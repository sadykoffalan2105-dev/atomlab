/**
 * «Рука» ученика: маленький стор (useSyncExternalStore) — что в руке, где стоит каждый предмет, какие дверцы
 * и ящики открыты, что сейчас нужно опыту, что надето из средств защиты, где рабочее место (стол или вытяжка).
 * Публикует события шины labEvents ('picked' / 'placed' / 'safety' / 'sound').
 * Живые координаты предметов на столе — в изменяемой карте (перетаскивание не перерисовывает React).
 */
import { useSyncExternalStore } from 'react'
import { labEvents, type LabGearId, type LabItemId } from '../labEvents'
import {
  BENCH_BOUNDS,
  BENCH_SLOTS,
  BENCH_STATIC,
  BENCH_Y,
  HOOD_BOUNDS,
  HOOD_RECT,
  HOOD_SLOTS,
  LAB_ITEM_BY_ID,
  WORK_RECT,
  WORK_SLOTS,
} from './labItems'

/** home — на своей полке/в шкафу; hand — в руке; bench — на столе; work — на рабочем месте. */
export type ItemZone = 'home' | 'hand' | 'bench' | 'work'
/** Где установка опыта: на рабочем месте стола или в вытяжном шкафу. */
export type WorkSite = 'bench' | 'hood'

export interface HandState {
  readonly held: LabItemId | null
  readonly zones: Readonly<Partial<Record<LabItemId, ItemZone>>>
  readonly doors: Readonly<Record<string, boolean>>
  readonly need: readonly LabItemId[]
  /** Ученик уже хоть раз брал предмет (подсказка «нажмите на склянку» скрывается). */
  readonly pickedOnce: boolean
  /** Предмет, который сейчас тащат по столу. */
  readonly dragging: LabItemId | null
  /** Надетые средства защиты и те, что просит надеть опыт. */
  readonly worn: readonly LabGearId[]
  readonly gearNeed: readonly LabGearId[]
  readonly site: WorkSite
  /** Вентилятор вытяжки включён. */
  readonly hoodFan: boolean
  /** Открыт список правил ТБ (нажатие на плакат). */
  readonly rulesOpen: boolean
}

const EMPTY: HandState = {
  held: null,
  zones: {},
  doors: {},
  need: [],
  pickedOnce: false,
  dragging: null,
  worn: [],
  gearNeed: [],
  site: 'bench',
  hoodFan: false,
  rulesOpen: false,
}
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

const workRect = () => (state.site === 'hood' ? HOOD_RECT : WORK_RECT)
const workSlots = () => (state.site === 'hood' ? HOOD_SLOTS : WORK_SLOTS)
/** Поверхность по точке: столешница вытяжки (слева) или рабочий стол. */
const onHood = (x: number) => x < HOOD_BOUNDS.x1 + 0.12
const boundsAt = (x: number) => (onHood(x) ? HOOD_BOUNDS : BENCH_BOUNDS)

/** Занят ли круг (x, z, r) другими предметами или декором. */
function blocked(x: number, z: number, r: number, except: LabItemId | null): boolean {
  if (!onHood(x)) for (const [sx, sz, sr] of BENCH_STATIC) if (Math.hypot(x - sx, z - sz) < r + sr) return true
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
  const slots = zone === 'work' ? workSlots() : BENCH_SLOTS
  return slots.find(([x, z]) => !blocked(x, z, r, id)) ?? null
}

export const insideWork = (x: number, z: number) => {
  const w = workRect()
  return x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1
}
export const currentWorkRect = workRect

/**
 * Сдвинуть точку (x, z) так, чтобы предмет не входил в другие и не выходил за край стола.
 * overhang > 0 — разрешить временно свеситься за край на эту долю радиуса (при перетаскивании; потом
 * предмет соскальзывает обратно). Возвращает точку и признак «упёрся в соседа».
 */
