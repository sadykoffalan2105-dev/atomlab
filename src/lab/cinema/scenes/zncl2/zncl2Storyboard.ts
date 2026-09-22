import * as THREE from 'three'
import { bondAngleDeg, bondLengthPm, getCrystal } from '../../../../chemistry/data'
import { sampleScalar, sampleVec3, windowFade, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { bondLength, pmToScene, speciesRadius, speciesRadiusPm } from '../kit/cpkAtoms'
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
import { ZNCL2_END, ZNCL2_FINISH, zncl2CueAt } from './zncl2Steps'

export {
  ZNCL2_CUES,
  ZNCL2_END,
  ZNCL2_FINISH,
  ZNCL2_SEGMENTS,
  ZNCL2_STEPS,
  ZNCL2_STEP_IDS,
  ZNCL2_TIMING,
  zncl2StepIndexAt,
  type Zncl2CueId,
  type Zncl2StepId,
} from './zncl2Steps'

/**
 * Раскадровка Zn (тв.) + 2 HCl (р-р) → ZnCl₂ (р-р) + H₂ (г.)↑ — ЧИСТАЯ функция
 * времени сюжета: ни THREE-сцены, ни React, только числа.
 *
 * Вся химия — из src/chemistry/data (ни одного числа руками):
 *   • цинк металлический: ГПУ, P6₃/mmc (194), a = 266,49 пм, c = 494,68 пм,
 *     c/a = 1,856, КЧ 12 — шесть соседей в слое (266,5 пм) и шесть в соседних
 *     слоях (≈ 291 пм);
 *   • радиусы: Zn⁰ 134 пм (металлический) → Zn²⁺ 74 пм (Shannon, КЧ 6);
 *     Cl⁻ 181 пм; O 66 пм и H 31 пм (ковалентные);
 *   • связи: H–H 74,14 пм; O–H 95,8 пм; Zn–O 208 пм в аквакомплексе
 *     [Zn(H₂O)₆]²⁺ (EXAFS, КЧ 6);
 *   • углы: H–O–H в воде — bondAngleDeg('water'); H₃O⁺ — тригональная пирамида, нарисована
 *     по идеальной VSEPR-геометрии 109,47° (измеренный угол 111°).
 *
 * ЭЛЕКТРОНЕЙТРАЛЬНОСТЬ КАДРА. В сцене ровно одна формульная единица реакции:
 * один атом цинка, которому предстоит уйти в раствор, ДВА протона (в виде H₃O⁺)
 * и ДВА иона Cl⁻. До реакции 2(+1) и 2(−1), после — (+2) и 2(−1): заряд сходится.
 *
 * ЧТО НАРИСОВАНО СХЕМАТИЧНО (и так сказано в тексте урока):
 *   • H⁺ — голое ядро: его радиус примерно в 10⁵ раз меньше атомного, поэтому
 *     протон нарисован маленьким светящимся шариком, а не в масштабе;
 *   • «полёт» электрона по дуге внутри металла: электроны в металле обобществлены,
 *     отдельной траектории у них нет;
 *   • пузырёк водорода — кольца точек: настоящий пузырёк содержит ~10¹⁷ молекул;
 *   • показаны 18 атомов пластинки и 12 молекул воды; в капле раствора их ~10²¹.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

const ZN_METAL = getCrystal('zn_metal')!
const ZN_SALT = getCrystal('zncl2')!

/** Ближайший сосед в слое ГПУ-цинка = параметр a. */
const A = pmToScene(ZN_METAL.cellPm.a)
/** Половина периода c: расстояние между плотноупакованными слоями. */
const LAYER = pmToScene((ZN_METAL.cellPm.c ?? ZN_METAL.cellPm.a) / 2)

const D_OH = bondLength('O-H')
const D_HH = bondLength('H-H')
const D_ZNO = bondLength('Zn-O')

const ANG_WATER = (bondAngleDeg('water') * Math.PI) / 180
const ANG_TETRA = (bondAngleDeg('tetrahedral') * Math.PI) / 180

const R = {
  zn: speciesRadius('Zn', 0),
  znIon: speciesRadius('Zn', 2),
  cl: speciesRadius('Cl', -1),
  o: speciesRadius('O', 0),
  h: speciesRadius('H', 0),
} as const

/**
 * Голое ядро водорода. Настоящий радиус протона ~0,84 фм — в сто тысяч раз
 * меньше атома, нарисовать его в масштабе невозможно. Рисуем как 45 % шарика
 * атома H: это ЗНАК «здесь протон», а не размер. Текст шага говорит об этом прямо.
 */
const R_PROTON = R.h * 0.45

/** Радиус схематичной валентной оболочки атома цинка (электронный газ металла). */
const SHELL_ZN = R.zn * 1.3

export const ZNCL2_GEOM = {
  radius: { ...R, proton: R_PROTON },
  shellZn: SHELL_ZN,
  bond: { oh: D_OH, hh: D_HH, znO: D_ZNO },
  metal: { a: A, layer: LAYER },
  /** справочные числа для подписей и тестов */
  data: {
    metal: {
      spaceGroup: ZN_METAL.spaceGroup,
      spaceGroupNo: ZN_METAL.spaceGroupNo,
      latticeType: ZN_METAL.latticeType,
      aPm: ZN_METAL.cellPm.a,
      cPm: ZN_METAL.cellPm.c ?? 0,
      neighbourPm: ZN_METAL.cationAnionPm,
      coordination: ZN_METAL.coordination,
      densityGCm3: ZN_METAL.densityGCm3,
    },
    salt: {
      spaceGroup: ZN_SALT.spaceGroup,
      spaceGroupNo: ZN_SALT.spaceGroupNo,
      latticeType: ZN_SALT.latticeType,
      aPm: ZN_SALT.cellPm.a,
      cPm: ZN_SALT.cellPm.c ?? 0,
      znClPm: ZN_SALT.cationAnionPm,
      coordination: ZN_SALT.coordination,
    },
    znPm: speciesRadiusPm('Zn', 0),
    znIonPm: speciesRadiusPm('Zn', 2),
    clIonPm: speciesRadiusPm('Cl', -1),
    hhPm: bondLengthPm('H-H'),
    ohPm: bondLengthPm('O-H'),
    znOPm: bondLengthPm('Zn-O'),
    waterAngleDeg: bondAngleDeg('water'),
  },
} as const

/** Масштаб рига камеры. */
export const ZNCL2_RIG_SCALE = 1.15

// ─────────────────────────────────────────────────────────────────────────────
// 2. Векторная мелочь (раскадровка читается в Node, поэтому без THREE-объектов)
// ─────────────────────────────────────────────────────────────────────────────

type V3 = readonly [number, number, number]

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const len3 = (a: V3): number => Math.hypot(a[0], a[1], a[2])
const unit = (a: V3): V3 => {
  const l = len3(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const cross3 = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/**
 * Шесть вершин октаэдра: три взаимно перпендикулярные оси и их противоположности.
 * Именно это и есть координационное число 6 аквакомплекса [Zn(H₂O)₆]²⁺.
 */
function octahedronAxes(seed: V3): V3[] {
  const u = unit(seed)
  const v = unit(cross3([0, 0, 1], u))
  const w = cross3(u, v)
  return [u, mul(u, -1), v, mul(v, -1), w, mul(w, -1)]
}

const OCT_AXES = octahedronAxes([1, 0.26, 0.24])

// ─────────────────────────────────────────────────────────────────────────────
// 3. Пластинка цинка: фрагмент ГПУ-решётки
// ─────────────────────────────────────────────────────────────────────────────

/** Плоскость поверхности, обращённой к раствору. */
const PLATE_X = -1.95
const SQ32 = Math.sqrt(3) / 2

type PlateSite = { id: Zncl2AtomId; pos: V3; layer: 0 | 1 }

/**
 * Два плотноупакованных слоя ABAB: слой B смещён на центр треугольника слоя A,
 * (u + v)/3 = a/√3, и отстоит на c/2. Отсюда 6 соседей в слое (266,5 пм)
 * и 6 в соседнем слое (≈ 291 пм) — координационное число 12.
 */
const PLATE_SITES: PlateSite[] = (() => {
  const out: PlateSite[] = []
  const cells: Array<[number, number]> = []
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) cells.push([i, j])
  // Атом, которому предстоит уйти в раствор, — в центре обращённой к кислоте грани.
  cells.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]))
  let n = 0
  for (const [i, j] of cells) {
    out.push({ id: `Z${n++}` as Zncl2AtomId, pos: [PLATE_X, i * A + j * (A / 2), j * A * SQ32], layer: 0 })
  }
  for (const [i, j] of cells) {
    out.push({
      id: `Z${n++}` as Zncl2AtomId,
      pos: [PLATE_X - LAYER, i * A + j * (A / 2) + A / 2, j * A * SQ32 + (A * SQ32 * 2) / 6],
      layer: 1,
    })
  }
  return out
})()

