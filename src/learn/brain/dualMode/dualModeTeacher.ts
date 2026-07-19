/**
 * TeacherIntelligence — «Двухрежимный разум» ИИ-преподавателя химии.
 *
 * Высокоуровневая система управления обучением (State Machine), связывающая:
 *  • камеру  → EngagementTracker → UnifiedBrain (вовлечённость, мимика, честность);
 *  • микрофон → DuplexVoiceSession (VAD + STT + TTS + барджин);
 *  • химическую БД → QuestionGenerator / TrainingModeEngine (вопросы и объяснения);
 *  • «преподавательское мышление» → UnifiedBrain (reasoning-трасса + память ученика).
 *
 * Два принципиально разных состояния:
 *   TRAINING — профессор-наставник, полные объяснения, проактивный «понятно?».
 *   EXAM     — строгий экзаменатор, правило «НЕТ ОТВЕТАМ», сократовский диалог.
 *
 * Ключевые точки API (как у серверного контроллера обучения):
 *   handleIncomingVoice(transcript, mode?)  — единый вход речи, роутинг по режиму;
 *   evaluateResponse(answer, topic, diff)   — оценка без выдачи решения в экзамене;
 *   generateNextQuestion(topic, mistakes)   — следующий вопрос по «проблемным зонам»;
 *   analyzeCameraEngagement()               — постоянный CV-мониторинг вовлечённости.
 */
import type { LearnSpeechController } from '../../learnSpeech'
import type { FusedContext, ReasoningStepSnapshot, VisionSignal } from '../brainTypes'
import { UnifiedBrain } from '../unifiedBrain'
import { EngagementTracker } from '../vision/engagementTracker'
import { DuplexVoiceSession } from '../voice/duplexVoiceSession'
import type { DialogTurn } from '../voice/interruptionController'
import {
  ConversationStateManager,
  type ConversationSnapshot,
} from './conversationStateManager'
import { ExamModeEngine } from './examModeEngine'
import { QuestionGenerator } from './questionGenerator'
import { TrainingModeEngine } from './trainingModeEngine'
import { parseVoiceIntent } from './intentParser'
import {
  clarifyPrompt,
  personaForMode,
  reengagePrompt,
  switchAnnouncement,
} from './personaProfiles'
import type {
  AssistantLang,
  QuestionCard,
  TeacherResponse,
  TutorMode,
  TutorPersona,
} from './dualModeTypes'

export interface DualModeTeacherCallbacks {
  onResponse?: (response: TeacherResponse) => void
  onModeChange?: (mode: TutorMode, persona: TutorPersona) => void
  onEngagement?: (fused: FusedContext) => void
  onPartialTranscript?: (text: string) => void
  /** Финальная реплика ученика (после распознавания) — для ленты диалога. */
  onStudentUtterance?: (text: string) => void
  onTurnChange?: (turn: DialogTurn) => void
  onSpeakingChange?: (speaking: boolean) => void
  onStateChange?: (snapshot: ConversationSnapshot) => void
}

export interface DualModeTeacherConfig {
  lang: AssistantLang
  gradeId: string
  chapterId: string
  sectionTitle?: string
  sectionId?: string
  studentId: string
  studentName?: string | null
  /** Список тем экзамена (для очереди «следующая тема»). */
  topics?: string[]
  initialMode?: TutorMode
  useAiGrading?: boolean
  controller: LearnSpeechController
  callbacks?: DualModeTeacherCallbacks
}

const PROACTIVE_COOLDOWN_MS = 15_000
const REENGAGE_COOLDOWN_MS = 12_000

export class TeacherIntelligence {
  private readonly cfg: DualModeTeacherConfig
  private readonly lang: AssistantLang
  private persona: TutorPersona
  private readonly state: ConversationStateManager
  private readonly generator: QuestionGenerator
  private readonly training: TrainingModeEngine
  private readonly exam: ExamModeEngine
  private readonly brain: UnifiedBrain

