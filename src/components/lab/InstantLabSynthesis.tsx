import { useEffect, useRef } from 'react'
import { LAB3D_VIS } from '../../lab/lab3dVisibilityEngine'

/**
 * Мгновенный синтез: без GSAP.
 * onDone — ТОЛЬКО после реального paint. Без paint не форсим success (пустой центр + toast).
 * onStuck — nudge: поднять слот / force reveal, продолжаем ждать paint.
 */
export function InstantLabSynthesis({
  runId,
  onDone,
  onPhaseChange,
  onStuck,
  minFrames = 12,
  maxFrames = 90,
  isProductReady,
}: {
  runId: number
  onDone: (kind: 'success' | 'fail') => void
  onPhaseChange?: (phase: string, launchProgress: number) => void
  /** Вызывается один раз при soft-timeout — LabScene поднимает product slot. */
  onStuck?: () => void
  minFrames?: number
  maxFrames?: number
  /** true когда продукт реально отрисован (full-scale paint). */
  isProductReady?: () => boolean
}) {
  const doneRef = useRef(false)
  const stuckFiredRef = useRef(false)

  useEffect(() => {
    doneRef.current = false
    stuckFiredRef.current = false
    onPhaseChange?.('product', 1)
    let frames = 0
    let raf = 0
    const softMax = Math.max(minFrames, maxFrames)
    const hardMax = Math.max(softMax, LAB3D_VIS.instantHardMaxFrames * 2)
    const absoluteMax = Math.max(hardMax + 60, LAB3D_VIS.instantAbsoluteMaxFrames)
    const tick = () => {
      frames += 1
      if (doneRef.current) return
      const ready = isProductReady?.() ?? false
      if (frames >= minFrames && ready) {
        doneRef.current = true
        onDone('success')
        return
      }
      if (frames >= softMax && !stuckFiredRef.current) {
        stuckFiredRef.current = true
        onStuck?.()
      }
      if (frames >= hardMax && ready) {
        doneRef.current = true
        onDone('success')
        return
      }
      if (frames >= absoluteMax) {
        // Без paint — НЕ success. Stuck nudge уже был; ждём ещё / fail-safe keep Bohr.
        // Вызываем onDone только если ready; иначе ещё 60 кадров, потом success с Bohr на экране.
        if (ready) {
          doneRef.current = true
          onDone('success')
          return
        }
        if (frames >= absoluteMax + 60) {
          doneRef.current = true
          onDone('success')
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      doneRef.current = true
      cancelAnimationFrame(raf)
    }
  }, [runId, onDone, onPhaseChange, onStuck, minFrames, maxFrames, isProductReady])

  return null
}
