/**
 * Самопроверка части «brain-web» (политика R1/R2/R3, светская беседа, клиент локального мозга,
 * маршрутизатор учителя и движок живого урока) — с подменой fetch, без сервера и без сети.
 *
 *   npx tsx src/learn/brain/remote/brainWeb.selftest.ts
 *
 * Файл не импортируется сайтом (в сборку не попадает), но проходит tsc вместе с src.
 * Без node-типов: провал — исключение в конце (код выхода 1).
 */
import { setDialogBackend } from '../dialog/dialogState'
import { setMemoryProfileBackend } from '../human/studentProfile'
import { TrainingModeEngine } from '../dualMode/trainingModeEngine'
import {
  applyInputPolicy,
  detectQuestionLang,
  ensureNoUnknown,
  hasUnknownPhrase,
  matchesOwnerRule,
  MODERATION_NOTICE,
  moderateText,
  OWNER_RULE_TEXT,
  SMALLTALK_PATTERN_COUNT,
} from '../policy'
import { routeTeacherReply } from '../../learnTeacherRouter'
import type { LearnLocalAssistantContext } from '../../learnLocalAssistant'
import { BRAIN_URL, checkHealth, getBrainStatus, getBrainStudent, markBrainOffline, parseSseBuffer, streamChat } from './brainClient'

setMemoryProfileBackend()
setDialogBackend('memory')

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

/** Независимый от noUnknown.ts список запрещённых фраз R3 (контракт). */
const R3_CONTRACT = /в моей базе нет|нет в (моей )?базе|(?<!\p{L})не знаю(?!\p{L})|не могу ответить|bazamda[^.!?]{0,60}yo['‘ʻ]?q|bilmayman|i don'?t know|not in my database|умный ИИ|(?<!\p{L})puter(?!\p{L})/iu
/** Мат, который не должен попадать в ответ. */
const PROFANITY = /бля|б\*я|хуй|пизд|fuck|jalab/iu

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/* ------------------------------------------------------------------ подмена fetch */

type FetchInit = RequestInit | undefined
type Handler = (url: string, init: FetchInit) => Promise<Response>

const realFetch = globalThis.fetch.bind(globalThis)
const calls: { url: string; body: string }[] = []
let brainHandler: Handler = async () => {
  throw new TypeError('connect ECONNREFUSED 127.0.0.1:8787')
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith(BRAIN_URL)) {
    calls.push({ url: url.slice(BRAIN_URL.length), body: typeof init?.body === 'string' ? init.body : '' })
    return brainHandler(url.slice(BRAIN_URL.length), init)
  }
  return realFetch(input, init)
}) as typeof fetch

