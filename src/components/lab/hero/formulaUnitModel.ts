/**
 * Модели 200 веществ каталога, которых нет в школьных сценах и героях-кристаллах (чистый модуль, пм).
 *
 *  • ИОННОЕ вещество (соль, щёлочь, основание, основный / амфотерный оксид, сульфид, гидрид металла …) — ФОРМУЛЬНАЯ
 *    ЕДИНИЦА из ионов: простые ионы — шары Шеннона с подписью заряда; многоатомные («корни»: SO₄²⁻, NO₃⁻, OH⁻,
 *    NH₄⁺ …) — «шар-палочка» по шаблону из ядра (REAGENT_GEOMETRY). Между ионами палочек нет: ион подводится к
 *    соседу до касания (катион — к атому O кислотного остатка на расстоянии r(катиона) + r(O²⁻) по Шеннону;
 *    OH⁻ и NH₄⁺ касаются как целое: 137 и 148 пм). Раскладка компактная и симметричная: пара, линия, треугольник,
 *    тетраэдр, бипирамида M₂X₃, шпинель M₃O₄; кристаллогидраты — вода у катиона, двойные соли — две единицы.
 *  • МОЛЕКУЛА (кислоты, оксиды и водородные соединения неметаллов, простые вещества) — длины и углы из ядра,
 *    кратность — по школьной графической формуле. Кислоты без газовой структуры (H₂SO₃, H₂CO₃ …) — кислотный
 *    остаток из ядра + H у кислорода (REAGENT_GEOMETRY.acidOH, помечено как схема).
 *
 * Модуль не знает о позе и мире сцены: schoolHeroModel переводит пм в мир и ставит ракурс.
 */
import {
  FORMAL_ANION_RADIUS_PM,
  POLYATOMIC_ION_RADIUS_PM,
  REAGENT_GEOMETRY,
  bondAngleDeg,
  bondLengthPm,
  radiusForSpecies,
  reagentAngleDeg,
  reagentBondPm,
  type BondKey,
  type ElementSymbol,
  type ReagentGeometryKey,
} from '../../../chemistry/data'
import { speciesLabel } from '../../../lab/cinema/scenes/kit/cpkAtoms'
import { SCHOOL_DRAW } from '../../../lab/cinema/scenes/school/schoolModel'

export type P3 = [number, number, number]

/** Доля ионного радиуса для шара иона (как у ionicFromCatalog: ионы почти касаются, щель 6 %). */
export const ION_BALL_SCALE = 0.94

export type UnitAtom = {
  el: ElementSymbol
  /** центр, пм */
  p: P3
  /** заряд простого иона (у атомов многоатомного иона — 0) */
  charge: number
  label: string
  /** радиус частицы, пм (ионный Шеннона или ковалентный Кордеро) */
  radiusPm: number
  /** радиус нарисованного шара, пм */
  drawPm: number
  /** радиус касания, пм (ион или атом O/S кислотного остатка); нет — атом не касается соседей */
  contact?: number
  /** номер иона/молекулы в ions */
  ion: number
}

export type UnitBond = { a: number; b: number; order: number }

export type SiteKind = 'edge' | 'face' | 'vertex' | 'side' | 'end'

export type UnitIon = {
  /** ключ шаблона: 'SO4', 'OH', 'Na+', 'H2O' … */
  key: string
  /** подпись: SO₄²⁻, Na⁺, H₂O */
  label: string
  charge: number
  /** индексы атомов модели */
  atoms: number[]
  /** ключ геометрии в ядре (REAGENT_GEOMETRY), если ион многоатомный */
  geometry?: ReagentGeometryKey
}

export type FormulaUnit = {
  compoundId: string
  kind: 'ionic' | 'molecule'
  atoms: UnitAtom[]
  bonds: UnitBond[]
  ions: UnitIon[]
  /** во сколько раз модель больше формулы (P₂O₅ → молекула P₄O₁₀: 2) */
  formulaMultiple: number
  /** ключи ядра, по которым построена модель (для подписи источников и теста) */
  geometry: ReagentGeometryKey[]
  /** пометка «схема» — что упрощено */
  schematic: string[]
}

// ─── векторы ────────────────────────────────────────────────────────────────

const add = (a: readonly number[], b: readonly number[]): P3 => [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!]
const sub = (a: readonly number[], b: readonly number[]): P3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!]
const mul = (a: readonly number[], k: number): P3 => [a[0]! * k, a[1]! * k, a[2]! * k]
const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
const cross = (a: readonly number[], b: readonly number[]): P3 => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]
const len = (a: readonly number[]) => Math.hypot(a[0]!, a[1]!, a[2]!)
const norm = (a: readonly number[]): P3 => {
  const l = len(a)
  return l > 1e-12 ? [a[0]! / l, a[1]! / l, a[2]! / l] : [1, 0, 0]
}
const rad = (d: number) => (d * Math.PI) / 180

type M3 = [P3, P3, P3]
const I3: M3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]
const mv = (m: M3, v: readonly number[]): P3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)]
const mm = (a: M3, b: M3): M3 => {
  const c = (j: number): P3 => [b[0][j]!, b[1][j]!, b[2][j]!]
  return [
    [dot(a[0], c(0)), dot(a[0], c(1)), dot(a[0], c(2))],
    [dot(a[1], c(0)), dot(a[1], c(1)), dot(a[1], c(2))],
    [dot(a[2], c(0)), dot(a[2], c(1)), dot(a[2], c(2))],
  ]
}
/** Поворот вокруг единичной оси k на угол t (Родригес). */
function rotAxis(k: P3, t: number): M3 {
  const c = Math.cos(t)
  const s = Math.sin(t)
  const v = 1 - c
  const [x, y, z] = k
  return [
    [c + x * x * v, x * y * v - z * s, x * z * v + y * s],
    [y * x * v + z * s, c + y * y * v, y * z * v - x * s],
    [z * x * v - y * s, z * y * v + x * s, c + z * z * v],
  ]
}
/** Поворот, переводящий единичный a в единичный b. */
function align(a: P3, b: P3): M3 {
  const c = dot(a, b)
  const ax = cross(a, b)
  const s = len(ax)
  if (s < 1e-9) {
    if (c > 0) return I3
    const perp = Math.abs(a[0]) < 0.9 ? norm(cross(a, [1, 0, 0])) : norm(cross(a, [0, 1, 0]))
    return rotAxis(perp, Math.PI)
  }
  return rotAxis(norm(ax), Math.atan2(s, c))
}

// ─── шаблоны ионов (кадр шаблона, центр — начало координат) ───────────────────

type TAtom = { el: ElementSymbol; p: P3; contact?: number }
type Site = { dir: P3; kind: SiteKind }
type Template = {
  key: string
  label: string
  charge: number
  geometry?: ReagentGeometryKey
  atoms: TAtom[]
  bonds: [number, number, number][]
  sites: Site[]
  /** направление, которое при стыковке по возможности смотрит вдоль глобальной оси up (нормаль плоского иона) */
  up?: P3
  schematic?: string
}

/** Радиус касания атома O / S в кислотном остатке — ион O²⁻ / S²⁻ по Шеннону (КЧ 6). */
const O_CONTACT = radiusForSpecies('O', -2, { model: 'ionic' })
const S_CONTACT = radiusForSpecies('S', -2, { model: 'ionic' })
const CL_CONTACT = radiusForSpecies('Cl', -1, { model: 'ionic' })

function contactOf(el: ElementSymbol): number | undefined {
  if (el === 'O') return O_CONTACT
  if (el === 'S') return S_CONTACT
  if (el === 'Cl') return CL_CONTACT
  return undefined
}

const TD: P3[] = (
  [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ] as P3[]
).map(norm)
const AXES: P3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]

function tdSites(): Site[] {
  return [...AXES.map((dir) => ({ dir, kind: 'edge' as const })), ...TD.map((v) => ({ dir: mul(v, -1), kind: 'face' as const })), ...TD.map((v) => ({ dir: v, kind: 'vertex' as const }))]
}

/** Тетраэдрический ион XO₄ (SO₄²⁻, PO₄³⁻, MnO₄⁻, CrO₄²⁻, ClO₄⁻): рёбра — по осям. */
function tetraIon(key: string, label: string, charge: number, center: ElementSymbol, lig: ElementSymbol, bondPm: number, geometry: ReagentGeometryKey): Template {
  const atoms: TAtom[] = [{ el: center, p: [0, 0, 0] }, ...TD.map((v) => ({ el: lig, p: mul(v, bondPm), contact: contactOf(lig) }))]
  return { key, label, charge, geometry, atoms, bonds: [1, 2, 3, 4].map((i) => [0, i, 1] as [number, number, number]), sites: tdSites(), up: [0, 0, 1] }
}

/** Пирамида XO₃ (AX₃E: SO₃²⁻, ClO₃⁻): неподелённая пара — вверх (+y), O — внизу. */
function pyramidIon(key: string, label: string, charge: number, center: ElementSymbol, bondPm: number, angleDeg: number, geometry: ReagentGeometryKey): Template {
  const sinB = (2 / Math.sqrt(3)) * Math.sin(rad(angleDeg) / 2)
  const cosB = Math.sqrt(Math.max(0, 1 - sinB * sinB))
  const dirs: P3[] = [0, 1, 2].map((k) => {
    const phi = rad(-90 + 120 * k)
    return [sinB * Math.cos(phi), -cosB, sinB * Math.sin(phi)]
  })
  const atoms: TAtom[] = [{ el: center, p: [0, 0, 0] }, ...dirs.map((d) => ({ el: 'O' as ElementSymbol, p: mul(d, bondPm), contact: O_CONTACT }))]
  const edges: Site[] = [0, 1, 2].map((k) => ({ dir: norm(add(dirs[k]!, dirs[(k + 1) % 3]!)), kind: 'edge' as const }))
  return { key, label, charge, geometry, atoms, bonds: [1, 2, 3].map((i) => [0, i, 1] as [number, number, number]), sites: [{ dir: [0, -1, 0], kind: 'face' }, ...edges], up: [0, 1, 0] }
}

