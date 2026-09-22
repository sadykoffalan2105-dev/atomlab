import * as THREE from 'three'
import { ATOMIC_DATA, bondLengthPm, getCrystal } from '../../../../chemistry/data'
import { smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, windowFade, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { orbitTrack, sampleShot, shotTrack, type ShotTrack } from '../kit/camera'
import { bondLength, LATTICE_BALL_SCALE, pmToScene, SPECIES_SCALE, speciesRadius } from '../kit/cpkAtoms'
import { createElectronJump, sampleElectronJump, type ElectronJump } from '../kit/electronFx'
import { latticeCaption, latticeFragment, type LatticeSegment } from '../kit/lattice'
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
import { OCTET_SNAP_EPS, octetSnap } from '../kit/valence'
import { MGO_DHF_TABLE_KJ } from './mgoEnergetics'
import { MGO_ELECTRON_LEAD, MGO_ELECTRONS, MGO_END, MGO_FINISH, MGO_STEPS, mgoCueAt } from './mgoSteps'

export {
  MGO_CUES,
  MGO_ELECTRON_LEAD,
  MGO_ELECTRONS,
  MGO_END,
  MGO_FINISH,
  MGO_SEGMENTS,
  MGO_STEPS,
  MGO_STEP_IDS,
  MGO_TIMING,
  mgoStepIndexAt,
  type MgoCueId,
  type MgoStepId,
} from './mgoSteps'

/**
 * Раскадровка 2 Mg (тв.) + O₂ (г.) → 2 MgO (тв.) — ЧИСТАЯ функция времени сюжета.
 * Построена по рецепту эталона scenes/nacl.
 *
 * Ни одного числа химии: геометрия — из crystalData через kit/lattice (металл Mg ГПУ 2×2×1 ячейки,
 * фрагмент MgO 2×2×2), длины — из bondData (O=O, газовая Mg–O), радиусы — через speciesRadius
 * (Mg⁰ металлический, O⁰ ковалентный, ионы — Шеннон, КЧ 6), энергия — из цикла и таблицы.
 *
 * Правила, выполненные по построению:
 *   • у каждого атома span [первый, последний шаг]; вне него непрозрачность строго 0;
 *   • каждый видимый атом подписан или покрыт подписью группы (label.hosts);
 *   • заряд донора меняется в кадр УХОДА электрона (Mg → Mg⁺ → Mg²⁺), акцептора — в кадр ПРИХОДА
 *     (O → O⁻ → O²⁻): в любой кадр Σзарядов + (−1)·(летящие e⁻) = 0;
 *   • радиус меняется, когда у частицы появляется табличный радиус: Mg²⁺ — в кадр ухода второго
 *     электрона (слой 3s пуст), O²⁻ — в кадр прихода второго (октет). У промежуточных Mg⁺ и O⁻
 *     радиусов Шеннона нет — размер остаётся прежним (названо в note шага 3);
 *   • шаг 5: полные сферы Шеннона — газовая пара на r_e(MgO, г.) перекрывается честно;
 *   • решётка — целое число ячеек, рёбра ячеек отдельным слоем, никаких связей Mg–O;
 *   • пламени и свечения нет нигде: пламя магния описано только в тексте урока.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

const SALT = getCrystal('mgo')!

/** Фрагмент периклаза: 2×2×2 ячейки, 125 ионов, центр рамки в начале координат. */
export const SALT_FRAG = latticeFragment('mgo', [2, 2, 2])
/** Кусочек металлического магния: 2×2×1 ГПУ-ячейки (ромбические призмы), 8 атомов в двух слоях. */
export const METAL_FRAG = latticeFragment('mg_metal', [2, 2, 1])
/** Подписи решёток — только символы и числа. */
export const SALT_CAPTION = latticeCaption('mgo')
export const METAL_CAPTION = latticeCaption('mg_metal')
/**
 * Символ Германа — Могена для учебного кадра: ядро хранит ASCII-запись («Fm-3m»), а в кадре
 * инверсионная ось пишется цифрой с надчёркиванием (Fm3̄m, № 225) — «-3» → «3» + U+0304.
 */
export const hermannMauguinDisplay = (ascii: string): string => ascii.replace(/-(\d)/g, '$1\u0304')
export const SALT_SG_DISPLAY = hermannMauguinDisplay(SALT_CAPTION[1]!)

/** Половина ребра ячейки MgO = d(Mg²⁺–O²⁻) в решётке, мировые единицы. */
const H = pmToScene(SALT.cationAnionPm)
/** Газовая пара (формальные заряды цикла ±2; реальная MgO (г.) ближе к Mg⁺O⁻ — названо в note шага 5): r_e молекулы MgO (г.), мировые единицы. */
const D_GAS = pmToScene(bondLengthPm('Mg-O'))
/** Половина длины связи O=O. */
const OH_ = bondLength('O=O') / 2

const R = {
  mg: speciesRadius('Mg', 0),
  mgIon: speciesRadius('Mg', 2),
  o: speciesRadius('O', 0),
  oIon: speciesRadius('O', -2),
} as const

/** Ионы решётки: доля радиуса как у героя (LATTICE_BALL_SCALE) — сквозь фрагмент видны рёбра ячеек. */
const R_LATTICE = {
  mgIon: speciesRadius('Mg', 2, LATTICE_BALL_SCALE),
  oIon: speciesRadius('O', -2, LATTICE_BALL_SCALE),
} as const

/** Зазор валентных точек над поверхностью атома (параметр рисунка, не химия). */
const DOT_GAP = 0.07

/** Плоскость действия шагов 1–5 — передняя грань будущего фрагмента (z = +a). */
const STAGE_Z = 2 * H

export const MGO_GEOM = {
  radius: R,
  latticeRadius: R_LATTICE,
  latticeScale: LATTICE_BALL_SCALE,
  /** d(Mg²⁺–O²⁻) в решётке, мировые единицы */
  latticeMgO: H,
  /** r_e газовой пары MgO, мировые единицы */
  gasMgO: D_GAS,
  cell: 2 * H,
  oHalf: OH_,
  stageZ: STAGE_Z,
} as const

/** Масштаб рига камеры. */
export const MGO_RIG_SCALE = 1.15

// ─────────────────────────────────────────────────────────────────────────────
// Состав кадра: атомы, их шаги и подписи
// ─────────────────────────────────────────────────────────────────────────────

export type MgoElement = 'Mg' | 'O'
export type MgoAtomKind = 'story' | 'metal' | 'lattice'

export type MgoAtomDef = {
  id: string
  el: MgoElement
  kind: MgoAtomKind
  /** индексы шагов [первый, последний], на которых атом имеет право быть видимым */
  span: readonly [number, number]
}

const E = MGO_ELECTRONS
const T = {
  sub1: mgoCueAt('sublimate'),
  sub2: mgoCueAt('sublimate') + 0.4,
  brk: mgoCueAt('bondBreak'),
  contact: mgoCueAt('contact'),
  lattice: mgoCueAt('lattice'),
}

const stepFrom = (i: number) => MGO_STEPS[i]!.from
const stepTo = (i: number) => MGO_STEPS[i]!.to
const LAST_STEP = MGO_STEPS.length - 1
const STEP = { reactants: 0, ignition: 1, transfer: 2, second: 3, attraction: 4, lattice: 5, energy: 6 } as const

/** Индекс узла фрагмента по координатам в единицах a/2 (центр фрагмента — Mg в (0,0,0)). */
function saltSiteAt(i: number, j: number, k: number): number {
  const idx = SALT_FRAG.sites.findIndex(
    (s) => Math.round(s.posScene[0] / H) === i && Math.round(s.posScene[1] / H) === j && Math.round(s.posScene[2] / H) === k,
  )
  if (idx < 0) throw new Error(`mgo: нет узла (${i}, ${j}, ${k}) во фрагменте`)
  return idx
}

/** Узлы передней грани, куда встают пары сюжета: Mg слева, O справа, как в газовой паре. */
const STORY_SITE = {
  mg1: saltSiteAt(-1, 1, 2),
  oA: saltSiteAt(0, 1, 2),
  mg2: saltSiteAt(-1, -1, 2),
  oB: saltSiteAt(0, -1, 2),
} as const

/** Атом металла со стороны кислорода: верхний (sy = +1) или нижний (−1) слой с наибольшим x. */
function metalEdgeSite(sy: 1 | -1): number {
  let best = -1
  for (let i = 0; i < METAL_FRAG.sites.length; i++) {
    const p = METAL_FRAG.sites[i]!.posScene
    if (Math.sign(p[1]) !== sy) continue
    if (best < 0 || p[0] > METAL_FRAG.sites[best]!.posScene[0] + 1e-9) best = i
  }
  if (best < 0) throw new Error('mgo: нет атома металла на краю')
  return best
}
const METAL_MG1 = metalEdgeSite(1)
const METAL_MG2 = metalEdgeSite(-1)
const METAL_REST = METAL_FRAG.sites.map((_, i) => i).filter((i) => i !== METAL_MG1 && i !== METAL_MG2)

const STORY_IDS = ['mg1', 'mg2', 'oA', 'oB'] as const
type StoryId = (typeof STORY_IDS)[number]
const STORY_SET = new Set<number>(Object.values(STORY_SITE))
const LATTICE_REST = SALT_FRAG.sites.map((_, i) => i).filter((i) => !STORY_SET.has(i))

export const MGO_ATOMS: readonly MgoAtomDef[] = [
  { id: 'mg1', el: 'Mg', kind: 'story', span: [0, LAST_STEP] },
  { id: 'mg2', el: 'Mg', kind: 'story', span: [0, LAST_STEP] },
  { id: 'oA', el: 'O', kind: 'story', span: [0, LAST_STEP] },
  { id: 'oB', el: 'O', kind: 'story', span: [0, LAST_STEP] },
  ...METAL_REST.map((_, k) => ({ id: `M${k}`, el: 'Mg' as MgoElement, kind: 'metal' as const, span: [STEP.reactants, STEP.ignition] as const })),
  ...LATTICE_REST.map((si, k) => ({
    id: `L${k}`,
    el: SALT_FRAG.sites[si]!.el as MgoElement,
    kind: 'lattice' as const,
    span: [STEP.lattice, LAST_STEP] as const,
  })),
]

export const MGO_ATOM_INDEX: ReadonlyMap<string, number> = new Map(MGO_ATOMS.map((a, i) => [a.id, i]))
const IDX = (id: string) => MGO_ATOM_INDEX.get(id)!
const I_MG1 = IDX('mg1')
const I_MG2 = IDX('mg2')
const I_OA = IDX('oA')
const I_OB = IDX('oB')
const METAL_IDS = MGO_ATOMS.filter((a) => a.kind === 'metal').map((a) => a.id)
const LATTICE_IDS = MGO_ATOMS.filter((a) => a.kind === 'lattice').map((a) => a.id)

/** Индекс узла фрагмента MgO для атома кадра (story + lattice). */
export const SALT_SITE_OF: ReadonlyMap<string, number> = new Map<string, number>([
  ['mg1', STORY_SITE.mg1],
  ['mg2', STORY_SITE.mg2],
  ['oA', STORY_SITE.oA],
  ['oB', STORY_SITE.oB],
  ...LATTICE_REST.map((si, k) => [`L${k}`, si] as [string, number]),
])

/** Индекс узла металла для атома кадра (металл + два атома сюжета). */
export const METAL_SITE_OF: ReadonlyMap<string, number> = new Map<string, number>([
  ['mg1', METAL_MG1],
  ['mg2', METAL_MG2],
  ...METAL_REST.map((si, k) => [`M${k}`, si] as [string, number]),
])

/** Металлические связи ГПУ: пары первой координационной сферы фрагмента (в слое и между слоями). */
export const METAL_BONDS: readonly (readonly [string, string])[] = METAL_FRAG.bonds.map(([i, j]) => {
  const byIdx = (si: number) => [...METAL_SITE_OF.entries()].find(([, v]) => v === si)![0]
  return [byIdx(i), byIdx(j)] as const
})

// ─────────────────────────────────────────────────────────────────────────────
// Положения
// ─────────────────────────────────────────────────────────────────────────────

type V3 = readonly [number, number, number]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]