  private tracker: EngagementTracker | null = null
  private duplex: DuplexVoiceSession | null = null
  private unsubscribeFused: (() => void) | null = null

  private currentCard: QuestionCard | null = null
  private attempt = 0
  private running = false
  private busy = false
  private lastProactiveMs = 0
  private lastReengageMs = 0

  constructor(config: DualModeTeacherConfig) {
    this.cfg = config
    this.lang = config.lang
    const initialMode = config.initialMode ?? 'training'
    this.persona = personaForMode(initialMode)
    this.state = new ConversationStateManager(initialMode, config.topics ?? [])
    this.generator = new QuestionGenerator({
      gradeId: config.gradeId,
      chapterId: config.chapterId,
      lang: config.lang,
    })
    this.training = new TrainingModeEngine({
      lang: config.lang,
      gradeId: config.gradeId,
      chapterId: config.chapterId,
      sectionId: config.sectionId,
      sectionTitle: config.sectionTitle,
    })
    this.exam = new ExamModeEngine({
      lang: config.lang,
      generator: this.generator,
      useAiGrading: config.useAiGrading,
      gradeId: config.gradeId,
      chapterId: config.chapterId,
    })
    this.brain = new UnifiedBrain({
      studentId: config.studentId,
      lang: config.lang,
      studentName: config.studentName ?? null,
      useAiGrading: config.useAiGrading,
    })
  }

  // ---------------------------------------------------------------- lifecycle

  /** Запуск: подключает камеру и микрофон, начинает вести диалог. */
  async start(video: HTMLVideoElement | null, micStream: MediaStream | null): Promise<void> {
    this.running = true

    if (video) {
      this.tracker = new EngagementTracker(video, {
        fps: 4,
        onSignal: (sig: VisionSignal) => this.brain.ingestVision(sig),
      })
      this.tracker.start()
    }
    this.unsubscribeFused = this.brain.onFused((fused) => this.handleEngagement(fused))

    if (micStream) {
      this.duplex = new DuplexVoiceSession({
        lang: this.lang,
        controller: this.cfg.controller,
        // Half-duplex: пока учитель говорит, микрофон не пишет его же речь.
        bargeInEnabled: false,
        postSpeakDelayMs: 450,
        onPartial: (t) => this.cfg.callbacks?.onPartialTranscript?.(t),
        onUserUtterance: (final) => {
          void this.handleIncomingVoice(final)
        },
        onTurnChange: (turn) => this.cfg.callbacks?.onTurnChange?.(turn),
        onAiSpeakingChange: (s) => this.cfg.callbacks?.onSpeakingChange?.(s),
      })
      await this.duplex.begin(micStream)
    }

    // Первая реплика зависит от режима.
    if (this.state.getMode() === 'exam') {
      await this.askNext()
    } else {
      await this.deliver(this.buildResponse(this.greeting(), null, null, false))
    }
  }

  stop(): void {
    this.running = false
    this.tracker?.stop()
    this.tracker = null
    this.duplex?.end()
    this.duplex = null
    this.unsubscribeFused?.()
    this.unsubscribeFused = null
    const topic = this.state.currentTopic() ?? this.cfg.sectionTitle ?? 'chemistry'
    void this.brain.endSession(topic, null)
  }

  // -------------------------------------------------------------- mode switch

  getMode(): TutorMode {
    return this.state.getMode()
  }

  getPersona(): TutorPersona {
    return this.persona
  }

  snapshot(): ConversationSnapshot {
    return this.state.snapshot()
  }

  /** Переключение режима: меняет «личность» ИИ и ведёт себя по-новому. */
  async setMode(mode: TutorMode): Promise<TeacherResponse> {
    if (mode === this.state.getMode()) {
      return this.buildResponse('', this.currentCard, null, false)
    }
    this.state.setMode(mode)
    this.persona = personaForMode(mode)
    this.currentCard = null
    this.attempt = 0
    this.cfg.callbacks?.onModeChange?.(mode, this.persona)
    this.cfg.callbacks?.onStateChange?.(this.state.snapshot())

    const announcement = switchAnnouncement(this.lang, mode)
    if (mode === 'exam') {
      const opening = await this.buildNextQuestionResponse(announcement)
      await this.deliver(opening)
      return opening
    }
    const resp = this.buildResponse(announcement, null, null, false)
    await this.deliver(resp)
    return resp
  }

