#!/usr/bin/env node
/**
 * Оценка серверного распознавания POST /stt по контракту «Голос» v1.
 *
 *   1) контракт: /stt/health и блок stt в /health; коды 400 (bad_audio 48 кГц, too_short, плохая session),
 *      413 (45 с), 415 (text/plain), 429 busy (два запроса одной session в полёте) — всегда с Retry-After;
 *      у заглушки ещё ?mode=rate → 429 и ?mode=down → 503 с Retry-After: 10; поля ответа 200;
 *   2) качество: все клипы манифеста (.tmp/voice-audio, иначе scripts/voice/fixtures) → WER/CER по языкам,
 *      вариантам (clean / snr20 / snr10 / class / quiet / padded) и категориям (формулы, числа, команды);
 *      точность языка (lang ответа против манифеста) на клипах с речью ≥ 1,5 с; доля пустых ответов на тишине/шуме;
 *      формулы — доля точных совпадений после fixTranscript (как увидит учитель);
 *   3) задержка: мс клиента (запрос → ответ) и ms.total сервера, p50/p95 при concurrency 1 и нагрузочный
 *      прогон при 4 (--load=0 — пропустить);
 *   4) --partial: первые 1,2 / 2,4 / 3,6 с клипа как partial=1 — текст должен быть префиксом финального
 *      (нестрого: WER префикса ≤ 30 %).
 *
 * Пороги (приёмка владельца, живой сервер): WER clean ru ≤ 10 %, uz ≤ 15 %, en ≤ 15 %; SNR 10 дБ ≤ 2× clean
 * (но не строже 5 %); тишина/шум → пусто ≥ 98 %; язык ≥ 95 %; формулы ru ≥ 85 %, uz/en ≥ 70 %;
 * p95 ≤ 800 мс (concurrency 1) и ≤ 1500 мс (4); 45 с → 413. Нарушение → код выхода 1.
 *
 * Лимиты сервера (session 30/мин, IP 300/мин): у каждого клипа своя session; 429 → ждём Retry-After и повторяем
 * (ожидание в задержку не входит, счётчик повторов печатается).
 *
 * Запуск:
 *   npm run voice:eval -- --url=http://127.0.0.1:8796          (заглушка: npm run voice:mock)
 *   npm run voice:eval -- --with-mock                          (заглушка поднимается сама на свободном порту)
 *   npm run voice:eval -- --url=https://<funnel>  [--manifest=…] [--concurrency=1] [--load=4] [--only=ru,uz]
 *        [--variants=clean,snr10] [--limit=N] [--partial] [--json=.tmp/stt-eval.json] [--no-thresholds]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aggregate, chemExact, formatGroups, wer, type WerLang, type WerRow } from './wer.mts'
import { decodeWav, encodeWav, resample } from './wavio.mts'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

/* ------------------------------------------------------------ типы */

export interface EvalEntry {
  id: string
  phrase?: string
  lang: WerLang | 'none'
  text: string
  cat: string
  variant: string
  seconds: number
  file16: string
  file48?: string
  speech?: { startMs: number; endMs: number } | null
}

interface SttOk {
  ok: true
  text: string
  lang: string
  langSource?: string
  confidence?: number | null
  engine?: string
  device?: string
  ms?: { queue?: number; decode?: number; infer?: number; total?: number }
  durationMs?: number
  partial?: boolean
}

interface Shot {
  status: number
  body: Record<string, unknown> | null
  retryAfter: string | null
  clientMs: number
  retries: number
  waitedMs: number
}

export interface ClipResult {
  id: string
  lang: string
  variant: string
  cat: string
  ref: string
  hyp: string
  hypLang: string
  status: number
  clientMs: number
  serverMs: number | null
  wer: number | null
  speechMs: number
}

export interface Check {
  name: string
  ok: boolean
  /** мягкая проверка — печатается, но код выхода не портит */
  soft?: boolean
  detail: string
}

