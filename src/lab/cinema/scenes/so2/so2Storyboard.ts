import * as THREE from 'three'
import { bondAngleDeg, bondLengthPm, type ElementSymbol } from '../../../../chemistry/data'
import { sampleScalar, sampleVec3, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { bondLength, pmToScene, speciesRadius } from '../kit/cpkAtoms'
import { createElectronJump, type ElectronJump } from '../kit/electronFx'
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
import { SO2_FINISH, SO2_TIMING, so2CueAt, type So2CueId, type So2StepId } from './so2Steps'

/**
 * РАСКАДРОВКА сцены «S + O₂ → SO₂»: чистая функция sampleFrame(t) на дорожках.
 * Ни THREE-рендера, ни React — файл читают и сцена, и тест (node).
 *
 * Вся химия приходит из src/chemistry/data через kit/cpkAtoms:
 *   d(S–S) 205,5 пм и ∠S–S–S 108° → корона S₈ (D4d);
 *   d(O=O) из bondData (r_e) → молекула кислорода;
 *   d(S=O) 143,1 пм и ∠O–S–O 119,5° → уголковая SO₂;
 *   d(S=O в SO₃) 142,0 пм и 120° → плоская тригональная SO₃;
 *   d(O–H) и ∠H–O–H → молекулы воды на шаге «свойства».
 * Ни одного числа химии здесь руками — только мизансцена (где что стоит на экране).
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Химия → мировые единицы
// ─────────────────────────────────────────────────────────────────────────────

const D_SS = bondLengthPm('S-S')
const RING_ANGLE_DEG = bondAngleDeg('sulfurRing')
const D_SO_PM = bondLengthPm('S=O')
const D_SO3_PM = bondLengthPm('S=O(SO3)')
const ANG_SO2 = bondAngleDeg('sulfurDioxide')
const ANG_SO3 = bondAngleDeg('trigonalPlanar')
const ANG_H2O = bondAngleDeg('water')

const R_SS = bondLength('S-S')
const R_OO = bondLength('O=O')
const R_SO = bondLength('S=O')
const R_SO3 = pmToScene(D_SO3_PM)
const R_OH = bondLength('O-H')
const R_CO = bondLength('C=O(CO2)')

/**
 * ГЕОМЕТРИЯ КОРОНЫ S₈ (точечная группа D4d) выводится из двух справочных чисел —
 * длины связи d(S–S) и валентного угла ∠S–S–S — и больше ни из чего.
 *
 * Восемь атомов стоят на окружности радиуса r через 45°, попеременно на высоте
 * ±h/2 («корона»). Для соседей k и k+1:
 *   d² = a·r² + h²,           a = 1 − 2cos45° + 2cos²45° = 0,585786
 *   v₁·v₂ = b·r² + h²,        b = −2cos45°(1 − cos45°)  = −0,414214
 *   cos(∠S–S–S) = (b·r² + h²) / (a·r² + h²)
 * Отсюда h² = r²(c·a − b)/(1 − c), c = cos(∠S–S–S), и далее r и h через d.
 * Для d = 205,5 пм и ∠ = 108° получается r = 235,1 пм, h = 99,2 пм,
 * а двугранный угол короны — 98,8° (эксперимент 98,3°, Rettig & Trotter 1987).
 */
const CROWN = (() => {
  const q = Math.cos(Math.PI / 4)
  const a = 1 - 2 * q + 2 * q * q
  const b = -2 * q * (1 - q)
  const c = Math.cos((RING_ANGLE_DEG * Math.PI) / 180)
  const hOverR2 = (c * a - b) / (1 - c)
  const rPm = D_SS / Math.sqrt(a + hOverR2)
  const hPm = rPm * Math.sqrt(hOverR2)
  return { rPm, hPm, r: pmToScene(rPm), h: pmToScene(hPm) }
})()

/** Наклон короны к плоскости экрана, рад: при 0 видна «в торец» и корона не читается. */
const CROWN_TILT = 1.0

const CROWN_CENTER: readonly [number, number, number] = [-1.14, 0.03, -0.06]
/** Центр реакции: здесь собирается молекула SO₂. */
const CENTER: readonly [number, number, number] = [0, 0.06, 0]

const RADIUS = {
  S: speciesRadius('S'),
  O: speciesRadius('O'),
  H: speciesRadius('H'),
  C: speciesRadius('C'),
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Действующие лица
// ─────────────────────────────────────────────────────────────────────────────

export type So2AtomId =
  | 's0' | 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7'
  | 'oa' | 'ob' | 'oc'
  | 'w1o' | 'w1a' | 'w1b'
  | 'w2o' | 'w2a' | 'w2b'
  | 'cc' | 'cq' | 'cr'

export type So2AtomDef = { id: So2AtomId; el: ElementSymbol }

export const SO2_ATOMS: readonly So2AtomDef[] = [
  { id: 's0', el: 'S' },
  { id: 's1', el: 'S' },
  { id: 's2', el: 'S' },
  { id: 's3', el: 'S' },
  { id: 's4', el: 'S' },
  { id: 's5', el: 'S' },
  { id: 's6', el: 'S' },
  { id: 's7', el: 'S' },
  { id: 'oa', el: 'O' },
  { id: 'ob', el: 'O' },
  { id: 'oc', el: 'O' },
  { id: 'w1o', el: 'O' },
  { id: 'w1a', el: 'H' },
  { id: 'w1b', el: 'H' },
  { id: 'w2o', el: 'O' },
  { id: 'w2a', el: 'H' },
  { id: 'w2b', el: 'H' },
  { id: 'cc', el: 'C' },
  { id: 'cq', el: 'O' },
  { id: 'cr', el: 'O' },
]

/** Кольцо S₈: восемь связей S–S по кругу (k → k+1, последняя замыкает корону). */
export const RING_BONDS: readonly (readonly [So2AtomId, So2AtomId])[] = [
  ['s0', 's1'], ['s1', 's2'], ['s2', 's3'], ['s3', 's4'],
  ['s4', 's5'], ['s5', 's6'], ['s6', 's7'], ['s7', 's0'],
]

/** Связи O–H двух молекул воды (шаг «свойства»). */
export const WATER_BONDS: readonly (readonly [So2AtomId, So2AtomId])[] = [
  ['w1o', 'w1a'], ['w1o', 'w1b'], ['w2o', 'w2a'], ['w2o', 'w2b'],
]

export const SO2_RIG_SCALE = 1.1

// ─────────────────────────────────────────────────────────────────────────────
// 3. Мизансцена: ключевые позиции
// ─────────────────────────────────────────────────────────────────────────────

type P3 = readonly [number, number, number]

function add(c: P3, dx: number, dy: number, dz: number): P3 {
  return [c[0] + dx, c[1] + dy, c[2] + dz]
}

/**
 * Лиганд на расстоянии `d` от центра `c`, под углом `degFromY` от оси +Y
 * (положительный угол — вправо). Так задаются и SO₂, и SO₃, и вода.
 */
function ligand(c: P3, d: number, degFromY: number, dz = 0): P3 {
  const a = (degFromY * Math.PI) / 180
  return [c[0] + d * Math.sin(a), c[1] + d * Math.cos(a), c[2] + dz]
}

/** Атом короны с индексом k, наклонённой на CROWN_TILT вокруг оси X. */
function crownAtom(k: number): P3 {
  const th = (k * Math.PI) / 4
  const x = CROWN.r * Math.cos(th)
  const y0 = CROWN.r * Math.sin(th)
  const z0 = (k % 2 === 0 ? 1 : -1) * (CROWN.h / 2)
  const cs = Math.cos(CROWN_TILT)
  const sn = Math.sin(CROWN_TILT)
  return [CROWN_CENTER[0] + x, CROWN_CENTER[1] + y0 * cs - z0 * sn, CROWN_CENTER[2] + y0 * sn + z0 * cs]
}

const CROWN_POS: readonly P3[] = [0, 1, 2, 3, 4, 5, 6, 7].map(crownAtom)

/** Молекула O₂ в начале: справа, слегка наклонена. */
const O2_START: P3 = [1.24, 0.31, 0.02]
/** Куда O₂ подлетает перед разрывом. */
const O2_DOCK: P3 = [0.72, 0.30, 0]
const O2_AXIS_DEG = -70 // ось молекулы от +Y, «верх-влево»

function o2Atom(center: P3, sign: 1 | -1): P3 {
  return ligand(center, (sign * R_OO) / 2, O2_AXIS_DEG)
}

/** Уголковая SO₂ (119,5°) и промежуточная «широкая» форма (150°) до изгиба. */
const SO2_LEFT = ligand(CENTER, R_SO, -ANG_SO2 / 2)
const SO2_RIGHT = ligand(CENTER, R_SO, ANG_SO2 / 2)
const WIDE_LEFT = ligand(CENTER, R_SO, -75)
const WIDE_RIGHT = ligand(CENTER, R_SO, 75)
/** Плоская тригональная SO₃ (120°, 142,0 пм): третий кислород встаёт на место пары. */
const SO3_LEFT = ligand(CENTER, R_SO3, -ANG_SO3 / 2)
const SO3_RIGHT = ligand(CENTER, R_SO3, ANG_SO3 / 2)
const SO3_DOWN = ligand(CENTER, R_SO3, 180)

const OC_PARK: P3 = [0, -1.28, 0.3]

/** Молекулы воды: центр (атом O) и два H под углом H–O–H, «спиной» к сере. */
const W1_FAR: P3 = [-1.46, 0.64, 0.26]
const W1_DOCK: P3 = [-0.66, 0.54, 0.2]
const W2_FAR: P3 = [1.52, -0.58, -0.32]
const W2_DOCK: P3 = [0.64, -0.44, -0.24]

/** Направление «от серы» в градусах от +Y для данного положения молекулы воды. */
function waterAwayDeg(o: P3): number {
  const dx = o[0] - CENTER[0]
  const dy = o[1] - CENTER[1]
  return (Math.atan2(dx, dy) * 180) / Math.PI
}

function waterH(o: P3, sign: 1 | -1): P3 {
  return ligand(o, R_OH, waterAwayDeg(o) + (sign * ANG_H2O) / 2)
}

/**
 * Призрак CO₂ для сравнения: линейная молекула, 180°.
 * Он ПОДПИСАН («CO₂: O–C–O 180°») и разобран в тексте шага «Вторая связь и угол»:
 * у углерода три электронные группы превращаются в две, неподелённых пар нет —
 * отсюда 180° против 119,5° у SO₂. Показывается ровно столько, сколько висит
 * подпись, — неподписанных тел в кадре быть не должно.
 */
const CO2_CENTER: P3 = [0, 0.94, -0.26]
const CO2_LEFT = ligand(CO2_CENTER, R_CO, -90)
const CO2_RIGHT = ligand(CO2_CENTER, R_CO, 90)

// ─────────────────────────────────────────────────────────────────────────────
// 4. Дорожки позиций
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  ringOpen: so2CueAt('ringOpen'),
  sFree: so2CueAt('sFree'),
  o2Break: so2CueAt('o2Break'),
  bond1: so2CueAt('bond1'),
  bond2: so2CueAt('bond2'),
  bent: so2CueAt('bent'),
  resonance: so2CueAt('resonance'),
  acidRain: so2CueAt('acidRain'),
  so3: so2CueAt('so3'),
  exo: so2CueAt('exo'),
} as const

/** s0 — тот самый атом серы, который уйдёт из кольца и станет центром SO₂. */
const POS_S0: Vec3Track = [
  { t: 0, v: CROWN_POS[0]! },
  { t: T.ringOpen, v: add(CROWN_POS[0]!, 0.05, 0.03, 0.02), ease: 'smooth' },
  { t: T.sFree, v: add(CROWN_POS[0]!, 0.15, 0.06, 0.04), ease: 'smooth' },
  { t: 9.6, v: CENTER, ease: 'smooth', arc: 0.12 },
]

const POS_OA: Vec3Track = [
  { t: 0, v: o2Atom(O2_START, 1) },
  { t: 4.2, v: o2Atom([1.16, 0.31, 0.02], 1), ease: 'smooth' },
  { t: 9.6, v: o2Atom(O2_DOCK, 1), ease: 'smooth' },
  { t: T.o2Break, v: o2Atom(O2_DOCK, 1) },
  // обходит серу сверху, а не сквозь неё
  { t: 10.6, v: [0.1, 0.6, 0.07], ease: 'smooth' },
  { t: T.bond1, v: WIDE_LEFT, ease: 'smooth' },
  { t: T.bent, v: SO2_LEFT, ease: 'smooth' },
  { t: T.so3, v: SO3_LEFT, ease: 'smooth' },
  { t: 22.2, v: SO2_LEFT, ease: 'smooth' },
]

const POS_OB: Vec3Track = [
  { t: 0, v: o2Atom(O2_START, -1) },
  { t: 4.2, v: o2Atom([1.16, 0.31, 0.02], -1), ease: 'smooth' },
  { t: 9.6, v: o2Atom(O2_DOCK, -1), ease: 'smooth' },
  { t: T.o2Break, v: o2Atom(O2_DOCK, -1) },
  { t: 12.4, v: [1.02, -0.4, 0.12], ease: 'smooth' },
  { t: T.bond2, v: WIDE_RIGHT, ease: 'smooth' },
  { t: T.bent, v: SO2_RIGHT, ease: 'smooth' },
  { t: T.so3, v: SO3_RIGHT, ease: 'smooth' },
  { t: 22.2, v: SO2_RIGHT, ease: 'smooth' },
]

/** Третий кислород — только на кадре «2 SO₂ + O₂ ⇌ 2 SO₃», потом уходит обратно. */
const POS_OC: Vec3Track = [
  { t: 0, v: OC_PARK },
  { t: 19.6, v: OC_PARK },
  { t: T.so3, v: SO3_DOWN, ease: 'smooth' },
  { t: 21.9, v: SO3_DOWN },
  { t: 22.6, v: OC_PARK, ease: 'smooth' },
]

function waterTrack(far: P3, dock: P3, part: 'o' | 'a' | 'b'): Vec3Track {
  const at = (p: P3): P3 => (part === 'o' ? p : waterH(p, part === 'a' ? 1 : -1))
  return [
    { t: 0, v: at(far) },
    { t: 17.2, v: at(far) },
    { t: T.acidRain, v: at(dock), ease: 'smooth' },
    { t: 19.5, v: at(dock) },
    { t: 20.4, v: at(far), ease: 'smooth' },
  ]
}

const POS: Record<So2AtomId, Vec3Track> = {
  s0: POS_S0,
  s1: [{ t: 0, v: CROWN_POS[1]! }],
  s2: [{ t: 0, v: CROWN_POS[2]! }],
  s3: [{ t: 0, v: CROWN_POS[3]! }],
  s4: [{ t: 0, v: CROWN_POS[4]! }],
  s5: [{ t: 0, v: CROWN_POS[5]! }],
  s6: [{ t: 0, v: CROWN_POS[6]! }],
  s7: [{ t: 0, v: CROWN_POS[7]! }],
  oa: POS_OA,
  ob: POS_OB,
  oc: POS_OC,
  w1o: waterTrack(W1_FAR, W1_DOCK, 'o'),
  w1a: waterTrack(W1_FAR, W1_DOCK, 'a'),
  w1b: waterTrack(W1_FAR, W1_DOCK, 'b'),
  w2o: waterTrack(W2_FAR, W2_DOCK, 'o'),
  w2a: waterTrack(W2_FAR, W2_DOCK, 'a'),
  w2b: waterTrack(W2_FAR, W2_DOCK, 'b'),
  cc: [{ t: 0, v: CO2_CENTER }],
  cq: [{ t: 0, v: CO2_LEFT }],
  cr: [{ t: 0, v: CO2_RIGHT }],
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Дорожки прозрачности, связей и эффектов
// ─────────────────────────────────────────────────────────────────────────────

/** Остаток короны (s1…s7) уходит из кадра после того, как сера освободилась. */
const CROWN_FADE: ScalarTrack = [
  { t: 0, v: 1 },
  { t: 8.4, v: 1 },
  { t: 10.4, v: 0, ease: 'smooth' },
]

/**
 * ПРАВИЛО ПОДПИСАННОГО ТЕЛА. Вспомогательные частицы — две молекулы воды,
 * третий кислород и призрак CO₂ — появляются и исчезают СТРОГО внутри окна
 * своей подписи (labels «acid», «so3eq», «co2»). Иначе ученик на долю секунды
 * видит в кадре тело, которое никак не названо. Проверяется тестом сцены.
 */
const WATER_FADE: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 18.05, v: 0 },
  { t: 18.5, v: 1, ease: 'smooth' },
  { t: 19.4, v: 1 },
  { t: 19.75, v: 0, ease: 'smooth' },
]

