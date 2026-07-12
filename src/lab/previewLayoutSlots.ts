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
 * Без early-break: дыра в середине не обрезает хвост (shell-hold).
 * Без дублирования последнего атома.
 */
export function mergePreviewLayoutSlots(
  slotCount: number,
  preview: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
): readonly ReactorPreviewAtom[] {
  if (slotCount <= 0) return preview.length > 0 ? preview : shell
  const out: ReactorPreviewAtom[] = []
  let last: ReactorPreviewAtom | null = null
  for (let i = 0; i < slotCount; i++) {
    const atom = resolvePreviewLayoutSlotAtom(i, preview, shell)
    if (atom) {
      out.push(atom)
      last = atom
      continue
    }
    // Gap: удерживаем last known atom в слоте (только pos/z для pin), не обрываем массив.
    if (last) {
      out.push(last)
    } else if (shell.length > 0) {
      out.push(shell[Math.min(i, shell.length - 1)]!)
    } else if (preview.length > 0) {
      out.push(preview[Math.min(i, preview.length - 1)]!)
    } else {
      break
    }
  }
  return out.length > 0 ? out : preview.length > 0 ? preview : shell
}

/** Стабильный identity key атома превью (для affinity / тестов). */
export function reactorPreviewAtomKey(atom: {
  termId?: string
  termIndex: number
  atomInTerm: number
  z: number
}): string {
  return `${atom.termId ?? `t${atom.termIndex}`}:${atom.atomInTerm}:${atom.z}`
}
