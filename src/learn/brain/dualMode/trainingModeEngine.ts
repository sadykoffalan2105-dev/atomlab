/**
 * Движок режима «Обучение» для живого диалога.
 *
 * Ход ученика → (follow-up? берём тему прошлого вопроса) → знания через
 * teacherKnowledge.retrieveForTeacher (вне критического пути, кеш, лимит ожидания) →
 *   • «умный ИИ» подключён: потоковый ответ Puter; текст режется на фразы
 *     (SentenceStreamSplitter), и первая фраза уходит в озвучку, как только готова;
 *     нет первого куска за ~3.5 с — мгновенно отвечаем локально;
 *   • иначе — локальный составитель ответа (без LLM, только найденный текст).
 * С учётом эмоции ученика с камеры и памяти сессии (последние ~8 реплик).
 */
import type { LearnLocalAssistantContext } from '../../learnLocalAssistant'
import { filterAssistantReply } from '../../learnAssistantGuard'
import { buildLiveAssistantSystemPrompt } from '../../learnAssistantPrompt'
import { isSmartAiConnected, streamTeacherChat, type ChatMessage } from '../../learnPuterChat'
import { buildSectionOutlineBlock } from '../../learnSectionKnowledge'
import { citationForDisplay, retrieveForTeacher, type TeacherKnowledgeResult } from '../../teacherKnowledge'
import type { EmotionState } from '../brainTypes'
import { SentenceStreamSplitter } from '../voice/sentenceStream'
import { emotionPromptHint } from './cameraEmotionCoach'
import { resolveTurn, type ResolvedTurn } from './followUps'
import { buildLiveOnlineBrainDirective } from './liveOnlineBrain'
import { composeLocalAnswer, type ComposeStyle } from './localAnswerComposer'
import { clarifyPrompt } from './personaProfiles'
import type { AssistantLang } from './dualModeTypes'

export interface TrainingEngineConfig {
  lang: AssistantLang
  gradeId: string
  chapterId: string
  sectionId?: string
  sectionTitle?: string
}

export interface TrainingAnswerRequest {
  /** Реплика ученика как есть. */
  text: string
  /** Последние реплики диалога (user/assistant), без текущей. */
  history: ChatMessage[]
  /** Прошлые содержательные вопросы ученика (для «а почему?», «пример»). */
  previousQuestions: string[]
  emotion?: EmotionState
  signal?: AbortSignal
  /** Готовая к озвучке фраза. */
  onSentence?: (sentence: string) => void
  /** Текст ответа на данный момент (для стриминга в UI). */
  onText?: (text: string) => void
  /** Переопределить «умный ИИ подключён» (тесты). */
  smartAi?: boolean
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
  source: 'smart' | 'local'
  confident: boolean
  citations: string[]
  resolved: ResolvedTurn
  /** «Умный ИИ» не ответил вовремя — ответили локально. */
  fellBack: boolean
  timings: TrainingAnswerTimings
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

function styleHint(style: ComposeStyle, lang: AssistantLang): string {
  const parts: string[] = []
  if (style.detail === 'more') parts.push('The student asked for MORE DETAIL: up to 140 words, still in short spoken sentences.')
  else parts.push('Keep it short: about 40–60 words (3–4 short sentences).')
  if (style.simpler) parts.push('The student did not understand: explain it SIMPLER, everyday words, one idea.')
  if (style.wantExample) parts.push('Give ONE concrete example (a substance or a reaction said in words).')
  if (style.wantWhy) parts.push('The student asks WHY: give the cause/mechanism first.')
  void lang
  return parts.join(' ')
}

export class TrainingModeEngine {
  private readonly cfg: TrainingEngineConfig
  private seed = Math.floor(Math.random() * 1000)

  constructor(config: TrainingEngineConfig) {
    this.cfg = config
  }

