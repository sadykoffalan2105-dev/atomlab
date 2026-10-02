import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import { matchFaqEntry } from './learnChemistryFaq'
import { pickFaqText } from './learnAssistantLocale'
import { buildAssistantSystemPrompt } from './learnAssistantPrompt'
import { filterAssistantReply } from './learnAssistantGuard'
import { buildTeacherChatPayload, isSmartAiConnected, requestPuterChat } from './learnPuterChat'
import { citationForDisplay, retrieveForTeacher, type TeacherKnowledgeResult } from './teacherKnowledge'
import { detectNonQuestion, isSubstantiveQuestion, replyForNonQuestion, resolveTurn } from './brain/dualMode/followUps'
import { composeLocalAnswer } from './brain/dualMode/localAnswerComposer'
import { humanTurn, humanizeBookAnswer } from './brain/human/humanTeacher'
import { loadProfile, preferredDetail } from './brain/human/studentProfile'
import { answerFromQaBank } from './brain/qa/qaBank'
import { askTeacherModels } from './brain/human/teacherModelRegistry'
import { mlIntentStep, mergeIntentStyle, replaceLastUser, type IntentStepResult } from './brain/ml/intentStep'
import type { ComposeStyle } from './brain/dualMode/localAnswerComposer'

export type TeacherReplySource = 'faq' | 'local' | 'ollama' | 'api' | 'puter'

export type TeacherRouterOptions = {
  preferOllama?: boolean
  ollamaUrl?: string
  ollamaModel?: string
  /** Отключить облачный «умный ИИ» (Puter). По умолчанию — только если ученик его подключил. */
  disablePuter?: boolean
  signal?: AbortSignal
  /** Потоковая выдача текста «умного ИИ» (для обновления сообщения в ленте). */
  onDelta?: (fullText: string) => void
  /** Уже найденные знания (иначе ищем через teacherKnowledge). */
  knowledge?: TeacherKnowledgeResult
  /** «Человеческий» слой уже отработал (не запускать его повторно). */
  humanHandled?: boolean
}

export type TeacherRouterResult = { text: string; source: TeacherReplySource; citations: string[] }

function puterEnabled(opts?: TeacherRouterOptions): boolean {
  if (opts?.disablePuter) return false
  const flag = import.meta.env.VITE_PUTER_ENABLED
  if (flag === '0' || flag === 'false') return false
  return true
}

const DEFAULT_OLLAMA = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'llama3.2'
const OLLAMA_TIMEOUT_MS = 20_000

function ollamaEnabled(opts?: TeacherRouterOptions): boolean {
  if (opts?.preferOllama === false) return false
  const flag = import.meta.env.VITE_OLLAMA_ENABLED
  if (flag === '0' || flag === 'false') return false
  return opts?.preferOllama === true || flag === '1' || flag === 'true'
}

function lastUserText(messages: { role: string; content: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return messages[i]!.content.trim()
  }
  return ''
}

function isAbort(signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted)
}

async function tryOllamaReply(
  messages: { role: string; content: string }[],
  ctx: LearnLocalAssistantContext,
  knowledge: TeacherKnowledgeResult,
  opts?: TeacherRouterOptions,
): Promise<string | null> {
  if (!ollamaEnabled(opts) || isAbort(opts?.signal)) return null
  const base = (opts?.ollamaUrl ?? import.meta.env.VITE_OLLAMA_URL ?? DEFAULT_OLLAMA).replace(/\/$/, '')
  const model = opts?.ollamaModel ?? import.meta.env.VITE_OLLAMA_MODEL ?? DEFAULT_MODEL
  const { payload } = await buildTeacherChatPayload(messages, ctx, { knowledge, signal: opts?.signal })
  const system = payload[0]?.content ?? buildAssistantSystemPrompt({ ...ctx, knowledgeBlock: '', chemistryKnowledgeBlock: knowledge.text })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), OLLAMA_TIMEOUT_MS)
  const onAbort = () => ctrl.abort()
  opts?.signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: system },
          ...messages.slice(-8).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        ],
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { message?: { content?: string } }
    const text = data.message?.content?.trim()
    const filtered = text ? filterAssistantReply(text, ctx.locale) : ''
    return filtered.length > 2 ? filtered : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    opts?.signal?.removeEventListener('abort', onAbort)
  }
}

function lastTeacherText(messages: { role: string; content: string }[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'assistant') return messages[i]!.content
  }
  return undefined
}

type HumanStep =
  | { done: true; result: TeacherRouterResult & { confident: boolean } }
  | { done: false; messages: { role: string; content: string }[]; prefix: string }

/**
 * «Человеческий» слой (офлайн): разговор, эмоции, память, расчёты, химия из данных проекта.
 * Полный ответ — сразу; смешанная фраза — префикс + остаток-вопрос для базы знаний.
 */
