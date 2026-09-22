import * as THREE from 'three'
import { ATOMIC_DATA, bondLengthPm, getCrystal, radiusForSpecies, type ElementSymbol } from '../../../../chemistry/data'
import { smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, windowFade, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { sampleShot, shotTrack, orbitTrack, type ShotTrack } from '../kit/camera'
import { bondLength, LATTICE_BALL_SCALE, pmToScene, SPECIES_SCALE, speciesRadius } from '../kit/cpkAtoms'
import { createElectronJump, sampleElectronJump, type ElectronJump } from '../kit/electronFx'
import { coordinationShell, latticeCaption, latticeFragment, type LatticeFragment, type LatticeSegment } from '../kit/lattice'
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
import { octetSnap, OCTET_SNAP_EPS } from '../kit/valence'
import { PBO_DHF_KJ } from './pboEnergetics'
import { PBO_ELECTRONS, PBO_END, PBO_FINISH, PBO_STEPS, pboCueAt } from './pboSteps'

export {
  PBO_CUES,
  PBO_ELECTRONS,
  PBO_END,
  PBO_FINISH,
  PBO_SEGMENTS,
  PBO_STEPS,
  PBO_STEP_IDS,
  PBO_TIMING,
  pboStepIndexAt,
  type PboCueId,
  type PboStepId,
} from './pboSteps'

/**
 * Раскадровка 2 Pb (тв.) + O₂ (г.) → 2 PbO (тв.) — ЧИСТАЯ функция времени сюжета (рецепт эталона nacl).
 *
 * Ни одного числа химии: геометрия — из crystalData через kit/lattice (ячейка ГЦК свинца 1×1×1,
 * массикот 2×2×2, глёт 2×2×2), длина O=O — из bondData, радиусы — из ядра: Pb⁰ металлический, O⁰
 * ковалентный (Кордеро), Pb²⁺ и O²⁻ — Шеннон при ФАКТИЧЕСКОМ КЧ структуры (coordination кристалла:
 * Pb²⁺ КЧ 4, а не 6), энергия — из цикла, число электронов 6s² — из электронной конфигурации ядра.
 *
 * Правила эталона, выполненные по построению:
 *   • у каждого атома span [первый, последний шаг]; вне него непрозрачность строго 0;
 *   • каждый видимый атом подписан или покрыт подписью группы (label.hosts);
 *   • заряд донора растёт ступенью в кадр УХОДА электрона, акцептора — в кадр ПРИХОДА:
 *     Σ зарядов + (−1)·(летящие e⁻) = 0 в любой кадр; радиус меняется ступенью, когда ион
 *     стал Pb²⁺ (уход второго e⁻) и O²⁻ (приход второго e⁻) — у Шеннона нет Pb⁺ и O⁻;
 *   • решётки — целое число ячеек, рёбра ячеек отдельным слоем; связей Pb–O-палочек нет —
 *     пирамида PbO₄ одного атома показана пунктиром координационного многогранника;
 *   • пары 6s² у Pb²⁺ глёта смотрят в щель между слоями (от своих четырёх O) — схема, названа в note;
 *   • финал без огня, ореолов и свечения внутри кристалла: все FX-амплитуды → 0.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

const METAL = getCrystal('pb_metal')!
const MASS = getCrystal('massicot')!
const LITH = getCrystal('litharge')!

/** Одна ГЦК-ячейка свинца: 8 вершин + 6 центров граней. */
export const METAL_FRAG = latticeFragment('pb_metal', [1, 1, 1])
/** Массикот β-PbO (Pbcm): 2×2×2 ячейки. */
export const MASS_FRAG = latticeFragment('massicot', [2, 2, 2])
/** Глёт α-PbO (P4/nmm): 2×2×2 ячейки, ось c — вверх (слои горизонтальны). */
export const LITH_FRAG = latticeFragment('litharge', [2, 2, 2])

/** Подписи решёток — только символы и числа (latticeCaption). */
export const METAL_CAPTION = latticeCaption('pb_metal')
export const MASS_CAPTION = latticeCaption('massicot')
export const LITH_CAPTION = latticeCaption('litharge')

/**
 * Немая подсказка ЦВЕТА ВЕЩЕСТВА (не CPK): светящаяся рамка вокруг фрагмента модификации.
 * Шары решётки окрашены по CPK (O — красный, Pb — серый), и красный шар O легко принять за «красный
 * глёт». Поэтому цвет самого вещества — жёлтый массикот, красный глёт (nameRu ядра, ГЛАВНЫЙ
 * ДОКУМЕНТ §4) — показан отдельно, рамкой. Это цвет рисунка, а не число химии.
 */
export const PBO_PHASE_TINT = {
  massicot: 0xf2c94c,
  litharge: 0xd9542b,
} as const
export type PboTintPhase = keyof typeof PBO_PHASE_TINT

/** Габарит фрагмента (по рёбрам его ячеек) — рамка цвета вещества идёт чуть снаружи. */
function fragmentBox(frag: LatticeFragment): { min: [number, number, number]; max: [number, number, number] } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const [p, q] of frag.cellEdges) {
    for (const v of [p, q]) {
      for (let k = 0; k < 3; k++) {
        if (v[k]! < min[k]!) min[k] = v[k]!
        if (v[k]! > max[k]!) max[k] = v[k]!
      }
    }
  }
  return { min, max }
}
export const PBO_TINT_BOX: Readonly<Record<PboTintPhase, { min: readonly [number, number, number]; max: readonly [number, number, number] }>> = {
  massicot: fragmentBox(MASS_FRAG),
  litharge: fragmentBox(LITH_FRAG),
}

/** Фактические КЧ из crystalData (в обеих модификациях PbO — 4:4). */
const CN_PB = LITH.coordination['Pb²⁺']!
const CN_O = LITH.coordination['O²⁻']!

/** Радиусы ионов, пм: Шеннон при фактическом КЧ. */
export const PBO_ION_RADIUS_PM = {
  pb: radiusForSpecies('Pb', 2, { cn: CN_PB }),
  o: radiusForSpecies('O', -2, { cn: CN_O }),
} as const

/** Радиус иона при КЧ структуры в мировых единицах, доля scale. */
const ionR = (pm: number, scale: number) => pmToScene(pm) * scale

const R = {
  pb: speciesRadius('Pb', 0),
  pbIon: ionR(PBO_ION_RADIUS_PM.pb, SPECIES_SCALE),
  o: speciesRadius('O', 0),
  oIon: ionR(PBO_ION_RADIUS_PM.o, SPECIES_SCALE),
} as const

/** Ионы фрагментов: доля радиуса как у героя — сквозь фрагмент видны рёбра ячеек. */
const R_LATTICE = {
  pbIon: ionR(PBO_ION_RADIUS_PM.pb, LATTICE_BALL_SCALE),
  oIon: ionR(PBO_ION_RADIUS_PM.o, LATTICE_BALL_SCALE),
} as const

/** Половина длины O=O. */
const OH = bondLength('O=O') / 2

/** Зазор валентных точек над поверхностью атома (параметр рисунка, не химия). */
const DOT_GAP = 0.07

/**
 * Электронов в паре ns² свинца — из электронной конфигурации ядра ('… 6s² 6p²'): эти два
 * электрона Pb²⁺ сохраняет (стереоактивная пара), уходят только np-электроны.
 */
export const PB_S_PAIR = (() => {
  const SUP: Record<string, number> = { '¹': 1, '²': 2 }
  const m = /\ds([¹²])(?!.*\ds[¹²])/.exec(ATOMIC_DATA.Pb.configuration)
  if (!m) throw new Error('pbo: в конфигурации Pb нет внешней s-подоболочки')
  return SUP[m[1]!]!
})()

// ─────────────────────────────────────────────────────────────────────────────
// Выбор узлов сюжета
// ─────────────────────────────────────────────────────────────────────────────

