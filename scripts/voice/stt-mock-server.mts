#!/usr/bin/env node
/**
 * Заглушка мозга для голосового пути: /stt, /stt/health, /health, минимальный /chat (SSE) — по контракту «Голос» v1.
 * Нужна e2e-voice (Playwright) и исполнителю сайта для отладки без ПК друга.
 *
 * Текст распознавания:
 *   1) заголовок X-Mock-Text (URI-кодированный) — как есть;
 *   2) sha1 тела = файл из манифеста (stt-eval шлёт ровно файлы .tmp/voice-audio) — текст клипа;
 *   3) заголовок X-Mock-Clip: <id клипа> — сегмент выравнивается по огибающей громкости с клипом (фейковый микрофон
 *      Chrome отдаёт сайту тот же звук, но обрезанный сегментатором и пропущенный через AGC/шумодав): текст фраз,
 *      попавших в окно; для partial=1 — префикс по доле прозвучавшего;
 *   4) иначе — пустой текст.
 * Язык — detectLang из brain/pipeline/normalize.ts (как будет на сервере), пусто → подсказка lang.
 *
 * Режимы (query ?mode= у /stt или глобально --mode= / POST /mock/mode?mode=): normal | slow (1,5 с) | down (503) |
 * rate (каждый нечётный запрос сессии → 429 Retry-After: 1, повтор проходит).
 * Служебное: GET /mock/stats (счётчики, последние ответы), POST /mock/reset.
 *
 * Запуск: npm run voice:mock [-- --port=8796] [--manifest=.tmp/voice-audio/manifest.json] [--mode=slow] [--quiet]
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectLang } from '../../brain/pipeline/normalize.ts'
import { checkSttWav, decodeWav, envelope, resample, sha1, speechBounds, STT_MAX_BODY_BYTES } from './wavio.mts'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

export type MockMode = 'normal' | 'slow' | 'down' | 'rate'

export interface MockClip {
  id: string
  /** 16 кГц, ровно то, что звучит в микрофон (вместе с тишиной до/после) */
  samples: Float32Array
  segments: { startMs: number; endMs: number; text: string }[]
}

export interface MockSttLog {
  at: number
  status: number
  session: string
  partial: boolean
  text: string
  lang: string
  durationMs: number
  bytes: number
  source: 'header' | 'hash' | 'clip' | 'none' | 'error'
  code?: string
}

export interface MockServer {
  url: string
  port: number
  close(): Promise<void>
  setMode(m: MockMode): void
  registerClip(c: MockClip): void
  stats: { stt: MockSttLog[]; chat: { at: number; text: string }[]; health: number; sttHealth: number }
  reset(): void
}

export interface MockOptions {
  port?: number
  host?: string
  manifests?: string[]
  mode?: MockMode
  /** имитация распознавания, мс (normal) */
  inferMs?: number
  quiet?: boolean
}

interface ManifestLike {
  entries: { id: string; text: string; lang: string; file16: string; sha1?: string; segments?: { startMs: number; endMs: number; text: string }[]; speech?: { startMs: number; endMs: number } | null }[]
}

const LANGS = ['ru', 'uz', 'en']
const SESSION_RE = /^[A-Za-z0-9_-]{1,64}$/

/* ------------------------------------------------------------ выравнивание сегмента с клипом */

function zlog(env: Float32Array): Float32Array {
  const e = env.map((v) => Math.log10(v + 1e-4))
  let m = 0
  for (const v of e) m += v
  m /= e.length || 1
  let s = 0
  for (const v of e) s += (v - m) ** 2
  s = Math.sqrt(s / (e.length || 1)) || 1
  return e.map((v) => (v - m) / s)
}

/** Где в клипе лежит полученный сегмент: смещение (мс) с максимальной корреляцией лог-огибающих. */
export function alignOffsetMs(clip: Float32Array, seg: Float32Array, rate = 16000): number {
  const FR = 20
  const a = zlog(envelope(clip, rate, FR))
  const b = zlog(envelope(seg, rate, FR))
  if (!a.length || !b.length) return 0
  let best = -Infinity
  let bestOff = 0
  const minOverlap = Math.max(5, Math.floor(b.length * 0.6))
  for (let off = -b.length + minOverlap; off <= a.length - minOverlap; off++) {
    let s = 0
    let n = 0
    const i0 = Math.max(0, -off)
    const i1 = Math.min(b.length, a.length - off)
    for (let i = i0; i < i1; i++) {
      s += b[i] * a[i + off]
      n++
    }
    if (n < minOverlap) continue
    const score = s / n
    if (score > best) {
      best = score
      bestOff = off
    }
  }
  return bestOff * FR
}

