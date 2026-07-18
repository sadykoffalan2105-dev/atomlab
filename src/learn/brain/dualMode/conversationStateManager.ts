/**
 * Conversation State Manager — память текущего диалога.
 *
 * Хранит: текущий режим, активную тему и очередь тем, прогресс по каждой теме
 * (какие вопросы «завалены», какие освоены, попытки, mastery), адаптивную
 * сложность и историю реплик. Это «рабочая память» на одну сессию (в отличие от
 * долгосрочной StudentMemoryStore).
 */
import type { ExamGradeVerdict } from '../../learnExamGrader'
import type { TutorMode } from './dualModeTypes'

export interface TopicProgress {
  topic: string
  askedIds: string[]
  failedIds: string[]
  knownIds: string[]
  attempts: number
  correct: number
  /** Освоение темы 0..1. */
  mastery: number
}

export interface ConversationSnapshot {
  mode: TutorMode
  topic: string | null
  topicIndex: number
  totalTopics: number
  difficulty: number
  progress: TopicProgress[]
}

interface Turn {
  role: 'student' | 'tutor'
  content: string
  atMs: number
}

const MIN_DIFFICULTY = 1
const MAX_DIFFICULTY = 5

function clampDifficulty(x: number): number {
  return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, x))
}

export class ConversationStateManager {
  private mode: TutorMode
  private topics: string[]
  private topicIndex = 0
  private difficulty = 2
  private readonly progress = new Map<string, TopicProgress>()
  private readonly turns: Turn[] = []

  constructor(initialMode: TutorMode, topics: string[] = []) {
    this.mode = initialMode
    this.topics = [...topics]
  }

  getMode(): TutorMode {
    return this.mode
  }

  setMode(mode: TutorMode): void {
    this.mode = mode
  }

  setTopics(topics: string[]): void {
    this.topics = [...topics]
    this.topicIndex = 0
  }

  currentTopic(): string | null {
    return this.topics[this.topicIndex] ?? null
  }

  nextTopic(): string | null {
    if (this.topicIndex < this.topics.length - 1) {
      this.topicIndex += 1
      return this.currentTopic()
    }
    return null
  }

  getDifficulty(): number {
    return this.difficulty
  }

  private ensure(topic: string): TopicProgress {
    let p = this.progress.get(topic)
    if (!p) {
      p = { topic, askedIds: [], failedIds: [], knownIds: [], attempts: 0, correct: 0, mastery: 0.5 }
      this.progress.set(topic, p)
    }
    return p
  }

  markAsked(topic: string, questionId: string): void {
    const p = this.ensure(topic)
    if (!p.askedIds.includes(questionId)) p.askedIds.push(questionId)
  }

  isAsked(topic: string, questionId: string): boolean {
    return this.progress.get(topic)?.askedIds.includes(questionId) ?? false
  }

  /** Учесть результат ответа: обновить прогресс, mastery и адаптивную сложность. */
  recordResult(topic: string, questionId: string, verdict: ExamGradeVerdict): void {
    const p = this.ensure(topic)
    p.attempts += 1
    const value = verdict === 'correct' ? 1 : verdict === 'partial' ? 0.5 : 0
    p.mastery = p.mastery * 0.6 + value * 0.4

    if (verdict === 'correct') {
      p.correct += 1
      if (!p.knownIds.includes(questionId)) p.knownIds.push(questionId)
      p.failedIds = p.failedIds.filter((id) => id !== questionId)
      this.difficulty = clampDifficulty(this.difficulty + 1)
    } else if (verdict === 'incorrect') {
      if (!p.failedIds.includes(questionId)) p.failedIds.push(questionId)
      this.difficulty = clampDifficulty(this.difficulty - 1)
    }
  }

  /** Проблемные зоны темы — заваленные и ещё не восстановленные вопросы. */
  problemZones(topic: string): string[] {
    const p = this.progress.get(topic)
    if (!p) return []
    return p.failedIds.filter((id) => !p.knownIds.includes(id))
  }

  pushTurn(role: Turn['role'], content: string): void {
    const clean = content.trim()
    if (!clean) return
    this.turns.push({ role, content: clean, atMs: Date.now() })
    if (this.turns.length > 60) this.turns.shift()
  }

  /** История в формате для LLM/логики (последние N реплик). */
  history(limit = 8): { role: string; content: string }[] {
    return this.turns.slice(-limit).map((t) => ({
      role: t.role === 'student' ? 'user' : 'assistant',
      content: t.content,
    }))
  }

  snapshot(): ConversationSnapshot {
    return {
      mode: this.mode,
      topic: this.currentTopic(),
      topicIndex: this.topicIndex,
      totalTopics: this.topics.length,
      difficulty: this.difficulty,
      progress: [...this.progress.values()].map((p) => ({ ...p })),
    }
  }
}
