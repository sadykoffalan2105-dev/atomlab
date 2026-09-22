import * as THREE from 'three'
import { bondAngleDeg, bondLengthPm, getCrystal } from '../../../../chemistry/data'
import { smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, windowFade, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { pmToScene, speciesRadius, speciesRadiusPm } from '../kit/cpkAtoms'
import { createElectronJump, sampleElectronJump, type ElectronJump } from '../kit/electronFx'
import {
  createLabelStates,
  fadeTrack,
  rampTrack,
  sampleLabels,
  validateTracks,
  type SceneLabelDef,
  type SceneLabelState,
} from '../kit/sceneKit'
import { FES_FINISH, fesCueAt } from './fesSteps'

export {
  FES_CUES,
  FES_END,
  FES_FINISH,
  FES_SEGMENTS,
  FES_STEPS,
  FES_STEP_IDS,
  FES_TIMING,
  fesStepIndexAt,
  type FesCueId,
  type FesStepId,
} from './fesSteps'

/**
 * Раскадровка Fe (тв.) + S (тв.) → FeS (тв.) — ЧИСТАЯ функция времени сюжета.
 *
 * Вся химия — из src/chemistry/data (ни одного числа руками):
 *   • железо: ОЦК (феррит α-Fe), Im-3m (229), a = 286,65 пм, КЧ 8, d = 248,2 пм;
 *   • сера при 25 °C — КОРОНА S₈: d(S–S) = 205,5 пм, угол S–S–S = 108°,
 *     симметрия D4d (радиус кольца и высота гофра ВЫЧИСЛЕНЫ из этих двух чисел);
 *   • троилит FeS: сверхструктура типа NiAs, P-62c (190), a = 596,3 пм,
 *     c = 1175,4 пм, d(Fe–S) = 244,5 пм, КЧ 6/6, Z = 12, ρ = 4,84 г/см³;
 *   • радиусы: Fe⁰ 126 пм (металлический) → Fe²⁺ 78 пм; S⁰ 105 пм (ковалентный,
 *     в короне S₈) → S²⁻ 184 пм. На экране S²⁻ в 2,36 раза крупнее Fe²⁺.
 *
 * ЧТО НАРИСОВАНО СХЕМАТИЧНО (и так сказано в тексте урока):
 *   • фрагмент решётки — ИДЕАЛЬНАЯ подъячейка типа NiAs троилита
 *     (a_NiAs = a/√3 = 344,3 пм, c_NiAs = c/2 = 587,7 пм); настоящий троилит —
 *     слегка искажённая сверхструктура √3a × 2c, поэтому измеренное
 *     d(Fe–S) = 244,5 пм чуть меньше идеального;
 *   • показан слой из 31 иона, в кристалле их порядка 10²³;
 *   • светящаяся оболочка вокруг железа — знак «здесь внешние электроны 4s²»,
 *     а не форма орбитали; «полёт» электрона — тоже картинка, переход квантовый;
 *   • магнит — прямоугольный брусок: важен только факт притяжения/непритяжения;
 *   • из всей смеси прослежены ОДИН атом железа и ОДИН атом серы, остальные
 *     реагируют так же и уходят из кадра.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

const TROILITE = getCrystal('troilite')!
const IRON = getCrystal('fe_metal')!

/** Параметр a подъячейки NiAs: сверхструктура троилита — √3a × 2c. */
const A_SUB_PM = TROILITE.cellPm.a / Math.sqrt(3)
/** Параметр c подъячейки NiAs. */
const C_SUB_PM = (TROILITE.cellPm.c ?? TROILITE.cellPm.a) / 2

/** Ребро подъячейки NiAs в мировых единицах (ось a). */
const A = pmToScene(A_SUB_PM)
/** Высота подъячейки NiAs в мировых единицах (ось c — вертикаль кадра). */
const C = pmToScene(C_SUB_PM)
/** Половина ребра ОЦК-ячейки железа. */
const MH = pmToScene(IRON.cellPm.a) / 2

const R = {
  fe: speciesRadius('Fe', 0),
  feIon: speciesRadius('Fe', 2),
  s: speciesRadius('S', 0),
  sIon: speciesRadius('S', -2),
} as const

/** Радиус светящейся оболочки вокруг атома железа (схематичные внешние 4s²). */
const SHELL_FE = R.fe * 1.45

// ——— Корона S₈: радиус кольца и высота гофра ВЫЧИСЛЯЮТСЯ из d и угла ———
// Атом k стоит в (ρ·cos 45k°, ρ·sin 45k°, (−1)^k·h). Два условия:
//   |r₁ − r₀|² = K₁ρ² + 4h² = d²,   cos∠(r₀ r₁ r₂) = (K₂ρ² + 4h²) / d² = cos 108°,
// где K₁ = 2 − 2cos45°, K₂ = 1 − 2cos45°. Отсюда ρ и h однозначно.
const S8_D_PM = bondLengthPm('S-S')
const S8_ANGLE_DEG = bondAngleDeg('sulfurRing')
const S8_RING_PM = (() => {
  const k1 = 2 - 2 * Math.cos(Math.PI / 4)
  const k2 = 1 - 2 * Math.cos(Math.PI / 4)
  const c = Math.cos((S8_ANGLE_DEG * Math.PI) / 180)
  return Math.sqrt((S8_D_PM * S8_D_PM) / (k1 + (c * k1 - k2) / (1 - c)))
})()
const S8_PUCKER_PM = (() => {
  const k1 = 2 - 2 * Math.cos(Math.PI / 4)
  return Math.sqrt(Math.max(0, S8_D_PM * S8_D_PM - k1 * S8_RING_PM * S8_RING_PM)) / 2
})()

const RING_R = pmToScene(S8_RING_PM)
const RING_H = pmToScene(S8_PUCKER_PM)

/** Кратчайшее Fe–S в НАРИСОВАННОЙ идеальной подъячейке NiAs, пм. */
const FE_S_IDEAL_PM = Math.sqrt((A_SUB_PM * A_SUB_PM) / 3 + (C_SUB_PM * C_SUB_PM) / 16)
/**
 * Fe–Fe вдоль оси c: октаэдры FeS₆ делят ГРАНИ, поэтому железо стоит колонками
 * с шагом c_sub/2. Это определяющая черта типа NiAs — в отличие от каменной
 * соли, здесь одноимённые ионы оказываются прямыми соседями, и именно эти
 * контакты объясняют, почему связь в троилите не чисто ионная.
 */
const FE_FE_COLUMN_PM = C_SUB_PM / 2
/** Кратчайшее Fe–S в НАРИСОВАННОЙ решётке, мировые единицы. */
const FE_S_IDEAL = pmToScene(FE_S_IDEAL_PM)
/** Измеренное d(Fe²⁺–S²⁻) троилита: на нём стоит ионная пара шага 4. */
const FE_S_PAIR = pmToScene(TROILITE.cationAnionPm)

export const FES_GEOM = {
  radius: R,
  shellFe: SHELL_FE,
  ringR: RING_R,
  ringH: RING_H,
  metalHalf: MH,
  cellA: A,
  cellC: C,
  feSIdeal: FE_S_IDEAL,
  feSPair: FE_S_PAIR,
  /** справочные числа для подписей и тестов */
  data: {
    spaceGroup: TROILITE.spaceGroup,
    spaceGroupNo: TROILITE.spaceGroupNo,
    latticeType: TROILITE.latticeType,
    structureType: TROILITE.structureType,
    cellPm: TROILITE.cellPm,
    subCellPm: { a: A_SUB_PM, c: C_SUB_PM },
    feSPm: TROILITE.cationAnionPm,
    feSIdealPm: FE_S_IDEAL_PM,
    feFeColumnPm: FE_FE_COLUMN_PM,
    coordination: TROILITE.coordination,
    z: TROILITE.z,
    densityGCm3: TROILITE.densityGCm3,
    s8: { bondPm: S8_D_PM, angleDeg: S8_ANGLE_DEG, ringPm: S8_RING_PM, puckerPm: S8_PUCKER_PM },
    metal: { spaceGroup: IRON.spaceGroup, cellPm: IRON.cellPm.a, coordination: IRON.coordination, nearestPm: IRON.cationAnionPm },
  },
} as const

/** Масштаб рига камеры. */
export const FES_RIG_SCALE = 1.15

// ─────────────────────────────────────────────────────────────────────────────
// Узлы решётки NiAs, фрагмент железа и корона S₈
// ─────────────────────────────────────────────────────────────────────────────

export type FesElement = 'Fe' | 'S'
export type FesAtomId = 'fe1' | 's1' | `M${number}` | `R${number}` | `L${number}`

type Frac = readonly [number, number, number]

/**
 * Гексагональные координаты → декартовы. Ось c направлена ВВЕРХ (по Y кадра),
 * базисная плоскость лежит в XZ, угол γ = 120°.
 */
const cart = (f: Frac): [number, number, number] => [
  A * (f[0] - f[1] / 2),
  C * (f[2] - 0.5),
  A * f[1] * (Math.sqrt(3) / 2),
]

/** Расстояние в базисной плоскости для решётки с γ = 120°, в единицах a. */
const planeR = (u: number, v: number): number => Math.sqrt(u * u + v * v - u * v)

/** Радиус, по которому обрезан слой (в единицах a): столбцы дальше — уже за кадром. */
const SLAB_R = 1.25

type LatticeSite = { el: FesElement; frac: Frac }

/**
 * Слой типа NiAs: железо в позициях 2a (0,0,0) и (0,0,½), сера в 2c (⅓,⅔,¼)
 * и (⅔,⅓,¾). Пять чередующихся слоёв Fe–S–Fe–S–Fe вдоль оси c.
 *
 * ВАЖНО: шахматное правило каменной соли здесь НЕ работает. Железо сидит
 * колонками над одной и той же точкой (u, v) — октаэдры FeS₆ делят грани,
 * и соседи по колонке отстоят всего на c_sub/2 ≈ 294 пм. Ближайший сосед
 * железа — всё-таки сера (244,5 пм), но прямые контакты Fe–Fe существуют,
 * и именно они делают троилит не чисто ионным. Так и сказано в тексте урока.
 */
const SITES: LatticeSite[] = (() => {
  const out: LatticeSite[] = []
  for (let u = -1; u <= 1; u++) {
    for (let v = -1; v <= 1; v++) {
      if (planeR(u, v) <= SLAB_R + 1e-9) {
        for (const w of [0, 0.5, 1]) out.push({ el: 'Fe', frac: [u, v, w] })
      }
      const lo: Frac = [u + 1 / 3, v + 2 / 3, 0.25]
      if (planeR(lo[0], lo[1]) <= SLAB_R + 1e-9) out.push({ el: 'S', frac: lo })
      const hi: Frac = [u + 2 / 3, v + 1 / 3, 0.75]
      if (planeR(hi[0], hi[1]) <= SLAB_R + 1e-9) out.push({ el: 'S', frac: hi })
    }
  }
  return out
})()

/** Узел героя-железа: центр слоя, полное окружение из шести S²⁻. */
const FE1_FRAC: Frac = [0, 0, 0.5]
/** Узел героя-серы: верхний сосед центрального железа, полный тригональный призматический КЧ 6. */
const S1_FRAC: Frac = [2 / 3, 1 / 3, 0.75]

const sameFrac = (a: Frac, b: Frac): boolean =>
  Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6

const FE1_SITE = cart(FE1_FRAC)
const S1_SITE = cart(S1_FRAC)

/** Узлы решётки, которые НЕ заняты героями: они подлетают на шаге «решётка». */
const LATTICE_SITES: { id: FesAtomId; el: FesElement; pos: [number, number, number] }[] = SITES.filter(
  (s) => !sameFrac(s.frac, FE1_FRAC) && !sameFrac(s.frac, S1_FRAC),
).map((s, i) => ({ id: `L${i}` as FesAtomId, el: s.el, pos: cart(s.frac) }))

export const POS_BY_ID: Readonly<Record<string, readonly [number, number, number]>> = {
  fe1: FE1_SITE,
  s1: S1_SITE,
  ...Object.fromEntries(LATTICE_SITES.map((l) => [l.id, l.pos])),
}

// ——— Фрагмент металлического железа: ОЦК-ячейка (центр + 8 вершин, КЧ 8) ———
const IRON_CENTER: readonly [number, number, number] = [-1.78, 0.2, 0]
const ironPos = (dx: number, dy: number, dz: number): [number, number, number] => [
  IRON_CENTER[0] + dx,
  IRON_CENTER[1] + dy,
  IRON_CENTER[2] + dz,
]

/** Вершина, из которой уходит в реакцию атом-герой fe1. */
const FE1_START = ironPos(MH, MH, MH)

/** Центр ячейки + семь оставшихся вершин. */
const IRON_SITES: Array<[number, number, number]> = [
  ironPos(0, 0, 0),
  ironPos(-MH, MH, MH),
  ironPos(MH, -MH, MH),
  ironPos(-MH, -MH, MH),
  ironPos(MH, MH, -MH),
  ironPos(-MH, MH, -MH),
  ironPos(MH, -MH, -MH),
  ironPos(-MH, -MH, -MH),
]

export const IRON_ATOMS: readonly { id: FesAtomId; pos: readonly [number, number, number] }[] = IRON_SITES.map(
  (pos, i) => ({ id: `M${i}` as FesAtomId, pos }),
)

/** Связи ОЦК: центр ячейки — все восемь вершин (КЧ 8, d = 248,2 пм). */
export const IRON_BONDS: readonly (readonly [FesAtomId, FesAtomId])[] = [
  ['M0', 'fe1'],
  ['M0', 'M1'],
  ['M0', 'M2'],
  ['M0', 'M3'],
  ['M0', 'M4'],
  ['M0', 'M5'],
  ['M0', 'M6'],
  ['M0', 'M7'],
]

// ——— Корона S₈: восемь атомов, кольцо в плоскости XY, гофр по Z ———
const CROWN_CENTER: readonly [number, number, number] = [1.92, -0.06, 0]
/** Индекс атома кольца, который становится героем s1 (ближайший к железу). */
const S1_RING_INDEX = 4

const ringPos = (k: number): [number, number, number] => [
  CROWN_CENTER[0] + RING_R * Math.cos((k * Math.PI) / 4),
  CROWN_CENTER[1] + RING_R * Math.sin((k * Math.PI) / 4),
  CROWN_CENTER[2] + (k % 2 === 0 ? RING_H : -RING_H),
]

/** Кольцо по порядку обхода: герой s1 на своём месте, остальные — R0…R6. */
export const RING_ORDER: readonly FesAtomId[] = (() => {
  const out: FesAtomId[] = []
  let n = 0
  for (let k = 0; k < 8; k++) out.push(k === S1_RING_INDEX ? 's1' : (`R${n++}` as FesAtomId))
  return out
})()

export const RING_ATOMS: readonly { id: FesAtomId; pos: readonly [number, number, number] }[] = RING_ORDER.map(
  (id, k) => ({ id, pos: ringPos(k) }),
).filter((a) => a.id !== 's1')

const S1_START = ringPos(S1_RING_INDEX)

/** Восемь связей S–S короны (замкнутый цикл). */
export const RING_BONDS: readonly (readonly [FesAtomId, FesAtomId])[] = RING_ORDER.map(
  (id, k) => [id, RING_ORDER[(k + 1) % 8]!] as const,
)

// ——— Полный список частиц кадра ———
export const FES_ATOMS: readonly { id: FesAtomId; el: FesElement; main: boolean }[] = [
  { id: 'fe1', el: 'Fe', main: true },
  { id: 's1', el: 'S', main: true },
  ...IRON_ATOMS.map((m) => ({ id: m.id, el: 'Fe' as FesElement, main: false })),
  ...RING_ATOMS.map((r) => ({ id: r.id, el: 'S' as FesElement, main: false })),
  ...LATTICE_SITES.map((l) => ({ id: l.id, el: l.el, main: false })),
]

/** Атомы железа (металл + герой) — их поднимает магнит на шаге 1. */
const IRON_PULLED: readonly FesAtomId[] = ['fe1', ...IRON_ATOMS.map((m) => m.id)]

/** Рёбра фрагмента решётки: пары Fe–S на кратчайшем расстоянии (октаэдр вокруг каждого Fe²⁺). */
export const FES_EDGES: readonly (readonly [FesAtomId, FesAtomId])[] = (() => {
  const ids = Object.keys(POS_BY_ID) as FesAtomId[]
  const out: [FesAtomId, FesAtomId][] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = POS_BY_ID[ids[i]!]!
      const b = POS_BY_ID[ids[j]!]!
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
      if (Math.abs(d - FE_S_IDEAL) < 1e-3) out.push([ids[i]!, ids[j]!])
    }
  }
  return out
})()

