/**
 * Конвейер /chat строго по шагам: normalize → moderation → ownerRule → smalltalk → ДИАЛОГ (состояние разговора →
 * самодостаточный вопрос → тип/охват) → intent → tools → план ответа → retrieve («сначала школа») → llm|fallback →
 * самопроверка → postcheck → journal. Каждый шаг отражается в meta.route; ответ — события meta / delta / done (brain/sse.ts).
 * runChat не знает про HTTP: его же гоняет eval (--inproc) и тесты с подменой LLM.
 * Мозг v2: реплика «а у натрия?» превращается в «Какая валентность у натрия?» (brain/pipeline/dialogResolve.ts), и уже
 * этот вопрос ищется, считается и отвечается; длина — по классу (tiny/short/normal/long, dialogPlan.ts).
 */
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import type { BrainConfig } from '../config.ts'
import { FILES } from '../config.ts'
import type { EmbedStore } from '../kb/embedStore.ts'
import type { Journal } from '../kb/journal.ts'
import type { Knowledge } from '../kb/shards.ts'
import { appendLine, ulid } from '../kb/storage.ts'
import type { LlmClient, LlmMessage } from '../llm/ollama.ts'
import { buildSystemPrompt, buildUserTurn } from '../persona/systemPrompt.ts'
import { adaptationForPrompt } from '../student/adapt.ts'
import type { StudentStore } from '../student/events.ts'
import { detectErrorTags, snapshot, type StudentSnapshot } from '../student/model.ts'
import { selfCheck } from './dialogCheck.ts'
import { planAnswer } from './dialogPlan.ts'
import { maybeLlmRewrite, resolveStandalone, trailingQuestion } from './dialogResolve.ts'
import { buildDialogState, compressAnswer, questionKindCompat } from './dialogState.ts'
import type { AnswerPlan, FollowUp, LengthClass, Profile, QuestionKind, RankedFragment, RetrievalResultV2, RetrieveOptions, Scope, SourceKind, StandaloneQuery } from './dialogTypes.ts'
import { composeFallback, offtopicReply, referenceFacts } from './fallback.ts'
import { jaccard, type Candidate } from './hybrid.ts'
import { classifyIntent, greetingPrefix, hasChemVocabulary, matchSmalltalk, smalltalkReply, wantsEncyclopedia, type Intent, type QType } from './intent.ts'
import { llmAnswer, llmClassify, llmVerify } from './llm.ts'
import { ASK_CHEM, moderate, R2 } from './moderation.ts'
import { cmpForm, detectLang, GIBBERISH_REPLY, normalizeInput, type Lang } from './normalize.ts'
import { isOwnerRuleQuestion, R1 } from './ownerRule.ts'
import { DANGER_REPLY, ensureToolNumbers, isDangerousRequest, scrubR3, splitSentences, wordCount } from './postcheck.ts'
import { gradeNum, retrieve, type RetrievalResult, type RetrieveDeps } from './retrieve.ts'
import { checkStudentNumbers, runTools, type ToolResult } from './tools.ts'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }
export type ChatRequest = {
  sessionId: string
  studentId?: string
  lang: Lang | 'auto'
  stream: boolean
  messages: ChatMessage[]
  context: { gradeId: string; chapterId?: string; sectionId?: string; sectionTitle?: string; mode: 'chat' | 'live'; detail: 'brief' | 'more' }
  student?: { mood?: string; cameraEngagement?: number }
}

export type Route = string
/**
 * reason — почему ответил запасной путь, когда LLM была (first_token_timeout, cjk, lang_mismatch, error…); поле сверх контракта v1.
 * standalone/followUp/scope/kind/lengthClass — мозг v2 (как понят вопрос); клиент их не требует.
 */
export type MetaEvent = {
  turnId: string
  intent: Intent
  route: Route
  moderated: boolean
  lang: Lang
  reason?: string
  standalone?: string
  followUp?: FollowUp
  scope?: Scope
  kind?: QuestionKind
  lengthClass?: LengthClass
}
export type DoneEvent = {
  /** итоговый маршрут (= meta.route) и причина подмены — поля сверх контракта v1, клиент их не требует */
  route?: Route
  reason?: string
  text: string
  source: 'llm' | 'tool' | 'local' | 'rule'
  citations: string[]
  confidence: number
  confidenceLabel: 'high' | 'medium' | 'reasoned'
  student: { level: number; mood: string; pace: string; recentErrors: string[] }
  ms: number
  /** мозг v2: откуда знания подсказки (≤ 3) и план ответа */
  sources?: SourceKind[]
  plan?: { kind: QuestionKind; lengthClass: LengthClass; scope: Scope }
}
export type ChatSink = {
  meta(m: MetaEvent): void
  delta(text: string): void
  done(d: DoneEvent): void
  error(e: { code: 'bad_request' | 'llm_timeout' | 'internal'; message: string }): void
}

