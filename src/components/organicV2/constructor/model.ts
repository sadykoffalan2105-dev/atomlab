/**
 * Конструктор органики v2 — модель рисунка (чистый TS, без React; её же гоняет scripts/test-organic-v2-constructor.mts).
 *
 * Ученик рисует только скелет: атомы C и гетероатомы, связи 1/2/3. Водороды не рисуются — их число и подписи
 * (CH₃, CH₂, OH, NH₂) считает движок src/chemistry/organicV2 по валентности.
 * Координаты — в «длинах связи» (1 = одна связь), ось y направлена вниз (как в SVG).
 * Все действия — чистые функции: (состояние, …) → новое состояние (так работают отмена/повтор).
 */
import { perceiveCisTrans, type BondOrder, type SkeletonGraph } from '../../../chemistry/organicV2'

export interface CAtom {
  readonly id: number
  readonly el: string
  readonly x: number
  readonly y: number
}

export interface CBond {
  readonly id: number
  /** id атомов */
  readonly a: number
  readonly b: number
  readonly o: BondOrder
}

export interface CState {
  readonly atoms: readonly CAtom[]
  readonly bonds: readonly CBond[]
  readonly nextId: number
}

/** Готовые группы палитры. */
export type GroupKey = 'OH' | 'CHO' | 'COOH' | 'NH2' | 'NO2' | 'CH3' | 'benzene' | 'c3' | 'c4' | 'c5' | 'c6'

export const GROUP_KEYS: readonly GroupKey[] = ['OH', 'CHO', 'COOH', 'NH2', 'NO2', 'CH3', 'benzene', 'c3', 'c4', 'c5', 'c6']

/** Элементы палитры (H нет — водороды рисуются сами). */
export const PALETTE_ELEMENTS = ['C', 'O', 'N', 'S', 'Cl', 'Br', 'I'] as const

export const EMPTY: CState = { atoms: [], bonds: [], nextId: 1 }

const DEG = Math.PI / 180
const TAU = Math.PI * 2

export const atomById = (s: CState, id: number): CAtom | undefined => s.atoms.find((a) => a.id === id)
export const bondById = (s: CState, id: number): CBond | undefined => s.bonds.find((b) => b.id === id)
export const bondBetween = (s: CState, a: number, b: number): CBond | undefined =>
  s.bonds.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))
export const neighbors = (s: CState, id: number): number[] =>
  s.bonds.filter((b) => b.a === id || b.b === id).map((b) => (b.a === id ? b.b : b.a))

// ───────────────────────── простые действия ─────────────────────────

export function addAtom(s: CState, x: number, y: number, el = 'C'): { state: CState; id: number } {
  const id = s.nextId
  return { state: { atoms: [...s.atoms, { id, el, x, y }], bonds: s.bonds, nextId: id + 1 }, id }
}

/** Связь a–b (если уже есть — кратность по кругу 1→2→3→1). */
export function addBond(s: CState, a: number, b: number, o: BondOrder = 1): CState {
  if (a === b) return s
  const ex = bondBetween(s, a, b)
  if (ex) return cycleBond(s, ex.id)
  return { atoms: s.atoms, bonds: [...s.bonds, { id: s.nextId, a, b, o }], nextId: s.nextId + 1 }
}

/** Касание связи: 1 → 2 → 3 → 1. */
export function cycleBond(s: CState, bondId: number): CState {
  return { ...s, bonds: s.bonds.map((b) => (b.id === bondId ? { ...b, o: (b.o === 3 ? 1 : b.o + 1) as BondOrder } : b)) }
}

export function setBondOrder(s: CState, bondId: number, o: BondOrder): CState {
  return { ...s, bonds: s.bonds.map((b) => (b.id === bondId ? { ...b, o } : b)) }
}

export function setElement(s: CState, atomId: number, el: string): CState {
  return { ...s, atoms: s.atoms.map((a) => (a.id === atomId ? { ...a, el } : a)) }
}

