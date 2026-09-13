import * as THREE from 'three'
import { ang, BOND_ANGLE_DEG, BOND_LENGTH_A } from '../../core/atoms'
import { ease, mix, norm, type EaseName } from '../../core/easing'
import type { BondState } from '../../core/states'
import {
  jitter,
  sampleScalar,
  sampleVec3,
  validateTrack,
  windowFade,
  type ScalarTrack,
  type Vec3Track,
} from '../../core/tracks'
import { CLO2_END } from './clo2Steps'

export * from './clo2Steps'

/**
 * Раскадровка механизма получения ClO₂ в растворе (см. clo2Steps.ts).
 *
 * Всё здесь — данные и чистая функция sampleClo2Frame(t): по времени сюжета она
 * раскладывает мир — атомы, связи, отдельные электроны, стрелки движения пар,
 * подписи, камеру. Сцена только копирует результат в меши, тест проверяет тот
 * же результат в Node. Поэтому «что показано» и «что проверено» не расходятся.
 *
 * Идентичность частиц сквозная, как в реальной реакции:
 *   хлорит A = clA, oA1 (атакующий кислород), oA2;
 *   хлорит B = clB, oB1 (атакующий кислород), oB2;
 *   Cl₂ = clX (станет Cl⁺ в ClOClO, потом второй Cl⁻) + clY (первый Cl⁻);
 *   na1, na2 — ионы-наблюдатели.
 * Электроны e1/e2 — неподелённая пара oA1, e3/e4 — пара связи Cl–Cl,
 * e5/e6 — неподелённая пара oB1. Каждый электрон едет по своей дорожке
 * от старта до финала: пары переходят в связи и из связей, а при гомолизе
 * e5 уходит к хлорит-половине A, e6 — к половине B (их неспаренные электроны).
 */

// ——— Геометрия (мировые единицы сцены; 1 Å = 0.285) ———
export const CLO2_GEOM = {
  clOChlorite: ang(BOND_LENGTH_A.ClO_chlorite),
  clORadical: ang(BOND_LENGTH_A.ClO_radical),
  clCl: ang(BOND_LENGTH_A.ClCl),
  /** O–Cl в ClOClO: как одинарная связь в HOCl, ≈1.69 Å (схематично) */
  oClNew: ang(1.69),
  /** O–Cl мостик короткоживущего комплекса — длиннее обычной связи (схематично) */
  oClAdduct: ang(1.85),
  angle: {
    chlorite: BOND_ANGLE_DEG.chlorite,
    radical: BOND_ANGLE_DEG.clo2,
  },
  /**
   * Радиусы «шарик-палочка»: доля ковалентного радиуса, чтобы между атомами были видны
   * связи с полосами порядка и лепестки орбиталей (пропорции элементов сохранены).
   */
  radius: {
    cl: ang(1.02) * 0.58,
    o: ang(0.66) * 0.62,
    /** Na⁺ — ионный радиус 1.02 Å, заметно меньше нейтрального атома */
    na: ang(1.02) * 0.5,
    /** Cl⁻ — ионный радиус 1.81 Å: принятая пара «раздувает» оболочку */
    clAnion: ang(1.81) * 0.4,
  },
} as const

/** Масштаб CinemaCameraRig — нужен, чтобы центрировать фокус кадра. */
export const CLO2_RIG_SCALE = 1.1

/** Угол между связью O→Cl и направлением неподелённой пары кислорода (≈110° при O). */
const LONE_PAIR_OFFSET_DEG = 70
/**
 * Отклонение атакующего O от плоскости O–Cl–O. У Cl в комплексе три O и неподелённая
 * пара (AX₃E) — это пирамида, как у ClO₃⁻: при 59° углы O–Cl–O ≈ 107°.
 */
const ATTACK_OUT_OF_PLANE_DEG = 59

export type Clo2AtomId = 'clA' | 'oA1' | 'oA2' | 'clB' | 'oB1' | 'oB2' | 'clX' | 'clY' | 'na1' | 'na2'
export type Clo2Element = 'Cl' | 'O' | 'Na'

export const CLO2_ATOMS: ReadonlyArray<{ id: Clo2AtomId; element: Clo2Element; charge: 0 | 1 }> = [
  { id: 'clA', element: 'Cl', charge: 0 },
  { id: 'oA1', element: 'O', charge: 0 },
  { id: 'oA2', element: 'O', charge: 0 },
  { id: 'clB', element: 'Cl', charge: 0 },
  { id: 'oB1', element: 'O', charge: 0 },
  { id: 'oB2', element: 'O', charge: 0 },
  { id: 'clX', element: 'Cl', charge: 0 },
  { id: 'clY', element: 'Cl', charge: 0 },
  { id: 'na1', element: 'Na', charge: 1 },
  { id: 'na2', element: 'Na', charge: 1 },
]

export type Clo2BondId = 'clA_oA1' | 'clA_oA2' | 'clB_oB1' | 'clB_oB2' | 'clX_clY' | 'oA1_clX' | 'oB1_clA'

export const CLO2_BONDS: ReadonlyArray<{ id: Clo2BondId; a: Clo2AtomId; b: Clo2AtomId }> = [
  { id: 'clA_oA1', a: 'clA', b: 'oA1' },
  { id: 'clA_oA2', a: 'clA', b: 'oA2' },
  { id: 'clB_oB1', a: 'clB', b: 'oB1' },
  { id: 'clB_oB2', a: 'clB', b: 'oB2' },
  { id: 'clX_clY', a: 'clX', b: 'clY' },
  { id: 'oA1_clX', a: 'oA1', b: 'clX' },
  { id: 'oB1_clA', a: 'oB1', b: 'clA' },
]

// ——— Якоря: где находится электрон / конец стрелки / подпись ———
type DirSpec =
  | { toward: Clo2AtomId }
  | { away: Clo2AtomId }
  /** lpA/lpB — неподелённая пара атакующего кислорода; attackA — позиция третьей связи у clA */
  | { vec: 'lpA' | 'lpB' | 'attackA' | 'up' }

export type Clo2Anchor =
  | { k: 'atom'; atom: Clo2AtomId; dir: DirSpec; side: number }
  | { k: 'bond'; a: Clo2AtomId; b: Clo2AtomId; side: number; lift?: number }
  /**
   * Точка сбоку от атома, перпендикулярно направлению atom→ref — концы стрелок, обходящих атомы дугой.
   * Знак side отсчитывается от направления atom→ref: для той же стороны, что у bond(ref, atom), side совпадает,
   * а у bond(atom, ref) — противоположен.
   */
  | { k: 'rim'; atom: Clo2AtomId; ref: Clo2AtomId; side: number; along?: number }
  | { k: 'cloud'; unit: 'A' | 'B' }
  /** точка в лепестке π* 2b1 над атомом Cl радикала (у орбитали узел в плоскости молекулы) */
  | { k: 'somo'; unit: 'A' | 'B' }
  | { k: 'center'; atom: Clo2AtomId }

type AnchorKey = { t: number; a: Clo2Anchor; ease?: EaseName; arc?: number }

const atomDir = (atom: Clo2AtomId, dir: DirSpec, side = 0): Clo2Anchor => ({ k: 'atom', atom, dir, side })
const onBond = (a: Clo2AtomId, b: Clo2AtomId, side = 0): Clo2Anchor => ({ k: 'bond', a, b, side })
const liftedBond = (a: Clo2AtomId, b: Clo2AtomId, side: number, lift: number): Clo2Anchor => ({ k: 'bond', a, b, side, lift })
const rim = (atom: Clo2AtomId, ref: Clo2AtomId, side: number, along = 0): Clo2Anchor => ({ k: 'rim', atom, ref, side, along })

// ——— Дорожки молекулярных фреймов ———
/** Хлорит A стоит на месте всю реакцию: к нему привязаны атакующие частицы. */
const UNIT_A = {
  center: [
    { t: 0, v: [-1.25, -0.22, -0.1] },
    { t: 5, v: [-1.0, -0.3, 0] },
    { t: 21, v: [-1.0, -0.3, 0] },
    { t: 23, v: [-1.2, -0.15, 0.1], ease: 'inOutSine' },
    { t: 27, v: [-1.35, -0.05, 0.15], ease: 'inOutSine' },
    { t: CLO2_END, v: [-1.4, 0, 0.15], ease: 'inOutSine' },
  ] satisfies Vec3Track,
  /** направление oA1 в плоскости кадра, градусы: 70° — неподелённая пара oA1 смотрит строго вправо */
  heading: [
    { t: 0, v: 82 },
    { t: 5, v: 70 },
    { t: 21, v: 70 },
    { t: 23, v: 60, ease: 'inOutSine' },
    { t: CLO2_END, v: 38, ease: 'inOutSine' },
  ] satisfies ScalarTrack,
  // После распада молекула наклоняется: p-лепестки π* (перпендикулярны плоскости) видны сбоку, а не торцом.
  tilt: [
    { t: 0, v: 0.25 },
    { t: 5, v: 0 },
    { t: 21, v: 0 },
    { t: 23, v: 0.95, ease: 'inOutSine' },
    { t: CLO2_END, v: 1.05, ease: 'inOutSine' },
  ] satisfies ScalarTrack,
} as const

/** Геометрия хлорит → радикал ClO₂: общая для обеих половин, меняется только после распада. */
const RADICAL_FORM = {
  angle: [
    { t: 0, v: CLO2_GEOM.angle.chlorite },
    { t: 20.8, v: CLO2_GEOM.angle.chlorite },
    { t: 22.4, v: CLO2_GEOM.angle.radical, ease: 'outBack' },
  ] satisfies ScalarTrack,
  bond: [
    { t: 0, v: CLO2_GEOM.clOChlorite },
    { t: 20.8, v: CLO2_GEOM.clOChlorite },
    { t: 22.4, v: CLO2_GEOM.clORadical, ease: 'outCubic' },
  ] satisfies ScalarTrack,
} as const