/** Атом, который растворится: центр поверхностного слоя. */
const ZN0: Zncl2AtomId = 'Z0'

/** Рёбра металла: все пары ближе 1,15·a — 6 в слое и 6 между слоями (КЧ 12). */
export const ZNCL2_METAL_BONDS: readonly (readonly [Zncl2AtomId, Zncl2AtomId])[] = (() => {
  const out: [Zncl2AtomId, Zncl2AtomId][] = []
  for (let i = 0; i < PLATE_SITES.length; i++) {
    for (let j = i + 1; j < PLATE_SITES.length; j++) {
      if (len3(sub(PLATE_SITES[i]!.pos, PLATE_SITES[j]!.pos)) < A * 1.15) {
        out.push([PLATE_SITES[i]!.id, PLATE_SITES[j]!.id])
      }
    }
  }
  return out
})()

const PLATE_CENTER: V3 = [PLATE_X - LAYER / 2, 0, 0]

// ─────────────────────────────────────────────────────────────────────────────
// 4. Ключевые моменты
// ─────────────────────────────────────────────────────────────────────────────

const T_APPROACH = zncl2CueAt('approach') // 6.0
const T_ELECTRONS = zncl2CueAt('electrons') // 7.4
const T_H2 = zncl2CueAt('h2form') // 10.4
const T_BUBBLE = zncl2CueAt('bubble') // 12.2
const T_LEAVE = zncl2CueAt('znLeave') // 14.0
const T_HYDRATION = zncl2CueAt('hydration') // 16.4
const T_SPECTATOR = zncl2CueAt('spectator') // 18.6
const T_EXO = zncl2CueAt('exo') // 21.6

/** Электрон 1 → протон A, электрон 2 → протон B (полуреакция 2H⁺ + 2e⁻ → H₂). */
const T_E1 = { leave: 6.4, arrive: T_ELECTRONS }
const T_E2 = { leave: 6.75, arrive: T_ELECTRONS + 0.35 }

// ─────────────────────────────────────────────────────────────────────────────
// 5. Ионы гидроксония: подход к поверхности и отдача протона
// ─────────────────────────────────────────────────────────────────────────────

/** Места, куда садятся протоны на поверхности металла. */
const PA: V3 = [-1.44, 0.38, 0.21]
const PB: V3 = [-1.44, -0.4, -0.19]

/** Направление «от металла» для каждого гидроксония. */
const DIR_A = unit([0.78, 0.5, 0.38])
const DIR_B = unit([0.8, -0.52, -0.34])

/** Пока протон в составе H₃O⁺, он висит на 0,14 ед. дальше площадки — связь потом тянется и рвётся. */
const PROTON_GAP = 0.14

const OA_DOCK = add(PA, mul(DIR_A, D_OH + PROTON_GAP))
const OB_DOCK = add(PB, mul(DIR_B, D_OH + PROTON_GAP))

const OA_PATH: Vec3Track = [
  { t: 0, v: [1.75, 1.05, 0.4] },
  { t: 1.6, v: [0.95, 0.88, 0.36], ease: 'smooth' },
  { t: T_APPROACH, v: OA_DOCK, ease: 'smooth' },
  { t: 7.8, v: OA_DOCK },
  { t: 11.5, v: [0.2, 1.32, 0.55], ease: 'smooth' },
  { t: 19, v: [0.72, 1.55, 0.68], ease: 'smooth' },
  { t: ZNCL2_END, v: [0.9, 1.68, 0.72], ease: 'smooth' },
]

const OB_PATH: Vec3Track = [
  { t: 0, v: [1.85, -1.18, -0.5] },
  { t: 1.6, v: [1.02, -0.98, -0.44], ease: 'smooth' },
  { t: T_APPROACH + 0.3, v: OB_DOCK, ease: 'smooth' },
  { t: 8.1, v: OB_DOCK },
  { t: 11.8, v: [0.32, -1.3, -0.62], ease: 'smooth' },
  { t: 19, v: [0.95, -1.55, -0.74], ease: 'smooth' },
  { t: ZNCL2_END, v: [1.08, -1.66, -0.78], ease: 'smooth' },
]

/** Смещение протона относительно кислорода, пока он в составе H₃O⁺. */
const OFF_A1 = mul(DIR_A, -D_OH)
const OFF_B1 = mul(DIR_B, -D_OH)

/** Ось рождающейся молекулы H₂ и точка встречи двух атомов на поверхности. */
const H2_AXIS = unit([0.05, 0.9, 0.43])
const H2_HALF = mul(H2_AXIS, D_HH / 2)