export interface EvalReport {
  url: string
  engine: string | null
  device: string | null
  clips: number
  retries: number
  checks: Check[]
  thresholds: Check[]
  groups: { byLang: ReturnType<typeof aggregate>; byVariant: ReturnType<typeof aggregate>; byCat: ReturnType<typeof aggregate> }
  latency: { c1: LatencyStats | null; load: LatencyStats | null }
  langAccuracy: Record<string, { n: number; ok: number }>
  emptyOnQuiet: { n: number; empty: number }
  formulas: Record<string, { n: number; exact: number }>
  partial: { n: number; ok: number; items: { id: string; cut: number; text: string; wer: number }[] } | null
  results: ClipResult[]
  ok: boolean
}

interface LatencyStats {
  concurrency: number
  n: number
  client: { p50: number; p95: number; max: number }
  server: { p50: number; p95: number } | null
}

export interface EvalOptions {
  url: string
  manifest?: string
  concurrency?: number
  load?: number
  only?: string[]
  variants?: string[]
  limit?: number
  partial?: boolean
  thresholds?: boolean
  quiet?: boolean
}

/* ------------------------------------------------------------ утилиты */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function pct(xs: number[], p: number): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]
}

async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i], i)
      }
    }),
  )
  return out
}

const RUN = Date.now().toString(36)
let seq = 0
const newSession = (tag: string) => `eval-${RUN}-${tag}-${(seq++).toString(36)}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64)

/** Один запрос /stt; 429 → ждём Retry-After и повторяем (до maxRetries), ожидание не входит в clientMs. */
async function postStt(
  base: string,
  body: Buffer,
  q: { lang?: string; session?: string; partial?: boolean; mode?: string },
  opts: { contentType?: string; retry429?: boolean; maxRetries?: number } = {},
): Promise<Shot> {
  const params = new URLSearchParams({ lang: q.lang ?? 'auto', session: q.session ?? newSession('x'), partial: q.partial ? '1' : '0' })
  if (q.mode) params.set('mode', q.mode)
  let retries = 0
  let waitedMs = 0
  for (;;) {
    const t = performance.now()
    let res: Response
    try {
      res = await fetch(`${base}/stt?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': opts.contentType ?? 'audio/wav' },
        body: new Uint8Array(body),
        signal: AbortSignal.timeout(30_000),
      })
    } catch (e) {
      return { status: 0, body: { ok: false, error: { code: 'network', message: String(e) } }, retryAfter: null, clientMs: performance.now() - t, retries, waitedMs }
    }
    const text = await res.text()
    const clientMs = performance.now() - t
    let json: Record<string, unknown> | null = null
    try {
      json = JSON.parse(text) as Record<string, unknown>
    } catch {
      json = null
    }
    const retryAfter = res.headers.get('retry-after')
    if (res.status === 429 && opts.retry429 && retries < (opts.maxRetries ?? 6)) {
      const wait = Math.min(65, Math.max(1, Number(retryAfter) || 2)) * 1000
      retries++
      waitedMs += wait
      await sleep(wait)
      continue
    }
    return { status: res.status, body: json, retryAfter, clientMs, retries, waitedMs }
  }
}

async function getJson(url: string): Promise<{ status: number; body: Record<string, unknown> | null }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    const t = await res.text()
    try {
      return { status: res.status, body: JSON.parse(t) as Record<string, unknown> }
    } catch {
      return { status: res.status, body: null }
    }
  } catch (e) {
    return { status: 0, body: { error: String(e) } }
  }
}

const errCode = (s: Shot) => ((s.body?.error as { code?: string } | undefined)?.code ?? '')

/* ------------------------------------------------------------ манифест */