  // --------------------------------------------------------- voice entrypoint

  /**
   * Единый вход речи ученика. Распознаёт команды управления и маршрутизирует
   * реплику в зависимости от текущего (или переданного) режима.
   */
  async handleIncomingVoice(transcript: string, mode?: TutorMode): Promise<TeacherResponse> {
    if (mode && mode !== this.state.getMode()) {
      await this.setMode(mode)
    }
    const text = transcript.trim()
    if (!text) return this.buildResponse('', this.currentCard, null, false)

    // Не принимать реплику, пока учитель ещё говорит / только что говорил (эхо).
    if (this.duplex?.isAiSpeaking() || this.busy) {
      return this.buildResponse('', this.currentCard, null, false)
    }

    this.state.pushTurn('student', text)
    this.cfg.callbacks?.onStudentUtterance?.(text)
    this.duplex?.markThinking()

    const intent = parseVoiceIntent(text, this.lang)
    let response: TeacherResponse

    switch (intent.kind) {
      case 'switch_mode':
        return this.setMode(intent.target)
      case 'stop':
        response = this.buildResponse(this.byeLine(), null, null, true)
        break
      case 'next_topic':
        response = await this.advanceTopic()
        break
      case 'next_question':
        response = await this.buildNextQuestionResponse()
        break
      case 'repeat':
        response = this.repeatLine()
        break
      case 'explain':
        response = await this.handleExplain(intent.text)
        break
      case 'answer':
      default:
        response = await this.routeAnswer(intent.kind === 'answer' ? intent.text : text)
        break
    }

    await this.deliver(response)
    if (intent.kind === 'stop') this.stop()
    return response
  }

  // --------------------------------------------------------------- evaluation

  /**
   * Оценка ответа ученика. В режиме экзамена НИКОГДА не раскрывает решение —
   * возвращает сократовский наводящий вопрос; в обучении отвечает как профессор.
   */
  async evaluateResponse(
    answer: string,
    topic: string,
    _difficulty: number,
  ): Promise<TeacherResponse> {
    if (this.state.getMode() === 'training') {
      const explanation = await this.training.explainAsync(answer, topic, this.state.history())
      return this.buildResponse(explanation, this.currentCard, null, false)
    }

    // Экзамен: мышление и память — через UnifiedBrain, фраза — строго без ответа.
    const card = this.currentCard
    if (!card) return this.buildNextQuestionResponse()

    this.attempt += 1
    let reasoning: ReasoningStepSnapshot[] = []
    let grade
    try {
      const evalResult = await this.brain.evaluateAnswer(answer)
      grade = evalResult.grade
      reasoning = evalResult.decision.reasoning
    } catch {
      grade = undefined
    }

    const examEval = grade
      ? this.exam.respond(grade, card, this.attempt)
      : await this.exam.evaluate(answer, card, this.attempt)

    this.state.recordResult(card.topic, card.id, examEval.grade.verdict)
    this.cfg.callbacks?.onStateChange?.(this.state.snapshot())

    if (examEval.passed) {
      // Верно — короткая похвала и сразу следующий вопрос.
      const next = await this.buildNextQuestionResponse(examEval.say)
      next.reasoning = reasoning
      next.verdict = examEval.grade.verdict
      return next
    }

    // Неверно/частично — сократовский наводящий вопрос, тот же вопрос остаётся.
    const resp = this.buildResponse(examEval.say, card, examEval.grade.verdict, false)
    resp.reasoning = reasoning
    return resp
  }

