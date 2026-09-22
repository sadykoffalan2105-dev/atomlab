import * as THREE from 'three'
import { ATOMIC_DATA, bondAngleDeg, bondLengthPm, BOND_DATA, getCrystal, radiusForSpecies } from '../../../../chemistry/data'
import { smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { orbitTrack, sampleShot, shotTrack, type ShotTrack } from '../kit/camera'
import { pmToScene, SPECIES_SCALE } from '../kit/cpkAtoms'
import { latticeCaption, latticeFragment, type LatticeSegment, type Vec3 } from '../kit/lattice'
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
import { SIO2_BOND_COMPARISON, SIO2_DHF_TABLE_KJ } from './sio2Energetics'
import { SIO2_BREAKS, SIO2_END, SIO2_FINISH, SIO2_INSERTIONS, SIO2_STEPS, sio2CueAt } from './sio2Steps'

export {
  SIO2_BREAKS,
  SIO2_CUES,
  SIO2_END,
  SIO2_FINISH,
  SIO2_INSERTIONS,
  SIO2_SEGMENTS,
  SIO2_STEPS,
  SIO2_STEP_IDS,
  SIO2_TIMING,
  sio2StepIndexAt,
  type Sio2CueId,
  type Sio2StepId,
} from './sio2Steps'

/**
 * Раскадровка Si (тв.) + O₂ (г.) → SiO₂ (тв.) — ЧИСТАЯ функция времени сюжета.
 * Построена по рецепту эталона (scenes/nacl).
 *
 * Ни одного числа химии: геометрия — из crystalData через kit/lattice (ячейка Si Fd-3m 1×1×1,
 * фрагмент α-кварца 2×2×2), длины — из bondData (O=O, Si–Si, Si–O, C=O в CO₂), углы — из bondData
 * (quartzOSiO, quartzSiOSi), радиусы — Кордеро (radiusForSpecies, model 'covalent'): SiO₂ —
 * полярно-ковалентный каркас, ионов Si⁴⁺ и O²⁻ в нём нет, подписи — δ+/δ−.
 *
 * Постановка (всё схематичное названо в note шагов):
 *   • тетраэдр, который строит кислород, — это тетраэдр SiO₄ того узла α-кварца, в который
 *     он встанет на шаге 5: ячейку кремния поворачиваем так, чтобы связи центрального Si
 *     смотрели на вершины этого тетраэдра. Кристалл кварца растёт вокруг — сюжетные атомы не прыгают;
 *   • O встраивается в связь Si–Si (Si–Si + O → Si–O–Si), соседние Si отходят на Si···Si каркаса;
 *   • остальной кремний уходит из кадра до паузы шага 2 (оставлен один атом и его соседи);
 *   • CO₂ — молекула сравнения только на шаге 4, пока о ней говорит текст.
 * Правила эталона: у каждого атома span [первый, последний шаг], вне него непрозрачность 0;
 * каждый видимый атом подписан (label.hosts); смена материала, точек и подписи — в кадр встраивания;
 * финал без огня и свечения внутри вещества.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

const SI = getCrystal('si')!
const QZ = getCrystal('quartz')!

/** Ячейка кремния: 8 вершин + 6 граней + 4 внутренних атома, 16 связей Si–Si. */
export const SI_FRAG = latticeFragment('si', [1, 1, 1])
/** Фрагмент α-кварца: 2×2×2 ячейки (центр рамки — в начале координат). */
export const QUARTZ_FRAG = latticeFragment('quartz', [2, 2, 2])
/** Подписи решёток — только символы и числа. */
export const SI_CAPTION = latticeCaption('si')
export const QUARTZ_CAPTION = latticeCaption('quartz')

type V3 = readonly [number, number, number]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const unit = (a: V3): V3 => scale(a, 1 / (len(a) || 1))

/** Соседи узла по связям фрагмента. */
function neighborsOf(frag: typeof SI_FRAG, i: number): number[] {
  const out: number[] = []
  for (const [a, b] of frag.bonds) {
    if (a === i) out.push(b)
    else if (b === i) out.push(a)
  }
  return out.sort((x, y) => x - y)
}

const QP = (i: number): V3 => QUARTZ_FRAG.sites[i]!.posScene
const SP = (i: number): V3 => SI_FRAG.sites[i]!.posScene

/** Узел Si кварца, чей тетраэдр строит сюжет: четыре связи во фрагменте, ближе всех к центру. */
const Q0 = (() => {
  let best = -1
  let bestD = Infinity
  QUARTZ_FRAG.sites.forEach((s, i) => {
    if (s.el !== 'Si' || neighborsOf(QUARTZ_FRAG, i).length !== 4) return
    const d = len(sub(s.posScene, QUARTZ_FRAG.boundsScene.center))
    if (d < bestD - 1e-9) {
      bestD = d
      best = i
    }
  })
  if (best < 0) throw new Error('sio2: во фрагменте кварца нет Si с четырьмя O')
  return best
})()
const Q0_O = neighborsOf(QUARTZ_FRAG, Q0)
const Q0_SI = Q0_O.map((o) => {
  const other = neighborsOf(QUARTZ_FRAG, o).find((s) => s !== Q0)
  if (other == null) throw new Error('sio2: мостиковый O тетраэдра без второго Si')
  return other
})

/** Центральный Si ячейки кремния (внутренний, четыре соседа) и его соседи. */
const SI_C = SI_FRAG.sites.findIndex((_, i) => neighborsOf(SI_FRAG, i).length === 4)
const SI_N = neighborsOf(SI_FRAG, SI_C)

/**
 * Поворот ячейки кремния: связи центрального Si → вершины тетраэдра кварца (триада по двум
 * векторам, перебор 24 соответствий, берём наименьшую угловую ошибку по всем четырём).
 * Поворот собственный (det = +1), расстояния сохраняются — тест проверяет.
 */
type Mat3 = readonly [V3, V3, V3] // строки
const mul = (m: Mat3, v: V3): V3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)]
function triad(a: V3, b: V3): Mat3 {
  const e1 = unit(a)
  const e2 = unit(sub(b, scale(e1, dot(b, e1))))
  const e3 = cross(e1, e2)
  return [e1, e2, e3]
}
const ALIGN = (() => {
  const d = SI_N.map((n) => unit(sub(SP(n), SP(SI_C))))
  const q = Q0_O.map((o) => unit(sub(QP(o), QP(Q0))))
  const perms: number[][] = []
  const permute = (rest: number[], acc: number[]) => {
    if (!rest.length) perms.push(acc)
    rest.forEach((x, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, x]))
  }
  permute([0, 1, 2, 3], [])
  let best: { perm: number[]; rot: Mat3; err: number } | null = null
  for (const p of perms) {
    const bd = triad(d[0]!, d[1]!)
    const bq = triad(q[p[0]!]!, q[p[1]!]!)
    // R = Bqᵀ · Bd (строки базиса d → строки базиса q)
    const rot: Mat3 = [0, 1, 2].map((r) => [0, 1, 2].map((c) => bq[0]![r]! * bd[0]![c]! + bq[1]![r]! * bd[1]![c]! + bq[2]![r]! * bd[2]![c]!) as unknown as V3) as unknown as Mat3
    let err = 0
    for (let k = 0; k < 4; k++) err += Math.acos(Math.max(-1, Math.min(1, dot(mul(rot, d[k]!), q[p[k]!]!))))
    if (!best || err < best.err) best = { perm: p, rot, err }
  }
  return best!
})()