/** Шесть ближайших S²⁻ вокруг иона fe1 — подсветка координационного числа 6 (октаэдр). */
export const FES_COORDINATION_IDS: readonly FesAtomId[] = FES_EDGES.filter(([a, b]) => a === 'fe1' || b === 'fe1').map(
  ([a, b]) => (a === 'fe1' ? b : a),
)

// ─────────────────────────────────────────────────────────────────────────────
// Ключевые моменты
// ─────────────────────────────────────────────────────────────────────────────

const T_MAGNET = fesCueAt('magnet') // 2.0
const T_SEPARATE = fesCueAt('separate') // 2.9
const T_IGNITE = fesCueAt('ignite') // 6.2
const T_TRANSFER = fesCueAt('transfer') // 11.0
const T_LATTICE = fesCueAt('lattice') // 16.6
const T_MAGNET_FAIL = fesCueAt('magnetFail') // 19.6
const T_EXO = fesCueAt('exo') // 22.2

/** Два электрона 4s² уходят один за другим: Fe⁰ − 2e⁻ → Fe²⁺. */
const T_E1 = { leave: 9.0, arrive: 10.6 }
const T_E2 = { leave: 9.5, arrive: T_TRANSFER }

/** Момент, когда ионная пара сходится на справочном d(Fe²⁺–S²⁻) = 244,5 пм. */
const T_PAIR = 14.5

