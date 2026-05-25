import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

/**
 * В модалке каталога контейнер часто получает размер после первого кадра / при scroll;
 * без явного setSize холст остаётся 0×0 → «чёрный прямоугольник».
 */
export function CatalogCanvasResizeSync() {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const setDpr = useThree((s) => s.setDpr)

  useEffect(() => {
    const canvas = gl.domElement
    const parent = canvas.parentElement
    if (!parent) return

    const sync = () => {
      const w = Math.max(2, Math.floor(parent.clientWidth))
      const h = Math.max(2, Math.floor(parent.clientHeight))
      setDpr(Math.min(window.devicePixelRatio || 1, 1.75))
      gl.setSize(w, h, false)
      invalidate()
    }

    sync()
    const raf0 = requestAnimationFrame(sync)
    const raf1 = requestAnimationFrame(sync)

    const ro = new ResizeObserver(() => sync())
    ro.observe(parent)
    window.addEventListener('resize', sync)

    return () => {
      cancelAnimationFrame(raf0)
      cancelAnimationFrame(raf1)
      ro.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [gl, invalidate, setDpr])

  return null
}
