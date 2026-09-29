/**
 * Модель вещества для ЕДИНОГО школьного 3D-вида (герой продукта в лаборатории и 3D карточки каталога).
 * Чистый модуль без three и React: его читает тест scripts/test-hero-style.mts.
 *
 * Откуда берётся строение (по приоритету):
 *  1. кристалл из heroStructures (NaCl, MgO, Al₂O₃, SiO₂, PbO) — фрагмент из целых ячеек (heroGeometry);
 *  2. молекула школьной сцены (scenes/<id>/<id>Spec: продукты, затем реагенты) — координаты сцены в пм,
 *     кратность связи = число общих пар (CO — тройная, NO — двойная, NO₂ — N=O и N→O, N₂O — N≡N→O,
 *     HNO₃ и N₂O₅ — как в сцене);
 *  3. молекула по ядру: H₂SO₄ (REAGENT_GEOMETRY.h2so4: две S=O и две S–OH), CH₄, NH₃ (BOND_DATA,
 *     BOND_ANGLES), H₂O₂, Mn₂O₇, Cl₂O₇ (heroStructures → heroGeometry);
 *  4. остальные вещества — геометрия каталога (atoms/bonds): масштаб восстанавливается по ковалентным
 *     радиусам ядра, кратность — повтор пары в bonds (органика) или правило валентности (см. inferOrders).
 *
 * Поза (screenPose) — как молекула стоит в итоге школьной сцены: линейная — по горизонтали, плоская — в
 * плоскости экрана, объёмная — в ракурсе.
 *
 * Шары — 0,62 ковалентного радиуса Кордеро (SCHOOL_DRAW.ballScale, как в школьной сцене); у ионов
 * решётки — ионный радиус Шеннона (как у героя и сцены NaCl). Координаты — мир кино-ядра (pmToScene),
 * центр геометрии — в начале координат.
 */
import {
  ATOMIC_DATA,
  bondAngleDeg,
  bondLengthPm,
  radiusForSpecies,
  reagentAngleDeg,
  reagentBondPm,
  type ElementSymbol,
} from '../../../chemistry/data'
import { pmToScene, speciesLabel } from '../../../lab/cinema/scenes/kit/cpkAtoms'
import type { SchoolMoleculeSpec, SchoolSceneSpec } from '../../../lab/cinema/scenes/school/schoolSpec'
import { SCHOOL_DRAW } from '../../../lab/cinema/scenes/school/schoolModel'
import { CO_SCHOOL_SPEC } from '../../../lab/cinema/scenes/co/coSpec'
import { CO2_SCHOOL_SPEC } from '../../../lab/cinema/scenes/co2/co2Spec'
import { H2O_SPEC } from '../../../lab/cinema/scenes/h2o/h2oSpec'
import { N2O_SCENE_SPEC } from '../../../lab/cinema/scenes/n2o/n2oSpec'
import { N2O5_SCENE_SPEC } from '../../../lab/cinema/scenes/n2o5/n2o5Spec'
import { NO_SCENE_SPEC } from '../../../lab/cinema/scenes/no/noSpec'
import { NO2_SCENE_SPEC } from '../../../lab/cinema/scenes/no2/no2Spec'
import { SO2_SCHOOL_SPEC } from '../../../lab/cinema/scenes/so2/so2Spec'
import { SO3_SCHOOL_SPEC } from '../../../lab/cinema/scenes/so3/so3Spec'
import { buildHeroModel } from './heroGeometry'

export type V3 = [number, number, number]

export type SchoolHeroAtom = {
  el: ElementSymbol
  /** подпись в шаре: символ (молекула) или символ с зарядом иона (Na⁺, Cl⁻) */
  label: string
  charge: number
  /** центр, мир */
  pos: V3
  /** радиус шара, мир */
  r: number
  /** радиус частицы, пм (ковалентный Кордеро или ионный Шеннон) */
  radiusPm: number
}

export type SchoolHeroBond = {
  a: number
  b: number
  /** число палочек: 1 — одинарная, 2 — двойная, 3 — тройная */
  order: number
}

export type SchoolHeroSource = 'crystal' | 'school' | 'core' | 'catalog'

