import * as THREE from 'three'
import { ATOMIC_DATA, bondAngleDeg, bondLengthPm, dipoleDebye, getElement, type ElementSymbol } from '../../../../chemistry/data'
import { smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { TETRAHEDRAL_ANGLE_DEG } from '../../core/vsepr'
import { orbitTrack, sampleShot, shotTrack, type ShotKey, type ShotTrack } from '../kit/camera'
import { bondLength, speciesRadius } from '../kit/cpkAtoms'
import { latticeCaption, type LatticeSegment } from '../kit/lattice'
import type { SubstanceKind } from '../kit/materials'
import {
  createLabelStates,
  createSceneCamera,
  fadeTrack,
  sampleLabels,
  validateTracks,
  type SceneCamera,
  type SceneLabelDef,
  type SceneLabelState,
} from '../kit/sceneKit'
import { OCTET_SNAP_EPS } from '../kit/valence'
import { H2O_CHAIN_KJ, H2O_THERMO } from './h2oEnergetics'
import { ICE_FRAG, ICE_HBONDS, ICE_MOLECULES, ICE_OO_PM } from './h2oIce'
import { H2O_END, H2O_EVENTS, H2O_FINISH, H2O_STEPS } from './h2oSteps'

export {
  H2O_CUES,
  H2O_END,
  H2O_EVENTS,
  H2O_FINISH,
  H2O_SEGMENTS,
  H2O_STEPS,
  H2O_STEP_IDS,
  H2O_TIMING,
  h2oStepIndexAt,
  type H2oCueId,
  type H2oEventId,
  type H2oStepId,
} from './h2oSteps'
export { ICE_CELLS, ICE_EDGES, ICE_FRAG, ICE_HBONDS, ICE_MOLECULES } from './h2oIce'

/**
 * Раскадровка 2 H₂ (г.) + O₂ (г.) → 2 H₂O — ЧИСТАЯ функция времени сюжета (рецепт эталона nacl).
 *
 * Ни одного числа химии: длины — bondData (H–H r_e, O=O r_e, O–H r₀), угол H–O–H — bondData (r₀),
 * радиусы — Кордеро через speciesRadius, лёд — crystalData 'ice' через kit/lattice (h2oIce.ts),
 * энергии подписей — h2oEnergetics (ΔH°f и стадии цепи ядра).
 *
 * Механизм — РАЗВЕТВЛЁННАЯ ЦЕПЬ, а не «разорвали всё — собрали»:
 *   init    H₂ → 2 H· (искра);            branchH H· + O₂ → ·OH + O(³P);
 *   branchO O(³P) + H₂ → ·OH + H·;        propA/B ·OH + H₂ → H₂O + H·.
 * В кадре 4 H₂ + 2 O₂ (смесь 2 : 1); в цепь уходят четыре H₂ и один O₂, остаются три радикала H·
 * (из одного стало три — разветвление) и второй O₂; они уходят из кадра на шаге 5.
 *
 * Правила эталона, выполненные по построению:
 *   • у каждого атома span [первый, последний шаг]; вне него непрозрачность строго 0;
 *   • каждый видимый атом подписан (label.hosts);
 *   • в кадр события СТУПЕНЬЮ меняются: связи (флаги on), число неспаренных электронов (точки),
 *     материал (gas → covalent в кадр рождения молекулы воды) и подписи (O(³P) → ·OH → H₂O);
 *   • атом O(³P) несёт ДВЕ точки неспаренных электронов, O₂ — две на молекулу (триплет), H· и ·OH — одну;
 *     в любой кадр Σ неспаренных электронов меняется только при инициировании (0 → 2), дальше постоянна;
 *   • водородная связь — пунктир kit/bondVisual 'hbond', неподелённые пары — полупрозрачные холодные лепестки;
 *   • огня, дыма и тумана нет; единственное свечение — искра шага 2, вне молекул, подписана.
 */

const D2R = Math.PI / 180

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

const OH = bondLength('O-H')
const HH = bondLength('H-H')
const OO = bondLength('O=O')
/** Валентный угол H–O–H (r₀, в паре с r₀ O–H). */
const ANGLE = bondAngleDeg('water')

const R = { h: speciesRadius('H', 0), o: speciesRadius('O', 0) } as const

const EN_H = getElement('H').electronegativity!
const EN_O = getElement('O').electronegativity!

export const H2O_GEOM = {
  radius: R,
  oh: OH,
  hh: HH,
  oo: OO,
  angleDeg: ANGLE,
  lonePairAngleDeg: TETRAHEDRAL_ANGLE_DEG,
  data: {
    ohPm: bondLengthPm('O-H'),
    hhPm: bondLengthPm('H-H'),
    ooPm: bondLengthPm('O=O'),
    dipoleD: dipoleDebye('H2O')!,
    enH: EN_H,
    enO: EN_O,
    ooIcePm: ICE_OO_PM,
  },
} as const

/** Масштаб рига: молекула воды втрое мельче пары NaCl — риг крупнее эталонного. */
export const H2O_RIG_SCALE = 2.2

// ─────────────────────────────────────────────────────────────────────────────
// Состав кадра
// ─────────────────────────────────────────────────────────────────────────────

export type H2oElement = 'H' | 'O'
export type H2oAtomKind = 'story' | 'ice'

export type H2oAtomDef = {
  id: string
  el: H2oElement
  kind: H2oAtomKind
  /** индексы шагов [первый, последний], на которых атом имеет право быть видимым */
  span: readonly [number, number]
}

const LAST = H2O_STEPS.length - 1
const S_MOLECULE = H2O_STEPS.findIndex((s) => s.id === 'molecule')
const S_ICE = H2O_STEPS.findIndex((s) => s.id === 'ice')
const stepFrom = (i: number) => H2O_STEPS[i]!.from
const stepTo = (i: number) => H2O_STEPS[i]!.to
const T = H2O_EVENTS

/**
 * Двенадцать атомов сюжета: 4 H₂ (h0*, h1*, h2*, h3*) и 2 O₂ (oA–oB, oC–oD).
 *   молекула воды A = oA + h0a + h2a, молекула B = oB + h1a + h3a;
 *   h0b, h1b, h2b, h3b — радикалы H·; oC–oD — второй O₂ (ждёт следующего звена).
 */
const STORY: readonly H2oAtomDef[] = [
  { id: 'h0a', el: 'H', kind: 'story', span: [0, LAST] },
  { id: 'h0b', el: 'H', kind: 'story', span: [0, 1] },
  { id: 'oA', el: 'O', kind: 'story', span: [0, LAST] },
  { id: 'oB', el: 'O', kind: 'story', span: [0, LAST] },
  { id: 'h1a', el: 'H', kind: 'story', span: [0, LAST] },
  { id: 'h1b', el: 'H', kind: 'story', span: [0, S_MOLECULE] },
  { id: 'h2a', el: 'H', kind: 'story', span: [0, LAST] },
  { id: 'h2b', el: 'H', kind: 'story', span: [0, S_MOLECULE] },
  { id: 'h3a', el: 'H', kind: 'story', span: [0, LAST] },
  { id: 'h3b', el: 'H', kind: 'story', span: [0, S_MOLECULE] },
  { id: 'oC', el: 'O', kind: 'story', span: [0, S_MOLECULE] },
  { id: 'oD', el: 'O', kind: 'story', span: [0, S_MOLECULE] },
]

// ——— Какие узлы льда займут молекулы сюжета: водородно связанная пара у передней грани ———

const FRONT_Z = Math.max(...ICE_MOLECULES.map((m) => m.o[2]))
const STORY_HB = [...ICE_HBONDS].sort((a, b) => {
  const score = (h: (typeof ICE_HBONDS)[number]) => {
    const p = ICE_MOLECULES[h.donor]!.o
    const q = ICE_MOLECULES[h.acceptor]!.o
    return Math.hypot((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2 - FRONT_Z)
  }
  return score(a) - score(b)
})[0]!
/** Узлы льда молекул сюжета: A — донор водородной связи, B — акцептор. */
export const STORY_ICE_SITE = { A: STORY_HB.donor, B: STORY_HB.acceptor } as const

const ICE_REST = ICE_MOLECULES.map((_, i) => i).filter((i) => i !== STORY_ICE_SITE.A && i !== STORY_ICE_SITE.B)

const ICE_DEFS: H2oAtomDef[] = []
for (const mi of ICE_REST) {
  ICE_DEFS.push({ id: `I${mi}o`, el: 'O', kind: 'ice', span: [S_ICE, LAST] })
  ICE_DEFS.push({ id: `I${mi}h0`, el: 'H', kind: 'ice', span: [S_ICE, LAST] })
  ICE_DEFS.push({ id: `I${mi}h1`, el: 'H', kind: 'ice', span: [S_ICE, LAST] })
}

export const H2O_ATOMS: readonly H2oAtomDef[] = [...STORY, ...ICE_DEFS]
export const H2O_ATOM_INDEX: ReadonlyMap<string, number> = new Map(H2O_ATOMS.map((a, i) => [a.id, i]))
const IDX = (id: string) => H2O_ATOM_INDEX.get(id)!

/** Роль атома в молекуле льда: молекула (индекс ICE_MOLECULES) и 'o' | 0 | 1 (какой H). */
type IceRole = { mol: number; role: 'o' | 0 | 1 }
export const ICE_ROLE_OF: ReadonlyMap<string, IceRole> = new Map<string, IceRole>(
  ICE_REST.flatMap((mi): [string, IceRole][] => [
    [`I${mi}o`, { mol: mi, role: 'o' }],
    [`I${mi}h0`, { mol: mi, role: 0 }],
    [`I${mi}h1`, { mol: mi, role: 1 }],
  ]),
)

/** Молекулы воды сюжета: O, H1, H2. */
export const WATER_A = ['oA', 'h0a', 'h2a'] as const
export const WATER_B = ['oB', 'h1a', 'h3a'] as const

/** Молекулы H₂ по порядку вступления в цепь и события, в которые их связь рвётся. */
export const H2_MOLECULES = [
  { a: 'h0a', b: 'h0b', breakAt: T.init },
  { a: 'h1a', b: 'h1b', breakAt: T.branchO },
  { a: 'h2a', b: 'h2b', breakAt: T.propA },
  { a: 'h3a', b: 'h3b', breakAt: T.propB },
] as const
/** Молекулы O₂: первая рвётся в branchH, вторая остаётся (уходит из кадра). */
export const O2_MOLECULES = [
  { a: 'oA', b: 'oB', breakAt: T.branchH },
  { a: 'oC', b: 'oD', breakAt: Infinity },
] as const
/** Связи O–H молекул сюжета и события их рождения. */
export const STORY_OH = [
  { o: 'oA', h: 'h0a', formAt: T.branchH },
  { o: 'oB', h: 'h1a', formAt: T.branchO },
  { o: 'oA', h: 'h2a', formAt: T.propA },
  { o: 'oB', h: 'h3a', formAt: T.propB },
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Положения: аналитические «позы», затем плотные дорожки (сетка 1/30 с)
// ─────────────────────────────────────────────────────────────────────────────

type V3 = readonly [number, number, number]
const v3 = (x: number, y: number, z = 0): V3 => [x, y, z]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const norm = (a: V3): V3 => mul(a, 1 / Math.hypot(a[0], a[1], a[2]))
const rotZ = (a: V3, deg: number): V3 => {
  const c = Math.cos(deg * D2R)
  const s = Math.sin(deg * D2R)
  return [a[0] * c - a[1] * s, a[0] * s + a[1] * c, a[2]]
}

// ——— Шаг 1: расстановка смеси (параметры рисунка) ———
const U0: V3 = v3(1, 0)
const O2A_C: V3 = v3(-0.3, 0.3)
const OA0 = sub(O2A_C, mul(U0, OO / 2))
const OB0 = add(O2A_C, mul(U0, OO / 2))
const H0_C: V3 = v3(-1.15, 0.3)
const H0A0 = add(H0_C, mul(U0, HH / 2))
const H0B0 = sub(H0_C, mul(U0, HH / 2))
/** Атом O(³P) после разветвления летит к H₂ №1 и встречает его ВДОЛЬ оси (перенос атома коллинеарен). */
const OB_F2: V3 = v3(0.25, 0.45)
const U1 = norm(sub(OB_F2, OB0))
const H1A0 = add(OB_F2, mul(U1, OH))
const H1B0 = add(H1A0, mul(U1, HH))
/** ·OH(A) встречает H₂ №2: второй H встаёт под углом H–O–H к первому. */
const OA_F: V3 = v3(-0.55, -0.05)
const DIR_A2 = rotZ(mul(U0, -1), ANGLE)
const H2A0 = add(OA_F, mul(DIR_A2, OH))
const H2B0 = add(H2A0, mul(DIR_A2, HH))
/** ·OH(B) встречает H₂ №3. */
const OB_F: V3 = v3(0.35, 0.05)
const DIR_B3 = rotZ(U1, -ANGLE)
const H3A0 = add(OB_F, mul(DIR_B3, OH))
const H3B0 = add(H3A0, mul(DIR_B3, HH))
/** Второй O₂ — справа, ось вертикальна. */
const O2B_C: V3 = v3(1.15, 0.02)
const OC0 = add(O2B_C, v3(0, OO / 2))
const OD0 = sub(O2B_C, v3(0, OO / 2))
/** Искра — вне молекул, над H₂ №1 (центр свечения, мировые единицы). */
export const SPARK_POS: V3 = add(H0_C, v3(-0.04, 0.3, 0.06))
/** Радикалы после отрыва отлетают по оси разорванной связи. */
const RECOIL = 0.3

const smooth = (u: number) => smoothstep(0, 1, u)
/** Переход из a в b за [t0, t1] (гладкий старт и остановка), дуга arc — ⟂ пути в плоскости экрана. */
function mv(t: number, t0: number, t1: number, a: V3, b: V3, arc = 0): V3 {
  if (t <= t0) return a
  if (t >= t1) return b
  const u = smooth((t - t0) / (t1 - t0))
  const p = add(a, mul(sub(b, a), u))
  if (!arc) return p
  const d = sub(b, a)
  const l = Math.hypot(d[0], d[1]) || 1
  const bump = Math.sin(Math.PI * u) * arc
  return add(p, v3((-d[1] / l) * bump, (d[0] / l) * bump))
}

// ——— Позы молекулы воды: O, поворот канонического каркаса, угол H–O–H ———
type Pose = { o: V3; q: THREE.Quaternion; theta: number }

/** Каноническая молекула: O в нуле, биссектриса −Y, плоскость XY; H1 слева, H2 справа. */
function canonicalH(theta: number, which: 0 | 1): THREE.Vector3 {
  const s = Math.sin((theta / 2) * D2R) * OH
  const c = Math.cos((theta / 2) * D2R) * OH
  return new THREE.Vector3(which === 0 ? -s : s, -c, 0)
}

function poseFrom(o: V3, h1: V3, h2: V3): Pose {
  const a = new THREE.Vector3(...sub(h1, o))
  const b = new THREE.Vector3(...sub(h2, o))
  const theta = a.angleTo(b) / D2R
  const bis = a.clone().normalize().add(b.clone().normalize()).normalize()
  const X = b.clone().sub(a).normalize()
  const Y = bis.clone().negate()
  const Z = new THREE.Vector3().crossVectors(X, Y)
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z))
  return { o, q, theta }
}

function atPose(p: Pose, which: 'o' | 0 | 1): V3 {
  if (which === 'o') return p.o
  const v = canonicalH(p.theta, which).applyQuaternion(p.q)
  return add(p.o, [v.x, v.y, v.z])
}

/** Промежуточная поза: O по гладкой кривой, поворот — slerp, угол — линейно (жёсткое тело, без растяжения связей). */
function blendPose(a: Pose, b: Pose, u: number, arc = 0): Pose {
  const o = mv(u, 0, 1, a.o, b.o, arc)
  const s = smooth(u)
  return { o, q: a.q.clone().slerp(b.q, s), theta: a.theta + (b.theta - a.theta) * s }
}

const qAngle = (a: THREE.Quaternion, b: THREE.Quaternion) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))))