export function loadManifest(file?: string): { base: string; entries: EvalEntry[]; file: string } {
  const candidates = file
    ? [resolve(ROOT, file)]
    : [join(ROOT, '.tmp', 'voice-audio', 'manifest.json'), join(HERE, 'fixtures', 'manifest.json')]
  for (const f of candidates) {
    if (!existsSync(f)) continue
    const m = JSON.parse(readFileSync(f, 'utf8')) as { entries: EvalEntry[] }
    return { base: dirname(f), entries: m.entries, file: f }
  }
  throw new Error(`нет манифеста (${candidates.join(' | ')}) — сначала npm run voice:audio`)
}

/* ------------------------------------------------------------ контракт */

function isSttOk(b: Record<string, unknown> | null): b is SttOk & Record<string, unknown> {
  return !!b && b.ok === true && typeof b.text === 'string' && typeof b.lang === 'string'
}

function shapeProblems(b: Record<string, unknown>): string[] {
  const p: string[] = []
  if (!['ru', 'uz', 'en', 'unknown'].includes(String(b.lang))) p.push(`lang=${String(b.lang)}`)
  if (!['hint', 'script', 'whisper'].includes(String(b.langSource))) p.push(`langSource=${String(b.langSource)}`)
  if (!(b.confidence === null || typeof b.confidence === 'number')) p.push('confidence')
  if (!['gigaam-large', 'gigaam', 'whisper-turbo', 'whisper-turbo-cpu', 'mock'].includes(String(b.engine))) p.push(`engine=${String(b.engine)}`)
  if (!['cuda', 'cpu'].includes(String(b.device))) p.push(`device=${String(b.device)}`)
  const ms = b.ms as Record<string, unknown> | undefined
  if (!ms || !['queue', 'decode', 'infer', 'total'].every((k) => typeof ms[k] === 'number')) p.push('ms{queue,decode,infer,total}')
  if (typeof b.durationMs !== 'number') p.push('durationMs')
  if (typeof b.partial !== 'boolean') p.push('partial')
  return p
}

