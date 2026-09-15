import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

type DialogFocusOptions = { initialFocus?: RefObject<HTMLElement | null>; trap?: boolean }

/**
 * Фокус модального окна (aria-modal): при открытии переносит фокус внутрь,
 * Tab/Shift+Tab не уходят за окно, при закрытии фокус возвращается туда, откуда открыли.
 *
 * Два способа вызова:
 * - `const ref = useDialogFocus(open)` — хук сам создаёт ref для карточки окна;
 * - `useDialogFocus(open, dialogRef, { initialFocus, trap })` — ref передаётся снаружи.
 * `initialFocus` — элемент для первого фокуса (иначе первый фокусируемый, иначе само окно).
 * `trap=false` — только перенос/возврат фокуса (немодальные панели).
 */
export function useDialogFocus<T extends HTMLElement = HTMLDivElement>(open: boolean): RefObject<T | null>
export function useDialogFocus(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  opts?: DialogFocusOptions,
): RefObject<HTMLElement | null>
export function useDialogFocus(
  open: boolean,
  dialogRef?: RefObject<HTMLElement | null>,
  opts?: DialogFocusOptions,
): RefObject<HTMLElement | null> {
  const ownRef = useRef<HTMLElement | null>(null)
  const ref = dialogRef ?? ownRef
  const initialFocus = opts?.initialFocus
  const trap = opts?.trap ?? true

  useEffect(() => {
    if (!open) return
    const dialog = ref.current
    if (!dialog) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const raf = requestAnimationFrame(() => {
      if (dialog.contains(document.activeElement)) return
      const target =
        initialFocus?.current ??
        [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].find(isVisible) ??
        (dialog.tabIndex >= -1 ? dialog : null)
      target?.focus({ preventScroll: true })
    })

    const onKey = (e: KeyboardEvent) => {
      if (!trap || e.key !== 'Tab') return
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isVisible)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]!
      const last = items[items.length - 1]!
      const active = document.activeElement
      if (!dialog.contains(active) || active === dialog) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      const active = document.activeElement
      // Закрытие делает окно inert или размонтирует его — фокус падает на body; возвращаем его открывшей кнопке.
      if (
        opener &&
        opener.isConnected &&
        !dialog.contains(opener) &&
        (!active || active === document.body || dialog.contains(active))
      ) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [open, ref, initialFocus, trap])

  return ref
}
