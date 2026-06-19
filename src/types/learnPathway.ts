import type { MessageKey } from '../i18n/messagesRu'

/** Шаг интерактивного лабораторного пути (формат LabXchange / pathway). */
export type LearnPathwayStepId =
  | 'context'
  | 'predictions'
  | 'materials'
  | 'protocol'
  | 'results'
  | 'reflection'
  | 'summary'

export type LearnPathwayStepDef = {
  id: LearnPathwayStepId
  /** Сколько подпунктов нужно выполнить на шаге */
  taskCount: number
  titleKey: MessageKey
}

export type LearnPathwayKind = 'reactor' | 'vr'

export type LearnPathwayDef = {
  id: string
  titleKey: MessageKey
  leadKey: MessageKey
  accentColor: string
  gradeId: string
  chapterId: string
  sectionId: string
  productCompoundId: string
  equationUnicode: string
  steps: readonly LearnPathwayStepDef[]
  estimatedMin: number
  /** reactor — классический реактор; vr — VR 3D лаборатория */
  kind?: LearnPathwayKind
  vrLessonId?: string
  vrReactionId?: string
}
