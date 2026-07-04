import { useMemo, useRef } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import {
  estimatePreviewAtomCount,
  pickLayoutAtoms,
  SYNC_BUILD_ATOM_CAP,
  termsSignature,
} from './previewLayoutPolicy'

export { SYNC_BUILD_ATOM_CAP } from './previewLayoutPolicy'

export type PreviewLayoutHookResult = {
  atoms: readonly ReactorPreviewAtom[]
  layoutPending: boolean
}

/**
 * Sync layout на каждое изменение terms — без useState (нет кадра с пустым массивом).
 */
export function useReactorPreviewLayout(
  terms: readonly ReactorEquationTerm[],
  _coeffEditBurst: boolean,
  _layoutDebounceMs = 0,
  _coeffEditing = _coeffEditBurst,
): PreviewLayoutHookResult {
  const termsSig = useMemo(() => termsSignature(terms), [terms])
  const atomEstimate = useMemo(() => estimatePreviewAtomCount(terms), [termsSig, terms])

  const shellRef = useRef<readonly ReactorPreviewAtom[]>([])
  const lastBuiltSigRef = useRef('')

  const heavyEquation = atomEstimate > SYNC_BUILD_ATOM_CAP

  if (termsSig !== lastBuiltSigRef.current) {
    lastBuiltSigRef.current = termsSig
    const shell = shellRef.current
    if (terms.length >= 1 && atomEstimate > 0) {
      const built = buildReactorPreviewAtoms(terms, {
        tier: heavyEquation ? 'lite' : 'full',
      })
      const picked = pickLayoutAtoms(built, shell, _coeffEditing, atomEstimate)
      if (picked.length > 0) shellRef.current = picked
    }
  }

  const resolved =
    shellRef.current.length > 0
      ? shellRef.current
      : terms.length >= 1 && atomEstimate > 0
        ? pickLayoutAtoms(
            buildReactorPreviewAtoms(terms, { tier: heavyEquation ? 'lite' : 'full' }),
            shellRef.current,
            _coeffEditing,
            atomEstimate,
          )
        : shellRef.current

  if (resolved.length > 0) {
    shellRef.current = resolved
  }

  return {
    atoms: resolved,
    layoutPending: false,
  }
}
