import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'

/** Слоты 0..slotCount-1: preview[i] ?? shell[i] — для layout/pin при shell-hold. */
export function mergePreviewLayoutSlots(
  slotCount: number,
  preview: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
): readonly ReactorPreviewAtom[] {
  if (slotCount <= 0) return preview.length > 0 ? preview : shell
  const out: ReactorPreviewAtom[] = []
  for (let i = 0; i < slotCount; i++) {
    const atom = preview[i] ?? shell[i]
    if (atom) out.push(atom)
  }
  return out
}