const CL2_FREE = {
  center: [
    { t: 0, v: [0.6, 3.1, 0.2] },
    { t: 3.45, v: [0.9, 0.95, 0.1], ease: 'outCubic' },
    { t: 5, v: [0.75, 0.34, 0.05], ease: 'inOutSine' },
  ] satisfies Vec3Track,
  axis: [
    { t: 0, v: 40 },
    { t: 3.45, v: 18, ease: 'inOutSine' },
    { t: 5, v: 0, ease: 'inOutSine' },
  ] satisfies ScalarTrack,
} as const

/** Выравнивание Cl₂ по неподелённой паре oA1 и дистанции вдоль этой оси. */
const CL2_ALIGN = {
  weightX: [
    { t: 5.2, v: 0 },
    { t: 7.6, v: 1, ease: 'inOutSine' },
    { t: 21.0, v: 1 },
    { t: 22.2, v: 0, ease: 'inOutSine' },
  ] satisfies ScalarTrack,
  weightY: [
    { t: 5.2, v: 0 },
    { t: 7.6, v: 1, ease: 'inOutSine' },
    { t: 11.0, v: 1 },
    { t: 12.2, v: 0, ease: 'inOutSine' },
  ] satisfies ScalarTrack,
  /** oA1 ··· clX: подход → новая связь O–Cl → отрыв Cl⁻ на распаде */
  sX: [
    { t: 5.2, v: 1.25 },
    { t: 8, v: 0.8, ease: 'inOutSine' },
    { t: 9.3, v: 0.8 },
    { t: 10.2, v: CLO2_GEOM.oClNew, ease: 'inOutCubic' },
    { t: 20.35, v: CLO2_GEOM.oClNew },
    { t: 21.0, v: 1.0, ease: 'outCubic' },
  ] satisfies ScalarTrack,
  /** clX — clY: натяжение до разрыва, затем уход хлорид-иона */
  dXY: [
    { t: 5.2, v: CLO2_GEOM.clCl },
    { t: 8, v: CLO2_GEOM.clCl * 1.03 },
    { t: 9.3, v: CLO2_GEOM.clCl * 1.06 },
    { t: 10.15, v: CLO2_GEOM.clCl * 1.24, ease: 'inQuad' },
    { t: 11.0, v: 1.25, ease: 'outCubic' },
    { t: 11.6, v: 1.6, ease: 'outQuad' },
  ] satisfies ScalarTrack,
} as const

const UNIT_B = {
  align: [
    { t: 15, v: 0 },
    { t: 16.6, v: 1, ease: 'inOutSine' },
    { t: 21.6, v: 1 },
    { t: 23, v: 0, ease: 'inOutSine' },
  ] satisfies ScalarTrack,
  /** oB1 ··· clA вдоль биссектрисы хлорита A */
  s: [
    { t: 15, v: 1.5 },
    { t: 17.0, v: 1.0, ease: 'inOutSine' },
    { t: 18.15, v: CLO2_GEOM.oClAdduct, ease: 'inOutCubic' },
    { t: 20.35, v: CLO2_GEOM.oClAdduct },
    { t: 21.6, v: 1.4, ease: 'outCubic' },
  ] satisfies ScalarTrack,
} as const

// ——— Свободные дорожки частиц (вне выравнивания) ———
const NA = {
  na1: [
    { t: 0, v: [-2.55, 0.95, -0.8] },
    { t: 15, v: [-2.35, 1.05, -0.7], ease: 'inOutSine' },
    { t: CLO2_END, v: [-2.2, 1.15, -0.6], ease: 'inOutSine' },
  ] satisfies Vec3Track,
  na2: [
    { t: 0, v: [2.75, 0.55, -1.0] },
    { t: 15, v: [2.75, 0.15, -0.9], ease: 'inOutSine' },
    { t: CLO2_END, v: [2.9, -0.7, -0.8], ease: 'inOutSine' },
  ] satisfies Vec3Track,
} as const

// ——— Рабочие объекты сэмплера (без аллокаций в горячем цикле) ———
export type UnitFrame = {
  cl: THREE.Vector3
  o1: THREE.Vector3
  o2: THREE.Vector3
  d: THREE.Vector3
  q: THREE.Vector3
  lp: THREE.Vector3
  bis: THREE.Vector3
  /** направление третьей связи центрального Cl (пирамида AX₃E): куда встаёт атакующий O */
  attack: THREE.Vector3
  headingDeg: number
}

function createUnitFrame(): UnitFrame {
  return {
    cl: new THREE.Vector3(),
    o1: new THREE.Vector3(),
    o2: new THREE.Vector3(),
    d: new THREE.Vector3(),
    q: new THREE.Vector3(),
    lp: new THREE.Vector3(),
    bis: new THREE.Vector3(),
    attack: new THREE.Vector3(),
    headingDeg: 0,
  }
}

const DEG = Math.PI / 180
const _z = new THREE.Vector3(0, 0, 1)
const _t1 = new THREE.Vector3()
const _t2 = new THREE.Vector3()

/**
 * Уголковая частица X(O₂): o1 по курсу heading, o2 под углом angle в плоскости,
 * наклонённой на tilt вокруг оси o1. lp — неподелённая пара o1 со стороны,
 * противоположной o2; bis — биссектриса угла O–Cl–O.
 */
function writeUnit(out: UnitFrame, center: THREE.Vector3, headingDeg: number, tilt: number, angleDeg: number, bond: number): void {
  const h = headingDeg * DEG
  out.headingDeg = headingDeg
  out.d.set(Math.cos(h), Math.sin(h), 0)
  // q' = cos τ · q + sin τ · z, где q — перпендикуляр к d в плоскости кадра
  out.q.set(-Math.sin(h) * Math.cos(tilt), Math.cos(h) * Math.cos(tilt), Math.sin(tilt))
  const a = angleDeg * DEG
  out.cl.copy(center)
  out.o1.copy(center).addScaledVector(out.d, bond)
  _t1.copy(out.d).multiplyScalar(Math.cos(a)).addScaledVector(out.q, Math.sin(a))
  out.o2.copy(center).addScaledVector(_t1, bond)
  const lpa = LONE_PAIR_OFFSET_DEG * DEG
  out.lp.copy(out.d).multiplyScalar(Math.cos(lpa)).addScaledVector(out.q, -Math.sin(lpa))
  out.bis.copy(out.d).add(_t1).normalize()
  // нормаль плоскости d × q' смотрит к камере (+z) при tilt = 0
  const oop = ATTACK_OUT_OF_PLANE_DEG * DEG
  _t1.copy(out.d).cross(out.q).normalize()
  out.attack.copy(out.bis).multiplyScalar(-Math.cos(oop)).addScaledVector(_t1, Math.sin(oop)).normalize()
}

// ——— Кадр мира ———
export type Clo2ElectronId = 'e1' | 'e2' | 'e3' | 'e4' | 'e5' | 'e6' | 'tokA' | 'tokB'

export type Clo2ElectronState = { id: Clo2ElectronId; pos: THREE.Vector3; opacity: number; glow: number; token: boolean }

export type Clo2ArrowState = {
  id: string
  kind: 'pair' | 'single'
  p0: THREE.Vector3
  p1: THREE.Vector3
  ctrl: THREE.Vector3
  /** 0..1 — насколько стрелка «прорисована» */
  draw: number
  opacity: number
}

export type Clo2LabelKind = 'ox' | 'species' | 'delta' | 'token'

export type Clo2LabelState = {
  id: string
  kind: Clo2LabelKind
  pos: THREE.Vector3
  opacity: number
  text: string
}

export type Clo2Frame = {
  t: number
  atoms: Record<Clo2AtomId, THREE.Vector3>
  /** 0..1: нейтральный атом хлора → хлорид-ион (растёт радиус) */
  anion: { clX: number; clY: number }
  bonds: Record<Clo2BondId, BondState>
  electrons: Clo2ElectronState[]
  arrows: Clo2ArrowState[]
  labels: Clo2LabelState[]
  /** облако неспаренного электрона радикала ClO₂ (π*, делокализовано по O–Cl–O) */
  clouds: { A: { center: THREE.Vector3; amount: number }; B: { center: THREE.Vector3; amount: number } }
  /** гидратная оболочка ионов в растворе (схематичное свечение) */
  hydration: { na1: number; na2: number; clX: number; clY: number }
  env: {
    medium: number
    bubble: { center: THREE.Vector3; opacity: number; scale: number }
    cl2Gas: number
    clo2Tint: number
    productGas: number
    exo: number
    fade: number
  }
  camera: { zoom: number; offset: THREE.Vector3; yaw: number; roll: number; shake: number; bloom: number; vignette: number }
  unitA: UnitFrame
  unitB: UnitFrame
  /** химия связей: порядок (школьная модель) и характер разрыва — для InstancedBonds */
  bondChem: Record<Clo2BondId, { order: number; split: number }>
  /** видимость орбиталей 0..1 (рендерер раскладывает лепестки по фреймам молекул) */
  orbitals: Clo2OrbitalState
  /** множители амплитуды колебаний (реальные частоты — core/chem/vibration) */
  vibration: { cl2: number; radicalA: number; radicalB: number; chlorite: number }
}

export type Clo2OrbitalState = {
  /** неподелённая пара атакующего O хлорита A (донор на шаге 3) */
  lonePairA: number
  /** неподелённая пара атакующего O хлорита B (донор на шаге 5) */
  lonePairB: number
  /** пустая σ*(Cl–Cl) — акцептор пары на шаге 3 (контур) */
  sigmaStarCl2: number
  /** π* 2b1 радикалов ClO₂ — заселена одним электроном */
  somoA: number
  somoB: number
}

