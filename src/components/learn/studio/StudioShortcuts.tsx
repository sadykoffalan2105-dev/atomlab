import { useEffect, useRef } from 'react'
import { useT } from '../../../i18n/useT'
import { LearnShellIcon } from '../LearnShellIcon'
import { Kbd } from './StudioKit'
import kit from './StudioKit.module.css'
import styles from './StudioShell.module.css'

/** Кнопка «?» с всплывающей подсказкой по горячим клавишам студии. */
export function StudioShortcutsButton({
  open,
  onToggle,
  onClose,
}: {
  open: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const { t } = useT()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, onClose])

  const rows: { keys: string[]; text: string }[] = [
    { keys: ['1', '2', '3'], text: t('learn.studio.shortcut.panels') },
    { keys: ['B'], text: t('learn.present.on') },
    { keys: ['F'], text: t('learn.studio.shortcut.fullscreen') },
    { keys: ['Esc'], text: t('learn.studio.shortcut.escape') },
    { keys: ['←', '→'], text: t('learn.studio.shortcut.resize') },
    { keys: ['?'], text: t('learn.studio.shortcut.help') },
  ]

  return (
    <div className={styles.helpWrap} ref={wrapRef}>
      <button
        type="button"
        className={`${kit.iconBtn} ${styles.helpBtn}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={t('learn.studio.shortcuts')}
        aria-label={t('learn.studio.shortcuts')}
      >
        ?
      </button>
      {open ? (
        <div className={styles.helpPop} role="dialog" aria-label={t('learn.studio.shortcuts')} data-studio-shortcuts="1">
          <p className={styles.helpTitle}>
            <LearnShellIcon name="keyboard" size={16} />
            {t('learn.studio.shortcuts')}
          </p>
          <ul className={styles.helpList}>
            {rows.map((r) => (
              <li key={r.text} className={styles.helpRow}>
                <span className={styles.helpKeys}>
                  {r.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
                <span className={styles.helpText}>{r.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
