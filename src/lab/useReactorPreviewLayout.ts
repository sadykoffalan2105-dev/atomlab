import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import { shouldForceSyncPreviewLayout } from './atomlabPerfGuard'
import {
  estimatePreviewAtomCount,
  pickLayoutAtoms,
  SYNC_BUILD_ATOM_CAP,
  termsSignature,
} from './previewLayoutPolicy'
import { scheduleIdleMatch } from './labRenderGuards'

export { SYNC_BUILD_ATOM_CAP } from './previewLayoutPolicy'

export type PreviewLayoutHookResult = {
  atoms: readonly ReactorPreviewAtom[]
  layoutPending: boolean
}

/**
 * Layout превью: при +/- всегда sync (lite для >12 атомов).
 * Вне редактирования — idle rebuild для тяжёлых уравнений, shell до готовности.
 * Инвариант: при terms.length > 0 никогда не возвращаем пустой массив.
 */
export function useReactorPreviewLayout(
  terms: readonly ReactorEquationTerm[],
  coeffEditBurst: boolean,
  layoutDebounceMs = 0,
  coeffEditing = coeffEditBurst,
): PreviewLayoutHookResult {
  const termsSig = useMemo(() => termsSignature(terms), [terms])
  const atomEstimate = useMemo(() => estimatePreviewAtomCount(terms), [termsSig, terms])

  const shellRef = useRef<readonly ReactorPreviewAtom[]>([])
  const syncAtomsRef = useRef<readonly ReactorPreviewAtom[]>([])
  const lastBuiltSigRef = useRef('')
  const pendingSigRef = useRef<string | null>(null)

  const forceSync = shouldForceSyncPreviewLayout(atomEstimate, coeffEditing)
  const heavyEquation = atomEstimate > SYNC_BUILD_ATOM_CAP

  if (termsSig !== lastBuiltSigRef.current) {
    lastBuiltSigRef.current = termsSig
    const shell = shellRef.current

    if (coeffEditing) {
      const built = buildReactorPreviewAtoms(terms, {
        tier: heavyEquation ? 'lite' : 'full',
      })
      const picked = pickLayoutAtoms(built, shell)
      syncAtomsRef.current = picked
      if (picked.length > 0) shellRef.current = picked
      pendingSigRef.current = null
    } else if (forceSync || shell.length === 0) {
      const built = buildReactorPreviewAtoms(terms, {
        tier: heavyEquation ? 'lite' : 'full',
      })
      const picked = pickLayoutAtoms(built, shell)
      syncAtomsRef.current = picked
      if (picked.length > 0) shellRef.current = picked
      pendingSigRef.current = null
    } else if (shell.length > 0) {
      syncAtomsRef.current = shell
      pendingSigRef.current = termsSig
    } else {
      const built = buildReactorPreviewAtoms(terms, { tier: 'lite' })
      const picked = pickLayoutAtoms(built, shell)
      syncAtomsRef.current = picked
      if (picked.length > 0) shellRef.current = picked
      pendingSigRef.current = null
    }
  }

  const syncAtoms = syncAtomsRef.current
  const layoutPending = pendingSigRef.current != null

  const [atoms, setAtoms] = useState<readonly ReactorPreviewAtom[]>(() =>
    syncAtoms.length > 0 ? syncAtoms : shellRef.current,
  )

  if (syncAtoms.length > 0) {
    shellRef.current = syncAtoms
  }

  useLayoutEffect(() => {
    const pending = pendingSigRef.current
    if (pending && pending === termsSig) {
      let cancelled = false
      let debounceTimer: number | null = null
      const run = () => {
        if (cancelled) return
        const built = buildReactorPreviewAtoms(terms, { tier: 'lite' })
        const picked = pickLayoutAtoms(built, shellRef.current)
        if (picked.length > 0) {
          shellRef.current = picked
          syncAtomsRef.current = picked
          setAtoms(picked)
        }
        pendingSigRef.current = null
      }
      const scheduleRun = () => {
        if (layoutDebounceMs > 0) {
          debounceTimer = window.setTimeout(run, layoutDebounceMs)
        } else {
          run()
        }
      }
      const raf = requestAnimationFrame(() => {
        scheduleIdleMatch(scheduleRun)
      })
      return () => {
        cancelled = true
        cancelAnimationFrame(raf)
        if (debounceTimer != null) window.clearTimeout(debounceTimer)
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
      const picked = pickLayoutAtoms(built, shellRef.current)
      if (picked.length > 0) {
        shellRef.current = picked
        syncAtomsRef.current = picked
        setAtoms(picked)
      }
    }
  }, [termsSig, terms, syncAtoms, coeffEditing, layoutDebounceMs, atomEstimate, forceSync, heavyEquation])

  const resolved =
    atoms.length > 0 ? atoms : shellRef.current.length > 0 ? shellRef.current : atoms

  return {
    atoms: resolved,
    layoutPending: layoutPending || (pendingSigRef.current != null),
  }
}
