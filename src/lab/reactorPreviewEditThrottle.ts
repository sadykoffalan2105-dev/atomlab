import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'

const BURST_WINDOW_MS = 520
const BURST_MIN_CHANGES = 1
/** Удержание burst после последнего +/- — атомы не «мигают» при отпускании кнопки. */
const BURST_HOLD_MS = 1400
/** Пауза до editIdle после последнего изменения. */
const EDIT_IDLE_MS = 960
/** Доп. удержание превью после editIdle — стабильность на последнем коэффициенте. */
const VISUAL_HOLD_MS = 1600

function termsSignature(terms: readonly ReactorEquationTerm[] | null): string {
  if (!terms?.length) return ''
  return terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|')
}

/**
 * Сигнал быстрого +/- (burst), паузы (editIdle) и visualHold после отпускания кнопки.
 */
export function useReactorCoeffEditBurst(
  terms: readonly ReactorEquationTerm[] | null,
): {
  coeffEditBurst: boolean
  editIdle: boolean
  visualHold: boolean
  resetEditBurst: () => void
} {
  const sig = useMemo(() => termsSignature(terms), [terms])
  const [coeffEditBurst, setCoeffEditBurst] = useState(false)
  const [editIdle, setEditIdle] = useState(true)
  const [visualHold, setVisualHold] = useState(false)
  const changeTimesRef = useRef<number[]>([])
  const burstHoldUntilRef = useRef(0)
  const visualHoldUntilRef = useRef(0)
  const idleTimerRef = useRef<number | null>(null)
  const burstEndTimerRef = useRef<number | null>(null)
  const visualHoldTimerRef = useRef<number | null>(null)
  const baselineSigRef = useRef<string | null>(null)

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    if (burstEndTimerRef.current != null) {
      clearTimeout(burstEndTimerRef.current)
      burstEndTimerRef.current = null
    }
    if (visualHoldTimerRef.current != null) {
      clearTimeout(visualHoldTimerRef.current)
      visualHoldTimerRef.current = null
    }
  }, [])

  const resetEditBurst = useCallback(() => {
    clearTimers()
    setCoeffEditBurst(false)
    setEditIdle(true)
    setVisualHold(false)
    changeTimesRef.current = []
    burstHoldUntilRef.current = 0
    visualHoldUntilRef.current = 0
    baselineSigRef.current = null
  }, [clearTimers])

  const scheduleVisualHoldEnd = useCallback(() => {
    if (visualHoldTimerRef.current != null) clearTimeout(visualHoldTimerRef.current)
    const delay = Math.max(0, visualHoldUntilRef.current - performance.now())
    visualHoldTimerRef.current = window.setTimeout(() => {
      visualHoldTimerRef.current = null
      if (performance.now() >= visualHoldUntilRef.current) {
        setVisualHold(false)
      } else {
        scheduleVisualHoldEnd()
      }
    }, delay)
  }, [])

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

  useLayoutEffect(() => {
    if (terms == null || terms.length === 0) {
      resetEditBurst()
      return
    }

    if (baselineSigRef.current === null) {
      baselineSigRef.current = sig
      return
    }

    if (baselineSigRef.current === sig) return

    const now = performance.now()
    changeTimesRef.current.push(now)
    changeTimesRef.current = changeTimesRef.current.filter((t) => now - t < BURST_WINDOW_MS)
    burstHoldUntilRef.current = Math.max(burstHoldUntilRef.current, now + BURST_HOLD_MS)
    visualHoldUntilRef.current = now + VISUAL_HOLD_MS
    setVisualHold(true)
    scheduleVisualHoldEnd()

    if (changeTimesRef.current.length >= BURST_MIN_CHANGES) {
      setCoeffEditBurst(true)
    } else {
      setCoeffEditBurst(false)
    }
    scheduleIdle()
    scheduleBurstEnd()
  }, [sig, terms, resetEditBurst, scheduleIdle, scheduleBurstEnd, scheduleVisualHoldEnd])

  useEffect(() => () => clearTimers(), [clearTimers])

  return { coeffEditBurst, editIdle, visualHold, resetEditBurst }
}
