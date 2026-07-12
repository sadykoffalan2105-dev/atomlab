import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'

/** Слот i → атом для layout/pin. Индекс слота совпадает с pool[i]. */
export function resolvePreviewLayoutSlotAtom(
  index: number,
  preview: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
): ReactorPreviewAtom | null {
  return preview[index] ?? shell[index] ?? null
}

/**
 * Слоты 0..slotCount-1: preview[i] ?? shell[i].
 * Без дублирования последнего атома — иначе React key collision и remount Bohr.
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
    if (!atom) break
    out.push(atom)
  }
  return out.length > 0 ? out : preview.length > 0 ? preview : shell
}

/** Стабильный identity key атома превью (не индекс пула). */
export function reactorPreviewAtomKey(atom: {
  termId?: string
  termIndex: number
  atomInTerm: number
  z: number
}): string {
  return `${atom.termId ?? `t${atom.termIndex}`}:${atom.atomInTerm}:${atom.z}`
}
