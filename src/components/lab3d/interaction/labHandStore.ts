/**
 * «Рука» ученика: маленький стор (useSyncExternalStore) — что в руке, где стоит каждый предмет, какие дверцы
 * открыты, что сейчас нужно опыту. Публикует события шины labEvents ('picked' / 'placed').
 * Живые координаты предметов на столе — в изменяемой карте (перетаскивание не перерисовывает React).
 */
import { useSyncExternalStore } from 'react'
import { labEvents, type LabItemId } from '../labEvents'
import { BENCH_BOUNDS, BENCH_SLOTS, BENCH_STATIC, LAB_ITEM_BY_ID, WORK_RECT, WORK_SLOTS } from './labItems'

/** home — на своей полке/в шкафу; hand — в руке; bench — на столе; work — на рабочем месте. */
export type ItemZone = 'home' | 'hand' | 'bench' | 'work'

export interface HandState {
  readonly held: LabItemId | null
  readonly zones: Readonly<Partial<Record<LabItemId, ItemZone>>>
  readonly doors: Readonly<Record<string, boolean>>
  readonly need: readonly LabItemId[]
  /** Ученик уже хоть раз брал предмет (подсказка «нажмите на склянку» скрывается). */
  readonly pickedOnce: boolean
  /** Предмет, который сейчас тащат по столу. */
  readonly dragging: LabItemId | null
}

const EMPTY: HandState = { held: null, zones: {}, doors: {}, need: [], pickedOnce: false, dragging: null }
let state: HandState = EMPTY
const listeners = new Set<() => void>()
/** Координаты [x, z] предметов на столе (bench/work). */
export const itemXZ = new Map<LabItemId, [number, number]>()