async function contractChecks(url: string, man: { base: string; entries: EvalEntry[] }, engineHint: string | null): Promise<Check[]> {
  const out: Check[] = []
  const add = (name: string, ok: boolean, detail: string, soft = false) => out.push({ name, ok, detail, soft })

  // health
  const h = await getJson(`${url}/health`)
  const stt = h.body?.stt as { available?: unknown; langs?: unknown; device?: unknown } | undefined
  add(
    '/health: блок stt',
    h.status === 200 && h.body?.ok === true && !!stt && typeof stt.available === 'boolean' && Array.isArray(stt.langs),
    `HTTP ${h.status}, stt=${JSON.stringify(stt ?? null)}`,
  )
  const sh = await getJson(`${url}/stt/health`)
  const shb = sh.body ?? {}
  add(
    '/stt/health: поля',
    sh.status === 200 && shb.ok === true && typeof shb.available === 'boolean' && Array.isArray(shb.engines) && Array.isArray(shb.langs) && shb.maxSeconds === 25 && typeof (shb.queue as Record<string, unknown> | undefined)?.running === 'number',
    `HTTP ${sh.status}, available=${String(shb.available)}, engines=${Array.isArray(shb.engines) ? (shb.engines as { name?: string }[]).map((e) => e.name).join(',') : '—'}`,
  )

  const pick = (pred: (e: EvalEntry) => boolean) => man.entries.find(pred)
  const short = pick((e) => e.variant === 'clean' && e.lang === 'ru' && e.seconds >= 1.5 && e.seconds <= 6) ?? pick((e) => !!e.text)
  if (!short) {
    add('клип для проверок', false, 'в манифесте нет клипа с речью')
    return out
  }
  const wav = readFileSync(join(man.base, short.file16))

  // 200 + поля
  const ok = await postStt(url, wav, { lang: 'ru', session: newSession('shape') }, { retry429: true })
  add('200: поля ответа', ok.status === 200 && isSttOk(ok.body) && shapeProblems(ok.body).length === 0, `HTTP ${ok.status} ${ok.body ? shapeProblems(ok.body).join(', ') || 'поля на месте' : 'не JSON'}`)
  const okp = await postStt(url, wav, { lang: 'ru', session: newSession('shape-p'), partial: true }, { retry429: true })
  add('200 partial=1: partial=true', okp.status === 200 && okp.body?.partial === true, `HTTP ${okp.status}, partial=${String(okp.body?.partial)}`)

  // 400: 48 кГц
  const e48 = pick((e) => !!e.file48 && e.seconds <= 8 && !!e.text)
  const pcm = decodeWav(wav)
  const wav48 = e48 && existsSync(join(man.base, e48.file48!)) ? readFileSync(join(man.base, e48.file48!)) : encodeWav(resample(pcm.samples, pcm.rate, 48000), 48000)
  const r48 = await postStt(url, wav48, { lang: 'ru', session: newSession('r48') }, { retry429: true })
  add('400 bad_audio на 48 кГц', r48.status === 400 && errCode(r48) === 'bad_audio', `HTTP ${r48.status} ${errCode(r48)}`)

  // 400: too_short (0,1 с)
  const tiny = encodeWav(pcm.samples.slice(0, 1600), 16000)
  const rs = await postStt(url, tiny, { lang: 'ru', session: newSession('short') }, { retry429: true })
  add('400 too_short (0,1 с)', rs.status === 400 && errCode(rs) === 'too_short', `HTTP ${rs.status} ${errCode(rs)}`)

  // 400: плохая session
  const rb = await postStt(url, wav, { lang: 'ru', session: 'плохая сессия!' }, { retry429: true })
  add('400 на плохую session', rb.status === 400, `HTTP ${rb.status} ${errCode(rb)}`)

  // 415
  const r415 = await postStt(url, Buffer.from('привет'), { lang: 'ru', session: newSession('415') }, { contentType: 'text/plain', retry429: true })
  add('415 на text/plain', r415.status === 415 && errCode(r415) === 'unsupported_media_type', `HTTP ${r415.status} ${errCode(r415)}`)

  // 413: длинная речь 45 с
  const long = pick((e) => e.variant === 'long')
  const longWav = long ? readFileSync(join(man.base, long.file16)) : encodeWav(new Float32Array(45 * 16000).map((_, i) => Math.sin(i / 7) * 0.2), 16000)
  const r413 = await postStt(url, longWav, { lang: 'ru', session: newSession('long') }, { retry429: true })
  add('413 too_long на 45 с', r413.status === 413 && errCode(r413) === 'too_long', `HTTP ${r413.status} ${errCode(r413)} (${(longWav.length / 1024).toFixed(0)} КБ)`)

  // 429 busy: три запроса одной session одновременно (у живого сервера гонка возможна — мягкая проверка)
  const longest = man.entries.filter((e) => !!e.text && e.seconds <= 20 && e.variant !== 'long').sort((a, b) => b.seconds - a.seconds)[0] ?? short
  const busyWav = readFileSync(join(man.base, longest.file16))
  const sess = newSession('busy')
  const trio = await Promise.all([0, 1, 2].map(() => postStt(url, busyWav, { lang: 'ru', session: sess })))
  const busy = trio.find((s) => s.status === 429)
  add(
    '429 busy (одна session в полёте) + Retry-After',
    !!busy && errCode(busy) === 'busy' && !!busy.retryAfter,
    `коды ${trio.map((s) => `${s.status}${errCode(s) ? ` ${errCode(s)}` : ''}`).join(' / ')}${busy ? `, Retry-After=${busy.retryAfter}` : ''}`,
    engineHint !== 'mock',
  )

  // только заглушка: режимы rate / down
  if (engineHint === 'mock') {
    const rr = await postStt(url, wav, { lang: 'ru', session: newSession('rate'), mode: 'rate' })
    add('заглушка ?mode=rate → 429 rate + Retry-After', rr.status === 429 && errCode(rr) === 'rate' && !!rr.retryAfter, `HTTP ${rr.status} ${errCode(rr)} Retry-After=${rr.retryAfter}`)
    const rd = await postStt(url, wav, { lang: 'ru', session: newSession('down'), mode: 'down' })
    add('заглушка ?mode=down → 503 + Retry-After: 10', rd.status === 503 && errCode(rd) === 'stt_unavailable' && rd.retryAfter === '10', `HTTP ${rd.status} ${errCode(rd)} Retry-After=${rd.retryAfter}`)
  }
  return out
}

