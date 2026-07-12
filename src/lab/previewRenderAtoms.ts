import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { mergeLayoutDuringEdit } from './previewEditHold'
import { mergePreviewLayoutSlotsIndexed } from './previewSlotBuffer'

export type PreviewRenderSnapshot = {
  atoms: readonly ReactorPreviewAtom[]
  renderCount: number
}

/**
 * Финальный snapshot для рендера: stable atoms + shell-hold + index-aligned slots.
 */
export function buildPreviewRenderSnapshot(
  preview: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
  expectedCount: number,
  editing: boolean,
): PreviewRenderSnapshot {
  if (expectedCount <= 0) {
    const atoms = preview.length > 0 ? preview : shell
    return { atoms, renderCount: atoms.length }
  }

  if (!editing) {
    const atoms = preview.length >= expectedCount ? preview : preview.length > 0 ? preview : shell
    const renderCount = Math.max(atoms.length, expectedCount)
    return { atoms, renderCount }
  }

  const merged = mergeLayoutDuringEdit(preview, shell, expectedCount, shell.length)
  const renderCount = Math.max(merged.holdCount, expectedCount)
  return { atoms: merged.atoms, renderCount }
}

/** Index-aligned layout для pool[i] — null = freeze предыдущий кадр. */
export function buildPreviewLayoutIndexed(
  slotCount: number,
  preview: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
): (ReactorPreviewAtom | null)[] {
  return mergePreviewLayoutSlotsIndexed(slotCount, preview, shell)
}