/** Путь пузырька: рождается у поверхности, отрывается и всплывает. */
const BUBBLE_PATH: Vec3Track = [
  { t: T_H2, v: [-1.3, -0.01, 0.01] },
  { t: T_BUBBLE, v: [-1.24, 0.22, 0.06], ease: 'smooth' },
  { t: 14.5, v: [-1.16, 0.7, 0.14], ease: 'smooth' },
  { t: 17, v: [-1.06, 1.24, 0.22], ease: 'smooth' },
  { t: 21, v: [-0.92, 2.2, 0.34], ease: 'smooth' },
  { t: ZNCL2_END, v: [-0.84, 2.98, 0.4], ease: 'smooth' },
]

/**
 * Дорожка протона: пока он часть H₃O⁺ — жёстко за кислородом (ключи те же,
 * что у кислорода, плюс постоянное смещение), потом отрывается на площадку
 * поверхности и дальше живёт как половина молекулы H₂.
 */
function protonTrack(oPath: Vec3Track, off: V3, site: V3, dock: number, detach: number, side: 1 | -1): Vec3Track {
  const keys: Vec3Track[number][] = []
  for (const k of oPath) {
    if (k.t > dock) break
    keys.push({ t: k.t, v: add(k.v as V3, off), ease: k.ease })
  }
  const docked = keys[keys.length - 1]!.v as V3
  keys.push({ t: detach - 0.5, v: docked })
  keys.push({ t: detach, v: site, ease: 'smooth' })
  keys.push({ t: T_H2 - 1.8, v: site })
  for (const k of BUBBLE_PATH) {
    keys.push({ t: k.t, v: add(k.v as V3, mul(H2_HALF, side)), ease: k.t === T_H2 ? 'smooth' : k.ease })
  }
  return keys
}

const HA1_PATH = protonTrack(OA_PATH, OFF_A1, PA, T_APPROACH, T_ELECTRONS, 1)
const HB1_PATH = protonTrack(OB_PATH, OFF_B1, PB, T_APPROACH + 0.3, T_ELECTRONS + 0.35, -1)

// ─────────────────────────────────────────────────────────────────────────────
// 6. Ион цинка и его гидратная оболочка
// ─────────────────────────────────────────────────────────────────────────────

/** Куда встаёт гидратированный ион Zn²⁺. */
const ZN_AQ: V3 = [0.55, -0.15, 0.1]

const Z0_PATH: Vec3Track = [
  { t: 0, v: PLATE_SITES[0]!.pos },
  { t: 13.4, v: PLATE_SITES[0]!.pos },
  { t: 14.6, v: [-1.2, -0.08, 0.06], ease: 'smooth' },
  { t: 16.2, v: ZN_AQ, ease: 'smooth' },
  { t: ZNCL2_END, v: ZN_AQ },
]

/** Стартовые места шести молекул воды, которые потом станут гидратной оболочкой. */
const SHELL_START: readonly V3[] = [
  [1.95, 0.05, 0.6],
  [0.35, 0.95, -0.7],
  [1.2, 1.15, 0.45],
  [-0.15, -1.05, -0.55],
  [1.45, -1.35, -0.3],
  [0.05, 0.25, 0.85],
]

const SHELL_SITES: readonly V3[] = OCT_AXES.map((n) => add(ZN_AQ, mul(n, D_ZNO)))

const SHELL_PATHS: readonly Vec3Track[] = SHELL_START.map((start, i) => [
  { t: 0, v: start },
  { t: 6, v: add(start, [-0.1, 0.08 * (i % 2 ? 1 : -1), 0.06]), ease: 'smooth' },
  { t: 13.4, v: add(start, [-0.18, 0.12 * (i % 2 ? 1 : -1), 0.1]), ease: 'smooth' },
  { t: T_HYDRATION, v: SHELL_SITES[i]!, ease: 'smooth' },
  { t: ZNCL2_END, v: SHELL_SITES[i]! },
])

// ─────────────────────────────────────────────────────────────────────────────
// 7. Ионы-зрители Cl⁻ и фоновая вода
// ─────────────────────────────────────────────────────────────────────────────

const CL_PATHS: readonly Vec3Track[] = [
  [
    { t: 0, v: [1.95, 0.62, -0.55] },
    { t: 9, v: [1.62, 0.5, -0.42], ease: 'smooth' },
    { t: T_SPECTATOR, v: [1.78, 0.46, -0.3], ease: 'smooth' },
    { t: ZNCL2_END, v: [1.72, 0.52, -0.24], ease: 'smooth' },
  ],
  [
    { t: 0, v: [1.55, -0.98, 0.62] },
    { t: 9, v: [1.72, -1.08, 0.5], ease: 'smooth' },
    { t: T_SPECTATOR, v: [1.48, -1.12, 0.42], ease: 'smooth' },
    { t: ZNCL2_END, v: [1.55, -1.06, 0.38], ease: 'smooth' },
  ],
]

/** Фоновая вода: растворитель, который никуда не девается. */
const BG_START: readonly V3[] = [
  [1.9, 1.35, 0.3],
  [2.15, -0.42, -0.6],
  [0.15, -1.72, 0.2],
  [1.1, 1.9, -0.45],
  [-0.4, 1.42, 0.62],
  [0.7, -1.2, -0.78],
]