/* ------------------------------------------------------------ прогон клипов */

async function runClips(url: string, man: { base: string }, entries: EvalEntry[], concurrency: number, onRetry: (n: number) => void): Promise<ClipResult[]> {
  let done = 0
  return pool(entries, concurrency, async (e) => {
    const body = readFileSync(join(man.base, e.file16))
    const hint = e.lang === 'none' ? 'auto' : e.lang
    const s = await postStt(url, body, { lang: hint, session: newSession(e.id) }, { retry429: true })
    onRetry(s.retries)
    done++
    if (done % 50 === 0) process.stdout.write(`  … ${done}/${entries.length}\n`)
    const ok = s.status === 200 && isSttOk(s.body)
    const hyp = ok ? String(s.body!.text) : ''
    const speechMs = e.speech ? e.speech.endMs - e.speech.startMs : 0
    return {
      id: e.id,
      lang: e.lang,
      variant: e.variant,
      cat: e.cat,
      ref: e.text,
      hyp,
      hypLang: ok ? String(s.body!.lang) : '',
      status: s.status,
      clientMs: Math.round(s.clientMs),
      serverMs: ok ? Number((s.body!.ms as { total?: number } | undefined)?.total ?? NaN) : null,
      wer: e.lang !== 'none' && e.text ? wer(e.text, hyp, e.lang).wer : null,
      speechMs,
    }
  })
}

function latency(rs: ClipResult[], concurrency: number): LatencyStats | null {
  const ok = rs.filter((r) => r.status === 200)
  if (!ok.length) return null
  const c = ok.map((r) => r.clientMs)
  const sv = ok.map((r) => r.serverMs).filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  return {
    concurrency,
    n: ok.length,
    client: { p50: pct(c, 50), p95: pct(c, 95), max: Math.max(...c) },
    server: sv.length ? { p50: pct(sv, 50), p95: pct(sv, 95) } : null,
  }
}

/* ------------------------------------------------------------ partial */

async function partialChecks(url: string, man: { base: string }, entries: EvalEntry[], finals: Map<string, string>): Promise<NonNullable<EvalReport['partial']>> {
  const items: { id: string; cut: number; text: string; wer: number }[] = []
  let ok = 0
  const pickd = entries.filter((e) => e.variant === 'clean' && e.lang !== 'none' && e.seconds >= 3).slice(0, 24)
  for (const e of pickd) {
    const fin = finals.get(e.id) ?? e.text
    const pcm = decodeWav(readFileSync(join(man.base, e.file16)))
    for (const cut of [1.2, 2.4, 3.6]) {
      if (cut >= e.seconds) continue
      const body = encodeWav(pcm.samples.slice(0, Math.round(cut * pcm.rate)), pcm.rate)
      const s = await postStt(url, body, { lang: e.lang, session: newSession(`p-${e.id}`), partial: true }, { retry429: true })
      const text = s.status === 200 && isSttOk(s.body) ? String(s.body.text) : ''
      // префикс финального текста той же длины в словах (нестрого: ±1 слово — берём лучший)
      const fw = fin.split(/\s+/).filter(Boolean)
      const n = text.split(/\s+/).filter(Boolean).length
      let best = n ? 1 : 0
      for (const k of [n - 1, n, n + 1]) if (k > 0 && k <= fw.length) best = Math.min(best, wer(fw.slice(0, k).join(' '), text, e.lang as WerLang).wer)
      items.push({ id: e.id, cut, text, wer: best })
      if (best <= 0.3) ok++
    }
  }
  return { n: items.length, ok, items }
}

