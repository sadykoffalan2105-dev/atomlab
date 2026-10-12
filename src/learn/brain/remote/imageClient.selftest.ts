/**
 * Самопроверка части «site-image» (кнопка «Нарисовать»): клиент /image (поток SSE, ошибки, лимиты, ключи,
 * кеш тем), перехват «нарисуй …» (drawIntent) и SVG-подписи формул (formulaSvg) — с подменой fetch,
 * без сервера и без сети.
 *
 *   npx tsx src/learn/brain/remote/imageClient.selftest.ts      (npm run test:image-client)
 *
 * Файл не импортируется сайтом (в сборку не попадает), но проходит tsc вместе с src.
 * Без node-типов: провал — исключение в конце (код выхода 1).
 */
import { checkHealth, getBrainStatus, markBrainOffline, setBrainAddressConfig } from './brainClient'
import {
  canUseDrawing,
  clearPresetCache,
  fetchPresets,
  generateImage,
  getImageInfo,
  hasImageKey,
  ImageError,
  randomSeed,
  role,
  setImageKey,
  type ImagePhase,
} from './imageClient'
import { parseDrawRequest } from '../image/drawIntent'
import { formulaToUnicode, parseFormula, renderOverlaySvg, type FormulaToken } from '../image/formulaSvg'
import { pngFileName } from '../image/overlayCompose'
import {
  addToGallery,
  askAboutImageText,
  cleanFormulaInput,
  clearGallery,
  drawAvailability,
  galleryItems,
  GALLERY_MAX,
  nearestPreset,
  presetsForGrade,
  stageIndex,
  stageOf,
  waitLabel,
  type DrawGalleryItem,
} from '../image/drawMode'
import type { ImagePreset } from './imageClient'

/* ------------------------------------------------------------------ счётчик */

let passed = 0
const failures: string[] = []
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passed++
  else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/* ------------------------------------------------------------------ подмена fetch */

type Handler = (path: string, init: RequestInit | undefined) => Promise<Response>
const REMOTE_URL = 'https://brain.atomlab.test'
const calls: { path: string; body: string; headers: Record<string, string> }[] = []
let handler: Handler = async () => {
  throw new TypeError('getaddrinfo ENOTFOUND brain.atomlab.test')
}
const realFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith(REMOTE_URL)) {
    const path = url.slice(REMOTE_URL.length)
    const headers: Record<string, string> = {}
    const h = init?.headers
    if (h && typeof h === 'object' && !(h instanceof Headers) && !Array.isArray(h)) for (const [k, v] of Object.entries(h)) headers[k.toLowerCase()] = String(v)
    calls.push({ path, body: typeof init?.body === 'string' ? init.body : '', headers })
    return handler(path, init)
  }
  if (/(^|\/)brain\.json$/.test(url)) return new Response('not found', { status: 404 })
  return realFetch(input, init)
}) as typeof fetch

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

/** SSE-ответ кусками (куски режут события пополам), с паузой между кусками; hang — не закрывать поток. */
function sse(chunks: string[], opts: { delayMs?: number; hang?: boolean; signal?: AbortSignal | null } = {}): Response {
  const enc = new TextEncoder()
  let i = 0
  const body = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      await sleep(opts.delayMs ?? 3)
      if (i >= chunks.length) {
        if (opts.hang) {
          await new Promise<void>((_r, rej) => opts.signal?.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError'))))
        }
        ctrl.close()
        return
      }
      ctrl.enqueue(enc.encode(chunks[i++]!))
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

const ev = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
/** Разрезать текст на куски по n символов (проверка склейки буфера). */
function split(s: string, n: number): string[] {
  const out: string[] = []
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n))
  return out
}

/** Крошечный WebP 1×1 (как /view сервера). */
const WEBP_1PX = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'
const DONE = {
  jobId: '01JTEST',
  dataUrl: `data:image/webp;base64,${WEBP_1PX}`,
  mime: 'image/webp',
  width: 1024,
  height: 1024,
  seed: 4242,
  engine: 'z-image-turbo',
  variant: 'int8',
  ms: 9100,
  timings: { queueMs: 10, drainMs: 300, unloadMs: 800, loadMs: 2500, genMs: 3900, safetyMs: 60, reloadMs: 1500 },
  prompt: { final: 'Clean educational illustration…', translated: false, presetId: 'g8-zinc-acid' },
  safety: { nsfw: 0.01, normal: 0.99 },
  overlay: { formula: 'Zn + 2HCl -> ZnCl2 + H2^' },
  url: '/image/01JTEST',
}

