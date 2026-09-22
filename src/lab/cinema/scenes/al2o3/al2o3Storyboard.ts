import * as THREE from 'three'
import { ATOMIC_DATA, bondLengthPm, getCrystal, ionicRadiusCnsOf, NATIVE_OXIDE_FILMS, radiusForSpecies, type ElementSymbol } from '../../../../chemistry/data'
import { smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, windowFade, type ScalarKey, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { orbitTrack, sampleShot, shotTrack, type ShotTrack } from '../kit/camera'
import { bondLength, LATTICE_BALL_SCALE, pmToScene, SPECIES_SCALE } from '../kit/cpkAtoms'
import { createElectronJump, sampleElectronJump, type ElectronJump } from '../kit/electronFx'
import { coordinationShell, latticeCaption, latticeFragment, type LatticeSegment } from '../kit/lattice'
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
import { AL2O3_DHF_KJ } from './al2o3Energetics'
import { al2o3CueAt, AL2O3_ELECTRON_LEAD, AL2O3_ELECTRONS, AL2O3_END, AL2O3_FINISH, AL2O3_STEPS } from './al2o3Steps'

export {
  AL2O3_CUES,
  AL2O3_ELECTRONS,
  AL2O3_ELECTRON_LEAD,
  AL2O3_END,
  AL2O3_FINISH,
  AL2O3_SEGMENTS,
  AL2O3_STEPS,
  AL2O3_STEP_IDS,
  AL2O3_TIMING,
  al2o3StepIndexAt,
  type Al2o3CueId,
  type Al2o3StepId,
} from './al2o3Steps'

/**
 * Раскадровка 4 Al (тв.) + 3 O₂ (г.) → 2 Al₂O₃ (тв., корунд) — ЧИСТАЯ функция времени сюжета.
 * Построена по рецепту эталона (scenes/nacl).
 *
 * Ни одного числа химии: геометрия — из crystalData через kit/lattice (ГЦК-алюминий 2×2×1,
 * корунд 2×2×1 гексагональных ячеек), толщина естественной плёнки — из phenomenaData, длина O=O —
 * из bondData, радиусы — radiusForSpecies (Al⁰ металлический, O⁰ ковалентный, ионы — Шеннон при
 * ФАКТИЧЕСКОМ КЧ: Al³⁺ КЧ 6 и O²⁻ КЧ 4 в корунде, Al³⁺ КЧ 4 в аморфной плёнке), энергия — из цикла.
 *
 * Правила эталона, выполненные по построению:
 *   • у каждого атома есть span [первый, последний шаг]; вне него непрозрачность строго 0;
 *   • каждый видимый атом подписан или покрыт подписью группы (label.hosts);
 *   • заряд меняется ступенью в кадр УХОДА электрона у Al (Al → Al⁺ → Al²⁺ → Al³⁺) и в кадр ПРИХОДА
 *     у O (O → O⁻ → O²⁻): в любой кадр Σ зарядов + (−1)·(летящие e⁻) = 0;
 *   • радиус меняется ступенью в кадр появления Al³⁺ (уход третьего электрона) и O²⁻ (приход
 *     второго): для Al⁺, Al²⁺, O⁻ у Шеннона радиусов нет — в кристаллах этих частиц не бывает;
 *   • плёнка нарисована в масштабе: её толщина (нижняя граница из ядра) рядом с ячейкой металла;
 *   • решётка — целое число ячеек, рёбра ячеек отдельным слоем, никаких связей Al–O;
 *   • финал без огня, ореолов и свечения внутри кристалла: FX-амплитуды → 0.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

const CORUNDUM = getCrystal('corundum')!
const METAL = getCrystal('al_metal')!
const FILM = NATIVE_OXIDE_FILMS.al

/** Перевод единиц плёнки (нм → пм) — это не химия, а метрология. */
const PM_PER_NM = 1000

/** Фрагмент корунда: 2×2×1 гексагональных ячеек (c почти втрое длиннее a — см. note шага 4). */
export const CORUNDUM_FRAG = latticeFragment('corundum', [2, 2, 1])
/** Металлический алюминий: 2×2×1 ГЦК-ячейки — «подложка» под плёнкой. */
export const METAL_FRAG = latticeFragment('al_metal', [2, 2, 1])
/** Подписи решёток — только символы и числа. */
export const CORUNDUM_CAPTION = latticeCaption('corundum')
export const METAL_CAPTION = latticeCaption('al_metal')

/** Радиус частицы в мировых единицах: Шеннон при КЧ cn (если задан), иначе как radiusForSpecies. */
function rad(el: ElementSymbol, charge: number, cn: number | undefined, scale: number): number {
  return pmToScene(radiusForSpecies(el, charge, cn != null ? { cn } : undefined)) * scale
}

/** КЧ из ядра: Al³⁺ 6, O²⁻ 4 (CRYSTAL_DATA.corundum.coordination). */
const CN_AL = CORUNDUM.coordination['Al³⁺']!
const CN_O = CORUNDUM.coordination['O²⁻']!
/**
 * КЧ Al³⁺ в аморфной плёнке: в ней преобладают тетраэдры AlO₄ (и пирамиды AlO₅, Lee et al.,
 * PRL 103 (2009) 095501) — берём наименьшее КЧ, для которого в ядре есть радиус Шеннона Al³⁺
 * (выбор модели назван в note шага 1; отдельной записи о плёнке в ядре нет).
 */
const CN_AL_FILM = Math.min(...ionicRadiusCnsOf('Al', 3))

const R = {
  al: rad('Al', 0, undefined, SPECIES_SCALE),
  alIon: rad('Al', 3, CN_AL, SPECIES_SCALE),
  o: rad('O', 0, undefined, SPECIES_SCALE),
  oIon: rad('O', -2, CN_O, SPECIES_SCALE),
  filmAl: rad('Al', 3, CN_AL_FILM, SPECIES_SCALE),
  filmO: rad('O', -2, CN_O, SPECIES_SCALE),
} as const

const R_LATTICE = {
  alIon: rad('Al', 3, CN_AL, LATTICE_BALL_SCALE),
  oIon: rad('O', -2, CN_O, LATTICE_BALL_SCALE),
} as const

/** Кратчайшие расстояния в корунде по парам элементов (пм) — из базиса ядра. */
const CORUNDUM_MIN_PM: Readonly<Record<'AlO' | 'OO' | 'AlAl', number>> = (() => {
  const f = latticeFragment('corundum', [1, 1, 1])
  const out = { AlO: Infinity, OO: Infinity, AlAl: Infinity }
  for (let i = 0; i < f.sites.length; i++) {
    for (let j = i + 1; j < f.sites.length; j++) {
      const p = f.posPm[i]!
      const q = f.posPm[j]!
      const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
      const a = f.sites[i]!.el
      const b = f.sites[j]!.el
      const key = a === b ? (a === 'O' ? 'OO' : 'AlAl') : 'AlO'
      if (d < out[key]) out[key] = d
    }
  }
  return out
})()

/** Зазор валентных точек над поверхностью атома (параметр рисунка, не химия). */
const DOT_GAP = 0.07

// ── Шаг 1: металл + аморфная плёнка в масштабе + O₂ ──
const METAL_HALF_H = METAL_FRAG.boundsScene.max[1]
const METAL_HALF_W = METAL_FRAG.boundsScene.max[0]
/** Толщина плёнки на рисунке — нижняя граница диапазона ядра (2 нм), в масштабе сцены. */
const FILM_T = pmToScene(FILM.min * PM_PER_NM)
const D_ALO = pmToScene(CORUNDUM_MIN_PM.AlO)
/** Зазор между поверхностью плёнки и «севшей» молекулой O₂ (параметр рисунка). */
const O2_GAP = R.filmO + R.o + 0.06
const HALF_OO = bondLength('O=O') / 2

/** Центр фрагмента металла: колонна «металл + плёнка + O₂» стоит по центру кадра. */
const METAL_Y = -(FILM_T + O2_GAP + R.o) / 2
const METAL_CENTER = [0, METAL_Y, 0] as const
const METAL_TOP = METAL_Y + METAL_HALF_H
const FILM_Y0 = METAL_TOP + D_ALO
const FILM_Y1 = METAL_TOP + FILM_T
const O2_Y = FILM_Y1 + O2_GAP

/** Сдвиг рёбер ячейки металла в кадре (слой CinemaCellEdges). */
export const AL2O3_METAL_OFFSET = METAL_CENTER

/**
 * Плёнка: детерминированная случайная укладка (RSA) ионов O²⁻ и Al³⁺ в слое над металлом —
 * СХЕМА аморфного оксида. Минимальные расстояния — кратчайшие O–O, Al–O, Al–Al корунда из ядра,
 * состав строго Al : O = 2 : 3. Генератор — линейный конгруэнтный (фиксированное зерно):
 * кадр и тест видят одну и ту же плёнку.
 */
export type FilmSite = { el: 'Al' | 'O'; pos: readonly [number, number, number] }

export const FILM_SITES: readonly FilmSite[] = (() => {
  let s = 0x2a1203 >>> 0
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  const dOO = pmToScene(CORUNDUM_MIN_PM.OO)
  const dAlO = D_ALO
  const dAlAl = pmToScene(CORUNDUM_MIN_PM.AlAl)
  const m = R.filmO
  const x0 = -METAL_HALF_W + m
  const x1 = METAL_HALF_W - m
  const pick = (): [number, number, number] => [x0 + (x1 - x0) * rnd(), FILM_Y0 + (FILM_Y1 - FILM_Y0) * rnd(), x0 + (x1 - x0) * rnd()]
  const far = (p: readonly number[], list: readonly (readonly number[])[], d: number) =>
    list.every((q) => (p[0]! - q[0]!) ** 2 + (p[1]! - q[1]!) ** 2 + (p[2]! - q[2]!) ** 2 >= d * d)
  const O: [number, number, number][] = []
  for (let k = 0; k < 2600; k++) {
    const p = pick()
    if (far(p, O, dOO)) O.push(p)
  }
  const Al: [number, number, number][] = []
  const wantAl = Math.floor((2 * O.length) / 3)
  for (let k = 0; k < 2600 && Al.length < wantAl; k++) {
    const p = pick()
    if (far(p, O, dAlO) && far(p, Al, dAlAl)) Al.push(p)
  }
  // Состав Al₂O₃: 2n Al и 3n O.
  const n = Math.min(Math.floor(O.length / 3), Math.floor(Al.length / 2))
  return [...Al.slice(0, 2 * n).map((pos) => ({ el: 'Al' as const, pos })), ...O.slice(0, 3 * n).map((pos) => ({ el: 'O' as const, pos }))]
})()

/** Размерная линия толщины плёнки: у переднего правого ребра колонны. */
export const FILM_DIM = { x: METAL_HALF_W + 0.14, z: METAL_HALF_W, y0: METAL_TOP, y1: FILM_Y1 } as const

// ── Шаги 3–5: сцена переноса перед передней гранью корунда ──
const Z_FRONT = Math.max(...CORUNDUM_FRAG.sites.map((s) => s.posScene[2]))
/** Плоскость действия шагов 2–3 — передняя грань будущего фрагмента. */
const STAGE_Z = Z_FRONT

/** Расстановка двух формульных единиц (A — слева, B — справа), мировые единицы (параметры рисунка). */
const X_AL = 1.95
const X_O = 0.85
const Y_AL = 0.375
const Y_O = 0.75

export const AL2O3_GEOM = {
  radius: R,
  latticeRadius: R_LATTICE,
  latticeScale: LATTICE_BALL_SCALE,
  filmThickness: FILM_T,
  filmY: [FILM_Y0, FILM_Y1] as const,
  metalTop: METAL_TOP,
  stageZ: STAGE_Z,
  cn: { al: CN_AL, o: CN_O, alFilm: CN_AL_FILM },
  corundumMinPm: CORUNDUM_MIN_PM,
  data: {
    spaceGroup: CORUNDUM.spaceGroup,
    cellPm: CORUNDUM.cellPm,
    z: CORUNDUM.z,
    densityGCm3: CORUNDUM.densityGCm3,
    oo: bondLengthPm('O=O'),
    metal: { spaceGroup: METAL.spaceGroup, cellPm: METAL.cellPm.a, nnPm: METAL.cationAnionPm, coordination: METAL.coordination.Al! },
  },
} as const

/** Масштаб рига камеры. */
export const AL2O3_RIG_SCALE = 1.15

// ─────────────────────────────────────────────────────────────────────────────
// Состав кадра: атомы, их шаги и подписи
// ─────────────────────────────────────────────────────────────────────────────

export type Al2o3Element = 'Al' | 'O'
export type Al2o3AtomKind = 'story' | 'metal' | 'film' | 'lattice'

export type Al2o3AtomDef = {
  id: string
  el: Al2o3Element
  kind: Al2o3AtomKind
  /** индексы шагов [первый, последний], на которых атом имеет право быть видимым */
  span: readonly [number, number]
}

const stepFrom = (i: number) => AL2O3_STEPS[i]!.from
const stepTo = (i: number) => AL2O3_STEPS[i]!.to
const LAST_STEP = AL2O3_STEPS.length - 1

const T = {
  film: al2o3CueAt('film'),
  crack: al2o3CueAt('crack'),
  sub: al2o3CueAt('sublimate'),
  brk: al2o3CueAt('bondBreak'),
  lattice: al2o3CueAt('lattice'),
  octa: al2o3CueAt('octahedron'),
}

const STORY_AL = ['alA1', 'alA2', 'alB1', 'alB2'] as const
const STORY_O = ['oA1', 'oA2', 'oA3', 'oB1', 'oB2', 'oB3'] as const
const STORY_IDS = [...STORY_AL, ...STORY_O] as const
type StoryId = (typeof STORY_IDS)[number]

type V3 = readonly [number, number, number]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]

