import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import { matchFaqEntry } from './learnChemistryFaq'
import { pickFaqText } from './learnAssistantLocale'
import { buildAssistantSystemPrompt } from './learnAssistantPrompt'
import { filterAssistantReply } from './learnAssistantGuard'
import { buildTeacherChatPayload, isSmartAiConnected, requestPuterChat } from './learnPuterChat'
import { citationForDisplay, retrieveForTeacher, type TeacherKnowledgeResult } from './teacherKnowledge'
import { detectNonQuestion, isSubstantiveQuestion, replyForNonQuestion, resolveTurn } from './brain/dualMode/followUps'
import { composeLocalAnswer } from './brain/dualMode/localAnswerComposer'
import { humanTurn } from './brain/human/humanTeacher'
import { detectMood, speakLikeHuman } from './brain/human/personaVoice'
import { loadProfile, preferredDetail } from './brain/human/studentProfile'
import { answerFromQaBank } from './brain/qa/qaBank'
import { askTeacherModels } from './brain/human/teacherModelRegistry'
import { mlIntentStep, mergeIntentStyle, replaceLastUser, type IntentStepResult } from './brain/ml/intentStep'
import type { ComposeStyle } from './brain/dualMode/localAnswerComposer'
import { dialogStep, dialogStyleHints } from './brain/dialog/dialogManager'

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
  | { done: false; messages: { role: string; content: string }[]; prefix: string; rewritten?: boolean }

/**
 * «Человеческий» слой (офлайн): разговор, эмоции, память, расчёты, химия из данных проекта.
 * Полный ответ — сразу; смешанная фраза — префикс + остаток-вопрос для базы знаний.
 */
async function humanStep(messages: { role: string; content: string }[], ctx: LearnLocalAssistantContext): Promise<HumanStep> {
  const text = lastUserText(messages)
  // Диалоговый менеджер (викторина, поддержка, домашка, обучение в моменте, тема из стека) — раньше всего.
  const dialog = await dialogStep(text, { lang: ctx.locale, grade: ctx.gradeId, chapterId: ctx.chapterId, sectionId: ctx.sectionId, sectionTitle: ctx.sectionTitle, messages }).catch(() => null)
  if (dialog?.text) return { done: true, result: { text: dialog.text, source: 'local', citations: dialog.citations, confident: dialog.confident } }
  if (dialog?.rewrite) return { done: false, messages: messages.map((m, i) => (i === messages.length - 1 && m.role === 'user' ? { ...m, content: dialog.rewrite! } : m)), prefix: '', rewritten: true }
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

/* ------------------------------------------------------------ предмет вопроса и главная тема ответа */

/** Вопрос-определение: «что такое…», «кто такой…», «расскажи про…» — у него есть один предмет. */
const DEFINITION_Q = /(?<![а-яё])(что\s+так(ое|ая|ой|ие)|кто\s+так(ой|ая|ие)|что\s+значит|что\s+это|расскажи(те)?\s+(мне\s+)?(о|об|про)|как\s+работает|как\s+устроен|зачем\s+нуж|чем\s+(вредн|полезн|опасн))/iu

/** Банк фактов ответил не о предмете вопроса-определения: ни одно смысловое слово вопроса не упомянуто в начале ответа. */
async function qaOffSubject(query: string, qaText: string, locale: string): Promise<boolean> {
  if (locale !== 'ru' || !DEFINITION_Q.test(query)) return false
  try {
    const { subjectMentionedAtStart } = await import('./kb/wikiBig')
    return !subjectMentionedAtStart(query, qaText.replace(/\*\*/g, ''))
  } catch {
    return false
  }
}

type MainTopicFn = (query: string, title: string, text: string) => boolean
async function mainTopicFn(): Promise<MainTopicFn> {
  const { subjectIsMainTopic } = await import('./kb/wikiBig')
  return subjectIsMainTopic
}

/** Начало «ядра» ответа учебника: без связки учителя и без «В учебнике Kimyo 8 об этом сказано так: «». */
function answerCore(text: string): string {
  const quote = text.match(/[«"]([^»"]{12,})/u)
  if (quote && /сказано|пишут|говорится|написано/i.test(text.slice(0, quote.index ?? 0))) return quote[1]!
  // короткая связка («Если коротко:», «Давай разберёмся.») — убираем
  return text.replace(/^\s*[^.!?:]{0,40}[.!?:]\s+/u, '').replace(/\*\*/g, '')
}

