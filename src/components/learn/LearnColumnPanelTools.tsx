import { useT } from '../../i18n/useT'
import { LearnShellIcon, type LearnShellIconName } from './LearnShellIcon'
import styles from '../../pages/LearnPage.module.css'

/**
 * Шапка колонки урока: иконка + название панели и (опционально) кнопки
 * «на весь экран / свернуть» и «скрыть панель».
 */
export function LearnColumnPanelTools({
  expanded = false,
  label,
  icon,
  onExpand,
  onHide,
}: {
  expanded?: boolean
  label: string
  icon: LearnShellIconName
  onExpand?: () => void
  onHide?: () => void
}) {
  const { t } = useT()
  const expandTitle = expanded
    ? t('learn.panel.collapse')
    : `${t('learn.panel.fullscreen')} · ${label}`

  return (
    <div className={styles.learnColPanelHead}>
      <span className={styles.learnColPanelIcon} aria-hidden="true">
        <LearnShellIcon name={icon} size={15} />
      </span>
      <span className={styles.learnColPanelTitle}>{label}</span>
      {onExpand || onHide ? (
        <div className={styles.learnColPanelTools} role="toolbar" aria-label={label}>
          {onExpand ? (
            <button
              type="button"
              className={expanded ? styles.learnColExpandOn : styles.learnColExpand}
              onClick={onExpand}
              aria-pressed={expanded}
              title={expandTitle}
              aria-label={expandTitle}
            >
              <LearnShellIcon name={expanded ? 'minimize' : 'maximize'} size={15} />
              {expanded ? (
                <span className={styles.learnColExpandLabel}>{t('learn.panel.collapse')}</span>
              ) : null}
            </button>
          ) : null}
          {onHide ? (
            <button
              type="button"
              className={styles.learnColHide}
              onClick={onHide}
              title={t('learn.panel.hide')}
              aria-label={t('learn.panel.hide')}
            >
              <LearnShellIcon name="close" size={15} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