export type SchoolHeroModel = {
  compoundId: string
  kind: 'molecule' | 'crystal'
  source: SchoolHeroSource
  atoms: SchoolHeroAtom[]
  bonds: SchoolHeroBond[]
  /** рёбра ячеек (кристалл), мир */
  cellEdges: [V3, V3][]
  /** радиус описанной сферы (с шарами), мир */
  radius: number
  /** начальная поза: наклон и рыскание (порядок YXZ — как rotYX школьной сцены) */
  pitch: number
  yaw: number
  /** 'sway' — покачивание молекулы вокруг начальной позы, 'orbit' — медленный облёт кристалла */
  motion: 'sway' | 'orbit'
  /** у кристалла — подпись под моделью (a, группа, КЧ) */
  caption: string[]
}

/** Мировых единиц на пикометр (1 Å = 0,285 — как у сцен). */
const K = pmToScene(1)

/** Радиус шара молекулы: 0,62 ковалентного (как у школьной сцены), мир. */
export function schoolBallRadius(el: ElementSymbol): number {
  return radiusForSpecies(el, 0, { model: 'covalent' }) * SCHOOL_DRAW.ballScale * K
}

function covalentAtom(el: ElementSymbol, pm: readonly number[]): SchoolHeroAtom {
  const radiusPm = radiusForSpecies(el, 0, { model: 'covalent' })
  return { el, label: el, charge: 0, pos: [pm[0]! * K, pm[1]! * K, pm[2]! * K], r: radiusPm * SCHOOL_DRAW.ballScale * K, radiusPm }
}

function centerAndBound(atoms: SchoolHeroAtom[], edges: [V3, V3][] = []): number {
  if (atoms.length === 0) return 1
  const c = [0, 0, 0]
  for (const a of atoms) for (let k = 0; k < 3; k++) c[k]! += a.pos[k]!
  for (let k = 0; k < 3; k++) c[k]! /= atoms.length
  for (const a of atoms) for (let k = 0; k < 3; k++) a.pos[k]! -= c[k]!
  for (const e of edges) for (const p of e) for (let k = 0; k < 3; k++) p[k]! -= c[k]!
  let r = 0
  for (const a of atoms) r = Math.max(r, Math.hypot(a.pos[0], a.pos[1], a.pos[2]) + a.r)
  for (const [p, q] of edges) r = Math.max(r, Math.hypot(p[0], p[1], p[2]), Math.hypot(q[0], q[1], q[2]))
  return Math.max(r, 1e-6)
}

/**
 * Поза молекулы на экране (как в конце школьной сцены): ЛИНЕЙНАЯ — ось по горизонтали, ПЛОСКАЯ — в плоскости
 * экрана (лёгкий наклон, чтобы читался объём шаров), объёмная — ракурс (pitch, yaw). Атомы при необходимости
 * поворачиваются на месте (центр уже в начале координат): ось линейной — на X, нормаль плоской — на Z.
 */
function screenPose(atoms: SchoolHeroAtom[], pitch3d: number, yaw3d: number): { pitch: number; yaw: number } {
  if (atoms.length < 2) return { pitch: 0, yaw: 0 }
  const P = atoms.map((a) => a.pos)
  const tol = 6 * K
  // Линейная: все атомы на прямой через первые два.
  const d = sub3(P[1]!, P[0]!)
  const dl = Math.hypot(d[0], d[1], d[2])
  if (dl > 1e-9) {
    const u: V3 = [d[0] / dl, d[1] / dl, d[2] / dl]
    const linear = P.every((p) => {
      const w = sub3(p, P[0]!)
      const t = dot3(w, u)
      return Math.hypot(w[0] - u[0] * t, w[1] - u[1] * t, w[2] - u[2] * t) < tol
    })
    if (linear) {
      rotateAtoms(atoms, u, [1, 0, 0])
      return { pitch: 0, yaw: 0 }
    }
  }
  // Плоская: нормаль по первым трём неколлинеарным атомам, остальные — в плоскости.
  let n: V3 | null = null
  for (let i = 1; i < P.length && !n; i++) {
    for (let j = i + 1; j < P.length && !n; j++) {
      const c = cross3(sub3(P[i]!, P[0]!), sub3(P[j]!, P[0]!))
      const cl = Math.hypot(c[0], c[1], c[2])
      if (cl > 1e-8) n = [c[0] / cl, c[1] / cl, c[2] / cl]
    }
  }
  if (n && P.every((p) => Math.abs(dot3(sub3(p, P[0]!), n!)) < tol)) {
    if (Math.abs(n[2]) < 0.985) rotateAtoms(atoms, n, [0, 0, 1])
    return { pitch: 0.14, yaw: 0 }
  }
  return { pitch: pitch3d, yaw: yaw3d }
}