/** Позиция узла ячейки кремния в кадре: центральный Si совпадает с узлом Q0 кварца. */
const siScene = (i: number): V3 => add(QP(Q0), mul(ALIGN.rot, sub(SP(i), SP(SI_C))))
/** Центр ячейки кремния в кадре. */
const SI_CELL_CENTER: V3 = add(QP(Q0), mul(ALIGN.rot, scale(SP(SI_C), -1)))
/** Рёбра ячейки кремния, повёрнутые вместе с ней (пул рёбер получает готовые отрезки). */
export const SI_CELL_EDGES: readonly LatticeSegment[] = SI_FRAG.cellEdges.map(([p, q]) => [
  add(SI_CELL_CENTER, mul(ALIGN.rot, p)) as Vec3,
  add(SI_CELL_CENTER, mul(ALIGN.rot, q)) as Vec3,
])

/** Связь k центрального Si ↔ вершина тетраэдра кварца: O и второй Si. */
const QO = [0, 1, 2, 3].map((k) => Q0_O[ALIGN.perm[k]!]!)
const QS = [0, 1, 2, 3].map((k) => Q0_SI[ALIGN.perm[k]!]!)

/** Середина связи k центрального Si в ячейке кремния и точка посадки O рядом с ней. */
const BOND_MID = SI_N.map((_, k) => scale(add(siScene(SI_C), siScene(SI_N[k]!)), 0.5))
/** Посадка O сбоку от связи Si–Si — со стороны будущей вершины тетраэдра (параметр постановки). */
const LAND_OFFSET = 0.42
const LAND: V3[] = [0, 1, 2, 3].map((k) => {
  const d = unit(sub(siScene(SI_N[k]!), siScene(SI_C)))
  const toO = sub(QP(QO[k]!), BOND_MID[k]!)
  let n = sub(toO, scale(d, dot(toO, d)))
  if (len(n) < 1e-6) n = cross(d, [0, 1, 0])
  return add(BOND_MID[k]!, scale(unit(n), LAND_OFFSET))
})

/** Пары связей для двух молекул O₂: разбиение, у которого середины пар лежат левее/правее всего. */
const PAIRS = (() => {
  type Pair = readonly [number, number]
  const splits: readonly (readonly [Pair, Pair])[] = [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[0, 3], [1, 2]],
  ]
  let best = splits[0]!
  let bestX = -1
  for (const s of splits) {
    const m = sub(scale(add(LAND[s[0][0]]!, LAND[s[0][1]]!), 0.5), QP(Q0))
    if (Math.abs(m[0]) > bestX) {
      bestX = Math.abs(m[0])
      best = s
    }
  }
  const mA = scale(add(LAND[best[0][0]]!, LAND[best[0][1]]!), 0.5)
  // Молекула A — справа (x больше), B — слева.
  return mA[0] >= QP(Q0)[0] ? { a: best[0], b: best[1] } : { a: best[1], b: best[0] }
})()
/** Какая связь центрального Si достаётся каждому сюжетному O: o0, o1 — из O₂ A; o2, o3 — из O₂ B. */
const O_BOND: readonly [number, number, number, number] = [PAIRS.a[0], PAIRS.a[1], PAIRS.b[0], PAIRS.b[1]]

const D_OO = pmToScene(bondLengthPm('O=O'))
const D_CO = pmToScene(bondLengthPm('C=O(CO2)'))

/** Ковалентные радиусы Кордеро (ядро), доля SPECIES_SCALE — одна на все атомы сцены. */
export const radiusCovalentPm = (el: 'Si' | 'O' | 'C') => radiusForSpecies(el, 0, { model: 'covalent' })
const R = {
  Si: pmToScene(radiusCovalentPm('Si')) * SPECIES_SCALE,
  O: pmToScene(radiusCovalentPm('O')) * SPECIES_SCALE,
  C: pmToScene(radiusCovalentPm('C')) * SPECIES_SCALE,
} as const

/** Зазор валентных точек над поверхностью атома (параметр рисунка, не химия). */
const DOT_GAP = 0.07

export const SIO2_GEOM = {
  radius: R,
  q0: Q0,
  quartzO: QO,
  quartzSi: QS,
  siCentral: SI_C,
  siNeighbors: SI_N,
  rotation: ALIGN.rot,
  alignErrorRad: ALIGN.err,
  siCellCenter: SI_CELL_CENTER,
  data: {
    siCellPm: SI.cellPm.a,
    siSiPm: bondLengthPm('Si-Si'),
    ooPm: bondLengthPm('O=O'),
    sioPm: bondLengthPm('Si-O'),
    sioLengthsPm: BOND_DATA['Si-O'].lengthsPm ?? [],
    oSiOdeg: bondAngleDeg('quartzOSiO'),
    siOSideg: bondAngleDeg('quartzSiOSi'),
    quartz: { spaceGroup: QZ.spaceGroup, a: QZ.cellPm.a, c: QZ.cellPm.c!, z: QZ.z, coordination: QZ.coordination, density: QZ.densityGCm3 },
  },
} as const

/** Масштаб рига камеры. */
export const SIO2_RIG_SCALE = 1.15

// ─────────────────────────────────────────────────────────────────────────────
// Состав кадра
// ─────────────────────────────────────────────────────────────────────────────

export type Sio2Element = 'Si' | 'O' | 'C'
export type Sio2AtomKind = 'story' | 'silicon' | 'vertex' | 'quartz' | 'compare'

export type Sio2AtomDef = {
  id: string
  el: Sio2Element
  kind: Sio2AtomKind
  /** индексы шагов [первый, последний], на которых атом имеет право быть видимым */
  span: readonly [number, number]
}

const stepFrom = (i: number) => SIO2_STEPS[i]!.from
const stepTo = (i: number) => SIO2_STEPS[i]!.to
const LAST_STEP = SIO2_STEPS.length - 1
const INS = SIO2_INSERTIONS.map((x) => x.at)

const STORY_IDS = ['si0', 'n0', 'n1', 'n2', 'n3', 'o0', 'o1', 'o2', 'o3'] as const
type StoryId = (typeof STORY_IDS)[number]

/** Узел кварца каждого сюжетного атома. */
const STORY_QSITE: Record<StoryId, number> = {
  si0: Q0,
  n0: QS[0]!,
  n1: QS[1]!,
  n2: QS[2]!,
  n3: QS[3]!,
  o0: QO[O_BOND[0]]!,
  o1: QO[O_BOND[1]]!,
  o2: QO[O_BOND[2]]!,
  o3: QO[O_BOND[3]]!,
}
const STORY_QSET = new Set<number>(Object.values(STORY_QSITE))
/** Остальные атомы ячейки кремния. */
const SI_REST = SI_FRAG.sites.map((_, i) => i).filter((i) => i !== SI_C && !SI_N.includes(i))
/** O соседних тетраэдров (вершины, общие с соседями): появляются на шаге 4. */
const VERTEX_SITES = QUARTZ_FRAG.sites
  .map((_, i) => i)
  .filter((i) => QUARTZ_FRAG.sites[i]!.el === 'O' && !STORY_QSET.has(i) && neighborsOf(QUARTZ_FRAG, i).some((s) => QS.includes(s)))
const QUARTZ_REST = QUARTZ_FRAG.sites.map((_, i) => i).filter((i) => !STORY_QSET.has(i) && !VERTEX_SITES.includes(i))

export const SIO2_ATOMS: readonly Sio2AtomDef[] = [
  { id: 'si0', el: 'Si', kind: 'story', span: [0, LAST_STEP] },
  ...(['n0', 'n1', 'n2', 'n3'] as const).map((id) => ({ id, el: 'Si' as const, kind: 'story' as const, span: [0, LAST_STEP] as const })),
  ...(['o0', 'o1', 'o2', 'o3'] as const).map((id) => ({ id, el: 'O' as const, kind: 'story' as const, span: [0, LAST_STEP] as const })),
  ...SI_REST.map((_, k) => ({ id: `S${k}`, el: 'Si' as const, kind: 'silicon' as const, span: [0, 1] as const })),
  ...VERTEX_SITES.map((_, k) => ({ id: `V${k}`, el: 'O' as const, kind: 'vertex' as const, span: [3, LAST_STEP] as const })),
  ...QUARTZ_REST.map((si, k) => ({ id: `Q${k}`, el: QUARTZ_FRAG.sites[si]!.el as 'Si' | 'O', kind: 'quartz' as const, span: [4, LAST_STEP] as const })),
  { id: 'cC', el: 'C', kind: 'compare', span: [3, 4] },
  { id: 'cO1', el: 'O', kind: 'compare', span: [3, 4] },
  { id: 'cO2', el: 'O', kind: 'compare', span: [3, 4] },
]

