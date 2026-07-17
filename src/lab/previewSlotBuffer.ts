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
    // Pre-synth держит editing=true через previewOnlyMode. Если всё же idle —
    // не обнуляем peak мгновенно: держим max(expected, prevPeak) один кадр через lastExpected.
    const displayCount = Math.max(slotCount, expectedCount, buf.editPeakSlots)
    buf.lastExpected = expectedCount
    while (buf.slots.length < displayCount) buf.slots.push(null)
    for (let i = 0; i < displayCount; i++) {
      const incoming = i < indexed.length ? indexed[i] : null
      buf.slots[i] = incoming ?? (i < Math.max(expectedCount, buf.editPeakSlots) ? buf.slots[i] : null) ?? null
    }
    if (expectedCount >= buf.editPeakSlots) {
      buf.editPeakSlots = expectedCount
    } else if (layoutReady) {
      // Сжимаем peak только когда layout готов и expected стабильно ниже.
      buf.editPeakSlots = Math.max(expectedCount, Math.min(buf.editPeakSlots, displayCount))
    }
    if (buf.slots.length > displayCount) buf.slots.length = displayCount
    return { slots: buf.slots, displayCount: Math.max(displayCount, expectedCount) }
  }

  // Editing: peak только растёт (или сжимается при явном уменьшении coeff + layoutReady).
  if (expectedCount > buf.lastExpected) {
    buf.editPeakSlots = Math.max(buf.editPeakSlots, expectedCount, slotCount)
  } else if (expectedCount < buf.lastExpected && layoutReady) {
    // Не сжимаем резко: держим peak ещё кадр (защита rapid +/-).
    buf.editPeakSlots = Math.max(expectedCount, Math.floor(buf.editPeakSlots * 0.85))
    if (buf.editPeakSlots < expectedCount) buf.editPeakSlots = expectedCount
  } else {
    buf.editPeakSlots = Math.max(buf.editPeakSlots, expectedCount, slotCount)
  }
  buf.lastExpected = expectedCount

  const displayCount = Math.max(slotCount, expectedCount, buf.editPeakSlots)

  while (buf.slots.length < displayCount) buf.slots.push(null)
  if (buf.slots.length > displayCount) buf.slots.length = displayCount

  for (let i = 0; i < displayCount; i++) {
    const incoming = i < indexed.length ? indexed[i] : null
    if (incoming) {
      buf.slots[i] = incoming
      continue
    }
    /** Дыры при росте коэффициентов — клон соседа с зазором, атомы не пропадают. */
    if (!buf.slots[i]) {
      const prev = i > 0 ? buf.slots[i - 1] : null
      if (prev) {
        buf.slots[i] = {
          ...prev,
          atomInTerm: prev.atomInTerm + 1,
          visualIndex: (prev.visualIndex ?? prev.atomInTerm) + 1,
          pos: [prev.pos[0] + 0.52, prev.pos[1], prev.pos[2] + 0.18],
        }
      }
    }
  }

  // Без slice: тот же массив — меньше аллокаций при каждом +/-.
  return { slots: buf.slots, displayCount }
}