// Молекула A: в цепи — как родилась; на шаге 5 — крупно, в плоскости экрана; на шаге 6 — в узле льда.
const POSE_A_CHAIN = poseFrom(OA_F, add(OA_F, mul(U0, -OH)), H2A0)
const POSE_A_SHOW: Pose = { o: v3(-0.12, 0.09), q: new THREE.Quaternion(), theta: ANGLE }
const POSE_B_CHAIN = poseFrom(OB_F, add(OB_F, mul(U1, OH)), H3A0)
const POSE_B_SHOW: Pose = { o: v3(0.62, -0.1, -0.35), q: POSE_B_CHAIN.q.clone(), theta: ANGLE }

/** Поза молекулы льда с выбором порядка H, при котором поворот от prev наименьший. */
function icePose(mi: number, prev: THREE.Quaternion): { pose: Pose; swap: boolean } {
  const m = ICE_MOLECULES[mi]!
  const p0 = poseFrom(m.o, m.h[0], m.h[1])
  const p1 = poseFrom(m.o, m.h[1], m.h[0])
  return qAngle(prev, p0.q) <= qAngle(prev, p1.q) ? { pose: p0, swap: false } : { pose: p1, swap: true }
}
const ICE_A = icePose(STORY_ICE_SITE.A, POSE_A_SHOW.q)
const ICE_B = icePose(STORY_ICE_SITE.B, POSE_B_SHOW.q)

