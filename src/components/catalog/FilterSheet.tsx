import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import styles from './FilterSheet.module.css'

/**
 * Выезжающая снизу панель фильтров каталога (телефон). Открывается кнопкой «Фильтры»,
 * закрывается крестиком, фоном, Esc или кнопкой «Показать N». Фокус — внутрь при открытии
 * и обратно на кнопку при закрытии.
 */
export function FilterSheet({
  open,
  onClose,
  title,
  closeLabel,
  returnFocusRef,
  footer,
  children,
  id,
}: {
  open: boolean
  onClose: () => void
  title: string
  closeLabel: string
  returnFocusRef?: RefObject<HTMLElement | null>
  footer?: ReactNode
  children: ReactNode
  id?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus({ preventScroll: true })
    const back = returnFocusRef?.current ?? null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      // фокус не уходит из панели под затемнение
      const nodes = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), input, [tabindex]:not([tabindex="-1"])',
      )
      if (nodes.length === 0) return
      const first = nodes[0]!
      const last = nodes[nodes.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      back?.focus({ preventScroll: true })
    }
  }, [open, onClose, returnFocusRef])

  if (!open) return null

  return (
    <div className={styles.root}>
      <div className={styles.scrim} onClick={onClose} aria-hidden />
      <div ref={panelRef} id={id} className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.handle} aria-hidden />
        <header className={styles.head}>
          <h2 className={styles.title}>{title}</h2>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label={closeLabel}>
            ×
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer ? <footer className={styles.foot}>{footer}</footer> : null}
      </div>
    </div>
  )
}
