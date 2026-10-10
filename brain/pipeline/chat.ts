/**
 * Конвейер /chat строго по шагам: normalize → moderation → ownerRule → intent → tools → retrieve → llm|fallback →
 * postcheck → journal. Каждый шаг отражается в meta.route; ответ — события meta / delta / done (brain/sse.ts).
 * runChat не знает про HTTP: его же гоняет eval (--inproc) и тесты с подменой LLM.
 */
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import type { BrainConfig } from '../config.ts'
import { FILES } from '../config.ts'
import type { EmbedStore } from '../kb/embedStore.ts'
import type { Journal } from '../kb/journal.ts'
import type { Knowledge } from '../kb/shards.ts'
import { appendLine, ulid } from '../kb/storage.ts'
import type { LlmClient, LlmMessage } from '../llm/ollama.ts'
import { buildSystemPrompt } from '../persona/systemPrompt.ts'
import { adaptationForPrompt } from '../student/adapt.ts'
import type { StudentStore } from '../student/events.ts'
import { detectErrorTags, snapshot, type StudentSnapshot } from '../student/model.ts'
import { composeFallback, offtopicReply } from './fallback.ts'
import { jaccard } from './hybrid.ts'
import { classifyIntent, greetingPrefix, hasChemVocabulary, matchSmalltalk, questionType, smalltalkReply, wantsEncyclopedia, type Intent } from './intent.ts'
import { llmAnswer, llmClassify } from './llm.ts'
import { ASK_CHEM, moderate, R2 } from './moderation.ts'
import { cmpForm, detectLang, GIBBERISH_REPLY, normalizeInput, type Lang } from './normalize.ts'
import { isOwnerRuleQuestion, R1 } from './ownerRule.ts'
import { DANGER_REPLY, ensureToolNumbers, isDangerousRequest, scrubR3, splitSentences } from './postcheck.ts'
import { retrieve, type RetrievalResult } from './retrieve.ts'
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
export type MetaEvent = { turnId: string; intent: Intent; route: Route; moderated: boolean; lang: Lang }
export type DoneEvent = {
  text: string
  source: 'llm' | 'tool' | 'local' | 'rule'
  citations: string[]
  confidence: number
  confidenceLabel: 'high' | 'medium' | 'reasoned'
  student: { level: number; mood: string; pace: string; recentErrors: string[] }
  ms: number
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
  const wordLimit = mode === 'live' ? config.wordLimits.live : detail === 'more' ? config.wordLimits.more : config.wordLimits.brief
  const events = deps.students.events(studentId)

  let metaSent = false
  let routePrefix = ''
  let moderated = false
  const sendMeta = (intent: Intent, route: string) => {
    if (metaSent) return
    metaSent = true
    sink.meta({ turnId, intent, route: routePrefix + route, moderated, lang })
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
    retrieval?: RetrievalResult | null
    tools?: ToolResult[]
  }): DoneEvent => {
    sendMeta(o.intent, o.route)
    if (!o.streamed) streamText(o.text, sink)
    const snap = o.snap ?? snapshot(events, req.context.gradeId, req.student?.mood, norm.text, o.tags ?? [])
    const done: DoneEvent = {
      text: o.text,
      source: o.source,
      citations: (o.citations ?? []).slice(0, 3),
      confidence: Math.round(Math.min(1, Math.max(0, o.confidence)) * 100) / 100,
      confidenceLabel: confidenceLabel(o.confidence, config),
      student: { level: snap.levelInt, mood: snap.mood, pace: snap.pace, recentErrors: snap.recentErrors },
      ms: Math.round(performance.now() - t0),
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
          route: routePrefix + o.route,
          source: o.source,
          confidence: done.confidence,
          ms: done.ms,
          citations: done.citations,
          tools: (o.tools ?? []).map((t) => t.tool),
          retrievalMs: o.retrieval?.ms,
          vectors: o.retrieval?.usedVectors ?? false,
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

  // 4) светская беседа
  let cmp = cmpForm(text)
  const st = matchSmalltalk(cmp, text)
  let greeting = ''
  if (st && !st.rest) {
    const snap = snapshot(events, req.context.gradeId, req.student?.mood ?? (st.kinds.includes('tired') ? 'tired' : st.kinds.includes('bored') ? 'bored' : undefined), text, [])
    return finish({ text: head(smalltalkReply(st.kinds, lang, seed)), intent: 'smalltalk', route: 'fallback', source: 'local', confidence: 1, snap })
  }
  if (st?.rest) {
    greeting = greetingPrefix(st.kinds, lang)
    text = st.rest
    cmp = cmpForm(text)
  }

  // намерение (+ быстрый LLM для спорных случаев)
  const guess = classifyIntent(text, cmp)
  let intent: Intent = guess.intent
  if (guess.ambiguous && deps.llm?.status().available) {
    const label = await llmClassify(deps.llm, config, text, signal)
    if (label) intent = label
  }
  const qtype = questionType(cmp)

  // 5) инструменты
  const tools = intent === 'offtopic' || intent === 'smalltalk' ? [] : runTools(text, cmp, lang, kb)
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

  // 6) поиск
  const wantEnc = wantsEncyclopedia(cmp) || qtype === 'who' || intent === 'offtopic'
  const retrieval = await retrieve(text, lang, req.context, wantEnc, { kb, journal: deps.journal, embeds: deps.embeds, llm: deps.llm, config }, signal)
  if (intent === 'chemistry' && !tools.length && !hasChemVocabulary(text) && retrieval.confR < 0.3) intent = 'offtopic'

  // 7) LLM или запасной путь
  const llmOn = !!deps.llm?.status().available
  const toolOnly = tools.length > 0 && (intent === 'calc' || intent === 'homework')
  const plannedRoute = llmOn ? 'llm' : toolOnly ? 'tool' : 'fallback'
  sendMeta(intent, plannedRoute)
  const lead = prefix ? `${prefix}\n\n${greeting}` : greeting
  if (lead) sink.delta(lead)
  const tagsArr = [...tags]
  const fbInput = () => ({
    text,
    cmp,
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
  })

  if (llmOn && deps.llm) {
    const history: LlmMessage[] = req.messages.map((m, i) => ({ role: m.role, content: i === req.messages.length - 1 ? text : m.content }))
    const reasoned = !tools.length && retrieval.confR < config.thresholds.medium
    const system = buildSystemPrompt({
      lang,
      mode,
      detail,
      gradeId: req.context.gradeId,
      sectionTitle: req.context.sectionTitle,
      chapterId: req.context.chapterId,
      sectionId: req.context.sectionId,
      knowledge: retrieval.items,
      tools,
      studentBlock: adaptationForPrompt(snap, lang),
      reasoned,
    })
    const ans = await llmAnswer({ llm: deps.llm, config, lang, mode, detail, intent, system, history, wordLimit, signal, onDelta: (d) => sink.delta(d) })
    if (signal?.aborted) return finish({ text: lead + ans.text, intent, route: 'llm', source: 'llm', confidence: 0, streamed: true, snap, tags: tagsArr, good, retrieval, tools })
    if (ans.ok) {
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
      if (ans.stopped === 'total_timeout') {
        // договорить из запасного пути только недостающее
        const fb = intent === 'offtopic' ? offtopicReply(lang, retrieval, seed) : composeFallback(fbInput())
        const have = splitSentences(body).map((s) => new Set(analyzeTerms(s)))
        const extra = splitSentences(fb.text).filter((s) => {
          const t = new Set(analyzeTerms(s))
          return !have.some((h) => jaccard(h, t) > 0.5)
        })
        if (extra.length) {
          const add = ' ' + extra.join(' ')
          sink.delta(add)
          body += add
        }
      }
      const citations = [...(tools.length ? ['[ATOMLAB: расчёт]'] : []), ...retrieval.items.slice(0, 3).map((c) => c.citation)].filter((c, i, a) => a.indexOf(c) === i)
      const conf = tools.length ? 0.95 : Math.max(retrieval.confR, reasoned ? 0.3 : retrieval.confR)
      return finish({ text: lead + body, intent, route: 'llm', source: 'llm', citations, confidence: conf, streamed: true, snap, tags: tagsArr, good, retrieval, tools })
    }
    // LLM не ответила (таймаут первого токена, ошибка, язык) → запасной путь
    if (ans.text) {
      const fb = intent === 'offtopic' ? offtopicReply(lang, retrieval, seed) : composeFallback(fbInput())
      const have = splitSentences(ans.text).map((s) => new Set(analyzeTerms(s)))
      const extra = splitSentences(fb.text).filter((s) => !have.some((h) => jaccard(h, new Set(analyzeTerms(s))) > 0.5))
      const add = extra.length ? ' ' + extra.join(' ') : ''
      if (add) sink.delta(add)
      return finish({ text: lead + ans.text + add, intent, route: 'fallback', source: 'local', citations: fb.citations, confidence: fb.confidence, streamed: true, snap, tags: tagsArr, good, retrieval, tools })
    }
  }

  // запасной путь
  const fb = intent === 'offtopic' ? offtopicReply(lang, retrieval, seed) : composeFallback(fbInput())
  let body = scrubR3(fb.text, lang)
  if (hwNote) body += '\n' + hwNote
  streamText(body, sink)
  const source: DoneEvent['source'] = toolOnly ? 'tool' : 'local'
  return finish({ text: lead + body, intent, route: toolOnly ? 'tool' : 'fallback', source, citations: fb.citations, confidence: fb.confidence, streamed: true, snap, tags: tagsArr, good, retrieval, tools })
}
