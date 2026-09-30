import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useT } from '../../../i18n/useT'
import { LearnShellIcon } from '../LearnShellIcon'
import {
  FOCUS_MODE_DESC,
  STUDIO_WORKSPACES,
  STUDIO_WORKSPACE_BY_KEY,
  STUDIO_WORKSPACE_ICON,
  STUDIO_WORKSPACE_KEY,
  STUDIO_WORKSPACE_LABEL,
  type StudioWorkspace,
} from './studioWorkspaces'
import { isEditableTarget } from './useStudioShortcuts'
import styles from './StudioWorkspaceChooser.module.css'

/**
 * Окно «Как проведём урок?» — три крупные понятные опции (иконка, название,
 * одна строка) и «Запомнить выбор». Клавиши 1/2/3 — выбрать, стрелки — фокус,
 * Esc — закрыть (если режим уже выбран).
 */
export function StudioWorkspaceChooser({
  lessonTitle,
  badge,
  current,
  remembered,
  onPick,
  onClose,
}: {
  lessonTitle: string
  badge?: string | null
  current: StudioWorkspace | null
  /** Режим уже запомнен для всех уроков — галочка стоит. */
  remembered: boolean
  onPick: (ws: StudioWorkspace, remember: boolean) => void
  /** Есть только когда режим уже выбран — «оставить как было». */
  onClose?: () => void
}) {
  const { t } = useT()
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [remember, setRemember] = useState(remembered)
  const rememberId = useId()
  const highlighted: StudioWorkspace = current ?? 'teach'

  useEffect(() => {
    const start = STUDIO_WORKSPACES.indexOf(highlighted)
    cardRefs.current[start < 0 ? 0 : start]?.focus()
  }, [highlighted])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (isEditableTarget(e.target)) return
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        e.preventDefault()
        onPick(STUDIO_WORKSPACE_BY_KEY[e.key], remember)
      } else if (e.key === 'Escape' && onClose) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPick, remember])

  const onCardKeyDown = useCallback((e: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const n = STUDIO_WORKSPACES.length
    cardRefs.current[(i + dir + n) % n]?.focus()
  }, [])

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t('learn.studio.ws.title')} data-studio-chooser="1">
      <div className={styles.dialog}>
        {onClose ? (
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('learn.studio.close')} title={t('learn.studio.close')}>
            <LearnShellIcon name="close" size={18} />
          </button>
        ) : null}
        <p className={styles.kicker}>
          {badge ? <span className={styles.kickerBadge}>{badge}</span> : null}
          <span className={styles.kickerText}>{lessonTitle}</span>
        </p>
        <h1 className={styles.title}>{t('learn.studio.ws.title')}</h1>
        <div className={styles.list}>
          {STUDIO_WORKSPACES.map((ws, i) => {
            const on = highlighted === ws
            return (
              <button
                key={ws}
                type="button"
                ref={(el) => {
                  cardRefs.current[i] = el
                }}
                className={on ? `${styles.option} ${styles.optionOn}` : styles.option}
                onClick={() => onPick(ws, remember)}
                onKeyDown={(e) => onCardKeyDown(e, i)}
                aria-current={current === ws ? 'true' : undefined}
                data-studio-ws-card={ws}
              >
                <span className={styles.optionIcon} aria-hidden="true">
                  <LearnShellIcon name={STUDIO_WORKSPACE_ICON[ws]} size={22} />
                </span>
                <span className={styles.optionText}>
                  <span className={styles.optionTitle}>{t(STUDIO_WORKSPACE_LABEL[ws])}</span>
                  <span className={styles.optionDesc}>{t(FOCUS_MODE_DESC[ws])}</span>
                </span>
                <span className={styles.optionKey} aria-hidden="true">
                  {STUDIO_WORKSPACE_KEY[ws]}
                </span>
                <span className={styles.optionGo} aria-hidden="true">
                  <LearnShellIcon name="arrowRight" size={18} />
                </span>
              </button>
            )
          })}
        </div>
        <label className={styles.remember} htmlFor={rememberId}>
          <input
            id={rememberId}
            type="checkbox"
            className={styles.rememberBox}
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            data-studio-remember="1"
          />
          <span className={styles.rememberText}>
            <span className={styles.rememberTitle}>{t('learn.focus.chooser.remember')}</span>
            <span className={styles.rememberHint}>{t('learn.focus.chooser.rememberHint')}</span>
          </span>
        </label>
        <p className={styles.keys}>{t('learn.focus.chooser.keys')}</p>
      </div>
    </div>
  )
}