const sub3 = (a: readonly number[], b: readonly number[]): V3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!]
const dot3 = (a: readonly number[], b: readonly number[]): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
const cross3 = (a: readonly number[], b: readonly number[]): V3 => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]

/** Поворот всех атомов (вокруг начала координат), переводящий единичный вектор from в to (Родригес). */
function rotateAtoms(atoms: SchoolHeroAtom[], from: V3, to: V3): void {
  const c = dot3(from, to)
  let axis = cross3(from, to)
  let s = Math.hypot(axis[0], axis[1], axis[2])
  let ang = Math.atan2(s, c)
  if (s < 1e-9) {
    if (c > 0) return
    // Противоположные: поворот на π вокруг любой перпендикулярной оси.
    axis = Math.abs(from[0]) < 0.9 ? cross3(from, [1, 0, 0]) : cross3(from, [0, 1, 0])
    s = Math.hypot(axis[0], axis[1], axis[2])
    ang = Math.PI
  }
  const k: V3 = [axis[0] / s, axis[1] / s, axis[2] / s]
  const cs = Math.cos(ang)
  const sn = Math.sin(ang)
  for (const a of atoms) {
    const v = a.pos
    const kv = cross3(k, v)
    const kd = dot3(k, v) * (1 - cs)
    a.pos = [v[0] * cs + kv[0] * sn + k[0] * kd, v[1] * cs + kv[1] * sn + k[1] * kd, v[2] * cs + kv[2] * sn + k[2] * kd]
  }
}

// ─── 1. Кристалл (heroStructures) ───────────────────────────────────────────

function fromCrystal(compoundId: string): SchoolHeroModel | null {
  const m = buildHeroModel(compoundId)
  if (!m || m.spec.kind !== 'crystal') return null
  const atoms: SchoolHeroAtom[] = m.atoms.map((a) => ({
    el: a.el,
    label: a.charge !== 0 ? speciesLabel(a.el, a.charge) : a.el,
    charge: a.charge,
    pos: [a.pos[0], a.pos[1], a.pos[2]],
    r: a.radius,
    radiusPm: a.radiusPm,
  }))
  const bonds = m.bonds.filter((b) => b.kind !== 'hbond').map((b) => ({ a: b.a, b: b.b, order: b.order }))
  const edges = m.cellEdges.map(([p, q]) => [[p[0], p[1], p[2]], [q[0], q[1], q[2]]] as [V3, V3])
  const radius = centerAndBound(atoms, edges)
  // Наклон верхом к зрителю и поворот — как у прежнего героя и решётки сцены NaCl (передача кадра).
  return { compoundId, kind: 'crystal', source: 'crystal', atoms, bonds, cellEdges: edges, radius, pitch: 0.32, yaw: 0.55, motion: 'orbit', caption: m.caption }
}

// ─── 2. Молекула школьной сцены ────────────────────────────────────────────

/** Сцены, из которых берутся молекулы (продукты — в позе конца сцены, реагенты — как на шаге reactants). */
export const SCHOOL_HERO_SCENES: readonly SchoolSceneSpec[] = [
  H2O_SPEC,
  CO2_SCHOOL_SPEC,
  CO_SCHOOL_SPEC,
  SO2_SCHOOL_SPEC,
  SO3_SCHOOL_SPEC,
  NO_SCENE_SPEC,
  NO2_SCENE_SPEC,
  N2O_SCENE_SPEC,
  N2O5_SCENE_SPEC,
]


type Composition = Record<string, number>