// ——— Где герои стоят между шагами ———
/** Ионная пара: ровно d(Fe²⁺–S²⁻) по горизонтали, центр чуть левее начала координат. */
const PAIR_CENTER = -0.1
const PAIR = {
  fe: [PAIR_CENTER - FE_S_PAIR / 2, 0.12, 0.12] as const,
  s: [PAIR_CENTER + FE_S_PAIR / 2, 0.12, 0.12] as const,
}
/** Свободные атомы перед переходом электронов: между ними ещё далеко. */
const FREE = {
  fe: [-0.78, 0.16, 0.12] as const,
  s: [0.72, 0.02, 0.12] as const,
}

// ─────────────────────────────────────────────────────────────────────────────
// Дорожки положений
// ─────────────────────────────────────────────────────────────────────────────

const POS: Partial<Record<FesAtomId, Vec3Track>> = {
  fe1: [
    { t: 0, v: FE1_START },
    { t: 4.6, v: FE1_START },
    { t: 7.4, v: FREE.fe, ease: 'smooth', arc: 0.2 },
    { t: 12.6, v: FREE.fe },
    { t: T_PAIR, v: PAIR.fe, ease: 'smooth' },
    { t: 15.6, v: PAIR.fe },
    { t: 17.1, v: FE1_SITE, ease: 'smooth' },
  ],
  s1: [
    { t: 0, v: S1_START },
    { t: 4.6, v: S1_START },
    { t: 7.4, v: FREE.s, ease: 'smooth', arc: -0.2 },
    { t: 12.6, v: FREE.s },
    { t: T_PAIR, v: PAIR.s, ease: 'smooth' },
    { t: 15.6, v: PAIR.s },
    { t: 17.1, v: S1_SITE, ease: 'smooth' },
  ],
}
for (const m of IRON_ATOMS) POS[m.id] = [{ t: 0, v: m.pos }]
for (const r of RING_ATOMS) POS[r.id] = [{ t: 0, v: r.pos }]

