import { useT } from '../../i18n/useT'
import styles from '../../pages/LearnPage.module.css'

export function LearnColumnPanelTools({
  expanded,
  label,
  onExpand,
  onHide,
}: {
  expanded: boolean
  label: string
  onExpand: () => void
  onHide: () => void
}) {
  const { t } = useT()
  const expandTitle = expanded
    ? t('learn.panel.collapse')
    : `${t('learn.panel.fullscreen')} · ${label}`

  return (
    <div className={styles.learnColPanelTools} role="toolbar" aria-label={label}>
      <button
        type="button"
        className={styles.learnColHide}
        onClick={onHide}
        title={t('learn.panel.hide')}
        aria-label={t('learn.panel.hide')}
      >
        ×
      </button>
      <button
        type="button"
        className={expanded ? styles.learnColExpandOn : styles.learnColExpand}
        onClick={onExpand}
        aria-pressed={expanded}
        title={expandTitle}
        aria-label={expandTitle}
      >
        {expanded ? t('learn.panel.collapse') : '⛶'}
        {!expanded ? <span className={styles.learnColExpandLabel}>{label}</span> : null}
      </button>
    </div>
  )
}