// ——— Моменты движения (время сюжета) ———
const M = {
  appear: [0, 0.6] as const,
  stretch: 1.0,
  h0bOut: [T.init, stepTo(1) - 0.4] as const,
  h0bFade: [T.init + 0.6, stepTo(1) - 0.4] as const,
  h0aDrift: [T.init, T.init + 1.2] as const,
  h0aFly: [stepFrom(2) + 0.3, T.branchH] as const,
  oBFly: [T.branchH + 0.2, T.branchO] as const,
  recoilH1: [T.branchO, T.branchO + 1.4] as const,
  ohAFly: [stepFrom(3) + 0.3, T.propA] as const,
  ohBFly: [stepFrom(3) + 1.3, T.propB] as const,
  recoilH2: [T.propA, T.propA + 1.4] as const,
  recoilH3: [T.propB, T.propB + 1.4] as const,
  exitMove: [stepFrom(4) + 0.2, stepFrom(4) + 1.8] as const,
  exitFade: [stepFrom(4) + 0.5, stepFrom(4) + 1.8] as const,
  showA: [stepFrom(4) + 0.3, stepFrom(4) + 1.9] as const,
  showB: [stepFrom(4) + 0.3, stepFrom(4) + 1.9] as const,
  iceA: [stepFrom(5) + 0.3, stepFrom(5) + 2.3] as const,
  iceB: [stepFrom(5) + 0.5, stepFrom(5) + 2.5] as const,
  grow: { from: stepFrom(5) + 1.2, to: stepFrom(5) + 4.0, flight: 1.2, appear: 0.7, reach: 0.8 },
  hbond: [stepFrom(5) + 3.0, stepFrom(5) + 4.4] as const,
  edges: [stepFrom(5) + 3.8, stepFrom(5) + 4.6] as const,
  lobes: [stepFrom(4) + 1.4, stepFrom(5) + 0.5] as const,
  partial: [stepFrom(4) + 2.3, stepFrom(5) + 0.5] as const,
}

const EXIT_IDS = ['h1b', 'h2b', 'h3b', 'oC', 'oD'] as const
const EXIT_DIR: Record<(typeof EXIT_IDS)[number], V3> = {
  h1b: mul(U1, 0.8),
  h2b: mul(DIR_A2, 0.8),
  h3b: mul(DIR_B3, 0.8),
  oC: v3(0.8, 0),
  oD: v3(0.8, 0),
}

/** Поза воды A/B во времени t (после её рождения). */
function waterPose(which: 'A' | 'B', t: number): Pose {
  const chain = which === 'A' ? POSE_A_CHAIN : POSE_B_CHAIN
  const show = which === 'A' ? POSE_A_SHOW : POSE_B_SHOW
  const ice = which === 'A' ? ICE_A.pose : ICE_B.pose
  const w1 = which === 'A' ? M.showA : M.showB
  const w2 = which === 'A' ? M.iceA : M.iceB
  if (t <= w1[0]) return chain
  if (t < w1[1]) return blendPose(chain, show, (t - w1[0]) / (w1[1] - w1[0]))
  if (t <= w2[0]) return show
  if (t < w2[1]) return blendPose(show, ice, (t - w2[0]) / (w2[1] - w2[0]), which === 'A' ? 0.25 : -0.25)
  return ice
}

/** Аналитическое положение атома сюжета (только для построения дорожек — с аллокациями). */
function storyPos(id: string, t: number): V3 {
  switch (id) {
    case 'h0a': {
      if (t < T.init) return mv(t, T.init - M.stretch, T.init, H0A0, add(H0A0, mul(U0, 0.02)))
      if (t < M.h0aFly[0]) return mv(t, M.h0aDrift[0], M.h0aDrift[1], add(H0A0, mul(U0, 0.02)), add(H0A0, v3(0.08, 0.03)))
      if (t <= T.branchH) return mv(t, M.h0aFly[0], M.h0aFly[1], add(H0A0, v3(0.08, 0.03)), sub(OA0, mul(U0, OH)))
      if (t <= T.propA) return add(storyPos('oA', t), mul(U0, -OH))
      return atPose(waterPose('A', t), 0)
    }
    case 'h0b': {
      if (t < T.init) return mv(t, T.init - M.stretch, T.init, H0B0, sub(H0B0, mul(U0, 0.02)))
      return mv(t, M.h0bOut[0], M.h0bOut[1], sub(H0B0, mul(U0, 0.02)), add(H0B0, v3(-0.5, 0.26)))
    }
    case 'oA': {
      if (t <= M.ohAFly[0]) return OA0
      if (t <= T.propA) return mv(t, M.ohAFly[0], M.ohAFly[1], OA0, OA_F)
      return atPose(waterPose('A', t), 'o')
    }
    case 'oB': {
      if (t <= T.branchO) return mv(t, M.oBFly[0], M.oBFly[1], OB0, OB_F2, 0.06)
      if (t <= T.propB) return mv(t, M.ohBFly[0], M.ohBFly[1], OB_F2, OB_F)
      return atPose(waterPose('B', t), 'o')
    }
    case 'h1a': {
      if (t < T.branchO) return H1A0
      if (t <= T.propB) return add(storyPos('oB', t), mul(U1, OH))
      return atPose(waterPose('B', t), 0)
    }
    case 'h1b': {
      if (t < T.branchO) return mv(t, T.branchO - M.stretch, T.branchO, H1B0, add(H1B0, mul(U1, 0.015)))
      const rest = add(H1B0, mul(U1, RECOIL))
      if (t < M.exitMove[0]) return mv(t, M.recoilH1[0], M.recoilH1[1], add(H1B0, mul(U1, 0.015)), rest)
      return mv(t, M.exitMove[0], M.exitMove[1], rest, add(rest, EXIT_DIR.h1b))
    }
    case 'h2a': {
      if (t < T.propA) return H2A0
      return atPose(waterPose('A', t), 1)
    }
    case 'h2b': {
      if (t < T.propA) return mv(t, T.propA - M.stretch, T.propA, H2B0, add(H2B0, mul(DIR_A2, 0.02)))
      const rest = add(H2B0, mul(DIR_A2, RECOIL))
      if (t < M.exitMove[0]) return mv(t, M.recoilH2[0], M.recoilH2[1], add(H2B0, mul(DIR_A2, 0.02)), rest)
      return mv(t, M.exitMove[0], M.exitMove[1], rest, add(rest, EXIT_DIR.h2b))
    }
    case 'h3a': {
      if (t < T.propB) return H3A0
      return atPose(waterPose('B', t), 1)
    }
    case 'h3b': {
      if (t < T.propB) return mv(t, T.propB - M.stretch, T.propB, H3B0, add(H3B0, mul(DIR_B3, 0.02)))
      const rest = add(H3B0, mul(DIR_B3, RECOIL))
      if (t < M.exitMove[0]) return mv(t, M.recoilH3[0], M.recoilH3[1], add(H3B0, mul(DIR_B3, 0.02)), rest)
      return mv(t, M.exitMove[0], M.exitMove[1], rest, add(rest, EXIT_DIR.h3b))
    }
    case 'oC':
      return mv(t, M.exitMove[0], M.exitMove[1], OC0, add(OC0, EXIT_DIR.oC))
    case 'oD':
      return mv(t, M.exitMove[0], M.exitMove[1], OD0, add(OD0, EXIT_DIR.oD))
  }
  throw new Error(`h2o: нет атома сюжета ${id}`)
}

/**
 * Сетка сюжета: положение каждого атома сюжета записано каждые 1/30 с (все события и паузы шагов
 * лежат на сетке), между узлами — линейно. Поиск узла — O(1) по индексу, без перебора ключей.
 */
const GRID = 30
const GRID_N = Math.round(H2O_END * GRID) + 1
function gridTrack(id: string): Float64Array {
  const out = new Float64Array(GRID_N * 3)
  for (let k = 0; k < GRID_N; k++) {
    const p = storyPos(id, k / GRID)
    out[k * 3] = p[0]
    out[k * 3 + 1] = p[1]
    out[k * 3 + 2] = p[2]
  }
  return out
}
function sampleGrid(g: Float64Array, t: number, out: THREE.Vector3): void {
  const x = Math.min(Math.max(t * GRID, 0), GRID_N - 1)
  const k0 = Math.min(Math.floor(x), GRID_N - 2)
  const u = x - k0
  const a = k0 * 3
  const b = a + 3
  out.set(g[a]! + (g[b]! - g[a]!) * u, g[a + 1]! + (g[b + 1]! - g[a + 1]!) * u, g[a + 2]! + (g[b + 2]! - g[a + 2]!) * u)
}