  /** Следующий вопрос по теме с учётом «проблемных зон» ученика. */
  generateNextQuestion(topic: string, previousMistakes: string[]): QuestionCard | null {
    const asked = this.state.snapshot().progress.find((p) => p.topic === topic)?.askedIds ?? []
    return this.generator.generateNextQuestion(
      topic,
      previousMistakes,
      this.state.getDifficulty(),
      asked,
    )
  }

  /** Постоянный CV-мониторинг: текущий сведённый контекст вовлечённости. */
  analyzeCameraEngagement(): FusedContext {
    return this.brain.fusedNow()
  }

  // ------------------------------------------------------------------ private

  private async routeAnswer(text: string): Promise<TeacherResponse> {
    if (this.state.getMode() === 'training') {
      // В обучении «ответ» — это вопрос/реплика ученика: объясняем как профессор.
      const explanation = await this.training.explainAsync(text, this.currentTopic(), this.state.history())
      return this.buildResponse(explanation, null, null, false)
    }
    return this.evaluateResponse(text, this.currentTopic(), this.state.getDifficulty())
  }

  private async handleExplain(text: string): Promise<TeacherResponse> {
    if (this.state.getMode() === 'exam') {
      // Экзаменатор не объясняет — мягко возвращает к вопросу без ответа.
      const card = this.currentCard
      const nudge =
        this.lang === 'en'
          ? 'In exam mode I cannot explain. Try to reason it out yourself.'
          : this.lang === 'uz'
            ? 'Imtihon rejimida tushuntira olmayman. O‘zingiz fikrlab ko‘ring.'
            : 'В режиме экзамена я не подсказываю. Попробуй рассуждать сам.'
      const socratic = card ? ` ${this.generator.socraticFollowUp(card, this.attempt + 1)}` : ''
      return this.buildResponse(`${nudge}${socratic}`.trim(), card, null, false)
    }
    const explanation = await this.training.explainAsync(text, this.currentTopic(), this.state.history())
    return this.buildResponse(explanation, null, null, false)
  }

  private async advanceTopic(): Promise<TeacherResponse> {
    const next = this.state.nextTopic()
    this.cfg.callbacks?.onStateChange?.(this.state.snapshot())
    if (!next) {
      return this.buildResponse(this.allTopicsDoneLine(), null, null, true)
    }
    if (this.state.getMode() === 'exam') {
      return this.buildNextQuestionResponse()
    }
    const invite =
      this.lang === 'en'
        ? `New topic: ${next}. What would you like to know about it?`
        : this.lang === 'uz'
          ? `Yangi mavzu: ${next}. Bu haqda nimani bilmoqchisiz?`
          : `Новая тема: ${next}. Что хочешь узнать о ней?`
    return this.buildResponse(invite, null, null, false)
  }

  /** Подобрать и «задать» новый вопрос экзамена (с необязательным префиксом). */
  private async buildNextQuestionResponse(prefix = ''): Promise<TeacherResponse> {
    const topic = this.currentTopic()
    const mistakes = this.state.problemZones(topic)
    const card = this.generateNextQuestion(topic, mistakes)
    if (!card) {
      return this.buildResponse(prefix || this.noQuestionsLine(), null, null, true)
    }
    this.currentCard = card
    this.attempt = 0
    this.state.markAsked(card.topic, card.id)
    this.brain.setActiveQuestion({
      question: card.speak,
      rubric: card.rubric,
      sampleAnswer: card.sampleAnswer,
      topic: card.topic,
    })
    this.cfg.callbacks?.onStateChange?.(this.state.snapshot())
    const say = prefix ? `${prefix} ${card.speak}`.trim() : card.speak
    return this.buildResponse(say, card, null, false)
  }

  private async askNext(): Promise<void> {
    const resp = await this.buildNextQuestionResponse()
    await this.deliver(resp)
  }

