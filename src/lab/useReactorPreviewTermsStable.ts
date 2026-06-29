import { useRef } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'

/**
 * Стабильные terms для Canvas: никогда не null/пусто, пока в UI есть реагенты.
 * При burst — immediate (мгновенный count атомов); иначе deferred с fallback.
 */
export function useReactorPreviewTermsStable(
  reactorOpen: boolean,
  immediate: readonly ReactorEquationTerm[],
  deferred: readonly ReactorEquationTerm[],
  coeffEditBurst: boolean,
): readonly ReactorEquationTerm[] | null {
  const shellRef = useRef<readonly ReactorEquationTerm[] | null>(null)

  const immediateOk = reactorOpen && immediate.length >= 1 ? immediate : null
  if (immediateOk) shellRef.current = immediateOk

  const deferredOk = reactorOpen && deferred.length >= 1 ? deferred : null

  if (!reactorOpen) {
    shellRef.current = null
    return null
  }

  if (coeffEditBurst && immediateOk) return immediateOk
  if (deferredOk) return deferredOk
  if (immediateOk) return immediateOk
  return shellRef.current
}