const BG_PATHS: readonly Vec3Track[] = BG_START.map((start, i) => {
  const s = i % 2 ? 1 : -1
  return [
    { t: 0, v: start },
    { t: 9, v: add(start, [0.12 * s, -0.1 * s, 0.08]), ease: 'smooth' },
    { t: 18, v: add(start, [-0.1 * s, 0.14 * s, -0.06]), ease: 'smooth' },
    { t: ZNCL2_END, v: add(start, [0.06 * s, 0.05 * s, 0.02]), ease: 'smooth' },
  ]
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Список частиц
// ─────────────────────────────────────────────────────────────────────────────

export type Zncl2Element = 'Zn' | 'H' | 'O' | 'Cl'

export type Zncl2AtomId =
  | `Z${number}`
  | 'oA'
  | 'hA1'
  | 'hA2'
  | 'hA3'
  | 'oB'
  | 'hB1'
  | 'hB2'
  | 'hB3'
  | `C${number}`
  | `W${number}`
  | `WH${number}`
  | `B${number}`
  | `BH${number}`

/** Роль частицы — по ней сцена выбирает прозрачность, свечение и цвет кромки. */
export type Zncl2Role = 'metal' | 'proton' | 'waterO' | 'waterH' | 'spectator'

export type Zncl2AtomDef = { id: Zncl2AtomId; el: Zncl2Element; role: Zncl2Role }

const SHELL_O: Zncl2AtomId[] = SHELL_START.map((_, i) => `W${i}` as Zncl2AtomId)
const SHELL_H: Zncl2AtomId[] = SHELL_START.flatMap((_, i) => [`WH${i * 2}`, `WH${i * 2 + 1}`] as Zncl2AtomId[])
const BG_O: Zncl2AtomId[] = BG_START.map((_, i) => `B${i}` as Zncl2AtomId)
const BG_H: Zncl2AtomId[] = BG_START.flatMap((_, i) => [`BH${i * 2}`, `BH${i * 2 + 1}`] as Zncl2AtomId[])
const CL_IDS: Zncl2AtomId[] = CL_PATHS.map((_, i) => `C${i}` as Zncl2AtomId)

export const ZNCL2_ATOMS: readonly Zncl2AtomDef[] = [
  ...PLATE_SITES.map((s) => ({ id: s.id, el: 'Zn' as const, role: 'metal' as const })),
  { id: 'oA', el: 'O', role: 'waterO' },
  { id: 'hA1', el: 'H', role: 'proton' },
  { id: 'hA2', el: 'H', role: 'waterH' },
  { id: 'hA3', el: 'H', role: 'waterH' },
  { id: 'oB', el: 'O', role: 'waterO' },
  { id: 'hB1', el: 'H', role: 'proton' },
  { id: 'hB2', el: 'H', role: 'waterH' },
  { id: 'hB3', el: 'H', role: 'waterH' },
  ...CL_IDS.map((id) => ({ id, el: 'Cl' as const, role: 'spectator' as const })),
  ...SHELL_O.map((id) => ({ id, el: 'O' as const, role: 'waterO' as const })),
  ...SHELL_H.map((id) => ({ id, el: 'H' as const, role: 'waterH' as const })),
  ...BG_O.map((id) => ({ id, el: 'O' as const, role: 'waterO' as const })),
  ...BG_H.map((id) => ({ id, el: 'H' as const, role: 'waterH' as const })),
]

/** Связи O–H: три у каждого H₃O⁺ (одна из них потом рвётся) и по две у каждой воды. */
export const ZNCL2_OH_BONDS: readonly { o: Zncl2AtomId; h: Zncl2AtomId; breaking: boolean }[] = [
  { o: 'oA', h: 'hA1', breaking: true },
  { o: 'oA', h: 'hA2', breaking: false },
  { o: 'oA', h: 'hA3', breaking: false },
  { o: 'oB', h: 'hB1', breaking: true },
  { o: 'oB', h: 'hB2', breaking: false },
  { o: 'oB', h: 'hB3', breaking: false },
  ...SHELL_O.flatMap((o, i) => [
    { o, h: SHELL_H[i * 2]!, breaking: false },
    { o, h: SHELL_H[i * 2 + 1]!, breaking: false },
  ]),
  ...BG_O.flatMap((o, i) => [
    { o, h: BG_H[i * 2]!, breaking: false },
    { o, h: BG_H[i * 2 + 1]!, breaking: false },
  ]),
]

/** Донорно-акцепторные связи Zn²⁺ ← OH₂: шесть штук, КЧ 6. */
export const ZNCL2_AQUA_BONDS: readonly { zn: Zncl2AtomId; o: Zncl2AtomId }[] = SHELL_O.map((o) => ({ zn: ZN0, o }))

export const ZNCL2_H2_BOND = { a: 'hA1' as Zncl2AtomId, b: 'hB1' as Zncl2AtomId }

// ─────────────────────────────────────────────────────────────────────────────
// 9. Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

/** Радиус цинка меняется ровно тогда, когда ион ПОКИДАЕТ металл: 134 → 74 пм. */
const RADIUS_ZN0 = rampTrack(13.4, R.zn, 14.9, R.znIon)
const CHARGE_ZN0 = rampTrack(13.4, 0, T_LEAVE + 0.6, 1, 'smooth')

/** Протон получает электрон — из голого ядра становится атомом H (31 пм). */
const RADIUS_HA1 = rampTrack(T_E1.arrive - 0.15, R_PROTON, T_E1.arrive + 0.5, R.h)
const RADIUS_HB1 = rampTrack(T_E2.arrive - 0.15, R_PROTON, T_E2.arrive + 0.5, R.h)
const CHARGE_HA1 = rampTrack(T_E1.arrive - 0.15, 1, T_E1.arrive + 0.4, 0, 'smooth')
const CHARGE_HB1 = rampTrack(T_E2.arrive - 0.15, 1, T_E2.arrive + 0.4, 0, 'smooth')

/** Появление раствора и металла. */
const PLATE_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.8, v: 1, ease: 'smooth' },
]
const SOLUTION_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.5, v: 0 },
  { t: 1.6, v: 1, ease: 'smooth' },
]
const METAL_BOND_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 1.0, v: 0.5, ease: 'smooth' },
  { t: 13, v: 0.5 },
  { t: 15, v: 0.3, ease: 'smooth' },
  { t: 20, v: 0.22, ease: 'smooth' },
]

/** Связь O–H, по которой уходит протон: тянется и рвётся ГЕТЕРОЛИТИЧЕСКИ (пара остаётся у кислорода). */
const PROTON_BOND_STRESS_A = rampTrack(T_APPROACH, 0, T_E1.arrive - 0.35, 1, 'inQuad')
const PROTON_BOND_FADE_A = rampTrack(T_E1.arrive - 0.45, 1, T_E1.arrive + 0.1, 0, 'smooth')
const PROTON_BOND_STRESS_B = rampTrack(T_APPROACH + 0.3, 0, T_E2.arrive - 0.35, 1, 'inQuad')
const PROTON_BOND_FADE_B = rampTrack(T_E2.arrive - 0.45, 1, T_E2.arrive + 0.1, 0, 'smooth')

/** Связь H–H: рождается в момент встречи двух атомов. */
const H2_BOND: ScalarTrack = [
  { t: T_H2 - 0.35, v: 0 },
  { t: T_H2 + 0.25, v: 1, ease: 'smooth' },
  { t: 24.4, v: 1 },
  { t: ZNCL2_FINISH.to, v: 0, ease: 'smooth' },
]
const H2_FORM: ScalarTrack = [
  { t: T_H2, v: 1 },
  { t: T_H2 + 0.9, v: 0, ease: 'smooth' },
]

/** Пузырёк: растёт вокруг молекулы, отрывается и всплывает. */
const BUBBLE_RADIUS: ScalarTrack = [
  { t: T_H2, v: D_HH * 0.8 },
  { t: T_BUBBLE, v: 0.3, ease: 'smooth' },
  { t: 17, v: 0.42, ease: 'smooth' },
  { t: 23, v: 0.5, ease: 'smooth' },
]
const BUBBLE_OPACITY: ScalarTrack = [
  { t: T_H2 + 0.1, v: 0 },
  { t: T_BUBBLE - 0.6, v: 1, ease: 'smooth' },
  { t: 23.5, v: 1 },
  { t: ZNCL2_FINISH.to, v: 0, ease: 'smooth' },
]

/** Донорно-акцепторные связи аквакомплекса. */
const AQUA_BOND: ScalarTrack = [
  { t: T_HYDRATION - 1.4, v: 0 },
  { t: T_HYDRATION, v: 0.75, ease: 'smooth' },
  { t: 24.4, v: 0.75 },
  { t: ZNCL2_FINISH.to, v: 0, ease: 'smooth' },
]