const HEALTH = (image: Record<string, unknown> | null) => ({
  ok: true,
  service: 'atomlab-brain',
  version: '2.0.0',
  contract: 1,
  llm: { available: true, chatModel: 'gemma4:12b', fastModel: 'gemma4:12b', embedModel: 'bge-m3' },
  kb: { docs: 10, journalLines: 0, embedded: 10 },
  uptimeMs: 1000,
  ...(image ? { image } : {}),
})

let healthImage: Record<string, unknown> | null = { enabled: true, ready: true, engine: 'z-image-turbo', students: false, queue: { running: 0, waiting: 0, paused: false }, lastMs: 0 }
let imageRoute: Handler = async () => json({ ok: false }, 500)
let presetsCalls = 0
handler = async (path, init) => {
  if (path === '/health') return json(HEALTH(healthImage))
  if (path.startsWith('/image/presets')) {
    presetsCalls++
    return json({
      ok: true,
      students: { enabled: false },
      presets: [
        { id: 'g8-zinc-acid', title: 'Цинк в соляной кислоте', grades: ['g8'], topic: 'acids', style: 'photo', size: 'square', chapter: { grade: 'g8', ch: 3, sec: 2 } },
        { id: 'g7-hydrogen-kipp', titles: { ru: 'Аппарат Киппа', uz: 'Kipp apparati', en: "Kipp's apparatus" }, grades: ['g7', 'g8'], topic: 'gases', style: 'illustration', size: 'tall' },
        { id: 42, title: 'мусор' },
      ],
    })
  }
  if (path === '/image') return imageRoute(path, init)
  return json({ ok: false }, 404)
}

/* ================================================================== 1. /health → image, роли */
console.log('[info] /health → image, роли и ключи')
{
  setBrainAddressConfig({ urls: [REMOTE_URL], localFallback: false })
  await checkHealth(true)
  check('brain online', getBrainStatus() === 'online', getBrainStatus())
  const info = getImageInfo()
  check('info: enabled/ready/engine', !!info && info.enabled && info.ready && info.engine === 'z-image-turbo', JSON.stringify(info))
  check('info: students off', info?.students === false)
  setImageKey('owner', '')
  setImageKey('teacher', '')
  check('role: student without keys', role() === 'student' && !hasImageKey())
  check('canUseDrawing: student + students off → false', canUseDrawing() === false)
  setImageKey('teacher', 'teacher-key-0123456789abcdef')
  check('role: teacher key → teacher', role() === 'teacher' && hasImageKey('teacher') && !hasImageKey('owner'))
  check('canUseDrawing: teacher → true', canUseDrawing() === true)
  setImageKey('owner', 'owner-admin-key-xyz')
  check('role: owner key wins', role() === 'owner')
  setImageKey('owner', '')
  setImageKey('teacher', '')
  healthImage = { enabled: true, ready: false, engine: 'z-image-turbo', students: { enabled: true } }
  await checkHealth(true)
  check('info: students {enabled:true} object form', getImageInfo()?.students === true && getImageInfo()?.ready === false)
  check('canUseDrawing: student + students on → true', canUseDrawing() === true)
  healthImage = null
  await checkHealth(true)
  check('info: old server without image → null', getImageInfo() === null && canUseDrawing() === false)
  healthImage = { enabled: true, ready: true, engine: 'z-image-turbo', students: false }
  await checkHealth(true)
}

