import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'

const BURST_WINDOW_MS = 480
const BURST_MIN_CHANGES = 2
const BURST_HOLD_MS = 960
const EDIT_IDLE_MS = 520

function termsSignature(terms: readonly ReactorEquationTerm[] | null): string {
  if (!terms?.length) return ''
  return terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|')
}

/**
 * Сигнал быстрого +/- (burst) и паузы после редактирования (editIdle).
 * 3D-термы передаются в Canvas сразу — без отдельного throttled state.
 */
export function useReactorCoeffEditBurst(
  terms: readonly ReactorEquationTerm[] | null,
): {
  coeffEditBurst: boolean
  editIdle: boolean
  resetEditBurst: () => void
} {
  const sig = useMemo(() => termsSignature(terms), [terms])
  const [coeffEditBurst, setCoeffEditBurst] = useState(false)
  const [editIdle, setEditIdle] = useState(true)
  const changeTimesRef = useRef<number[]>([])
  const burstHoldUntilRef = useRef(0)
  const idleTimerRef = useRef<number | null>(null)
  const burstEndTimerRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    if (burstEndTimerRef.current != null) {
      clearTimeout(burstEndTimerRef.current)
      burstEndTimerRef.current = null
    }
  }, [])

  const resetEditBurst = useCallback(() => {
    clearTimers()
    setCoeffEditBurst(false)
    setEditIdle(true)
    changeTimesRef.current = []
    burstHoldUntilRef.current = 0
  }, [clearTimers])

  const scheduleIdle = useCallback(() => {
    if (idleTimerRef.current != null) clearTimeout(idleTimerRef.current)
    setEditIdle(false)
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null
      setEditIdle(true)
    }, EDIT_IDLE_MS)
  }, [])

  const scheduleBurstEnd = useCallback(() => {
    if (burstEndTimerRef.current != null) clearTimeout(burstEndTimerRef.current)
    burstEndTimerRef.current = window.setTimeout(() => {
      burstEndTimerRef.current = null
      const now = performance.now()
      if (now < burstHoldUntilRef.current) {
        scheduleBurstEnd()
        return
      }
      setCoeffEditBurst(false)
      changeTimesRef.current = []
    }, EDIT_IDLE_MS)
  }, [])

  useEffect(() => {
    if (terms == null || terms.length === 0) {
      resetEditBurst()
      return
    }

    const now = performance.now()
    changeTimesRef.current.push(now)
    changeTimesRef.current = changeTimesRef.current.filter((t) => now - t < BURST_WINDOW_MS)
    if (changeTimesRef.current.length >= BURST_MIN_CHANGES) {
      burstHoldUntilRef.current = Math.max(burstHoldUntilRef.current, now + BURST_HOLD_MS)
      setCoeffEditBurst(true)
    }
    scheduleIdle()
    scheduleBurstEnd()
  }, [sig, terms, resetEditBurst, scheduleIdle, scheduleBurstEnd])

  useEffect(() => () => clearTimers(), [clearTimers])

  return { coeffEditBurst, editIdle, resetEditBurst }
}

/** @deprecated Используйте useReactorCoeffEditBurst */
export function useThrottledReactorPreviewTerms(immediate: readonly ReactorEquationTerm[] | null) {
  const { coeffEditBurst, editIdle, resetEditBurst } = useReactorCoeffEditBurst(immediate)
  return {
    termsFor3d: immediate,
    coeffEditBurst,
    editIdle,
    flushPreviewTerms: resetEditBurst,
  }
}