export function removeAtom(s: CState, atomId: number): CState {
  return { atoms: s.atoms.filter((a) => a.id !== atomId), bonds: s.bonds.filter((b) => b.a !== atomId && b.b !== atomId), nextId: s.nextId }
}

export function removeBond(s: CState, bondId: number): CState {
  return { ...s, bonds: s.bonds.filter((b) => b.id !== bondId) }
}

export function moveAtom(s: CState, atomId: number, x: number, y: number): CState {
  return { ...s, atoms: s.atoms.map((a) => (a.id === atomId ? { ...a, x, y } : a)) }
}

// ───────────────────────── направление новой связи ─────────────────────────

const angleOf = (from: CAtom, to: CAtom) => Math.atan2(to.y - from.y, to.x - from.x)
const normA = (a: number) => ((a % TAU) + TAU) % TAU

/** Середина самого широкого свободного сектора вокруг атома. */
function freeGap(angles: number[]): number {
  const s = angles.map(normA).sort((p, q) => p - q)
  let best = 0, gap = -1
  for (let i = 0; i < s.length; i++) {
    const a = s[i], b = i + 1 < s.length ? s[i + 1] : s[0] + TAU
    if (b - a > gap + 1e-9) { gap = b - a; best = a + (b - a) / 2 }
  }
  return best
}

/**
 * Угол новой связи от атома: «красивый» школьный рисунок.
 * 0 соседей — вверх-вправо (−30°); 1 сосед — зигзаг (120°, в сторону, противоположную предыдущему изгибу),
 * у тройной связи или =C= — по прямой; 2–3 соседа — середина самого широкого свободного сектора.
 */
export function growAngle(s: CState, atomId: number): number {
  const at = atomById(s, atomId)
  if (!at) return -30 * DEG
  const nb = neighbors(s, atomId).map((id) => atomById(s, id)!).filter(Boolean)
  if (!nb.length) return -30 * DEG
  const linear = s.bonds.some((b) => (b.a === atomId || b.b === atomId) && b.o === 3)
    || s.bonds.filter((b) => (b.a === atomId || b.b === atomId) && b.o === 2).length >= 2
  if (nb.length === 1) {
    const back = angleOf(at, nb[0])
    if (linear) return back + Math.PI
    // зигзаг: смотрим, куда повернула цепь у соседа
    const prev = nb[0]
    const pn = neighbors(s, prev.id).filter((id) => id !== atomId).map((id) => atomById(s, id)!).filter(Boolean)
    const c1 = back + 120 * DEG, c2 = back - 120 * DEG
    if (pn.length) {
      // кандидат, у которого новый атом окажется по другую сторону линии prev–at, чем сосед соседа (транс-зигзаг)
      const side = (px: number, py: number) => (at.x - prev.x) * (py - prev.y) - (at.y - prev.y) * (px - prev.x)
      const sPrev = side(pn[0].x, pn[0].y)
      const p1 = { x: at.x + Math.cos(c1), y: at.y + Math.sin(c1) }
      return Math.sign(side(p1.x, p1.y)) !== Math.sign(sPrev) ? c1 : c2
    }
    // предпочитаем «вверх-вправо / вниз-вправо», чтобы цепь росла слева направо
    return Math.cos(c1) >= Math.cos(c2) - 1e-6 ? c1 : c2
  }
  const angs = nb.map((n) => angleOf(at, n))
  if (nb.length === 2) {
    // треугольник sp³ на рисунке: третья связь — против биссектрисы
    return freeGap(angs)
  }
  return freeGap(angs)
}

/** Привязка угла к сетке 30° (для перетаскивания новой связи). */
export const snapAngle = (a: number): number => Math.round(a / (30 * DEG)) * 30 * DEG

/** Рост цепи: новый атом `el` по «красивому» направлению (или по углу `angle`), связь кратности 1. */
export function growFrom(s: CState, atomId: number, el = 'C', angle?: number): { state: CState; id: number } {
  const at = atomById(s, atomId)
  if (!at) return { state: s, id: -1 }
  const ang = angle ?? growAngle(s, atomId)
  const r = addAtom(s, at.x + Math.cos(ang), at.y + Math.sin(ang), el)
  return { state: addBond(r.state, atomId, r.id), id: r.id }
}

