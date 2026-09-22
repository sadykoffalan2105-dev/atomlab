import * as THREE from 'three'
import {
  ATOMIC_DATA,
  bondAngleDeg,
  bondLengthPm,
  radiusForSpecies,
  reagentAngleDeg,
  reagentBondPm,
} from '../../../../chemistry/data'
import { sampleScalar, sampleVec3, type ScalarTrack, type Vec3Key, type Vec3Track } from '../../core/tracks'
import { createBridgedFrame, writeBridged, type BridgedFrame } from '../../core/vsepr'
import { orbitTrack, sampleShot, shotTrack, type ShotTrack } from '../kit/camera'
import { oxidationLabel, pmToScene, SPECIES_SCALE } from '../kit/cpkAtoms'
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
import { octetSnap } from '../kit/valence'
import { MN2O7_DECOMP_COEF, MN2O7_DECOMP_DH_KJ, MN2O7_DECOMP_ESTIMATED, MN2O7_DHF_ESTIMATED, MN2O7_DHF_KJ } from './mn2o7Energetics'
import { MN2O7_END, MN2O7_FINISH, MN2O7_PROTONS, MN2O7_STEPS, mn2o7CueAt } from './mn2o7Steps'

export {
  MN2O7_CUES,
  MN2O7_END,
  MN2O7_FINISH,
  MN2O7_PROTONS,
  MN2O7_SEGMENTS,
  MN2O7_STEPS,
  MN2O7_STEP_IDS,
  MN2O7_TIMING,
  mn2o7StepIndexAt,
  type Mn2o7CueId,
  type Mn2o7StepId,
} from './mn2o7Steps'

/**
 * Раскадровка 2 KMnO₄ + H₂SO₄ → Mn₂O₇ + K₂SO₄ + H₂O — ЧИСТАЯ функция времени сюжета (по эталону NaCl).
 *
 * Ни одного числа химии: длины и углы — из bondData (Mn–O перманганата, концевая и мостиковая Mn–O
 * в Mn₂O₇, угол Mn–O–Mn, набор H₂SO₄ одного метода, S–O сульфата, O–H и угол воды, H···O водородной
 * связи), радиусы — из atomicData (K⁺ — Шеннон, остальные атомы ковалентных частиц — Кордеро),
 * степени окисления и порядки связей считаются из электронейтральности и валентности O.
 *
 * Правила эталона, выполненные по построению:
 *   • в кадре только объекты текущего шага: у каждого атома есть span [первый, последний шаг],
 *     вне него непрозрачность строго 0 (тест — каждые 1/60 с);
 *   • каждый видимый атом подписан подписью-хозяином (label.hosts), капля — своей подписью;
 *   • протон переходит вдоль водородной связи O–H···O: связь O–H, заряды групп и подписи
 *     переключаются в ОДИН кадр (hop); свободного H⁺ нет, Σ зарядов групп = 0 в любой кадр;
 *   • атомы молекулы живут от первого до последнего кадра: HMnO₄ (A) и HMnO₄ (B) становятся
 *     Mn₂O₇, мостиковый O — бывший OH молекулы B, вода — OH молекулы A + протон молекулы B;
 *   • финал без огня, ореолов и свечения: FX-амплитуды = 0, у капли нет emissive.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Числа ядра (пм, градусы) — в одном месте
// ─────────────────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180

/** Длины, пм — только из ядра. */
export const MN2O7_PM = {
  /** Mn–O в MnO₄⁻ (KMnO₄, Palenik 1967) */
  mnO4: reagentBondPm('permanganate', 'Mn–O'),
  /** Mn–O концевая в Mn₂O₇ */
  term: bondLengthPm('Mn-O(term)'),
  /** Mn–O мостиковая в Mn₂O₇ */
  bridge: bondLengthPm('Mn-O(bridge)'),
  /** H₂SO₄ (г), один набор r₀ */
  sDouble: reagentBondPm('h2so4', 'S=O'),
  sOH: reagentBondPm('h2so4', 'S–O(H)'),
  oh: reagentBondPm('h2so4', 'O–H'),
  /** S–O сульфат-иона */
  sulfate: reagentBondPm('sulfate', 'S–O'),
  /** вода (г), r₀ */
  ohWater: bondLengthPm('O-H'),
  /** H···O водородной связи (как в воде — схема) */
  hBond: bondLengthPm('O-H...O'),
} as const

/** Углы, градусы — только из ядра. */
export const MN2O7_DEG = {
  mnOMn: bondAngleDeg('mn2o7MnOMn'),
  /** ∠O–Mn–O тетраэдра MnO₄⁻; отдельного угла O–Mn–O для Mn₂O₇ в ядре нет — берётся он же */
  oMnO: reagentAngleDeg('permanganate', '∠O–Mn–O'),
  oSo: reagentAngleDeg('h2so4', '∠O=S=O'),
  hoSoh: reagentAngleDeg('h2so4', '∠HO–S–OH'),
  sOH: reagentAngleDeg('h2so4', '∠S–O–H'),
  sulfate: reagentAngleDeg('sulfate', '∠O–S–O'),
  water: bondAngleDeg('water'),
} as const

/** Степень окисления кислорода из валентного слоя: 8 − 6 = 2 электрона до октета → −2. */
const OX_O = -(8 - ATOMIC_DATA.O.valenceElectrons)
/** Степень окисления Mn в частице Mn_nO_m^q из электронейтральности. */
export function mnOxidationState(nMn: number, nO: number, charge: number): number {
  return (charge - nO * OX_O) / nMn
}
/**
 * Средний порядок связи X–O в оксоанионе XO₄^q: валентность O (2) на каждый O минус заряд,
 * поделённые на четыре связи. MnO₄⁻ → 1¾, SO₄²⁻ → 1½. π-доля = порядок − 1.
 */
export function oxoanionBondOrder(nO: number, charge: number): number {
  return (nO * -OX_O - Math.abs(charge)) / nO
}
const PI_MNO4 = oxoanionBondOrder(4, -1) - 1
const PI_SO4 = oxoanionBondOrder(4, -2) - 1

export type Mn2o7Element = 'K' | 'Mn' | 'O' | 'S' | 'H'

/** Радиусы, пм: K⁺ — Шеннон (КЧ 6), атомы ковалентных частиц — Кордеро. */
export const MN2O7_RADIUS_PM: Readonly<Record<Mn2o7Element, number>> = {
  K: radiusForSpecies('K', 1),
  Mn: radiusForSpecies('Mn', 0, { model: 'covalent' }),
  O: radiusForSpecies('O', 0, { model: 'covalent' }),
  S: radiusForSpecies('S', 0, { model: 'covalent' }),
  H: radiusForSpecies('H', 0, { model: 'covalent' }),
}

/** Контакт K⁺···O для схемы формульной единицы: сумма радиусов Шеннона K⁺ и O²⁻. */
const K_O_CONTACT_PM = radiusForSpecies('K', 1) + radiusForSpecies('O', -2)

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия (мировые единицы)
// ─────────────────────────────────────────────────────────────────────────────

type V = THREE.Vector3
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const L = {
  mnO4: pmToScene(MN2O7_PM.mnO4),
  term: pmToScene(MN2O7_PM.term),
  bridge: pmToScene(MN2O7_PM.bridge),
  sDouble: pmToScene(MN2O7_PM.sDouble),
  sOH: pmToScene(MN2O7_PM.sOH),
  oh: pmToScene(MN2O7_PM.oh),
  sulfate: pmToScene(MN2O7_PM.sulfate),
  ohWater: pmToScene(MN2O7_PM.ohWater),
  /** O···O водородной связи = O–H + H···O */
  oo: pmToScene(MN2O7_PM.oh + MN2O7_PM.hBond),
  kDock: pmToScene(MN2O7_PM.mnO4 + K_O_CONTACT_PM),
  kSulfate: pmToScene(MN2O7_PM.sulfate + K_O_CONTACT_PM),
} as const