/** Центр кусочка металла (слева) и молекулы кислорода (справа) на шаге 1. */
const METAL_CENTER: V3 = [-1.45, 0, STAGE_Z]
const O2_CENTER: V3 = [1.35, 0, STAGE_Z]
/** Сдвиг рёбер ячеек металла в кадре (слой CinemaCellEdges). */
export const MGO_METAL_OFFSET = METAL_CENTER

const metalPos = (si: number): V3 => add(METAL_CENTER, METAL_FRAG.sites[si]!.posScene)
const saltPos = (si: number): V3 => SALT_FRAG.sites[si]!.posScene

/** Свободные атомы после сублимации/диссоциации — перед переходом электронов. */
const FREE: Record<StoryId, V3> = {
  mg1: [-0.95, H, STAGE_Z],
  mg2: [-0.95, -H, STAGE_Z],
  oA: [0.55, H, STAGE_Z],
  oB: [0.55, -H, STAGE_Z],
}

/** Газовые пары: середина пары = середина её будущих узлов решётки, Mg²⁺ и O²⁻ на r_e(MgO, г.). */
function gasPos(mg: 'mg1' | 'mg2', o: 'oA' | 'oB', which: 'mg' | 'o'): V3 {
  const a = saltPos(STORY_SITE[mg])
  const b = saltPos(STORY_SITE[o])
  const mid = scale(add(a, b), 0.5)
  const dir = scale(add(b, scale(a, -1)), 1 / H)
  return add(mid, scale(dir, (which === 'mg' ? -0.5 : 0.5) * D_GAS))
}
const GAS: Record<StoryId, V3> = {
  mg1: gasPos('mg1', 'oA', 'mg'),
  oA: gasPos('mg1', 'oA', 'o'),
  mg2: gasPos('mg2', 'oB', 'mg'),
  oB: gasPos('mg2', 'oB', 'o'),
}

