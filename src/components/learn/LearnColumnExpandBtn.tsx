import { useT } from '../../i18n/useT'
import styles from '../../pages/LearnPage.module.css'

export function LearnColumnExpandBtn({
  expanded,
  label,
  onClick,
}: {
  expanded: boolean
  label: string
  onClick: () => void
}) {
  const { t } = useT()

  return (
    <button
      type="button"
      className={expanded ? styles.learnColExpandOn : styles.learnColExpand}
      onClick={onClick}
      aria-pressed={expanded}
      title={expanded ? t('learn.panel.collapse') : t('learn.panel.fullscreen')}
    >
      {expanded ? t('learn.panel.collapse') : '⛶'}
      <span className={styles.learnColExpandLabel}>{expanded ? '' : label}</span>
    </button>
  )
}
