import * as THREE from 'three'
import { ATOMIC_DATA, bondLengthPm, getCrystal, type ElementSymbol } from '../../../../chemistry/data'
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
import { octetSnap } from '../kit/valence'
import { NACL_DHF_KJ } from './naclEnergetics'
import { NACL_ELECTRONS, NACL_FINISH, NACL_END, NACL_STEPS, naclCueAt } from './naclSteps'

export {
  NACL_CUES,
  NACL_ELECTRONS,
  NACL_END,
  NACL_FINISH,
  NACL_SEGMENTS,
  NACL_STEPS,
  NACL_STEP_IDS,
  NACL_TIMING,
  naclStepIndexAt,
  type NaclCueId,
  type NaclStepId,
} from './naclSteps'

/**
 * Раскадровка 2 Na (тв.) + Cl₂ (г.) → 2 NaCl (тв.) — ЧИСТАЯ функция времени сюжета. ЭТАЛОН.
 *
 * Ни одного числа химии: геометрия — из crystalData через kit/lattice (ячейка Na ОЦК 1×1×1,
 * фрагмент NaCl 2×2×2), длины — из bondData (Cl–Cl, газовая Na–Cl), радиусы — через
 * speciesRadius (Na⁰ металлический, Cl⁰ ковалентный, ионы — Шеннон, КЧ 6), энергия — из цикла.
 *
 * Правила эталона, которые здесь выполнены по построению:
 *   • в кадре только объекты текущего шага: у каждого атома есть span [первый, последний шаг],
 *     вне него непрозрачность строго 0 (ни одного «призрака» — тест проверяет каждую 1/60 с);
 *   • каждый видимый атом подписан или покрыт подписью группы (label.hosts);
 *   • Na → Na⁺ в кадр УХОДА электрона (Na → Na⁺ + e⁻ — это и есть ступень ионизации), Cl → Cl⁻ —
 *     в кадр его ПРИХОДА: в любой кадр Σзарядов частиц + (−1)·(летящие e⁻) = 0 (тест, каждые 1/60 с);
 *   • масштаб шаров: 0,72 радиуса (SPECIES_SCALE) на шагах 1–3, полный радиус Шеннона на шаге 4
 *     (видно честное перекрытие газовой пары), LATTICE_BALL_SCALE в решётке (видны рёбра ячеек);
 *   • газовая пара Na⁺Cl⁻ стоит на r_e(NaCl, г.), в решётке ионы расходятся до a/2;
 *   • ионная связь — дуги поля точками, без «палочки»; Cl–Cl — σ-цилиндр;
 *   • решётка — целое число ячеек, рёбра ячеек отдельным слоем, никаких связей Na–Cl;
 *   • финал без огня, ореолов и свечения внутри кристалла: все FX-амплитуды → 0.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

const SALT = getCrystal('nacl')!
const METAL = getCrystal('na_metal')!

/** Фрагмент каменной соли: 2×2×2 ячейки, 125 ионов, центр рамки в начале координат. */
export const SALT_FRAG = latticeFragment('nacl', [2, 2, 2])
/** Одна ОЦК-ячейка натрия: 8 вершин + центр. */
export const METAL_FRAG = latticeFragment('na_metal', [1, 1, 1])
/** Подписи решёток — только символы и числа: ['a = 564 {pm}', 'Fm-3m', '{cn} 6:6']. */
export const SALT_CAPTION = latticeCaption('nacl')
export const METAL_CAPTION = latticeCaption('na_metal')

/** Половина ребра ячейки NaCl = d(Na⁺–Cl⁻) в решётке, мировые единицы. */
const H = pmToScene(SALT.cationAnionPm)
/** Газовая пара Na⁺Cl⁻: r_e молекулы NaCl (г.), мировые единицы. */
const D_GAS = pmToScene(bondLengthPm('Na-Cl'))
/** Половина длины связи Cl–Cl. */
const CH = bondLength('Cl-Cl') / 2

const R = {
  na: speciesRadius('Na', 0),
  naIon: speciesRadius('Na', 1),
  cl: speciesRadius('Cl', 0),
  clIon: speciesRadius('Cl', -1),
} as const

/** Ионы решётки: доля радиуса как у героя (LATTICE_BALL_SCALE) — сквозь фрагмент видны рёбра ячеек. */
const R_LATTICE = {
  naIon: speciesRadius('Na', 1, LATTICE_BALL_SCALE),
  clIon: speciesRadius('Cl', -1, LATTICE_BALL_SCALE),
} as const

/** Зазор валентных точек над поверхностью атома (параметр рисунка, не химия). */
const DOT_GAP = 0.07

/**
 * Плоскость действия шагов 1–4 — передняя грань будущего фрагмента (z = +a):
 * пары встают прямо в узлы передней грани, решётка достраивается за ними.
 */
const STAGE_Z = 2 * H

export const NACL_GEOM = {
  radius: R,
  latticeRadius: R_LATTICE,
  /** доля радиуса шаров решётки */
  latticeScale: LATTICE_BALL_SCALE,
  /** d(Na⁺–Cl⁻) в решётке, мировые единицы */
  latticeNaCl: H,
  /** r_e газовой пары NaCl, мировые единицы */
  gasNaCl: D_GAS,
  cell: 2 * H,
  clHalf: CH,
  stageZ: STAGE_Z,
  data: {
    spaceGroup: SALT.spaceGroup,
    spaceGroupNo: SALT.spaceGroupNo,
    latticeType: SALT.latticeType,
    cellPm: SALT.cellPm.a,
    naClPm: SALT.cationAnionPm,
    gasNaClPm: bondLengthPm('Na-Cl'),
    clClPm: bondLengthPm('Cl-Cl'),
    coordination: SALT.coordination,
    z: SALT.z,
    densityGCm3: SALT.densityGCm3,
    metal: { spaceGroup: METAL.spaceGroup, cellPm: METAL.cellPm.a, nnPm: METAL.cationAnionPm, coordination: METAL.coordination },
  },
} as const

