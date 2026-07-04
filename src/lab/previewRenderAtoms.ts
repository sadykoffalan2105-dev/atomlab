import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'

/**
 * Стабильный список атомов для отрисовки: при +/- не уменьшаем count,
 * пока новый layout не догнал expected (убирает «пропадание» при burst).
 */
export function resolveStablePreviewRenderAtoms(
  preview: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
  expectedCount: number,
  editing: boolean,
): readonly ReactorPreviewAtom[] {
  if (expectedCount <= 0) return preview.length > 0 ? preview : shell

  if (preview.length >= expectedCount) return preview

  if (preview.length > 0 && shell.length === 0) return preview

  if (editing) {
    if (preview.length === 0 && shell.length > 0) {
      return shell.length >= expectedCount ? shell : shell
    }
    if (preview.length > 0 && preview.length < expectedCount && shell.length >= expectedCount) {
      return shell
    }
    if (preview.length > 0 && shell.length > preview.length) {
      const merged: ReactorPreviewAtom[] = preview.slice() as ReactorPreviewAtom[]
      for (let i = preview.length; i < Math.min(expectedCount, shell.length); i++) {
        merged.push(shell[i]!)
      }
      if (merged.length >= expectedCount || merged.length > preview.length) return merged
    }
  }

  if (preview.length > 0) return preview
  if (shell.length > 0) return shell
  return preview
}
