/**
 * Чистая раскладка «сцены реактора» научного маршрута (без WebGL):
 * ряд «реагенты → продукты» из настоящих формульных единиц + счёт атомов.
 * THREE не импортируется — функция тестируется в Node.
 *
 * Кроме веществ каталога член ряда может быть частицей реактора вне каталога
 * (src/data/labSpecies.ts): ион (Na⁺ — шар с зарядом, SO₄²⁻ — тетраэдр), электрон e⁻,
 * органическая молекула, простое вещество-продукт. Если в уравнении есть заряды,
 * к счёту атомов добавляется строка заряда (kind: 'charge').
 */
import type { ReactorEquationTerm } from '../../../chemistry/reactorEquationBalance'
import { ATOMIC_DATA, isElementSymbol as isCoreElementSymbol } from '../../../chemistry/data'
import { diatomicBondA } from '../../../chemistry/labSpeciesGeometry'
import { getElementBySymbol, getElementByZ } from '../../../data/elements'
import { ELECTRON_SPECIES_ID, labCompoundById as compoundById, labSpeciesKind } from '../../../data/labSpecies'
import {
  BOND_LENGTH_A,
  COVALENT_RADIUS_A,
  CPK,
  SCENE_PER_ANGSTROM,
} from '../../../lab/cinema/core/atoms'

export type StageVec3 = [number, number, number]

export type StageRoleSpec = {
  /** 'Cl' | 'O' | 'Na+' | 'Cl-' … — один InstancedMesh на роль */
  id: string
  symbol: string
  charge: number
  radius: number
  color: number
  glowColor: number
}

export type StageAtom = {
  unit: number
  role: string
  symbol: string
  /** позиция относительно центра формульной единицы */
  local: StageVec3
  radius: number
}

export type StageBond = { unit: number; a: number; b: number }

export type StageUnit = {
  /** стабильный ключ копии: `${termKey}#${copy}` — по нему анимируется появление */
  key: string
  termKey: string
  side: 'left' | 'right'
  center: StageVec3
  /** детерминированная фаза «покачивания» */
  phase: number
  atomStart: number
  atomCount: number
}

export type StageTermLabel = {
  key: string
  side: 'left' | 'right'
  coeff: number
  formula: string
  /** ионная запись для солей в растворе, напр. «Na⁺ ClO₂⁻» */
  ionFormula: string | null
  visibleCopies: number
  hiddenCopies: number
  center: StageVec3
  /** верх подписи — общая «базовая линия» ряда */
  labelPosition: StageVec3
  /** правый верхний угол кластера — для бэйджа «×N» */
  badgePosition: StageVec3
  clusterWidth: number
  clusterHeight: number
}

export type StageSeparator = { key: string; glyph: '+' | '→'; position: StageVec3 }

export type StageTallyRow = {
  symbol: string
  left: number
  right: number
  equal: boolean
  /** 'charge' — строка суммарного заряда (ионы, электроны); symbol у неё «±». */
  kind?: 'atom' | 'charge'
}

export type ScientificStageLayout = {
  roles: StageRoleSpec[]
  units: StageUnit[]
  atoms: StageAtom[]
  bonds: StageBond[]
  bondRadius: number
  terms: StageTermLabel[]
  separators: StageSeparator[]
  tally: { rows: StageTallyRow[]; equal: boolean }
  tallyPosition: StageVec3
  /** ширина ряда до масштабирования */
  width: number
  /** масштаб группы, чтобы ряд влез в кадр (≤ 1) */
  fitScale: number
}

/** Побочный продукт: вещество каталога (compoundId) или простое вещество (z, diatomic). */
export type StageCoProduct = {
  id: string
  coeff: number
  compoundId?: string
  z?: number
  diatomic?: boolean
}

/** Мир сцены = мир кино-сцены ×1.1: кино играет в группе ×0.78, превью чуть крупнее. */
const STAGE_WORLD_PER_ANGSTROM = SCENE_PER_ANGSTROM * 1.1
/**
 * Ручные геометрии каталога (catalogGeometryOverrides) заданы в единицах, где
 * Cl–O радикала 1.47 Å = 0.56 (у хлорита 1.57 Å = 0.60 — тот же масштаб),
 * поэтому один множитель сохраняет реальную разницу длин связей.
 */
