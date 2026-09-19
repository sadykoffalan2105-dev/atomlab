import * as THREE from 'three'
import { bondLengthPm, dipoleDebye, getElement } from '../../../../chemistry/data'
import { smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, windowFade, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { bondLength, speciesRadius, speciesRadiusPm } from '../kit/cpkAtoms'
import {
  appearTrack,
  createLabelStates,
  fadeTrack,
  rampTrack,
  sampleLabels,
  validateTracks,
  type SceneLabelDef,
  type SceneLabelState,
} from '../kit/sceneKit'
import {
  HCL_INITIATION_KJ,
  HCL_IONIC_FRACTION,
  HCL_PHOTON_NM,
  HCL_PROP1_KJ,
  HCL_PROP2_KJ,
  HCL_REACTION_DH_KJ,
} from './hclEnergetics'
import { HCL_FINISH, hclCueAt } from './hclSteps'

export {
  HCL_CUES,
  HCL_END,
  HCL_FINISH,
  HCL_SEGMENTS,
  HCL_STEPS,
  HCL_STEP_IDS,
  HCL_TIMING,
  hclStepIndexAt,
  type HclCueId,
  type HclStepId,
} from './hclSteps'

/**
 * Раскадровка H₂ (г.) + Cl₂ (г.) → 2 HCl (г.) — ЧИСТАЯ функция времени сюжета.
 *
 * Вся химия — из src/chemistry/data (ни одного числа руками):
 *   • H₂: d(H–H) = 74,14 пм, D = 436 кДж/моль;
 *   • Cl₂: d(Cl–Cl) = 198,8 пм, D = 243 кДж/моль;
 *   • HCl: d(H–Cl) = 127,46 пм, D = 431 кДж/моль, μ = 1,08 D;
 *   • радиусы: ковалентные H 31 пм и Cl 102 пм — водород ВТРОЕ меньше хлора,
 *     и на экране это видно честно, без «подтягивания» для красоты.
 *
 * Все частицы нейтральны: реакция РАДИКАЛЬНАЯ, а не ионная, поэтому радиусы
 * по ходу сцены не меняются — меняется только то, с кем атом связан. Ионов
 * «H⁺» и «Cl⁻» в газовой фазе здесь НЕТ (они появляются лишь в водном растворе).
 *
 * ЧТО НАРИСОВАНО СХЕМАТИЧНО (и так сказано в тексте урока):
 *   • неспаренный электрон радикала — одна светящаяся точка у поверхности атома;
 *     на самом деле это плотность вероятности, а не шарик на орбите;
 *   • общая электронная пара новой связи — две точки между ядрами, сдвинутые
 *     к хлору; смещение УСИЛЕНО (POLARITY_GAIN), иначе его не видно;
 *   • квант света показан летящей искрой: фотон не имеет траектории;
 *   • дальнейшие звенья цепи показаны четырьмя готовыми молекулами HCl —
 *     на деле один квант даёт до ~10⁶ молекул.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Масштаб сцены и геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Общий множитель сцены. Умножает И радиусы, И расстояния, поэтому ВСЕ
 * отношения (r(Cl)/r(H) = 3,3; d(H–Cl)/d(Cl–Cl) = 0,64) остаются честными —
 * это просто «объектив», а не правка химии. Молекулы газа мелкие, поэтому
 * без него они были бы в кадре точками.
 */
const S = 2.2

const R = {
  h: speciesRadius('H', 0) * S,
  cl: speciesRadius('Cl', 0) * S,
} as const

/** Половина длины связи Cl–Cl. */
const CH = (bondLength('Cl-Cl') * S) / 2
/** Половина длины связи H–H. */
const HH = (bondLength('H-H') * S) / 2
/** Длина связи H–Cl и её половина. */
const HCL = bondLength('H-Cl') * S
const HCL2 = HCL / 2

/** Радиус схематичной валентной оболочки вокруг радикала. */
const SHELL_CL = R.cl * 1.34
const SHELL_H = R.h * 2.6

/**
 * Доля ионности связи H–Cl считается в hclEnergetics по ОПЫТНОМУ дипольному
 * моменту (≈ 0,18). На рисунке смещение плотности усилено втрое — иначе его
 * не видно; в тексте шага это названо усилением.
 */
const POLARITY_GAIN = 3
/** Знак «+» в BondPool.polarity = плотность к атому B; у связи hcl1/hcl2 B — хлор. */
const HCL_POLARITY = Math.min(1, HCL_IONIC_FRACTION * POLARITY_GAIN)

export const HCL_GEOM = {
  scale: S,
  radius: R,
  clHalf: CH,
  hHalf: HH,
  hclLength: HCL,
  shellCl: SHELL_CL,
  shellH: SHELL_H,
  polarity: HCL_POLARITY,
  ionicFraction: HCL_IONIC_FRACTION,
  /** справочные числа для подписей и тестов */
  data: {
    hhPm: bondLengthPm('H-H'),
    clClPm: bondLengthPm('Cl-Cl'),
    hClPm: bondLengthPm('H-Cl'),
    dipoleD: dipoleDebye('HCl')!,
    enH: getElement('H').electronegativity!,
    enCl: getElement('Cl').electronegativity!,
    radiusHPm: speciesRadiusPm('H', 0),
    radiusClPm: speciesRadiusPm('Cl', 0),
  },
} as const

/** Масштаб рига камеры: в кадре газ, важна общая картина смеси. */
export const HCL_RIG_SCALE = 0.92

// ─────────────────────────────────────────────────────────────────────────────
// Состав кадра
// ─────────────────────────────────────────────────────────────────────────────

export type HclElement = 'H' | 'Cl'

/** Шесть частиц сюжета + фоновый газ (G) + готовые молекулы продукта (P). */
export type HclAtomId =
  | 'cl1'
  | 'cl2'
  | 'cl3'
  | 'cl4'
  | 'h1'
  | 'h2'
  | `G${number}`
  | `P${number}`

type V3 = readonly [number, number, number]

/** Центры молекул сюжета: Cl₂ №1 слева сверху, H₂ в середине, Cl₂ №2 справа. */
const A: V3 = [-1.45, 0.85, 0]
const B: V3 = [0.05, -0.6, 0.05]
const C: V3 = [1.6, 0.7, -0.1]
/** Точка, где два радикала Cl• встречаются и обрывают цепь. */
const TERM: V3 = [-0.2, 1.85, 0.15]

const add = (p: V3, dx: number, dy: number, dz: number): V3 => [p[0] + dx, p[1] + dy, p[2] + dz]

const CL1_HOME = add(A, CH, 0, 0)
const CL2_HOME = add(A, -CH, 0, 0)
const H1_HOME = add(B, -HH, 0, 0)
const H2_HOME = add(B, HH, 0, 0)
const CL3_HOME = add(C, -CH, 0, 0)
const CL4_HOME = add(C, CH, 0, 0)

/** Переходное состояние первой стадии роста цепи: Cl···H–H вытянуты в линию. */
const H1_TS: V3 = [-0.25, -0.6, 0.05]
const CL1_TS: V3 = [H1_TS[0] - HCL, H1_TS[1], H1_TS[2]]
const H2_TS: V3 = [0.35, -0.6, 0.05]
/** Вторая стадия: H• подходит к Cl₂ вдоль оси молекулы, слева. */
const H2_TS2: V3 = [CL3_HOME[0] - HCL, CL3_HOME[1], CL3_HOME[2]]

const CL2_TERM: V3 = [TERM[0] - CH, TERM[1], TERM[2]]
const CL4_TERM: V3 = [TERM[0] + CH, TERM[1], TERM[2]]

const T_PHOTON = hclCueAt('photon')
const T_HOMO = hclCueAt('homolysis')
const T_ABSTRACT = hclCueAt('abstract')
const T_PROPAGATE = hclCueAt('propagate')
const T_CHAIN = hclCueAt('chain')
const T_TERMINATE = hclCueAt('terminate')

// ─────────────────────────────────────────────────────────────────────────────
// Фоновый газ и готовые молекулы продукта
// ─────────────────────────────────────────────────────────────────────────────

type GasSpec = { id: string; el: HclElement; center: V3; half: number; phase: number }

/** Молекулы, которые просто летают в сосуде: смесь 1 : 1 (две H₂ и две Cl₂). */
const GAS_MOLECULES: readonly GasSpec[] = [
  { id: 'g0', el: 'H', center: [-1.15, -1.55, -0.8], half: HH, phase: 0.4 },
  { id: 'g1', el: 'H', center: [1.7, -0.95, -0.75], half: HH, phase: 2.1 },
  { id: 'g2', el: 'Cl', center: [-1.95, -0.8, -0.95], half: CH, phase: 1.2 },
  { id: 'g3', el: 'Cl', center: [2.05, 1.75, -0.85], half: CH, phase: 3.3 },
]

/** Молекулы HCl, рождённые дальнейшими звеньями цепи (схематично, четыре штуки). */
const PRODUCT_MOLECULES: readonly { id: string; center: V3; at: number }[] = [
  { id: 'p0', center: [-2.05, -0.15, -0.7], at: 16.4 },
  { id: 'p1', center: [1.2, -1.3, -0.55], at: 16.9 },
  { id: 'p2', center: [2.15, -0.25, -0.5], at: 17.4 },
  { id: 'p3', center: [-0.55, -1.6, -0.65], at: 17.9 },
]

export const HCL_ATOMS: readonly { id: HclAtomId; el: HclElement; kind: 'story' | 'gas' | 'product' }[] = [
  { id: 'cl1', el: 'Cl', kind: 'story' },
  { id: 'cl2', el: 'Cl', kind: 'story' },
  { id: 'cl3', el: 'Cl', kind: 'story' },
  { id: 'cl4', el: 'Cl', kind: 'story' },
  { id: 'h1', el: 'H', kind: 'story' },
  { id: 'h2', el: 'H', kind: 'story' },
  ...GAS_MOLECULES.flatMap((g, i) => [
    { id: `G${i * 2}` as HclAtomId, el: g.el, kind: 'gas' as const },
    { id: `G${i * 2 + 1}` as HclAtomId, el: g.el, kind: 'gas' as const },
  ]),
  ...PRODUCT_MOLECULES.flatMap((_, i) => [
    { id: `P${i * 2}` as HclAtomId, el: 'H' as HclElement, kind: 'product' as const },
    { id: `P${i * 2 + 1}` as HclAtomId, el: 'Cl' as HclElement, kind: 'product' as const },
  ]),
]

export type HclBondId =
  | 'clcl1'
  | 'hh'
  | 'clcl2'
  | 'hcl1'
  | 'hcl2'
  | 'clcl3'
  | `gb${number}`
  | `pb${number}`

/** Связи кадра: a — «левый» атом, b — «правый»; полярность считается к b. */
export const HCL_BONDS: readonly { id: HclBondId; a: HclAtomId; b: HclAtomId }[] = [
  { id: 'clcl1', a: 'cl2', b: 'cl1' },
  { id: 'hh', a: 'h1', b: 'h2' },
  { id: 'clcl2', a: 'cl3', b: 'cl4' },
  { id: 'hcl1', a: 'h1', b: 'cl1' },
  { id: 'hcl2', a: 'h2', b: 'cl3' },
  { id: 'clcl3', a: 'cl2', b: 'cl4' },
  ...GAS_MOLECULES.map((_, i) => ({ id: `gb${i}` as HclBondId, a: `G${i * 2}` as HclAtomId, b: `G${i * 2 + 1}` as HclAtomId })),
  ...PRODUCT_MOLECULES.map((_, i) => ({ id: `pb${i}` as HclBondId, a: `P${i * 2}` as HclAtomId, b: `P${i * 2 + 1}` as HclAtomId })),
]

// ─────────────────────────────────────────────────────────────────────────────
// Дорожки положений
// ─────────────────────────────────────────────────────────────────────────────

const POS: Record<'cl1' | 'cl2' | 'cl3' | 'cl4' | 'h1' | 'h2', Vec3Track> = {
  // Cl₂ №1: cl1 — ближний к водороду, он и станет носителем цепи.
  cl1: [
    { t: 0, v: CL1_HOME },
    { t: 2, v: add(CL1_HOME, 0.03, 0.03, 0.02) },
    { t: 4, v: CL1_HOME },
    { t: T_HOMO, v: CL1_HOME },
    { t: 7.8, v: [-0.7, 0.55, 0.06], ease: 'smooth' },
    { t: 9.2, v: [-0.7, 0.55, 0.06] },
    { t: 10.3, v: [-1.55, -0.58, 0.05], ease: 'smooth' },
    { t: T_ABSTRACT, v: CL1_TS, ease: 'smooth' },
    { t: 14.5, v: add(CL1_TS, -0.4, -0.35, 0), ease: 'smooth' },
    { t: 26, v: add(CL1_TS, -0.6, -0.45, 0) },
  ],
  // Второй осколок Cl₂ №1: ждёт в стороне и в конце обрывает цепь.
  cl2: [
    { t: 0, v: CL2_HOME },
    { t: 2, v: add(CL2_HOME, -0.03, 0.03, 0.02) },
    { t: 4, v: CL2_HOME },
    { t: T_HOMO, v: CL2_HOME },
    { t: 7.8, v: [-2.32, 1.18, -0.05], ease: 'smooth' },
    { t: 13, v: [-2.26, 1.24, 0.02], ease: 'smooth' },
    { t: 18.6, v: [-2.3, 1.15, -0.05], ease: 'smooth' },
    { t: T_TERMINATE, v: CL2_TERM, ease: 'smooth' },
    { t: 26, v: add(CL2_TERM, -0.06, 0.07, 0) },
  ],
  // Cl₂ №2: cl3 уходит в молекулу HCl, cl4 становится НОВЫМ радикалом.
  cl3: [
    { t: 0, v: CL3_HOME },
    { t: 2, v: add(CL3_HOME, 0.03, 0.03, 0.02) },
    { t: 4, v: CL3_HOME },
    { t: T_PROPAGATE, v: CL3_HOME },
    { t: 18.5, v: add(CL3_HOME, 0.075, -0.45, -0.2), ease: 'smooth' },
    { t: 26, v: add(CL3_HOME, 0.15, -0.6, -0.25) },
  ],
  cl4: [
    { t: 0, v: CL4_HOME },
    { t: 2, v: add(CL4_HOME, 0.03, 0.03, -0.02) },
    { t: 4, v: CL4_HOME },
    { t: T_PROPAGATE, v: CL4_HOME },
    { t: 17.1, v: [2.5, 1.35, 0.45], ease: 'smooth' },
    { t: 18.6, v: [2.5, 1.35, 0.45] },
    { t: T_TERMINATE, v: CL4_TERM, ease: 'smooth' },
    { t: 26, v: add(CL4_TERM, -0.06, 0.07, 0) },
  ],
  // H₂: h1 достаётся хлору, h2 улетает свободным радикалом H•.
  h1: [
    { t: 0, v: H1_HOME },
    { t: 2, v: add(H1_HOME, 0.02, 0.03, 0.01) },
    { t: 4, v: H1_HOME },
    { t: 10.3, v: H1_HOME },
    { t: T_ABSTRACT, v: H1_TS, ease: 'smooth' },
    { t: 14.5, v: add(H1_TS, -0.4, -0.35, 0), ease: 'smooth' },
    { t: 26, v: add(H1_TS, -0.6, -0.45, 0) },
  ],
  h2: [
    { t: 0, v: H2_HOME },
    { t: 2, v: add(H2_HOME, 0.02, 0.03, -0.01) },
    { t: 4, v: H2_HOME },
    { t: 10.3, v: H2_HOME },
    { t: T_ABSTRACT, v: H2_TS, ease: 'smooth' },
    { t: 12.4, v: [0.72, -0.3, 0.02], ease: 'smooth' },
    { t: 13.6, v: [0.72, -0.3, 0.02] },
    { t: 14.6, v: [-0.3, 0.45, -0.05], ease: 'smooth' },
    { t: T_PROPAGATE, v: H2_TS2, ease: 'smooth' },
    { t: 18.5, v: add(H2_TS2, 0.075, -0.45, -0.2), ease: 'smooth' },
    { t: 26, v: add(H2_TS2, 0.15, -0.6, -0.25) },
  ],
}

/** Квант света: прилетает издалека и гаснет в молекуле хлора. */
const PHOTON_FROM: V3 = [-4.6, 3.1, 1.3]
const PHOTON_TRACK: Vec3Track = [
  { t: T_PHOTON - 0.8, v: PHOTON_FROM },
  { t: T_PHOTON, v: A, ease: 'inQuad' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

/** Связь Cl–Cl молекулы №1: натяжение от кванта, затем ГОМОЛИЗ (split = 0). */
const CLCL1_STRESS = rampTrack(T_PHOTON - 0.5, 0, T_HOMO, 1, 'inQuad')
const CLCL1_SPLIT = rampTrack(T_HOMO - 0.15, 0, T_HOMO + 0.4, 1, 'outCubic')
const CLCL1_OPACITY = rampTrack(T_HOMO, 1, T_HOMO + 0.7, 0, 'smooth')

/** Связь H–H: растягивается подошедшим радикалом и рвётся гомолитически. */
const HH_STRESS = rampTrack(9.8, 0, T_ABSTRACT, 1, 'inQuad')
const HH_SPLIT = rampTrack(T_ABSTRACT - 0.4, 0, T_ABSTRACT + 0.3, 1, 'outCubic')
const HH_OPACITY = rampTrack(T_ABSTRACT, 1, T_ABSTRACT + 0.4, 0, 'smooth')

/** Связь Cl–Cl молекулы №2: её рвёт подлетевший H•. */
const CLCL2_STRESS = rampTrack(14.4, 0, T_PROPAGATE, 1, 'inQuad')
const CLCL2_SPLIT = rampTrack(T_PROPAGATE - 0.15, 0, T_PROPAGATE + 0.4, 1, 'outCubic')
const CLCL2_OPACITY = rampTrack(T_PROPAGATE, 1, T_PROPAGATE + 0.6, 0, 'smooth')

/** Новые связи: появляются волной образования (form). */
const HCL1_OPACITY = rampTrack(T_ABSTRACT - 0.3, 0, T_ABSTRACT + 0.4, 1, 'smooth')
const HCL1_FORM = rampTrack(T_ABSTRACT - 0.3, 0, T_ABSTRACT + 1.1, 1, 'smooth')
const HCL2_OPACITY = rampTrack(T_PROPAGATE - 0.3, 0, T_PROPAGATE + 0.4, 1, 'smooth')
const HCL2_FORM = rampTrack(T_PROPAGATE - 0.3, 0, T_PROPAGATE + 1.1, 1, 'smooth')
const CLCL3_OPACITY = rampTrack(T_TERMINATE - 0.2, 0, T_TERMINATE + 0.5, 1, 'smooth')
const CLCL3_FORM = rampTrack(T_TERMINATE - 0.2, 0, T_TERMINATE + 1.2, 1, 'smooth')

/** Фоновый газ: проявляется в начале и слегка тускнеет на крупных планах. */
const GAS_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.9, v: 0.62, ease: 'smooth' },
  { t: 4, v: 0.62 },
  { t: 6.2, v: 0.4, ease: 'smooth' },
  { t: 17.2, v: 0.4 },
  { t: 22, v: 0.58, ease: 'smooth' },
]

/** Темнота первого шага: пока нет света, реакции нет и кадр приглушён. */
const DARK: ScalarTrack = [
  { t: 0, v: 1 },
  { t: T_PHOTON - 0.7, v: 1 },
  { t: T_PHOTON, v: 0, ease: 'outCubic' },
]

const FADE = fadeTrack(HCL_FINISH)

const CAM_ZOOM: ScalarTrack = [
  { t: 0, v: 0.8 },
  { t: 4, v: 0.82, ease: 'smooth' },
  { t: T_HOMO, v: 1.02, ease: 'smooth' },
  { t: 8.5, v: 0.98, ease: 'smooth' },
  { t: T_ABSTRACT, v: 1.06, ease: 'smooth' },
  { t: 13, v: 0.96, ease: 'smooth' },
  { t: T_PROPAGATE, v: 1.04, ease: 'smooth' },
  { t: 18, v: 0.88, ease: 'smooth' },
  { t: T_TERMINATE, v: 0.98, ease: 'smooth' },
  { t: 22.5, v: 0.76, ease: 'smooth' },
  { t: 26, v: 0.72, ease: 'smooth' },
]

const CAM_OFFSET: Vec3Track = [
  { t: 0, v: [0, 0.02, 0] },
  { t: 4, v: [0, 0.02, 0] },
  { t: T_HOMO, v: [0.62, -0.38, 0], ease: 'smooth' },
  { t: 9.5, v: [0.35, -0.1, 0], ease: 'smooth' },
  { t: T_ABSTRACT, v: [0.42, 0.24, 0], ease: 'smooth' },
  { t: 13.5, v: [0.1, 0.1, 0], ease: 'smooth' },
  { t: T_PROPAGATE, v: [-0.26, -0.3, 0], ease: 'smooth' },
  { t: 18.5, v: [-0.05, -0.3, 0], ease: 'smooth' },
  { t: T_TERMINATE, v: [0.09, -0.8, 0], ease: 'smooth' },
  { t: 22.5, v: [0, -0.05, 0], ease: 'smooth' },
  { t: 26, v: [0, 0.02, 0] },
]

const CAM_YAW: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 13, v: 0 },
  { t: 18, v: 0.12, ease: 'smooth' },
  { t: 22, v: 0.3, ease: 'smooth' },
  { t: 26, v: 0.4, ease: 'smooth' },
]