/** Плоский треугольник XO₃ (CO₃²⁻, NO₃⁻, «SiO₃²⁻», PO₃⁻) в плоскости xy: O на 90°, 210°, 330°. */
function planarIon(key: string, label: string, charge: number, center: ElementSymbol, bondPm: number, geometry: ReagentGeometryKey): Template {
  const dirs: P3[] = [90, 210, 330].map((a) => [Math.cos(rad(a)), Math.sin(rad(a)), 0])
  const atoms: TAtom[] = [{ el: center, p: [0, 0, 0] }, ...dirs.map((d) => ({ el: 'O' as ElementSymbol, p: mul(d, bondPm), contact: O_CONTACT }))]
  const sites: Site[] = [270, 30, 150].map((a) => ({ dir: [Math.cos(rad(a)), Math.sin(rad(a)), 0] as P3, kind: 'edge' as const }))
  return { key, label, charge, geometry, atoms, bonds: [1, 2, 3].map((i) => [0, i, 1] as [number, number, number]), sites, up: [0, 0, 1] }
}

/** Угловой XO₂ (NO₂⁻, ClO₂⁻) в плоскости xy: O внизу, биссектриса — −y. */
function bentIon(key: string, label: string, charge: number, center: ElementSymbol, bondPm: number, angleDeg: number, geometry: ReagentGeometryKey): Template {
  const h = rad(angleDeg) / 2
  const dirs: P3[] = [
    [Math.sin(h), -Math.cos(h), 0],
    [-Math.sin(h), -Math.cos(h), 0],
  ]
  const atoms: TAtom[] = [{ el: center, p: [0, 0, 0] }, ...dirs.map((d) => ({ el: 'O' as ElementSymbol, p: mul(d, bondPm), contact: O_CONTACT }))]
  return {
    key,
    label,
    charge,
    geometry,
    atoms,
    bonds: [
      [0, 1, 1],
      [0, 2, 1],
    ],
    sites: [{ dir: [0, -1, 0], kind: 'edge' }, ...dirs.map((d) => ({ dir: d, kind: 'end' as const }))],
    up: [0, 0, 1],
  }
}

/** Двухатомный симметричный ион X₂ (O₂²⁻, O₂⁻, S₂²⁻, C₂²⁻) по оси x; касание — «сбоку». */
function dimerIon(key: string, label: string, charge: number, el: ElementSymbol, bondPm: number, order: number, geometry: ReagentGeometryKey, contact: number | undefined): Template {
  return {
    key,
    label,
    charge,
    geometry,
    atoms: [
      { el, p: [-bondPm / 2, 0, 0], contact },
      { el, p: [bondPm / 2, 0, 0], contact },
    ],
    bonds: [[0, 1, order]],
    sites: [
      { dir: [0, 1, 0], kind: 'side' },
      { dir: [0, -1, 0], kind: 'side' },
      { dir: [0, 0, 1], kind: 'side' },
      { dir: [0, 0, -1], kind: 'side' },
      { dir: [1, 0, 0], kind: 'end' },
      { dir: [-1, 0, 0], kind: 'end' },
    ],
    up: [0, 0, 1],
  }
}

/** Линейный O–M–O (школьные AlO₂⁻, ZnO₂²⁻). */
function linearTriIon(key: string, label: string, charge: number, center: ElementSymbol, bondPm: number, geometry: ReagentGeometryKey): Template {
  return {
    key,
    label,
    charge,
    geometry,
    atoms: [
      { el: center, p: [0, 0, 0] },
      { el: 'O', p: [bondPm, 0, 0], contact: O_CONTACT },
      { el: 'O', p: [-bondPm, 0, 0], contact: O_CONTACT },
    ],
    bonds: [
      [0, 1, 1],
      [0, 2, 1],
    ],
    sites: [
      { dir: [0, 1, 0], kind: 'side' },
      { dir: [0, -1, 0], kind: 'side' },
      { dir: [0, 0, 1], kind: 'side' },
      { dir: [0, 0, -1], kind: 'side' },
      { dir: [1, 0, 0], kind: 'end' },
      { dir: [-1, 0, 0], kind: 'end' },
    ],
    up: [0, 0, 1],
  }
}

/**
 * H у кислорода: O–H = len, ∠X–O–H = angle; азимут — тот, при котором H дальше всего от остальных атомов
 * (плоский остаток — только в его плоскости). Возвращает позицию H.
 */
function placeH(atoms: readonly { p: P3 }[], xIdx: number, oIdx: number, lenPm: number, angleDeg: number, planar: boolean): P3 {
  const O = atoms[oIdx]!.p
  const u = norm(sub(O, atoms[xIdx]!.p))
  const ref: P3 = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
  const w0 = norm(cross(u, ref))
  const w1 = cross(u, w0)
  const t = Math.PI - rad(angleDeg)
  let best: P3 = O
  let bestD = -Infinity
  const n = planar ? 2 : 24
  for (let k = 0; k < n; k++) {
    let w: P3
    if (planar) {
      // в плоскости xy: перпендикуляр к u в этой плоскости
      const inPlane = norm([-u[1], u[0], 0])
      w = k === 0 ? inPlane : mul(inPlane, -1)
    } else {
      const a = (2 * Math.PI * k) / n
      w = add(mul(w0, Math.cos(a)), mul(w1, Math.sin(a)))
    }
    const h = add(O, add(mul(u, lenPm * Math.cos(t)), mul(w, lenPm * Math.sin(t))))
    let d = Infinity
    atoms.forEach((a, i) => {
      if (i !== oIdx) d = Math.min(d, len(sub(a.p, h)))
    })
    if (d > bestD + 1e-6) {
      bestD = d
      best = h
    }
  }
  return best
}

const OH_LEN = reagentBondPm('acidOH', 'O–H')
const OH_ANGLE = reagentAngleDeg('acidOH', '∠Э–O–H')

