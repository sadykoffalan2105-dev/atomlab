import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useT } from '../../../i18n/useT'
import { LearnShellIcon } from '../LearnShellIcon'
import { Kbd } from './StudioKit'
import kit from './StudioKit.module.css'
import { StudioWorkspaceArt } from './StudioWorkspaceArt'
import {
  STUDIO_WORKSPACES,
  STUDIO_WORKSPACE_DESC,
  STUDIO_WORKSPACE_KEY,
  STUDIO_WORKSPACE_LABEL,
  STUDIO_WORKSPACE_BY_KEY,
  workspaceToneStyle,
  type StudioWorkspace,
} from './studioWorkspaces'
import { isEditableTarget } from './useStudioShortcuts'
import styles from './StudioWorkspaceChooser.module.css'

/**
 * Экран выбора рабочего пространства урока: три большие карточки
 * (Обучение · Интерактивная доска · ИИ-учитель) с живым артом.
 * Клавиши 1/2/3 — выбрать, стрелки — перевести фокус, Esc — оставить текущее.
 */
export function StudioWorkspaceChooser({
  lessonTitle,
  badge,
  current,
  onPick,
  onClose,
}: {
  lessonTitle: string
  badge?: string | null
  current: StudioWorkspace | null
  onPick: (ws: StudioWorkspace) => void
  /** Есть только когда пространство уже выбрано — «оставить как было». */
  onClose?: () => void
}) {
  const { t } = useT()
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const start = current ? STUDIO_WORKSPACES.indexOf(current) : 0
    cardRefs.current[start < 0 ? 0 : start]?.focus()
  }, [current])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (isEditableTarget(e.target)) return
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        e.preventDefault()
        onPick(STUDIO_WORKSPACE_BY_KEY[e.key])
      } else if (e.key === 'Escape' && onClose) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPick])

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
        <div className={styles.head}>
          <p className={styles.kicker}>
            {badge ? <span>{badge}</span> : null}
            <span>{lessonTitle}</span>
          </p>
          <h1 className={styles.title}>{t('learn.studio.ws.title')}</h1>
          <p className={styles.lead}>{t('learn.studio.ws.lead')}</p>
        </div>
        <div className={styles.grid}>
          {STUDIO_WORKSPACES.map((ws, i) => (
            <button
              key={ws}
              type="button"
              ref={(el) => {
                cardRefs.current[i] = el
              }}
              className={current === ws ? `${styles.card} ${styles.cardCurrent}` : styles.card}
              style={workspaceToneStyle(ws)}
              onClick={() => onPick(ws)}
              onKeyDown={(e) => onCardKeyDown(e, i)}
              aria-current={current === ws ? 'true' : undefined}
              data-studio-ws-card={ws}
            >
              <span className={styles.artWrap}>
                <StudioWorkspaceArt ws={ws} className={styles.art} />
              </span>
              <span className={styles.cardBody}>
                <span className={styles.cardTitleRow}>
                  <span className={kit.iconTile} aria-hidden="true">
                    <LearnShellIcon name={ws === 'teach' ? 'layout' : ws === 'board' ? 'board' : 'sparkles'} size={16} />
                  </span>
                  <span className={styles.cardTitle}>{t(STUDIO_WORKSPACE_LABEL[ws])}</span>
                </span>
                <span className={styles.cardDesc}>{t(STUDIO_WORKSPACE_DESC[ws])}</span>
                <span className={styles.cardFoot}>
                  <span className={styles.cardKbd}>
                    <Kbd>{STUDIO_WORKSPACE_KEY[ws]}</Kbd>
                    <span>{current === ws ? t('learn.studio.ws.current') : t('learn.studio.ws.open')}</span>
                  </span>
                  <span className={styles.cardGo}>
                    <span>{t('learn.studio.ws.go')}</span>
                    <LearnShellIcon name="arrowRight" size={15} />
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className={styles.foot}>
          {onClose ? (
            <button type="button" className={kit.btn} onClick={onClose}>
              <LearnShellIcon name="arrowLeft" size={15} />
              <span>{t('learn.studio.ws.keep')}</span>
              <Kbd>Esc</Kbd>
            </button>
          ) : null}
          <p className={styles.footHint}>{t('learn.studio.ws.footHint')}</p>
        </div>
      </div>
    </div>
  )
}