/** Масштаб рига камеры. */
export const NACL_RIG_SCALE = 1.15

// ─────────────────────────────────────────────────────────────────────────────
// Состав кадра: атомы, их шаги и подписи
// ─────────────────────────────────────────────────────────────────────────────

export type NaclElement = 'Na' | 'Cl'
export type NaclAtomKind = 'story' | 'metal' | 'lattice'

export type NaclAtomDef = {
  id: string
  el: NaclElement
  kind: NaclAtomKind
  /** индексы шагов [первый, последний], на которых атом имеет право быть видимым */
  span: readonly [number, number]
}

const T = {
  sub1: naclCueAt('sublimate'),
  sub2: naclCueAt('sublimate') + 0.4,
  brk: naclCueAt('bondBreak'),
  contact: naclCueAt('contact'),
  lattice: naclCueAt('lattice'),
  e1: NACL_ELECTRONS.e1,
  e2: NACL_ELECTRONS.e2,
}

const stepFrom = (i: number) => NACL_STEPS[i]!.from
const stepTo = (i: number) => NACL_STEPS[i]!.to
const LAST_STEP = NACL_STEPS.length - 1

/** Индекс узла фрагмента по координатам в единицах a/2 (центр фрагмента — Na в (0,0,0)). */
function saltSiteAt(i: number, j: number, k: number): number {
  const idx = SALT_FRAG.sites.findIndex(
    (s) => Math.round(s.posScene[0] / H) === i && Math.round(s.posScene[1] / H) === j && Math.round(s.posScene[2] / H) === k,
  )
  if (idx < 0) throw new Error(`nacl: нет узла (${i}, ${j}, ${k}) во фрагменте`)
  return idx
}

/** Узлы передней грани, куда встают пары сюжета: Na слева, Cl справа, как в газовой паре. */
const STORY_SITE = {
  na1: saltSiteAt(-1, 1, 2),
  clA: saltSiteAt(0, 1, 2),
  na2: saltSiteAt(-1, -1, 2),
  clB: saltSiteAt(0, -1, 2),
} as const

/** Атомы металла: na1/na2 — вершины со стороны хлора (x > 0, спереди), остальные — M0…M6. */
function metalSite(sx: number, sy: number, sz: number): number {
  const idx = METAL_FRAG.sites.findIndex(
    (s) => Math.sign(Math.round(s.posScene[0] * 1e6)) === sx && Math.sign(Math.round(s.posScene[1] * 1e6)) === sy && Math.sign(Math.round(s.posScene[2] * 1e6)) === sz,
  )
  if (idx < 0) throw new Error('nacl: нет вершины ОЦК-ячейки')
  return idx
}
const METAL_NA1 = metalSite(1, 1, 1)
const METAL_NA2 = metalSite(1, -1, 1)
const METAL_REST = METAL_FRAG.sites.map((_, i) => i).filter((i) => i !== METAL_NA1 && i !== METAL_NA2)

const STORY_IDS = ['na1', 'na2', 'clA', 'clB'] as const
type StoryId = (typeof STORY_IDS)[number]
const STORY_SET = new Set<number>(Object.values(STORY_SITE))
const LATTICE_REST = SALT_FRAG.sites.map((_, i) => i).filter((i) => !STORY_SET.has(i))

export const NACL_ATOMS: readonly NaclAtomDef[] = [
  { id: 'na1', el: 'Na', kind: 'story', span: [0, LAST_STEP] },
  { id: 'na2', el: 'Na', kind: 'story', span: [0, LAST_STEP] },
  { id: 'clA', el: 'Cl', kind: 'story', span: [0, LAST_STEP] },
  { id: 'clB', el: 'Cl', kind: 'story', span: [0, LAST_STEP] },
  ...METAL_REST.map((_, k) => ({ id: `M${k}`, el: 'Na' as NaclElement, kind: 'metal' as const, span: [0, 1] as const })),
  ...LATTICE_REST.map((si, k) => ({
    id: `L${k}`,
    el: SALT_FRAG.sites[si]!.el as NaclElement,
    kind: 'lattice' as const,
    span: [4, LAST_STEP] as const,
  })),
]

export const NACL_ATOM_INDEX: ReadonlyMap<string, number> = new Map(NACL_ATOMS.map((a, i) => [a.id, i]))
const IDX = (id: string) => NACL_ATOM_INDEX.get(id)!
const I_NA1 = IDX('na1')
const I_NA2 = IDX('na2')
const I_CLA = IDX('clA')
const I_CLB = IDX('clB')
const METAL_IDS = NACL_ATOMS.filter((a) => a.kind === 'metal').map((a) => a.id)
const LATTICE_IDS = NACL_ATOMS.filter((a) => a.kind === 'lattice').map((a) => a.id)

/** Индекс узла фрагмента соли для атома кадра (story + lattice). */
export const SALT_SITE_OF: ReadonlyMap<string, number> = new Map<string, number>([
  ['na1', STORY_SITE.na1],
  ['na2', STORY_SITE.na2],
  ['clA', STORY_SITE.clA],
  ['clB', STORY_SITE.clB],
  ...LATTICE_REST.map((si, k) => [`L${k}`, si] as [string, number]),
])

/** Индекс узла ячейки металла для атома кадра (металл + два атома сюжета). */
export const METAL_SITE_OF: ReadonlyMap<string, number> = new Map<string, number>([
  ['na1', METAL_NA1],
  ['na2', METAL_NA2],
  ...METAL_REST.map((si, k) => [`M${k}`, si] as [string, number]),
])