const DATA_TO_WORLD = (1.47 / 0.56) * STAGE_WORLD_PER_ANGSTROM
/** Страховка для геометрий в другом масштабе (PubChem и т.п.). */
const MIN_BOND_WORLD = 0.38
const MAX_BOND_WORLD = 0.62

const BOND_RADIUS = 0.04
/** зазор между поверхностями разнесённых ионов (раствор, связи нет) */
const ION_GAP = 0.16
const COPY_GAP = 0.24
const ITEM_GAP = 0.3
const PLUS_WIDTH = 0.42
const ARROW_WIDTH = 0.95
const ROW_Y = 0.5
const MAX_ROW_WIDTH = 10.8
const LABEL_GAP = 0.2
const TALLY_DROP = 0.1
export const STAGE_MAX_VISIBLE_COPIES = 4

const ROLE_RADIUS: Record<string, number> = { Cl: 0.23, O: 0.15, 'Na+': 0.18, 'Cl-': 0.27 }

/** Заряды простых катионов — для ионной записи и радиусов в растворе. */
const CATION_CHARGE: Record<string, number> = {
  Li: 1, Na: 1, K: 1, Rb: 1, Cs: 1, Ag: 1,
  Mg: 2, Ca: 2, Sr: 2, Ba: 2, Zn: 2,
}

const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']
const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹']

function subscript(n: number): string {
  return n <= 1 ? '' : String(n).split('').map((d) => SUB[Number(d)]).join('')
}

function chargeText(q: number): string {
  if (q === 0) return ''
  const mag = Math.abs(q)
  const digits = mag === 1 ? '' : String(mag).split('').map((d) => SUP[Number(d)]).join('')
  return `${digits}${q > 0 ? '⁺' : '⁻'}`
}

function roleId(symbol: string, charge: number): string {
  if (charge === 0) return symbol
  const mag = Math.abs(charge)
  return `${symbol}${mag === 1 ? '' : mag}${charge > 0 ? '+' : '-'}`
}

/** Символ «атома»-электрона в раскладке (роль 'e-'): маленькая голубая частица. */
export const STAGE_ELECTRON_SYMBOL = 'e'
const ELECTRON_COLOR = 0x7fd4ff
const ELECTRON_RADIUS = 0.075

function colorFor(symbol: string): number {
  if (symbol === STAGE_ELECTRON_SYMBOL) return ELECTRON_COLOR
  const cpk = (CPK as Record<string, number>)[symbol]
  if (cpk != null) return cpk
  if (isCoreElementSymbol(symbol)) return ATOMIC_DATA[symbol].cpk
  const hex = getElementBySymbol(symbol)?.cpkHex
  const n = hex ? Number.parseInt(hex, 16) : Number.NaN
  return Number.isFinite(n) ? n : 0x99aabb
}

/** Ковалентный радиус, Å: кино-таблица, затем научное ядро (Li, Be, Ni, Rb, W …). */
function covalentA(symbol: string): number | null {
  const covA = (COVALENT_RADIUS_A as Record<string, number>)[symbol]
  if (covA != null) return covA
  return isCoreElementSymbol(symbol) ? ATOMIC_DATA[symbol].covalentRadiusPm / 100 : null
}

function radiusFor(symbol: string, charge: number): number {
  if (symbol === STAGE_ELECTRON_SYMBOL) return ELECTRON_RADIUS
  const fixed = ROLE_RADIUS[roleId(symbol, charge)]
  if (fixed != null) return fixed
  const covA = covalentA(symbol)
  const cov = covA != null ? Math.min(0.3, Math.max(0.1, covA * SCENE_PER_ANGSTROM * 0.72 * 1.1)) : 0.2
  if (charge > 0) return Math.min(cov, 0.18)
  if (charge < 0) return cov * 1.17
  return cov
}