const ELECTRON_IDS: readonly Clo2ElectronId[] = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'tokA', 'tokB']

export function createClo2Frame(): Clo2Frame {
  const atoms = {} as Record<Clo2AtomId, THREE.Vector3>
  for (const a of CLO2_ATOMS) atoms[a.id] = new THREE.Vector3()
  const bonds = {} as Record<Clo2BondId, BondState>
  for (const b of CLO2_BONDS) {
    bonds[b.id] = { from: new THREE.Vector3(), to: new THREE.Vector3(), stress: 0, opacity: 0, form: 1, thinning: 0 }
  }
  const bondChem = {} as Record<Clo2BondId, { order: number; split: number }>
  for (const b of CLO2_BONDS) bondChem[b.id] = { order: 1, split: 0 }
  return {
    bondChem,
    orbitals: { lonePairA: 0, lonePairB: 0, sigmaStarCl2: 0, somoA: 0, somoB: 0 },
    vibration: { cl2: 0, radicalA: 0, radicalB: 0, chlorite: 0 },
    t: 0,
    atoms,
    anion: { clX: 0, clY: 0 },
    bonds,
    electrons: ELECTRON_IDS.map((id) => ({
      id,
      pos: new THREE.Vector3(),
      opacity: 0,
      glow: 0,
      token: id.startsWith('tok'),
    })),
    arrows: CLO2_ARROWS.map((a) => ({
      id: a.id,
      kind: a.kind,
      p0: new THREE.Vector3(),
      p1: new THREE.Vector3(),
      ctrl: new THREE.Vector3(),
      draw: 0,
      opacity: 0,
    })),
    labels: CLO2_LABELS.map((l) => ({ id: l.id, kind: l.kind, pos: new THREE.Vector3(), opacity: 0, text: l.keys[0]!.text })),
    clouds: { A: { center: new THREE.Vector3(), amount: 0 }, B: { center: new THREE.Vector3(), amount: 0 } },
    hydration: { na1: 0, na2: 0, clX: 0, clY: 0 },
    env: {
      medium: 0,
      bubble: { center: new THREE.Vector3(), opacity: 0, scale: 1 },
      cl2Gas: 0,
      clo2Tint: 0,
      productGas: 0,
      exo: 0,
      fade: 0,
    },
    camera: { zoom: 1, offset: new THREE.Vector3(), yaw: 0, roll: 0, shake: 0, bloom: 0.3, vignette: 0.3 },
    unitA: createUnitFrame(),
    unitB: createUnitFrame(),
  }
}

// ——— Электроны ———
const ELECTRONS: Record<Clo2ElectronId, { keys: readonly AnchorKey[]; opacity: ScalarTrack; glow: ScalarTrack }> = {
  // Неподелённая пара oA1 → связь O–Cl (шаг 3) → целиком к clX при распаде (шаг 6)
  e1: {
    keys: [
      { t: 0, a: atomDir('oA1', { vec: 'lpA' }, 1) },
      { t: 9.3, a: atomDir('oA1', { vec: 'lpA' }, 1) },
      { t: 10.2, a: onBond('oA1', 'clX', 1), ease: 'inOutSine', arc: 0.05 },
      { t: 19.8, a: onBond('oA1', 'clX', 1) },
      { t: 20.35, a: atomDir('clX', { away: 'oA1' }, 1), ease: 'inOutSine', arc: 0.05 },
    ],
    opacity: [
      { t: 5.3, v: 0 },
      { t: 6.2, v: 1 },
      { t: 26.8, v: 1 },
      { t: 27.4, v: 0.45 },
    ],
    glow: [
      { t: 8.2, v: 0 },
      { t: 8.6, v: 1 },
      { t: 10.4, v: 1 },
      { t: 10.9, v: 0 },
      { t: 19.4, v: 0 },
      { t: 19.8, v: 1 },
      { t: 20.5, v: 1 },
      { t: 21.0, v: 0 },
    ],
  },
  e2: {
    keys: [
      { t: 0, a: atomDir('oA1', { vec: 'lpA' }, -1) },
      { t: 9.3, a: atomDir('oA1', { vec: 'lpA' }, -1) },
      { t: 10.2, a: onBond('oA1', 'clX', -1), ease: 'inOutSine', arc: -0.05 },
      { t: 19.8, a: onBond('oA1', 'clX', -1) },
      { t: 20.35, a: atomDir('clX', { away: 'oA1' }, -1), ease: 'inOutSine', arc: -0.05 },
    ],
    opacity: [
      { t: 5.3, v: 0 },
      { t: 6.2, v: 1 },
      { t: 26.8, v: 1 },
      { t: 27.4, v: 0.45 },
    ],
    glow: [
      { t: 8.2, v: 0 },
      { t: 8.6, v: 1 },
      { t: 10.4, v: 1 },
      { t: 10.9, v: 0 },
      { t: 19.4, v: 0 },
      { t: 19.8, v: 1 },
      { t: 20.5, v: 1 },
      { t: 21.0, v: 0 },
    ],
  },
  // Пара связи Cl–Cl → целиком к clY (гетеролиз, шаг 3)
  e3: {
    keys: [
      { t: 0, a: onBond('clX', 'clY', 1) },
      { t: 9.3, a: onBond('clX', 'clY', 1) },
      { t: 10.3, a: atomDir('clY', { away: 'clX' }, 1), ease: 'inOutSine', arc: 0.06 },
    ],
    opacity: [
      { t: 5.3, v: 0 },
      { t: 6.2, v: 1 },
      { t: 26.8, v: 1 },
      { t: 27.4, v: 0.45 },
    ],
    glow: [
      { t: 8.6, v: 0 },
      { t: 9.0, v: 1 },
      { t: 10.5, v: 1 },
      { t: 11.0, v: 0 },
    ],
  },
  e4: {
    keys: [
      { t: 0, a: onBond('clX', 'clY', -1) },
      { t: 9.3, a: onBond('clX', 'clY', -1) },
      { t: 10.3, a: atomDir('clY', { away: 'clX' }, -1), ease: 'inOutSine', arc: -0.06 },
    ],
    opacity: [
      { t: 5.3, v: 0 },
      { t: 6.2, v: 1 },
      { t: 26.8, v: 1 },
      { t: 27.4, v: 0.45 },
    ],
    glow: [
      { t: 8.6, v: 0 },
      { t: 9.0, v: 1 },
      { t: 10.5, v: 1 },
      { t: 11.0, v: 0 },
    ],
  },
  // Неподелённая пара oB1 → мостик O–Cl (шаг 5) → поровну при гомолизе (шаг 6)
  e5: {
    keys: [
      { t: 0, a: atomDir('oB1', { vec: 'lpB' }, 1) },
      { t: 17.3, a: atomDir('oB1', { vec: 'lpB' }, 1) },
      { t: 18.1, a: onBond('oB1', 'clA', 1), ease: 'inOutSine', arc: 0.05 },
      { t: 19.9, a: onBond('oB1', 'clA', 1) },
      { t: 20.45, a: atomDir('clA', { vec: 'attackA' }, 0), ease: 'inOutSine', arc: 0.08 },
      { t: 21.2, a: atomDir('clA', { vec: 'attackA' }, 0) },
      { t: 22.4, a: { k: 'somo', unit: 'A' }, ease: 'inOutSine' },
    ],
    opacity: [
      { t: 15.3, v: 0 },
      { t: 16.0, v: 1 },
      { t: 21.6, v: 1 },
      { t: 22.4, v: 0 },
    ],
    glow: [
      { t: 16.8, v: 0 },
      { t: 17.2, v: 1 },
      { t: 18.3, v: 1 },
      { t: 18.8, v: 0 },
      { t: 19.5, v: 0 },
      { t: 19.9, v: 1 },
      { t: 20.8, v: 1 },
      { t: 21.3, v: 0 },
    ],
  },
  e6: {
    keys: [
      { t: 0, a: atomDir('oB1', { vec: 'lpB' }, -1) },
      { t: 17.3, a: atomDir('oB1', { vec: 'lpB' }, -1) },
      { t: 18.1, a: onBond('oB1', 'clA', -1), ease: 'inOutSine', arc: -0.05 },
      { t: 19.9, a: onBond('oB1', 'clA', -1) },
      { t: 20.45, a: atomDir('oB1', { away: 'clA' }, 0), ease: 'inOutSine', arc: -0.08 },
      { t: 21.2, a: atomDir('oB1', { away: 'clA' }, 0) },
      { t: 22.4, a: { k: 'somo', unit: 'B' }, ease: 'inOutSine' },
    ],
    opacity: [
      { t: 15.3, v: 0 },
      { t: 16.0, v: 1 },
      { t: 21.6, v: 1 },
      { t: 22.4, v: 0 },
    ],
    glow: [
      { t: 16.8, v: 0 },
      { t: 17.2, v: 1 },
      { t: 18.3, v: 1 },
      { t: 18.8, v: 0 },
      { t: 19.5, v: 0 },
      { t: 19.9, v: 1 },
      { t: 20.8, v: 1 },
      { t: 21.3, v: 0 },
    ],
  },
  // Итоговый баланс (шаг 8): «призрачные» e⁻ — это бухгалтерия, а не траектория
  tokA: {
    keys: [
      { t: 27.6, a: atomDir('clA', { vec: 'up' }, 0) },
      { t: 29.2, a: atomDir('clX', { vec: 'up' }, 0), ease: 'inOutSine', arc: 0.55 },
    ],
    opacity: [
      { t: 27.5, v: 0 },
      { t: 27.9, v: 1 },
      { t: 30.2, v: 1 },
      { t: 30.8, v: 0 },
    ],
    glow: [{ t: 0, v: 0.6 }],
  },
  tokB: {
    keys: [
      { t: 27.9, a: atomDir('clB', { vec: 'up' }, 0) },
      { t: 29.5, a: atomDir('clY', { vec: 'up' }, 0), ease: 'inOutSine', arc: 0.55 },
    ],
    opacity: [
      { t: 27.8, v: 0 },
      { t: 28.2, v: 1 },
      { t: 30.2, v: 1 },
      { t: 30.8, v: 0 },
    ],
    glow: [{ t: 0, v: 0.6 }],
  },
}

