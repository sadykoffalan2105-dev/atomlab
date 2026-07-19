import { useEffect, useRef, useState } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'

function termsFullSig(terms: readonly ReactorEquationTerm[]): string {
  return terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|')
}

/**
 * Canvas terms: применяем уравнение сразу после commit коэффициента (<1 с).
 * Не держим долгий freeze — пропадания лечит shell/sticky в превью, не задержка.
 * Микро-debounce только схлопывает серии ↑↓ за один кадр.
 */
export function useReactorCanvasTermsHold(
  reactorOpen: boolean,
  leftTerms: readonly ReactorEquationTerm[],
  _freezeCanvas: boolean,
  idleMs = 32,
): readonly ReactorEquationTerm[] {
  const [canvasTerms, setCanvasTerms] = useState<readonly ReactorEquationTerm[]>(() => leftTerms)
  const canvasRef = useRef(leftTerms)
  const timerRef = useRef<number | null>(null)
  void _freezeCanvas

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
    if (nextFull === termsFullSig(canvasRef.current)) return

    if (timerRef.current != null) clearTimeout(timerRef.current)

    // 0–50ms: атомы на экране сразу после Enter/blur, без секундного ожидания.
    const delay = Math.min(50, Math.max(0, idleMs))
    if (delay <= 0) {
      canvasRef.current = leftTerms
      setCanvasTerms(leftTerms)
      return
    }

    const snapshot = leftTerms
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      canvasRef.current = snapshot
      setCanvasTerms(snapshot)
    }, delay)

    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [reactorOpen, leftTerms, idleMs])

  useEffect(
    () => () => {
      if (timerRef.current != null) clearTimeout(timerRef.current)
    },
    [],
  )

  if (!reactorOpen) return leftTerms
  return canvasTerms.length > 0 || leftTerms.length === 0 ? canvasTerms : leftTerms
}