const T_MOVE_LATTICE = { from: stepFrom(STEP.lattice) + 0.3, to: stepFrom(STEP.lattice) + 1.9 }
const T_PAIR = { from: stepFrom(STEP.attraction) + 0.4, to: T.contact }

/**
 * МАСШТАБ ШАРОВ частиц сюжета относительно SPECIES_SCALE (параметр рисунка, не химия).
 * Шаг 5: полный радиус Шеннона (×1/SPECIES_SCALE) — сумма радиусов больше r_e газовой пары,
 * перекрытие видно честно. Шаг 6: пары расходятся до a/2, шары сжимаются до доли решётки.
 */
export const MGO_DRAW_SCALE: ScalarTrack = [
  { t: stepFrom(STEP.attraction), v: 1 },
  { t: T_PAIR.from + 0.8, v: 1 / SPECIES_SCALE, ease: 'smooth' },
  { t: T_MOVE_LATTICE.from, v: 1 / SPECIES_SCALE },
  { t: T_MOVE_LATTICE.to, v: LATTICE_BALL_SCALE / SPECIES_SCALE, ease: 'smooth' },
]

function storyTrack(id: StoryId, start: V3, leaveAt: number, free: V3, arc: number): Vec3Track {
  return [
    { t: 0, v: start },
    { t: leaveAt, v: start },
    { t: leaveAt + 1.8, v: free, ease: 'smooth', arc },
    { t: T_PAIR.from, v: free },
    { t: T_PAIR.to, v: GAS[id], ease: 'smooth' },
    { t: T_MOVE_LATTICE.from, v: GAS[id] },
    { t: T_MOVE_LATTICE.to, v: saltPos(STORY_SITE[id]), ease: 'smooth' },
  ]
}

const POS: Record<string, Vec3Track> = {
  mg1: storyTrack('mg1', metalPos(METAL_MG1), T.sub1 - 0.3, FREE.mg1, 0.2),
  mg2: storyTrack('mg2', metalPos(METAL_MG2), T.sub2 - 0.3, FREE.mg2, -0.2),
  oA: [
    { t: 0, v: add(O2_CENTER, [0, OH_, 0]) },
    { t: T.brk - 1.4, v: add(O2_CENTER, [0, OH_, 0]) },
    { t: T.brk, v: add(O2_CENTER, [0, OH_ + 0.05, 0]), ease: 'inQuad' },
    { t: T.brk + 1.3, v: FREE.oA, ease: 'smooth' },
    { t: T_PAIR.from, v: FREE.oA },
    { t: T_PAIR.to, v: GAS.oA, ease: 'smooth' },
    { t: T_MOVE_LATTICE.from, v: GAS.oA },
    { t: T_MOVE_LATTICE.to, v: saltPos(STORY_SITE.oA), ease: 'smooth' },
  ],
  oB: [
    { t: 0, v: add(O2_CENTER, [0, -OH_, 0]) },
    { t: T.brk - 1.4, v: add(O2_CENTER, [0, -OH_, 0]) },
    { t: T.brk, v: add(O2_CENTER, [0, -OH_ - 0.05, 0]), ease: 'inQuad' },
    { t: T.brk + 1.3, v: FREE.oB, ease: 'smooth' },
    { t: T_PAIR.from, v: FREE.oB },
    { t: T_PAIR.to, v: GAS.oB, ease: 'smooth' },
    { t: T_MOVE_LATTICE.from, v: GAS.oB },
    { t: T_MOVE_LATTICE.to, v: saltPos(STORY_SITE.oB), ease: 'smooth' },
  ],
}

/** Остальной металл уходит влево и гаснет ПОЛНОСТЬЮ до конца шага 2 — без призраков. */
const METAL_EXIT: V3 = [-0.6, 0, 0]
const T_METAL_OUT = { from: T.sub2 + 0.3, to: stepTo(STEP.ignition) - 0.4 }
METAL_IDS.forEach((id, k) => {
  const p = metalPos(METAL_REST[k]!)
  POS[id] = [
    { t: 0, v: p },
    { t: T_METAL_OUT.from, v: p },
    { t: T_METAL_OUT.to, v: add(p, METAL_EXIT), ease: 'inQuad' },
  ]
})

/**
 * Рост кристалла: 121 ион подлетает к узлам радиально, ближние к парам сюжета раньше.
 * Каждый ион вырастает из точки в начале своего полёта; все на местах задолго до паузы шага 6.
 */