function compositionOfSchool(spec: SchoolSceneSpec, mol: SchoolMoleculeSpec): Composition {
  const out: Composition = {}
  for (const id of mol.atoms) {
    const el = spec.atoms.find((a) => a.id === id)?.element
    if (el) out[el] = (out[el] ?? 0) + 1
  }
  return out
}

function sameComposition(a: Composition, b: Composition): boolean {
  const ka = Object.keys(a).filter((k) => (a[k] ?? 0) > 0)
  const kb = Object.keys(b).filter((k) => (b[k] ?? 0) > 0)
  if (ka.length !== kb.length) return false
  return ka.every((k) => a[k] === b[k])
}

/** Молекула сцены с этим составом: сначала продукты, затем реагенты; null — нет такой. */
export function findSchoolMolecule(comp: Composition): { spec: SchoolSceneSpec; mol: SchoolMoleculeSpec; product: boolean } | null {
  for (const product of [true, false]) {
    for (const spec of SCHOOL_HERO_SCENES) {
      for (const mol of product ? spec.products : spec.reactants) {
        if (mol.atoms.length < 2) continue
        if (sameComposition(compositionOfSchool(spec, mol), comp)) return { spec, mol, product }
      }
    }
  }
  return null
}

function fromSchool(compoundId: string, comp: Composition): SchoolHeroModel | null {
  const hit = findSchoolMolecule(comp)
  if (!hit) return null
  const { spec, mol } = hit
  const idx = new Map<string, number>()
  const atoms: SchoolHeroAtom[] = mol.atoms.map((id, i) => {
    idx.set(id, i)
    const el = spec.atoms.find((a) => a.id === id)!.element as ElementSymbol
    return covalentAtom(el, mol.coords[id]!)
  })
  const bonds: SchoolHeroBond[] = mol.bonds.map((b) => ({ a: idx.get(b.a)!, b: idx.get(b.b)!, order: b.pairs.length }))
  const radius = centerAndBound(atoms)
  return { compoundId, kind: 'molecule', source: 'school', atoms, bonds, cellEdges: [], radius, ...screenPose(atoms, 0.16, 0.35), motion: 'sway', caption: [] }
}

// ─── 3. Молекула по ядру ────────────────────────────────────────────────────

type Vec = [number, number, number]
const vadd = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const vmul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k]
const deg = (d: number) => (d * Math.PI) / 180

/**
 * H₂SO₄ (газ, Kuczkowski 1981): искажённый тетраэдр вокруг S, ось C₂ — вертикаль. Две S=O в плоскости
 * экрана вверх (∠O=S=O), две S–OH в перпендикулярной плоскости вниз (∠HO–S–OH); H — под ∠S–O–H,
 * повёрнут к «своей» S=O (конформация C₂).
 */
function h2so4Core(): { atoms: SchoolHeroAtom[]; bonds: SchoolHeroBond[] } {
  const so = reagentBondPm('h2so4', 'S=O')
  const soh = reagentBondPm('h2so4', 'S–O(H)')
  const oh = reagentBondPm('h2so4', 'O–H')
  const a1 = deg(reagentAngleDeg('h2so4', '∠O=S=O'))
  const a2 = deg(reagentAngleDeg('h2so4', '∠HO–S–OH'))
  const th = deg(reagentAngleDeg('h2so4', '∠S–O–H'))
  const S: Vec = [0, 0, 0]
  const uO1: Vec = [Math.sin(a1 / 2), Math.cos(a1 / 2), 0]
  const uO2: Vec = [-Math.sin(a1 / 2), Math.cos(a1 / 2), 0]
  const uH1: Vec = [0, -Math.cos(a2 / 2), Math.sin(a2 / 2)]
  const uH2: Vec = [0, -Math.cos(a2 / 2), -Math.sin(a2 / 2)]
  const O1 = vmul(uO1, so)
  const O2 = vmul(uO2, so)
  const O3 = vmul(uH1, soh)
  const O4 = vmul(uH2, soh)
  // H: угол S–O–H = th к направлению O→S (−u), в плоскости (−u, ±x); x ⟂ u для обеих S–OH.
  const hOf = (O: Vec, u: Vec, side: number): Vec => {
    const v = vmul(u, -1)
    const w: Vec = [side, 0, 0]
    return vadd(O, vadd(vmul(v, oh * Math.cos(th)), vmul(w, oh * Math.sin(th))))
  }
  const H1 = hOf(O3, uH1, 1)
  const H2 = hOf(O4, uH2, -1)
  const atoms = [covalentAtom('S', S), covalentAtom('O', O1), covalentAtom('O', O2), covalentAtom('O', O3), covalentAtom('O', O4), covalentAtom('H', H1), covalentAtom('H', H2)]
  const bonds: SchoolHeroBond[] = [
    { a: 0, b: 1, order: 2 },
    { a: 0, b: 2, order: 2 },
    { a: 0, b: 3, order: 1 },
    { a: 0, b: 4, order: 1 },
    { a: 3, b: 5, order: 1 },
    { a: 4, b: 6, order: 1 },
  ]
  return { atoms, bonds }
}

