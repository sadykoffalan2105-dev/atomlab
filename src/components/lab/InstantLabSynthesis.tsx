import { useEffect, useRef } from 'react'

/**
 * Мгновенный синтез: без GSAP.
 * onDone — только после minFrames И готовности продукта (paint/GPU),
 * иначе чёрный/красный кадр при cold compile.
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
  /** Жёсткий потолок ожидания paint (не зависаем навсегда). */
  maxFrames?: number
  /** true когда продукт реально отрисован / GPU готов. */
  isProductReady?: () => boolean
}) {
  const doneRef = useRef(false)

  useEffect(() => {
    doneRef.current = false
    onPhaseChange?.('product', 1)
    let frames = 0
    let raf = 0
    const tick = () => {
      frames += 1
      if (doneRef.current) return
      const ready = isProductReady?.() ?? true
      if (frames >= minFrames && ready) {
        doneRef.current = true
        onDone('success')
        return
      }
      if (frames >= maxFrames) {
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
