import { useLayoutEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'

/**
 * В модалке каталога контейнер часто получает размер после первого кадра / при scroll;
 * без явного setSize холст остаётся 0×0 → белый/чёрный прямоугольник.
 * useLayoutEffect — синхронизация до paint (без белой вспышки при settled).
 */
export function CatalogCanvasResizeSync({ touchDpr = true }: { touchDpr?: boolean }) {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const setDpr = useThree((s) => s.setDpr)
  const timerRef = useRef(0)

  useLayoutEffect(() => {
    const canvas = gl.domElement
    const parent = canvas.parentElement
    if (!parent) return

    const sync = () => {
      const w = Math.max(2, Math.floor(parent.clientWidth))
      const h = Math.max(2, Math.floor(parent.clientHeight))
      if (touchDpr) {
        setDpr(Math.min(window.devicePixelRatio || 1, 1.75))
      }
      gl.setSize(w, h, false)
      invalidate()
    }

    const scheduleSync = () => {
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(sync, 32)
    }

    sync()

    const ro = new ResizeObserver(() => scheduleSync())
    ro.observe(parent)
    window.addEventListener('resize', scheduleSync)

    return () => {
      window.clearTimeout(timerRef.current)
      ro.disconnect()
      window.removeEventListener('resize', scheduleSync)
    }
  }, [gl, invalidate, setDpr, touchDpr])

  return null
}
