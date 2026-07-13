import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import {
  estimatePreviewAtomCount,
  SYNC_BUILD_ATOM_CAP,
  termsSignature,
} from './previewLayoutPolicy'
import { mergeLayoutDuringEdit } from './previewEditHold'

export { SYNC_BUILD_ATOM_CAP } from './previewLayoutPolicy'

export type PreviewLayoutHookResult = {
  atoms: readonly ReactorPreviewAtom[]
  layoutPending: boolean
}

/**
 * Всегда JS+cache: мгновенно, без WASM hitch на render.
 * WASM refinement только после idle (не блокирует +/-).
 */
function buildLayoutAtomsInstant(
  terms: readonly ReactorEquationTerm[],
  heavyEquation: boolean,
): ReactorPreviewAtom[] {
  return buildReactorPreviewAtoms(terms, {
    tier: heavyEquation ? 'lite' : 'full',
  })
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
 * Instant layout на каждое изменение terms — без debounce и без WASM в render.
 * Shell-hold при editing: атомы не исчезают между кадрами.
 */
export function useReactorPreviewLayout(
  terms: readonly ReactorEquationTerm[],
  coeffEditBurst: boolean,
  _layoutDebounceMs = 0,
  coeffEditing = coeffEditBurst,
): PreviewLayoutHookResult {
  const termsSig = useMemo(() => termsSignature(terms), [terms])
  const atomEstimate = useMemo(() => estimatePreviewAtomCount(terms), [termsSig, terms])

  const shellRef = useRef<readonly ReactorPreviewAtom[]>([])
  const holdCountRef = useRef(0)
  const lastBuiltSigRef = useRef('')
  const [, setTick] = useState(0)

  const editing = coeffEditing || coeffEditBurst
  const heavyEquation = atomEstimate > SYNC_BUILD_ATOM_CAP

  const needsBuild =
    termsSig !== lastBuiltSigRef.current && terms.length >= 1 && atomEstimate > 0

  // Instant build синхронно — JS cache, без пустого кадра.
  if (needsBuild) {
    const built = buildLayoutAtomsInstant(terms, heavyEquation)
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
    if (!editing && holdCountRef.current !== atomEstimate) {
      holdCountRef.current = atomEstimate
    }
  }, [editing, atomEstimate])

  // Force re-render when terms change after shell was mutated in render path
  // (React already re-renders on terms change via parent).
  useLayoutEffect(() => {
    if (terms.length < 1) {
      shellRef.current = []
      lastBuiltSigRef.current = ''
      holdCountRef.current = 0
      setTick((n) => n + 1)
    }
  }, [terms.length])

  const resolved =
    shellRef.current.length > 0
      ? shellRef.current
      : terms.length >= 1 && atomEstimate > 0
        ? buildLayoutAtomsInstant(terms, heavyEquation)
        : shellRef.current

  if (resolved.length > 0 && shellRef.current.length === 0) {
    shellRef.current = resolved
    lastBuiltSigRef.current = termsSig
    holdCountRef.current = atomEstimate
  }

  return {
    atoms: resolved,
    layoutPending: false,
  }
}