const CO2_FADE: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 14.3, v: 0 },
  { t: 14.9, v: 0.55, ease: 'smooth' },
  { t: 16.6, v: 0.55 },
  { t: 17.1, v: 0, ease: 'smooth' },
]

const OC_FADE: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 20.3, v: 0 },
  { t: 20.8, v: 1, ease: 'smooth' },
  { t: 21.8, v: 1 },
  { t: 22.15, v: 0, ease: 'smooth' },
]

/** Связь S0–S1: рвётся первой (кольцо раскрывается). */
const RING0_OP: ScalarTrack = [
  { t: 0, v: 1 },
  { t: 4.9, v: 1 },
  { t: T.ringOpen + 0.15, v: 0, ease: 'smooth' },
]
const RING0_STRESS: ScalarTrack = rampTrack(4.2, 0, T.ringOpen, 1, 'inOutSine')
const RING0_THIN: ScalarTrack = rampTrack(4.8, 0, T.ringOpen + 0.15, 1, 'smooth')

/** Связь S7–S0: рвётся второй, и атом серы уходит. */
const RING7_OP: ScalarTrack = [
  { t: 0, v: 1 },
  { t: 7.1, v: 1 },
  { t: T.sFree + 0.15, v: 0, ease: 'smooth' },
]
const RING7_STRESS: ScalarTrack = rampTrack(6.2, 0, T.sFree, 1, 'inOutSine')
const RING7_THIN: ScalarTrack = rampTrack(7, 0, T.sFree + 0.15, 1, 'smooth')

