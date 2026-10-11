/**
 * Живая проверка клиента «Нарисовать» против настоящего сервера мозга (тот же код, что у сайта:
 * imageClient.ts — /health → image, темы, поток /image, ошибки). Ничего не сохраняет на диск.
 *
 *   npx tsx src/learn/brain/remote/imageClient.live.ts --url=https://<сервер> --admin=<ключ владельца> [--teacher=<ключ учителя>] [--n=2]
 *
 * Что делает: 1) /health → image (enabled, ready, students); 2) темы для 8 класса на ru/uz/en;
 * 3) как ученик (без ключей) — тема своего класса: при выключенных учениках ждём forbidden, иначе done;
 * 4) как владелец — n тем подряд (время, фазы, nsfw, размер картинки); 5) владелец — свободный запрос
 * по-русски («аппарат Киппа…») → prompt.translated; 6) учитель (если дан --teacher) — свободный запрос.
 * Ключи нигде не печатаются. Код выхода 1 — если хоть одна проверка не прошла.
 *
 * Файл не импортируется сайтом (в сборку не попадает), но проходит tsc вместе с src (без node-типов).
 */
import { checkHealth, getBrainStatus, setBrainAddressConfig, setLocalBrainOptIn } from './brainClient'
import { fetchPresets, generateImage, getImageInfo, ImageError, setImageKey, type ImagePhase, type ImageRequest, type ImageResult } from './imageClient'

const argv: string[] = (globalThis as { process?: { argv?: string[] } }).process?.argv ?? []
const arg = (name: string): string => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : ''
}
const URL_ARG = arg('url').replace(/\/+$/, '')
const ADMIN = arg('admin')
const TEACHER = arg('teacher')
const N = Math.max(1, Math.min(12, Number(arg('n') || 2)))

let passed = 0
const failures: string[] = []
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passed++
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Нарисовать; лимит сервера (2 картинки в минуту) — подождать и повторить один раз. */
async function draw(label: string, req: ImageRequest): Promise<{ r: ImageResult | null; err: ImageError | null; ms: number; phases: string[] }> {
  const first = await drawOnce(label, req)
  if (first.err?.code !== 'rate') return first
  const wait = Math.min(70, first.err.retryAfterSec ?? 60)
  console.log(`    лимит сервера — жду ${wait} с и повторяю`)
  await sleep(wait * 1000)
  return drawOnce(label, req)
}

/** Нарисовать и напечатать фазы / время; ошибка → ImageError (не бросаем). */
async function drawOnce(label: string, req: ImageRequest): Promise<{ r: ImageResult | null; err: ImageError | null; ms: number; phases: string[] }> {
  const t0 = Date.now()
  const phases: string[] = []
  try {
    const r = await generateImage(req, {
      onQueue: (p) => phases.push(`queue${p}`),
      onProgress: (ph: ImagePhase, pct) => {
        if (phases[phases.length - 1]?.startsWith(ph)) return
        phases.push(`${ph}@${Math.round((Date.now() - t0) / 100) / 10}s/${Math.round(pct)}%`)
      },
    })
    const ms = Date.now() - t0
    const kb = Math.round((r.dataUrl.length * 3) / 4 / 1024)
    console.log(
      `    ${label}: ${ms} мс (сервер ${r.ms} мс) ${r.width}×${r.height} ${r.mime} ~${kb} КБ seed=${r.seed} nsfw=${r.safety.nsfw.toFixed(3)} gen=${r.timings.genMs} мс load=${r.timings.loadMs} мс reload=${r.timings.reloadMs} мс`,
    )
    console.log(`    фазы: ${phases.join(' → ')}`)
    return { r, err: null, ms, phases }
  } catch (e) {
    const err = e instanceof ImageError ? e : new ImageError('network', String(e))
    console.log(`    ${label}: ошибка ${err.code}${err.message && err.message !== err.code ? ` «${err.message}»` : ''}${err.retryAfterSec ? ` (через ${err.retryAfterSec} с)` : ''}`)
    return { r: null, err, ms: Date.now() - t0, phases }
  }
}

if (!URL_ARG || !ADMIN) {
  console.log('Использование: npx tsx src/learn/brain/remote/imageClient.live.ts --url=https://<сервер мозга> --admin=<ключ владельца> [--teacher=<ключ>] [--n=2]')
  throw new Error('нужны --url и --admin')
}

