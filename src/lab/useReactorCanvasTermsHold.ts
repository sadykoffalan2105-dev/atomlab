import { useEffect, useRef, useState } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'

function termsIdSig(terms: readonly ReactorEquationTerm[]): string {
  return terms.map((t) => `${t.id}:${t.z}:${t.diatomic ? 1 : 0}`).join('|')
}

function termsFullSig(terms: readonly ReactorEquationTerm[]): string {
  return terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|')
}

/**
 * Terms для Canvas: пока ученик вводит коэффициенты,
 * 3D заморожен — атомы не remount'ятся при O₂→K→Cr.
 * После blur + idle — одно обновление.
 */
export function useReactorCanvasTermsHold(
  reactorOpen: boolean,
  leftTerms: readonly ReactorEquationTerm[],
  freezeCanvas: boolean,
  idleMs = 560,
): readonly ReactorEquationTerm[] {
  const [canvasTerms, setCanvasTerms] = useState<readonly ReactorEquationTerm[]>(() => leftTerms)
  const canvasRef = useRef(leftTerms)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!reactorOpen) {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      canvasRef.current = leftTerms
      setCanvasTerms(leftTerms)
      return
    }

    const nextFull = termsFullSig(leftTerms)
    const curFull = termsFullSig(canvasRef.current)
    if (nextFull === curFull) return

    const structural =
      termsIdSig(leftTerms) !== termsIdSig(canvasRef.current) ||
      leftTerms.length !== canvasRef.current.length

    if (structural) {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      canvasRef.current = leftTerms
      setCanvasTerms(leftTerms)
      return
    }

    // Coeff-only + freeze (focus / edit burst) — держим старый снимок.
    if (freezeCanvas) {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    if (timerRef.current != null) clearTimeout(timerRef.current)
    const snapshot = leftTerms
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      canvasRef.current = snapshot
      setCanvasTerms(snapshot)
    }, idleMs)

    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [reactorOpen, leftTerms, freezeCanvas, idleMs])

  useEffect(
    () => () => {
      if (timerRef.current != null) clearTimeout(timerRef.current)
    },
    [],
  )

  if (!reactorOpen) return leftTerms
  return canvasRef.current.length > 0 || leftTerms.length === 0 ? canvasTerms : leftTerms
}
