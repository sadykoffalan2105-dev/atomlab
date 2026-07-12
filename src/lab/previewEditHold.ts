import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'

/**
 * Слияние layout при +/-: позиции из built, пропуски — из shell.
 * Никогда не сжимаем ниже expected, пока built не догнал (transient hold).
 */
export function mergeLayoutDuringEdit(
  built: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
  expectedCount: number,
  prevHoldCount: number,
): { atoms: readonly ReactorPreviewAtom[]; holdCount: number } {
  if (expectedCount <= 0) {
    return { atoms: built.length > 0 ? built : shell, holdCount: 0 }
  }

  const layoutReady = built.length >= expectedCount
  const holdCount = layoutReady
    ? expectedCount
    : Math.max(prevHoldCount, expectedCount, built.length, shell.length)

  const targetLen = layoutReady ? expectedCount : holdCount
  const out: ReactorPreviewAtom[] = []

  for (let i = 0; i < targetLen; i++) {
    if (i < built.length) {
      out.push(built[i]!)
    } else if (i < shell.length) {
      out.push(shell[i]!)
    }
  }

  return {
    atoms: out.length > 0 ? out : shell.length > 0 ? shell : built,
    holdCount: layoutReady ? expectedCount : holdCount,
  }
}

/** Слоты 0..slotCount: preview[i] ?? shell[i], без дублирования last. */
export function fillLayoutSlots(
  slotCount: number,
  preview: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
): readonly ReactorPreviewAtom[] {
  if (slotCount <= 0) return preview.length > 0 ? preview : shell
  const out: ReactorPreviewAtom[] = []
  for (let i = 0; i < slotCount; i++) {
    const atom = preview[i] ?? shell[i] ?? null
    if (atom) out.push(atom)
  }
  return out.length > 0 ? out : preview.length > 0 ? preview : shell
}
