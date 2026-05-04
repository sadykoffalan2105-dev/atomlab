/**
 * Число ячеек в старой сетке реактора (legacy).
 * Лаборатория использует уравнение с коэффициентами (`reactorEquationBalance.ts`);
 * функции ниже оставлены для `composition.findCompoundMatchByReactorSlots` и совместимости.
 */
export const REACTOR_SLOT_COUNT = 4

export type ReactorSlot = { z: number; count: number } | null

export function emptyReactorSlots(): ReactorSlot[] {
  return Array.from({ length: REACTOR_SLOT_COUNT }, () => null)
}

/**
 * Слоты UI: одна ячейка = уникальный элемент + счётчик.
 * Добавление элемента:
 * - если элемент уже есть в слоте — увеличиваем `count` (но общий totalAtoms не превышает 4)
 * - если элемента нет — вставляем в первую пустую; если места нет — сдвиг влево, новый в конец
 */
export function appendReactorZ(prev: readonly ReactorSlot[], z: number): ReactorSlot[] {
  const out: ReactorSlot[] = Array.from({ length: REACTOR_SLOT_COUNT }, (_, i) => (i < prev.length ? prev[i]! : null))
  const delta = 1

  const existingIdx = out.findIndex((s) => s != null && s.z === z)
  if (existingIdx >= 0) {
    const s = out[existingIdx]!
    out[existingIdx] = { z: s.z, count: s.count + delta }
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        sessionId: 'dbdb64',
        runId: 'reactor',
        hypothesisId: 'H_slots',
        location: 'reactorSlots.ts:appendReactorZ',
        message: 'increment existing',
        data: { z, existingIdx, delta, countAfter: s.count + delta },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    return out
  }

  const firstEmpty = out.findIndex((s) => s == null)
  if (firstEmpty >= 0) {
    out[firstEmpty] = { z, count: delta }
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        sessionId: 'dbdb64',
        runId: 'reactor',
        hypothesisId: 'H_slots',
        location: 'reactorSlots.ts:appendReactorZ',
        message: 'insert new into empty',
        data: { z, firstEmpty, delta },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    return out
  }

  // Сдвиг влево: удаляем самый старый уникальный элемент
  for (let i = 0; i < REACTOR_SLOT_COUNT - 1; i++) out[i] = out[i + 1]!
  out[REACTOR_SLOT_COUNT - 1] = { z, count: delta }
  // #region agent log
  fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      sessionId: 'dbdb64',
      runId: 'reactor',
      hypothesisId: 'H_slots',
      location: 'reactorSlots.ts:appendReactorZ',
      message: 'shift left and insert',
      data: { z, delta },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
  return out
}

/** Число «атомов» в реакторе: сумма count (нужно для enable/disable синтеза). */
export function countFilledReactorSlots(slots: readonly ReactorSlot[]): number {
  let n = 0
  for (const s of slots) if (s) n += Math.max(0, s.count | 0)
  return n
}

/**
 * Для синтеза/подбора по каталогу нужна «плоская» последовательность Z (с повторениями).
 * Пример: [{H,2},{O,1}] => [H,H,O]
 */
export function getFilledReactorZ(slots: readonly ReactorSlot[]): number[] {
  const out: number[] = []
  for (const s of slots) {
    if (!s) continue
    const c = Math.max(0, s.count | 0)
    for (let i = 0; i < c; i++) out.push(s.z)
  }
  return out
}

/** Уменьшить count по индексу. Если стало 0 — удалить и сдвинуть влево. */
export function decrementReactorSlot(slots: readonly ReactorSlot[], index: number): ReactorSlot[] {
  const out: ReactorSlot[] = Array.from({ length: REACTOR_SLOT_COUNT }, (_, i) => (i < slots.length ? slots[i]! : null))
  const s = out[index]
  if (!s) return out
  const nextCount = (s.count | 0) - 1
  if (nextCount > 0) {
    out[index] = { z: s.z, count: nextCount }
  } else {
    out[index] = null
    // сдвиг влево, сохраняя порядок
    const compact: ReactorSlot[] = out.filter((x) => x != null)
    while (compact.length < REACTOR_SLOT_COUNT) compact.push(null)
    for (let i = 0; i < REACTOR_SLOT_COUNT; i++) out[i] = compact[i] ?? null
  }
  // #region agent log
  fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      sessionId: 'dbdb64',
      runId: 'reactor',
      hypothesisId: 'H_slots',
      location: 'reactorSlots.ts:decrementReactorSlot',
      message: 'decrement slot',
      data: { index, z: s.z, countBefore: s.count, countAfter: Math.max(0, nextCount) },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
  return out
}