/** Направление на конусе: угол angleDeg от оси axis, ближайшее к hint. */
function coneDir(axis: V, angleDeg: number, hint: V): V {
  const a = axis.clone().normalize()
  const p = hint.clone().addScaledVector(a, -hint.dot(a))
  if (p.lengthSq() < 1e-12) p.set(0, 0, 1).addScaledVector(a, -a.z)
  p.normalize()
  return a.multiplyScalar(Math.cos(angleDeg * DEG)).addScaledVector(p, Math.sin(angleDeg * DEG))
}
const mirrorY = (p: V) => v3(p.x, -p.y, p.z)
const WORLD_X = v3(1, 0, 0)

/**
 * ФИНАЛ: O₃Mn–O–MnO₃ из writeBridged — мостик в начале координат, оба Mn слева (крен −90°),
 * концевые O под тетраэдрическим углом (угла O–Mn–O для Mn₂O₇ в ядре нет). Конформация
 * (поворот троек) — схема.
 */
export const MN2O7_FINAL: BridgedFrame = writeBridged(
  createBridgedFrame(3),
  v3(),
  L.bridge,
  MN2O7_DEG.mnOMn,
  L.term,
  MN2O7_DEG.oMnO,
  0,
  0,
  0,
  -Math.PI / 2,
)
const F = MN2O7_FINAL
const vA = F.bridge.clone().sub(F.x0).normalize()
const vB = F.bridge.clone().sub(F.x1).normalize()
const dA = F.t0.map((p) => p.clone().sub(F.x0).normalize())
const dB = F.t1.map((p) => p.clone().sub(F.x1).normalize())

/**
 * ДО КОНДЕНСАЦИИ: B уже на своём месте (Mn–O ещё как в MnO₄⁻), A отодвинута по оси мостика так,
 * что O(H) молекулы A и O(H) молекулы B стоят на расстоянии водородной связи O···O:
 * a² + b² − 2ab·cos∠(Mn–O–Mn) = d(O···O)², b = d(мост) − d(MnO₄⁻), a = b + s.
 */
const B_GAP = L.bridge - L.mnO4
const COS_B = Math.cos(MN2O7_DEG.mnOMn * DEG)
const A_GAP = B_GAP * COS_B + Math.sqrt(B_GAP * B_GAP * COS_B * COS_B - B_GAP * B_GAP + L.oo * L.oo)
const SHIFT_A = A_GAP - B_GAP

type Tetra = { mn: V; o: [V, V, V]; oh: V }
const PRE_A: Tetra = (() => {
  const mn = F.x0.clone().addScaledVector(vA, -SHIFT_A)
  return {
    mn,
    o: [0, 1, 2].map((k) => mn.clone().addScaledVector(dA[k]!, L.mnO4)) as [V, V, V],
    oh: mn.clone().addScaledVector(vA, L.mnO4),
  }
})()
const PRE_B: Tetra = {
  mn: F.x1.clone(),
  o: [0, 1, 2].map((k) => F.x1.clone().addScaledVector(dB[k]!, L.mnO4)) as [V, V, V],
  oh: F.x1.clone().addScaledVector(vB, L.mnO4),
}

/** H на OH молекулы HMnO₄: угол Mn–O–H — как X–O–H кислородной кислоты (∠S–O–H ядра; своего нет). */
const W_A = coneDir(vA.clone().negate(), MN2O7_DEG.sOH, WORLD_X)
const W_B = coneDir(vB.clone().negate(), MN2O7_DEG.sOH, WORLD_X)

/** ПРОТОНИРОВАНИЕ: A и B раздвинуты по вертикали (зеркально), кислота подходит к каждой по очереди. */
const SPLIT = 0.55
const T_B = v3(0, SPLIT, 0)
const OH_B_PROT = PRE_B.oh.clone().add(T_B)
const OH_A_PROT = mirrorY(OH_B_PROT)
const T_A = OH_A_PROT.clone().sub(PRE_A.oh)
const shift = (t: Tetra, d: V): Tetra => ({ mn: t.mn.clone().add(d), o: t.o.map((p) => p.clone().add(d)) as [V, V, V], oh: t.oh.clone().add(d) })
const PROT_A = shift(PRE_A, T_A)
const PROT_B = shift(PRE_B, T_B)

/**
 * H₂SO₄ в локальных координатах (S в нуле): две S–OH в плоскости XY под ∠HO–S–OH, смотрят влево;
 * две S=O в плоскости XZ под ∠O=S=O, смотрят вправо (плоскости взяты перпендикулярными — схема).
 * «Нижняя» OH отдаёт протон молекуле A, «верхняя» — B. H — на конусе ∠S–O–H, ближе к акцептору.
 */
const B_HA = v3(-Math.cos((MN2O7_DEG.hoSoh / 2) * DEG), -Math.sin((MN2O7_DEG.hoSoh / 2) * DEG), 0)
const B_HB = mirrorY(B_HA)
const B_D1 = v3(Math.cos((MN2O7_DEG.oSo / 2) * DEG), 0, Math.sin((MN2O7_DEG.oSo / 2) * DEG))
const B_D2 = v3(B_D1.x, 0, -B_D1.z)
const ACID_LOCAL = {
  s: v3(),
  ohA: B_HA.clone().multiplyScalar(L.sOH),
  ohB: B_HB.clone().multiplyScalar(L.sOH),
  od1: B_D1.clone().multiplyScalar(L.sDouble),
  od2: B_D2.clone().multiplyScalar(L.sDouble),
  hA: B_HA.clone()
    .multiplyScalar(L.sOH)
    .addScaledVector(coneDir(B_HA.clone().negate(), MN2O7_DEG.sOH, W_A.clone().negate()), L.oh),
  hB: B_HB.clone()
    .multiplyScalar(L.sOH)
    .addScaledVector(coneDir(B_HB.clone().negate(), MN2O7_DEG.sOH, W_B.clone().negate()), L.oh),
}
/** Сульфат-ион: правильный тетраэдр S–O (половина ∠O–S–O ядра от оси ±x). */
const HALF_SO4 = (MN2O7_DEG.sulfate / 2) * DEG
const SULFATE_LOCAL = {
  s: v3(),
  ohA: v3(-Math.cos(HALF_SO4), -Math.sin(HALF_SO4), 0).multiplyScalar(L.sulfate),
  ohB: v3(-Math.cos(HALF_SO4), Math.sin(HALF_SO4), 0).multiplyScalar(L.sulfate),
  od1: v3(Math.cos(HALF_SO4), 0, Math.sin(HALF_SO4)).multiplyScalar(L.sulfate),
  od2: v3(Math.cos(HALF_SO4), 0, -Math.sin(HALF_SO4)).multiplyScalar(L.sulfate),
}
/** Причал кислоты у A: O(H) кислоты на d(O···O) от O молекулы A вдоль направления её будущей связи O–H. */
const S_P1 = OH_A_PROT.clone().addScaledVector(W_A, L.oo).sub(ACID_LOCAL.ohA)
const S_P2 = mirrorY(S_P1)
const S_START = v3(S_P1.x + 0.55, 0, 0)
/** Сульфат после второго протона отходит вправо, туда подходят два K⁺ (схема формульной единицы K₂SO₄). */
const S_K = v3(S_P1.x + 0.85, 0, 0)
const S_EXIT = S_K.clone().add(v3(1.0, 0, 0))

/** K⁺ у своего MnO₄⁻ (схема формульной единицы KMnO₄: контакт K⁺···O по радиусам Шеннона). */
const K_A0 = PROT_A.mn.clone().addScaledVector(v3(Math.cos(205 * DEG), Math.sin(205 * DEG), 0), L.kDock)
const K_B0 = mirrorY(K_A0)
const K_A_DOCK = S_K.clone().add(v3(0, -L.kSulfate, 0))
const K_B_DOCK = mirrorY(K_A_DOCK)
const K_A_WAY = v3((K_A0.x + K_A_DOCK.x) / 2, Math.min(K_A0.y, PROT_A.mn.y) - 0.4, 0)
const K_B_WAY = mirrorY(K_A_WAY)