type V3 = readonly [number, number, number]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Узлы с полной координационной сферой (все КЧ соседей внутри фрагмента). */
function fullShell(frag: LatticeFragment, i: number): boolean {
  return coordinationShell(frag, i).neighbors.length === frag.sites[i]!.cn
}

/**
 * Глёт: pb1 (верхняя половина) и pb2 (нижняя) — передние Pb с полной пирамидой PbO₄; их партнёры
 * oA / oB — соседний O справа (из той же пирамиды). Так пирамида pb1 целиком во фрагменте.
 */
const LITH_STORY = (() => {
  const pbs = LITH_FRAG.sites.map((s, i) => ({ s, i })).filter(({ s, i }) => s.el === 'Pb' && fullShell(LITH_FRAG, i))
  const score = (p: V3) => p[2] - 0.3 * Math.abs(p[0])
  const pick = (up: boolean) => {
    const c = pbs.filter(({ s }) => (up ? s.posScene[1] > 0 : s.posScene[1] < 0))
    c.sort((a, b) => score(b.s.posScene) - score(a.s.posScene) || a.i - b.i)
    return c[0]!.i
  }
  const pb1 = pick(true)
  const pb2 = pick(false)
  const rightO = (pb: number, not: number) => {
    const nb = coordinationShell(LITH_FRAG, pb).neighbors.filter((j) => j !== not)
    nb.sort((a, b) => LITH_FRAG.sites[b]!.posScene[0] - LITH_FRAG.sites[a]!.posScene[0] || LITH_FRAG.sites[b]!.posScene[2] - LITH_FRAG.sites[a]!.posScene[2])
    return nb[0]!
  }
  const oA = rightO(pb1, -1)
  const oB = rightO(pb2, oA)
  return { pb1, oA, pb2, oB }
})()

/** Массикот: для каждой пары глёта — ближайшая связанная пара Pb–O массикота (короткий перелёт на шаге 5). */
const MASS_STORY = (() => {
  const pairs: [number, number][] = []
  for (const [i, j] of MASS_FRAG.bonds) {
    const a = MASS_FRAG.sites[i]!
    const b = MASS_FRAG.sites[j]!
    if (a.el === 'Pb' && b.el === 'O') pairs.push([i, j])
    else if (a.el === 'O' && b.el === 'Pb') pairs.push([j, i])
  }
  const cost = ([pb, o]: [number, number], lpb: number, lo: number) =>
    dist(MASS_FRAG.sites[pb]!.posScene, LITH_FRAG.sites[lpb]!.posScene) + dist(MASS_FRAG.sites[o]!.posScene, LITH_FRAG.sites[lo]!.posScene)
  const best = (lpb: number, lo: number, used: Set<number>) => {
    const c = pairs.filter(([pb, o]) => !used.has(pb) && !used.has(o))
    c.sort((x, y) => cost(x, lpb, lo) - cost(y, lpb, lo) || x[0] - y[0] || x[1] - y[1])
    return c[0]!
  }
  const used = new Set<number>()
  const [pb1, oA] = best(LITH_STORY.pb1, LITH_STORY.oA, used)
  used.add(pb1).add(oA)
  const [pb2, oB] = best(LITH_STORY.pb2, LITH_STORY.oB, used)
  return { pb1, oA, pb2, oB }
})()

/** Атомы металла: pb1 / pb2 — вершины ячейки со стороны кислорода (x > 0, спереди). */
function metalSite(sx: number, sy: number, sz: number): number {
  const idx = METAL_FRAG.sites.findIndex(
    (s) => Math.sign(Math.round(s.posScene[0] * 1e6)) === sx && Math.sign(Math.round(s.posScene[1] * 1e6)) === sy && Math.sign(Math.round(s.posScene[2] * 1e6)) === sz,
  )
  if (idx < 0) throw new Error('pbo: нет вершины ГЦК-ячейки')
  return idx
}
const METAL_PB1 = metalSite(1, 1, 1)
const METAL_PB2 = metalSite(1, -1, 1)
const METAL_REST = METAL_FRAG.sites.map((_, i) => i).filter((i) => i !== METAL_PB1 && i !== METAL_PB2)

const STORY_IDS = ['pb1', 'pb2', 'oA', 'oB'] as const
type StoryId = (typeof STORY_IDS)[number]
const MASS_STORY_SET = new Set<number>(Object.values(MASS_STORY))
const LITH_STORY_SET = new Set<number>(Object.values(LITH_STORY))
const MASS_REST = MASS_FRAG.sites.map((_, i) => i).filter((i) => !MASS_STORY_SET.has(i))
const LITH_REST = LITH_FRAG.sites.map((_, i) => i).filter((i) => !LITH_STORY_SET.has(i))

// ─────────────────────────────────────────────────────────────────────────────
// Состав кадра
// ─────────────────────────────────────────────────────────────────────────────

export type PboElement = 'Pb' | 'O'
export type PboAtomKind = 'story' | 'metal' | 'massicot' | 'litharge'

export type PboAtomDef = {
  id: string
  el: PboElement
  kind: PboAtomKind
  /** индексы шагов [первый, последний], на которых атом имеет право быть видимым */
  span: readonly [number, number]
}

const stepFrom = (i: number) => PBO_STEPS[i]!.from
const stepTo = (i: number) => PBO_STEPS[i]!.to
const LAST_STEP = PBO_STEPS.length - 1
const S_MASS = PBO_STEPS.findIndex((s) => s.id === 'massicot')
const S_LITH = PBO_STEPS.findIndex((s) => s.id === 'litharge')

export const PBO_ATOMS: readonly PboAtomDef[] = [
  { id: 'pb1', el: 'Pb', kind: 'story', span: [0, LAST_STEP] },
  { id: 'pb2', el: 'Pb', kind: 'story', span: [0, LAST_STEP] },
  { id: 'oA', el: 'O', kind: 'story', span: [0, LAST_STEP] },
  { id: 'oB', el: 'O', kind: 'story', span: [0, LAST_STEP] },
  ...METAL_REST.map((_, k) => ({ id: `M${k}`, el: 'Pb' as PboElement, kind: 'metal' as const, span: [0, 1] as const })),
  ...MASS_REST.map((si, k) => ({ id: `B${k}`, el: MASS_FRAG.sites[si]!.el as PboElement, kind: 'massicot' as const, span: [S_MASS, S_LITH] as const })),
  ...LITH_REST.map((si, k) => ({ id: `A${k}`, el: LITH_FRAG.sites[si]!.el as PboElement, kind: 'litharge' as const, span: [S_LITH, LAST_STEP] as const })),
]

export const PBO_ATOM_INDEX: ReadonlyMap<string, number> = new Map(PBO_ATOMS.map((a, i) => [a.id, i]))
const IDX = (id: string) => PBO_ATOM_INDEX.get(id)!
const I_PB1 = IDX('pb1')
const I_PB2 = IDX('pb2')
const I_OA = IDX('oA')
const I_OB = IDX('oB')
const STORY_INDEX = [I_PB1, I_PB2, I_OA, I_OB] as const
const METAL_IDS = PBO_ATOMS.filter((a) => a.kind === 'metal').map((a) => a.id)
const MASS_IDS = PBO_ATOMS.filter((a) => a.kind === 'massicot').map((a) => a.id)
const LITH_IDS = PBO_ATOMS.filter((a) => a.kind === 'litharge').map((a) => a.id)

/** Узел фрагмента для атома кадра. */
export const METAL_SITE_OF: ReadonlyMap<string, number> = new Map<string, number>([
  ['pb1', METAL_PB1],
  ['pb2', METAL_PB2],
  ...METAL_REST.map((si, k) => [`M${k}`, si] as [string, number]),
])
export const MASS_SITE_OF: ReadonlyMap<string, number> = new Map<string, number>([
  ...STORY_IDS.map((id) => [id, MASS_STORY[id]] as [string, number]),
  ...MASS_REST.map((si, k) => [`B${k}`, si] as [string, number]),
])
export const LITH_SITE_OF: ReadonlyMap<string, number> = new Map<string, number>([
  ...STORY_IDS.map((id) => [id, LITH_STORY[id]] as [string, number]),
  ...LITH_REST.map((si, k) => [`A${k}`, si] as [string, number]),
])