/** Атом в радиусе `r` от точки (ближайший) или undefined. */
export function atomNear(s: CState, x: number, y: number, r: number, except?: number): CAtom | undefined {
  let best: CAtom | undefined, bd = r * r
  for (const a of s.atoms) {
    if (a.id === except) continue
    const d = (a.x - x) ** 2 + (a.y - y) ** 2
    if (d <= bd) { bd = d; best = a }
  }
  return best
}

// ───────────────────────── группы палитры ─────────────────────────

/** Правильный n-угольник со стороной 1: первая вершина в `start`, центр — в направлении `dir` от неё. */
function ringPoints(n: number, sx: number, sy: number, dir: number): { x: number; y: number }[] {
  const R = 1 / (2 * Math.sin(Math.PI / n))
  const cx = sx + R * Math.cos(dir), cy = sy + R * Math.sin(dir)
  const a0 = dir + Math.PI
  return Array.from({ length: n }, (_, k) => ({ x: cx + R * Math.cos(a0 + (k * TAU) / n), y: cy + R * Math.sin(a0 + (k * TAU) / n) }))
}

/**
 * Добавить группу к атому (`atomId`) или отдельно в точке (x, y).
 * –OH, –NH₂, –CH₃ — один атом; –CHO — C(=O); –COOH — C(=O)O; –NO₂ — N(=O)=O (движок сам переводит в N⁺–O⁻);
 * бензол — кольцо с чередованием 1/2; циклы C3–C6 — кольца из C. Отдельно стоящая функциональная группа
 * получает свой атом C (клик по пустому месту с «–OH» даёт CH₃–OH).
 */
export function attachGroup(s0: CState, key: GroupKey, atomId: number | null, x = 0, y = 0): { state: CState; id: number } {
  let s = s0
  let anchor = atomId
  const ringN = key === 'benzene' ? 6 : key === 'c3' ? 3 : key === 'c4' ? 4 : key === 'c5' ? 5 : key === 'c6' ? 6 : 0
  if (ringN) {
    let pts: { x: number; y: number }[]
    let first: number
    if (anchor !== null && atomById(s, anchor)) {
      const at = atomById(s, anchor)!
      const ang = growAngle(s, anchor)
      const sx = at.x + Math.cos(ang), sy = at.y + Math.sin(ang)
      pts = ringPoints(ringN, sx, sy, ang)
    } else {
      // свободное кольцо: центр в точке клика, «плоское» дно
      const R = 1 / (2 * Math.sin(Math.PI / ringN))
      pts = ringPoints(ringN, x, y + R, -Math.PI / 2)
      anchor = null
    }
    const ids: number[] = []
    for (const p of pts) { const r = addAtom(s, p.x, p.y, 'C'); s = r.state; ids.push(r.id) }
    for (let k = 0; k < ringN; k++) s = addBond(s, ids[k], ids[(k + 1) % ringN], key === 'benzene' && k % 2 === 0 ? 2 : 1)
    if (anchor !== null) s = addBond(s, anchor, ids[0])
    first = ids[0]
    return { state: s, id: first }
  }
  if (anchor === null || !atomById(s, anchor)) {
    const r = addAtom(s, x, y, 'C')
    s = r.state
    anchor = r.id
    if (key === 'CH3') return { state: s, id: r.id }
  }
  const el = key === 'OH' ? 'O' : key === 'NH2' || key === 'NO2' ? 'N' : 'C'
  const g = growFrom(s, anchor, el)
  s = g.state
  if (key === 'CHO' || key === 'COOH' || key === 'NO2') {
    const o1 = growFrom(s, g.id, 'O')
    s = setBondOrder(o1.state, bondBetween(o1.state, g.id, o1.id)!.id, 2)
    const o2 = growFrom(s, g.id, 'O')
    s = o2.state
    if (key === 'CHO') s = removeAtom(s, o2.id)
    if (key === 'NO2') s = setBondOrder(s, bondBetween(s, g.id, o2.id)!.id, 2)
  }
  return { state: s, id: g.id }
}