/** Связь O=O: гомолитический разрыв (split = 0 — пара делится поровну). */
const OO_OP: ScalarTrack = [
  { t: 0, v: 1 },
  { t: 9.7, v: 1 },
  { t: T.o2Break + 0.2, v: 0, ease: 'smooth' },
]
const OO_STRESS: ScalarTrack = rampTrack(8.8, 0, T.o2Break, 1, 'inOutSine')
const OO_THIN: ScalarTrack = rampTrack(9.4, 0, T.o2Break + 0.2, 1, 'smooth')

const SOA_OP: ScalarTrack = rampTrack(T.bond1 - 0.25, 0, T.bond1 + 0.2, 1, 'smooth')
const SOB_OP: ScalarTrack = rampTrack(T.bond2 - 0.25, 0, T.bond2 + 0.2, 1, 'smooth')
const SOC_OP: ScalarTrack = [
  { t: 0, v: 0 },
  { t: T.so3 - 0.25, v: 0 },
  { t: T.so3 + 0.2, v: 1, ease: 'smooth' },
  { t: 21.9, v: 1 },
  { t: 22.4, v: 0, ease: 'smooth' },
]

/**
 * ПОРЯДОК СВЯЗИ S–O. Школьная формула — O=S=O (порядок 2), но обе связи в SO₂
 * одинаковы (143,1 пм) и π-плотность делокализована на три центра: настоящий
 * порядок ≈ 1,5. На кадре «резонанс» порядок плавно переходит 2 → 1,5,
 * и одновременно зажигается π-облако (см. поле `pi` кадра).
 */
