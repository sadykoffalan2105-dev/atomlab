import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Модальный диалог: при открытии фокус в карточку, Tab/Shift+Tab не выходят
 * за её пределы (aria-modal), при закрытии фокус возвращается туда, где был.
 */
export function useDialogFocus<T extends HTMLElement = HTMLDivElement>(isOpen: boolean) {
  const cardRef = useRef<T>(null)

  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cardRef.current?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const card = cardRef.current
      if (!card) return
      const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      )
      if (items.length === 0) {
        e.preventDefault()
        card.focus({ preventScroll: true })
        return
      }
      const first = items[0]!
      const last = items[items.length - 1]!
      const active = document.activeElement
      const inside = active instanceof Node && card.contains(active)
      if (e.shiftKey) {
        if (!inside || active === first || active === card) {
          e.preventDefault()
          last.focus()
        }
      } else if (!inside || active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true })
    }
  }, [isOpen])

  return cardRef
}
