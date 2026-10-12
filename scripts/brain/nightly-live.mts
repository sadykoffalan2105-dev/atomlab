/**
 * npm run brain:nightly — ночной ЖИВОЙ прогон качества на сервере с видеокартой (nextBuild #2).
 * Запускается задачей «ATOMLAB Nightly» в 03:00 (deploy/brain-pc/nightly-eval.ps1) против http://127.0.0.1:8787;
 * ключ админа — env BRAIN_ADMIN_TOKEN (снимает лимиты /chat профиля gpu; нужен и для /admin/image/test).
 *
 *   1) eval       — brain:eval --sample=40 --cat=dialog-ru,dialog-uz,dialog-en,length,logic,calc (общий, calc, первое слово, R3/CJK/wikiLeak);
 *   2) curriculum — brain:eval:curriculum --file=brain/eval/curriculum/sample-live.jsonl --no-report (calc, test, why);
 *   3) image      — POST /admin/image/test × --image-n тем (p50/p95, nsfw); картинки выключены — «пропущено»;
 *   4) stt        — voice:eval (scripts/voice/fixtures) на /stt мозга (WER ru/uz/en); STT недоступно — «пропущено».
 * Итог — JSON (--out, по умолчанию $BRAIN_REPORTS_DIR или .tmp/reports, файл live-YYYYMMDD.json), его отдаёт
 * GET /admin/live-report. Пороги — scripts/brain/liveReportLib.mts; провал печатается красным, код выхода 0
 * (--strict — 1 при провале). Любая часть падает отдельно: остальные идут дальше.
 *
 *   --url=…  --out=файл.json  --sample=40  --cats=a,b  --curriculum-file=…  --curriculum-sample=N  --image-n=3
 *   --stt-url=… (по умолчанию --url)  --stt-load=4  --only=eval,stt  --skip=image  --commit=sha  --no-color  --strict
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CJK_RE, hasR3 } from '../../brain/pipeline/postcheck.ts'
import { consoleLines, finalize, pct, type CurriculumPart, type EvalPart, type ImagePart, type LiveHealth, type LiveReport, type PartName, type SttPart } from './liveReportLib.mts'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const argv = process.argv.slice(2)
const arg = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const flag = (name: string) => argv.includes(`--${name}`)

const URL_ = (arg('url') ?? `http://127.0.0.1:${process.env.BRAIN_PORT || 8787}`).replace(/\/+$/, '')
const ADMIN = process.env.BRAIN_ADMIN_TOKEN?.trim() ?? ''
const now = new Date()
const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
const OUT = path.resolve(arg('out') ?? path.join(process.env.BRAIN_REPORTS_DIR || path.join(ROOT, '.tmp', 'reports'), `live-${ymd}.json`))
const ALL: PartName[] = ['eval', 'curriculum', 'image', 'stt']
const only = arg('only')?.split(',')
const skip = arg('skip')?.split(',') ?? []
const want = (p: PartName) => (!only || only.includes(p)) && !skip.includes(p)
const IMAGE_PRESETS = ['g8-zinc-acid', 'g9-flame-colors', 'g7-water-molecule', 'g8-magnesium-burning', 'g10-benzene-ring']
const adminH: Record<string, string> = ADMIN ? { 'X-Brain-Admin': ADMIN } : {}

const log = (s: string) => console.log(`[nightly] ${s}`)
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomlab-nightly-'))

async function getJson(p: string, timeoutMs = 10_000): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(URL_ + p, { headers: adminH, signal: AbortSignal.timeout(timeoutMs) })
    return (await r.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

function toHealth(h: Record<string, unknown> | null): LiveHealth | null {
  if (!h) return null
  const llm = (h.llm ?? {}) as Record<string, unknown>
  const img = (h.image ?? {}) as Record<string, unknown>
  const stt = (h.stt ?? {}) as Record<string, unknown>
  return {
    ok: h.ok === true,
    version: typeof h.version === 'string' ? h.version : null,
    chatModel: typeof llm.chatModel === 'string' ? llm.chatModel : null,
    llm: llm.available === true,
    image: { enabled: img.enabled === true, ready: img.ready === true, engine: typeof img.engine === 'string' ? img.engine : null },
    stt: { available: stt.available === true, device: typeof stt.device === 'string' ? stt.device : null },
  }
}

/** Дочерний скрипт тем же node (с тем же загрузчиком tsx); вывод копится, хвост печатается в журнал. */
function runScript(rel: string, args: string[], timeoutMs: number): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...process.execArgv, path.join(ROOT, rel), ...args], { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d: Buffer) => (out += d.toString('utf8')))
    child.stderr.on('data', (d: Buffer) => (out += d.toString('utf8')))
    const t = setTimeout(() => child.kill(), timeoutMs)
    child.on('close', (code) => {
      clearTimeout(t)
      for (const line of out.trim().split('\n').slice(-12)) console.log(`    ${line}`)
      resolve({ code, out })
    })
    child.on('error', (e) => {
      clearTimeout(t)
      resolve({ code: null, out: out + String(e) })
    })
  })
}