  private context(): LearnLocalAssistantContext {
    return {
      locale: this.cfg.lang,
      gradeId: this.cfg.gradeId,
      chapterId: this.cfg.chapterId,
      sectionId: this.cfg.sectionId ?? 's01',
      sectionTitle: this.cfg.sectionTitle ?? '',
      slideTitle: this.cfg.sectionTitle ?? '',
      slideBody: '',
      mode: 'teacher',
      kpNumber: 1,
    }
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

  /** Ответ на ход ученика (стриминг фраз через колбэки). */
  async answer(req: TrainingAnswerRequest): Promise<TrainingAnswer> {
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

    const knowledgeP = this.knowledge(resolved.query, style, signal)
    const smart = req.smartAi ?? isSmartAiConnected()

    if (smart) {
      const knowledge = await knowledgeP
      timings.knowledgeMs = knowledge.ms
      if (signal?.aborted) throw abortError()
      const splitter = new SentenceStreamSplitter({ firstMaxChars: 110, minChars: 12 })
      try {
        const ctx = this.context()
        const system = buildLiveAssistantSystemPrompt({
          ...ctx,
          knowledgeBlock: '',
          chemistryKnowledgeBlock: knowledge.text,
          sectionOutlineBlock: buildSectionOutlineBlock(ctx, 600),
          liveDirective: buildLiveOnlineBrainDirective(this.cfg.lang),
          cameraHint: emotionPromptHint(this.cfg.lang, req.emotion ?? 'neutral'),
          answerStyle: styleHint(style, this.cfg.lang),
        })
        const payload: ChatMessage[] = [
          { role: 'system', content: system },
          ...req.history.slice(-8).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          { role: 'user', content: req.text },
        ]
        const result = await streamTeacherChat(payload, {
          signal,
          firstTokenTimeoutMs: 3_500,
          totalTimeoutMs: 20_000,
          maxTokens: style.detail === 'more' ? 600 : 320,
          temperature: 0.35,
          onDelta: (delta, full) => {
            req.onText?.(full)
            for (const s of splitter.push(delta)) emit(s)
          },
        })
        timings.firstTokenMs = result.firstTokenMs === null ? null : Math.round(result.firstTokenMs)
        for (const s of splitter.flush()) emit(s)
        const text = filterAssistantReply(result.text.trim(), this.cfg.lang).trim() || result.text.trim()
        if (text.length > 2) {
          const citations = knowledge.citations.slice(0, 2).map((c) => citationForDisplay(c, this.cfg.lang))
          timings.totalMs = Math.round(now() - t0)
          return {
            display: citations.length ? `${text}\n\n${citations.join(' ')}` : text,
            text,
            sentences,
            source: 'smart',
            confident: true,
            citations,
            resolved,
            fellBack: false,
            timings,
          }
        }
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError' || signal?.aborted) throw abortError()
        // Если что-то уже прозвучало — договариваем остаток и не дублируем ответ локально.
        if (sentences.length > 0) {
          for (const s of splitter.flush()) emit(s)
          const text = sentences.join(' ')
          timings.totalMs = Math.round(now() - t0)
          return { display: text, text, sentences, source: 'smart', confident: true, citations: [], resolved, fellBack: false, timings }
        }
      }
      // «Умный ИИ» не успел — отвечаем локально (знания уже найдены).
      return this.composeLocal(req, resolved, knowledge, timings, t0, emit, sentences, true)
    }

    const knowledge = await knowledgeP
    timings.knowledgeMs = knowledge.ms
    if (signal?.aborted) throw abortError()
    return this.composeLocal(req, resolved, knowledge, timings, t0, emit, sentences, false)
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
      suggestSmartAi: !isSmartAiConnected(),
    })
    for (const s of composed.sentences) emit(s)
    req.onText?.(composed.text)
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
      display: citations.length && composed.confident ? `${composed.text}\n\n${citations.join(' ')}` : composed.text,
      text: composed.text,
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
