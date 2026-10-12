/**
 * npm run brain:image-live -- --url=https://<сервер>.ts.net --admin=<ключ> [--n=12] [--verify-graph] [--mode=pairs|seq]
 *                             [--out=.tmp/image-live] [--text=6]
 * Живая приёмка картинок на сервере с видеокартой (ComfyUI + Gemma на одной RTX):
 *   0) /health: image.enabled и ready; /admin/image/status — движок;
 *   1) --verify-graph: /admin/image/verify — граф сверяется с /object_info живого ComfyUI (расхождение = провал);
 *   2) «покой»: 3 текстовых вопроса подряд — первое слово без картинок;
 *   3) n тем: парами (по умолчанию — вторая картинка попадает в то же окно) или по одной (--mode=seq) через
 *      POST /image?wait=1, параллельно текстовые вопросы каждые 10 с (--text штук из brain/eval/questions.jsonl, school-ru);
 *   4) после последнего окна — ждём, пока /api/ps (через статус) снова покажет чат-модель в видеопамяти;
 *   5) таблица и JSON: e2e p50/p95, вторая в окне, средние timings, первое слово текста p50/p95 в окнах и в покое,
 *      busy и ошибки, nsfw каждой темы; картинки WebP — в --out. Пороги приёмки печатаются ✓/✗, код выхода 1 при провале.
 */
import fs from 'node:fs'
import path from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    return m ? [m[1], m[2] ?? 'true'] : [a, 'true']
  }),
) as Record<string, string>
const URL_ = String(args.url ?? '').replace(/\/+$/, '')
const ADMIN = String(args.admin ?? process.env.BRAIN_ADMIN_TOKEN ?? '')
const N = Math.max(1, Math.min(48, Number(args.n ?? 12) || 12))
const MODE = args.mode === 'seq' ? 'seq' : 'pairs'
const OUT = path.resolve(String(args.out ?? '.tmp/image-live'))
const TEXT_N = Math.max(0, Number(args.text ?? 6) || 0)
if (!URL_ || !ADMIN) {
  console.error('нужно: --url=https://<сервер> --admin=<ключ администратора мозга>')
  process.exit(2)
}
const H = { 'X-Brain-Admin': ADMIN }
const JSONH = { 'Content-Type': 'application/json' }

/** 12 тем по всем классам (сюжеты без людей и надписей); дальше — остальные из /image/presets. */
const PICK = ['g8-zinc-acid', 'g7-spirit-lamp', 'g7-distillation', 'g8-copper-sulfate-crystals', 'g8-magnesium-burning', 'g9-flame-colors', 'g9-blast-furnace', 'g8-titration', 'g10-benzene-ring', 'g10-oil-tower', 'g11-paper-chromatography', 'g7-water-molecule']

const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]!
}
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : NaN)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let failed = 0
const check = (cond: boolean, what: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ✓' : '  ✗'} ${what}${extra ? ' — ' + extra : ''}`)
}

async function getJson(p: string, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const r = await fetch(URL_ + p, { headers: { ...H, ...headers }, signal: AbortSignal.timeout(20_000) })
  return (await r.json()) as Record<string, unknown>
}

type Img = { presetId: string; ok: boolean; ms: number; code?: string; reason?: string; timings?: Record<string, number>; nsfw?: number; jobId?: string; startedAt: number; doneAt: number }
async function draw(presetId: string): Promise<Img> {
  const t0 = Date.now()
  try {
    const r = await fetch(`${URL_}/image?wait=1`, {
      method: 'POST',
      headers: { ...H, ...JSONH, Accept: 'application/json' },
      body: JSON.stringify({ sessionId: 'image-live', lang: 'ru', presetId, size: 'square' }),
      signal: AbortSignal.timeout(180_000),
    })
    const j = JSON.parse((await r.text()).trim()) as Record<string, unknown>
    const doneAt = Date.now()
    if (j.ok !== true) return { presetId, ok: false, ms: doneAt - t0, code: String((j.error as { code?: string })?.code ?? r.status), startedAt: t0, doneAt }
    const b64 = String(j.dataUrl ?? '').replace(/^data:image\/webp;base64,/, '')
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(path.join(OUT, `${presetId}.webp`), Buffer.from(b64, 'base64'))
    return { presetId, ok: true, ms: doneAt - t0, timings: j.timings as Record<string, number>, nsfw: (j.safety as { nsfw?: number })?.nsfw, jobId: String(j.jobId), startedAt: t0, doneAt }
  } catch (err) {
    return { presetId, ok: false, ms: Date.now() - t0, code: 'network', reason: (err as Error).message, startedAt: t0, doneAt: Date.now() }
  }
}