// ——— Рост кристалла: ионы подлетают к готовой паре, ближние раньше ———
const T_GROW = { from: 15.1, to: T_LATTICE - 0.2 }

const noise = (n: number, k: number): number => {
  const s = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

type LatticeMeta = { id: FesAtomId; start: number; arrive: number; track: Vec3Track }

export const FES_LATTICE_META: readonly LatticeMeta[] = LATTICE_SITES.map((l, i) => ({
  l,
  i,
  dist: Math.hypot(l.pos[0], l.pos[1], l.pos[2]),
}))
  .sort((a, b) => a.dist - b.dist || a.i - b.i)
  .map(({ l, i }, rank, all) => {
    const arrive = T_GROW.from + (rank / Math.max(1, all.length - 1)) * (T_GROW.to - T_GROW.from)
    const start = arrive - 1.6
    const [x, y, z] = l.pos
    const far = 1.5 + 0.16 * noise(i, 1)
    const track: Vec3Track = [
      {
        t: start,
        v: [x * far + 0.18 * noise(i, 2), y * far + 0.18 * noise(i, 3), z * far + 0.18 * noise(i, 4)],
      },
      { t: arrive, v: [x, y, z], ease: 'smooth' },
    ]
    return { id: l.id, start, arrive, track }
  })

const LATTICE_START: Record<string, number> = Object.fromEntries(FES_LATTICE_META.map((m) => [m.id, m.start]))
for (const m of FES_LATTICE_META) POS[m.id] = m.track

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

/** Подъём опилок железа к магниту — и обратно, когда магнит убрали. */
const IRON_LIFT: ScalarTrack = [
  { t: 0, v: 0 },
  { t: T_MAGNET + 0.1, v: 0 },
  { t: T_SEPARATE, v: 0.4, ease: 'smooth' },
  { t: 3.4, v: 0.4 },
  { t: 4.2, v: 0, ease: 'smooth' },
]

/** РАДИУС МЕНЯЕТСЯ РОВНО ТОГДА, КОГДА ЭЛЕКТРОНЫ УХОДЯТ / ПРИХОДЯТ. */
const RADIUS_FE = rampTrack(T_E1.leave, R.fe, T_E2.arrive + 0.25, R.feIon)
const RADIUS_S = rampTrack(T_E1.arrive - 0.5, R.s, T_E2.arrive + 0.7, R.sIon)

/** Реальная степень окисления: 0 → +2 и 0 → −2 (в пул пишется зажатой в ±1). */
const CHARGE_FE = rampTrack(T_E1.leave, 0, T_E2.arrive, 2, 'smooth')
const CHARGE_S = rampTrack(T_E1.arrive - 0.4, 0, T_E2.arrive + 0.3, -2, 'smooth')

/** Металл и корона: живут до поджига, затем уходят из кадра (реагируют так же). */
const MIX_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.7, v: 1, ease: 'smooth' },
  { t: T_IGNITE + 0.5, v: 1 },
  { t: 8.4, v: 0, ease: 'smooth' },
]
const IRON_BOND_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.9, v: 0.6, ease: 'smooth' },
  { t: 5.4, v: 0.6 },
  { t: 8.4, v: 0, ease: 'smooth' },
]
const RING_BOND_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.9, v: 1, ease: 'smooth' },
  { t: T_IGNITE, v: 1 },
  { t: 7.6, v: 0, ease: 'smooth' },
]

