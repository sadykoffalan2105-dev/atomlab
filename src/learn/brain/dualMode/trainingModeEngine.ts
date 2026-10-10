/**
 * Движок режима «Обучение» для живого диалога.
 *
 * Ход ученика → политика (правило владельца R1, модерация R2, светская беседа) →
 *   • локальный мозг запущен: потоковый ответ (SSE); текст режется на фразы
 *     (SentenceStreamSplitter), и первая фраза уходит в озвучку, как только готова;
 *     мозг оборвался до первого куска — мгновенно отвечаем локально;
 *   • иначе — «человеческий» слой и локальный составитель ответа (без LLM, только найденный текст).
 * Любой ответ проходит пост-проверку R3 (без «не знаю / нет в базе»).
 * С учётом эмоции ученика с камеры и памяти сессии (последние ~8 реплик).
 */
import { filterAssistantReply } from '../../learnAssistantGuard'
import type { ChatMessage } from '../../learnTeacherPrompt'
import { citationForDisplay, retrieveForTeacher, type TeacherKnowledgeResult } from '../../teacherKnowledge'
import type { EmotionState } from '../brainTypes'
import { SentenceStreamSplitter, splitIntoSentences } from '../voice/sentenceStream'
import { humanTurn } from '../human/humanTeacher'
import { detectMood } from '../human/personaVoice'
import { applyInputPolicy, detectQuestionLang, ensureNoUnknown, isReasonedLead, reasonFromBasics } from '../policy'
import { brainMoodFrom, ensureBrainOnline, streamChat } from '../remote/brainClient'
import { detectNonQuestion, replyForNonQuestion, resolveTurn, type ResolvedTurn } from './followUps'
import { composeLocalAnswer, extractKeyTerm, type ComposeStyle } from './localAnswerComposer'
import { clarifyPrompt } from './personaProfiles'
import type { AssistantLang } from './dualModeTypes'

export interface TrainingEngineConfig {
  lang: AssistantLang
  gradeId: string
  chapterId: string
  sectionId?: string
  sectionTitle?: string
  /** Стабильный id ученика (для модели ученика в мозге). */
  studentId?: string
}

export interface TrainingAnswerRequest {
  /** Реплика ученика как есть. */
  text: string
  /** Последние реплики диалога (user/assistant), без текущей. */
  history: ChatMessage[]
  /** Прошлые содержательные вопросы ученика (для «а почему?», «пример»). */
  previousQuestions: string[]
  emotion?: EmotionState
  /** Вовлечённость с камеры 0..1 (отправляется в мозг один раз за ход). */
  cameraEngagement?: number
  signal?: AbortSignal
  /** Готовая к озвучке фраза. */
  onSentence?: (sentence: string) => void
  /** Текст ответа на данный момент (для стриминга в UI). */
  onText?: (text: string) => void
  /** Не обращаться к локальному мозгу (тесты, офлайн). */
  noBrain?: boolean
}

export interface TrainingAnswerTimings {
  knowledgeMs: number
  /** От начала обработки до первой готовой фразы. */
  firstSentenceMs: number | null
  firstTokenMs: number | null
  totalMs: number
}

export interface TrainingAnswer {
  /** Текст для чата (с источниками в конце — UI превращает их в чипы). */
  display: string
  /** Чистый текст ответа (что озвучено). */
  text: string
  sentences: string[]
  source: 'brain' | 'local'
  confident: boolean
  citations: string[]
  resolved: ResolvedTurn
  /** Мозг был запущен, но не ответил — ответили локально. */
  fellBack: boolean
  timings: TrainingAnswerTimings
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

export class TrainingModeEngine {
  private readonly cfg: TrainingEngineConfig
  private seed = Math.floor(Math.random() * 1000)

  constructor(config: TrainingEngineConfig) {
    this.cfg = config
  }

  private knowledge(query: string, style: ComposeStyle, signal?: AbortSignal): Promise<TeacherKnowledgeResult> {
    return retrieveForTeacher(query, {
      locale: this.cfg.lang,
      gradeId: this.cfg.gradeId,
      chapterId: this.cfg.chapterId,
      sectionId: this.cfg.sectionId,
      sectionTitle: this.cfg.sectionTitle,
      limit: style.detail === 'more' ? 8 : 6,
      maxChars: 3_600,
      timeoutMs: 1_500,
      signal,
    })
  }

  /** Готовый текст одним ходом (политика, светская беседа, «человеческий» слой). */
  private immediate(req: TrainingAnswerRequest, text: string): TrainingAnswer {
    const t0 = now()
    const sentences = splitIntoSentences(text)
    for (const s of sentences) req.onSentence?.(s)
    req.onText?.(text)
    const resolved = resolveTurn(req.text, req.previousQuestions, this.cfg.lang, this.cfg.sectionTitle)
    const ms = Math.round(now() - t0)
    return {
      display: text,
      text,
      sentences,
      source: 'local',
      confident: true,
      citations: [],
      resolved,
      fellBack: false,
      timings: { knowledgeMs: 0, firstSentenceMs: ms, firstTokenMs: null, totalMs: ms },
    }
  }