export const SIO2_ATOM_INDEX: ReadonlyMap<string, number> = new Map(SIO2_ATOMS.map((a, i) => [a.id, i]))
const IDX = (id: string) => SIO2_ATOM_INDEX.get(id)!
const I_SI0 = IDX('si0')
const I_N = [IDX('n0'), IDX('n1'), IDX('n2'), IDX('n3')] as const
const I_O = [IDX('o0'), IDX('o1'), IDX('o2'), IDX('o3')] as const
const I_CC = IDX('cC')
const I_CO1 = IDX('cO1')
const I_CO2 = IDX('cO2')
const SILICON_IDS = SIO2_ATOMS.filter((a) => a.kind === 'silicon').map((a) => a.id)
const VERTEX_IDS = SIO2_ATOMS.filter((a) => a.kind === 'vertex').map((a) => a.id)
const QUARTZ_IDS = SIO2_ATOMS.filter((a) => a.kind === 'quartz').map((a) => a.id)

/** Узел фрагмента кварца для атома кадра (сюжет, вершины, кварц). */
export const QUARTZ_SITE_OF: ReadonlyMap<string, number> = new Map<string, number>([
  ...STORY_IDS.map((id) => [id, STORY_QSITE[id]] as [string, number]),
  ...VERTEX_SITES.map((si, k) => [`V${k}`, si] as [string, number]),
  ...QUARTZ_REST.map((si, k) => [`Q${k}`, si] as [string, number]),
])
/** Узел ячейки кремния для атома кадра (центральный, соседи, остальные). */
export const SILICON_SITE_OF: ReadonlyMap<string, number> = new Map<string, number>([
  ['si0', SI_C],
  ...SI_N.map((si, k) => [`n${k}`, si] as [string, number]),
  ...SI_REST.map((si, k) => [`S${k}`, si] as [string, number]),
])
const atomOfQuartzSite = new Map<number, number>([...QUARTZ_SITE_OF.entries()].map(([id, si]) => [si, IDX(id)]))
const atomOfSiliconSite = new Map<number, number>([...SILICON_SITE_OF.entries()].map(([id, si]) => [si, IDX(id)]))

// ─────────────────────────────────────────────────────────────────────────────
// Время
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  restOut: { from: stepFrom(1) + 0.3, to: stepFrom(1) + 1.7 },
  approach: { from: stepFrom(1) + 0.6, to: sio2CueAt('adsorb') },
  brkA: SIO2_BREAKS.a,
  brkB: SIO2_BREAKS.b,
  landA: SIO2_BREAKS.a + 1.1,
  landB: SIO2_BREAKS.b + 1.1,
  insMove: 0.9,
  tetraOn: stepFrom(3) + 0.4,
  vertex: { from: stepFrom(3) + 1.0, to: stepFrom(3) + 2.6 },
  co2: { on: stepFrom(3) + 1.0, off: stepTo(3) + 0.1 },
  storyLabelsEnd: stepFrom(4) + 0.9,
  quartzEdges: sio2CueAt('quartz') - 1.1,
}

// ─────────────────────────────────────────────────────────────────────────────
// Положения
// ─────────────────────────────────────────────────────────────────────────────

/** Время встраивания атома O k (по порядку связей центрального Si). */
const INS_OF_O = O_BOND.map((b) => INS[b]!)
/** Какой сюжетный O встраивается в связь k центрального Si. */
const OF_BOND: readonly number[] = [0, 1, 2, 3].map((k) => O_BOND.indexOf(k))

// ─────────────────────────────────────────────────────────────────────────────
// Связи кадра (слоты пула — в этом порядке)
// ─────────────────────────────────────────────────────────────────────────────

export type Sio2BondGroup = 'siSi' | 'oo' | 'story' | 'quartz' | 'co2'
export type Sio2BondDef = { a: number; b: number; kind: 'sigma' | 'double'; group: Sio2BondGroup; /** для 'story' и 'siSi': номер связи центрального Si */ k?: number }

export const SIO2_BONDS: readonly Sio2BondDef[] = [
  // Связи Si–Si ячейки кремния (16).
  ...SI_FRAG.bonds.map(([i, j]) => {
    const a = atomOfSiliconSite.get(i)!
    const b = atomOfSiliconSite.get(j)!
    const k = a === I_SI0 ? I_N.indexOf(b as never) : b === I_SI0 ? I_N.indexOf(a as never) : -1
    return { a, b, kind: 'sigma' as const, group: 'siSi' as const, ...(k >= 0 ? { k } : {}) }
  }),
  // O=O двух молекул.
  { a: I_O[0], b: I_O[1], kind: 'double', group: 'oo' },
  { a: I_O[2], b: I_O[3], kind: 'double', group: 'oo' },
  // Четыре мостика Si–O–Si сюжета: Si(центр)–O и O–Si(сосед); A — Si, B — O (полярность к O).
  ...[0, 1, 2, 3].flatMap((k) => [
    { a: I_SI0, b: I_O[OF_BOND[k]!]!, kind: 'sigma' as const, group: 'story' as const, k },
    { a: I_N[k]!, b: I_O[OF_BOND[k]!]!, kind: 'sigma' as const, group: 'story' as const, k },
  ]),
  // Связи Si–O фрагмента кварца, кроме уже нарисованных сюжетом.
  ...QUARTZ_FRAG.bonds
    .filter(([i, j]) => !(STORY_QSET.has(i) && STORY_QSET.has(j)))
    .map(([i, j]) => {
      const [si, o] = QUARTZ_FRAG.sites[i]!.el === 'Si' ? [i, j] : [j, i]
      return { a: atomOfQuartzSite.get(si)!, b: atomOfQuartzSite.get(o)!, kind: 'sigma' as const, group: 'quartz' as const }
    }),
  // CO₂: две двойные связи.
  { a: I_CC, b: I_CO1, kind: 'double', group: 'co2' },
  { a: I_CC, b: I_CO2, kind: 'double', group: 'co2' },
]


/** Молекулы O₂ на шаге 1: справа и слева от ячейки, ось вертикальна. */
const O2_START: Record<'a' | 'b', V3> = {
  a: add(SI_CELL_CENTER, [2.45, 0.25, 0]),
  b: add(SI_CELL_CENTER, [-2.45, -0.25, 0]),
}
const HALF_OO: V3 = [0, D_OO / 2, 0]
/** Молекула у поверхности (до разрыва): над серединой своей пары посадок, ось — вдоль пары. */
function nearSurface(pair: readonly [number, number]): { center: V3; half: V3 } {
  const mid = scale(add(LAND[pair[0]]!, LAND[pair[1]]!), 0.5)
  const out = unit(sub(mid, QP(Q0)))
  return { center: add(mid, scale(out, 0.35)), half: scale(unit(sub(LAND[pair[1]]!, LAND[pair[0]]!)), D_OO / 2) }
}
const NEAR = { a: nearSurface(PAIRS.a), b: nearSurface(PAIRS.b) }

