import { useT } from '../../i18n/useT'
import { LearnShellIcon } from './LearnShellIcon'
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
  const title = expanded ? t('learn.panel.collapse') : `${t('learn.panel.fullscreen')} · ${label}`

  return (
    <button
      type="button"
      className={expanded ? styles.learnColExpandOn : styles.learnColExpand}
      onClick={onClick}
      aria-pressed={expanded}
      title={title}
    >
      <LearnShellIcon name={expanded ? 'minimize' : 'maximize'} size={15} />
      <span className={styles.learnColExpandLabel}>
        {expanded ? t('learn.panel.collapse') : label}
      </span>
    </button>
  )
}