// ——— Стрелки движения электронов ———
type ArrowDef = {
  id: string
  kind: 'pair' | 'single'
  from: Clo2Anchor
  to: Clo2Anchor
  /** выгиб дуги относительно длины стрелки (знак — сторона) */
  bend: number
  draw: readonly [number, number]
  fade: readonly [number, number]
}

/**
 * Стрелки, как в учебнике, рисуются на исходной структуре: геометрия берётся в момент
 * конца прорисовки (draw[1]) и дальше не следует за атомами. Гаснут они, когда
 * электроны начинают двигаться по ним, — дальше путь показывают сами электроны.
 */
export const CLO2_ARROWS: readonly ArrowDef[] = [
  // шаг 3: неподелённая пара O → новая связь O–Cl
  { id: 'lp_to_OCl', kind: 'pair', from: atomDir('oA1', { vec: 'lpA' }), to: liftedBond('oA1', 'clX', -1, 0.2), bend: -0.55, draw: [8.3, 9.1], fade: [9.35, 9.95] },
  // шаг 3: пара связи Cl–Cl → дальний Cl (уходит Cl⁻)
  { id: 'ClCl_to_Cl', kind: 'pair', from: liftedBond('clX', 'clY', -1, 0.2), to: rim('clY', 'clX', 1, -0.12), bend: -0.6, draw: [8.6, 9.25], fade: [9.4, 10.0] },
  // шаг 5: неподелённая пара второго хлорита → мостик к центральному Cl
  { id: 'lpB_to_OCl', kind: 'pair', from: atomDir('oB1', { vec: 'lpB' }), to: liftedBond('oB1', 'clA', 1, 0.2), bend: 0.55, draw: [16.3, 17.1], fade: [17.35, 17.95] },
  // шаг 6: гетеролиз Cl–O — пара целиком к крайнему Cl
  { id: 'OCl_to_Cl', kind: 'pair', from: liftedBond('oA1', 'clX', -1, 0.2), to: rim('clX', 'oA1', 1, -0.1), bend: -0.6, draw: [18.8, 19.5], fade: [19.8, 20.3] },
  // шаг 6: гомолиз мостика — по одному электрону в каждую сторону
  { id: 'bridge_to_ClA', kind: 'single', from: liftedBond('oB1', 'clA', 1, 0.2), to: rim('clA', 'oB1', -1), bend: 0.5, draw: [19.0, 19.7], fade: [19.9, 20.4] },
  { id: 'bridge_to_OB', kind: 'single', from: liftedBond('oB1', 'clA', 1, 0.2), to: rim('oB1', 'clA', 1), bend: -0.5, draw: [19.0, 19.7], fade: [19.9, 20.4] },
]

// ——— Подписи в кадре (язык-нейтральные: формулы, заряды, степени окисления) ———
type LabelDef = {
  id: string
  kind: Clo2LabelKind
  anchor: Clo2Anchor
  offset: readonly [number, number, number]
  window: readonly [number, number]
  keys: readonly { t: number; text: string }[]
}

const center = (atom: Clo2AtomId): Clo2Anchor => ({ k: 'center', atom })

export const CLO2_LABELS: readonly LabelDef[] = [
  { id: 'ox_clA', kind: 'ox', anchor: center('clA'), offset: [-0.12, 0.34, 0.1], window: [1.2, 31.2], keys: [{ t: 0, text: '+3' }, { t: 21.2, text: '+4' }] },
  { id: 'ox_clB', kind: 'ox', anchor: center('clB'), offset: [0.12, 0.34, 0.1], window: [1.2, 31.2], keys: [{ t: 0, text: '+3' }, { t: 21.2, text: '+4' }] },
  { id: 'ox_clX', kind: 'ox', anchor: center('clX'), offset: [0.3, 0.3, 0.1], window: [3.8, 31.2], keys: [{ t: 0, text: '0' }, { t: 10.25, text: '+1' }, { t: 20.4, text: '−1' }] },
  { id: 'ox_clY', kind: 'ox', anchor: center('clY'), offset: [0, 0.38, 0.1], window: [3.8, 31.2], keys: [{ t: 0, text: '0' }, { t: 10.25, text: '−1' }] },
  { id: 'delta_clX', kind: 'delta', anchor: center('clX'), offset: [0, -0.38, 0.1], window: [6.2, 10.15], keys: [{ t: 0, text: 'δ+' }] },
  { id: 'delta_clY', kind: 'delta', anchor: center('clY'), offset: [0, -0.4, 0.1], window: [6.2, 10.15], keys: [{ t: 0, text: 'δ−' }] },
  { id: 'sp_A_chlorite', kind: 'species', anchor: { k: 'cloud', unit: 'A' }, offset: [-0.1, -0.62, 0], window: [0.8, 9.8], keys: [{ t: 0, text: 'ClO₂⁻' }] },
  { id: 'sp_A_inter', kind: 'species', anchor: center('oA1'), offset: [0.05, 0.62, 0], window: [10.6, 18.0], keys: [{ t: 0, text: 'Cl–O–Cl=O' }] },
  { id: 'sp_adduct', kind: 'species', anchor: center('clA'), offset: [-0.55, 0.72, 0], window: [18.25, 20.25], keys: [{ t: 0, text: '[ClOCl(O)OClO]⁻' }] },
  { id: 'sp_A_radical', kind: 'species', anchor: { k: 'cloud', unit: 'A' }, offset: [0, -0.62, 0], window: [22.0, 31.2], keys: [{ t: 0, text: 'ClO₂' }] },
  { id: 'sp_B_chlorite', kind: 'species', anchor: { k: 'cloud', unit: 'B' }, offset: [0.1, -0.62, 0], window: [0.8, 17.9], keys: [{ t: 0, text: 'ClO₂⁻' }] },
  { id: 'sp_B_radical', kind: 'species', anchor: { k: 'cloud', unit: 'B' }, offset: [0, -0.62, 0], window: [22.0, 31.2], keys: [{ t: 0, text: 'ClO₂' }] },
  { id: 'sp_cl2', kind: 'species', anchor: onBond('clX', 'clY'), offset: [0, 0.46, 0], window: [3.7, 9.2], keys: [{ t: 0, text: 'Cl₂' }] },
  { id: 'sp_clY', kind: 'species', anchor: center('clY'), offset: [0, -0.48, 0], window: [10.9, 31.2], keys: [{ t: 0, text: 'Cl⁻' }] },
  { id: 'sp_clX', kind: 'species', anchor: center('clX'), offset: [0, -0.48, 0], window: [21.0, 31.2], keys: [{ t: 0, text: 'Cl⁻' }] },
  { id: 'sp_na1', kind: 'species', anchor: center('na1'), offset: [0, -0.36, 0], window: [0.8, 31.2], keys: [{ t: 0, text: 'Na⁺' }] },
  { id: 'sp_na2', kind: 'species', anchor: center('na2'), offset: [0, -0.36, 0], window: [0.8, 31.2], keys: [{ t: 0, text: 'Na⁺' }] },
]

// ——— Связи ———
const BOND_TRACKS: Record<Clo2BondId, { opacity: ScalarTrack; stress: ScalarTrack; form: ScalarTrack; thinning: ScalarTrack }> = {
  clA_oA1: {
    opacity: [{ t: 0, v: 1 }],
    stress: [
      { t: 0, v: 0.06 },
      { t: 17.5, v: 0.1 },
      { t: 18.3, v: 0.32 },
      { t: 21.0, v: 0.3 },
      { t: 22.4, v: 0.08 },
    ],
    form: [{ t: 0, v: 1 }],
    thinning: [{ t: 0, v: 0 }],
  },
  clA_oA2: {
    opacity: [{ t: 0, v: 1 }],
    stress: [
      { t: 0, v: 0.06 },
      { t: 18.3, v: 0.2 },
      { t: 22.4, v: 0.08 },
    ],
    form: [{ t: 0, v: 1 }],
    thinning: [{ t: 0, v: 0 }],
  },
  clB_oB1: {
    opacity: [{ t: 0, v: 1 }],
    stress: [
      { t: 0, v: 0.06 },
      { t: 18.3, v: 0.2 },
      { t: 22.4, v: 0.08 },
    ],
    form: [{ t: 0, v: 1 }],
    thinning: [{ t: 0, v: 0 }],
  },
  clB_oB2: {
    opacity: [{ t: 0, v: 1 }],
    stress: [{ t: 0, v: 0.06 }],
    form: [{ t: 0, v: 1 }],
    thinning: [{ t: 0, v: 0 }],
  },
  clX_clY: {
    opacity: [
      { t: 0, v: 1 },
      { t: 10.05, v: 1 },
      { t: 10.35, v: 0, ease: 'inQuad' },
    ],
    stress: [
      { t: 0, v: 0.1 },
      { t: 8, v: 0.3, ease: 'inOutSine' },
      { t: 10.05, v: 0.95, ease: 'inQuad' },
      { t: 10.2, v: 1 },
    ],
    form: [{ t: 0, v: 1 }],
    thinning: [
      { t: 0, v: 0 },
      { t: 8, v: 0.2 },
      { t: 10.15, v: 0.85, ease: 'inQuad' },
    ],
  },
  oA1_clX: {
    opacity: [
      { t: 9.45, v: 0 },
      { t: 10.2, v: 1, ease: 'outCubic' },
      { t: 20.15, v: 1 },
      { t: 20.4, v: 0, ease: 'inQuad' },
    ],
    stress: [
      { t: 10.5, v: 0.15 },
      { t: 15, v: 0.28 },
      { t: 20.1, v: 0.85, ease: 'inQuad' },
      { t: 20.3, v: 1 },
    ],
    form: [
      { t: 9.5, v: 0 },
      { t: 10.5, v: 1, ease: 'outQuad' },
    ],
    thinning: [
      { t: 19.0, v: 0 },
      { t: 20.3, v: 0.7, ease: 'inQuad' },
    ],
  },
  oB1_clA: {
    opacity: [
      { t: 17.35, v: 0 },
      { t: 18.1, v: 1, ease: 'outCubic' },
      { t: 20.2, v: 1 },
      { t: 20.45, v: 0, ease: 'inQuad' },
    ],
    stress: [
      { t: 18.3, v: 0.4 },
      { t: 20.2, v: 0.9, ease: 'inQuad' },
    ],
    form: [
      { t: 17.4, v: 0 },
      { t: 18.3, v: 1, ease: 'outQuad' },
    ],
    thinning: [
      { t: 18.3, v: 0.2 },
      { t: 20.4, v: 0.8, ease: 'inQuad' },
    ],
  },
}