const POS: Record<string, Vec3Track> = {
  si0: [{ t: 0, v: QP(Q0) }],
}
I_N.forEach((_, k) => {
  POS[`n${k}`] = [
    { t: 0, v: siScene(SI_N[k]!) },
    { t: INS[k]!, v: siScene(SI_N[k]!) },
    { t: INS[k]! + T.insMove, v: QP(QS[k]!), ease: 'smooth' },
  ]
})
for (let j = 0; j < 4; j++) {
  const mol = j < 2 ? 'a' : 'b'
  const sign = j % 2 === 0 ? -1 : 1
  const start = add(O2_START[mol], scale(HALF_OO, sign))
  const near = add(NEAR[mol].center, scale(NEAR[mol].half, sign))
  const brk = mol === 'a' ? T.brkA : T.brkB
  const land = mol === 'a' ? T.landA : T.landB
  const b = O_BOND[j]!
  POS[`o${j}`] = [
    { t: 0, v: start },
    { t: T.approach.from, v: start },
    { t: T.approach.to, v: near, ease: 'smooth', arc: 0.35 },
    { t: brk, v: near },
    { t: land, v: LAND[b]!, ease: 'smooth' },
    { t: INS_OF_O[j]!, v: LAND[b]! },
    { t: INS_OF_O[j]! + T.insMove, v: QP(QO[b]!), ease: 'smooth' },
  ]
}
/** Остальной кремний уходит от центра и гаснет полностью до паузы шага 2. */
SILICON_IDS.forEach((id, k) => {
  const p = siScene(SI_REST[k]!)
  const out = scale(unit(sub(p, QP(Q0))), 0.5)
  POS[id] = [
    { t: 0, v: p },
    { t: T.restOut.from, v: p },
    { t: T.restOut.to, v: add(p, out), ease: 'inQuad' },
  ]
})

/**
 * Рост каркаса: вершины соседних тетраэдров (шаг 4), затем остальной фрагмент (шаг 5) подлетают
 * к узлам радиально от центрального Si, ближние раньше; каждый атом вырастает из точки.
 */
const GROW = { from: stepFrom(4) + 0.4, to: sio2CueAt('quartz') - 0.7, flight: 1.0, appear: 0.7, reach: 0.8 }
function arrivals(ids: string[], from: number, to: number, flight: number): Map<string, { start: number; arrive: number }> {
  const ranked = ids
    .map((id) => ({ id, d: len(sub(QP(QUARTZ_SITE_OF.get(id)!), QP(Q0))) }))
    .sort((a, b) => a.d - b.d || a.id.localeCompare(b.id))
  const out = new Map<string, { start: number; arrive: number }>()
  ranked.forEach((r, rank) => {
    const start = from + (rank / Math.max(1, ranked.length - 1)) * (to - from - flight)
    out.set(r.id, { start, arrive: start + flight })
  })
  return out
}
export const GROWTH_ARRIVAL: ReadonlyMap<string, { start: number; arrive: number }> = new Map([
  ...arrivals(VERTEX_IDS, T.vertex.from, T.vertex.to, GROW.flight),
  ...arrivals(QUARTZ_IDS, GROW.from, GROW.to, GROW.flight),
])
for (const id of [...VERTEX_IDS, ...QUARTZ_IDS]) {
  const p = QP(QUARTZ_SITE_OF.get(id)!)
  const dir = unit(sub(p, QP(Q0)))
  const a = GROWTH_ARRIVAL.get(id)!
  POS[id] = [
    { t: a.start, v: add(p, scale(dir, GROW.reach)) },
    { t: a.arrive, v: p, ease: 'smooth' },
  ]
}
/** Молекула сравнения CO₂ — слева от тетраэдра, линейная, C=O из bondData. */
const CO2_CENTER: V3 = add(QP(Q0), [-2.35, 0.35, 0])
POS.cC = [{ t: 0, v: CO2_CENTER }]
POS.cO1 = [{ t: 0, v: add(CO2_CENTER, [-D_CO, 0, 0]) }]
POS.cO2 = [{ t: 0, v: add(CO2_CENTER, [D_CO, 0, 0]) }]

/** Спиральная цепочка тетраэдров вокруг винтовой оси: цепь Si–(O)–Si, каждый шаг — на c/3 вверх. */
export const HELIX_SITES: readonly number[] = (() => {
  const c3 = pmToScene(QZ.cellPm.c!) / 3
  const siNb = (s: number) => {
    const out: number[] = []
    for (const o of neighborsOf(QUARTZ_FRAG, s)) for (const x of neighborsOf(QUARTZ_FRAG, o)) if (x !== s) out.push(x)
    return out
  }
  const up = (s: number) => siNb(s).filter((n) => Math.abs(QP(n)[1] - QP(s)[1] - c3) < 1e-4)
  const chains: number[][] = []
  const walk = (path: number[]) => {
    const nx = up(path[path.length - 1]!)
    if (!nx.length) {
      chains.push(path)
      return
    }
    for (const n of nx) walk([...path, n])
  }
  const siSites = QUARTZ_FRAG.sites.map((_, i) => i).filter((i) => QUARTZ_FRAG.sites[i]!.el === 'Si')
  for (const s of siSites) if (!siSites.some((b) => up(b).includes(s))) walk([s])
  // Спираль: каждый третий атом стоит ровно над первым (трансляция c) — иначе это зигзаг.
  const helix = chains.filter(
    (ch) => ch.length >= 4 && ch.includes(Q0) && ch.every((s, i) => i + 3 >= ch.length || (Math.abs(QP(ch[i + 3]!)[0] - QP(s)[0]) < 1e-4 && Math.abs(QP(ch[i + 3]!)[2] - QP(s)[2]) < 1e-4)),
  )
  helix.sort((a, b) => b.length - a.length || a.join().localeCompare(b.join()))
  if (!helix.length) throw new Error('sio2: не найдена спиральная цепочка через центральный тетраэдр')
  return helix[0]!
})()
export const HELIX_ATOMS: readonly number[] = HELIX_SITES.map((s) => atomOfQuartzSite.get(s)!)
const HELIX_READY = Math.max(...HELIX_ATOMS.map((i) => GROWTH_ARRIVAL.get(SIO2_ATOMS[i]!.id)?.arrive ?? 0)) + 0.2

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

/** Валентные точки атома O: 6 до встраивания, 4 (две неподелённые пары) — в кадр встраивания. */
const O_VALENCE = ATOMIC_DATA.O.valenceElectrons
/** Связей Si–O у мостикового кислорода. */
export const BRIDGE_BONDS = 2
export const SIO2_SNAP = {
  valenceO: INS_OF_O.map((t) => octetSnap(t, O_VALENCE, O_VALENCE - BRIDGE_BONDS)),
  /** 0 → 1: атом стал частью полярного каркаса (материал covalent/gas → polar, подпись → δ) */
  polarO: INS_OF_O.map((t) => octetSnap(t, 0, 1)),
  polarN: INS.map((t) => octetSnap(t, 0, 1)),
  polarSi0: octetSnap(INS[0]!, 0, 1),
} as const

const APPEAR: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.6, v: 1, ease: 'smooth' },
]
const REST_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.6, v: 1, ease: 'smooth' },
  { t: T.restOut.from, v: 1 },
  { t: T.restOut.to, v: 0, ease: 'smooth' },
]
const CO2_OPACITY: ScalarTrack = [
  { t: T.co2.on, v: 0 },
  { t: T.co2.on + 0.6, v: 1, ease: 'smooth' },
  { t: T.co2.off, v: 1 },
  { t: T.co2.off + 0.6, v: 0, ease: 'smooth' },
]
/** O=O: натяжение и ГОМОЛИТИЧЕСКИЙ разрыв — каждый атом O уносит два неспаренных электрона. */
const OO_OPACITY = (brk: number): ScalarTrack => [
  { t: 0, v: 0 },
  { t: 0.6, v: 1, ease: 'smooth' },
  { t: brk, v: 1 },
  { t: brk + 0.5, v: 0, ease: 'smooth' },
]
const OO_A = OO_OPACITY(T.brkA)
const OO_B = OO_OPACITY(T.brkB)
/** Si–Si центрального атома гаснет, когда в неё встраивается O. */
const SISI_K = INS.map((t): ScalarTrack => [
  { t: 0, v: 0 },
  { t: 0.6, v: 1, ease: 'smooth' },
  { t: t - 0.2, v: 1 },
  { t: t + 0.35, v: 0, ease: 'smooth' },
])
/** Две связи Si–O мостика k появляются в кадр встраивания. */
const SIO_K = INS.map((t): ScalarTrack => [
  { t, v: 0 },
  { t: t + 0.5, v: 1, ease: 'smooth' },
])

