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
}

export type { AssistantLang }