/** Металлические связи ГЦК-ячейки: соседи на a/√2 (первая сфера, КЧ 12). */
export const METAL_BONDS: readonly (readonly [string, string])[] = METAL_FRAG.bonds.map(([i, j]) => {
  const byIdx = (si: number) => [...METAL_SITE_OF.entries()].find(([, v]) => v === si)![0]
  return [byIdx(i), byIdx(j)] as const
})

const idOfLith = (si: number) => [...LITH_SITE_OF.entries()].find(([, v]) => v === si)![0]

/** Пирамида PbO₄ атома pb1 в глёте: вершина — Pb, основание — четыре O (рёбра квадрата). */
export const PBO_PYRAMID = (() => {
  const sh = coordinationShell(LITH_FRAG, LITH_STORY.pb1)
  return {
    apex: 'pb1',
    base: sh.neighbors.map(idOfLith),
    baseEdges: sh.edges.map(([a, b]) => [idOfLith(a), idOfLith(b)] as const),
    distancesPm: sh.distancesPm,
  }
})()

/**
 * Пары 6s²: у каждого Pb²⁺ глёта — направление ±Y (ось c), ОТ своих четырёх O — в щель между слоями.
 * 0 — не Pb глёта. Для атомов сюжета — направление в их узле глёта.
 */
export const PBO_LONE_DIR: Float32Array = (() => {
  const out = new Float32Array(PBO_ATOMS.length)
  for (const [id, si] of LITH_SITE_OF) {
    if (LITH_FRAG.sites[si]!.el !== 'Pb') continue
    const sh = coordinationShell(LITH_FRAG, si)
    const y = LITH_FRAG.sites[si]!.posScene[1]
    let yo = 0
    let n = 0
    // Ближайший слой O: даже у Pb на краю фрагмента хотя бы один сосед есть.
    for (const j of sh.neighbors) {
      yo += LITH_FRAG.sites[j]!.posScene[1]
      n++
    }
    if (n === 0) throw new Error(`pbo: у Pb ${id} в глёте нет соседей O`)
    out[IDX(id)] = y - yo / n > 0 ? 1 : -1
  }
  return out
})()

/**
 * Щель между слоями: пара Pb²⁺ с парами 6s², смотрящими друг на друга (нижний смотрит вверх, верхний —
 * вниз), без слоя O между ними; кратчайшая такая пара, спереди. Расстояние — из ячейки и z(Pb) ядра.
 */
export const PBO_GAP = (() => {
  let best: { a: string; b: string; d: number; score: number } | null = null
  const pb = [...LITH_SITE_OF.entries()].filter(([, si]) => LITH_FRAG.sites[si]!.el === 'Pb')
  for (const [ia, sa] of pb) {
    for (const [ib, sb] of pb) {
      const pa = LITH_FRAG.sites[sa]!.posScene
      const pbp = LITH_FRAG.sites[sb]!.posScene
      if (!(pbp[1] > pa[1])) continue
      if (PBO_LONE_DIR[IDX(ia)] !== 1 || PBO_LONE_DIR[IDX(ib)] !== -1) continue
      const d = LITH_FRAG.posPm[sa]!
      const e = LITH_FRAG.posPm[sb]!
      const dPm = Math.hypot(d[0] - e[0], d[1] - e[1], d[2] - e[2])
      const score = dPm * 1000 - (pa[2] + pbp[2]) + 0.01 * Math.abs(pa[0] + pbp[0])
      if (!best || score < best.score - 1e-9) best = { a: ia, b: ib, d: dPm, score }
    }
  }
  if (!best) throw new Error('pbo: в глёте не нашлось щели между слоями')
  return { a: best.a, b: best.b, pm: best.d }
})()

// ─────────────────────────────────────────────────────────────────────────────
// Положения
// ─────────────────────────────────────────────────────────────────────────────

const massPos = (si: number): V3 => MASS_FRAG.sites[si]!.posScene
const lithPos = (si: number): V3 => LITH_FRAG.sites[si]!.posScene

/** Плоскость действия шагов 1–3 — глубина узлов сюжета в массикоте (они встают туда на шаге 4). */
const STAGE_Z = STORY_IDS.reduce((s, id) => s + massPos(MASS_STORY[id])[2], 0) / STORY_IDS.length

/** Центр ячейки металла (слева) и молекулы O₂ (справа) на шаге 1. */
const METAL_CENTER: V3 = [-1.6, 0, STAGE_Z]
const O2_CENTER: V3 = [1.6, 0, STAGE_Z]
export const PBO_METAL_OFFSET = METAL_CENTER

const metalPos = (si: number): V3 => add(METAL_CENTER, METAL_FRAG.sites[si]!.posScene)

/** Свободные атомы перед переходом электронов (шаг 3): две пары Pb … O одна над другой. */
const FREE: Record<StoryId, V3> = {
  pb1: [-0.95, 0.55, STAGE_Z],
  pb2: [-0.95, -0.55, STAGE_Z],
  oA: [0.75, 0.55, STAGE_Z],
  oB: [0.75, -0.55, STAGE_Z],
}

const T = {
  sub1: pboCueAt('sublimate'),
  sub2: pboCueAt('sublimate') + 0.4,
  brk: pboCueAt('bondBreak'),
  massicot: pboCueAt('massicot'),
  lattice: pboCueAt('lattice'),
  e1: PBO_ELECTRONS.e1,
  e2: PBO_ELECTRONS.e2,
  e3: PBO_ELECTRONS.e3,
  e4: PBO_ELECTRONS.e4,
}

const T_MOVE_MASS = { from: stepFrom(S_MASS) + 0.3, to: stepFrom(S_MASS) + 1.9 }
const T_MOVE_LITH = { from: stepFrom(S_LITH) + 0.9, to: stepFrom(S_LITH) + 2.5 }

/**
 * МАСШТАБ ШАРОВ частиц сюжета относительно SPECIES_SCALE (параметр рисунка, не химия): 1 на шагах 1–3,
 * при входе в массикот — доля решётки. Отношения радиусов в любой кадр одни и те же.
 */
export const PBO_DRAW_SCALE: ScalarTrack = [
  { t: T_MOVE_MASS.from, v: 1 },
  { t: T_MOVE_MASS.to, v: LATTICE_BALL_SCALE / SPECIES_SCALE, ease: 'smooth' },
]