const HEALTH_OK = {
  ok: true,
  service: 'atomlab-brain',
  version: '1.0.0',
  contract: 1,
  llm: { available: false, chatModel: null, fastModel: null, embedModel: null },
  kb: { docs: 10, journalLines: 3, embedded: 0 },
  uptimeMs: 1000,
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

/** Поток SSE кусками (с задержкой); `breakAfter` — оборвать соединение после N кусков. */
function sseResponse(chunks: string[], opts: { delayMs?: number; breakAfter?: number } = {}): Response {
  const enc = new TextEncoder()
  let i = 0
  const body = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      await sleep(opts.delayMs ?? 5)
      if (opts.breakAfter !== undefined && i >= opts.breakAfter) {
        ctrl.error(new TypeError('socket hang up'))
        return
      }
      if (i >= chunks.length) {
        ctrl.close()
        return
      }
      ctrl.enqueue(enc.encode(chunks[i++]!))
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

/** Ответ мозга: meta → куски delta → done. Куски намеренно режут события пополам. */
function brainReply(parts: string[], done: Record<string, unknown>): string[] {
  const full = parts.join('')
  const stream = [
    sse('meta', { turnId: 't1', intent: 'chemistry', route: 'llm', moderated: false, lang: 'ru' }),
    ...parts.map((p) => sse('delta', { text: p })),
    sse('done', { text: full, source: 'llm', citations: [], confidence: 0.8, confidenceLabel: 'high', ms: 42, ...done }),
  ].join('')
  const out: string[] = []
  for (let i = 0; i < stream.length; i += 37) out.push(stream.slice(i, i + 37))
  return out
}

const ctxOf = (locale: 'ru' | 'en' | 'uz'): LearnLocalAssistantContext => ({
  locale,
  gradeId: 'g8',
  chapterId: 'c1',
  sectionId: 's01',
  sectionTitle: '',
  slideTitle: '',
  slideBody: '',
  mode: 'teacher',
  kpNumber: 1,
})
const ask = (q: string) => [{ role: 'user', content: q }]

/* ================================================================== 1. правило владельца (R1) */
console.log('[R1] правило владельца')
const OWNER_Q: string[] = [
  'Чем органическая химия отличается от неорганической?',
  'в чём разница между органической и неорганической химией',
  'Органическая и неорганическая химия — какая разница?',
  'сравни органическую и неорганическую химию',
  'Органика vs неорганика',
  'чем отличаются органические вещества от неорганических',
  'Различия органической и неорганической химии, пожалуйста',
  'органическая химия против неорганической: что общего и в чём отличие',
  'ОРГАНИЧЕСКАЯ ХИМИЯ ОТЛИЧИЕ ОТ НЕОРГАНИЧЕСКОЙ',
  'Органическая и неорганическая химия — это одно и то же?',
  'What is the difference between organic and inorganic chemistry?',
  'organic vs inorganic chemistry',
  'How does organic chemistry differ from inorganic chemistry?',
  'compare organic and inorganic chemistry',
  'What separates organic chemistry from inorganic chemistry?',
  'Organik va noorganik kimyo oʻrtasidagi farq nima?',
  "organik kimyo noorganik kimyodan nima bilan farq qiladi",
  'organik va anorganik kimyoni solishtiring',
  'Organik kimyo noorganik kimyodan qanday ajralib turadi?',
  'Органик ва ноорганик кимё фарқи нима?',
]
for (const q of OWNER_Q) {
  check(`R1 match: ${q}`, matchesOwnerRule(q))
  const step = applyInputPolicy(q, 'ru')
  check(`R1 reply verbatim: ${q}`, step.kind === 'reply' && step.text === OWNER_RULE_TEXT, step.kind === 'reply' ? step.text.slice(0, 60) : step.kind)
}
const NOT_OWNER: string[] = [
  'разница между кислотой и основанием',
  'чем отличается кислота от основания',
  'что изучает органическая химия',
  'что такое неорганическая химия',
  'difference between acids and bases',
  'organik kimyo nimani oʻrganadi',
  'сравни металлы и неметаллы',
]
for (const q of NOT_OWNER) check(`R1 trap: ${q}`, !matchesOwnerRule(q))

/* ================================================================== 2. модерация (R2) */
console.log('[R2] модерация')
const MOD_CASES: { q: string; lang: 'ru' | 'en' | 'uz'; topic: RegExp }[] = [
  { q: 'б*я, что такое моль', lang: 'ru', topic: /моль/i },
  { q: 'бляяя что такое моль', lang: 'ru', topic: /моль/i },
  { q: 'х у й знает что такое моль', lang: 'ru', topic: /моль/i },
  { q: 'сука, объясни что такое валентность', lang: 'ru', topic: /валентност/i },
  { q: 'what the f**k is a mole', lang: 'en', topic: /mole/i },
  { q: 'wtf fucking acids, what is pH', lang: 'en', topic: /ph/i },
  { q: 'jalab, mol nima?', lang: 'uz', topic: /mol/i },
]
for (const c of MOD_CASES) {
  const mod = moderateText(c.q, 'ru')
  check(`R2 flagged: ${c.q}`, mod.flagged)
  check(`R2 cleaned keeps topic: ${c.q}`, c.topic.test(mod.cleaned) && !PROFANITY.test(mod.cleaned), mod.cleaned)
  const step = applyInputPolicy(c.q, 'ru')
  check(`R2 notice lang ${c.lang}: ${c.q}`, step.kind === 'continue' && step.prefix === `${MODERATION_NOTICE[c.lang]}\n\n`, step.kind)
}
const CLEAN: string[] = [
  'употребление хлеба',
  'скипидар растворитель',
  'застрахуй меня от ошибок в задаче',
  'не надо оскорблять ученика',
  'учебник 8 класса',
  'рубль и корабль',
  'Shiitake mushrooms',
  'yukni koʻtarish',
  'себя проверить',
]
for (const q of CLEAN) check(`R2 whitelist: ${q}`, !moderateText(q, 'ru').flagged)
check('R2 ru text verbatim', MODERATION_NOTICE.ru === 'Пожалуйста, выражайтесь корректно, использование ненормативной лексики в этом чате недопустимо.')

/* ================================================================== 3. светская беседа */
console.log('[smalltalk]')
check('smalltalk ≥ 40 patterns', SMALLTALK_PATTERN_COUNT >= 40, String(SMALLTALK_PATTERN_COUNT))
const SMALL: { q: string; bridge: RegExp }[] = [
  { q: 'привет', bridge: /хими/i },
  { q: 'Привет! Как дела?', bridge: /хими/i },
  { q: 'кто ты', bridge: /хими/i },
  { q: 'спасибо большое', bridge: /\S/ },
  { q: 'hello', bridge: /chemistry/i },
  { q: 'how are you?', bridge: /chemistry/i },
  { q: 'salom', bridge: /kimyo/i },
  { q: 'Assalomu alaykum', bridge: /kimyo/i },
]
for (const s of SMALL) {
  const step = applyInputPolicy(s.q, 'ru', 3)
  check(`smalltalk reply: ${s.q}`, step.kind === 'reply' && s.bridge.test(step.text), step.kind === 'reply' ? step.text.slice(0, 80) : step.kind)
}
check('smalltalk does not swallow questions', applyInputPolicy('привет, что такое моль?', 'ru').kind === 'continue')

/* ================================================================== 4. R3 и язык */
console.log('[R3] пост-проверка')
const R3_SAMPLES: [string, 'ru' | 'en' | 'uz'][] = [
  ['К сожалению, в моей базе нет ответа на этот вопрос. Выдумывать не буду.', 'ru'],
  ['Я не знаю, что такое лантаноидное сжатие.', 'ru'],
  ['Подключи умный ИИ, и он ответит.', 'ru'],
  ["I don't know. It is not in my database.", 'en'],
  ['Bazamda bu haqda maʼlumot yoʻq. Bilmayman.', 'uz'],
]
for (const [text, lang] of R3_SAMPLES) {
  const out = ensureNoUnknown(text, lang, ['Строение атома', 'Периодический закон'], { query: 'лантаноидное сжатие' })
  check(`R3 rewritten: ${text.slice(0, 40)}`, !R3_CONTRACT.test(out) && !hasUnknownPhrase(out), out.slice(0, 80))
  check(`R3 reasoned lead (${lang})`, /Разберём от основ|Let us reason from the fundamentals|Asoslardan boshlab/u.test(out))
}
check('lang ru', detectQuestionLang('что такое моль') === 'ru')
check('lang en', detectQuestionLang('what is a mole') === 'en')
check('lang uz', detectQuestionLang('mol nima?') === 'uz')
check('lang uz-cyr', detectQuestionLang('моль нима?') === 'uz')

/* ================================================================== 5. клиент мозга */
console.log('[client] /health, SSE')
{
  const parsed = parseSseBuffer('event: delta\ndata: {"text":"a"}\n\nevent: delta\r\ndata: {"text":"b"}\r\n\r\nevent: do')
  check('SSE parser: 2 events + rest', parsed.events.length === 2 && parsed.rest === 'event: do' && parsed.events[1]!.data === '{"text":"b"}')

  // мозга нет (ECONNREFUSED) → offline
  calls.length = 0
  check('health offline (refused)', (await checkHealth(true)) === false && getBrainStatus() === 'offline')

  // /health висит → таймаут 800 мс
  brainHandler = (url, init) =>
    url === '/health'
      ? new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError'))))
      : Promise.reject(new TypeError('refused'))
  const t0 = Date.now()
  const hung = await checkHealth(true)
  const dt = Date.now() - t0
  check('health timeout ≈ 800 ms → offline', !hung && dt >= 700 && dt < 1500, `${dt} ms`)

  // чужой сервис на порту → offline
  brainHandler = async (url) => (url === '/health' ? json({ ok: true, service: 'other' }) : json({}, 404))
  check('health foreign service → offline', (await checkHealth(true)) === false)

  // мозг есть
  brainHandler = async (url) => (url === '/health' ? json(HEALTH_OK) : json({}, 404))
  const t1 = Date.now()
  check('health online ≤ 1 s', (await checkHealth(true)) === true && getBrainStatus() === 'online' && Date.now() - t1 < 1000)
  calls.length = 0
  await checkHealth(false)
  check('health cached (no second request within 20 s)', calls.length === 0)

  // поток: куски delta, done с цитатами и моделью ученика
  const deltas: string[] = []
  brainHandler = async (url, init) => {
    if (url === '/health') return json(HEALTH_OK)
    const body = JSON.parse(String(init?.body ?? '{}')) as { messages: { role: string }[]; context: { gradeId: string }; stream: boolean }
    if (!body.stream || body.messages[body.messages.length - 1]?.role !== 'user') return json({ error: 'bad' }, 400)
    return sseResponse(
      brainReply(['Моль — ', 'количество вещества, ', 'в котором 6,02·10²³ частиц.'], {
        citations: ['[Kimyo 8, §12, стр. 54]'],
        student: { level: 3, mood: 'neutral', pace: 'normal', recentErrors: ['путает моль и массу'] },
      }),
    )
  }
  const done = await streamChat({
    messages: [{ role: 'assistant', content: 'Привет!' }, { role: 'user', content: 'что такое моль' }],
    context: { gradeId: '8', mode: 'chat', detail: 'brief' },
    lang: 'ru',
    onDelta: (_d, full) => deltas.push(full),
  })
  check('stream: done text', done?.text === 'Моль — количество вещества, в котором 6,02·10²³ частиц.', done?.text)
  check('stream: ≥ 3 growing deltas', deltas.length >= 3 && deltas.every((d, i) => i === 0 || d.length > deltas[i - 1]!.length), String(deltas.length))
  check('stream: citations + student', done?.citations[0] === '[Kimyo 8, §12, стр. 54]' && getBrainStudent()?.level === 3)
  const chatBody = JSON.parse(calls.find((c) => c.url === '/chat')?.body ?? '{}') as { context?: { gradeId?: string }; sessionId?: string }
  check('stream: request gradeId g8 + sessionId', chatBody.context?.gradeId === 'g8' && /^s-/.test(chatBody.sessionId ?? ''))

  // обрыв до первого delta → null, мозг offline
  brainHandler = async (url) => (url === '/health' ? json(HEALTH_OK) : sseResponse([sse('meta', { turnId: 't', intent: 'chemistry', route: 'llm', moderated: false, lang: 'ru' })], { breakAfter: 1 }))
  await checkHealth(true)
  const none = await streamChat({ messages: ask('что такое моль'), context: { gradeId: 'g8', mode: 'chat', detail: 'brief' }, lang: 'ru' })
  check('stream: break before delta → null + offline', none === null && getBrainStatus() === 'offline')

  // обрыв после delta → накопленный текст
  brainHandler = async (url) => (url === '/health' ? json(HEALTH_OK) : sseResponse(brainReply(['Электролиз — это ', 'разложение веществ током', ' — и дальше...'], {}).slice(0, 6), { breakAfter: 6 }))
  await checkHealth(true)
  const part = await streamChat({ messages: ask('что такое электролиз'), context: { gradeId: 'g8', mode: 'chat', detail: 'brief' }, lang: 'ru' })
  check('stream: break after delta → partial text', !!part?.partial && /Электролиз/.test(part.text), part?.text ?? 'null')

  // ошибка сервера 500 → null
  brainHandler = async (url) => (url === '/health' ? json(HEALTH_OK) : json({ error: 'internal' }, 500))
  await checkHealth(true)
  check('stream: HTTP 500 → null', (await streamChat({ messages: ask('x'), context: { gradeId: '', mode: 'chat', detail: 'brief' }, lang: 'ru' })) === null)
}

/* ================================================================== 6. маршрутизатор учителя */
console.log('[router] routeTeacherReply')
{
  // мозг онлайн: потоковый ответ, onDelta дописывает сообщение, источник 'brain'
  brainHandler = async (url) =>
    url === '/health'
      ? json(HEALTH_OK)
      : sseResponse(brainReply(['Электроотрицательность — ', 'способность атома ', 'притягивать электроны связи.'], { citations: ['[ATOMLAB: расчёт]'] }))
  await checkHealth(true)
  const live: string[] = []
  calls.length = 0
  const r = await routeTeacherReply(ask('что такое электроотрицательность'), ctxOf('ru'), { onDelta: (t) => live.push(t), detail: 'brief' })
  check('router brain: source brain', r.source === 'brain', r.source)
  check('router brain: streamed deltas', live.length >= 3 && /притягивать/.test(live[live.length - 1]!), String(live.length))
  check('router brain: citations appended', r.citations[0] === '[ATOMLAB: расчёт]' && r.text.includes('[ATOMLAB: расчёт]'))

  // R1 при запущенном мозге — без запроса /chat
  calls.length = 0
  const owner = await routeTeacherReply(ask('Чем органическая химия отличается от неорганической?'), ctxOf('ru'))
  check('router R1 verbatim, no /chat', owner.text === OWNER_RULE_TEXT && !calls.some((c) => c.url === '/chat'), owner.text.slice(0, 60))

  // мат при запущенном мозге: в мозг уходит очищенный вопрос, ответ начинается с R2
  calls.length = 0
  const rude = await routeTeacherReply(ask('б*я, что такое электроотрицательность'), ctxOf('ru'), { onDelta: (t) => live.push(t) })
  const sent = calls.find((c) => c.url === '/chat')?.body ?? ''
  check('router R2: notice first + blank line', rude.text.startsWith(`${MODERATION_NOTICE.ru}\n\n`), rude.text.slice(0, 90))
  check('router R2: brain got cleaned question', /электроотрицательность/.test(sent) && !PROFANITY.test(sent), sent.slice(0, 120))
  check('router R2: streamed text keeps notice', live[live.length - 1]!.startsWith(MODERATION_NOTICE.ru))

  // мозг ответил «не знаю» — пост-проверка R3
  brainHandler = async (url) =>
    url === '/health' ? json(HEALTH_OK) : sseResponse(brainReply(['Честно, я не знаю. ', 'В моей базе нет ответа.'], {}))
  const unk = await routeTeacherReply(ask('что такое лантаноидное сжатие'), ctxOf('ru'))
  check('router brain R3 rewritten', !R3_CONTRACT.test(unk.text) && /Разберём от основ/.test(unk.text), unk.text.slice(0, 100))

  // мозг оборвался на полуслове: показываем полученное, следующий вопрос — запасной путь без /chat
  brainHandler = async (url) =>
    url === '/health' ? json(HEALTH_OK) : sseResponse(brainReply(['Катализатор ускоряет реакцию, ', 'снижая энергию активации, ', 'но сам...'], {}).slice(0, 7), { breakAfter: 7 })
  await checkHealth(true)
  const cut = await routeTeacherReply(ask('что такое катализатор'), ctxOf('ru'))
  check('router cut: partial brain text shown', cut.source === 'brain' && /Катализатор/.test(cut.text), cut.text.slice(0, 80))
  check('router cut: brain marked offline', getBrainStatus() === 'offline')
  calls.length = 0
  brainHandler = async () => {
    throw new TypeError('connect ECONNREFUSED')
  }
  const next = await routeTeacherReply(ask('что такое катализатор'), ctxOf('ru'))
  check('router cut: next question → fallback, no /chat', next.source !== 'brain' && next.text.length > 20 && !calls.some((c) => c.url === '/chat'), `${next.source}: ${next.text.slice(0, 60)}`)
}

/* ================================================================== 7. запасной путь без мозга */
console.log('[fallback] без мозга')
{
  markBrainOffline()
  brainHandler = async () => {
    throw new TypeError('connect ECONNREFUSED')
  }
  await checkHealth(true)
  const hi = await routeTeacherReply(ask('привет'), ctxOf('ru'))
  check('fallback: привет → warm + bridge', /хими/i.test(hi.text) && hi.source === 'local', hi.text.slice(0, 80))
  const mole = await routeTeacherReply(ask('б*я, что такое моль'), ctxOf('ru'))
  check('fallback: R2 + mole', mole.text.startsWith(`${MODERATION_NOTICE.ru}\n\n`) && /моль/i.test(mole.text.slice(MODERATION_NOTICE.ru.length)) && !PROFANITY.test(mole.text), mole.text.slice(0, 140))
  const lanth = await routeTeacherReply(ask('что такое лантаноидное сжатие'), ctxOf('ru'))
  check('fallback: лантаноидное сжатие — no R3', !R3_CONTRACT.test(lanth.text), lanth.text.slice(0, 160))
  check('fallback: лантаноидное сжатие — reasoning/answer', /Разберём от основ|сжати/i.test(lanth.text), lanth.text.slice(0, 160))
  for (const q of ['что такое квантовая хромодинамика глюонов в химии', 'what is lanthanide contraction', 'lantanoid siqilishi nima']) {
    const lang = detectQuestionLang(q)
    const res = await routeTeacherReply(ask(q), ctxOf(lang))
    check(`fallback ${lang}: no R3 — ${q}`, res.text.length > 20 && !R3_CONTRACT.test(res.text), res.text.slice(0, 120))
    // «хром» внутри «хромодинамики» — не карточка про дихромат калия
    if (/хромодинамик/.test(q)) check('fallback: FAQ only on subject', !/дихромат/i.test(res.text), res.text.slice(0, 80))
    // ответ на языке ученика без «нет статьи / нет в библиотеке»
    check(`fallback ${lang}: no "missing article" notice`, !/no English article|kutubxonamizda yo/i.test(res.text), res.text.slice(0, 80))
  }
  for (const q of OWNER_Q.slice(0, 10)) {
    const res = await routeTeacherReply(ask(q), ctxOf('ru'))
    check(`fallback R1: ${q}`, res.text === OWNER_RULE_TEXT)
  }
}

/* ================================================================== 8. живой урок: фразы мозга по мере прихода */
console.log('[live] TrainingModeEngine')
{
  brainHandler = async (url) =>
    url === '/health'
      ? json(HEALTH_OK)
      : sseResponse(brainReply(['Кислота — это вещество, которое отдаёт протон. ', 'Например, соляная кислота HCl. ', 'А основание протон принимает.'], {}), { delayMs: 15 })
  await checkHealth(true)
  const engine = new TrainingModeEngine({ lang: 'ru', gradeId: 'g8', chapterId: 'c1', sectionId: 's01', sectionTitle: '' })
  const spoken: { s: string; at: number }[] = []
  const t0 = Date.now()
  const ans = await engine.answer({ text: 'что такое кислота', history: [], previousQuestions: [], onSentence: (s) => spoken.push({ s, at: Date.now() - t0 }) })
  check('live brain: source brain', ans.source === 'brain', ans.source)
  check('live brain: ≥ 2 sentences spoken', spoken.length >= 2, String(spoken.length))
  check('live brain: first sentence before stream end', spoken.length > 0 && spoken[0]!.at < (ans.timings.totalMs || Infinity), JSON.stringify(spoken.map((x) => x.at)))
  const r1 = await engine.answer({ text: 'organic vs inorganic chemistry', history: [], previousQuestions: [] })
  check('live R1 verbatim', r1.text === OWNER_RULE_TEXT)
  markBrainOffline()
  brainHandler = async () => {
    throw new TypeError('refused')
  }
  const rude = await engine.answer({ text: 'сука, что такое моль', history: [], previousQuestions: [], noBrain: true })
  check('live R2 offline', rude.text.startsWith(MODERATION_NOTICE.ru) && !PROFANITY.test(rude.text), rude.text.slice(0, 100))
}

/* ------------------------------------------------------------------ итог */
console.log(`\nbrain-web selftest: ${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`)
  throw new Error(`brain-web selftest: ${failures.length} failed`)
}