const SO_ORDER: ScalarTrack = [
  { t: 0, v: 2 },
  { t: T.resonance - 0.3, v: 2 },
  { t: T.resonance + 0.5, v: 1.5, ease: 'smooth' },
]

const SOA_FORM: ScalarTrack = appearTrack(T.bond1, 0.6)
const SOB_FORM: ScalarTrack = appearTrack(T.bond2, 0.6)

/** Валентная оболочка серы: видна, пока идёт обобществление электронов. */
const SHELL_S: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 9.8, v: 0 },
  { t: 10.6, v: 1, ease: 'smooth' },
  { t: 15, v: 1 },
  { t: 15.8, v: 0, ease: 'smooth' },
]

/** Неподелённая пара серы: появляется к изгибу, уступает место кислороду в SO₃. */
const LONE_PAIR: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 14.6, v: 0 },
  { t: T.bent, v: 1, ease: 'smooth' },
  { t: 20.2, v: 1 },
  { t: T.so3, v: 0, ease: 'smooth' },
  { t: 22.2, v: 0 },
  { t: 22.9, v: 1, ease: 'smooth' },
]

/** Делокализованное π-облако над и под плоскостью молекулы. */
const PI_CLOUD: ScalarTrack = [
  { t: 0, v: 0 },
  { t: T.resonance - 0.4, v: 0 },
  { t: T.resonance + 0.6, v: 1, ease: 'smooth' },
]

/** Синее пламя горящей серы: знакомство с веществом на первом шаге. */
const FLAME: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 1.1, v: 0 },
  { t: 2.4, v: 1, ease: 'smooth' },
  { t: 3.4, v: 0.75 },
  { t: 4.6, v: 0, ease: 'smooth' },
]

/** Выделение энергии: каждая связь греет, итоговая вспышка — на шаге энергии. */
const EXO: ScalarTrack = [
  { t: 0, v: 0 },
  { t: T.bond1 - 0.2, v: 0 },
  { t: T.bond1 + 0.35, v: 0.5, ease: 'smooth' },
  { t: 13.4, v: 0.16, ease: 'smooth' },
  { t: T.bond2 + 0.35, v: 0.72, ease: 'smooth' },
  { t: 16.6, v: 0.2, ease: 'smooth' },
  { t: 22.6, v: 0.2 },
  { t: T.exo, v: 1, ease: 'smooth' },
  { t: 25.6, v: 0.55, ease: 'smooth' },
]

/** Голубая «вода» вокруг молекулы на кадре растворения. */
const SOLVATION: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 17.8, v: 0 },
  { t: T.acidRain, v: 1, ease: 'smooth' },
  { t: 19.6, v: 1 },
  { t: 20.4, v: 0, ease: 'smooth' },
]

/** Значок катализатора V₂O₅ на кадре окисления до SO₃. */
const CATALYST: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 20, v: 0 },
  { t: T.so3, v: 1, ease: 'smooth' },
  { t: 21.9, v: 1 },
  { t: 22.5, v: 0, ease: 'smooth' },
]

const FADE = fadeTrack(SO2_FINISH)

// ─────────────────────────────────────────────────────────────────────────────
// 6. Камера
// ─────────────────────────────────────────────────────────────────────────────

const ZOOM: ScalarTrack = [
  { t: 0, v: 1.18 },
  { t: 4.2, v: 1.28 },
  { t: 8.2, v: 1.5 },
  { t: 12.8, v: 1.62, ease: 'smooth' },
  { t: 17.2, v: 1.54, ease: 'smooth' },
  { t: 22.6, v: 1.56, ease: 'smooth' },
  { t: 26, v: 1.46, ease: 'smooth' },
]