// ——— Порядок связей и характер разрыва ———
/**
 * Школьная модель порядков связи (см. core/chem/bondOrder.ts):
 *   хлорит ClO₂⁻ — резонанс O=Cl–O⁻ ↔ ⁻O–Cl=O, в среднем 1,5;
 *   ClOClO — Cl–O–Cl=O: мостик одинарный, концевая Cl=O двойная;
 *   комплекс — мостик O→Cl донорный (1), у второй половины O–Cl и Cl=O;
 *   радикал ClO₂ — 1,5 + 0,25: ушёл электрон с разрыхляющей π* (2b1).
 * Порядок меняется ровно тогда, когда перестраивается связь рядом.
 */
export const CLO2_BOND_ORDER: Record<Clo2BondId, ScalarTrack> = {
  clA_oA1: [
    { t: 9.5, v: 1.5 },
    { t: 10.2, v: 1, ease: 'inOutSine' },
    { t: 20.8, v: 1 },
    { t: 22.4, v: 1.75, ease: 'inOutSine' },
  ],
  clA_oA2: [
    { t: 9.5, v: 1.5 },
    { t: 10.2, v: 2, ease: 'inOutSine' },
    { t: 20.8, v: 2 },
    { t: 22.4, v: 1.75, ease: 'inOutSine' },
  ],
  clB_oB1: [
    { t: 17.4, v: 1.5 },
    { t: 18.1, v: 1, ease: 'inOutSine' },
    { t: 20.8, v: 1 },
    { t: 22.4, v: 1.75, ease: 'inOutSine' },
  ],
  clB_oB2: [
    { t: 17.4, v: 1.5 },
    { t: 18.1, v: 2, ease: 'inOutSine' },
    { t: 20.8, v: 2 },
    { t: 22.4, v: 1.75, ease: 'inOutSine' },
  ],
  clX_clY: [{ t: 0, v: 1 }],
  oA1_clX: [{ t: 0, v: 1 }],
  oB1_clA: [{ t: 0, v: 1 }],
}

/**
 * Характер разрыва (−1 пара к атому a связи, 0 поровну, +1 к атому b) — постоянный на связь:
 *   Cl–Cl: пара уходит к clY (b) — гетеролиз;
 *   O–Cl концевая (oA1_clX): пара к clX (b) — гетеролиз, второй Cl⁻;
 *   мостик oB1_clA: по одному электрону — гомолиз.
 */
export const CLO2_BOND_SPLIT: Record<Clo2BondId, number> = {
  clA_oA1: 0,
  clA_oA2: 0,
  clB_oB1: 0,
  clB_oB2: 0,
  clX_clY: 1,
  oA1_clX: 1,
  oB1_clA: 0,
}

// ——— Орбитали и колебания ———
export const CLO2_ORBITAL_TRACKS: Record<keyof Clo2OrbitalState, ScalarTrack> = {
  // Пара кислорода видна, пока она неподелённая; гаснет, когда становится связью O–Cl.
  lonePairA: [
    { t: 5.6, v: 0 },
    { t: 6.6, v: 1, ease: 'inOutSine' },
    { t: 9.3, v: 1 },
    { t: 10.1, v: 0, ease: 'inOutSine' },
  ],
  // Акцептор — пустая σ*(Cl–Cl): контур до момента, когда в неё «входит» пара и связь рвётся.
  sigmaStarCl2: [
    { t: 6.2, v: 0 },
    { t: 7.2, v: 1, ease: 'inOutSine' },
    { t: 9.6, v: 1 },
    { t: 10.2, v: 0, ease: 'inQuad' },
  ],
  lonePairB: [
    { t: 15.4, v: 0 },
    { t: 16.2, v: 1, ease: 'inOutSine' },
    { t: 17.3, v: 1 },
    { t: 18.1, v: 0, ease: 'inOutSine' },
  ],
  // Неспаренный электрон ClO₂ — в π* 2b1 (узловая плоскость = плоскость молекулы).
  somoA: [
    { t: 21.2, v: 0 },
    { t: 22.4, v: 1, ease: 'inOutSine' },
  ],
  somoB: [
    { t: 21.2, v: 0 },
    { t: 22.4, v: 1, ease: 'inOutSine' },
  ],
}

export const CLO2_VIBRATION_TRACKS = {
  // Cl₂ «звенит» на подходе; колебание гаснет к моменту переноса.
  cl2: [
    { t: 3.2, v: 0 },
    { t: 4.6, v: 1, ease: 'inOutSine' },
    { t: 8.6, v: 1 },
    { t: 9.4, v: 0, ease: 'inOutSine' },
  ] satisfies ScalarTrack,
  chlorite: [
    { t: 0.5, v: 0 },
    { t: 2, v: 0.6, ease: 'inOutSine' },
    { t: 8, v: 0.6 },
    { t: 9.3, v: 0.25, ease: 'inOutSine' },
  ] satisfies ScalarTrack,
  // После распада радикалы колеблются сильнее (избыток энергии) и затухают до теплового фона.
  radical: [
    { t: 20.5, v: 0 },
    { t: 21.3, v: 1, ease: 'outCubic' },
    { t: 25.5, v: 0.35, ease: 'outCubic' },
  ] satisfies ScalarTrack,
} as const