/** Электронный газ металла: подсвечивается, пока идёт перенос электронов. */
const GAS: ScalarTrack = [
  { t: 0, v: 0.2 },
  { t: 5.4, v: 0.25 },
  { t: T_E1.leave, v: 1, ease: 'smooth' },
  { t: T_E2.arrive + 0.6, v: 0.3, ease: 'smooth' },
  { t: 14, v: 0.3 },
  { t: 17, v: 0.15, ease: 'smooth' },
]

/** Тепловой эффект: раствор греется по ходу реакции, пик — на шаге энергии. */
const WARM: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 7.5, v: 0.1, ease: 'smooth' },
  { t: 13, v: 0.28, ease: 'smooth' },
  { t: 18, v: 0.4, ease: 'smooth' },
  { t: T_EXO, v: 1, ease: 'smooth' },
  { t: 24, v: 0.55, ease: 'smooth' },
]

const CAM_ZOOM: ScalarTrack = [
  { t: 0, v: 0.76 },
  { t: 4, v: 0.84, ease: 'smooth' },
  { t: 7.2, v: 1.18, ease: 'smooth' },
  { t: T_H2 + 0.6, v: 1.34, ease: 'smooth' },
  { t: 13, v: 1.0, ease: 'smooth' },
  { t: T_HYDRATION, v: 1.2, ease: 'smooth' },
  { t: 19, v: 0.8, ease: 'smooth' },
  { t: 25, v: 0.74, ease: 'smooth' },
]
const CAM_OFFSET: Vec3Track = [
  { t: 0, v: [0, 0.05, 0] },
  { t: 6.5, v: [1.15, -0.18, 0], ease: 'smooth' },
  { t: 12, v: [1.2, -0.2, 0], ease: 'smooth' },
  { t: 15, v: [0.15, 0.04, 0], ease: 'smooth' },
  { t: T_HYDRATION, v: [-0.4, 0.12, 0], ease: 'smooth' },
  { t: 19.5, v: [-0.1, 0.06, 0], ease: 'smooth' },
  { t: 25, v: [0, 0.05, 0], ease: 'smooth' },
]
const CAM_YAW: ScalarTrack = [
  { t: 0, v: -0.12 },
  { t: 8, v: 0.08, ease: 'smooth' },
  { t: 15, v: 0.3, ease: 'smooth' },
  { t: 21, v: 0.46, ease: 'smooth' },
  { t: 25, v: 0.54, ease: 'smooth' },
]
const CAM_ROLL: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 15, v: -0.08, ease: 'smooth' },
  { t: 25, v: -0.12, ease: 'smooth' },
]
const FADE = fadeTrack(ZNCL2_FINISH)

// ─────────────────────────────────────────────────────────────────────────────
// 10. Подписи в 3D
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Тексты подписей — формулы и обозначения СИ, одинаковые в ru/en/uz. Состояния
 * вещества и единицы записаны токенами `{s} {g} {aq} {pm} {kJmol}`; язык
 * подставляет сцена через localizeSceneLabels(). Все словесные пояснения живут
 * в zncl2MechanismText.{ts,en.ts,uz.ts}.
 */
export type Zncl2LabelDef = SceneLabelDef & {
  anchor: Zncl2AtomId | 'plate' | 'bubble' | 'complex' | 'surface'
}

const HH_PM = Math.round(ZNCL2_GEOM.data.hhPm)
const ZNO_PM = Math.round(ZNCL2_GEOM.data.znOPm)
const ZN_PM = Math.round(ZNCL2_GEOM.data.znPm)
const ZNION_PM = Math.round(ZNCL2_GEOM.data.znIonPm)

export const ZNCL2_LABELS: readonly Zncl2LabelDef[] = [
  { id: 'plate', kind: 'species', anchor: 'plate', dy: 1.62, keys: [{ t: 0, text: 'Zn ({s})' }], windows: [[0.9, 20.4]] },
  {
    id: 'acid',
    kind: 'token',
    anchor: 'oA',
    dy: 0.62,
    keys: [{ t: 0, text: 'HCl ({aq}) → H⁺ + Cl⁻' }],
    windows: [[1.8, 5.2]],
  },
  {
    id: 'h3oA',
    kind: 'species',
    anchor: 'oA',
    dy: 0.22,
    keys: [
      { t: 0, text: 'H₃O⁺' },
      { t: T_E1.arrive + 0.3, text: 'H₂O' },
    ],
    windows: [
      [2.2, 4.6],
      [5.6, 12.4],
    ],
  },
  { id: 'h3oB', kind: 'species', anchor: 'oB', dy: -0.24, keys: [{ t: 0, text: 'H₃O⁺' }, { t: T_E2.arrive + 0.3, text: 'H₂O' }], windows: [[5.8, 12.4]] },
  { id: 'cl0', kind: 'species', anchor: 'C0', dy: 0.2, keys: [{ t: 0, text: 'Cl⁻' }], windows: [[2.2, 24.4]] },
  { id: 'cl1', kind: 'species', anchor: 'C1', dy: 0.2, keys: [{ t: 0, text: 'Cl⁻' }], windows: [[2.2, 24.4]] },
  { id: 'proton', kind: 'ox', anchor: 'hA1', dy: 0.3, keys: [{ t: 0, text: 'H⁺' }, { t: T_E1.arrive + 0.25, text: 'H' }], windows: [[6.4, T_H2 - 0.2]] },
  { id: 'electrons', kind: 'token', anchor: 'surface', dy: 0.72, keys: [{ t: 0, text: '2e⁻' }], windows: [[T_E1.leave - 0.3, T_E2.arrive + 0.8]] },
  { id: 'h2', kind: 'species', anchor: 'bubble', dy: 0.5, keys: [{ t: 0, text: 'H₂ ({g})↑' }], windows: [[T_H2 + 0.2, 24.4]] },
  { id: 'hh', kind: 'delta', anchor: 'bubble', dy: -0.52, keys: [{ t: 0, text: `${HH_PM} {pm}` }], windows: [[T_H2 + 0.4, T_BUBBLE + 0.6]] },
  {
    id: 'zn0',
    kind: 'species',
    anchor: ZN0,
    dy: 0.24,
    keys: [
      { t: 0, text: 'Zn' },
      { t: T_LEAVE + 0.2, text: 'Zn²⁺' },
    ],
    windows: [[13.2, 24.4]],
  },
  { id: 'znRadius', kind: 'delta', anchor: ZN0, dy: -0.3, keys: [{ t: 0, text: `${ZN_PM} → ${ZNION_PM} {pm}` }], windows: [[13.8, 16.2]] },
  { id: 'aqua', kind: 'species', anchor: 'complex', dy: 1.18, keys: [{ t: 0, text: '[Zn(H₂O)₆]²⁺ ({aq})' }], windows: [[T_HYDRATION - 0.2, 24.4]] },
  { id: 'znO', kind: 'delta', anchor: 'complex', dy: -1.16, keys: [{ t: 0, text: `Zn–O = ${ZNO_PM} {pm}` }], windows: [[T_HYDRATION + 0.3, 19.2]] },
  { id: 'cell', kind: 'token', anchor: 'complex', dy: -1.68, keys: [{ t: 0, text: 'E° = +0.76 V' }], windows: [[T_SPECTATOR, 24.4]] },
  { id: 'product', kind: 'species', anchor: 'complex', dy: 1.7, keys: [{ t: 0, text: 'ZnCl₂ ({aq})' }], windows: [[T_SPECTATOR + 0.4, 24.6]] },
  { id: 'dH', kind: 'delta', anchor: 'complex', dy: 2.22, keys: [{ t: 0, text: 'ΔH = −154 {kJmol}' }], windows: [[T_EXO, 24.6]] },
]