/* ================================================================== 2. поток accepted → queue → progress → done */
console.log('[stream] /image SSE')
{
  imageRoute = async () =>
    sse(
      split(
        ': hb\n\n' +
          ev('accepted', { jobId: '01JTEST', role: 'owner', engine: 'z-image-turbo', variant: 'int8', width: 1024, height: 1024, presetId: 'g8-zinc-acid', etaSec: 12 }) +
          ev('queue', { position: 2, waiting: 3, etaSec: 20 }) +
          ev('progress', { phase: 'checking', pct: 5, ms: 1 }) +
          ev('progress', { phase: 'switching', pct: 20, ms: 900 }) +
          ': hb\n\n' +
          ev('progress', { phase: 'sampling', pct: 61, ms: 4000 }) +
          ev('progress', { phase: 'bogus', pct: 99, ms: 1 }) +
          ev('done', DONE),
        37,
      ),
    )
  setImageKey('owner', 'owner-admin-key-xyz')
  calls.length = 0
  const queue: number[] = []
  const phases: [ImagePhase, number][] = []
  let acceptedRole = ''
  const r = await generateImage(
    { lang: 'ru', presetId: 'g8-zinc-acid', size: 'square', overlay: { formula: 'Zn + 2HCl -> ZnCl2 + H2^', caption: '' }, context: { gradeId: '8', place: 'chat' } },
    { onQueue: (p) => queue.push(p), onProgress: (ph, pct) => phases.push([ph, pct]), onAccepted: (a) => (acceptedRole = a.role ?? '') },
  )
  check('done: dataUrl webp', r.dataUrl.startsWith('data:image/webp;base64,'), r.dataUrl.slice(0, 30))
  check('done: size/seed/engine', r.width === 1024 && r.height === 1024 && r.seed === 4242 && r.engine === 'z-image-turbo' && r.variant === 'int8')
  check('done: timings all ≥ 0', Object.values(r.timings).every((v) => v >= 0) && r.timings.genMs === 3900)
  check('done: prompt + safety + overlay echo', r.prompt.presetId === 'g8-zinc-acid' && r.safety.nsfw === 0.01 && r.overlay?.formula === DONE.overlay.formula)
  check('done: role from accepted', r.role === 'owner' && acceptedRole === 'owner')
  check('queue event → onQueue(2)', queue.join(',') === '2', queue.join(','))
  check('progress: known phases only, in order', phases.map((p) => p[0]).join(',') === 'checking,switching,sampling' && phases[2]![1] === 61, JSON.stringify(phases))
  const call = calls.find((c) => c.path === '/image')
  const body = JSON.parse(call?.body ?? '{}') as Record<string, unknown>
  check('request: Accept text/event-stream + JSON', call?.headers['accept'] === 'text/event-stream' && call?.headers['content-type'] === 'application/json')
  check('request: X-Brain-Admin from owner key', call?.headers['x-brain-admin'] === 'owner-admin-key-xyz')
  check('request: no teacherKey for owner', !('teacherKey' in body))
  check('request: gradeId normalised, sessionId, presetId', (body.context as { gradeId?: string })?.gradeId === 'g8' && typeof body.sessionId === 'string' && body.presetId === 'g8-zinc-acid')
  check('request: empty caption not sent', !(body.overlay as { caption?: string }).caption)
  setImageKey('owner', '')

  // учитель: ключ в теле, заголовка нет
  setImageKey('teacher', 'teacher-key-0123456789abcdef')
  calls.length = 0
  imageRoute = async () => sse([ev('accepted', { jobId: 'x', role: 'teacher' }), ev('done', DONE)])
  await generateImage({ lang: 'uz', prompt: '  Kipp apparati  ', style: 'diagram', seed: 7 })
  const tcall = calls.find((c) => c.path === '/image')
  const tbody = JSON.parse(tcall?.body ?? '{}') as Record<string, unknown>
  check('teacher: teacherKey in body, no admin header', tbody.teacherKey === 'teacher-key-0123456789abcdef' && !tcall?.headers['x-brain-admin'])
  check('teacher: prompt trimmed, style, seed', tbody.prompt === 'Kipp apparati' && tbody.style === 'diagram' && tbody.seed === 7 && tbody.lang === 'uz')
  setImageKey('teacher', '')
}

