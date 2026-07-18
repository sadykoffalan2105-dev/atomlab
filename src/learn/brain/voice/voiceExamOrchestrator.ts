/**
 * Voice Exam Orchestrator — «Голосовое тестирование по химии».
 *
 * Сценарий одного вопроса:
 *   ИИ устно задаёт вопрос → слушает ответ (STT) → мозг оценивает и сверяет с
 *   эмоцией/вовлечённостью по камере → если ошибка/сомнение, на лету генерирует
 *   корректирующий наводящий вопрос и слушает снова → фиксирует лучший балл →
 *   переходит к следующему вопросу.
 *
 * Барджин ученика мгновенно обрабатывается duplex-сессией: ИИ замолкает и
 * пересчитывает ответ по новой реплике.
 */
import type { ExamGradeResult } from '../../learnExamGrader'
import type { AssistantLang, ReasoningStepSnapshot } from '../brainTypes'
import type { LearnSpeechController } from '../../learnSpeech'
import type { UnifiedBrain } from '../unifiedBrain'
import { DuplexVoiceSession } from './duplexVoiceSession'
import type { DialogTurn } from './interruptionController'

export interface VoiceExamQuestion {
  id: string
  question: string
  display?: string
  rubric: string[]
  sampleAnswer?: string
  topic: string
}

export interface VoiceExamCallbacks {
  onQuestionChange?: (index: number, q: VoiceExamQuestion) => void
  onReasoning?: (steps: ReasoningStepSnapshot[]) => void
  onTutorText?: (text: string) => void
  onPartial?: (text: string) => void
  onGrade?: (index: number, grade: ExamGradeResult) => void
  onTurnChange?: (turn: DialogTurn) => void
  onAiSpeakingChange?: (speaking: boolean) => void
  onComplete?: (summary: VoiceExamSummary) => void
}

export interface VoiceExamSummary {
  totalScore: number
  maxScore: number
  perQuestion: number[]
}

export interface VoiceExamConfig {
  brain: UnifiedBrain
  controller: LearnSpeechController
  lang: AssistantLang
  questions: VoiceExamQuestion[]
  maxFollowUpsPerQuestion?: number
  bargeInEnabled?: boolean
  callbacks?: VoiceExamCallbacks
}

export class VoiceExamOrchestrator {
  private readonly brain: UnifiedBrain
  private readonly questions: VoiceExamQuestion[]
  private readonly maxFollowUps: number
  private readonly callbacks: VoiceExamCallbacks
  private readonly session: DuplexVoiceSession

  private index = 0
  private followUps = 0
  private running = false
  private busy = false
  private readonly bestScore: number[]

  constructor(config: VoiceExamConfig) {
    this.brain = config.brain
    this.questions = config.questions
    this.maxFollowUps = config.maxFollowUpsPerQuestion ?? 2
    this.callbacks = config.callbacks ?? {}
    this.bestScore = new Array(this.questions.length).fill(0)
    this.session = new DuplexVoiceSession({
      lang: config.lang,
      controller: config.controller,
      bargeInEnabled: config.bargeInEnabled ?? true,
      onPartial: (text) => this.callbacks.onPartial?.(text),
      onUserUtterance: (text) => void this.handleUserUtterance(text),
      onTurnChange: (turn) => this.callbacks.onTurnChange?.(turn),
      onAiSpeakingChange: (s) => this.callbacks.onAiSpeakingChange?.(s),
    })
  }

  /** Запустить голосовой опрос на потоке микрофона. */
  async start(micStream: MediaStream): Promise<void> {
    if (this.running || this.questions.length === 0) return
    this.running = true
    this.index = 0
    this.followUps = 0
    await this.session.begin(micStream)
    await this.askCurrent()
  }

  private currentQuestion(): VoiceExamQuestion | null {
    return this.questions[this.index] ?? null
  }

  private async askCurrent(): Promise<void> {
    const q = this.currentQuestion()
    if (!q) return this.finish()
    this.followUps = 0
    this.brain.setActiveQuestion({
      question: q.question,
      rubric: q.rubric,
      sampleAnswer: q.sampleAnswer,
      topic: q.topic,
    })
    this.callbacks.onQuestionChange?.(this.index, q)

    const opening = await this.brain.askOpening()
    this.callbacks.onReasoning?.(opening.reasoning)
    this.callbacks.onTutorText?.(opening.say)
    await this.session.speak(opening.say)
  }

  /** Обработать финальную реплику ученика. */
  private async handleUserUtterance(text: string): Promise<void> {
    if (!this.running || this.busy) return
    const q = this.currentQuestion()
    if (!q) return
    this.busy = true
    this.session.markThinking()

    try {
      const evaluation = await this.brain.evaluateAnswer(text)
      this.callbacks.onReasoning?.(evaluation.decision.reasoning)
      this.callbacks.onGrade?.(this.index, evaluation.grade)
      this.bestScore[this.index] = Math.max(this.bestScore[this.index]!, evaluation.grade.score)
      this.callbacks.onTutorText?.(evaluation.decision.say)

      const passed = evaluation.grade.verdict === 'correct'
      const exhausted = this.followUps >= this.maxFollowUps

      if (passed || exhausted) {
        await this.session.speak(evaluation.decision.say)
        this.advance()
      } else {
        this.followUps += 1
        // Наводящий/корректирующий вопрос — остаёмся на том же вопросе.
        await this.session.speak(evaluation.decision.followUpQuestion ?? evaluation.decision.say)
      }
    } finally {
      this.busy = false
    }
  }

  private advance(): void {
    this.index += 1
    if (this.index >= this.questions.length) {
      void this.finish()
      return
    }
    void this.askCurrent()
  }

  private async finish(): Promise<void> {
    if (!this.running) return
    this.running = false
    const totalScore = this.bestScore.reduce((s, v) => s + v, 0)
    const maxScore = this.questions.length * 2
    await this.brain.endSession(this.questions[0]?.topic ?? 'chemistry', totalScore)
    this.session.end()
    this.callbacks.onComplete?.({ totalScore, maxScore, perQuestion: [...this.bestScore] })
  }

  /** Принудительно завершить опрос (кнопка «Закрыть»). */
  stop(): void {
    this.running = false
    this.busy = false
    this.session.end()
  }

  /** Текстовый ввод как альтернатива голосу (fallback UI). */
  submitText(text: string): void {
    void this.handleUserUtterance(text)
  }

  getIndex(): number {
    return this.index
  }
}
