import { useCallback, useEffect, useRef } from 'react'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { getSynthesisWatchdogMs } from '../synthesisGuarantee'

type RunPayload = {
  flyTerms: readonly ReactorEquationTerm[]
  zSlots: readonly number[]
  onForceComplete: () => void
}

/** Watchdog + cleanup для одного запуска синтеза. */
export class SynthesisRunController {
  private timer: ReturnType<typeof setTimeout> | null = null

  start(payload: RunPayload): void {
    this.clear()
    const ms = getSynthesisWatchdogMs(payload.flyTerms, payload.zSlots)
    this.timer = setTimeout(() => {
      payload.onForceComplete()
    }, ms)
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}

export function useSynthesisRunController(): SynthesisRunController {
  const ref = useRef<SynthesisRunController | null>(null)
  if (!ref.current) ref.current = new SynthesisRunController()
  return ref.current
}

export function useSynthesisWatchdog(
  active: boolean,
  flyTerms: readonly ReactorEquationTerm[] | null,
  zSlots: readonly number[] | null,
  onForceComplete: () => void,
): void {
  const ctrl = useSynthesisRunController()
  const onForce = useCallback(onForceComplete, [onForceComplete])

  useEffect(() => {
    if (!active || !flyTerms?.length || !zSlots?.length) {
      ctrl.clear()
      return
    }
    ctrl.start({ flyTerms, zSlots, onForceComplete: onForce })
    return () => ctrl.clear()
  }, [active, flyTerms, zSlots, onForce, ctrl])
}