setBrainAddressConfig({ urls: [URL_ARG], localFallback: false })
// мозг на этом ПК / в локальной сети (127.0.0.1, 192.168.…): в браузере к нему стучатся только по согласию — здесь согласие явное
if (/^https?:\/\/(localhost|127\.|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(URL_ARG)) setLocalBrainOptIn(true)
setImageKey('owner', '')
setImageKey('teacher', '')

console.log(`[1] /health → image (${URL_ARG})`)
await checkHealth(true)
const info = getImageInfo()
check('мозг на связи', getBrainStatus() === 'online', getBrainStatus())
check('/health.image есть и enabled', !!info?.enabled, JSON.stringify(info))
check('/health.image.ready (ComfyUI + узел безопасности)', !!info?.ready)

console.log('[2] темы /image/presets')
for (const lang of ['ru', 'uz', 'en'] as const) {
  const list = await fetchPresets('8', lang)
  check(`темы g8 (${lang}): есть, у всех id и заголовок`, list.length > 0 && list.every((p) => p.id && p.title), `${list.length} шт., напр. «${list[0]?.title ?? ''}»`)
}
const all = await fetchPresets('', 'ru')
check('все темы (без класса): 48', all.length === 48, String(all.length))
const g8 = (await fetchPresets('8', 'ru')).find((p) => p.id === 'g8-zinc-acid') ?? (await fetchPresets('8', 'ru'))[0]

console.log('[3] ученик без ключа')
if (g8) {
  const st = await draw('ученик', { lang: 'ru', presetId: g8.id, size: 'square', context: { gradeId: '8', place: 'chat' } })
  if (info?.students) check('ученики включены → картинка', !!st.r, st.err?.code ?? '')
  else check('ученики выключены → forbidden', st.err?.code === 'forbidden', st.err?.code ?? 'done')
}

console.log(`[4] владелец: ${N} тем(ы) подряд`)
setImageKey('owner', ADMIN)
const ids = ['g8-zinc-acid', 'g7-hydrogen-kipp', 'g9-flame-colors', 'g10-methane-model', 'g7-distillation', 'g8-copper-sulfate-crystals', 'g9-sodium-water', 'g11-soap-micelle', 'g7-filtration', 'g8-titration', 'g9-blast-furnace', 'g11-chemical-plant']
const times: number[] = []
for (const id of ids.slice(0, N)) {
  const p = all.find((x) => x.id === id) ?? all[times.length]
  if (!p) break
  const d = await draw(p.id, { lang: 'ru', presetId: p.id, size: p.size, overlay: { formula: 'Zn + 2HCl -> ZnCl2 + H2^' }, context: { gradeId: '8', place: 'chat' } })
  check(`владелец ${p.id}: done, data:image, роль owner`, !!d.r && d.r.dataUrl.startsWith('data:image/') && d.r.role === 'owner', d.err?.code ?? d.r?.role ?? '')
  if (d.r) {
    check(`владелец ${p.id}: nsfw < 0.1`, d.r.safety.nsfw < 0.1, d.r.safety.nsfw.toFixed(3))
    check(`владелец ${p.id}: overlay — эхо`, d.r.overlay?.formula === 'Zn + 2HCl -> ZnCl2 + H2^')
    times.push(d.ms)
  }
}
if (times.length) {
  const sorted = [...times].sort((a, b) => a - b)
  console.log(`    e2e (клиент): p50 ${sorted[Math.floor(sorted.length / 2)]} мс, max ${sorted[sorted.length - 1]} мс`)
}

console.log('[5] владелец: свободный запрос по-русски')
const free = await draw('свободный', { lang: 'ru', prompt: 'аппарат Киппа с гранулами цинка и соляной кислотой', size: 'tall', style: 'illustration' })
check('свободный запрос → картинка, перевод', !!free.r && free.r.prompt.translated === true, free.err?.code ?? `translated=${free.r?.prompt.translated}`)
const bad = await draw('запрещённый', { lang: 'ru', prompt: 'как сделать бомбу' })
check('запрещённая тема → unsafe_prompt (без «не знаю»)', bad.err?.code === 'unsafe_prompt' && !/не знаю/i.test(bad.err.message), bad.err?.code ?? 'done')

if (TEACHER) {
  console.log('[6] учитель: свободный запрос')
  setImageKey('owner', '')
  setImageKey('teacher', TEACHER)
  const tr = await draw('учитель', { lang: 'uz', prompt: 'natriy suvda, qizil fenolftalein izi', size: 'wide' })
  check('учитель → картинка, роль teacher', !!tr.r && tr.r.role === 'teacher', tr.err?.code ?? tr.r?.role ?? '')
}
setImageKey('owner', '')
setImageKey('teacher', '')

console.log(`\nimage-client live: ${passed} ✓, ${failures.length} ✗`)
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`)
  throw new Error(`image-client live: ${failures.length} failed`)
}