// ——— Лёд: молекулы подлетают радиально (ближние к паре сюжета раньше) и вырастают из точки ———
const STORY_ICE_CENTROID: V3 = mul(add(ICE_MOLECULES[STORY_ICE_SITE.A]!.o, ICE_MOLECULES[STORY_ICE_SITE.B]!.o), 0.5)
export const ICE_ARRIVAL: ReadonlyMap<number, { start: number; arrive: number }> = (() => {
  const g = M.grow
  const ranked = ICE_REST.map((mi) => {
    const p = ICE_MOLECULES[mi]!.o
    return { mi, d: Math.hypot(p[0] - STORY_ICE_CENTROID[0], p[1] - STORY_ICE_CENTROID[1], p[2] - STORY_ICE_CENTROID[2]) }
  }).sort((a, b) => a.d - b.d || a.mi - b.mi)
  const out = new Map<number, { start: number; arrive: number }>()
  ranked.forEach((r, rank) => {
    const start = g.from + (rank / Math.max(1, ranked.length - 1)) * (g.to - g.from - g.flight)
    out.set(r.mi, { start, arrive: start + g.flight })
  })
  return out
})()

function iceRestPos(mi: number, role: 'o' | 0 | 1): V3 {
  const m = ICE_MOLECULES[mi]!
  return role === 'o' ? m.o : m.h[role]
}
function iceTrack(mi: number, role: 'o' | 0 | 1): Vec3Track {
  const rest = iceRestPos(mi, role)
  const c = ICE_MOLECULES[mi]!.o
  const d = norm(sub(c, STORY_ICE_CENTROID))
  const a = ICE_ARRIVAL.get(mi)!
  return [
    { t: a.start, v: add(rest, mul(d, M.grow.reach)) },
    { t: a.arrive, v: rest, ease: 'smooth' },
  ]
}

/** Дорожки молекул льда (два ключа: подлёт) и сетки атомов сюжета. */
const POS: Record<string, Vec3Track> = {}
for (const [id, r] of ICE_ROLE_OF) POS[id] = iceTrack(r.mol, r.role)
const TRACKS: readonly (Vec3Track | null)[] = H2O_ATOMS.map((a) => POS[a.id] ?? null)
const GRIDS: readonly (Float64Array | null)[] = H2O_ATOMS.map((a) => (a.kind === 'story' ? gridTrack(a.id) : null))

// ─────────────────────────────────────────────────────────────────────────────
// Ступени (кадр события): неспаренные электроны и материал
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Число неспаренных электронов частицы. Правило Льюиса по числу валентных электронов ядра
 * (первые четыре — поодиночке, дальше пары): H 1, O 2; каждая σ-связь занимает один из них.
 * Молекула O₂ — ТРИПЛЕТ (мультиплетность 3 = 2S + 1 ⇒ S = 1): два неспаренных электрона на
 * молекулу, по одному рисуем у каждого атома (на деле они делокализованы по π*).
 */
function lewisUnpaired(el: ElementSymbol): number {
  const n = ATOMIC_DATA[el].valenceElectrons
  return n <= 4 ? n : 8 - n
}
const U_H = lewisUnpaired('H')
const U_O = lewisUnpaired('O')
const O2_TRIPLET_PER_ATOM = 1

/** Ступенчатая дорожка: значения по событиям (каждая смена — в один кадр, как octetSnap). */
function snapTrack(v0: number, changes: readonly (readonly [number, number])[]): ScalarTrack {
  const keys: { t: number; v: number; ease?: 'step' }[] = [{ t: 0, v: v0 }]
  let cur = v0
  for (const [t, v] of changes) {
    keys.push({ t: t - OCTET_SNAP_EPS, v: cur })
    keys.push({ t, v, ease: 'step' })
    cur = v
  }
  return keys
}

/** Неспаренные электроны атомов сюжета (ступенью в кадр события). */
export const H2O_UNPAIRED: Readonly<Record<string, ScalarTrack>> = {
  h0a: snapTrack(0, [
    [T.init, U_H],
    [T.branchH, U_H - 1],
  ]),
  h0b: snapTrack(0, [[T.init, U_H]]),
  oA: snapTrack(O2_TRIPLET_PER_ATOM, [
    [T.branchH, U_O - 1],
    [T.propA, U_O - 2],
  ]),
  oB: snapTrack(O2_TRIPLET_PER_ATOM, [
    [T.branchH, U_O],
    [T.branchO, U_O - 1],
    [T.propB, U_O - 2],
  ]),
  h1a: snapTrack(0, []),
  h1b: snapTrack(0, [[T.branchO, U_H]]),
  h2a: snapTrack(0, []),
  h2b: snapTrack(0, [[T.propA, U_H]]),
  h3a: snapTrack(0, []),
  h3b: snapTrack(0, [[T.propB, U_H]]),
  oC: snapTrack(O2_TRIPLET_PER_ATOM, []),
  oD: snapTrack(O2_TRIPLET_PER_ATOM, []),
}

/** В кадр рождения молекулы воды её атомы меняют материал gas → covalent. */
const WATER_BORN: Readonly<Record<string, number>> = {
  oA: T.propA,
  h0a: T.propA,
  h2a: T.propA,
  oB: T.propB,
  h1a: T.propB,
  h3a: T.propB,
}

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

const APPEAR: ScalarTrack = [
  { t: M.appear[0], v: 0 },
  { t: M.appear[1], v: 1, ease: 'smooth' },
]
const H0B_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: M.appear[1], v: 1, ease: 'smooth' },
  { t: M.h0bFade[0], v: 1 },
  { t: M.h0bFade[1], v: 0, ease: 'smooth' },
]
const EXIT_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: M.appear[1], v: 1, ease: 'smooth' },
  { t: M.exitFade[0], v: 1 },
  { t: M.exitFade[1], v: 0, ease: 'smooth' },
]
const SPARK: ScalarTrack = [
  { t: T.spark - 0.5, v: 0 },
  { t: T.spark, v: 1, ease: 'outCubic' },
  { t: T.init + 0.1, v: 0, ease: 'smooth' },
]
const LOBES: ScalarTrack = [
  { t: M.lobes[0], v: 0 },
  { t: M.lobes[0] + 0.6, v: 1, ease: 'smooth' },
  { t: M.lobes[1] - 0.4, v: 1 },
  { t: M.lobes[1], v: 0, ease: 'smooth' },
]
const PARTIAL: ScalarTrack = [
  { t: M.partial[0], v: 0 },
  { t: M.partial[0] + 0.6, v: 1, ease: 'smooth' },
  { t: M.partial[1] - 0.4, v: 1 },
  { t: M.partial[1], v: 0, ease: 'smooth' },
]
const HBOND: ScalarTrack = [
  { t: M.hbond[0], v: 0 },
  { t: M.hbond[1], v: 1, ease: 'smooth' },
]
const EDGES: ScalarTrack = [
  { t: M.edges[0], v: 0 },
  { t: M.edges[1], v: 1, ease: 'smooth' },
  { t: H2O_FINISH.from, v: 1 },
  { t: H2O_FINISH.to, v: 0, ease: 'smooth' },
]
const FADE = fadeTrack(H2O_FINISH)
/** Полярность связи O–H: есть с рождения, подчёркнута на шаге 5 до ΔЭО/2 (параметр рисунка). */
const POLARITY_MAX = Math.min(1, (EN_O - EN_H) / 2)
const POLARITY: ScalarTrack = [
  { t: T.branchH, v: 0.3 },
  { t: M.partial[0], v: 0.3 },
  { t: M.partial[0] + 0.6, v: POLARITY_MAX, ease: 'smooth' },
]
/** Окраска кромки δ: параметр рисунка, соотношение O : H = −2 : 1 — молекула электронейтральна. */
const RIM_DELTA = 0.35

// ─────────────────────────────────────────────────────────────────────────────
// Камера: общий план смеси, наезд на искру и цепь, крупно молекула, отъезд на лёд, облёт
// ─────────────────────────────────────────────────────────────────────────────

const _qR = new THREE.Quaternion()
const _eR = new THREE.Euler()
/** Точка p в центр кадра: смещение рига = масштаб × поворот × p (kit/camera: offset = −target). */
function aim(p: V3, zoom: number, yaw = 0, pitch = 0): V3 {
  _eR.set(pitch, yaw, 0, 'YXZ')
  _qR.setFromEuler(_eR)
  const v = new THREE.Vector3(...p).applyQuaternion(_qR).multiplyScalar(H2O_RIG_SCALE * zoom)
  return [v.x, v.y, v.z]
}
const shot = (t: number, zoom: number, p: V3, yaw = 0, pitch = 0): ShotKey => ({ t, zoom, yaw, pitch, target: aim(p, zoom, yaw, pitch) })