// ───────────────────────── в граф движка ─────────────────────────

export interface SkeletonWithMap {
  readonly graph: SkeletonGraph
  /** индекс атома графа → id атома рисунка */
  readonly ids: readonly number[]
  readonly index: ReadonlyMap<number, number>
}

/** Связи, лежащие в каком-нибудь цикле (мост-тест: без этой связи концы всё ещё связаны). */
export function ringBondIds(s: CState): Set<number> {
  const out = new Set<number>()
  const adj = new Map<number, { to: number; bond: number }[]>()
  for (const a of s.atoms) adj.set(a.id, [])
  for (const b of s.bonds) { adj.get(b.a)?.push({ to: b.b, bond: b.id }); adj.get(b.b)?.push({ to: b.a, bond: b.id }) }
  // мосты — алгоритм Тарьяна; всё, что не мост, лежит в цикле
  const tin = new Map<number, number>(), low = new Map<number, number>()
  let t = 0
  const bridges = new Set<number>()
  const dfs = (v: number, pb: number) => {
    tin.set(v, t); low.set(v, t); t++
    for (const e of adj.get(v) ?? []) {
      if (e.bond === pb) continue
      if (tin.has(e.to)) low.set(v, Math.min(low.get(v)!, tin.get(e.to)!))
      else {
        dfs(e.to, e.bond)
        low.set(v, Math.min(low.get(v)!, low.get(e.to)!))
        if (low.get(e.to)! > tin.get(v)!) bridges.add(e.bond)
      }
    }
  }
  for (const a of s.atoms) if (!tin.has(a.id)) dfs(a.id, -1)
  for (const b of s.bonds) if (!bridges.has(b.id)) out.add(b.id)
  return out
}

/**
 * Рисунок → SkeletonGraph движка. Цис/транс двойных связей вне циклов берётся из рисунка
 * (зигзаг C–C=C–C — транс, «буквой П» — цис), как в учебнике.
 */
export function toSkeleton(s: CState, opts: { cisTrans?: boolean } = {}): SkeletonWithMap {
  const index = new Map<number, number>()
  s.atoms.forEach((a, i) => index.set(a.id, i))
  const g: SkeletonGraph = {
    atoms: s.atoms.map((a) => ({ el: a.el, x: a.x, y: a.y })),
    bonds: s.bonds.map((b) => ({ a: index.get(b.a)!, b: index.get(b.b)!, o: b.o })),
  }
  if (opts.cisTrans === false) return { graph: g, ids: s.atoms.map((a) => a.id), index }
  const ring = ringBondIds(s)
  const ct = perceiveCisTrans(g)
  const bonds = ct.bonds.map((b, k) => (b.cisTrans && ring.has(s.bonds[k].id) ? { a: b.a, b: b.b, o: b.o } : b))
  return { graph: { atoms: g.atoms, bonds }, ids: s.atoms.map((a) => a.id), index }
}

/** SkeletonGraph (с x/y или без) → рисунок; без координат — раскладка layoutTree. */
export function fromSkeleton(g: SkeletonGraph): CState {
  let s: CState = EMPTY
  const ids: number[] = []
  g.atoms.forEach((a) => {
    if (a.el === 'H') { ids.push(-1); return }
    const r = addAtom(s, a.x ?? 0, a.y ?? 0, a.el)
    s = r.state
    ids.push(r.id)
  })
  for (const b of g.bonds) if (ids[b.a] > 0 && ids[b.b] > 0) s = addBond(s, ids[b.a], ids[b.b], b.o)
  return s
}

/** Ключ топологии (элементы + связи + цис/транс) — меняется только при изменении молекулы, а не при сдвиге атома. */
export function topologyKey(g: SkeletonGraph): string {
  return g.atoms.map((a) => a.el).join(',') + '|' + g.bonds.map((b) => `${b.a}.${b.b}.${b.o}${b.cisTrans ? b.cisTrans[0] : ''}`).join(',')
}