function makeRole(symbol: string, charge: number): StageRoleSpec {
  const color = colorFor(symbol)
  return {
    id: roleId(symbol, charge),
    symbol,
    charge,
    radius: radiusFor(symbol, charge),
    color,
    // Как кромка CinemaAtom: катион теплее, анион холоднее.
    glowColor: charge > 0 ? 0xffd9a0 : charge < 0 ? 0x9be8ff : color,
  }
}

// ── векторная мелочь (без THREE) ────────────────────────────────────────────

type V = [number, number, number]
const sub3 = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot3 = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross3 = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const len3 = (a: V) => Math.hypot(a[0], a[1], a[2])

/** Поворот Родрига вокруг единичной оси. */
function rotate(v: V, k: V, angle: number): V {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const kv = cross3(k, v)
  const kd = dot3(k, v) * (1 - c)
  return [
    v[0] * c + kv[0] * s + k[0] * kd,
    v[1] * c + kv[1] * s + k[1] * kd,
    v[2] * c + kv[2] * s + k[2] * kd,
  ]
}

function rotateAll(pts: V[], from: V, to: V): V[] {
  const f = len3(from)
  if (f < 1e-9) return pts
  const u: V = [from[0] / f, from[1] / f, from[2] / f]
  const axis = cross3(u, to)
  const al = len3(axis)
  const d = Math.max(-1, Math.min(1, dot3(u, to)))
  if (al < 1e-9) {
    if (d > 0) return pts
    // антипараллельно — разворот на 180° вокруг любой перпендикулярной оси
    const perp: V = Math.abs(to[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
    const k0 = cross3(to, perp)
    const kl = len3(k0)
    const k: V = [k0[0] / kl, k0[1] / kl, k0[2] / kl]
    return pts.map((p) => rotate(p, k, Math.PI))
  }
  const k: V = [axis[0] / al, axis[1] / al, axis[2] / al]
  const angle = Math.acos(d)
  return pts.map((p) => rotate(p, k, angle))
}

/**
 * Разворачивает фрагмент плоскостью к камере (+z) и канонизирует угол в
 * плоскости: у изогнутых молекул центральный атом сверху («Λ»), так что
 * ClO₂⁻ реагента и ClO₂ продукта читаются одинаково.
 */
function orientFragment(pts: V[], bonds: readonly (readonly [number, number])[]): V[] {
  if (pts.length <= 1) return pts.map(() => [0, 0, 0])
  const n = pts.length
  const c: V = [0, 0, 0]
  for (const p of pts) {
    c[0] += p[0] / n
    c[1] += p[1] / n
    c[2] += p[2] / n
  }
  let out = pts.map((p) => sub3(p, c))

  let normal: V = [0, 0, 0]
  let best = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const cr = cross3(out[i]!, out[j]!)
      const m = len3(cr)
      if (m > best + 1e-9) {
        best = m
        normal = cr
      }
    }
  }

  let farIdx = 0
  for (let i = 1; i < n; i++) if (len3(out[i]!) > len3(out[farIdx]!) + 1e-9) farIdx = i
  const farLen = len3(out[farIdx]!)

  if (best < 1e-6 * Math.max(1e-6, farLen * farLen)) {
    // линейный фрагмент — вдоль x
    return rotateAll(out, out[farIdx]!, [1, 0, 0])
  }
  if (normal[2] < 0) normal = [-normal[0], -normal[1], -normal[2]]
  out = rotateAll(out, normal, [0, 0, 1])

  const degree = new Array<number>(n).fill(0)
  for (const [a, b] of bonds) {
    degree[a] = (degree[a] ?? 0) + 1
    degree[b] = (degree[b] ?? 0) + 1
  }
  let hub = 0
  for (let i = 1; i < n; i++) if (degree[i]! > degree[hub]!) hub = i

  let dir: V | null = null
  let target: V = [0, 1, 0]
  if (degree[hub]! >= 2) {
    const nb: V = [0, 0, 0]
    let cnt = 0
    for (const [a, b] of bonds) {
      const other = a === hub ? b : b === hub ? a : -1
      if (other < 0) continue
      nb[0] += out[other]![0]
      nb[1] += out[other]![1]
      cnt += 1
    }
    const v: V = [out[hub]![0] - nb[0] / cnt, out[hub]![1] - nb[1] / cnt, 0]
    if (Math.hypot(v[0], v[1]) > 1e-4) dir = v
  }
  if (!dir) {
    dir = [out[farIdx]![0], out[farIdx]![1], 0]
    target = [1, 0, 0]
  }
  const a0 = Math.atan2(dir[1], dir[0])
  const a1 = Math.atan2(target[1], target[0])
  return out.map((p) => rotate(p, [0, 0, 1], a1 - a0))
}