/** Рёбра ячеек: ячейка кремния (шаг 1), потом ячейки кварца (шаг 5 → финал). */
const SI_EDGES: ScalarTrack = [
  { t: 0.2, v: 0 },
  { t: 1.0, v: 1, ease: 'smooth' },
  { t: T.restOut.from, v: 1 },
  { t: T.restOut.to - 0.2, v: 0, ease: 'smooth' },
]
const QUARTZ_EDGES: ScalarTrack = [
  { t: T.quartzEdges, v: 0 },
  { t: T.quartzEdges + 0.9, v: 1, ease: 'smooth' },
  { t: SIO2_FINISH.from, v: 1 },
  { t: SIO2_FINISH.to, v: 0, ease: 'smooth' },
]
/** С какого момента пул рёбер держит ячейки кварца (в этот момент обе дорожки = 0). */
export const EDGE_SWITCH_T = stepFrom(2)

/** Направляющие: рёбра тетраэдра SiO₄ (O···O) и спираль — пунктир, каждая подписана. */
const GUIDE_TETRA: ScalarTrack = [
  { t: T.tetraOn, v: 0 },
  { t: T.tetraOn + 0.8, v: 1, ease: 'smooth' },
]
const GUIDE_HELIX: ScalarTrack = [
  { t: HELIX_READY, v: 0 },
  { t: HELIX_READY + 0.8, v: 1, ease: 'smooth' },
]

/** Валентные точки O: появляются в кадр разрыва O=O, гаснут в начале шага 4. */
const VALENCE_OFF = stepFrom(3) + 1.0

const FADE = fadeTrack(SIO2_FINISH)

/**
 * Камера — планы (kit/camera): общий план реагентов, наезд на поверхность и мостики,
 * тетраэдр и CO₂, отъезд на каркас и медленный облёт на финале.
 */
const Q0P = QP(Q0)
export const SIO2_CAMERA: ShotTrack = shotTrack([
  { t: 0, zoom: 0.66, target: [SI_CELL_CENTER[0], SI_CELL_CENTER[1], SI_CELL_CENTER[2]] },
  { t: stepTo(0), zoom: 0.68 },
  { t: stepFrom(1) + 3.0, zoom: 0.98, target: [Q0P[0], Q0P[1], Q0P[2]] },
  { t: stepTo(1), zoom: 1.0 },
  { t: stepTo(2), zoom: 1.04 },
  { t: stepFrom(3) + 1.4, zoom: 0.78, target: [Q0P[0] - 1.05, Q0P[1], Q0P[2]] },
  { t: stepTo(3), zoom: 0.78 },
  { t: sio2CueAt('quartz') - 0.8, zoom: 0.62, yaw: 0.3, pitch: 0.2, target: [0, 0, 0] },
  ...orbitTrack(stepFrom(5), stepTo(5), 0.3, 0.8, 0.2, 0.62),
])

const BASE_EMISSIVE = 0.08
const BASE_BLOOM = 0.3

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D — только формулы, заряды, числа и символы единиц (токены)
// ─────────────────────────────────────────────────────────────────────────────

export type Sio2LabelDef = SceneLabelDef & {
  anchor: 'atom' | 'siCell' | 'siCellBelow' | 'siBond' | 'o2a' | 'o2b' | 'ooBond' | 'nbr' | 'sioBond' | 'angle' | 'bridge' | 'below' | 'co2' | 'co2Below' | 'vertex' | 'cubeAbove' | 'edgeA' | 'edgeC' | 'helix'
  atom?: string
  dx?: number
  hosts: readonly string[]
}

/** Число без хвостовых нулей, до сотых: 120.75 → «120.75», 1859.2 → «1859.2», 1598 → «1598». */
const fmt = (v: number) => String(Math.round(v * 100) / 100)
/** Одна десятая всегда: 116 → «116.0», 910.7 → «910.7». */
const fmt1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1)
const signed1 = (v: number) => (v < 0 ? `−${fmt1(-v)}` : `+${fmt1(v)}`)

/** Длина связи Si–O мостика 0 в каркасе — какое из двух значений ядра (160,5 или 161,4). */
const SIO_LABEL_PM = (() => {
  const d = len(sub(QP(QO[O_BOND[0]]!), QP(Q0))) / pmToScene(1)
  const list = BOND_DATA['Si-O'].lengthsPm ?? [bondLengthPm('Si-O')]
  return list.reduce((b, v) => (Math.abs(v - d) < Math.abs(b - d) ? v : b), list[0]!)
})()

const STORY_LABEL_END = T.storyLabelsEnd
const W_O = (j: number): readonly [number, number] => [j < 2 ? T.brkA : T.brkB, STORY_LABEL_END]