/** Металлические связи ОЦК: центр — восемь вершин (связи фрагмента = первая сфера, КЧ 8). */
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

/** Центр ячейки металла (слева) и молекулы хлора (справа) на шаге 1. */
const METAL_CENTER: V3 = [-1.45, 0, STAGE_Z]
const CL2_CENTER: V3 = [1.45, 0, STAGE_Z]
/** Сдвиг рёбер ячейки металла в кадре (слой CinemaCellEdges). */
export const NACL_METAL_OFFSET = METAL_CENTER

const metalPos = (si: number): V3 => add(METAL_CENTER, METAL_FRAG.sites[si]!.posScene)
const saltPos = (si: number): V3 => SALT_FRAG.sites[si]!.posScene

/** Свободные атомы после сублимации/диссоциации — перед переходом электрона. */
const FREE: Record<StoryId, V3> = {
  na1: [-1.05, H, STAGE_Z],
  na2: [-1.05, -H, STAGE_Z],
  clA: [0.75, H, STAGE_Z],
  clB: [0.75, -H, STAGE_Z],
}

/**
 * Газовые пары: середина пары совпадает с серединой её будущих узлов решётки,
 * Na⁺ и Cl⁻ на r_e(NaCl, г.) — на шаге 5 пара только «раздвигается» до a/2.
 */
function gasPos(na: StoryId, cl: StoryId, which: 'na' | 'cl'): V3 {
  const a = saltPos(STORY_SITE[na as 'na1'])
  const b = saltPos(STORY_SITE[cl as 'clA'])
  const mid = scale(add(a, b), 0.5)
  const dir = scale(add(b, scale(a, -1)), 1 / H)
  return add(mid, scale(dir, (which === 'na' ? -0.5 : 0.5) * D_GAS))
}
const GAS: Record<StoryId, V3> = {
  na1: gasPos('na1', 'clA', 'na'),
  clA: gasPos('na1', 'clA', 'cl'),
  na2: gasPos('na2', 'clB', 'na'),
  clB: gasPos('na2', 'clB', 'cl'),
}

const T_MOVE_LATTICE = { from: stepFrom(4) + 0.3, to: stepFrom(4) + 1.9 }
const T_PAIR = { from: stepFrom(3) + 0.4, to: T.contact }

/**
 * МАСШТАБ ШАРОВ частиц сюжета относительно SPECIES_SCALE (параметр рисунка, не химия).
 * Шаг 4: полный радиус Шеннона (×1/SPECIES_SCALE) — сумма 102 + 181 больше r_e газовой пары, и
 * перекрытие сфер видно честно (закон «Химия»: рисовать перекрытие, расстояние не подгонять).
 * Шаг 5: пары расходятся до a/2, шары сжимаются до доли решётки — к ионам фрагмента.
 * Отношения радиусов в любой кадр одни и те же; скачков нет (плавная дорожка).
 */
export const NACL_DRAW_SCALE: ScalarTrack = [
  { t: stepFrom(3), v: 1 },
  { t: T_PAIR.from + 0.8, v: 1 / SPECIES_SCALE, ease: 'smooth' },
  { t: T_MOVE_LATTICE.from, v: 1 / SPECIES_SCALE },
  { t: T_MOVE_LATTICE.to, v: LATTICE_BALL_SCALE / SPECIES_SCALE, ease: 'smooth' },
]

const POS: Record<string, Vec3Track> = {
  na1: [
    { t: 0, v: metalPos(METAL_NA1) },
    { t: T.sub1 - 0.3, v: metalPos(METAL_NA1) },
    { t: T.sub1 + 1.5, v: FREE.na1, ease: 'smooth', arc: 0.2 },
    { t: T_PAIR.from, v: FREE.na1 },
    { t: T_PAIR.to, v: GAS.na1, ease: 'smooth' },
    { t: T_MOVE_LATTICE.from, v: GAS.na1 },
    { t: T_MOVE_LATTICE.to, v: saltPos(STORY_SITE.na1), ease: 'smooth' },
  ],
  na2: [
    { t: 0, v: metalPos(METAL_NA2) },
    { t: T.sub2 - 0.3, v: metalPos(METAL_NA2) },
    { t: T.sub2 + 1.5, v: FREE.na2, ease: 'smooth', arc: -0.2 },
    { t: T_PAIR.from, v: FREE.na2 },
    { t: T_PAIR.to, v: GAS.na2, ease: 'smooth' },
    { t: T_MOVE_LATTICE.from, v: GAS.na2 },
    { t: T_MOVE_LATTICE.to, v: saltPos(STORY_SITE.na2), ease: 'smooth' },
  ],
  clA: [
    { t: 0, v: add(CL2_CENTER, [0, CH, 0]) },
    { t: T.brk - 1.4, v: add(CL2_CENTER, [0, CH, 0]) },
    { t: T.brk, v: add(CL2_CENTER, [0, CH + 0.05, 0]), ease: 'inQuad' },
    { t: T.brk + 1.3, v: FREE.clA, ease: 'smooth' },
    { t: T_PAIR.from, v: FREE.clA },
    { t: T_PAIR.to, v: GAS.clA, ease: 'smooth' },
    { t: T_MOVE_LATTICE.from, v: GAS.clA },
    { t: T_MOVE_LATTICE.to, v: saltPos(STORY_SITE.clA), ease: 'smooth' },
  ],
  clB: [
    { t: 0, v: add(CL2_CENTER, [0, -CH, 0]) },
    { t: T.brk - 1.4, v: add(CL2_CENTER, [0, -CH, 0]) },
    { t: T.brk, v: add(CL2_CENTER, [0, -CH - 0.05, 0]), ease: 'inQuad' },
    { t: T.brk + 1.3, v: FREE.clB, ease: 'smooth' },
    { t: T_PAIR.from, v: FREE.clB },
    { t: T_PAIR.to, v: GAS.clB, ease: 'smooth' },
    { t: T_MOVE_LATTICE.from, v: GAS.clB },
    { t: T_MOVE_LATTICE.to, v: saltPos(STORY_SITE.clB), ease: 'smooth' },
  ],
}

