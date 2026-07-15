import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'

export type PreviewSlotBuffer = {
  /** Замороженный layout по индексу pool-слота. */
  slots: (ReactorPreviewAtom | null)[]
  /** Пик видимых слотов — не сжимаем во время transient layout. */
  editPeakSlots: number
  lastExpected: number
}

export function createPreviewSlotBuffer(): PreviewSlotBuffer {
  return { slots: [], editPeakSlots: 0, lastExpected: 0 }
}

/** Индекс-выровненные слоты: pool[i] ↔ result[i]. */
export function mergePreviewLayoutSlotsIndexed(
  slotCount: number,
  preview: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
): (ReactorPreviewAtom | null)[] {
  if (slotCount <= 0) return []
  const out: (ReactorPreviewAtom | null)[] = new Array(slotCount)
  for (let i = 0; i < slotCount; i++) {
    out[i] = preview[i] ?? shell[i] ?? null
  }
  return out
}

function countNonNull(arr: readonly (ReactorPreviewAtom | null)[], upTo: number): number {
  let n = 0
  for (let i = 0; i < upTo && i < arr.length; i++) {
    if (arr[i]) n++
  }
  return n
}

/**
 * Frozen buffer: при editing null-слоты не стирают прошлый кадр.
 * displayCount не падает, пока indexed layout не покрыл expected.
 */
export function resolvePreviewSlotBuffer(
  buf: PreviewSlotBuffer,
  indexed: readonly (ReactorPreviewAtom | null)[],
  slotCount: number,
  expectedCount: number,
  editing: boolean,
): { slots: (ReactorPreviewAtom | null)[]; displayCount: number } {
  const scanLen = Math.max(slotCount, expectedCount, indexed.length)
  const layoutReady =
    expectedCount <= 0 || countNonNull(indexed, scanLen) >= expectedCount

  if (!editing) {
    buf.editPeakSlots = 0
    buf.lastExpected = expectedCount
    const displayCount = Math.max(slotCount, expectedCount)
    while (buf.slots.length < displayCount) buf.slots.push(null)
    for (let i = 0; i < displayCount; i++) {
      const incoming = i < indexed.length ? indexed[i] : null
      buf.slots[i] = incoming ?? (i < expectedCount ? buf.slots[i] : null) ?? null
    }
    buf.slots.length = displayCount
    return { slots: buf.slots.slice(0, displayCount), displayCount }
  }

  if (expectedCount > buf.lastExpected) {
    buf.editPeakSlots = Math.max(buf.editPeakSlots, expectedCount, slotCount)
  } else if (expectedCount < buf.lastExpected && layoutReady) {
    buf.editPeakSlots = expectedCount
  } else {
    buf.editPeakSlots = Math.max(buf.editPeakSlots, expectedCount, slotCount)
  }
  buf.lastExpected = expectedCount

  let displayCount: number
  if (layoutReady && expectedCount <= buf.editPeakSlots) {
    displayCount = Math.max(expectedCount, slotCount)
  } else {
    displayCount = Math.max(slotCount, expectedCount, buf.editPeakSlots)
  }

  while (buf.slots.length < displayCount) buf.slots.push(null)

  for (let i = 0; i < displayCount; i++) {
    const incoming = i < indexed.length ? indexed[i] : null
    if (incoming) {
      buf.slots[i] = incoming
      continue
    }
    /** Дыры при росте коэффициентов — клон соседа, атомы не пропадают. */
    if (!buf.slots[i]) {
      const prev = i > 0 ? buf.slots[i - 1] : null
      if (prev) {
        buf.slots[i] = {
          ...prev,
          atomInTerm: prev.atomInTerm + 1,
          visualIndex: (prev.visualIndex ?? prev.atomInTerm) + 1,
          pos: [prev.pos[0] + 0.08, prev.pos[1], prev.pos[2] + 0.04],
        }
      }
    }
  }

  return { slots: buf.slots.slice(0, displayCount), displayCount }
}