const GROW = { from: stepFrom(STEP.lattice) + 0.8, to: T.lattice - 1.4, flight: 1.2, appear: 0.7, reach: 0.9 }
const STORY_CENTROID: V3 = scale(
  add(add(saltPos(STORY_SITE.mg1), saltPos(STORY_SITE.oA)), add(saltPos(STORY_SITE.mg2), saltPos(STORY_SITE.oB))),
  0.25,
)
export const LATTICE_ARRIVAL: ReadonlyMap<string, { start: number; arrive: number }> = (() => {
  const ranked = LATTICE_IDS.map((id) => {
    const p = saltPos(SALT_SITE_OF.get(id)!)
    return { id, d: Math.hypot(p[0] - STORY_CENTROID[0], p[1] - STORY_CENTROID[1], p[2] - STORY_CENTROID[2]) }
  }).sort((a, b) => a.d - b.d || a.id.localeCompare(b.id))
  const out = new Map<string, { start: number; arrive: number }>()
  ranked.forEach((r, rank) => {
    const start = GROW.from + (rank / Math.max(1, ranked.length - 1)) * (GROW.to - GROW.from - GROW.flight)
    out.set(r.id, { start, arrive: start + GROW.flight })
  })
  return out
})()
for (const id of LATTICE_IDS) {
  const p = saltPos(SALT_SITE_OF.get(id)!)
  const dx = p[0] - STORY_CENTROID[0]
  const dy = p[1] - STORY_CENTROID[1]
  const dz = p[2] - STORY_CENTROID[2]
  const len = Math.hypot(dx, dy, dz) || 1
  const from: V3 = [p[0] + (dx / len) * GROW.reach, p[1] + (dy / len) * GROW.reach, p[2] + (dz / len) * GROW.reach]
  const a = LATTICE_ARRIVAL.get(id)!
  POS[id] = [
    { t: a.start, v: from },
    { t: a.arrive, v: p, ease: 'smooth' },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

/** Две ступени подряд (заряд 0 → 1 → 2): каждая — ровно в свой кадр, без промежуточных значений. */
function twoSnaps(t1: number, t2: number, a: number, b: number, c: number): ScalarTrack {
  return [
    { t: t1 - OCTET_SNAP_EPS, v: a },
    { t: t1, v: b, ease: 'step' },
    { t: t2 - OCTET_SNAP_EPS, v: b },
    { t: t2, v: c, ease: 'step' },
  ]
}

/**
 * ЗАРЯД, РАДИУС И МАТЕРИАЛ МЕНЯЮТСЯ СТУПЕНЬЮ:
 * донор — в кадр УХОДА электрона (Mg → Mg⁺ + e⁻, Mg⁺ → Mg²⁺ + e⁻ — это ступени ионизации),
 * акцептор — в кадр ПРИХОДА (O + e⁻ → O⁻, O⁻ + e⁻ → O²⁻). Радиус — когда появляется табличный
 * радиус иона: Mg²⁺ на втором уходе, O²⁻ на втором приходе.
 */
export const MGO_SNAP = {
  radiusMg1: octetSnap(E.e3.leave, R.mg, R.mgIon),
  radiusMg2: octetSnap(E.e4.leave, R.mg, R.mgIon),
  radiusOA: octetSnap(E.e3.arrive, R.o, R.oIon),
  radiusOB: octetSnap(E.e4.arrive, R.o, R.oIon),
  chargeMg1: twoSnaps(E.e1.leave, E.e3.leave, 0, 1, 2),
  chargeMg2: twoSnaps(E.e2.leave, E.e4.leave, 0, 1, 2),
  chargeOA: twoSnaps(E.e1.arrive, E.e3.arrive, 0, -1, -2),
  chargeOB: twoSnaps(E.e2.arrive, E.e4.arrive, 0, -1, -2),
} as const

/** Какие электроны отдаёт/принимает каждая частица сюжета (для теста и облаков). */
export const MGO_ELECTRON_ROUTES = [
  { id: 'e1', donor: 'mg1', acceptor: 'oA', order: 1 },
  { id: 'e2', donor: 'mg2', acceptor: 'oB', order: 1 },
  { id: 'e3', donor: 'mg1', acceptor: 'oA', order: 2 },
  { id: 'e4', donor: 'mg2', acceptor: 'oB', order: 2 },
] as const

/** Появление шага 1 (после прогрева шейдеров). */
const APPEAR: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.6, v: 1, ease: 'smooth' },
]
const METAL_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.6, v: 1, ease: 'smooth' },
  { t: T_METAL_OUT.from, v: 1 },
  { t: T_METAL_OUT.to, v: 0, ease: 'smooth' },
]
/** Металлические связи уходят раньше атомов — кусочек металла распадается, когда атомы его покидают. */
const METAL_BOND: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.8, v: 1, ease: 'smooth' },
  { t: stepTo(STEP.reactants), v: 1 },
  { t: T.sub1, v: 0, ease: 'smooth' },
]

/** Связь O=O: натяжение, затем ГОМОЛИТИЧЕСКИЙ разрыв (split = 0), π уходит первой. */
const BOND_STRESS: ScalarTrack = [
  { t: T.brk - 1.8, v: 0 },
  { t: T.brk, v: 1, ease: 'inQuad' },
]
const BOND_THIN: ScalarTrack = [
  { t: T.brk - 0.15, v: 0 },
  { t: T.brk + 0.35, v: 1, ease: 'outCubic' },
]
const BOND_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.6, v: 1, ease: 'smooth' },
  { t: T.brk, v: 1 },
  { t: T.brk + 0.6, v: 0, ease: 'smooth' },
]
const PI_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.8, v: 1, ease: 'smooth' },
  { t: T.brk - 0.9, v: 1 },
  { t: T.brk - 0.1, v: 0, ease: 'smooth' },
]

/** Рёбра ячеек: сначала ячейки металла (шаг 1), потом ячейки MgO (шаг 6 → финал). */
const METAL_EDGES: ScalarTrack = [
  { t: 0.2, v: 0 },
  { t: 1.0, v: 1, ease: 'smooth' },
  { t: stepTo(STEP.reactants), v: 1 },
  { t: T.sub1 - 0.1, v: 0, ease: 'smooth' },
]
const SALT_EDGES: ScalarTrack = [
  { t: T.lattice - 0.8, v: 0 },
  { t: T.lattice, v: 1, ease: 'smooth' },
  { t: MGO_FINISH.from, v: 1 },
  { t: MGO_FINISH.to, v: 0, ease: 'smooth' },
]
/** С какого момента пул рёбер держит ячейки MgO (в этот момент обе дорожки = 0). */
export const EDGE_SWITCH_T = stepFrom(STEP.transfer)

/**
 * Валентные облака: у Mg две точки (3s²), у O шесть (2s²2p⁴). Загораются в конце шага 2 — на паузе
 * перед переносом видно «до». У O облако гаснет на шаге притяжения (октет уже показан).
 */
const VALENCE_WIN = { from: stepTo(STEP.ignition) - 0.9, oOff: stepFrom(STEP.attraction) + 1.0 }

/** Линии поля газовых пар (шаг 5) — видны и на паузе шага, гаснут, когда пары раздвигаются. */
const FIELD_WIN: readonly [number, number] = [stepFrom(STEP.attraction) + 0.2, T_MOVE_LATTICE.to - 0.4]

const FADE = fadeTrack(MGO_FINISH)