/** AX₄ (CH₄) — правильный тетраэдр; AX₃E (NH₃) — пирамида с углом из ядра. Одна связь — вверх. */
function axnCore(center: ElementSymbol, lig: ElementSymbol, n: 3 | 4, bondKey: 'C-H' | 'N-H', angleKey: 'methane' | 'ammonia'): { atoms: SchoolHeroAtom[]; bonds: SchoolHeroBond[] } {
  const len = bondLengthPm(bondKey)
  const ang = deg(bondAngleDeg(angleKey))
  const atoms = [covalentAtom(center, [0, 0, 0])]
  const bonds: SchoolHeroBond[] = []
  if (n === 4) {
    // Одна C–H вверх, три — вниз под углом ang к ней, через 120° по азимуту.
    atoms.push(covalentAtom(lig, [0, len, 0]))
    for (let k = 0; k < 3; k++) {
      const phi = deg(90 + 120 * k)
      const s = Math.sin(Math.PI - ang)
      atoms.push(covalentAtom(lig, [len * s * Math.cos(phi), -len * Math.cos(Math.PI - ang), len * s * Math.sin(phi)]))
    }
  } else {
    // Пирамида: три N–H вниз, угол H–N–H = ang между любыми двумя. cos(ang) = cos²β·… → высота из тригонометрии.
    const sinB = (2 / Math.sqrt(3)) * Math.sin(ang / 2)
    const cosB = Math.sqrt(Math.max(0, 1 - sinB * sinB))
    for (let k = 0; k < 3; k++) {
      const phi = deg(90 + 120 * k)
      atoms.push(covalentAtom(lig, [len * sinB * Math.cos(phi), -len * cosB, len * sinB * Math.sin(phi)]))
    }
  }
  for (let i = 1; i < atoms.length; i++) bonds.push({ a: 0, b: i, order: 1 })
  if (n === 4) {
    // Вид вдоль оси S₄ (биссектриса двух C–H): четыре H — по углам квадрата вокруг C, ни один не за
    // атомом углерода и не перед ним (иначе одна связь пряталась за шаром C).
    const u1 = atoms[1]!.pos
    const u2 = atoms[2]!.pos
    const b: V3 = [u1[0] + u2[0], u1[1] + u2[1], u1[2] + u2[2]]
    const bl = Math.hypot(b[0], b[1], b[2])
    if (bl > 1e-9) rotateAtoms(atoms, [b[0] / bl, b[1] / bl, b[2] / bl], [0, 0, 1])
  }
  return { atoms, bonds }
}