export type BrainDeps = {
  kb: Knowledge
  journal: Journal
  embeds: EmbedStore | null
  llm: LlmClient | null
  students: StudentStore
  config: BrainConfig
  /** не писать в журнал диалогов (тесты) */
  noJournal?: boolean
}

/** Проверка тела запроса по контракту. Строка — текст ошибки (400). */
export function validateChatRequest(body: unknown): ChatRequest | string {
  if (!body || typeof body !== 'object') return 'тело запроса должно быть JSON-объектом'
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.messages) || !b.messages.length) return 'messages: пустой список'
  const msgs: ChatMessage[] = []
  for (const m of b.messages.slice(-12)) {
    if (!m || typeof m !== 'object') return 'messages: неверный элемент'
    const role = (m as Record<string, unknown>).role
    const content = (m as Record<string, unknown>).content
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return 'messages: role ∈ user|assistant, content — строка'
    msgs.push({ role, content: content.slice(0, 4000) })
  }
  const last = (b.messages as ChatMessage[])[b.messages.length - 1]!
  if (last.role !== 'user') return 'последнее сообщение должно быть от user'
  if (typeof last.content !== 'string' || !last.content.trim()) return 'пустой вопрос'
  if (last.content.length > 4000) return 'content ≤ 4000 символов'
  const lang = b.lang === 'ru' || b.lang === 'en' || b.lang === 'uz' ? b.lang : 'auto'
  const ctx = (b.context && typeof b.context === 'object' ? b.context : {}) as Record<string, unknown>
  const gradeId = typeof ctx.gradeId === 'string' && /^(g(7|8|9|10|11))?$/.test(ctx.gradeId) ? ctx.gradeId : ''
  const student = b.student && typeof b.student === 'object' ? (b.student as ChatRequest['student']) : undefined
  return {
    sessionId: typeof b.sessionId === 'string' && b.sessionId ? b.sessionId.slice(0, 100) : 'anon',
    studentId: typeof b.studentId === 'string' && b.studentId ? b.studentId.slice(0, 100) : undefined,
    lang,
    stream: b.stream !== false,
    messages: msgs,
    context: {
      gradeId,
      chapterId: typeof ctx.chapterId === 'string' ? ctx.chapterId : undefined,
      sectionId: typeof ctx.sectionId === 'string' ? ctx.sectionId : undefined,
      sectionTitle: typeof ctx.sectionTitle === 'string' ? ctx.sectionTitle.slice(0, 200) : undefined,
      mode: ctx.mode === 'live' ? 'live' : 'chat',
      detail: ctx.detail === 'more' ? 'more' : 'brief',
    },
    student,
  }
}

export function confidenceLabel(c: number, cfg: BrainConfig): DoneEvent['confidenceLabel'] {
  return c >= cfg.thresholds.high ? 'high' : c >= cfg.thresholds.medium ? 'medium' : 'reasoned'
}

function seedOf(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Поток готового текста по предложениям (запасной путь тоже «печатает»). */
function streamText(text: string, sink: ChatSink): void {
  const paras = text.split('\n')
  paras.forEach((p, i) => {
    const ss = splitSentences(p)
    ss.forEach((s, j) => sink.delta((j ? ' ' : '') + s))
    if (i < paras.length - 1) sink.delta('\n')
  })
}

// ---------------------------------------------------------------- профиль и совместимость с SOURCES

/** Профиль железа: config.dialog.profile или по Ollama /api/ps (модель в видеопамяти → gpu). */
export function profileOf(deps: Pick<BrainDeps, 'llm' | 'config'>): Profile {
  const p = deps.config.dialog?.profile ?? 'auto'
  if (p === 'gpu' || p === 'laptop') return p
  return deps.llm?.status().gpu ? 'gpu' : 'laptop'
}

/** Реплики-шаблоны (а почему? / проще / пример / подробнее / да): намерение и расчёт — по самой реплике; «повтори» — по прежнему вопросу. */
const TEMPLATE_FU = new Set<FollowUp>(['why', 'simpler', 'example', 'more', 'confirm'])

const TEST_STYLE = /(выбер\p{L}* (правильн|верн)|верно ли|какое из (утвержд|перечисл)|какие из (утвержд|перечисл)|(^|\s)[абвг]\)\s|(^|\s)[a-d]\)\s|tanlang|to[ʻ'’]?g[ʻ'’]?rimi|which of the following|true or false)/iu