const Z_ICE = 0.42
const ICE_YAW0 = 0.32
const ICE_YAW1 = 0.9
const ICE_PITCH = 0.26

export const H2O_CAMERA: ShotTrack = shotTrack([
  shot(0, 0.58, v3(-0.02, 0.1)),
  shot(stepTo(0), 0.6, v3(-0.05, 0.1)),
  shot(stepFrom(1) + 3.4, 0.82, v3(-0.72, 0.3)),
  shot(stepFrom(2) + 2.6, 0.84, v3(-0.35, 0.34)),
  shot(stepTo(2) - 0.3, 0.8, v3(0.05, 0.32)),
  shot(stepFrom(3) + 2.4, 0.72, v3(-0.08, 0.02)),
  shot(stepTo(3) - 0.2, 0.64, v3(0.1, 0.0)),
  shot(stepFrom(4) + 2.1, 1.2, v3(0.12, -0.02, -0.1), 0.42, 0.08),
  shot(stepTo(4), 1.2, v3(0.12, -0.02, -0.1), 0.42, 0.08),
  shot(stepFrom(5) + 2.6, Z_ICE, v3(0, 0, 0), ICE_YAW0, ICE_PITCH),
  ...orbitTrack(stepFrom(6), stepTo(6), ICE_YAW0, ICE_YAW1, ICE_PITCH, Z_ICE),
])

const BASE_EMISSIVE = 0.08
const BASE_BLOOM = 0.3

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D — только формулы, заряды, числа и символы единиц (токены)
// ─────────────────────────────────────────────────────────────────────────────

export type H2oLabelDef = SceneLabelDef & {
  anchor: 'atom' | 'mid' | 'spark' | 'bondOH' | 'bisector' | 'below' | 'iceTop' | 'iceEdgeA' | 'iceEdgeC' | 'pairOO'
  atom?: string
  atom2?: string
  dx?: number
  hosts: readonly string[]
}

const fmt = (v: number, d: number) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d)
const signed = (v: number, d = 1) => (v < 0 ? `−${fmt(-v, d)}` : `+${fmt(v, d)}`)
/** Число знаков, с которыми число хранится в ядре (74.14 → 2, 120.75 → 2, 95.8 → 1). */
const digitsOf = (v: number) => {
  for (let d = 0; d <= 3; d++) if (Math.abs(Math.round(v * 10 ** d) - v * 10 ** d) < 1e-9) return d
  return 3
}
const pm = (v: number) => `${fmt(v, digitsOf(v))} {pm}`

export const ICE_CAPTION = latticeCaption('ice')

const ICE_ATOM_IDS = ICE_DEFS.map((a) => a.id)
const W_WATER_END = stepFrom(5) + 0.4
const EXIT_END = M.exitFade[1]

export const H2O_LABELS: readonly H2oLabelDef[] = [
  // Шаг 1: смесь 2 : 1 — четыре H₂ и два O₂; длины связей r_e
  { id: 'h2m0', kind: 'species', anchor: 'mid', atom: 'h0a', atom2: 'h0b', dy: 0.2, keys: [{ t: 0, text: 'H₂ ({g})' }], windows: [[0.2, T.init]], hosts: ['h0a', 'h0b'] },
  { id: 'h2m1', kind: 'species', anchor: 'mid', atom: 'h1a', atom2: 'h1b', dy: 0.2, keys: [{ t: 0, text: 'H₂ ({g})' }], windows: [[0.2, T.branchO]], hosts: ['h1a', 'h1b'] },
  { id: 'h2m2', kind: 'species', anchor: 'mid', atom: 'h2a', atom2: 'h2b', dy: -0.22, keys: [{ t: 0, text: 'H₂ ({g})' }], windows: [[0.2, T.propA]], hosts: ['h2a', 'h2b'] },
  { id: 'h2m3', kind: 'species', anchor: 'mid', atom: 'h3a', atom2: 'h3b', dy: -0.22, keys: [{ t: 0, text: 'H₂ ({g})' }], windows: [[0.2, T.propB]], hosts: ['h3a', 'h3b'] },
  { id: 'o2m1', kind: 'species', anchor: 'mid', atom: 'oA', atom2: 'oB', dy: 0.24, keys: [{ t: 0, text: 'O₂ ({g})' }], windows: [[0.2, T.branchH]], hosts: ['oA', 'oB'] },
  { id: 'o2m2', kind: 'species', anchor: 'mid', atom: 'oC', atom2: 'oD', dy: 0.3, keys: [{ t: 0, text: 'O₂ ({g})' }], windows: [[0.2, EXIT_END]], hosts: ['oC', 'oD'] },
  { id: 'dHH', kind: 'measure', anchor: 'mid', atom: 'h0a', atom2: 'h0b', dy: -0.16, keys: [{ t: 0, text: pm(bondLengthPm('H-H')) }], windows: [[0.6, stepTo(0) + 0.6]], hosts: [] },
  { id: 'dOO', kind: 'measure', anchor: 'mid', atom: 'oA', atom2: 'oB', dy: -0.2, keys: [{ t: 0, text: pm(bondLengthPm('O=O')) }], windows: [[0.6, stepTo(0) + 0.6]], hosts: [] },
  // Шаг 2: искра (единственное свечение, вне молекул) и два радикала H·
  { id: 'spark', kind: 'delta', anchor: 'spark', dy: 0.14, keys: [{ t: 0, text: `${signed(H2O_CHAIN_KJ.initiation)} {kJmol}` }], windows: [[T.spark - 0.4, stepTo(1) - 0.1]], hosts: [] },
  { id: 'r0a', kind: 'species', anchor: 'atom', atom: 'h0a', dy: 0.1, keys: [{ t: 0, text: 'H·' }], windows: [[T.init, T.branchH]], hosts: ['h0a'] },
  { id: 'r0b', kind: 'species', anchor: 'atom', atom: 'h0b', dy: 0.1, keys: [{ t: 0, text: 'H·' }], windows: [[T.init, M.h0bFade[1]]], hosts: ['h0b'] },
  // Шаги 3–5: частицы цепи — ступенью в кадр события
  {
    id: 'ctrA',
    kind: 'species',
    anchor: 'atom',
    atom: 'oA',
    dy: 0.12,
    keys: [
      { t: 0, text: '·OH' },
      { t: T.propA, text: 'H₂O ({g})' },
    ],
    windows: [[T.branchH, W_WATER_END]],
    hosts: [...WATER_A],
  },
  {
    id: 'ctrB',
    kind: 'species',
    anchor: 'atom',
    atom: 'oB',
    dy: 0.12,
    keys: [
      { t: 0, text: 'O(³P)' },
      { t: T.branchO, text: '·OH' },
      { t: T.propB, text: 'H₂O ({g})' },
    ],
    windows: [[T.branchH, W_WATER_END]],
    hosts: [...WATER_B],
  },
  { id: 'r1b', kind: 'species', anchor: 'atom', atom: 'h1b', dy: 0.1, keys: [{ t: 0, text: 'H·' }], windows: [[T.branchO, EXIT_END]], hosts: ['h1b'] },
  { id: 'r2b', kind: 'species', anchor: 'atom', atom: 'h2b', dy: -0.1, keys: [{ t: 0, text: 'H·' }], windows: [[T.propA, EXIT_END]], hosts: ['h2b'] },
  { id: 'r3b', kind: 'species', anchor: 'atom', atom: 'h3b', dy: -0.1, keys: [{ t: 0, text: 'H·' }], windows: [[T.propB, EXIT_END]], hosts: ['h3b'] },
  // ΔH элементарных стадий цепи (ядро: REACTION_STEP_CHAINS.h2_o2)
  { id: 'dHbrH', kind: 'delta', anchor: 'atom', atom: 'oA', dy: -0.2, keys: [{ t: 0, text: `${signed(H2O_CHAIN_KJ.branchH)} {kJmol}` }], windows: [[T.branchH, T.branchO - 0.2]], hosts: [] },
  { id: 'dHbrO', kind: 'delta', anchor: 'atom', atom: 'oB', dy: -0.2, keys: [{ t: 0, text: `${signed(H2O_CHAIN_KJ.branchO)} {kJmol}` }], windows: [[T.branchO, stepTo(2) - 0.1]], hosts: [] },
  { id: 'dHprop', kind: 'delta', anchor: 'atom', atom: 'oA', dy: -0.34, keys: [{ t: 0, text: `${signed(H2O_CHAIN_KJ.propagation)} {kJmol}` }], windows: [[T.propA, stepTo(3) - 0.1]], hosts: [] },
  // Шаг 5: геометрия и полярность молекулы A
  { id: 'dOH', kind: 'measure', anchor: 'bondOH', atom: 'oA', atom2: 'h2a', dy: 0, keys: [{ t: 0, text: pm(bondLengthPm('O-H')) }], windows: [[M.showA[1] - 0.3, stepTo(4) + 0.2]], hosts: [] },
  { id: 'angle', kind: 'token', anchor: 'bisector', atom: 'oA', dy: 0, keys: [{ t: 0, text: `${fmt(ANGLE, digitsOf(ANGLE))}°` }], windows: [[M.showA[1] - 0.3, stepTo(4) + 0.2]], hosts: [] },
  { id: 'dMinus', kind: 'ox', anchor: 'atom', atom: 'oA', dy: 0.3, keys: [{ t: 0, text: 'δ−' }], windows: [[M.partial[0], stepTo(4) + 0.2]], hosts: [] },
  { id: 'dPlus1', kind: 'ox', anchor: 'atom', atom: 'h0a', dy: -0.09, keys: [{ t: 0, text: 'δ+' }], windows: [[M.partial[0], stepTo(4) + 0.2]], hosts: [] },
  { id: 'dPlus2', kind: 'ox', anchor: 'atom', atom: 'h2a', dy: -0.09, keys: [{ t: 0, text: 'δ+' }], windows: [[M.partial[0], stepTo(4) + 0.2]], hosts: [] },
  { id: 'mu', kind: 'delta', anchor: 'below', atom: 'oA', dy: -0.5, keys: [{ t: 0, text: `μ = ${fmt(H2O_GEOM.data.dipoleD, digitsOf(H2O_GEOM.data.dipoleD))} D` }], windows: [[M.partial[0] + 0.3, stepTo(4) + 0.2]], hosts: [] },
  // Шаги 6–7: лёд Ih
  { id: 'ice', kind: 'species', anchor: 'iceTop', dy: 0.4, keys: [{ t: 0, text: 'H₂O ({s})' }], windows: [[M.iceA[1] - 0.4, H2O_END]], hosts: [...WATER_A, ...WATER_B, ...ICE_ATOM_IDS] },
  { id: 'cellA', kind: 'measure', anchor: 'iceEdgeA', dy: -0.2, keys: [{ t: 0, text: ICE_CAPTION[0]! }], windows: [[M.edges[0], H2O_END]], hosts: [] },
  { id: 'cellC', kind: 'measure', anchor: 'iceEdgeC', dy: 0, dx: 0.22, keys: [{ t: 0, text: ICE_CAPTION[1]! }], windows: [[M.edges[0] + 0.2, H2O_END]], hosts: [] },
  { id: 'sg', kind: 'token', anchor: 'iceTop', dy: 0.85, dx: -0.55, keys: [{ t: 0, text: ICE_CAPTION[2]! }], windows: [[M.edges[0] + 0.4, H2O_END]], hosts: [] },
  { id: 'cn', kind: 'token', anchor: 'iceTop', dy: 0.85, dx: 0.55, keys: [{ t: 0, text: ICE_CAPTION[3]! }], windows: [[M.edges[0] + 0.4, H2O_END]], hosts: [] },
  { id: 'oo', kind: 'measure', anchor: 'pairOO', dy: 0.16, keys: [{ t: 0, text: pm(ICE_OO_PM) }], windows: [[M.hbond[1] - 0.4, stepFrom(6) + 1.2]], hosts: [] },
  // Шаг 7: итог — ΔH°f пара и жидкости из ядра
  { id: 'dHg', kind: 'delta', anchor: 'iceTop', dy: 1.3, keys: [{ t: 0, text: `ΔH°f(H₂O, {g}) = ${signed(H2O_THERMO.gasKJ)} {kJmol}` }], windows: [[stepFrom(6) + 0.4, H2O_END]], hosts: [] },
  { id: 'dHl', kind: 'delta', anchor: 'iceTop', dy: 1.7, keys: [{ t: 0, text: `ΔH°f(H₂O, {l}) = ${signed(H2O_THERMO.liquidKJ)} {kJmol}` }], windows: [[stepFrom(6) + 0.8, H2O_END]], hosts: [] },
]