// ——— Прочие дорожки сцены ———
export const CLO2_TRACKS = {
  anionClY: [
    { t: 10.2, v: 0 },
    { t: 10.9, v: 1, ease: 'outCubic' },
  ] satisfies ScalarTrack,
  anionClX: [
    { t: 20.35, v: 0 },
    { t: 21.0, v: 1, ease: 'outCubic' },
  ] satisfies ScalarTrack,
  cloudA: [
    { t: 21.2, v: 0 },
    { t: 22.4, v: 1, ease: 'inOutSine' },
  ] satisfies ScalarTrack,
  cloudB: [
    { t: 21.2, v: 0 },
    { t: 22.4, v: 1, ease: 'inOutSine' },
  ] satisfies ScalarTrack,
  hydrationNa: [
    { t: 0.8, v: 0 },
    { t: 1.8, v: 0.55 },
  ] satisfies ScalarTrack,
  hydrationClY: [
    { t: 11.2, v: 0 },
    { t: 12.4, v: 0.55 },
  ] satisfies ScalarTrack,
  hydrationClX: [
    { t: 21.5, v: 0 },
    { t: 22.7, v: 0.55 },
  ] satisfies ScalarTrack,
  medium: [
    { t: 0, v: 0.05 },
    { t: 2.2, v: 0.3, ease: 'outCubic' },
    { t: 30.8, v: 0.32 },
  ] satisfies ScalarTrack,
  bubbleOpacity: [
    { t: 0, v: 0.85 },
    { t: 3.2, v: 0.85 },
    { t: 3.9, v: 0, ease: 'inQuad' },
  ] satisfies ScalarTrack,
  bubbleScale: [
    { t: 0, v: 1 },
    { t: 3.2, v: 1.02 },
    { t: 3.9, v: 1.45, ease: 'outCubic' },
  ] satisfies ScalarTrack,
  cl2Gas: [
    { t: 0, v: 0.35 },
    { t: 3.3, v: 0.5 },
    { t: 4.6, v: 0, ease: 'inQuad' },
  ] satisfies ScalarTrack,
  clo2Tint: [
    { t: 21.6, v: 0 },
    { t: 23.6, v: 0.06, ease: 'outCubic' },
    { t: 30.8, v: 0.08 },
  ] satisfies ScalarTrack,
  productGas: [
    { t: 23, v: 0 },
    { t: 25, v: 0.05, ease: 'outCubic' },
    { t: 30.8, v: 0.06 },
  ] satisfies ScalarTrack,
  exo: [
    { t: 0, v: 0.12 },
    { t: 9.6, v: 0.3 },
    { t: 10.25, v: 0.85, ease: 'inQuad' },
    { t: 11.6, v: 0.25, ease: 'outCubic' },
    { t: 19.8, v: 0.3 },
    { t: 20.4, v: 0.8, ease: 'inQuad' },
    { t: 22.6, v: 0.22, ease: 'outCubic' },
  ] satisfies ScalarTrack,
  fade: [
    { t: 31, v: 0 },
    { t: CLO2_END, v: 1, ease: 'inQuad' },
  ] satisfies ScalarTrack,
  camZoom: [
    { t: 0, v: 0.62 },
    { t: 4.8, v: 0.86, ease: 'outCubic' },
    { t: 7.5, v: 0.96, ease: 'inOutSine' },
    { t: 9.6, v: 1.26, ease: 'inOutCubic' },
    { t: 10.8, v: 1.26 },
    { t: 12.6, v: 1.04, ease: 'inOutSine' },
    { t: 15.5, v: 1.04 },
    { t: 17.6, v: 1.2, ease: 'inOutSine' },
    { t: 19.8, v: 1.42, ease: 'inOutCubic' },
    { t: 20.9, v: 1.42 },
    { t: 23.2, v: 0.98, ease: 'inOutCubic' },
    { t: 27, v: 0.9, ease: 'inOutSine' },
    { t: 31, v: 0.86, ease: 'inOutSine' },
    { t: CLO2_END, v: 0.8, ease: 'inOutSine' },
  ] satisfies ScalarTrack,
  camFocus: [
    { t: 0, v: [0, 0.35, 0] },
    { t: 4.8, v: [0.05, 0.2, 0], ease: 'inOutSine' },
    { t: 7.5, v: [-0.3, 0.08, 0], ease: 'inOutSine' },
    { t: 9.6, v: [-0.5, 0.12, 0], ease: 'inOutSine' },
    { t: 12.6, v: [-0.4, 0.0, 0], ease: 'inOutSine' },
    { t: 15.5, v: [-0.55, -0.25, 0], ease: 'inOutSine' },
    { t: 17.6, v: [-0.62, -0.45, 0], ease: 'inOutSine' },
    { t: 19.8, v: [-0.62, -0.38, 0], ease: 'inOutSine' },
    { t: 23.2, v: [-0.2, -0.1, 0], ease: 'inOutSine' },
    { t: 27, v: [0.15, 0.05, 0], ease: 'inOutSine' },
    { t: CLO2_END, v: [0.2, 0.05, 0], ease: 'inOutSine' },
  ] satisfies Vec3Track,
  camYaw: [
    { t: 0, v: 0.05 },
    { t: 9.6, v: -0.06, ease: 'inOutSine' },
    { t: 15, v: 0.04, ease: 'inOutSine' },
    // Облёт на присоединении и распаде: пирамида у центрального Cl видна в объёме.
    { t: 18.2, v: 0.42, ease: 'inOutSine' },
    { t: 20.9, v: 0.42 },
    { t: 23.2, v: 0.05, ease: 'inOutSine' },
    { t: 27, v: 0.03, ease: 'inOutSine' },
    { t: CLO2_END, v: 0, ease: 'inOutSine' },
  ] satisfies ScalarTrack,
  camRoll: [
    { t: 0, v: 0.012 },
    { t: 10, v: -0.01, ease: 'inOutSine' },
    { t: 20, v: 0.008, ease: 'inOutSine' },
    { t: CLO2_END, v: 0, ease: 'inOutSine' },
  ] satisfies ScalarTrack,
  camShake: [
    { t: 0, v: 0 },
    { t: 10.1, v: 0 },
    { t: 10.25, v: 0.7, ease: 'outQuad' },
    { t: 10.8, v: 0, ease: 'outQuad' },
    { t: 20.3, v: 0 },
    { t: 20.42, v: 0.6, ease: 'outQuad' },
    { t: 21.0, v: 0, ease: 'outQuad' },
  ] satisfies ScalarTrack,
  postBloom: [
    { t: 0, v: 0.3 },
    { t: 8, v: 0.4 },
    { t: 10.25, v: 0.95, ease: 'inQuad' },
    { t: 11.5, v: 0.5, ease: 'outCubic' },
    { t: 18, v: 0.45 },
    { t: 20.4, v: 0.9, ease: 'inQuad' },
    { t: 22, v: 0.55, ease: 'outCubic' },
    { t: CLO2_END, v: 0.5 },
  ] satisfies ScalarTrack,
  postVignette: [
    { t: 0, v: 0.3 },
    { t: 10.2, v: 0.55, ease: 'inOutSine' },
    { t: 12, v: 0.35, ease: 'inOutSine' },
    { t: 20.3, v: 0.55, ease: 'inOutSine' },
    { t: 23, v: 0.35, ease: 'inOutSine' },
    { t: CLO2_END, v: 0.3 },
  ] satisfies ScalarTrack,
} as const

// ——— Сэмплер ———
const _cl2c = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _free = new THREE.Vector3()
const _al = new THREE.Vector3()
const _alX = new THREE.Vector3()
const _anchor0 = new THREE.Vector3()
const _anchor1 = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _perp = new THREE.Vector3()
const _cA = new THREE.Vector3()
const _cB = new THREE.Vector3()
const _scratchUnit = createUnitFrame()

/** Свободные «после распада» дорожки считаются от выровненных положений — чтобы переход был бесшовным. */
let POST_TRACKS: {
  clY: Vec3Track
  clX: Vec3Track
  unitBCenter: Vec3Track
  unitBHeading: ScalarTrack
  unitBTilt: ScalarTrack
} | null = null

function displayRadius(frame: Clo2Frame, atom: Clo2AtomId): number {
  const r = CLO2_GEOM.radius
  if (atom === 'clX') return mix(r.cl, r.clAnion, frame.anion.clX)
  if (atom === 'clY') return mix(r.cl, r.clAnion, frame.anion.clY)
  if (atom.startsWith('cl')) return r.cl
  if (atom.startsWith('na')) return r.na
  return r.o
}

function resolveDir(frame: Clo2Frame, atom: Clo2AtomId, dir: DirSpec, out: THREE.Vector3): THREE.Vector3 {
  if ('toward' in dir) {
    out.copy(frame.atoms[dir.toward]).sub(frame.atoms[atom])
  } else if ('away' in dir) {
    out.copy(frame.atoms[atom]).sub(frame.atoms[dir.away])
  } else {
    switch (dir.vec) {
      case 'lpA':
        out.copy(frame.unitA.lp)
        break
      case 'lpB':
        out.copy(frame.unitB.lp)
        break
      case 'attackA':
        out.copy(frame.unitA.attack)
        break
      case 'up':
        out.set(0, 1, 0)
        break
    }
  }
  if (out.lengthSq() < 1e-10) out.set(0, 1, 0)
  return out.normalize()
}

const _somoN = new THREE.Vector3()
/** Высота электрона над плоскостью ClO₂ — внутри верхнего лепестка 2b1 у хлора. */
const SOMO_ANCHOR_LIFT = 0.24

/** Нормаль плоскости O–Cl–O (d × q'): ось p-орбиталей π-системы. */
export function writeUnitNormal(u: UnitFrame, out: THREE.Vector3): THREE.Vector3 {
  return out.copy(u.d).cross(u.q).normalize()
}

function perpInView(dir: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  out.copy(dir).cross(_z)
  if (out.lengthSq() < 1e-8) out.set(0, 1, 0)
  return out.normalize()
}

/** Положение якоря в текущем кадре. */
export function resolveClo2Anchor(frame: Clo2Frame, a: Clo2Anchor, out: THREE.Vector3): THREE.Vector3 {
  switch (a.k) {
    case 'center':
      return out.copy(frame.atoms[a.atom])
    case 'atom': {
      resolveDir(frame, a.atom, a.dir, _dir)
      out.copy(frame.atoms[a.atom]).addScaledVector(_dir, displayRadius(frame, a.atom) + 0.07)
      if (a.side !== 0) out.addScaledVector(perpInView(_dir, _perp), a.side * 0.075)
      return out
    }
    case 'bond': {
      const pa = frame.atoms[a.a]
      const pb = frame.atoms[a.b]
      out.copy(pa).add(pb).multiplyScalar(0.5)
      if (a.side !== 0) {
        _dir.copy(pb).sub(pa)
        if (_dir.lengthSq() > 1e-10) _dir.normalize()
        out.addScaledVector(perpInView(_dir, _perp), a.side * (a.lift ?? 0.06))
      }
      return out
    }
    case 'rim': {
      const p = frame.atoms[a.atom]
      _dir.copy(frame.atoms[a.ref]).sub(p)
      if (_dir.lengthSq() > 1e-10) _dir.normalize()
      else _dir.set(1, 0, 0)
      out.copy(p).addScaledVector(perpInView(_dir, _perp), a.side * (displayRadius(frame, a.atom) + 0.08))
      if (a.along) out.addScaledVector(_dir, a.along)
      return out
    }
    case 'cloud': {
      const u = a.unit === 'A' ? frame.unitA : frame.unitB
      return out.copy(u.cl).add(u.o1).add(u.o2).multiplyScalar(1 / 3)
    }
    case 'somo': {
      const u = a.unit === 'A' ? frame.unitA : frame.unitB
      writeUnitNormal(u, _somoN)
      return out.copy(u.cl).addScaledVector(_somoN, SOMO_ANCHOR_LIFT)
    }
  }
}

function sampleAnchorTrack(frame: Clo2Frame, keys: readonly AnchorKey[], t: number, out: THREE.Vector3): THREE.Vector3 {
  const n = keys.length
  const first = keys[0]!
  if (n === 1 || t <= first.t) return resolveClo2Anchor(frame, first.a, out)
  const last = keys[n - 1]!
  if (t >= last.t) return resolveClo2Anchor(frame, last.a, out)
  let i = 1
  while (i < n - 1 && t >= keys[i]!.t) i++
  const k0 = keys[i - 1]!
  const k1 = keys[i]!
  const u = ease(k1.ease, norm(k0.t, k1.t, t))
  resolveClo2Anchor(frame, k0.a, _anchor0)
  resolveClo2Anchor(frame, k1.a, _anchor1)
  out.copy(_anchor0).lerp(_anchor1, u)
  if (k1.arc) {
    _dir.copy(_anchor1).sub(_anchor0)
    if (_dir.lengthSq() > 1e-10) {
      _dir.normalize()
      out.addScaledVector(perpInView(_dir, _perp), Math.sin(Math.PI * u) * k1.arc)
    }
  }
  return out
}