/** Текст фраз клипа, попавших в окно [from, to] мс; partial — последняя фраза обрезается по доле прозвучавшего. */
export function textForWindow(clip: MockClip, fromMs: number, toMs: number, partial: boolean): string {
  const out: string[] = []
  for (const s of clip.segments) {
    const len = Math.max(1, s.endMs - s.startMs)
    const ov = Math.min(toMs, s.endMs) - Math.max(fromMs, s.startMs)
    const f = ov / len
    if (f <= 0) continue
    if (f >= 0.6) out.push(s.text)
    else if (partial) {
      const words = s.text.split(/\s+/)
      const k = Math.floor(words.length * f)
      if (k > 0) out.push(words.slice(0, k).join(' '))
    } else if (f >= 0.35) out.push(s.text)
  }
  return out.join(' ').trim()
}

function hasSpeech(x: Float32Array): boolean {
  const env = envelope(x, 16000, 20)
  let n = 0
  for (const v of env) if (v > 0.01) n++
  return n >= 6
}

/* ------------------------------------------------------------ сервер */

export async function startMockServer(opts: MockOptions = {}): Promise<MockServer> {
  let mode: MockMode = opts.mode ?? 'normal'
  const inferMs = opts.inferMs ?? 60
  const log = (...a: unknown[]) => {
    if (!opts.quiet) console.log('[mock]', ...a)
  }
  const t0 = Date.now()

  // манифесты: sha1 → текст; id → клип (лениво)
  const byHash = new Map<string, { text: string; lang: string; id: string }>()
  const clipFiles = new Map<string, { file: string; segments?: MockClip['segments']; text: string; speech?: { startMs: number; endMs: number } | null }>()
  for (const m of opts.manifests ?? []) {
    if (!existsSync(m)) continue
    const man = JSON.parse(readFileSync(m, 'utf8')) as ManifestLike
    const base = dirname(resolve(m))
    for (const e of man.entries) {
      const file = join(base, e.file16)
      const h = e.sha1 ?? (existsSync(file) ? sha1(readFileSync(file)) : null)
      if (h) byHash.set(h, { text: e.text, lang: e.lang, id: e.id })
      clipFiles.set(e.id, { file, segments: e.segments, text: e.text, speech: e.speech })
    }
    log(`манифест ${m}: ${man.entries.length} клипов`)
  }
  const clips = new Map<string, MockClip>()
  const getClip = (id: string): MockClip | null => {
    const c = clips.get(id)
    if (c) return c
    const f = clipFiles.get(id)
    if (!f || !existsSync(f.file)) return null
    const pcm = decodeWav(readFileSync(f.file))
    const samples = pcm.rate === 16000 ? pcm.samples : resample(pcm.samples, pcm.rate, 16000)
    const b = f.speech ?? speechBounds(samples, 16000)
    const clip: MockClip = { id, samples, segments: f.segments ?? (f.text && b ? [{ ...b, text: f.text }] : []) }
    clips.set(id, clip)
    return clip
  }

  const stats: MockServer['stats'] = { stt: [], chat: [], health: 0, sttHealth: 0 }
  const inFlight = new Set<string>()
  const rateCount = new Map<string, number>()
  const windowHits = new Map<string, number[]>()

  const cors = (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Mock-Text, X-Mock-Clip')
    res.setHeader('Access-Control-Expose-Headers', 'Retry-After')
    res.setHeader('Access-Control-Max-Age', '600')
  }
  const json = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
    res.end(JSON.stringify(body))
  }
  const fail = (res: ServerResponse, status: number, code: string, message: string, headers: Record<string, string> = {}) =>
    json(res, status, { ok: false, error: { code, message } }, headers)

  const readBody = (req: IncomingMessage, limit: number) =>
    new Promise<Buffer | 'too_big'>((resolveBody, reject) => {
      const parts: Buffer[] = []
      let n = 0
      let over = false
      req.on('data', (c: Buffer) => {
        n += c.length
        if (n > limit) over = true
        else parts.push(c)
      })
      req.on('end', () => resolveBody(over ? 'too_big' : Buffer.concat(parts)))
      req.on('error', reject)
    })

  const sttAvailable = () => mode !== 'down'

  async function handleStt(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const q = url.searchParams
    const m = (q.get('mode') as MockMode | null) ?? mode
    const session = q.get('session') ?? ''
    const lang = q.get('lang') ?? 'auto'
    const partial = q.get('partial') === '1'
    const rec = (status: number, extra: Partial<MockSttLog>) => {
      const e: MockSttLog = { at: Date.now(), status, session, partial, text: '', lang: '', durationMs: 0, bytes: 0, source: 'error', ...extra }
      stats.stt.push(e)
      if (stats.stt.length > 500) stats.stt.shift()
      log(`/stt ${status} session=${session} partial=${partial ? 1 : 0} ${e.code ?? ''} «${e.text}»`)
    }
    if (m === 'down') {
      await readBody(req, STT_MAX_BODY_BYTES).catch(() => null)
      rec(503, { code: 'stt_unavailable' })
      return fail(res, 503, 'stt_unavailable', 'распознавание недоступно (заглушка: mode=down)', { 'Retry-After': '10' })
    }
    if (!SESSION_RE.test(session) || !(lang === 'auto' || LANGS.includes(lang))) {
      rec(400, { code: 'bad_request' })
      return fail(res, 400, 'bad_request', 'нужны lang=ru|uz|en|auto и session=[A-Za-z0-9_-]{1,64}')
    }
    const ct = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
    if (!['audio/wav', 'audio/x-wav', 'audio/wave', 'application/octet-stream'].includes(ct)) {
      await readBody(req, STT_MAX_BODY_BYTES).catch(() => null)
      rec(415, { code: 'unsupported_media_type' })
      return fail(res, 415, 'unsupported_media_type', 'нужен audio/wav (PCM16 моно 16 кГц)')
    }
    const declared = Number(req.headers['content-length'] ?? NaN)
    if (Number.isFinite(declared) && declared > STT_MAX_BODY_BYTES) {
      req.resume()
      rec(413, { code: 'too_long' })
      return fail(res, 413, 'too_long', 'тело больше 1 МиБ')
    }
    // лимиты сессии (как на сервере, упрощённо): busy — второй запрос в полёте; 30/мин финальных, 60/мин partial
    if (inFlight.has(session)) {
      await readBody(req, STT_MAX_BODY_BYTES).catch(() => null)
      rec(429, { code: 'busy' })
      return fail(res, 429, 'busy', 'предыдущий запрос этой сессии ещё распознаётся', { 'Retry-After': '1' })
    }
    const key = `${session}:${partial ? 'p' : 'f'}`
    const now = Date.now()
    const hits = (windowHits.get(key) ?? []).filter((t) => now - t < 60_000)
    if (hits.length >= (partial ? 60 : 30)) {
      req.resume()
      rec(429, { code: 'rate' })
      return fail(res, 429, 'rate', 'слишком часто', { 'Retry-After': String(Math.ceil((60_000 - (now - hits[0])) / 1000)) })
    }
    if (m === 'rate') {
      const n = (rateCount.get(session) ?? 0) + 1
      rateCount.set(session, n)
      if (n % 2 === 1) {
        await readBody(req, STT_MAX_BODY_BYTES).catch(() => null)
        rec(429, { code: 'rate' })
        return fail(res, 429, 'rate', 'заглушка: mode=rate', { 'Retry-After': '1' })
      }
    }
    inFlight.add(session)
    try {
      const body = await readBody(req, STT_MAX_BODY_BYTES)
      if (body === 'too_big') {
        rec(413, { code: 'too_long' })
        return fail(res, 413, 'too_long', 'тело больше 1 МиБ')
      }
      const check = checkSttWav(body)
      if (!check.ok) {
        rec(check.status, { code: check.code, bytes: body.length })
        return json(res, check.status, { ok: false, error: { code: check.code, message: check.detail ?? check.code, ...(check.detail ? { detail: check.detail } : {}) } })
      }
      hits.push(now)
      windowHits.set(key, hits)
      const tq = Date.now()
      await new Promise((r) => setTimeout(r, m === 'slow' ? 1500 : inferMs))
      let text = ''
      let source: MockSttLog['source'] = 'none'
      const hdrText = req.headers['x-mock-text']
      const hdrClip = req.headers['x-mock-clip']
      const hashHit = byHash.get(sha1(body))
      if (typeof hdrText === 'string') {
        text = decodeURIComponent(hdrText)
        source = 'header'
      } else if (hashHit) {
        text = hashHit.text
        source = 'hash'
      } else if (typeof hdrClip === 'string') {
        const clip = getClip(hdrClip)
        const seg = decodeWav(body).samples
        if (clip && hasSpeech(seg)) {
          const off = alignOffsetMs(clip.samples, seg)
          text = textForWindow(clip, off, off + check.info.durationMs, partial)
        }
        source = 'clip'
      }
      // язык: письмо (кириллица/латиница) решает «ru против uz/en», внутри латиницы побеждает подсказка
      // (detectLang путает короткие узбекские формулы словами «ka el kaliy xlorid» с английским)
      const byText = text ? detectLang(text) : null
      const cyr = /[а-яё]/i.test(text)
      const hintFits = byText !== null && !cyr && (lang === 'uz' || lang === 'en')
      const detected = hintFits ? null : byText
      const outLang = detected ?? (lang === 'auto' ? 'unknown' : lang)
      const total = Date.now() - tq
      rec(200, { text, lang: outLang, durationMs: check.info.durationMs, bytes: body.length, source })
      json(res, 200, {
        ok: true,
        text,
        lang: outLang,
        langSource: detected ? 'script' : 'hint',
        confidence: null,
        engine: 'mock',
        device: 'cpu',
        ms: { queue: 0, decode: 1, infer: Math.max(0, total - 1), total },
        durationMs: check.info.durationMs,
        partial,
      })
    } finally {
      inFlight.delete(session)
    }
  }

  async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await readBody(req, 2_000_000)
    let text = ''
    try {
      const j = JSON.parse(String(body)) as { messages?: { role: string; content: string }[] }
      const last = [...(j.messages ?? [])].reverse().find((x) => x.role === 'user')
      text = last?.content ?? ''
    } catch {
      /* пусто */
    }
    stats.chat.push({ at: Date.now(), text })
    log(`/chat «${text.slice(0, 80)}»`)
    const lang = text ? detectLang(text) : 'ru'
    const reply = lang === 'en' ? `Got it: ${text}` : lang === 'uz' ? `Tushundim: ${text}` : `Понял: ${text}`
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    const turnId = `mock-${Date.now().toString(36)}`
    send('meta', { turnId, intent: 'chemistry', route: 'mock', moderated: false, lang })
    const half = Math.ceil(reply.length / 2)
    send('delta', { text: reply.slice(0, half) })
    await new Promise((r) => setTimeout(r, 40))
    send('delta', { text: reply.slice(half) })
    send('done', { text: reply, source: 'llm', citations: [], confidence: 0.9, confidenceLabel: 'high', student: null, ms: 80 })
    res.end()
  }

  const server = createServer((req, res) => {
    cors(req, res)
    const url = new URL(req.url ?? '/', 'http://mock')
    const path = url.pathname.replace(/\/+$/, '') || '/'
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    void (async () => {
      try {
        if (req.method === 'GET' && path === '/health') {
          stats.health++
          return json(res, 200, {
            ok: true,
            service: 'atomlab-brain',
            version: 'mock',
            contract: 1,
            llm: { available: true, chatModel: 'mock', fastModel: null, embedModel: null },
            kb: { docs: 0, journalLines: 0, embedded: 0 },
            uptimeMs: Date.now() - t0,
            stt: { available: sttAvailable(), langs: LANGS, device: sttAvailable() ? 'cpu' : null },
          })
        }
        if (req.method === 'GET' && path === '/stt/health') {
          stats.sttHealth++
          return json(res, 200, {
            ok: true,
            available: sttAvailable(),
            engines: [{ name: 'mock', device: 'cpu', loaded: sttAvailable(), langs: LANGS }],
            langs: LANGS,
            maxSeconds: 25,
            queue: { running: inFlight.size, waiting: 0 },
          })
        }
        if (req.method === 'POST' && path === '/stt') return await handleStt(req, res, url)
        if (req.method === 'POST' && path === '/chat') return await handleChat(req, res)
        if (req.method === 'GET' && path === '/mock/stats') return json(res, 200, { mode, ...stats })
        if (req.method === 'POST' && path === '/mock/mode') {
          mode = (url.searchParams.get('mode') as MockMode) ?? 'normal'
          return json(res, 200, { ok: true, mode })
        }
        if (req.method === 'POST' && path === '/mock/reset') {
          api.reset()
          return json(res, 200, { ok: true })
        }
        fail(res, 404, 'not_found', path)
      } catch (e) {
        if (!res.headersSent) fail(res, 500, 'internal', String(e))
        else res.end()
      }
    })()
  })

  const host = opts.host ?? '127.0.0.1'
  await new Promise<void>((r, j) => {
    server.once('error', j)
    server.listen(opts.port ?? 8796, host, () => r())
  })
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : opts.port ?? 8796
  const api: MockServer = {
    url: `http://${host}:${port}`,
    port,
    stats,
    close: () => new Promise((r) => server.close(() => r())),
    setMode: (m) => {
      mode = m
    },
    registerClip: (c) => {
      clips.set(c.id, c)
    },
    reset: () => {
      stats.stt.length = 0
      stats.chat.length = 0
      stats.health = 0
      stats.sttHealth = 0
      rateCount.clear()
      windowHits.clear()
    },
  }
  return api
}

/* ------------------------------------------------------------ CLI */

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=')
      return [k, v ?? '1']
    }),
  )
  const manifests = args.manifest
    ? String(args.manifest).split(',').map((p) => resolve(ROOT, p))
    : [join(ROOT, '.tmp', 'voice-audio', 'manifest.json'), join(HERE, 'fixtures', 'manifest.json')]
  startMockServer({ port: Number(args.port ?? 8796), manifests, mode: (args.mode as MockMode) ?? 'normal', quiet: args.quiet === '1' })
    .then((s) => console.log(`заглушка мозга (STT) слушает ${s.url} — /health, /stt, /stt/health, /chat, /mock/stats`))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