function fromCore(compoundId: string, comp: Composition): SchoolHeroModel | null {
  let built: { atoms: SchoolHeroAtom[]; bonds: SchoolHeroBond[] } | null = null
  let pitch = 0.18
  let yaw = 0.42
  if (sameComposition(comp, { H: 2, S: 1, O: 4 })) built = h2so4Core()
  else if (sameComposition(comp, { C: 1, H: 4 })) {
    built = axnCore('C', 'H', 4, 'C-H', 'methane')
    pitch = 0.22
    // Без постоянного рыскания: задняя пара H лежит по горизонтали, и при рыскании 0,3 + покачивание 0,3
    // одна задняя H уходила за шар C. С одним покачиванием (±0,3) все четыре H видны всегда.
    yaw = 0
  }
  else if (sameComposition(comp, { N: 1, H: 3 })) {
    built = axnCore('N', 'H', 3, 'N-H', 'ammonia')
    pitch = 0.35
  } else {
    // H₂O₂, Mn₂O₇, Cl₂O₇: главная молекула героя heroStructures (длины, углы, двугранный угол — ядро).
    const m = buildHeroModel(compoundId)
    if (m && m.spec.kind === 'molecule') {
      const main = m.atoms.filter((a) => !a.neighbor)
      const pm = 1 / K
      built = {
        atoms: main.map((a) => covalentAtom(a.el, [a.pos[0] * pm, a.pos[1] * pm, a.pos[2] * pm])),
        bonds: m.bonds.filter((b) => b.kind !== 'hbond' && b.a < main.length && b.b < main.length).map((b) => ({ a: b.a, b: b.b, order: b.order })),
      }
      pitch = 0.12
      yaw = 0.3
    }
  }
  if (!built) return null
  const radius = centerAndBound(built.atoms)
  return { compoundId, kind: 'molecule', source: 'core', atoms: built.atoms, bonds: built.bonds, cellEdges: [], radius, ...screenPose(built.atoms, pitch, yaw), motion: 'sway', caption: [] }
}

// ─── 4. Геометрия каталога ─────────────────────────────────────────────────

export type CatalogShape = {
  readonly id: string
  readonly composition?: Readonly<Record<string, number>>
  readonly atoms: readonly { readonly symbol: string; readonly pos: readonly [number, number, number] }[]
  readonly bonds: readonly (readonly [number, number])[]
}

const NONMETAL = new Set(['H', 'B', 'C', 'N', 'O', 'F', 'Si', 'P', 'S', 'Cl', 'Se', 'Br', 'Te', 'I', 'Xe', 'As', 'Kr'])
/** Наибольшая валентность центра, при которой концевой O/S ещё добирает двойную связь. */
const MAX_VALENCE: Record<string, number> = { C: 4, N: 4, P: 5, S: 6, Se: 6, Te: 6, Cl: 7, Br: 7, I: 7, Xe: 8, As: 5 }
/** Обычная валентность (C, N, O) — для кратных связей между ними (N≡N, C=C, C≡N). */
const STD_VALENCE: Record<string, number> = { C: 4, N: 3, O: 2 }

/**
 * Кратность связей по валентности (только если в данных каталога её нет):
 *  • концевой O или S у неметалла-центра получает двойную связь, пока у центра остаётся валентность
 *    (CO₂ → O=C=O, SO₃ → три S=O, H₃PO₄ → одна P=O, HClO₄ → три Cl=O); у N — не больше одной N=O
 *    (HNO₃, нитраты: вторая N–O — донорно-акцепторная, одинарная палочка);
 *  • атомы C, N, O с недобранной валентностью достраивают кратную связь между собой (N≡N, C=C, C≡N).
 * Металлы (ионные контакты кластеров) и водород — всегда одинарные палочки.
 */
export function inferOrders(els: readonly string[], pairs: readonly (readonly [number, number])[]): number[] {
  const order = pairs.map(() => 1)
  const deg0 = els.map(() => 0)
  const nb: number[][] = els.map(() => [])
  pairs.forEach(([i, j], k) => {
    deg0[i]! += 1
    deg0[j]! += 1
    nb[i]!.push(k)
    nb[j]!.push(k)
  })
  const sum = (i: number) => nb[i]!.reduce((s, k) => s + order[k]!, 0)
  const doubles = (i: number) => nb[i]!.filter((k) => order[k]! >= 2).length
  // концевые халькогены у неметалла
  pairs.forEach(([i, j], k) => {
    for (const [t, c] of [[i, j], [j, i]] as const) {
      const te = els[t]!
      const ce = els[c]!
      if ((te !== 'O' && te !== 'S') || deg0[t] !== 1) continue
      if (!NONMETAL.has(ce) || ce === 'H' || ce === 'O') continue
      const max = MAX_VALENCE[ce]
      if (!max || sum(c) + 1 > max) continue
      if (ce === 'N' && doubles(c) >= 1) continue
      if (order[k] === 1) order[k] = 2
    }
  })
  // C, N, O: недобор валентности → кратная связь между ними
  const deficit = (i: number) => (STD_VALENCE[els[i]!] ?? 0) - sum(i)
  for (let pass = 0; pass < 3; pass++) {
    pairs.forEach(([i, j], k) => {
      if (!(els[i]! in STD_VALENCE) || !(els[j]! in STD_VALENCE)) return
      if (order[k]! >= 3) return
      if (deficit(i) > 0 && deficit(j) > 0) order[k]! += 1
    })
  }
  return order
}