/**
 * Камера — планы (kit/camera): общий план реагентов, наезд на электроны, крупно пары,
 * отъезд на решётку и медленный облёт на финале.
 */
export const MGO_CAMERA: ShotTrack = shotTrack([
  { t: 0, zoom: 0.62, target: [-0.75, 0, STAGE_Z] },
  { t: stepTo(STEP.reactants), zoom: 0.64 },
  { t: stepFrom(STEP.ignition) + 3.4, zoom: 1.02, target: [-0.2, 0, STAGE_Z] },
  { t: stepTo(STEP.second), zoom: 1.05 },
  { t: T.contact, zoom: 1.35, target: [-H / 2, 0, STAGE_Z] },
  { t: stepTo(STEP.attraction), zoom: 1.35 },
  { t: T.lattice - 1.2, zoom: 0.9, yaw: 0.32, pitch: 0.22, target: [0, 0, 0] },
  ...orbitTrack(stepFrom(STEP.energy), stepTo(STEP.energy), 0.32, 0.8, 0.22, 0.9),
])

const BASE_EMISSIVE = 0.08
const BASE_BLOOM = 0.3

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D — только формулы, заряды, числа и символы единиц (токены)
// ─────────────────────────────────────────────────────────────────────────────

export type MgoLabelDef = SceneLabelDef & {
  anchor: 'atom' | 'metal' | 'metalEdge' | 'o2' | 'oBond' | 'pair' | 'pairFront' | 'electron' | 'edgeA' | 'cubeAbove'
  atom?: string
  /** индекс электрона (0…3) для anchor 'electron' */
  electron?: number
  dx?: number
  hosts: readonly string[]
}

const fmt1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1)
/** Значение ядра без лишних нулей и без потери знаков (r_e O=O — две цифры после точки). */
const fmtCore = (v: number) => String(Math.round(v * 100) / 100)
const signed1 = (v: number) => (v < 0 ? `−${fmt1(-v)}` : `+${fmt1(v)}`)

const W_LABEL_STORY_END = T_MOVE_LATTICE.to + 0.6
const E_LIST = [E.e1, E.e2, E.e3, E.e4] as const

export const MGO_LABELS: readonly MgoLabelDef[] = [
  // Шаг 1: металл и молекула
  { id: 'metal', kind: 'species', anchor: 'metal', dy: 1.05, keys: [{ t: 0, text: 'Mg ({s})' }], windows: [[0.2, T_METAL_OUT.to]], hosts: [...METAL_IDS, 'mg1', 'mg2'] },
  { id: 'metalA', kind: 'measure', anchor: 'metalEdge', dy: -0.95, keys: [{ t: 0, text: METAL_CAPTION[0]! }], windows: [[0.6, T.sub1]], hosts: [] },
  { id: 'o2', kind: 'species', anchor: 'o2', dy: 0.55, keys: [{ t: 0, text: 'O₂ ({g})' }], windows: [[0.2, T.brk]], hosts: ['oA', 'oB'] },
  { id: 'oBond', kind: 'measure', anchor: 'oBond', dy: 0, keys: [{ t: 0, text: `${fmtCore(bondLengthPm('O=O'))} {pm}` }], windows: [[0.6, T.brk - 0.3]], hosts: [] },
  // Шаги 2–5: частицы сюжета; заряд донора — в кадр ухода, акцептора — в кадр прихода
  { id: 'mg1', kind: 'species', anchor: 'atom', atom: 'mg1', dy: 0.16, keys: [{ t: 0, text: 'Mg ({g})' }, { t: E.e1.leave, text: 'Mg⁺' }, { t: E.e3.leave, text: 'Mg²⁺' }], windows: [[T.sub1, W_LABEL_STORY_END]], hosts: ['mg1'] },
  { id: 'mg2', kind: 'species', anchor: 'atom', atom: 'mg2', dy: -0.16, keys: [{ t: 0, text: 'Mg ({g})' }, { t: E.e2.leave, text: 'Mg⁺' }, { t: E.e4.leave, text: 'Mg²⁺' }], windows: [[T.sub2, W_LABEL_STORY_END]], hosts: ['mg2'] },
  { id: 'oA', kind: 'species', anchor: 'atom', atom: 'oA', dy: 0.16, keys: [{ t: 0, text: 'O ({g})' }, { t: E.e1.arrive, text: 'O⁻' }, { t: E.e3.arrive, text: 'O²⁻' }], windows: [[T.brk, W_LABEL_STORY_END]], hosts: ['oA'] },
  { id: 'oB', kind: 'species', anchor: 'atom', atom: 'oB', dy: -0.16, keys: [{ t: 0, text: 'O ({g})' }, { t: E.e2.arrive, text: 'O⁻' }, { t: E.e4.arrive, text: 'O²⁻' }], windows: [[T.brk, W_LABEL_STORY_END]], hosts: ['oB'] },
  ...E_LIST.map((e, k) => ({
    id: `e${k + 1}`,
    kind: 'token' as const,
    anchor: 'electron' as const,
    electron: k,
    dy: k % 2 === 0 ? 0.2 : -0.2,
    keys: [{ t: 0, text: 'e⁻' }],
    windows: [[e.leave - MGO_ELECTRON_LEAD, e.arrive + 0.15]] as const,
    hosts: [] as const,
  })),
  // Шаг 5: газовая пара — r_e(MgO, г.)
  { id: 'dGas', kind: 'measure', anchor: 'pair', dy: -0.5, keys: [{ t: 0, text: `${fmtCore(bondLengthPm('Mg-O'))} {pm}` }], windows: [[T.contact - 0.8, T_MOVE_LATTICE.from + 0.5]], hosts: [] },
  // Шаг 6: та же пара в решётке — d(Mg²⁺–O²⁻) = a/2
  { id: 'dCrystal', kind: 'measure', anchor: 'pairFront', dy: 0, keys: [{ t: 0, text: `${fmt1(SALT.cationAnionPm)} {pm}` }], windows: [[T_MOVE_LATTICE.to - 0.2, stepFrom(STEP.energy) + 1.2]], hosts: [] },
  { id: 'cellA', kind: 'measure', anchor: 'edgeA', dy: -0.3, keys: [{ t: 0, text: SALT_CAPTION[0]! }], windows: [[T.lattice - 0.6, MGO_END]], hosts: [] },
  { id: 'sg', kind: 'token', anchor: 'cubeAbove', dy: 0.38, dx: -0.5, keys: [{ t: 0, text: SALT_SG_DISPLAY }], windows: [[T.lattice - 0.4, MGO_END]], hosts: [] },
  { id: 'cn', kind: 'token', anchor: 'cubeAbove', dy: 0.38, dx: 0.5, keys: [{ t: 0, text: SALT_CAPTION[2]! }], windows: [[T.lattice - 0.2, MGO_END]], hosts: [] },
  { id: 'mgo', kind: 'species', anchor: 'cubeAbove', dy: 1.35, keys: [{ t: 0, text: 'MgO ({s})' }], windows: [[GROW.from + 1.2, MGO_END]], hosts: [...LATTICE_IDS, ...STORY_IDS] },
  // Шаг 7: табличная ΔH°f (число из ядра, не строкой)
  { id: 'dH', kind: 'measure', anchor: 'cubeAbove', dy: 0.85, keys: [{ t: 0, text: `ΔH°f = ${signed1(MGO_DHF_TABLE_KJ)} {kJmol}` }], windows: [[stepFrom(STEP.energy) + 0.4, MGO_END]], hosts: [] },
]