function build(key: string): Template {
  switch (key) {
    case 'SO4':
      return tetraIon('SO4', 'SO₄²⁻', -2, 'S', 'O', reagentBondPm('sulfate', 'S–O'), 'sulfate')
    case 'PO4':
      return tetraIon('PO4', 'PO₄³⁻', -3, 'P', 'O', reagentBondPm('phosphate', 'P–O'), 'phosphate')
    case 'MnO4':
      return tetraIon('MnO4', 'MnO₄⁻', -1, 'Mn', 'O', reagentBondPm('permanganate', 'Mn–O'), 'permanganate')
    case 'MnO4_2':
      return tetraIon('MnO4_2', 'MnO₄²⁻', -2, 'Mn', 'O', reagentBondPm('manganate', 'Mn–O'), 'manganate')
    case 'CrO4':
      return tetraIon('CrO4', 'CrO₄²⁻', -2, 'Cr', 'O', reagentBondPm('chromate', 'Cr–O'), 'chromate')
    case 'ClO4':
      return tetraIon('ClO4', 'ClO₄⁻', -1, 'Cl', 'O', reagentBondPm('perchlorate', 'Cl–O'), 'perchlorate')
    case 'SO3':
      return pyramidIon('SO3', 'SO₃²⁻', -2, 'S', reagentBondPm('sulfite', 'S–O'), reagentAngleDeg('sulfite', '∠O–S–O'), 'sulfite')
    case 'ClO3':
      return pyramidIon('ClO3', 'ClO₃⁻', -1, 'Cl', reagentBondPm('chlorate', 'Cl–O'), reagentAngleDeg('chlorate', '∠O–Cl–O'), 'chlorate')
    case 'CO3':
      return planarIon('CO3', 'CO₃²⁻', -2, 'C', reagentBondPm('carbonate', 'C–O'), 'carbonate')
    case 'NO3':
      return planarIon('NO3', 'NO₃⁻', -1, 'N', reagentBondPm('nitrate', 'N–O'), 'nitrate')
    case 'SiO3': {
      const t = planarIon('SiO3', 'SiO₃²⁻', -2, 'Si', reagentBondPm('silicateSchool', 'Si–O'), 'silicateSchool')
      return { ...t, schematic: REAGENT_GEOMETRY.silicateSchool.schematic }
    }
    case 'PO3': {
      const t = planarIon('PO3', 'PO₃⁻', -1, 'P', reagentBondPm('metaphosphate', 'P–O'), 'metaphosphate')
      return { ...t, schematic: REAGENT_GEOMETRY.metaphosphate.schematic }
    }
    case 'NO2':
      return bentIon('NO2', 'NO₂⁻', -1, 'N', reagentBondPm('nitrite', 'N–O'), reagentAngleDeg('nitrite', '∠O–N–O'), 'nitrite')
    case 'ClO2':
      return bentIon('ClO2', 'ClO₂⁻', -1, 'Cl', reagentBondPm('chlorite', 'Cl–O'), reagentAngleDeg('chlorite', '∠O–Cl–O'), 'chlorite')
    case 'ClO': {
      const l = reagentBondPm('hypochlorite', 'Cl–O')
      return {
        key,
        label: 'ClO⁻',
        charge: -1,
        geometry: 'hypochlorite',
        atoms: [
          { el: 'Cl', p: [-l / 2, 0, 0], contact: CL_CONTACT },
          { el: 'O', p: [l / 2, 0, 0], contact: O_CONTACT },
        ],
        bonds: [[0, 1, 1]],
        sites: [
          { dir: [1, 0, 0], kind: 'end' },
          { dir: [0, 1, 0], kind: 'side' },
          { dir: [0, -1, 0], kind: 'side' },
        ],
        up: [0, 0, 1],
      }
    }
    case 'O2_2':
      return dimerIon('O2_2', 'O₂²⁻', -2, 'O', reagentBondPm('peroxide', 'O–O'), 1, 'peroxide', O_CONTACT)
    case 'O2_1':
      return dimerIon('O2_1', 'O₂⁻', -1, 'O', reagentBondPm('superoxide', 'O–O'), 1, 'superoxide', O_CONTACT)
    case 'S2':
      return dimerIon('S2', 'S₂²⁻', -2, 'S', reagentBondPm('disulfide', 'S–S'), 1, 'disulfide', S_CONTACT)
    case 'C2': {
      // У C в C₂²⁻ ионного радиуса нет: касание — по ван-дер-ваальсову радиусу C (Bondi, 170 пм), это оценка.
      const t = dimerIon('C2', 'C₂²⁻', -2, 'C', reagentBondPm('acetylide', 'C≡C'), 3, 'acetylide', 170)
      return { ...t, schematic: 'касание Ca²⁺ и C₂²⁻ — по ван-дер-ваальсову радиусу C (Bondi 170 пм): ионного радиуса у C в C₂²⁻ нет' }
    }
    case 'AlO2': {
      const t = linearTriIon('AlO2', 'AlO₂⁻', -1, 'Al', reagentBondPm('aluminateSchool', 'Al–O'), 'aluminateSchool')
      return { ...t, schematic: REAGENT_GEOMETRY.aluminateSchool.schematic }
    }
    case 'ZnO2': {
      const t = linearTriIon('ZnO2', 'ZnO₂²⁻', -2, 'Zn', reagentBondPm('zincateSchool', 'Zn–O'), 'zincateSchool')
      return { ...t, schematic: REAGENT_GEOMETRY.zincateSchool.schematic }
    }
    case 'OH': {
      const l = reagentBondPm('hydroxide', 'O–H')
      return {
        key,
        label: 'OH⁻',
        charge: -1,
        geometry: 'hydroxide',
        atoms: [
          { el: 'O', p: [0, 0, 0], contact: POLYATOMIC_ION_RADIUS_PM['OH-'] },
          { el: 'H', p: [l, 0, 0] },
        ],
        bonds: [[0, 1, 1]],
        sites: [
          { dir: [-1, 0, 0], kind: 'end' },
          { dir: [0, 1, 0], kind: 'side' },
        ],
        up: [0, 0, 1],
      }
    }
    case 'NH4': {
      const l = reagentBondPm('ammonium', 'N–H')
      return {
        key,
        label: 'NH₄⁺',
        charge: 1,
        geometry: 'ammonium',
        atoms: [{ el: 'N', p: [0, 0, 0], contact: POLYATOMIC_ION_RADIUS_PM['NH4+'] }, ...TD.map((v) => ({ el: 'H' as ElementSymbol, p: mul(v, l) }))],
        bonds: [1, 2, 3, 4].map((i) => [0, i, 1] as [number, number, number]),
        sites: TD.map((v) => ({ dir: v, kind: 'end' as const })),
        up: [0, 0, 1],
      }
    }
    case 'H2O': {
      const l = bondLengthPm('O-H')
      const h = rad(bondAngleDeg('water')) / 2
      return {
        key,
        label: 'H₂O',
        charge: 0,
        atoms: [
          { el: 'O', p: [0, 0, 0], contact: O_CONTACT },
          { el: 'H', p: [l * Math.sin(h), -l * Math.cos(h), 0] },
          { el: 'H', p: [-l * Math.sin(h), -l * Math.cos(h), 0] },
        ],
        bonds: [
          [0, 1, 1],
          [0, 2, 1],
        ],
        sites: [{ dir: [0, 1, 0], kind: 'end' }],
        up: [0, 0, 1],
      }
    }
    case 'HCO3': {
      const t = planarIon('HCO3', 'HCO₃⁻', -1, 'C', reagentBondPm('hydrogencarbonate', 'C–O'), 'hydrogencarbonate')
      const H = placeH(t.atoms, 0, 1, reagentBondPm('hydrogencarbonate', 'O–H'), reagentAngleDeg('hydrogencarbonate', '∠C–O–H'), true)
      t.atoms.push({ el: 'H', p: H })
      t.bonds.push([1, 4, 1])
      // касание — ребро между двумя O без H (O₂ и O₃, внизу)
      return { ...t, sites: [{ dir: [0, -1, 0], kind: 'edge' }], schematic: REAGENT_GEOMETRY.hydrogencarbonate.schematic }
    }
    case 'HSO4': {
      const t = tetraIon('HSO4', 'HSO₄⁻', -1, 'S', 'O', reagentBondPm('sulfate', 'S–O'), 'sulfate')
      const H = placeH(t.atoms, 0, 1, OH_LEN, OH_ANGLE, false)
      t.atoms.push({ el: 'H', p: H })
      t.bonds.push([1, 5, 1])
      // грань из трёх O без H — напротив вершины O₁
      return { ...t, sites: [{ dir: mul(TD[0]!, -1), kind: 'face' }, ...tdSites().filter((x) => x.kind === 'edge')], schematic: 'HSO₄⁻ — сульфат-ион + H у одного O (связь S–OH в кристалле длиннее: ≈156 пм)' }
    }
    case 'HPO4':
    case 'H2PO4': {
      const nH = key === 'HPO4' ? 1 : 2
      const pO = reagentBondPm('phosphoricAcid', 'P=O')
      const pOH = reagentBondPm('phosphoricAcid', 'P–O(H)')
      const atoms: TAtom[] = [{ el: 'P', p: [0, 0, 0] }, ...TD.map((v, i) => ({ el: 'O' as ElementSymbol, p: mul(v, i < nH ? pOH : pO), contact: O_CONTACT }))]
      const bonds: [number, number, number][] = [1, 2, 3, 4].map((i) => [0, i, 1])
      for (let i = 0; i < nH; i++) {
        const H = placeH(atoms, 0, 1 + i, OH_LEN, OH_ANGLE, false)
        atoms.push({ el: 'H', p: H })
        bonds.push([1 + i, atoms.length - 1, 1])
      }
      // первым — место у атомов O без H; дальше — остальные рёбра тетраэдра (для второго, третьего катиона)
      const sites: Site[] = [nH === 1 ? { dir: mul(TD[0]!, -1), kind: 'face' } : { dir: [-1, 0, 0], kind: 'edge' }, ...tdSites().filter((x) => x.kind === 'edge' && x.dir[0] !== -1)]
      return { key, label: nH === 1 ? 'HPO₄²⁻' : 'H₂PO₄⁻', charge: nH === 1 ? -2 : -1, geometry: 'phosphoricAcid', atoms, bonds, sites, up: [0, 0, 1], schematic: REAGENT_GEOMETRY.phosphoricAcid.schematic }
    }
    case 'Cr2O7':
    case 'P2O7': {
      const cr = key === 'Cr2O7'
      const g: ReagentGeometryKey = cr ? 'dichromate' : 'pyrophosphate'
      const center: ElementSymbol = cr ? 'Cr' : 'P'
      const term = reagentBondPm(g, cr ? 'Cr–O' : 'P–O')
      const bridge = reagentBondPm(g, cr ? 'Cr–O(мост)' : 'P–O(мост)')
      const ang = rad(reagentAngleDeg(g, cr ? '∠Cr–O–Cr' : '∠P–O–P'))
      // мостиковый O в начале координат, центры — ниже в плоскости xy
      const atoms: TAtom[] = [{ el: 'O', p: [0, 0, 0], contact: O_CONTACT }]
      const bonds: [number, number, number][] = []
      for (const s of [1, -1]) {
        const C: P3 = [s * bridge * Math.sin(ang / 2), -bridge * Math.cos(ang / 2), 0]
        const ci = atoms.push({ el: center, p: C }) - 1
        bonds.push([0, ci, 1])
        const u = norm(sub([0, 0, 0], C))
        // три концевых O: под 109,47° к направлению на мостик, «в заторможенной» позиции
        const w0 = norm(cross(u, [0, 0, 1]))
        const w1 = cross(u, w0)
        const t = rad(109.47)
        for (let k = 0; k < 3; k++) {
          const a = rad(180 + 120 * k)
          const w = add(mul(w0, Math.cos(a)), mul(w1, Math.sin(a)))
          const d = add(mul(u, Math.cos(t)), mul(w, Math.sin(t)))
          const oi = atoms.push({ el: 'O', p: add(C, mul(d, term)), contact: O_CONTACT }) - 1
          bonds.push([ci, oi, 1])
        }
      }
      return {
        key,
        label: cr ? 'Cr₂O₇²⁻' : 'P₂O₇⁴⁻',
        charge: cr ? -2 : -4,
        geometry: g,
        atoms,
        bonds,
        sites: [
          { dir: [0, 0, 1], kind: 'side' },
          { dir: [0, 0, -1], kind: 'side' },
          { dir: [0, -1, 0], kind: 'edge' },
          { dir: [0, 1, 0], kind: 'edge' },
        ],
        up: [0, 1, 0],
        schematic: REAGENT_GEOMETRY[g].schematic,
      }
    }
    case 'ZnOH4': {
      const zo = reagentBondPm('tetrahydroxozincate', 'Zn–O')
      const atoms: TAtom[] = [{ el: 'Zn', p: [0, 0, 0] }, ...TD.map((v) => ({ el: 'O' as ElementSymbol, p: mul(v, zo), contact: POLYATOMIC_ION_RADIUS_PM['OH-'] }))]
      const bonds: [number, number, number][] = [1, 2, 3, 4].map((i) => [0, i, 1])
      for (let i = 1; i <= 4; i++) {
        const H = placeH(atoms, 0, i, reagentBondPm('tetrahydroxozincate', 'O–H'), reagentAngleDeg('tetrahydroxozincate', '∠Zn–O–H'), false)
        atoms.push({ el: 'H', p: H })
        bonds.push([i, atoms.length - 1, 1])
      }
      return { key, label: '[Zn(OH)₄]²⁻', charge: -2, geometry: 'tetrahydroxozincate', atoms, bonds, sites: tdSites().filter((s) => s.kind === 'edge'), up: [0, 0, 1], schematic: REAGENT_GEOMETRY.tetrahydroxozincate.schematic }
    }
  }
  // простой ион: 'Na+', 'Ca2+', 'Cl-', 'O2-', 'C4-'
  const m = /^([A-Z][a-z]?)(\d?)([+-])$/.exec(key)
  if (!m) throw new Error(`formulaUnitModel: неизвестный ион «${key}»`)
  const el = m[1] as ElementSymbol
  const q = (m[3] === '+' ? 1 : -1) * Number(m[2] || 1)
  const r = key === 'C4-' ? FORMAL_ANION_RADIUS_PM['C4-'] : radiusForSpecies(el, q, { model: 'ionic' })
  return {
    key,
    label: speciesLabel(el, q),
    charge: q,
    atoms: [{ el, p: [0, 0, 0], contact: r }],
    bonds: [],
    sites: AXES.map((dir) => ({ dir, kind: 'side' as const })),
    schematic: key === 'C4-' ? 'C⁴⁻ — формальный ион (радиус Полинга 260 пм): в Al₄C₃ связь Al–C во многом ковалентна' : undefined,
  }
}

