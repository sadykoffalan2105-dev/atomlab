import type { LearnTaskGenerated } from './learnTaskProblems'

/** Контекст задачи для ИИ-коуча — без правильного ответа и индекса варианта. */
export type LearnTaskCoachContext = {
  categoryId: string
  categoryTitle: string
  problemKind: 'numeric' | 'mcq'
  questionText: string
  answerLabel?: string
  params?: Record<string, string | number>
  /** Варианты ответа (MCQ) — только текст, без пометки верного */
  choiceLabels?: string[]
  staticHintsRevealed: number
  aiHintsGiven: number
  feedback: 'idle' | 'wrong' | 'correct'
  userAttempt?: string
  scratchpad?: string
  /** Задача-опыт в 3D-лаборатории: id, журнал показаний приборов («m(Zn) = 1,31 г»), текущий шаг опыта. */
  labTaskId?: string
  labMeasurements?: string[]
  currentStep?: string
}

export function buildTaskCoachContext(
  problem: LearnTaskGenerated,
  meta: {
    categoryId: string
    categoryTitle: string
    questionText: string
    answerLabel?: string
    staticHintsRevealed: number
    aiHintsGiven: number
    feedback: 'idle' | 'wrong' | 'correct'
    userAttempt?: string
    scratchpad?: string
    choiceLabels?: string[]
    labTaskId?: string
    labMeasurements?: string[]
    currentStep?: string
  },
): LearnTaskCoachContext {
  return {
    categoryId: meta.categoryId,
    categoryTitle: meta.categoryTitle,
    problemKind: problem.kind,
    questionText: meta.questionText,
    answerLabel: meta.answerLabel,
    params: problem.kind === 'numeric' ? (problem.params as Record<string, string | number>) : undefined,
    choiceLabels: meta.choiceLabels,
    staticHintsRevealed: meta.staticHintsRevealed,
    aiHintsGiven: meta.aiHintsGiven,
    feedback: meta.feedback,
    userAttempt: meta.userAttempt,
    scratchpad: meta.scratchpad,
    labTaskId: meta.labTaskId,
    labMeasurements: meta.labMeasurements,
    currentStep: meta.currentStep,
  }
}
