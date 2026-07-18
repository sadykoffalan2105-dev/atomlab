/**
 * UnifiedBrain — «супер-мозг» ИИ-преподавателя.
 *
 * Сводит три потока (камера / аудио+STT / лаборатория) в единый контекст,
 * ведёт журнал скрытых мыслей (Reasoning Log) в порядке:
 *   [Оценка ответа] → [Сверка с эмоцией] → [Вовлечённость] → [Лаборатория]
 *   → [Долгосрочная память] → [Выбор стратегии] → [Генерация реплики]
 * и возвращает решение (что и каким тоном сказать, какой наводящий вопрос задать,
 * как изменить сложность). Персистит выводы в долгосрочную память ученика.
 */
import { gradeExamAnswerLocal, gradeExamAnswer, type ExamGradeResult } from '../learnExamGrader'
import { retrieveChemistryKnowledge } from '../learnKnowledgeRetrieval'
import type { AppLocale } from '../../i18n/types'
import {
  type AssistantLang,
  type AudioSignal,
  type BrainDecision,
  type FusedContext,
  type LabSignal,
  type VisionSignal,
} from './brainTypes'
import { ContextGraph } from './contextGraph'
import { ReasoningTrace } from './reasoningTrace'
import { decideStrategy } from './pedagogicalStrategy'
import { composeTutorLine, type PhraseContext } from './brainPhrasing'
import {
  studentMemory,
  StudentMemoryStore,
  type SessionRecord,
  type StudentProfile,
} from './studentMemoryStore'

export interface BrainConfig {
  studentId: string
  lang: AssistantLang
  studentName?: string | null
  memory?: StudentMemoryStore
  /** Пытаться ли оценивать ответ через teacher_service (иначе локально). */
  useAiGrading?: boolean
}

export interface ActiveQuestion {
  question: string
  rubric: string[]
  sampleAnswer?: string
  topic: string
}

export interface AnswerEvaluation {
  grade: ExamGradeResult
  decision: BrainDecision
  missingPoints: string[]
}

type FusedListener = (fused: FusedContext) => void

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Пункты рубрики, которые ученик не раскрыл в ответе. */
function findMissingRubric(answer: string, rubric: readonly string[]): string[] {
  const norm = normalize(answer)
  const missing: string[] = []
  for (const point of rubric) {
    const key = normalize(point)
    if (key.length < 2) continue
    // Совпадением считаем, если хотя бы одно значимое слово пункта прозвучало.
    const words = key.split(' ').filter((w) => w.length >= 4)
    const hit = words.length > 0 ? words.some((w) => norm.includes(w)) : norm.includes(key)
    if (!hit) missing.push(point)
  }
  return missing
}

function stripForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/[#>*_`]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function toAppLocale(lang: AssistantLang): AppLocale {
  return lang as AppLocale
}

export class UnifiedBrain {
  private readonly graph = new ContextGraph()
  private readonly memory: StudentMemoryStore
  private readonly config: BrainConfig
  private profile: StudentProfile | null = null
  private active: ActiveQuestion | null = null
  private consecutiveMisses = 0
  private readonly listeners = new Set<FusedListener>()

  // Метрики сессии для долгосрочной памяти.
  private sessionStartMs = Date.now()
  private attentionSum = 0
  private attentionSamples = 0
  private emotionTally: Record<string, number> = {}
  private highlights: string[] = []

  constructor(config: BrainConfig) {
    this.config = config
    this.memory = config.memory ?? studentMemory
    void this.memory.loadProfile(config.studentId).then((p) => {
      this.profile = p
    })
  }