/* ------------------------------------------------------------ главный прогон */

export async function runEval(opts: EvalOptions): Promise<EvalReport> {
  const url = opts.url.replace(/\/+$/, '')
  const say = (s: string) => {
    if (!opts.quiet) console.log(s)
  }
  const man = loadManifest(opts.manifest)
  say(`манифест: ${man.file} (${man.entries.length} клипов)`)

  const sh = await getJson(`${url}/stt/health`)
  const engines = (sh.body?.engines as { name?: string; device?: string }[] | undefined) ?? []
  const engine = engines[0]?.name ?? null
  const device = engines[0]?.device ?? null
  say(`сервер: ${url} — /stt/health HTTP ${sh.status}, движки ${engines.map((e) => `${e.name}/${e.device}`).join(', ') || '—'}`)

  const checks = await contractChecks(url, man, engine)

  let entries = man.entries.filter((e) => e.variant !== 'long')
  if (opts.only?.length) entries = entries.filter((e) => opts.only!.includes(e.lang) || (e.lang === 'none' && opts.only!.includes('none')))
  if (opts.variants?.length) entries = entries.filter((e) => opts.variants!.includes(e.variant))
  if (opts.limit) entries = entries.slice(0, opts.limit)

  let retries = 0
  const conc = Math.max(1, opts.concurrency ?? 1)
  say(`клипы: ${entries.length}, concurrency ${conc}…`)
  const results = await runClips(url, man, entries, conc, (n) => (retries += n))

  // нагрузка: clean-клипы при concurrency N (по умолчанию 4)
  let load: LatencyStats | null = null
  const loadN = opts.load ?? 4
  if (loadN > 1 && conc !== loadN) {
    const sub = entries.filter((e) => e.variant === 'clean' && e.lang !== 'none').slice(0, 60)
    if (sub.length) {
      say(`нагрузка: ${sub.length} клипов при concurrency ${loadN}…`)
      load = latency(await runClips(url, man, sub, loadN, (n) => (retries += n)), loadN)
    }
  }

  // метрики
  const speechRows: WerRow[] = results
    .filter((r) => r.lang !== 'none' && r.ref && r.status === 200)
    .map((r) => ({ id: r.id, lang: r.lang as WerLang, variant: r.variant, cat: r.cat, ref: r.ref, hyp: r.hyp }))
  const byLang = aggregate(speechRows.filter((r) => r.variant === 'clean'), (r) => `${r.lang} clean`)
  const byVariant = aggregate(speechRows, (r) => `${r.lang} ${r.variant}`)
  const byCat = aggregate(speechRows.filter((r) => ['formula', 'number', 'command'].includes(r.cat)), (r) => `${r.lang} ${r.cat}`)

  const langAccuracy: EvalReport['langAccuracy'] = {}
  for (const r of results) {
    if (r.lang === 'none' || !r.ref || r.status !== 200 || r.speechMs < 1500 || r.cat === 'teacher') continue
    const a = (langAccuracy[r.lang] ??= { n: 0, ok: 0 })
    a.n++
    if (r.hypLang === r.lang) a.ok++
  }
  const quiet = results.filter((r) => r.lang === 'none')
  const emptyOnQuiet = { n: quiet.length, empty: quiet.filter((r) => r.status === 200 && !r.hyp.trim()).length }
  const formulas: EvalReport['formulas'] = {}
  for (const r of results) {
    if (r.cat !== 'formula' || r.variant !== 'clean' || r.lang === 'none') continue
    const f = (formulas[r.lang] ??= { n: 0, exact: 0 })
    f.n++
    if (r.status === 200 && chemExact(r.ref, r.hyp, r.lang as WerLang)) f.exact++
  }

  const finals = new Map(results.map((r) => [r.id, r.hyp]))
  const partial = opts.partial ? await partialChecks(url, man, entries, finals) : null

  // пороги
  const thresholds: Check[] = []
  const T = (name: string, ok: boolean, detail: string) => thresholds.push({ name, ok, detail })
  const fmt = (x: number) => `${(x * 100).toFixed(1)} %`
  const LIM: Record<string, number> = { ru: 0.1, uz: 0.15, en: 0.15 }
  const wClean = new Map(byLang.map((g) => [g.key.split(' ')[0], g.wer]))
  const wByVar = new Map(byVariant.map((g) => [g.key, g.wer]))
  for (const lang of ['ru', 'uz', 'en']) {
    if (!wClean.has(lang)) continue
    const c = wClean.get(lang)!
    T(`WER clean ${lang} ≤ ${LIM[lang] * 100} %`, c <= LIM[lang], fmt(c))
    const n10 = wByVar.get(`${lang} snr10`)
    if (n10 !== undefined) {
      const lim = Math.max(2 * c, 0.05)
      T(`WER SNR 10 дБ ${lang} ≤ 2× clean (≥ 5 %)`, n10 <= lim, `${fmt(n10)} (предел ${fmt(lim)})`)
    }
  }
  if (emptyOnQuiet.n) T('тишина/шум → пусто ≥ 98 %', emptyOnQuiet.empty / emptyOnQuiet.n >= 0.98, `${emptyOnQuiet.empty}/${emptyOnQuiet.n}`)
  for (const [lang, a] of Object.entries(langAccuracy)) if (a.n) T(`язык ${lang} ≥ 95 % (речь ≥ 1,5 с)`, a.ok / a.n >= 0.95, `${a.ok}/${a.n}`)
  for (const [lang, f] of Object.entries(formulas)) {
    const lim = lang === 'ru' ? 0.85 : 0.7
    if (f.n) T(`формулы ${lang} после fixTranscript ≥ ${lim * 100} %`, f.exact / f.n >= lim, `${f.exact}/${f.n}`)
  }
  const c1 = conc === 1 ? latency(results, 1) : null
  const loadStats = conc === 1 ? load : latency(results, conc)
  if (c1) T('p95 /stt ≤ 800 мс (concurrency 1)', c1.client.p95 <= 800, `p50 ${c1.client.p50.toFixed(0)} мс, p95 ${c1.client.p95.toFixed(0)} мс`)
  if (loadStats) T(`p95 /stt ≤ 1500 мс (concurrency ${loadStats.concurrency})`, loadStats.client.p95 <= 1500, `p50 ${loadStats.client.p50.toFixed(0)} мс, p95 ${loadStats.client.p95.toFixed(0)} мс`)
  const http = results.filter((r) => r.status !== 200)
  T('все клипы → HTTP 200', http.length === 0, http.length ? http.slice(0, 5).map((r) => `${r.id}: ${r.status}`).join(', ') : `${results.length}/${results.length}`)
  if (partial) T('partial: префикс финального (WER ≤ 30 %) ≥ 90 %', partial.n === 0 || partial.ok / partial.n >= 0.9, `${partial.ok}/${partial.n}`)

  const useThresholds = opts.thresholds !== false
  const ok = checks.every((c) => c.ok || c.soft) && (!useThresholds || thresholds.every((t) => t.ok))
  return {
    url,
    engine,
    device,
    clips: results.length,
    retries,
    checks,
    thresholds,
    groups: { byLang, byVariant, byCat },
    latency: { c1, load: loadStats },
    langAccuracy,
    emptyOnQuiet,
    formulas,
    partial,
    results,
    ok,
  }
}

