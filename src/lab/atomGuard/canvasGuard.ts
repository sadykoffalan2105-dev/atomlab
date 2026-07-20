import { useEffect, useRef, type RefObject } from 'react'
import { LAB_CANVAS_MIN_HEIGHT_VH } from '../labRenderGuards'

export function ensureCanvasMinSize(el: HTMLElement | null): void {
  if (!el) return
  const minH = Math.max(200, (window.innerHeight * LAB_CANVAS_MIN_HEIGHT_VH) / 100)
  if (el.clientHeight < minH) {
    el.style.minHeight = `${minH}px`
  }
}

/** ResizeObserver: не даём Canvas схлопнуться в 0×0 (белый экран / битая иконка). */
export function useCanvasSizeGuard(containerRef: RefObject<HTMLElement | null>): void {
  const roRef = useRef<ResizeObserver | null>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const syncCanvas = () => {
      ensureCanvasMinSize(el)
      const canvas = el.querySelector('canvas')
      if (!canvas) {
        window.dispatchEvent(new Event('resize'))
        return
      }
      const tooSmall = canvas.clientWidth < 8 || canvas.clientHeight < 8
      const parent = canvas.parentElement
      const parentOk = parent != null && parent.clientWidth >= 8 && parent.clientHeight >= 8
      if (tooSmall && parentOk) {
        // Явно подтянуть размер до следующего R3F measure.
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        window.dispatchEvent(new Event('resize'))
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
      } else if (tooSmall) {
        window.dispatchEvent(new Event('resize'))
      }
    }
    syncCanvas()
    roRef.current = new ResizeObserver(syncCanvas)
    roRef.current.observe(el)
    // Реактор снизу меняет clearance — тоже перемерить холст.
    const wrap = el.closest('[data-lab-synthesis-view]') ?? el.parentElement
    if (wrap && wrap !== el) roRef.current.observe(wrap)
    return () => roRef.current?.disconnect()
  }, [containerRef])
}