export const SIO2_LABELS: readonly Sio2LabelDef[] = [
  // Шаг 1: кремний и кислород
  { id: 'si', kind: 'species', anchor: 'siCell', dy: 0.35, keys: [{ t: 0, text: 'Si ({s})' }], windows: [[0.2, T.restOut.to]], hosts: ['si0', 'n0', 'n1', 'n2', 'n3', ...SILICON_IDS] },
  { id: 'siA', kind: 'measure', anchor: 'siCellBelow', dy: -0.3, keys: [{ t: 0, text: SI_CAPTION[0]! }], windows: [[0.6, T.restOut.from]], hosts: [] },
  { id: 'siSG', kind: 'token', anchor: 'siCell', dy: 0.9, dx: -0.55, keys: [{ t: 0, text: SI_CAPTION[1]! }], windows: [[0.8, T.restOut.from]], hosts: [] },
  { id: 'siCN', kind: 'token', anchor: 'siCell', dy: 0.9, dx: 0.55, keys: [{ t: 0, text: SI_CAPTION[2]! }], windows: [[0.8, T.restOut.from]], hosts: [] },
  { id: 'siBond', kind: 'measure', anchor: 'siBond', dy: 0, keys: [{ t: 0, text: `${fmt(bondLengthPm('Si-Si'))} {pm}` }], windows: [[0.8, INS[0]! - 0.3]], hosts: [] },
  { id: 'o2a', kind: 'species', anchor: 'o2a', dy: 0.55, keys: [{ t: 0, text: 'O₂ ({g})' }], windows: [[0.2, T.brkA]], hosts: ['o0', 'o1'] },
  { id: 'o2b', kind: 'species', anchor: 'o2b', dy: 0.55, keys: [{ t: 0, text: 'O₂ ({g})' }], windows: [[0.2, T.brkB]], hosts: ['o2', 'o3'] },
  { id: 'ooBond', kind: 'measure', anchor: 'ooBond', dy: 0, keys: [{ t: 0, text: `${fmt(bondLengthPm('O=O'))} {pm}` }], windows: [[0.6, T.approach.from]], hosts: [] },
  // Шаги 2–4: сюжетные атомы; δ+/δ− — в кадр встраивания
  { id: 'si0', kind: 'species', anchor: 'atom', atom: 'si0', dy: 0.14, keys: [{ t: 0, text: 'Si' }, { t: INS[0]!, text: 'Siᵟ⁺' }], windows: [[T.restOut.to - 0.4, STORY_LABEL_END]], hosts: ['si0'] },
  { id: 'nbr', kind: 'species', anchor: 'nbr', dy: 0.45, keys: [{ t: 0, text: 'Si' }, { t: INS[3]!, text: 'Siᵟ⁺' }], windows: [[T.restOut.to - 0.4, STORY_LABEL_END]], hosts: ['n0', 'n1', 'n2', 'n3'] },
  ...[0, 1, 2, 3].map((j) => ({
    id: `o${j}`,
    kind: 'species' as const,
    anchor: 'atom' as const,
    atom: `o${j}`,
    dy: j % 2 === 0 ? 0.12 : -0.12,
    keys: [
      { t: 0, text: 'O' },
      { t: INS_OF_O[j]!, text: 'Oᵟ⁻' },
    ],
    windows: [W_O(j)],
    hosts: [`o${j}`],
  })),
  { id: 'sio', kind: 'measure', anchor: 'sioBond', dy: 0, keys: [{ t: 0, text: `${fmt(SIO_LABEL_PM)} {pm}` }], windows: [[INS[O_BOND[0]]! + 1.0, stepTo(3) + 0.3]], hosts: [] },
  // Шаг 4: тетраэдр, углы, энергии связей, CO₂ для сравнения
  { id: 'sio4', kind: 'species', anchor: 'atom', atom: 'si0', dy: 0.75, keys: [{ t: 0, text: 'SiO₄' }], windows: [[T.tetraOn, SIO2_END]], hosts: ['si0', 'o0', 'o1', 'o2', 'o3'] },
  { id: 'angOSiO', kind: 'delta', anchor: 'angle', dy: 0, keys: [{ t: 0, text: `${fmt(bondAngleDeg('quartzOSiO'))}°` }], windows: [[T.tetraOn + 0.3, stepTo(3) + 0.3]], hosts: [] },
  { id: 'angSiOSi', kind: 'delta', anchor: 'bridge', dy: 0, keys: [{ t: 0, text: `${fmt(bondAngleDeg('quartzSiOSi'))}°` }], windows: [[T.tetraOn + 0.5, stepTo(3) + 0.3]], hosts: [] },
  { id: 'sum4', kind: 'measure', anchor: 'below', dy: -0.55, keys: [{ t: 0, text: `4 Si–O: ${fmt1(SIO2_BOND_COMPARISON.fourSiO)} {kJmol}` }], windows: [[T.co2.on + 0.6, stepTo(3) + 0.3]], hosts: [] },
  { id: 'vertex', kind: 'species', anchor: 'vertex', dy: 0.3, keys: [{ t: 0, text: 'Oᵟ⁻' }], windows: [[T.vertex.to - 0.4, STORY_LABEL_END]], hosts: VERTEX_IDS },
  { id: 'co2', kind: 'species', anchor: 'co2', dy: 0.5, keys: [{ t: 0, text: 'CO₂ ({g})' }], windows: [[T.co2.on + 0.2, T.co2.off + 0.3]], hosts: ['cC', 'cO1', 'cO2'] },
  { id: 'co2Double', kind: 'measure', anchor: 'co2Below', dy: -0.5, keys: [{ t: 0, text: `2 C=O: ${fmt(SIO2_BOND_COMPARISON.twoCdoubleO)} {kJmol}` }], windows: [[T.co2.on + 0.8, T.co2.off + 0.3]], hosts: [] },
  { id: 'co2Single', kind: 'measure', anchor: 'co2Below', dy: -1.05, keys: [{ t: 0, text: `4 C–O: ${fmt(SIO2_BOND_COMPARISON.fourCO)} {kJmol}` }], windows: [[T.co2.on + 1.2, T.co2.off + 0.3]], hosts: [] },
  // Шаг 5: каркас α-кварца
  { id: 'quartz', kind: 'species', anchor: 'cubeAbove', dy: 1.5, keys: [{ t: 0, text: 'SiO₂ ({s})' }], windows: [[GROW.from + 1.0, SIO2_END]], hosts: [...STORY_IDS, ...VERTEX_IDS, ...QUARTZ_IDS] },
  { id: 'qA', kind: 'measure', anchor: 'edgeA', dy: -0.34, keys: [{ t: 0, text: QUARTZ_CAPTION[0]! }], windows: [[T.quartzEdges + 0.3, SIO2_END]], hosts: [] },
  { id: 'qC', kind: 'measure', anchor: 'edgeC', dy: 0, keys: [{ t: 0, text: QUARTZ_CAPTION[1]! }], windows: [[T.quartzEdges + 0.5, SIO2_END]], hosts: [] },
  { id: 'qSG', kind: 'token', anchor: 'cubeAbove', dy: 0.42, dx: -0.7, keys: [{ t: 0, text: QUARTZ_CAPTION[2]! }], windows: [[T.quartzEdges + 0.7, SIO2_END]], hosts: [] },
  { id: 'qCN', kind: 'token', anchor: 'cubeAbove', dy: 0.42, dx: 0.7, keys: [{ t: 0, text: QUARTZ_CAPTION[3]! }], windows: [[T.quartzEdges + 0.9, SIO2_END]], hosts: [] },
  { id: 'helix', kind: 'token', anchor: 'helix', dy: 0.4, keys: [{ t: 0, text: '3₂' }], windows: [[HELIX_READY + 0.3, SIO2_END]], hosts: [] },
  // Шаг 6: итог — табличная ΔH°f из ядра
  { id: 'dH', kind: 'measure', anchor: 'cubeAbove', dy: 0.9, keys: [{ t: 0, text: `ΔH°f = ${signed1(SIO2_DHF_TABLE_KJ)} {kJmol}` }], windows: [[stepFrom(5) + 0.4, SIO2_END]], hosts: [] },
]

export type Sio2LabelState = SceneLabelState

/** Ребро кварца вдоль a — нижнее переднее (под ним пустое поле вне силуэта). */
const EDGE_A: LatticeSegment = (() => {
  const e = QUARTZ_FRAG.cellEdges
  const bottom = Math.min(...e.flatMap(([p, q]) => [p[1], q[1]]))
  const flat = e.filter(([p, q]) => Math.abs(p[1] - bottom) < 1e-6 && Math.abs(q[1] - bottom) < 1e-6 && Math.abs(p[2] - q[2]) < 1e-6)
  flat.sort((a, b) => Math.max(b[0][2], b[1][2]) - Math.max(a[0][2], a[1][2]) || Math.min(a[0][0], a[1][0]) - Math.min(b[0][0], b[1][0]))
  return flat[0]!
})()
/** Вертикальное ребро кварца вдоль c — правое переднее. */
const EDGE_C: LatticeSegment = (() => {
  const e = QUARTZ_FRAG.cellEdges.filter(([p, q]) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[2] - q[2]) < 1e-6)
  e.sort((a, b) => b[0][0] + b[0][2] - (a[0][0] + a[0][2]))
  return e[0]!
})()
export const SIO2_EDGE_A = EDGE_A
export const SIO2_EDGE_C = EDGE_C
const SI_CELL_TOP = Math.max(...SI_CELL_EDGES.flatMap(([p, q]) => [p[1], q[1]]))
const SI_CELL_BOTTOM = Math.min(...SI_CELL_EDGES.flatMap(([p, q]) => [p[1], q[1]]))
/** Атом-якорь подписи вершин — верхний из них. */
const VERTEX_TOP = VERTEX_IDS.length ? VERTEX_IDS.reduce((b, id) => (QP(QUARTZ_SITE_OF.get(id)!)[1] > QP(QUARTZ_SITE_OF.get(b)!)[1] ? id : b), VERTEX_IDS[0]!) : 'si0'
const HELIX_TOP = HELIX_ATOMS.reduce((b, i) => (QP(HELIX_SITES[HELIX_ATOMS.indexOf(i)]!)[1] > QP(HELIX_SITES[HELIX_ATOMS.indexOf(b)]!)[1] ? i : b), HELIX_ATOMS[0]!)

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type Sio2Valence = { center: THREE.Vector3; radius: number; count: number; amount: number }

