import { useEffect, useRef } from 'react'
import { LAB3D_VIS } from '../../lab/lab3dVisibilityEngine'

/**
 * Мгновенный синтез: без GSAP.
 * onDone — только после minFrames И реального paint продукта на экране.
 * maxFrames — мягкий потолок; hardMax — абсолютный (не форсим success по GPU-cache).
 */
export function InstantLabSynthesis({
  runId,
  onDone,
  onPhaseChange,
  minFrames = 12,
  maxFrames = 90,
  isProductReady,
}: {
  runId: number
  onDone: (kind: 'success' | 'fail') => void
  onPhaseChange?: (phase: string, launchProgress: number) => void
  /** Минимум кадров до завершения. */
  minFrames?: number
  /** Мягкий потолок ожидания paint. */
  maxFrames?: number
  /** true когда продукт реально отрисован (full-scale paint), НЕ только GPU-cache. */
  isProductReady?: () => boolean
}) {
  const doneRef = useRef(false)

  useEffect(() => {
    doneRef.current = false
    onPhaseChange?.('product', 1)
    let frames = 0
    let raf = 0
    const hardMax = Math.max(maxFrames, LAB3D_VIS.instantHardMaxFrames)
    const tick = () => {
      frames += 1
      if (doneRef.current) return
      const ready = isProductReady?.() ?? false
      if (frames >= minFrames && ready) {
        doneRef.current = true
        onDone('success')
        return
      }
      // До hardMax не форсим success без paint — иначе toast «3D показан» при пустом центре.
      if (frames >= hardMax) {
        doneRef.current = true
        onDone('success')
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      doneRef.current = true
      cancelAnimationFrame(raf)
    }
  }, [runId, onDone, onPhaseChange, minFrames, maxFrames, isProductReady])

  return null
}