/** Капля жидкого Mn₂O₇ (шаг 5): справа от молекулы. Макрообъект, не в масштабе молекулы (note). */
export const MN2O7_DROP = { center: [1.3, -0.05, 0] as const, radius: 0.55 } as const

/** Центр молекулы для камеры и подписей. */
const MOL_CENTER = (() => {
  const c = v3()
  const pts = [F.x0, F.x1, F.bridge, ...F.t0, ...F.t1]
  for (const p of pts) c.add(p)
  return c.multiplyScalar(1 / pts.length)
})()

export const MN2O7_GEOM = {
  final: F,
  pre: { a: PRE_A, b: PRE_B },
  prot: { a: PROT_A, b: PROT_B },
  acidLocal: ACID_LOCAL,
  sulfateLocal: SULFATE_LOCAL,
  dock: { s1: S_P1, s2: S_P2, sK: S_K },
  shiftA: SHIFT_A,
  molCenter: MOL_CENTER,
  scene: L,
} as const

export const MN2O7_RIG_SCALE = 1.15

// ─────────────────────────────────────────────────────────────────────────────
// Состав кадра
// ─────────────────────────────────────────────────────────────────────────────

export type Mn2o7Group = 'k' | 'mnA' | 'mnB' | 'acid' | 'water'

export type Mn2o7AtomDef = {
  id: string
  el: Mn2o7Element
  /** к какой частице относится атом в начале сюжета */
  group: Mn2o7Group
  /** индексы шагов [первый, последний], на которых атом имеет право быть видимым */
  span: readonly [number, number]
}

const LAST_STEP = MN2O7_STEPS.length - 1
const stepFrom = (i: number) => MN2O7_STEPS[i]!.from
const stepTo = (i: number) => MN2O7_STEPS[i]!.to

export const MN2O7_ATOMS: readonly Mn2o7AtomDef[] = [
  { id: 'kA', el: 'K', group: 'k', span: [0, 2] },
  { id: 'kB', el: 'K', group: 'k', span: [0, 2] },
  { id: 'mnA', el: 'Mn', group: 'mnA', span: [0, LAST_STEP] },
  { id: 'oA0', el: 'O', group: 'mnA', span: [0, LAST_STEP] },
  { id: 'oA1', el: 'O', group: 'mnA', span: [0, LAST_STEP] },
  { id: 'oA2', el: 'O', group: 'mnA', span: [0, LAST_STEP] },
  // O(H) молекулы A — уходит с водой
  { id: 'oA3', el: 'O', group: 'mnA', span: [0, 3] },
  { id: 'mnB', el: 'Mn', group: 'mnB', span: [0, LAST_STEP] },
  { id: 'oB0', el: 'O', group: 'mnB', span: [0, LAST_STEP] },
  { id: 'oB1', el: 'O', group: 'mnB', span: [0, LAST_STEP] },
  { id: 'oB2', el: 'O', group: 'mnB', span: [0, LAST_STEP] },
  // O(H) молекулы B — станет мостиковым O
  { id: 'oB3', el: 'O', group: 'mnB', span: [0, LAST_STEP] },
  { id: 's', el: 'S', group: 'acid', span: [0, 2] },
  { id: 'ohA', el: 'O', group: 'acid', span: [0, 2] },
  { id: 'ohB', el: 'O', group: 'acid', span: [0, 2] },
  { id: 'od1', el: 'O', group: 'acid', span: [0, 2] },
  { id: 'od2', el: 'O', group: 'acid', span: [0, 2] },
  // протоны кислоты: hA → OH молекулы A (потом вода), hB → OH молекулы B → вода
  { id: 'hA', el: 'H', group: 'acid', span: [0, 3] },
  { id: 'hB', el: 'H', group: 'acid', span: [0, 3] },
]

export const MN2O7_ATOM_INDEX: ReadonlyMap<string, number> = new Map(MN2O7_ATOMS.map((a, i) => [a.id, i]))
const IDX = (id: string) => {
  const i = MN2O7_ATOM_INDEX.get(id)
  if (i == null) throw new Error(`mn2o7: нет атома ${id}`)
  return i
}

/** Атомы молекулы продукта Mn₂O₇ (2 Mn + 7 O). */
export const MN2O7_PRODUCT_IDS = ['mnA', 'oA0', 'oA1', 'oA2', 'mnB', 'oB0', 'oB1', 'oB2', 'oB3'] as const
export const MN2O7_WATER_IDS = ['oA3', 'hA', 'hB'] as const
export const MN2O7_SULFATE_IDS = ['kA', 'kB', 's', 'ohA', 'ohB', 'od1', 'od2'] as const
const A_IDS = ['mnA', 'oA0', 'oA1', 'oA2', 'oA3'] as const
const B_IDS = ['mnB', 'oB0', 'oB1', 'oB2', 'oB3'] as const
const ACID_IDS = ['s', 'ohA', 'ohB', 'od1', 'od2'] as const

// ─────────────────────────────────────────────────────────────────────────────
// Время
// ─────────────────────────────────────────────────────────────────────────────

const P1 = MN2O7_PROTONS.p1
const P2 = MN2O7_PROTONS.p2
const P3 = MN2O7_PROTONS.p3
const T = {
  acidToP1: [stepFrom(1) + 0.2, stepFrom(1) + 1.3] as const,
  acidToP2: [P1.arrive + 0.3, P2.leave - 0.2] as const,
  relax: [P2.arrive, mn2o7CueAt('sulfate') - 0.2] as const,
  kMove: [P1.arrive + 0.5, mn2o7CueAt('sulfate')] as const,
  sulfateExit: [stepFrom(2) + 0.1, stepFrom(2) + 1.5] as const,
  acidFade: [stepFrom(2) + 0.3, stepFrom(2) + 1.4] as const,
  toPre: [stepFrom(2) + 0.2, stepFrom(2) + 1.4] as const,
  rotateH: [stepFrom(2) + 1.4, stepFrom(2) + 2.2] as const,
  waterOut: [P3.arrive, P3.arrive + 0.8] as const,
  close: [P3.arrive + 0.2, mn2o7CueAt('bridge')] as const,
  waterExit: [stepFrom(3) + 0.2, stepFrom(3) + 1.3] as const,
  drop: [mn2o7CueAt('liquid') - 0.5, mn2o7CueAt('liquid') + 0.3] as const,
}

// ─────────────────────────────────────────────────────────────────────────────
// Дорожки положений
// ─────────────────────────────────────────────────────────────────────────────

type K3 = readonly [number, number, number]
const arr = (p: V): K3 => [p.x, p.y, p.z]
const POS: Record<string, Vec3Key[]> = {}

/** Молекула-тетраэдр: протонирование (PROT) → сближение (PRE) → финал Mn₂O₇. */
function tetraTrack(id: string, prot: V, pre: V, fin: V | null): void {
  const keys: Vec3Key[] = [
    { t: 0, v: arr(prot) },
    { t: T.toPre[0], v: arr(prot) },
    { t: T.toPre[1], v: arr(pre), ease: 'smooth' },
  ]
  if (fin) {
    keys.push({ t: T.close[0], v: arr(pre) })
    keys.push({ t: T.close[1], v: arr(fin), ease: 'smooth' })
  }
  POS[id] = keys
}
tetraTrack('mnA', PROT_A.mn, PRE_A.mn, F.x0)
tetraTrack('mnB', PROT_B.mn, PRE_B.mn, F.x1)
for (let k = 0; k < 3; k++) {
  tetraTrack(`oA${k}`, PROT_A.o[k]!, PRE_A.o[k]!, F.t0[k]!)
  tetraTrack(`oB${k}`, PROT_B.o[k]!, PRE_B.o[k]!, F.t1[k]!)
}
tetraTrack('oB3', PROT_B.oh, PRE_B.oh, F.bridge)