export type Sio2Frame = {
  t: number
  pos: THREE.Vector3[]
  radius: Float32Array
  opacity: Float32Array
  emissive: Float32Array
  /** знак частичного заряда δ для окраски кромки: +1 (Si в каркасе), −1 (O в каркасе), 0 — нет */
  delta: Float32Array
  material: SubstanceKind[]
  /** появление связи каждого слота SIO2_BONDS, 0…1 */
  bond: Float32Array
  /** натяжение O=O перед разрывом (молекулы A, B) */
  ooStress: [number, number]
  edgeSet: 'si' | 'quartz'
  edges: number
  /** валентные облака сюжетных O (o0…o3) */
  valence: [Sio2Valence, Sio2Valence, Sio2Valence, Sio2Valence]
  /** направляющие: рёбра тетраэдра SiO₄ и спираль (пунктир, подписаны 'SiO₄' и '3₂') */
  guides: { tetra: number; helix: number }
  /** амплитуды эффектов свечения (тест: в финале все 0; огня и ореолов в сцене нет) */
  fx: { glow: number }
  labels: Sio2LabelState[]
  camera: SceneCamera
  fade: number
}

export function createSio2Frame(): Sio2Frame {
  const n = SIO2_ATOMS.length
  const val = (): Sio2Valence => ({ center: new THREE.Vector3(), radius: 0, count: 0, amount: 0 })
  return {
    t: 0,
    pos: SIO2_ATOMS.map(() => new THREE.Vector3()),
    radius: new Float32Array(n),
    opacity: new Float32Array(n),
    emissive: new Float32Array(n).fill(BASE_EMISSIVE),
    delta: new Float32Array(n),
    material: SIO2_ATOMS.map(() => 'default' as SubstanceKind),
    bond: new Float32Array(SIO2_BONDS.length),
    ooStress: [0, 0],
    edgeSet: 'si',
    edges: 0,
    valence: [val(), val(), val(), val()],
    guides: { tetra: 0, helix: 0 },
    fx: { glow: 0 },
    labels: createLabelStates(SIO2_LABELS),
    camera: createSceneCamera(),
    fade: 0,
  }
}

/** Кадр, для которого считаются подписи (anchorLabel — модульная функция, без замыканий в кадре). */
let _cur: Sio2Frame | null = null

function anchorLabel(def: SceneLabelDef, st: SceneLabelState): void {
  const f = _cur!
  const d = def as Sio2LabelDef
  const p = f.pos
  switch (d.anchor) {
    case 'atom': {
      const i = IDX(d.atom!)
      st.pos.copy(p[i]!)
      st.pos.y += d.dy > 0 ? f.radius[i]! + d.dy : -(f.radius[i]! - d.dy)
      return
    }
    case 'siCell':
      st.pos.set(SI_CELL_CENTER[0] + (d.dx ?? 0), SI_CELL_TOP + d.dy, SI_CELL_CENTER[2])
      return
    case 'siCellBelow':
      st.pos.set(SI_CELL_CENTER[0], SI_CELL_BOTTOM + d.dy, SI_CELL_CENTER[2])
      return
    case 'siBond':
      st.pos.copy(p[I_SI0]!).lerp(p[I_N[O_BOND[0]]!]!, 0.5)
      st.pos.z += R.Si + 0.1
      return
    case 'o2a':
      st.pos.copy(p[I_O[0]]!).lerp(p[I_O[1]]!, 0.5)
      st.pos.y += d.dy
      return
    case 'o2b':
      st.pos.copy(p[I_O[2]]!).lerp(p[I_O[3]]!, 0.5)
      st.pos.y += d.dy
      return
    case 'ooBond':
      st.pos.copy(p[I_O[0]]!).lerp(p[I_O[1]]!, 0.5)
      st.pos.x += R.O + 0.42
      return
    case 'nbr': {
      // Над верхним из соседей.
      let top = p[I_N[0]]!
      for (let k = 1; k < 4; k++) if (p[I_N[k]]!.y > top.y) top = p[I_N[k]]!
      st.pos.copy(top)
      st.pos.y += R.Si + d.dy
      return
    }
    case 'sioBond':
      st.pos.copy(p[I_SI0]!).lerp(p[I_O[0]]!, 0.5)
      st.pos.z += R.Si + 0.1
      return
    case 'angle':
      // Угол O–Si–O: у центрального Si между o0 и o1, чуть к зрителю.
      st.pos.copy(p[I_O[0]]!).add(p[I_O[1]]!).multiplyScalar(0.5).lerp(p[I_SI0]!, 0.45)
      st.pos.z += R.Si + 0.12
      return
    case 'bridge':
      // Угол Si–O–Si: у мостика o2 снаружи тетраэдра.
      st.pos.copy(p[I_O[2]]!).sub(p[I_SI0]!).multiplyScalar(0.45).add(p[I_O[2]]!)
      st.pos.z += 0.12
      return
    case 'below': {
      let low = p[I_SI0]!.y
      for (let k = 0; k < 4; k++) low = Math.min(low, p[I_N[k]]!.y, p[I_O[k]]!.y)
      st.pos.set(p[I_SI0]!.x, low + d.dy, p[I_SI0]!.z)
      return
    }
    case 'co2':
      st.pos.copy(p[I_CC]!)
      st.pos.y += d.dy
      return
    case 'co2Below':
      st.pos.copy(p[I_CC]!)
      st.pos.y += d.dy
      return
    case 'vertex': {
      const i = IDX(VERTEX_TOP)
      st.pos.copy(p[i]!)
      st.pos.y += R.O + d.dy
      return
    }
    case 'cubeAbove':
      st.pos.set(d.dx ?? 0, QUARTZ_FRAG.boundsScene.max[1] + d.dy, 0)
      return
    case 'edgeA':
      st.pos.set((EDGE_A[0][0] + EDGE_A[1][0]) / 2, (EDGE_A[0][1] + EDGE_A[1][1]) / 2 + d.dy, (EDGE_A[0][2] + EDGE_A[1][2]) / 2)
      return
    case 'edgeC':
      st.pos.set((EDGE_C[0][0] + EDGE_C[1][0]) / 2 + 0.55, (EDGE_C[0][1] + EDGE_C[1][1]) / 2 + d.dy, (EDGE_C[0][2] + EDGE_C[1][2]) / 2)
      return
    case 'helix':
      st.pos.copy(p[HELIX_TOP]!)
      st.pos.y += R.Si + d.dy
      return
  }
}