export type H2oLabelState = SceneLabelState

/** Ребро a: нижнее переднее ребро ячейки вдоль x; ребро c: вертикальное переднее правое. */
const EDGE_A: LatticeSegment = (() => {
  const e = ICE_FRAG.cellEdges
  const bottom = Math.min(...e.flatMap(([p, q]) => [p[1], q[1]]))
  const cand = e.filter(([p, q]) => Math.abs(p[1] - bottom) < 1e-6 && Math.abs(q[1] - bottom) < 1e-6 && Math.abs(p[2] - q[2]) < 1e-6)
  cand.sort((a, b) => Math.max(b[0][2], b[1][2]) - Math.max(a[0][2], a[1][2]) || Math.min(a[0][0], a[1][0]) - Math.min(b[0][0], b[1][0]))
  return cand[0]!
})()
const EDGE_C: LatticeSegment = (() => {
  const e = ICE_FRAG.cellEdges.filter(([p, q]) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[2] - q[2]) < 1e-6)
  e.sort((a, b) => b[0][2] + b[0][0] * 0.3 - (a[0][2] + a[0][0] * 0.3))
  return e[0]!
})()
export const H2O_EDGE_A = EDGE_A
export const H2O_EDGE_C = EDGE_C

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type H2oBondState = { on: boolean; amount: number; stress: number; thinning: number; form: number }

export type H2oFrame = {
  t: number
  pos: THREE.Vector3[]
  radius: Float32Array
  opacity: Float32Array
  emissive: Float32Array
  /** δ для окраски кромки (−1…+1) */
  charge: Float32Array
  material: SubstanceKind[]
  /** неспаренные электроны атома (точки) */
  unpaired: Int8Array
  /** направления точек: по два вектора на атом (второй нужен только O(³P)) */
  dotDir: THREE.Vector3[]
  h2: H2oBondState[]
  o2: H2oBondState[]
  oh: (H2oBondState & { polarity: number })[]
  /** связи O–H молекул льда: по две на молекулу (0…1) */
  iceOH: Float32Array
  /** водородные связи льда (0…1) */
  hbond: Float32Array
  /** неподелённые пары молекулы A */
  lobes: { amount: number; center: THREE.Vector3; axis: [THREE.Vector3, THREE.Vector3] }
  spark: { amount: number; pos: THREE.Vector3 }
  edges: number
  /** амплитуды эффектов (тест: на шагах льда и итога все 0) */
  fx: { spark: number; dots: number; lobes: number }
  labels: H2oLabelState[]
  camera: SceneCamera
  fade: number
}

export function createH2oFrame(): H2oFrame {
  const n = H2O_ATOMS.length
  const bond = (): H2oBondState => ({ on: false, amount: 0, stress: 0, thinning: 0, form: 0 })
  return {
    t: 0,
    pos: H2O_ATOMS.map(() => new THREE.Vector3()),
    radius: new Float32Array(n),
    opacity: new Float32Array(n),
    emissive: new Float32Array(n).fill(BASE_EMISSIVE),
    charge: new Float32Array(n),
    material: H2O_ATOMS.map(() => 'gas' as SubstanceKind),
    unpaired: new Int8Array(n),
    dotDir: Array.from({ length: n * 2 }, () => new THREE.Vector3()),
    h2: H2_MOLECULES.map(bond),
    o2: O2_MOLECULES.map(bond),
    oh: STORY_OH.map(() => ({ ...bond(), polarity: 0 })),
    iceOH: new Float32Array(ICE_MOLECULES.length * 2),
    hbond: new Float32Array(ICE_HBONDS.length),
    lobes: { amount: 0, center: new THREE.Vector3(), axis: [new THREE.Vector3(), new THREE.Vector3()] },
    spark: { amount: 0, pos: new THREE.Vector3(...SPARK_POS) },
    edges: 0,
    fx: { spark: 0, dots: 0, lobes: 0 },
    labels: createLabelStates(H2O_LABELS),
    camera: createSceneCamera(),
    fade: 0,
  }
}

let _cur: H2oFrame | null = null
/** Вынос подписи длины связи наружу от молекулы, мировые единицы (параметр рисунка). */
const LABEL_OUT = 0.16
const _m = new THREE.Vector3()
const _n = new THREE.Vector3()