// TEMP до слияния с SOURCES: questionKind (intent.ts) — тип вопроса по старому questionType + расчёт/тест
function questionKindCompatFull(cmp: string, text: string, intent: Intent, hasTools: boolean): QuestionKind {
  if (TEST_STYLE.test(text)) return 'test_style'
  if ((intent === 'calc' || intent === 'homework') && hasTools) return intent
  return questionKindCompat(cmp, text)
}

// TEMP до слияния с SOURCES: classifyScope (intent.ts) — офтопик / широкий («кто открыл», история) / школьный
const BROAD_RE = /(кто\s|когда\s|истори|открыл|открыт|изобр|биограф|в чем смысл|как устроен мир|вселенн|космос|who\s|when\s|histor|discover|invent|universe|kim\s|qachon|kashf|tarix|koinot)/iu
function classifyScopeCompat(text: string, cmp: string, _lang: Lang, _kb: Knowledge): { scope: Scope; why: string } {
  if (classifyIntent(text, cmp).intent === 'offtopic') return { scope: 'offtopic', why: 'offtopic_vocab' }
  if (BROAD_RE.test(cmp)) return { scope: 'broad', why: 'history_or_wide' }
  return { scope: 'school', why: 'default' }
}

function sourceKindOf(c: Candidate, grade: number | null): SourceKind {
  if (c.type === 'encyclopedia') return 'encyclopedia'
  if (c.type === 'index') return 'index'
  if (/^Kimyo/i.test(c.source) || /^\[Kimyo/i.test(c.citation)) return grade != null && c.grade === grade ? 'textbook_grade' : 'textbook_other'
  if (c.origin === 'journal' && !/ATOMLAB/i.test(`${c.source} ${c.citation}`)) return 'journal'
  return 'atomlab'
}
const TIER: Record<SourceKind, 1 | 2 | 3 | 4> = { textbook_grade: 1, textbook_other: 2, atomlab: 3, journal: 3, encyclopedia: 4, index: 4 }

// TEMP до слияния с SOURCES: retrieveV2 (retrieve.ts) — поверх старого retrieve: самодостаточный вопрос + тема, класс sq.grade
async function retrieveV2Compat(opts: RetrieveOptions, deps: RetrieveDeps, signal?: AbortSignal): Promise<RetrievalResultV2> {
  const q = opts.query
  const fold = (s: string) => s.toLowerCase().replace(/ё/g, 'е')
  // тема по-русски добавляется к русскому запросу, если её нет в тексте («а почему?» → «Почему: … валентность»)
  const text = q.lang === 'ru' && q.topic && !fold(q.text).includes(fold(q.topic).slice(0, 5)) ? `${q.text} ${q.topic}` : q.text
  const ctx = q.grade && q.grade !== opts.ctx.gradeId ? { gradeId: q.grade } : opts.ctx
  const wantEnc = wantsEncyclopedia(cmpForm(text)) || q.kind === 'who_history' || q.scope !== 'school'
  const r: RetrievalResult = await retrieve(text, q.lang, ctx, wantEnc, deps, signal)
  const g = gradeNum(ctx.gradeId)
  const items: RankedFragment[] = r.items.map((c) => {
    const sourceKind = sourceKindOf(c, g)
    return Object.assign(c, { sourceKind, gradeDelta: g != null && c.grade != null ? c.grade - g : null, tier: TIER[sourceKind] })
  })
  const tiers: Partial<Record<SourceKind, number>> = {}
  for (const f of items) tiers[f.sourceKind] = (tiers[f.sourceKind] ?? 0) + 1
  return { ...r, items, scopeUsed: q.scope, schoolHit: items.some((f) => f.tier <= 2), encyclopediaUsed: items.some((f) => f.sourceKind === 'encyclopedia'), tiers }
}

/** Тип вопроса v2 → старый QType запасного пути. */
function qtypeOf(kind: QuestionKind): QType {
  switch (kind) {
    case 'definition':
    case 'why':
    case 'compare':
    case 'properties':
    case 'uses':
      return kind
    case 'howto_obtain':
      return 'how'
    case 'who_history':
      return 'who'
    default:
      return 'general'
  }
}

export async function runChat(req: ChatRequest, deps: BrainDeps, sink: ChatSink, signal?: AbortSignal): Promise<DoneEvent> {
  const t0 = performance.now()
  const { kb, config } = deps
  const turnId = `t-${ulid()}`
  const studentId = req.studentId || `s-${req.sessionId}`
  const lastUser = req.messages[req.messages.length - 1]!.content
  let norm = normalizeInput(lastUser, req.lang)
  let lang = norm.lang
  const seed = seedOf(req.sessionId + req.messages.length)
  const mode = req.context.mode
  const detail = req.context.detail
  const events = deps.students.events(studentId)

  let metaSent = false
  let metaRoute = ''
  let routePrefix = ''
  let moderated = false
  let reason: string | undefined
  /** замеры LLM для журнала (первый токен, токены подсказки после кеша, попытки, CJK) */
  let llmStats: Record<string, unknown> | undefined
  /** мозг v2: как понят вопрос (meta, done, журнал) — заполняется после разбора диалога */
  let sqInfo: StandaloneQuery | null = null
  let planInfo: AnswerPlan | null = null
  let sources: SourceKind[] = []
  let fixes: string[] = []
  const sendMeta = (intent: Intent, route: string) => {
    if (metaSent) return
    metaSent = true
    metaRoute = routePrefix + route
    const v2 = sqInfo ? { standalone: sqInfo.text, followUp: sqInfo.followUp, scope: sqInfo.scope, kind: sqInfo.kind, lengthClass: planInfo?.lengthClass ?? sqInfo.lengthClass } : {}
    sink.meta({ turnId, intent, route: metaRoute, moderated, lang, ...(reason ? { reason } : {}), ...v2 })
  }
  const finish = (o: {
    text: string
    intent: Intent
    route: string
    source: DoneEvent['source']
    citations?: string[]
    confidence: number
    snap?: StudentSnapshot
    tags?: string[]
    good?: number
    streamed?: boolean
    retrieval?: RetrievalResult | RetrievalResultV2 | null
    tools?: ToolResult[]
  }): DoneEvent => {
    sendMeta(o.intent, o.route)
    if (!o.streamed) streamText(o.text, sink)
    const snap = o.snap ?? snapshot(events, req.context.gradeId, req.student?.mood, norm.text, o.tags ?? [])
    const done: DoneEvent = {
      route: metaRoute,
      ...(reason ? { reason } : {}),
      text: o.text,
      source: o.source,
      citations: (o.citations ?? []).slice(0, 3),
      confidence: Math.round(Math.min(1, Math.max(0, o.confidence)) * 100) / 100,
      confidenceLabel: confidenceLabel(o.confidence, config),
      student: { level: snap.levelInt, mood: snap.mood, pace: snap.pace, recentErrors: snap.recentErrors },
      ms: Math.round(performance.now() - t0),
      ...(sqInfo ? { sources: sources.slice(0, 3), plan: { kind: sqInfo.kind, lengthClass: planInfo?.lengthClass ?? sqInfo.lengthClass, scope: sqInfo.scope } } : {}),
    }
    sink.done(done)
    if (!deps.noJournal) {
      try {
        appendLine(FILES.dialogs, {
          at: new Date().toISOString(),
          turnId,
          sessionId: req.sessionId,
          studentId,
          lang,
          q: lastUser,
          a: o.text,
          intent: o.intent,
          route: metaRoute,
          ...(reason ? { reason } : {}),
          ...(llmStats ? { llm: llmStats } : {}),
          source: o.source,
          confidence: done.confidence,
          ms: done.ms,
          citations: done.citations,
          tools: (o.tools ?? []).map((t) => t.tool),
          retrievalMs: o.retrieval?.ms,
          vectors: o.retrieval?.usedVectors ?? false,
          // мозг v2 — только дописывание полей
          ...(sqInfo
            ? { standalone: sqInfo.text, followUp: sqInfo.followUp, scope: sqInfo.scope, kind: sqInfo.kind, lengthClass: planInfo?.lengthClass ?? sqInfo.lengthClass, sources: sources.slice(0, 3), fixes }
            : {}),
        })
        deps.students.append(studentId, { type: 'turn', sessionId: req.sessionId, intent: o.intent, len: lastUser.length, good: o.good ?? 0, grade: req.context.gradeId })
        for (const tag of o.tags ?? []) deps.students.append(studentId, { type: 'error_tag', sessionId: req.sessionId, tag })
        if (snap.mood !== 'neutral') deps.students.append(studentId, { type: 'mood', sessionId: req.sessionId, mood: snap.mood })
      } catch (err) {
        console.warn('[brain] журнал не записан:', (err as Error).message)
      }
    }
    return done
  }

  // 1) набор букв
  if (norm.gibberish) return finish({ text: GIBBERISH_REPLY[lang], intent: 'gibberish', route: 'fallback', source: 'local', confidence: 1 })

  // 2) мат
  let text = norm.text
  let prefix = ''
  const mod = moderate(text)
  if (mod.flagged) {
    moderated = true
    routePrefix = 'moderation+'
    text = mod.cleaned
    if (req.lang === 'auto' && text) lang = detectLang(text)
    prefix = R2[lang]
    if (!text) return finish({ text: `${prefix}\n\n${ASK_CHEM[lang]}`, intent: 'offtopic', route: 'rule', source: 'rule', confidence: 1 })
    norm = { ...normalizeInput(text, lang), lang }
  }
  const head = (body: string) => (prefix ? `${prefix}\n\n${body}` : body)

  // 3) правило владельца — дословно R1
  if (isOwnerRuleQuestion(text)) return finish({ text: head(R1), intent: 'rule', route: 'rule', source: 'rule', confidence: 1 })

  // опасные инструкции — отказ с объяснением безопасности
  if (isDangerousRequest(text)) return finish({ text: head(DANGER_REPLY[lang]), intent: 'chemistry', route: 'rule', source: 'rule', confidence: 1 })

  // 4a–4b) профиль железа и состояние разговора (до светской беседы: «да» после «Хотите задачу?» — согласие, а не «ок»)
  const profile = profileOf(deps)
  const state = buildDialogState(req.messages, req.context, kb)

  // 4) светская беседа
  let cmp = cmpForm(text)
  const st = matchSmalltalk(cmp, text)
  let greeting = ''
  const confirmTurn = !!st && !st.rest && st.kinds.every((k) => k === 'ok') && !!trailingQuestion(state.lastAnswer)
  if (st && !st.rest && !confirmTurn) {
    const snap = snapshot(events, req.context.gradeId, req.student?.mood ?? (st.kinds.includes('tired') ? 'tired' : st.kinds.includes('bored') ? 'bored' : undefined), text, [])
    return finish({ text: head(smalltalkReply(st.kinds, lang, seed)), intent: 'smalltalk', route: 'fallback', source: 'local', confidence: 1, snap })
  }
  if (st?.rest) {
    greeting = greetingPrefix(st.kinds, lang)
    text = st.rest
    cmp = cmpForm(text)
  }

  // 4c) самодостаточный вопрос: «а у натрия?» → «Какая валентность у натрия?» (правила; на gpu — ещё и быстрая модель)
  let sq = resolveStandalone(text, state, { lang, cmp, kb, gradeId: req.context.gradeId })
  if (profile === 'gpu' && mode !== 'live' && deps.llm?.status().available) sq = await maybeLlmRewrite(sq, state, { llm: deps.llm, config, profile }, signal)
  // правило владельца — и вместе с прошлым вопросом («Что такое органическая химия?» → «а чем она отличается от неорганической?»)
  const ownerCombo = !!state.lastStandalone && /(органич|organik|organic)/iu.test(text) && isOwnerRuleQuestion(`${state.lastStandalone} ${text}`)
  if (ownerCombo) return finish({ text: head(R1), intent: 'rule', route: 'rule', source: 'rule', confidence: 1 })
  if (sq.text !== text) {
    // правило владельца и опасность — и по переписанному вопросу
    if (isOwnerRuleQuestion(sq.text)) return finish({ text: head(R1), intent: 'rule', route: 'rule', source: 'rule', confidence: 1 })
    if (isDangerousRequest(sq.text)) return finish({ text: head(DANGER_REPLY[lang]), intent: 'chemistry', route: 'rule', source: 'rule', confidence: 1 })
  }
  const template = TEMPLATE_FU.has(sq.followUp)
  const sqCmp = cmpForm(sq.text)
  /** по чему считать намерение и инструменты: шаблон «Почему: <ответ учителя>…» — по самой реплике (уравнения ответа — не задача) */
  const workText = template ? text : sq.text
  const workCmp = template ? cmp : sqCmp

  // 4e) намерение (+ быстрый LLM для спорных случаев)
  const guess = classifyIntent(workText, workCmp)
  let intent: Intent = guess.intent
  // в живом голосе не тратим секунды на уточнение (и не сбиваем кеш быстрой модели) — хватает эвристики
  if (guess.ambiguous && mode !== 'live' && deps.llm?.status().available) {
    const label = await llmClassify(deps.llm, config, workText, signal)
    if (label) intent = label
  }
  if (template && intent === 'offtopic' && (state.topic || state.lastStandalone)) intent = 'chemistry'

  // 5) инструменты: по самодостаточному вопросу; числа задачи могли быть только в оригинале
  let tools = intent === 'offtopic' || intent === 'smalltalk' ? [] : runTools(workText, workCmp, lang, kb)
  if (!tools.length && !template && sq.text !== text && intent !== 'offtopic' && intent !== 'smalltalk') tools = runTools(text, cmp, lang, kb)

  // 4d) тип и охват вопроса (функции SOURCES; пока — совместимые заглушки)
  // шаблоны («проще», «пример», «повтори», «да») сохраняют тип из правил (прежний вопрос / confirm / repeat)
  if (sq.followUp === 'why') sq.kind = 'why'
  else if (!template && sq.followUp !== 'repeat') sq.kind = questionKindCompatFull(sqCmp, sq.text, intent, tools.length > 0)
  sq.scope = intent === 'offtopic' ? 'offtopic' : classifyScopeCompat(sq.text, sqCmp, lang, kb).scope
  if (template && sq.scope === 'offtopic') sq.scope = 'school'
  sqInfo = sq

  const tags = new Set(detectErrorTags(text, kb))
  let good = 0
  for (const t of tools) {
    for (const tag of t.errorTags ?? []) tags.add(tag)
    good += t.good ?? 0
  }
  let hwNote = ''
  if (intent === 'homework' && tools.length) {
    const chk = checkStudentNumbers(text, tools, lang)
    hwNote = chk.note
    chk.tags.forEach((t) => tags.add(t))
    good += chk.good
  }
  const snap = snapshot(events, req.context.gradeId, req.student?.mood, text, [...tags])

  // 5a) план ответа: класс длины, каркас, бюджеты подсказки по профилю
  let plan = planAnswer(sq, state, snap, { mode, detail, profile, config })
  planInfo = plan

  // 6) поиск «сначала школа» по самодостаточному вопросу (тема и класс — из состояния диалога)
  const retrieval = await retrieveV2Compat(
    { query: sq, ctx: req.context, profile, budgetChars: plan.knowledgeChars, maxItems: plan.knowledgeItems },
    { kb, journal: deps.journal, embeds: deps.embeds, llm: deps.llm, config },
    signal,
  )
  if (retrieval.scopeUsed !== sq.scope) {
    sq.scope = retrieval.scopeUsed
    plan = planAnswer(sq, state, snap, { mode, detail, profile, config })
    planInfo = plan
  }
  if (intent === 'chemistry' && !tools.length && !hasChemVocabulary(sq.text) && retrieval.confR < 0.3) {
    intent = 'offtopic'
    sq.scope = 'offtopic'
  }
  // 6a) знания для подсказки: школа и ATOMLAB; энциклопедия школьному вопросу — только фоном (не цитата), широкому — знанием
  const schoolItems = retrieval.items.filter((f) => f.sourceKind !== 'encyclopedia' && f.sourceKind !== 'index')
  const knowledge = sq.scope === 'school' ? schoolItems : retrieval.items
  const background = sq.scope === 'school' ? retrieval.items.filter((f) => f.sourceKind === 'encyclopedia').slice(0, 1) : []
  const overlapQ = `${sq.text} ${sq.topic ?? ''}`.trim()
  const promptItems = promptKnowledge(knowledge, overlapQ)
  sources = promptItems.slice(0, 3).map((f) => f.sourceKind)
  const qtype = qtypeOf(sq.kind)
  const wordLimit = Math.round(plan.words[1] * 1.2)

  // 7) LLM или запасной путь. meta уходит, когда маршрут известен честно: с первым куском текста модели
  // (route=llm) или в момент подмены запасным путём (route=fallback + reason). Пока модель думает,
  // сервер держит соединение «сердцебиением» (brain/server.ts), клиент показывает «Думаю…».
  const llmOn = !!deps.llm?.status().available
  const toolOnly = tools.length > 0 && (intent === 'calc' || intent === 'homework')
  const lead = prefix ? `${prefix}\n\n${greeting}` : greeting
  let leadSent = false
  const openStream = (route: string, why?: string) => {
    if (why) reason = why
    sendMeta(intent, route)
    if (lead && !leadSent) {
      leadSent = true
      sink.delta(lead)
    }
  }
  if (!llmOn) openStream(toolOnly ? 'tool' : 'fallback', toolOnly ? undefined : 'llm_unavailable')
  const tagsArr = [...tags]
  const fbInput = () => ({
    text: sq.text,
    cmp: sqCmp,
    lang,
    intent,
    qtype,
    detail,
    mode,
    kb,
    retrieval,
    tools,
    student: snap,
    seed,
    thresholds: config.thresholds,
    wordLimit,
    sq,
    plan,
  })

  if (llmOn && deps.llm) {
    // история — по плану: на ноутбуке 2 реплики × 300 симв., на сервере с видеокартой до 8 × 900; ответы учителя — сжато
    const past = req.messages.slice(0, -1).slice(-plan.useHistory)
    const history: LlmMessage[] = past.map((m) => {
      const c = m.role === 'assistant' ? compressAnswer(m.content, plan.historyChars) : m.content
      return { role: m.role, content: c.length > plan.historyChars ? c.slice(0, plan.historyChars) + '…' : c }
    })
    const reasoned = !tools.length && retrieval.confR < config.thresholds.medium
    const live = mode === 'live'
    const facts = referenceFacts(sq.text, lang, kb, qtype).slice(0, live ? 1 : 3)
    const userTurn = buildUserTurn({
      lang,
      mode,
      detail,
      gradeId: req.context.gradeId,
      sectionTitle: req.context.sectionTitle,
      chapterId: req.context.chapterId,
      sectionId: req.context.sectionId,
      knowledge: promptItems,
      background,
      plan,
      standalone: sq,
      tools,
      // только действенные указания (короче/проще/успокой); строка «уровень 3/5, темп normal» — лишние токены
      studentBlock: live ? '' : adaptationForPrompt(snap, lang).split('\n').slice(1).join('\n'),
      reasoned,
      facts,
      question: sq.text,
      maxItems: plan.knowledgeItems,
      maxChars: plan.knowledgeChars,
    })
    history.push({ role: 'user', content: userTurn })
    const system = buildSystemPrompt(lang)
    const tLlm = Date.now()
    const ans = await llmAnswer({
      llm: deps.llm,
      config,
      lang,
      mode,
      detail,
      intent,
      system,
      history,
      wordLimit,
      plan,
      signal,
      onDelta: (d) => {
        openStream('llm')
        sink.delta(d)
      },
    })
    const varChars = userTurn.length + history.slice(0, -1).reduce((n, m) => n + m.content.length, 0)
    llmStats = { model: ans.model, stopped: ans.stopped, firstMs: ans.firstMs, promptTokens: ans.promptTokens, promptMs: ans.promptMs, attempts: ans.attempts, cjk: ans.cjk || undefined, varChars, retrievalMs: retrieval.ms, profile }
    if (!deps.noJournal || process.env.BRAIN_LOG_LLM === '1')
      console.log(`[brain] llm ${ans.model} ${mode}/${profile}: ${ans.stopped}, первый токен ${ans.firstMs ?? '—'} мс, подсказка ${ans.promptTokens ?? '—'} ток/${ans.promptMs ?? '—'} мс, переменная часть ${varChars} симв., поиск ${Math.round(retrieval.ms)} мс${ans.cjk ? ', CJK' : ''}${sq.resolvedBy !== 'none' ? `, вопрос «${sq.text.slice(0, 80)}»` : ''}`)
    if (signal?.aborted) {
      if (!metaSent) openStream('fallback', 'client_abort')
      return finish({ text: lead + ans.text, intent, route: ans.text ? 'llm' : 'fallback', source: ans.text ? 'llm' : 'local', confidence: 0, streamed: true, snap, tags: tagsArr, good, retrieval, tools })
    }
    // цитаты — только из знаний подсказки (учебник, ATOMLAB; энциклопедия — лишь у широкого вопроса)
    const citations = () => [...tools.map((t) => t.cite ?? '[ATOMLAB: расчёт]'), ...relevantCitations(knowledge, overlapQ)].filter((c, i, a) => a.indexOf(c) === i)
    if (ans.ok || ans.text) {
      // ответ модели (возможно, оборванный по времени или на CJK) — договариваем недостающее из запасного пути
      openStream('llm')
      let body = ans.text
      const fixed = ensureToolNumbers(body, tools, lang)
      if (fixed !== body) {
        sink.delta(fixed.slice(body.length))
        body = fixed
      }
      if (hwNote) {
        sink.delta('\n' + hwNote)
        body += '\n' + hwNote
      }
      const short = wordCount(body) < 25
      let fbText: string | null = null
      const fbOnce = () => (fbText ??= intent === 'offtopic' ? offtopicReply(lang, retrieval, seed, sqCmp).text : composeFallback(fbInput()).text)
      if (!ans.ok || ans.stopped === 'total_timeout' || (ans.stopped === 'cjk' && short)) {
        reason = `llm_${ans.stopped}+fallback_tail`
        const have = splitSentences(body).map((s) => new Set(analyzeTerms(s)))
        const extra = splitSentences(scrubR3(fbOnce(), lang)).filter((s) => {
          const t = new Set(analyzeTerms(s))
          return !have.some((h) => jaccard(h, t) > 0.5)
        })
        if (extra.length) {
          const add = ' ' + extra.slice(0, 3).join(' ')
          sink.delta(add)
          body += add
        }
      } else if (ans.stopped === 'cjk') reason = 'llm_cjk_trimmed'
      // 7a) самопроверка по точным фактам: уравнения, новая сущность, длина, апострофы uz, противоречия
      if (intent !== 'offtopic') {
        const chk = selfCheck(body, { sq, tools, lang, kb, plan, fallbackText: wordCount(body) < plan.words[0] * 0.5 ? fbOnce() : undefined })
        fixes = chk.fixes
        if (chk.text !== body) {
          if (chk.text.startsWith(body)) sink.delta(chk.text.slice(body.length))
          body = chk.text // клиент берёт итог из done.text — правка внутри текста доходит и так
        }
        // 7b) сервер с видеокартой: проверочный проход быстрой моделью и одна регенерация, если нашлась ошибка
        if (profile === 'gpu' && (plan.verify || fixes.includes('contradiction')) && !signal?.aborted) {
          const v = await llmVerify(deps.llm, config, { answer: body, facts, tools, lang }, signal)
          if (!v.ok) {
            fixes.push('verify')
            if (Date.now() - tLlm < 6000) {
              const last = history[history.length - 1]!
              const note = lang === 'ru' ? `(Проверка нашла: ${v.note}. Исправь это, остальное сохрани.)` : lang === 'uz' ? `(Tekshiruv topdi: ${v.note}. Shuni tuzat, qolganini saqla.)` : `(The check found: ${v.note}. Fix this, keep the rest.)`
              const again = await llmAnswer({ llm: deps.llm, config, lang, mode, detail, intent, system, history: [...history.slice(0, -1), { ...last, content: `${last.content}\n\n${note}` }], wordLimit, plan, temperature: 0.1, signal, onDelta: () => {} })
              if (again.ok && again.text.trim()) {
                body = selfCheck(again.text, { sq, tools, lang, kb, plan }).text
                fixes.push('regenerated')
              }
            }
          }
        }
      }
      const conf = tools.length ? 0.95 : Math.max(retrieval.confR, reasoned ? 0.3 : retrieval.confR)
      return finish({ text: lead + body, intent, route: 'llm', source: 'llm', citations: citations(), confidence: conf, streamed: true, snap, tags: tagsArr, good, retrieval, tools })
    }
    // модель не сказала ни слова (таймаут первого токена, ошибка, CJK сразу, не тот язык) → честно: запасной путь + причина
    openStream(toolOnly ? 'tool' : 'fallback', `llm_${ans.stopped}`)
  }

  // запасной путь
  const fb = intent === 'offtopic' ? offtopicReply(lang, retrieval, seed, sqCmp) : composeFallback(fbInput())
  let body = scrubR3(fb.text, lang)
  if (hwNote) body += '\n' + hwNote
  streamText(body, sink)
  const source: DoneEvent['source'] = toolOnly ? 'tool' : 'local'
  return finish({ text: lead + body, intent, route: toolOnly ? 'tool' : 'fallback', source, citations: fb.citations, confidence: fb.confidence, streamed: true, snap, tags: tagsArr, good, retrieval, tools })
}

/** Термы вопроса, по которым проверяем, что найденный фрагмент вообще о нём. */
function overlap(question: string, c: { title: string; text: string }): number {
  const q = new Set(analyzeTerms(question))
  if (!q.size) return 0
  const t = new Set(analyzeTerms(`${c.title} ${c.text.slice(0, 600)}`))
  let n = 0
  for (const w of q) if (t.has(w)) n++
  return n / q.size
}

/** В подсказку — только фрагменты, которые пересекаются с вопросом по смыслу (иначе модель «цитирует не к месту»). */
function promptKnowledge(items: RankedFragment[], question: string): RankedFragment[] {
  const kept = items.filter((c) => overlap(question, c) >= 0.25)
  return kept.length ? kept : items.slice(0, 1)
}

/** Цитаты к ответу модели — только из фрагментов по теме вопроса. */
function relevantCitations(items: RankedFragment[], question: string): string[] {
  return items
    .filter((c) => overlap(question, c) >= 0.34)
    .slice(0, 3)
    .map((c) => c.citation)
}