/** Остальной металл уходит влево и гаснет ПОЛНОСТЬЮ до конца шага 2 — без призраков. */
const METAL_EXIT: V3 = [-0.6, 0, 0]
const T_METAL_OUT = { from: T.sub2 + 0.3, to: stepTo(1) - 0.4 }
METAL_IDS.forEach((id, k) => {
  const p = metalPos(METAL_REST[k]!)
  POS[id] = [
    { t: 0, v: p },
    { t: T_METAL_OUT.from, v: p },
    { t: T_METAL_OUT.to, v: add(p, METAL_EXIT), ease: 'inQuad' },
  ]
})

/**
 * Рост кристалла: 121 ион подлетает к узлам радиально (от центра пар сюжета наружу — внутрь),
 * ближние раньше. Каждый ион вырастает из точки за 0,7 с в начале своего полёта; все стоят на местах
 * задолго до паузы шага 5.
 */
const GROW = { from: stepFrom(4) + 0.8, to: T.lattice - 1.4, flight: 1.2, appear: 0.7, reach: 0.9 }
const STORY_CENTROID: V3 = scale(
  add(add(saltPos(STORY_SITE.na1), saltPos(STORY_SITE.clA)), add(saltPos(STORY_SITE.na2), saltPos(STORY_SITE.clB))),
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

/**
 * РАДИУС, ЗАРЯД И МАТЕРИАЛ МЕНЯЮТСЯ СТУПЕНЬЮ, без промежуточных кадров:
 * у донора — в кадр УХОДА электрона (Na → Na⁺ + e⁻: катион рождается в момент отрыва, это ступень
 * ионизации лестницы), у акцептора — в кадр ПРИХОДА (Cl + e⁻ → Cl⁻). Пока электрон летит,
 * в кадре Na⁺ + e⁻ + Cl — сумма зарядов 0.
 */
export const NACL_SNAP = {
  radiusNa1: octetSnap(T.e1.leave, R.na, R.naIon),
  radiusNa2: octetSnap(T.e2.leave, R.na, R.naIon),
  radiusClA: octetSnap(T.e1.arrive, R.cl, R.clIon),
  radiusClB: octetSnap(T.e2.arrive, R.cl, R.clIon),
  chargeNa1: octetSnap(T.e1.leave, 0, 1),
  chargeNa2: octetSnap(T.e2.leave, 0, 1),
  chargeClA: octetSnap(T.e1.arrive, 0, -1),
  chargeClB: octetSnap(T.e2.arrive, 0, -1),
} as const

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
/** Металлические связи уходят раньше атомов — ячейка распадается, когда атомы её покидают. */
const METAL_BOND: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.8, v: 1, ease: 'smooth' },
  { t: stepTo(0), v: 1 },
  { t: T.sub1, v: 0, ease: 'smooth' },
]

/** Связь Cl–Cl: натяжение, затем ГОМОЛИТИЧЕСКИЙ разрыв (split = 0 в сцене). */
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

/** Рёбра ячеек: сначала ячейка металла (шаг 1), потом ячейки соли (шаг 5 → финал). */
const METAL_EDGES: ScalarTrack = [
  { t: 0.2, v: 0 },
  { t: 1.0, v: 1, ease: 'smooth' },
  { t: stepTo(0), v: 1 },
  { t: T.sub1 - 0.1, v: 0, ease: 'smooth' },
]
const SALT_EDGES: ScalarTrack = [
  { t: T.lattice - 0.8, v: 0 },
  { t: T.lattice, v: 1, ease: 'smooth' },
  { t: NACL_FINISH.from, v: 1 },
  { t: NACL_FINISH.to, v: 0, ease: 'smooth' },
]
/** С какого момента пул рёбер держит ячейки соли (в этот момент обе дорожки = 0). */
export const EDGE_SWITCH_T = stepFrom(2)

/**
 * Валентные облака: Na — одна точка 3s¹, Cl — семь, после прихода — октет. Загораются ещё в конце
 * шага 2 — на паузе перед переносом ученик видит «до» (1 и 7 точек), на паузе шага 3 — «после».
 */
const VALENCE_WIN = { from: stepTo(1) - 0.9, clOff: stepFrom(3) + 1.0 }
const ELECTRON_LEAD = 0.6

/** Линии поля газовых пар (шаг 4) — видны и на паузе шага, гаснут, когда пары раздвигаются. */
const FIELD_WIN: readonly [number, number] = [stepFrom(3) + 0.2, T_MOVE_LATTICE.to - 0.4]

const FADE = fadeTrack(NACL_FINISH)

/**
 * Камера — планы (kit/camera): общий план реагентов, наезд на электроны, крупно пары,
 * отъезд на решётку и медленный облёт на финале.
 */
export const NACL_CAMERA: ShotTrack = shotTrack([
  { t: 0, zoom: 0.76, target: [-0.4, 0, STAGE_Z] },
  { t: stepTo(0), zoom: 0.78 },
  { t: stepFrom(1) + 3.4, zoom: 0.98, target: [-0.15, 0, STAGE_Z] },
  { t: stepTo(2), zoom: 1.0 },
  { t: T.contact, zoom: 1.12, target: [-H / 2, 0, STAGE_Z] },
  { t: stepTo(3), zoom: 1.12 },
  { t: T.lattice - 1.2, zoom: 0.7, yaw: 0.32, pitch: 0.22, target: [0, 0, 0] },
  ...orbitTrack(stepFrom(5), stepTo(5), 0.32, 0.8, 0.22, 0.7),
])

