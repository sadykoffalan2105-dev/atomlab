import { useRef } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'

/**
 * Стабильные terms для Canvas: никогда не null/пусто, пока в UI есть реагенты.
 * Всегда immediate — deferred давал рассинхрон и пропадание атомов между кадрами.
 */
export function useReactorPreviewTermsStable(
  reactorOpen: boolean,
  immediate: readonly ReactorEquationTerm[],
  _deferred: readonly ReactorEquationTerm[],
  _coeffEditBurst: boolean,
): readonly ReactorEquationTerm[] | null {
  const shellRef = useRef<readonly ReactorEquationTerm[] | null>(null)

  const immediateOk = reactorOpen && immediate.length >= 1 ? immediate : null
  if (immediateOk) shellRef.current = immediateOk

  if (!reactorOpen) {
    shellRef.current = null
    return null
  }

  if (immediateOk) return immediateOk
  if (shellRef.current?.length) return shellRef.current
  return null
}
