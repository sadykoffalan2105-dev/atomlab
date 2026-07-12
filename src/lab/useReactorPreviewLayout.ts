import { useLayoutEffect, useMemo, useRef, useState } from 'react'
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

function applyBuiltLayout(
  built: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
  expectedCount: number,
  editing: boolean,
  holdCountRef: { current: number },
): readonly ReactorPreviewAtom[] {
  if (!editing) {
    holdCountRef.current = expectedCount
    return built.length > 0 ? built : shell
  }
  const merged = mergeLayoutDuringEdit(built, shell, expectedCount, holdCountRef.current)
  holdCountRef.current = merged.holdCount
  return merged.atoms.length > 0 ? merged.atoms : shell.length > 0 ? shell : built
}

/**
 * Sync layout на каждое изменение terms.
 * При editing — coalesce WASM (debounce), shell-hold без пустых кадров.
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
  const holdCountRef = useRef(0)
  const lastBuiltSigRef = useRef('')
  const debounceTimerRef = useRef<number | null>(null)
  const [debouncedPending, setDebouncedPending] = useState(false)

  const editing = coeffEditing || coeffEditBurst
  const heavyEquation = atomEstimate > SYNC_BUILD_ATOM_CAP

  const needsBuild =
    termsSig !== lastBuiltSigRef.current && terms.length >= 1 && atomEstimate > 0

  if (needsBuild && (!editing || layoutDebounceMs <= 0)) {
    const built = buildLayoutAtoms(terms, heavyEquation)
    shellRef.current = applyBuiltLayout(
      built,
      shellRef.current,
      atomEstimate,
      editing,
      holdCountRef,
    )
    lastBuiltSigRef.current = termsSig
  }

  useLayoutEffect(() => {
    if (debounceTimerRef.current != null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    if (!needsBuild) {
      if (!editing && holdCountRef.current !== atomEstimate) {
        holdCountRef.current = atomEstimate
      }
      setDebouncedPending(false)
      return
    }

    if (!editing || layoutDebounceMs <= 0) {
      setDebouncedPending(false)
      return
    }

    setDebouncedPending(true)
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null
      const built = buildLayoutAtoms(terms, heavyEquation)
      shellRef.current = applyBuiltLayout(
        built,
        shellRef.current,
        atomEstimate,
        editing,
        holdCountRef,
      )
      lastBuiltSigRef.current = termsSig
      setDebouncedPending(false)
    }, layoutDebounceMs)

    return () => {
      if (debounceTimerRef.current != null) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [needsBuild, editing, layoutDebounceMs, termsSig, terms, atomEstimate, heavyEquation])

  useLayoutEffect(
    () => () => {
      if (debounceTimerRef.current != null) clearTimeout(debounceTimerRef.current)
    },
    [],
  )

  const resolved =
    shellRef.current.length > 0
      ? shellRef.current
      : terms.length >= 1 && atomEstimate > 0
        ? buildLayoutAtoms(terms, heavyEquation)
        : shellRef.current

  if (resolved.length > 0 && shellRef.current.length === 0) {
    shellRef.current = resolved
    lastBuiltSigRef.current = termsSig
  }

  return {
    atoms: resolved,
    layoutPending: debouncedPending,
  }
}