// ── формульная единица ──────────────────────────────────────────────────────

type UnitTemplate = {
  atoms: { symbol: string; charge: number; pos: V }[]
  bonds: [number, number][]
  width: number
  height: number
  ionFormula: string | null
}

function bboxOf(atoms: readonly { pos: V; r: number }[]) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const a of atoms) {
    minX = Math.min(minX, a.pos[0] - a.r)
    maxX = Math.max(maxX, a.pos[0] + a.r)
    minY = Math.min(minY, a.pos[1] - a.r)
    maxY = Math.max(maxY, a.pos[1] + a.r)
  }
  if (!Number.isFinite(minX)) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  return { minX, maxX, minY, maxY }
}

function finalizeTemplate(
  atoms: UnitTemplate['atoms'],
  bonds: UnitTemplate['bonds'],
  ionFormula: string | null,
): UnitTemplate {
  if (atoms.length === 0) return { atoms, bonds, width: 0.4, height: 0.4, ionFormula }
  const box = bboxOf(atoms.map((a) => ({ pos: a.pos, r: radiusFor(a.symbol, a.charge) })))
  const cx = (box.minX + box.maxX) / 2
  const cy = (box.minY + box.maxY) / 2
  const cz = atoms.reduce((s, a) => s + a.pos[2], 0) / atoms.length
  return {
    atoms: atoms.map((a) => ({ ...a, pos: [a.pos[0] - cx, a.pos[1] - cy, a.pos[2] - cz] })),
    bonds,
    width: box.maxX - box.minX,
    height: box.maxY - box.minY,
    ionFormula,
  }
}

function fragmentFormula(symbols: readonly string[]): string {
  const order: string[] = []
  const counts: Record<string, number> = {}
  for (const s of symbols) {
    if (!(s in counts)) order.push(s)
    counts[s] = (counts[s] ?? 0) + 1
  }
  return order.map((s) => `${s}${subscript(counts[s]!)}`).join('')
}

const templateCache = new Map<string, UnitTemplate>()