/** Вода: O(H) молекулы A + H_A + протон H_B. Геометрия воды (O–H, ∠H–O–H) — из ядра. */
const H_B_AT_A = PRE_A.oh.clone().addScaledVector(PRE_B.oh.clone().sub(PRE_A.oh).normalize(), L.oh)
const H_A_ON_A = PRE_A.oh.clone().addScaledVector(W_A, L.oh)
const WATER_OUT_DIR = vA.clone().cross(v3(0, 0, 1)).add(v3(0, 0, 0.5)).normalize()
const W1 = PRE_A.oh.clone().addScaledVector(WATER_OUT_DIR, 0.85)
const W2 = W1.clone().add(v3(0.9, -0.45, 0.3))
const WATER_H = (() => {
  const a = H_A_ON_A.clone().sub(PRE_A.oh).normalize()
  const b = H_B_AT_A.clone().sub(PRE_A.oh).normalize()
  const bis = a.clone().add(b).normalize()
  const perp = a.clone().sub(b)
  perp.addScaledVector(bis, -perp.dot(bis)).normalize()
  const half = (MN2O7_DEG.water / 2) * DEG
  return {
    a: bis.clone().multiplyScalar(Math.cos(half)).addScaledVector(perp, Math.sin(half)).multiplyScalar(L.ohWater),
    b: bis.clone().multiplyScalar(Math.cos(half)).addScaledVector(perp, -Math.sin(half)).multiplyScalar(L.ohWater),
  }
})()
POS.oA3 = [
  { t: 0, v: arr(PROT_A.oh) },
  { t: T.toPre[0], v: arr(PROT_A.oh) },
  { t: T.toPre[1], v: arr(PRE_A.oh), ease: 'smooth' },
  { t: T.waterOut[0], v: arr(PRE_A.oh) },
  { t: T.waterOut[1], v: arr(W1), ease: 'smooth' },
  { t: T.waterExit[0], v: arr(W1) },
  { t: T.waterExit[1], v: arr(W2), ease: 'inQuad' },
]

/** Кислота целиком: старт → причал у A → причал у B → (сульфат) → к K⁺ → уход вправо. */
type AcidAtom = 'ohA' | 'ohB' | 'od1' | 'od2' | 's'
function acidTrack(id: AcidAtom): void {
  const loc = ACID_LOCAL[id]
  const rel = SULFATE_LOCAL[id]
  POS[id] = [
    { t: 0, v: arr(S_START.clone().add(loc)) },
    { t: T.acidToP1[0], v: arr(S_START.clone().add(loc)) },
    { t: T.acidToP1[1], v: arr(S_P1.clone().add(loc)), ease: 'smooth' },
    { t: T.acidToP2[0], v: arr(S_P1.clone().add(loc)) },
    { t: T.acidToP2[1], v: arr(S_P2.clone().add(loc)), ease: 'smooth' },
    { t: T.relax[0], v: arr(S_P2.clone().add(loc)) },
    { t: T.relax[1], v: arr(S_K.clone().add(rel)), ease: 'smooth' },
    { t: T.sulfateExit[0], v: arr(S_K.clone().add(rel)) },
    { t: T.sulfateExit[1], v: arr(S_EXIT.clone().add(rel)), ease: 'inQuad' },
  ]
}
for (const id of ACID_IDS) acidTrack(id)

/** Протон A: в кислоте → переход к O молекулы A → едет с A → в воде. */
POS.hA = [
  { t: 0, v: arr(S_START.clone().add(ACID_LOCAL.hA)) },
  { t: T.acidToP1[0], v: arr(S_START.clone().add(ACID_LOCAL.hA)) },
  { t: T.acidToP1[1], v: arr(S_P1.clone().add(ACID_LOCAL.hA)), ease: 'smooth' },
  { t: P1.leave, v: arr(S_P1.clone().add(ACID_LOCAL.hA)) },
  { t: P1.arrive, v: arr(OH_A_PROT.clone().addScaledVector(W_A, L.oh)), ease: 'smooth' },
  { t: T.toPre[0], v: arr(OH_A_PROT.clone().addScaledVector(W_A, L.oh)) },
  { t: T.toPre[1], v: arr(H_A_ON_A), ease: 'smooth' },
  { t: T.waterOut[0], v: arr(H_A_ON_A) },
  { t: T.waterOut[1], v: arr(W1.clone().add(WATER_H.a)), ease: 'smooth' },
  { t: T.waterExit[0], v: arr(W1.clone().add(WATER_H.a)) },
  { t: T.waterExit[1], v: arr(W2.clone().add(WATER_H.a)), ease: 'inQuad' },
]

/**
 * Протон B: в кислоте → к O молекулы B → едет с B → поворачивается вокруг связи Mn–O (на конусе
 * угла Mn–O–H) к O(H) молекулы A → переход (отщепление воды) → в воде.
 */
const H_B_ROT: Vec3Key[] = (() => {
  const axis = vB.clone().negate()
  const w0 = W_B.clone()
  const target = coneDir(axis, MN2O7_DEG.sOH, PRE_A.oh.clone().sub(PRE_B.oh))
  const p0 = w0.clone().addScaledVector(axis, -w0.dot(axis)).normalize()
  let q = axis.clone().cross(p0).normalize()
  if (q.z < 0) q = q.negate()
  const tp = target.clone().addScaledVector(axis, -target.dot(axis)).normalize()
  let phiEnd = Math.atan2(tp.dot(q), tp.dot(p0))
  if (phiEnd < 0) phiEnd += 2 * Math.PI
  const ca = axis.dot(w0)
  const sa = Math.sqrt(Math.max(0, 1 - ca * ca))
  const keys: Vec3Key[] = []
  const N = 6
  for (let k = 0; k <= N; k++) {
    const phi = (phiEnd * k) / N
    const dir = axis.clone().multiplyScalar(ca).addScaledVector(p0, Math.cos(phi) * sa).addScaledVector(q, Math.sin(phi) * sa)
    const t = T.rotateH[0] + ((T.rotateH[1] - T.rotateH[0]) * k) / N
    keys.push({ t, v: arr(PRE_B.oh.clone().addScaledVector(dir, L.oh)), ease: 'linear' })
  }
  return keys
})()
POS.hB = [
  { t: 0, v: arr(S_START.clone().add(ACID_LOCAL.hB)) },
  { t: T.acidToP1[0], v: arr(S_START.clone().add(ACID_LOCAL.hB)) },
  { t: T.acidToP1[1], v: arr(S_P1.clone().add(ACID_LOCAL.hB)), ease: 'smooth' },
  { t: T.acidToP2[0], v: arr(S_P1.clone().add(ACID_LOCAL.hB)) },
  { t: T.acidToP2[1], v: arr(S_P2.clone().add(ACID_LOCAL.hB)), ease: 'smooth' },
  { t: P2.leave, v: arr(S_P2.clone().add(ACID_LOCAL.hB)) },
  { t: P2.arrive, v: arr(OH_B_PROT.clone().addScaledVector(W_B, L.oh)), ease: 'smooth' },
  { t: T.toPre[0], v: arr(OH_B_PROT.clone().addScaledVector(W_B, L.oh)) },
  { t: T.toPre[1], v: arr(PRE_B.oh.clone().addScaledVector(W_B, L.oh)), ease: 'smooth' },
  ...H_B_ROT.slice(1),
  { t: P3.leave, v: H_B_ROT[H_B_ROT.length - 1]!.v },
  { t: P3.arrive, v: arr(H_B_AT_A), ease: 'smooth' },
  { t: T.waterOut[1], v: arr(W1.clone().add(WATER_H.b)), ease: 'smooth' },
  { t: T.waterExit[0], v: arr(W1.clone().add(WATER_H.b)) },
  { t: T.waterExit[1], v: arr(W2.clone().add(WATER_H.b)), ease: 'inQuad' },
]
// Первый ключ поворота совпадает с концом переезда B — в дорожке он уже есть (T.toPre[1] = T.rotateH[0]).

