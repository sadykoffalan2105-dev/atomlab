import { compoundById } from '../../data/compounds'
import { artIdForLessonStep } from '../../learn/learnStepVisual'
import type { LearnStep, LearnTopicCoreId } from '../../types/learn'
import { renderTopicArt } from './topicArt/TopicArts'
import styles from '../../pages/LearnPage.module.css'

export function StepVisualPanel({
  topicId,
  totemCompoundId,
  step,
  stepIndex,
  variant,
}: {
  topicId: string
  totemCompoundId: string
  step: LearnStep
  stepIndex: number
  variant: 'compact' | 'hero'
}) {
  if (step.type === 'highlightCompound') return null
  const accent = compoundById[totemCompoundId]?.accentColor ?? '#3dffec'
  const artId = artIdForLessonStep(topicId as LearnTopicCoreId, step, stepIndex)
  if (!artId) return null
  return (
    <div className={styles.stepVisualWrap} aria-hidden>
      {renderTopicArt(artId, { accent, variant })}
    </div>
  )
}