function anchorLabel(def: SceneLabelDef, st: SceneLabelState): void {
  const f = _cur!
  const d = def as H2oLabelDef
  const p = f.pos
  switch (d.anchor) {
    case 'atom': {
      const i = IDX(d.atom!)
      st.pos.copy(p[i]!)
      st.pos.y += d.dy > 0 ? f.radius[i]! + d.dy : -(f.radius[i]! - d.dy)
      return
    }
    case 'mid':
      st.pos.copy(p[IDX(d.atom!)]!).lerp(p[IDX(d.atom2!)]!, 0.5)
      st.pos.y += d.dy
      return
    case 'spark':
      st.pos.copy(f.spark.pos)
      st.pos.y += d.dy
      return
    case 'bondOH': {
      // Середина связи O–H, вынесенная наружу от центра молекулы A (подпись не ложится на шары).
      st.pos.copy(p[IDX(d.atom!)]!).lerp(p[IDX(d.atom2!)]!, 0.5)
      _m.copy(p[I.oA]!).add(p[I.h0a]!).add(p[I.h2a]!).multiplyScalar(1 / 3)
      _n.copy(st.pos).sub(_m)
      const l = _n.length() || 1
      st.pos.addScaledVector(_n, LABEL_OUT / l)
      return
    }
    case 'bisector': {
      // Вершина угла: чуть ниже O по биссектрисе к водородам.
      const o = p[IDX('oA')]!
      _m.copy(p[IDX('h0a')]!).add(p[IDX('h2a')]!).multiplyScalar(0.5).sub(o)
      st.pos.copy(o).addScaledVector(_m, 0.55)
      return
    }
    case 'below':
      st.pos.copy(p[IDX(d.atom!)]!)
      st.pos.y += d.dy
      return
    case 'iceTop':
      st.pos.set(d.dx ?? 0, ICE_FRAG.boundsScene.max[1] + d.dy, 0)
      return
    case 'iceEdgeA':
      st.pos.set((EDGE_A[0][0] + EDGE_A[1][0]) / 2, (EDGE_A[0][1] + EDGE_A[1][1]) / 2 + d.dy, (EDGE_A[0][2] + EDGE_A[1][2]) / 2)
      return
    case 'iceEdgeC':
      st.pos.set((EDGE_C[0][0] + EDGE_C[1][0]) / 2 + (d.dx ?? 0), (EDGE_C[0][1] + EDGE_C[1][1]) / 2, (EDGE_C[0][2] + EDGE_C[1][2]) / 2)
      return
    case 'pairOO':
      st.pos.copy(p[IDX('oA')]!).lerp(p[IDX('oB')]!, 0.5)
      st.pos.y += d.dy
      return
  }
}

const I = {
  h0a: IDX('h0a'),
  h0b: IDX('h0b'),
  oA: IDX('oA'),
  oB: IDX('oB'),
  h1a: IDX('h1a'),
  h1b: IDX('h1b'),
  h2a: IDX('h2a'),
  h2b: IDX('h2b'),
  h3a: IDX('h3a'),
  h3b: IDX('h3b'),
  oC: IDX('oC'),
  oD: IDX('oD'),
} as const
const STORY_N = STORY.length
const UNPAIRED_TRACKS: readonly ScalarTrack[] = STORY.map((a) => H2O_UNPAIRED[a.id]!)
const EXIT_SET = new Set<number>(EXIT_IDS.map((id) => IDX(id)))
const ICE_START: readonly number[] = H2O_ATOMS.map((a) => (a.kind === 'ice' ? ICE_ARRIVAL.get(ICE_ROLE_OF.get(a.id)!.mol)!.start : 0))
/** Индексы атомов молекул льда: [o, h0, h1] (для сюжетных A и B — атомы сюжета в порядке позы). */
export const ICE_MOL_ATOMS: readonly (readonly [number, number, number])[] = ICE_MOLECULES.map((_, mi) => {
  if (mi === STORY_ICE_SITE.A) return ICE_A.swap ? [I.oA, I.h2a, I.h0a] : [I.oA, I.h0a, I.h2a]
  if (mi === STORY_ICE_SITE.B) return ICE_B.swap ? [I.oB, I.h3a, I.h1a] : [I.oB, I.h1a, I.h3a]
  return [IDX(`I${mi}o`), IDX(`I${mi}h0`), IDX(`I${mi}h1`)]
})

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleH2oFrame(t: number, frame: H2oFrame): H2oFrame {
  frame.t = t
  const { pos, radius, opacity, emissive, charge, material, unpaired } = frame
  for (let i = 0; i < H2O_ATOMS.length; i++) {
    const g = GRIDS[i]
    if (g) sampleGrid(g, t, pos[i]!)
    else sampleVec3(TRACKS[i]!, t, pos[i]!)
    emissive[i] = BASE_EMISSIVE
  }

  // ——— Атомы сюжета ———
  const appear = sampleScalar(APPEAR, t)
  const exitA = sampleScalar(EXIT_OPACITY, t)
  const partial = sampleScalar(PARTIAL, t)
  for (let i = 0; i < STORY_N; i++) {
    const el = H2O_ATOMS[i]!.el
    radius[i] = el === 'H' ? R.h : R.o
    opacity[i] = i === I.h0b ? sampleScalar(H0B_OPACITY, t) : EXIT_SET.has(i) ? exitA : appear
    unpaired[i] = Math.round(sampleScalar(UNPAIRED_TRACKS[i]!, t))
    const born = WATER_BORN[H2O_ATOMS[i]!.id]
    material[i] = born != null && t >= born ? 'covalent' : 'gas'
    charge[i] = 0
  }
  // δ± у молекулы A на шаге 5 (кромка): O −2k, каждый H +k — сумма 0.
  charge[I.oA] = -2 * RIM_DELTA * partial
  charge[I.h0a] = RIM_DELTA * partial
  charge[I.h2a] = RIM_DELTA * partial

  // ——— Лёд: готовые молекулы, вырастают из точки в начале подлёта ———
  for (let i = STORY_N; i < H2O_ATOMS.length; i++) {
    const a = ICE_START[i]!
    const grow = t <= a ? 0 : smoothstep(a, a + M.grow.appear, t)
    radius[i] = (H2O_ATOMS[i]!.el === 'H' ? R.h : R.o) * grow
    opacity[i] = grow * 3 >= 1 ? 1 : grow * 3
    material[i] = 'covalent'
    charge[i] = 0
    unpaired[i] = 0
  }

  // ——— Связи H₂ и O₂: флаг on ступенью в кадр события, картинка догорает за доли секунды ———
  for (let k = 0; k < H2_MOLECULES.length; k++) {
    const m = H2_MOLECULES[k]!
    const b = frame.h2[k]!
    const vis = Math.min(opacity[IDX(m.a)]!, opacity[IDX(m.b)]!)
    b.on = t < m.breakAt
    b.stress = smoothstep(m.breakAt - M.stretch, m.breakAt, t)
    b.thinning = smoothstep(m.breakAt - 0.15, m.breakAt + 0.35, t)
    b.amount = vis * (b.on ? 1 : 1 - smoothstep(m.breakAt, m.breakAt + 0.4, t))
    b.form = 1
  }
  for (let k = 0; k < O2_MOLECULES.length; k++) {
    const m = O2_MOLECULES[k]!
    const b = frame.o2[k]!
    const vis = Math.min(opacity[IDX(m.a)]!, opacity[IDX(m.b)]!)
    b.on = t < m.breakAt
    b.stress = smoothstep(m.breakAt - M.stretch, m.breakAt, t)
    b.thinning = smoothstep(m.breakAt - 0.15, m.breakAt + 0.35, t)
    b.amount = vis * (b.on ? 1 : 1 - smoothstep(m.breakAt, m.breakAt + 0.4, t))
    b.form = 1
  }
  const polarity = sampleScalar(POLARITY, t)
  for (let k = 0; k < STORY_OH.length; k++) {
    const m = STORY_OH[k]!
    const b = frame.oh[k]!
    b.on = t >= m.formAt
    b.amount = b.on ? smoothstep(m.formAt, m.formAt + 0.25, t) * Math.min(opacity[IDX(m.o)]!, opacity[IDX(m.h)]!) : 0
    b.form = b.on ? smoothstep(m.formAt, m.formAt + 0.6, t) : 0
    b.stress = 0
    b.thinning = 0
    b.polarity = polarity
  }
  // Связи O–H молекул льда (у сюжетных — это их же связи, здесь только чужие молекулы).
  for (let mi = 0; mi < ICE_MOLECULES.length; mi++) {
    const [o] = ICE_MOL_ATOMS[mi]!
    const v = H2O_ATOMS[o]!.kind === 'ice' ? opacity[o]! : 0
    frame.iceOH[mi * 2] = v
    frame.iceOH[mi * 2 + 1] = v
  }
  const hb = sampleScalar(HBOND, t)
  for (let k = 0; k < ICE_HBONDS.length; k++) {
    const h = ICE_HBONDS[k]!
    const d = ICE_MOL_ATOMS[h.donor]![0]
    const a = ICE_MOL_ATOMS[h.acceptor]![0]
    frame.hbond[k] = hb * Math.min(opacity[d]!, opacity[a]!)
  }

  // ——— Точки неспаренных электронов: направления ———
  let dots = 0
  for (let i = 0; i < STORY_N; i++) {
    if (unpaired[i]! > 0) dots += opacity[i]!
    writeDotDirs(frame, i, t)
  }
  frame.fx.dots = dots

  // ——— Неподелённые пары молекулы A: оси — по тетраэдру, ⟂ плоскости молекулы, против водородов ———
  const lob = sampleScalar(LOBES, t)
  frame.lobes.amount = lob
  frame.fx.lobes = lob
  if (lob > 0) writeLonePairs(frame)

  // ——— Искра: вне молекул, только на шаге 2 ———
  frame.spark.amount = sampleScalar(SPARK, t)
  frame.fx.spark = frame.spark.amount

  frame.edges = sampleScalar(EDGES, t)
  frame.fade = sampleScalar(FADE, t)

  _cur = frame
  sampleLabels(H2O_LABELS, frame.labels, t, anchorLabel, frame.fade)
  _cur = null

  const cam = frame.camera
  sampleShot(H2O_CAMERA, t, cam)
  cam.shake = 0
  cam.bloom = BASE_BLOOM + 0.2 * frame.spark.amount
  cam.vignette = Math.max(0.3, frame.fade)
  return frame
}

