import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import { requestPreviewLayout } from './reactorPreviewLayoutWorkerClient'

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

/** Порог sync-build на main thread; выше — worker + shell. */
export const SYNC_BUILD_ATOM_CAP = 12

/**
 * Layout превью: мгновенный sync для малых N + WASM/worker off-thread для тяжёлых уравнений.
 * Shell ref не даёт вернуть пустой список между кадрами (zero-black-screen).
 */
export function useReactorPreviewLayout(
  terms: readonly ReactorEquationTerm[],
  coeffEditBurst: boolean,
  layoutDebounceMs = 0,
): readonly ReactorPreviewAtom[] {
  const termsSig = useMemo(() => termsSignature(terms), [terms])
  const atomEstimate = useMemo(() => estimatePreviewAtomCount(terms), [termsSig, terms])

  const shellRef = useRef<readonly ReactorPreviewAtom[]>([])
  const syncAtomsRef = useRef<readonly ReactorPreviewAtom[]>([])
  const lastBuiltSigRef = useRef('')

  if (termsSig !== lastBuiltSigRef.current) {
    lastBuiltSigRef.current = termsSig
    const shell = shellRef.current
    const heavy = atomEstimate > SYNC_BUILD_ATOM_CAP
    /** Burst +/-: всегда sync-build — worker не откладывает layout. */
    const deferSync = heavy && shell.length > 0 && !coeffEditBurst
    if (!deferSync || shell.length === 0) {
      const built = buildReactorPreviewAtoms(terms, { tier: 'full' })
      syncAtomsRef.current = built.length > 0 ? built : shell.length > 0 ? shell : built
      if (built.length > 0) shellRef.current = built
    } else {
      syncAtomsRef.current = shell
    }
  }

  const syncAtoms = syncAtomsRef.current
  const genRef = useRef(0)
  const [atoms, setAtoms] = useState<readonly ReactorPreviewAtom[]>(() =>
    syncAtoms.length > 0 ? syncAtoms : shellRef.current,
  )

  if (syncAtoms.length > 0) {
    shellRef.current = syncAtoms
  }

  useLayoutEffect(() => {
    genRef.current += 1
    const gen = genRef.current

    if (syncAtoms.length > 0) {
      shellRef.current = syncAtoms
      setAtoms(syncAtoms)
    } else if (shellRef.current.length > 0 && terms.length >= 1) {
      setAtoms(shellRef.current)
    }

    const useWorker = atomEstimate > SYNC_BUILD_ATOM_CAP && !coeffEditBurst
    if (!useWorker) return

    let cancelled = false
    let timer: number | null = null

    const runWorker = () => {
      if (terms.length < 1) return
      void requestPreviewLayout(terms, { coeffEditBurst }).then((result) => {
        if (cancelled || gen !== genRef.current) return
        if (result.atoms.length > 0) {
          shellRef.current = result.atoms
          setAtoms(result.atoms)
          return
        }
        const syncFallback = buildReactorPreviewAtoms(terms, { tier: 'full' })
        if (syncFallback.length > 0) {
          shellRef.current = syncFallback
          setAtoms(syncFallback)
        } else if (shellRef.current.length > 0) {
          setAtoms(shellRef.current)
        }
      })
    }

    const debounceMs =
      layoutDebounceMs > 0 ? layoutDebounceMs : coeffEditBurst ? 20 : 12
    if (debounceMs > 0) timer = window.setTimeout(runWorker, debounceMs)
    else runWorker()

    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
    }
  }, [termsSig, terms, coeffEditBurst, syncAtoms, layoutDebounceMs, atomEstimate])

  if (atoms.length > 0) return atoms
  if (shellRef.current.length > 0) return shellRef.current
  return atoms
}
