import { useEffect, useRef } from 'react'

/**
 * Мгновенный синтез: без GSAP. onDone — только после кадров отрисовки продукта.
 */
export function InstantLabSynthesis({
  runId,
  onDone,
  onPhaseChange,
  minFrames = 10,
}: {
  runId: number
  onDone: (kind: 'success' | 'fail') => void
  onPhaseChange?: (phase: string, launchProgress: number) => void
  /** Минимум кадров до завершения — продукт успевает отрисоваться (нет чёрного экрана). */
  minFrames?: number
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
      if (frames >= minFrames) {
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
  }, [runId, onDone, onPhaseChange, minFrames])

  return null
}