const CAM_OFFSET: Vec3Track = [
  { t: 0, v: [-0.1, 0, 0] },
  { t: 5.4, v: [-0.48, 0.02, 0], ease: 'smooth' },
  { t: 9.2, v: [0.04, 0.03, 0], ease: 'smooth' },
  { t: 12.8, v: [0, 0.07, 0], ease: 'smooth' },
  { t: 17.2, v: [0, 0.1, 0], ease: 'smooth' },
  { t: 22.6, v: [0, 0.05, 0], ease: 'smooth' },
]

const YAW: ScalarTrack = [
  { t: 0, v: -0.06 },
  { t: 4.2, v: 0.15, ease: 'smooth' },
  { t: 8.2, v: -0.05, ease: 'smooth' },
  { t: 12.8, v: 0.05, ease: 'smooth' },
  { t: 16.4, v: -0.1, ease: 'smooth' },
  { t: 19.8, v: 0.2, ease: 'smooth' },
  { t: 22.6, v: 0, ease: 'smooth' },
  { t: 26, v: 0.07, ease: 'smooth' },
]

const ROLL: ScalarTrack = [
  { t: 0, v: 0.015 },
  { t: 9.6, v: -0.012, ease: 'smooth' },
  { t: 17.2, v: 0.01, ease: 'smooth' },
  { t: 26, v: 0, ease: 'smooth' },
]

const SHAKE: ScalarTrack = [
  { t: 0, v: 0 },
  { t: T.o2Break - 0.1, v: 0 },
  { t: T.o2Break + 0.1, v: 0.5, ease: 'smooth' },
  { t: T.o2Break + 0.8, v: 0, ease: 'smooth' },
  { t: T.exo - 0.1, v: 0 },
  { t: T.exo + 0.12, v: 0.7, ease: 'smooth' },
  { t: T.exo + 1, v: 0, ease: 'smooth' },
]

const BLOOM: ScalarTrack = [
  { t: 0, v: 0.3 },
  { t: T.bond2, v: 0.42, ease: 'smooth' },
  { t: T.exo, v: 0.6, ease: 'smooth' },
  { t: 26, v: 0.4, ease: 'smooth' },
]