const CAM_ROLL: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 18, v: 0 },
  { t: 22, v: -0.07, ease: 'smooth' },
  { t: 26, v: -0.1, ease: 'smooth' },
]

const PRODUCT_APPEAR: Record<string, ScalarTrack> = Object.fromEntries(
  PRODUCT_MOLECULES.map((p) => [p.id, appearTrack(p.at, 0.6)]),
)

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Тексты подписей — формулы и обозначения СИ, одинаковые в ru/en/uz.
 * Агрегатные состояния и единицы пишутся ТОКЕНАМИ ({g}, {pm}, {nm}, {kJmol},
 * {kJ}) и подставляются сценой один раз за кадр (localizeSceneLabels).
 */
export type HclLabelAnchor =
  | HclAtomId
  | 'cl2mol1'
  | 'cl2mol2'
  | 'h2mol'
  | 'hclMol1'
  | 'hclMol2'
  | 'termMol'
  | 'center'

export type HclLabelDef = SceneLabelDef & { anchor: HclLabelAnchor }

/** Число с НАСТОЯЩИМ минусом и знаком «+» у эндотермических величин. */
const signed = (n: number, digits = 0): string => {
  const v = Number(Math.abs(n).toFixed(digits))
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${v}`
}

const PM_HCL = Math.round(HCL_GEOM.data.hClPm * 10) / 10
const NM_PHOTON = HCL_PHOTON_NM

export const HCL_LABELS: readonly HclLabelDef[] = [
  // ——— Шаг 1: что в сосуде ———
  { id: 'h2mol', kind: 'species', anchor: 'h2mol', dy: 0.44, keys: [{ t: 0, text: 'H₂ ({g})' }], windows: [[0.7, 10.6]] },
  { id: 'cl2molA', kind: 'species', anchor: 'cl2mol1', dy: 0.5, keys: [{ t: 0, text: 'Cl₂ ({g})' }], windows: [[0.7, 5.9]] },
  { id: 'cl2molB', kind: 'species', anchor: 'cl2mol2', dy: 0.5, keys: [{ t: 0, text: 'Cl₂ ({g})' }], windows: [[0.9, 5.0], [13.6, 15.3]] },
  // ——— Шаг 2: квант света и гомолиз ———
  { id: 'photon', kind: 'token', anchor: 'cl2mol1', dy: -0.66, keys: [{ t: 0, text: `hν,  λ ≤ ${NM_PHOTON} {nm}` }], windows: [[4.7, 7.6]] },
  { id: 'dissoc', kind: 'delta', anchor: 'cl2mol1', dy: 1.08, keys: [{ t: 0, text: `D(Cl–Cl) = ${HCL_INITIATION_KJ} {kJmol}` }], windows: [[5.8, 7.9]] },
  { id: 'radCl1', kind: 'species', anchor: 'cl1', dy: 0.28, keys: [{ t: 0, text: 'Cl•' }], windows: [[6.6, 10.8]] },
  { id: 'radCl2', kind: 'species', anchor: 'cl2', dy: 0.28, keys: [{ t: 0, text: 'Cl•' }], windows: [[6.6, 8.2], [18.4, 20.4]] },
  // ——— Шаг 3: первое звено цепи ———
  { id: 'prop1', kind: 'delta', anchor: 'hclMol1', dy: -0.62, keys: [{ t: 0, text: `ΔH = ${signed(HCL_PROP1_KJ)} {kJmol}` }], windows: [[11.1, 12.7]] },
  { id: 'hclA', kind: 'species', anchor: 'hclMol1', dy: 0.46, keys: [{ t: 0, text: 'HCl ({g})' }], windows: [[12.5, 13.7]] },
  { id: 'dPlus', kind: 'ox', anchor: 'h1', dy: 0.24, keys: [{ t: 0, text: 'δ⁺' }], windows: [[11.7, 13.4]] },
  { id: 'dMinus', kind: 'ox', anchor: 'cl1', dy: 0.3, keys: [{ t: 0, text: 'δ⁻' }], windows: [[11.7, 13.4]] },
  { id: 'radH', kind: 'species', anchor: 'h2', dy: 0.34, keys: [{ t: 0, text: 'H•' }], windows: [[11.6, 15.3]] },
  // ——— Шаг 4: второе звено и цепь ———
  { id: 'prop2', kind: 'delta', anchor: 'hclMol2', dy: -0.64, keys: [{ t: 0, text: `ΔH = ${signed(HCL_PROP2_KJ)} {kJmol}` }], windows: [[15.7, 17.5]] },
  { id: 'hclB', kind: 'species', anchor: 'hclMol2', dy: 0.46, keys: [{ t: 0, text: 'HCl ({g})' }], windows: [[15.9, 17.4]] },
  { id: 'radCl4', kind: 'species', anchor: 'cl4', dy: 0.3, keys: [{ t: 0, text: 'Cl•' }], windows: [[16.2, 20.4]] },
  {
    id: 'count',
    kind: 'token',
    anchor: 'center',
    dy: 1.42,
    keys: [
      { t: 0, text: 'n(HCl) = 1' },
      { t: T_PROPAGATE + 0.2, text: 'n(HCl) = 2' },
      { t: 16.6, text: 'n(HCl) = 3' },
      { t: 17.1, text: 'n(HCl) = 4' },
      { t: 17.6, text: 'n(HCl) = 5' },
      { t: 18.1, text: 'n(HCl) = 6' },
      { t: 19, text: 'n(HCl) ≈ 10⁶' },
    ],
    windows: [[11.3, 21.6]],
  },
  // ——— Шаг 5: обрыв цепи ———
  { id: 'termDH', kind: 'delta', anchor: 'termMol', dy: 0.56, keys: [{ t: 0, text: `ΔH = ${signed(-HCL_INITIATION_KJ)} {kJmol}` }], windows: [[20.7, 22.3]] },
  { id: 'termMol', kind: 'species', anchor: 'termMol', dy: -0.58, keys: [{ t: 0, text: 'Cl₂ ({g})' }], windows: [[20.9, 22.3]] },
  // ——— Шаг 6: итог ———
  { id: 'product', kind: 'species', anchor: 'center', dy: -1.5, keys: [{ t: 0, text: '2 HCl ({g})' }], windows: [[22.4, 26.2]] },
  { id: 'dH', kind: 'delta', anchor: 'center', dy: -2.02, keys: [{ t: 0, text: `ΔH = ${signed(HCL_REACTION_DH_KJ, 1)} {kJ}` }], windows: [[22.9, 26.2]] },
  { id: 'bondLen', kind: 'token', anchor: 'hclMol2', dy: 0.48, keys: [{ t: 0, text: `d(H–Cl) = ${PM_HCL} {pm}` }], windows: [[22.6, 26]] },
  { id: 'dipole', kind: 'token', anchor: 'hclMol2', dy: -0.5, keys: [{ t: 0, text: `μ = ${HCL_GEOM.data.dipoleD} D` }], windows: [[23.5, 26]] },
]

export type HclLabelState = SceneLabelState

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type HclBondFrame = {
  opacity: number
  stress: number
  thinning: number
  form: number
  polarity: number
}

export type HclFrame = {
  atoms: Record<HclAtomId, THREE.Vector3>
  radius: Record<HclAtomId, number>
  opacity: Record<HclAtomId, number>
  emissive: Record<HclAtomId, number>
  bonds: Record<HclBondId, HclBondFrame>
  /** яркость неспаренного электрона радикала, 0…1 */
  radicals: { cl1: number; cl2: number; cl4: number; h2: number }
  /** яркость общей электронной пары новой связи, 0…1 */
  pairs: { hcl1: number; hcl2: number; term: number }
  /** квант света: положение и яркость */
  photon: { pos: THREE.Vector3; amount: number }
  env: { exo: number; fade: number; dark: number; chain: number }
  labels: HclLabelState[]
  camera: { zoom: number; offset: THREE.Vector3; yaw: number; roll: number; shake: number; bloom: number; vignette: number }
  center: THREE.Vector3
  /** середины молекул — якоря подписей и центры эффектов */
  mid: Record<'cl2mol1' | 'cl2mol2' | 'h2mol' | 'hclMol1' | 'hclMol2' | 'termMol', THREE.Vector3>
}

function emptyBond(): HclBondFrame {
  return { opacity: 0, stress: 0, thinning: 0, form: 1, polarity: 0 }
}

export function createHclFrame(): HclFrame {
  const atoms = {} as Record<HclAtomId, THREE.Vector3>
  const radius = {} as Record<HclAtomId, number>
  const opacity = {} as Record<HclAtomId, number>
  const emissive = {} as Record<HclAtomId, number>
  for (const a of HCL_ATOMS) {
    atoms[a.id] = new THREE.Vector3()
    radius[a.id] = a.el === 'H' ? R.h : R.cl
    opacity[a.id] = a.kind === 'story' ? 1 : 0
    emissive[a.id] = 0.08
  }
  const bonds = {} as Record<HclBondId, HclBondFrame>
  for (const b of HCL_BONDS) bonds[b.id] = emptyBond()

  return {
    atoms,
    radius,
    opacity,
    emissive,
    bonds,
    radicals: { cl1: 0, cl2: 0, cl4: 0, h2: 0 },
    pairs: { hcl1: 0, hcl2: 0, term: 0 },
    photon: { pos: new THREE.Vector3(), amount: 0 },
    env: { exo: 0, fade: 0, dark: 1, chain: 0 },
    labels: createLabelStates(HCL_LABELS),
    camera: { zoom: 1, offset: new THREE.Vector3(), yaw: 0, roll: 0, shake: 0, bloom: 0.3, vignette: 0.3 },
    center: new THREE.Vector3(),
    mid: {
      cl2mol1: new THREE.Vector3(),
      cl2mol2: new THREE.Vector3(),
      h2mol: new THREE.Vector3(),
      hclMol1: new THREE.Vector3(),
      hclMol2: new THREE.Vector3(),
      termMol: new THREE.Vector3(),
    },
  }
}

const _dir = new THREE.Vector3()

/** Медленный тепловой дрейф молекулы газа (детерминированный, без аллокаций). */
function gasAtom(spec: GasSpec, sign: number, t: number, out: THREE.Vector3, seed: number): void {
  const cx = spec.center[0] + 0.1 * Math.sin(t * 0.31 + seed * 1.7)
  const cy = spec.center[1] + 0.08 * Math.sin(t * 0.27 + seed * 2.6)
  const cz = spec.center[2] + 0.07 * Math.sin(t * 0.23 + seed * 3.4)
  const a = spec.phase + t * 0.19 * (seed % 2 === 0 ? 1 : -1)
  _dir.set(Math.cos(a), Math.sin(a) * 0.62, Math.sin(a) * 0.78).normalize()
  out.set(cx + _dir.x * spec.half * sign, cy + _dir.y * spec.half * sign, cz + _dir.z * spec.half * sign)
}

/** Готовая молекула HCl «из глубины цепи»: стоит на месте и едва покачивается. */
function productAtom(center: V3, sign: number, t: number, out: THREE.Vector3, seed: number): void {
  const cx = center[0] + 0.05 * Math.sin(t * 0.21 + seed * 2.2)
  const cy = center[1] + 0.045 * Math.sin(t * 0.18 + seed * 3.1)
  out.set(cx + HCL2 * sign, cy, center[2])
}

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleHclFrame(t: number, frame: HclFrame): HclFrame {
  const { atoms, radius, opacity, emissive, bonds } = frame

  // ——— Частицы сюжета ———
  sampleVec3(POS.cl1, t, atoms.cl1)
  sampleVec3(POS.cl2, t, atoms.cl2)
  sampleVec3(POS.cl3, t, atoms.cl3)
  sampleVec3(POS.cl4, t, atoms.cl4)
  sampleVec3(POS.h1, t, atoms.h1)
  sampleVec3(POS.h2, t, atoms.h2)

  // ——— Фоновый газ ———
  const gasA = sampleScalar(GAS_OPACITY, t)
  for (let i = 0; i < GAS_MOLECULES.length; i++) {
    const g = GAS_MOLECULES[i]!
    gasAtom(g, -1, t, atoms[`G${i * 2}` as HclAtomId], i)
    gasAtom(g, 1, t, atoms[`G${i * 2 + 1}` as HclAtomId], i)
    opacity[`G${i * 2}` as HclAtomId] = gasA
    opacity[`G${i * 2 + 1}` as HclAtomId] = gasA
  }

  // ——— Молекулы HCl дальнейших звеньев цепи ———
  for (let i = 0; i < PRODUCT_MOLECULES.length; i++) {
    const p = PRODUCT_MOLECULES[i]!
    productAtom(p.center, -1, t, atoms[`P${i * 2}` as HclAtomId], i)
    productAtom(p.center, 1, t, atoms[`P${i * 2 + 1}` as HclAtomId], i)
    const a = sampleScalar(PRODUCT_APPEAR[p.id]!, t)
    opacity[`P${i * 2}` as HclAtomId] = a
    opacity[`P${i * 2 + 1}` as HclAtomId] = a
  }

  // ——— Радиусы постоянны: реакция радикальная, зарядов ни у кого нет ———
  for (const a of HCL_ATOMS) radius[a.id] = a.el === 'H' ? R.h : R.cl

  // ——— Связи ———
  const clcl1 = bonds.clcl1
  clcl1.opacity = sampleScalar(CLCL1_OPACITY, t)
  clcl1.stress = sampleScalar(CLCL1_STRESS, t)
  clcl1.thinning = sampleScalar(CLCL1_SPLIT, t)
  clcl1.form = 1
  clcl1.polarity = 0

  const hh = bonds.hh
  hh.opacity = sampleScalar(HH_OPACITY, t)
  hh.stress = sampleScalar(HH_STRESS, t)
  hh.thinning = sampleScalar(HH_SPLIT, t)
  hh.form = 1
  hh.polarity = 0

  const clcl2 = bonds.clcl2
  clcl2.opacity = sampleScalar(CLCL2_OPACITY, t)
  clcl2.stress = sampleScalar(CLCL2_STRESS, t)
  clcl2.thinning = sampleScalar(CLCL2_SPLIT, t)
  clcl2.form = 1
  clcl2.polarity = 0

  const hcl1 = bonds.hcl1
  hcl1.opacity = sampleScalar(HCL1_OPACITY, t)
  hcl1.stress = 0
  hcl1.thinning = 0
  hcl1.form = sampleScalar(HCL1_FORM, t)
  hcl1.polarity = HCL_POLARITY * hcl1.form

  const hcl2 = bonds.hcl2
  hcl2.opacity = sampleScalar(HCL2_OPACITY, t)
  hcl2.stress = 0
  hcl2.thinning = 0
  hcl2.form = sampleScalar(HCL2_FORM, t)
  hcl2.polarity = HCL_POLARITY * hcl2.form

  const clcl3 = bonds.clcl3
  clcl3.opacity = sampleScalar(CLCL3_OPACITY, t)
  clcl3.stress = 0
  clcl3.thinning = 0
  clcl3.form = sampleScalar(CLCL3_FORM, t)
  clcl3.polarity = 0

  for (let i = 0; i < GAS_MOLECULES.length; i++) {
    const b = bonds[`gb${i}` as HclBondId]!
    b.opacity = gasA
    b.stress = 0
    b.thinning = 0
    b.form = 1
    b.polarity = 0
  }
  for (let i = 0; i < PRODUCT_MOLECULES.length; i++) {
    const b = bonds[`pb${i}` as HclBondId]!
    b.opacity = opacity[`P${i * 2}` as HclAtomId]
    b.stress = 0
    b.thinning = 0
    b.form = 1
    b.polarity = HCL_POLARITY
  }

  // ——— Неспаренные электроны радикалов ———
  frame.radicals.cl1 = windowFade([T_HOMO + 0.1, T_ABSTRACT], t, 0.45)
  frame.radicals.cl2 = windowFade([T_HOMO + 0.1, T_TERMINATE], t, 0.45)
  frame.radicals.h2 = windowFade([T_ABSTRACT + 0.2, T_PROPAGATE], t, 0.45)
  frame.radicals.cl4 = windowFade([T_PROPAGATE + 0.2, T_TERMINATE], t, 0.45)

  // ——— Общие электронные пары новых связей ———
  frame.pairs.hcl1 = windowFade([T_ABSTRACT - 0.3, 13.4], t, 0.5)
  frame.pairs.hcl2 = windowFade([T_PROPAGATE - 0.3, 18], t, 0.5)
  frame.pairs.term = windowFade([T_TERMINATE - 0.2, 22.2], t, 0.5)

  // ——— Квант света ———
  sampleVec3(PHOTON_TRACK, t, frame.photon.pos)
  frame.photon.amount = windowFade([T_PHOTON - 0.8, T_PHOTON + 0.15], t, 0.18)

  // ——— Энергия и среда ———
  // Тепло даёт ВТОРАЯ стадия роста цепи (−189 кДж/моль), а не первая.
  const exo =
    smoothstep(T_PROPAGATE - 0.25, T_PROPAGATE + 0.15, t) * (1 - 0.45 * smoothstep(T_PROPAGATE, T_PROPAGATE + 2.4, t))
  frame.env.exo = exo
  frame.env.dark = sampleScalar(DARK, t)
  frame.env.fade = sampleScalar(FADE, t)
  frame.env.chain = windowFade([T_CHAIN - 0.6, 21.4], t, 0.6)

  // ——— Середины молекул (якоря подписей и центры эффектов) ———
  frame.mid.cl2mol1.copy(atoms.cl1).lerp(atoms.cl2, 0.5)
  frame.mid.cl2mol2.copy(atoms.cl3).lerp(atoms.cl4, 0.5)
  frame.mid.h2mol.copy(atoms.h1).lerp(atoms.h2, 0.5)
  frame.mid.hclMol1.copy(atoms.h1).lerp(atoms.cl1, 0.5)
  frame.mid.hclMol2.copy(atoms.h2).lerp(atoms.cl3, 0.5)
  frame.mid.termMol.copy(atoms.cl2).lerp(atoms.cl4, 0.5)
  frame.center.set(0, 0, 0)

  // ——— Свечение частиц ———
  for (const a of HCL_ATOMS) {
    let e = 0.08 + exo * 0.35
    if (a.id === 'cl1') e += frame.radicals.cl1 * 0.45
    else if (a.id === 'cl2') e += frame.radicals.cl2 * 0.45
    else if (a.id === 'cl4') e += frame.radicals.cl4 * 0.45
    else if (a.id === 'h2') e += frame.radicals.h2 * 0.55
    if (a.kind === 'product') e += frame.env.chain * 0.3
    emissive[a.id] = e
  }

  // ——— Подписи ———
  sampleLabels(
    HCL_LABELS,
    frame.labels,
    t,
    (def, st) => {
      const d = def as HclLabelDef
      const mid = frame.mid[d.anchor as keyof HclFrame['mid']]
      if (mid) {
        st.pos.copy(mid)
        st.pos.y += d.dy
      } else if (d.anchor === 'center') {
        st.pos.copy(frame.center)
        st.pos.y += d.dy
      } else {
        const id = d.anchor as HclAtomId
        st.pos.copy(atoms[id])
        st.pos.y += d.dy > 0 ? radius[id] + d.dy : -(radius[id] - d.dy)
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
    0.34 * Math.max(0, 1 - Math.abs(t - T_HOMO) / 0.32) +
    0.22 * Math.max(0, 1 - Math.abs(t - T_ABSTRACT) / 0.3) +
    0.55 * Math.max(0, 1 - Math.abs(t - T_PROPAGATE) / 0.45)
  cam.bloom = 0.22 + 0.5 * (1 - frame.env.dark) * 0.2 + 0.8 * exo + 0.5 * frame.photon.amount
  cam.vignette = 0.3 + 0.22 * frame.env.dark + 0.12 * exo
  return frame
}

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validateHclStoryboard(): void {
  validateTracks({
    'pos.cl1': POS.cl1,
    'pos.cl2': POS.cl2,
    'pos.cl3': POS.cl3,
    'pos.cl4': POS.cl4,
    'pos.h1': POS.h1,
    'pos.h2': POS.h2,
    photon: PHOTON_TRACK,
    'cam.offset': CAM_OFFSET,
  })
  validateTracks({
    CLCL1_STRESS,
    CLCL1_SPLIT,
    CLCL1_OPACITY,
    HH_STRESS,
    HH_SPLIT,
    HH_OPACITY,
    CLCL2_STRESS,
    CLCL2_SPLIT,
    CLCL2_OPACITY,
    HCL1_OPACITY,
    HCL1_FORM,
    HCL2_OPACITY,
    HCL2_FORM,
    CLCL3_OPACITY,
    CLCL3_FORM,
    GAS_OPACITY,
    DARK,
    FADE,
    CAM_ZOOM,
    CAM_YAW,
    CAM_ROLL,
    ...PRODUCT_APPEAR,
  })

  // Простые вещества стартуют МОЛЕКУЛАМИ: ни одного свободного атома в кадре.
  const frame = createHclFrame()
  sampleHclFrame(0, frame)
  const d = (a: HclAtomId, b: HclAtomId) => frame.atoms[a].distanceTo(frame.atoms[b])
  const near = (got: number, want: number, tol: number, what: string) => {
    if (Math.abs(got - want) > tol) throw new Error(`hcl: ${what} — ${got.toFixed(3)}, ожидалось ${want.toFixed(3)}`)
  }
  near(d('cl1', 'cl2'), CH * 2, 1e-6, 'длина связи Cl–Cl в молекуле №1')
  near(d('cl3', 'cl4'), CH * 2, 1e-6, 'длина связи Cl–Cl в молекуле №2')
  near(d('h1', 'h2'), HH * 2, 1e-6, 'длина связи H–H')
  for (let i = 0; i < GAS_MOLECULES.length; i++) {
    const g = GAS_MOLECULES[i]!
    near(
      d(`G${i * 2}` as HclAtomId, `G${i * 2 + 1}` as HclAtomId),
      g.half * 2,
      1e-6,
      `длина связи фоновой молекулы ${g.el === 'H' ? 'H₂' : 'Cl₂'}`,
    )
  }

  // Готовая молекула HCl: настоящая длина связи.
  sampleHclFrame(19, frame)
  near(d('h1', 'cl1'), HCL, 1e-6, 'длина связи H–Cl (первое звено)')
  near(d('h2', 'cl3'), HCL, 1e-6, 'длина связи H–Cl (второе звено)')
  for (let i = 0; i < PRODUCT_MOLECULES.length; i++) {
    near(d(`P${i * 2}` as HclAtomId, `P${i * 2 + 1}` as HclAtomId), HCL, 1e-6, `длина связи HCl №${i + 1} цепи`)
  }

  // Обрыв цепи: получилась настоящая молекула Cl₂.
  sampleHclFrame(21.5, frame)
  near(d('cl2', 'cl4'), CH * 2, 1e-6, 'длина связи Cl–Cl после обрыва цепи')

  // Физика размеров: водород ВТРОЕ меньше хлора — это видно и не подгоняется.
  const ratio = R.cl / R.h
  if (ratio < 3 || ratio > 3.6) throw new Error(`hcl: r(Cl)/r(H) = ${ratio.toFixed(2)}, ожидалось ≈ 3,3`)

  // Полярность связи H–Cl направлена К ХЛОРУ (в BondPool «+» = к атому b).
  for (const b of HCL_BONDS) {
    if (b.id !== 'hcl1' && b.id !== 'hcl2') continue
    const bEl = HCL_ATOMS.find((a) => a.id === b.b)!.el
    if (bEl !== 'Cl') throw new Error(`hcl: у связи ${b.id} атом b обязан быть хлором (плотность смещена к нему)`)
  }
  if (!(HCL_POLARITY > 0)) throw new Error('hcl: смещение электронной плотности обязано быть к хлору')
  if (HCL_IONIC_FRACTION <= 0 || HCL_IONIC_FRACTION >= 0.5) {
    throw new Error(`hcl: доля ионности ${HCL_IONIC_FRACTION.toFixed(3)} — связь обязана остаться полярной КОВАЛЕНТНОЙ`)
  }
}
