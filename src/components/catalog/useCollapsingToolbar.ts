import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'

/** Медиазапрос как состояние React (телефонная раскладка каталога и т. п.). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/**
 * «Шторка» фильтров каталога: при прокрутке вниз сворачивается в одну строку, при прокрутке
 * вверх — разворачивается, у верха страницы — всегда развёрнута.
 *
 * Высота панели в потоке не меняется (развёрнутая часть лишь прячется opacity/transform),
 * поэтому карточки под курсором не прыгают.
 *
 * scrollerRef — прокручиваемый контейнер страницы; anchorRef — блок прямо над панелью
 * (по его низу видно, «прилипла» ли она); panelRef — сама липкая панель; fullRef — её
 * развёрнутая часть (пока в ней фокус с клавиатуры/ввод — не сворачиваем).
 */
export function useCollapsingToolbar(
  scrollerRef: RefObject<HTMLElement | null>,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  fullRef: RefObject<HTMLElement | null>,
) {
  const [collapsed, setCollapsed] = useState(false)
  const [stuck, setStuck] = useState(false)
  const collapsedRef = useRef(false)
  collapsedRef.current = collapsed

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    let last = el.scrollTop
    let acc = 0
    let raf = 0
    const tick = () => {
      raf = 0
      const y = el.scrollTop
      const dy = y - last
      last = y
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (!anchor || !panel) return
      const sticky = getComputedStyle(panel).position === 'sticky'
      // верх панели в потоке = низ блока прямо над ней (шапка каталога)
      const naturalTop = anchor.getBoundingClientRect().bottom - el.getBoundingClientRect().top + y
      const isStuck = sticky && y > naturalTop + 20
      setStuck(isStuck)
      if (!isStuck || y <= naturalTop + 40) {
        acc = 0
        setCollapsed(false)
        return
      }
      if (dy > 0) {
        acc = Math.max(0, acc) + dy
        if (acc > 10 && !collapsedRef.current) {
          // пока в развёрнутой панели идёт ввод/выбор с клавиатуры — не прячем её из-под фокуса
          const active = document.activeElement
          if (active && fullRef.current?.contains(active) && active.matches('input, textarea')) return
          setCollapsed(true)
        }
      } else if (dy < 0) {
        acc = Math.min(0, acc) + dy
        if (acc < -40) setCollapsed(false)
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    tick()
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [scrollerRef, anchorRef, panelRef, fullRef])

  const expand = useCallback(() => setCollapsed(false), [])
  const collapse = useCallback(() => setCollapsed(true), [])
  return { collapsed, stuck, expand, collapse }
}
