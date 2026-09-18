import { useT } from '../../i18n/useT'
import { LearnShellIcon, type LearnShellIconName } from './LearnShellIcon'
import { Kbd, StudioPanelHead } from './studio/StudioKit'
import kit from './studio/StudioKit.module.css'
import styles from '../../pages/LearnPage.module.css'

/**
 * Шапка колонки урока (Lesson Studio): плитка-иконка в тоне панели + название
 * (+ подзаголовок) и кнопки «на весь экран / свернуть» и «скрыть панель».
 * Тон берётся из --studio-tone корня колонки.
 */
export function LearnColumnPanelTools({
  expanded = false,
  label,
  subtitle,
  icon,
  onExpand,
  onHide,
}: {
  expanded?: boolean
  label: string
  subtitle?: string
  icon: LearnShellIconName
  onExpand?: () => void
  onHide?: () => void
}) {
  const { t } = useT()
  const expandTitle = expanded
    ? `${t('learn.panel.collapse')} (Esc)`
    : `${t('learn.panel.fullscreen')} · ${label} (F)`

  const actions =
    onExpand || onHide ? (
      <>
        {onExpand ? (
          <button
            type="button"
            className={expanded ? `${kit.btn} ${styles.learnColExpandOn}` : kit.iconBtn}
            onClick={onExpand}
            aria-pressed={expanded}
            title={expandTitle}
            aria-label={expandTitle}
            data-studio-expand="1"
          >
            <LearnShellIcon name={expanded ? 'minimize' : 'maximize'} size={15} />
            {expanded ? (
              <>
                <span className={styles.learnColExpandLabel}>{t('learn.panel.collapse')}</span>
                <Kbd>Esc</Kbd>
              </>
            ) : null}
          </button>
        ) : null}
        {onHide ? (
          <button
            type="button"
            className={`${kit.iconBtn} ${kit.iconBtnDanger}`}
            onClick={onHide}
            title={t('learn.panel.hide')}
            aria-label={t('learn.panel.hide')}
            data-studio-hide="1"
          >
            <LearnShellIcon name="close" size={15} />
          </button>
        ) : null}
      </>
    ) : undefined

  return (
    <StudioPanelHead
      className={styles.learnColPanelHead}
      icon={icon}
      title={label}
      subtitle={subtitle}
      actions={actions}
    />
  )
}