  /**
   * Ответ на ход ученика (стриминг фраз через колбэки). Сначала — политика (R1/R2/светская
   * беседа), затем локальный мозг, если он запущен; иначе «человеческий» слой и база знаний.
   */
  async answer(req: TrainingAnswerRequest): Promise<TrainingAnswer> {
    const step = applyInputPolicy(req.text, this.cfg.lang, this.seed++)
    if (step.kind === 'reply') return this.immediate(req, step.text)
    if (step.prefix) {
      // R2 звучит первым, затем ответ по сути на очищенный вопрос.
      const notice = step.prefix.trim()
      for (const s of splitIntoSentences(notice)) req.onSentence?.(s)
      const onText = req.onText
      const res = await this.answerAfterPolicy({ ...req, text: step.text, onText: onText ? (t) => onText(`${step.prefix}${t}`) : undefined })
      const noticeSentences = splitIntoSentences(notice)
      return { ...res, display: `${step.prefix}${res.display}`, text: `${step.prefix}${res.text}`, sentences: [...noticeSentences, ...res.sentences] }
    }
    return this.answerAfterPolicy({ ...req, text: step.text })
  }

  private async answerAfterPolicy(req: TrainingAnswerRequest): Promise<TrainingAnswer> {
    let brainTried = false
    if (!req.noBrain && (await ensureBrainOnline())) {
      brainTried = true
      const brain = await this.answerBrain(req)
      if (brain) return brain
      if (req.signal?.aborted) throw abortError()
    }
    const lastTeacher = [...req.history].reverse().find((m) => m.role === 'assistant')?.content
    const human = humanTurn(req.text, { lang: this.cfg.lang, lastTeacher })
    if (human?.kind === 'reply') return this.immediate(req, human.text)
    if (human?.kind === 'prefix') {
      const pre = human.prefix
      req.onSentence?.(pre)
      const onText = req.onText
      const res = await this.answerCore({ ...req, text: human.rest, onText: onText ? (t) => onText(`${pre} ${t}`) : undefined }, brainTried)
      return { ...res, display: `${pre} ${res.display}`, text: `${pre} ${res.text}`, sentences: [pre, ...res.sentences] }
    }
    return this.answerCore(req, brainTried)
  }

  /** Потоковый ответ локального мозга; null — мозг не ответил до первого куска (запасной путь). */
  private async answerBrain(req: TrainingAnswerRequest): Promise<TrainingAnswer | null> {
    const t0 = now()
    const signal = req.signal
    const resolved = resolveTurn(req.text, req.previousQuestions, this.cfg.lang, this.cfg.sectionTitle)
    const timings: TrainingAnswerTimings = { knowledgeMs: 0, firstSentenceMs: null, firstTokenMs: null, totalMs: 0 }
    const sentences: string[] = []
    const emit = (s: string) => {
      if (signal?.aborted) return
      if (timings.firstSentenceMs === null) timings.firstSentenceMs = Math.round(now() - t0)
      sentences.push(s)
      req.onSentence?.(s)
    }
    const splitter = new SentenceStreamSplitter({ firstMaxChars: 110, minChars: 12 })
    const messages = [...req.history.slice(-10), { role: 'user', content: req.text }]
    const done = await streamChat({
      messages,
      lang: detectQuestionLang(req.text, this.cfg.lang),
      context: {
        gradeId: this.cfg.gradeId,
        chapterId: this.cfg.chapterId,
        sectionId: this.cfg.sectionId,
        sectionTitle: this.cfg.sectionTitle,
        mode: 'live',
        detail: resolved.style.detail === 'more' ? 'more' : 'brief',
      },
      student: {
        mood: brainMoodFrom(req.emotion ?? null, detectMood(req.text)),
        ...(typeof req.cameraEngagement === 'number' ? { cameraEngagement: Math.max(0, Math.min(1, req.cameraEngagement)) } : {}),
      },
      studentId: this.cfg.studentId,
      signal,
      onDelta: (delta, full) => {
        if (signal?.aborted) return
        if (timings.firstTokenMs === null) timings.firstTokenMs = Math.round(now() - t0)
        req.onText?.(full)
        for (const s of splitter.push(delta)) emit(s)
      },
    })
    if (signal?.aborted) throw abortError()
    if (!done) return null
    for (const s of splitter.flush()) emit(s)
    const raw = done.text.trim()
    const text = ensureNoUnknown(filterAssistantReply(raw, this.cfg.lang).trim() || raw, this.cfg.lang, [this.cfg.sectionTitle ?? ''])
    if (text.length < 2) return null
    // Пост-проверка изменила текст до того, как он прозвучал целиком, — договариваем недостающее.
    if (!sentences.length) for (const s of splitIntoSentences(text)) emit(s)
    const citations = done.citations.slice(0, 2)
    timings.totalMs = Math.round(now() - t0)
    return {
      display: citations.length ? `${text}\n\n${citations.join(' ')}` : text,
      text,
      sentences,
      source: 'brain',
      confident: done.confidenceLabel !== 'reasoned',
      citations,
      resolved,
      fellBack: false,
      timings,
    }
  }

