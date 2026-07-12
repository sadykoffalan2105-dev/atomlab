import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { mergeLayoutDuringEdit } from './previewEditHold'

/** Слот i → атом для layout/pin. Индекс слота совпадает с pool[i]. */
export function resolvePreviewLayoutSlotAtom(
  index: number,
  preview: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
): ReactorPreviewAtom | null {
  return preview[index] ?? shell[index] ?? null
}

/**
 * Слоты 0..slotCount-1 — legacy dense array (без null-дыр).
 * Для pool-рендера используйте mergePreviewLayoutSlotsIndexed.
 */
export function mergePreviewLayoutSlots(
  slotCount: number,
  preview: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
): readonly ReactorPreviewAtom[] {
  if (slotCount <= 0) return preview.length > 0 ? preview : shell
  const out: ReactorPreviewAtom[] = []
  for (let i = 0; i < slotCount; i++) {
    const atom = resolvePreviewLayoutSlotAtom(i, preview, shell)
    if (atom) out.push(atom)
  }
  return out.length > 0 ? out : preview.length > 0 ? preview : shell
}

/** Стабильный identity key атома превью (для тестов). */
export function reactorPreviewAtomKey(atom: {
  termId?: string
  termIndex: number
  atomInTerm: number
  z: number
}): string {
  return `${atom.termId ?? `t${atom.termIndex}`}:${atom.atomInTerm}:${atom.z}`
}

export { mergeLayoutDuringEdit }