function compoundTemplate(compoundId: string): UnitTemplate | null {
  const cached = templateCache.get(compoundId)
  if (cached) return cached
  const compound = compoundById[compoundId]
  if (!compound) return null
  // Электрон: атомов нет — одна маленькая частица e⁻.
  if (compoundId === ELECTRON_SPECIES_ID) {
    const tpl = finalizeTemplate([{ symbol: STAGE_ELECTRON_SYMBOL, charge: -1, pos: [0, 0, 0] }], [], null)
    templateCache.set(compoundId, tpl)
    return tpl
  }
  // Простое вещество-продукт (O₂, Hg): тот же вид, что у простого вещества слева.
  if (labSpeciesKind(compoundId) === 'simple') {
    const [sym, count] = Object.entries(compound.composition)[0] ?? []
    const el = sym ? getElementBySymbol(sym) : undefined
    const tpl = el ? elementTemplate(el.z, count === 2) : null
    if (tpl) templateCache.set(compoundId, tpl)
    return tpl
  }
  const raw = compound.atoms
  const n = raw.length
  // Одноатомный ион (Na⁺, Cl⁻, Fe³⁺): шар с зарядом — радиус и кромка катиона/аниона.
  if (n === 1 && compound.charge) {
    const tpl = finalizeTemplate([{ symbol: raw[0]!.symbol, charge: compound.charge, pos: [0, 0, 0] }], [], null)
    templateCache.set(compoundId, tpl)
    return tpl
  }

  // Компоненты связности: ионы соли в растворе — отдельные фрагменты.
  const parent = raw.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
  for (const [a, b] of compound.bonds) {
    if (a < n && b < n) parent[find(a)] = find(b)
  }
  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    const g = groups.get(r)
    if (g) g.push(i)
    else groups.set(r, [i])
  }
  const fragments = [...groups.values()]

  // Заряды: только для солей с известным простым катионом.
  const isSalt = compound.category === 'salt' && fragments.length > 1
  const fragCharge = new Array<number>(fragments.length).fill(0)
  let ionic = false
  if (isSalt) {
    let q = 0
    const anionIdx: number[] = []
    fragments.forEach((f, fi) => {
      const sym = raw[f[0]!]!.symbol
      const cq = f.length === 1 ? CATION_CHARGE[sym] : undefined
      if (cq != null) {
        fragCharge[fi] = cq
        q += cq
      } else {
        anionIdx.push(fi)
      }
    })
    if (q > 0 && anionIdx.length > 0 && q % anionIdx.length === 0) {
      for (const fi of anionIdx) fragCharge[fi] = -q / anionIdx.length
      ionic = true
    } else {
      fragCharge.fill(0)
    }
  }

  // Масштаб: реальные пропорции из данных, но самая короткая связь в разумных пределах.
  let minBond = Infinity
  for (const [a, b] of compound.bonds) {
    const pa = raw[a]?.pos
    const pb = raw[b]?.pos
    if (pa && pb) minBond = Math.min(minBond, Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]))
  }
  let scale = DATA_TO_WORLD
  if (Number.isFinite(minBond) && minBond > 1e-6) {
    const w = minBond * scale
    if (w < MIN_BOND_WORLD) scale = MIN_BOND_WORLD / minBond
    else if (w > MAX_BOND_WORLD) scale = MAX_BOND_WORLD / minBond
  }

  // Катионы — слева (как в формуле NaClO₂), остальное в порядке данных.
  const orderIdx = fragments
    .map((_, fi) => fi)
    .sort((x, y) => Number(fragCharge[y]! > 0) - Number(fragCharge[x]! > 0) || x - y)

  const atoms: UnitTemplate['atoms'] = []
  const bonds: UnitTemplate['bonds'] = []
  let cursor = 0
  const ionParts: string[] = []
  for (const fi of orderIdx) {
    const f = fragments[fi]!
    const local = new Map<number, number>()
    f.forEach((gi, li) => local.set(gi, li))
    const fragBonds = compound.bonds
      .filter(([a, b]) => local.has(a) && local.has(b))
      .map(([a, b]) => [local.get(a)!, local.get(b)!] as const)
    const pts = orientFragment(
      f.map((gi) => {
        const p = raw[gi]!.pos
        return [p[0] * scale, p[1] * scale, p[2] * scale] as V
      }),
      fragBonds,
    )
    const monoCharge = f.length === 1 ? fragCharge[fi]! : 0
    const sized = f.map((gi, li) => ({
      symbol: raw[gi]!.symbol,
      charge: monoCharge,
      pos: pts[li]!,
      r: radiusFor(raw[gi]!.symbol, monoCharge),
    }))
    const box = bboxOf(sized)
    const start = atoms.length === 0 ? 0 : cursor + ION_GAP
    const dx = start - box.minX
    const dy = -(box.minY + box.maxY) / 2
    const base = atoms.length
    for (const a of sized) {
      atoms.push({ symbol: a.symbol, charge: a.charge, pos: [a.pos[0] + dx, a.pos[1] + dy, a.pos[2]] })
    }
    for (const [a, b] of fragBonds) bonds.push([base + a, base + b])
    cursor = start + (box.maxX - box.minX)

    if (ionic) {
      ionParts.push(`${fragmentFormula(f.map((gi) => raw[gi]!.symbol))}${chargeText(fragCharge[fi]!)}`)
    }
  }

  let ionFormula: string | null = null
  if (ionic) {
    // «Na⁺ Na⁺ SO₄²⁻» → «2Na⁺ SO₄²⁻»
    const grouped: { text: string; n: number }[] = []
    for (const p of ionParts) {
      const last = grouped[grouped.length - 1]
      if (last && last.text === p) last.n += 1
      else grouped.push({ text: p, n: 1 })
    }
    ionFormula = grouped.map((g) => `${g.n > 1 ? g.n : ''}${g.text}`).join(' ')
  }

  const tpl = finalizeTemplate(atoms, bonds, ionFormula)
  templateCache.set(compoundId, tpl)
  return tpl
}