  private repeatLine(): TeacherResponse {
    if (this.currentCard) {
      return this.buildResponse(this.currentCard.speak, this.currentCard, null, false)
    }
    const line =
      this.lang === 'en'
        ? 'There is nothing to repeat yet.'
        : this.lang === 'uz'
          ? 'Hozircha takrorlaydigan narsa yo‘q.'
          : 'Пока нечего повторять.'
    return this.buildResponse(line, null, null, false)
  }

  /** Реакция на данные камеры: проактивный «понятно?» или напоминание о вопросе. */
  private handleEngagement(fused: FusedContext): void {
    this.cfg.callbacks?.onEngagement?.(fused)
    if (!this.running || this.busy) return
    if (this.duplex?.isAiSpeaking()) return
    if (this.duplex && this.duplex.getTurn() !== 'idle') return

    const now = Date.now()

    // Обучение: заметили замешательство — сами предлагаем зайти иначе.
    if (
      this.state.getMode() === 'training' &&
      this.persona.proactiveClarify &&
      (fused.emotion === 'confused' || fused.emotion === 'frustrated') &&
      now - this.lastProactiveMs > PROACTIVE_COOLDOWN_MS
    ) {
      this.lastProactiveMs = now
      void this.deliver(this.buildResponse(clarifyPrompt(this.lang), this.currentCard, null, false))
      return
    }

    // Любой режим: ученик отвлёкся/отошёл — напоминаем о вопросе.
    if (
      (fused.engagement === 'distracted' || fused.engagement === 'absent') &&
      now - this.lastReengageMs > REENGAGE_COOLDOWN_MS
    ) {
      this.lastReengageMs = now
      const line = reengagePrompt(this.lang, this.state.getMode())
      const say = this.currentCard ? `${line} ${this.currentCard.speak}` : line
      void this.deliver(this.buildResponse(say, this.currentCard, null, false))
    }
  }

  private buildResponse(
    say: string,
    question: QuestionCard | null,
    verdict: TeacherResponse['verdict'],
    finished: boolean,
  ): TeacherResponse {
    return {
      mode: this.state.getMode(),
      say,
      reasoning: [],
      question,
      verdict,
      topic: this.currentTopic(),
      finished,
    }
  }

  /** Озвучить и отдать реплику наверх. */
  private async deliver(response: TeacherResponse): Promise<void> {
    if (response.say) this.state.pushTurn('tutor', response.say)
    this.cfg.callbacks?.onResponse?.(response)
    if (!response.say) return
    this.busy = true
    try {
      if (this.duplex) {
        await this.duplex.speak(response.say)
      } else {
        await this.cfg.controller.speak(response.say, this.lang)
      }
    } finally {
      this.busy = false
    }
  }

  private currentTopic(): string {
    return this.state.currentTopic() ?? this.cfg.sectionTitle ?? 'chemistry'
  }

  private greeting(): string {
    if (this.lang === 'en') {
      return 'Training mode. I am your chemistry mentor — ask me anything and I will explain it in depth.'
    }
    if (this.lang === 'uz') {
      return 'O‘quv rejimi. Men sizning kimyo murabbiyingizman — istalgan savolni bering, chuqur tushuntiraman.'
    }
    return 'Режим обучения. Я твой наставник по химии — спрашивай что угодно, объясню подробно.'
  }

  private byeLine(): string {
    if (this.lang === 'en') return 'We are done. Well done today.'
    if (this.lang === 'uz') return 'Tugatdik. Bugun yaxshi ishladingiz.'
    return 'На этом закончим. Сегодня ты хорошо поработал.'
  }

  private noQuestionsLine(): string {
    if (this.lang === 'en') return 'There are no questions available for this chapter yet.'
    if (this.lang === 'uz') return 'Bu bob uchun hozircha savollar yo‘q.'
    return 'Для этой главы пока нет вопросов.'
  }

  private allTopicsDoneLine(): string {
    if (this.lang === 'en') return 'We have covered all the topics. Great job.'
    if (this.lang === 'uz') return 'Barcha mavzularni ko‘rib chiqdik. Zo‘r.'
    return 'Мы прошли все темы. Отличная работа.'
  }
}