/** Пламя горелки: подводим тепло, после поджига горелку убирают. */
const BURNER: ScalarTrack = [
  { t: 4.1, v: 0 },
  { t: 5.9, v: 1, ease: 'smooth' },
  { t: T_IGNITE + 0.5, v: 0.9 },
  { t: 8.0, v: 0, ease: 'smooth' },
]

/** Самоподдерживающееся горение: началось на поджиге и дальше идёт без нагревания. */
const BURN: ScalarTrack = [
  { t: T_IGNITE - 0.2, v: 0 },
  { t: 7.2, v: 1, ease: 'smooth' },
  { t: 13, v: 0.7, ease: 'smooth' },
  { t: 17.5, v: 0.3, ease: 'smooth' },
  { t: 21, v: 0.2 },
]

/** Магнит: приходит к смеси, потом к готовому сульфиду. */
const MAGNET_POS: Vec3Track = [
  { t: 0, v: [IRON_CENTER[0], 2.7, 0] },
  { t: 1.3, v: [IRON_CENTER[0], 2.7, 0] },
  { t: T_MAGNET, v: [IRON_CENTER[0], 1.12, 0], ease: 'smooth' },
  { t: 3.5, v: [IRON_CENTER[0], 1.12, 0] },
  { t: 4.4, v: [IRON_CENTER[0], 2.7, 0], ease: 'smooth' },
  { t: 18.2, v: [0, 2.7, 0], ease: 'smooth' },
  { t: T_MAGNET_FAIL, v: [0, 1.32, 0], ease: 'smooth' },
  { t: 20.6, v: [0, 1.32, 0] },
  { t: 21.4, v: [0, 2.7, 0], ease: 'smooth' },
]
const MAGNET_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 1.3, v: 0 },
  { t: 1.9, v: 1, ease: 'smooth' },
  { t: 3.6, v: 1 },
  { t: 4.3, v: 0, ease: 'smooth' },
  { t: 18.3, v: 0 },
  { t: 19.0, v: 1, ease: 'smooth' },
  { t: 20.8, v: 1 },
  { t: 21.4, v: 0, ease: 'smooth' },
]

/** Рёбра октаэдров решётки: проявляются, когда фрагмент собран. */
const EDGES: ScalarTrack = [
  { t: T_GROW.to - 0.6, v: 0 },
  { t: T_LATTICE, v: 0.55, ease: 'smooth' },
  { t: 24.4, v: 0.55 },
  { t: FES_FINISH.to, v: 0, ease: 'smooth' },
]

const CAM_ZOOM: ScalarTrack = [
  { t: 0, v: 0.72 },
  { t: 4, v: 0.78, ease: 'smooth' },
  { t: 8, v: 1.0, ease: 'smooth' },
  { t: 12.6, v: 1.12, ease: 'smooth' },
  { t: T_PAIR, v: 1.18, ease: 'smooth' },
  { t: 16.0, v: 0.86, ease: 'smooth' },
  { t: T_LATTICE + 0.4, v: 0.6, ease: 'smooth' },
  { t: 25, v: 0.56, ease: 'smooth' },
]
const CAM_YAW: ScalarTrack = [
  { t: 15.6, v: 0 },
  { t: 20.4, v: 0.48, ease: 'smooth' },
  { t: 25, v: 0.62, ease: 'smooth' },
]
const CAM_ROLL: ScalarTrack = [
  { t: 15.6, v: 0 },
  { t: 20.4, v: -0.13, ease: 'smooth' },
]
const CAM_OFFSET: Vec3Track = [
  { t: 0, v: [0, 0.06, 0] },
  { t: 8, v: [0, 0.1, 0], ease: 'smooth' },
  { t: 15.6, v: [0, 0.02, 0], ease: 'smooth' },
  { t: 20.4, v: [0, 0.08, 0], ease: 'smooth' },
]
const FADE = fadeTrack(FES_FINISH)

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Тексты подписей — формулы и обозначения СИ, одинаковые в ru/en/uz;
 * состояния вещества и единицы пишутся ТОКЕНАМИ ({s}, {pm}, {kJmol}),
 * сцена подставляет язык один раз за кадр. Все словесные пояснения живут
 * в fesMechanismText.{ts,en.ts,uz.ts} и показываются панелью урока.
 */
export type FesLabelDef = SceneLabelDef & { anchor: FesAtomId | 'iron' | 'crown' | 'pair' | 'crystal' }

const A_SUB_LABEL = Math.round(A_SUB_PM * 10) / 10
const FE_S_LABEL = Math.round(TROILITE.cationAnionPm * 10) / 10
/** Верх/низ фрагмента для разведения подписей по высоте. */
const SLAB_TOP = C / 2 + R.sIon