const BASE_EMISSIVE = 0.08
const BASE_BLOOM = 0.3

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D — только формулы, заряды, числа и символы единиц (токены)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * anchor — к чему привязана подпись; hosts — какие атомы она подписывает (для закона
 * «каждый видимый объект подписан»: тест требует у каждого видимого атома видимую подпись-хозяина).
 */
export type NaclLabelDef = SceneLabelDef & {
  anchor: 'atom' | 'metal' | 'metalEdge' | 'cl2' | 'clBond' | 'pair' | 'pairFront' | 'electron1' | 'electron2' | 'edgeA' | 'cubeAbove' | 'cubeBelow'
  atom?: string
  /** сдвиг по X (подписи над кубом в одну строку) */
  dx?: number
  hosts: readonly string[]
}

const fmt1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1)
const signed = (v: number) => (v < 0 ? `−${fmt1(-v)}` : `+${fmt1(v)}`)

const W_LABEL_STORY_END = T_MOVE_LATTICE.to + 0.6

export const NACL_LABELS: readonly NaclLabelDef[] = [
  // Шаг 1: металл и молекула
  { id: 'metal', kind: 'species', anchor: 'metal', dy: 1.15, keys: [{ t: 0, text: 'Na ({s})' }], windows: [[0.2, T_METAL_OUT.to]], hosts: [...METAL_IDS, 'na1', 'na2'] },
  { id: 'metalA', kind: 'measure', anchor: 'metalEdge', dy: -0.95, keys: [{ t: 0, text: METAL_CAPTION[0]! }], windows: [[0.6, T.sub1]], hosts: [] },
  { id: 'cl2', kind: 'species', anchor: 'cl2', dy: 0.62, keys: [{ t: 0, text: 'Cl₂ ({g})' }], windows: [[0.2, T.brk]], hosts: ['clA', 'clB'] },
  { id: 'clBond', kind: 'measure', anchor: 'clBond', dy: 0, keys: [{ t: 0, text: `${fmt1(bondLengthPm('Cl-Cl'))} {pm}` }], windows: [[0.6, T.brk - 0.3]], hosts: [] },
  // Шаги 2–4: частицы сюжета; Na → Na⁺ в кадр ухода электрона, Cl → Cl⁻ в кадр прихода
  { id: 'na1', kind: 'species', anchor: 'atom', atom: 'na1', dy: 0.16, keys: [{ t: 0, text: 'Na ({g})' }, { t: T.e1.leave, text: 'Na⁺' }], windows: [[T.sub1, W_LABEL_STORY_END]], hosts: ['na1'] },
  { id: 'na2', kind: 'species', anchor: 'atom', atom: 'na2', dy: -0.16, keys: [{ t: 0, text: 'Na ({g})' }, { t: T.e2.leave, text: 'Na⁺' }], windows: [[T.sub2, W_LABEL_STORY_END]], hosts: ['na2'] },
  { id: 'clA', kind: 'species', anchor: 'atom', atom: 'clA', dy: 0.16, keys: [{ t: 0, text: 'Cl ({g})' }, { t: T.e1.arrive, text: 'Cl⁻' }], windows: [[T.brk, W_LABEL_STORY_END]], hosts: ['clA'] },
  { id: 'clB', kind: 'species', anchor: 'atom', atom: 'clB', dy: -0.16, keys: [{ t: 0, text: 'Cl ({g})' }, { t: T.e2.arrive, text: 'Cl⁻' }], windows: [[T.brk, W_LABEL_STORY_END]], hosts: ['clB'] },
  { id: 'e1', kind: 'token', anchor: 'electron1', dy: 0.2, keys: [{ t: 0, text: 'e⁻' }], windows: [[T.e1.leave - ELECTRON_LEAD, T.e1.arrive + 0.15]], hosts: [] },
  { id: 'e2', kind: 'token', anchor: 'electron2', dy: -0.2, keys: [{ t: 0, text: 'e⁻' }], windows: [[T.e2.leave - ELECTRON_LEAD, T.e2.arrive + 0.15]], hosts: [] },
  // Шаг 4: газовая пара — r_e(NaCl, г.)
  { id: 'dGas', kind: 'measure', anchor: 'pair', dy: -0.55, keys: [{ t: 0, text: `${fmt1(bondLengthPm('Na-Cl'))} {pm}` }], windows: [[T.contact - 0.8, T_MOVE_LATTICE.from + 0.5]], hosts: [] },
  // Шаг 5: та же пара в решётке — d(Na⁺–Cl⁻) = a/2
  { id: 'dCrystal', kind: 'measure', anchor: 'pairFront', dy: 0, keys: [{ t: 0, text: `${fmt1(SALT.cationAnionPm)} {pm}` }], windows: [[T_MOVE_LATTICE.to - 0.2, stepFrom(5) + 1.2]], hosts: [] },
  { id: 'cellA', kind: 'measure', anchor: 'edgeA', dy: -0.34, keys: [{ t: 0, text: SALT_CAPTION[0]! }], windows: [[T.lattice - 0.6, NACL_END]], hosts: [] },
  // Группа и КЧ — одной строкой НАД кубом (под кубом их прижимала к панели реактора раскладка подписей).
  { id: 'sg', kind: 'token', anchor: 'cubeAbove', dy: 0.42, dx: -0.6, keys: [{ t: 0, text: SALT_CAPTION[1]! }], windows: [[T.lattice - 0.4, NACL_END]], hosts: [] },
  { id: 'cn', kind: 'token', anchor: 'cubeAbove', dy: 0.42, dx: 0.6, keys: [{ t: 0, text: SALT_CAPTION[2]! }], windows: [[T.lattice - 0.2, NACL_END]], hosts: [] },
  { id: 'nacl', kind: 'species', anchor: 'cubeAbove', dy: 1.5, keys: [{ t: 0, text: 'NaCl ({s})' }], windows: [[GROW.from + 1.2, NACL_END]], hosts: [...LATTICE_IDS, ...STORY_IDS] },
  // Шаг 6: итог из цикла Борна — Габера (число из ядра, не строкой)
  { id: 'dH', kind: 'measure', anchor: 'cubeAbove', dy: 0.9, keys: [{ t: 0, text: `ΔH°f = ${signed(NACL_DHF_KJ)} {kJmol}` }], windows: [[stepFrom(5) + 0.4, NACL_END]], hosts: [] },
]