function labelText(def: LabelDef, t: number): string {
  let text = def.keys[0]!.text
  for (const k of def.keys) if (t >= k.t) text = k.text
  return text
}

function unwrapTo(value: number, reference: number): number {
  let v = value
  while (v - reference > 180) v -= 360
  while (reference - v > 180) v += 360
  return v
}

const _alignedB = { heading: 0, tilt: 0 }

/**
 * Выровненное положение хлорита B: неподелённая пара oB1 смотрит на центральный Cl
 * хлорита A вдоль его направления атаки (attack — пирамидальная позиция).
 * Решаем writeUnit обратно: lp = cos70·d − sin70·q' должен совпасть с −attack.
 */
function alignedUnitB(frame: Clo2Frame, t: number, outCenter: THREE.Vector3): typeof _alignedB {
  const attack = frame.unitA.attack
  const lpa = LONE_PAIR_OFFSET_DEG * DEG
  const lz = -attack.z
  const sinTilt = Math.max(-1, Math.min(1, -lz / Math.sin(lpa)))
  const tilt = Math.asin(sinTilt)
  const lpXYAngle = Math.atan2(-attack.y, -attack.x)
  const h = lpXYAngle - Math.atan2(-Math.sin(lpa) * Math.cos(tilt), Math.cos(lpa))
  const s = sampleScalar(UNIT_B.s, t)
  const bond = sampleScalar(RADICAL_FORM.bond, t)
  // oB1 = clA + attack·s ; clB = oB1 − d·bond
  outCenter
    .copy(frame.unitA.cl)
    .addScaledVector(attack, s)
    .add(_t2.set(-Math.cos(h) * bond, -Math.sin(h) * bond, 0))
  _alignedB.heading = h / DEG
  _alignedB.tilt = tilt
  return _alignedB
}

function alignedClX(frame: Clo2Frame, t: number, out: THREE.Vector3): THREE.Vector3 {
  return out.copy(frame.unitA.o1).addScaledVector(frame.unitA.lp, sampleScalar(CL2_ALIGN.sX, t))
}

function cl2FreePositions(t: number, outX: THREE.Vector3, outY: THREE.Vector3): void {
  sampleVec3(CL2_FREE.center, t, _cl2c)
  const a = sampleScalar(CL2_FREE.axis, t) * DEG
  _axis.set(Math.cos(a), Math.sin(a), 0)
  outX.copy(_cl2c).addScaledVector(_axis, -CLO2_GEOM.clCl / 2)
  outY.copy(_cl2c).addScaledVector(_axis, CLO2_GEOM.clCl / 2)
}

function writeUnitA(frame: Clo2Frame, t: number): void {
  sampleVec3(UNIT_A.center, t, _cA)
  const j = 1 - norm(4.2, 5.2, t)
  if (j > 0) {
    _cA.x += 0.014 * j * jitter(t, 1)
    _cA.y += 0.014 * j * jitter(t, 2)
  }
  writeUnit(
    frame.unitA,
    _cA,
    sampleScalar(UNIT_A.heading, t),
    sampleScalar(UNIT_A.tilt, t),
    sampleScalar(RADICAL_FORM.angle, t),
    sampleScalar(RADICAL_FORM.bond, t),
  )
}

function ensurePostTracks(): NonNullable<typeof POST_TRACKS> {
  if (POST_TRACKS) return POST_TRACKS
  const f = createClo2Frame()

  // clY: уходит по оси атаки, затем плывёт хлорид-ионом в растворе.
  writeUnitA(f, 11.0)
  alignedClX(f, 11.0, _alX)
  const clY11 = _alX.clone().addScaledVector(f.unitA.lp, sampleScalar(CL2_ALIGN.dXY, 11.0))

  // clX: после отрыва — по оси бывшей связи O–Cl.
  writeUnitA(f, 21.0)
  const clX21 = alignedClX(f, 21.0, new THREE.Vector3())

  // хлорит B в момент конца выравнивания.
  writeUnitA(f, 21.6)
  const cB216 = new THREE.Vector3()
  const { heading: hB216, tilt: tB216 } = alignedUnitB(f, 21.6, cB216)
  writeUnitA(f, 15)
  const { heading: hB15, tilt: tB15 } = alignedUnitB(f, 15, new THREE.Vector3())

  const v = (p: THREE.Vector3) => [p.x, p.y, p.z] as const
  POST_TRACKS = {
    clY: [
      { t: 11.0, v: v(clY11) },
      { t: 12.2, v: [clY11.x + 0.35, clY11.y + 0.25, 0.15], ease: 'outCubic' },
      { t: 15, v: [1.45, 0.8, 0.2], ease: 'inOutSine' },
      { t: 23, v: [1.6, 0.85, 0.2], ease: 'inOutSine' },
      { t: 27, v: [1.75, 0.6, 0.25], ease: 'inOutSine' },
      { t: CLO2_END, v: [1.8, 0.6, 0.25], ease: 'inOutSine' },
    ],
    clX: [
      { t: 21.0, v: v(clX21) },
      { t: 22.2, v: [clX21.x + 0.35, clX21.y + 0.43, 0.3], ease: 'outCubic' },
      { t: 25, v: [0.45, 0.85, 0.45], ease: 'inOutSine' },
      { t: CLO2_END, v: [0.35, 0.95, 0.5], ease: 'inOutSine' },
    ],
    unitBCenter: [
      { t: 0, v: [2.1, -1.1, -0.5] },
      { t: 5, v: [1.85, -1.2, -0.4], ease: 'inOutSine' },
      { t: 12, v: [1.75, -1.25, -0.35], ease: 'inOutSine' },
      { t: 15, v: [1.7, -1.3, -0.3], ease: 'inOutSine' },
      { t: 21.6, v: v(cB216) },
      { t: 23, v: [0.55, -1.1, 0.1], ease: 'inOutSine' },
      { t: 27, v: [0.85, -0.85, 0.15], ease: 'inOutSine' },
      { t: CLO2_END, v: [0.9, -0.8, 0.15], ease: 'inOutSine' },
    ],
    unitBHeading: [
      { t: 0, v: hB15 - 35 },
      { t: 12, v: hB15 - 20, ease: 'inOutSine' },
      { t: 15, v: hB15 },
      { t: 21.6, v: hB216 },
      { t: 23, v: hB216 + 20, ease: 'inOutSine' },
      { t: 27, v: hB216 + 50, ease: 'inOutSine' },
      { t: CLO2_END, v: hB216 + 60, ease: 'inOutSine' },
    ],
    unitBTilt: [
      { t: 0, v: 0.3 },
      { t: 15, v: tB15, ease: 'inOutSine' },
      { t: 21.6, v: tB216 },
      { t: 23, v: 1.0, ease: 'inOutSine' },
      { t: CLO2_END, v: 1.1, ease: 'inOutSine' },
    ],
  }
  return POST_TRACKS
}

/** Только частицы: фреймы молекул, атомы, рост анионов. Стрелки берут отсюда свою геометрию. */
function sampleClo2Atoms(t: number, frame: Clo2Frame): void {
  const post = ensurePostTracks()
  frame.t = t
  const atoms = frame.atoms

  // Хлорит A
  writeUnitA(frame, t)
  atoms.clA.copy(frame.unitA.cl)
  atoms.oA1.copy(frame.unitA.o1)
  atoms.oA2.copy(frame.unitA.o2)

  // Cl₂ → ClOClO → Cl⁻
  const wX = sampleScalar(CL2_ALIGN.weightX, t)
  const wY = sampleScalar(CL2_ALIGN.weightY, t)
  cl2FreePositions(t, _free, _al)
  const freeX = _cA.copy(_free)
  const freeY = _cB.copy(_al)
  if (t > 15) sampleVec3(post.clX, t, freeX)
  if (t > 9) sampleVec3(post.clY, t, freeY)
  alignedClX(frame, t, _alX)
  atoms.clX.copy(freeX).lerp(_alX, wX)
  _al.copy(_alX).addScaledVector(frame.unitA.lp, sampleScalar(CL2_ALIGN.dXY, t))
  atoms.clY.copy(freeY).lerp(_al, wY)

  // Хлорит B
  const wB = sampleScalar(UNIT_B.align, t)
  sampleVec3(post.unitBCenter, t, _free)
  let headingB = sampleScalar(post.unitBHeading, t)
  let tiltB = sampleScalar(post.unitBTilt, t)
  if (wB > 0) {
    const aligned = alignedUnitB(frame, t, _al)
    _free.lerp(_al, wB)
    headingB = mix(headingB, unwrapTo(aligned.heading, headingB), wB)
    tiltB = mix(tiltB, aligned.tilt, wB)
  }
  const jB = 1 - norm(12, 15, t)
  if (jB > 0) {
    _free.x += 0.014 * jB * jitter(t, 3)
    _free.y += 0.014 * jB * jitter(t, 4)
  }
  writeUnit(frame.unitB, _free, headingB, tiltB, sampleScalar(RADICAL_FORM.angle, t), sampleScalar(RADICAL_FORM.bond, t))
  atoms.clB.copy(frame.unitB.cl)
  atoms.oB1.copy(frame.unitB.o1)
  atoms.oB2.copy(frame.unitB.o2)

  // Na⁺ — наблюдатели
  sampleVec3(NA.na1, t, atoms.na1)
  sampleVec3(NA.na2, t, atoms.na2)
  atoms.na1.y += 0.02 * jitter(t, 5)
  atoms.na2.y += 0.02 * jitter(t, 6)

  frame.anion.clX = sampleScalar(CLO2_TRACKS.anionClX, t)
  frame.anion.clY = sampleScalar(CLO2_TRACKS.anionClY, t)
}