/** Ответ учебника/карточки — о предмете вопроса (в названии использованного фрагмента или в начале ответа). */
function composedOnSubject(
  query: string,
  composed: { text: string; usedTitles: string[] },
  hits: readonly TeacherKnowledgeResult['hits'][number][],
  isMain: MainTopicFn,
): boolean {
  if (!DEFINITION_Q.test(query) && !/^\s*\S+(\s+\S+){0,3}\s*\??\s*$/u.test(query)) return true
  if (isMain(query, '', answerCore(composed.text))) return true
  const used = new Set(composed.usedTitles)
  return hits.some((h) => used.has(h.title) && isMain(query, h.title, h.text))
}

/** Статья большой энциклопедии ровно о предмете вопроса (название = предмет), или пусто. */
async function exactSubjectArticle(query: string): Promise<TeacherKnowledgeResult['hits']> {
  try {
    const { bigWikiHits } = await import('./kb/encyclopedia')
    const { wikiExactTopic } = await import('./kb/wikiBig')
    const big = await bigWikiHits(query, 3)
    // статья из одной фразы беднее ответа учебника — тогда остаётся учебник
    return big[0] && big[0].text.length >= 300 && wikiExactTopic(big[0], query) ? big : []
  } catch {
    return []
  }
}

/** «Кто открыл X»: фразы об открытии из статьи X (большая и малая энциклопедии), карточек учёных и учебника. */
async function discoveryReply(
  query: string,
  encHits: readonly TeacherKnowledgeResult['hits'][number][],
  hits: readonly TeacherKnowledgeResult['hits'][number][],
  seed: number,
): Promise<(TeacherRouterResult & { confident: boolean }) | null> {
  try {
    const { queryContentTerms } = await import('./kb/wikiBig')
    const { analyzeTerms } = await import('./kb/analyzer')
    const { composeDiscoveryAnswer } = await import('./brain/wiki/encyclopediaAnswer')
    const subject = queryContentTerms(query)
    if (!subject.length || subject.length > 3) return null
    const big = await exactSubjectArticle(query)
    const wikiCite = (title: string) => `[Википедия: ${title} — CC BY-SA]`
    const sources = [
      ...big.slice(0, 1).map((h) => ({ title: h.title, text: h.text, cite: wikiCite(h.title) })),
      ...encHits.map((h) => ({ title: h.title, text: h.text, cite: wikiCite(h.title) })),
      ...hits
        .filter((h) => h.type !== 'encyclopedia')
        .map((h) => ({
          title: h.title,
          text: h.text,
          cite: /учён|scientist/i.test(h.citation ?? '') ? '[ATOMLAB — учёные]' : h.citation ? citationForDisplay(h.citation, 'ru') : '[ATOMLAB]',
        })),
    ]
    const ans = composeDiscoveryAnswer(subject, sources, (t) => analyzeTerms(t), { seed })
    return ans ? { text: ans.text, source: 'local', citations: ans.citations, confident: true } : null
  } catch {
    return null
  }
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
    const step = await humanStep(messages, ctx)
    if (step.done) return step.result
    if (step.prefix) {
      const inner = await composeLocalTeacherReply(step.messages, ctx, { ...opts, knowledge: undefined, humanHandled: true })
      return withPrefix(step.prefix, inner)
    }
    if (step.rewritten) {
      messages = step.messages
      opts = { ...opts, knowledge: undefined }
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
  let qaFallback: (TeacherRouterResult & { confident: boolean }) | null = null
  if (qa) {
    const r = { text: qa.text, source: 'local' as const, citations: qa.citations, confident: true }
    // Банк фактов ответил не о предмете вопроса («что такое витамин C» → углерод): ищем дальше, его ответ — запасной.
    if (!(await qaOffSubject(text, qa.text, ctx.locale))) return r
    qaFallback = r
  }
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
  // Слабая тема ученика или недавнее «не понимаю / устал» — объясняем проще и короче.
  const simpler = style.simpler || dialogStyleHints(resolved.query).simpler
  const composed = composeLocalAnswer({
    query: resolved.query,
    hits: knowledge.hits,
    lang: ctx.locale,
    // Чат: коротко и по делу (прямой ответ + до 2 поясняющих фраз, ≈80 слов); длинно — только по «подробнее».
    style: {
      ...style,
      simpler,
      wantExample: style.wantExample || loadProfile().examples >= 1,
      detail,
      maxWords: detail === 'more' ? 140 : simpler ? 50 : 80,
      channel: 'chat',
      helper: ctx.mode === 'helper',
    },
    topicHint: ctx.sectionTitle,
    seed: messages.length,
    suggestSmartAi: !isSmartAiConnected(),
  })
  // wf15: энциклопедия (Википедия, CC BY-SA) — учёные, история, промышленность, быт: когда школьный ответ слабый
  // или вопрос явно «за пределами школы» («кто такой…», «кто открыл…», «нобелевск…», «в промышленности»).
  {
    const { composeEncyclopediaAnswer, encyclopediaIntent, DISCOVERY_QUESTION_RE } = await import('./brain/wiki/encyclopediaAnswer')
    let encHits = knowledge.hits.filter((h) => h.type === 'encyclopedia')
    const strong = encHits.length || !composed.confident ? (await encyclopediaIntent(resolved.query, ctx.locale)) === 'strong' : false
    if (!encHits.length && !composed.confident) {
      const { encyclopediaFallbackHits } = await import('./kb/encyclopedia')
      encHits = await encyclopediaFallbackHits(resolved.query, ctx.locale)
    }
    // «кто открыл / изобрёл X»: фразы об открытии из статьи X, карточек учёных и учебника (не просто статья X)
    if (ctx.locale === 'ru' && DISCOVERY_QUESTION_RE.test(resolved.query)) {
      const disc = await discoveryReply(resolved.query, encHits, knowledge.hits, messages.length)
      if (disc) return disc
    }
    if (encHits.length && (!composed.confident || strong)) {
      const enc = composeEncyclopediaAnswer(resolved.query, encHits, ctx.locale, { seed: messages.length })
      if (enc) return { text: enc.text, source: 'local', citations: [enc.citation], confident: true }
    }
    // Учебник/карточка ответили, но предмет вопроса у них — мимолётное упоминание («Кобальт важен при синтезе
    // гемоглобина», карточка Пастера на «как работает вакцина»): статья, чьё название = предмет вопроса, важнее.
    if (composed.confident && ctx.locale === 'ru' && !composedOnSubject(resolved.query, composed, knowledge.hits, await mainTopicFn())) {
      const exact = await exactSubjectArticle(resolved.query)
      if (exact.length) {
        const enc = composeEncyclopediaAnswer(resolved.query, exact, ctx.locale, { seed: messages.length })
        if (enc) return { text: enc.text, source: 'local', citations: [enc.citation], confident: true }
      }
    }
    if (qaFallback && !composed.confident) return qaFallback
  }
  const used = new Set(composed.usedTitles)
  // Значки — из фрагментов, давших фразы ответа (не все фрагменты с тем же заголовком).
  const citations = [
    ...new Set(
      (composed.usedCitations?.length ? composed.usedCitations : knowledge.hits.filter((h) => used.has(h.title) && h.citation).map((h) => h.citation!)).map((c) =>
        citationForDisplay(c, ctx.locale),
      ),
    ),
  ].slice(0, 3)
  // Живая речь поверх ответа (факты и подписи не меняются): «не знаю» — честно, с 2 близкими темами.
  const answer = speakLikeHuman(composed.text, {
    lang: ctx.locale,
    kind: composed.confident ? 'book' : 'noAnswer',
    seed: messages.length,
    query: resolved.query,
    mood: detectMood(text),
    nearTopics: [...new Set([...knowledge.hits.map((h) => h.title), ctx.sectionTitle ?? ''])].filter(Boolean),
  })
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
    const step = await humanStep(messages, ctx)
    if (step.done) return step.result
    if (step.prefix) {
      const inner = await routeTeacherReply(step.messages, ctx, {
        ...opts,
        knowledge: undefined,
        onDelta: opts?.onDelta ? (full) => opts?.onDelta?.(`${step.prefix} ${full}`) : undefined,
        humanHandled: true,
      })
      return withPrefix(step.prefix, inner)
    }
    if (step.rewritten) {
      messages = step.messages
      opts = { ...opts, knowledge: undefined }
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
  // Карточка FAQ — тоже живым голосом (ветка local уже озвучена внутри composeLocalTeacherReply).
  if (faq) return { text: speakLikeHuman(pickFaqText(faq, ctx.locale), { lang: ctx.locale, kind: 'fact', seed: messages.length, query: q, mood: detectMood(q) }), source: 'faq', citations: [] }

  return local
}