const templateCache = new Map<string, Template>()
/** Шаблон иона (кэш). Экспорт — для теста: геометрия корня = шаблону. */
export function ionTemplate(key: string): Template {
  let t = templateCache.get(key)
  if (!t) {
    t = build(key)
    templateCache.set(key, t)
  }
  return t
}

/** Радиус простого иона (Шеннон, КЧ 6; C⁴⁻ — Полинг), пм. */
function monoRadius(key: string): number {
  return ionTemplate(key).atoms[0]!.contact!
}

// ─── сборка ─────────────────────────────────────────────────────────────────

class Assembler {
  atoms: UnitAtom[] = []
  bonds: UnitBond[] = []
  ions: UnitIon[] = []
  geometry = new Set<ReagentGeometryKey>()
  schematic = new Set<string>()

  /** Атомы шаблона после поворота R и сдвига pos (без добавления). */
  private placed(t: Template, R: M3, pos: P3): { el: ElementSymbol; p: P3; contact?: number; drawPm: number }[] {
    const mono = t.atoms.length === 1 && t.charge !== 0
    return t.atoms.map((a) => ({ el: a.el, p: add(mv(R, a.p), pos), contact: a.contact, drawPm: mono ? a.contact! * ION_BALL_SCALE : radiusForSpecies(a.el, 0, { model: 'covalent' }) * SCHOOL_DRAW.ballScale }))
  }

  put(key: string, R: M3 = I3, pos: P3 = [0, 0, 0]): number {
    const t = ionTemplate(key)
    const mono = t.atoms.length === 1 && t.charge !== 0
    const base = this.atoms.length
    const ionIdx = this.ions.length
    const pl = this.placed(t, R, pos)
    pl.forEach((a) => {
      const radiusPm = mono ? a.contact! : radiusForSpecies(a.el, 0, { model: 'covalent' })
      this.atoms.push({ el: a.el, p: a.p, charge: mono ? t.charge : 0, label: mono ? t.label : a.el, radiusPm, drawPm: a.drawPm, contact: a.contact, ion: ionIdx })
    })
    for (const [a, b, o] of t.bonds) this.bonds.push({ a: base + a, b: base + b, order: o })
    this.ions.push({ key, label: t.label, charge: t.charge, atoms: pl.map((_, i) => base + i), geometry: t.geometry })
    if (t.geometry) this.geometry.add(t.geometry)
    if (t.schematic) this.schematic.add(t.schematic)
    return ionIdx
  }

  /** Расстояние касания двух атомов разных частиц, пм. */
  static contact(a: { contact?: number; drawPm: number }, b: { contact?: number; drawPm: number }): number {
    if (a.contact != null && b.contact != null) return a.contact + b.contact
    return a.drawPm + b.drawPm + 8
  }

  /**
   * Подвести ион по лучу anchor + t·d (из бесконечности к anchor) до первого касания с уже поставленными
   * атомами. site ориентации: направление шаблона, которое смотрит на anchor (−d); up — по возможности вдоль upPref.
   */
  dock(key: string, d: P3, site: P3 | null, upPref: P3 = [0, 0, 1], anchor: P3 = [0, 0, 0]): number {
    const t = ionTemplate(key)
    const R = orient(t, site, mul(d, -1), upPref)
    const pl = this.placed(t, R, [0, 0, 0])
    let tBest = 0
    for (const a of pl) {
      for (const b of this.atoms) {
        const c = Assembler.contact(a, b)
        const v = sub(add(anchor, a.p), b.p)
        const dv = dot(d, v)
        const disc = dv * dv - dot(v, v) + c * c
        if (disc < 0) continue
        tBest = Math.max(tBest, -dv + Math.sqrt(disc))
      }
    }
    return this.put(key, R, add(anchor, mul(d, tBest)))
  }

  /** Минимальный «зазор касания» между частицами i и j (≥ 0 — не перекрываются). */
  gap(i: number, j: number): number {
    let g = Infinity
    for (const a of this.ions[i]!.atoms) for (const b of this.ions[j]!.atoms) g = Math.min(g, len(sub(this.atoms[a]!.p, this.atoms[b]!.p)) - Assembler.contact(this.atoms[a]!, this.atoms[b]!))
    return g
  }
}

/** Поворот шаблона: site → target, up шаблона — как можно ближе к upPref (вращение вокруг target). */
function orient(t: Template, site: P3 | null, target: P3, upPref: P3): M3 {
  if (!site) return I3
  const R1 = align(norm(site), norm(target))
  if (!t.up) return R1
  const w = mv(R1, t.up)
  const tt = norm(target)
  const pw = sub(w, mul(tt, dot(w, tt)))
  const pu = sub(upPref, mul(tt, dot(upPref, tt)))
  if (len(pw) < 1e-6 || len(pu) < 1e-6) return R1
  const a = norm(pw)
  const b = norm(pu)
  const ang = Math.atan2(dot(cross(a, b), tt), dot(a, b))
  return mm(rotAxis(tt, ang), R1)
}

/** n направлений из списка сайтов с наибольшим наименьшим углом между ними (при равенстве — раньше в списке). */
function pickSites(sites: readonly Site[], n: number, kinds: readonly SiteKind[] = ['edge', 'face', 'side', 'end']): P3[] {
  const pool = sites.filter((s) => kinds.includes(s.kind))
  let best: number[] = []
  let bestMin = -Infinity
  const rec = (start: number, chosen: number[]) => {
    if (chosen.length === n) {
      let mn = Infinity
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) mn = Math.min(mn, Math.acos(Math.max(-1, Math.min(1, dot(pool[chosen[i]!]!.dir, pool[chosen[j]!]!.dir)))))
      if (n === 1) mn = 0
      if (mn > bestMin + 1e-9) {
        bestMin = mn
        best = [...chosen]
      }
      return
    }
    for (let i = start; i < pool.length; i++) rec(i + 1, [...chosen, i])
  }
  rec(0, [])
  return best.map((i) => pool[i]!.dir)
}

/** Направления для n соседей простого центрального иона: линия, треугольник, тетраэдр, октаэдр. */
function starDirs(n: number): P3[] {
  if (n === 1) return [[1, 0, 0]]
  if (n === 2)
    return [
      [1, 0, 0],
      [-1, 0, 0],
    ]
  if (n === 3) return [90, 210, 330].map((a) => [Math.cos(rad(a)), Math.sin(rad(a)), 0] as P3)
  if (n === 4) return TD
  return AXES.slice(0, n)
}

const isMono = (key: string) => /^[A-Z][a-z]?\d?[+-]$/.test(key)

/** Первый подходящий сайт шаблона для стыковки к центру. */
function firstSite(key: string, kinds: readonly SiteKind[] = ['edge', 'face', 'side', 'end']): P3 | null {
  const t = ionTemplate(key)
  if (isMono(key)) return null
  for (const k of kinds) {
    const s = t.sites.find((x) => x.kind === k)
    if (s) return s.dir
  }
  return null
}

/** Центр + n одинаковых соседей (1:n): центр — ион, которого один. */
function star(A: Assembler, center: string, sat: string, n: number): void {
  A.put(center)
  const dirs = isMono(center) ? starDirs(n) : pickSites(ionTemplate(center).sites, n)
  for (const d of dirs) A.dock(sat, d, firstSite(sat))
}

/**
 * Бипирамида M₂X₃ / M₃X₂: трое — кольцом в плоскости xy (радиус R), двое — на оси ±z, подведены до касания.
 * R — наименьший, при котором частицы не перекрываются, с минимальным описанным радиусом.
 */
function bipyramid(A: Assembler, ring: string, apex: string): void {
  let best: Assembler | null = null
  let bestR = Infinity
  const ringT = ionTemplate(ring)
  const r0 = isMono(ring) ? monoRadius(ring) : 60
  for (let R = r0 * 0.8; R < r0 * 6 + 600; R += 2) {
    const B = new Assembler()
    for (let k = 0; k < 3; k++) {
      const a = rad(90 + 120 * k)
      const radial: P3 = [Math.cos(a), Math.sin(a), 0]
      const rot = isMono(ring) ? I3 : orient(ringT, firstSite(ring, ['edge', 'side']), mul(radial, -1), [0, 0, 1])
      B.put(ring, rot, mul(radial, R))
    }
    if (B.gap(0, 1) < -1e-6) continue
    const siteApex = firstSite(apex, ['face', 'edge', 'side', 'end'])
    B.dock(apex, [0, 0, 1], siteApex, [1, 0, 0])
    B.dock(apex, [0, 0, -1], siteApex, [1, 0, 0])
    if (B.gap(3, 4) < -1e-6) continue
    let br = 0
    for (const a of B.atoms) br = Math.max(br, len(a.p) + a.drawPm)
    if (br < bestR - 0.5) {
      bestR = br
      best = B
    } else if (best) break
  }
  if (!best) throw new Error(`formulaUnitModel: бипирамида ${ring}/${apex} не собралась`)
  Object.assign(A, best)
}