export type MgoLabelState = SceneLabelState

/** Ребро ячейки для подписи a: нижнее переднее ребро первой ячейки вдоль x (под ним пусто). */
const EDGE_A: LatticeSegment = (() => {
  const bottom = Math.min(...SALT_FRAG.cellEdges.flatMap(([p, q]) => [p[1], q[1]]))
  const front = Math.max(...SALT_FRAG.cellEdges.flatMap(([p, q]) => [p[2], q[2]]))
  const cand = SALT_FRAG.cellEdges.filter(
    ([p, q]) => Math.abs(p[1] - bottom) < 1e-6 && Math.abs(q[1] - bottom) < 1e-6 && Math.abs(p[2] - front) < 1e-6 && Math.abs(q[2] - front) < 1e-6 && Math.abs(p[0] - q[0]) > 1e-6,
  )
  cand.sort((a, b) => Math.min(a[0][0], a[1][0]) - Math.min(b[0][0], b[1][0]))
  return cand[0]!
})()
const METAL_BOTTOM_Y = Math.min(...METAL_FRAG.cellEdges.flatMap(([p, q]) => [p[1], q[1]]))

export const MGO_EDGE_A = EDGE_A
/** Размерная линия a: на этом расстоянии под ребром (снаружи сфер нижнего ряда), мировые единицы. */
export const MGO_DIM_A_DROP = R_LATTICE.oIon + 0.12

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type MgoValence = { center: THREE.Vector3; radius: number; count: number; amount: number; highlight: number; skip: number }

export type MgoFrame = {
  t: number
  pos: THREE.Vector3[]
  radius: Float32Array
  charge: Float32Array
  opacity: Float32Array
  emissive: Float32Array
  material: SubstanceKind[]
  /** связь O=O: σ (stress/thinning/opacity) и π-лепестки */
  bond: { stress: number; thinning: number; opacity: number; pi: number }
  /** металлические связи (0…1) */
  metalBond: number
  edgeSet: 'metal' | 'salt'
  edges: number
  electrons: [ElectronJump, ElectronJump, ElectronJump, ElectronJump]
  /** валентные облака: mg1, mg2, oA, oB */
  valence: [MgoValence, MgoValence, MgoValence, MgoValence]
  /** амплитуды эффектов (тест: в финале все 0) */
  fx: { electrons: [number, number, number, number]; field: number }
  dims: { pair: number; edgeA: number }
  drawScale: number
  labels: MgoLabelState[]
  camera: SceneCamera
  fade: number
}

const VIEW = new THREE.Vector3(0, 0, 1)

function createValence(): MgoValence {
  return { center: new THREE.Vector3(), radius: 0, count: 0, amount: 0, highlight: -1, skip: 0 }
}

export function createMgoFrame(): MgoFrame {
  const n = MGO_ATOMS.length
  return {
    t: 0,
    pos: MGO_ATOMS.map(() => new THREE.Vector3()),
    radius: new Float32Array(n),
    charge: new Float32Array(n),
    opacity: new Float32Array(n),
    emissive: new Float32Array(n).fill(BASE_EMISSIVE),
    material: MGO_ATOMS.map(() => 'default' as SubstanceKind),
    bond: { stress: 0, thinning: 0, opacity: 0, pi: 0 },
    metalBond: 0,
    edgeSet: 'metal',
    edges: 0,
    electrons: [createElectronJump('e1'), createElectronJump('e2'), createElectronJump('e3'), createElectronJump('e4')],
    valence: [createValence(), createValence(), createValence(), createValence()],
    fx: { electrons: [0, 0, 0, 0], field: 0 },
    dims: { pair: 0, edgeA: 0 },
    drawScale: 1,
    labels: createLabelStates(MGO_LABELS),
    camera: createSceneCamera(),
    fade: 0,
  }
}

/** Кадр, для которого сейчас считаются подписи (anchorLabel — модульная функция, без замыканий). */
let _cur: MgoFrame | null = null

function anchorLabel(def: SceneLabelDef, st: SceneLabelState): void {
  const f = _cur!
  const d = def as MgoLabelDef
  const p = f.pos
  switch (d.anchor) {
    case 'atom': {
      const i = IDX(d.atom!)
      st.pos.copy(p[i]!)
      st.pos.y += d.dy > 0 ? f.radius[i]! + d.dy : -(f.radius[i]! - d.dy)
      return
    }
    case 'metal':
      st.pos.set(METAL_CENTER[0], METAL_CENTER[1] + d.dy, METAL_CENTER[2])
      return
    case 'metalEdge':
      st.pos.set(METAL_CENTER[0], METAL_CENTER[1] + METAL_BOTTOM_Y + d.dy * 0.4, METAL_CENTER[2])
      return
    case 'o2':
      st.pos.copy(p[I_OA]!).lerp(p[I_OB]!, 0.5)
      st.pos.y += d.dy
      return
    case 'oBond':
      st.pos.copy(p[I_OA]!).lerp(p[I_OB]!, 0.5)
      st.pos.x += R.o + 0.45
      return
    case 'pair':
      st.pos.copy(p[I_MG1]!).lerp(p[I_OA]!, 0.5)
      st.pos.y += d.dy
      return
    case 'pairFront':
      st.pos.copy(p[I_MG1]!).lerp(p[I_OA]!, 0.5)
      st.pos.z += f.radius[I_OA]! + 0.08
      return
    case 'electron':
      st.pos.copy(f.electrons[d.electron!]!.pos)
      st.pos.y += d.dy
      return
    case 'edgeA':
      st.pos.set((EDGE_A[0][0] + EDGE_A[1][0]) / 2, (EDGE_A[0][1] + EDGE_A[1][1]) / 2 - MGO_DIM_A_DROP + d.dy, (EDGE_A[0][2] + EDGE_A[1][2]) / 2)
      return
    case 'cubeAbove':
      st.pos.set(d.dx ?? 0, SALT_FRAG.boundsScene.max[1] + d.dy, 0)
      return
  }
}

