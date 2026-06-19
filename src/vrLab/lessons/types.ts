export type LessonPhase = 'theory' | 'quiz' | 'practice' | 'complete'

export type VrLabQuizQuestion = {
  id: string
  promptKey: string
  options: Array<{ id: string; labelKey: string; correct?: boolean }>
  explanationKey: string
}

export type VrLabLessonModule = {
  id: string
  titleKey: string
  grade: 7 | 8 | 9
  reactionIds: string[]
  theoryKeys: string[]
  safetyKeys: string[]
  quiz: VrLabQuizQuestion[]
  practiceMissionKey: string
  compounds: [string, string]
}

export type LessonProgress = {
  lessonId: string
  theoryDone: boolean
  quizScore: number
  quizPassed: boolean
  practiceDone: boolean
  /** Выполненные curated-реакции в рамках урока. */
  completedReactionIds: string[]
  completedAt?: string
}