const VIGNETTE: ScalarTrack = [
  { t: 0, v: 0.3 },
  { t: 12.8, v: 0.36, ease: 'smooth' },
  { t: 26, v: 0.44, ease: 'smooth' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 7. Подписи в 3D (только формулы и СИ; слова — в текстах урока)
// ─────────────────────────────────────────────────────────────────────────────

const SO2_LABELS: readonly SceneLabelDef[] = [
  { id: 's8', kind: 'species', dy: 0.86, keys: [{ t: 0, text: 'S₈ ({s})' }], windows: [[0.5, 5]] },
  { id: 'ss', kind: 'delta', dy: -0.98, keys: [{ t: 0, text: `S–S ${Math.round(D_SS)} {pm}` }], windows: [[1.4, 5]] },
  { id: 'o2', kind: 'species', dy: 0.42, keys: [{ t: 0, text: 'O₂ ({g})' }], windows: [[0.6, 9.4]] },
  { id: 'oo', kind: 'delta', dy: -0.42, keys: [{ t: 0, text: `O=O ${Math.round(bondLengthPm('O=O'))} {pm}` }], windows: [[1.8, 8]] },
  // Подпись намеренно начинается с «⅛ S₈»: +277 кДж/моль — СРЕДНЯЯ атомизация
  // (одна связь S–S на вынесенный атом), а не цена двух связей первого атома.
  {
    id: 'atomize',
    kind: 'delta',
    dy: 0.54,
    keys: [{ t: 0, text: '⅛ S₈ → S ({g})' }, { t: T.sFree, text: '⅛ S₈ → S ({g})   +277 {kJmol}' }],
    windows: [[6, 9.4]],
  },
  {
    id: 'dissoc',
    kind: 'delta',
    dy: 0.52,
    keys: [{ t: 0, text: 'O₂ → 2 O ({g})   +498 {kJmol}' }],
    windows: [[9.9, 11.6]],
  },
  { id: 'so', kind: 'delta', dy: 0.38, keys: [{ t: 0, text: `S=O ${Math.round(D_SO_PM)} {pm}` }], windows: [[11.8, 15.4]] },
  { id: 'lone', kind: 'ox', dy: -0.34, keys: [{ t: 0, text: '2e⁻' }], windows: [[15, 20.2]] },
  { id: 'angle', kind: 'delta', dy: -0.88, keys: [{ t: 0, text: `O–S–O ${ANG_SO2}°` }], windows: [[15.6, 19.2]] },
  {
    id: 'co2',
    kind: 'species',
    dy: 0.34,
    keys: [{ t: 0, text: `CO₂: O–C–O ${bondAngleDeg('carbonDioxide')}°` }],
    windows: [[14.2, 17.2]],
  },
  { id: 'dipole', kind: 'delta', dy: 0.38, keys: [{ t: 0, text: 'μ = 1.63 D' }], windows: [[16.6, 19.2]] },
  { id: 'acid', kind: 'species', dy: 0.9, keys: [{ t: 0, text: 'SO₂ + H₂O ⇌ H₂SO₃' }], windows: [[18, 19.8]] },
  { id: 'so3eq', kind: 'species', dy: 0.9, keys: [{ t: 0, text: '2 SO₂ + O₂ ⇌ 2 SO₃ (V₂O₅)' }], windows: [[20.2, 22.2]] },
  { id: 'product', kind: 'species', dy: 0.64, keys: [{ t: 0, text: 'SO₂ ({g})' }], windows: [[22.8, 26.4]] },
  { id: 'dhf', kind: 'delta', dy: -0.64, keys: [{ t: 0, text: 'ΔH°f = −297 {kJmol}' }], windows: [[23.2, 26.4]] },
]

export { SO2_LABELS }

// ─────────────────────────────────────────────────────────────────────────────
// 8. Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type So2Frame = {
  atoms: Record<So2AtomId, THREE.Vector3>
  radius: Record<So2AtomId, number>
  opacity: Record<So2AtomId, number>
  emissive: Record<So2AtomId, number>
  /** прозрачность / натяжение / истончение восьми связей кольца */
  ring: { opacity: number[]; stress: number[]; thinning: number[] }
  oo: { opacity: number; stress: number; thinning: number }
  so: { a: number; b: number; c: number; order: number; formA: number; formB: number }
  waterBond: number
  co2Bond: number
  shellS: number
  lonePair: number
  pi: number
  flame: number
  exo: number
  solvation: number
  catalyst: number
  fade: number
  electrons: ElectronJump[]
  center: THREE.Vector3
  crownCenter: THREE.Vector3
  o2Mid: THREE.Vector3
  labels: SceneLabelState[]
  camera: {
    zoom: number
    offset: THREE.Vector3
    yaw: number
    roll: number
    shake: number
    bloom: number
    vignette: number
  }
}

const ELEMENT_OF = new Map<So2AtomId, ElementSymbol>(SO2_ATOMS.map((a) => [a.id, a.el]))

export function createSo2Frame(): So2Frame {
  const atoms = {} as Record<So2AtomId, THREE.Vector3>
  const radius = {} as Record<So2AtomId, number>
  const opacity = {} as Record<So2AtomId, number>
  const emissive = {} as Record<So2AtomId, number>
  for (const a of SO2_ATOMS) {
    atoms[a.id] = new THREE.Vector3()
    radius[a.id] = RADIUS[a.el as keyof typeof RADIUS] ?? speciesRadius(a.el)
    opacity[a.id] = 1
    emissive[a.id] = 0.08
  }
  return {
    atoms,
    radius,
    opacity,
    emissive,
    ring: { opacity: new Array<number>(8).fill(1), stress: new Array<number>(8).fill(0), thinning: new Array<number>(8).fill(0) },
    oo: { opacity: 1, stress: 0, thinning: 0 },
    so: { a: 0, b: 0, c: 0, order: 2, formA: 0, formB: 0 },
    waterBond: 0,
    co2Bond: 0,
    shellS: 0,
    lonePair: 0,
    pi: 0,
    flame: 0,
    exo: 0,
    solvation: 0,
    catalyst: 0,
    fade: 0,
    electrons: [createElectronJump('e-s'), createElectronJump('e-o')],
    center: new THREE.Vector3(),
    crownCenter: new THREE.Vector3(),
    o2Mid: new THREE.Vector3(),
    labels: createLabelStates(SO2_LABELS),
    camera: {
      zoom: 1,
      offset: new THREE.Vector3(),
      yaw: 0,
      roll: 0,
      shake: 0,
      bloom: 0.3,
      vignette: 0.3,
    },
  }
}

const CROWN_IDS: readonly So2AtomId[] = ['s1', 's2', 's3', 's4', 's5', 's6', 's7']
const WATER_IDS: readonly So2AtomId[] = ['w1o', 'w1a', 'w1b', 'w2o', 'w2a', 'w2b']
const CO2_IDS: readonly So2AtomId[] = ['cc', 'cq', 'cr']

export function sampleSo2Frame(t: number, frame: So2Frame): So2Frame {
  for (const a of SO2_ATOMS) sampleVec3(POS[a.id], t, frame.atoms[a.id])

  const crown = sampleScalar(CROWN_FADE, t)
  const water = sampleScalar(WATER_FADE, t)
  const co2 = sampleScalar(CO2_FADE, t)
  const ocFade = sampleScalar(OC_FADE, t)
  frame.fade = sampleScalar(FADE, t)

  for (const a of SO2_ATOMS) frame.opacity[a.id] = 1
  for (const id of CROWN_IDS) frame.opacity[id] = crown
  for (const id of WATER_IDS) frame.opacity[id] = water
  for (const id of CO2_IDS) frame.opacity[id] = co2
  frame.opacity.oc = ocFade

  frame.flame = sampleScalar(FLAME, t)
  frame.exo = sampleScalar(EXO, t)
  frame.solvation = sampleScalar(SOLVATION, t)
  frame.catalyst = sampleScalar(CATALYST, t)
  frame.shellS = sampleScalar(SHELL_S, t)
  frame.lonePair = sampleScalar(LONE_PAIR, t)
  frame.pi = sampleScalar(PI_CLOUD, t)

  // Сера светится, когда горит и когда связи отдают энергию.
  const hot = Math.max(frame.flame * 0.5, frame.exo * 0.55)
  for (const a of SO2_ATOMS) frame.emissive[a.id] = 0.08
  frame.emissive.s0 = 0.1 + hot
  for (const id of CROWN_IDS) frame.emissive[id] = 0.08 + frame.flame * 0.45
  frame.emissive.oa = 0.08 + frame.exo * 0.35
  frame.emissive.ob = 0.08 + frame.exo * 0.35

  // Связи кольца.
  const r0 = sampleScalar(RING0_OP, t)
  const r7 = sampleScalar(RING7_OP, t)
  for (let k = 0; k < 8; k++) {
    frame.ring.opacity[k] = crown
    frame.ring.stress[k] = 0
    frame.ring.thinning[k] = 0
  }
  // Связь 0 — S0–S1, связь 7 — S7–S0: остальные держат прозрачность короны,
  // но гаснут и они, когда s0 улетает (иначе «резинка» тянулась бы через экран).
  frame.ring.opacity[0] = crown * r0
  frame.ring.stress[0] = sampleScalar(RING0_STRESS, t) * r0
  frame.ring.thinning[0] = sampleScalar(RING0_THIN, t)
  frame.ring.opacity[7] = crown * r7
  frame.ring.stress[7] = sampleScalar(RING7_STRESS, t) * r7
  frame.ring.thinning[7] = sampleScalar(RING7_THIN, t)

  frame.oo.opacity = sampleScalar(OO_OP, t)
  frame.oo.stress = sampleScalar(OO_STRESS, t) * frame.oo.opacity
  frame.oo.thinning = sampleScalar(OO_THIN, t)

  frame.so.a = sampleScalar(SOA_OP, t)
  frame.so.b = sampleScalar(SOB_OP, t)
  frame.so.c = sampleScalar(SOC_OP, t)
  frame.so.order = sampleScalar(SO_ORDER, t)
  frame.so.formA = sampleScalar(SOA_FORM, t)
  frame.so.formB = sampleScalar(SOB_FORM, t)

  frame.waterBond = water
  frame.co2Bond = co2

  frame.center.copy(frame.atoms.s0)
  frame.crownCenter.set(CROWN_CENTER[0], CROWN_CENTER[1], CROWN_CENTER[2])
  frame.o2Mid.copy(frame.atoms.oa).lerp(frame.atoms.ob, 0.5)

  frame.camera.zoom = sampleScalar(ZOOM, t)
  sampleVec3(CAM_OFFSET, t, frame.camera.offset)
  frame.camera.yaw = sampleScalar(YAW, t)
  frame.camera.roll = sampleScalar(ROLL, t)
  frame.camera.shake = sampleScalar(SHAKE, t)
  frame.camera.bloom = sampleScalar(BLOOM, t)
  frame.camera.vignette = sampleScalar(VIGNETTE, t)

  sampleLabels(SO2_LABELS, frame.labels, t, anchorLabel(frame), frame.fade)
  return frame
}

function anchorLabel(frame: So2Frame) {
  return (def: SceneLabelDef, st: SceneLabelState): void => {
    switch (def.id) {
      case 's8':
      case 'ss':
        st.pos.copy(frame.crownCenter)
        break
      case 'o2':
      case 'oo':
      case 'dissoc':
        st.pos.copy(frame.o2Mid)
        break
      case 'atomize':
        st.pos.copy(frame.atoms.s0)
        break
      case 'so':
        st.pos.copy(frame.atoms.oa)
        break
      case 'dipole':
        st.pos.copy(frame.atoms.ob)
        break
      case 'co2':
        st.pos.copy(frame.atoms.cc)
        break
      default:
        st.pos.copy(frame.center)
        break
    }
    st.pos.y += def.dy
  }
}

/** Спецификация прыжка электрона на текущий момент: обобществление пары S···O. */
export function so2ElectronSpec(t: number): {
  donor: So2AtomId
  acceptor: So2AtomId
  leave: number
  arrive: number
} {
  if (t < 12.2) return { donor: 's0', acceptor: 'oa', leave: T.bond1 - 0.75, arrive: T.bond1 }
  return { donor: 's0', acceptor: 'ob', leave: T.bond2 - 0.75, arrive: T.bond2 }
}

export const SO2_GEOM = {
  crownRadiusPm: CROWN.rPm,
  crownHeightPm: CROWN.hPm,
  crownRadius: CROWN.r,
  ringBond: R_SS,
  shellS: RADIUS.S * 1.85,
  lonePairDistance: R_SO3 * 0.72,
  piRadius: R_SO * 0.62,
  bondSO: R_SO,
  bondSO3: R_SO3,
  center: CENTER,
  crownCenter: CROWN_CENTER,
} as const

export { SO2_TIMING }
export type { So2CueId, So2StepId }

// ─────────────────────────────────────────────────────────────────────────────
// 9. Проверки (зовут тест сцены и dev-режим)
// ─────────────────────────────────────────────────────────────────────────────

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()

function dist(p: P3, q: P3): number {
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

function angleDeg(a: P3, centre: P3, b: P3): number {
  _a.set(a[0] - centre[0], a[1] - centre[1], a[2] - centre[2])
  _b.set(b[0] - centre[0], b[1] - centre[1], b[2] - centre[2])
  return (_a.angleTo(_b) * 180) / Math.PI
}

/** Двугранный угол A–B–C–D в градусах — для проверки короны S₈. */
function dihedralDeg(a: P3, b: P3, c: P3, d: P3): number {
  const v1 = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const v2 = new THREE.Vector3(c[0] - b[0], c[1] - b[1], c[2] - b[2])
  const v3 = new THREE.Vector3(d[0] - c[0], d[1] - c[1], d[2] - c[2])
  const n1 = _a.copy(v1).cross(v2)
  const n2 = _b.copy(v2).cross(v3)
  const m = _c.copy(n1).cross(v2.clone().normalize())
  const x = n1.dot(n2)
  const y = m.dot(n2)
  return Math.abs((Math.atan2(y, x) * 180) / Math.PI)
}

export function validateSo2Storyboard(): void {
  SO2_TIMING.validate()
  validateTracks({
    ...POS,
    CROWN_FADE,
    WATER_FADE,
    CO2_FADE,
    OC_FADE,
    RING0_OP,
    RING0_STRESS,
    RING0_THIN,
    RING7_OP,
    RING7_STRESS,
    RING7_THIN,
    OO_OP,
    OO_STRESS,
    OO_THIN,
    SOA_OP,
    SOB_OP,
    SOC_OP,
    SO_ORDER,
    SOA_FORM,
    SOB_FORM,
    SHELL_S,
    LONE_PAIR,
    PI_CLOUD,
    FLAME,
    EXO,
    SOLVATION,
    CATALYST,
    FADE,
    ZOOM,
    CAM_OFFSET,
    YAW,
    ROLL,
    SHAKE,
    BLOOM,
    VIGNETTE,
  })

  // ── Корона S₈: длины, углы и двугранный угол ────────────────────────────
  const dPm = (a: P3, b: P3) => (dist(a, b) / pmToScene(1))
  for (let k = 0; k < 8; k++) {
    const d = dPm(CROWN_POS[k]!, CROWN_POS[(k + 1) % 8]!)
    if (Math.abs(d - D_SS) > 0.2) {
      throw new Error(`[so2] связь S${k}–S${(k + 1) % 8} = ${d.toFixed(1)} пм, справочник ${D_SS}`)
    }
    const ang = angleDeg(CROWN_POS[(k + 7) % 8]!, CROWN_POS[k]!, CROWN_POS[(k + 1) % 8]!)
    if (Math.abs(ang - RING_ANGLE_DEG) > 0.3) {
      throw new Error(`[so2] ∠S–S–S при S${k} = ${ang.toFixed(1)}°, справочник ${RING_ANGLE_DEG}°`)
    }
  }
  const dih = dihedralDeg(CROWN_POS[0]!, CROWN_POS[1]!, CROWN_POS[2]!, CROWN_POS[3]!)
  if (dih < 96 || dih > 101) {
    throw new Error(`[so2] двугранный угол короны ${dih.toFixed(1)}° вне [96, 101] (эксперимент 98,3°)`)
  }

  // ── Молекула кислорода — ДВУХАТОМНАЯ, длина по справочнику ──────────────
  const dOO = dPm(o2Atom(O2_START, 1), o2Atom(O2_START, -1))
  if (Math.abs(dOO - bondLengthPm('O=O')) > 0.2) throw new Error(`[so2] d(O=O) = ${dOO.toFixed(1)} пм`)

  // ── SO₂: уголковая, обе связи одинаковы ─────────────────────────────────
  const dA = dPm(SO2_LEFT, CENTER)
  const dB = dPm(SO2_RIGHT, CENTER)
  if (Math.abs(dA - D_SO_PM) > 0.2 || Math.abs(dB - D_SO_PM) > 0.2) {
    throw new Error(`[so2] связи S=O ${dA.toFixed(1)} / ${dB.toFixed(1)} пм, справочник ${D_SO_PM}`)
  }
  if (Math.abs(dA - dB) > 0.01) throw new Error('[so2] обе связи S=O обязаны быть одинаковой длины (резонанс)')
  const angSO2 = angleDeg(SO2_LEFT, CENTER, SO2_RIGHT)
  if (Math.abs(angSO2 - ANG_SO2) > 0.2) throw new Error(`[so2] ∠O–S–O = ${angSO2.toFixed(1)}°, справочник ${ANG_SO2}°`)
  if (!(angSO2 < 180)) throw new Error('[so2] SO₂ уголковая, а не линейная')

  // ── SO₃: плоский правильный треугольник ─────────────────────────────────
  for (const [p, q] of [[SO3_LEFT, SO3_RIGHT], [SO3_RIGHT, SO3_DOWN], [SO3_DOWN, SO3_LEFT]] as const) {
    const ang = angleDeg(p, CENTER, q)
    if (Math.abs(ang - ANG_SO3) > 0.2) throw new Error(`[so2] SO₃: угол ${ang.toFixed(1)}°, ожидалось ${ANG_SO3}°`)
  }
  for (const p of [SO3_LEFT, SO3_RIGHT, SO3_DOWN]) {
    const d = dPm(p, CENTER)
    if (Math.abs(d - D_SO3_PM) > 0.2) throw new Error(`[so2] SO₃: связь ${d.toFixed(1)} пм, справочник ${D_SO3_PM}`)
  }

  // ── Вода: длина O–H и угол H–O–H ────────────────────────────────────────
  for (const o of [W1_FAR, W1_DOCK, W2_FAR, W2_DOCK]) {
    const ha = waterH(o, 1)
    const hb = waterH(o, -1)
    if (Math.abs(dPm(ha, o) - bondLengthPm('O-H')) > 0.2) throw new Error('[so2] вода: длина O–H не по справочнику')
    const ang = angleDeg(ha, o, hb)
    if (Math.abs(ang - ANG_H2O) > 0.2) throw new Error(`[so2] вода: ∠H–O–H = ${ang.toFixed(1)}°`)
  }

  // ── CO₂: линейная, для сравнения с SO₂ ──────────────────────────────────
  const angCO2 = angleDeg(CO2_LEFT, CO2_CENTER, CO2_RIGHT)
  if (Math.abs(angCO2 - bondAngleDeg('carbonDioxide')) > 0.2) throw new Error(`[so2] CO₂ обязан быть линейным, а не ${angCO2.toFixed(1)}°`)

  // ── Размеры: сера крупнее кислорода, кислород крупнее водорода ──────────
  if (!(RADIUS.S > RADIUS.O && RADIUS.O > RADIUS.H)) {
    throw new Error('[so2] радиусы обязаны идти S > O > H')
  }

  // ── Порядок связи: школьная O=S=O (2) → делокализация (1,5) ─────────────
  if (sampleScalar(SO_ORDER, T.bond2) !== 2) throw new Error('[so2] до резонанса порядок связи S–O обязан быть 2')
  if (Math.abs(sampleScalar(SO_ORDER, 18) - 1.5) > 1e-6) throw new Error('[so2] после резонанса порядок связи S–O обязан быть 1,5')

  // ── Неподелённая пара уступает место третьему кислороду в SO₃ ───────────
  if (sampleScalar(LONE_PAIR, T.so3) > 0.05) throw new Error('[so2] на кадре SO₃ неподелённой пары быть не должно')
  if (sampleScalar(LONE_PAIR, T.bent + 1) < 0.9) throw new Error('[so2] у SO₂ обязана быть видна неподелённая пара')
}

/** Для теста: позиции и прозрачности всех частиц на момент t (проверка «нет рывков»). */
export function so2Particles(t: number, frame: So2Frame): { id: string; pos: THREE.Vector3; opacity: number }[] {
  sampleSo2Frame(t, frame)
  return SO2_ATOMS.map((a) => ({ id: a.id, pos: frame.atoms[a.id], opacity: frame.opacity[a.id] }))
}

export { ELEMENT_OF }
