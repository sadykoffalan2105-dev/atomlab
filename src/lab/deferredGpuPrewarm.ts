import { useEffect, useRef, useState } from 'react'

/** Пауза после intent / конца burst — только потом GPU-prewarm (не блокирует превью). */
export const GPU_PREWARM_STABLE_MS = 800

/**
 * true только если условия стабильны ≥ GPU_PREWARM_STABLE_MS (баланс, idle, не burst).
 */
export function useStableGpuPrewarmGate(
  enabled: boolean,
  resetKey: string,
): boolean {
  const [stable, setStable] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setStable(false)
    if (!enabled) return

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setStable(true)
    }, GPU_PREWARM_STABLE_MS)

    return () => {
      if (timerRef.current != null) clearTimeout(timerRef.current)
    }
  }, [enabled, resetKey])

  return stable
}
