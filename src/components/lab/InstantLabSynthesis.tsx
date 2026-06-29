import { useEffect, useRef } from 'react'

/**
 * Мгновенный синтез лаборатории: без GSAP, полёта, вспышек.
 * Показываем продукт через LabProductHeroSlot, завершаем run за 2–3 кадра.
 */
export function InstantLabSynthesis({
  runId,
  onDone,
  onPhaseChange,
}: {
  runId: number
  onDone: (kind: 'success' | 'fail') => void
  onPhaseChange?: (phase: string, launchProgress: number) => void
}) {
  const doneRef = useRef(false)

  useEffect(() => {
    doneRef.current = false
    onPhaseChange?.('product', 1)
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (doneRef.current) return
        doneRef.current = true
        onDone('success')
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [runId, onDone, onPhaseChange])

  return null
}
