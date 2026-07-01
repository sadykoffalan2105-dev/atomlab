import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import { shouldForceSyncPreviewLayout } from './atomlabPerfGuard'
import { deferHeavyLayoutRebuild } from './atomlabSynthesisGuard'
import { scheduleIdleMatch } from './labRenderGuards'

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
 * Layout превью: при +/- на тяжёлых уравнениях держим shell на экране,
 * rebuild — в idle/rAF (без 2–3 с «пустого» кадра).
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
  const pendingSigRef = useRef<string | null>(null)

  const forceSync = shouldForceSyncPreviewLayout(atomEstimate, coeffEditing)
  const deferHeavy = deferHeavyLayoutRebuild(atomEstimate, coeffEditing)

  if (termsSig !== lastBuiltSigRef.current) {
    lastBuiltSigRef.current = termsSig
    const shell = shellRef.current

    if (deferHeavy && shell.length > 0) {
      syncAtomsRef.current = shell
      pendingSigRef.current = termsSig
    } else if (forceSync || shell.length === 0) {
      const built = buildReactorPreviewAtoms(terms, {
        tier: deferHeavy ? 'lite' : 'full',
      })
      syncAtomsRef.current = built.length > 0 ? built : shell.length > 0 ? shell : built
      if (built.length > 0) shellRef.current = built
      pendingSigRef.current = null
    } else {
      syncAtomsRef.current = shell
      pendingSigRef.current = null
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
    const pending = pendingSigRef.current
    if (pending && pending === termsSig && deferHeavy) {
      let cancelled = false
      const run = () => {
        if (cancelled) return
        const built = buildReactorPreviewAtoms(terms, { tier: 'lite' })
        if (built.length > 0) {
          shellRef.current = built
          syncAtomsRef.current = built
          setAtoms(built)
        }
        pendingSigRef.current = null
      }
      const raf = requestAnimationFrame(() => {
        scheduleIdleMatch(run)
      })
      return () => {
        cancelled = true
        cancelAnimationFrame(raf)
      }
    }

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
      const built = buildReactorPreviewAtoms(terms, { tier: 'lite' })
      if (built.length > 0) {
        shellRef.current = built
        syncAtomsRef.current = built
        setAtoms(built)
      }
    }
  }, [termsSig, terms, syncAtoms, coeffEditing, layoutDebounceMs, atomEstimate, forceSync, deferHeavy])

  if (atoms.length > 0) return atoms
  if (shellRef.current.length > 0) return shellRef.current
  return atoms
}