export const FES_LABELS: readonly FesLabelDef[] = [
  { id: 'iron', kind: 'species', anchor: 'iron', dy: 0.92, keys: [{ t: 0, text: 'Fe ({s})' }], windows: [[0.8, 6.8]] },
  { id: 'crown', kind: 'species', anchor: 'crown', dy: 0.92, keys: [{ t: 0, text: 'S₈ ({s})' }], windows: [[0.8, 6.8]] },
  {
    id: 'fe1',
    kind: 'species',
    anchor: 'fe1',
    dy: 0.2,
    keys: [
      { t: 0, text: 'Fe' },
      { t: T_E2.arrive + 0.2, text: 'Fe²⁺' },
    ],
    windows: [[7.6, T_LATTICE - 0.3]],
  },
  {
    id: 's1',
    kind: 'species',
    anchor: 's1',
    dy: 0.2,
    keys: [
      { t: 0, text: 'S' },
      { t: T_E2.arrive + 0.3, text: 'S²⁻' },
    ],
    windows: [[7.6, T_LATTICE - 0.3]],
  },
  {
    id: 'oxFe',
    kind: 'ox',
    anchor: 'fe1',
    dy: -0.2,
    keys: [
      { t: 0, text: '0' },
      { t: T_E2.arrive, text: '+2' },
    ],
    windows: [[8.0, 16.0]],
  },
  {
    id: 'oxS',
    kind: 'ox',
    anchor: 's1',
    dy: -0.2,
    keys: [
      { t: 0, text: '0' },
      { t: T_E2.arrive + 0.1, text: '−2' },
    ],
    windows: [[8.0, 16.0]],
  },
  // Шаг 4: ионная пара стоит ровно на справочном d(Fe²⁺–S²⁻) троилита.
  {
    id: 'pair',
    kind: 'delta',
    anchor: 'pair',
    dy: 0.52,
    keys: [{ t: 0, text: `${FE_S_LABEL} {pm}` }],
    windows: [[T_PAIR - 0.2, 15.9]],
  },
  // Шаг 4: параметр подъячейки NiAs и координационные числа (разведены по высоте).
  {
    id: 'cell',
    kind: 'delta',
    anchor: 'crystal',
    dy: SLAB_TOP + 1.12,
    keys: [{ t: 0, text: `a = ${A_SUB_LABEL} {pm}` }],
    windows: [[T_LATTICE - 0.2, 24.4]],
  },
  {
    id: 'coord',
    kind: 'token',
    anchor: 'crystal',
    dy: SLAB_TOP + 0.5,
    keys: [{ t: 0, text: 'Fe²⁺ : 6 S²⁻ · S²⁻ : 6 Fe²⁺' }],
    windows: [[T_LATTICE + 0.4, 19.0]],
  },
  { id: 'fes', kind: 'species', anchor: 'crystal', dy: -(SLAB_TOP + 0.55), keys: [{ t: 0, text: 'FeS ({s})' }], windows: [[T_LATTICE - 0.1, 24.6]] },
  // Шаг 5: качественная проба — то, чего исходная смесь не давала.
  {
    id: 'acid',
    kind: 'token',
    anchor: 'crystal',
    dy: -(SLAB_TOP + 1.05),
    keys: [{ t: 0, text: 'FeS + 2 HCl → FeCl₂ + H₂S↑' }],
    windows: [[20.3, 21.4]],
  },
  { id: 'dH', kind: 'delta', anchor: 'crystal', dy: -(SLAB_TOP + 1.05), keys: [{ t: 0, text: 'ΔH°f = −100 {kJmol}' }], windows: [[T_EXO - 0.4, 24.6]] },
]

export type FesLabelState = SceneLabelState

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type FesFrame = {
  atoms: Record<FesAtomId, THREE.Vector3>
  radius: Record<FesAtomId, number>
  /** настоящая степень окисления: 0 → +2 у железа, 0 → −2 у серы */
  charge: Record<FesAtomId, number>
  opacity: Record<FesAtomId, number>
  emissive: Record<FesAtomId, number>
  /** прозрачность связей металлического железа и короны S₈ */
  ironBond: number
  ringBond: number
  /** прозрачность рёбер октаэдров фрагмента решётки */
  edges: number
  electrons: [ElectronJump, ElectronJump]
  /** подсветка схематичной валентной оболочки железа, 0..1 */
  shell: number
  /** сила линий электростатического поля в ионной паре, 0..1 */
  field: number
  /** подсветка октаэдрического окружения Fe²⁺, 0..1 */
  coord: number
  /** магнит: положение, видимость, «дрожь» неудачи */
  magnet: { pos: THREE.Vector3; opacity: number; fail: number }
  env: { burner: number; burn: number; exo: number; fade: number }
  labels: FesLabelState[]
  camera: { zoom: number; offset: THREE.Vector3; yaw: number; roll: number; shake: number; bloom: number; vignette: number }
  crystalCenter: THREE.Vector3
  ironCenter: THREE.Vector3
  crownCenter: THREE.Vector3
  /** центр реакции: где греет горелка и откуда идёт свет */
  hotSpot: THREE.Vector3
}

