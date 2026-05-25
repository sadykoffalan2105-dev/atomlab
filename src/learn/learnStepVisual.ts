import type { LearnStep, LearnTopicArtId, LearnTopicCoreId } from '../types/learn'

/** Для шага без 3D: какой SVG показать (один Canvas на экране — только highlight). */
export function artIdForLessonStep(
  topicCoreId: LearnTopicCoreId,
  step: LearnStep,
  _stepIndex: number,
): LearnTopicArtId | null {
  if (step.type === 'highlightCompound') return null
  if (step.type === 'tryLaboratory') return 'lab_invite'
  return topicCoreId
}