  private async answerCore(req: TrainingAnswerRequest, brainTried: boolean): Promise<TrainingAnswer> {
    const t0 = now()
    const signal = req.signal
    const resolved = resolveTurn(req.text, req.previousQuestions, this.cfg.lang, this.cfg.sectionTitle)
    const style = resolved.style
    const timings: TrainingAnswerTimings = { knowledgeMs: 0, firstSentenceMs: null, firstTokenMs: null, totalMs: 0 }
    const sentences: string[] = []
    const emit = (s: string) => {
      if (signal?.aborted) return
      if (timings.firstSentenceMs === null) timings.firstSentenceMs = Math.round(now() - t0)
      sentences.push(s)
      req.onSentence?.(s)
    }

    // Реплика без вопроса («не знаю», «ммм», «понятно») — короткий человеческий ответ
    // с наводкой по теме; база знаний при этом не опрашивается.
    const nonQuestion = detectNonQuestion(req.text)
    if (nonQuestion) {
      const topic = req.previousQuestions[req.previousQuestions.length - 1] ?? this.cfg.sectionTitle
      const reply = replyForNonQuestion(nonQuestion, this.cfg.lang, { topic, seed: this.seed++ })
      emit(reply)
      req.onText?.(reply)
      timings.totalMs = Math.round(now() - t0)
      return { display: reply, text: reply, sentences, source: 'local', confident: true, citations: [], resolved, fellBack: brainTried, timings }
    }

    const knowledge = await this.knowledge(resolved.query, style, signal)
    timings.knowledgeMs = knowledge.ms
    if (signal?.aborted) throw abortError()
    return this.composeLocal(req, resolved, knowledge, timings, t0, emit, sentences, brainTried)
  }

  private composeLocal(
    req: TrainingAnswerRequest,
    resolved: ResolvedTurn,
    knowledge: TeacherKnowledgeResult,
    timings: TrainingAnswerTimings,
    t0: number,
    emit: (s: string) => void,
    sentences: string[],
    fellBack: boolean,
  ): TrainingAnswer {
    const composed = composeLocalAnswer({
      query: resolved.query,
      hits: knowledge.hits,
      lang: this.cfg.lang,
      style: resolved.style,
      topicHint: this.cfg.sectionTitle,
      seed: this.seed++,
    })
    const nearTopics = [...new Set([...knowledge.hits.map((h) => h.title), this.cfg.sectionTitle ?? ''])].filter(Boolean)
    const reasonedOpts = { query: resolved.query, keyTerm: composed.keyTerm ?? extractKeyTerm(resolved.query, this.cfg.lang) }
    // Готового ответа нет — рассуждение от основ вместо «нет в базе» (R3).
    const text =
      !composed.confident && isReasonedLead(composed.text)
        ? reasonFromBasics(this.cfg.lang, nearTopics, reasonedOpts)
        : ensureNoUnknown(composed.text, this.cfg.lang, nearTopics, reasonedOpts)
    const spoken = text === composed.text ? composed.sentences : splitIntoSentences(text)
    for (const s of spoken) emit(s)
    req.onText?.(text)
    const used = new Set(composed.usedTitles)
    // Значки — из фрагментов, давших фразы ответа (не все фрагменты с тем же заголовком).
    const citations = [
      ...new Set(
        (composed.usedCitations?.length ? composed.usedCitations : knowledge.hits.filter((h) => used.has(h.title) && h.citation).map((h) => h.citation!)).map((c) =>
          citationForDisplay(c, this.cfg.lang),
        ),
      ),
    ].slice(0, 2)
    timings.totalMs = Math.round(now() - t0)
    return {
      display: citations.length && composed.confident ? `${text}\n\n${citations.join(' ')}` : text,
      text,
      sentences,
      source: 'local',
      confident: composed.confident,
      citations,
      resolved,
      fellBack,
      timings,
    }
  }

  /** Совместимость со старым API: ответ целиком одним текстом. */
  async explainAsync(
    query: string,
    _topic: string,
    history: { role: string; content: string }[] = [],
    emotion: EmotionState = 'neutral',
  ): Promise<string> {
    const previous = history.filter((m) => m.role === 'user').map((m) => m.content)
    const res = await this.answer({ text: query, history, previousQuestions: previous, emotion })
    return res.text
  }

  /** Короткое «объясню проще» по последнему вопросу (реакция на замешательство с камеры). */
  async simplerExplanation(lastQuestion: string, signal?: AbortSignal): Promise<string | null> {
    if (!lastQuestion.trim()) return null
    const style: ComposeStyle = { simpler: true, noCheckQuestion: true, maxWords: 35 }
    const knowledge = await this.knowledge(lastQuestion, style, signal)
    const composed = composeLocalAnswer({
      query: lastQuestion,
      hits: knowledge.hits,
      lang: this.cfg.lang,
      style,
      topicHint: this.cfg.sectionTitle,
      seed: this.seed++,
    })
    return composed.confident ? composed.text : null
  }

  clarify(): string {
    return clarifyPrompt(this.cfg.lang)
  }
}