/** Свободные частицы перед переносом электронов (шаги 2–3). */
const FREE: Record<StoryId, V3> = {
  alA1: [-X_AL, Y_AL, STAGE_Z],
  alA2: [-X_AL, -Y_AL, STAGE_Z],
  alB1: [X_AL, Y_AL, STAGE_Z],
  alB2: [X_AL, -Y_AL, STAGE_Z],
  oA1: [-X_O, Y_O, STAGE_Z],
  oA2: [-X_O, 0, STAGE_Z],
  oA3: [-X_O, -Y_O, STAGE_Z],
  oB1: [X_O, Y_O, STAGE_Z],
  oB2: [X_O, 0, STAGE_Z],
  oB3: [X_O, -Y_O, STAGE_Z],
}

/** Узлы корунда для частиц сюжета: ближайшие к их свободным местам узлы передней грани того же элемента. */
const STORY_SITE: Record<StoryId, number> = (() => {
  const front = CORUNDUM_FRAG.sites.map((s, i) => ({ s, i })).filter(({ s }) => s.posScene[2] >= Z_FRONT - 0.45)
  const used = new Set<number>()
  const out = {} as Record<StoryId, number>
  for (const id of STORY_IDS) {
    const el = id.startsWith('al') ? 'Al' : 'O'
    const f = FREE[id]
    let best = -1
    let bd = Infinity
    for (const { s, i } of front) {
      if (s.el !== el || used.has(i)) continue
      const d = Math.hypot(s.posScene[0] - f[0], s.posScene[1] - f[1], (s.posScene[2] - f[2]) * 0.5)
      if (d < bd) {
        bd = d
        best = i
      }
    }
    if (best < 0) throw new Error(`al2o3: нет узла передней грани для ${id}`)
    used.add(best)
    out[id] = best
  }
  return out
})()

