import { useLayoutEffect, useMemo, useRef, useState } from 'react'
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
 * Layout превью: при любом изменении terms — sync rebuild (кэш layout).
 * Инвариант: при terms.length > 0 и хотя бы одном coeff > 0 — никогда не пустой массив.
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
  const syncAtomsRef = useRef<readonly ReactorPreviewAtom[]>([])
  const lastBuiltSigRef = useRef('')

  const heavyEquation = atomEstimate > SYNC_BUILD_ATOM_CAP

  if (termsSig !== lastBuiltSigRef.current) {
    lastBuiltSigRef.current = termsSig
    const shell = shellRef.current
    const built = buildReactorPreviewAtoms(terms, {
      tier: heavyEquation ? 'lite' : 'full',
    })
    const picked = pickLayoutAtoms(built, shell)
    syncAtomsRef.current = picked
    if (picked.length > 0) shellRef.current = picked
  }

  const syncAtoms = syncAtomsRef.current

  const [atoms, setAtoms] = useState<readonly ReactorPreviewAtom[]>(() =>
    syncAtoms.length > 0 ? syncAtoms : shellRef.current,
  )

  if (syncAtoms.length > 0) {
    shellRef.current = syncAtoms
  }

  useLayoutEffect(() => {
    if (syncAtoms.length > 0) {
      shellRef.current = syncAtoms
      setAtoms(syncAtoms)
      return
    }
    if (shellRef.current.length > 0 && terms.length >= 1) {
      setAtoms(shellRef.current)
      return
    }
    if (terms.length >= 1 && atomEstimate > 0) {
      const built = buildReactorPreviewAtoms(terms, { tier: heavyEquation ? 'lite' : 'full' })
      const picked = pickLayoutAtoms(built, shellRef.current)
      if (picked.length > 0) {
        shellRef.current = picked
        syncAtomsRef.current = picked
        setAtoms(picked)
      }
    }
  }, [termsSig, syncAtoms, terms, atomEstimate, heavyEquation])

  const resolved =
    atoms.length > 0 ? atoms : shellRef.current.length > 0 ? shellRef.current : atoms

  return {
    atoms: resolved,
    layoutPending: false,
  }
}
