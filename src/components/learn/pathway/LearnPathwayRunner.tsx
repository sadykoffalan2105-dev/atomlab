import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { learnPathwayById } from '../../../data/learnPathways'
import {
  completePathway,
  markPathwayStepTask,
  pathwayCompletedTaskCount,
  readPathwayProgress,
  setPathwayCurrentStep,
  type PathwayProgress,
} from '../../../learn/learnPathwayProgressStorage'
import type { LearnPathwayStepId } from '../../../types/learnPathway'
import { useT } from '../../../i18n/useT'
import { LearnPathwaySidebar } from './LearnPathwaySidebar'
import { renderPathwayStep } from './LearnPathwaySteps'
import styles from './LearnPathway.module.css'

const STEP_ORDER: LearnPathwayStepId[] = [
  'context',
  'predictions',
  'materials',
  'protocol',
  'results',
  'reflection',
  'summary',
]

export function LearnPathwayRunner() {
  const { pathwayId, stepId: stepParam } = useParams<{ pathwayId: string; stepId?: string }>()
  const navigate = useNavigate()
  const { t } = useT()
  const pathway = pathwayId ? learnPathwayById(pathwayId) : undefined

  const [progress, setProgress] = useState<PathwayProgress>(() =>
    pathwayId ? readPathwayProgress(pathwayId) : { pathwayId: '', currentStep: 'context', steps: {} },
  )

  useEffect(() => {
    if (!pathwayId) return
    setProgress(readPathwayProgress(pathwayId))
  }, [pathwayId])

  const currentStepId: LearnPathwayStepId = useMemo(() => {
    if (stepParam && STEP_ORDER.includes(stepParam as LearnPathwayStepId)) {
      return stepParam as LearnPathwayStepId
    }
    return progress.currentStep
  }, [stepParam, progress.currentStep])

  useEffect(() => {
    if (!pathwayId || !pathway) return
    if (stepParam && STEP_ORDER.includes(stepParam as LearnPathwayStepId)) {
      if (progress.currentStep !== stepParam) {
        const next = setPathwayCurrentStep(pathwayId, stepParam as LearnPathwayStepId)
        setProgress(next)
      }
    } else if (!stepParam) {
      navigate(`/learn/pathway/${pathwayId}/${progress.currentStep}`, { replace: true })
    }
  }, [pathwayId, pathway, stepParam, progress.currentStep, navigate])

  const stepDef = pathway?.steps.find((s) => s.id === currentStepId)
  const stepProgress = progress.steps[currentStepId]
  const doneOnStep = stepProgress?.done ?? 0
  const stepComplete = stepProgress?.completed ?? false
  const doneTasks = pathwayCompletedTaskCount(progress)

  const goStep = useCallback(
    (id: string) => {
      if (!pathwayId) return
      navigate(`/learn/pathway/${pathwayId}/${id}`)
    },
    [navigate, pathwayId],
  )

  const onProgress = useCallback(
    (done: number) => {
      if (!pathwayId || !stepDef) return
      const next = markPathwayStepTask(pathwayId, currentStepId, done, stepDef.taskCount)
      setProgress(next)
      if (currentStepId === 'summary' && done >= 1 && !next.completedAt) {
        setProgress(completePathway(pathwayId))
      }
    },
    [pathwayId, stepDef, currentStepId],
  )

  const stepIndex = STEP_ORDER.indexOf(currentStepId)
  const canNext = stepComplete || (stepDef && doneOnStep >= stepDef.taskCount)

  const onNext = () => {
    if (stepIndex < STEP_ORDER.length - 1) {
      goStep(STEP_ORDER[stepIndex + 1]!)
    } else if (pathwayId) {
      setProgress(completePathway(pathwayId))
    }
  }

  const onPrev = () => {
    if (stepIndex > 0) goStep(STEP_ORDER[stepIndex - 1]!)
  }

  if (!pathway || !pathwayId) {
    return (
      <p className={styles.lead}>
        <Link to="/learn/pathways">{t('learn.pathways.back')}</Link>
      </p>
    )
  }

  return (
    <div
      className={styles.shell}
      style={{ ['--pathway-accent' as string]: pathway.accentColor }}
    >
      <section className={styles.main} aria-labelledby="pathway-step-title">
        <header className={styles.mainHeader}>
          <p className={styles.stepLabel}>
            {t(stepDef?.titleKey ?? 'learn.pathway.step.context')}
          </p>
          <h1 id="pathway-step-title" className={styles.mainTitle}>
            {t(
              currentStepId === 'context'
                ? 'learn.pathway.context.title'
                : currentStepId === 'predictions'
                  ? 'learn.pathway.predictions.title'
                  : currentStepId === 'materials'
                    ? 'learn.pathway.materials.title'
                    : currentStepId === 'protocol'
                      ? 'learn.pathway.protocol.title'
                      : currentStepId === 'results'
                        ? 'learn.pathway.results.title'
                        : currentStepId === 'reflection'
                          ? 'learn.pathway.reflection.title'
                          : 'learn.pathway.summary.title',
            )}
          </h1>
        </header>
        <div className={styles.mainBody}>
          {renderPathwayStep(currentStepId, {
            pathway,
            done: doneOnStep,
            onProgress,
          })}
        </div>
        <footer className={styles.mainFooter}>
          <button
            type="button"
            className={styles.btn}
            onClick={onPrev}
            disabled={stepIndex <= 0}
          >
            {t('learn.pathway.nav.prev')}
          </button>
          {stepIndex < STEP_ORDER.length - 1 ? (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={onNext}
              disabled={!canNext}
            >
              {t('learn.pathway.nav.next')}
            </button>
          ) : (
            <Link className={`${styles.btnPrimary} ${styles.btn}`} to="/learn/pathways">
              {t('learn.pathways.back')}
            </Link>
          )}
        </footer>
      </section>
      <LearnPathwaySidebar
        pathway={pathway}
        progress={progress}
        currentStepId={currentStepId}
        doneTasks={doneTasks}
        onSelectStep={goStep}
      />
    </div>
  )
}
