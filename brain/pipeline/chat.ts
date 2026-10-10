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
import { buildSystemPrompt, buildUserTurn } from '../persona/systemPrompt.ts'
import { adaptationForPrompt } from '../student/adapt.ts'
import type { StudentStore } from '../student/events.ts'
import { detectErrorTags, snapshot, type StudentSnapshot } from '../student/model.ts'
import { composeFallback, offtopicReply, referenceFacts } from './fallback.ts'
import { jaccard } from './hybrid.ts'
import { classifyIntent, greetingPrefix, hasChemVocabulary, matchSmalltalk, questionType, smalltalkReply, wantsEncyclopedia, type Intent } from './intent.ts'
import { llmAnswer, llmClassify } from './llm.ts'
import { ASK_CHEM, moderate, R2 } from './moderation.ts'
import { cmpForm, detectLang, GIBBERISH_REPLY, normalizeInput, type Lang } from './normalize.ts'
import { isOwnerRuleQuestion, R1 } from './ownerRule.ts'
import { DANGER_REPLY, ensureToolNumbers, isDangerousRequest, scrubR3, splitSentences, wordCount } from './postcheck.ts'
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
/** reason — почему ответил запасной путь, когда LLM была (first_token_timeout, cjk, lang_mismatch, error…); поле сверх контракта v1. */
export type MetaEvent = { turnId: string; intent: Intent; route: Route; moderated: boolean; lang: Lang; reason?: string }
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
  let metaRoute = ''
  let routePrefix = ''
  let moderated = false
  let reason: string | undefined
  /** замеры LLM для журнала (первый токен, токены подсказки после кеша, попытки, CJK) */
  let llmStats: Record<string, unknown> | undefined
  const sendMeta = (intent: Intent, route: string) => {
    if (metaSent) return
    metaSent = true
    metaRoute = routePrefix + route
    sink.meta({ turnId, intent, route: metaRoute, moderated, lang, ...(reason ? { reason } : {}) })
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
      route: metaRoute,
      ...(reason ? { reason } : {}),
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
  // в живом голосе не тратим секунды на уточнение (и не сбиваем кеш быстрой модели) — хватает эвристики
  if (guess.ambiguous && mode !== 'live' && deps.llm?.status().available) {
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
    // история — коротко (последние реплики, каждая обрезана): длинная история стоит секунд чтения подсказки
    const pc = config.prompt
    const past = req.messages.slice(0, -1).slice(-pc.historyMessages)
    const history: LlmMessage[] = past.map((m) => ({ role: m.role, content: m.content.length > pc.historyChars ? m.content.slice(0, pc.historyChars) + '…' : m.content }))
    const reasoned = !tools.length && retrieval.confR < config.thresholds.medium
    const live = mode === 'live'
    const userTurn = buildUserTurn({
      lang,
      mode,
      detail,
      gradeId: req.context.gradeId,
      sectionTitle: req.context.sectionTitle,
      chapterId: req.context.chapterId,
      sectionId: req.context.sectionId,
      knowledge: promptKnowledge(retrieval, text),
      tools,
      // только действенные указания (короче/проще/успокой); строка «уровень 3/5, темп normal» — лишние токены
      studentBlock: live ? '' : adaptationForPrompt(snap, lang).split('\n').slice(1).join('\n'),
      reasoned,
      facts: referenceFacts(text, lang, kb, qtype).slice(0, live ? 1 : 3),
      question: text,
      maxItems: live ? pc.liveItems : pc.chatItems,
      maxChars: live ? pc.liveChars : pc.chatChars,
    })
    history.push({ role: 'user', content: userTurn })
    const system = buildSystemPrompt(lang)
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
      signal,
      onDelta: (d) => {
        openStream('llm')
        sink.delta(d)
      },
    })
    const varChars = userTurn.length + history.slice(0, -1).reduce((n, m) => n + m.content.length, 0)
    llmStats = { model: ans.model, stopped: ans.stopped, firstMs: ans.firstMs, promptTokens: ans.promptTokens, promptMs: ans.promptMs, attempts: ans.attempts, cjk: ans.cjk || undefined, varChars, retrievalMs: retrieval.ms }
    if (!deps.noJournal || process.env.BRAIN_LOG_LLM === '1')
      console.log(`[brain] llm ${ans.model} ${mode}: ${ans.stopped}, первый токен ${ans.firstMs ?? '—'} мс, подсказка ${ans.promptTokens ?? '—'} ток/${ans.promptMs ?? '—'} мс, переменная часть ${varChars} симв., поиск ${Math.round(retrieval.ms)} мс${ans.cjk ? ', CJK' : ''}`)
    if (signal?.aborted) {
      if (!metaSent) openStream('fallback', 'client_abort')
      return finish({ text: lead + ans.text, intent, route: ans.text ? 'llm' : 'fallback', source: ans.text ? 'llm' : 'local', confidence: 0, streamed: true, snap, tags: tagsArr, good, retrieval, tools })
    }
    const citations = () => [...(tools.length ? ['[ATOMLAB: расчёт]'] : []), ...relevantCitations(retrieval, text)].filter((c, i, a) => a.indexOf(c) === i)
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
      if (!ans.ok || ans.stopped === 'total_timeout' || (ans.stopped === 'cjk' && short)) {
        reason = `llm_${ans.stopped}+fallback_tail`
        const fb = intent === 'offtopic' ? offtopicReply(lang, retrieval, seed, cmp) : composeFallback(fbInput())
        const have = splitSentences(body).map((s) => new Set(analyzeTerms(s)))
        const extra = splitSentences(scrubR3(fb.text, lang)).filter((s) => {
          const t = new Set(analyzeTerms(s))
          return !have.some((h) => jaccard(h, t) > 0.5)
        })
        if (extra.length) {
          const add = ' ' + extra.slice(0, 3).join(' ')
          sink.delta(add)
          body += add
        }
      } else if (ans.stopped === 'cjk') reason = 'llm_cjk_trimmed'
      const conf = tools.length ? 0.95 : Math.max(retrieval.confR, reasoned ? 0.3 : retrieval.confR)
      return finish({ text: lead + body, intent, route: 'llm', source: 'llm', citations: citations(), confidence: conf, streamed: true, snap, tags: tagsArr, good, retrieval, tools })
    }
    // модель не сказала ни слова (таймаут первого токена, ошибка, CJK сразу, не тот язык) → честно: запасной путь + причина
    openStream(toolOnly ? 'tool' : 'fallback', `llm_${ans.stopped}`)
  }

  // запасной путь
  const fb = intent === 'offtopic' ? offtopicReply(lang, retrieval, seed, cmp) : composeFallback(fbInput())
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
function promptKnowledge(r: RetrievalResult, question: string) {
  const items = r.items.filter((c) => overlap(question, c) >= 0.25)
  return items.length ? items : r.items.slice(0, 1)
}

/** Цитаты к ответу модели — только из фрагментов по теме вопроса. */
function relevantCitations(r: RetrievalResult, question: string): string[] {
  return r.items
    .filter((c) => overlap(question, c) >= 0.34)
    .slice(0, 3)
    .map((c) => c.citation)
}