const readRows = <T,>(file: string): T[] => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T[]
  } catch {
    return []
  }
}
const bump = (m: Record<string, { n: number; pass: number }>, k: string, ok: boolean) => {
  const x = (m[k] ??= { n: 0, pass: 0 })
  x.n++
  if (ok) x.pass++
}
const BUSY_RE = /HTTP 429|HTTP 503|busy/i

async function partEval(): Promise<EvalPart> {
  const t0 = Date.now()
  const json = path.join(tmpDir, 'eval.json')
  const cats = arg('cats') ?? 'dialog-ru,dialog-uz,dialog-en,length,logic,calc'
  const r = await runScript('scripts/brain/eval.mts', [`--url=${URL_}`, `--sample=${Number(arg('sample') ?? 40)}`, `--cat=${cats}`, `--json=${json}`], 90 * 60_000)
  type Row = { id: string; cat: string; text: string; route?: string; source?: string; firstMs?: number; why: string[] }
  const rows = readRows<Row>(json)
  const base = { durationMs: Date.now() - t0, byCat: {}, firstMs: { n: 0, p50: null, p95: null }, busy: 0, r3: 0, cjk: 0, wikiLeak: null, fails: [], n: 0, pass: 0 }
  if (!rows.length) return { ...base, status: 'error', note: `brain:eval без результатов (код ${r.code}): ${r.out.trim().split('\n').slice(-2).join(' ').slice(0, 200)}` }
  const byCat: Record<string, { n: number; pass: number }> = {}
  for (const row of rows) bump(byCat, row.cat, !row.why.length)
  const busy = rows.filter((x) => x.why.some((w) => BUSY_RE.test(w)) || BUSY_RE.test(x.route ?? ''))
  const firsts = rows.filter((x) => x.source === 'llm' && /(^|\+)llm$/.test(x.route ?? '') && typeof x.firstMs === 'number' && !busy.includes(x)).map((x) => x.firstMs!)
  const wl = /wikiLeak (\d+)/.exec(r.out)
  return {
    ...base,
    status: 'ok',
    n: rows.length,
    pass: rows.filter((x) => !x.why.length).length,
    byCat,
    firstMs: { n: firsts.length, p50: pct(firsts, 50), p95: pct(firsts, 95) },
    busy: busy.length,
    r3: rows.filter((x) => hasR3(x.text)).length,
    cjk: rows.filter((x) => CJK_RE.test(x.text)).length,
    wikiLeak: wl ? Number(wl[1]) : null,
    fails: rows.filter((x) => x.why.length).slice(0, 10).map((x) => ({ id: x.id, cat: x.cat, why: x.why.join('; ').slice(0, 200) })),
  }
}