export type Zncl2LabelState = SceneLabelState

// ─────────────────────────────────────────────────────────────────────────────
// 11. Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type Zncl2Frame = {
  atoms: Record<Zncl2AtomId, THREE.Vector3>
  radius: Record<Zncl2AtomId, number>
  charge: Record<Zncl2AtomId, number>
  opacity: Record<Zncl2AtomId, number>
  emissive: Record<Zncl2AtomId, number>
  /** прозрачность рёбер металлической решётки */
  metalBond: number
  /** обычные связи O–H (вода и невытесненные протоны) */
  waterBond: number
  /** рвущиеся связи O–H, по которым уходят протоны */
  protonBond: { a: { opacity: number; stress: number }; b: { opacity: number; stress: number } }
  /** связь H–H */
  h2Bond: { opacity: number; form: number }
  /** донорно-акцепторные связи Zn²⁺ ← OH₂ */
  aquaBond: number
  /** пузырёк водорода */
  bubble: { center: THREE.Vector3; radius: number; opacity: number }
  electrons: [ElectronJump, ElectronJump]
  /** свечение электронного газа металла, 0..1 */
  gas: number
  /** линии ион-дипольного притяжения Zn²⁺ ← OH₂, 0..1 */
  field: number
  /** подсветка октаэдра КЧ 6, 0..1 */
  coord: number
  env: { warm: number; fade: number }
  labels: Zncl2LabelState[]
  camera: { zoom: number; offset: THREE.Vector3; yaw: number; roll: number; shake: number; bloom: number; vignette: number }
  plateCenter: THREE.Vector3
  surfacePoint: THREE.Vector3
  complexCenter: THREE.Vector3
}

const POS: Partial<Record<Zncl2AtomId, Vec3Track>> = {}
for (const s of PLATE_SITES) POS[s.id] = [{ t: 0, v: s.pos }]
POS[ZN0] = Z0_PATH
POS.oA = OA_PATH
POS.oB = OB_PATH
POS.hA1 = HA1_PATH
POS.hB1 = HB1_PATH
CL_IDS.forEach((id, i) => {
  POS[id] = CL_PATHS[i]!
})
SHELL_O.forEach((id, i) => {
  POS[id] = SHELL_PATHS[i]!
})
BG_O.forEach((id, i) => {
  POS[id] = BG_PATHS[i]!
})

/**
 * Геометрия H₃O⁺: тригональная пирамида. Одна связь смотрит на металл (d1),
 * две другие — под углом 109,47° к ней и друг к другу (идеальная VSEPR-форма;
 * измеренный угол H–O–H в H₃O⁺ равен 111°).
 */
function pyramidOffsets(d1: V3, len: number): [V3, V3] {
  const p = unit(cross3(d1, len3(cross3(d1, [0, 0, 1])) > 0.3 ? [0, 0, 1] : [0, 1, 0]))
  const q = cross3(d1, p)
  const c = Math.cos(ANG_TETRA)
  const s = Math.sin(ANG_TETRA)
  const h2 = add(mul(d1, c), mul(p, s))
  const h3 = add(mul(d1, c), add(mul(p, -0.5 * s), mul(q, SQ32 * s)))
  return [mul(unit(h2), len), mul(unit(h3), len)]
}

/**
 * Когда протон ушёл, оставшиеся две связи смыкаются с тетраэдрического до угла воды из ядра —
 * это и есть молекула воды. Атомы почти не двигаются: разница 5°.
 */
function closeToWater(o2: V3, o3: V3, len: number): [V3, V3] {
  const b = unit(add(o2, o3))
  const s = unit(sub(o2, o3))
  const c = Math.cos(ANG_WATER / 2)
  const k = Math.sin(ANG_WATER / 2)
  return [mul(add(mul(b, c), mul(s, k)), len), mul(add(mul(b, c), mul(s, -k)), len)]
}

const [OFF_A2_ION, OFF_A3_ION] = pyramidOffsets(mul(DIR_A, -1), D_OH)
const [OFF_A2_WAT, OFF_A3_WAT] = closeToWater(OFF_A2_ION, OFF_A3_ION, D_OH)
const [OFF_B2_ION, OFF_B3_ION] = pyramidOffsets(mul(DIR_B, -1), D_OH)
const [OFF_B2_WAT, OFF_B3_WAT] = closeToWater(OFF_B2_ION, OFF_B3_ION, D_OH)

const WATER_BLEND_A = rampTrack(T_E1.arrive, 0, T_E1.arrive + 1.1, 1, 'smooth')
const WATER_BLEND_B = rampTrack(T_E2.arrive, 0, T_E2.arrive + 1.1, 1, 'smooth')

/** Ось, от которой отсчитывается плоскость молекулы воды (Грам — Шмидт, без вырождений). */
const SHELL_PLANE: readonly V3[] = OCT_AXES.map((_, i) => OCT_AXES[(i + 2) % 6]!)

const _b = new THREE.Vector3()
const _s = new THREE.Vector3()
const _k = new THREE.Vector3()
const _tmp = new THREE.Vector3()
const ZN_AQ_V = new THREE.Vector3(ZN_AQ[0], ZN_AQ[1], ZN_AQ[2])

/** Две связи O–H: биссектриса b, плоскость (b, s), угол H–O–H = bondAngleDeg('water'). */
function writeWaterHydrogens(
  o: THREE.Vector3,
  bisector: THREE.Vector3,
  plane: THREE.Vector3,
  h1: THREE.Vector3,
  h2: THREE.Vector3,
): void {
  _b.copy(bisector).normalize()
  _s.copy(plane).addScaledVector(_b, -plane.dot(_b)).normalize()
  const c = Math.cos(ANG_WATER / 2) * D_OH
  const k = Math.sin(ANG_WATER / 2) * D_OH
  h1.copy(o).addScaledVector(_b, c).addScaledVector(_s, k)
  h2.copy(o).addScaledVector(_b, c).addScaledVector(_s, -k)
}