export type NaclLabelState = SceneLabelState

/**
 * Ребро ячейки для подписи a: НИЖНЕЕ переднее ребро первой ячейки вдоль x. Камера смотрит на
 * кристалл сверху, поэтому под нижним передним ребром — пустое поле вне силуэта фрагмента:
 * размерная линия и подпись не ложатся на сферы (приёмка: «a = 564» лежала на Cl⁻).
 */
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

export const NACL_EDGE_A = EDGE_A
/** Размерная линия a: на этом расстоянии под ребром (снаружи сфер нижнего ряда), мировые единицы. */
export const NACL_DIM_A_DROP = R_LATTICE.clIon + 0.12

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type NaclValence = { center: THREE.Vector3; radius: number; count: number; amount: number; highlight: number }

export type NaclFrame = {
  t: number
  pos: THREE.Vector3[]
  radius: Float32Array
  charge: Float32Array
  opacity: Float32Array
  emissive: Float32Array
  material: SubstanceKind[]
  /** связь Cl–Cl */
  bond: { stress: number; thinning: number; opacity: number }
  /** металлические связи ОЦК (0…1) */
  metalBond: number
  /** какой набор рёбер ячеек в пуле и его прозрачность */
  edgeSet: 'metal' | 'salt'
  edges: number
  electrons: [ElectronJump, ElectronJump]
  /** валентные облака: na1, na2, clA, clB */
  valence: [NaclValence, NaclValence, NaclValence, NaclValence]
  /** амплитуды эффектов (тест: в финале все 0) */
  fx: { electron1: number; electron2: number; field: number }
  /** размерные линии (видимость = видимость их подписей): пара Na⁺–Cl⁻ в решётке и ребро a */
  dims: { pair: number; edgeA: number }
  /** множитель масштаба шаров частиц сюжета относительно SPECIES_SCALE (NACL_DRAW_SCALE) */
  drawScale: number
  labels: NaclLabelState[]
  camera: SceneCamera
  fade: number
}

const VIEW = new THREE.Vector3(0, 0, 1)

function createValence(): NaclValence {
  return { center: new THREE.Vector3(), radius: 0, count: 0, amount: 0, highlight: -1 }
}

export function createNaclFrame(): NaclFrame {
  const n = NACL_ATOMS.length
  return {
    t: 0,
    pos: NACL_ATOMS.map(() => new THREE.Vector3()),
    radius: new Float32Array(n),
    charge: new Float32Array(n),
    opacity: new Float32Array(n),
    emissive: new Float32Array(n).fill(BASE_EMISSIVE),
    material: NACL_ATOMS.map(() => 'default' as SubstanceKind),
    bond: { stress: 0, thinning: 0, opacity: 0 },
    metalBond: 0,
    edgeSet: 'metal',
    edges: 0,
    electrons: [createElectronJump('e1'), createElectronJump('e2')],
    valence: [createValence(), createValence(), createValence(), createValence()],
    fx: { electron1: 0, electron2: 0, field: 0 },
    dims: { pair: 0, edgeA: 0 },
    drawScale: 1,
    labels: createLabelStates(NACL_LABELS),
    camera: createSceneCamera(),
    fade: 0,
  }
}

/** Кадр, для которого сейчас считаются подписи (anchorLabel — модульная функция, без замыканий в кадре). */
let _cur: NaclFrame | null = null

function anchorLabel(def: SceneLabelDef, st: SceneLabelState): void {
  const f = _cur!
  const d = def as NaclLabelDef
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
    case 'cl2':
      st.pos.copy(p[I_CLA]!).lerp(p[I_CLB]!, 0.5)
      st.pos.y += d.dy
      return
    case 'clBond':
      st.pos.copy(p[I_CLA]!).lerp(p[I_CLB]!, 0.5)
      st.pos.x += R.cl + 0.42
      return
    case 'pair':
      st.pos.copy(p[I_NA1]!).lerp(p[I_CLA]!, 0.5)
      st.pos.y += d.dy
      return
    case 'pairFront':
      // Пара на передней грани: подпись на размерной линии пары, перед сферами (линию рисует сцена).
      st.pos.copy(p[I_NA1]!).lerp(p[I_CLA]!, 0.5)
      st.pos.z += f.radius[I_CLA]! + 0.08
      return
    case 'electron1':
      st.pos.copy(f.electrons[0].pos)
      st.pos.y += d.dy
      return
    case 'electron2':
      st.pos.copy(f.electrons[1].pos)
      st.pos.y += d.dy
      return
    case 'edgeA':
      // Под размерной линией a (она на NACL_DIM_A_DROP ниже ребра).
      st.pos.set((EDGE_A[0][0] + EDGE_A[1][0]) / 2, (EDGE_A[0][1] + EDGE_A[1][1]) / 2 - NACL_DIM_A_DROP + d.dy, (EDGE_A[0][2] + EDGE_A[1][2]) / 2)
      return
    // Над и под кубом на вертикальной оси: при облёте (yaw) подписи не ездят по кадру.
    case 'cubeAbove':
      st.pos.set(d.dx ?? 0, SALT_FRAG.boundsScene.max[1] + d.dy, 0)
      return
    case 'cubeBelow':
      st.pos.set(0, SALT_FRAG.boundsScene.min[1] + d.dy, 0)
      return
  }
}