type ArrowGeom = { p0: THREE.Vector3; p1: THREE.Vector3; ctrl: THREE.Vector3 }
let ARROW_GEOM: ArrowGeom[] | null = null

/** Геометрия стрелок на исходной структуре — момент конца прорисовки каждой стрелки. */
function ensureArrowGeom(): ArrowGeom[] {
  if (ARROW_GEOM) return ARROW_GEOM
  const f = createClo2Frame()
  const dir = new THREE.Vector3()
  const perp = new THREE.Vector3()
  ARROW_GEOM = CLO2_ARROWS.map((def) => {
    sampleClo2Atoms(def.draw[1], f)
    const p0 = resolveClo2Anchor(f, def.from, new THREE.Vector3())
    const p1 = resolveClo2Anchor(f, def.to, new THREE.Vector3())
    dir.copy(p1).sub(p0)
    const len = dir.length()
    const ctrl = p0.clone().add(p1).multiplyScalar(0.5)
    if (len > 1e-6) ctrl.addScaledVector(perpInView(dir.multiplyScalar(1 / len), perp), def.bend * Math.max(len, 0.3))
    return { p0, p1, ctrl }
  })
  return ARROW_GEOM
}

/**
 * Мир в момент story time t. Пишет в `frame` без аллокаций.
 * Порядок важен: хлорит A → Cl₂ (привязан к oA1) → хлорит B (привязан к clA) → остальное.
 */
export function sampleClo2Frame(t: number, frame: Clo2Frame): Clo2Frame {
  sampleClo2Atoms(t, frame)
  const arrowGeom = ensureArrowGeom()
  const atoms = frame.atoms
  const tr = CLO2_TRACKS

  // Связи
  for (const b of CLO2_BONDS) {
    const s = frame.bonds[b.id]
    const def = BOND_TRACKS[b.id]
    s.from.copy(atoms[b.a])
    s.to.copy(atoms[b.b])
    s.opacity = sampleScalar(def.opacity, t)
    s.stress = sampleScalar(def.stress, t)
    s.form = sampleScalar(def.form, t)
    s.thinning = sampleScalar(def.thinning, t)
  }

  // Электроны
  for (const e of frame.electrons) {
    const def = ELECTRONS[e.id]
    e.opacity = sampleScalar(def.opacity, t)
    e.glow = sampleScalar(def.glow, t)
    if (e.opacity > 0.001) sampleAnchorTrack(frame, def.keys, t, e.pos)
  }

  // Стрелки
  for (let i = 0; i < CLO2_ARROWS.length; i++) {
    const def = CLO2_ARROWS[i]!
    const s = frame.arrows[i]!
    const draw = norm(def.draw[0], def.draw[1], t)
    const out = 1 - norm(def.fade[0], def.fade[1], t)
    s.draw = ease('inOutSine', draw)
    s.opacity = t < def.draw[0] ? 0 : Math.min(1, draw * 4) * out
    if (s.opacity <= 0.001) continue
    const g = arrowGeom[i]!
    s.p0.copy(g.p0)
    s.p1.copy(g.p1)
    s.ctrl.copy(g.ctrl)
  }

  // Подписи
  for (let i = 0; i < CLO2_LABELS.length; i++) {
    const def = CLO2_LABELS[i]!
    const s = frame.labels[i]!
    s.opacity = windowFade(def.window, t, 0.35)
    s.text = labelText(def, t)
    if (s.opacity <= 0.001) continue
    resolveClo2Anchor(frame, def.anchor, s.pos)
    s.pos.x += def.offset[0]
    s.pos.y += def.offset[1]
    s.pos.z += def.offset[2]
  }

  // Химия связей, орбитали, колебания
  for (const b of CLO2_BONDS) {
    const c = frame.bondChem[b.id]
    c.order = sampleScalar(CLO2_BOND_ORDER[b.id], t)
    c.split = CLO2_BOND_SPLIT[b.id]
  }
  const orb = frame.orbitals
  orb.lonePairA = sampleScalar(CLO2_ORBITAL_TRACKS.lonePairA, t)
  orb.lonePairB = sampleScalar(CLO2_ORBITAL_TRACKS.lonePairB, t)
  orb.sigmaStarCl2 = sampleScalar(CLO2_ORBITAL_TRACKS.sigmaStarCl2, t)
  orb.somoA = sampleScalar(CLO2_ORBITAL_TRACKS.somoA, t)
  orb.somoB = sampleScalar(CLO2_ORBITAL_TRACKS.somoB, t)
  const vib = frame.vibration
  vib.cl2 = sampleScalar(CLO2_VIBRATION_TRACKS.cl2, t)
  vib.chlorite = sampleScalar(CLO2_VIBRATION_TRACKS.chlorite, t)
  vib.radicalA = sampleScalar(CLO2_VIBRATION_TRACKS.radical, t)
  vib.radicalB = vib.radicalA

  // Радикалы, гидратация, среда
  resolveClo2Anchor(frame, { k: 'cloud', unit: 'A' }, frame.clouds.A.center)
  resolveClo2Anchor(frame, { k: 'cloud', unit: 'B' }, frame.clouds.B.center)
  frame.clouds.A.amount = sampleScalar(tr.cloudA, t)
  frame.clouds.B.amount = sampleScalar(tr.cloudB, t)
  frame.hydration.na1 = sampleScalar(tr.hydrationNa, t)
  frame.hydration.na2 = frame.hydration.na1
  frame.hydration.clY = sampleScalar(tr.hydrationClY, t)
  frame.hydration.clX = sampleScalar(tr.hydrationClX, t)

  const env = frame.env
  env.medium = sampleScalar(tr.medium, t)
  cl2FreePositions(Math.min(t, 5), _free, _al)
  env.bubble.center.copy(_free).add(_al).multiplyScalar(0.5)
  env.bubble.opacity = sampleScalar(tr.bubbleOpacity, t)
  env.bubble.scale = sampleScalar(tr.bubbleScale, t)
  env.cl2Gas = sampleScalar(tr.cl2Gas, t)
  env.clo2Tint = sampleScalar(tr.clo2Tint, t)
  env.productGas = sampleScalar(tr.productGas, t)
  env.exo = sampleScalar(tr.exo, t)
  env.fade = sampleScalar(tr.fade, t)

  // Камера: фокус кадра сдвигаем в центр с учётом масштаба рига
  const cam = frame.camera
  cam.zoom = sampleScalar(tr.camZoom, t)
  sampleVec3(tr.camFocus, t, cam.offset).multiplyScalar(-CLO2_RIG_SCALE * cam.zoom)
  cam.yaw = sampleScalar(tr.camYaw, t)
  cam.roll = sampleScalar(tr.camRoll, t)
  cam.shake = sampleScalar(tr.camShake, t)
  cam.bloom = sampleScalar(tr.postBloom, t)
  cam.vignette = sampleScalar(tr.postVignette, t)

  void _scratchUnit
  return frame
}

/** Проверка раскадровки: ключи всех дорожек строго по возрастанию. */
export function validateClo2Storyboard(): void {
  const check = (name: string, track: ReadonlyArray<{ t: number }>) => validateTrack(name, track)
  for (const [name, track] of Object.entries(CLO2_TRACKS)) check(name, track as ReadonlyArray<{ t: number }>)
  for (const [name, track] of Object.entries(UNIT_A)) check(`unitA.${name}`, track as ReadonlyArray<{ t: number }>)
  for (const [name, track] of Object.entries(RADICAL_FORM)) check(`form.${name}`, track as ReadonlyArray<{ t: number }>)
  for (const [name, track] of Object.entries(CL2_FREE)) check(`cl2.${name}`, track as ReadonlyArray<{ t: number }>)
  for (const [name, track] of Object.entries(CL2_ALIGN)) check(`cl2Align.${name}`, track as ReadonlyArray<{ t: number }>)
  for (const [name, track] of Object.entries(UNIT_B)) check(`unitB.${name}`, track as ReadonlyArray<{ t: number }>)
  for (const [name, track] of Object.entries(NA)) check(`na.${name}`, track as ReadonlyArray<{ t: number }>)
  for (const [id, def] of Object.entries(BOND_TRACKS)) {
    for (const [k, track] of Object.entries(def)) check(`bond.${id}.${k}`, track as ReadonlyArray<{ t: number }>)
  }
  for (const [id, def] of Object.entries(ELECTRONS)) {
    check(`electron.${id}.keys`, def.keys)
    check(`electron.${id}.opacity`, def.opacity)
    check(`electron.${id}.glow`, def.glow)
  }
  for (const [name, track] of Object.entries(ensurePostTracks())) check(`post.${name}`, track as ReadonlyArray<{ t: number }>)
  for (const [id, track] of Object.entries(CLO2_BOND_ORDER)) check(`bondOrder.${id}`, track)
  for (const [id, track] of Object.entries(CLO2_ORBITAL_TRACKS)) check(`orbital.${id}`, track)
  for (const [id, track] of Object.entries(CLO2_VIBRATION_TRACKS)) check(`vibration.${id}`, track)
  for (const l of CLO2_LABELS) {
    if (!(l.window[0] < l.window[1])) throw new Error(`[cinema] label "${l.id}": empty window`)
  }
  for (const a of CLO2_ARROWS) {
    if (!(a.draw[0] < a.draw[1] && a.draw[1] <= a.fade[0] && a.fade[0] < a.fade[1])) {
      throw new Error(`[cinema] arrow "${a.id}": draw must finish before it fades`)
    }
  }
}
