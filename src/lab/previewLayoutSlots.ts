import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'

/** Слот i → атом для layout/pin. Индекс слота совпадает с pool[i]. */
export function resolvePreviewLayoutSlotAtom(
  index: number,
  preview: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
): ReactorPreviewAtom | null {
  return preview[index] ?? shell[index] ?? null
}

function fallbackShellAtom(
  index: number,
  preview: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
): ReactorPreviewAtom | null {
  return (
    resolvePreviewLayoutSlotAtom(index, preview, shell) ??
    shell[shell.length - 1] ??
    preview[preview.length - 1] ??
    null
  )
}

/**
 * Слоты 0..slotCount-1: preview[i] ?? shell[i].
 * Длина результата = slotCount — индексы pool-слотов не смещаются при +/-.
 */
export function mergePreviewLayoutSlots(
  slotCount: number,
  preview: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
): readonly ReactorPreviewAtom[] {
  if (slotCount <= 0) return preview.length > 0 ? preview : shell
  const out: ReactorPreviewAtom[] = []
  for (let i = 0; i < slotCount; i++) {
    const atom = fallbackShellAtom(i, preview, shell)
    if (!atom) break
    out.push(atom)
  }
  if (out.length === slotCount) return out
  while (out.length < slotCount) {
    const atom = fallbackShellAtom(out.length, preview, shell)
    if (!atom) break
    out.push(atom)
  }
  if (out.length === slotCount) return out
  return out.length > 0 ? out : preview.length > 0 ? preview : shell
}
