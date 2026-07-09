import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { resolveShellRenderCount } from '../wasm/previewAtomShellWasm'
import { mergePreviewLayoutSlots } from './previewLayoutSlots'

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
  if (expectedCount <= 0) {
    return preview.length > 0 ? preview : shell
  }

  if (!editing) {
    if (preview.length >= expectedCount) return preview
    if (preview.length > 0) return preview
    return shell.length > 0 ? shell : preview
  }

  if (preview.length >= expectedCount) return preview

  if (preview.length === 0 && shell.length > 0) {
    return shell.length >= expectedCount ? shell.slice(0, expectedCount) : shell
  }

  if (expectedCount > preview.length && shell.length > preview.length) {
    const merged: ReactorPreviewAtom[] = preview.slice() as ReactorPreviewAtom[]
    for (let i = preview.length; i < Math.min(expectedCount, shell.length); i++) {
      merged.push(shell[i]!)
    }
    if (merged.length > preview.length) return merged
    if (shell.length >= expectedCount) return shell.slice(0, expectedCount)
    return shell
  }

  if (preview.length > 0) return preview
  if (shell.length > 0) return shell.slice(0, expectedCount)
  return preview
}

export type PreviewRenderSnapshot = {
  atoms: readonly ReactorPreviewAtom[]
  renderCount: number
}

/**
 * Финальный snapshot для рендера: stable atoms + WASM shell-hold count.
 */
export function buildPreviewRenderSnapshot(
  preview: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
  expectedCount: number,
  editing: boolean,
): PreviewRenderSnapshot {
  const atoms = resolveStablePreviewRenderAtoms(preview, shell, expectedCount, editing)
  const renderCount = resolveShellRenderCount(
    preview.length,
    shell.length,
    expectedCount,
    editing,
  )
  const targetCount = Math.max(
    atoms.length,
    renderCount,
    expectedCount > 0 && editing ? expectedCount : 0,
  )

  if (targetCount <= 0) {
    return { atoms, renderCount: 0 }
  }

  const merged = mergePreviewLayoutSlots(targetCount, atoms, shell)
  if (merged.length >= targetCount) {
    return { atoms: merged, renderCount: merged.length }
  }

  if (targetCount <= atoms.length) {
    return { atoms, renderCount: atoms.length }
  }

  if (shell.length >= targetCount) {
    const filled: ReactorPreviewAtom[] = atoms.slice() as ReactorPreviewAtom[]
    for (let i = atoms.length; i < targetCount; i++) {
      filled.push(shell[i]!)
    }
    return { atoms: filled, renderCount: filled.length }
  }

  return { atoms: merged.length > 0 ? merged : atoms, renderCount: Math.max(merged.length, atoms.length) }
}