export function resolveOnBench(id: LabItemId, x: number, z: number, overhang = 0): [number, number] {
  return resolveWithContact(id, x, z, overhang).p
}
function resolveWithContact(id: LabItemId, x: number, z: number, overhang = 0): { p: [number, number]; contact: boolean } {
  const r = LAB_ITEM_BY_ID.get(id)?.r ?? 0.04
  const b = boundsAt(x)
  const hood = onHood(x)
  const m = r * (1 - overhang)
  let px = x
  let pz = z
  let contact = false
  for (let it = 0; it < 5; it++) {
    px = Math.min(b.x1 - m, Math.max(b.x0 + m, px))
    pz = Math.min(b.z1 - m, Math.max(b.z0 + m, pz))
    const push = (ox: number, oz: number, or: number) => {
      const dx = px - ox
      const dz = pz - oz
      const d = Math.hypot(dx, dz)
      const min = r + or
      if (d < min) {
        contact = true
        const k = d > 1e-5 ? (min - d) / d : 1
        px += d > 1e-5 ? dx * k : min
        pz += d > 1e-5 ? dz * k : 0
      }
    }
    if (!hood) for (const [sx, sz, sr] of BENCH_STATIC) push(sx, sz, sr)
    for (const [oid, [ox, oz]] of itemXZ) {
      if (oid === id) continue
      const zn = zoneOf(oid)
      if (zn !== 'bench' && zn !== 'work') continue
      push(ox, oz, LAB_ITEM_BY_ID.get(oid)?.r ?? 0.04)
    }
  }
  // Окончательная постановка (без свешивания): раздвигание в тесноте могло не сойтись (сосед с двух сторон,
  // край стола) — тогда ищем ближайшее свободное место по расширяющимся кольцам, чтобы стекло не входило в стекло.
  if (overhang === 0 && !fitsAt(id, px, pz, r, b)) {
    const found = nearestFree(id, x, z, r, b)
    if (found) return { p: found, contact: true }
  }
  return { p: [px, pz], contact }
}

/** Помещается ли предмет радиуса r в точке: внутри столешницы и без касания соседей/декора (зазор 1 мм). */
function fitsAt(id: LabItemId, x: number, z: number, r: number, b: { x0: number; x1: number; z0: number; z1: number }): boolean {
  const eps = 1e-4
  if (x < b.x0 + r - eps || x > b.x1 - r + eps || z < b.z0 + r - eps || z > b.z1 - r + eps) return false
  if (!onHood(x)) for (const [sx, sz, sr] of BENCH_STATIC) if (Math.hypot(x - sx, z - sz) < r + sr - 0.001) return false
  for (const [oid, [ox, oz]] of itemXZ) {
    if (oid === id) continue
    const zn = zoneOf(oid)
    if (zn !== 'bench' && zn !== 'work') continue
    if (Math.hypot(x - ox, z - oz) < r + (LAB_ITEM_BY_ID.get(oid)?.r ?? 0.04) - 0.001) return false
  }
  return true
}

/** Ближайшая к (x, z) свободная точка той же поверхности: кольца через 1,5 см, до 1,2 м. */
function nearestFree(id: LabItemId, x: number, z: number, r: number, b: { x0: number; x1: number; z0: number; z1: number }): [number, number] | null {
  const cx = Math.min(b.x1 - r, Math.max(b.x0 + r, x))
  const cz = Math.min(b.z1 - r, Math.max(b.z0 + r, z))
  if (fitsAt(id, cx, cz, r, b)) return [cx, cz]
  for (let ring = 1; ring <= 80; ring++) {
    const rad = ring * 0.015
    const n = Math.max(8, Math.round((2 * Math.PI * rad) / 0.012))
    let best: [number, number] | null = null
    let bestD = Infinity
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      const px = cx + Math.cos(a) * rad
      const pz = cz + Math.sin(a) * rad
      if (onHood(px) !== onHood(cx)) continue
      if (!fitsAt(id, px, pz, r, b)) continue
      const d = Math.hypot(px - x, pz - z)
      if (d < bestD) {
        bestD = d
        best = [px, pz]
      }
    }
    if (best) return best
  }
  return null
}

