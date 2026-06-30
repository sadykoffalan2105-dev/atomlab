import { useEffect, useRef, type RefObject } from 'react'
import { LAB_CANVAS_MIN_HEIGHT_VH } from '../labRenderGuards'

export function ensureCanvasMinSize(el: HTMLElement | null): void {
  if (!el) return
  const minH = Math.max(200, (window.innerHeight * LAB_CANVAS_MIN_HEIGHT_VH) / 100)
  if (el.clientHeight < minH) {
    el.style.minHeight = `${minH}px`
  }
}

/** ResizeObserver: не даём Canvas схлопнуться в 0×0 (чёрный экран). */
export function useCanvasSizeGuard(containerRef: RefObject<HTMLElement | null>): void {
  const roRef = useRef<ResizeObserver | null>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const syncCanvas = () => {
      ensureCanvasMinSize(el)
      const canvas = el.querySelector('canvas')
      if (canvas && (canvas.clientWidth < 8 || canvas.clientHeight < 8)) {
        window.dispatchEvent(new Event('resize'))
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
      }
    }
    syncCanvas()
    roRef.current = new ResizeObserver(syncCanvas)
    roRef.current.observe(el)
    return () => roRef.current?.disconnect()
  }, [containerRef])
}
