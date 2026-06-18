import type { LearnPathwayDef } from '../../../types/learnPathway'
import type { PathwayProgress } from '../../../learn/learnPathwayProgressStorage'
import { pathwayTotalTasks } from '../../../data/learnPathways'
import { useT } from '../../../i18n/useT'
import styles from './LearnPathwaySidebar.module.css'

type Props = {
  pathway: LearnPathwayDef
  progress: PathwayProgress
  currentStepId: string
  doneTasks: number
  onSelectStep: (stepId: string) => void
}

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 22
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(1, pct))
  return (
    <svg className={styles.ring} viewBox="0 0 52 52" aria-hidden>
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(120,140,180,0.25)" strokeWidth="5" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="29" textAnchor="middle" fontSize="11" fontWeight="800" fill="#e8eef8">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}

export function LearnPathwaySidebar({
  pathway,
  progress,
  currentStepId,
  doneTasks,
  onSelectStep,
}: Props) {
  const { t } = useT()
  const total = pathwayTotalTasks(pathway)
  const pct = total > 0 ? doneTasks / total : 0

  return (
    <aside
      className={styles.sidebar}
      style={{ ['--pathway-accent' as string]: pathway.accentColor }}
      aria-label={t('learn.pathway.sidebar.title')}
    >
      <div className={styles.header}>
        <p className={styles.title}>{t('learn.pathway.sidebar.title')}</p>
        <h2 className={styles.pathTitle}>{t(pathway.titleKey)}</h2>
        <div className={styles.ringRow}>
          <ProgressRing pct={pct} color={pathway.accentColor} />
          <span className={styles.ringText}>
            {t('learn.pathway.sidebar.tasks', { done: doneTasks, total })}
          </span>
        </div>
      </div>
      <ol className={styles.stepList}>
        {pathway.steps.map((step, idx) => {
          const st = progress.steps[step.id]
          const done = st?.done ?? 0
          const completed = st?.completed ?? false
          const active = step.id === currentStepId
          const btnClass = active
            ? styles.stepBtnActive
            : completed
              ? styles.stepBtnDone
              : styles.stepBtn
          return (
            <li key={step.id}>
              <button
                type="button"
                className={btnClass}
                onClick={() => onSelectStep(step.id)}
                aria-current={active ? 'step' : undefined}
              >
                <span className={styles.stepNum}>{completed ? '✓' : idx + 1}</span>
                <span>{t(step.titleKey)}</span>
                <span className={styles.stepTasks}>
                  {done}/{step.taskCount}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