/** Атомы металла для сюжета: центры граней верхнего слоя (через них видна трещина). */
function metalTopFaceSite(sx: number, sz: number): number {
  const eps = 1e-6
  const idx = METAL_FRAG.sites.findIndex((s) => {
    const [x, y, z] = s.posScene
    return Math.abs(y - METAL_HALF_H) < eps && Math.sign(x) === sx && Math.sign(z) === sz && Math.abs(x) < METAL_HALF_W - eps && Math.abs(z) < METAL_HALF_W - eps
  })
  if (idx < 0) throw new Error('al2o3: нет центра грани верхнего слоя ГЦК')
  return idx
}
const METAL_STORY: Record<(typeof STORY_AL)[number], number> = {
  alA1: metalTopFaceSite(-1, 1),
  alA2: metalTopFaceSite(-1, -1),
  alB1: metalTopFaceSite(1, 1),
  alB2: metalTopFaceSite(1, -1),
}
const METAL_STORY_SET = new Set<number>(Object.values(METAL_STORY))
const METAL_REST = METAL_FRAG.sites.map((_, i) => i).filter((i) => !METAL_STORY_SET.has(i))
const STORY_SITE_SET = new Set<number>(Object.values(STORY_SITE))
const LATTICE_REST = CORUNDUM_FRAG.sites.map((_, i) => i).filter((i) => !STORY_SITE_SET.has(i))

export const AL2O3_ATOMS: readonly Al2o3AtomDef[] = [
  ...STORY_IDS.map((id) => ({ id, el: (id.startsWith('al') ? 'Al' : 'O') as Al2o3Element, kind: 'story' as const, span: [0, LAST_STEP] as const })),
  ...METAL_REST.map((_, k) => ({ id: `M${k}`, el: 'Al' as Al2o3Element, kind: 'metal' as const, span: [0, 1] as const })),
  ...FILM_SITES.map((f, k) => ({ id: `F${k}`, el: f.el as Al2o3Element, kind: 'film' as const, span: [0, 1] as const })),
  ...LATTICE_REST.map((si, k) => ({ id: `L${k}`, el: CORUNDUM_FRAG.sites[si]!.el as Al2o3Element, kind: 'lattice' as const, span: [3, LAST_STEP] as const })),
]

export const AL2O3_ATOM_INDEX: ReadonlyMap<string, number> = new Map(AL2O3_ATOMS.map((a, i) => [a.id, i]))
const IDX = (id: string) => AL2O3_ATOM_INDEX.get(id)!
const METAL_IDS = AL2O3_ATOMS.filter((a) => a.kind === 'metal').map((a) => a.id)
const FILM_IDS = AL2O3_ATOMS.filter((a) => a.kind === 'film').map((a) => a.id)
const LATTICE_IDS = AL2O3_ATOMS.filter((a) => a.kind === 'lattice').map((a) => a.id)
const STORY_INDEX: readonly number[] = STORY_IDS.map((id) => IDX(id))
const I_METAL0 = STORY_IDS.length
const I_FILM0 = I_METAL0 + METAL_IDS.length
const I_LATTICE0 = I_FILM0 + FILM_IDS.length

/** Узел фрагмента корунда для атома кадра (story + lattice). */
export const CORUNDUM_SITE_OF: ReadonlyMap<string, number> = new Map<string, number>([
  ...STORY_IDS.map((id) => [id, STORY_SITE[id]] as [string, number]),
  ...LATTICE_REST.map((si, k) => [`L${k}`, si] as [string, number]),
])

/** Узел ячейки металла для атома кадра (металл + четыре атома сюжета). */
export const METAL_SITE_OF: ReadonlyMap<string, number> = new Map<string, number>([
  ...STORY_AL.map((id) => [id, METAL_STORY[id]] as [string, number]),
  ...METAL_REST.map((si, k) => [`M${k}`, si] as [string, number]),
])

/** Металлические связи ГЦК (первая сфера, КЧ 12): пары id атомов кадра. */
export const METAL_BONDS: readonly (readonly [string, string])[] = (() => {
  const byIdx = new Map<number, string>([...METAL_SITE_OF.entries()].map(([id, si]) => [si, id]))
  return METAL_FRAG.bonds.map(([i, j]) => [byIdx.get(i)!, byIdx.get(j)!] as const)
})()

/** Три молекулы O₂ и атомы, на которые каждая распадается. */
export const O2_MOLECULES: readonly { a: StoryId; b: StoryId; center: V3 }[] = [
  { a: 'oA1', b: 'oA2', center: [-0.45, O2_Y, 0.5] },
  { a: 'oA3', b: 'oB1', center: [0, O2_Y, -0.5] },
  { a: 'oB2', b: 'oB3', center: [0.45, O2_Y, 0.5] },
]

/**
 * Двенадцать прыжков электронов: в единице g первый Al отдаёт k = 0…2 атомам O g1…g3,
 * второй Al — k = 3…5 тем же атомам. Времена — AL2O3_ELECTRONS[k], единицы A и B синхронно.
 */
export type Al2o3Jump = { id: string; group: 'A' | 'B'; k: number; donor: StoryId; acceptor: StoryId; leave: number; arrive: number; arcSign: number }

export const AL2O3_JUMPS: readonly Al2o3Jump[] = (['A', 'B'] as const).flatMap((g) =>
  AL2O3_ELECTRONS.map((e, k) => ({
    id: `e${g}${k + 1}`,
    group: g,
    k,
    donor: `al${g}${k < 3 ? 1 : 2}` as StoryId,
    acceptor: `o${g}${(k % 3) + 1}` as StoryId,
    leave: e.leave,
    arrive: e.arrive,
    arcSign: (k < 3 ? 1 : -1) * (g === 'A' ? 1 : -1),
  })),
)

// ─────────────────────────────────────────────────────────────────────────────
// Положения
// ─────────────────────────────────────────────────────────────────────────────

const metalPos = (si: number): V3 => add(METAL_CENTER, METAL_FRAG.sites[si]!.posScene)
const siteScene = (si: number): V3 => CORUNDUM_FRAG.sites[si]!.posScene

const T_O2_LAND = { from: 0.3, to: T.film }
/** Плёнка расходится (трещина) так далеко, что уходит из области действия шагов 2–3. */
const FILM_SPLIT = 2.6
const T_CRACK = { from: T.crack - 0.2, to: T.crack + 1.6 }
const T_FILM_OUT = { from: T.brk, to: T.brk + 2.0 }
const O_FLIGHT = 3.0
const AL_FLIGHT = 2.4
const DETACH: Record<(typeof STORY_AL)[number], number> = { alA1: T.sub, alB1: T.sub + 0.1, alA2: T.sub + 0.3, alB2: T.sub + 0.4 }
const T_METAL_OUT = { from: T.sub + 0.4, to: stepTo(1) - 0.9 }
const T_MOVE_LATTICE = { from: stepFrom(3) + 0.3, to: stepFrom(3) + 1.9 }

const POS: Record<string, Vec3Track> = {}