const TRACKS: (Vec3Track | undefined)[] = NACL_ATOMS.map((a) => POS[a.id])
const L_DCRYSTAL = NACL_LABELS.findIndex((l) => l.id === 'dCrystal')
const L_CELLA = NACL_LABELS.findIndex((l) => l.id === 'cellA')
const STORY_INDEX = [I_NA1, I_NA2, I_CLA, I_CLB] as const
const DETACH = [T.sub1 - 0.3, T.sub2 - 0.3] as const

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleNaclFrame(t: number, frame: NaclFrame): NaclFrame {
  frame.t = t
  const { pos, radius, charge, opacity, material, emissive } = frame

  for (let i = 0; i < NACL_ATOMS.length; i++) {
    const tr = TRACKS[i]
    if (tr) sampleVec3(tr, t, pos[i]!)
    emissive[i] = BASE_EMISSIVE
  }

  // ——— Атомы сюжета: радиус/заряд/материал ступенью (Na — уход e⁻, Cl — приход), масштаб шаров — дорожкой ———
  const appear = sampleScalar(APPEAR, t)
  const k = sampleScalar(NACL_DRAW_SCALE, t)
  frame.drawScale = k
  radius[I_NA1] = sampleScalar(NACL_SNAP.radiusNa1, t) * k
  radius[I_NA2] = sampleScalar(NACL_SNAP.radiusNa2, t) * k
  radius[I_CLA] = sampleScalar(NACL_SNAP.radiusClA, t) * k
  radius[I_CLB] = sampleScalar(NACL_SNAP.radiusClB, t) * k
  charge[I_NA1] = sampleScalar(NACL_SNAP.chargeNa1, t)
  charge[I_NA2] = sampleScalar(NACL_SNAP.chargeNa2, t)
  charge[I_CLA] = sampleScalar(NACL_SNAP.chargeClA, t)
  charge[I_CLB] = sampleScalar(NACL_SNAP.chargeClB, t)
  for (let s = 0; s < 4; s++) opacity[STORY_INDEX[s]!] = appear
  material[I_NA1] = t < DETACH[0] ? 'metal' : t < T.e1.leave ? 'gas' : 'ion'
  material[I_NA2] = t < DETACH[1] ? 'metal' : t < T.e2.leave ? 'gas' : 'ion'
  material[I_CLA] = t < T.e1.arrive ? 'gas' : 'ion'
  material[I_CLB] = t < T.e2.arrive ? 'gas' : 'ion'

  // ——— Металл: ячейка ОЦК, затем уходит и гаснет полностью ———
  const metalA = sampleScalar(METAL_OPACITY, t)
  for (let i = 4; i < 4 + METAL_IDS.length; i++) {
    radius[i] = R.na
    charge[i] = 0
    opacity[i] = metalA
    material[i] = 'metal'
  }
  frame.metalBond = sampleScalar(METAL_BOND, t)

  // ——— Решётка: готовые Na⁺ / Cl⁻, проявляются в начале своего подлёта ———
  const base = 4 + METAL_IDS.length
  for (let k = 0; k < LATTICE_IDS.length; k++) {
    const i = base + k
    const na = NACL_ATOMS[i]!.el === 'Na'
    const a = LATTICE_TIMES[k]!
    // Проявление = рост шара из точки вместе с непрозрачностью: полупрозрачный «растровый»
    // шар полного размера читался бы как призрак, а маленький почти не виден.
    const grow = t <= a ? 0 : smoothstep(a, a + GROW.appear, t)
    radius[i] = (na ? R_LATTICE.naIon : R_LATTICE.clIon) * grow
    charge[i] = na ? 1 : -1
    material[i] = 'ion'
    // Растровая прозрачность только пока шар меньше трети размера — дальше он уже непрозрачный.
    opacity[i] = grow * 3 >= 1 ? 1 : grow * 3
  }

  // ——— Связь Cl–Cl ———
  frame.bond.stress = sampleScalar(BOND_STRESS, t)
  frame.bond.thinning = sampleScalar(BOND_THIN, t)
  frame.bond.opacity = sampleScalar(BOND_OPACITY, t)

  // ——— Рёбра ячеек ———
  if (t < EDGE_SWITCH_T) {
    frame.edgeSet = 'metal'
    frame.edges = sampleScalar(METAL_EDGES, t)
  } else {
    frame.edgeSet = 'salt'
    frame.edges = sampleScalar(SALT_EDGES, t)
  }

  // ——— Электроны: 3s¹ натрия достраивает октет хлора ———
  const a1 = sampleElectronJump(frame.electrons[0], t, {
    donor: pos[I_NA1]!,
    acceptor: pos[I_CLA]!,
    shellRadius: R.na + DOT_GAP,
    acceptorRadius: radius[I_CLA]!,
    leave: T.e1.leave,
    arrive: T.e1.arrive,
    arcSign: 1,
    lead: ELECTRON_LEAD,
    view: VIEW,
  })
  const a2 = sampleElectronJump(frame.electrons[1], t, {
    donor: pos[I_NA2]!,
    acceptor: pos[I_CLB]!,
    shellRadius: R.na + DOT_GAP,
    acceptorRadius: radius[I_CLB]!,
    leave: T.e2.leave,
    arrive: T.e2.arrive,
    arcSign: -1,
    lead: ELECTRON_LEAD,
    view: VIEW,
  })
  frame.fx.electron1 = frame.electrons[0].opacity
  frame.fx.electron2 = frame.electrons[1].opacity

  // ——— Валентные облака: count = valenceElectrons − charge (из ядра) ———
  writeValence(frame.valence[0], pos[I_NA1]!, 'Na', charge[I_NA1]!, radius[I_NA1]!, t, T.e1.leave - ELECTRON_LEAD, a1, T.e1.arrive)
  writeValence(frame.valence[1], pos[I_NA2]!, 'Na', charge[I_NA2]!, radius[I_NA2]!, t, T.e2.leave - ELECTRON_LEAD, a2, T.e2.arrive)
  writeValence(frame.valence[2], pos[I_CLA]!, 'Cl', charge[I_CLA]!, radius[I_CLA]!, t, VALENCE_WIN.clOff, a1, T.e1.arrive)
  writeValence(frame.valence[3], pos[I_CLB]!, 'Cl', charge[I_CLB]!, radius[I_CLB]!, t, VALENCE_WIN.clOff, a2, T.e2.arrive)

  // ——— Шаг 4: линии поля (ионная связь — без «палочки») ———
  frame.fx.field = windowFade(FIELD_WIN, t, 0.5)

  frame.fade = sampleScalar(FADE, t)

  // ——— Подписи ———
  _cur = frame
  sampleLabels(NACL_LABELS, frame.labels, t, anchorLabel, frame.fade)
  _cur = null
  frame.dims.pair = frame.labels[L_DCRYSTAL]!.opacity
  frame.dims.edgeA = frame.labels[L_CELLA]!.opacity

  // ——— Камера ———
  const cam = frame.camera
  sampleShot(NACL_CAMERA, t, cam)
  cam.shake = 0
  cam.bloom = BASE_BLOOM + 0.15 * Math.max(frame.electrons[0].glow * frame.fx.electron1, frame.electrons[1].glow * frame.fx.electron2)
  cam.vignette = Math.max(0.3, frame.fade)
  return frame
}

