import * as THREE from 'three'
import { bondAngleDeg, bondLengthPm, dipoleDebye, getElement } from '../../../../chemistry/data'
import { smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, windowFade, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { bondLength, pmToScene, speciesRadius } from '../kit/cpkAtoms'
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
import { H2O_THERMO } from './h2oEnergetics'
import { H2O_END, H2O_FINISH, h2oCueAt } from './h2oSteps'

export {
  H2O_CUES,
  H2O_END,
  H2O_FINISH,
  H2O_SEGMENTS,
  H2O_STEPS,
  H2O_STEP_IDS,
  H2O_TIMING,
  h2oStepIndexAt,
  type H2oCueId,
  type H2oStepId,
} from './h2oSteps'

/**
 * Раскадровка 2 H₂ (г.) + O₂ (г.) → 2 H₂O (г.) — ЧИСТАЯ функция времени сюжета.
 *
 * Вся химия — из src/chemistry/data (ни одного числа руками):
 *   • H₂: длина связи 74,14 пм (E = 436 кДж/моль);
 *   • O₂: 120,8 пм, ДВОЙНАЯ связь (E = 498 кДж/моль);
 *   • H₂O: O–H 95,8 пм (E = 463), угол H–O–H 104,45°, μ = 1,85 D;
 *   • водородная связь H···O 185 пм (O···O выходит 280 пм — как в жидкой воде);
 *   • радиусы ковалентные: H 31 пм, O 66 пм; ЭО: H 2,20, O 3,44.
 *
 * Частичные заряды НЕ выдуманы: δ считается из дипольного момента в модели
 * точечных зарядов, μ = 2·q·d·cos(θ/2) ⇒ q(H) ≈ +0,33 e, q(O) ≈ −0,66 e.
 *
 * ЧТО НАРИСОВАНО СХЕМАТИЧНО (и так сказано в тексте урока):
 *   • «полёт» электрона к кислороду: в ковалентной связи электрон НЕ отдаётся,
 *     пара общая — просто её облако смещено к кислороду;
 *   • неподелённые пары нарисованы под идеальным тетраэдрическим углом 109,47°:
 *     измеряемая величина — только угол H–O–H (104,45°), направление
 *     неподелённых пар экспериментом напрямую не определяется;
 *   • показаны ДВЕ молекулы воды, в капле их порядка 10²¹;
 *   • полярность связи на экране усиливается на шаге «полярность» — связь полярна
 *     с момента образования, подчёркивание сделано ради наглядности.
 */

const D2R = Math.PI / 180

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

/** Длина связи O–H, мировые единицы. */
const OH = bondLength('O-H')
/** Половина длины связи H–H и O=O — молекулы строим симметрично вокруг центра. */
const HH_HALF = bondLength('H-H') / 2
const OO_HALF = bondLength('O=O') / 2
/** Водородная связь: расстояние H···O. */
const HB = pmToScene(bondLengthPm('O-H...O'))

/** Валентный угол H–O–H — ИЗМЕРЯЕМАЯ величина (микроволновая спектроскопия). */
const ANGLE = bondAngleDeg('water')
const ANGLE_HALF = ANGLE / 2
/** Угол идеального тетраэдра, град — под ним рисуем НЕПОДЕЛЁННЫЕ пары (см. note). */
const TETRA = Math.acos(-1 / 3) / D2R
/** Отклонение водородной связи от прямой: в воде угол O–H···O ≈ 175°. */
const HB_BEND = 5

const R = {
  h: speciesRadius('H', 0),
  o: speciesRadius('O', 0),
} as const

/** Радиус схематичной валентной оболочки кислорода. */
const SHELL_O = R.o * 1.75

const EN_H = getElement('H').electronegativity ?? 0
const EN_O = getElement('O').electronegativity ?? 0
const DELTA_EN = Math.round((EN_O - EN_H) * 100) / 100

/**
 * Частичный заряд из дипольного момента, модель точечных зарядов:
 * μ = 2·q·d·cos(θ/2), где d — длина связи. 1 e·Å = 4.80320 D.
 */
const E_ANGSTROM_IN_DEBYE = 4.8032
const PARTIAL_H =
  dipoleDebye('H2O')! / (E_ANGSTROM_IN_DEBYE * 2 * (bondLengthPm('O-H') / 100) * Math.cos(ANGLE_HALF * D2R))
const PARTIAL_O = -2 * PARTIAL_H

type V3 = readonly [number, number, number]

const polar = (o: V3, deg: number, r: number): V3 => [
  o[0] + r * Math.cos(deg * D2R),
  o[1] + r * Math.sin(deg * D2R),
  o[2],
]

/** Бисектриса молекулы воды A: смотрит вправо-вниз, её водород — донор связи. */
const THETA_A = -50
const O_A: V3 = [-0.282, 0.085, 0]
/** Водород-донор (смотрит на вторую молекулу) и второй водород. */
const A_H1 = polar(O_A, THETA_A + ANGLE_HALF, OH)
const A_H2 = polar(O_A, THETA_A - ANGLE_HALF, OH)

/** Направление водородной связи H···O и положение второй молекулы. */
const HB_DIR = THETA_A + ANGLE_HALF - HB_BEND
const O_B: V3 = polar(A_H1, HB_DIR, HB)
/** Бисектриса молекулы B смотрит ОТ молекулы A — к ней обращены её неподелённые пары. */
const THETA_B = HB_DIR
const B_H1 = polar(O_B, THETA_B + ANGLE_HALF, OH)
const B_H2 = polar(O_B, THETA_B - ANGLE_HALF, OH)

/**
 * Две неподелённые пары sp³-кислорода: лежат в плоскости, перпендикулярной
 * плоскости молекулы, и обе смотрят в сторону, противоположную водородам.
 */
function lonePairs(thetaDeg: number): [V3, V3] {
  const c = Math.cos((TETRA / 2) * D2R)
  const s = Math.sin((TETRA / 2) * D2R)
  const bx = -Math.cos(thetaDeg * D2R)
  const by = -Math.sin(thetaDeg * D2R)
  return [
    [c * bx, c * by, s],
    [c * bx, c * by, -s],
  ]
}

export const LONE_PAIRS_A = lonePairs(THETA_A)
export const LONE_PAIRS_B = lonePairs(THETA_B)

/** Справочные числа сцены — их же показывают подписи и проверяет тест. */
export const H2O_GEOM = {
  radius: R,
  shellO: SHELL_O,
  oh: OH,
  hb: HB,
  angleDeg: ANGLE,
  lonePairAngleDeg: TETRA,
  hbondAngleDeg: 180 - HB_BEND,
  data: {
    ohPm: bondLengthPm('O-H'),
    hhPm: bondLengthPm('H-H'),
    ooPm: bondLengthPm('O=O'),
    hbPm: bondLengthPm('O-H...O'),
    dipoleD: dipoleDebye('H2O')!,
    enH: EN_H,
    enO: EN_O,
    deltaEN: DELTA_EN,
    partialH: Math.round(PARTIAL_H * 1000) / 1000,
    partialO: Math.round(PARTIAL_O * 1000) / 1000,
  },
} as const

/**
 * Масштаб рига камеры. Молекула воды в 4 раза мельче фрагмента решётки NaCl
 * (O–H 96 пм против d(Na⁺–Cl⁻) 282 пм), поэтому риг увеличен — на экране сцена
 * занимает столько же места, что и остальные уроки.
 */
export const H2O_RIG_SCALE = 4.2

// ─────────────────────────────────────────────────────────────────────────────
// Частицы
// ─────────────────────────────────────────────────────────────────────────────

export type H2oElement = 'H' | 'O'
export type H2oAtomId = 'h1' | 'h2' | 'h3' | 'h4' | 'o1' | 'o2'

/**
 * Шесть атомов: 2 H₂ + O₂ → 2 H₂O. Из КАЖДОЙ молекулы водорода один атом
 * уходит в первую молекулу воды, другой — во вторую: видно, что атомы
 * перемешиваются, а не «молекула превращается в молекулу».
 *   молекула A = o1 + h1 + h3,  молекула B = o2 + h2 + h4.
 */
export const H2O_ATOMS: readonly { id: H2oAtomId; el: H2oElement }[] = [
  { id: 'h1', el: 'H' },
  { id: 'h2', el: 'H' },
  { id: 'h3', el: 'H' },
  { id: 'h4', el: 'H' },
  { id: 'o1', el: 'O' },
  { id: 'o2', el: 'O' },
]

/** Связи реагентов, которые рвутся: [a, b]. */
export const REACTANT_BONDS: readonly (readonly [H2oAtomId, H2oAtomId, number])[] = [
  ['h1', 'h2', 1],
  ['h3', 'h4', 1],
  ['o1', 'o2', 2],
]

/** Ковалентные связи продукта: [H, O] — полярность направлена к кислороду. */
export const OH_BONDS: readonly (readonly [H2oAtomId, H2oAtomId])[] = [
  ['h1', 'o1'],
  ['h3', 'o1'],
  ['h2', 'o2'],
  ['h4', 'o2'],
]

/** Водородная связь: водород молекулы A — кислород молекулы B. */
export const HBOND: readonly [H2oAtomId, H2oAtomId] = ['h1', 'o2']

// ─────────────────────────────────────────────────────────────────────────────
// Ключевые моменты
// ─────────────────────────────────────────────────────────────────────────────

const T_SPARK = h2oCueAt('spark') // 5.4
const T_BREAK = h2oCueAt('bondBreak') // 7.2
const T_PAIR = h2oCueAt('pair') // 11.8
const T_BENT = h2oCueAt('bent') // 15.2
const T_HBOND = h2oCueAt('hbond') // 20.4
const T_EXO = h2oCueAt('exo') // 23.4

/** Момент, когда атомы встали в готовые молекулы. */
const T_FORM = 12.4
/** Радикалы разлетелись и «висят» свободными. */
const T_FREE = 8.8

// ─────────────────────────────────────────────────────────────────────────────
// Дорожки положений
// ─────────────────────────────────────────────────────────────────────────────

const add = (v: V3, dx: number, dy: number, dz: number): V3 => [v[0] + dx, v[1] + dy, v[2] + dz]

/** Стартовая расстановка: две молекулы H₂ слева, молекула O₂ справа. */
const START: Record<H2oAtomId, V3> = {
  h1: [-0.47, 0.42 + HH_HALF, 0.05],
  h2: [-0.47, 0.42 - HH_HALF, 0.05],
  h3: [-0.47, -0.42 + HH_HALF, -0.05],
  h4: [-0.47, -0.42 - HH_HALF, -0.05],
  o1: [0.93, OO_HALF, 0],
  o2: [0.93, -OO_HALF, 0],
}

/** Газ живой: до искры молекулы тихо сближаются. */
const DRIFT: Record<H2oAtomId, V3> = {
  h1: [0.04, -0.015, 0],
  h2: [0.04, -0.015, 0],
  h3: [0.04, 0.015, 0],
  h4: [0.04, 0.015, 0],
  o1: [-0.05, 0, 0],
  o2: [-0.05, 0, 0],
}

/** Натяжение связи перед разрывом: атомы расходятся ВДОЛЬ оси связи. */
const STRETCH: Record<H2oAtomId, V3> = {
  h1: [0, 0.035, 0],
  h2: [0, -0.035, 0],
  h3: [0, 0.035, 0],
  h4: [0, -0.035, 0],
  o1: [0, 0.03, 0],
  o2: [0, -0.03, 0],
}

/** Свободные радикалы H· и O· сразу после гомолитического разрыва. */
const FREE: Record<H2oAtomId, V3> = {
  h1: [-0.36, 0.58, 0.07],
  h2: [-0.1, 0.62, 0.1],
  h3: [-0.53, -0.3, -0.07],
  h4: [-0.06, -0.62, -0.1],
  o1: [0.5, 0.4, -0.1],
  o2: [0.86, -0.34, 0.08],
}

/** Куда атом встаёт в готовой молекуле воды. */
const FINAL: Record<H2oAtomId, V3> = {
  h1: A_H1,
  h3: A_H2,
  o1: O_A,
  h2: B_H1,
  h4: B_H2,
  o2: O_B,
}

/** Дуга полёта (мировые единицы): длинные перелёты разводим по глубине. */
const ARC: Record<H2oAtomId, number> = { h1: 0.05, h2: -0.16, h3: 0.04, h4: 0.16, o1: 0.14, o2: -0.06 }

const POS = {} as Record<H2oAtomId, Vec3Track>
for (const a of H2O_ATOMS) {
  const s = START[a.id]
  const drifted = add(s, DRIFT[a.id][0], DRIFT[a.id][1], DRIFT[a.id][2])
  const stretched = add(drifted, STRETCH[a.id][0], STRETCH[a.id][1], STRETCH[a.id][2])
  POS[a.id] = [
    { t: 0, v: s },
    { t: 4.6, v: drifted, ease: 'smooth' },
    { t: T_BREAK, v: stretched, ease: 'inQuad' },
    { t: T_FREE, v: FREE[a.id], ease: 'smooth' },
    { t: T_FORM, v: FINAL[a.id], ease: 'smooth', arc: ARC[a.id] },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

/** Связи реагентов: натяжение → ГОМОЛИТИЧЕСКИЙ разрыв (split = 0) → исчезновение. */
const REACT_STRESS = rampTrack(4.6, 0, T_BREAK, 1, 'inQuad')
const REACT_THIN = rampTrack(T_BREAK - 0.15, 0, T_BREAK + 0.35, 1, 'outCubic')
const REACT_OPACITY = rampTrack(T_BREAK, 1, T_BREAK + 0.6, 0, 'smooth')

/** Связи O–H: проявляются и «схлопываются» ровно к моменту общей пары. */
const OH_OPACITY = rampTrack(T_PAIR - 1.4, 0, T_PAIR + 0.4, 1, 'smooth')
const OH_FORM = rampTrack(T_PAIR - 1.4, 0, T_PAIR + 0.8, 1, 'smooth')
/**
 * Полярность связи: она есть с момента образования (0,3), а на шаге «полярность»
 * подчёркнута до величины, отвечающей разнице ЭО (ΔЭО / 2 = 0,62).
 */
const POLARITY_MAX = Math.min(1, DELTA_EN / 2)
const OH_POLARITY = rampTrack(T_PAIR, 0.3, 19.6, POLARITY_MAX, 'smooth')

/** Водородная связь между молекулами. */
const HBOND_OPACITY: ScalarTrack = [
  { t: 19.6, v: 0 },
  { t: T_HBOND + 0.4, v: 0.8, ease: 'smooth' },
  { t: 26.4, v: 0.8 },
  { t: H2O_FINISH.to, v: 0, ease: 'smooth' },
]

/** Неподелённые пары: проявляются на шаге «уголковая молекула». */
const LOBES: ScalarTrack = [
  { t: T_BENT - 0.6, v: 0 },
  { t: T_BENT + 0.4, v: 1, ease: 'smooth' },
  { t: 26.4, v: 1 },
  { t: H2O_FINISH.to, v: 0, ease: 'smooth' },
]

/** Облако общей электронной пары на связях O–H. */
const CLOUD: ScalarTrack = [
  { t: T_PAIR - 1.4, v: 0 },
  { t: T_PAIR + 0.6, v: 1, ease: 'smooth' },
  { t: 26.4, v: 1 },
  { t: H2O_FINISH.to, v: 0, ease: 'smooth' },
]

/** Частичные заряды на экране разгораются на шаге «полярность». */
const PARTIAL = rampTrack(18.4, 0, 19.6, 1, 'smooth')

const CAM_ZOOM: ScalarTrack = [
  { t: 0, v: 0.86 },
  { t: 4, v: 0.92, ease: 'smooth' },
  { t: T_FREE, v: 1.0, ease: 'smooth' },
  { t: 12.6, v: 1.02, ease: 'smooth' },
  { t: 15.6, v: 1.25, ease: 'smooth' },
  { t: 18.0, v: 1.25 },
  { t: T_HBOND, v: 0.95, ease: 'smooth' },
  { t: T_EXO, v: 0.9, ease: 'smooth' },
  { t: 26.5, v: 0.86, ease: 'smooth' },
]

/** Куда смещать риг, чтобы выбранный центр оказался посреди кадра. */
const camOffset = (center: V3, zoom: number): V3 => [
  -center[0] * H2O_RIG_SCALE * zoom,
  -center[1] * H2O_RIG_SCALE * zoom,
  0,
]

const mean = (...v: V3[]): V3 => [
  v.reduce((s, p) => s + p[0], 0) / v.length,
  v.reduce((s, p) => s + p[1], 0) / v.length,
  v.reduce((s, p) => s + p[2], 0) / v.length,
]

/** Центр молекулы A и центр пары молекул — по ним ведём камеру. */
const CENTER_A = mean(O_A, A_H1, A_H2)
const CENTER_PAIR = mean(O_A, A_H1, A_H2, O_B, B_H1, B_H2)

const CAM_OFFSET: Vec3Track = [
  { t: 0, v: [0, 0, 0] },
  { t: T_FREE, v: [0, 0, 0] },
  { t: 12.6, v: camOffset(CENTER_PAIR, 1.02), ease: 'smooth' },
  { t: 15.6, v: camOffset(CENTER_A, 1.25), ease: 'smooth' },
  { t: 18.0, v: camOffset(CENTER_A, 1.25) },
  { t: T_HBOND, v: camOffset(CENTER_PAIR, 0.95), ease: 'smooth' },
  { t: 26.5, v: camOffset(CENTER_PAIR, 0.86), ease: 'smooth' },
]

const CAM_YAW: ScalarTrack = [
  { t: 13.4, v: 0 },
  { t: 16.4, v: 0.38, ease: 'smooth' },
  { t: 18.4, v: 0.2, ease: 'smooth' },
  { t: 21.4, v: -0.16, ease: 'smooth' },
  { t: 26.5, v: 0.08, ease: 'smooth' },
]
const CAM_ROLL: ScalarTrack = [
  { t: 13.4, v: 0 },
  { t: 16.4, v: -0.09, ease: 'smooth' },
  { t: 20.0, v: 0, ease: 'smooth' },
]
const FADE = fadeTrack(H2O_FINISH)

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Тексты подписей не переводятся — это формулы и обозначения СИ. Состояния
 * вещества и единицы пишутся токенами ({g}, {l}, {pm}, {kJ}, {kJmol}), сцена
 * подставляет язык один раз за кадр через localizeSceneLabels().
 */
export type H2oAnchor = H2oAtomId | 'h2a' | 'h2b' | 'oo' | 'ohA' | 'hb'
export type H2oLabelDef = SceneLabelDef & { anchor: H2oAnchor }

const PM_HH = Math.round(H2O_GEOM.data.hhPm)
const PM_OO = Math.round(H2O_GEOM.data.ooPm)
const PM_OH = Math.round(H2O_GEOM.data.ohPm)
const PM_HB = Math.round(H2O_GEOM.data.hbPm)
const KJ_BREAK = Math.round(H2O_THERMO.breakKJ)
const KJ_GAS = Math.abs(Math.round(H2O_THERMO.gasKJ))
const KJ_LIQ = Math.abs(Math.round(H2O_THERMO.liquidKJ))

export const H2O_LABELS: readonly H2oLabelDef[] = [
  { id: 'h2a', kind: 'species', anchor: 'h2a', dy: 0.25, keys: [{ t: 0, text: 'H₂ ({g})' }], windows: [[0.8, 6.9]] },
  { id: 'h2b', kind: 'species', anchor: 'h2b', dy: 0.25, keys: [{ t: 0, text: 'H₂ ({g})' }], windows: [[0.8, 6.9]] },
  { id: 'o2mol', kind: 'species', anchor: 'oo', dy: 0.4, keys: [{ t: 0, text: 'O₂ ({g})' }], windows: [[0.8, 6.9]] },
  { id: 'dHH', kind: 'delta', anchor: 'h2a', dy: -0.25, keys: [{ t: 0, text: `${PM_HH} {pm}` }], windows: [[1.6, 4.4]] },
  { id: 'dOO', kind: 'delta', anchor: 'oo', dy: -0.42, keys: [{ t: 0, text: `${PM_OO} {pm}` }], windows: [[1.6, 4.4]] },
  { id: 'mix', kind: 'token', anchor: 'oo', dy: 0.62, keys: [{ t: 0, text: '2 H₂ : 1 O₂' }], windows: [[2.2, 4.4]] },
  { id: 'radH', kind: 'token', anchor: 'h2', dy: 0.1, keys: [{ t: 0, text: 'H·' }], windows: [[7.6, 10.6]] },
  { id: 'radO', kind: 'token', anchor: 'o1', dy: 0.12, keys: [{ t: 0, text: 'O·' }], windows: [[7.6, 10.6]] },
  { id: 'endo', kind: 'delta', anchor: 'oo', dy: 0.62, keys: [{ t: 0, text: `+${KJ_BREAK} {kJ}` }], windows: [[7.3, 9.2]] },
  { id: 'dOH', kind: 'delta', anchor: 'ohA', dy: 0.16, keys: [{ t: 0, text: `${PM_OH} {pm}` }], windows: [[12.8, 17.8]] },
  { id: 'angle', kind: 'token', anchor: 'o1', dy: 0.2, keys: [{ t: 0, text: `${ANGLE}°` }], windows: [[13.8, 17.8]] },
  { id: 'sp3', kind: 'token', anchor: 'o1', dy: 0.42, keys: [{ t: 0, text: 'sp³' }], windows: [[T_BENT + 0.2, 17.8]] },
  { id: 'h2oA', kind: 'species', anchor: 'o1', dy: -0.14, keys: [{ t: 0, text: 'H₂O ({g})' }], windows: [[13.0, 26.4]] },
  {
    id: 'h2oB',
    kind: 'species',
    anchor: 'o2',
    dy: -0.14,
    keys: [{ t: 0, text: 'H₂O ({g})' }],
    windows: [
      [13.0, 14.4],
      [20.2, 26.4],
    ],
  },
  { id: 'dMinus', kind: 'ox', anchor: 'o1', dy: 0.14, keys: [{ t: 0, text: 'δ−' }], windows: [[18.6, 26.4]] },
  { id: 'dPlus1', kind: 'ox', anchor: 'h1', dy: 0.1, keys: [{ t: 0, text: 'δ+' }], windows: [[18.6, 22.6]] },
  { id: 'dPlus2', kind: 'ox', anchor: 'h3', dy: 0.1, keys: [{ t: 0, text: 'δ+' }], windows: [[18.6, 22.6]] },
  {
    id: 'dipole',
    kind: 'delta',
    anchor: 'o1',
    dy: -0.38,
    keys: [{ t: 0, text: `μ = ${H2O_GEOM.data.dipoleD} D` }],
    windows: [[19.2, 22.6]],
  },
  { id: 'hbond', kind: 'token', anchor: 'hb', dy: 0.15, keys: [{ t: 0, text: `${PM_HB} {pm}` }], windows: [[20.6, 26.4]] },
  {
    id: 'dHf',
    kind: 'delta',
    anchor: 'oo',
    dy: -0.5,
    keys: [{ t: 0, text: `ΔH°f = −${KJ_GAS} {kJmol}` }],
    windows: [[23.0, 26.4]],
  },
  {
    id: 'dHl',
    kind: 'delta',
    anchor: 'oo',
    dy: -0.72,
    keys: [{ t: 0, text: `H₂O ({l}): −${KJ_LIQ} {kJmol}` }],
    windows: [[24.0, 26.4]],
  },
]

export type H2oLabelState = SceneLabelState

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type H2oFrame = {
  atoms: Record<H2oAtomId, THREE.Vector3>
  radius: Record<H2oAtomId, number>
  /** частичный заряд δ для окраски кромки (−1…+1) */
  charge: Record<H2oAtomId, number>
  opacity: Record<H2oAtomId, number>
  emissive: Record<H2oAtomId, number>
  bonds: {
    reactantOpacity: number
    stress: number
    thinning: number
    ohOpacity: number
    ohForm: number
    ohPolarity: number
    hbond: number
  }
  /** «переход» электрона к кислороду — схематичный, см. note шага */
  electrons: [ElectronJump, ElectronJump]
  /** валентная оболочка кислорода, 0…1 */
  shell: number
  /** подсветка неспаренных электронов у радикалов, 0…1 */
  radicals: number
  /** облако общей электронной пары, 0…1 */
  cloud: number
  /** неподелённые пары (лепестки), 0…1 */
  lobes: number
  env: { exo: number; fade: number; spark: number }
  labels: H2oLabelState[]
  camera: {
    zoom: number
    offset: THREE.Vector3
    yaw: number
    roll: number
    shake: number
    bloom: number
    vignette: number
  }
  /** середины: молекулы H₂, молекулы O₂ / пары кислородов, связи O–H, водородной связи */
  midHHa: THREE.Vector3
  midHHb: THREE.Vector3
  midOO: THREE.Vector3
  midOH: THREE.Vector3
  midHB: THREE.Vector3
  /** центр действия — для вспышек, волн и тёплого свечения */
  center: THREE.Vector3
}

export function createH2oFrame(): H2oFrame {
  const atoms = {} as Record<H2oAtomId, THREE.Vector3>
  const radius = {} as Record<H2oAtomId, number>
  const charge = {} as Record<H2oAtomId, number>
  const opacity = {} as Record<H2oAtomId, number>
  const emissive = {} as Record<H2oAtomId, number>
  for (const a of H2O_ATOMS) {
    atoms[a.id] = new THREE.Vector3()
    radius[a.id] = a.el === 'H' ? R.h : R.o
    charge[a.id] = 0
    opacity[a.id] = 1
    emissive[a.id] = 0.08
  }
  return {
    atoms,
    radius,
    charge,
    opacity,
    emissive,
    bonds: {
      reactantOpacity: 1,
      stress: 0,
      thinning: 0,
      ohOpacity: 0,
      ohForm: 0,
      ohPolarity: 0,
      hbond: 0,
    },
    electrons: [createElectronJump('eA'), createElectronJump('eB')],
    shell: 0,
    radicals: 0,
    cloud: 0,
    lobes: 0,
    env: { exo: 0, fade: 0, spark: 0 },
    labels: createLabelStates(H2O_LABELS),
    camera: {
      zoom: 1,
      offset: new THREE.Vector3(),
      yaw: 0,
      roll: 0,
      shake: 0,
      bloom: 0.3,
      vignette: 0.3,
    },
    midHHa: new THREE.Vector3(),
    midHHb: new THREE.Vector3(),
    midOO: new THREE.Vector3(),
    midOH: new THREE.Vector3(),
    midHB: new THREE.Vector3(),
    center: new THREE.Vector3(),
  }
}

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleH2oFrame(t: number, frame: H2oFrame): H2oFrame {
  const { atoms, radius, charge, opacity, emissive } = frame

  for (const a of H2O_ATOMS) sampleVec3(POS[a.id], t, atoms[a.id])

  // Радиус ковалентный и постоянный: в ковалентной связи атом НЕ становится ионом.
  for (const a of H2O_ATOMS) radius[a.id] = a.el === 'H' ? R.h : R.o

  // ——— Связи ———
  const b = frame.bonds
  b.stress = sampleScalar(REACT_STRESS, t)
  b.thinning = sampleScalar(REACT_THIN, t)
  b.reactantOpacity = sampleScalar(REACT_OPACITY, t)
  b.ohOpacity = sampleScalar(OH_OPACITY, t)
  b.ohForm = sampleScalar(OH_FORM, t)
  b.ohPolarity = sampleScalar(OH_POLARITY, t)
  b.hbond = sampleScalar(HBOND_OPACITY, t)

  // ——— Частичные заряды: считаны из дипольного момента, разгораются на шаге 5 ———
  const partial = sampleScalar(PARTIAL, t)
  for (const a of H2O_ATOMS) charge[a.id] = partial * (a.el === 'H' ? PARTIAL_H : PARTIAL_O)

  // ——— Электронные эффекты ———
  frame.radicals = windowFade([T_BREAK - 0.1, T_PAIR - 0.6], t, 0.5)
  frame.cloud = sampleScalar(CLOUD, t)
  frame.lobes = sampleScalar(LOBES, t)
  frame.shell = windowFade([T_PAIR - 2.2, 26.4], t, 0.7)

  // Схематичный «приход» электрона к кислороду: на самом деле пара ОБЩАЯ.
  sampleElectronJump(frame.electrons[0], t, {
    donor: atoms.h1,
    acceptor: atoms.o1,
    shellRadius: R.h * 1.9,
    acceptorRadius: radius.o1,
    leave: T_PAIR - 1.6,
    arrive: T_PAIR,
    arcSign: 1,
    arcHeight: 0.1,
  })
  sampleElectronJump(frame.electrons[1], t, {
    donor: atoms.h4,
    acceptor: atoms.o2,
    shellRadius: R.h * 1.9,
    acceptorRadius: radius.o2,
    leave: T_PAIR - 1.35,
    arrive: T_PAIR + 0.25,
    arcSign: -1,
    arcHeight: 0.1,
  })

  // ——— Энергия: искра поджига и экзотермический пик ———
  const spark = Math.max(0, 1 - Math.abs(t - T_SPARK) / 0.55)
  const exo = smoothstep(T_EXO - 0.7, T_EXO, t) * (1 - 0.5 * smoothstep(T_EXO, T_EXO + 1.8, t))
  frame.env.spark = spark
  frame.env.exo = exo
  frame.env.fade = sampleScalar(FADE, t)

  for (const a of H2O_ATOMS) {
    let e = (a.el === 'O' ? 0.1 : 0.12) + exo * 0.45 + spark * 0.3
    if (frame.radicals > 0) e += frame.radicals * 0.35
    emissive[a.id] = e
    opacity[a.id] = 1
  }

  // ——— Опорные точки ———
  frame.midHHa.copy(atoms.h1).lerp(atoms.h2, 0.5)
  frame.midHHb.copy(atoms.h3).lerp(atoms.h4, 0.5)
  frame.midOO.copy(atoms.o1).lerp(atoms.o2, 0.5)
  frame.midOH.copy(atoms.o1).lerp(atoms.h1, 0.5)
  frame.midHB.copy(atoms.h1).lerp(atoms.o2, 0.5)
  frame.center.copy(frame.midOO)

  // ——— Подписи ———
  sampleLabels(
    H2O_LABELS,
    frame.labels,
    t,
    (def, st) => {
      const d = def as H2oLabelDef
      if (d.anchor === 'h2a') st.pos.copy(frame.midHHa).setY(frame.midHHa.y + d.dy)
      else if (d.anchor === 'h2b') st.pos.copy(frame.midHHb).setY(frame.midHHb.y + d.dy)
      else if (d.anchor === 'oo') st.pos.copy(frame.midOO).setY(frame.midOO.y + d.dy)
      else if (d.anchor === 'ohA') st.pos.copy(frame.midOH).setY(frame.midOH.y + d.dy)
      else if (d.anchor === 'hb') st.pos.copy(frame.midHB).setY(frame.midHB.y + d.dy)
      else {
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
    0.35 * Math.max(0, 1 - Math.abs(t - T_BREAK) / 0.35) +
    0.25 * Math.max(0, 1 - Math.abs(t - T_SPARK) / 0.3) +
    0.5 * Math.max(0, 1 - Math.abs(t - T_EXO) / 0.5)
  cam.bloom = 0.3 + 0.5 * spark + 0.75 * exo + 0.15 * frame.lobes
  cam.vignette = 0.3 + 0.15 * exo
  return frame
}

// ─────────────────────────────────────────────────────────────────────────────
// Проверки
// ─────────────────────────────────────────────────────────────────────────────

const dist = (a: V3, b: V3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function angleDeg(a: V3, center: V3, b: V3): number {
  const u = [a[0] - center[0], a[1] - center[1], a[2] - center[2]]
  const v = [b[0] - center[0], b[1] - center[1], b[2] - center[2]]
  const lu = Math.hypot(u[0], u[1], u[2])
  const lv = Math.hypot(v[0], v[1], v[2])
  const c = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv)
  return Math.acos(Math.max(-1, Math.min(1, c))) / D2R
}

const toPm = (scene: number): number => (scene / pmToScene(100)) * 100

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validateH2oStoryboard(): void {
  const vec: Record<string, Vec3Track> = {}
  for (const a of H2O_ATOMS) vec[`pos.${a.id}`] = POS[a.id]
  vec['cam.offset'] = CAM_OFFSET
  validateTracks(vec)
  validateTracks({
    REACT_STRESS,
    REACT_THIN,
    REACT_OPACITY,
    OH_OPACITY,
    OH_FORM,
    OH_POLARITY,
    HBOND_OPACITY,
    LOBES,
    CLOUD,
    PARTIAL,
    CAM_ZOOM,
    CAM_YAW,
    CAM_ROLL,
    FADE,
  })

  if (H2O_ATOMS.length !== 6) throw new Error(`h2o: 2 H₂ + O₂ — это 6 атомов, получилось ${H2O_ATOMS.length}`)
  if (H2O_ATOMS.filter((a) => a.el === 'H').length !== 4) throw new Error('h2o: водородов обязано быть 4')
  if (H2O_ATOMS.filter((a) => a.el === 'O').length !== 2) throw new Error('h2o: кислородов обязано быть 2')

  // ——— Реагенты: простые вещества ДВУХАТОМНЫ и с настоящими длинами связей ———
  const dHH = toPm(dist(START.h1, START.h2))
  const dOO = toPm(dist(START.o1, START.o2))
  if (Math.abs(dHH - H2O_GEOM.data.hhPm) > 0.05) throw new Error(`h2o: H–H = ${dHH.toFixed(2)} пм вместо ${H2O_GEOM.data.hhPm}`)
  if (Math.abs(dOO - H2O_GEOM.data.ooPm) > 0.05) throw new Error(`h2o: O=O = ${dOO.toFixed(2)} пм вместо ${H2O_GEOM.data.ooPm}`)

  // ——— Продукт: длины O–H и угол H–O–H ———
  for (const [h, o] of OH_BONDS) {
    const d = toPm(dist(FINAL[h], FINAL[o]))
    if (Math.abs(d - H2O_GEOM.data.ohPm) > 0.05) throw new Error(`h2o: связь ${o}–${h} = ${d.toFixed(2)} пм вместо ${H2O_GEOM.data.ohPm}`)
  }
  for (const [o, ha, hb] of [
    ['o1', 'h1', 'h3'],
    ['o2', 'h2', 'h4'],
  ] as const) {
    const deg = angleDeg(FINAL[ha], FINAL[o], FINAL[hb])
    if (Math.abs(deg - ANGLE) > 0.05) throw new Error(`h2o: угол H–O–H = ${deg.toFixed(2)}° вместо ${ANGLE}°`)
  }

  // ——— Водородная связь: H···O 185 пм, O···O ≈ 280 пм, угол O–H···O ≈ 175° ———
  const dHB = toPm(dist(FINAL[HBOND[0]], FINAL[HBOND[1]]))
  if (Math.abs(dHB - H2O_GEOM.data.hbPm) > 0.05) throw new Error(`h2o: H···O = ${dHB.toFixed(2)} пм вместо ${H2O_GEOM.data.hbPm}`)
  const dOOpair = toPm(dist(O_A, O_B))
  if (dOOpair < 272 || dOOpair > 288) throw new Error(`h2o: O···O = ${dOOpair.toFixed(1)} пм, в воде 276–280`)
  const hbAngle = angleDeg(O_A, A_H1, O_B)
  if (Math.abs(hbAngle - (180 - HB_BEND)) > 0.05) throw new Error(`h2o: угол O–H···O = ${hbAngle.toFixed(1)}°`)

  // ——— Неподелённые пары: по две на кислород, единичные, под углом тетраэдра ———
  for (const pair of [LONE_PAIRS_A, LONE_PAIRS_B]) {
    if (pair.length !== 2) throw new Error('h2o: у кислорода ровно ДВЕ неподелённые пары')
    for (const v of pair) {
      const len = Math.hypot(v[0], v[1], v[2])
      if (Math.abs(len - 1) > 1e-6) throw new Error('h2o: направление неподелённой пары обязано быть единичным')
    }
    const deg = angleDeg(pair[0], [0, 0, 0], pair[1])
    if (Math.abs(deg - TETRA) > 0.05) throw new Error(`h2o: угол между неподелёнными парами ${deg.toFixed(2)}° вместо ${TETRA.toFixed(2)}°`)
  }
  // Неподелённые пары смотрят ПРОТИВ водородов: скалярное произведение с бисектрисой < 0.
  const bisA: V3 = [Math.cos(THETA_A * D2R), Math.sin(THETA_A * D2R), 0]
  for (const v of LONE_PAIRS_A) {
    if (v[0] * bisA[0] + v[1] * bisA[1] + v[2] * bisA[2] >= 0) {
      throw new Error('h2o: неподелённая пара не может смотреть в ту же сторону, что и водороды')
    }
  }

  // ——— Частичные заряды: молекула в целом НЕЙТРАЛЬНА ———
  const q = 2 * PARTIAL_H + PARTIAL_O
  if (Math.abs(q) > 1e-9) throw new Error(`h2o: суммарный заряд молекулы ${q}, обязан быть 0`)
  if (!(PARTIAL_H > 0.2 && PARTIAL_H < 0.5)) throw new Error(`h2o: δ(H) = ${PARTIAL_H.toFixed(3)} e вне разумного диапазона`)
  if (!(PARTIAL_O < 0)) throw new Error('h2o: на кислороде обязан быть отрицательный частичный заряд')

  // ——— Электроотрицательность: пара смещена именно к кислороду ———
  if (!(EN_O > EN_H)) throw new Error('h2o: ЭО кислорода обязана быть больше ЭО водорода')
  if (!(POLARITY_MAX > 0)) throw new Error('h2o: полярность связи O–H обязана быть больше нуля')

  // ——— Радиусы ———
  if (!(R.h < R.o)) throw new Error('h2o: атом водорода обязан быть меньше атома кислорода')

  if (H2O_END <= 0) throw new Error('h2o: пустой сюжет')
}