for (const id of STORY_AL) {
  const p0 = metalPos(METAL_STORY[id])
  const d = DETACH[id]
  POS[id] = [
    { t: 0, v: p0 },
    { t: d - 0.3, v: p0 },
    { t: d + AL_FLIGHT, v: FREE[id], ease: 'smooth', arc: id.endsWith('1') ? 0.2 : -0.2 },
    { t: T_MOVE_LATTICE.from, v: FREE[id] },
    { t: T_MOVE_LATTICE.to, v: siteScene(STORY_SITE[id]), ease: 'smooth' },
  ]
}
for (const m of O2_MOLECULES) {
  for (const [id, sx] of [
    [m.a, -1],
    [m.b, 1],
  ] as const) {
    const rest = add(m.center, [sx * HALF_OO, 0, 0])
    const high = add(rest, [0, 0.7, 0])
    POS[id] = [
      { t: 0, v: high },
      { t: T_O2_LAND.from, v: high },
      { t: T_O2_LAND.to, v: rest, ease: 'smooth' },
      { t: T.brk - 0.6, v: rest },
      { t: T.brk, v: add(rest, [sx * 0.05, 0, 0]), ease: 'inQuad' },
      { t: T.brk + O_FLIGHT, v: FREE[id], ease: 'smooth' },
      { t: T_MOVE_LATTICE.from, v: FREE[id] },
      { t: T_MOVE_LATTICE.to, v: siteScene(STORY_SITE[id]), ease: 'smooth' },
    ]
  }
}

/** Остальной металл уходит вниз и гаснет ПОЛНОСТЬЮ до паузы шага 2. */
const METAL_EXIT: V3 = [0, -0.7, 0]
METAL_IDS.forEach((id, k) => {
  const p = metalPos(METAL_REST[k]!)
  POS[id] = [
    { t: 0, v: p },
    { t: T_METAL_OUT.from, v: p },
    { t: T_METAL_OUT.to, v: add(p, METAL_EXIT), ease: 'inQuad' },
  ]
})

/** Плёнка: трещина посередине — половины расходятся в стороны и гаснут. */
FILM_IDS.forEach((id, k) => {
  const p = FILM_SITES[k]!.pos
  const off: V3 = [p[0] < 0 ? -FILM_SPLIT : FILM_SPLIT, 0, 0]
  POS[id] = [
    { t: 0, v: p },
    { t: T_CRACK.from, v: p },
    { t: T_CRACK.to, v: add(p, off), ease: 'smooth' },
  ]
})

/**
 * Рост кристалла: остальные ионы корунда подлетают к узлам радиально и вырастают из точки,
 * ближние к частицам сюжета — раньше; все стоят на местах задолго до паузы шага 4.
 */