export function createFesFrame(): FesFrame {
  const atoms = {} as Record<FesAtomId, THREE.Vector3>
  const radius = {} as Record<FesAtomId, number>
  const charge = {} as Record<FesAtomId, number>
  const opacity = {} as Record<FesAtomId, number>
  const emissive = {} as Record<FesAtomId, number>
  for (const a of FES_ATOMS) {
    atoms[a.id] = new THREE.Vector3()
    radius[a.id] = a.el === 'Fe' ? R.fe : R.s
    charge[a.id] = 0
    opacity[a.id] = a.main ? 1 : 0
    emissive[a.id] = 0.08
  }
  return {
    atoms,
    radius,
    charge,
    opacity,
    emissive,
    ironBond: 0,
    ringBond: 0,
    edges: 0,
    electrons: [createElectronJump('e1'), createElectronJump('e2')],
    shell: 0,
    field: 0,
    coord: 0,
    magnet: { pos: new THREE.Vector3(), opacity: 0, fail: 0 },
    env: { burner: 0, burn: 0, exo: 0, fade: 0 },
    labels: createLabelStates(FES_LABELS),
    camera: { zoom: 1, offset: new THREE.Vector3(), yaw: 0, roll: 0, shake: 0, bloom: 0.3, vignette: 0.3 },
    crystalCenter: new THREE.Vector3(),
    ironCenter: new THREE.Vector3(IRON_CENTER[0], IRON_CENTER[1], IRON_CENTER[2]),
    crownCenter: new THREE.Vector3(CROWN_CENTER[0], CROWN_CENTER[1], CROWN_CENTER[2]),
    hotSpot: new THREE.Vector3(),
  }
}

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleFesFrame(t: number, frame: FesFrame): FesFrame {
  const { atoms, radius, charge, opacity, emissive } = frame

  for (const a of FES_ATOMS) {
    const track = POS[a.id]
    if (track) sampleVec3(track, t, atoms[a.id])
  }

  // ——— Магнит поднимает ВСЁ железо смеси: это и есть разделение компонентов ———
  const lift = sampleScalar(IRON_LIFT, t)
  if (lift > 0) for (const id of IRON_PULLED) atoms[id].y += lift
  frame.ironCenter.set(IRON_CENTER[0], IRON_CENTER[1] + lift, IRON_CENTER[2])

  radius.fe1 = sampleScalar(RADIUS_FE, t)
  radius.s1 = sampleScalar(RADIUS_S, t)
  charge.fe1 = sampleScalar(CHARGE_FE, t)
  charge.s1 = sampleScalar(CHARGE_S, t)

  const mix = sampleScalar(MIX_OPACITY, t)
  frame.ironBond = sampleScalar(IRON_BOND_OPACITY, t)
  frame.ringBond = sampleScalar(RING_BOND_OPACITY, t)
  opacity.fe1 = opacity.s1 = 1
  for (const m of IRON_ATOMS) {
    radius[m.id] = R.fe
    charge[m.id] = 0
    opacity[m.id] = mix
  }
  for (const r of RING_ATOMS) {
    radius[r.id] = R.s
    charge[r.id] = 0
    opacity[r.id] = mix
  }

  // Ионы решётки: уже готовые Fe²⁺ / S²⁻, проявляются на подлёте.
  for (const l of LATTICE_SITES) {
    radius[l.id] = l.el === 'Fe' ? R.feIon : R.sIon
    charge[l.id] = l.el === 'Fe' ? 2 : -2
    const s = LATTICE_START[l.id]!
    opacity[l.id] = smoothstep(s, s + 0.5, t)
  }

  // ——— Схематичная валентная оболочка 4s²: разгорается перед отдачей электронов ———
  frame.shell = windowFade([T_E1.leave - 1.4, T_E2.leave + 0.3], t, 0.45)

  // ——— Два электрона 4s² достраивают 3p-подуровень серы до октета ———
  sampleElectronJump(frame.electrons[0], t, {
    donor: atoms.fe1,
    acceptor: atoms.s1,
    shellRadius: SHELL_FE,
    acceptorRadius: radius.s1,
    leave: T_E1.leave,
    arrive: T_E1.arrive,
    arcSign: 1,
  })
  sampleElectronJump(frame.electrons[1], t, {
    donor: atoms.fe1,
    acceptor: atoms.s1,
    shellRadius: SHELL_FE,
    acceptorRadius: radius.s1,
    leave: T_E2.leave,
    arrive: T_E2.arrive,
    arcSign: -1,
  })

  frame.edges = sampleScalar(EDGES, t)

  // ——— Шаг 4: электростатическое притяжение Fe²⁺ ··· S²⁻ (закон Кулона) ———
  frame.field = windowFade([12.4, T_PAIR + 0.9], t, 0.6)

  // ——— Шаг 4: октаэдрическое окружение, КЧ 6 ———
  frame.coord = windowFade([T_LATTICE + 0.4, 19.0], t, 0.45) * (0.7 + 0.3 * Math.sin(t * 5.5))

  // ——— Магнит ———
  sampleVec3(MAGNET_POS, t, frame.magnet.pos)
  frame.magnet.opacity = sampleScalar(MAGNET_OPACITY, t)
  // «Не притягивается»: магнит подрагивает над кристаллом, а кристалл стоит.
  frame.magnet.fail = windowFade([T_MAGNET_FAIL - 0.4, 20.8], t, 0.4)

  // ——— Тепло: горелка, самоподдерживающееся горение, пик выделения энергии ———
  frame.env.burner = sampleScalar(BURNER, t)
  frame.env.burn = sampleScalar(BURN, t)
  const exo = smoothstep(T_EXO - 0.8, T_EXO, t) * (1 - 0.5 * smoothstep(T_EXO, T_EXO + 1.8, t))
  frame.env.exo = exo
  frame.env.fade = sampleScalar(FADE, t)

  // ——— Центры кадра ———
  frame.crystalCenter.set(0, 0, 0)
  const heat = Math.max(frame.env.burner, frame.env.burn)
  // Очаг тепла: середина между героями — в смеси это центр кучки, потом центр реакции.
  frame.hotSpot.copy(atoms.fe1).lerp(atoms.s1, 0.5)

  const hot = Math.max(heat * 0.55, exo)
  for (const a of FES_ATOMS) {
    let e = (a.el === 'Fe' ? 0.1 : 0.08) + hot * 0.45
    if (a.id === 'fe1') e += frame.shell * 0.32
    if (frame.coord > 0 && (a.id === 'fe1' || FES_COORDINATION_IDS.includes(a.id))) e += frame.coord * 0.45
    emissive[a.id] = e
  }

  // ——— Подписи ———
  sampleLabels(
    FES_LABELS,
    frame.labels,
    t,
    (def, st) => {
      const d = def as FesLabelDef
      if (d.anchor === 'crystal') {
        st.pos.copy(frame.crystalCenter)
        st.pos.y += d.dy
      } else if (d.anchor === 'iron') {
        st.pos.copy(frame.ironCenter)
        st.pos.y += d.dy
      } else if (d.anchor === 'crown') {
        st.pos.copy(frame.crownCenter)
        st.pos.y += d.dy
      } else if (d.anchor === 'pair') {
        st.pos.copy(atoms.fe1).lerp(atoms.s1, 0.5)
        st.pos.y += d.dy
      } else {
        st.pos.copy(atoms[d.anchor])
        st.pos.y += d.dy > 0 ? radius[d.anchor] + d.dy : -(radius[d.anchor] - d.dy)
      }
    },
    frame.env.fade,
  )

  // ——— Камера ———
  const cam = frame.camera
  cam.zoom = sampleScalar(CAM_ZOOM, t)
  sampleVec3(CAM_OFFSET, t, cam.offset)
  cam.yaw = sampleScalar(CAM_YAW, t)
  cam.roll = sampleScalar(CAM_ROLL, t)
  cam.shake =
    0.42 * Math.max(0, 1 - Math.abs(t - T_IGNITE) / 0.45) + 0.5 * Math.max(0, 1 - Math.abs(t - T_EXO) / 0.5)
  cam.bloom = 0.3 + 0.2 * frame.shell + 0.45 * frame.env.burn + 0.7 * exo
  cam.vignette = 0.3 + 0.15 * exo
  return frame
}