export function printReport(r: EvalReport): void {
  const mark = (c: Check) => (c.ok ? '  ok  ' : c.soft ? '  warn' : '  FAIL')
  console.log(`\n=== контракт /stt (${r.url}, движок ${r.engine ?? '—'}/${r.device ?? '—'}) ===`)
  for (const c of r.checks) console.log(`${mark(c)} ${c.name} — ${c.detail}`)
  console.log('')
  console.log(formatGroups('WER по языкам (clean):', r.groups.byLang))
  console.log(formatGroups('WER по вариантам:', r.groups.byVariant))
  console.log(formatGroups('WER по категориям (формулы / числа / команды):', r.groups.byCat))
  const lat = (l: LatencyStats | null) =>
    l ? `n=${l.n}, клиент p50 ${l.client.p50.toFixed(0)} / p95 ${l.client.p95.toFixed(0)} / max ${l.client.max.toFixed(0)} мс${l.server ? `; сервер ms.total p50 ${l.server.p50.toFixed(0)} / p95 ${l.server.p95.toFixed(0)}` : ''}` : '—'
  console.log(`\nзадержка c=1: ${lat(r.latency.c1)}`)
  console.log(`задержка c=${r.latency.load?.concurrency ?? '—'}: ${lat(r.latency.load)}`)
  console.log(`повторов после 429: ${r.retries}`)
  const worst = r.results.filter((x) => (x.wer ?? 0) > 0 && x.variant === 'clean').sort((a, b) => (b.wer ?? 0) - (a.wer ?? 0)).slice(0, 8)
  if (worst.length) {
    console.log('\nхудшие clean-клипы:')
    for (const w of worst) console.log(`  ${w.id.padEnd(16)} WER ${((w.wer ?? 0) * 100).toFixed(0).padStart(3)} %  «${w.ref}» → «${w.hyp}»`)
  }
  if (r.partial) console.log(`\npartial: ${r.partial.ok}/${r.partial.n} — префикс финального текста`)
  console.log('\n=== пороги ===')
  for (const t of r.thresholds) console.log(`${mark(t)} ${t.name} — ${t.detail}`)
  console.log(`\nитог: ${r.ok ? 'ПРОЙДЕНО' : 'НЕ ПРОЙДЕНО'} (${r.clips} клипов)`)
}