const GROW = { from: stepFrom(3) + 0.7, to: T.lattice - 1.2, flight: 1.2, appear: 0.7, reach: 0.9 }
const STORY_CENTROID: V3 = scale3(
  STORY_IDS.reduce<V3>((acc, id) => add(acc, siteScene(STORY_SITE[id])), [0, 0, 0]),
  1 / STORY_IDS.length,
)
export const LATTICE_ARRIVAL: ReadonlyMap<string, { start: number; arrive: number }> = (() => {
  const ranked = LATTICE_IDS.map((id) => {
    const p = siteScene(CORUNDUM_SITE_OF.get(id)!)
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
  const p = siteScene(CORUNDUM_SITE_OF.get(id)!)
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
// Координационные многогранники (шаг 5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Выделенный Al³⁺: полный октаэдр внутри фрагмента, ближе всех к зрителю; выделенный O²⁻ — его
 * сосед с полным тетраэдром OAl₄. Длины Al–O — из координат узлов (базис ядра).
 */
export const OCTA = (() => {
  const zOf = (i: number) => CORUNDUM_FRAG.sites[i]!.posScene[2]
  const off = (i: number) => Math.abs(CORUNDUM_FRAG.sites[i]!.posScene[0]) + Math.abs(CORUNDUM_FRAG.sites[i]!.posScene[1])
  const cands = CORUNDUM_FRAG.sites
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => s.el === 'Al' && coordinationShell(CORUNDUM_FRAG, i).neighbors.length === CN_AL)
    .sort((a, b) => zOf(b.i) - zOf(a.i) || off(a.i) - off(b.i))
  const al = cands[0]!.i
  const shell = coordinationShell(CORUNDUM_FRAG, al)
  const oCands = shell.neighbors.filter((j) => coordinationShell(CORUNDUM_FRAG, j).neighbors.length === CN_O).sort((a, b) => zOf(b) - zOf(a) || off(a) - off(b))
  const o = oCands[0]!
  const tetra = coordinationShell(CORUNDUM_FRAG, o)
  const dMin = shell.distancesPm[0]!
  const dMax = shell.distancesPm[shell.distancesPm.length - 1]!
  const shortIdx = shell.neighbors.filter((_, k) => shell.distancesPm[k]! < (dMin + dMax) / 2).sort((a, b) => zOf(b) - zOf(a))[0]!
  const longIdx = shell.neighbors.filter((_, k) => shell.distancesPm[k]! > (dMin + dMax) / 2).sort((a, b) => zOf(b) - zOf(a))[0]!
  return {
    al,
    o,
    shell,
    tetra,
    shortPm: dMin,
    longPm: dMax,
    short: shortIdx,
    long: longIdx,
  }
})()

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

/** Ступенчатая дорожка: v0, затем значения в моменты times (без промежуточных кадров). */
function stepsTrack(v0: number, steps: readonly (readonly [number, number])[]): ScalarTrack {
  const out: ScalarKey[] = []
  let v = v0
  for (const [t, nv] of steps) {
    out.push({ t: t - OCTET_SNAP_EPS, v })
    out.push({ t, v: nv, ease: 'step' })
    v = nv
  }
  return out
}

const jumpsOf = (id: StoryId, role: 'donor' | 'acceptor') => AL2O3_JUMPS.filter((j) => j[role] === id).sort((a, b) => a.leave - b.leave)

/**
 * РАДИУС, ЗАРЯД И МАТЕРИАЛ МЕНЯЮТСЯ СТУПЕНЬЮ: заряд Al — в каждый кадр ухода (Al⁺, Al²⁺, Al³⁺),
 * заряд O — в каждый кадр прихода (O⁻, O²⁻); радиус — в кадр появления Al³⁺ и O²⁻.
 */
export const AL2O3_SNAP: Record<string, ScalarTrack> = (() => {
  const out: Record<string, ScalarTrack> = {}
  for (const id of STORY_AL) {
    const js = jumpsOf(id, 'donor')
    out[`charge.${id}`] = stepsTrack(0, js.map((j, n) => [j.leave, n + 1] as const))
    out[`radius.${id}`] = octetSnap(js[js.length - 1]!.leave, R.al, R.alIon)
  }
  for (const id of STORY_O) {
    const js = jumpsOf(id, 'acceptor').sort((a, b) => a.arrive - b.arrive)
    out[`charge.${id}`] = stepsTrack(0, js.map((j, n) => [j.arrive, -(n + 1)] as const))
    out[`radius.${id}`] = octetSnap(js[js.length - 1]!.arrive, R.o, R.oIon)
  }
  return out
})()

/** Кадр, с которого частица сюжета перестаёт быть металлом/газом. */
export const AL2O3_FIRST_LEAVE: Readonly<Record<string, number>> = Object.fromEntries(STORY_AL.map((id) => [id, jumpsOf(id, 'donor')[0]!.leave]))
export const AL2O3_FIRST_ARRIVE: Readonly<Record<string, number>> = Object.fromEntries(
  STORY_O.map((id) => [id, Math.min(...jumpsOf(id, 'acceptor').map((j) => j.arrive))]),
)
export const AL2O3_DETACH: Readonly<Record<string, number>> = { ...DETACH }

/**
 * МАСШТАБ ШАРОВ частиц сюжета относительно SPECIES_SCALE (параметр рисунка): на шагах 1–3 — 1,
 * при переходе в решётку — доля LATTICE_BALL_SCALE, как у ионов фрагмента. Плавная дорожка.
 */
export const AL2O3_DRAW_SCALE: ScalarTrack = [
  { t: T_MOVE_LATTICE.from, v: 1 },
  { t: T_MOVE_LATTICE.to, v: LATTICE_BALL_SCALE / SPECIES_SCALE, ease: 'smooth' },
]

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
const FILM_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.6, v: 1, ease: 'smooth' },
  { t: T_FILM_OUT.from, v: 1 },
  { t: T_FILM_OUT.to, v: 0, ease: 'smooth' },
]
/** Металлические связи уходят вместе с трещиной — ячейка распадается раньше атомов. */
const METAL_BOND: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.8, v: 1, ease: 'smooth' },
  { t: T_CRACK.from, v: 1 },
  { t: T.sub, v: 0, ease: 'smooth' },
]
/** Связи O=O: натяжение, затем ГОМОЛИТИЧЕСКИЙ разрыв (split = 0 в сцене). */
const BOND_STRESS: ScalarTrack = [
  { t: T.brk - 1.2, v: 0 },
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
const METAL_EDGES: ScalarTrack = [
  { t: 0.2, v: 0 },
  { t: 1.0, v: 1, ease: 'smooth' },
  { t: T_CRACK.from, v: 1 },
  { t: T.crack + 0.5, v: 0, ease: 'smooth' },
]
const CORUNDUM_EDGES: ScalarTrack = [
  { t: T.lattice - 0.8, v: 0 },
  { t: T.lattice, v: 1, ease: 'smooth' },
  { t: AL2O3_FINISH.from, v: 1 },
  { t: AL2O3_FINISH.to, v: 0, ease: 'smooth' },
]
/** С какого момента пул рёбер держит ячейки корунда (в этот момент обе дорожки = 0). */
export const EDGE_SWITCH_T = stepFrom(2)

/** Валентные точки: зажигаются в конце шага 2 («до»), гаснут, когда ионы уходят в решётку. */
const VALENCE_WIN = { from: stepTo(1) - 0.9, off: T_MOVE_LATTICE.from + 0.5 }

/** Размерная линия плёнки и многогранники шага 5 — окна видимости (= окна их подписей). */
const W_FILM_DIM: readonly [number, number] = [0.6, T_CRACK.from + 0.2]
const W_POLY: readonly [number, number] = [stepFrom(4) + 0.6, stepTo(4) + 0.8]

const FADE = fadeTrack(AL2O3_FINISH)

/** Центр выделенного октаэдра — цель наезда камеры на шаге 5. */
const OCTA_CENTER = siteScene(OCTA.al)

/**
 * Камера (kit/camera): общий план колонны «металл + плёнка» чуть сверху, наезд на перенос,
 * отъезд на решётку, крупно октаэдр, медленный облёт на финале.
 */
export const AL2O3_CAMERA: ShotTrack = shotTrack([
  { t: 0, zoom: 0.46, yaw: 0.3, pitch: 0.2, target: [0, 0, 0] },
  { t: stepTo(0), zoom: 0.47 },
  { t: stepTo(1) - 1.2, zoom: 0.86, yaw: 0, pitch: 0.06, target: [0, 0, STAGE_Z] },
  { t: stepTo(2), zoom: 0.88 },
  { t: T.lattice - 1.2, zoom: 0.6, yaw: 0.35, pitch: 0.2, target: [0, 0, 0] },
  { t: stepTo(3), zoom: 0.6 },
  { t: T.octa, zoom: 0.95, yaw: 0.22, pitch: 0.14, target: OCTA_CENTER },
  { t: stepTo(4), zoom: 0.95 },
  { t: stepFrom(5) + 1.2, zoom: 0.62, yaw: 0.3, pitch: 0.2, target: [0, 0, 0] },
  ...orbitTrack(stepFrom(5) + 1.3, stepTo(5), 0.3, 0.8, 0.2, 0.62),
])

const BASE_EMISSIVE = 0.08
const BASE_BLOOM = 0.3

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D — только формулы, заряды, числа и символы единиц (токены)
// ─────────────────────────────────────────────────────────────────────────────

export type Al2o3LabelDef = SceneLabelDef & {
  anchor:
    | 'atom'
    | 'atomIn'
    | 'metal'
    | 'metalEdge'
    | 'film'
    | 'filmDim'
    | 'o2'
    | 'o2Bond'
    | 'electron'
    | 'edgeA'
    | 'edgeC'
    | 'fragAbove'
    | 'site'
    | 'dimShort'
    | 'dimLong'
  atom?: string
  /** индекс прыжка электрона (anchor 'electron') или узла корунда (anchor 'site') */
  index?: number
  /** сдвиг по X (подписи над фрагментом в одну строку) */
  dx?: number
  hosts: readonly string[]
}

const fmt = (v: number, dec: number) => (Math.round(v * 10 ** dec) / 10 ** dec).toFixed(dec)
const signed1 = (v: number) => (v < 0 ? `−${fmt(-v, 1)}` : `+${fmt(v, 1)}`)
const fmtRange = (lo: number, hi: number) => `${lo}–${hi}`

const W_STORY_END = T_MOVE_LATTICE.to + 0.6

function storyLabel(id: StoryId): Al2o3LabelDef {
  if (id.startsWith('al')) {
    const js = jumpsOf(id, 'donor')
    const up = id.endsWith('1')
    return {
      id,
      kind: 'species',
      anchor: 'atom',
      atom: id,
      dy: up ? 0.16 : -0.16,
      keys: [{ t: 0, text: 'Al ({g})' }, { t: js[0]!.leave, text: 'Al⁺' }, { t: js[1]!.leave, text: 'Al²⁺' }, { t: js[2]!.leave, text: 'Al³⁺' }],
      windows: [[DETACH[id as (typeof STORY_AL)[number]], W_STORY_END]],
      hosts: [id],
    }
  }
  const js = jumpsOf(id, 'acceptor').sort((a, b) => a.arrive - b.arrive)
  return {
    id,
    kind: 'species',
    anchor: 'atomIn',
    atom: id,
    dy: 0,
    keys: [{ t: 0, text: 'O ({g})' }, { t: js[0]!.arrive, text: 'O⁻' }, { t: js[1]!.arrive, text: 'O²⁻' }],
    windows: [[T.brk, W_STORY_END]],
    hosts: [id],
  }
}

export const AL2O3_LABELS: readonly Al2o3LabelDef[] = [
  // Шаг 1: металл, плёнка (в масштабе), O₂ на её поверхности
  { id: 'metal', kind: 'species', anchor: 'metal', dy: 0, keys: [{ t: 0, text: 'Al ({s})' }], windows: [[0.2, T_METAL_OUT.to]], hosts: [...METAL_IDS, ...STORY_AL] },
  { id: 'metalA', kind: 'measure', anchor: 'metalEdge', dy: -0.34, keys: [{ t: 0, text: METAL_CAPTION[0]! }], windows: [[0.6, T_CRACK.from]], hosts: [] },
  { id: 'film', kind: 'species', anchor: 'film', dy: 0, keys: [{ t: 0, text: 'Al₂O₃' }], windows: [[0.2, T_FILM_OUT.to]], hosts: FILM_IDS },
  { id: 'filmT', kind: 'measure', anchor: 'filmDim', dy: 0, keys: [{ t: 0, text: `${fmtRange(FILM.min, FILM.max)} {nm}` }], windows: [W_FILM_DIM], hosts: [] },
  { id: 'o2', kind: 'species', anchor: 'o2', dy: 0.5, keys: [{ t: 0, text: 'O₂ ({g})' }], windows: [[0.2, T.brk]], hosts: [...STORY_O] },
  { id: 'o2Bond', kind: 'measure', anchor: 'o2Bond', dy: 0, keys: [{ t: 0, text: `${fmt(bondLengthPm('O=O'), 2)} {pm}` }], windows: [[0.8, T.brk - 0.3]], hosts: [] },
  // Шаги 2–4: частицы сюжета; заряд — в кадр ухода (Al) и прихода (O) каждого электрона
  ...STORY_IDS.map(storyLabel),
  ...AL2O3_JUMPS.map((j, k) => ({
    id: j.id,
    kind: 'token' as const,
    anchor: 'electron' as const,
    index: k,
    dy: j.arcSign > 0 ? 0.2 : -0.2,
    keys: [{ t: 0, text: 'e⁻' }],
    windows: [[j.leave - AL2O3_ELECTRON_LEAD, j.arrive + 0.15]] as const,
    hosts: [] as string[],
  })),
  // Шаг 4: корунд
  { id: 'product', kind: 'species', anchor: 'fragAbove', dy: 1.45, keys: [{ t: 0, text: 'α-Al₂O₃ ({s})' }], windows: [[GROW.from + 1.2, AL2O3_END]], hosts: [...LATTICE_IDS, ...STORY_IDS] },
  { id: 'cellA', kind: 'measure', anchor: 'edgeA', dy: -0.34, keys: [{ t: 0, text: CORUNDUM_CAPTION[0]! }], windows: [[T.lattice - 0.6, AL2O3_END]], hosts: [] },
  { id: 'cellC', kind: 'measure', anchor: 'edgeC', dy: 0, keys: [{ t: 0, text: CORUNDUM_CAPTION[1]! }], windows: [[T.lattice - 0.5, AL2O3_END]], hosts: [] },
  { id: 'sg', kind: 'token', anchor: 'fragAbove', dy: 0.42, dx: -0.6, keys: [{ t: 0, text: CORUNDUM_CAPTION[2]! }], windows: [[T.lattice - 0.4, AL2O3_END]], hosts: [] },
  { id: 'cn', kind: 'token', anchor: 'fragAbove', dy: 0.42, dx: 0.6, keys: [{ t: 0, text: CORUNDUM_CAPTION[3]! }], windows: [[T.lattice - 0.2, AL2O3_END]], hosts: [] },
  // Шаг 5: выделенные ионы и две длины Al–O (из координат узлов ядра)
  { id: 'alStar', kind: 'species', anchor: 'site', index: OCTA.al, dy: 0.22, keys: [{ t: 0, text: 'Al³⁺' }], windows: [W_POLY], hosts: [] },
  { id: 'oStar', kind: 'species', anchor: 'site', index: OCTA.o, dy: -0.26, keys: [{ t: 0, text: 'O²⁻' }], windows: [W_POLY], hosts: [] },
  { id: 'dShort', kind: 'measure', anchor: 'dimShort', dy: 0, keys: [{ t: 0, text: `${fmt(OCTA.shortPm, 1)} {pm}` }], windows: [W_POLY], hosts: [] },
  { id: 'dLong', kind: 'measure', anchor: 'dimLong', dy: 0, keys: [{ t: 0, text: `${fmt(OCTA.longPm, 1)} {pm}` }], windows: [W_POLY], hosts: [] },
  // Шаг 6: итог из цикла Борна — Габера (число из ядра)
  { id: 'dH', kind: 'measure', anchor: 'fragAbove', dy: 0.9, keys: [{ t: 0, text: `ΔH°f = ${signed1(AL2O3_DHF_KJ)} {kJmol}` }], windows: [[stepFrom(5) + 0.4, AL2O3_END]], hosts: [] },
]

export type Al2o3LabelState = SceneLabelState

/** Нижнее переднее ребро ячейки вдоль x (для подписи a) и переднее правое вертикальное (для c). */
const edgeWhere = (pred: (p: V3, q: V3) => boolean): LatticeSegment => {
  const cand = CORUNDUM_FRAG.cellEdges.filter(([p, q]) => pred(p, q))
  if (cand.length === 0) throw new Error('al2o3: не найдено ребро ячейки')
  return cand[0]!
}
const B_MIN = CORUNDUM_FRAG.boundsScene.min
const B_MAX = CORUNDUM_FRAG.boundsScene.max
const e6 = (a: number, b: number) => Math.abs(a - b) < 1e-6
export const AL2O3_EDGE_A: LatticeSegment = (() => {
  const cand = CORUNDUM_FRAG.cellEdges.filter(([p, q]) => e6(p[1], B_MIN[1]) && e6(q[1], B_MIN[1]) && e6(p[2], B_MAX[2]) && e6(q[2], B_MAX[2]) && !e6(p[0], q[0]))
  cand.sort((a, b) => Math.min(a[0][0], a[1][0]) - Math.min(b[0][0], b[1][0]))
  return cand[0]!
})()
export const AL2O3_EDGE_C: LatticeSegment = edgeWhere(
  (p, q) => e6(p[0], q[0]) && e6(p[2], q[2]) && !e6(p[1], q[1]) && e6(p[2], B_MAX[2]) && p[0] >= Math.max(...CORUNDUM_FRAG.cellEdges.filter(([a, b]) => e6(a[2], B_MAX[2]) && e6(b[2], B_MAX[2])).map(([a]) => a[0])) - 1e-6,
)
/** Размерные линии a и c: на этом расстоянии снаружи рёбер (вне сфер), мировые единицы. */
export const AL2O3_DIM_DROP = R_LATTICE.oIon + 0.12

const METAL_BOTTOM_Y = METAL_Y + METAL_FRAG.boundsScene.min[1]

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type Al2o3Valence = { center: THREE.Vector3; radius: number; count: number; amount: number; highlight: number }

export type Al2o3Frame = {
  t: number
  pos: THREE.Vector3[]
  radius: Float32Array
  charge: Float32Array
  opacity: Float32Array
  emissive: Float32Array
  material: SubstanceKind[]
  /** связи O=O (три молекулы — одна дорожка) */
  bond: { stress: number; thinning: number; opacity: number }
  /** металлические связи ГЦК (0…1) */
  metalBond: number
  /** какой набор рёбер ячеек в пуле и его прозрачность */
  edgeSet: 'metal' | 'corundum'
  edges: number
  electrons: ElectronJump[]
  /** валентные облака частиц сюжета (порядок STORY_IDS) */
  valence: Al2o3Valence[]
  /** амплитуды эффектов (тест: в финале все 0) */
  fx: { electrons: number }
  /** размерные линии и многогранники (видимость = видимость их подписей) */
  dims: { film: number; edgeA: number; edgeC: number; poly: number }
  /** множитель масштаба шаров частиц сюжета относительно SPECIES_SCALE */
  drawScale: number
  labels: Al2o3LabelState[]
  camera: SceneCamera
  fade: number
}

const VIEW = new THREE.Vector3(0, 0, 1)

export function createAl2o3Frame(): Al2o3Frame {
  const n = AL2O3_ATOMS.length
  return {
    t: 0,
    pos: AL2O3_ATOMS.map(() => new THREE.Vector3()),
    radius: new Float32Array(n),
    charge: new Float32Array(n),
    opacity: new Float32Array(n),
    emissive: new Float32Array(n).fill(BASE_EMISSIVE),
    material: AL2O3_ATOMS.map(() => 'default' as SubstanceKind),
    bond: { stress: 0, thinning: 0, opacity: 0 },
    metalBond: 0,
    edgeSet: 'metal',
    edges: 0,
    electrons: AL2O3_JUMPS.map((j) => createElectronJump(j.id)),
    valence: STORY_IDS.map(() => ({ center: new THREE.Vector3(), radius: 0, count: 0, amount: 0, highlight: -1 })),
    fx: { electrons: 0 },
    dims: { film: 0, edgeA: 0, edgeC: 0, poly: 0 },
    drawScale: 1,
    labels: createLabelStates(AL2O3_LABELS),
    camera: createSceneCamera(),
    fade: 0,
  }
}

/** Кадр, для которого сейчас считаются подписи (anchorLabel — модульная функция, без замыканий в кадре). */
let _cur: Al2o3Frame | null = null

const METAL_LABEL_X = METAL_HALF_W + 0.55
const FILM_LABEL_Y = FILM_Y0 + (FILM_Y1 - FILM_Y0) * 0.78

function anchorLabel(def: SceneLabelDef, st: SceneLabelState): void {
  const f = _cur!
  const d = def as Al2o3LabelDef
  const p = f.pos
  switch (d.anchor) {
    case 'atom': {
      const i = IDX(d.atom!)
      st.pos.copy(p[i]!)
      st.pos.y += d.dy > 0 ? f.radius[i]! + d.dy : -(f.radius[i]! - d.dy)
      return
    }
    case 'atomIn': {
      // Сбоку от атома, со стороны центра кадра (с внешней стороны летят электроны).
      const i = IDX(d.atom!)
      st.pos.copy(p[i]!)
      st.pos.x += (p[i]!.x < 0 ? 1 : -1) * (f.radius[i]! + 0.22)
      return
    }
    case 'metal':
      st.pos.set(METAL_LABEL_X, METAL_Y + d.dy, METAL_HALF_W)
      return
    case 'metalEdge':
      st.pos.set(0, METAL_BOTTOM_Y + d.dy, METAL_HALF_W)
      return
    case 'film':
      st.pos.set(-METAL_LABEL_X, FILM_LABEL_Y + d.dy, METAL_HALF_W)
      return
    case 'filmDim':
      st.pos.set(FILM_DIM.x + 0.42, (FILM_DIM.y0 + FILM_DIM.y1) / 2 + d.dy, FILM_DIM.z)
      return
    case 'o2': {
      const m = O2_MOLECULES[1]!
      st.pos.copy(p[IDX(m.a)]!).lerp(p[IDX(m.b)]!, 0.5)
      st.pos.y += d.dy
      return
    }
    case 'o2Bond': {
      const m = O2_MOLECULES[2]!
      st.pos.copy(p[IDX(m.b)]!)
      st.pos.x += R.o + 0.45
      return
    }
    case 'electron':
      st.pos.copy(f.electrons[d.index!]!.pos)
      st.pos.y += d.dy
      return
    case 'edgeA':
      st.pos.set(
        (AL2O3_EDGE_A[0][0] + AL2O3_EDGE_A[1][0]) / 2,
        (AL2O3_EDGE_A[0][1] + AL2O3_EDGE_A[1][1]) / 2 - AL2O3_DIM_DROP + d.dy,
        (AL2O3_EDGE_A[0][2] + AL2O3_EDGE_A[1][2]) / 2,
      )
      return
    case 'edgeC':
      st.pos.set(AL2O3_EDGE_C[0][0] + AL2O3_DIM_DROP + 0.5, (AL2O3_EDGE_C[0][1] + AL2O3_EDGE_C[1][1]) / 2 + d.dy, AL2O3_EDGE_C[0][2])
      return
    case 'fragAbove':
      st.pos.set(d.dx ?? 0, B_MAX[1] + d.dy, 0)
      return
    case 'site': {
      const s = CORUNDUM_FRAG.sites[d.index!]!.posScene
      st.pos.set(s[0], s[1] + d.dy, s[2] + 0.12)
      return
    }
    case 'dimShort':
    case 'dimLong': {
      const a = CORUNDUM_FRAG.sites[OCTA.al]!.posScene
      const b = CORUNDUM_FRAG.sites[d.anchor === 'dimShort' ? OCTA.short : OCTA.long]!.posScene
      st.pos.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + 0.16)
      return
    }
  }
}

