import { useCallback, useRef } from 'react'

const SYNTH_PHASES = new Set([
  'ignite',
  'converge',
  'flying',
  'mergeFlash',
  'product',
  'failBounce',
  'settled',
])

/** Колбэки фаз синтеза: смена фазы — сразу, progress внутри фазы — с throttle. */
export function useThrottledPhaseCallback(
  onPhase?: (phase: string, progress: number) => void,
  minIntervalMs = 120,
): (phase: string, progress: number) => void {
  const lastRef = useRef(0)
  const phaseRef = useRef('')

  return useCallback(
    (phase: string, progress: number) => {
      if (!onPhase) return
      const now = performance.now()
      const phaseChanged = phase !== phaseRef.current

      if (phaseChanged) {
        phaseRef.current = phase
        lastRef.current = now
        onPhase(phase, progress)
        return
      }

      if (SYNTH_PHASES.has(phase) && now - lastRef.current < minIntervalMs) {
        return
      }

      if (now - lastRef.current >= minIntervalMs) {
        lastRef.current = now
        onPhase(phase, progress)
      }
    },
    [onPhase, minIntervalMs],
  )
}
