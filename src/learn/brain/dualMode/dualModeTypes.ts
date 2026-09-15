/**
 * Двухрежимный разум ИИ-преподавателя — контракты состояний и персон.
 *
 * Режим 1 «Обучение» (training): профессор-ментор, даёт полные объяснения,
 *   примеры, аналогии, исторические факты, проактивно спрашивает «понятно?».
 * Режим 2 «Экзамен» (exam): строгий экзаменатор, НИКОГДА не выдаёт ответ,
 *   ведёт сократовский диалог наводящими вопросами.
 */
import type { ExamGradeVerdict } from '../../learnExamGrader'
import type { AssistantLang, ReasoningStepSnapshot, TutorTone } from '../brainTypes'

export type TutorMode = 'training' | 'exam'

/** Политика ответов: можно ли раскрывать решение. */
export type AnswerPolicy = 'full_answers' | 'no_answers'

export interface TutorPersona {
  mode: TutorMode
  answerPolicy: AnswerPolicy
  baseTone: TutorTone
  /** Сам спрашивает «понятно?» при признаках замешательства (только обучение). */
  proactiveClarify: boolean
  /** Разрешено раскрывать правильное решение. */
  revealsSolutions: boolean
  nameRu: string
  nameEn: string
  nameUz: string
}

/** Распознанное намерение из речи ученика. */
export type VoiceIntent =
  | { kind: 'answer'; text: string }
  | { kind: 'next_question' }
  | { kind: 'next_topic' }
  | { kind: 'explain'; text: string }
  | { kind: 'repeat' }
  | { kind: 'switch_mode'; target: TutorMode }
  | { kind: 'stop' }
  /** «Стоп/подожди» — замолчать и слушать, урок продолжается. */
  | { kind: 'hush' }

/** Карточка вопроса, которую «ведёт» экзаменатор. */
export interface QuestionCard {
  id: string
  topic: string
  speak: string
  display: string
  rubric: string[]
  sampleAnswer?: string
  difficulty: number
}

/** Единый ответ преподавателя для UI и озвучки. */
export interface TeacherResponse {
  mode: TutorMode
  /** Полный текст для чата. */
  say: string
  /** Укороченный текст только для TTS (если нет — озвучивается say). */
  saySpeak?: string
  reasoning: ReasoningStepSnapshot[]
  question: QuestionCard | null
  verdict: ExamGradeVerdict | null
  topic: string
  /** Экзамен/тема завершены. */
  finished: boolean
  /** Номер реплики учителя (совпадает с черновиком при стриминге). */
  turnId?: number
  /** Откуда ответ: «умный ИИ», локальная база, служебная фраза. */
  source?: TeacherReplyOrigin
  /** Источники знаний (подписи вида «[Kimyo 8, §2, стр. 10]»). */
  citations?: string[]
}

export type TeacherReplyOrigin = 'smart' | 'local' | 'system'

/** Задержки одного хода живого диалога (мс). */
export interface LiveTurnMetrics {
  turnId: number
  inputKind: 'voice' | 'text' | 'command'
  commitReason?: string
  /** Конец речи ученика (VAD) → коммит реплики. */
  speechEndToCommitMs: number | null
  /** Коммит/отправка → первая готовая фраза ответа. */
  commitToFirstSentenceMs: number | null
  /** Коммит/отправка → первый звук учителя. */
  commitToFirstAudioMs: number | null
  /** Конец речи ученика → первый звук (главная метрика «живости»). */
  speechEndToFirstAudioMs: number | null
  knowledgeMs: number | null
  firstTokenMs: number | null
  totalMs: number | null
  source: TeacherReplyOrigin
  fellBack: boolean
}

/** Реплика ученика в очереди (для UI «в очереди»). */
export interface QueuedStudentTurn {
  id: number
  kind: 'voice' | 'text' | 'command'
  text: string
  label: string
}

export type { AssistantLang }
