import * as THREE from 'three'
import { smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, windowFade, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { bondLength, pmToScene, speciesRadius } from '../kit/cpkAtoms'
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
import { HABER, NH3_CATALYST_CRYSTAL, NH3_GEOMETRY, NH3_REACTION_DH_KJ, NH3_DHF_KJ, NH3_DELTA_N, NN_BOND_KJ } from './nh3Energetics'
import { NH3_FINISH, NH3_END, nh3CueAt } from './nh3Steps'

export {
  NH3_CUES,
  NH3_END,
  NH3_FINISH,
  NH3_SEGMENTS,
  NH3_STEPS,
  NH3_STEP_IDS,
  NH3_TIMING,
  nh3StepIndexAt,
  type Nh3CueId,
  type Nh3StepId,
} from './nh3Steps'

/**
 * Раскадровка N₂ (г) + 3 H₂ (г) ⇌ 2 NH₃ (г) — ЧИСТАЯ функция времени сюжета.
 *
 * Вся химия — из src/chemistry/data (ни одного числа руками):
 *   • N₂: тройная связь, d = 109,77 пм, E = 945 кДж/моль — самая прочная связь урока;
 *   • H₂: d = 74,14 пм, E = 435,8 кДж/моль (bondData);
 *   • NH₃: d(N–H) = 101,2 пм, угол H–N–H = 106,7°, тригональная пирамида, μ = 1,47 Д;
 *   • радиусы ковалентные: N 71 пм, H 31 пм (ионов в этой реакции нет вообще);
 *   • катализатор — α-Fe: ОЦК, Im-3m (229), a = 286,65 пм, d(Fe–Fe) = 248,2 пм, КЧ 8.
 *
 * ЧТО НАРИСОВАНО СХЕМАТИЧНО (и так сказано в тексте урока):
 *   • π-облака тройной связи — две «банановые» дуги точек вокруг оси N–N: это
 *     ЗНАК двух π-связей, а не форма орбиталей;
 *   • неподелённая пара азота — две светящиеся точки: электроны не «стоят» в точке;
 *   • показан фрагмент поверхности железа из 18 атомов (два слоя), в зерне
 *     катализатора их порядка 10²⁰, и работает только поверхность;
 *   • реальный маршрут на поверхности содержит стадии N₂(адс) → 2 N(адс),
 *     H₂(адс) → 2 H(адс), N + H → NH → NH₂ → NH₃ → NH₃(г): показаны все,
 *     но атомы перемещаются по поверхности плавно, а на самом деле это
 *     дискретные перескоки между адсорбционными центрами;
 *   • две кривые активации нарисованы качественно: высота барьера без
 *     катализатора взята равной E(N≡N) = 945 кДж/моль — это ОЦЕНКА СНИЗУ
 *     (энтальпия диссоциации связи), а не измеренная Eₐ; барьер на железе —
 *     интервал 60…100 кДж/моль (кажущаяся Eₐ, см. nh3Energetics.ts).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

/** Ребро ОЦК-ячейки железа в мировых единицах. */
const A_FE = pmToScene(NH3_CATALYST_CRYSTAL.cellPm.a)
/** Длины связей. */
const D_NN = bondLength('N#N')
const D_HH = bondLength('H-H')
const D_NH = bondLength('N-H')

const R = {
  n: speciesRadius('N', 0),
  h: speciesRadius('H', 0),
  fe: speciesRadius('Fe', 0),
} as const

/**
 * Геометрия тригональной пирамиды NH₃ из ОДНОГО справочного угла.
 *
 * Если все три связи длины L, а угол H–N–H равен θ, то для угла β между связью
 * и осью C₃ выполняется cos θ = 1 − 1,5 · sin²β. Отсюда:
 *   sin β = √((1 − cos θ) / 1,5),  и связь раскладывается на
 *   радиальную составляющую L·sin β и осевую L·cos β.
 * Для θ = 106,7° получается β ≈ 67,9°: RAD ≈ 0,267, AX ≈ 0,109 мировых единиц.
 */
const COS_THETA = Math.cos((NH3_GEOMETRY.angleDeg * Math.PI) / 180)
const SIN_BETA = Math.sqrt((1 - COS_THETA) / 1.5)
const COS_BETA = Math.sqrt(Math.max(0, 1 - SIN_BETA * SIN_BETA))
/** Радиальный вынос атома H от оси C₃, мировые единицы. */
const PYR_RAD = D_NH * SIN_BETA
/** Смещение атома H вдоль оси C₃ (в сторону, противоположную неподелённой паре). */
const PYR_AX = D_NH * COS_BETA

export const NH3_GEOM = {
  radius: R,
  bond: { nn: D_NN, hh: D_HH, nh: D_NH },
  pyramid: { radial: PYR_RAD, axial: PYR_AX, betaDeg: (Math.asin(SIN_BETA) * 180) / Math.PI },
  cellFe: A_FE,
  data: {
    nnPm: NH3_GEOMETRY.nnPm,
    hhPm: NH3_GEOMETRY.hhPm,
    nhPm: NH3_GEOMETRY.nhPm,
    angleDeg: NH3_GEOMETRY.angleDeg,
    dipoleD: NH3_GEOMETRY.dipoleD,
    fe: {
      spaceGroup: NH3_CATALYST_CRYSTAL.spaceGroup,
      spaceGroupNo: NH3_CATALYST_CRYSTAL.spaceGroupNo,
      cellPm: NH3_CATALYST_CRYSTAL.cellPm.a,
      neighbourPm: NH3_CATALYST_CRYSTAL.cationAnionPm,
      coordination: NH3_CATALYST_CRYSTAL.coordination.Fe,
    },
  },
} as const

/** Масштаб рига: молекулы мелкие (N 71 пм), поэтому крупнее, чем у NaCl. */
export const NH3_RIG_SCALE = 1.25

// ─────────────────────────────────────────────────────────────────────────────
// Поверхность катализатора: грань (100) ОЦК-железа
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Риг камеры умеет только поворот вокруг Y и крен, наклона «сверху» у него нет,
 * поэтому плоскость поверхности наклонена в самих координатах сцены: базис
 * EU (вправо), EV (вглубь и вверх по экрану), N_UP (нормаль к поверхности).
 */
const TILT_DEG = 25
const TILT = (TILT_DEG * Math.PI) / 180
const EV_Y = Math.sin(TILT)
const EV_Z = -Math.cos(TILT)
const NUP_Y = Math.cos(TILT)
const NUP_Z = Math.sin(TILT)
/** Высота верхнего слоя железа в кадре. */
const SURF_Y = -0.62

/** Точка над поверхностью: u — вправо, v — вглубь, h — по нормали. */
function surf(u: number, v: number, h: number): [number, number, number] {
  return [u, SURF_Y + EV_Y * v + NUP_Y * h, EV_Z * v + NUP_Z * h]
}

/** Единичная нормаль поверхности (в сторону газа). */
export const SURFACE_NORMAL: readonly [number, number, number] = [0, NUP_Y, NUP_Z]
/** Единичный вектор «вглубь» поверхности. */
const EV: readonly [number, number, number] = [0, EV_Y, EV_Z]
const EU: readonly [number, number, number] = [1, 0, 0]

export type Nh3AtomId = 'n1' | 'n2' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | `F${number}`

/**
 * Фрагмент ОЦК-железа: верхний слой (узлы решётки на грани) и второй слой,
 * сдвинутый на половину ячейки по обеим осям и на a/2 вглубь — это и есть
 * «объёмноцентрированность». Каждый атом второго слоя лежит ровно под центром
 * квадрата верхнего слоя, расстояние до всех четырёх соседей = (√3/2)·a = 248,2 пм.
 */
const TOP_U = [-1.5 * A_FE, -0.5 * A_FE, 0.5 * A_FE, 1.5 * A_FE]
const TOP_V = [-0.5 * A_FE, 0.5 * A_FE, 1.5 * A_FE]
const SUB_U = [-A_FE, 0, A_FE]
const SUB_V = [0, A_FE]

type FeAtom = { id: Nh3AtomId; pos: readonly [number, number, number]; layer: 0 | 1; u: number; v: number }

export const FE_ATOMS: readonly FeAtom[] = (() => {
  const out: FeAtom[] = []
  let n = 0
  for (const v of TOP_V) for (const u of TOP_U) out.push({ id: `F${n++}` as Nh3AtomId, pos: surf(u, v, 0), layer: 0, u, v })
  for (const v of SUB_V)
    for (const u of SUB_U) out.push({ id: `F${n++}` as Nh3AtomId, pos: surf(u, v, -A_FE / 2), layer: 1, u, v })
  return out
})()

/** Связи Fe–Fe: атом второго слоя с четырьмя соседями верхнего (по (√3/2)·a). */
export const FE_BONDS: readonly (readonly [Nh3AtomId, Nh3AtomId])[] = (() => {
  const out: [Nh3AtomId, Nh3AtomId][] = []
  const near = (u: number, v: number) => FE_ATOMS.find((a) => a.layer === 0 && Math.abs(a.u - u) < 1e-6 && Math.abs(a.v - v) < 1e-6)
  for (const a of FE_ATOMS) {
    if (a.layer !== 1) continue
    for (const du of [-A_FE / 2, A_FE / 2])
      for (const dv of [-A_FE / 2, A_FE / 2]) {
        const b = near(a.u + du, a.v + dv)
        if (b) out.push([a.id, b.id])
      }
  }
  return out
})()

export const NH3_ATOMS: readonly { id: Nh3AtomId; el: 'N' | 'H' | 'Fe' }[] = [
  { id: 'n1', el: 'N' },
  { id: 'n2', el: 'N' },
  { id: 'h1', el: 'H' },
  { id: 'h2', el: 'H' },
  { id: 'h3', el: 'H' },
  { id: 'h4', el: 'H' },
  { id: 'h5', el: 'H' },
  { id: 'h6', el: 'H' },
  ...FE_ATOMS.map((f) => ({ id: f.id, el: 'Fe' as const })),
]

// ─────────────────────────────────────────────────────────────────────────────
// Ключевые моменты
// ─────────────────────────────────────────────────────────────────────────────

const T_ADSORB = nh3CueAt('adsorb') // 5.6 — молекулы сели на железо
const T_HH_SPLIT = 7.2 // H₂ распадается на поверхности легко
const T_SPLIT = nh3CueAt('split') // 8.4 — разорвана тройная связь N≡N
const T_NH = nh3CueAt('nh') // 11.6
const T_NH2 = nh3CueAt('nh2') // 13.4
const T_NH3 = nh3CueAt('nh3') // 15.4
const T_DESORB = nh3CueAt('desorb') // 17.4
const T_EQUIL = nh3CueAt('equilibrium') // 21.0
const T_EXO = nh3CueAt('exo') // 24.6

/** Шесть водородов уравнения: 3 H₂ дают ровно 6 атомов на две молекулы NH₃. */
export type Nh3HydrogenId = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

/** Когда каждый водород становится частью молекулы (дальше он жёстко в пирамиде). */
const H_ATTACH: Record<Nh3HydrogenId, number> = {
  h1: T_NH - 0.2,
  h3: T_NH,
  h2: T_NH2 - 0.2,
  h4: T_NH2,
  h5: T_NH3 - 0.2,
  h6: T_NH3,
}

/** К какому азоту идёт водород и под каким азимутом он встаёт в пирамиду. */
const H_OWNER: Record<Nh3HydrogenId, { n: 'n1' | 'n2'; phiDeg: number }> = {
  h1: { n: 'n1', phiDeg: 200 },
  h2: { n: 'n1', phiDeg: 320 },
  h5: { n: 'n1', phiDeg: 80 },
  h3: { n: 'n2', phiDeg: 340 },
  h4: { n: 'n2', phiDeg: 220 },
  h6: { n: 'n2', phiDeg: 100 },
}

// ─────────────────────────────────────────────────────────────────────────────
// Опорные точки
// ─────────────────────────────────────────────────────────────────────────────

/** Высота адсорбции: центр частицы над плоскостью верхнего слоя. */
const H_N_ADS = 0.40
const H_H_ADS = 0.24

/** Двухатомная молекула: центр и единичная ось. */
type Diatomic = { c: readonly [number, number, number]; ax: readonly [number, number, number] }
type MolKey = 'n2' | 'hh1' | 'hh2' | 'hh3'

/** Газовая фаза (шаг 1): N₂ сверху, три H₂ ниже. */
const GAS: Record<MolKey, Diatomic> = {
  n2: { c: [0, 0.62, 0.15], ax: EU },
  hh1: { c: [-0.92, 0.18, 0.05], ax: [0.8704, 0.4924, 0] },
  hh2: { c: [0.92, 0.18, -0.05], ax: [0.8704, -0.4924, 0] },
  hh3: { c: [0, 0.02, 0.3], ax: EU },
}

/** Адсорбированные молекулы (шаг 2, до разрыва связей). */
const ADS: Record<MolKey, Diatomic> = {
  n2: { c: surf(0, 0.25, H_N_ADS + 0.02), ax: EU },
  hh1: { c: surf(-0.95, 0.24, H_H_ADS), ax: EU },
  hh2: { c: surf(0.95, 0.24, H_H_ADS), ax: EU },
  hh3: { c: surf(0, 1.15, H_H_ADS), ax: EU },
}

/** Центры адсорбции атомов после разрыва связей. */
const SITE = {
  n1: surf(-0.42, 0.25, H_N_ADS),
  n2: surf(0.42, 0.25, H_N_ADS),
  h1: surf(-1.05, 0.62, H_H_ADS),
  h2: surf(-0.86, -0.15, H_H_ADS),
  h3: surf(1.05, 0.62, H_H_ADS),
  h4: surf(0.86, -0.15, H_H_ADS),
  h5: surf(-0.3, 1.15, H_H_ADS),
  h6: surf(0.3, 1.15, H_H_ADS),
} as const

/** Куда уходят готовые молекулы после десорбции. */
const FREE = {
  n1: [-0.5, 0.42, 0.12] as const,
  n2: [0.5, 0.42, 0.12] as const,
}

const add = (
  c: readonly [number, number, number],
  ax: readonly [number, number, number],
  k: number,
): [number, number, number] => [c[0] + ax[0] * k, c[1] + ax[1] * k, c[2] + ax[2] * k]

// ─────────────────────────────────────────────────────────────────────────────
// Пирамида NH₃: поворот молекулы при десорбции
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Угол переворота молекулы. На поверхности азот связан с железом именно
 * НЕПОДЕЛЁННОЙ ПАРОЙ, поэтому пара смотрит вниз, а три водорода — вверх (α = 0).
 * Оторвавшись, молекула разворачивается на 180° (α = π) и встаёт в привычный
 * школьный вид: азот сверху, три водорода снизу, неподелённая пара сверху.
 */
const FLIP: ScalarTrack = rampTrack(T_DESORB + 0.4, 0, T_DESORB + 2.0, Math.PI, 'inOutSine')

const _off = new THREE.Vector3()

/** Смещение водорода от азота в пирамиде при азимуте φ и угле переворота α. */
function pyramidOffset(phiDeg: number, alpha: number, out: THREE.Vector3): THREE.Vector3 {
  const phi = (phiDeg * Math.PI) / 180
  const c1 = PYR_RAD * Math.cos(phi)
  const c2 = PYR_RAD * Math.sin(phi)
  const c3 = PYR_AX
  const ca = Math.cos(alpha)
  const sa = Math.sin(alpha)
  const k2 = c2 * ca - c3 * sa
  const k3 = c2 * sa + c3 * ca
  out.set(
    EU[0] * c1 + EV[0] * k2 + SURFACE_NORMAL[0] * k3,
    EU[1] * c1 + EV[1] * k2 + SURFACE_NORMAL[1] * k3,
    EU[2] * c1 + EV[2] * k2 + SURFACE_NORMAL[2] * k3,
  )
  return out
}

/** Направление неподелённой пары от азота (противоположно «оси водородов»). */
function lonePairDir(alpha: number, out: THREE.Vector3): THREE.Vector3 {
  const ca = Math.cos(alpha)
  const sa = Math.sin(alpha)
  out.set(
    EV[0] * sa - SURFACE_NORMAL[0] * ca,
    EV[1] * sa - SURFACE_NORMAL[1] * ca,
    EV[2] * sa - SURFACE_NORMAL[2] * ca,
  )
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Дорожки положений
// ─────────────────────────────────────────────────────────────────────────────

const half = (d: number) => d / 2

/** Положение водорода в момент присоединения — стык дорожки и пирамиды без скачка. */
function attachPoint(id: keyof typeof H_OWNER): [number, number, number] {
  const owner = H_OWNER[id]!
  pyramidOffset(owner.phiDeg, 0, _off)
  const base = SITE[owner.n]
  return [base[0] + _off.x, base[1] + _off.y, base[2] + _off.z]
}

const POS: Record<string, Vec3Track> = {
  // ——— Азот: газ → адсорбция → разрыв N≡N → свой центр → десорбция ———
  n1: [
    { t: 0, v: add(GAS.n2.c, GAS.n2.ax, -half(D_NN)) },
    { t: 4.2, v: add(GAS.n2.c, GAS.n2.ax, -half(D_NN)) },
    { t: T_ADSORB, v: add(ADS.n2.c, ADS.n2.ax, -half(D_NN)), ease: 'smooth' },
    // связь тянется: расстояние N–N растёт ещё до разрыва
    { t: T_SPLIT, v: add(ADS.n2.c, ADS.n2.ax, -half(D_NN) * 1.5), ease: 'inQuad' },
    { t: T_SPLIT + 1.6, v: SITE.n1, ease: 'smooth' },
    { t: T_DESORB, v: SITE.n1 },
    { t: T_DESORB + 2.0, v: FREE.n1, ease: 'smooth' },
  ],
  n2: [
    { t: 0, v: add(GAS.n2.c, GAS.n2.ax, half(D_NN)) },
    { t: 4.2, v: add(GAS.n2.c, GAS.n2.ax, half(D_NN)) },
    { t: T_ADSORB, v: add(ADS.n2.c, ADS.n2.ax, half(D_NN)), ease: 'smooth' },
    { t: T_SPLIT, v: add(ADS.n2.c, ADS.n2.ax, half(D_NN) * 1.5), ease: 'inQuad' },
    { t: T_SPLIT + 1.6, v: SITE.n2, ease: 'smooth' },
    { t: T_DESORB, v: SITE.n2 },
    { t: T_DESORB + 2.0, v: FREE.n2, ease: 'smooth' },
  ],
}

/** Водороды: газ → адсорбция молекулой → разрыв H–H → миграция к азоту. */
const H_PLAN: Record<keyof typeof H_OWNER, { gas: Diatomic; ads: Diatomic; side: 1 | -1 }> = {
  h1: { gas: GAS.hh1, ads: ADS.hh1, side: -1 },
  h2: { gas: GAS.hh1, ads: ADS.hh1, side: 1 },
  h3: { gas: GAS.hh2, ads: ADS.hh2, side: 1 },
  h4: { gas: GAS.hh2, ads: ADS.hh2, side: -1 },
  h5: { gas: GAS.hh3, ads: ADS.hh3, side: -1 },
  h6: { gas: GAS.hh3, ads: ADS.hh3, side: 1 },
}

for (const id of Object.keys(H_PLAN) as (keyof typeof H_PLAN)[]) {
  const plan = H_PLAN[id]
  const attach = H_ATTACH[id]
  POS[id] = [
    { t: 0, v: add(plan.gas.c, plan.gas.ax, half(D_HH) * plan.side) },
    { t: 4.2, v: add(plan.gas.c, plan.gas.ax, half(D_HH) * plan.side) },
    { t: T_ADSORB, v: add(plan.ads.c, plan.ads.ax, half(D_HH) * plan.side), ease: 'smooth' },
    { t: T_HH_SPLIT, v: add(plan.ads.c, plan.ads.ax, half(D_HH) * 1.45 * plan.side), ease: 'inQuad' },
    { t: T_HH_SPLIT + 1.4, v: SITE[id], ease: 'smooth' },
    { t: attach - 1.5, v: SITE[id] },
    { t: attach, v: attachPoint(id), ease: 'smooth' },
  ]
}

for (const f of FE_ATOMS) POS[f.id] = [{ t: 0, v: f.pos }]

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

/** Железо проявляется в начале шага «адсорбция» и остаётся до конца — оно НЕ расходуется. */
const FE_OPACITY: ScalarTrack = appearTrack(4.0, 1.0)
const FE_BOND_OPACITY: ScalarTrack = [
  { t: 4.2, v: 0 },
  { t: 5.2, v: 0.5, ease: 'smooth' },
]

/**
 * Кратность связи N≡N: 3 → 0. Промежуточные дробные значения рендерер рисует
 * пунктирной третьей полосой — видно, как связь СЛАБЕЕТ на катализаторе.
 */
const NN_ORDER: ScalarTrack = [
  { t: 0, v: 3 },
  { t: T_ADSORB, v: 3 },
  { t: T_ADSORB + 1.2, v: 2.3, ease: 'smooth' },
  { t: T_SPLIT - 0.8, v: 1.4, ease: 'smooth' },
  { t: T_SPLIT, v: 0.6, ease: 'smooth' },
]
const NN_STRESS: ScalarTrack = rampTrack(T_ADSORB, 0, T_SPLIT, 1, 'inQuad')
const NN_THIN: ScalarTrack = rampTrack(T_SPLIT - 0.5, 0, T_SPLIT + 0.3, 1, 'outCubic')
const NN_OPACITY: ScalarTrack = rampTrack(T_SPLIT, 1, T_SPLIT + 0.6, 0, 'smooth')

/** Связь H–H рвётся на железе раньше и легче: E(H–H) против E(N≡N) из bondData. */
const HH_STRESS: ScalarTrack = rampTrack(T_ADSORB, 0, T_HH_SPLIT, 1, 'inQuad')
const HH_THIN: ScalarTrack = rampTrack(T_HH_SPLIT - 0.4, 0, T_HH_SPLIT + 0.25, 1, 'outCubic')
const HH_OPACITY: ScalarTrack = rampTrack(T_HH_SPLIT, 1, T_HH_SPLIT + 0.5, 0, 'smooth')

/** Связь Fe←NH₃ (донорно-акцепторная, через неподелённую пару) — держится до десорбции. */
const ADS_BOND: ScalarTrack = [
  { t: T_ADSORB - 0.2, v: 0 },
  { t: T_ADSORB + 0.4, v: 0.55, ease: 'smooth' },
  { t: T_DESORB, v: 0.55 },
  { t: T_DESORB + 0.8, v: 0, ease: 'smooth' },
]

/** π-облака тройной связи: ярко в газе, гаснут вместе с ослаблением связи. */
const PI_CLOUD: ScalarTrack = [
  { t: 0.5, v: 0 },
  { t: 1.4, v: 1, ease: 'smooth' },
  { t: T_ADSORB, v: 0.9 },
  { t: T_SPLIT, v: 0, ease: 'smooth' },
]

/** Две кривые активации на шаге «катализатор». */
const EA_CURVES: ScalarTrack = [
  { t: T_ADSORB - 0.6, v: 0 },
  { t: T_ADSORB + 0.6, v: 1, ease: 'smooth' },
  { t: T_SPLIT + 0.8, v: 1 },
  { t: 9.9, v: 0, ease: 'smooth' },
]

/** Неподелённая пара: появляется, как только собрана молекула. */
const LONE_PAIR: ScalarTrack = [
  { t: T_NH3 - 0.2, v: 0 },
  { t: T_NH3 + 0.8, v: 1, ease: 'smooth' },
]

/** Стрелки равновесия ⇌ (шаг 5). */
const EQ_ARROWS: ScalarTrack = [
  { t: T_EQUIL - 1.0, v: 0 },
  { t: T_EQUIL, v: 1, ease: 'smooth' },
  { t: 23.6, v: 1 },
  { t: 24.2, v: 0, ease: 'smooth' },
]

/** Подсветка «катализатор цел»: короткая волна по решётке сразу после десорбции. */
const CATALYST_PULSE: ScalarTrack = [
  { t: T_DESORB + 1.2, v: 0 },
  { t: T_DESORB + 1.9, v: 1, ease: 'smooth' },
  { t: T_DESORB + 3.0, v: 0, ease: 'smooth' },
]

const CAM_ZOOM: ScalarTrack = [
  { t: 0, v: 1.02 },
  { t: 3.4, v: 1.1, ease: 'smooth' },
  { t: T_ADSORB, v: 0.62, ease: 'smooth' },
  { t: T_SPLIT, v: 0.74, ease: 'smooth' },
  { t: 10.6, v: 0.94, ease: 'smooth' },
  { t: T_NH3, v: 1.0, ease: 'smooth' },
  { t: T_DESORB + 2.0, v: 1.06, ease: 'smooth' },
  { t: T_EQUIL, v: 0.72, ease: 'smooth' },
  { t: T_EXO, v: 0.78, ease: 'smooth' },
  { t: NH3_END, v: 0.76 },
]
const CAM_YAW: ScalarTrack = [
  { t: 0, v: 0 },
  { t: T_ADSORB, v: -0.18, ease: 'smooth' },
  { t: T_NH2, v: 0.2, ease: 'smooth' },
  { t: T_DESORB + 2.0, v: 0.06, ease: 'smooth' },
  { t: T_EQUIL, v: 0, ease: 'smooth' },
]
const CAM_ROLL: ScalarTrack = [
  { t: 0, v: 0 },
  { t: T_SPLIT, v: -0.05, ease: 'smooth' },
  { t: T_DESORB, v: 0, ease: 'smooth' },
]
const CAM_OFFSET: Vec3Track = [
  { t: 0, v: [0, -0.28, 0] },
  { t: T_ADSORB, v: [0, 0.16, 0], ease: 'smooth' },
  { t: T_NH, v: [0, 0.14, 0], ease: 'smooth' },
  { t: T_DESORB + 2.0, v: [0, -0.28, 0], ease: 'smooth' },
  { t: T_EQUIL, v: [0, -0.18, 0], ease: 'smooth' },
]
const FADE = fadeTrack(NH3_FINISH)

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Тексты подписей НЕ переводятся: формулы, символы и обозначения СИ одинаковы
 * в ru/en/uz. Агрегатные состояния и единицы пишутся ТОКЕНАМИ ({g}, {pm},
 * {kJmol}, {kJ}) — сцена подставляет язык один раз за кадр.
 */
export type Nh3LabelAnchor =
  | 'n1'
  | 'n2'
  | 'nnMid'
  | 'hh1'
  | 'molA'
  | 'molB'
  | 'surface'
  | 'free'

export type Nh3LabelDef = SceneLabelDef & { anchor: Nh3LabelAnchor; at?: readonly [number, number, number] }

const NN_PM = Math.round(NH3_GEOM.data.nnPm * 10) / 10
const NH_PM = Math.round(NH3_GEOM.data.nhPm * 10) / 10
const FE_PM = Math.round(NH3_GEOM.data.fe.cellPm * 10) / 10
const ANGLE = NH3_GEOM.data.angleDeg
const DIPOLE = NH3_GEOM.data.dipoleD ?? 0
/** Настоящий минус U+2212 вместо дефиса: подпись — это химия, а не код. */
const sci = (n: number): string => String(n).replace('-', '−')

export const NH3_LABELS: readonly Nh3LabelDef[] = [
  // ——— Шаг 1: исходные вещества ———
  { id: 'n2', kind: 'species', anchor: 'nnMid', dy: 0.42, keys: [{ t: 0, text: 'N₂ ({g})' }], windows: [[0.7, T_ADSORB + 0.6]] },
  {
    id: 'nnBond',
    kind: 'delta',
    anchor: 'nnMid',
    dy: -0.42,
    keys: [{ t: 0, text: `N≡N  ${NN_PM} {pm}  ·  ${NN_BOND_KJ} {kJmol}` }],
    windows: [[1.3, T_SPLIT - 0.2]],
  },
  { id: 'h2', kind: 'species', anchor: 'hh1', dy: -0.34, keys: [{ t: 0, text: 'H₂ ({g})' }], windows: [[1.0, T_ADSORB + 0.6]] },
  // ——— Шаг 2: катализатор и барьер ———
  { id: 'fe', kind: 'species', anchor: 'surface', dy: -0.2, keys: [{ t: 0, text: `Fe ({s})  a = ${FE_PM} {pm}` }], windows: [[4.8, 9.8]] },
  {
    id: 'ea1',
    kind: 'delta',
    anchor: 'free',
    at: [-0.86, 1.38, 0],
    dy: 0,
    keys: [{ t: 0, text: `Eₐ ≈ ${HABER.eaPlainKJ} {kJmol}` }],
    windows: [[T_ADSORB, 9.8]],
  },
  {
    id: 'ea2',
    kind: 'delta',
    anchor: 'free',
    at: [0.92, 0.86, 0],
    dy: 0,
    keys: [{ t: 0, text: `Eₐ (Fe) ≈ ${HABER.eaCatalystKJ[0]}–${HABER.eaCatalystKJ[1]} {kJmol}` }],
    windows: [[T_ADSORB + 0.4, 9.8]],
  },
  // ——— Шаг 3: сборка молекулы ———
  {
    id: 'molA',
    kind: 'species',
    anchor: 'molA',
    dy: 0.36,
    keys: [
      { t: 0, text: 'N' },
      { t: H_ATTACH.h1 + 0.1, text: 'NH' },
      { t: H_ATTACH.h2 + 0.1, text: 'NH₂' },
      { t: H_ATTACH.h5 + 0.1, text: 'NH₃' },
      { t: T_DESORB + 1.0, text: 'NH₃ ({g})' },
    ],
    windows: [[T_SPLIT + 0.8, 23.8]],
  },
  {
    id: 'molB',
    kind: 'species',
    anchor: 'molB',
    dy: 0.36,
    keys: [
      { t: 0, text: 'N' },
      { t: H_ATTACH.h3 + 0.1, text: 'NH' },
      { t: H_ATTACH.h4 + 0.1, text: 'NH₂' },
      { t: H_ATTACH.h6 + 0.1, text: 'NH₃' },
      { t: T_DESORB + 1.0, text: 'NH₃ ({g})' },
    ],
    windows: [[T_SPLIT + 0.8, 23.8]],
  },
  {
    id: 'nhLen',
    kind: 'delta',
    anchor: 'molA',
    dy: -0.5,
    keys: [{ t: 0, text: `N–H  ${NH_PM} {pm}  ·  ${NH3_GEOMETRY.nhBondKJ} {kJmol}` }],
    windows: [[T_NH + 0.4, T_DESORB]],
  },
  // ——— Шаг 4: геометрия готовой молекулы ———
  {
    id: 'angle',
    kind: 'token',
    anchor: 'molB',
    dy: -0.5,
    keys: [{ t: 0, text: `H–N–H = ${ANGLE}°` }],
    windows: [[T_DESORB + 1.4, 20.6]],
  },
  {
    id: 'dipole',
    kind: 'delta',
    anchor: 'molA',
    dy: -0.5,
    keys: [{ t: 0, text: `μ = ${DIPOLE} D` }],
    windows: [[T_DESORB + 1.8, 20.6]],
  },
  // ——— Шаг 5: равновесие и принцип Ле Шателье ———
  {
    id: 'eq',
    kind: 'token',
    anchor: 'free',
    at: [0, 1.5, 0],
    dy: 0,
    keys: [{ t: 0, text: 'N₂ + 3 H₂ ⇌ 2 NH₃' }],
    windows: [[T_EQUIL - 0.8, 24.0]],
  },
  {
    id: 'dn',
    kind: 'delta',
    anchor: 'free',
    at: [0, 1.06, 0],
    dy: 0,
    keys: [{ t: 0, text: `4 ⇌ 2  ·  Δn = ${sci(NH3_DELTA_N)}` }],
    windows: [[T_EQUIL + 0.4, 24.0]],
  },
  {
    id: 'pUp',
    kind: 'token',
    anchor: 'free',
    at: [-1.05, -0.02, 0],
    dy: 0,
    keys: [{ t: 0, text: 'p ↑  ⟶' }],
    windows: [[T_EQUIL + 0.8, 24.0]],
  },
  {
    id: 'tUp',
    kind: 'token',
    anchor: 'free',
    at: [1.05, -0.02, 0],
    dy: 0,
    keys: [{ t: 0, text: '⟵  T ↑' }],
    windows: [[T_EQUIL + 1.4, 24.0]],
  },
  // ——— Шаг 6: энергетический итог ———
  {
    id: 'dH',
    kind: 'delta',
    anchor: 'free',
    at: [0, 1.32, 0],
    dy: 0,
    keys: [{ t: 0, text: `ΔH = ${sci(NH3_REACTION_DH_KJ)} {kJ}` }],
    windows: [[T_EXO - 0.6, NH3_FINISH.to]],
  },
  {
    id: 'dHf',
    kind: 'delta',
    anchor: 'free',
    at: [0, 0.94, 0],
    dy: 0,
    keys: [{ t: 0, text: `ΔH°f(NH₃) = ${sci(NH3_DHF_KJ)} {kJmol}` }],
    windows: [[T_EXO + 0.4, NH3_FINISH.to]],
  },
]

export type Nh3LabelState = SceneLabelState

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type Nh3Frame = {
  atoms: Record<Nh3AtomId, THREE.Vector3>
  radius: Record<Nh3AtomId, number>
  opacity: Record<Nh3AtomId, number>
  emissive: Record<Nh3AtomId, number>
  /** тройная связь N≡N: кратность, натяжение, истончение, прозрачность */
  nn: { order: number; stress: number; thinning: number; opacity: number }
  /** три связи H–H */
  hh: { stress: number; thinning: number; opacity: number }
  /** шесть связей N–H: 0 — ещё нет, 1 — готова (волна образования) */
  nh: Record<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', number>
  /** донорно-акцепторная связь молекулы с железом */
  adsBond: number
  feBond: number
  /** π-облака тройной связи */
  piCloud: number
  /** кривые активации (с катализатором и без) */
  eaCurves: number
  /** неподелённая пара азота */
  lonePair: number
  /** направление неподелённой пары (единичный вектор) */
  lonePairDir: THREE.Vector3
  /** стрелки равновесия */
  eqArrows: number
  /** «катализатор цел» — волна по решётке */
  catalystPulse: number
  env: { exo: number; fade: number }
  labels: Nh3LabelState[]
  camera: { zoom: number; offset: THREE.Vector3; yaw: number; roll: number; shake: number; bloom: number; vignette: number }
  /** середина связи N–N (для подписи и эффектов) */
  nnMid: THREE.Vector3
  /** центр фрагмента железа */
  surfaceCenter: THREE.Vector3
  /** центр кадра между двумя молекулами */
  center: THREE.Vector3
}

export function createNh3Frame(): Nh3Frame {
  const atoms = {} as Record<Nh3AtomId, THREE.Vector3>
  const radius = {} as Record<Nh3AtomId, number>
  const opacity = {} as Record<Nh3AtomId, number>
  const emissive = {} as Record<Nh3AtomId, number>
  for (const a of NH3_ATOMS) {
    atoms[a.id] = new THREE.Vector3()
    radius[a.id] = a.el === 'N' ? R.n : a.el === 'H' ? R.h : R.fe
    opacity[a.id] = a.el === 'Fe' ? 0 : 1
    emissive[a.id] = 0.08
  }
  return {
    atoms,
    radius,
    opacity,
    emissive,
    nn: { order: 3, stress: 0, thinning: 0, opacity: 1 },
    hh: { stress: 0, thinning: 0, opacity: 1 },
    nh: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
    adsBond: 0,
    feBond: 0,
    piCloud: 0,
    eaCurves: 0,
    lonePair: 0,
    lonePairDir: new THREE.Vector3(),
    eqArrows: 0,
    catalystPulse: 0,
    env: { exo: 0, fade: 0 },
    labels: createLabelStates(NH3_LABELS),
    camera: { zoom: 1, offset: new THREE.Vector3(), yaw: 0, roll: 0, shake: 0, bloom: 0.3, vignette: 0.3 },
    nnMid: new THREE.Vector3(),
    surfaceCenter: new THREE.Vector3(0, SURF_Y + 0.12, 0),
    center: new THREE.Vector3(),
  }
}

const H_IDS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleNh3Frame(t: number, frame: Nh3Frame): Nh3Frame {
  const { atoms, opacity, emissive } = frame

  sampleVec3(POS.n1!, t, atoms.n1)
  sampleVec3(POS.n2!, t, atoms.n2)
  for (const f of FE_ATOMS) sampleVec3(POS[f.id]!, t, atoms[f.id])

  // ——— Водород: до присоединения — по дорожке, после — жёстко в пирамиде ———
  const alpha = sampleScalar(FLIP, t)
  for (const id of H_IDS) {
    const attach = H_ATTACH[id]
    if (t < attach) {
      sampleVec3(POS[id]!, t, atoms[id])
    } else {
      const owner = H_OWNER[id]!
      pyramidOffset(owner.phiDeg, alpha, _off)
      atoms[id].copy(atoms[owner.n]).add(_off)
    }
    frame.nh[id] = smoothstep(attach - 0.25, attach + 0.15, t)
  }

  // ——— Прозрачности ———
  const feA = sampleScalar(FE_OPACITY, t)
  for (const f of FE_ATOMS) opacity[f.id] = feA
  frame.feBond = sampleScalar(FE_BOND_OPACITY, t)

  // ——— Связи ———
  frame.nn.order = sampleScalar(NN_ORDER, t)
  frame.nn.stress = sampleScalar(NN_STRESS, t)
  frame.nn.thinning = sampleScalar(NN_THIN, t)
  frame.nn.opacity = sampleScalar(NN_OPACITY, t)
  frame.hh.stress = sampleScalar(HH_STRESS, t)
  frame.hh.thinning = sampleScalar(HH_THIN, t)
  frame.hh.opacity = sampleScalar(HH_OPACITY, t)
  frame.adsBond = sampleScalar(ADS_BOND, t) * feA

  // ——— Эффекты ———
  frame.piCloud = sampleScalar(PI_CLOUD, t)
  frame.eaCurves = sampleScalar(EA_CURVES, t)
  frame.lonePair = sampleScalar(LONE_PAIR, t)
  lonePairDir(alpha, frame.lonePairDir)
  frame.eqArrows = sampleScalar(EQ_ARROWS, t)
  frame.catalystPulse = sampleScalar(CATALYST_PULSE, t)

  // ——— Энергия: пик на cue exo, дальше ровное тёплое свечение ———
  const exo = smoothstep(T_EXO - 0.7, T_EXO, t) * (1 - 0.5 * smoothstep(T_EXO, T_EXO + 1.8, t))
  frame.env.exo = exo
  frame.env.fade = sampleScalar(FADE, t)

  // ——— Свечение частиц ———
  const forming = Math.max(
    windowFade([T_NH - 0.3, T_NH + 0.5], t, 0.3),
    windowFade([T_NH2 - 0.3, T_NH2 + 0.5], t, 0.3),
    windowFade([T_NH3 - 0.3, T_NH3 + 0.5], t, 0.3),
  )
  for (const a of NH3_ATOMS) {
    let e = 0.08 + exo * 0.4
    if (a.el === 'N') e += frame.piCloud * 0.18 + forming * 0.35
    if (a.el === 'H') e += forming * 0.3
    if (a.el === 'Fe') e += frame.catalystPulse * 0.45
    emissive[a.id] = e
  }

  // ——— Опорные точки ———
  frame.nnMid.copy(atoms.n1).lerp(atoms.n2, 0.5)
  frame.center.copy(atoms.n1).lerp(atoms.n2, 0.5)

  // ——— Подписи ———
  sampleLabels(
    NH3_LABELS,
    frame.labels,
    t,
    (def, st) => {
      const d = def as Nh3LabelDef
      switch (d.anchor) {
        case 'free':
          st.pos.set(d.at![0], d.at![1], d.at![2])
          break
        case 'nnMid':
          st.pos.copy(frame.nnMid)
          st.pos.y += d.dy
          break
        case 'hh1':
          st.pos.copy(atoms.h1).lerp(atoms.h2, 0.5)
          st.pos.y += d.dy
          break
        case 'surface':
          st.pos.copy(frame.surfaceCenter)
          st.pos.y += d.dy
          break
        case 'molA':
          st.pos.copy(atoms.n1)
          st.pos.y += d.dy
          break
        case 'molB':
          st.pos.copy(atoms.n2)
          st.pos.y += d.dy
          break
        default:
          st.pos.copy(atoms[d.anchor])
          st.pos.y += d.dy
          break
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
    0.35 * Math.max(0, 1 - Math.abs(t - T_SPLIT) / 0.35) +
    0.2 * Math.max(0, 1 - Math.abs(t - T_HH_SPLIT) / 0.3) +
    0.45 * Math.max(0, 1 - Math.abs(t - T_EXO) / 0.5)
  cam.bloom = 0.3 + 0.25 * frame.piCloud + 0.7 * exo + 0.3 * forming
  cam.vignette = 0.3 + 0.15 * exo
  return frame
}

// ─────────────────────────────────────────────────────────────────────────────
// Проверка раскадровки
// ─────────────────────────────────────────────────────────────────────────────

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validateNh3Storyboard(): void {
  const vec: Record<string, Vec3Track> = { 'cam.offset': CAM_OFFSET }
  for (const [id, track] of Object.entries(POS)) vec[`pos.${id}`] = track
  validateTracks(vec)
  validateTracks({
    FE_OPACITY,
    FE_BOND_OPACITY,
    NN_ORDER,
    NN_STRESS,
    NN_THIN,
    NN_OPACITY,
    HH_STRESS,
    HH_THIN,
    HH_OPACITY,
    ADS_BOND,
    PI_CLOUD,
    EA_CURVES,
    LONE_PAIR,
    EQ_ARROWS,
    CATALYST_PULSE,
    FLIP,
    CAM_ZOOM,
    CAM_YAW,
    CAM_ROLL,
    FADE,
  })

  // Состав кадра: 2 N + 6 H = ровно две молекулы NH₃, ни одного лишнего атома.
  const nCount = NH3_ATOMS.filter((a) => a.el === 'N').length
  const hCount = NH3_ATOMS.filter((a) => a.el === 'H').length
  if (nCount !== 2) throw new Error(`nh3: в кадре обязано быть 2 атома N, получилось ${nCount}`)
  if (hCount !== 6) throw new Error(`nh3: в кадре обязано быть 6 атомов H, получилось ${hCount}`)

  // Фрагмент железа: 12 атомов верхнего слоя + 6 второго, у каждого атома
  // второго слоя ровно 4 соседа сверху (полное КЧ 8 — с учётом слоя ниже).
  if (FE_ATOMS.length !== 18) throw new Error(`nh3: фрагмент Fe обязан содержать 18 атомов, получилось ${FE_ATOMS.length}`)
  if (FE_BONDS.length !== 24) throw new Error(`nh3: ожидалось 24 связи Fe–Fe, получилось ${FE_BONDS.length}`)

  // Расстояние Fe–Fe в нарисованных связях = табличное d = 248,2 пм.
  // Допуск 0,2 пм: в справочнике d(Fe–Fe) округлено до 248,2, а из ребра ячейки
  // получается (√3/2)·286,65 = 248,26 пм. Это округление источника, а не ошибка.
  const want = pmToScene(NH3_GEOM.data.fe.neighbourPm)
  const tol = pmToScene(0.2)
  const byId = new Map(FE_ATOMS.map((f) => [f.id, f.pos]))
  for (const [a, b] of FE_BONDS) {
    const pa = byId.get(a)!
    const pb = byId.get(b)!
    const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2])
    if (Math.abs(d - want) > tol) {
      throw new Error(`nh3: связь Fe–Fe ${a}–${b} длиной ${d.toFixed(4)}, ожидалось ${want.toFixed(4)}`)
    }
  }

  // Геометрия пирамиды: все три угла H–N–H равны справочным 106,7°.
  const pa = pyramidOffset(H_OWNER.h1!.phiDeg, 0, new THREE.Vector3())
  const pb = pyramidOffset(H_OWNER.h2!.phiDeg, 0, new THREE.Vector3())
  const pc = pyramidOffset(H_OWNER.h5!.phiDeg, 0, new THREE.Vector3())
  for (const [x, y] of [
    [pa, pb],
    [pb, pc],
    [pc, pa],
  ] as const) {
    const deg = (Math.acos(x.dot(y) / (x.length() * y.length())) * 180) / Math.PI
    if (Math.abs(deg - NH3_GEOM.data.angleDeg) > 0.05) {
      throw new Error(`nh3: угол H–N–H = ${deg.toFixed(2)}°, ожидалось ${NH3_GEOM.data.angleDeg}°`)
    }
    if (Math.abs(x.length() - D_NH) > 1e-9) throw new Error('nh3: длина связи N–H в пирамиде не равна справочной')
  }

  // Размеры: азот заметно крупнее водорода (71 против 31 пм).
  if (!(R.n > R.h)) throw new Error('nh3: атом N обязан быть больше атома H')
  if (!(R.fe > R.n)) throw new Error('nh3: атом Fe обязан быть больше атома N')

  // Тройная связь начинается кратностью 3 и полностью рвётся.
  if (Math.abs(sampleScalar(NN_ORDER, 0) - 3) > 1e-9) throw new Error('nh3: N₂ обязан стартовать с кратностью 3')
  if (sampleScalar(NN_OPACITY, T_SPLIT + 1) > 0.01) throw new Error('nh3: связь N≡N обязана исчезнуть после разрыва')

  // Катализатор НЕ расходуется: к концу сцены все 18 атомов Fe на месте и видны.
  if (sampleScalar(FE_OPACITY, NH3_END) < 0.99) throw new Error('nh3: железо обязано остаться в кадре до конца — катализатор не расходуется')

  if (NH3_END <= 0) throw new Error('nh3: пустой сюжет')
}

/** Набор для тестов: позиции и прозрачности видимых частиц в момент t. */
export function nh3VisibleAt(t: number, frame: Nh3Frame): ReadonlyArray<{ id: string; pos: THREE.Vector3; opacity: number }> {
  sampleNh3Frame(t, frame)
  return NH3_ATOMS.map((a) => ({ id: a.id, pos: frame.atoms[a.id], opacity: frame.opacity[a.id] }))
}