/** Шпинель M₃O₄ (Fe₃O₄, Mn₃O₄): O²⁻ — тетраэдр касающихся ионов, катионы — над тремя гранями (M²⁺ и 2 M³⁺). */
function spinel(A: Assembler, el: 'Fe' | 'Mn'): void {
  const rO = monoRadius('O2-')
  const R = (2 * rO) * Math.sqrt(3 / 8)
  for (const v of TD) A.put('O2-', I3, mul(v, R))
  A.dock(`${el}2+`, mul(TD[0]!, -1), null)
  A.dock(`${el}3+`, mul(TD[1]!, -1), null)
  A.dock(`${el}3+`, mul(TD[2]!, -1), null)
}

type IonCount = [string, number]

/** Две частицы разных сортов: пара, звезда или бипирамида. */
function binary(A: Assembler, cat: IonCount, an: IonCount): void {
  const [c, nc] = cat
  const [a, na] = an
  if (nc === 1 && na === 1) {
    // центр — многоатомный (если оба — анион), сосед — по первому сайту центра
    const center = !isMono(a) ? a : !isMono(c) ? c : a
    const other = center === a ? c : a
    A.put(center)
    const d = isMono(center) ? ([1, 0, 0] as P3) : pickSites(ionTemplate(center).sites, 1)[0]!
    A.dock(other, d, firstSite(other))
    return
  }
  if (nc === 1) return star(A, c, a, na)
  if (na === 1) return star(A, a, c, nc)
  if (nc === 2 && na === 3) return bipyramid(A, a, c)
  if (nc === 3 && na === 2) return bipyramid(A, c, a)
  throw new Error(`formulaUnitModel: нет раскладки ${c}×${nc} + ${a}×${na}`)
}

// ─── молекулы ───────────────────────────────────────────────────────────────

type MolAtom = { el: ElementSymbol; p: P3 }
type Mol = { atoms: MolAtom[]; bonds: [number, number, number][]; geometry: ReagentGeometryKey[]; schematic?: string; multiple?: number }

function diatomic(e1: ElementSymbol, e2: ElementSymbol, key: BondKey, order: number): Mol {
  const l = bondLengthPm(key)
  return {
    atoms: [
      { el: e1, p: [-l / 2, 0, 0] },
      { el: e2, p: [l / 2, 0, 0] },
    ],
    bonds: [[0, 1, order]],
    geometry: [],
  }
}

/** AXₙ: пирамида (n = 3, угол) или тетраэдр (n = 4); одна связь — вверх у тетраэдра. */
function axn(c: ElementSymbol, x: ElementSymbol, n: 2 | 3 | 4, l: number, angleDeg: number): Mol {
  const atoms: MolAtom[] = [{ el: c, p: [0, 0, 0] }]
  if (n === 2) {
    const h = rad(angleDeg) / 2
    atoms.push({ el: x, p: [l * Math.sin(h), -l * Math.cos(h), 0] }, { el: x, p: [-l * Math.sin(h), -l * Math.cos(h), 0] })
  } else if (n === 4) {
    atoms.push({ el: x, p: [0, l, 0] })
    for (let k = 0; k < 3; k++) {
      const phi = rad(90 + 120 * k)
      const s = Math.sin(Math.PI - rad(angleDeg))
      atoms.push({ el: x, p: [l * s * Math.cos(phi), -l * Math.cos(Math.PI - rad(angleDeg)), l * s * Math.sin(phi)] })
    }
  } else {
    const sinB = (2 / Math.sqrt(3)) * Math.sin(rad(angleDeg) / 2)
    const cosB = Math.sqrt(Math.max(0, 1 - sinB * sinB))
    for (let k = 0; k < 3; k++) {
      const phi = rad(90 + 120 * k)
      atoms.push({ el: x, p: [l * sinB * Math.cos(phi), -l * cosB, l * sinB * Math.sin(phi)] })
    }
  }
  return { atoms, bonds: atoms.slice(1).map((_, i) => [0, i + 1, 1] as [number, number, number]), geometry: [] }
}

/**
 * Кислота «остаток + H»: к первым nH атомам O шаблона — H (acidOH), кратность — по школьной формуле:
 * nDouble из оставшихся связей X–O — двойные.
 */
function acidFromRoot(rootKey: string, nH: number, nDouble: number): Mol {
  const t = ionTemplate(rootKey)
  const atoms: MolAtom[] = t.atoms.map((a) => ({ el: a.el, p: [...a.p] as P3 }))
  const bonds: [number, number, number][] = t.bonds.map(([a, b, o]) => [a, b, o])
  const planar = atoms.every((a) => Math.abs(a.p[2]) < 1e-6)
  // атомы O, связанные с центром (для P₂O₇ — концевые, не мостик)
  const terminal = atoms.map((_, i) => i).filter((i) => atoms[i]!.el === 'O' && bonds.filter(([a, b]) => a === i || b === i).length === 1)
  const centerOf = (o: number) => {
    const b = bonds.find(([a, bb]) => a === o || bb === o)!
    return b[0] === o ? b[1] : b[0]
  }
  // H — поровну по центрам (H₄P₂O₇: по два у каждого P)
  const centers = [...new Set(terminal.map(centerOf))]
  const perCenter = centers.map((c) => terminal.filter((o) => centerOf(o) === c))
  const withH: number[] = []
  for (let k = 0; withH.length < nH; k++) for (const list of perCenter) if (withH.length < nH && list[k] != null) withH.push(list[k]!)
  for (const o of withH) {
    const H = placeH(atoms, centerOf(o), o, OH_LEN, OH_ANGLE, planar)
    atoms.push({ el: 'H', p: H })
    bonds.push([o, atoms.length - 1, 1])
  }
  const rest = terminal.filter((o) => !withH.includes(o))
  const dbl: number[] = []
  for (let k = 0; dbl.length < nDouble; k++) {
    let added = false
    for (const c of centers) {
      const list = rest.filter((o) => centerOf(o) === c)
      if (dbl.length < nDouble && list[k] != null) {
        dbl.push(list[k]!)
        added = true
      }
    }
    if (!added) break
  }
  for (const o of dbl) {
    const b = bonds.find(([a, bb]) => (a === o || bb === o) && atoms[a === o ? bb : a]!.el !== 'H')!
    b[2] = 2
  }
  return { atoms, bonds, geometry: [t.geometry!, 'acidOH'], schematic: [t.schematic, REAGENT_GEOMETRY.acidOH.schematic].filter(Boolean).join(' ') }
}

/** H₃PO₄: P=O вверх, три P–OH — вниз под тетраэдрическим углом (кристалл, Greenwood & Earnshaw). */
function phosphoricAcid(): Mol {
  const pO = reagentBondPm('phosphoricAcid', 'P=O')
  const pOH = reagentBondPm('phosphoricAcid', 'P–O(H)')
  const t = rad(reagentAngleDeg('phosphoricAcid', '∠O–P–O'))
  const atoms: MolAtom[] = [
    { el: 'P', p: [0, 0, 0] },
    { el: 'O', p: [0, pO, 0] },
  ]
  const bonds: [number, number, number][] = [[0, 1, 2]]
  for (let k = 0; k < 3; k++) {
    const phi = rad(90 + 120 * k)
    const d: P3 = [Math.sin(t) * Math.cos(phi), Math.cos(t), Math.sin(t) * Math.sin(phi)]
    atoms.push({ el: 'O', p: mul(d, pOH) })
    bonds.push([0, atoms.length - 1, 1])
  }
  for (let k = 0; k < 3; k++) {
    const H = placeH(atoms, 0, 2 + k, reagentBondPm('phosphoricAcid', 'O–H'), reagentAngleDeg('phosphoricAcid', '∠P–O–H'), false)
    atoms.push({ el: 'H', p: H })
    bonds.push([2 + k, atoms.length - 1, 1])
  }
  return { atoms, bonds, geometry: ['phosphoricAcid'], schematic: REAGENT_GEOMETRY.phosphoricAcid.schematic }
}

/** HClO₄ (газ, Clark 1970): три Cl=O вверх под ∠O=Cl=O, Cl–OH вниз по оси; H — acidOH. */
function perchloricAcid(): Mol {
  const a = reagentBondPm('hclo4', 'Cl=O')
  const b = reagentBondPm('hclo4', 'Cl–O(H)')
  const ang = reagentAngleDeg('hclo4', '∠O=Cl=O')
  const sinB = (2 / Math.sqrt(3)) * Math.sin(rad(ang) / 2)
  const cosB = Math.sqrt(1 - sinB * sinB)
  const atoms: MolAtom[] = [
    { el: 'Cl', p: [0, 0, 0] },
    { el: 'O', p: [0, -b, 0] },
  ]
  const bonds: [number, number, number][] = [[0, 1, 1]]
  for (let k = 0; k < 3; k++) {
    const phi = rad(90 + 120 * k)
    atoms.push({ el: 'O', p: [a * sinB * Math.cos(phi), a * cosB, a * sinB * Math.sin(phi)] })
    bonds.push([0, atoms.length - 1, 2])
  }
  const H = placeH(atoms, 0, 1, OH_LEN, OH_ANGLE, false)
  atoms.push({ el: 'H', p: H })
  bonds.push([1, atoms.length - 1, 1])
  return { atoms, bonds, geometry: ['hclo4', 'acidOH'], schematic: 'O–H и ∠Cl–O–H электронография не разрешает — взяты по REAGENT_GEOMETRY.acidOH' }
}