function set(patch: Partial<HandState>) {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const getState = () => state

export function useHand(): HandState {
  return useSyncExternalStore(subscribe, getState, getState)
}

export const zoneOf = (id: LabItemId): ItemZone => state.zones[id] ?? 'home'

/** Занят ли круг (x, z, r) другими предметами или декором. */
function blocked(x: number, z: number, r: number, except: LabItemId | null): boolean {
  for (const [sx, sz, sr] of BENCH_STATIC) if (Math.hypot(x - sx, z - sz) < r + sr) return true
  for (const [id, [ix, iz]] of itemXZ) {
    if (id === except) continue
    const zn = zoneOf(id)
    if (zn !== 'bench' && zn !== 'work') continue
    const ir = LAB_ITEM_BY_ID.get(id)?.r ?? 0.04
    if (Math.hypot(x - ix, z - iz) < r + ir - 0.004) return true
  }
  return false
}

/** Первый свободный слот рабочего места / стола (или null). */
export function freeSlot(zone: 'work' | 'bench', id: LabItemId | null): readonly [number, number] | null {
  const r = id ? (LAB_ITEM_BY_ID.get(id)?.r ?? 0.04) : 0.04
  const slots = zone === 'work' ? WORK_SLOTS : BENCH_SLOTS
  return slots.find(([x, z]) => !blocked(x, z, r, id)) ?? null
}

export const insideWork = (x: number, z: number) => x > WORK_RECT.x0 && x < WORK_RECT.x1 && z > WORK_RECT.z0 && z < WORK_RECT.z1

/** Сдвинуть точку (x, z) так, чтобы предмет не входил в другие и не выходил за край стола. */
export function resolveOnBench(id: LabItemId, x: number, z: number): [number, number] {
  const r = LAB_ITEM_BY_ID.get(id)?.r ?? 0.04
  let px = x
  let pz = z
  for (let it = 0; it < 5; it++) {
    px = Math.min(BENCH_BOUNDS.x1 - r, Math.max(BENCH_BOUNDS.x0 + r, px))
    pz = Math.min(BENCH_BOUNDS.z1 - r, Math.max(BENCH_BOUNDS.z0 + r, pz))
    const push = (ox: number, oz: number, or: number) => {
      const dx = px - ox
      const dz = pz - oz
      const d = Math.hypot(dx, dz)
      const min = r + or
      if (d < min) {
        const k = d > 1e-5 ? (min - d) / d : 1
        px += d > 1e-5 ? dx * k : min
        pz += d > 1e-5 ? dz * k : 0
      }
    }
    for (const [sx, sz, sr] of BENCH_STATIC) push(sx, sz, sr)
    for (const [oid, [ox, oz]] of itemXZ) {
      if (oid === id) continue
      const zn = zoneOf(oid)
      if (zn !== 'bench' && zn !== 'work') continue
      push(ox, oz, LAB_ITEM_BY_ID.get(oid)?.r ?? 0.04)
    }
  }
  return [px, pz]
}

function setZone(id: LabItemId, zone: ItemZone, extra: Partial<HandState> = {}) {
  const zones = { ...state.zones }
  if (zone === 'home') delete zones[id]
  else zones[id] = zone
  set({ ...extra, zones })
}

export const labHand = {
  /** Взять предмет в руку (если в руке был другой — он возвращается на своё место). */
  pick(id: LabItemId) {
    if (state.held === id) return
    if (state.held) labHand.putBack()
    itemXZ.delete(id)
    setZone(id, 'hand', { held: id, pickedOnce: true })
    labEvents.emit({ type: 'picked', itemId: id })
  },
  /** Положить предмет из руки на своё место на полке/в шкафу. */
  putBack() {
    const id = state.held
    if (!id) return
    setZone(id, 'home', { held: null })
    labEvents.emit({ type: 'placed', itemId: id, zone: 'shelf' })
  },
  /** Поставить предмет из руки на рабочее место (в свободный слот у края) или на свободное место стола. */
  place(zone: 'work' | 'bench', at?: readonly [number, number]) {
    const id = state.held
    if (!id) return false
    const slot = at ?? freeSlot(zone, id) ?? (zone === 'work' ? WORK_SLOTS[0] : BENCH_SLOTS[0])
    const [x, z] = resolveOnBench(id, slot[0], slot[1])
    itemXZ.set(id, [x, z])
    setZone(id, zone, { held: null })
    labEvents.emit({ type: 'placed', itemId: id, zone })
    return true
  },
  /** Перетаскивание по столу: начало, ход (живые координаты), конец. */
  dragStart(id: LabItemId) {
    set({ dragging: id })
  },
  dragMove(id: LabItemId, x: number, z: number) {
    itemXZ.set(id, resolveOnBench(id, x, z))
  },
  dragEnd(id: LabItemId) {
    const p = itemXZ.get(id)
    if (!p) return set({ dragging: null })
    let zone: 'work' | 'bench' = 'bench'
    if (insideWork(p[0], p[1])) {
      // На рабочем месте — в ближайший свободный слот у края, чтобы не мешать установке
      zone = 'work'
      itemXZ.delete(id)
      const free = WORK_SLOTS.filter(([sx, sz]) => !blocked(sx, sz, LAB_ITEM_BY_ID.get(id)?.r ?? 0.04, id))
      const best = (free.length ? free : WORK_SLOTS).reduce((a, b) => (Math.hypot(a[0] - p[0], a[1] - p[1]) <= Math.hypot(b[0] - p[0], b[1] - p[1]) ? a : b))
      itemXZ.set(id, resolveOnBench(id, best[0], best[1]))
    }
    setZone(id, zone, { dragging: null })
    labEvents.emit({ type: 'placed', itemId: id, zone })
  },
  toggleDoor(doorId: string) {
    set({ doors: { ...state.doors, [doorId]: !state.doors[doorId] } })
  },
  openDoor(doorId: string) {
    if (!state.doors[doorId]) set({ doors: { ...state.doors, [doorId]: true } })
  },
  setNeed(ids: readonly LabItemId[]) {
    set({ need: ids })
  },
  /** Смена опыта: всё возвращается на полки и в шкафы, рука пуста (подсказка о первом взятии остаётся скрытой). */
  reset() {
    itemXZ.clear()
    set({ held: null, zones: {}, dragging: null })
  },
  getState,
}