/** Число ионов во фрагменте решётки (включая героев fe1 и s1). */
export const FES_SLAB_SIZE = SITES.length

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validateFesStoryboard(): void {
  const vec: Record<string, Vec3Track> = {}
  for (const [id, track] of Object.entries(POS)) if (track) vec[`pos.${id}`] = track
  vec['cam.offset'] = CAM_OFFSET
  vec['magnet.pos'] = MAGNET_POS
  validateTracks(vec)
  validateTracks({
    IRON_LIFT,
    RADIUS_FE,
    RADIUS_S,
    CHARGE_FE,
    CHARGE_S,
    MIX_OPACITY,
    IRON_BOND_OPACITY,
    RING_BOND_OPACITY,
    BURNER,
    BURN,
    MAGNET_OPACITY,
    EDGES,
    CAM_ZOOM,
    CAM_YAW,
    CAM_ROLL,
    FADE,
  })

  // ——— Строение вещества: железо ОЦК, сера — корона S₈ ———
  if (IRON_ATOMS.length !== 8) throw new Error(`fes: в ОЦК-фрагменте кроме героя должно остаться 8 атомов, получилось ${IRON_ATOMS.length}`)
  if (IRON_BONDS.length !== 8) throw new Error(`fes: КЧ(Fe) в ОЦК обязано быть 8, получилось ${IRON_BONDS.length}`)
  if (RING_ORDER.length !== 8) throw new Error(`fes: корона серы обязана быть S₈, получилось ${RING_ORDER.length}`)
  if (RING_BONDS.length !== 8) throw new Error('fes: в короне S₈ ровно 8 связей S–S (замкнутый цикл)')
  for (let k = 0; k < 8; k++) {
    const a = ringPos(k)
    const b = ringPos((k + 1) % 8)
    const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    const pm = (d / pmToScene(100)) * 100
    if (Math.abs(pm - S8_D_PM) > 0.5) throw new Error(`fes: связь S–S в короне ${pm.toFixed(1)} пм, справочник даёт ${S8_D_PM}`)
  }

  // ——— Решётка: чередование сортов и координационное число ———
  if (FES_SLAB_SIZE < 24) throw new Error(`fes: фрагмент решётки слишком мал (${FES_SLAB_SIZE} ионов)`)
  if (FES_EDGES.length === 0) throw new Error('fes: во фрагменте не нашлось ни одного ребра Fe–S')
  const elById = new Map(FES_ATOMS.map((a) => [a.id, a.el]))
  for (const [a, b] of FES_EDGES) {
    if (elById.get(a) === elById.get(b)) throw new Error(`fes: соседи ${a} и ${b} одного сорта — решётка построена неверно`)
  }
  if (FES_COORDINATION_IDS.length !== 6) {
    throw new Error(`fes: КЧ(Fe²⁺) обязано быть 6 (октаэдр из S²⁻), получилось ${FES_COORDINATION_IDS.length}`)
  }
  for (const id of FES_COORDINATION_IDS) {
    if (elById.get(id) !== 'S') throw new Error(`fes: в октаэдре вокруг Fe²⁺ обязана быть только сера, найден ${id}`)
  }
  // Идеальная подъячейка NiAs отличается от измеренного троилита меньше чем на 1,5 %.
  const dev = Math.abs(FE_S_IDEAL_PM - TROILITE.cationAnionPm) / TROILITE.cationAnionPm
  if (dev > 0.015) {
    throw new Error(`fes: нарисованное d(Fe–S) = ${FE_S_IDEAL_PM.toFixed(1)} пм расходится с троилитом ${TROILITE.cationAnionPm} пм на ${(dev * 100).toFixed(1)} %`)
  }

  // ——— Физика размера: катион меньше атома, анион больше ———
  if (!(R.feIon < R.fe)) throw new Error('fes: Fe²⁺ обязан быть меньше атома Fe')
  if (!(R.sIon > R.s)) throw new Error('fes: S²⁻ обязан быть больше атома S')
  const ratio = speciesRadiusPm('S', -2) / speciesRadiusPm('Fe', 2)
  if (ratio < 2.2 || ratio > 2.5) throw new Error(`fes: S²⁻ / Fe²⁺ = ${ratio.toFixed(2)}, ожидалось ≈ 2,36`)

  // ——— Ионная пара стоит ровно на справочном расстоянии ———
  const pairD = Math.hypot(PAIR.fe[0] - PAIR.s[0], PAIR.fe[1] - PAIR.s[1], PAIR.fe[2] - PAIR.s[2])
  if (Math.abs(pairD - FE_S_PAIR) > 1e-6) throw new Error('fes: ионная пара обязана стоять на d(Fe²⁺–S²⁻) из справочника')
}