/** K⁺: у своего MnO₄⁻ → в обход молекулы → к сульфату → уход вместе с K₂SO₄. */
function kTrack(id: 'kA' | 'kB', start: V, way: V, dock: V): void {
  POS[id] = [
    { t: 0, v: arr(start) },
    { t: T.kMove[0], v: arr(start) },
    { t: (T.kMove[0] + T.kMove[1]) / 2, v: arr(way), interp: 'hermite' },
    { t: T.kMove[1], v: arr(dock), interp: 'hermite' },
    { t: T.sulfateExit[0], v: arr(dock) },
    { t: T.sulfateExit[1], v: arr(dock.clone().add(S_EXIT).sub(S_K)), ease: 'inQuad' },
  ]
}
kTrack('kA', K_A0, K_A_WAY, K_A_DOCK)
kTrack('kB', K_B0, K_B_WAY, K_B_DOCK)

// ─────────────────────────────────────────────────────────────────────────────
// Заряды групп: переключаются в кадр перехода протона (hop), Σ = 0 в любой кадр
// ─────────────────────────────────────────────────────────────────────────────

export const MN2O7_CHARGE = {
  kA: [{ t: 0, v: 1 }] as ScalarTrack,
  kB: [{ t: 0, v: 1 }] as ScalarTrack,
  /** MnO₄⁻ → HMnO₄ */
  mnA: octetSnap(P1.hop, -1, 0),
  mnB: octetSnap(P2.hop, -1, 0),
  /** H₂SO₄ → HSO₄⁻ → SO₄²⁻ */
  acid: [...octetSnap(P1.hop, 0, -1), ...octetSnap(P2.hop, -1, -2)] as ScalarTrack,
} as const

/** Степень окисления Mn (одна на весь сюжет: реакция образования Mn₂O₇ — не окислительно-восстановительная). */
export const MN_OX = mnOxidationState(1, 4, -1)

// ─────────────────────────────────────────────────────────────────────────────
// Связи
// ─────────────────────────────────────────────────────────────────────────────

export type Mn2o7BondKind = 'sigma' | 'hbond' | 'ionic'
export type Mn2o7BondDef = {
  id: string
  a: string
  b: string
  kind: Mn2o7BondKind
  /** видимость связи (0…1), умножается на непрозрачность её атомов */
  amount: ScalarTrack
  /** π-доля (порядок − 1) для σ-связей X–O; нет — чистая σ */
  pi?: ScalarTrack
}

const hold = (v: number): ScalarTrack => [{ t: 0, v }]
const ramp = (t0: number, a: number, t1: number, b: number): ScalarTrack => [
  { t: t0, v: a },
  { t: t1, v: b, ease: 'smooth' },
]
const piAfter = (t: number, before: number, after: number) => ramp(t, before, t + 0.5, after)

export const MN2O7_BONDS: readonly Mn2o7BondDef[] = [
  // тетраэдр A: MnO₄⁻ (π-доля ¾) → HMnO₄ (три Mn=O и Mn–OH) → половина Mn₂O₇
  ...[0, 1, 2].map((k) => ({ id: `mnA-oA${k}`, a: 'mnA', b: `oA${k}`, kind: 'sigma' as const, amount: hold(1), pi: piAfter(P1.hop, PI_MNO4, 1) })),
  { id: 'mnA-oA3', a: 'mnA', b: 'oA3', kind: 'sigma', amount: ramp(P3.hop, 1, P3.hop + 0.3, 0), pi: piAfter(P1.hop, PI_MNO4, 0) },
  ...[0, 1, 2].map((k) => ({ id: `mnB-oB${k}`, a: 'mnB', b: `oB${k}`, kind: 'sigma' as const, amount: hold(1), pi: piAfter(P2.hop, PI_MNO4, 1) })),
  { id: 'mnB-oB3', a: 'mnB', b: 'oB3', kind: 'sigma', amount: hold(1), pi: piAfter(P2.hop, PI_MNO4, 0) },
  // H₂SO₄ → сульфат (порядок 1½ у всех четырёх S–O)
  { id: 's-ohA', a: 's', b: 'ohA', kind: 'sigma', amount: hold(1), pi: ramp(T.relax[0], 0, T.relax[0] + 0.6, PI_SO4) },
  { id: 's-ohB', a: 's', b: 'ohB', kind: 'sigma', amount: hold(1), pi: ramp(T.relax[0], 0, T.relax[0] + 0.6, PI_SO4) },
  { id: 's-od1', a: 's', b: 'od1', kind: 'sigma', amount: hold(1), pi: ramp(T.relax[0], 1, T.relax[0] + 0.6, PI_SO4) },
  { id: 's-od2', a: 's', b: 'od2', kind: 'sigma', amount: hold(1), pi: ramp(T.relax[0], 1, T.relax[0] + 0.6, PI_SO4) },
  // O–H: в кислоте → у акцептора (переключение в кадр hop)
  { id: 'ohA-hA', a: 'ohA', b: 'hA', kind: 'sigma', amount: ramp(P1.leave, 1, P1.hop, 0) },
  { id: 'ohB-hB', a: 'ohB', b: 'hB', kind: 'sigma', amount: ramp(P2.leave, 1, P2.hop, 0) },
  { id: 'oA3-hA', a: 'oA3', b: 'hA', kind: 'sigma', amount: ramp(P1.hop, 0, P1.arrive, 1) },
  {
    id: 'oB3-hB',
    a: 'oB3',
    b: 'hB',
    kind: 'sigma',
    amount: [
      { t: P2.hop, v: 0 },
      { t: P2.arrive, v: 1, ease: 'smooth' },
      { t: P3.leave, v: 1 },
      { t: P3.hop, v: 0, ease: 'smooth' },
    ],
  },
  { id: 'oA3-hB', a: 'oA3', b: 'hB', kind: 'sigma', amount: ramp(P3.hop, 0, P3.arrive, 1) },
  // новая мостиковая связь Mn(A)–O(B)
  { id: 'mnA-oB3', a: 'mnA', b: 'oB3', kind: 'sigma', amount: ramp(T.close[0] + 0.4, 0, T.close[1] - 0.1, 1), pi: hold(0) },
  // водородные связи O–H···O перед каждым переходом протона
  {
    id: 'hb1',
    a: 'hA',
    b: 'oA3',
    kind: 'hbond',
    amount: [
      { t: T.acidToP1[1] - 0.4, v: 0 },
      { t: T.acidToP1[1], v: 1, ease: 'smooth' },
      { t: P1.leave, v: 1 },
      { t: P1.arrive, v: 0, ease: 'smooth' },
    ],
  },
  {
    id: 'hb2',
    a: 'hB',
    b: 'oB3',
    kind: 'hbond',
    amount: [
      { t: T.acidToP2[1] - 0.2, v: 0 },
      { t: T.acidToP2[1] + 0.1, v: 1, ease: 'smooth' },
      { t: P2.leave, v: 1 },
      { t: P2.arrive, v: 0, ease: 'smooth' },
    ],
  },
  {
    id: 'hb3',
    a: 'hB',
    b: 'oA3',
    kind: 'hbond',
    amount: [
      { t: T.rotateH[1] - 0.4, v: 0 },
      { t: T.rotateH[1], v: 1, ease: 'smooth' },
      { t: P3.leave, v: 1 },
      { t: P3.arrive, v: 0, ease: 'smooth' },
    ],
  },
  // ионная связь K⁺ ··· анион — дуги поля, без «палочки»
  { id: 'kA-mnA', a: 'kA', b: 'mnA', kind: 'ionic', amount: [{ t: 0.4, v: 0 }, { t: 0.9, v: 1, ease: 'smooth' }, { t: T.kMove[0] - 0.2, v: 1 }, { t: T.kMove[0] + 0.4, v: 0, ease: 'smooth' }] },
  { id: 'kB-mnB', a: 'kB', b: 'mnB', kind: 'ionic', amount: [{ t: 0.4, v: 0 }, { t: 0.9, v: 1, ease: 'smooth' }, { t: T.kMove[0] - 0.2, v: 1 }, { t: T.kMove[0] + 0.4, v: 0, ease: 'smooth' }] },
  { id: 'kA-s', a: 'kA', b: 's', kind: 'ionic', amount: [{ t: T.kMove[1] - 0.3, v: 0 }, { t: T.kMove[1] + 0.1, v: 1, ease: 'smooth' }, { t: T.acidFade[0], v: 1 }, { t: T.acidFade[1] - 0.3, v: 0, ease: 'smooth' }] },
  { id: 'kB-s', a: 'kB', b: 's', kind: 'ionic', amount: [{ t: T.kMove[1] - 0.3, v: 0 }, { t: T.kMove[1] + 0.1, v: 1, ease: 'smooth' }, { t: T.acidFade[0], v: 1 }, { t: T.acidFade[1] - 0.3, v: 0, ease: 'smooth' }] },
]

