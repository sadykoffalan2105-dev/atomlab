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
 * Слоты 0..slotCount-1 — dense array без дыр.
 * Если слотов больше, чем atoms/shell — клонируем крайний (рост коэффициентов).
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
    if (atom) {
      out.push(atom)
      continue
    }
    const prev = out[out.length - 1] ?? shell[shell.length - 1] ?? preview[preview.length - 1]
    if (prev) {
      out.push({
        ...prev,
        atomInTerm: prev.atomInTerm + (i - out.length) + 1,
        visualIndex: (prev.visualIndex ?? prev.atomInTerm) + (i - out.length) + 1,
        pos: [prev.pos[0] + 0.08, prev.pos[1], prev.pos[2] + 0.04],
      })
    }
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
