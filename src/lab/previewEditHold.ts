import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'

/**
 * Слияние layout при +/-: позиции из built, пропуски — из shell.
 * Никогда не сжимаем ниже expected, пока built не догнал (transient hold) —
 * но и никогда не поднимаем hold выше того, что реально есть в built/shell:
 * expectedCount может быть устаревшей или недостижимой для текущего tier
 * оценкой, и раздувать под неё кадр несуществующими клонами атомов нельзя.
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
  // Сколько атомов у нас есть на самом деле — built (свежий) или shell
  // (прошлый кадр). Если expectedCount завышен относительно обоих (устаревшая
  // оценка коэффициентов до правки или lite-tier cap, который built никогда
  // не достигнет), это не «рост, который вот-вот досчитается» — это ошибка
  // оценки. Раньше в этом случае недостающие слоты добивались клонами
  // последнего атома шлейфа, и в кадре появлялись атомы-призраки, которых
  // никогда не будет ни в built, ни в shell.
  const availableCeiling = Math.max(built.length, shell.length)
  const holdCount = layoutReady
    ? expectedCount
    : Math.min(Math.max(prevHoldCount, expectedCount, built.length, shell.length), availableCeiling)

  const targetLen = holdCount
  const out: ReactorPreviewAtom[] = []

  // targetLen <= availableCeiling = max(built.length, shell.length), поэтому
  // каждый слот i < targetLen гарантированно берётся из built или из shell —
  // фантомных клонов за пределами реальных данных больше не подставляем.
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