function fromCatalog(shape: CatalogShape): SchoolHeroModel | null {
  const valid = shape.atoms.filter((a) => a.symbol in ATOMIC_DATA)
  if (valid.length === 0 || valid.length !== shape.atoms.length) return null
  // Кратность: повтор пары (органика, ручные модели) или правило валентности.
  const groups = new Map<string, { i: number; j: number; n: number }>()
  for (const [i, j] of shape.bonds) {
    if (!shape.atoms[i] || !shape.atoms[j] || i === j) continue
    const key = `${Math.min(i, j)}-${Math.max(i, j)}`
    const g = groups.get(key)
    if (g) g.n += 1
    else groups.set(key, { i: Math.min(i, j), j: Math.max(i, j), n: 1 })
  }
  const list = [...groups.values()]
  const els = shape.atoms.map((a) => a.symbol)
  const repeated = list.some((g) => g.n > 1)
  const orders = repeated ? list.map((g) => Math.min(3, g.n)) : inferOrders(els, list.map((g) => [g.i, g.j] as const))
  // Масштаб каталога → пм: медиана «длина / (r₁ + r₂)» по связям (кратные короче: × 0,9 и × 0,84).
  const ratios: number[] = []
  list.forEach((g, k) => {
    const p = shape.atoms[g.i]!.pos
    const q = shape.atoms[g.j]!.pos
    const len = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    const rr = radiusForSpecies(els[g.i] as ElementSymbol, 0, { model: 'covalent' }) + radiusForSpecies(els[g.j] as ElementSymbol, 0, { model: 'covalent' })
    const kk = orders[k]! >= 3 ? 0.84 : orders[k] === 2 ? 0.9 : 1
    if (len > 1e-6 && rr > 0) ratios.push(len / (rr * kk))
  })
  ratios.sort((a, b) => a - b)
  const unitsPerPm = ratios.length > 0 ? ratios[Math.floor(ratios.length / 2)]! : 0.0032
  const atoms = shape.atoms.map((a) => covalentAtom(a.symbol as ElementSymbol, [a.pos[0] / unitsPerPm, a.pos[1] / unitsPerPm, a.pos[2] / unitsPerPm]))
  const bonds = list.map((g, k) => ({ a: g.i, b: g.j, order: orders[k]! }))
  const radius = centerAndBound(atoms)
  return { compoundId: shape.id, kind: 'molecule', source: 'catalog', atoms, bonds, cellEdges: [], radius, ...screenPose(atoms, 0.16, 0.35), motion: 'sway', caption: [] }
}

// ─── Вход ──────────────────────────────────────────────────────────────────

function compositionOf(shape: CatalogShape): Composition {
  if (shape.composition) return { ...shape.composition }
  const out: Composition = {}
  for (const a of shape.atoms) out[a.symbol] = (out[a.symbol] ?? 0) + 1
  return out
}

const cache = new Map<string, SchoolHeroModel | null>()

/**
 * Модель единого школьного вида для вещества каталога / продукта лаборатории / органической молекулы.
 * shape — атомы и связи каталога (запасной путь 4); id — ключ кэша.
 */
export function buildSchoolHeroModel(shape: CatalogShape): SchoolHeroModel | null {
  const hit = cache.get(shape.id)
  if (hit !== undefined) return hit
  const comp = compositionOf(shape)
  const model = fromCrystal(shape.id) ?? fromSchool(shape.id, comp) ?? fromCore(shape.id, comp) ?? fromCatalog(shape)
  cache.set(shape.id, model)
  return model
}