/* ------------------------------------------------------------ CLI */

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...v] = a.replace(/^--/, '').split('=')
      return [k, v.length ? v.join('=') : '1']
    }),
  ) as Record<string, string>
  ;(async () => {
    let mock: { url: string; close(): Promise<void> } | null = null
    let url = args.url ?? 'http://127.0.0.1:8796'
    if (args['with-mock'] === '1') {
      const { startMockServer } = await import('./stt-mock-server.mts')
      const man = loadManifest(args.manifest)
      mock = await startMockServer({ port: 0, manifests: [join(man.base, 'manifest.json'), join(HERE, 'fixtures', 'manifest.json')], quiet: true })
      url = mock.url
      console.log(`заглушка поднята: ${url}`)
    }
    try {
      const report = await runEval({
        url,
        manifest: args.manifest,
        concurrency: Number(args.concurrency ?? 1),
        load: Number(args.load ?? 4),
        only: args.only ? args.only.split(',') : undefined,
        variants: args.variants ? args.variants.split(',') : undefined,
        limit: args.limit ? Number(args.limit) : undefined,
        partial: args.partial === '1',
        thresholds: args['no-thresholds'] !== '1',
      })
      printReport(report)
      const out = args.json === '1' ? join(ROOT, '.tmp', 'stt-eval.json') : args.json ? resolve(ROOT, args.json) : null
      if (out) {
        mkdirSync(dirname(out), { recursive: true })
        writeFileSync(out, JSON.stringify(report, null, 1) + '\n')
        console.log(`JSON: ${out}`)
      }
      process.exitCode = report.ok ? 0 : 1
    } finally {
      await mock?.close()
    }
  })().catch((e) => {
    console.error(e instanceof Error ? e.stack ?? e.message : e)
    process.exit(1)
  })
}