/** Направления точек неспаренных электронов (без аллокаций). */
function writeDotDirs(frame: H2oFrame, i: number, t: number): void {
  const d0 = frame.dotDir[i * 2]!
  const d1 = frame.dotDir[i * 2 + 1]!
  const p = frame.pos
  switch (i) {
    case I.oA:
      if (t < T.branchH) d0.set(0, 1, 0) // O₂ (триплет): над осью молекулы
      else d0.copy(p[I.oA]!).sub(p[I.h0a]!).normalize() // ·OH: на кислороде, против H
      d1.copy(d0)
      return
    case I.oB:
      if (t < T.branchH) {
        d0.set(0, -1, 0) // O₂ (триплет): под осью
        d1.copy(d0)
      } else if (t < T.branchO) {
        d0.set(-U1[1], U1[0], 0) // O(³P): две точки по обе стороны пути
        d1.set(U1[1], -U1[0], 0)
      } else {
        d0.copy(p[I.oB]!).sub(p[I.h1a]!).normalize()
        d1.copy(d0)
      }
      return
    case I.oC:
      d0.set(-1, 0, 0)
      d1.copy(d0)
      return
    case I.oD:
      d0.set(1, 0, 0)
      d1.copy(d0)
      return
    case I.h0a:
      d0.set(0, 1, 0)
      d1.copy(d0)
      return
    case I.h0b:
      d0.set(-1, 0, 0)
      d1.copy(d0)
      return
    case I.h1b:
      d0.set(U1[0], U1[1], 0)
      d1.copy(d0)
      return
    case I.h2b:
      d0.set(DIR_A2[0], DIR_A2[1], 0)
      d1.copy(d0)
      return
    case I.h3b:
      d0.set(DIR_B3[0], DIR_B3[1], 0)
      d1.copy(d0)
      return
    default:
      d0.set(0, 1, 0)
      d1.copy(d0)
  }
}

const COS_LP = Math.cos((TETRAHEDRAL_ANGLE_DEG / 2) * D2R)
const SIN_LP = Math.sin((TETRAHEDRAL_ANGLE_DEG / 2) * D2R)

/** Две неподелённые пары O молекулы A: биссектриса против H, плоскость пар ⟂ плоскости молекулы. */
function writeLonePairs(frame: H2oFrame): void {
  const p = frame.pos
  const o = p[I.oA]!
  frame.lobes.center.copy(o)
  // −биссектриса (от водородов) и нормаль плоскости H–O–H
  _m.copy(p[I.h0a]!).sub(o).normalize()
  _n.copy(p[I.h2a]!).sub(o).normalize()
  const nx = _m.y * _n.z - _m.z * _n.y
  const ny = _m.z * _n.x - _m.x * _n.z
  const nz = _m.x * _n.y - _m.y * _n.x
  _m.add(_n).normalize().negate()
  const l = Math.hypot(nx, ny, nz) || 1
  const [a0, a1] = frame.lobes.axis
  a0.set(_m.x * COS_LP + (nx / l) * SIN_LP, _m.y * COS_LP + (ny / l) * SIN_LP, _m.z * COS_LP + (nz / l) * SIN_LP)
  a1.set(_m.x * COS_LP - (nx / l) * SIN_LP, _m.y * COS_LP - (ny / l) * SIN_LP, _m.z * COS_LP - (nz / l) * SIN_LP)
}

// ─────────────────────────────────────────────────────────────────────────────
// Проверки
// ─────────────────────────────────────────────────────────────────────────────

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validateH2oStoryboard(): void {
  const vec: Record<string, Vec3Track> = {}
  for (const [id, track] of Object.entries(POS)) vec[`pos.${id}`] = track
  for (const g of GRIDS) if (g && !g.every(Number.isFinite)) throw new Error('h2o: сетка положений сюжета содержит не-число')
  vec['cam.offset'] = H2O_CAMERA.offset
  validateTracks(vec)
  validateTracks({
    ...H2O_UNPAIRED,
    APPEAR,
    H0B_OPACITY,
    EXIT_OPACITY,
    SPARK,
    LOBES,
    PARTIAL,
    HBOND,
    EDGES,
    FADE,
    POLARITY,
    camZoom: H2O_CAMERA.zoom,
    camYaw: H2O_CAMERA.yaw,
    camPitch: H2O_CAMERA.pitch,
  })

  const nH = STORY.filter((a) => a.el === 'H').length
  const nO = STORY.filter((a) => a.el === 'O').length
  if (nH !== 8 || nO !== 4) throw new Error(`h2o: в смеси 4 H₂ + 2 O₂ (8 H, 4 O), а не ${nH} H, ${nO} O`)
  if (ICE_MOLECULES.length !== ICE_FRAG.sites.length) throw new Error('h2o: молекул льда не столько, сколько узлов O')
  if (H2O_ATOMS.length !== STORY_N + 3 * (ICE_MOLECULES.length - 2)) throw new Error('h2o: состав кадра льда')

  // Реагенты — двухатомные молекулы с длинами ядра.
  const d = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  for (const [a, b] of [
    [H0A0, H0B0],
    [H1A0, H1B0],
    [H2A0, H2B0],
    [H3A0, H3B0],
  ] as const) {
    if (Math.abs(d(a, b) - HH) > 1e-9) throw new Error('h2o: длина H–H не из ядра')
  }
  if (Math.abs(d(OA0, OB0) - OO) > 1e-9 || Math.abs(d(OC0, OD0) - OO) > 1e-9) throw new Error('h2o: длина O=O не из ядра')

  // Частицы не перекрываются в кадре шага 1 (разные молекулы — дальше 2 радиусов O).
  const mols = [
    [H0A0, H0B0],
    [OA0, OB0],
    [H1A0, H1B0],
    [H2A0, H2B0],
    [H3A0, H3B0],
    [OC0, OD0],
  ]
  for (let i = 0; i < mols.length; i++) {
    for (let j = i + 1; j < mols.length; j++) {
      for (const p of mols[i]!) for (const q of mols[j]!) if (d(p, q) < 4 * R.o) throw new Error(`h2o: молекулы ${i} и ${j} слипаются в кадре шага 1`)
    }
  }

  // Физика размера и полярности.
  if (!(R.h < R.o)) throw new Error('h2o: атом H обязан быть меньше атома O')
  if (!(EN_O > EN_H)) throw new Error('h2o: ЭО кислорода обязана быть больше ЭО водорода')
  if (U_O !== 2 || U_H !== 1) throw new Error(`h2o: по Льюису у O ${U_O}, у H ${U_H} неспаренных — ожидалось 2 и 1`)
  if (H2O_END <= stepTo(LAST)) throw new Error('h2o: хвост сцены пустой')
}

/** Для теста: позы и параметры рисунка, которые тест пересчитывает. */
export const H2O_DEBUG = {
  sparkPos: SPARK_POS,
  poseAShow: POSE_A_SHOW,
  moves: M,
  exitIds: EXIT_IDS,
  qAngle,
} as const