function elementTemplate(z: number, diatomic: boolean): UnitTemplate | null {
  const el = getElementByZ(z)
  if (!el) return null
  const sym = el.symbol
  if (!diatomic) return finalizeTemplate([{ symbol: sym, charge: 0, pos: [0, 0, 0] }], [], null)
  // Длина связи X–X из научного ядра (H₂ 74 пм, N₂ 110 пм, I₂ 267 пм …).
  const bondA =
    sym === 'Cl' ? BOND_LENGTH_A.ClCl : sym === 'O' ? BOND_LENGTH_A.OO : (diatomicBondA(sym) ?? 1.5)
  const half = (bondA * STAGE_WORLD_PER_ANGSTROM) / 2
  return finalizeTemplate(
    [
      { symbol: sym, charge: 0, pos: [-half, 0, 0] },
      { symbol: sym, charge: 0, pos: [half, 0, 0] },
    ],
    [[0, 1]],
    null,
  )
}

function copyOffsets(n: number, cellW: number, cellH: number): V[] {
  switch (n) {
    case 0:
      return []
    case 1:
      return [[0, 0, 0]]
    case 2:
      return [
        [-0.14 * cellW, cellH / 2, -0.08],
        [0.14 * cellW, -cellH / 2, 0.08],
      ]
    case 3:
      return [
        [0, cellH / 2, -0.1],
        [-cellW / 2, -cellH / 2, 0.08],
        [cellW / 2, -cellH / 2, 0.08],
      ]
    default:
      return [
        [-cellW / 2, cellH / 2, -0.1],
        [cellW / 2, cellH / 2, -0.1],
        [-cellW / 2, -cellH / 2, 0.08],
        [cellW / 2, -cellH / 2, 0.08],
      ]
  }
}

function addComposition(into: Record<string, number>, order: string[], sym: string, n: number) {
  if (n <= 0) return
  if (!(sym in into)) {
    into[sym] = 0
    order.push(sym)
  }
  into[sym] += n
}

type RowTerm = {
  key: string
  side: 'left' | 'right'
  coeff: number
  formula: string
  template: UnitTemplate | null
  composition: Record<string, number>
  /** заряд формульной единицы (ион, электрон); 0 — нейтральная */
  charge: number
}