async function partCurriculum(): Promise<CurriculumPart> {
  const t0 = Date.now()
  const json = path.join(tmpDir, 'curriculum.json')
  const file = arg('curriculum-file') ?? 'brain/eval/curriculum/sample-live.jsonl'
  const extra = arg('curriculum-sample') ? [`--sample=${arg('curriculum-sample')}`] : []
  const r = await runScript('scripts/brain/eval-curriculum.mts', [`--url=${URL_}`, `--file=${file}`, `--json=${json}`, '--no-report', ...extra], 120 * 60_000)
  type Row = { id: string; sub: string; text: string; citations?: string[]; why: string[]; waits?: string[]; unfair?: string }
  const rows = readRows<Row>(json)
  const base = { durationMs: Date.now() - t0, bySub: {}, waits: 0, r3: 0, cjk: 0, wikiLeak: 0, fails: [], n: 0, pass: 0 }
  if (!rows.length) return { ...base, status: 'error', note: `eval:curriculum без результатов (код ${r.code}): ${r.out.trim().split('\n').slice(-2).join(' ').slice(0, 200)}` }
  // как в eval-curriculum: случаи, ждущие строителя, и «нечестные» — вне порогов
  const gated = rows.filter((x) => !x.waits?.length && !x.unfair)
  const bySub: Record<string, { n: number; pass: number }> = {}
  for (const row of gated) bump(bySub, row.sub, !row.why.length)
  return {
    ...base,
    status: 'ok',
    n: gated.length,
    pass: gated.filter((x) => !x.why.length).length,
    bySub,
    waits: rows.length - gated.length,
    r3: rows.filter((x) => hasR3(x.text)).length,
    cjk: rows.filter((x) => CJK_RE.test(x.text)).length,
    wikiLeak: rows.filter((x) => /википед|wikipedia/iu.test((x.citations ?? []).join(' '))).length,
    fails: gated.filter((x) => x.why.length).slice(0, 10).map((x) => ({ id: x.id, sub: x.sub, why: x.why.join('; ').slice(0, 200) })),
  }
}

async function partImage(h: LiveHealth): Promise<ImagePart> {
  const t0 = Date.now()
  const base = { durationMs: 0, engine: h.image.engine, items: [] as ImagePart['items'], p50Ms: null, p95Ms: null, nsfwMax: null }
  if (!h.image.enabled) return { ...base, status: 'skipped', note: 'картинки выключены (image.enabled = false)' }
  if (!h.image.ready) return { ...base, status: 'error', note: 'картинки включены, но не готовы (ComfyUI не отвечает?)' }
  if (!ADMIN) return { ...base, status: 'error', note: 'нет ключа админа (env BRAIN_ADMIN_TOKEN)' }
  const n = Math.max(1, Math.min(IMAGE_PRESETS.length, Number(arg('image-n') ?? 3) || 3))
  for (const presetId of IMAGE_PRESETS.slice(0, n)) {
    const c0 = Date.now()
    try {
      const res = await fetch(`${URL_}/admin/image/test`, { method: 'POST', headers: { ...adminH, 'Content-Type': 'application/json' }, body: JSON.stringify({ presetId }), signal: AbortSignal.timeout(240_000) })
      const j = (await res.json()) as { ok?: boolean; ms?: number; timings?: { genMs?: number }; safety?: { nsfw?: number }; error?: { code?: string; message?: string } | string }
      const ok = res.ok && j.ok !== false
      const err = typeof j.error === 'string' ? j.error : j.error ? `${j.error.code ?? ''}: ${j.error.message ?? ''}` : `HTTP ${res.status}`
      base.items.push({ presetId, ok, ms: typeof j.ms === 'number' ? j.ms : Date.now() - c0, genMs: j.timings?.genMs ?? null, nsfw: typeof j.safety?.nsfw === 'number' ? j.safety.nsfw : null, ...(ok ? {} : { error: err.slice(0, 160) }) })
    } catch (e) {
      base.items.push({ presetId, ok: false, ms: Date.now() - c0, genMs: null, nsfw: null, error: String((e as Error).message ?? e).slice(0, 160) })
    }
    log(`картинка ${presetId}: ${base.items.at(-1)!.ok ? 'ok' : 'ошибка'} за ${((Date.now() - c0) / 1000).toFixed(1)} с`)
  }
  const ms = base.items.filter((x) => x.ok).map((x) => x.ms)
  const ns = base.items.map((x) => x.nsfw).filter((x): x is number => x !== null)
  return { ...base, status: 'ok', durationMs: Date.now() - t0, p50Ms: pct(ms, 50), p95Ms: pct(ms, 95), nsfwMax: ns.length ? Math.max(...ns) : null }
}

