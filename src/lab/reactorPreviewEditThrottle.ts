import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'

const THROTTLE_MS = 80
const BURST_WINDOW_MS = 420
const BURST_MIN_CHANGES = 2
const SETTLE_MS = 140

function termsSignature(terms: readonly ReactorEquationTerm[] | null): string {
  if (!terms?.length) return ''
  return terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|')
}

/**
 * UI коэффициентов — мгновенно; 3D-превью — с coalescing при серии +/- .
 * Первое появление термов и закрытие реактора — без задержки (нет пустого кадра).
 */
export function useThrottledReactorPreviewTerms(immediate: readonly ReactorEquationTerm[] | null): {
  termsFor3d: readonly ReactorEquationTerm[] | null
  coeffEditBurst: boolean
  flushPreviewTerms: () => void
} {
  const sig = useMemo(() => termsSignature(immediate), [immediate])
  const [termsFor3d, setTermsFor3d] = useState(immediate)
  const [coeffEditBurst, setCoeffEditBurst] = useState(false)
  const latestRef = useRef(immediate)
  const hadTermsRef = useRef(immediate != null && immediate.length > 0)
  const throttleTimerRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const changeTimesRef = useRef<number[]>([])

  latestRef.current = immediate

  const clearTimers = useCallback(() => {
    if (throttleTimerRef.current != null) {
      clearTimeout(throttleTimerRef.current)
      throttleTimerRef.current = null
    }
    if (settleTimerRef.current != null) {
      clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
  }, [])

  const flushPreviewTerms = useCallback(() => {
    clearTimers()
    setTermsFor3d(latestRef.current)
    setCoeffEditBurst(false)
    changeTimesRef.current = []
  }, [clearTimers])

  useEffect(() => {
    if (immediate == null || immediate.length === 0) {
      hadTermsRef.current = false
      clearTimers()
      setTermsFor3d(immediate)
      setCoeffEditBurst(false)
      changeTimesRef.current = []
      return
    }

    if (!hadTermsRef.current) {
      hadTermsRef.current = true
      setTermsFor3d(immediate)
      return
    }

    const now = performance.now()
    changeTimesRef.current.push(now)
    changeTimesRef.current = changeTimesRef.current.filter((t) => now - t < BURST_WINDOW_MS)
    setCoeffEditBurst(changeTimesRef.current.length >= BURST_MIN_CHANGES)

    if (settleTimerRef.current != null) clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null
      setCoeffEditBurst(false)
      changeTimesRef.current = []
      setTermsFor3d(latestRef.current)
    }, SETTLE_MS)

    if (throttleTimerRef.current != null) return
    throttleTimerRef.current = window.setTimeout(() => {
      throttleTimerRef.current = null
      setTermsFor3d(latestRef.current)
    }, THROTTLE_MS)
  }, [sig, immediate, clearTimers])

  useEffect(() => () => clearTimers(), [clearTimers])

  return { termsFor3d, coeffEditBurst, flushPreviewTerms }
}