type Txt = { q: string; firstMs: number | null; ms: number; busy: boolean; route?: string; during: boolean }
let windowsOpen = false
async function ask(q: string): Promise<Txt> {
  const during = windowsOpen
  const t0 = Date.now()
  let firstMs: number | null = null
  let raw = ''
  try {
    const r = await fetch(`${URL_}/chat`, {
      method: 'POST',
      headers: { ...H, ...JSONH, Accept: 'text/event-stream' },
      body: JSON.stringify({ sessionId: 'image-live-text', studentId: 'image-live', lang: 'ru', stream: true, messages: [{ role: 'user', content: q }], context: { gradeId: 'g8', mode: 'chat', detail: 'brief' } }),
      signal: AbortSignal.timeout(150_000),
    })
    const reader = r.body!.getReader()
    const dec = new TextDecoder()
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      raw += dec.decode(value, { stream: true })
      if (firstMs === null && /event: delta/.test(raw)) firstMs = Date.now() - t0
    }
  } catch {
    /* сеть — считаем как ответ без первого слова */
  }
  const doneBlock = raw.split('\n\n').find((b) => b.startsWith('event: done'))
  let d: Record<string, unknown> = {}
  try {
    d = JSON.parse(doneBlock?.split('\n').find((l) => l.startsWith('data:'))?.slice(5) ?? '{}')
  } catch {
    d = {}
  }
  return { q, firstMs, ms: Date.now() - t0, busy: d.reason === 'busy', route: d.route as string | undefined, during }
}