async function partStt(h: LiveHealth): Promise<SttPart> {
  const t0 = Date.now()
  const sttUrl = (arg('stt-url') ?? URL_).replace(/\/+$/, '')
  const base = { durationMs: 0, engine: null, device: h.stt.device, clips: 0, wer: {}, p95Ms: null, evalOk: null }
  if (!arg('stt-url') && !h.stt.available) return { ...base, status: 'skipped', note: 'распознавание речи недоступно (/health stt.available = false)' }
  const mod = path.join(ROOT, 'scripts', 'voice', 'stt-eval.mts')
  if (!fs.existsSync(mod)) return { ...base, status: 'error', note: 'нет scripts/voice (добавьте в sparse server-config.json)' }
  // клипы — фикстуры репозитория (на сервере .tmp/voice-audio нет); без --manifest stt-eval сам выберет их
  const { runEval } = (await import('../voice/stt-eval.mts')) as typeof import('../voice/stt-eval.mts')
  const fixtures = path.join('scripts', 'voice', 'fixtures', 'manifest.json')
  const rep = await runEval({ url: sttUrl, manifest: fixtures, load: Number(arg('stt-load') ?? 4), thresholds: true, quiet: true })
  const wer: Record<string, number> = {}
  for (const g of rep.groups.byLang) wer[g.key.split(' ')[0]!] = Math.round(g.wer * 10000) / 10000
  return { ...base, status: 'ok', durationMs: Date.now() - t0, engine: rep.engine, device: rep.device, clips: rep.clips, wer, p95Ms: rep.latency.c1?.client.p95 ?? null, evalOk: rep.ok }
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString()
  log(`сервер ${URL_}; отчёт → ${OUT}; ключ админа: ${ADMIN ? 'есть' : 'нет'}`)
  const health = toHealth(await getJson('/health'))
  const parts: LiveReport['parts'] = {}
  const errPart = (note: string) => ({ status: 'error' as const, durationMs: 0, note })
  if (!health) {
    log('мозг не отвечает на /health — все части «ошибка»')
    for (const p of ALL.filter(want)) (parts as Record<string, unknown>)[p] = errPart('мозг не отвечает на /health')
  } else {
    const run = async <T,>(name: PartName, fn: () => Promise<T>) => {
      if (!want(name)) return
      log(`— ${name}`)
      try {
        ;(parts as Record<string, unknown>)[name] = await fn()
      } catch (e) {
        ;(parts as Record<string, unknown>)[name] = errPart(String((e as Error).message ?? e).slice(0, 200))
      }
    }
    if (!health.llm) log('внимание: LLM недоступна — eval пойдёт запасным путём, пороги это покажут')
    await run('eval', partEval)
    await run('curriculum', partCurriculum)
    await run('image', () => partImage(health))
    await run('stt', () => partStt(health))
  }
  const report = finalize({ version: 1, date: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`, startedAt, finishedAt: new Date().toISOString(), commit: arg('commit') ?? null, url: URL_, health, parts })
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1) + '\n')
  for (const line of consoleLines(report, !flag('no-color'))) console.log(line)
  log(`отчёт: ${OUT}`)
  fs.rmSync(tmpDir, { recursive: true, force: true })
  process.exitCode = flag('strict') && !report.ok ? 1 : 0
}

await main().catch((e) => {
  // сам прогон упал — печатаем, но ночная задача не ломается (код 0 без --strict)
  console.error(`[nightly] сбой: ${(e as Error).stack ?? e}`)
  process.exitCode = flag('strict') ? 1 : 0
})