const TRACKS: (Vec3Track | undefined)[] = AL2O3_ATOMS.map((a) => POS[a.id])
const LABEL_INDEX = (id: string) => AL2O3_LABELS.findIndex((l) => l.id === id)
const L_FILM_T = LABEL_INDEX('filmT')
const L_CELLA = LABEL_INDEX('cellA')
const L_CELLC = LABEL_INDEX('cellC')
const L_DSHORT = LABEL_INDEX('dShort')
const LATTICE_TIMES: readonly number[] = LATTICE_IDS.map((id) => LATTICE_ARRIVAL.get(id)!.start)
const LATTICE_FULL_R: readonly number[] = LATTICE_IDS.map((id) => (AL2O3_ATOMS[IDX(id)]!.el === 'Al' ? R_LATTICE.alIon : R_LATTICE.oIon))
const STORY_SNAP = STORY_IDS.map((id) => ({ charge: AL2O3_SNAP[`charge.${id}`]!, radius: AL2O3_SNAP[`radius.${id}`]! }))
const STORY_IS_AL = STORY_IDS.map((id) => id.startsWith('al'))
const STORY_DETACH = STORY_IDS.map((id) => (id.startsWith('al') ? DETACH[id as (typeof STORY_AL)[number]] : 0))
const STORY_FIRST = STORY_IDS.map((id) => (id.startsWith('al') ? AL2O3_FIRST_LEAVE[id]! : AL2O3_FIRST_ARRIVE[id]!))
const JUMP_DONOR = AL2O3_JUMPS.map((j) => IDX(j.donor))
const JUMP_ACCEPTOR = AL2O3_JUMPS.map((j) => IDX(j.acceptor))
/** Для валентных облаков: прыжки, у которых частица донор (Al) или акцептор (O), по порядку STORY_IDS. */
const STORY_JUMPS: readonly (readonly number[])[] = STORY_IDS.map((id) =>
  AL2O3_JUMPS.map((j, k) => ({ j, k })).filter(({ j }) => (id.startsWith('al') ? j.donor === id : j.acceptor === id)).map(({ k }) => k),
)
const FILM_R: readonly number[] = FILM_SITES.map((f) => (f.el === 'Al' ? R.filmAl : R.filmO))

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleAl2o3Frame(t: number, frame: Al2o3Frame): Al2o3Frame {
  frame.t = t
  const { pos, radius, charge, opacity, material, emissive } = frame

  for (let i = 0; i < AL2O3_ATOMS.length; i++) {
    const tr = TRACKS[i]
    if (tr) sampleVec3(tr, t, pos[i]!)
    emissive[i] = BASE_EMISSIVE
  }

  // ——— Частицы сюжета: радиус/заряд/материал ступенью, масштаб шаров — дорожкой ———
  const appear = sampleScalar(APPEAR, t)
  const k = sampleScalar(AL2O3_DRAW_SCALE, t)
  frame.drawScale = k
  for (let s = 0; s < STORY_INDEX.length; s++) {
    const i = STORY_INDEX[s]!
    const snap = STORY_SNAP[s]!
    radius[i] = sampleScalar(snap.radius, t) * k
    charge[i] = sampleScalar(snap.charge, t)
    opacity[i] = appear
    if (STORY_IS_AL[s]) material[i] = t < STORY_DETACH[s]! - 0.3 ? 'metal' : t < STORY_FIRST[s]! ? 'gas' : 'ion'
    else material[i] = t < STORY_FIRST[s]! ? 'gas' : 'ion'
  }

  // ——— Металл: ГЦК 2×2×1, уходит и гаснет полностью ———
  const metalA = sampleScalar(METAL_OPACITY, t)
  for (let i = I_METAL0; i < I_FILM0; i++) {
    radius[i] = R.al
    charge[i] = 0
    opacity[i] = metalA
    material[i] = 'metal'
  }
  frame.metalBond = sampleScalar(METAL_BOND, t)

  // ——— Аморфная плёнка: ионы в масштабе, расходится трещиной и гаснет ———
  const filmA = sampleScalar(FILM_OPACITY, t)
  for (let i = I_FILM0, n = 0; i < I_LATTICE0; i++, n++) {
    const al = FILM_SITES[n]!.el === 'Al'
    radius[i] = FILM_R[n]!
    charge[i] = al ? 3 : -2
    opacity[i] = filmA
    material[i] = 'ion'
  }

  // ——— Решётка корунда: готовые Al³⁺ / O²⁻, растут из точки в начале своего подлёта ———
  for (let n = 0; n < LATTICE_IDS.length; n++) {
    const i = I_LATTICE0 + n
    const a = LATTICE_TIMES[n]!
    const grow = t <= a ? 0 : smoothstep(a, a + GROW.appear, t)
    radius[i] = LATTICE_FULL_R[n]! * grow
    charge[i] = AL2O3_ATOMS[i]!.el === 'Al' ? 3 : -2
    material[i] = 'ion'
    opacity[i] = grow * 3 >= 1 ? 1 : grow * 3
  }

  // ——— Связи O=O ———
  frame.bond.stress = sampleScalar(BOND_STRESS, t)
  frame.bond.thinning = sampleScalar(BOND_THIN, t)
  frame.bond.opacity = sampleScalar(BOND_OPACITY, t)

  // ——— Рёбра ячеек ———
  if (t < EDGE_SWITCH_T) {
    frame.edgeSet = 'metal'
    frame.edges = sampleScalar(METAL_EDGES, t)
  } else {
    frame.edgeSet = 'corundum'
    frame.edges = sampleScalar(CORUNDUM_EDGES, t)
  }

  // ——— Двенадцать электронов ———
  let fxE = 0
  for (let j = 0; j < AL2O3_JUMPS.length; j++) {
    const jump = AL2O3_JUMPS[j]!
    const d = JUMP_DONOR[j]!
    const a = JUMP_ACCEPTOR[j]!
    sampleElectronJump(frame.electrons[j]!, t, {
      donor: pos[d]!,
      acceptor: pos[a]!,
      shellRadius: R.al + DOT_GAP,
      acceptorRadius: radius[a]!,
      leave: jump.leave,
      arrive: jump.arrive,
      arcSign: jump.arcSign,
      lead: AL2O3_ELECTRON_LEAD,
      view: VIEW,
    })
    fxE += frame.electrons[j]!.opacity
  }
  frame.fx.electrons = fxE

  // ——— Валентные облака: count = valenceElectrons − charge (ядро); у Al — минус электроны «на выходе» ———
  const on = smoothstep(VALENCE_WIN.from, VALENCE_WIN.from + 0.5, t)
  const off = 1 - smoothstep(VALENCE_WIN.off - 0.5, VALENCE_WIN.off, t)
  for (let s = 0; s < STORY_INDEX.length; s++) {
    const i = STORY_INDEX[s]!
    const v = frame.valence[s]!
    const el: ElementSymbol = STORY_IS_AL[s] ? 'Al' : 'O'
    const q = Math.round(charge[i]!)
    let count = ATOMIC_DATA[el].valenceElectrons - q
    let highlight = -1
    const jumps = STORY_JUMPS[s]!
    for (let m = 0; m < jumps.length; m++) {
      const jump = AL2O3_JUMPS[jumps[m]!]!
      // Донор: электрон, уже вышедший на оболочку (фаза lead), рисуется сам — его точку убираем.
      if (STORY_IS_AL[s] && t >= jump.leave - AL2O3_ELECTRON_LEAD && t < jump.leave) count--
      // Акцептор: только что пришедший электрон подсвечен.
      if (!STORY_IS_AL[s] && t >= jump.arrive && t < jump.arrive + 1.0) highlight = count - 1
    }
    v.center.copy(pos[i]!)
    v.radius = radius[i]! + DOT_GAP
    v.count = count >= 8 ? 8 : count <= 0 ? 0 : count
    v.amount = v.count > 0 ? on * off : 0
    v.highlight = highlight
  }

  frame.fade = sampleScalar(FADE, t)

  // ——— Подписи ———
  _cur = frame
  sampleLabels(AL2O3_LABELS, frame.labels, t, anchorLabel, frame.fade)
  _cur = null
  frame.dims.film = frame.labels[L_FILM_T]!.opacity
  frame.dims.edgeA = frame.labels[L_CELLA]!.opacity
  frame.dims.edgeC = frame.labels[L_CELLC]!.opacity
  frame.dims.poly = frame.labels[L_DSHORT]!.opacity

  // ——— Камера ———
  const cam = frame.camera
  sampleShot(AL2O3_CAMERA, t, cam)
  cam.shake = 0
  let glow = 0
  for (let j = 0; j < frame.electrons.length; j++) {
    const e = frame.electrons[j]!
    const g = e.glow * e.opacity
    if (g > glow) glow = g
  }
  cam.bloom = BASE_BLOOM + 0.15 * glow
  cam.vignette = Math.max(0.3, frame.fade)
  return frame
}