function humanStep(messages: { role: string; content: string }[], ctx: LearnLocalAssistantContext): HumanStep {
  const text = lastUserText(messages)
  let turn: ReturnType<typeof humanTurn>
  try {
    turn = humanTurn(text, { lang: ctx.locale, lastTeacher: lastTeacherText(messages) })
  } catch {
    turn = null
  }
  if (turn?.kind === 'reply') return { done: true, result: { text: turn.text, source: 'local', citations: [], confident: true } }
  if (turn?.kind === 'prefix') {
    const next = [...messages]
    for (let i = next.length - 1; i >= 0; i--) {
      if (next[i]?.role === 'user') {
        next[i] = { ...next[i]!, content: turn.rest }
        break
      }
    }
    return { done: false, messages: next, prefix: turn.prefix }
  }
  return { done: false, messages, prefix: '' }
}

const withPrefix = <T extends { text: string }>(prefix: string, r: T): T => (prefix && r.text ? { ...r, text: `${prefix} ${r.text}` } : r)

/** Короткий фактический вопрос, на который есть готовая карточка FAQ. */
function isShortFactualFaqQuery(query: string): boolean {
  const q = query.trim()
  if (q.length > 70) return false
  return !/расскаж|объясни|подроб|почему|зачем|как\s|чем отлич|сравн|реши|сколько|explain|tell me|why|how |compare|solve|tushuntir|nima uchun|qanday/i.test(
    q,
  )
}

/**
 * Локальный ответ без LLM: знания из базы → живой ответ (без выдумок).
 * Follow-up «проще», «пример», «почему» берут тему прошлого вопроса ученика.
 */
export async function composeLocalTeacherReply(
  messages: { role: string; content: string }[],
  ctx: LearnLocalAssistantContext,
  opts: { signal?: AbortSignal; knowledge?: TeacherKnowledgeResult; detail?: 'brief' | 'more'; humanHandled?: boolean; intentStyle?: Partial<ComposeStyle> } = {},
): Promise<TeacherRouterResult & { confident: boolean }> {
  let ml: IntentStepResult | null = null
  if (!opts.humanHandled) {
    const step = humanStep(messages, ctx)
    if (step.done) return step.result
    if (step.prefix) {
      const inner = await composeLocalTeacherReply(step.messages, ctx, { ...opts, knowledge: undefined, humanHandled: true })
      return withPrefix(step.prefix, inner)
    }
    // ML-слой: классификатор намерений (разговор → банк фраз, поправка → переписать вопрос, учебное → стиль).
    ml = await mlIntentStep(lastUserText(messages), ctx.locale, { topic: ctx.sectionTitle })
    if (ml?.reply) return { text: ml.reply, source: 'local', citations: [], confident: true }
    if (ml?.rewrite) messages = replaceLastUser(messages, ml.rewrite)
  }
  const text = lastUserText(messages)
  const previous = messages
    .slice(0, -1)
    .filter((m) => m.role === 'user' && isSubstantiveQuestion(m.content))
    .map((m) => m.content)
  // «Не знаю» / «ммм» / «спасибо» — отвечаем сразу, без поиска по базе (иначе учитель
  // цепляется за слово «знаю» и пересказывает случайный параграф).
  const nonQuestion = detectNonQuestion(text)
  if (nonQuestion) {
    const topic = previous[previous.length - 1] ?? ctx.sectionTitle
    const reply = replyForNonQuestion(nonQuestion, ctx.locale, { topic, seed: messages.length })
    return { text: reply, source: 'local', citations: [], confident: true }
  }
  // «Большая база данных»: вещества, элементы, реакции учебников, глоссарий — точный факт с подписью источника.
  const qa = await answerFromQaBank(text, { lang: ctx.locale, grade: Number(ctx.gradeId.replace(/\D/g, '')) || null, lastEntity: loadProfile().lastEntity })
  if (qa) return { text: qa.text, source: 'local', citations: qa.citations, confident: true }
  const resolved = resolveTurn(text, previous, ctx.locale, ctx.sectionTitle)
  const knowledge =
    // Результат по таймауту пуст — база ещё грузится; ждём тот же (кешированный) поиск ещё раз.
    opts.knowledge && resolved.query === text && !opts.knowledge.timedOut
      ? opts.knowledge
      : await retrieveForTeacher(resolved.query, {
          locale: ctx.locale,
          gradeId: ctx.gradeId,
          chapterId: ctx.chapterId,
          sectionId: ctx.sectionId,
          sectionTitle: ctx.sectionTitle,
          limit: 8,
          maxChars: 6_000,
          timeoutMs: 2_500,
          signal: opts.signal,
        })
  // Отзывы 👍/👎 ученика: любит подробнее/короче, больше примеров.
  // Подсказка классификатора намерений (почему / пример / проще / подробнее) поверх регулярок follow-up.
  const style = mergeIntentStyle(resolved.style, ml?.style ?? opts.intentStyle, resolved.followUp.kinds.length > 0)
  const detail = opts.detail ?? style.detail ?? preferredDetail() ?? 'brief'
  const composed = composeLocalAnswer({
    query: resolved.query,
    hits: knowledge.hits,
    lang: ctx.locale,
    // Чат: коротко и по делу (прямой ответ + до 2 поясняющих фраз, ≈80 слов); длинно — только по «подробнее».
    style: {
      ...style,
      wantExample: style.wantExample || loadProfile().examples >= 1,
      detail,
      maxWords: detail === 'more' ? 140 : style.simpler ? 50 : 80,
      channel: 'chat',
      helper: ctx.mode === 'helper',
    },
    topicHint: ctx.sectionTitle,
    seed: messages.length,
    suggestSmartAi: !isSmartAiConnected(),
  })
  const used = new Set(composed.usedTitles)
  // Значки — из фрагментов, давших фразы ответа (не все фрагменты с тем же заголовком).
  const citations = [
    ...new Set(
      (composed.usedCitations?.length ? composed.usedCitations : knowledge.hits.filter((h) => used.has(h.title) && h.citation).map((h) => h.citation!)).map((c) =>
        citationForDisplay(c, ctx.locale),
      ),
    ),
  ].slice(0, 3)
  const answer = composed.confident ? humanizeBookAnswer(composed.text, ctx.locale, messages.length) : composed.text
  const body = composed.confident && citations.length ? `${answer}\n\n${citations.join(' ')}` : answer
  return { text: body, source: 'local', citations, confident: composed.confident }
}

