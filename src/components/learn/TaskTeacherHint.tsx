import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LearnTaskGenerated } from '../../learn/learnTaskProblems'
import { buildTaskTeacherHints } from '../../learn/taskTeacherHints'
import { useT, type MessageKey } from '../../i18n/useT'
import styles from './TaskTeacherHint.module.css'

type Props = {
  problem: LearnTaskGenerated
  disabled?: boolean
  onHintUsed?: (count: number) => void
}

export function TaskTeacherHint({ problem, disabled, onHintUsed }: Props) {
  const { t } = useT()
  const steps = useMemo(() => buildTaskTeacherHints(problem), [problem])
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    setVisibleCount(0)
  }, [problem])

  const revealNext = useCallback(() => {
    if (disabled || visibleCount >= steps.length) return
    const next = visibleCount + 1
    setVisibleCount(next)
    onHintUsed?.(next)
  }, [disabled, onHintUsed, steps.length, visibleCount])

  const visible = steps.slice(0, visibleCount)
  const atLast = visibleCount >= steps.length
  const canReveal = !disabled && !atLast

  return (
    <aside className={styles.panel} aria-label={t('learn.task.teacherHint')}>
      <header className={styles.head}>
        <span className={styles.icon} aria-hidden>
          🎓
        </span>
        <div>
          <h3 className={styles.title}>{t('learn.task.teacherHint')}</h3>
          <p className={styles.lead}>{t('learn.task.teacherHintLead')}</p>
        </div>
      </header>

      {visible.length > 0 ? (
        <ol className={styles.steps}>
          {visible.map((step) => (
            <li key={step.step} className={styles.step}>
              <span className={styles.stepBadge}>
                {t('learn.task.teacherHintStep', { step: String(step.step) })}
              </span>
              <p className={styles.stepText}>
                {t(step.textKey as MessageKey, step.params as Record<string, string | number>)}
              </p>
            </li>
          ))}
        </ol>
      ) : null}

      <footer className={styles.foot}>
        {canReveal ? (
          <button type="button" className={styles.btn} onClick={revealNext}>
            {visibleCount === 0 ? t('learn.task.teacherHint') : t('learn.task.teacherHintMore')}
          </button>
        ) : null}
        {atLast && visibleCount > 0 ? (
          <p className={styles.lastNote}>{t('learn.task.teacherHintLast')}</p>
        ) : visibleCount > 0 && canReveal ? (
          <p className={styles.hintFoot}>{t('learn.task.teacherHintFoot')}</p>
        ) : null}
      </footer>
    </aside>
  )
}
