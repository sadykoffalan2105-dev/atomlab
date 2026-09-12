import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import {
  getReactorVisualTier,
  previewAtomCountForTier,
  type ReactorVisualTier,
} from '../chemistry/reactorVisualTier'
import { termsSignature } from './previewLayoutPolicy'
import { mergeLayoutDuringEdit } from './previewEditHold'

export { SYNC_BUILD_ATOM_CAP } from './previewLayoutPolicy'

export type PreviewLayoutHookResult = {
  atoms: readonly ReactorPreviewAtom[]
  layoutPending: boolean
}

/**
 * Всегда JS+cache: мгновенно, без WASM hitch на render.
 * WASM refinement только после idle (не блокирует +/-).
 *
 * Tier берём из getReactorVisualTier — того же источника, что и финальная
 * сцена синтеза (LabScene/SynthesisOnLabScene). Раньше здесь был отдельный
 * порог (ATOMLAB_SYNC_BUILD_ATOM_CAP = 12, предназначенный для решения
 * sync/worker-построения, а не для визуального tier'а), из-за чего превью
 * во время правки коэффициентов переключалось на lite на 12 атомах, а
 * запущенный синтез той же реакции показывал полный full-tier до 24 атомов —
 * при запуске атомы визуально «перестраивались» другим набором.
 */
function buildLayoutAtomsInstant(
  terms: readonly ReactorEquationTerm[],
  tier: ReactorVisualTier,
): ReactorPreviewAtom[] {
  return buildReactorPreviewAtoms(terms, { tier: tier === 'cluster' ? 'lite' : tier })
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
  const tier = useMemo(() => getReactorVisualTier(terms), [terms])
  // Реальное число атомов, которое построит buildLayoutAtomsInstant для этого
  // tier: наивная сумма коэффициентов может быть больше того, что lite/cluster
  // tier когда-либо покажет (per-term cap), и тогда hold ждал бы недостижимый
  // expectedCount вечно, достраивая кадр фантомными клонами последнего атома
  // шлейфа (см. previewEditHold.mergeLayoutDuringEdit).
  const atomEstimate = useMemo(() => previewAtomCountForTier(terms, tier), [terms, tier])

  const shellRef = useRef<readonly ReactorPreviewAtom[]>([])
  const holdCountRef = useRef(0)
  const lastBuiltSigRef = useRef('')
  const [, setTick] = useState(0)

  const editing = coeffEditing || coeffEditBurst

  const needsBuild =
    termsSig !== lastBuiltSigRef.current && terms.length >= 1 && atomEstimate > 0

  // Instant build синхронно — JS cache, без пустого кадра.
  if (needsBuild) {
    const built = buildLayoutAtomsInstant(terms, tier)
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
        ? buildLayoutAtomsInstant(terms, tier)
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