const POS: Record<string, Vec3Track> = {}
{
  const story = (id: StoryId, t0: V3, detach: number, free: number, arc: number): Vec3Track => [
    { t: 0, v: t0 },
    { t: detach, v: t0 },
    { t: free, v: FREE[id], ease: 'smooth', arc },
    { t: T_MOVE_MASS.from, v: FREE[id] },
    { t: T_MOVE_MASS.to, v: massPos(MASS_STORY[id]), ease: 'smooth' },
    { t: T_MOVE_LITH.from, v: massPos(MASS_STORY[id]) },
    { t: T_MOVE_LITH.to, v: lithPos(LITH_STORY[id]), ease: 'smooth' },
  ]
  POS.pb1 = story('pb1', metalPos(METAL_PB1), T.sub1 - 0.3, T.sub1 + 1.5, 0.2)
  POS.pb2 = story('pb2', metalPos(METAL_PB2), T.sub2 - 0.3, T.sub2 + 1.5, -0.2)
  // O=O: натяжение перед разрывом (связь чуть удлиняется), потом атомы расходятся.
  const oTrack = (id: 'oA' | 'oB', sgn: number): Vec3Track => [
    { t: 0, v: add(O2_CENTER, [0, sgn * OH, 0]) },
    { t: T.brk - 1.4, v: add(O2_CENTER, [0, sgn * OH, 0]) },
    { t: T.brk, v: add(O2_CENTER, [0, sgn * (OH + 0.05), 0]), ease: 'inQuad' },
    { t: T.brk + 1.3, v: FREE[id], ease: 'smooth' },
    { t: T_MOVE_MASS.from, v: FREE[id] },
    { t: T_MOVE_MASS.to, v: massPos(MASS_STORY[id]), ease: 'smooth' },
    { t: T_MOVE_LITH.from, v: massPos(MASS_STORY[id]) },
    { t: T_MOVE_LITH.to, v: lithPos(LITH_STORY[id]), ease: 'smooth' },
  ]
  POS.oA = oTrack('oA', 1)
  POS.oB = oTrack('oB', -1)
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
 * Рост фрагмента: ионы подлетают к узлам радиально (к центру пар сюжета), ближние раньше; каждый
 * вырастает из точки за GROW.appear с. Распад массикота на шаге 5 — то же в обратную сторону
 * (дальние раньше): ионы уходят наружу и сжимаются в точку. Параметры рисунка, не химия.
 */
type GrowPlan = { from: number; to: number; flight: number; appear: number; reach: number }
const GROW_MASS: GrowPlan = { from: stepFrom(S_MASS) + 0.8, to: T.massicot - 0.4, flight: 1.2, appear: 0.7, reach: 0.9 }
const VANISH_MASS: GrowPlan = { from: stepFrom(S_LITH) + 0.3, to: stepFrom(S_LITH) + 1.7, flight: 0.8, appear: 0.7, reach: 0.9 }
const GROW_LITH: GrowPlan = { from: stepFrom(S_LITH) + 1.5, to: T.lattice - 0.4, flight: 1.2, appear: 0.7, reach: 0.9 }

const centroid = (pts: V3[]): V3 => scale(pts.reduce((s, p) => add(s, p), [0, 0, 0] as V3), 1 / pts.length)
const MASS_CENTROID = centroid(STORY_IDS.map((id) => massPos(MASS_STORY[id])))
const LITH_CENTROID = centroid(STORY_IDS.map((id) => lithPos(LITH_STORY[id])))

/** Моменты старта для группы: по расстоянию до центра (near = ближние первыми). */
function schedule(ids: readonly string[], posOf: (id: string) => V3, c: V3, plan: GrowPlan, nearFirst: boolean): Map<string, number> {
  const ranked = ids
    .map((id) => ({ id, d: dist(posOf(id), c) }))
    .sort((a, b) => (nearFirst ? a.d - b.d : b.d - a.d) || a.id.localeCompare(b.id))
  const out = new Map<string, number>()
  ranked.forEach((r, rank) => out.set(r.id, plan.from + (rank / Math.max(1, ranked.length - 1)) * (plan.to - plan.from - plan.flight)))
  return out
}
const massOf = (id: string) => massPos(MASS_SITE_OF.get(id)!)
const lithOf = (id: string) => lithPos(LITH_SITE_OF.get(id)!)
export const MASS_ARRIVAL = schedule(MASS_IDS, massOf, MASS_CENTROID, GROW_MASS, true)
export const MASS_LEAVE = schedule(MASS_IDS, massOf, MASS_CENTROID, VANISH_MASS, false)
export const LITH_ARRIVAL = schedule(LITH_IDS, lithOf, LITH_CENTROID, GROW_LITH, true)

const outward = (p: V3, c: V3, reach: number): V3 => {
  const d: V3 = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]
  const len = Math.hypot(d[0], d[1], d[2]) || 1
  return add(p, scale(d, reach / len))
}
for (const id of MASS_IDS) {
  const p = massOf(id)
  const far = outward(p, MASS_CENTROID, GROW_MASS.reach)
  const a = MASS_ARRIVAL.get(id)!
  const l = MASS_LEAVE.get(id)!
  POS[id] = [
    { t: a, v: far },
    { t: a + GROW_MASS.flight, v: p, ease: 'smooth' },
    { t: l, v: p },
    { t: l + VANISH_MASS.flight, v: outward(p, MASS_CENTROID, VANISH_MASS.reach), ease: 'smooth' },
  ]
}
for (const id of LITH_IDS) {
  const p = lithOf(id)
  const a = LITH_ARRIVAL.get(id)!
  POS[id] = [
    { t: a, v: outward(p, LITH_CENTROID, GROW_LITH.reach) },
    { t: a + GROW_LITH.flight, v: p, ease: 'smooth' },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

/** Две ступени подряд: v0 → v1 в t1, v1 → v2 в t2 (ease 'step', как octetSnap). */
function twoSteps(t1: number, t2: number, v0: number, v1: number, v2: number): ScalarTrack {
  return [
    { t: t1 - OCTET_SNAP_EPS, v: v0 },
    { t: t1, v: v1, ease: 'step' },
    { t: t2 - OCTET_SNAP_EPS, v: v1 },
    { t: t2, v: v2, ease: 'step' },
  ]
}

/**
 * РАДИУС И ЗАРЯД МЕНЯЮТСЯ СТУПЕНЬЮ. Заряд донора — в кадр ухода каждого электрона (Pb → Pb⁺ → Pb²⁺),
 * акцептора — в кадр прихода (O → O⁻ → O²⁻). Радиус — когда ион готов: Pb²⁺ (уход второго e⁻,
 * Шеннон при КЧ 4) и O²⁻ (приход второго e⁻); радиусов Pb⁺ и O⁻ у Шеннона нет (названо в note).
 */
export const PBO_SNAP = {
  radiusPb1: octetSnap(T.e2.leave, R.pb, R.pbIon),
  radiusPb2: octetSnap(T.e4.leave, R.pb, R.pbIon),
  radiusOA: octetSnap(T.e2.arrive, R.o, R.oIon),
  radiusOB: octetSnap(T.e4.arrive, R.o, R.oIon),
  chargePb1: twoSteps(T.e1.leave, T.e2.leave, 0, 1, 2),
  chargePb2: twoSteps(T.e3.leave, T.e4.leave, 0, 1, 2),
  chargeOA: twoSteps(T.e1.arrive, T.e2.arrive, 0, -1, -2),
  chargeOB: twoSteps(T.e3.arrive, T.e4.arrive, 0, -1, -2),
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

/** Двойная связь O=O: натяжение, затем ГОМОЛИТИЧЕСКИЙ разрыв (split = 0 в сцене). */
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

/** Рёбра ячеек: ячейка свинца (шаг 1), ячейки массикота (шаг 4), ячейки глёта (шаг 5 → финал). */
const METAL_EDGES: ScalarTrack = [
  { t: 0.2, v: 0 },
  { t: 1.0, v: 1, ease: 'smooth' },
  { t: stepTo(0), v: 1 },
  { t: T.sub1 - 0.1, v: 0, ease: 'smooth' },
]
const MASS_EDGES: ScalarTrack = [
  { t: T.massicot - 0.8, v: 0 },
  { t: T.massicot, v: 1, ease: 'smooth' },
  { t: stepFrom(S_LITH) + 0.1, v: 1 },
  { t: stepFrom(S_LITH) + 0.7, v: 0, ease: 'smooth' },
]
const LITH_EDGES: ScalarTrack = [
  { t: T.lattice - 0.8, v: 0 },
  { t: T.lattice, v: 1, ease: 'smooth' },
  { t: PBO_FINISH.from, v: 1 },
  { t: PBO_FINISH.to, v: 0, ease: 'smooth' },
]
/** Моменты смены набора рёбер в пуле (обе соседние дорожки в этот момент = 0). */
export const EDGE_SWITCH = { massicot: stepFrom(2), litharge: stepFrom(S_LITH) + 0.9 } as const

/**
 * Валентные облака: у Pb четыре точки (6s² парой + 6p² поодиночке), у O шесть. Загораются в конце
 * шага 2 — на паузе ученик видит «до», на паузе шага 3 — «после» (у Pb²⁺ осталась пара 6s², у O²⁻ октет).
 */
const VALENCE_WIN = { from: stepTo(1) - 0.9, off: stepFrom(S_MASS) + 1.0 }
const ELECTRON_LEAD = 0.6

/** Пары 6s² глёта, пирамида PbO₄ и щель: видны на паузе шага 5, гаснут в начале шага 6. */
export const PBO_LATTICE_FX_WIN: readonly [number, number] = [T.lattice - 0.3, stepTo(S_LITH) + 0.5]
export const PBO_LATTICE_FX_FADE = 0.35

const FADE = fadeTrack(PBO_FINISH)

/**
 * Камера — планы (kit/camera): общий план реагентов, наезд на электроны, отъезд на массикот,
 * вид сбоку на слои глёта и медленный облёт на финале.
 */
export const PBO_CAMERA: ShotTrack = shotTrack([
  { t: 0, zoom: 0.72, target: [0, 0, STAGE_Z] },
  { t: stepTo(0), zoom: 0.74 },
  { t: stepFrom(1) + 3.4, zoom: 0.92, target: [-0.1, 0, STAGE_Z] },
  { t: stepTo(2), zoom: 0.98 },
  { t: T.massicot - 0.6, zoom: 0.62, yaw: 0.35, pitch: 0.2, target: [0, 0, 0] },
  { t: stepTo(S_MASS), zoom: 0.62 },
  { t: T.lattice - 0.4, zoom: 0.74, yaw: 0.25, pitch: 0.1, target: [0, 0, 0] },
  ...orbitTrack(stepFrom(LAST_STEP), stepTo(LAST_STEP), 0.25, 0.75, 0.14, 0.72),
])

const BASE_EMISSIVE = 0.08
const BASE_BLOOM = 0.3

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D — только формулы, заряды, числа и символы единиц (токены)
// ─────────────────────────────────────────────────────────────────────────────

export type PboLabelDef = SceneLabelDef & {
  anchor:
    | 'atom'
    | 'metal'
    | 'metalEdge'
    | 'o2'
    | 'ooBond'
    | 'electron'
    | 'massAbove'
    | 'lithAbove'
    | 'edgeA'
    | 'edgeC'
    | 'apex'
    | 'pboBond'
    | 'lonePair'
    | 'gap'
  atom?: string
  /** индекс электрона для anchor 'electron' */
  electron?: number
  dx?: number
  hosts: readonly string[]
}

/** Число ядра для подписи: не больше двух знаков после точки, без хвостовых нулей (120.75, 232.1). */
const fmtCore = (v: number) => String(Math.round(v * 100) / 100)
/** Одна десятая (выведенные величины: щель Pb···Pb, ΔH°f по циклу). */
const fmt1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1)
const signed = (v: number) => (v < 0 ? `−${fmt1(-v)}` : `+${fmt1(v)}`)

const W_STORY_END = T_MOVE_MASS.to + 0.6
const MASS_END = VANISH_MASS.to

export const PBO_LABELS: readonly PboLabelDef[] = [
  // Шаг 1: металл и молекула
  { id: 'metal', kind: 'species', anchor: 'metal', dy: 1.05, keys: [{ t: 0, text: 'Pb ({s})' }], windows: [[0.2, T_METAL_OUT.to]], hosts: [...METAL_IDS, 'pb1', 'pb2'] },
  { id: 'metalA', kind: 'measure', anchor: 'metalEdge', dy: -0.95, keys: [{ t: 0, text: METAL_CAPTION[0]! }], windows: [[0.6, T.sub1]], hosts: [] },
  { id: 'o2', kind: 'species', anchor: 'o2', dy: 0.55, keys: [{ t: 0, text: 'O₂ ({g})' }], windows: [[0.2, T.brk]], hosts: ['oA', 'oB'] },
  { id: 'ooBond', kind: 'measure', anchor: 'ooBond', dy: 0, keys: [{ t: 0, text: `${fmtCore(bondLengthPm('O=O'))} {pm}` }], windows: [[0.6, T.brk - 0.3]], hosts: [] },
  // Шаги 2–4: частицы сюжета; заряд донора — в кадр ухода, акцептора — в кадр прихода
  { id: 'pb1', kind: 'species', anchor: 'atom', atom: 'pb1', dy: 0.16, keys: [{ t: 0, text: 'Pb ({g})' }, { t: T.e1.leave, text: 'Pb⁺' }, { t: T.e2.leave, text: 'Pb²⁺' }], windows: [[T.sub1, W_STORY_END]], hosts: ['pb1'] },
  { id: 'pb2', kind: 'species', anchor: 'atom', atom: 'pb2', dy: -0.16, keys: [{ t: 0, text: 'Pb ({g})' }, { t: T.e3.leave, text: 'Pb⁺' }, { t: T.e4.leave, text: 'Pb²⁺' }], windows: [[T.sub2, W_STORY_END]], hosts: ['pb2'] },
  { id: 'oA', kind: 'species', anchor: 'atom', atom: 'oA', dy: 0.16, keys: [{ t: 0, text: 'O ({g})' }, { t: T.e1.arrive, text: 'O⁻' }, { t: T.e2.arrive, text: 'O²⁻' }], windows: [[T.brk, W_STORY_END]], hosts: ['oA'] },
  { id: 'oB', kind: 'species', anchor: 'atom', atom: 'oB', dy: -0.16, keys: [{ t: 0, text: 'O ({g})' }, { t: T.e3.arrive, text: 'O⁻' }, { t: T.e4.arrive, text: 'O²⁻' }], windows: [[T.brk, W_STORY_END]], hosts: ['oB'] },
  ...([T.e1, T.e2, T.e3, T.e4] as const).map((e, k) => ({
    id: `e${k + 1}`,
    kind: 'token' as const,
    anchor: 'electron' as const,
    electron: k,
    dy: k % 2 === 0 ? 0.2 : -0.2,
    keys: [{ t: 0, text: 'e⁻' }],
    windows: [[e.leave - ELECTRON_LEAD, e.arrive + 0.15]] as const,
    hosts: [] as readonly string[],
  })),
  // Шаг 4: массикот (β-PbO, Pbcm)
  { id: 'massicot', kind: 'species', anchor: 'massAbove', dy: 1.3, keys: [{ t: 0, text: 'β-PbO ({s})' }], windows: [[GROW_MASS.from + 1.0, MASS_END]], hosts: [...MASS_IDS, ...STORY_IDS] },
  { id: 'massSg', kind: 'token', anchor: 'massAbove', dy: 0.42, dx: -0.6, keys: [{ t: 0, text: MASS_CAPTION[3]! }], windows: [[T.massicot - 0.4, stepFrom(S_LITH) + 0.7]], hosts: [] },
  { id: 'massCn', kind: 'token', anchor: 'massAbove', dy: 0.42, dx: 0.6, keys: [{ t: 0, text: MASS_CAPTION[4]! }], windows: [[T.massicot - 0.2, stepFrom(S_LITH) + 0.7]], hosts: [] },
  // Шаг 5: глёт (α-PbO, P4/nmm)
  { id: 'litharge', kind: 'species', anchor: 'lithAbove', dy: 1.5, keys: [{ t: 0, text: 'α-PbO ({s})' }], windows: [[GROW_LITH.from + 0.6, PBO_END]], hosts: [...LITH_IDS, ...STORY_IDS] },
  { id: 'lithSg', kind: 'token', anchor: 'lithAbove', dy: 0.42, dx: -0.6, keys: [{ t: 0, text: LITH_CAPTION[2]! }], windows: [[T.lattice - 0.4, PBO_END]], hosts: [] },
  { id: 'lithCn', kind: 'token', anchor: 'lithAbove', dy: 0.42, dx: 0.6, keys: [{ t: 0, text: LITH_CAPTION[3]! }], windows: [[T.lattice - 0.2, PBO_END]], hosts: [] },
  { id: 'cellA', kind: 'measure', anchor: 'edgeA', dy: -0.34, keys: [{ t: 0, text: LITH_CAPTION[0]! }], windows: [[T.lattice - 0.6, PBO_END]], hosts: [] },
  { id: 'cellC', kind: 'measure', anchor: 'edgeC', dy: 0, keys: [{ t: 0, text: LITH_CAPTION[1]! }], windows: [[T.lattice - 0.6, PBO_END]], hosts: [] },
  { id: 'pyramid', kind: 'token', anchor: 'apex', dy: 0.3, keys: [{ t: 0, text: 'PbO₄' }], windows: [PBO_LATTICE_FX_WIN], hosts: [] },
  { id: 'dPbO', kind: 'measure', anchor: 'pboBond', dy: 0, keys: [{ t: 0, text: `${fmtCore(LITH.cationAnionPm)} {pm}` }], windows: [PBO_LATTICE_FX_WIN], hosts: [] },
  { id: 'lonePair', kind: 'token', anchor: 'lonePair', dy: 0.22, keys: [{ t: 0, text: `6s${PB_S_PAIR === 2 ? '²' : '¹'}` }], windows: [PBO_LATTICE_FX_WIN], hosts: [] },
  { id: 'gap', kind: 'measure', anchor: 'gap', dy: 0, keys: [{ t: 0, text: `${fmt1(PBO_GAP.pm)} {pm}` }], windows: [PBO_LATTICE_FX_WIN], hosts: [] },
  // Шаг 6: итог из цикла Борна — Габера (число из ядра, не строкой)
  { id: 'dH', kind: 'measure', anchor: 'lithAbove', dy: 0.95, keys: [{ t: 0, text: `ΔH°f = ${signed(PBO_DHF_KJ)} {kJmol}` }], windows: [[stepFrom(LAST_STEP) + 0.4, PBO_END]], hosts: [] },
]

export type PboLabelState = SceneLabelState

/** Нижнее переднее ребро глёта вдоль x (подпись a) и переднее правое вертикальное (подпись c). */
function frontEdge(frag: LatticeFragment, axis: 0 | 1): LatticeSegment {
  const bottom = frag.boundsScene.min[1]
  const front = frag.boundsScene.max[2]
  const right = frag.boundsScene.max[0]
  const cand = frag.cellEdges.filter(([p, q]) => {
    const along = Math.abs(p[axis] - q[axis]) > 1e-6
    const onFront = Math.abs(p[2] - front) < 1e-6 && Math.abs(q[2] - front) < 1e-6
    if (!along || !onFront) return false
    if (axis === 0) return Math.abs(p[1] - bottom) < 1e-6 && Math.abs(q[1] - bottom) < 1e-6
    return Math.abs(p[0] - right) < 1e-6 && Math.abs(q[0] - right) < 1e-6
  })
  cand.sort((a, b) => Math.min(a[0][axis === 0 ? 0 : 1], a[1][axis === 0 ? 0 : 1]) - Math.min(b[0][axis === 0 ? 0 : 1], b[1][axis === 0 ? 0 : 1]))
  if (!cand[0]) throw new Error('pbo: нет переднего ребра ячейки')
  return cand[0]
}
export const PBO_EDGE_A = frontEdge(LITH_FRAG, 0)
export const PBO_EDGE_C = frontEdge(LITH_FRAG, 1)
/** Размерная линия a: на этом расстоянии под ребром (снаружи сфер нижнего ряда). */
export const PBO_DIM_A_DROP = R_LATTICE.oIon + 0.12
/** Подпись c: справа от ребра, снаружи сфер. */
const DIM_C_SIDE = R_LATTICE.oIon + 0.3
const METAL_BOTTOM_Y = Math.min(...METAL_FRAG.cellEdges.flatMap(([p, q]) => [p[1], q[1]]))

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type PboValence = {
  center: THREE.Vector3
  radius: number
  /** всего валентных точек на атоме (из ядра: valenceElectrons − заряд − электрон «на старте») */
  count: number
  /** из них пара ns² (только Pb; у O 0 — у него обычная раскладка Льюиса) */
  sPair: number
  amount: number
  highlight: number
}

export type PboFrame = {
  t: number
  pos: THREE.Vector3[]
  radius: Float32Array
  charge: Float32Array
  opacity: Float32Array
  emissive: Float32Array
  material: SubstanceKind[]
  /** двойная связь O=O */
  bond: { stress: number; thinning: number; opacity: number }
  /** металлические связи ГЦК (0…1) */
  metalBond: number
  edgeSet: 'metal' | 'massicot' | 'litharge'
  edges: number
  /** рамка цвета вещества (PBO_PHASE_TINT): какая модификация и насколько видна; не FX — остаётся в финале */
  tint: { phase: PboTintPhase | 'none'; amount: number }
  electrons: [ElectronJump, ElectronJump, ElectronJump, ElectronJump]
  /** валентные облака: pb1, pb2, oA, oB */
  valence: [PboValence, PboValence, PboValence, PboValence]
  /** амплитуды эффектов (тест: в финале все 0) */
  fx: { electrons: number; lonePairs: number; pyramid: number; gap: number }
  /** размерная линия ребра a (видимость = подпись) */
  dims: { edgeA: number }
  drawScale: number
  labels: PboLabelState[]
  camera: SceneCamera
  fade: number
}

const VIEW = new THREE.Vector3(0, 0, 1)

function createValence(): PboValence {
  return { center: new THREE.Vector3(), radius: 0, count: 0, sPair: 0, amount: 0, highlight: -1 }
}

export function createPboFrame(): PboFrame {
  const n = PBO_ATOMS.length
  return {
    t: 0,
    pos: PBO_ATOMS.map(() => new THREE.Vector3()),
    radius: new Float32Array(n),
    charge: new Float32Array(n),
    opacity: new Float32Array(n),
    emissive: new Float32Array(n).fill(BASE_EMISSIVE),
    material: PBO_ATOMS.map(() => 'default' as SubstanceKind),
    bond: { stress: 0, thinning: 0, opacity: 0 },
    metalBond: 0,
    edgeSet: 'metal',
    edges: 0,
    tint: { phase: 'none', amount: 0 },
    electrons: [createElectronJump('e1'), createElectronJump('e2'), createElectronJump('e3'), createElectronJump('e4')],
    valence: [createValence(), createValence(), createValence(), createValence()],
    fx: { electrons: 0, lonePairs: 0, pyramid: 0, gap: 0 },
    dims: { edgeA: 0 },
    drawScale: 1,
    labels: createLabelStates(PBO_LABELS),
    camera: createSceneCamera(),
    fade: 0,
  }
}

const I_PYR_O0 = IDX(PBO_PYRAMID.base[0]!)
const I_GAP_A = IDX(PBO_GAP.a)
const I_GAP_B = IDX(PBO_GAP.b)
const MASS_TOP = MASS_FRAG.boundsScene.max[1]
const LITH_TOP = LITH_FRAG.boundsScene.max[1]

/** Кадр, для которого сейчас считаются подписи (anchorLabel — модульная функция, без замыканий в кадре). */
let _cur: PboFrame | null = null

function anchorLabel(def: SceneLabelDef, st: SceneLabelState): void {
  const f = _cur!
  const d = def as PboLabelDef
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
    case 'ooBond':
      st.pos.copy(p[I_OA]!).lerp(p[I_OB]!, 0.5)
      st.pos.x += R.o + 0.42
      return
    case 'electron': {
      st.pos.copy(f.electrons[d.electron!]!.pos)
      st.pos.y += d.dy
      return
    }
    case 'massAbove':
      st.pos.set(d.dx ?? 0, MASS_TOP + d.dy, 0)
      return
    case 'lithAbove':
      st.pos.set(d.dx ?? 0, LITH_TOP + d.dy, 0)
      return
    case 'edgeA':
      st.pos.set(
        (PBO_EDGE_A[0][0] + PBO_EDGE_A[1][0]) / 2,
        (PBO_EDGE_A[0][1] + PBO_EDGE_A[1][1]) / 2 - PBO_DIM_A_DROP + d.dy,
        (PBO_EDGE_A[0][2] + PBO_EDGE_A[1][2]) / 2,
      )
      return
    case 'edgeC':
      st.pos.set(
        (PBO_EDGE_C[0][0] + PBO_EDGE_C[1][0]) / 2 + DIM_C_SIDE,
        (PBO_EDGE_C[0][1] + PBO_EDGE_C[1][1]) / 2,
        (PBO_EDGE_C[0][2] + PBO_EDGE_C[1][2]) / 2,
      )
      return
    case 'apex': {
      // Над вершиной пирамиды — со стороны, противоположной основанию.
      const dir = PBO_LONE_DIR[I_PB1]!
      st.pos.copy(p[I_PB1]!)
      st.pos.x -= 0.32
      st.pos.y += dir * (f.radius[I_PB1]! + d.dy)
      return
    }
    case 'pboBond':
      st.pos.copy(p[I_PB1]!).lerp(p[I_PYR_O0]!, 0.5)
      st.pos.z += 0.18
      return
    case 'lonePair': {
      const dir = PBO_LONE_DIR[I_PB1]!
      st.pos.copy(p[I_PB1]!)
      st.pos.x += 0.3
      st.pos.y += dir * (f.radius[I_PB1]! + DOT_GAP + d.dy)
      return
    }
    case 'gap':
      st.pos.copy(p[I_GAP_A]!).lerp(p[I_GAP_B]!, 0.5)
      st.pos.z += 0.22
      return
  }
}

const TRACKS: (Vec3Track | undefined)[] = PBO_ATOMS.map((a) => POS[a.id])
const L_CELLA = PBO_LABELS.findIndex((l) => l.id === 'cellA')
const DETACH = [T.sub1 - 0.3, T.sub2 - 0.3] as const
const METAL_BASE = 4
const MASS_BASE = METAL_BASE + METAL_IDS.length
const LITH_BASE = MASS_BASE + MASS_IDS.length
const MASS_ARRIVE_T: readonly number[] = MASS_IDS.map((id) => MASS_ARRIVAL.get(id)!)
const MASS_LEAVE_T: readonly number[] = MASS_IDS.map((id) => MASS_LEAVE.get(id)!)
const LITH_ARRIVE_T: readonly number[] = LITH_IDS.map((id) => LITH_ARRIVAL.get(id)!)
const SPEC = [
  // [донор, акцептор, электрон, дуга]
  { d: I_PB1, a: I_OA, e: T.e1, arc: 1 },
  { d: I_PB1, a: I_OA, e: T.e2, arc: -1 },
  { d: I_PB2, a: I_OB, e: T.e3, arc: 1 },
  { d: I_PB2, a: I_OB, e: T.e4, arc: -1 },
] as const

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function samplePboFrame(t: number, frame: PboFrame): PboFrame {
  frame.t = t
  const { pos, radius, charge, opacity, material, emissive } = frame

  for (let i = 0; i < PBO_ATOMS.length; i++) {
    const tr = TRACKS[i]
    if (tr) sampleVec3(tr, t, pos[i]!)
    emissive[i] = BASE_EMISSIVE
  }

  // ——— Атомы сюжета: радиус/заряд/материал ступенью, масштаб шаров — дорожкой ———
  const appear = sampleScalar(APPEAR, t)
  const k = sampleScalar(PBO_DRAW_SCALE, t)
  frame.drawScale = k
  radius[I_PB1] = sampleScalar(PBO_SNAP.radiusPb1, t) * k
  radius[I_PB2] = sampleScalar(PBO_SNAP.radiusPb2, t) * k
  radius[I_OA] = sampleScalar(PBO_SNAP.radiusOA, t) * k
  radius[I_OB] = sampleScalar(PBO_SNAP.radiusOB, t) * k
  charge[I_PB1] = sampleScalar(PBO_SNAP.chargePb1, t)
  charge[I_PB2] = sampleScalar(PBO_SNAP.chargePb2, t)
  charge[I_OA] = sampleScalar(PBO_SNAP.chargeOA, t)
  charge[I_OB] = sampleScalar(PBO_SNAP.chargeOB, t)
  for (let s = 0; s < 4; s++) opacity[STORY_INDEX[s]!] = appear
  material[I_PB1] = t < DETACH[0] ? 'metal' : t < T.e1.leave ? 'gas' : 'ion'
  material[I_PB2] = t < DETACH[1] ? 'metal' : t < T.e3.leave ? 'gas' : 'ion'
  material[I_OA] = t < T.e1.arrive ? 'gas' : 'ion'
  material[I_OB] = t < T.e3.arrive ? 'gas' : 'ion'

  // ——— Металл: ячейка ГЦК, затем уходит и гаснет полностью ———
  const metalA = sampleScalar(METAL_OPACITY, t)
  for (let i = METAL_BASE; i < MASS_BASE; i++) {
    radius[i] = R.pb
    charge[i] = 0
    opacity[i] = metalA
    material[i] = 'metal'
  }
  frame.metalBond = sampleScalar(METAL_BOND, t)

  // ——— Массикот: ионы вырастают из точки при подлёте и сжимаются в точку при распаде ———
  for (let m = 0; m < MASS_IDS.length; m++) {
    const i = MASS_BASE + m
    const pb = PBO_ATOMS[i]!.el === 'Pb'
    const a = MASS_ARRIVE_T[m]!
    const l = MASS_LEAVE_T[m]!
    const inG = t <= a ? 0 : smoothstep(a, a + GROW_MASS.appear, t)
    const outG = t <= l ? 1 : 1 - smoothstep(l, l + VANISH_MASS.appear, t)
    const grow = inG < outG ? inG : outG
    radius[i] = (pb ? R_LATTICE.pbIon : R_LATTICE.oIon) * grow
    charge[i] = pb ? 2 : -2
    material[i] = 'ion'
    opacity[i] = grow * 3 >= 1 ? 1 : grow * 3
  }

  // ——— Глёт ———
  for (let m = 0; m < LITH_IDS.length; m++) {
    const i = LITH_BASE + m
    const pb = PBO_ATOMS[i]!.el === 'Pb'
    const a = LITH_ARRIVE_T[m]!
    const grow = t <= a ? 0 : smoothstep(a, a + GROW_LITH.appear, t)
    radius[i] = (pb ? R_LATTICE.pbIon : R_LATTICE.oIon) * grow
    charge[i] = pb ? 2 : -2
    material[i] = 'ion'
    opacity[i] = grow * 3 >= 1 ? 1 : grow * 3
  }

  // ——— Связь O=O ———
  frame.bond.stress = sampleScalar(BOND_STRESS, t)
  frame.bond.thinning = sampleScalar(BOND_THIN, t)
  frame.bond.opacity = sampleScalar(BOND_OPACITY, t)

  // ——— Рёбра ячеек ———
  if (t < EDGE_SWITCH.massicot) {
    frame.edgeSet = 'metal'
    frame.edges = sampleScalar(METAL_EDGES, t)
  } else if (t < EDGE_SWITCH.litharge) {
    frame.edgeSet = 'massicot'
    frame.edges = sampleScalar(MASS_EDGES, t)
  } else {
    frame.edgeSet = 'litharge'
    frame.edges = sampleScalar(LITH_EDGES, t)
  }
  // Цвет вещества следует за рёбрами своей модификации (у металла рамки нет).
  frame.tint.phase = frame.edgeSet === 'metal' ? 'none' : frame.edgeSet
  frame.tint.amount = frame.edgeSet === 'metal' ? 0 : frame.edges

  // ——— Электроны: два 6p-электрона каждого Pb уходят к своему O ———
  let fxE = 0
  for (let e = 0; e < 4; e++) {
    const s = SPEC[e]!
    sampleElectronJump(frame.electrons[e]!, t, {
      donor: pos[s.d]!,
      acceptor: pos[s.a]!,
      shellRadius: R.pb + DOT_GAP,
      acceptorRadius: radius[s.a]!,
      leave: s.e.leave,
      arrive: s.e.arrive,
      arcSign: s.arc,
      lead: ELECTRON_LEAD,
      view: VIEW,
    })
    fxE += frame.electrons[e]!.opacity
  }
  frame.fx.electrons = fxE

  // ——— Валентные облака: count = valenceElectrons − charge (из ядра) ———
  writeValence(frame.valence[0], pos[I_PB1]!, 'Pb', charge[I_PB1]!, radius[I_PB1]!, t, pending(t, T.e1, T.e2), -1)
  writeValence(frame.valence[1], pos[I_PB2]!, 'Pb', charge[I_PB2]!, radius[I_PB2]!, t, pending(t, T.e3, T.e4), -1)
  writeValence(frame.valence[2], pos[I_OA]!, 'O', charge[I_OA]!, radius[I_OA]!, t, 0, lastArrival(t, T.e1, T.e2))
  writeValence(frame.valence[3], pos[I_OB]!, 'O', charge[I_OB]!, radius[I_OB]!, t, 0, lastArrival(t, T.e3, T.e4))

  // ——— Глёт: пары 6s², пирамида PbO₄, щель между слоями ———
  const latticeFx = windowFade(PBO_LATTICE_FX_WIN, t, PBO_LATTICE_FX_FADE)
  frame.fx.lonePairs = latticeFx
  frame.fx.pyramid = latticeFx
  frame.fx.gap = latticeFx

  frame.fade = sampleScalar(FADE, t)

  // ——— Подписи ———
  _cur = frame
  sampleLabels(PBO_LABELS, frame.labels, t, anchorLabel, frame.fade)
  _cur = null
  frame.dims.edgeA = frame.labels[L_CELLA]!.opacity

  // ——— Камера ———
  const cam = frame.camera
  sampleShot(PBO_CAMERA, t, cam)
  cam.shake = 0
  let glow = 0
  for (let e = 0; e < 4; e++) {
    const el = frame.electrons[e]!
    const g = el.glow * el.opacity
    if (g > glow) glow = g
  }
  cam.bloom = BASE_BLOOM + 0.15 * glow
  cam.vignette = Math.max(0.3, frame.fade)
  return frame
}

/** Сколько электронов донора уже «на старте» (проявились на оболочке, но ещё не ушли): их точка — у дуги. */
function pending(t: number, a: { leave: number }, b: { leave: number }): number {
  let n = 0
  if (t >= a.leave - ELECTRON_LEAD && t < a.leave) n++
  if (t >= b.leave - ELECTRON_LEAD && t < b.leave) n++
  return n
}

/** Момент последнего прихода к акцептору до t (для подсветки новой точки), −1 — ещё ни одного. */
function lastArrival(t: number, a: { arrive: number }, b: { arrive: number }): number {
  return t >= b.arrive ? b.arrive : t >= a.arrive ? a.arrive : -1
}

/**
 * Облако валентных электронов: у Pb до ухода — четыре точки (6s² парой, 6p² поодиночке), у Pb²⁺ —
 * пара 6s²; у O — шесть (две пары и два неспаренных, O(³P)), у O⁻ семь, у O²⁻ октет.
 * highlightFrom — момент последнего прихода: новая точка подсвечена 1,2 с.
 */
function writeValence(
  v: PboValence,
  center: THREE.Vector3,
  el: ElementSymbol,
  charge: number,
  radius: number,
  t: number,
  onShell: number,
  highlightFrom: number,
): void {
  v.center.copy(center)
  v.radius = radius + DOT_GAP
  const count = ATOMIC_DATA[el].valenceElectrons - Math.round(charge) - onShell
  v.count = count >= 8 ? 8 : count <= 0 ? 0 : count
  v.sPair = el === 'Pb' ? Math.min(PB_S_PAIR, v.count) : 0
  const on = smoothstep(VALENCE_WIN.from, VALENCE_WIN.from + 0.5, t)
  const off = 1 - smoothstep(VALENCE_WIN.off - 0.5, VALENCE_WIN.off, t)
  v.amount = v.count > 0 ? on * off : 0
  v.highlight = highlightFrom >= 0 && t < highlightFrom + 1.2 ? v.count - 1 : -1
}

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validatePboStoryboard(): void {
  const vec: Record<string, Vec3Track> = {}
  for (const [id, track] of Object.entries(POS)) vec[`pos.${id}`] = track
  vec['cam.offset'] = PBO_CAMERA.offset
  validateTracks(vec)
  validateTracks({
    ...PBO_SNAP,
    PBO_DRAW_SCALE,
    APPEAR,
    METAL_OPACITY,
    METAL_BOND,
    BOND_STRESS,
    BOND_THIN,
    BOND_OPACITY,
    METAL_EDGES,
    MASS_EDGES,
    LITH_EDGES,
    FADE,
    camZoom: PBO_CAMERA.zoom,
    camYaw: PBO_CAMERA.yaw,
    camPitch: PBO_CAMERA.pitch,
  })

  if (METAL_FRAG.sites.length !== 14) throw new Error(`pbo: ячейка ГЦК — 14 атомов, а не ${METAL_FRAG.sites.length}`)
  if (PBO_ATOMS.length !== 4 + METAL_REST.length + MASS_REST.length + LITH_REST.length) throw new Error('pbo: состав кадра не сходится')
  // Обе модификации — одинаковые КЧ (радиусы Шеннона одни на оба фрагмента).
  if (MASS.coordination['Pb²⁺'] !== CN_PB || MASS.coordination['O²⁻'] !== CN_O) throw new Error('pbo: КЧ массикота ≠ КЧ глёта')

  // Пары сюжета — соседи Pb–O первой сферы в обоих фрагментах.
  for (const [frag, story] of [
    [MASS_FRAG, MASS_STORY],
    [LITH_FRAG, LITH_STORY],
  ] as const) {
    for (const [pb, o] of [
      [story.pb1, story.oA],
      [story.pb2, story.oB],
    ] as const) {
      if (frag.sites[pb]!.el !== 'Pb' || frag.sites[o]!.el !== 'O') throw new Error(`pbo: узлы пары в ${frag.crystalId} не Pb/O`)
      if (!coordinationShell(frag, pb).neighbors.includes(o)) throw new Error(`pbo: пара сюжета в ${frag.crystalId} не соседи`)
    }
  }
  if (PBO_PYRAMID.base.length !== CN_PB) throw new Error('pbo: у пирамиды PbO₄ не четыре O')

  // Физика размера: катион меньше атома, анион больше.
  if (!(R.pbIon < R.pb)) throw new Error('pbo: Pb²⁺ обязан быть меньше атома Pb')
  if (!(R.oIon > R.o)) throw new Error('pbo: O²⁻ обязан быть больше атома O')
  if (PB_S_PAIR !== 2) throw new Error('pbo: у Pb внешняя s-подоболочка обязана быть s²')

  // Никаких событий лаборатории до конца последнего шага.
  if (PBO_END <= stepTo(LAST_STEP)) throw new Error('pbo: хвост сцены пустой')
}

/** Для теста: узлы сюжета и геометрия. */
export const PBO_GEOM = {
  radius: R,
  latticeRadius: R_LATTICE,
  stageZ: STAGE_Z,
  massStory: MASS_STORY,
  lithStory: LITH_STORY,
  cn: { pb: CN_PB, o: CN_O },
  metal: { spaceGroup: METAL.spaceGroup, cellPm: METAL.cellPm.a, nnPm: METAL.cationAnionPm, coordination: METAL.coordination.Pb },
} as const