const TRACKS: (Vec3Track | undefined)[] = MGO_ATOMS.map((a) => POS[a.id])
const L_DCRYSTAL = MGO_LABELS.findIndex((l) => l.id === 'dCrystal')
const L_CELLA = MGO_LABELS.findIndex((l) => l.id === 'cellA')
const STORY_INDEX = [I_MG1, I_MG2, I_OA, I_OB] as const
const DETACH = [T.sub1 - 0.3, T.sub2 - 0.3] as const
/** Маршруты электронов в индексах кадра. */
const ROUTE_DONOR = MGO_ELECTRON_ROUTES.map((r) => IDX(r.donor))
const ROUTE_ACCEPTOR = MGO_ELECTRON_ROUTES.map((r) => IDX(r.acceptor))
const ARC_SIGN = [1, -1, 1, -1] as const

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleMgoFrame(t: number, frame: MgoFrame): MgoFrame {
  frame.t = t
  const { pos, radius, charge, opacity, material, emissive } = frame

  for (let i = 0; i < MGO_ATOMS.length; i++) {
    const tr = TRACKS[i]
    if (tr) sampleVec3(tr, t, pos[i]!)
    emissive[i] = BASE_EMISSIVE
  }

  // ——— Атомы сюжета: заряд/радиус/материал ступенью, масштаб шаров — дорожкой ———
  const appear = sampleScalar(APPEAR, t)
  const k = sampleScalar(MGO_DRAW_SCALE, t)
  frame.drawScale = k
  radius[I_MG1] = sampleScalar(MGO_SNAP.radiusMg1, t) * k
  radius[I_MG2] = sampleScalar(MGO_SNAP.radiusMg2, t) * k
  radius[I_OA] = sampleScalar(MGO_SNAP.radiusOA, t) * k
  radius[I_OB] = sampleScalar(MGO_SNAP.radiusOB, t) * k
  charge[I_MG1] = sampleScalar(MGO_SNAP.chargeMg1, t)
  charge[I_MG2] = sampleScalar(MGO_SNAP.chargeMg2, t)
  charge[I_OA] = sampleScalar(MGO_SNAP.chargeOA, t)
  charge[I_OB] = sampleScalar(MGO_SNAP.chargeOB, t)
  for (let s = 0; s < 4; s++) opacity[STORY_INDEX[s]!] = appear
  material[I_MG1] = t < DETACH[0] ? 'metal' : t < E.e1.leave ? 'gas' : 'ion'
  material[I_MG2] = t < DETACH[1] ? 'metal' : t < E.e2.leave ? 'gas' : 'ion'
  material[I_OA] = t < E.e1.arrive ? 'gas' : 'ion'
  material[I_OB] = t < E.e2.arrive ? 'gas' : 'ion'

  // ——— Металл: кусочек ГПУ, затем уходит и гаснет полностью ———
  const metalA = sampleScalar(METAL_OPACITY, t)
  for (let i = 4; i < 4 + METAL_IDS.length; i++) {
    radius[i] = R.mg
    charge[i] = 0
    opacity[i] = metalA
    material[i] = 'metal'
  }
  frame.metalBond = sampleScalar(METAL_BOND, t)

  // ——— Решётка: готовые Mg²⁺ / O²⁻, вырастают из точки в начале своего подлёта ———
  const base = 4 + METAL_IDS.length
  for (let q = 0; q < LATTICE_IDS.length; q++) {
    const i = base + q
    const mg = MGO_ATOMS[i]!.el === 'Mg'
    const a = LATTICE_TIMES[q]!
    const grow = t <= a ? 0 : smoothstep(a, a + GROW.appear, t)
    radius[i] = (mg ? R_LATTICE.mgIon : R_LATTICE.oIon) * grow
    charge[i] = mg ? 2 : -2
    material[i] = 'ion'
    opacity[i] = grow * 3 >= 1 ? 1 : grow * 3
  }

  // ——— Связь O=O ———
  frame.bond.stress = sampleScalar(BOND_STRESS, t)
  frame.bond.thinning = sampleScalar(BOND_THIN, t)
  frame.bond.opacity = sampleScalar(BOND_OPACITY, t)
  frame.bond.pi = sampleScalar(PI_OPACITY, t)

  // ——— Рёбра ячеек ———
  if (t < EDGE_SWITCH_T) {
    frame.edgeSet = 'metal'
    frame.edges = sampleScalar(METAL_EDGES, t)
  } else {
    frame.edgeSet = 'salt'
    frame.edges = sampleScalar(SALT_EDGES, t)
  }

  // ——— Электроны: 3s² магния достраивают октет кислорода, по одному ———
  for (let e = 0; e < 4; e++) {
    const d = ROUTE_DONOR[e]!
    const a = ROUTE_ACCEPTOR[e]!
    sampleElectronJump(frame.electrons[e]!, t, {
      donor: pos[d]!,
      acceptor: pos[a]!,
      // Оболочка донора — радиус атома Mg: старт дуги не прыгает, когда Mg²⁺ сжимается.
      shellRadius: R.mg + DOT_GAP,
      acceptorRadius: radius[a]!,
      leave: E_LIST[e]!.leave,
      arrive: E_LIST[e]!.arrive,
      arcSign: ARC_SIGN[e]!,
      lead: MGO_ELECTRON_LEAD,
      view: VIEW,
    })
    frame.fx.electrons[e] = frame.electrons[e]!.opacity
  }

  // ——— Валентные облака: count = valenceElectrons − charge (из ядра) ———
  writeDonorValence(frame.valence[0], pos[I_MG1]!, charge[I_MG1]!, radius[I_MG1]!, t, E.e1, E.e3)
  writeDonorValence(frame.valence[1], pos[I_MG2]!, charge[I_MG2]!, radius[I_MG2]!, t, E.e2, E.e4)
  writeAcceptorValence(frame.valence[2], pos[I_OA]!, charge[I_OA]!, radius[I_OA]!, t, E.e1.arrive, E.e3.arrive)
  writeAcceptorValence(frame.valence[3], pos[I_OB]!, charge[I_OB]!, radius[I_OB]!, t, E.e2.arrive, E.e4.arrive)

  // ——— Шаг 5: линии поля (ионная связь — без «палочки») ———
  frame.fx.field = windowFade(FIELD_WIN, t, 0.5)

  frame.fade = sampleScalar(FADE, t)

  // ——— Подписи ———
  _cur = frame
  sampleLabels(MGO_LABELS, frame.labels, t, anchorLabel, frame.fade)
  _cur = null
  frame.dims.pair = frame.labels[L_DCRYSTAL]!.opacity
  frame.dims.edgeA = frame.labels[L_CELLA]!.opacity

  // ——— Камера ———
  const cam = frame.camera
  sampleShot(MGO_CAMERA, t, cam)
  cam.shake = 0
  let glow = 0
  for (let e = 0; e < 4; e++) glow = Math.max(glow, frame.electrons[e]!.glow * frame.fx.electrons[e]!)
  cam.bloom = BASE_BLOOM + 0.15 * glow
  cam.vignette = Math.max(0.3, frame.fade)
  return frame
}