function clampCoeff(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

/**
 * Ряд «k₁A + k₂B → k₃C + k₄D» из настоящих формульных единиц: по копии на
 * единицу коэффициента (не больше 4), подписи, счёт атомов слева/справа.
 * Порядок продуктов как в SynthesisReactorPanel: сначала побочные, затем цель.
 */
export function scientificStageLayout(
  leftTerms: readonly ReactorEquationTerm[],
  coProducts: readonly StageCoProduct[],
  productId: string,
  productCoeff: number,
): ScientificStageLayout {
  const rowTerms: RowTerm[] = []

  for (const t of leftTerms) {
    if (t.compoundId) {
      const c = compoundById[t.compoundId]
      rowTerms.push({
        key: t.id,
        side: 'left',
        coeff: clampCoeff(t.coeff),
        formula: c?.formulaUnicode ?? t.compoundId,
        template: compoundTemplate(t.compoundId),
        composition: c?.composition ?? {},
        charge: c?.charge ?? 0,
      })
    } else {
      const el = getElementByZ(t.z)
      const sym = el?.symbol ?? '?'
      rowTerms.push({
        key: t.id,
        side: 'left',
        coeff: clampCoeff(t.coeff),
        formula: `${sym}${t.diatomic ? '₂' : ''}`,
        template: elementTemplate(t.z, Boolean(t.diatomic)),
        composition: el ? { [sym]: t.diatomic ? 2 : 1 } : {},
        charge: 0,
      })
    }
  }
  const pushCompound = (key: string, compoundId: string, coeff: number) => {
    const c = compoundById[compoundId]
    rowTerms.push({
      key,
      side: 'right',
      coeff: clampCoeff(coeff),
      formula: c?.formulaUnicode ?? compoundId,
      template: compoundTemplate(compoundId),
      composition: c?.composition ?? {},
      charge: c?.charge ?? 0,
    })
  }
  const pushElement = (key: string, z: number, diatomic: boolean, coeff: number) => {
    const el = getElementByZ(z)
    const sym = el?.symbol ?? '?'
    rowTerms.push({
      key,
      side: 'right',
      coeff: clampCoeff(coeff),
      formula: `${sym}${diatomic ? '₂' : ''}`,
      template: elementTemplate(z, diatomic),
      composition: el ? { [sym]: diatomic ? 2 : 1 } : {},
      charge: 0,
    })
  }
  for (const cp of coProducts) {
    if (cp.compoundId != null) pushCompound(cp.id, cp.compoundId, cp.coeff)
    else if (cp.z != null) pushElement(cp.id, cp.z, Boolean(cp.diatomic), cp.coeff)
  }
  if (productId) pushCompound(`product:${productId}`, productId, productCoeff)

  // ── ширины элементов ряда ──
  type Placed = RowTerm & {
    visible: number
    offsets: V[]
    unitW: number
    unitH: number
    clusterW: number
    clusterH: number
    clusterCx: number
    clusterCy: number
  }
  const placed: Placed[] = rowTerms.map((rt) => {
    const unitW = rt.template?.width ?? 0.4
    const unitH = rt.template?.height ?? 0.4
    const visible = Math.min(rt.coeff, STAGE_MAX_VISIBLE_COPIES)
    const offsets = copyOffsets(visible, unitW + COPY_GAP, unitH + COPY_GAP)
    let minX = -unitW / 2
    let maxX = unitW / 2
    let minY = -unitH / 2
    let maxY = unitH / 2
    if (offsets.length > 0) {
      minX = Math.min(...offsets.map((o) => o[0])) - unitW / 2
      maxX = Math.max(...offsets.map((o) => o[0])) + unitW / 2
      minY = Math.min(...offsets.map((o) => o[1])) - unitH / 2
      maxY = Math.max(...offsets.map((o) => o[1])) + unitH / 2
    }
    return {
      ...rt,
      visible,
      offsets,
      unitW,
      unitH,
      clusterW: maxX - minX,
      clusterH: maxY - minY,
      clusterCx: (minX + maxX) / 2,
      clusterCy: (minY + maxY) / 2,
    }
  })

  type Item = { kind: 'term'; term: Placed; width: number } | { kind: 'sep'; glyph: '+' | '→'; width: number; key: string }
  const items: Item[] = []
  placed.forEach((p, i) => {
    if (i > 0) {
      const prev = placed[i - 1]!
      const arrow = prev.side !== p.side
      items.push({
        kind: 'sep',
        glyph: arrow ? '→' : '+',
        width: arrow ? ARROW_WIDTH : PLUS_WIDTH,
        key: `sep:${prev.key}|${p.key}`,
      })
    }
    items.push({ kind: 'term', term: p, width: p.clusterW })
  })
  // Реагентов нет, но есть продукты — стрелка всё равно нужна перед ними.
  if (placed.length > 0 && placed[0]!.side === 'right') {
    items.unshift({ kind: 'sep', glyph: '→', width: ARROW_WIDTH, key: 'sep:start' })
  }

  const width = items.reduce((s, it) => s + it.width, 0) + Math.max(0, items.length - 1) * ITEM_GAP
  const fitScale = width > MAX_ROW_WIDTH ? MAX_ROW_WIDTH / width : 1
  const maxClusterH = placed.reduce((m, p) => Math.max(m, p.clusterH), 0.4)
  const labelY = ROW_Y - maxClusterH / 2 - LABEL_GAP

  const roles = new Map<string, StageRoleSpec>()
  const units: StageUnit[] = []
  const atoms: StageAtom[] = []
  const bonds: StageBond[] = []
  const terms: StageTermLabel[] = []
  const separators: StageSeparator[] = []

  let x = -width / 2
  for (const it of items) {
    const cx = x + it.width / 2
    if (it.kind === 'sep') {
      separators.push({ key: it.key, glyph: it.glyph, position: [cx, ROW_Y, 0] })
    } else {
      const p = it.term
      // центр кластера по x/y совпадает с точкой ряда
      const baseX = cx - p.clusterCx
      const baseY = ROW_Y - p.clusterCy
      p.offsets.forEach((o, copy) => {
        const tpl = p.template
        const unitIndex = units.length
        const atomStart = atoms.length
        if (tpl) {
          for (const a of tpl.atoms) {
            const role = makeRole(a.symbol, a.charge)
            if (!roles.has(role.id)) roles.set(role.id, role)
            atoms.push({
              unit: unitIndex,
              role: role.id,
              symbol: a.symbol,
              local: [a.pos[0], a.pos[1], a.pos[2]],
              radius: role.radius,
            })
          }
          for (const [a, b] of tpl.bonds) bonds.push({ unit: unitIndex, a: atomStart + a, b: atomStart + b })
        }
        units.push({
          key: `${p.key}#${copy}`,
          termKey: p.key,
          side: p.side,
          center: [baseX + o[0], baseY + o[1], o[2]],
          // золотой угол — соседние копии не качаются в унисон
          phase: (unitIndex * 2.399963) % (Math.PI * 2),
          atomStart,
          atomCount: atoms.length - atomStart,
        })
      })
      terms.push({
        key: p.key,
        side: p.side,
        coeff: p.coeff,
        formula: p.formula,
        ionFormula: p.template?.ionFormula ?? null,
        visibleCopies: p.visible,
        hiddenCopies: Math.max(0, p.coeff - p.visible),
        center: [cx, ROW_Y, 0],
        labelPosition: [cx, labelY, 0],
        badgePosition: [cx + p.clusterW / 2 + 0.14, ROW_Y + p.clusterH / 2 + 0.12, 0.2],
        clusterWidth: p.clusterW,
        clusterHeight: p.clusterH,
      })
    }
    x += it.width + ITEM_GAP
  }

  // ── счёт атомов ──
  const order: string[] = []
  const left: Record<string, number> = {}
  const right: Record<string, number> = {}
  const rightOrder: string[] = []
  for (const rt of rowTerms) {
    for (const [sym, n] of Object.entries(rt.composition)) {
      const k = Math.max(0, Math.floor(Number(n))) * rt.coeff
      if (rt.side === 'left') addComposition(left, order, sym, k)
      else addComposition(right, rightOrder, sym, k)
    }
  }
  for (const sym of rightOrder) if (!order.includes(sym)) order.push(sym)
  const rows: StageTallyRow[] = order.map((symbol) => {
    const l = left[symbol] ?? 0
    const r = right[symbol] ?? 0
    return { symbol, left: l, right: r, equal: l === r, kind: 'atom' }
  })
  // ── счёт зарядов (ионы, электроны): Ba²⁺ + SO₄²⁻ → BaSO₄ даёт «± 0 = 0» ──
  if (rowTerms.some((rt) => rt.charge !== 0)) {
    let ql = 0
    let qr = 0
    for (const rt of rowTerms) {
      if (rt.side === 'left') ql += rt.charge * rt.coeff
      else qr += rt.charge * rt.coeff
    }
    rows.push({ symbol: '±', left: ql, right: qr, equal: ql === qr, kind: 'charge' })
  }

  return {
    roles: [...roles.values()],
    units,
    atoms,
    bonds,
    bondRadius: BOND_RADIUS,
    terms,
    separators,
    tally: { rows, equal: rows.length > 0 && rows.every((r) => r.equal) },
    tallyPosition: [0, labelY - TALLY_DROP, 0],
    width,
    fitScale,
  }
}