/**
 * Бесплатный маршрут ответа учителя (без платежей и ключей):
 * база знаний (teacherKnowledge) → Ollama на этом ПК (если включена) → «умный ИИ»
 * Puter (только если ученик подключил, со стримингом) → локальный ответ из базы →
 * карточка FAQ. Все сетевые шаги отменяемы (signal) и с таймаутами.
 */
export async function routeTeacherReply(
  messages: { role: string; content: string }[],
  ctx: LearnLocalAssistantContext,
  opts?: TeacherRouterOptions,
): Promise<TeacherRouterResult> {
  const signal = opts?.signal
  let ml: IntentStepResult | null = null
  // 0) «Человеческий» слой — офлайн, раньше любых сетей (память и расчёты никуда не уходят).
  if (!opts?.humanHandled) {
    const step = humanStep(messages, ctx)
    if (step.done) return step.result
    if (step.prefix) {
      const inner = await routeTeacherReply(step.messages, ctx, {
        ...opts,
        knowledge: undefined,
        onDelta: opts?.onDelta ? (full) => opts.onDelta?.(`${step.prefix} ${full}`) : undefined,
        humanHandled: true,
      })
      return withPrefix(step.prefix, inner)
    }
    // 0a) ML-слой: классификатор намерений (разговор → банк фраз; поправка → переписать вопрос; учебное → стиль ниже).
    ml = await mlIntentStep(lastUserText(messages), ctx.locale, { topic: ctx.sectionTitle })
    if (ml?.reply) return { text: ml.reply, source: 'local', citations: [] }
    if (ml?.rewrite) messages = replaceLastUser(messages, ml.rewrite)
  }
  const q = lastUserText(messages)
  const knowledge =
    opts?.knowledge ??
    (await retrieveForTeacher(q, {
      locale: ctx.locale,
      gradeId: ctx.gradeId,
      chapterId: ctx.chapterId,
      sectionId: ctx.sectionId,
      sectionTitle: ctx.sectionTitle,
      limit: 8,
      maxChars: 12_000,
      timeoutMs: 2_500,
      signal,
    }))
  if (isAbort(signal)) return { text: '', source: 'local', citations: [] }

  // 0b) Подключённая внешняя модель (реестр; сейчас пуст — учитель офлайн).
  const external = await askTeacherModels(
    messages.map((m) => ({ role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: m.content })),
    { lang: ctx.locale, sectionTitle: ctx.sectionTitle },
    signal,
  )
  if (external) return { text: filterAssistantReply(external.text, ctx.locale), source: 'api', citations: knowledge.citations.slice(0, 3) }

  // 1) Локальная Ollama — если пользователь её поднял (максимальная приватность).
  if (ollamaEnabled(opts)) {
    const ollama = await tryOllamaReply(messages, ctx, knowledge, opts)
    if (ollama) return { text: ollama, source: 'ollama', citations: knowledge.citations.slice(0, 3) }
    if (isAbort(signal)) return { text: '', source: 'local', citations: [] }
  }

  // 2) «Умный ИИ» Puter — только с согласия ученика; окно входа здесь не открывается.
  if (puterEnabled(opts) && isSmartAiConnected()) {
    const puter = await requestPuterChat(messages, ctx, {
      signal,
      knowledge,
      onDelta: opts?.onDelta ? (_d, full) => opts.onDelta?.(full) : undefined,
    }).catch(() => null)
    if (puter) return { text: puter, source: 'puter', citations: knowledge.citations.slice(0, 3) }
    if (isAbort(signal)) return { text: '', source: 'local', citations: [] }
  }

  // 3) Локальный ответ из базы знаний.
  const local = await composeLocalTeacherReply(messages, ctx, { signal, knowledge, humanHandled: true, intentStyle: ml?.style })
  if (local.confident) return local

  // 4) Готовая карточка FAQ для короткого фактического вопроса.
  const faq = isShortFactualFaqQuery(q) ? matchFaqEntry(q.toLowerCase()) : null
  if (faq) return { text: pickFaqText(faq, ctx.locale), source: 'faq', citations: [] }

  return local
}