/** S₈ — корона D4d: связь и угол S–S–S из ядра, радиус и высота короны — из них. */
function s8(): Mol {
  const d = bondLengthPm('S-S')
  const th = rad(bondAngleDeg('sulfurRing'))
  const R = d * Math.sqrt(1 - Math.cos(th))
  const h = Math.sqrt(Math.max(0, d * d - 2 * R * R * (1 - Math.cos(Math.PI / 4)))) / 2
  const atoms: MolAtom[] = []
  for (let k = 0; k < 8; k++) atoms.push({ el: 'S', p: [R * Math.cos((k * Math.PI) / 4), (k % 2 ? -1 : 1) * h, R * Math.sin((k * Math.PI) / 4)] })
  return { atoms, bonds: atoms.map((_, k) => [k, (k + 1) % 8, 1] as [number, number, number]), geometry: [] }
}

/** P₄ — правильный тетраэдр, P–P из ядра. */
function p4(): Mol {
  const l = bondLengthPm('P-P')
  const R = l * Math.sqrt(3 / 8)
  const atoms = TD.map((v) => ({ el: 'P' as ElementSymbol, p: mul(v, R) }))
  const bonds: [number, number, number][] = []
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) bonds.push([i, j, 1])
  return { atoms, bonds, geometry: [] }
}

/** P₄O₁₀ (Beagley 1969): тетраэдр P₄, мостиковые O над рёбрами (P–O–P из ядра), концевые P=O наружу. */
function p4o10(multiple: number): Mol {
  const br = reagentBondPm('p4o10', 'P–O(мост)')
  const tm = reagentBondPm('p4o10', 'P=O')
  const pop = rad(reagentAngleDeg('p4o10', '∠P–O–P'))
  const pp = 2 * br * Math.sin(pop / 2)
  const R = pp * Math.sqrt(3 / 8)
  const atoms: MolAtom[] = TD.map((v) => ({ el: 'P' as ElementSymbol, p: mul(v, R) }))
  const bonds: [number, number, number][] = []
  for (let i = 0; i < 4; i++) {
    const oi = atoms.push({ el: 'O', p: mul(TD[i]!, R + tm) }) - 1
    bonds.push([i, oi, 2])
  }
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++) {
      const mid = mul(add(atoms[i]!.p, atoms[j]!.p), 0.5)
      const out = norm(mid)
      const oi = atoms.push({ el: 'O', p: add(mid, mul(out, br * Math.cos(pop / 2))) }) - 1
      bonds.push([i, oi, 1], [j, oi, 1])
    }
  return {
    atoms,
    bonds,
    geometry: ['p4o10'],
    multiple,
    schematic: multiple > 1 ? 'формула P₂O₅ — простейшая; настоящая молекула оксида фосфора(V) — P₄O₁₀ = (P₂O₅)₂' : undefined,
  }
}

function ozone(): Mol {
  const m = axn('O', 'O', 2, reagentBondPm('ozone', 'O–O'), reagentAngleDeg('ozone', '∠O–O–O'))
  m.bonds = [
    [0, 1, 2],
    [0, 2, 1],
  ]
  m.geometry = ['ozone']
  return m
}

function n2o4(): Mol {
  const nn = reagentBondPm('n2o4', 'N–N')
  const no = reagentBondPm('n2o4', 'N–O')
  const onn = rad((360 - reagentAngleDeg('n2o4', '∠O–N–O')) / 2)
  const atoms: MolAtom[] = [
    { el: 'N', p: [-nn / 2, 0, 0] },
    { el: 'N', p: [nn / 2, 0, 0] },
  ]
  const bonds: [number, number, number][] = [[0, 1, 1]]
  for (const [ni, s] of [
    [0, -1],
    [1, 1],
  ] as const) {
    for (const up of [1, -1]) {
      atoms.push({ el: 'O', p: [atoms[ni]!.p[0] + s * no * Math.cos(Math.PI - onn), up * no * Math.sin(Math.PI - onn), 0] })
      // N=O и N→O, как у NO₂ школьной сцены
      bonds.push([ni, atoms.length - 1, up === 1 ? 2 : 1])
    }
  }
  return { atoms, bonds, geometry: ['n2o4'] }
}

function n2o3(): Mol {
  const nn = reagentBondPm('n2o3', 'N–N')
  const atoms: MolAtom[] = [
    { el: 'N', p: [0, 0, 0] },
    { el: 'N', p: [nn, 0, 0] },
  ]
  const at = (from: P3, dirDeg: number, l: number): P3 => [from[0] + l * Math.cos(rad(dirDeg)), from[1] + l * Math.sin(rad(dirDeg)), 0]
  // нитрозо-O у N₁: ∠O=N–N; нитро-O у N₂: ∠N–N–O(a) вниз, ∠N–N–O(b) вверх (со стороны нитрозо-O)
  // направление N₁→N₂ — 0°, N₂→N₁ — 180°
  atoms.push({ el: 'O', p: at(atoms[0]!.p, reagentAngleDeg('n2o3', '∠O=N–N'), reagentBondPm('n2o3', 'N=O')) })
  atoms.push({ el: 'O', p: at(atoms[1]!.p, -(180 - reagentAngleDeg('n2o3', '∠N–N–O(a)')), reagentBondPm('n2o3', 'N–O(a)')) })
  atoms.push({ el: 'O', p: at(atoms[1]!.p, 180 - reagentAngleDeg('n2o3', '∠N–N–O(b)'), reagentBondPm('n2o3', 'N–O(b)')) })
  return {
    atoms,
    bonds: [
      [0, 1, 1],
      [0, 2, 2],
      [1, 3, 1],
      [1, 4, 2],
    ],
    geometry: ['n2o3'],
  }
}

function cro3(): Mol {
  const t = planarIon('CrO3m', 'CrO₃', 0, 'Cr', reagentBondPm('cro3School', 'Cr=O'), 'cro3School')
  return { atoms: t.atoms.map((a) => ({ el: a.el, p: a.p })), bonds: t.bonds.map(([a, b]) => [a, b, 2]), geometry: ['cro3School'], schematic: REAGENT_GEOMETRY.cro3School.schematic }
}

function v2o5(): Mol {
  const vo = reagentBondPm('v2o5School', 'V=O')
  const vb = reagentBondPm('v2o5School', 'V–O(мост)')
  const vov = rad(reagentAngleDeg('v2o5School', '∠V–O–V'))
  const ovo = reagentAngleDeg('v2o5School', '∠O=V=O')
  const atoms: MolAtom[] = [{ el: 'O', p: [0, 0, 0] }]
  const bonds: [number, number, number][] = []
  for (const s of [1, -1]) {
    const V: P3 = [s * vb * Math.sin(vov / 2), -vb * Math.cos(vov / 2), 0]
    const vi = atoms.push({ el: 'V', p: V }) - 1
    bonds.push([0, vi, 1])
    const toBridge = Math.atan2(-V[1], -V[0]) * (180 / Math.PI)
    for (const k of [1, -1]) {
      const a = rad(toBridge + k * ovo)
      const oi = atoms.push({ el: 'O', p: [V[0] + vo * Math.cos(a), V[1] + vo * Math.sin(a), 0] }) - 1
      bonds.push([vi, oi, 2])
    }
  }
  return { atoms, bonds, geometry: ['v2o5School'], schematic: REAGENT_GEOMETRY.v2o5School.schematic }
}

/** NH₃·H₂O: NH₃ (ядро) неподелённой парой вверх, над ней H₂O, H–O···N по прямой (связь палочкой не рисуется). */
function ammoniaHydrate(): Mol {
  const m = axn('N', 'H', 3, bondLengthPm('N-H'), bondAngleDeg('ammonia'))
  const hb = reagentBondPm('ammoniaHydrate', 'N···H')
  const oh = bondLengthPm('O-H')
  const w = rad(bondAngleDeg('water'))
  const H1: P3 = [0, hb, 0]
  const O: P3 = [0, hb + oh, 0]
  const H2: P3 = [oh * Math.sin(Math.PI - w), hb + oh - oh * Math.cos(Math.PI - w), 0]
  m.atoms.push({ el: 'H', p: H1 }, { el: 'O', p: O }, { el: 'H', p: H2 })
  m.bonds.push([5, 4, 1], [5, 6, 1])
  m.geometry = ['ammoniaHydrate']
  m.schematic = REAGENT_GEOMETRY.ammoniaHydrate.schematic
  return m
}

// ─── таблица 200 ────────────────────────────────────────────────────────────

type Spec = { ions: string } | { custom: (A: Assembler) => void } | { mol: () => Mol }

const mol = (f: () => Mol): Spec => ({ mol: f })
const ion = (s: string): Spec => ({ ions: s })

/** Кристаллогидрат: катион в центре, n H₂O вокруг него (кислородом к катиону), остальные частицы — снаружи. */
function hydrate(A: Assembler, cation: string, waterDirs: P3[], outer: { key: string; dir: P3; site?: SiteKind }[]): void {
  A.put(cation)
  for (const d of waterDirs) A.dock('H2O', norm(d), firstSite('H2O'), [0, 0, 1])
  for (const o of outer) A.dock(o.key, norm(o.dir), o.site ? (ionTemplate(o.key).sites.find((s) => s.kind === o.site)?.dir ?? firstSite(o.key)) : firstSite(o.key))
}

const OCT: P3[] = AXES