export const MN2O7_BOND_INDEX: ReadonlyMap<string, number> = new Map(MN2O7_BONDS.map((b, i) => [b.id, i]))
/** Для каждой связи — индексы атомов (без поиска в кадре). */
export const MN2O7_BOND_ATOMS: readonly (readonly [number, number])[] = MN2O7_BONDS.map((b) => [IDX(b.a), IDX(b.b)] as const)
/** Сколько σ-связей несут π-долю (им нужен отдельный слот лепестков). */
export const MN2O7_PI_BONDS: readonly number[] = MN2O7_BONDS.map((b, i) => (b.pi ? i : -1)).filter((i) => i >= 0)

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

const APPEAR: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.6, v: 1, ease: 'smooth' },
]
/** K₂SO₄ уходит и гаснет ПОЛНОСТЬЮ до паузы шага 3. */
const ACID_OUT: ScalarTrack = [
  { t: T.acidFade[0], v: 1 },
  { t: T.acidFade[1], v: 0, ease: 'smooth' },
]
/** Вода уходит и гаснет полностью до паузы шага 4. */
const WATER_OUT: ScalarTrack = [
  { t: T.waterExit[0] + 0.2, v: 1 },
  { t: T.waterExit[1], v: 0, ease: 'smooth' },
]
/** Капля растёт из точки (как ионы решётки у NaCl): радиус × grow, прозрачность только пока она мала. */
const DROP_GROW: ScalarTrack = [
  { t: T.drop[0], v: 0 },
  { t: T.drop[1], v: 1, ease: 'smooth' },
]
const FADE = fadeTrack(MN2O7_FINISH)

/** Камера: общий план, наезды на переходы протона, сближение тетраэдров, молекула, капля, облёт. */
export const MN2O7_CAMERA: ShotTrack = shotTrack([
  { t: 0, zoom: 0.7, target: [0.1, 0, 0] },
  { t: stepTo(0), zoom: 0.72 },
  { t: P1.leave - 0.2, zoom: 0.95, target: [0.45, -0.5, 0] },
  { t: T.acidToP2[0] + 0.3, zoom: 0.9, target: [0.5, 0, 0] },
  { t: P2.leave - 0.1, zoom: 0.95, target: [0.45, 0.5, 0] },
  { t: T.kMove[1], zoom: 0.68, target: [0.35, 0, 0] },
  { t: stepTo(1), zoom: 0.68 },
  { t: T.rotateH[1], zoom: 0.95, target: [-0.2, -0.3, 0] },
  { t: stepTo(2), zoom: 0.98, target: [-0.1, -0.15, 0] },
  { t: stepFrom(3) + 1.6, zoom: 1.35, yaw: 0.25, pitch: 0.12, target: [MOL_CENTER.x, MOL_CENTER.y, MOL_CENTER.z] },
  { t: stepTo(3), zoom: 1.35 },
  { t: T.drop[1] + 0.4, zoom: 0.92, yaw: 0.1, pitch: 0.12, target: [0.45, 0, 0] },
  ...orbitTrack(stepFrom(5), stepTo(5), 0.1, 0.6, 0.15, 0.9),
])

const BASE_EMISSIVE = 0.08
const BASE_BLOOM = 0.3

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D — только формулы, заряды, числа и символы единиц (токены)
// ─────────────────────────────────────────────────────────────────────────────

export type Mn2o7LabelDef = SceneLabelDef & {
  anchor: 'atom' | 'group' | 'bond' | 'drop' | 'point'
  /** атомы якоря: один (atom), группа (group — центроид), два (bond — середина) */
  atoms?: readonly string[]
  dx?: number
  /** точка якоря для 'point' */
  point?: K3
  hosts: readonly string[]
}