export function createZncl2Frame(): Zncl2Frame {
  const atoms = {} as Record<Zncl2AtomId, THREE.Vector3>
  const radius = {} as Record<Zncl2AtomId, number>
  const charge = {} as Record<Zncl2AtomId, number>
  const opacity = {} as Record<Zncl2AtomId, number>
  const emissive = {} as Record<Zncl2AtomId, number>
  for (const a of ZNCL2_ATOMS) {
    atoms[a.id] = new THREE.Vector3()
    radius[a.id] = a.el === 'Zn' ? R.zn : a.el === 'Cl' ? R.cl : a.el === 'O' ? R.o : R.h
    charge[a.id] = 0
    opacity[a.id] = 0
    emissive[a.id] = 0.08
  }
  return {
    atoms,
    radius,
    charge,
    opacity,
    emissive,
    metalBond: 0,
    waterBond: 0,
    protonBond: { a: { opacity: 0, stress: 0 }, b: { opacity: 0, stress: 0 } },
    h2Bond: { opacity: 0, form: 0 },
    aquaBond: 0,
    bubble: { center: new THREE.Vector3(), radius: 0, opacity: 0 },
    electrons: [createElectronJump('e1'), createElectronJump('e2')],
    gas: 0,
    field: 0,
    coord: 0,
    env: { warm: 0, fade: 0 },
    labels: createLabelStates(ZNCL2_LABELS),
    camera: { zoom: 1, offset: new THREE.Vector3(), yaw: 0, roll: 0, shake: 0, bloom: 0.3, vignette: 0.3 },
    plateCenter: new THREE.Vector3(PLATE_CENTER[0], PLATE_CENTER[1], PLATE_CENTER[2]),
    surfacePoint: new THREE.Vector3(),
    complexCenter: new THREE.Vector3(),
  }
}

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleZncl2Frame(t: number, frame: Zncl2Frame): Zncl2Frame {
  const { atoms, radius, charge, opacity, emissive } = frame

  for (const a of ZNCL2_ATOMS) {
    const track = POS[a.id]
    if (track) sampleVec3(track, t, atoms[a.id])
  }

  // ——— Водороды гидроксония: пирамида H₃O⁺ → уголок H₂O ———
  const blendA = sampleScalar(WATER_BLEND_A, t)
  const blendB = sampleScalar(WATER_BLEND_B, t)
  lerpOffset(atoms.oA, OFF_A2_ION, OFF_A2_WAT, blendA, atoms.hA2)
  lerpOffset(atoms.oA, OFF_A3_ION, OFF_A3_WAT, blendA, atoms.hA3)
  lerpOffset(atoms.oB, OFF_B2_ION, OFF_B2_WAT, blendB, atoms.hB2)
  lerpOffset(atoms.oB, OFF_B3_ION, OFF_B3_WAT, blendB, atoms.hB3)

  // ——— Гидратная оболочка: кислород лонной парой к катиону, водороды наружу ———
  for (let i = 0; i < SHELL_O.length; i++) {
    const o = atoms[SHELL_O[i]!]!
    _tmp.copy(o).sub(ZN_AQ_V)
    const pl = SHELL_PLANE[i]!
    _k.set(pl[0], pl[1], pl[2])
    writeWaterHydrogens(o, _tmp, _k, atoms[SHELL_H[i * 2]!]!, atoms[SHELL_H[i * 2 + 1]!]!)
  }

  // ——— Фоновая вода: медленно поворачивается, как в настоящем растворе ———
  for (let i = 0; i < BG_O.length; i++) {
    const o = atoms[BG_O[i]!]!
    const a = t * 0.35 + i * 1.7
    _tmp.set(Math.cos(a), 0.55 * Math.sin(a), 0.75 * Math.sin(a * 0.6 + i))
    _k.set(0, 0, 1)
    writeWaterHydrogens(o, _tmp, _k, atoms[BG_H[i * 2]!]!, atoms[BG_H[i * 2 + 1]!]!)
  }

  // ——— Радиусы и заряды ———
  radius[ZN0] = sampleScalar(RADIUS_ZN0, t)
  charge[ZN0] = sampleScalar(CHARGE_ZN0, t)
  radius.hA1 = sampleScalar(RADIUS_HA1, t)
  radius.hB1 = sampleScalar(RADIUS_HB1, t)
  charge.hA1 = sampleScalar(CHARGE_HA1, t)
  charge.hB1 = sampleScalar(CHARGE_HB1, t)
  for (const id of CL_IDS) charge[id] = -1
  // H₃O⁺ несёт «+» целиком, но размазанный: кромка тёплая у кислорода и водородов.
  const ionA = 1 - blendA
  const ionB = 1 - blendB
  charge.oA = 0.3 * ionA
  charge.hA2 = charge.hA3 = 0.35 * ionA
  charge.oB = 0.3 * ionB
  charge.hB2 = charge.hB3 = 0.35 * ionB

  // ——— Прозрачность ———
  const plate = sampleScalar(PLATE_OPACITY, t)
  const solution = sampleScalar(SOLUTION_OPACITY, t)
  for (const a of ZNCL2_ATOMS) opacity[a.id] = a.role === 'metal' ? plate : solution
  opacity[ZN0] = plate

  frame.metalBond = sampleScalar(METAL_BOND_OPACITY, t) * plate
  frame.waterBond = solution
  frame.protonBond.a.opacity = sampleScalar(PROTON_BOND_FADE_A, t) * solution
  frame.protonBond.a.stress = sampleScalar(PROTON_BOND_STRESS_A, t)
  frame.protonBond.b.opacity = sampleScalar(PROTON_BOND_FADE_B, t) * solution
  frame.protonBond.b.stress = sampleScalar(PROTON_BOND_STRESS_B, t)
  frame.h2Bond.opacity = sampleScalar(H2_BOND, t)
  frame.h2Bond.form = sampleScalar(H2_FORM, t)
  frame.aquaBond = sampleScalar(AQUA_BOND, t)

  // ——— Электроны текут ПО МЕТАЛЛУ к протонам: 2 H⁺ + 2e⁻ → 2 H ———
  frame.gas = sampleScalar(GAS, t)
  sampleElectronJump(frame.electrons[0], t, {
    donor: atoms[PLATE_SITES[10]!.id]!,
    acceptor: atoms.hA1,
    shellRadius: SHELL_ZN,
    acceptorRadius: radius.hA1 + 0.05,
    leave: T_E1.leave,
    arrive: T_E1.arrive,
    arcSign: 1,
    arcHeight: 0.2,
  })
  sampleElectronJump(frame.electrons[1], t, {
    donor: atoms[PLATE_SITES[12]!.id]!,
    acceptor: atoms.hB1,
    shellRadius: SHELL_ZN,
    acceptorRadius: radius.hB1 + 0.05,
    leave: T_E2.leave,
    arrive: T_E2.arrive,
    arcSign: -1,
    arcHeight: 0.2,
  })

  // ——— Пузырёк ———
  sampleVec3(BUBBLE_PATH, t, frame.bubble.center)
  frame.bubble.radius = sampleScalar(BUBBLE_RADIUS, t)
  frame.bubble.opacity = sampleScalar(BUBBLE_OPACITY, t)

  // ——— Ион-дипольное притяжение и подсветка октаэдра ———
  frame.field = windowFade([T_HYDRATION - 1.6, 19.4], t, 0.6)
  frame.coord = windowFade([T_HYDRATION + 0.2, 19.2], t, 0.5) * (0.7 + 0.3 * Math.sin(t * 5.2))

  const warm = sampleScalar(WARM, t)
  frame.env.warm = warm
  frame.env.fade = sampleScalar(FADE, t)

  // ——— Собственное свечение ———
  for (const a of ZNCL2_ATOMS) {
    let e = 0.08 + warm * 0.2
    if (a.role === 'metal') e += frame.gas * 0.12
    if (a.role === 'proton') e += 0.45 * (1 - Math.min(1, Math.abs(t - T_ELECTRONS) / 1.4))
    emissive[a.id] = e
  }
  emissive[ZN0] = 0.08 + warm * 0.2 + frame.coord * 0.45

  // ——— Опорные точки ———
  frame.complexCenter.copy(atoms[ZN0]!)
  frame.surfacePoint.copy(atoms.hA1).lerp(atoms.hB1, 0.5)

  // ——— Подписи ———
  sampleLabels(
    ZNCL2_LABELS,
    frame.labels,
    t,
    (def, st) => {
      const d = def as Zncl2LabelDef
      if (d.anchor === 'plate') {
        st.pos.copy(frame.plateCenter)
        st.pos.y += d.dy
      } else if (d.anchor === 'bubble') {
        st.pos.copy(frame.bubble.center)
        st.pos.y += d.dy > 0 ? frame.bubble.radius + d.dy : -frame.bubble.radius + d.dy
      } else if (d.anchor === 'complex') {
        st.pos.copy(frame.complexCenter)
        st.pos.y += d.dy
      } else if (d.anchor === 'surface') {
        st.pos.copy(frame.surfacePoint)
        st.pos.y += d.dy
      } else {
        st.pos.copy(atoms[d.anchor]!)
        st.pos.y += d.dy > 0 ? radius[d.anchor]! + d.dy : -(radius[d.anchor]! - d.dy)
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
    0.26 * Math.max(0, 1 - Math.abs(t - T_ELECTRONS) / 0.4) +
    0.2 * Math.max(0, 1 - Math.abs(t - T_H2) / 0.35) +
    0.34 * Math.max(0, 1 - Math.abs(t - T_EXO) / 0.5)
  cam.bloom = 0.3 + 0.3 * frame.gas + 0.5 * warm
  cam.vignette = 0.3 + 0.12 * warm
  return frame
}

const _o = new THREE.Vector3()
function lerpOffset(o: THREE.Vector3, a: V3, b: V3, k: number, out: THREE.Vector3): void {
  _o.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k)
  out.copy(o).add(_o)
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Проверка раскадровки — в dev и в тесте сцены
// ─────────────────────────────────────────────────────────────────────────────

export function validateZncl2Storyboard(): void {
  const vec: Record<string, Vec3Track> = {}
  for (const [id, track] of Object.entries(POS)) if (track) vec[`pos.${id}`] = track
  vec['cam.offset'] = CAM_OFFSET
  vec['bubble'] = BUBBLE_PATH
  validateTracks(vec)
  validateTracks({
    RADIUS_ZN0,
    CHARGE_ZN0,
    RADIUS_HA1,
    RADIUS_HB1,
    CHARGE_HA1,
    CHARGE_HB1,
    PLATE_OPACITY,
    SOLUTION_OPACITY,
    METAL_BOND_OPACITY,
    PROTON_BOND_STRESS_A,
    PROTON_BOND_FADE_A,
    PROTON_BOND_STRESS_B,
    PROTON_BOND_FADE_B,
    H2_BOND,
    H2_FORM,
    BUBBLE_RADIUS,
    BUBBLE_OPACITY,
    AQUA_BOND,
    GAS,
    WARM,
    CAM_ZOOM,
    CAM_YAW,
    CAM_ROLL,
    FADE,
  })

  // —— Металл: ГПУ-фрагмент ——
  if (PLATE_SITES.length !== 18) throw new Error(`zncl2: в пластинке ожидалось 18 атомов, получилось ${PLATE_SITES.length}`)
  const inPlane = ZNCL2_METAL_BONDS.filter(([a, b]) => {
    const pa = PLATE_SITES.find((s) => s.id === a)!
    const pb = PLATE_SITES.find((s) => s.id === b)!
    return pa.layer === pb.layer
  })
  for (const [a, b] of inPlane) {
    const d = len3(sub(PLATE_SITES.find((s) => s.id === a)!.pos, PLATE_SITES.find((s) => s.id === b)!.pos))
    if (Math.abs(d - A) > 1e-6) throw new Error(`zncl2: соседи в слое обязаны стоять на a = ${A}, получилось ${d}`)
  }
  const interlayer = ZNCL2_METAL_BONDS.length - inPlane.length
  if (interlayer <= 0) throw new Error('zncl2: ГПУ-укладка обязана дать соседей между слоями')

  // —— Октаэдр гидратной оболочки: три взаимно перпендикулярные оси, КЧ 6 ——
  if (OCT_AXES.length !== 6) throw new Error('zncl2: аквакомплекс обязан иметь шесть вершин (КЧ 6)')
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      const dot = OCT_AXES[i * 2]![0] * OCT_AXES[j * 2]![0] + OCT_AXES[i * 2]![1] * OCT_AXES[j * 2]![1] + OCT_AXES[i * 2]![2] * OCT_AXES[j * 2]![2]
      if (Math.abs(dot) > 1e-6) throw new Error('zncl2: оси октаэдра обязаны быть перпендикулярны')
    }
  }

  // —— Физика размера: катион меньше атома ——
  if (!(R.znIon < R.zn)) throw new Error('zncl2: Zn²⁺ обязан быть меньше атома Zn')
  if (!(R_PROTON < R.h)) throw new Error('zncl2: голое ядро H⁺ обязано быть меньше атома H')
  if (!(R.cl > speciesRadius('Cl', 0))) throw new Error('zncl2: Cl⁻ обязан быть больше атома Cl')

  // —— Электронейтральность кадра ——
  const protons = ZNCL2_ATOMS.filter((a) => a.role === 'proton').length
  const chlorides = CL_IDS.length
  if (protons !== 2 || chlorides !== 2) {
    throw new Error(`zncl2: в кадре обязаны быть 2 H⁺ и 2 Cl⁻, получилось ${protons} и ${chlorides}`)
  }

  if (ZNCL2_END <= 0) throw new Error('zncl2: пустой сюжет')
}