  /** Подписка UI на обновления сведённого контекста. Возвращает отписку. */
  onFused(listener: FusedListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emitFused(): void {
    if (this.listeners.size === 0) return
    const fused = this.graph.fuse()
    this.attentionSum += fused.attention
    this.attentionSamples += 1
    this.emotionTally[fused.emotion] = (this.emotionTally[fused.emotion] ?? 0) + 1
    for (const l of this.listeners) l(fused)
  }

  ingestVision(sig: VisionSignal): void {
    this.graph.ingestVision(sig)
    this.emitFused()
  }

  ingestAudio(sig: AudioSignal): void {
    this.graph.ingestAudio(sig)
    if (sig.finalTranscript && sig.finalTranscript.length > 12) {
      this.highlights.push(sig.finalTranscript.slice(0, 160))
      if (this.highlights.length > 30) this.highlights.shift()
    }
    this.emitFused()
  }

  ingestLab(sig: LabSignal): void {
    this.graph.ingestLab(sig)
    this.emitFused()
  }

  fusedNow(): FusedContext {
    return this.graph.fuse()
  }

  setActiveQuestion(q: ActiveQuestion): void {
    this.active = q
    this.consecutiveMisses = 0
  }

  private async knowledgeSnippet(topic: string): Promise<string | null> {
    try {
      const { chunks } = retrieveChemistryKnowledge(topic, { maxChunks: 2, minScore: 1 })
      const first = chunks[0]
      if (!first) return null
      const raw = this.config.lang === 'en' ? first.en || first.ru : first.ru
      const clean = stripForSpeech(raw)
      const sentence = clean.split(/(?<=[.!?])\s+/)[0] ?? clean
      return sentence.slice(0, 240)
    } catch {
      return null
    }
  }

  /** Вступительная реплика к текущему вопросу (фаза «задать вопрос»). */
  async askOpening(): Promise<BrainDecision> {
    const q = this.active
    if (!q) throw new Error('UnifiedBrain.askOpening: no active question')
    const trace = new ReasoningTrace()
    const fused = this.graph.fuse()
    trace.add('ingest', `attention=${fused.attention.toFixed(2)}, emotion=${fused.emotion}`, 'сведён контекст перед вопросом')

    const profile = await this.ensureProfile()
    const decision = decideStrategy({ fused, grade: null, profile, consecutiveMisses: 0 })
    // Для открытия вопроса всегда действие ask_question, но тон берём из стратегии.
    const strategy = { ...decision, action: 'ask_question' as const, hintLevel: 0 }
    trace.add('choose_strategy', decision.rationale, `тон=${strategy.tone}, задаём вопрос`)

    const phrase: PhraseContext = {
      lang: this.config.lang,
      question: q.question,
      missingPoints: [],
      knowledgeSnippet: null,
      studentName: this.config.studentName ?? null,
      topic: q.topic,
    }
    const say = stripForSpeech(composeTutorLine(strategy, phrase))
    trace.add('compose', 'реплика-вопрос сформирована', 'готово к озвучке с корректными ударениями')

    return { strategy, say, followUpQuestion: null, reasoning: trace.snapshot(), fused }
  }

  private async ensureProfile(): Promise<StudentProfile> {
    if (this.profile) return this.profile
    this.profile = await this.memory.loadProfile(this.config.studentId)
    return this.profile
  }

  /**
   * Оценить устный ответ ученика и решить, что сказать дальше.
   * Полный мыслительный путь фиксируется в reasoning-трассе.
   */
  async evaluateAnswer(studentAnswer: string): Promise<AnswerEvaluation> {
    const q = this.active
    if (!q) throw new Error('UnifiedBrain.evaluateAnswer: no active question')

    const trace = new ReasoningTrace()
    const locale = toAppLocale(this.config.lang)

    // 1) Оценка устного ответа (сначала быстрая локальная, при желании — ИИ).
    let grade = gradeExamAnswerLocal(studentAnswer, q.rubric, locale)
    if (this.config.useAiGrading) {
      try {
        grade = await gradeExamAnswer({
          question: q.question,
          rubric: q.rubric,
          sampleAnswer: q.sampleAnswer,
          studentAnswer,
          mode: 'oral',
          locale,
          sectionTitle: q.topic,
        })
      } catch {
        /* остаётся локальная оценка */
      }
    }
    const missingPoints = findMissingRubric(studentAnswer, q.rubric)
    trace.add(
      'assess_answer',
      `verdict=${grade.verdict}, score=${grade.score}/2, пропущено пунктов=${missingPoints.length}`,
      grade.verdict === 'correct' ? 'ответ полный' : 'ответ требует докрутки',
    )

    // 2) Сверка с эмоцией/вовлечённостью/лабораторией по камере и графу.
    const fused = this.graph.fuse()
    trace.add('check_emotion', `emotion=${fused.emotion} (${fused.emotionConfidence.toFixed(2)})`, fused.emotion === 'neutral' ? 'эмоция спокойная' : 'эмоция влияет на тон')
    trace.add('check_engagement', `attention=${fused.attention.toFixed(2)}, integrityRisk=${fused.integrityRisk.toFixed(2)}`, fused.engagement)
    trace.add('check_lab', `lab=${fused.labCorrectness ?? 'нет данных'}`, 'учтены действия в лаборатории')

    // 3) Долгосрочная память: обновляем профиль и учитываем пробелы.
    const profile = await this.ensureProfile()
    const ratio = grade.score / 2
    void this.memory.updateMastery(this.config.studentId, q.topic, ratio)
    if (grade.verdict !== 'correct') this.consecutiveMisses += 1
    else this.consecutiveMisses = 0
    if (grade.verdict === 'incorrect' && missingPoints[0]) {
      void this.memory.addMisconception(this.config.studentId, q.topic, missingPoints[0])
    }
    void this.memory.updateRapport(this.config.studentId, {
      engagement: fused.attention,
      attention: fused.attention,
      frustrationSpike: fused.emotion === 'frustrated',
    })
    trace.add('recall_memory', `sensitivity=${profile.rapport.sensitivity.toFixed(2)}, misses=${this.consecutiveMisses}`, 'персонализация тона и подсказки')

    // 4) Выбор педагогической стратегии.
    const decision = decideStrategy({ fused, grade, profile, consecutiveMisses: this.consecutiveMisses })
    trace.add('choose_strategy', decision.rationale, `action=${decision.action}, tone=${decision.tone}, hint=${decision.hintLevel}`)

    // 5) Генерация реплики (при необходимости с опорой на базу знаний).
    const knowledgeSnippet = decision.action === 'explain' ? await this.knowledgeSnippet(q.topic) : null
    const phrase: PhraseContext = {
      lang: this.config.lang,
      question: q.question,
      missingPoints,
      knowledgeSnippet,
      studentName: this.config.studentName ?? null,
      topic: q.topic,
    }
    const say = stripForSpeech(composeTutorLine(decision, phrase))
    const followUpQuestion =
      decision.action === 'give_hint' || decision.action === 'explain' ? say : null
    trace.add('compose', `сформирована реплика (${decision.verbosity})`, 'готово к озвучке')

    const brainDecision: BrainDecision = {
      strategy: decision,
      say,
      followUpQuestion,
      reasoning: trace.snapshot(),
      fused,
    }
    return { grade, decision: brainDecision, missingPoints }
  }

  /** Завершить сессию: сохранить сводку в долгосрочную память. */
  async endSession(topic: string, score: number | null): Promise<void> {
    const avgAttention = this.attentionSamples > 0 ? this.attentionSum / this.attentionSamples : 0.7
    let dominant: keyof typeof this.emotionTally = 'neutral'
    let best = -1
    for (const [emotion, count] of Object.entries(this.emotionTally)) {
      if (count > best) {
        best = count
        dominant = emotion
      }
    }
    const record: SessionRecord = {
      id: `${this.config.studentId}-${this.sessionStartMs}`,
      studentId: this.config.studentId,
      startedMs: this.sessionStartMs,
      endedMs: Date.now(),
      topic,
      transcriptHighlights: this.highlights.slice(-8),
      avgAttention,
      dominantEmotion: (dominant as SessionRecord['dominantEmotion']) ?? 'neutral',
      score,
    }
    await this.memory.recordSession(record)
  }

  reset(): void {
    this.graph.reset()
    this.consecutiveMisses = 0
    this.sessionStartMs = Date.now()
    this.attentionSum = 0
    this.attentionSamples = 0
    this.emotionTally = {}
    this.highlights = []
  }
}