const LATTICE_TIMES: readonly number[] = LATTICE_IDS.map((id) => LATTICE_ARRIVAL.get(id)!.start)

/**
 * Облако валентных электронов частицы: у Na до ухода — одна точка (3s¹), у Cl — семь;
 * в кадр прихода электрона у Cl становится восемь (новая точка подсвечена), у Na⁺ — ноль
 * (внешний слой ушёл целиком, заполненный слой 2s²2p⁶ не рисуем).
 */
function writeValence(
  v: NaclValence,
  center: THREE.Vector3,
  el: ElementSymbol,
  charge: number,
  radius: number,
  t: number,
  offAt: number,
  arrived: boolean,
  arrive: number,
): void {
  v.center.copy(center)
  v.radius = radius + DOT_GAP
  const count = ATOMIC_DATA[el].valenceElectrons - Math.round(charge)
  v.count = count >= 8 ? 8 : count <= 0 ? 0 : count
  if (charge > 0) v.count = 0
  const on = smoothstep(VALENCE_WIN.from, VALENCE_WIN.from + 0.5, t)
  const off = 1 - smoothstep(offAt - 0.5, offAt, t)
  v.amount = v.count > 0 ? on * off : 0
  v.highlight = arrived && charge < 0 && t < arrive + 1.2 ? 7 : -1
}

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validateNaclStoryboard(): void {
  const vec: Record<string, Vec3Track> = {}
  for (const [id, track] of Object.entries(POS)) vec[`pos.${id}`] = track
  vec['cam.offset'] = NACL_CAMERA.offset
  validateTracks(vec)
  validateTracks({
    ...NACL_SNAP,
    NACL_DRAW_SCALE,
    APPEAR,
    METAL_OPACITY,
    METAL_BOND,
    BOND_STRESS,
    BOND_THIN,
    BOND_OPACITY,
    METAL_EDGES,
    SALT_EDGES,
    FADE,
    camZoom: NACL_CAMERA.zoom,
    camYaw: NACL_CAMERA.yaw,
    camPitch: NACL_CAMERA.pitch,
  })

  if (SALT_FRAG.sites.length !== 125) throw new Error(`nacl: фрагмент 2×2×2 обязан содержать 125 ионов, а не ${SALT_FRAG.sites.length}`)
  if (METAL_FRAG.sites.length !== 9) throw new Error(`nacl: ячейка ОЦК — 9 атомов, а не ${METAL_FRAG.sites.length}`)
  if (METAL_BONDS.length !== METAL.coordination.Na) throw new Error(`nacl: у центра ОЦК ${METAL_BONDS.length} связей, КЧ ${METAL.coordination.Na}`)
  if (NACL_ATOMS.length !== 4 + 7 + 121) throw new Error(`nacl: в кадре ${NACL_ATOMS.length} атомов, ожидалось 132`)

  // Пары сюжета встают в соседние узлы с противоположным зарядом.
  for (const [na, cl] of [['na1', 'clA'], ['na2', 'clB']] as const) {
    const a = SALT_FRAG.sites[STORY_SITE[na]]!
    const b = SALT_FRAG.sites[STORY_SITE[cl]]!
    if (a.el !== 'Na' || b.el !== 'Cl') throw new Error(`nacl: узлы пары ${na}/${cl} не Na/Cl`)
  }
  for (const a of NACL_ATOMS) {
    const si = SALT_SITE_OF.get(a.id)
    if (si != null && SALT_FRAG.sites[si]!.el !== a.el) throw new Error(`nacl: атом ${a.id} стоит в чужом узле`)
  }

  // Физика размера: катион меньше атома, анион больше.
  if (!(R.naIon < R.na)) throw new Error('nacl: Na⁺ обязан быть меньше атома Na')
  if (!(R.clIon > R.cl)) throw new Error('nacl: Cl⁻ обязан быть больше атома Cl')

  // Никаких событий лаборатории до конца последнего шага.
  if (NACL_END <= stepTo(LAST_STEP)) throw new Error('nacl: хвост сцены пустой')
}
