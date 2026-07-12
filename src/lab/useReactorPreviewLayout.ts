import { useMemo, useRef } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import {
  estimatePreviewAtomCount,
  SYNC_BUILD_ATOM_CAP,
  termsSignature,
} from './previewLayoutPolicy'
import { mergeLayoutDuringEdit } from './previewEditHold'
import { buildPreviewLayoutWasmSync } from '../wasm/reactorPreviewLayoutWasm'

export { SYNC_BUILD_ATOM_CAP } from './previewLayoutPolicy'

export type PreviewLayoutHookResult = {
  atoms: readonly ReactorPreviewAtom[]
  layoutPending: boolean
}

function buildLayoutAtoms(
  terms: readonly ReactorEquationTerm[],
  heavyEquation: boolean,
): ReactorPreviewAtom[] {
  const tier = heavyEquation ? 'lite' : 'full'
  return buildPreviewLayoutWasmSync(terms, tier)
}

/**
 * Sync layout на каждое изменение terms — без useState (нет кадра с пустым массивом).
 * При editing — mergeLayoutDuringEdit: атомы не исчезают, пока built не догнал expected.
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
  const holdCountRef = useRef(0)
  const lastBuiltSigRef = useRef('')

  const heavyEquation = atomEstimate > SYNC_BUILD_ATOM_CAP

  if (termsSig !== lastBuiltSigRef.current) {
    lastBuiltSigRef.current = termsSig
    const shell = shellRef.current
    if (terms.length >= 1 && atomEstimate > 0) {
      const built = buildLayoutAtoms(terms, heavyEquation)
      if (_coeffEditing) {
        const merged = mergeLayoutDuringEdit(
          built,
          shell,
          atomEstimate,
          holdCountRef.current,
        )
        holdCountRef.current = merged.holdCount
        if (merged.atoms.length > 0) shellRef.current = merged.atoms
      } else {
        holdCountRef.current = atomEstimate
        shellRef.current = built.length > 0 ? built : shell
      }
    }
  }

  if (!_coeffEditing && holdCountRef.current !== atomEstimate) {
    holdCountRef.current = atomEstimate
  }

  const resolved =
    shellRef.current.length > 0
      ? shellRef.current
      : terms.length >= 1 && atomEstimate > 0
        ? buildLayoutAtoms(terms, heavyEquation)
        : shellRef.current

  if (resolved.length > 0) {
    shellRef.current = resolved
  }

  return {
    atoms: resolved,
    layoutPending: false,
  }
}