const LATTICE_TIMES: readonly number[] = LATTICE_IDS.map((id) => LATTICE_ARRIVAL.get(id)!.start)

const VALENCE_MG = ATOMIC_DATA.Mg.valenceElectrons
const VALENCE_O = ATOMIC_DATA.O.valenceElectrons

function valenceOn(t: number): number {
  return smoothstep(VALENCE_WIN.from, VALENCE_WIN.from + 0.5, t)
}

/**
 * Облако донора (Mg): две точки 3s², после первого ухода — одна, после второго — ноль
 * (у Mg²⁺ внешний слой ушёл целиком, заполненный 2s²2p⁶ не рисуем). Пока электрон перед
 * стартом обходит оболочку (lead), он рисуется сам, а его точка в облаке пропускается.
 */
function writeDonorValence(
  v: MgoValence,
  center: THREE.Vector3,
  charge: number,
  radius: number,
  t: number,
  first: { leave: number },
  second: { leave: number },
): void {
  v.center.copy(center)
  v.radius = radius + DOT_GAP
  const count = VALENCE_MG - Math.round(charge)
  v.count = count <= 0 ? 0 : count
  const inLead = (t >= first.leave - MGO_ELECTRON_LEAD && t < first.leave) || (t >= second.leave - MGO_ELECTRON_LEAD && t < second.leave)
  v.skip = inLead ? 1 : 0
  v.highlight = -1
  v.amount = v.count > 0 ? valenceOn(t) : 0
}

/** Облако акцептора (O): шесть точек, после первого прихода семь, после второго — октет (новая подсвечена). */
function writeAcceptorValence(v: MgoValence, center: THREE.Vector3, charge: number, radius: number, t: number, a1: number, a2: number): void {
  v.center.copy(center)
  v.radius = radius + DOT_GAP
  const count = VALENCE_O - Math.round(charge)
  v.count = count >= 8 ? 8 : count <= 0 ? 0 : count
  v.skip = 0
  const fresh = (t >= a1 && t < a1 + 1.2) || (t >= a2 && t < a2 + 1.2)
  v.highlight = fresh ? v.count - 1 : -1
  const off = 1 - smoothstep(VALENCE_WIN.oOff - 0.5, VALENCE_WIN.oOff, t)
  v.amount = v.count > 0 ? valenceOn(t) * off : 0
}

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validateMgoStoryboard(): void {
  const vec: Record<string, Vec3Track> = {}
  for (const [id, track] of Object.entries(POS)) vec[`pos.${id}`] = track
  vec['cam.offset'] = MGO_CAMERA.offset
  validateTracks(vec)
  validateTracks({
    ...MGO_SNAP,
    MGO_DRAW_SCALE,
    APPEAR,
    METAL_OPACITY,
    METAL_BOND,
    BOND_STRESS,
    BOND_THIN,
    BOND_OPACITY,
    PI_OPACITY,
    METAL_EDGES,
    SALT_EDGES,
    FADE,
    camZoom: MGO_CAMERA.zoom,
    camYaw: MGO_CAMERA.yaw,
    camPitch: MGO_CAMERA.pitch,
  })

  if (SALT_FRAG.sites.length !== 125) throw new Error(`mgo: фрагмент 2×2×2 обязан содержать 125 ионов, а не ${SALT_FRAG.sites.length}`)
  if (METAL_FRAG.sites.length < 6) throw new Error(`mgo: кусочек металла слишком мал (${METAL_FRAG.sites.length})`)
  if (MGO_ATOMS.length !== 4 + METAL_REST.length + 121) throw new Error(`mgo: в кадре ${MGO_ATOMS.length} атомов`)

  for (const [mg, o] of [['mg1', 'oA'], ['mg2', 'oB']] as const) {
    const a = SALT_FRAG.sites[STORY_SITE[mg]]!
    const b = SALT_FRAG.sites[STORY_SITE[o]]!
    if (a.el !== 'Mg' || b.el !== 'O') throw new Error(`mgo: узлы пары ${mg}/${o} не Mg/O`)
  }
  for (const a of MGO_ATOMS) {
    const si = SALT_SITE_OF.get(a.id)
    if (si != null && SALT_FRAG.sites[si]!.el !== a.el) throw new Error(`mgo: атом ${a.id} стоит в чужом узле`)
  }

  if (!(R.mgIon < R.mg)) throw new Error('mgo: Mg²⁺ обязан быть меньше атома Mg')
  if (!(R.oIon > R.o)) throw new Error('mgo: O²⁻ обязан быть больше атома O')

  // Каждый второй электрон уходит только после прихода первого — лестница идёт по порядку.
  if (!(E.e3.leave > E.e1.arrive && E.e4.leave > E.e2.arrive)) throw new Error('mgo: второй электрон стартует раньше прихода первого')
  // Электрон и его предстартовый обход оболочки — внутри своего шага.
  const inStep = (s: number, a: number, b: number) => a >= stepFrom(s) && b <= stepTo(s)
  if (!inStep(STEP.transfer, E.e1.leave - MGO_ELECTRON_LEAD, E.e2.arrive + 0.5)) throw new Error('mgo: первые электроны вне шага 3')
  if (!inStep(STEP.second, E.e3.leave - MGO_ELECTRON_LEAD, E.e4.arrive + 0.5)) throw new Error('mgo: вторые электроны вне шага 4')

  if (MGO_END <= stepTo(LAST_STEP)) throw new Error('mgo: хвост сцены пустой')
}