const questions = fs
  .readFileSync(path.resolve('brain/eval/questions.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l) as { cat: string; q: string })
  .filter((x) => x.cat === 'school-ru')
  .map((x) => x.q)

console.log(`[image-live] ${URL_} · ${N} тем (${MODE}) · текст ${TEXT_N} вопросов · картинки → ${OUT}`)
const health = await getJson('/health')
const hi = health.image as { enabled?: boolean; ready?: boolean; engine?: string } | undefined
check(!!hi?.enabled && !!hi?.ready, '/health.image: enabled и ready', JSON.stringify(hi))
const st0 = await getJson('/admin/image/status')
console.log(`  движок ${st0.engine}:${st0.variant} · видеопамять ${JSON.stringify(st0.device)} · журнал ${st0.journalLines} строк`)

if (args['verify-graph']) {
  const v = await getJson('/admin/image/verify')
  const bad = ((v.checks ?? []) as { class: string; ok: boolean; missing: string[]; unknown: string[]; absent?: boolean }[]).filter((c) => !c.ok)
  check(v.ok === true, '--verify-graph: граф сходится с /object_info живого ComfyUI', bad.map((c) => `${c.class}${c.absent ? ' (нет узла)' : ''}${c.missing.length ? ' нет входов ' + c.missing.join(',') : ''}${c.unknown.length ? ' лишние ' + c.unknown.join(',') : ''}`).join('; '))
  if (v.ok !== true) {
    console.log(JSON.stringify(v, null, 2))
    process.exit(1)
  }
}

// ——— покой: первое слово без картинок
console.log('покой: 3 вопроса без картинок')
const idle: Txt[] = []
for (const q of questions.slice(0, 3)) idle.push(await ask(q))

// ——— картинки + текст параллельно
const presets = [...PICK]
if (N > PICK.length) {
  const all = ((await getJson('/image/presets')).presets as { id: string }[]).map((p) => p.id)
  for (const id of all) if (!presets.includes(id)) presets.push(id)
}
const todo = presets.slice(0, N)
const imgs: Img[] = []
const texts: Promise<Txt>[] = []
windowsOpen = true
const tImg = Date.now()
const textTimer = (async () => {
  for (let i = 0; i < TEXT_N; i++) {
    texts.push(ask(questions[(3 + i) % questions.length]!))
    await sleep(10_000)
    if (!windowsOpen) break
  }
})()
if (MODE === 'pairs') {
  for (let i = 0; i < todo.length; i += 2) {
    const pair = todo.slice(i, i + 2)
    // вторая — через 300 мс: попадает в то же окно (окно добирает задания, пока их < maxJobs)
    const ps = pair.map((id, k) => sleep(k * 300).then(() => draw(id)))
    imgs.push(...(await Promise.all(ps)))
    console.log(`  ${pair.join(' + ')}: ${imgs.slice(-pair.length).map((r) => (r.ok ? `${(r.ms / 1000).toFixed(1)} с` : r.code)).join(' / ')}`)
  }
} else {
  for (const id of todo) {
    const r = await draw(id)
    imgs.push(r)
    console.log(`  ${id}: ${r.ok ? `${(r.ms / 1000).toFixed(1)} с` : r.code}`)
  }
}
windowsOpen = false
await textTimer
const during = await Promise.all(texts)
const imgMs = Date.now() - tImg

// ——— Gemma вернулась в видеопамять?
const tBack = Date.now()
let backMs: number | null = null
for (let i = 0; i < 40; i++) {
  const s = await getJson('/admin/image/status')
  const models = (s.ollama ?? []) as { name: string; size: number; size_vram: number }[]
  const chat = models.find((m) => /gemma/i.test(m.name)) ?? models.find((m) => !/bge|embed/i.test(m.name))
  if (chat && chat.size > 0 && chat.size_vram >= 0.5 * chat.size && s.state === 'llm') {
    backMs = Date.now() - tBack
    break
  }
  await sleep(500)
}
const st1 = await getJson('/admin/image/status')

// ——— итоги
const okImgs = imgs.filter((r) => r.ok)
const e2e = okImgs.map((r) => r.ms)
// вторая в окне: у неё нет дренажа и выгрузки; её «стоимость» — сколько она пришла после первой из пары
const seconds: number[] = []
if (MODE === 'pairs') {
  for (let i = 0; i + 1 < imgs.length; i += 2) {
    const a = imgs[i]!
    const b = imgs[i + 1]!
    if (a.ok && b.ok && b.timings && b.timings.unloadMs === 0 && b.timings.drainMs === 0) seconds.push(Math.max(0, b.doneAt - a.doneAt))
  }
}
const tAvg = (k: string) => avg(okImgs.map((r) => Number(r.timings?.[k] ?? NaN)).filter(Number.isFinite))
const firstDuring = during.map((t) => t.firstMs).filter((x): x is number => x !== null)
const firstIdle = idle.map((t) => t.firstMs).filter((x): x is number => x !== null)
console.log('\nтема                          | e2e, с | queue | drain | unload | load | gen | safety | reload | nsfw')
for (const r of imgs) {
  const t = r.timings ?? {}
  const f = (k: string) => String(t[k] ?? '—').padStart(5)
  console.log(`${r.presetId.padEnd(30)}| ${(r.ms / 1000).toFixed(1).padStart(6)} |${f('queueMs')} |${f('drainMs')} | ${f('unloadMs')} |${f('loadMs')}|${f('genMs')}| ${f('safetyMs')} | ${f('reloadMs')} | ${r.ok ? r.nsfw : r.code}`)
}
const summary = {
  url: URL_,
  engine: `${st0.engine}:${st0.variant}`,
  mode: MODE,
  images: { n: imgs.length, ok: okImgs.length, errors: imgs.filter((r) => !r.ok).map((r) => `${r.presetId}:${r.code}`), p50Ms: pct(e2e, 50), p95Ms: pct(e2e, 95), secondInWindowMs: seconds, wallMs: imgMs },
  timingsAvg: { queueMs: tAvg('queueMs'), drainMs: tAvg('drainMs'), unloadMs: tAvg('unloadMs'), loadMs: tAvg('loadMs'), genMs: tAvg('genMs'), safetyMs: tAvg('safetyMs'), reloadMs: tAvg('reloadMs') },
  text: {
    idle: { n: idle.length, firstP50Ms: pct(firstIdle, 50), firstP95Ms: pct(firstIdle, 95) },
    duringWindows: { n: during.length, firstP50Ms: pct(firstDuring, 50), firstP95Ms: pct(firstDuring, 95), busy: during.filter((t) => t.busy).length, noFirstWord: during.filter((t) => t.firstMs === null).length },
  },
  nsfw: Object.fromEntries(okImgs.map((r) => [r.presetId, r.nsfw])),
  gemmaBackMs: backMs,
  counters: st1.counters,
  journalLines: { before: st0.journalLines, after: st1.journalLines },
}
console.log('\n' + JSON.stringify(summary, null, 2))
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')

console.log('\nприёмка:')
check(okImgs.length === imgs.length, 'ошибок картинок 0', summary.images.errors.join(', '))
check(pct(e2e, 50) <= 15_000, 'картинка e2e p50 ≤ 15 с', `${pct(e2e, 50)} мс`)
check(pct(e2e, 95) <= 30_000, 'картинка e2e p95 ≤ 30 с', `${pct(e2e, 95)} мс`)
if (MODE === 'pairs') check(seconds.length > 0 && Math.max(...seconds) <= 8000, 'вторая картинка в том же окне ≤ 8 с', seconds.join(', '))
check(okImgs.every((r) => (r.nsfw ?? 1) < 0.1), 'nsfw всех тем < 0.1 (ложных unsafe_image 0)', okImgs.filter((r) => (r.nsfw ?? 1) >= 0.1).map((r) => `${r.presetId}:${r.nsfw}`).join(', '))
if (TEXT_N) {
  check(!during.some((t) => t.busy), 'текст во время окон: reason busy = 0', `${during.filter((t) => t.busy).length}`)
  check(pct(firstDuring, 95) <= 25_000 && firstDuring.length === during.length, 'первое слово текста во время окон p95 ≤ 25 с', `${pct(firstDuring, 95)} мс (в покое p95 ${pct(firstIdle, 95)} мс)`)
}
check(backMs !== null && backMs <= 20_000, 'после окна чат-модель снова в видеопамяти (size_vram ≥ 0,5·size) ≤ 20 с', `${backMs} мс`)
const jl = Number(st1.journalLines) - Number(st0.journalLines)
check(Number.isFinite(jl) && jl >= imgs.length, 'журнал images.jsonl: строка на каждое задание', `+${jl}`)
console.log(`\n[image-live] ${failed ? `ПРОВАЛ: ${failed}` : 'всё в норме'} · summary.json → ${OUT}`)
process.exit(failed ? 1 : 0)
