import { useEffect, useRef, type RefObject } from 'react'
import { LAB_CANVAS_MIN_HEIGHT_VH } from '../labRenderGuards'
import { debugSessionLog } from '../debugSessionLog'

export function ensureCanvasMinSize(el: HTMLElement | null): void {
  if (!el) return
  const minH = Math.max(200, (window.innerHeight * LAB_CANVAS_MIN_HEIGHT_VH) / 100)
  if (el.clientHeight < minH) {
    el.style.minHeight = `${minH}px`
  }
}

/** ResizeObserver: не даём Canvas схлопнуться в 0×0 (белый экран). */
export function useCanvasSizeGuard(containerRef: RefObject<HTMLElement | null>): void {
  const roRef = useRef<ResizeObserver | null>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const syncCanvas = () => {
      ensureCanvasMinSize(el)
      const canvas = el.querySelector('canvas')
      if (canvas && (canvas.clientWidth < 8 || canvas.clientHeight < 8)) {
        // #region agent log
        debugSessionLog(
          'canvasGuard.ts:zeroSize',
          'canvas element collapsed',
          { w: canvas.clientWidth, h: canvas.clientHeight, wrapW: el.clientWidth, wrapH: el.clientHeight },
          'H-A',
        )
        // #endregion
      }
    }
    syncCanvas()
    roRef.current = new ResizeObserver(syncCanvas)
    roRef.current.observe(el)
    return () => roRef.current?.disconnect()
  }, [containerRef])
}