const TRACKS: (Vec3Track | undefined)[] = SIO2_ATOMS.map((a) => POS[a.id])
const GROW_START: Float32Array = Float32Array.from(SIO2_ATOMS, (a) => GROWTH_ARRIVAL.get(a.id)?.start ?? -1)
const I_SILICON = SILICON_IDS.map(IDX)

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleSio2Frame(t: number, frame: Sio2Frame): Sio2Frame {
  frame.t = t
  const { pos, radius, opacity, material, emissive, delta, bond } = frame

  for (let i = 0; i < SIO2_ATOMS.length; i++) {
    const tr = TRACKS[i]
    if (tr) sampleVec3(tr, t, pos[i]!)
    emissive[i] = BASE_EMISSIVE
    delta[i] = 0
  }

  // ——— Сюжет: центральный Si, соседи, четыре O ———
  const appear = sampleScalar(APPEAR, t)
  const polarSi0 = sampleScalar(SIO2_SNAP.polarSi0, t)
  radius[I_SI0] = R.Si
  opacity[I_SI0] = appear
  material[I_SI0] = polarSi0 > 0.5 ? 'polar' : 'covalent'
  delta[I_SI0] = polarSi0 > 0.5 ? 1 : 0
  for (let k = 0; k < 4; k++) {
    const i = I_N[k]!
    const pol = sampleScalar(SIO2_SNAP.polarN[k]!, t)
    radius[i] = R.Si
    opacity[i] = appear
    material[i] = pol > 0.5 ? 'polar' : 'covalent'
    delta[i] = pol > 0.5 ? 1 : 0
  }
  for (let j = 0; j < 4; j++) {
    const i = I_O[j]!
    const pol = sampleScalar(SIO2_SNAP.polarO[j]!, t)
    radius[i] = R.O
    opacity[i] = appear
    material[i] = pol > 0.5 ? 'polar' : 'gas'
    delta[i] = pol > 0.5 ? -1 : 0
  }

  // ——— Остальной кремний: ячейка, затем уходит и гаснет полностью ———
  const restA = sampleScalar(REST_OPACITY, t)
  for (let k = 0; k < I_SILICON.length; k++) {
    const i = I_SILICON[k]!
    radius[i] = R.Si
    opacity[i] = restA
    material[i] = 'covalent'
  }

  // ——— Каркас: вершины (шаг 4) и остальной кварц (шаг 5) вырастают из точки ———
  for (let i = 0; i < SIO2_ATOMS.length; i++) {
    const kind = SIO2_ATOMS[i]!.kind
    if (kind !== 'vertex' && kind !== 'quartz') continue
    const a = GROW_START[i]!
    const grow = t <= a ? 0 : smoothstep(a, a + GROW.appear, t)
    const si = SIO2_ATOMS[i]!.el === 'Si'
    radius[i] = (si ? R.Si : R.O) * grow
    opacity[i] = grow * 3 >= 1 ? 1 : grow * 3
    material[i] = 'polar'
    delta[i] = si ? 1 : -1
  }

  // ——— CO₂ для сравнения ———
  const co2A = sampleScalar(CO2_OPACITY, t)
  radius[I_CC] = R.C
  radius[I_CO1] = R.O
  radius[I_CO2] = R.O
  for (const i of [I_CC, I_CO1, I_CO2]) {
    opacity[i] = co2A
    material[i] = 'covalent'
  }

  // ——— Связи ———
  for (let s = 0; s < SIO2_BONDS.length; s++) {
    const b = SIO2_BONDS[s]!
    const ends = Math.min(presence(frame, b.a), presence(frame, b.b))
    switch (b.group) {
      case 'siSi':
        bond[s] = b.k != null ? Math.min(ends, sampleScalar(SISI_K[b.k]!, t)) : ends
        break
      case 'oo':
        bond[s] = Math.min(ends, sampleScalar(b.a === I_O[0] ? OO_A : OO_B, t))
        break
      case 'story':
        bond[s] = Math.min(ends, sampleScalar(SIO_K[b.k!]!, t))
        break
      default:
        bond[s] = ends
    }
  }
  frame.ooStress[0] = smoothstep(T.brkA - 1.4, T.brkA, t)
  frame.ooStress[1] = smoothstep(T.brkB - 1.4, T.brkB, t)

  // ——— Рёбра ячеек ———
  if (t < EDGE_SWITCH_T) {
    frame.edgeSet = 'si'
    frame.edges = sampleScalar(SI_EDGES, t)
  } else {
    frame.edgeSet = 'quartz'
    frame.edges = sampleScalar(QUARTZ_EDGES, t)
  }

  // ——— Валентные точки O: 6 → 4 в кадр встраивания (count = valenceElectrons − связи Si–O) ———
  for (let j = 0; j < 4; j++) {
    const v = frame.valence[j]!
    const i = I_O[j]!
    v.center.copy(pos[i]!)
    v.radius = radius[i]! + DOT_GAP
    v.count = Math.round(sampleScalar(SIO2_SNAP.valenceO[j]!, t))
    const brk = j < 2 ? T.brkA : T.brkB
    const on = smoothstep(brk, brk + 0.5, t)
    const off = 1 - smoothstep(VALENCE_OFF - 0.6, VALENCE_OFF, t)
    v.amount = on * off
  }

  frame.guides.tetra = sampleScalar(GUIDE_TETRA, t)
  frame.guides.helix = sampleScalar(GUIDE_HELIX, t)
  frame.fx.glow = 0
  frame.fade = sampleScalar(FADE, t)

  // ——— Подписи ———
  _cur = frame
  sampleLabels(SIO2_LABELS, frame.labels, t, anchorLabel, frame.fade)
  _cur = null

  // ——— Камера ———
  const cam = frame.camera
  sampleShot(SIO2_CAMERA, t, cam)
  cam.shake = 0
  cam.bloom = BASE_BLOOM
  cam.vignette = Math.max(0.3, frame.fade)
  return frame
}

/** Растущие атомы каркаса и их полный радиус (для доли присутствия). */
const GROWS: readonly boolean[] = SIO2_ATOMS.map((a) => a.kind === 'vertex' || a.kind === 'quartz')
const FULL_R: Float32Array = Float32Array.from(SIO2_ATOMS, (a) => R[a.el])

/** Присутствие атома: для растущих — доля радиуса (связь вырастает вместе с шаром), для остальных — непрозрачность. */
function presence(frame: Sio2Frame, i: number): number {
  return GROWS[i] ? frame.radius[i]! / FULL_R[i]! : frame.opacity[i]!
}

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validateSio2Storyboard(): void {
  const vec: Record<string, Vec3Track> = {}
  for (const [id, track] of Object.entries(POS)) vec[`pos.${id}`] = track
  vec['cam.offset'] = SIO2_CAMERA.offset
  validateTracks(vec)
  const snaps: Record<string, ScalarTrack> = { polarSi0: SIO2_SNAP.polarSi0 }
  SIO2_SNAP.valenceO.forEach((tr, j) => (snaps[`valenceO${j}`] = tr))
  SIO2_SNAP.polarO.forEach((tr, j) => (snaps[`polarO${j}`] = tr))
  SIO2_SNAP.polarN.forEach((tr, j) => (snaps[`polarN${j}`] = tr))
  SISI_K.forEach((tr, j) => (snaps[`sisi${j}`] = tr))
  SIO_K.forEach((tr, j) => (snaps[`sio${j}`] = tr))
  validateTracks({
    ...snaps,
    APPEAR,
    REST_OPACITY,
    CO2_OPACITY,
    OO_A,
    OO_B,
    SI_EDGES,
    QUARTZ_EDGES,
    GUIDE_TETRA,
    GUIDE_HELIX,
    FADE,
    camZoom: SIO2_CAMERA.zoom,
    camYaw: SIO2_CAMERA.yaw,
    camPitch: SIO2_CAMERA.pitch,
  })

  if (SI_FRAG.sites.length !== 18) throw new Error(`sio2: ячейка Si — 18 атомов, а не ${SI_FRAG.sites.length}`)
  if (neighborsOf(SI_FRAG, SI_C).length !== SI.coordination.Si) throw new Error('sio2: у центрального Si не КЧ ядра')
  if (Q0_O.length !== QZ.coordination.Si) throw new Error('sio2: у Si тетраэдра не КЧ ядра')
  if (new Set(QS).size !== 4) throw new Error('sio2: четыре мостика должны вести к четырём разным Si')
  // Поворот ячейки собственный: det = +1.
  const m = ALIGN.rot
  const det = dot(m[0], cross(m[1], m[2]))
  if (Math.abs(det - 1) > 1e-9) throw new Error(`sio2: поворот ячейки не собственный (det ${det})`)
  // Каждый атом каркаса окружён только атомами другого элемента.
  for (const [i, j] of QUARTZ_FRAG.bonds) {
    if (QUARTZ_FRAG.sites[i]!.el === QUARTZ_FRAG.sites[j]!.el) throw new Error('sio2: в каркасе связь между одинаковыми атомами')
  }
  // Встраивания идут по порядку и внутри шага 3.
  for (let k = 0; k < INS.length; k++) {
    if (!(INS[k]! > stepFrom(2) && INS[k]! + T.insMove < stepTo(2))) throw new Error(`sio2: встраивание ${k} вне шага 3`)
  }
  if (SIO2_END <= stepTo(LAST_STEP)) throw new Error('sio2: хвост сцены пустой')
}
