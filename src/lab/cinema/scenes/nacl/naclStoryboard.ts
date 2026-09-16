import * as THREE from 'three'
import { ang, COVALENT_RADIUS_A, IONIC_RADIUS_A, BOND_LENGTH_A } from '../../core/atoms'
import { mix, norm, smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, validateTrack, windowFade, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { NACL_END, NACL_FINISH, naclCueAt } from './naclSteps'

export {
  NACL_CUES,
  NACL_END,
  NACL_FINISH,
  NACL_SEGMENTS,
  NACL_STEPS,
  NACL_STEP_IDS,
  naclStepIndexAt,
  type NaclCueId,
  type NaclStepId,
} from './naclSteps'

/**
 * Раскадровка 2 Na + Cl₂ → 2 NaCl — чистая функция времени сюжета.
 *
 * Геометрия настоящая: Cl–Cl 1,988 Å; в решётке NaCl расстояние Na–Cl 2,82 Å
 * (половина ребра ячейки 5,64 Å). Радиусы: атом Na 1,66 Å (ковалентный) → Na⁺ 1,02 Å,
 * атом Cl 1,02 Å → Cl⁻ 1,81 Å — ученик видит, что катион меньше атома, а анион больше.
 * Всё, что показано схематично (сам «прыжок» электрона, свечение орбитали),
 * оговорено в тексте урока.
 */

export type NaclAtomId = 'na1' | 'na2' | 'clA' | 'clB' | 'na3' | 'na4' | 'clC' | 'clD'
export type NaclElement = 'Na' | 'Cl'

export const NACL_ATOMS: readonly { id: NaclAtomId; el: NaclElement; main: boolean }[] = [
  { id: 'na1', el: 'Na', main: true },
  { id: 'na2', el: 'Na', main: true },
  { id: 'clA', el: 'Cl', main: true },
  { id: 'clB', el: 'Cl', main: true },
  { id: 'na3', el: 'Na', main: false },
  { id: 'na4', el: 'Na', main: false },
  { id: 'clC', el: 'Cl', main: false },
  { id: 'clD', el: 'Cl', main: false },
]

/** Масштаб рига камеры — как у ClO₂, чуть крупнее: ионов мало, детали важны. */
export const NACL_RIG_SCALE = 1.15

const ATOM_SCALE = 0.72
/** Половина ребра кубического фрагмента: Na–Cl 2,82 Å. */
const HALF = ang(2.82) / 2

export const NACL_GEOM = {
  /** радиусы в единицах сцены */
  radius: {
    na: ang(COVALENT_RADIUS_A.Na) * ATOM_SCALE,
    naCation: ang(IONIC_RADIUS_A['Na+']) * ATOM_SCALE,
    cl: ang(COVALENT_RADIUS_A.Cl) * ATOM_SCALE,
    clAnion: ang(IONIC_RADIUS_A['Cl-']) * ATOM_SCALE,
  },
  /** половина длины связи Cl–Cl */
  clHalf: ang(BOND_LENGTH_A.ClCl) / 2,
  /** радиус подсветки 3s-орбитали натрия */
  orbital3s: ang(COVALENT_RADIUS_A.Na) * ATOM_SCALE * 1.55,
  half: HALF,
  latticeNaCl: HALF * 2,
} as const

// ——— Ключевые моменты (story time) ———
const T_BREAK = naclCueAt('bondBreak') // 6.0
const T_E1 = { leave: 8.6, arrive: naclCueAt('transfer') } // 8.6 → 10.0
const T_E2 = { leave: 8.95, arrive: 10.35 }
const T_CONTACT = naclCueAt('contact') // 14.4
const T_LATTICE = naclCueAt('lattice') // 19.2
const T_EXO = naclCueAt('exo') // 20.8

const CH = NACL_GEOM.clHalf

/** Дорожки положений. Порядок ключей проверяет validateNaclStoryboard(). */
const POS: Record<NaclAtomId, Vec3Track> = {
  na1: [
    { t: 0, v: [-2.6, 1.0, 0] },
    { t: 4, v: [-1.05, 0.7, 0], ease: 'outCubic' },
    { t: 7, v: [-0.85, 0.62, 0], ease: 'smooth' },
    { t: 12, v: [-0.85, 0.62, 0] },
    { t: T_CONTACT, v: [-HALF, HALF, 0], ease: 'inQuad' },
    { t: 15.6, v: [-HALF, HALF, 0] },
    { t: 17.6, v: [-HALF, HALF, HALF], ease: 'smooth' },
  ],
  na2: [
    { t: 0, v: [2.6, -1.0, 0] },
    { t: 4, v: [1.05, -0.7, 0], ease: 'outCubic' },
    { t: 7, v: [0.85, -0.62, 0], ease: 'smooth' },
    { t: 12, v: [0.85, -0.62, 0] },
    { t: T_CONTACT, v: [HALF, -HALF, 0], ease: 'inQuad' },
    { t: 15.6, v: [HALF, -HALF, 0] },
    { t: 17.6, v: [HALF, -HALF, HALF], ease: 'smooth' },
  ],
  clA: [
    { t: 0, v: [0.12, CH, 0] },
    { t: 4, v: [0, CH, 0], ease: 'smooth' },
    { t: T_BREAK, v: [0.05, CH + 0.06, 0], ease: 'inQuad' },
    { t: 7, v: [0.45, 0.62, 0], ease: 'outCubic' },
    { t: 12, v: [0.45, 0.62, 0] },
    { t: T_CONTACT, v: [HALF, HALF, 0], ease: 'inQuad' },
    { t: 15.6, v: [HALF, HALF, 0] },
    { t: 17.6, v: [HALF, HALF, HALF], ease: 'smooth' },
  ],
  clB: [
    { t: 0, v: [0.12, -CH, 0] },
    { t: 4, v: [0, -CH, 0], ease: 'smooth' },
    { t: T_BREAK, v: [-0.05, -CH - 0.06, 0], ease: 'inQuad' },
    { t: 7, v: [-0.45, -0.62, 0], ease: 'outCubic' },
    { t: 12, v: [-0.45, -0.62, 0] },
    { t: T_CONTACT, v: [-HALF, -HALF, 0], ease: 'inQuad' },
    { t: 15.6, v: [-HALF, -HALF, 0] },
    { t: 17.6, v: [-HALF, -HALF, HALF], ease: 'smooth' },
  ],
  // Задний слой куба приходит из глубины, когда передний квадрат собран.
  na3: [
    { t: 16, v: [-1.1, -1.0, -1.9] },
    { t: 18.6, v: [-HALF, -HALF, -HALF], ease: 'smooth' },
  ],
  na4: [
    { t: 16, v: [1.1, 1.0, -1.9] },
    { t: 18.6, v: [HALF, HALF, -HALF], ease: 'smooth' },
  ],
  clC: [
    { t: 16, v: [1.1, -1.0, -1.9] },
    { t: 18.6, v: [HALF, -HALF, -HALF], ease: 'smooth' },
  ],
  clD: [
    { t: 16, v: [-1.1, 1.0, -1.9] },
    { t: 18.6, v: [-HALF, HALF, -HALF], ease: 'smooth' },
  ],
}

const R = NACL_GEOM.radius
const RADIUS_NA: ScalarTrack = [
  { t: T_E1.leave, v: R.na },
  { t: T_E1.leave + 1.8, v: R.naCation, ease: 'inOutSine' },
]
const RADIUS_NA2: ScalarTrack = [
  { t: T_E2.leave, v: R.na },
  { t: T_E2.leave + 1.8, v: R.naCation, ease: 'inOutSine' },
]
const RADIUS_CL: ScalarTrack = [
  { t: T_E1.arrive - 0.6, v: R.cl },
  { t: T_E1.arrive + 0.7, v: R.clAnion, ease: 'inOutSine' },
]
const RADIUS_CL2: ScalarTrack = [
  { t: T_E2.arrive - 0.6, v: R.cl },
  { t: T_E2.arrive + 0.7, v: R.clAnion, ease: 'inOutSine' },
]
const CHARGE_NA: ScalarTrack = [
  { t: T_E1.leave, v: 0 },
  { t: T_E1.arrive, v: 1, ease: 'smooth' },
]
const CHARGE_NA2: ScalarTrack = [
  { t: T_E2.leave, v: 0 },
  { t: T_E2.arrive, v: 1, ease: 'smooth' },
]
const CHARGE_CL: ScalarTrack = [
  { t: T_E1.arrive - 0.35, v: 0 },
  { t: T_E1.arrive + 0.3, v: -1, ease: 'smooth' },
]
const CHARGE_CL2: ScalarTrack = [
  { t: T_E2.arrive - 0.35, v: 0 },
  { t: T_E2.arrive + 0.3, v: -1, ease: 'smooth' },
]
const BACK_OPACITY: ScalarTrack = [
  { t: 16, v: 0 },
  { t: 17.3, v: 1, ease: 'smooth' },
]
/** Связь Cl–Cl: напряжение растёт, потом разрыв. */
const BOND_STRESS: ScalarTrack = [
  { t: 4.2, v: 0 },
  { t: T_BREAK, v: 1, ease: 'inQuad' },
]
const BOND_SPLIT: ScalarTrack = [
  { t: T_BREAK - 0.15, v: 0 },
  { t: T_BREAK + 0.35, v: 1, ease: 'outCubic' },
]
const BOND_OPACITY: ScalarTrack = [
  { t: T_BREAK, v: 1 },
  { t: T_BREAK + 0.7, v: 0, ease: 'smooth' },
]
/** Рёбра куба: появляются, когда задний слой на месте. */
const EDGES: ScalarTrack = [
  { t: 18.3, v: 0 },
  { t: T_LATTICE, v: 0.55, ease: 'smooth' },
  { t: 23.6, v: 0.55 },
  { t: NACL_FINISH.to, v: 0, ease: 'smooth' },
]
const CAM_ZOOM: ScalarTrack = [
  { t: 0, v: 0.96 },
  { t: 4, v: 1.02, ease: 'smooth' },
  { t: 7, v: 1.12, ease: 'smooth' },
  { t: 12, v: 1.12 },
  // Решётка крупнее ионной пары — отъезжаем, чтобы фрагмент с подписью NaCl помещался и на 390px.
  { t: 15, v: 1.1, ease: 'smooth' },
  { t: 20, v: 0.96, ease: 'smooth' },
  { t: 24, v: 0.92, ease: 'smooth' },
]
const CAM_YAW: ScalarTrack = [
  { t: 15, v: 0 },
  { t: 20, v: 0.52, ease: 'smooth' },
  { t: 24, v: 0.66, ease: 'smooth' },
]
const CAM_ROLL: ScalarTrack = [
  { t: 15, v: 0 },
  { t: 20, v: -0.16, ease: 'smooth' },
]
const CAM_OFFSET: Vec3Track = [
  { t: 0, v: [0, 0.05, 0] },
  { t: 7, v: [0, 0.1, 0], ease: 'smooth' },
  { t: 15, v: [0, 0.02, 0], ease: 'smooth' },
  { t: 20, v: [0, 0.08, 0], ease: 'smooth' },
]
const FADE: ScalarTrack = [
  { t: NACL_FINISH.from, v: 0 },
  { t: NACL_END, v: 1, ease: 'inQuad' },
]

// ——— Подписи ———
export type NaclLabelKind = 'species' | 'ox' | 'delta'
export type NaclLabelDef = {
  id: string
  kind: NaclLabelKind
  /** к какому атому привязана (или центр решётки) */
  anchor: NaclAtomId | 'cube' | 'cl2'
  /** смещение по y от края атома, единицы сцены */
  dy: number
  keys: readonly { t: number; text: string }[]
  /** окна видимости [from, to) */
  windows: readonly (readonly [number, number])[]
}

export const NACL_LABELS: readonly NaclLabelDef[] = [
  // Подписи ионов уходят, когда решётка собрана: дальше кадр подписан одним «NaCl», без наложений.
  { id: 'na1', kind: 'species', anchor: 'na1', dy: 0.2, keys: [{ t: 0, text: 'Na' }, { t: 10.2, text: 'Na⁺' }], windows: [[0.6, T_LATTICE - 0.2]] },
  { id: 'na2', kind: 'species', anchor: 'na2', dy: 0.2, keys: [{ t: 0, text: 'Na' }, { t: 10.5, text: 'Na⁺' }], windows: [[0.6, T_LATTICE - 0.2]] },
  { id: 'cl2', kind: 'species', anchor: 'cl2', dy: 0.2, keys: [{ t: 0, text: 'Cl₂' }], windows: [[0.6, T_BREAK - 0.1]] },
  { id: 'clA', kind: 'species', anchor: 'clA', dy: 0.2, keys: [{ t: 0, text: 'Cl' }, { t: 10.3, text: 'Cl⁻' }], windows: [[T_BREAK + 0.3, T_LATTICE - 0.2]] },
  { id: 'clB', kind: 'species', anchor: 'clB', dy: 0.2, keys: [{ t: 0, text: 'Cl' }, { t: 10.65, text: 'Cl⁻' }], windows: [[T_BREAK + 0.3, T_LATTICE - 0.2]] },
  { id: 'oxNa1', kind: 'ox', anchor: 'na1', dy: -0.2, keys: [{ t: 0, text: '0' }, { t: 10.2, text: '+1' }], windows: [[1.2, 18.4]] },
  { id: 'oxNa2', kind: 'ox', anchor: 'na2', dy: -0.2, keys: [{ t: 0, text: '0' }, { t: 10.5, text: '+1' }], windows: [[1.2, 18.4]] },
  { id: 'oxClA', kind: 'ox', anchor: 'clA', dy: -0.2, keys: [{ t: 0, text: '0' }, { t: 10.3, text: '−1' }], windows: [[T_BREAK + 0.3, 18.4]] },
  { id: 'oxClB', kind: 'ox', anchor: 'clB', dy: -0.2, keys: [{ t: 0, text: '0' }, { t: 10.65, text: '−1' }], windows: [[T_BREAK + 0.3, 18.4]] },
  { id: 'nacl', kind: 'species', anchor: 'cube', dy: 1.0, keys: [{ t: 0, text: 'NaCl' }], windows: [[T_LATTICE - 0.1, 23.8]] },
  { id: 'dH', kind: 'delta', anchor: 'cube', dy: -0.92, keys: [{ t: 0, text: 'ΔH = −411 kJ/mol' }], windows: [[T_EXO, 23.8]] },
]

export type NaclLabelState = { id: string; kind: NaclLabelKind; pos: THREE.Vector3; opacity: number; text: string }

export type NaclElectronState = {
  id: 'e1' | 'e2'
  /** положение сейчас */
  pos: THREE.Vector3
  /** старт и финиш прыжка (поверхности атомов) */
  from: THREE.Vector3
  to: THREE.Vector3
  /** нормаль дуги */
  perp: THREE.Vector3
  arc: number
  /** 0 — ещё на орбитали Na, 1 — уже у Cl */
  progress: number
  opacity: number
  /** яркость: разгорается на орбитали, пик в полёте */
  glow: number
}

export type NaclFrame = {
  atoms: Record<NaclAtomId, THREE.Vector3>
  radius: Record<NaclAtomId, number>
  charge: Record<NaclAtomId, number>
  opacity: Record<NaclAtomId, number>
  emissive: Record<NaclAtomId, number>
  /** связь Cl–Cl */
  bond: { order: number; stress: number; split: number; opacity: number }
  /** рёбра кубического фрагмента (прозрачность) */
  edges: number
  electrons: [NaclElectronState, NaclElectronState]
  /** подсветка 3s-орбитали каждого натрия, 0..1 */
  orbital: { na1: number; na2: number }
  /** сила «линий притяжения» между ионами пары, 0..1 */
  attract: number
  env: { exo: number; fade: number }
  labels: NaclLabelState[]
  camera: { zoom: number; offset: THREE.Vector3; yaw: number; roll: number; shake: number; bloom: number; vignette: number }
  /** центр фрагмента решётки (для ореола и подписей) */
  cubeCenter: THREE.Vector3
}

function v3(): THREE.Vector3 {
  return new THREE.Vector3()
}

export function createNaclFrame(): NaclFrame {
  const atoms = {} as Record<NaclAtomId, THREE.Vector3>
  const radius = {} as Record<NaclAtomId, number>
  const charge = {} as Record<NaclAtomId, number>
  const opacity = {} as Record<NaclAtomId, number>
  const emissive = {} as Record<NaclAtomId, number>
  for (const a of NACL_ATOMS) {
    atoms[a.id] = v3()
    radius[a.id] = a.el === 'Na' ? R.na : R.cl
    charge[a.id] = 0
    opacity[a.id] = a.main ? 1 : 0
    emissive[a.id] = 0.08
  }
  const electron = (id: 'e1' | 'e2'): NaclElectronState => ({
    id,
    pos: v3(),
    from: v3(),
    to: v3(),
    perp: v3(),
    arc: 0.28,
    progress: 0,
    opacity: 0,
    glow: 0,
  })
  return {
    atoms,
    radius,
    charge,
    opacity,
    emissive,
    bond: { order: 1, stress: 0, split: 0, opacity: 1 },
    edges: 0,
    electrons: [electron('e1'), electron('e2')],
    orbital: { na1: 0, na2: 0 },
    attract: 0,
    env: { exo: 0, fade: 0 },
    labels: NACL_LABELS.map((l) => ({ id: l.id, kind: l.kind, pos: v3(), opacity: 0, text: l.keys[0]!.text })),
    camera: { zoom: 1, offset: v3(), yaw: 0, roll: 0, shake: 0, bloom: 0.3, vignette: 0.3 },
    cubeCenter: v3(),
  }
}

const _dir = new THREE.Vector3()
const _z = new THREE.Vector3(0, 0, 1)

/** Точка на дуге прыжка электрона при параметре p ∈ [0, 1] (без аллокаций). */
export function naclElectronPoint(el: NaclElectronState, p: number, out: THREE.Vector3): THREE.Vector3 {
  out.copy(el.from).lerp(el.to, p)
  const bump = Math.sin(Math.PI * p)
  return out.addScaledVector(el.perp, el.arc * bump)
}

function sampleElectron(
  el: NaclElectronState,
  t: number,
  na: THREE.Vector3,
  cl: THREE.Vector3,
  rCl: number,
  timing: { leave: number; arrive: number },
  phase: number,
): void {
  _dir.copy(cl).sub(na)
  if (_dir.lengthSq() < 1e-8) _dir.set(1, 0, 0)
  _dir.normalize()
  el.from.copy(na).addScaledVector(_dir, NACL_GEOM.orbital3s)
  el.to.copy(cl).addScaledVector(_dir, -rCl * 0.55)
  el.perp.copy(_dir).cross(_z)
  if (el.perp.lengthSq() < 1e-8) el.perp.set(0, 1, 0)
  el.perp.normalize()
  // Знак дуги: у верхней пары выпуклость вверх, у нижней — вниз (симметрия кадра).
  el.arc = 0.28 * Math.sign(na.y || 1)

  const show = timing.leave - 1.4
  if (t < show) {
    el.opacity = 0
    el.progress = 0
    el.glow = 0
    el.pos.copy(el.from)
    return
  }
  if (t < timing.leave) {
    // На 3s-орбитали: медленно обходит атом, разгорается перед прыжком.
    const u = norm(show, timing.leave, t)
    // Плоскость орбиты — xy; обход заканчивается в точке старта прыжка (со стороны хлора).
    const start = Math.atan2(_dir.y, _dir.x)
    const a = start + (1 - u) * (Math.PI * 1.6) * (phase >= 0 ? 1 : -1)
    el.pos.set(na.x + Math.cos(a) * NACL_GEOM.orbital3s, na.y + Math.sin(a) * NACL_GEOM.orbital3s, na.z + 0.02)
    el.opacity = smoothstep(0, 0.25, u)
    el.progress = 0
    el.glow = 0.35 + 0.65 * smoothstep(0.55, 1, u)
    return
  }
  const p = smoothstep(0, 1, norm(timing.leave, timing.arrive, t))
  const pe = p * p * (3 - 2 * p)
  el.progress = pe
  naclElectronPoint(el, pe, el.pos)
  el.glow = 1
  // Прибыл — растворяется в электронной оболочке хлора.
  el.opacity = t <= timing.arrive ? 1 : 1 - smoothstep(0, 0.5, t - timing.arrive)
}

function labelText(def: NaclLabelDef, t: number): string {
  let text = def.keys[0]!.text
  for (const k of def.keys) if (t >= k.t) text = k.text
  return text
}

function labelOpacity(def: NaclLabelDef, t: number): number {
  let o = 0
  for (const w of def.windows) o = Math.max(o, windowFade(w, t, 0.25))
  return o
}

/**
 * Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций).
 */
export function sampleNaclFrame(t: number, frame: NaclFrame): NaclFrame {
  const { atoms, radius, charge, opacity, emissive } = frame

  for (const a of NACL_ATOMS) sampleVec3(POS[a.id], t, atoms[a.id])

  radius.na1 = sampleScalar(RADIUS_NA, t)
  radius.na2 = sampleScalar(RADIUS_NA2, t)
  radius.clA = sampleScalar(RADIUS_CL, t)
  radius.clB = sampleScalar(RADIUS_CL2, t)
  radius.na3 = radius.na4 = R.naCation
  radius.clC = radius.clD = R.clAnion

  charge.na1 = sampleScalar(CHARGE_NA, t)
  charge.na2 = sampleScalar(CHARGE_NA2, t)
  charge.clA = sampleScalar(CHARGE_CL, t)
  charge.clB = sampleScalar(CHARGE_CL2, t)
  charge.na3 = charge.na4 = 1
  charge.clC = charge.clD = -1

  const back = sampleScalar(BACK_OPACITY, t)
  opacity.na1 = opacity.na2 = opacity.clA = opacity.clB = 1
  opacity.na3 = opacity.na4 = opacity.clC = opacity.clD = back

  // ——— Орбиталь 3s: разгорается перед прыжком, гаснет, когда электрон ушёл ———
  frame.orbital.na1 = windowFade([T_E1.leave - 1.4, T_E1.leave + 0.25], t, 0.45)
  frame.orbital.na2 = windowFade([T_E2.leave - 1.4, T_E2.leave + 0.25], t, 0.45)

  // ——— Электроны ———
  sampleElectron(frame.electrons[0], t, atoms.na1, atoms.clA, radius.clA, T_E1, 0.4)
  sampleElectron(frame.electrons[1], t, atoms.na2, atoms.clB, radius.clB, T_E2, -0.4)

  // ——— Связь Cl–Cl и рёбра решётки ———
  frame.bond.order = 1
  frame.bond.stress = sampleScalar(BOND_STRESS, t)
  frame.bond.split = sampleScalar(BOND_SPLIT, t)
  frame.bond.opacity = sampleScalar(BOND_OPACITY, t)
  frame.edges = sampleScalar(EDGES, t)

  // ——— Притяжение ионов ———
  frame.attract = windowFade([12.3, T_CONTACT + 0.15], t, 0.5)

  // ——— Энергия: пик на cue exo, потом ровное тёплое свечение ———
  const rise = smoothstep(T_EXO - 0.7, T_EXO, t)
  const settle = 1 - 0.55 * smoothstep(T_EXO, T_EXO + 1.6, t)
  const exo = rise * settle
  frame.env.exo = exo
  frame.env.fade = sampleScalar(FADE, t)

  for (const a of NACL_ATOMS) {
    const base = a.el === 'Na' ? 0.1 : 0.08
    let e = base + exo * 0.42
    if (a.id === 'na1') e += frame.orbital.na1 * 0.3
    if (a.id === 'na2') e += frame.orbital.na2 * 0.3
    emissive[a.id] = e
  }

  // ——— Центр решётки ———
  frame.cubeCenter.copy(atoms.na1).add(atoms.na2).add(atoms.clA).add(atoms.clB).multiplyScalar(0.25)
  if (back > 0) {
    const bz = mix(0, -HALF, back)
    frame.cubeCenter.z = mix(frame.cubeCenter.z, (frame.cubeCenter.z + bz) * 0.5, back)
  }

  // ——— Подписи ———
  for (let i = 0; i < NACL_LABELS.length; i++) {
    const def = NACL_LABELS[i]!
    const st = frame.labels[i]!
    st.text = labelText(def, t)
    const o = labelOpacity(def, t)
    if (def.anchor === 'cube') {
      st.pos.copy(frame.cubeCenter)
      st.pos.y += def.dy
    } else if (def.anchor === 'cl2') {
      st.pos.copy(atoms.clA).lerp(atoms.clB, 0.5)
      st.pos.x += radius.clA + 0.22
      st.pos.y += def.dy - 0.2
    } else {
      const p = atoms[def.anchor]
      const r = radius[def.anchor]
      st.pos.copy(p)
      st.pos.y += def.dy > 0 ? r + def.dy : -(r + -def.dy)
    }
    st.opacity = o * (1 - frame.env.fade)
  }

  // ——— Камера ———
  const cam = frame.camera
  cam.zoom = sampleScalar(CAM_ZOOM, t)
  sampleVec3(CAM_OFFSET, t, cam.offset)
  cam.yaw = sampleScalar(CAM_YAW, t)
  cam.roll = sampleScalar(CAM_ROLL, t)
  cam.shake = 0.35 * Math.max(0, 1 - Math.abs(t - T_BREAK) / 0.35) + 0.5 * Math.max(0, 1 - Math.abs(t - T_EXO) / 0.5)
  cam.bloom = 0.3 + 0.25 * frame.orbital.na1 + 0.75 * exo
  cam.vignette = 0.3 + 0.15 * exo
  return frame
}

/** Рёбра кубического фрагмента: пары индексов NACL_ATOMS (Na–Cl по каждому ребру). */
export const NACL_EDGES: readonly (readonly [NaclAtomId, NaclAtomId])[] = [
  // передняя грань (z = +HALF): na1 (−,+) clA (+,+) na2 (+,−) clB (−,−)
  ['na1', 'clA'],
  ['clA', 'na2'],
  ['na2', 'clB'],
  ['clB', 'na1'],
  // задняя грань (z = −HALF): clD (−,+) na4 (+,+) clC (+,−) na3 (−,−)
  ['clD', 'na4'],
  ['na4', 'clC'],
  ['clC', 'na3'],
  ['na3', 'clD'],
  // рёбра вглубь
  ['na1', 'clD'],
  ['clA', 'na4'],
  ['na2', 'clC'],
  ['clB', 'na3'],
]

/** Проверка порядка ключей — в dev и в тестах. */
export function validateNaclStoryboard(): void {
  for (const id of Object.keys(POS) as NaclAtomId[]) validateTrack(`pos.${id}`, POS[id])
  const scalars: Record<string, ScalarTrack> = {
    RADIUS_NA,
    RADIUS_NA2,
    RADIUS_CL,
    RADIUS_CL2,
    CHARGE_NA,
    CHARGE_NA2,
    CHARGE_CL,
    CHARGE_CL2,
    BACK_OPACITY,
    BOND_STRESS,
    BOND_SPLIT,
    BOND_OPACITY,
    EDGES,
    CAM_ZOOM,
    CAM_YAW,
    CAM_ROLL,
    FADE,
  }
  for (const [name, track] of Object.entries(scalars)) validateTrack(name, track)
  validateTrack('CAM_OFFSET', CAM_OFFSET)
  for (const l of NACL_LABELS) validateTrack(`label.${l.id}`, l.keys)
  // Решётка: каждое ребро соединяет катион с анионом.
  for (const [a, b] of NACL_EDGES) {
    const ea = NACL_ATOMS.find((x) => x.id === a)!.el
    const eb = NACL_ATOMS.find((x) => x.id === b)!.el
    if (ea === eb) throw new Error(`nacl lattice edge ${a}–${b} joins two ${ea}`)
  }
}