/* ================================================================== 3. ошибки */
console.log('[errors] коды сервера и клиента')
{
  const expectErr = async (name: string, code: string, extra?: (e: ImageError) => boolean) => {
    try {
      await generateImage({ lang: 'ru', presetId: 'g8-zinc-acid' })
      check(name, false, 'no throw')
    } catch (e) {
      const ok = e instanceof ImageError && e.code === code && (!extra || extra(e))
      check(name, ok, e instanceof ImageError ? `${e.code}: ${e.message} retry=${e.retryAfterSec}` : String(e))
    }
  }
  imageRoute = async () => sse([ev('accepted', { jobId: 'x', role: 'student' }), ev('error', { code: 'unsafe_prompt', message: 'Эту тему нарисовать нельзя.' })])
  await expectErr('error event → ImageError unsafe_prompt + server message', 'unsafe_prompt', (e) => e.message === 'Эту тему нарисовать нельзя.' && e.role === 'student')
  imageRoute = async () => sse([ev('error', { code: 'busy', message: 'занят', retryAfterSec: 30 })])
  await expectErr('error event busy keeps retryAfterSec', 'busy', (e) => e.retryAfterSec === 30)
  imageRoute = async () => json({ ok: false, error: 'rate', code: 'rate', rule: 'image_minute', retryAfterSec: 41 }, 429, { 'Retry-After': '41' })
  await expectErr('429 before stream → rate + retryAfterSec', 'rate', (e) => e.retryAfterSec === 41)
  imageRoute = async () => json({ ok: false, error: 'rate' }, 429, { 'Retry-After': '17' })
  await expectErr('429 without body retry → Retry-After header', 'rate', (e) => e.retryAfterSec === 17)
  imageRoute = async () => json({ ok: false, code: 'forbidden', message: 'Рисование для учеников выключено' }, 403)
  await expectErr('403 JSON → forbidden', 'forbidden', (e) => /выключено/.test(e.message))
  imageRoute = async () => json({ ok: false, error: { code: 'not_ready', message: 'ComfyUI не готов' } }, 503)
  await expectErr('503 nested error → not_ready', 'not_ready')
  imageRoute = async () => json({ ok: false, error: { code: 'disabled', message: 'off' } }, 503)
  await expectErr('503 disabled', 'disabled')
  imageRoute = async () => new Response('not found', { status: 404 })
  await expectErr('404 (old server) → disabled', 'disabled')
  imageRoute = async () => json({ ok: false, error: { code: 'bad_request', message: 'выберите тему из списка' } }, 400)
  await expectErr('400 → bad_request', 'bad_request', (e) => e.message === 'выберите тему из списка')
  imageRoute = async () => sse([ev('accepted', { jobId: 'x' })])
  await expectErr('stream closed without done → network', 'network')
  imageRoute = async () => sse([ev('done', { ...DONE, dataUrl: 'javascript:alert(1)', url: '' })])
  await expectErr('done without a valid data:image → internal', 'internal')
  imageRoute = async () => json({ ok: true, ...DONE })
  const one = await generateImage({ lang: 'ru', presetId: 'g8-zinc-acid' })
  check('single JSON answer (?wait=1 style) accepted', one.seed === 4242 && one.dataUrl.startsWith('data:image/webp'))
  // отмена пользователем
  imageRoute = async (_p, init) => sse([ev('accepted', { jobId: 'x' }), ev('progress', { phase: 'sampling', pct: 40, ms: 1 })], { hang: true, signal: init?.signal ?? null })
  const ctrl = new AbortController()
  setTimeout(() => ctrl.abort(), 60)
  try {
    await generateImage({ lang: 'ru', presetId: 'g8-zinc-acid' }, { signal: ctrl.signal })
    check('abort → aborted', false, 'no throw')
  } catch (e) {
    check('abort → aborted', e instanceof ImageError && e.code === 'aborted', String((e as ImageError).code))
  }
  // мозга нет
  markBrainOffline()
  const saved = handler
  handler = async () => {
    throw new TypeError('connect ECONNREFUSED')
  }
  try {
    await generateImage({ lang: 'ru', presetId: 'g8-zinc-acid' })
    check('offline → offline', false, 'no throw')
  } catch (e) {
    check('offline → offline', e instanceof ImageError && e.code === 'offline', String((e as ImageError).code))
  }
  check('offline: getImageInfo null', getImageInfo() === null)
  handler = saved
  await checkHealth(true)
}

/* ================================================================== 4. темы и кеш */
console.log('[presets] GET /image/presets + кеш 5 мин')
{
  clearPresetCache()
  presetsCalls = 0
  const list = await fetchPresets('8', 'uz')
  check('presets: invalid entries dropped', list.length === 2, String(list.length))
  check('presets: titles object → title by lang', list.find((p) => p.id === 'g7-hydrogen-kipp')?.title === 'Kipp apparati')
  check('presets: grade param normalised', calls.some((c) => c.path === '/image/presets?grade=g8&lang=uz'))
  await fetchPresets('8', 'uz')
  check('presets: second call served from cache', presetsCalls === 1, String(presetsCalls))
  await fetchPresets('8', 'ru')
  check('presets: other lang → new request', presetsCalls === 2, String(presetsCalls))
  const saved = handler
  handler = async (path, init) => (path.startsWith('/image/presets') ? new Response('boom', { status: 500 }) : saved(path, init))
  check('presets: server error → []', (await fetchPresets('9', 'ru')).length === 0)
  handler = saved
}