function setZone(id: LabItemId, zone: ItemZone, extra: Partial<HandState> = {}) {
  const zones = { ...state.zones }
  if (zone === 'home') delete zones[id]
  else zones[id] = zone
  set({ ...extra, zones })
}

let lastContact: LabItemId | null = null
let lastClinkAt = 0

/** Нагретые у пламени предметы: до какого времени (performance.now) горячие. Остывают за 90 с. */
const hotUntil = new Map<LabItemId, number>()
const HOT_MS = 90_000
let hintLang: 'ru' | 'en' | 'uz' = 'ru'
const HOT_TEXT = {
  hot: { ru: 'Горячо!', en: 'Hot!', uz: 'Issiq!' },
  gloves: { ru: 'Горячо! Наденьте перчатки, чтобы взять', en: 'Hot! Put on gloves to pick it up', uz: 'Issiq! Olish uchun qo‘lqop kiying' },
} as const
const itemPoint = (id: LabItemId): [number, number, number] | null => {
  const xz = itemXZ.get(id)
  const h = LAB_ITEM_BY_ID.get(id)?.h ?? 0.1
  return xz ? [xz[0], BENCH_Y + h + 0.06, xz[1]] : null
}

export const labHand = {
  /** Взять предмет в руку (если в руке был другой — он возвращается на своё место). */
  pick(id: LabItemId) {
    if (state.held === id) return
    // Нагретый у пламени предмет без перчаток не берём (правила ТБ)
    if (labHand.isHot(id) && !state.worn.includes('gloves')) {
      const at = itemPoint(id)
      if (at) labEvents.emit({ type: 'hint', at, text: HOT_TEXT.gloves[hintLang] })
      labEvents.emit({ type: 'sound', name: 'error', gain: 0.6 })
      labHand.setGearNeed(['gloves'])
      return
    }
    if (state.held) labHand.putBack()
    const from = zoneOf(id)
    const xz = itemXZ.get(id)
    const home = LAB_ITEM_BY_ID.get(id)?.home
    itemXZ.delete(id)
    setZone(id, 'hand', { held: id, pickedOnce: true })
    labEvents.emit({ type: 'picked', itemId: id })
    // Стекло тихо звякает, когда его снимают с полки/со стола
    const at: [number, number, number] | undefined = xz ? [xz[0], BENCH_Y + 0.05, xz[1]] : from === 'home' && home ? [home[0], home[1] + 0.05, home[2]] : undefined
    labEvents.emit({ type: 'sound', name: 'glass-clink', at, gain: 0.3 })
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
    const slots = zone === 'work' ? workSlots() : BENCH_SLOTS
    const slot = at ?? freeSlot(zone, id) ?? slots[0]
    const [x, z] = resolveOnBench(id, slot[0], slot[1])
    itemXZ.set(id, [x, z])
    setZone(id, zone, { held: null })
    labEvents.emit({ type: 'placed', itemId: id, zone })
    return true
  },
  /** Перетаскивание по столу: начало, ход (живые координаты), конец. */
  dragStart(id: LabItemId) {
    lastContact = null
    set({ dragging: id })
  },
  dragMove(id: LabItemId, x: number, z: number) {
    // Можно чуть свесить предмет за край — при отпускании он соскользнёт обратно
    const { p, contact } = resolveWithContact(id, x, z, 0.55)
    itemXZ.set(id, p)
    // Упёрся в соседний предмет — лёгкий звон стекла (не чаще раза в 0,25 с)
    if (contact && lastContact !== id) {
      const now = performance.now()
      if (now - lastClinkAt > 250) {
        lastClinkAt = now
        labEvents.emit({ type: 'sound', name: 'glass-clink', at: [p[0], BENCH_Y + 0.05, p[1]], gain: 0.7 })
      }
    }
    lastContact = contact ? id : null
  },
  dragEnd(id: LabItemId) {
    const p = itemXZ.get(id)
    if (!p) return set({ dragging: null })
    let zone: 'work' | 'bench' = 'bench'
    if (insideWork(p[0], p[1])) {
      // На рабочем месте — в ближайший свободный слот у края, чтобы не мешать установке
      zone = 'work'
      itemXZ.delete(id)
      const slots = workSlots()
      const free = slots.filter(([sx, sz]) => !blocked(sx, sz, LAB_ITEM_BY_ID.get(id)?.r ?? 0.04, id))
      const best = (free.length ? free : slots).reduce((a, b) => (Math.hypot(a[0] - p[0], a[1] - p[1]) <= Math.hypot(b[0] - p[0], b[1] - p[1]) ? a : b))
      itemXZ.set(id, resolveOnBench(id, best[0], best[1]))
    } else {
      // Свесился за край — соскальзывает обратно на столешницу (визуально догоняет с трением)
      itemXZ.set(id, resolveOnBench(id, p[0], p[1]))
    }
    setZone(id, zone, { dragging: null })
    labEvents.emit({ type: 'placed', itemId: id, zone })
  },
  toggleDoor(doorId: string) {
    labHand.setDoor(doorId, !state.doors[doorId])
  },
  setDoor(doorId: string, open: boolean) {
    if (!!state.doors[doorId] !== open) set({ doors: { ...state.doors, [doorId]: open } })
  },
  openDoor(doorId: string) {
    labHand.setDoor(doorId, true)
  },
  setNeed(ids: readonly LabItemId[]) {
    set({ need: ids })
  },
  /** Надеть/снять средство защиты (опыт узнаёт из события 'safety'). */
  wear(gear: LabGearId, on = true) {
    const has = state.worn.includes(gear)
    if (has === on) return
    set({ worn: on ? [...state.worn, gear] : state.worn.filter((g) => g !== gear), gearNeed: on ? state.gearNeed.filter((g) => g !== gear) : state.gearNeed })
    labEvents.emit({ type: 'safety', gear, on })
  },
  setGearNeed(gear: readonly LabGearId[]) {
    set({ gearNeed: gear.filter((g) => !state.worn.includes(g)) })
  },
  setSite(site: WorkSite) {
    if (state.site !== site) set({ site })
  },
  setHoodFan(on: boolean) {
    if (state.hoodFan === on) return
    set({ hoodFan: on })
    labEvents.emit({ type: 'sound', name: 'hood-fan', gain: on ? 1 : 0 })
  },
  setRulesOpen(open: boolean) {
    set({ rulesOpen: open })
  },
  /** Предмет нагрелся у пламени (сцена узнаёт по событиям 'fire' / 'flame-loop'). */
  markHot(id: LabItemId) {
    const first = !labHand.isHot(id)
    hotUntil.set(id, performance.now() + HOT_MS)
    const at = itemPoint(id)
    if (first && at) labEvents.emit({ type: 'hint', at, text: HOT_TEXT.hot[hintLang] })
  },
  isHot(id: LabItemId): boolean {
    const t = hotUntil.get(id)
    return t !== undefined && t > performance.now()
  },
  /** Горячие предметы, что лежат на столе, и точка над ними (для постоянной метки «Горячо»). */
  hotItems(): { id: LabItemId; at: [number, number, number] }[] {
    const out: { id: LabItemId; at: [number, number, number] }[] = []
    for (const id of hotUntil.keys()) {
      if (!labHand.isHot(id) || state.held === id) continue
      const at = itemPoint(id)
      if (at) out.push({ id, at: [at[0], at[1] + 0.04, at[2]] })
    }
    return out
  },
  /** Язык подсказок, которые публикует стор (сцена сообщает при смене языка). */
  setLang(lang: 'ru' | 'en' | 'uz') {
    hintLang = lang
  },
  /** Смена опыта: всё возвращается на полки и в шкафы, рука пуста (подсказка о первом взятии остаётся скрытой). */
  reset() {
    hotUntil.clear()
    itemXZ.clear()
    set({ held: null, zones: {}, dragging: null })
  },
  getState,
}

// Для автоматических кадров (Playwright): …#/vr-lab?debugHand=1 открывает руку в window.__labHand
if (typeof window !== 'undefined' && /[?&]debugHand=1/.test(window.location.hash)) {
  ;(window as unknown as { __labHand?: typeof labHand }).__labHand = labHand
}