/** Окна видимости размерных линий и многогранников (для теста). */
export const AL2O3_WINDOWS = { filmDim: W_FILM_DIM, poly: W_POLY, windowFade } as const

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validateAl2o3Storyboard(): void {
  const vec: Record<string, Vec3Track> = {}
  for (const [id, track] of Object.entries(POS)) vec[`pos.${id}`] = track
  vec['cam.offset'] = AL2O3_CAMERA.offset
  validateTracks(vec)
  validateTracks({
    ...AL2O3_SNAP,
    AL2O3_DRAW_SCALE,
    APPEAR,
    METAL_OPACITY,
    FILM_OPACITY,
    METAL_BOND,
    BOND_STRESS,
    BOND_THIN,
    BOND_OPACITY,
    METAL_EDGES,
    CORUNDUM_EDGES,
    FADE,
    camZoom: AL2O3_CAMERA.zoom,
    camYaw: AL2O3_CAMERA.yaw,
    camPitch: AL2O3_CAMERA.pitch,
  })

  if (FILM.unit !== 'нм') throw new Error(`al2o3: толщина плёнки в ядре не в нм (${FILM.unit})`)
  const nAl = FILM_SITES.filter((f) => f.el === 'Al').length
  const nO = FILM_SITES.length - nAl
  if (nAl === 0 || nAl * 3 !== nO * 2) throw new Error(`al2o3: состав плёнки ${nAl} Al : ${nO} O ≠ 2 : 3`)
  if (METAL_BONDS.length !== METAL_FRAG.bonds.length) throw new Error('al2o3: металлические связи потеряны')
  if (STORY_AL.length * 3 !== STORY_O.length * 2) throw new Error('al2o3: в сюжете не две формульные единицы')
  for (const id of STORY_IDS) {
    const si = STORY_SITE[id]
    const el = id.startsWith('al') ? 'Al' : 'O'
    if (CORUNDUM_FRAG.sites[si]!.el !== el) throw new Error(`al2o3: атом ${id} стоит в чужом узле`)
  }
  for (const a of AL2O3_ATOMS) {
    const si = CORUNDUM_SITE_OF.get(a.id)
    if (si != null && CORUNDUM_FRAG.sites[si]!.el !== a.el) throw new Error(`al2o3: атом ${a.id} стоит в чужом узле`)
  }
  if (!(R.alIon < R.al)) throw new Error('al2o3: Al³⁺ обязан быть меньше атома Al')
  if (!(R.oIon > R.o)) throw new Error('al2o3: O²⁻ обязан быть больше атома O')
  if (OCTA.shell.neighbors.length !== CN_AL || OCTA.tetra.neighbors.length !== CN_O) throw new Error('al2o3: многогранники шага 5 неполные')
  if (AL2O3_END <= stepTo(LAST_STEP)) throw new Error('al2o3: хвост сцены пустой')
}