/* ================================================================== 5. «нарисуй …» */
console.log('[intent] parseDrawRequest')
{
  const POS: [string, string, string][] = [
    ['нарисуй аппарат Киппа', 'аппарат Киппа', 'ru'],
    ['Нарисуйте, пожалуйста, колбу с серной кислотой', 'колбу с серной кислотой', 'ru'],
    ['изобрази горение магния', 'горение магния', 'ru'],
    ['сделай картинку с кристаллами медного купороса', 'кристаллами медного купороса', 'ru'],
    ['покажи мне фото натрия на воде', 'натрия на воде', 'ru'],
    ['Пожалуйста, нарисуй мне модель молекулы воды!', 'модель молекулы воды', 'ru'],
    ['нарисуй, как выглядит доменная печь', 'доменная печь', 'ru'],
    ['создай иллюстрацию про перегонку воды', 'перегонку воды', 'ru'],
    ['rasm chizing: Kipp apparati', 'Kipp apparati', 'uz'],
    ['Iltimos, menga rasm chizib bering: kolba va voronka', 'kolba va voronka', 'uz'],
    ['Kipp apparatini chizing', 'Kipp apparati', 'uz'],
    ['natriy suvda rasmini chizib bering', 'natriy suvda', 'uz'],
    ['draw a Kipp apparatus', 'Kipp apparatus', 'en'],
    ['Please draw me the water molecule model', 'water molecule model', 'en'],
    ['generate an image of a blast furnace', 'a blast furnace', 'en'],
    ['show me a picture of copper sulfate crystals', 'copper sulfate crystals', 'en'],
    ['sketch a distillation setup.', 'distillation setup', 'en'],
  ]
  for (const [text, subject, lang] of POS) {
    const r = parseDrawRequest(text, 'ru')
    check(`intent +: ${text}`, !!r && r.subject.replace(/^an?\s+/i, '') === subject.replace(/^an?\s+/i, '') && r.lang === lang, JSON.stringify(r))
  }
  const NEG = [
    'как нарисовать структурную формулу',
    'нарисуй',
    'нарисуй ???',
    'сделай раствор соли',
    'покажи формулу серной кислоты',
    'нарисуй структурную формулу бензола',
    'нарисуй график растворимости',
    'how to draw a lewis structure',
    'draw a conclusion from the experiment',
    'make a solution of salt',
    'draw',
    'Can you draw a flask?',
    'qanday chizish kerak',
    'eritma tayyorlang',
    'rasm chiz',
    'что такое моль',
    'расскажи про перегонку',
    'show me the answer',
  ]
  for (const text of NEG) {
    const r = parseDrawRequest(text, 'ru')
    check(`intent −: ${text}`, r === null, JSON.stringify(r))
  }
  check('intent: ≥ 24 cases (≥ 12 + / ≥ 12 −, three languages)', POS.length >= 12 && NEG.length >= 12 && POS.length + NEG.length >= 24)
}