/** Число для подписи: целое — без хвоста, иначе одна десятая (десятичный знак локали ставит сцена). */
export const fmtNum = (v: number) => {
  const r = Math.round(v * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
const signed = (v: number) => (v < 0 ? `−${fmtNum(-v)}` : `+${fmtNum(v)}`)

const SUP_DIGIT: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
/** «3d⁰» из ядра: главное квантовое число d-подуровня Mn и число d-электронов после отдачи MN_OX электронов. */
export const MN_D_LABEL = (() => {
  const n = /(\d)d/.exec(ATOMIC_DATA.Mn.configuration)![1]!
  const left = ATOMIC_DATA.Mn.valenceElectrons - MN_OX
  return `${n}d${String(left)
    .split('')
    .map((c) => SUP_DIGIT[c] ?? c)
    .join('')}`
})()

const DECOMP_EQ = `${MN2O7_DECOMP_COEF.mn2o7} Mn₂O₇ → ${MN2O7_DECOMP_COEF.mno2} MnO₂ + ${MN2O7_DECOMP_COEF.o2} O₂`
const APPROX_DHF = MN2O7_DHF_ESTIMATED ? '≈ ' : '= '
const APPROX_DEC = MN2O7_DECOMP_ESTIMATED ? '≈ ' : '= '

const END = MN2O7_END
const W_TETRA_END = P3.hop
const W_SULFATE_END = T.acidFade[1] - 0.1
const W_MOL_NUMBERS: readonly [number, number] = [stepFrom(3) + 0.3, stepTo(3) - 0.2]

export const MN2O7_LABELS: readonly Mn2o7LabelDef[] = [
  // Шаг 1: KMnO₄ (две формульные единицы) и H₂SO₄
  { id: 'kmno4', kind: 'species', anchor: 'group', atoms: ['kA', 'kB'], dy: 0, dx: -0.1, keys: [{ t: 0, text: 'KMnO₄ ({s})' }], windows: [[0.2, stepTo(0) + 0.6]], hosts: ['kA', 'kB', ...A_IDS, ...B_IDS] },
  { id: 'kA', kind: 'species', anchor: 'atom', atoms: ['kA'], dy: -0.14, keys: [{ t: 0, text: 'K⁺' }], windows: [[0.2, W_SULFATE_END]], hosts: ['kA'] },
  { id: 'kB', kind: 'species', anchor: 'atom', atoms: ['kB'], dy: 0.14, keys: [{ t: 0, text: 'K⁺' }], windows: [[0.2, W_SULFATE_END]], hosts: ['kB'] },
  { id: 'mnA', kind: 'species', anchor: 'group', atoms: A_IDS, dy: -0.72, keys: [{ t: 0, text: 'MnO₄⁻' }, { t: P1.hop, text: 'HMnO₄' }], windows: [[0.2, W_TETRA_END]], hosts: [...A_IDS, 'hA'] },
  { id: 'mnB', kind: 'species', anchor: 'group', atoms: B_IDS, dy: 0.72, keys: [{ t: 0, text: 'MnO₄⁻' }, { t: P2.hop, text: 'HMnO₄' }], windows: [[0.2, W_TETRA_END]], hosts: [...B_IDS, 'hB'] },
  { id: 'oxA', kind: 'ox', anchor: 'atom', atoms: ['mnA'], dy: 0.1, dx: -0.3, keys: [{ t: 0, text: oxidationLabel(MN_OX) }], windows: [[0.4, stepTo(0) + 0.4], W_MOL_NUMBERS], hosts: [] },
  { id: 'oxB', kind: 'ox', anchor: 'atom', atoms: ['mnB'], dy: 0.1, dx: -0.3, keys: [{ t: 0, text: oxidationLabel(MN_OX) }], windows: [[0.4, stepTo(0) + 0.4], W_MOL_NUMBERS], hosts: [] },
  { id: 'd0', kind: 'token', anchor: 'atom', atoms: ['mnB'], dy: -0.1, dx: -0.42, keys: [{ t: 0, text: MN_D_LABEL }], windows: [[0.6, stepTo(0) + 0.4]], hosts: [] },
  { id: 'dMnO4', kind: 'measure', anchor: 'bond', atoms: ['mnB', 'oB0'], dy: 0.12, keys: [{ t: 0, text: `${fmtNum(MN2O7_PM.mnO4)} {pm}` }], windows: [[0.6, stepTo(0) + 0.4]], hosts: [] },
  {
    id: 'acid',
    kind: 'species',
    anchor: 'group',
    atoms: ACID_IDS,
    dy: 0.62,
    keys: [
      { t: 0, text: 'H₂SO₄ ({l})' },
      { t: P1.hop, text: 'HSO₄⁻' },
      { t: P2.hop, text: 'SO₄²⁻' },
      { t: mn2o7CueAt('sulfate'), text: 'K₂SO₄' },
    ],
    windows: [[0.2, W_SULFATE_END]],
    hosts: [...ACID_IDS, 'hA', 'hB'],
  },
  { id: 'dSO4', kind: 'measure', anchor: 'bond', atoms: ['s', 'od1'], dy: -0.16, keys: [{ t: 0, text: `${fmtNum(MN2O7_PM.sulfate)} {pm}` }], windows: [[T.relax[1], T.acidFade[0]]], hosts: [] },
  // Протон в момент перехода — подписан (H⁺ идёт вдоль водородной связи)
  { id: 'h1', kind: 'token', anchor: 'atom', atoms: ['hA'], dy: 0.12, keys: [{ t: 0, text: 'H⁺' }], windows: [[P1.leave - 0.3, P1.arrive + 0.3]], hosts: [] },
  { id: 'h2', kind: 'token', anchor: 'atom', atoms: ['hB'], dy: 0.12, keys: [{ t: 0, text: 'H⁺' }], windows: [[P2.leave - 0.3, P2.arrive + 0.3]], hosts: [] },
  { id: 'h3', kind: 'token', anchor: 'atom', atoms: ['hB'], dy: 0.12, keys: [{ t: 0, text: 'H⁺' }], windows: [[P3.leave - 0.3, P3.arrive + 0.3]], hosts: [] },
  // Шаги 3–6: продукт
  { id: 'mn2o7', kind: 'species', anchor: 'group', atoms: MN2O7_PRODUCT_IDS, dy: 0.95, keys: [{ t: 0, text: 'Mn₂O₇' }], windows: [[P3.hop, END]], hosts: [...MN2O7_PRODUCT_IDS] },
  { id: 'h2o', kind: 'species', anchor: 'atom', atoms: ['oA3'], dy: -0.2, keys: [{ t: 0, text: 'H₂O' }], windows: [[P3.arrive, T.waterExit[1]]], hosts: [...MN2O7_WATER_IDS] },
  { id: 'dTerm', kind: 'measure', anchor: 'bond', atoms: ['mnB', 'oB0'], dy: 0.12, keys: [{ t: 0, text: `${fmtNum(MN2O7_PM.term)} {pm}` }], windows: [W_MOL_NUMBERS], hosts: [] },
  { id: 'dBridge', kind: 'measure', anchor: 'bond', atoms: ['mnA', 'oB3'], dy: -0.14, keys: [{ t: 0, text: `${fmtNum(MN2O7_PM.bridge)} {pm}` }], windows: [W_MOL_NUMBERS], hosts: [] },
  { id: 'angle', kind: 'measure', anchor: 'atom', atoms: ['oB3'], dy: 0, dx: 0.42, keys: [{ t: 0, text: `${fmtNum(MN2O7_DEG.mnOMn)}°` }], windows: [W_MOL_NUMBERS], hosts: [] },
  // Шаг 5: капля жидкости
  { id: 'drop', kind: 'species', anchor: 'drop', dy: 0.3, keys: [{ t: 0, text: 'Mn₂O₇ ({l})' }], windows: [[T.drop[0] + 0.3, END]], hosts: [] },
  { id: 'dHf', kind: 'delta', anchor: 'drop', dy: -0.3, keys: [{ t: 0, text: `ΔH°f ${APPROX_DHF}${signed(MN2O7_DHF_KJ)} {kJmol}` }], windows: [[T.drop[1] + 0.2, END]], hosts: [] },
  // Шаг 6: разложение (подпись-уравнение из коэффициентов ядра) и его ΔH
  { id: 'decomp', kind: 'species', anchor: 'group', atoms: MN2O7_PRODUCT_IDS, dy: -1.0, keys: [{ t: 0, text: DECOMP_EQ }], windows: [[stepFrom(5) + 0.4, END]], hosts: [] },
  { id: 'dHdec', kind: 'delta', anchor: 'group', atoms: MN2O7_PRODUCT_IDS, dy: -1.5, keys: [{ t: 0, text: `ΔH ${APPROX_DEC}${signed(MN2O7_DECOMP_DH_KJ)} {kJ}` }], windows: [[stepFrom(5) + 0.7, END]], hosts: [] },
]

export type Mn2o7LabelState = SceneLabelState

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type Mn2o7Frame = {
  t: number
  pos: THREE.Vector3[]
  radius: Float32Array
  opacity: Float32Array
  emissive: Float32Array
  /** заряд для ободка шара: K⁺ +1, атомы ковалентных частиц 0 */
  charge: Float32Array
  material: SubstanceKind[]
  /** видимость связей и их π-доля (по MN2O7_BONDS) */
  bondAmount: Float32Array
  bondPi: Float32Array
  /** заряды частиц (групп): kA, kB, mnA, mnB, acid */
  groupCharge: { kA: number; kB: number; mnA: number; mnB: number; acid: number }
  /** капля жидкого Mn₂O₇ (шаг 5–6) */
  drop: { pos: THREE.Vector3; radius: number; opacity: number }
  /** амплитуды эффектов (тест: в финале все 0) */
  fx: { field: number; hbond: number }
  labels: Mn2o7LabelState[]
  camera: SceneCamera
  fade: number
}

const RADIUS_SCENE: readonly number[] = MN2O7_ATOMS.map((a) => pmToScene(MN2O7_RADIUS_PM[a.el]) * SPECIES_SCALE)
const MATERIAL: readonly SubstanceKind[] = MN2O7_ATOMS.map((a) => (a.el === 'K' ? 'ion' : 'covalent'))
const TRACKS: readonly Vec3Track[] = MN2O7_ATOMS.map((a) => {
  const tr = POS[a.id]
  if (!tr) throw new Error(`mn2o7: нет дорожки атома ${a.id}`)
  return tr
})

export function createMn2o7Frame(): Mn2o7Frame {
  const n = MN2O7_ATOMS.length
  return {
    t: 0,
    pos: MN2O7_ATOMS.map(() => new THREE.Vector3()),
    radius: Float32Array.from(RADIUS_SCENE),
    opacity: new Float32Array(n),
    emissive: new Float32Array(n).fill(BASE_EMISSIVE),
    charge: Float32Array.from(MN2O7_ATOMS, (a) => (a.el === 'K' ? 1 : 0)),
    material: MATERIAL.slice(),
    bondAmount: new Float32Array(MN2O7_BONDS.length),
    bondPi: new Float32Array(MN2O7_BONDS.length),
    groupCharge: { kA: 1, kB: 1, mnA: -1, mnB: -1, acid: 0 },
    drop: { pos: new THREE.Vector3(...MN2O7_DROP.center), radius: 0, opacity: 0 },
    fx: { field: 0, hbond: 0 },
    labels: createLabelStates(MN2O7_LABELS),
    camera: createSceneCamera(),
    fade: 0,
  }
}

/** Кадр, для которого сейчас считаются подписи (anchorLabel — модульная функция, без замыканий). */
let _cur: Mn2o7Frame | null = null
const LABEL_ATOMS: readonly (readonly number[])[] = MN2O7_LABELS.map((l) => (l.atoms ?? []).map(IDX))
const LABEL_INDEX: ReadonlyMap<string, number> = new Map(MN2O7_LABELS.map((l, i) => [l.id, i]))

function anchorLabel(def: SceneLabelDef, st: SceneLabelState): void {
  const f = _cur!
  const d = def as Mn2o7LabelDef
  const ids = LABEL_ATOMS[LABEL_INDEX.get(d.id)!]!
  const p = f.pos
  switch (d.anchor) {
    case 'atom': {
      const i = ids[0]!
      st.pos.copy(p[i]!)
      st.pos.y += d.dy > 0 ? f.radius[i]! + d.dy : d.dy < 0 ? -(f.radius[i]! - d.dy) : 0
      st.pos.x += d.dx ?? 0
      return
    }
    case 'group': {
      st.pos.set(0, 0, 0)
      for (let k = 0; k < ids.length; k++) st.pos.add(p[ids[k]!]!)
      st.pos.multiplyScalar(1 / ids.length)
      st.pos.y += d.dy
      st.pos.x += d.dx ?? 0
      return
    }
    case 'bond':
      st.pos.copy(p[ids[0]!]!).lerp(p[ids[1]!]!, 0.5)
      st.pos.y += d.dy
      st.pos.x += d.dx ?? 0
      return
    case 'drop':
      st.pos.copy(f.drop.pos)
      st.pos.y += d.dy > 0 ? MN2O7_DROP.radius + d.dy : -(MN2O7_DROP.radius - d.dy)
      return
    case 'point':
      st.pos.set(d.point![0], d.point![1], d.point![2])
      return
  }
}

const I_ACID = ACID_IDS.map(IDX)
const I_K = [IDX('kA'), IDX('kB')] as const
const I_WATER = MN2O7_WATER_IDS.map(IDX)

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleMn2o7Frame(t: number, frame: Mn2o7Frame): Mn2o7Frame {
  frame.t = t
  const { pos, opacity, emissive } = frame
  const appear = sampleScalar(APPEAR, t)
  const acidOut = sampleScalar(ACID_OUT, t)
  const waterOut = sampleScalar(WATER_OUT, t)

  for (let i = 0; i < MN2O7_ATOMS.length; i++) {
    sampleVec3(TRACKS[i]!, t, pos[i]!)
    opacity[i] = appear
    emissive[i] = BASE_EMISSIVE
  }
  for (let k = 0; k < I_ACID.length; k++) opacity[I_ACID[k]!] = appear * acidOut
  opacity[I_K[0]] = appear * acidOut
  opacity[I_K[1]] = appear * acidOut
  for (let k = 0; k < I_WATER.length; k++) opacity[I_WATER[k]!] = appear * waterOut

  // ——— Связи: видимость × непрозрачность атомов, π-доля ———
  let field = 0
  let hb = 0
  for (let b = 0; b < MN2O7_BONDS.length; b++) {
    const def = MN2O7_BONDS[b]!
    const [ia, ib] = MN2O7_BOND_ATOMS[b]!
    const oa = opacity[ia]!
    const ob = opacity[ib]!
    const amt = sampleScalar(def.amount, t) * (oa < ob ? oa : ob)
    frame.bondAmount[b] = amt
    frame.bondPi[b] = def.pi ? sampleScalar(def.pi, t) : 0
    if (def.kind === 'ionic' && amt > field) field = amt
    if (def.kind === 'hbond' && amt > hb) hb = amt
  }
  frame.fx.field = field
  frame.fx.hbond = hb

  // ——— Заряды частиц: ступенью в кадр перехода протона ———
  const g = frame.groupCharge
  g.kA = sampleScalar(MN2O7_CHARGE.kA, t)
  g.kB = sampleScalar(MN2O7_CHARGE.kB, t)
  g.mnA = sampleScalar(MN2O7_CHARGE.mnA, t)
  g.mnB = sampleScalar(MN2O7_CHARGE.mnB, t)
  g.acid = sampleScalar(MN2O7_CHARGE.acid, t)

  // ——— Капля ———
  const grow = sampleScalar(DROP_GROW, t)
  frame.drop.radius = MN2O7_DROP.radius * grow
  frame.drop.opacity = grow * 3 >= 1 ? 1 : grow * 3

  frame.fade = sampleScalar(FADE, t)

  // ——— Подписи ———
  _cur = frame
  sampleLabels(MN2O7_LABELS, frame.labels, t, anchorLabel, frame.fade)
  _cur = null

  // ——— Камера ———
  const cam = frame.camera
  sampleShot(MN2O7_CAMERA, t, cam)
  cam.shake = 0
  cam.bloom = BASE_BLOOM
  cam.vignette = Math.max(0.3, frame.fade)
  return frame
}

/** Сумма зарядов частиц кадра (закон сохранения заряда; свободного H⁺ нет). */
export function mn2o7ChargeSum(f: Mn2o7Frame): number {
  const g = f.groupCharge
  return g.kA + g.kB + g.mnA + g.mnB + g.acid
}

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validateMn2o7Storyboard(): void {
  const vec: Record<string, Vec3Track> = {}
  for (const [id, track] of Object.entries(POS)) vec[`pos.${id}`] = track
  vec['cam.offset'] = MN2O7_CAMERA.offset
  validateTracks(vec)
  const scal: Record<string, ScalarTrack> = { APPEAR, ACID_OUT, WATER_OUT, DROP_GROW, FADE, ...MN2O7_CHARGE }
  for (const b of MN2O7_BONDS) {
    scal[`bond.${b.id}`] = b.amount
    if (b.pi) scal[`pi.${b.id}`] = b.pi
  }
  scal.camZoom = MN2O7_CAMERA.zoom
  scal.camYaw = MN2O7_CAMERA.yaw
  scal.camPitch = MN2O7_CAMERA.pitch
  validateTracks(scal)

  // Состав: 2 K, 2 Mn, 12 O, 1 S, 2 H — ровно столько, сколько в левой части уравнения.
  const count = (el: Mn2o7Element) => MN2O7_ATOMS.filter((a) => a.el === el).length
  if (count('K') !== 2 || count('Mn') !== 2 || count('O') !== 12 || count('S') !== 1 || count('H') !== 2) {
    throw new Error('mn2o7: состав кадра не совпадает с 2 KMnO₄ + H₂SO₄')
  }
  if (MN2O7_PRODUCT_IDS.length !== 9) throw new Error('mn2o7: в Mn₂O₇ 9 атомов')
  if (MN_OX !== mnOxidationState(2, 7, 0)) throw new Error('mn2o7: степень окисления Mn в MnO₄⁻ и в Mn₂O₇ обязана совпадать (не ОВР)')
  if (!(SHIFT_A > 0)) throw new Error('mn2o7: молекула A до конденсации обязана стоять дальше, чем в Mn₂O₇')
  if (MN2O7_END <= stepTo(LAST_STEP)) throw new Error('mn2o7: хвост сцены пустой')
}
