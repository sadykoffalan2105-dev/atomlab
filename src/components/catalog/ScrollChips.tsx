import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import styles from './ScrollChips.module.css'

/**
 * Ряд чипов с горизонтальной прокруткой (каталог: «Семейство», «Тема»).
 * Колесо мыши крутит ряд вбок, пока есть куда; полосы прокрутки нет —
 * вместо неё стрелки-подсказки по краям, когда за краем есть продолжение.
 * Стрелки — только для мыши (aria-hidden, без Tab): с клавиатуры чипы
 * сами въезжают в видимую часть при фокусе.
 */
export function ScrollChips({
  ariaLabel,
  className,
  children,
}: {
  ariaLabel: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState<{ left: boolean; right: boolean }>({ left: false, right: false })

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const left = el.scrollLeft > 2
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    setEdges((p) => (p.left === left && p.right === right ? p : { left, right }))
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const mo = new MutationObserver(measure)
    mo.observe(el, { childList: true, subtree: true, characterData: true })
    el.addEventListener('scroll', measure, { passive: true })
    // React вешает onWheel пассивным — preventDefault там не работает, поэтому слушатель свой
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (delta === 0 || el.scrollWidth <= el.clientWidth + 1) return
      const max = el.scrollWidth - el.clientWidth
      const canMove = delta > 0 ? el.scrollLeft < max - 1 : el.scrollLeft > 1
      if (!canMove) return // ряд упёрся в край — дальше крутится страница
      e.preventDefault()
      const px = e.deltaMode === 1 ? delta * 32 : e.deltaMode === 2 ? delta * el.clientWidth : delta
      el.scrollLeft += px
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      ro.disconnect()
      mo.disconnect()
      el.removeEventListener('scroll', measure)
      el.removeEventListener('wheel', onWheel)
    }
  }, [measure])

  const nudge = (dir: -1 | 1) => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.7), behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className={styles.wrap} data-left={edges.left || undefined} data-right={edges.right || undefined}>
      <div
        ref={ref}
        className={className ? `${styles.scroller} ${className}` : styles.scroller}
        role="group"
        aria-label={ariaLabel}
      >
        {children}
      </div>
      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowLeft}`}
        tabIndex={-1}
        aria-hidden
        onClick={() => nudge(-1)}
      >
        ‹
      </button>
      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowRight}`}
        tabIndex={-1}
        aria-hidden
        onClick={() => nudge(1)}
      >
        ›
      </button>
    </div>
  )
}