/* ================================================================== 6. формулы и SVG-слой */
console.log('[formula] parseFormula / renderOverlaySvg')
{
  const kinds = (toks: FormulaToken[], kind: FormulaToken['kind']) => toks.filter((t) => t.kind === kind).map((t) => t.text)
  const h2so4 = parseFormula('H2SO4')
  check('H2SO4 → sub 2 and 4', kinds(h2so4, 'sub').join(',') === '2,4' && kinds(h2so4, 'normal').join('|') === 'H|SO', JSON.stringify(h2so4))
  const fe = parseFormula('Fe2(SO4)3')
  check('Fe2(SO4)3 → sub 2, 4, 3', kinds(fe, 'sub').join(',') === '2,4,3', JSON.stringify(fe))
  const so4 = parseFormula('SO4^2-')
  check('SO4^2- → sub 4, sup «2−»', kinds(so4, 'sub').join(',') === '4' && kinds(so4, 'sup').join(',') === '2−', JSON.stringify(so4))
  const na = parseFormula('Na+')
  check('Na+ → sup «+»', kinds(na, 'sup').join(',') === '+' && kinds(na, 'normal').join('') === 'Na', JSON.stringify(na))
  const eq = parseFormula('2H2 + O2 → 2H2O')
  check('2H2 + O2 → 2H2O: coefficients normal', eq[0]?.kind === 'normal' && eq[0]!.text.startsWith('2H') && kinds(eq, 'normal').some((t) => t.includes(' 2H')), JSON.stringify(eq))
  check('2H2 + O2 → 2H2O: arrow kept, subs 2,2,2', kinds(eq, 'arrow').join(',') === '→' && kinds(eq, 'sub').join(',') === '2,2,2', JSON.stringify(eq))
  const ascii = parseFormula('N2 + 3H2 <=> 2NH3')
  check('<=> → ⇄', kinds(ascii, 'arrow').join(',') === '⇄' && kinds(ascii, 'sub').join(',') === '2,2,3', JSON.stringify(ascii))
  check('-> and => → →', kinds(parseFormula('Zn + 2HCl -> ZnCl2 + H2↑'), 'arrow').join(',') === '→,↑' && kinds(parseFormula('A => B'), 'arrow').join(',') === '→')
  const co2 = parseFormula('CO2(г)')
  check('CO2(г) → state', kinds(co2, 'state').join(',') === '(г)' && kinds(co2, 'sub').join(',') === '2', JSON.stringify(co2))
  check('NaCl(aq) / H2O(l) → state', kinds(parseFormula('NaCl(aq)'), 'state')[0] === '(aq)' && kinds(parseFormula('H2O(l)'), 'state')[0] === '(l)')
  const uni = parseFormula('H₂O')
  check('unicode H₂O → sub 2', kinds(uni, 'sub').join(',') === '2', JSON.stringify(uni))
  check('unicode SO₄²⁻ → sub 4, sup 2−', kinds(parseFormula('SO₄²⁻'), 'sup').join(',') === '2−' && kinds(parseFormula('SO₄²⁻'), 'sub').join(',') === '4')
  check('Fe3+ → sup «3+»', kinds(parseFormula('Fe3+'), 'sup').join(',') === '3+' && kinds(parseFormula('Fe3+'), 'sub').length === 0)
  check('SO42- → sub 4, sup 2−', kinds(parseFormula('SO42-'), 'sub').join(',') === '4' && kinds(parseFormula('SO42-'), 'sup').join(',') === '2−')
  check('(NH4)2SO4 → sub 4, 2, 4', kinds(parseFormula('(NH4)2SO4'), 'sub').join(',') === '4,2,4')
  check('CuSO4*5H2O → «·», 5 normal', formulaToUnicode('CuSO4*5H2O') === 'CuSO₄·5H₂O', formulaToUnicode('CuSO4*5H2O'))
  check('formulaToUnicode H2SO4 / SO4^2-', formulaToUnicode('H2SO4') === 'H₂SO₄' && formulaToUnicode('SO4^2-') === 'SO₄²⁻', `${formulaToUnicode('H2SO4')} ${formulaToUnicode('SO4^2-')}`)
  check('formulaToUnicode equation', formulaToUnicode('2H2 + O2 -> 2H2O') === '2H₂ + O₂ → 2H₂O', formulaToUnicode('2H2 + O2 -> 2H2O'))

  const svg = renderOverlaySvg({ width: 1024, height: 1024, formula: 'H2SO4 + Zn -> ZnSO4 + H2^', caption: 'Цинк в серной кислоте: выделяется водород <газ> & пузырьки', theme: 'light' })
  check('svg: root with viewBox', svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"'), svg.slice(0, 80))
  check('svg: no external url()/href', !/url\(|href=|<image|@import|<script/i.test(svg))
  check('svg: text escaped', svg.includes('&lt;газ&gt;') && svg.includes('&amp;') && !svg.includes('<газ>'))
  const fsMain = Number(/font-size="([\d.]+)" font-weight="600"/.exec(svg)?.[1] ?? 0)
  const fsSub = Number(/<tspan [^>]*font-size="([\d.]+)"[^>]*data-k="sub"/.exec(svg)?.[1] ?? 0)
  check('svg: sub/sup tspans at 0.7 of formula size', /data-k="sub"/.test(svg) && /data-k="arrow"/.test(svg) && fsMain > 0 && Math.abs(fsSub / fsMain - 0.7) < 0.01, `${fsMain}/${fsSub}`)
  check('svg: formula size = width/26 for a short formula', Math.abs(Number(/font-size="([\d.]+)" font-weight="600"/.exec(renderOverlaySvg({ width: 1040, height: 1040, formula: 'H2SO4' }))?.[1]) - 40) < 0.11)
  check('svg: «H2^» → gas arrow ↑', formulaToUnicode('Zn + 2HCl -> ZnCl2 + H2^') === 'Zn + 2HCl → ZnCl₂ + H₂↑', formulaToUnicode('Zn + 2HCl -> ZnCl2 + H2^'))
  const spaced = renderOverlaySvg({ width: 1024, height: 1024, formula: 'H2 + Cl2 -> 2HCl' })
  const tight = renderOverlaySvg({ width: 1024, height: 1024, formula: 'H2+Cl2->2HCl' })
  check(
    'svg: arrow spacing — no double spaces, tight input gets padded',
    !/&#160;<\/tspan><tspan [^>]*data-k="arrow">&#160;/.test(spaced) && /<tspan [^>]*data-k="arrow">→<\/tspan>/.test(spaced) && /<tspan [^>]*data-k="arrow">&#160;→&#160;<\/tspan>/.test(tight),
    tight.slice(tight.indexOf('arrow') - 40, tight.indexOf('arrow') + 40),
  )
  const ionSvg = renderOverlaySvg({ width: 1024, height: 1024, formula: 'SO4^2-' })
  check('svg: charge tspan raised (negative dy)', /<tspan dy="-[\d.]+" font-size="[\d.]+" data-k="sup">2−<\/tspan>/.test(ionSvg), ionSvg.slice(0, 400))
  check('svg: system font only', /font-family='"Segoe UI", Roboto, Arial, sans-serif'/.test(svg))
  // грубая проверка XML: все теги закрыты
  const open = (svg.match(/<(svg|text|tspan|rect)\b/g) ?? []).length
  const closed = (svg.match(/<\/(svg|text|tspan)>|\/>/g) ?? []).length
  check('svg: tags balanced', open === closed, `${open}/${closed}`)
  const dark = renderOverlaySvg({ width: 832, height: 1216, caption: 'Подпись', theme: 'dark', position: 'top' })
  check('svg dark: dark plate 70 %, caption only', dark.includes('rgba(15,23,42,0.70)') && !/data-k=/.test(dark) && dark.includes('viewBox="0 0 832 1216"'))
  check('svg: nothing to draw → empty', renderOverlaySvg({ width: 1024, height: 1024 }) === '')
  const longCap = renderOverlaySvg({ width: 1024, height: 1024, caption: 'слово '.repeat(60) })
  const capLines = (longCap.match(/<text [^>]*>([^<]*)<\/text>/g) ?? []).length
  check('svg: caption cut to 120 chars, ≤ 3 lines', capLines >= 1 && capLines <= 3 && (longCap.match(/слово/g) ?? []).length <= 20, String(capLines))
  const longWord = renderOverlaySvg({ width: 600, height: 600, caption: `${'Ж'.repeat(110)} конец` })
  check('svg: word longer than a line → «…»', longWord.includes('…') && (longWord.match(/<text /g) ?? []).length <= 3)
}

/* ================================================================== 7. мелочи */
{
  check('pngFileName', pngFileName('g8-zinc-acid', 4242) === 'atomlab-g8-zinc-acid-4242.png' && pngFileName(null, 1) === 'atomlab-draw-1.png' && pngFileName('../x', 2) === 'atomlab-x-2.png')
  const s = randomSeed()
  check('randomSeed in 0..2^48', Number.isInteger(s) && s >= 0 && s < 2 ** 48)
}

/* ================================================================== 8. режим «🎨 Картинка» (drawMode.ts) */
{
  // доступность режима: всем видно, выбирается только когда сервер рисует и готов
  const on = { enabled: true, ready: true, students: true, engine: 'z-image-turbo' }
  check('mode: offline → not selectable (offline)', drawAvailability(null, 'student').selectable === false && drawAvailability(null, 'student').reason === 'offline')
  check('mode: disabled → not selectable', drawAvailability({ ...on, enabled: false }, 'owner').reason === 'disabled')
  check('mode: preparing → not selectable', drawAvailability({ ...on, ready: false }, 'teacher').reason === 'preparing' && !drawAvailability({ ...on, ready: false }, 'teacher').selectable)
  check('mode: student + students on → can draw', drawAvailability(on, 'student').canDraw && drawAvailability(on, 'student').selectable)
  const off = drawAvailability({ ...on, students: false }, 'student')
  check('mode: student + students off → selectable (key entry), cannot draw', off.selectable && !off.canDraw && off.studentsOff)
  check('mode: teacher draws even when students off', drawAvailability({ ...on, students: false }, 'teacher').canDraw)

  // фазы сервера → этапы
  const map: Array<[ImagePhase | 'queue' | 'done', string]> = [
    ['checking', 'request'],
    ['queue', 'queue'],
    ['waiting_gpu', 'gpu'],
    ['switching', 'gpu'],
    ['loading', 'gpu'],
    ['sampling', 'draw'],
    ['decoding', 'draw'],
    ['safety', 'check'],
    ['encoding', 'check'],
    ['done', 'done'],
  ]
  check('stages: every server phase mapped', map.every(([p, st]) => stageOf(p) === st), map.map(([p]) => `${p}→${stageOf(p)}`).join(','))
  check('stages: order queue < gpu < draw < check < done', stageIndex('request') < stageIndex('queue') && stageIndex('queue') < stageIndex('gpu') && stageIndex('gpu') < stageIndex('draw') && stageIndex('draw') < stageIndex('check') && stageIndex('check') < stageIndex('done'))

  // темы класса ±1 и ближайшая тема к «нарисуй …»
  const P = (id: string, grades: string[], title: string): ImagePreset => ({ id, grades, title, topic: '', style: 'illustration', size: 'square' })
  const list: ImagePreset[] = [
    P('g7-oxygen-apparatus', ['g7', 'g8'], 'Получение кислорода из KMnO₄'),
    P('g7-hydrogen-kipp', ['g7', 'g8'], 'Аппарат Киппа'),
    P('g7-water-molecule', ['g7', 'g8'], 'Модель молекулы воды'),
    P('g8-zinc-acid', ['g8'], 'Цинк в соляной кислоте'),
    P('g9-sodium-water', ['g9'], 'Натрий на воде'),
    P('g10-methane-model', ['g9', 'g10'], 'Модель молекулы метана'),
    P('g11-protein-helix', ['g11'], 'Спираль белка'),
  ]
  const g7 = presetsForGrade(list, 'g7')
  check('presets: grade 7 ±1 → 7–8 only', g7.map((p) => p.id).join(',') === 'g7-oxygen-apparatus,g7-hydrogen-kipp,g7-water-molecule,g8-zinc-acid', g7.map((p) => p.id).join(','))
  check('presets: grade 10 ±1 → 9–11', presetsForGrade(list, '10').length === 3, String(presetsForGrade(list, '10').length))
  check('presets: grade unknown → all', presetsForGrade(list, '').length === list.length)
  check('nearest: «получение кислорода» → oxygen', nearestPreset('получение кислорода', g7)?.id === 'g7-oxygen-apparatus')
  check('nearest: «аппарат Киппа» → kipp', nearestPreset('аппарат Киппа с цинком', g7)?.id === 'g7-hydrogen-kipp')
  check('nearest: «водород» (ru, not in title) → kipp by id', nearestPreset('получение водорода', g7)?.id === 'g7-hydrogen-kipp')
  check('nearest: «молекулу воды» → water model', nearestPreset('молекулу воды', g7)?.id === 'g7-water-molecule')
  check('nearest: uz «suv molekulasi» → water model', nearestPreset('suv molekulasi', g7)?.id === 'g7-water-molecule')
  check('nearest: «цинк в кислоте» → zinc', nearestPreset('цинк в кислоте', g7)?.id === 'g8-zinc-acid')
  check('nearest: nothing similar → null', nearestPreset('космический корабль', g7) === null)
  check('nearest: other grade topic not offered to grade 7', nearestPreset('спираль белка', g7) === null)

  // вопрос учителю — текст (тема, формула, описание), без байтов картинки
  const qRu = askAboutImageText('ru', { subject: 'Цинк в соляной кислоте', formula: 'Zn + 2HCl → ZnCl₂ + H₂↑' })
  check('ask ru: subject + formula + explain', qRu.includes('«Цинк в соляной кислоте»') && qRu.includes('ZnCl₂') && /Объясни/.test(qRu) && !qRu.includes('data:'), qRu)
  const qUz = askAboutImageText('uz', { subject: 'Kipp apparati', description: 'rux va kislota bilan Kipp apparati' })
  check('ask uz: description included', qUz.includes('Kipp apparati') && qUz.includes('Tavsif') && /tushuntiring/.test(qUz), qUz)
  const qEn = askAboutImageText('en', { subject: 'Water', description: 'water' })
  check('ask en: same description not repeated', !qEn.includes('Description') && qEn.includes('“Water”'), qEn)
  check('ask: subject capped', askAboutImageText('ru', { subject: 'x'.repeat(500) }).length < 400)

  // подпись-формула ученика: только символы формул
  check('formula: chemistry kept', cleanFormulaInput('Zn + 2HCl -> ZnCl2 + H2↑') === 'Zn + 2HCl -> ZnCl2 + H2↑')
  check('formula: Cyrillic words and emoji dropped', !/[а-я]/i.test(cleanFormulaInput('H2O дурак \u{1F600}')) && cleanFormulaInput('H2O дурак \u{1F600}').startsWith('H2O'), JSON.stringify(cleanFormulaInput('H2O дурак \u{1F600}')))
  check('formula: ≤ 80', cleanFormulaInput('H2O'.repeat(50)).length === 80)

  check('wait: seconds / minutes / hours', waitLabel(40, 'ru') === '40 с' && waitLabel(600, 'en') === '10 min' && waitLabel(86400, 'uz') === '24 soat', `${waitLabel(40, 'ru')}|${waitLabel(600, 'en')}|${waitLabel(86400, 'uz')}`)

  // галерея вкладки: новые первыми, без повторов, не больше GALLERY_MAX
  clearGallery()
  const item = (i: number): DrawGalleryItem => ({ id: `j${i}`, dataUrl: 'data:image/webp;base64,AA', width: 1024, height: 1024, subject: `s${i}`, presetId: null, seed: i, formula: '', caption: '', description: '', at: i })
  for (let i = 0; i < GALLERY_MAX + 3; i++) addToGallery(item(i))
  addToGallery(item(GALLERY_MAX + 2))
  const gl = galleryItems()
  check('gallery: newest first, capped, unique', gl.length === GALLERY_MAX && gl[0]!.id === `j${GALLERY_MAX + 2}` && new Set(gl.map((g) => g.id)).size === gl.length)
  clearGallery()
  check('gallery: clear', galleryItems().length === 0)
}

/* ------------------------------------------------------------------ итог */
console.log(`\nimage-client selftest: ${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`)
  throw new Error(`image-client selftest: ${failures.length} failed`)
}