const SPECS: Record<string, Spec> = {
  hcl: mol(() => diatomic('H', 'Cl', 'H-Cl', 1)),
  hbr: mol(() => diatomic('H', 'Br', 'H-Br', 1)),
  hi: mol(() => diatomic('H', 'I', 'H-I', 1)),
  hf: mol(() => diatomic('H', 'F', 'H-F', 1)),
  tb_cl2: mol(() => diatomic('Cl', 'Cl', 'Cl-Cl', 1)),
  tb_br2: mol(() => diatomic('Br', 'Br', 'Br-Br', 1)),
  tb_i2: mol(() => diatomic('I', 'I', 'I-I', 1)),
  tb_f2: mol(() => diatomic('F', 'F', 'F-F', 1)),
  h2s: mol(() => axn('S', 'H', 2, bondLengthPm('S-H'), bondAngleDeg('hydrogenSulfide'))),
  tb_ph3: mol(() => ({ ...axn('P', 'H', 3, reagentBondPm('phosphine', 'P–H'), reagentAngleDeg('phosphine', '∠H–P–H')), geometry: ['phosphine'] })),
  tb_sih4: mol(() => ({ ...axn('Si', 'H', 4, reagentBondPm('silane', 'Si–H'), reagentAngleDeg('silane', '∠H–Si–H')), geometry: ['silane'] })),
  tb_sif4: mol(() => ({ ...axn('Si', 'F', 4, reagentBondPm('sif4', 'Si–F'), reagentAngleDeg('sif4', '∠F–Si–F')), geometry: ['sif4'] })),
  tb_cs2: mol(() => {
    const l = reagentBondPm('cs2', 'C=S')
    return {
      atoms: [
        { el: 'S', p: [-l, 0, 0] },
        { el: 'C', p: [0, 0, 0] },
        { el: 'S', p: [l, 0, 0] },
      ],
      bonds: [
        [1, 0, 2],
        [1, 2, 2],
      ],
      geometry: ['cs2'],
    }
  }),
  tb_o3: mol(ozone),
  tb_s8: mol(s8),
  tb_p4: mol(p4),
  p2o5: mol(() => p4o10(2)),
  tb_p4o10: mol(() => p4o10(1)),
  tb_n2o4: mol(n2o4),
  tb_n2o3: mol(n2o3),
  cro3: mol(cro3),
  tb_v2o5: mol(v2o5),
  nh3_h2o: mol(ammoniaHydrate),
  h3po4: mol(phosphoricAcid),
  hclo4: mol(perchloricAcid),
  h2co3: mol(() => acidFromRoot('CO3', 2, 1)),
  h2so3: mol(() => acidFromRoot('SO3', 2, 1)),
  hno2: mol(() => acidFromRoot('NO2', 1, 1)),
  h2sio3: mol(() => acidFromRoot('SiO3', 2, 1)),
  hclo: mol(() => acidFromRoot('ClO', 1, 0)),
  hclo3: mol(() => acidFromRoot('ClO3', 1, 2)),
  hmno4: mol(() => acidFromRoot('MnO4', 1, 3)),
  tb_hpo3: mol(() => acidFromRoot('PO3', 1, 2)),
  tb_h4p2o7: mol(() => acidFromRoot('P2O7', 4, 2)),

  // ─ соли, основания, оксиды металлов: «катион[*n] анион[*n]»
  salt_ca_co3: ion('Ca2+ CO3'),
  ca_oh_2: ion('Ca2+ OH*2'),
  naoh: ion('Na+ OH'),
  salt_cu_so4: ion('Cu2+ SO4'),
  koh: ion('K+ OH'),
  salt_na_so4: ion('Na+*2 SO4'),
  salt_k_cl: ion('K+ Cl-'),
  cuo: ion('Cu2+ O2-'),
  cu_oh_2: ion('Cu2+ OH*2'),
  salt_na_co3: ion('Na+*2 CO3'),
  cao: ion('Ca2+ O2-'),
  salt_k_so4: ion('K+*2 SO4'),
  salt_ca_cl: ion('Ca2+ Cl-*2'),
  salt_k_mno4: ion('K+ MnO4'),
  salt_na_no3: ion('Na+ NO3'),
  salt_fe3_cl: ion('Fe3+ Cl-*3'),
  mno2: ion('Mn4+ O2-*2'),
  fe2o3: ion('Fe3+*2 O2-*3'),
  al_oh_3: ion('Al3+ OH*3'),
  salt_ag_no3: ion('Ag+ NO3'),
  salt_k_no3: ion('K+ NO3'),
  salt_zn_cl: ion('Zn2+ Cl-*2'),
  zno: ion('Zn2+ O2-'),
  salt_fe2_so4: ion('Fe2+ SO4'),
  salt_al_cl: ion('Al3+ Cl-*3'),
  salt_nahco3: ion('Na+ HCO3'),
  fe_oh_3: ion('Fe3+ OH*3'),
  salt_nh4_cl: ion('NH4 Cl-'),
  salt_al_so4: ion('Al3+*2 SO4*3'),
  salt_cu_cl: ion('Cu2+ Cl-*2'),
  salt_ba_cl: ion('Ba2+ Cl-*2'),
  tb_ca3po42: ion('Ca2+*3 PO4*2'),
  salt_ag_cl: ion('Ag+ Cl-'),
  salt_k_co3: ion('K+*2 CO3'),
  fe3o4: { custom: (A) => spinel(A, 'Fe') },
  salt_k_clo3: ion('K+ ClO3'),
  salt_nh4_no3: ion('NH4 NO3'),
  salt_k2cr2o7: ion('K+*2 Cr2O7'),
  salt_fe2_cl: ion('Fe2+ Cl-*2'),
  zn_oh_2: ion('Zn2+ OH*2'),
  fe_oh_2: ion('Fe2+ OH*2'),
  salt_mg_cl: ion('Mg2+ Cl-*2'),
  salt_zn_so4: ion('Zn2+ SO4'),
  salt_k_i: ion('K+ I-'),
  salt_fe2_s: ion('Fe2+ S2-'),
  salt_ca_hco3_2: ion('Ca2+ HCO3*2'),
  cu2o: ion('Cu+*2 O2-'),
  ba_oh_2: ion('Ba2+ OH*2'),
  salt_ca_so4: ion('Ca2+ SO4'),
  salt_nh4_so4: ion('NH4*2 SO4'),
  salt_na_br: ion('Na+ Br-'),
  mg_oh_2: ion('Mg2+ OH*2'),
  salt_mg_so4: ion('Mg2+ SO4'),
  tb_cah2: ion('Ca2+ H-*2'),
  tb_cac2: ion('Ca2+ C2'),
  salt_na_sio3: ion('Na+*2 SiO3'),
  salt_fe3_so4: ion('Fe3+*2 SO4*3'),
  tb_na3po4: ion('Na+*3 PO4'),
  salt_ca_no3: ion('Ca2+ NO3*2'),
  salt_k_br: ion('K+ Br-'),
  salt_na_so3: ion('Na+*2 SO3'),
  tb_nah: ion('Na+ H-'),
  cr2o3: ion('Cr3+*2 O2-*3'),
  feo: ion('Fe2+ O2-'),
  salt_na_s: ion('Na+*2 S2-'),
  na2o: ion('Na+*2 O2-'),
  salt_cu_no3: ion('Cu2+ NO3*2'),
  salt_mn_so4: ion('Mn2+ SO4'),
  fes2: ion('Fe2+ S2'),
  k2o: ion('K+*2 O2-'),
  li2o: ion('Li+*2 O2-'),
  salt_na_clo2: ion('Na+ ClO2'),
  na2o2: ion('Na+*2 O2_2'),
  salt_cr_so4: ion('Cr3+*2 SO4*3'),
  salt_pb_no3: ion('Pb2+ NO3*2'),
  tb_cro: ion('Cr2+ O2-'),
  tb_croh2: ion('Cr2+ OH*2'),
  salt_mn_cl: ion('Mn2+ Cl-*2'),
  tb_nahso4: ion('Na+ HSO4'),
  salt_al_no3: ion('Al3+ NO3*3'),
  salt_mg_co3: ion('Mg2+ CO3'),
  salt_na_i: ion('Na+ I-'),
  salt_zn_s: ion('Zn2+ S2-'),
  salt_cu_s: ion('Cu2+ S2-'),
  salt_al_s: ion('Al3+*2 S2-*3'),
  salt_pb_s: ion('Pb2+ S2-'),
  lioh: ion('Li+ OH'),
  tb_k2mno4: ion('K+*2 MnO4_2'),
  tb_crcl2: ion('Cr2+ Cl-*2'),
  bao: ion('Ba2+ O2-'),
  salt_ba_no3: ion('Ba2+ NO3*2'),
  salt_zn_no3: ion('Zn2+ NO3*2'),
  tb_mn3o4: { custom: (A) => spinel(A, 'Mn') },
  tb_croh3: ion('Cr3+ OH*3'),
  tb_k2o2: ion('K+*2 O2_2'),
  salt_k_s: ion('K+*2 S2-'),
  tb_aucl3: ion('Au3+ Cl-*3'),
  salt_ca_s: ion('Ca2+ S2-'),
  salt_ag_br: ion('Ag+ Br-'),
  salt_na_no2: ion('Na+ NO2'),
  salt_li_cl: ion('Li+ Cl-'),
  salt_fe3_no3: ion('Fe3+ NO3*3'),
  salt_ag_i: ion('Ag+ I-'),
  tb_hgo: ion('Hg2+ O2-'),
  ago: ion('Ag+*2 O2-'),
  salt_cr_cl: ion('Cr3+ Cl-*3'),
  salt_k_no2: ion('K+ NO2'),
  salt_pb_i: ion('Pb2+ I-*2'),
  tb_al4c3: {
    custom: (A) => {
      // 3 C⁴⁻ — треугольник касающихся ионов, 2 Al³⁺ — на оси, 2 — в плоскости у рёбер треугольника
      const rC = monoRadius('C4-')
      const R = (2 * rC) / Math.sqrt(3)
      for (const a of [90, 210, 330]) A.put('C4-', I3, [R * Math.cos(rad(a)), R * Math.sin(rad(a)), 0])
      A.dock('Al3+', [0, 0, 1], null)
      A.dock('Al3+', [0, 0, -1], null)
      A.dock('Al3+', [Math.cos(rad(270)), Math.sin(rad(270)), 0], null)
      A.dock('Al3+', [Math.cos(rad(30)), Math.sin(rad(30)), 0], null)
    },
  },
  tb_cah2po42: ion('Ca2+ H2PO4*2'),
  salt_ca_sio3: ion('Ca2+ SiO3'),
  tb_ag3po4: ion('Ag+*3 PO4'),
  tb_cahpo4: ion('Ca2+ HPO4'),
  tb_caocl2: {
    custom: (A) => {
      A.put('Ca2+')
      A.dock('Cl-', [1, 0, 0], null)
      A.dock('ClO', [-1, 0, 0], firstSite('ClO', ['end']))
    },
  },
  salt_pb_cl: ion('Pb2+ Cl-*2'),
  tb_kh: ion('K+ H-'),
  tb_naalo2: ion('Na+ AlO2'),
  tb_beo: ion('Be2+ O2-'),
  tb_cu2s: ion('Cu+*2 S2-'),
  salt_fe2_no3: ion('Fe2+ NO3*2'),
  tb_mn2o3: ion('Mn3+*2 O2-*3'),
  salt_nh4_co3: ion('NH4*2 CO3'),
  tb_kclo: ion('K+ ClO'),
  tb_mno: ion('Mn2+ O2-'),
  tb_nh42hpo4: ion('NH4*2 HPO4'),
  salt_k_cro4: ion('K+*2 CrO4'),
  tb_ca3p2: ion('Ca2+*3 P3-*2'),
  tb_na2zno2: ion('Na+*2 ZnO2'),
  tb_bao2: ion('Ba2+ O2_2'),
  tb_ko2: ion('K+ O2_1'),
  tb_na2znoh4: ion('Na+*2 ZnOH4'),
  salt_k_so3: ion('K+*2 SO3'),
  salt_nh4_cr2o7: ion('NH4*2 Cr2O7'),
  tb_mg3po42: ion('Mg2+*3 PO4*2'),

  // ─ основная соль, двойные соли, кристаллогидраты
  tb_cuoh2co3: {
    custom: (A) => {
      // (CuOH)₂CO₃ (малахит): CO₃²⁻ в центре, два Cu²⁺ у рёбер, у каждого Cu²⁺ — OH⁻ снаружи
      A.put('CO3')
      const dirs: P3[] = [
        [Math.cos(rad(30)), Math.sin(rad(30)), 0],
        [Math.cos(rad(150)), Math.sin(rad(150)), 0],
      ]
      const cu = dirs.map((d) => A.dock('Cu2+', d, null))
      cu.forEach((ci, k) => {
        const p = A.atoms[A.ions[ci]!.atoms[0]!]!.p
        A.dock('OH', dirs[k]!, firstSite('OH'), [0, 0, 1], p)
      })
    },
  },
  tb_kcl_nacl: {
    custom: (A) => {
      // сильвинит KCl·NaCl: грань «каменной соли» 2×2 — K⁺ и Na⁺ по диагонали, Cl⁻ между ними
      A.put('K+')
      A.dock('Cl-', [1, 0, 0], null)
      A.dock('Cl-', [0, 1, 0], null)
      A.dock('Na+', norm([1, 1, 0]), null)
    },
  },
  tb_kcl_mgcl2_6h2o: {
    custom: (A) => {
      // карналлит: [Mg(H₂O)₆]²⁺, три Cl⁻ над гранями октаэдра, K⁺ — между двумя Cl⁻
      hydrate(A, 'Mg2+', OCT, [
        { key: 'Cl-', dir: [1, 1, 1] },
        { key: 'Cl-', dir: [-1, 1, -1] },
        { key: 'Cl-', dir: [1, -1, -1] },
      ])
      const c1 = A.atoms[A.ions[7]!.atoms[0]!]!.p
      const c2 = A.atoms[A.ions[8]!.atoms[0]!]!.p
      A.dock('K+', norm(add(c1, c2)), null)
    },
  },
  tb_kcl_mgso4_3h2o: {
    custom: (A) => {
      // каинит KCl·MgSO₄·3H₂O: Mg²⁺ с тремя H₂O, SO₄²⁻ с другой стороны, K⁺ и Cl⁻ — пара рядом
      hydrate(
        A,
        'Mg2+',
        [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
        [{ key: 'SO4', dir: [-1, -1, -1], site: 'face' }],
      )
      A.dock('K+', norm([1, -1, -0.3]), null)
      const k = A.atoms[A.ions[A.ions.length - 1]!.atoms[0]!]!.p
      A.dock('Cl-', norm([1, -1, -0.3]), null, [0, 0, 1], k)
    },
  },
  tb_cuso4_5h2o: {
    custom: (A) => {
      // CuSO₄·5H₂O: [Cu(H₂O)₄]²⁺ (квадрат), SO₄²⁻ снизу вершиной O к Cu, пятая H₂O — у сульфата
      hydrate(
        A,
        'Cu2+',
        [
          [1, 0, 0],
          [-1, 0, 0],
          [0, 0, 1],
          [0, 0, -1],
        ],
        [{ key: 'SO4', dir: [0, -1, 0], site: 'vertex' }],
      )
      const s = A.atoms[A.ions[5]!.atoms[0]!]!.p
      A.dock('H2O', norm([1, -0.4, 0.6]), firstSite('H2O'), [0, 0, 1], s)
    },
  },
  tb_feso4_7h2o: {
    custom: (A) => {
      // FeSO₄·7H₂O: [Fe(H₂O)₆]²⁺, SO₄²⁻ над гранью октаэдра, седьмая H₂O — с противоположной стороны
      hydrate(A, 'Fe2+', OCT, [
        { key: 'SO4', dir: [1, 1, 1], site: 'face' },
        { key: 'H2O', dir: [-1, -1, -1] },
      ])
    },
  },
  tb_na2so4_10h2o: {
    custom: (A) => {
      // Na₂SO₄·10H₂O (мирабилит): SO₄²⁻ в центре, два Na⁺ у рёбер, у каждого Na⁺ — 4 H₂O, ещё 2 H₂O — у сульфата
      A.put('SO4')
      for (const s of [1, -1]) {
        const na = A.dock('Na+', [s, 0, 0], null)
        const p = A.atoms[A.ions[na]!.atoms[0]!]!.p
        for (const d of [
          [s * 0.35, 1, 0],
          [s * 0.35, -1, 0],
          [s * 0.35, 0, 1],
          [s * 0.35, 0, -1],
        ] as P3[])
          A.dock('H2O', norm(d), firstSite('H2O'), [0, 0, 1], p)
      }
      A.dock('H2O', norm([0, 0.6, 1]), firstSite('H2O'))
      A.dock('H2O', norm([0, -0.6, -1]), firstSite('H2O'))
    },
  },
  tb_caso4_2h2o: {
    custom: (A) => {
      // гипс CaSO₄·2H₂O: Ca²⁺, SO₄²⁻ ребром к нему, две H₂O у Ca²⁺ с другой стороны
      A.put('Ca2+')
      A.dock('SO4', [-1, 0, 0], firstSite('SO4', ['edge']))
      A.dock('H2O', [Math.cos(rad(60)), Math.sin(rad(60)), 0], firstSite('H2O'))
      A.dock('H2O', [Math.cos(rad(-60)), Math.sin(rad(-60)), 0], firstSite('H2O'))
    },
  },
}

/** Разбор «Ca2+ OH*2» → [['Ca2+', 1], ['OH', 2]]. */
function parseIons(s: string): IonCount[] {
  return s.split(/\s+/).map((tok) => {
    const [k, n] = tok.split('*')
    return [k!, Number(n ?? 1)]
  })
}

function fromMol(id: string, m: Mol): FormulaUnit {
  const atoms: UnitAtom[] = m.atoms.map((a) => {
    const radiusPm = radiusForSpecies(a.el, 0, { model: 'covalent' })
    return { el: a.el, p: a.p, charge: 0, label: a.el, radiusPm, drawPm: radiusPm * SCHOOL_DRAW.ballScale, ion: 0 }
  })
  return {
    compoundId: id,
    kind: 'molecule',
    atoms,
    bonds: m.bonds.map(([a, b, order]) => ({ a, b, order })),
    ions: [],
    formulaMultiple: m.multiple ?? 1,
    geometry: [...new Set(m.geometry)],
    schematic: m.schematic ? [m.schematic] : [],
  }
}

/** Идентификаторы, у которых модель строит этот модуль. */
export const FORMULA_UNIT_IDS: readonly string[] = Object.keys(SPECS)

const unitCache = new Map<string, FormulaUnit | null>()

/** Модель вещества (пм) по таблице; null — вещество не из этой таблицы. */
export function buildFormulaUnit(compoundId: string): FormulaUnit | null {
  const hit = unitCache.get(compoundId)
  if (hit !== undefined) return hit
  const spec = SPECS[compoundId]
  let out: FormulaUnit | null = null
  if (spec) {
    if ('mol' in spec) out = fromMol(compoundId, spec.mol())
    else {
      const A = new Assembler()
      if ('custom' in spec) spec.custom(A)
      else {
        const list = parseIons(spec.ions)
        const cat = list.find(([k]) => ionTemplate(k).charge > 0)!
        const an = list.find(([k]) => ionTemplate(k).charge < 0)!
        binary(A, cat, an)
      }
      out = { compoundId, kind: 'ionic', atoms: A.atoms, bonds: A.bonds, ions: A.ions, formulaMultiple: 1, geometry: [...A.geometry], schematic: [...A.schematic] }
    }
  }
  unitCache.set(compoundId, out)
  return out
}
