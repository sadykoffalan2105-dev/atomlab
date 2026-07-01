import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import { shouldForceSyncPreviewLayout } from './atomlabPerfGuard'

function termsSignature(terms: readonly ReactorEquationTerm[]): string {
  if (!terms.length) return ''
  return terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|')
}

function estimatePreviewAtomCount(terms: readonly ReactorEquationTerm[]): number {
  let n = 0
  for (const t of terms) {
    const c = Math.floor(t.coeff)
    if (c > 0) n += c
  }
  return n
}

/** Порог sync-build на main thread; выше — worker + shell (только вне редактирования). */
export const SYNC_BUILD_ATOM_CAP = 12

/**
 * Layout превью: всегда sync при редактировании / до синтеза — zero-black-screen.
 */
export function useReactorPreviewLayout(
  terms: readonly ReactorEquationTerm[],
  coeffEditBurst: boolean,
  layoutDebounceMs = 0,
  coeffEditing = coeffEditBurst,
): readonly ReactorPreviewAtom[] {
  const termsSig = useMemo(() => termsSignature(terms), [terms])
  const atomEstimate = useMemo(() => estimatePreviewAtomCount(terms), [termsSig, terms])

  const shellRef = useRef<readonly ReactorPreviewAtom[]>([])
  const syncAtomsRef = useRef<readonly ReactorPreviewAtom[]>([])
  const lastBuiltSigRef = useRef('')

  const forceSync = shouldForceSyncPreviewLayout(atomEstimate, coeffEditing)

  if (termsSig !== lastBuiltSigRef.current) {
    lastBuiltSigRef.current = termsSig
    const shell = shellRef.current
    if (forceSync || shell.length === 0) {
      const built = buildReactorPreviewAtoms(terms, { tier: 'full' })
      syncAtomsRef.current = built.length > 0 ? built : shell.length > 0 ? shell : built
      if (built.length > 0) shellRef.current = built
    } else {
      syncAtomsRef.current = shell
    }
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
    if (terms.length >= 1) {
      const built = buildReactorPreviewAtoms(terms, { tier: 'full' })
      if (built.length > 0) {
        shellRef.current = built
        syncAtomsRef.current = built
        setAtoms(built)
      }
    }
  }, [termsSig, terms, syncAtoms, coeffEditing, layoutDebounceMs, atomEstimate, forceSync])

  if (atoms.length > 0) return atoms
  if (shellRef.current.length > 0) return shellRef.current
  return atoms
}
