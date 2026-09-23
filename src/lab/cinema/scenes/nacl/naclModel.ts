import * as THREE from 'three'
import { bondLengthPm, getCrystal, radiusForSpecies, type ElementSymbol } from '../../../../chemistry/data'
import { heroSpecFor } from '../../../../chemistry/data/heroStructures'
import { bondLength, LATTICE_BALL_SCALE, pmToScene, SPECIES_SCALE, speciesRadius } from '../kit/cpkAtoms'
import { coordinationShell, latticeCaption, latticeFragment } from '../kit/lattice'
import { NACL_DHF_KJ, NACL_LATTICE_KJ } from './naclEnergetics'
import { NACL_ELECTRONS, NACL_END, NACL_FINISH, NACL_MORPH_S, NACL_STEPS, naclCueAt } from './naclSteps'

/**
 * Модель сцены 2 Na (тв.) + Cl₂ (г.) → 2 NaCl (тв.) — ЧИСТЫЕ функции геометрии и таймлайна.
 *
 * Без WebGL и без React: этот модуль читают класс NaClReactionScene, герой продукта и тест
 * scripts/test-nacl-cinema.mts (в Node). Состояние кадра — функция ОДНОГО числа: времени сюжета t.
 *
 * Ни одного числа химии: радиусы — radiusForSpecies через kit/cpkAtoms (Na⁰ металлический 186 пм,
 * Cl⁰ ковалентный 102 пм, ионы — Шеннон при КЧ 6: 102 и 181 пм), длины — bondData (Cl–Cl, газовая
 * Na–Cl), решётки — crystalData через kit/lattice (ОЦК натрия, каменная соль 3×3×3 ячейки — столько
 * же, сколько у героя продукта в heroStructures), энергия — цикл Борна — Габера ядра.
 *
 * Параметры РИСУНКА (не химии) названы и собраны здесь: доли радиуса шаров (SPECIES_SCALE,
 * LATTICE_BALL_SCALE — одна на все частицы кадра, отношения размеров честные), места действия,
 * зазор валентных точек, раскадровка движения.
 *
 * Законы, выполненные по построению (тест проверяет каждые 1/60 с):
 *   • Σ зарядов частиц + (−1)·(летящие e⁻) = 0: Na⁺ образуется в кадр УХОДА электрона (ионизация),
 *     Cl⁻ — в кадр ПОГЛОЩЕНИЯ; размеры, цвет и подписи заряда меняются у обоих ОДНОВРЕМЕННО с кадра
 *     поглощения и одинаково долго (NACL_MORPH_S) — перенос читается одним событием;
 *   • у каждого объекта своё окно видимости, вне его непрозрачность и масштаб строго 0;
 *   • ионная связь — дуги поля точками, без «палочки»; Cl–Cl — один цилиндр и одна общая пара;
 *   • решётка — целое число ячеек, заряды чередуются, у внутреннего иона 6 противоионов на
 *     cationAnionPm; финал без огня и свечения внутри кристалла.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

export type V3 = readonly [number, number, number]

export const NACL_SALT = getCrystal('nacl')!
export const NACL_METAL = getCrystal('na_metal')!

/** Число ячеек решётки — из спецификации героя продукта: сцена кончается ровно этой решёткой. */
export const NACL_LATTICE_CELLS: readonly [number, number, number] = (() => {
  const spec = heroSpecFor('nacl')
  if (!spec || spec.kind !== 'crystal') throw new Error('nacl: герой NaCl обязан быть кристаллом')
  return [spec.cells[0], spec.cells[1], spec.cells[2]] as const
})()

/** Фрагмент каменной соли (центр рамки ячеек — в начале координат). */
export const SALT_FRAG = latticeFragment('nacl', NACL_LATTICE_CELLS)
/** Одна ОЦК-ячейка натрия: 8 вершин + центр. */
export const METAL_FRAG = latticeFragment('na_metal', [1, 1, 1])
/** ['a = 564 {pm}', 'Fm-3m', '{cn} 6:6'] */
export const SALT_CAPTION = latticeCaption('nacl')

/** Шаг сетки узлов = d(Na⁺–Cl⁻) = a/2, мировые единицы. */
export const NACL_H = pmToScene(NACL_SALT.cationAnionPm)
/** r_e газовой молекулы NaCl, мировые единицы. */
export const NACL_D_GAS = pmToScene(bondLengthPm('Na-Cl'))
/** Половина длины связи Cl–Cl. */
const CL_HALF = bondLength('Cl-Cl') / 2

/** Радиусы частиц в пм (ядро) — для подписей и тестов. */
export const NACL_RADIUS_PM = {
  /** металлический радиус Na (КЧ 12) */
  na: radiusForSpecies('Na', 0, { model: 'metallic' }),
  /** ковалентный радиус Cl (Cordero) */
  cl: radiusForSpecies('Cl', 0, { model: 'covalent' }),
  naIon: radiusForSpecies('Na', 1),
  clIon: radiusForSpecies('Cl', -1),
} as const

/** Радиусы шаров шагов 1–3 (доля SPECIES_SCALE), мировые единицы. */
export const NACL_R = {
  na: speciesRadius('Na', 0),
  cl: speciesRadius('Cl', 0),
  naIon: speciesRadius('Na', 1),
  clIon: speciesRadius('Cl', -1),
} as const

/** Шары решётки: ОДИН общий коэффициент на все ионы — отношение Cl⁻/Na⁺ = 181/102 сохранено. */
export const NACL_LATTICE_R = {
  naIon: speciesRadius('Na', 1, LATTICE_BALL_SCALE),
  clIon: speciesRadius('Cl', -1, LATTICE_BALL_SCALE),
} as const

/** Зазор валентных точек над поверхностью шара (параметр рисунка). */
export const NACL_DOT_GAP = 0.075

// ─── Узлы решётки в единицах a/2 ───

export type Grid = readonly [number, number, number]

/** Целые координаты узла в единицах a/2 (центр фрагмента — (0, 0, 0)). */
export function naclGridOf(i: number): Grid {
  const p = SALT_FRAG.sites[i]!.posScene
  return [Math.round(p[0] / NACL_H), Math.round(p[1] / NACL_H), Math.round(p[2] / NACL_H)]
}

const GRID_INDEX = new Map<string, number>(SALT_FRAG.sites.map((_, i) => [naclGridOf(i).join(','), i]))

/** Индекс узла фрагмента по целым координатам; бросает, если узла нет. */
export function naclSiteAt(gx: number, gy: number, gz: number): number {
  const i = GRID_INDEX.get(`${gx},${gy},${gz}`)
  if (i == null) throw new Error(`nacl: нет узла (${gx}, ${gy}, ${gz}) во фрагменте`)
  return i
}

/** Половина числа шагов сетки по ребру фрагмента (3 ячейки → узлы −3…3). */
export const NACL_GRID_HALF = NACL_LATTICE_CELLS[0]

/**
 * Плоскость действия шагов 1–4 — передняя грань будущей решётки (z = +3·a/2):
 * пары встают прямо в узлы передней грани, решётка достраивается за ними.
 */
export const NACL_STAGE_Z = NACL_GRID_HALF * NACL_H

/** Частицы сюжета: 2 Na и 2 Cl — ровно столько, сколько в уравнении 2 Na + Cl₂. */
export const NACL_STORY = [
  { id: 'na1', el: 'Na' as ElementSymbol, site: naclSiteAt(-1, 1, NACL_GRID_HALF) },
  { id: 'na2', el: 'Na' as ElementSymbol, site: naclSiteAt(-1, -1, NACL_GRID_HALF) },
  { id: 'clA', el: 'Cl' as ElementSymbol, site: naclSiteAt(0, 1, NACL_GRID_HALF) },
  { id: 'clB', el: 'Cl' as ElementSymbol, site: naclSiteAt(0, -1, NACL_GRID_HALF) },
] as const
export const I_NA1 = 0
export const I_NA2 = 1
export const I_CLA = 2
export const I_CLB = 3
/** Пара электрона k: донор и акцептор. */
export const NACL_PAIRS = [
  [I_NA1, I_CLA],
  [I_NA2, I_CLB],
] as const

/**
 * Координационные октаэдры КЧ 6:6 — у Na⁺ (вершины — 6 Cl⁻) и у Cl⁻ (вершины — 6 Na⁺), оба у передней
 * грани: вершина каждого выходит на лицевую плоскость и видна сквозь фрагмент, октаэдры не касаются.
 */
export const NACL_OCTA = [
  { center: naclSiteAt(-2, 1, NACL_GRID_HALF - 1), el: 'Na' as ElementSymbol },
  { center: naclSiteAt(1, -1, NACL_GRID_HALF - 1), el: 'Cl' as ElementSymbol },
] as const

/** Вершины октаэдров — 6 противоионов (по связям фрагмента). */
export const NACL_OCTA_SHELLS = NACL_OCTA.map((o) => coordinationShell(SALT_FRAG, o.center))

// ─── Места действия шагов 1–4 (плоскость z = NACL_STAGE_Z) ───

export const NACL_METAL_CENTER: V3 = [-1.75, 0, NACL_STAGE_Z]
export const NACL_CL2_CENTER: V3 = [1.75, 0, NACL_STAGE_Z]

/**
 * Собственный доворот ячейки металла (параметр рисунка, не химии): камера шагов 1–4 смотрит
 * фронтально, и неповёрнутый куб вырождался в квадрат — задние вершины прятались за передними,
 * рёбра сливались попарно. Те же углы, что у решётки соли на шаге 5 (NACL_SHOTS): трёхчетвертной
 * ракурс, в котором читается именно КУБ с атомом в центре (ОЦК). Углы выбраны по максимуму
 * наименьшего расстояния между проекциями девяти атомов: ни один атом не прячется за другим.
 */
export const NACL_METAL_YAW = 0.45
export const NACL_METAL_PITCH = 0.24

/** Точка ячейки металла: доворот вокруг вертикали и наклон, затем сдвиг в место действия. */
export function naclMetalPoint(p: Readonly<V3>): V3 {
  const cy = Math.cos(NACL_METAL_YAW)
  const sy = Math.sin(NACL_METAL_YAW)
  const cp = Math.cos(NACL_METAL_PITCH)
  const sp = Math.sin(NACL_METAL_PITCH)
  const x = p[0] * cy + p[2] * sy
  const z0 = -p[0] * sy + p[2] * cy
  const y = p[1] * cp - z0 * sp
  const z = p[1] * sp + z0 * cp
  return [NACL_METAL_CENTER[0] + x, NACL_METAL_CENTER[1] + y, NACL_METAL_CENTER[2] + z]
}

/** Атомы ячейки металла: два уходят в реакцию (вершины со стороны хлора, спереди), 7 гаснут. */
function metalSite(sx: number, sy: number, sz: number): number {
  const idx = METAL_FRAG.sites.findIndex(
    (s) => Math.sign(Math.round(s.posScene[0] * 1e6)) === sx && Math.sign(Math.round(s.posScene[1] * 1e6)) === sy && Math.sign(Math.round(s.posScene[2] * 1e6)) === sz,
  )
  if (idx < 0) throw new Error('nacl: нет вершины ОЦК-ячейки')
  return idx
}
const METAL_NA1 = metalSite(1, 1, 1)
const METAL_NA2 = metalSite(1, -1, 1)
/** Индексы атомов ячейки металла, которые не уходят в реакцию. */
export const NACL_METAL_REST = METAL_FRAG.sites.map((_, i) => i).filter((i) => i !== METAL_NA1 && i !== METAL_NA2)

const metalPos = (si: number): V3 => naclMetalPoint(METAL_FRAG.sites[si]!.posScene)
const saltPos = (si: number): V3 => SALT_FRAG.sites[si]!.posScene

/** Позиция атома металла (с учётом центра ячейки), мировые единицы. */
export function naclMetalPos(si: number): V3 {
  return metalPos(si)
}

/** Свободные атомы после сублимации/диссоциации — места переноса электрона. */
export const NACL_FREE: readonly V3[] = [
  [-1.05, NACL_H, NACL_STAGE_Z],
  [-1.05, -NACL_H, NACL_STAGE_Z],
  [0.8, NACL_H, NACL_STAGE_Z],
  [0.8, -NACL_H, NACL_STAGE_Z],
]

/** Газовые пары: середина пары — середина её будущих узлов, Na⁺ и Cl⁻ на r_e(NaCl, г.). */
function gasPos(na: number, cl: number, which: 'na' | 'cl'): V3 {
  const a = saltPos(NACL_STORY[na]!.site)
  const b = saltPos(NACL_STORY[cl]!.site)
  const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  const s = (which === 'na' ? -0.5 : 0.5) * NACL_D_GAS
  return [mid[0] + ((b[0] - a[0]) / NACL_H) * s, mid[1] + ((b[1] - a[1]) / NACL_H) * s, mid[2] + ((b[2] - a[2]) / NACL_H) * s]
}
export const NACL_GAS: readonly V3[] = [gasPos(I_NA1, I_CLA, 'na'), gasPos(I_NA2, I_CLB, 'na'), gasPos(I_NA1, I_CLA, 'cl'), gasPos(I_NA2, I_CLB, 'cl')]

// ─── Валентные точки (Льюис) и траектория электрона ───

const DEG = Math.PI / 180
/** Углы 7 валентных электронов Cl⁰ в плоскости кадра: три пары и одиночный слева-снизу. */
export const NACL_CL_DOT_ANGLES = [78 * DEG, 102 * DEG, -12 * DEG, 12 * DEG, 258 * DEG, 282 * DEG, 192 * DEG] as const
/** Индекс одиночного электрона Cl (он пришёл из общей пары Cl–Cl при гомолизе). */
export const NACL_CL_SINGLE = 6
/** Куда садится электрон натрия: пара к одиночному — октет. */
export const NACL_CL_ARRIVE_ANGLE = 168 * DEG
/** Единственный внешний электрон Na (3s¹) — на стороне хлора, чуть выше оси. */
export const NACL_NA_DOT_ANGLE = 12 * DEG

/**
 * Траектория электрона — КУБИЧЕСКАЯ КРИВАЯ БЕЗЬЕ: от внешнего уровня Na (3s¹) к свободному месту
 * валентной оболочки Cl; контрольные точки над линией Na–Cl (дуга в плоскости кадра).
 */
export function naclElectronCurve(k: 0 | 1): THREE.CubicBezierCurve3 {
  const [di, ai] = NACL_PAIRS[k]!
  const d = NACL_FREE[di]!
  const a = NACL_FREE[ai]!
  const rd = NACL_R.na + NACL_DOT_GAP
  const ra = NACL_R.cl + NACL_DOT_GAP
  const p0 = new THREE.Vector3(d[0] + rd * Math.cos(NACL_NA_DOT_ANGLE), d[1] + rd * Math.sin(NACL_NA_DOT_ANGLE), d[2])
  const p3 = new THREE.Vector3(a[0] + ra * Math.cos(NACL_CL_ARRIVE_ANGLE), a[1] + ra * Math.sin(NACL_CL_ARRIVE_ANGLE), a[2])
  const len = p0.distanceTo(p3)
  const p1 = new THREE.Vector3(p0.x + 0.22 * len, p0.y + 0.62 * len, p0.z)
  const p2 = new THREE.Vector3(p3.x - 0.22 * len, p3.y + 0.62 * len, p3.z)
  return new THREE.CubicBezierCurve3(p0, p1, p2, p3)
}
export const NACL_ELECTRON_CURVES = [naclElectronCurve(0), naclElectronCurve(1)] as const

// ─────────────────────────────────────────────────────────────────────────────
// Раскадровка (время сюжета = экранное время)
// ─────────────────────────────────────────────────────────────────────────────

const stepFrom = (i: number) => NACL_STEPS[i]!.from
const stepTo = (i: number) => NACL_STEPS[i]!.to

export const NACL_T = {
  appear: [0, 0.6] as const,
  metalEdges: [0.2, 1.0] as const,
  /** отрыв атомов от металла и прилёт на свободные места */
  detach: [naclCueAt('sublimate') - 0.3, naclCueAt('sublimate') + 0.3] as const,
  flyFree: 1.5,
  /** остальной металл уходит влево и гаснет до нуля */
  metalOut: [naclCueAt('sublimate') + 0.8, stepTo(1) - 1.3] as const,
  /** Cl–Cl: натяжение и гомолиз */
  stress: naclCueAt('bondBreak') - 1.4,
  brk: naclCueAt('bondBreak'),
  clFree: [naclCueAt('bondBreak') + 0.1, naclCueAt('bondBreak') + 1.4] as const,
  /** валентные точки «до переноса» */
  valenceIn: [stepTo(1) - 1.1, stepTo(1) - 0.6] as const,
  valenceOut: [stepFrom(3) + 0.1, stepFrom(3) + 0.7] as const,
  e: [NACL_ELECTRONS.e1, NACL_ELECTRONS.e2] as const,
  /** «разгон» электрона перед вылетом: точка разгорается */
  windUp: 0.8,
  morph: NACL_MORPH_S,
  /** газовые пары */
  pair: [stepFrom(3) + 0.5, naclCueAt('contact')] as const,
  gasScale: [stepFrom(3) + 0.5, stepFrom(3) + 1.7] as const,
  field: [stepFrom(3) + 0.9, stepFrom(4) + 1.2] as const,
  /** пары встают в узлы, шары сжимаются до доли решётки */
  toLattice: [stepFrom(4) + 0.3, stepFrom(4) + 1.9] as const,
  grow: { from: stepFrom(4) + 0.8, to: stepFrom(4) + 4.0, flight: 1.2, appear: 0.6, reach: 0.9 },
  /** частицы сюжета передают узлы инстансам решётки (вид одинаковый — шов не виден) */
  handover: stepFrom(4) + 2.0,
  saltEdges: [naclCueAt('lattice') - 1.0, naclCueAt('lattice') - 0.2] as const,
  octa: [naclCueAt('lattice') - 0.4, naclCueAt('lattice') + 0.3] as const,
  dimA: [naclCueAt('lattice') - 0.2, naclCueAt('lattice') + 0.4] as const,
  spin: [stepFrom(5), stepTo(5)] as const,
  finalLabels: stepFrom(5) + 0.3,
  finish: [NACL_FINISH.from, NACL_FINISH.to] as const,
} as const

/** Доля перехода a→b по времени: 0 до a, 1 после b, smoothstep внутри. */
export function naclSmooth(a: number, b: number, t: number): number {
  if (t <= a) return 0
  if (t >= b) return 1
  const x = (t - a) / (b - a)
  return x * x * (3 - 2 * x)
}
function smoother(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * c * (c * (c * 6 - 15) + 10)
}
const lerp = (a: number, b: number, u: number) => a + (b - a) * u

/**
 * Смена частицы при поглощении электрона: 0 до кадра поглощения, 1 через NACL_MORPH_S.
 * ОДНА функция для донора и акцептора пары — начало и длительность совпадают по построению.
 */
export function naclMorphAt(pair: 0 | 1, t: number): number {
  const a = NACL_T.e[pair]!.arrive
  return naclSmooth(a, a + NACL_T.morph, t)
}

/**
 * Масштаб шаров частиц сюжета относительно SPECIES_SCALE: 1 на шагах 1–3, полный радиус Шеннона
 * на шаге 4 (перекрытие газовой пары видно честно), доля решётки на шаге 5 — к ионам фрагмента.
 */
/** Шары сюжета на шагах 1–3 — ровно масштаб кита (SPECIES_SCALE), как у остальных сцен; уменьшаем только газовую пару шага 4. */
const STORY_BALL = 1
/** Газовая пара на шаге 4: не полный радиус Шеннона (1/0.72 = 1.39×), а 0.88 — перекрытие 102 + 181 > 236,1 пм всё ещё видно (249 > 236), но пара не заслоняет кадр. */
const GAS_PAIR_BALL = 0.88 / SPECIES_SCALE
export function naclDrawScale(t: number): number {
  const full = GAS_PAIR_BALL
  const lat = LATTICE_BALL_SCALE / SPECIES_SCALE
  if (t < NACL_T.toLattice[0]) return lerp(STORY_BALL, full, naclSmooth(NACL_T.gasScale[0], NACL_T.gasScale[1], t))
  return lerp(full, lat, naclSmooth(NACL_T.toLattice[0], NACL_T.toLattice[1], t))
}

/** Прилёт иона решётки: старт по рангу удалённости от пар сюжета (ближние — раньше). */
export const NACL_LATTICE_START: Float32Array = (() => {
  const story = new Set<number>(NACL_STORY.map((s) => s.site))
  const c = [0, 0, 0]
  for (const s of NACL_STORY) {
    const p = saltPos(s.site)
    c[0] += p[0] / 4
    c[1] += p[1] / 4
    c[2] += p[2] / 4
  }
  const ranked = SALT_FRAG.sites
    .map((s, i) => ({ i, d: Math.hypot(s.posScene[0] - c[0]!, s.posScene[1] - c[1]!, s.posScene[2] - c[2]!) }))
    .filter((x) => !story.has(x.i))
    .sort((a, b) => a.d - b.d || a.i - b.i)
  const out = new Float32Array(SALT_FRAG.sites.length).fill(-1)
  const g = NACL_T.grow
  ranked.forEach((r, rank) => {
    out[r.i] = g.from + (rank / Math.max(1, ranked.length - 1)) * (g.to - g.from - g.flight)
  })
  return out
})()

/** Направления прилёта (от центра пар наружу), единичные — для раскладки в классе. */
export const NACL_LATTICE_DIR: Float32Array = (() => {
  const out = new Float32Array(SALT_FRAG.sites.length * 3)
  const c = [0, 0, 0]
  for (const s of NACL_STORY) {
    const p = saltPos(s.site)
    c[0] += p[0] / 4
    c[1] += p[1] / 4
    c[2] += p[2] / 4
  }
  SALT_FRAG.sites.forEach((s, i) => {
    const dx = s.posScene[0] - c[0]!
    const dy = s.posScene[1] - c[1]!
    const dz = s.posScene[2] - c[2]!
    const l = Math.hypot(dx, dy, dz) || 1
    out[i * 3] = dx / l
    out[i * 3 + 1] = dy / l
    out[i * 3 + 2] = dz / l
  })
  return out
})()

/** Рост иона решётки 0…1 и доля пути прилёта 0…1 в момент t. */
export function naclLatticeIonAt(i: number, t: number, out: { grow: number; travel: number }): { grow: number; travel: number } {
  const start = NACL_LATTICE_START[i]!
  if (start < 0) {
    // Узел частицы сюжета: инстанс проявляется в кадр передачи (до него узел занят частицей сюжета).
    const on = t >= NACL_T.handover ? 1 : 0
    out.grow = on
    out.travel = 1
    return out
  }
  const g = NACL_T.grow
  out.grow = naclSmooth(start, start + g.appear, t)
  out.travel = t <= start ? 0 : smoother((t - start) / g.flight)
  return out
}

// ─── Камера (план кадра): зум, поворот и центр действия группы stage ───

type ShotKey = { t: number; zoom: number; yaw: number; pitch: number; target: V3 }
export const NACL_SHOTS: readonly ShotKey[] = [
  { t: 0, zoom: 1.2, yaw: 0, pitch: 0, target: [0, 0, NACL_STAGE_Z] },
  { t: stepTo(0), zoom: 1.2, yaw: 0, pitch: 0, target: [0, 0, NACL_STAGE_Z] },
  { t: stepTo(1) - 0.7, zoom: 1.45, yaw: 0, pitch: 0, target: [-0.12, 0, NACL_STAGE_Z] },
  { t: stepTo(2), zoom: 1.45, yaw: 0, pitch: 0, target: [-0.12, 0, NACL_STAGE_Z] },
  { t: naclCueAt('contact'), zoom: 1.85, yaw: 0, pitch: 0, target: [-NACL_H / 2, 0, NACL_STAGE_Z] },
  { t: stepTo(3), zoom: 1.85, yaw: 0, pitch: 0, target: [-NACL_H / 2, 0, NACL_STAGE_Z] },
  { t: NACL_T.saltEdges[0], zoom: 0.44, yaw: 0.42, pitch: 0.3, target: [0, 0.35, 0] },
  { t: NACL_END, zoom: 0.44, yaw: 0.42, pitch: 0.3, target: [0, 0.35, 0] },
]

export type NaclShot = { zoom: number; yaw: number; pitch: number; target: THREE.Vector3 }

/** План кадра в момент t (без аллокаций). */
export function naclShotAt(t: number, out: NaclShot): NaclShot {
  const keys = NACL_SHOTS
  let i = 1
  while (i < keys.length - 1 && t >= keys[i]!.t) i++
  const a = keys[i - 1]!
  const b = keys[i]!
  const u = t <= a.t ? 0 : t >= b.t ? 1 : smoother((t - a.t) / (b.t - a.t))
  out.zoom = lerp(a.zoom, b.zoom, u)
  out.yaw = lerp(a.yaw, b.yaw, u)
  out.pitch = lerp(a.pitch, b.pitch, u)
  out.target.set(lerp(a.target[0], b.target[0], u), lerp(a.target[1], b.target[1], u), lerp(a.target[2], b.target[2], u))
  return out
}

/** Облёт на шаге 6 — поворот решётки вокруг вертикали, рад. */
export function naclSpinAt(t: number): number {
  return 0.5 * naclSmooth(NACL_T.spin[0], NACL_T.spin[1] + 1.5, t)
}

/**
 * Длиннофокусная перспектива шагов 1–4 (параметр рисунка). Хост отодвигает корень сцены от камеры
 * в k раз и во столько же раз увеличивает его — проекция та же, но ГЛУБИННОЕ искажение падает в k
 * раз: одинаковые атомы Na в ячейке перестают выглядеть разными по размеру. На шагах 5–6 k = 1 —
 * там объём решётки, наоборот, нужно читать.
 */
export const NACL_LONG_LENS = 2.1

export function naclDepthPushAt(t: number): number {
  const to = NACL_STEPS[3]!.to
  return lerp(NACL_LONG_LENS, 1, naclSmooth(to - 0.8, to, t))
}

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D — только формулы, заряды, числа и символы единиц (токены)
// ─────────────────────────────────────────────────────────────────────────────

const fmt1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1)
const fmtSigned = (v: number) => (v < 0 ? `−${fmt1(-v)}` : `+${fmt1(v)}`)

export type NaclLabelAnchor =
  /** над (side 1) или под (side −1) частицей сюжета */
  | { kind: 'story'; index: number; side: 1 | -1 }
  | { kind: 'electron'; index: 0 | 1 }
  /** точка в системе stage (не вращается с решёткой) */
  | { kind: 'stage'; p: V3 }
  /** точка в системе решётки (едет вместе с облётом и передачей герою) */
  | { kind: 'lattice'; p: V3 }
  | { kind: 'metal' }
  | { kind: 'cl2' }
  | { kind: 'clBond' }
  | { kind: 'gasPair' }
  /** у своего координационного октаэдра (вынос в сторону от его центра) */
  | { kind: 'octa'; index: number; dir: 1 | -1 }

/**
 * Сторона, с которой подпись обязана стоять СНАРУЖИ экранной проекции решётки. Якорь в системе
 * решётки вращается вместе с облётом и большую часть оборота оказывался внутри силуэта — подпись
 * ложилась на ионы. Класс каждый кадр считает габарит проекции фрагмента и выносит подпись за него;
 * row — номер строки в полосе под решёткой (итог шага 6 в три строки).
 */
export type NaclLabelOutside = { side: 'above' | 'below' | 'left' | 'right'; row?: number }

export type NaclLabelDef = {
  id: string
  kind: 'species' | 'measure' | 'token'
  keys: readonly { t: number; text: string }[]
  windows: readonly (readonly [number, number])[]
  anchor: NaclLabelAnchor
  outside?: NaclLabelOutside
}

const T = NACL_T
const E = NACL_ELECTRONS
const STORY_END = T.toLattice[1] + 0.3
const HALF = NACL_GRID_HALF * NACL_H
/**
 * Размерная линия ребра a: нижнее переднее ребро ПЕРВОЙ ячейки (2 шага сетки = a), опущенное под
 * шары нижнего ряда. Выносные линии идут от самих концов ребра вниз — по кадру видно, какое именно
 * ребро равно a.
 */
export const NACL_DIM_A = {
  from: [-HALF, -HALF, HALF] as V3,
  to: [-HALF + 2 * NACL_H, -HALF, HALF] as V3,
  drop: NACL_LATTICE_R.clIon + 0.16,
  tick: 0.09,
} as const
/** Размерная линия газовой пары (под верхней парой). */
export const NACL_DIM_GAS_DROP = NACL_R.clIon / SPECIES_SCALE + 0.12

export const NACL_LABELS: readonly NaclLabelDef[] = [
  // Шаг 1: металл и молекула
  { id: 'metal', kind: 'species', keys: [{ t: 0, text: 'Na ({s})' }], windows: [[0.3, T.metalOut[1]]], anchor: { kind: 'metal' } },
  { id: 'metalA', kind: 'measure', keys: [{ t: 0, text: `a = ${fmt1(NACL_METAL.cellPm.a)} {pm}` }], windows: [[0.8, T.detach[0]]], anchor: { kind: 'stage', p: [NACL_METAL_CENTER[0], NACL_METAL_CENTER[1] - pmToScene(NACL_METAL.cellPm.a) / 2 - 0.62, NACL_STAGE_Z] } },
  { id: 'cl2', kind: 'species', keys: [{ t: 0, text: 'Cl₂ ({g})' }], windows: [[0.3, T.brk]], anchor: { kind: 'cl2' } },
  { id: 'clBond', kind: 'measure', keys: [{ t: 0, text: `${fmt1(bondLengthPm('Cl-Cl'))} {pm}` }], windows: [[0.8, T.brk - 0.4]], anchor: { kind: 'clBond' } },
  // Шаги 2–4: частицы сюжета. Подпись ДОНОРА меняется в кадр УХОДА электрона (тогда же, когда
  // модель ставит ему заряд +1): пока e⁻ летит, в кадре стоит Na⁺ + e⁻ + Cl и сумма зарядов видна
  // нулевой. Размер и цвет у обоих партнёров меняются позже — в кадр поглощения (решение владельца).
  { id: 'na1', kind: 'species', keys: [{ t: 0, text: 'Na ({g})' }, { t: E.e1.leave, text: 'Na⁺' }], windows: [[T.detach[0] + 0.5, STORY_END]], anchor: { kind: 'story', index: I_NA1, side: 1 } },
  { id: 'na2', kind: 'species', keys: [{ t: 0, text: 'Na ({g})' }, { t: E.e2.leave, text: 'Na⁺' }], windows: [[T.detach[0] + 1.1, STORY_END]], anchor: { kind: 'story', index: I_NA2, side: -1 } },
  { id: 'clA', kind: 'species', keys: [{ t: 0, text: 'Cl ({g})' }, { t: E.e1.arrive, text: 'Cl⁻' }], windows: [[T.brk, STORY_END]], anchor: { kind: 'story', index: I_CLA, side: 1 } },
  { id: 'clB', kind: 'species', keys: [{ t: 0, text: 'Cl ({g})' }, { t: E.e2.arrive, text: 'Cl⁻' }], windows: [[T.brk, STORY_END]], anchor: { kind: 'story', index: I_CLB, side: -1 } },
  { id: 'e1', kind: 'token', keys: [{ t: 0, text: 'e⁻' }], windows: [[E.e1.leave - T.windUp, E.e1.arrive + 0.1]], anchor: { kind: 'electron', index: 0 } },
  { id: 'e2', kind: 'token', keys: [{ t: 0, text: 'e⁻' }], windows: [[E.e2.leave - T.windUp, E.e2.arrive + 0.1]], anchor: { kind: 'electron', index: 1 } },
  // Шаг 4: газовая пара — r_e(NaCl, г.)
  { id: 'dGas', kind: 'measure', keys: [{ t: 0, text: `${fmt1(bondLengthPm('Na-Cl'))} {pm}` }], windows: [[naclCueAt('contact') - 0.6, T.toLattice[0] + 0.4]], anchor: { kind: 'gasPair' } },
  // Шаг 5: решётка — подписи СНАРУЖИ силуэта решётки (класс выносит их каждый кадр)
  { id: 'nacl', kind: 'species', keys: [{ t: 0, text: 'NaCl ({s})' }], windows: [[T.grow.from + 1.4, NACL_END]], anchor: { kind: 'lattice', p: [0, HALF, 0] }, outside: { side: 'above' } },
  // Шаг 6 называет a в итоговой строке (p1) — размерная линия и её подпись уходят, чтобы не дублировать.
  // Формат один с итогом: «564,0 пм» (fmt1), а не «564» из latticeCaption.
  { id: 'cellA', kind: 'measure', keys: [{ t: 0, text: `a = ${fmt1(NACL_SALT.cellPm.a)} {pm}` }], windows: [[T.dimA[0], T.finalLabels]], anchor: { kind: 'lattice', p: [(NACL_DIM_A.from[0] + NACL_DIM_A.to[0]) / 2, -HALF - NACL_DIM_A.drop - 0.24, HALF] }, outside: { side: 'below' } },
  {
    id: 'cn',
    kind: 'measure',
    keys: [{ t: 0, text: SALT_CAPTION[2]! }],
    windows: [[T.octa[0], NACL_END]],
    // Слева сверху, СНАРУЖИ проекции решётки: в системе решётки якорь уезжал внутрь силуэта.
    anchor: { kind: 'lattice', p: [-HALF, HALF, 0] },
    outside: { side: 'left' },
  },
  // Окружение выделенных ионов: «6 Cl⁻» у октаэдра Na⁺ и «6 Na⁺» у октаэдра Cl⁻ — с выноской
  // от самой фигуры (число соседей берётся из coordination ядра).
  { id: 'octaNa', kind: 'measure', keys: [{ t: 0, text: `${NACL_SALT.coordination['Na⁺']} Cl⁻` }], windows: [[T.octa[0] + 0.1, NACL_END]], anchor: { kind: 'octa', index: 0, dir: -1 } },
  { id: 'octaCl', kind: 'measure', keys: [{ t: 0, text: `${NACL_SALT.coordination['Cl⁻']} Na⁺` }], windows: [[T.octa[0] + 0.1, NACL_END]], anchor: { kind: 'octa', index: 1, dir: 1 } },
  // Шаг 6: зафиксированные параметры и энергия (числа — из ядра), полосой под решёткой
  { id: 'p1', kind: 'measure', keys: [{ t: 0, text: `${NACL_SALT.spaceGroup} · a = ${fmt1(NACL_SALT.cellPm.a)} {pm} · d = ${fmt1(NACL_SALT.cationAnionPm)} {pm}` }], windows: [[T.finalLabels, NACL_END]], anchor: { kind: 'stage', p: [0, -HALF - 0.75, 0] }, outside: { side: 'below', row: 0 } },
  { id: 'p2', kind: 'measure', keys: [{ t: 0, text: `Z = ${NACL_SALT.z} · ρ = ${NACL_SALT.densityGCm3} {gcm3}` }], windows: [[T.finalLabels + 0.2, NACL_END]], anchor: { kind: 'stage', p: [0, -HALF - 1.75, 0] }, outside: { side: 'below', row: 1 } },
  { id: 'p3', kind: 'measure', keys: [{ t: 0, text: `ΔH°f = ${fmtSigned(NACL_DHF_KJ)} {kJmol} · U = ${fmtSigned(NACL_LATTICE_KJ)} {kJmol}` }], windows: [[T.finalLabels + 0.4, NACL_END]], anchor: { kind: 'stage', p: [0, -HALF - 2.75, 0] }, outside: { side: 'below', row: 2 } },
]

// ─────────────────────────────────────────────────────────────────────────────
// Состояние кадра
// ─────────────────────────────────────────────────────────────────────────────

export type NaclElectronState = {
  /** 'none' — ещё нет; 'dot' — валентная точка Na; 'flying' — летит; 'absorbed' — восьмая точка Cl */
  phase: 'none' | 'dot' | 'flying' | 'absorbed'
  pos: THREE.Vector3
  /** параметр кривой Безье 0…1 */
  u: number
  /** непрозрачность точки/электрона */
  amount: number
  /** свечение (ореол, след): 0 — просто точка, 1 — летящий электрон */
  glow: number
}

export type NaclState = {
  t: number
  /** частицы сюжета */
  pos: THREE.Vector3[]
  radius: Float32Array
  /** заряд по балансу (Na⁺ — с ухода электрона, Cl⁻ — с поглощения) */
  charge: Float32Array
  /** 0 — атом (Na — матовый металл, Cl — атом газа), 1 — ион; плавно за NACL_MORPH_S с поглощения */
  morph: Float32Array
  /** вспышка поглощения 0…1 (свечение кромки) */
  flash: Float32Array
  /** появление (масштаб), 0…1 */
  appear: number
  /** частицы сюжета видны (до передачи узлов решётке) */
  storyOn: boolean
  metal: { opacity: number; shiftX: number; edges: number }
  bond: { opacity: number; stretch: number }
  /** доля гомолиза общей пары: 0 — пара посередине связи, 1 — по электрону у каждого Cl */
  split: number
  /** валентные точки Cl (6 неподелённых, одиночная — отдельно) */
  valence: number
  /** одиночный электрон Cl (из общей пары) виден */
  single: number
  electrons: [NaclElectronState, NaclElectronState]
  field: number
  dimGas: number
  drawScale: number
  saltEdges: number
  octa: number
  dimA: number
  spin: number
  /** передача кадра герою: 0 — до хвоста, 1 — решётка стоит на месте героя */
  handoff: number
  /** доля сценического света (в хвосте гаснет: дальше решётку освещает лаборатория, как героя) */
  light: number
  labelOpacity: Float32Array
  labelText: string[]
  shot: NaclShot
  /** сумма зарядов частиц и летящих электронов (баланс) */
  chargeSum: number
}

function createElectron(): NaclElectronState {
  return { phase: 'none', pos: new THREE.Vector3(), u: 0, amount: 0, glow: 0 }
}

export function createNaclState(): NaclState {
  return {
    t: 0,
    pos: NACL_STORY.map(() => new THREE.Vector3()),
    radius: new Float32Array(4),
    charge: new Float32Array(4),
    morph: new Float32Array(4),
    flash: new Float32Array(4),
    appear: 0,
    storyOn: true,
    metal: { opacity: 0, shiftX: 0, edges: 0 },
    bond: { opacity: 0, stretch: 0 },
    split: 0,
    valence: 0,
    single: 0,
    electrons: [createElectron(), createElectron()],
    field: 0,
    dimGas: 0,
    drawScale: 1,
    saltEdges: 0,
    octa: 0,
    dimA: 0,
    spin: 0,
    handoff: 0,
    light: 1,
    labelOpacity: new Float32Array(NACL_LABELS.length),
    labelText: NACL_LABELS.map((l) => l.keys[0]!.text),
    shot: { zoom: 1, yaw: 0, pitch: 0, target: new THREE.Vector3() },
    chargeSum: 0,
  }
}

/** Позиция частицы сюжета i в момент t (без аллокаций). */
function storyPos(i: number, t: number, out: THREE.Vector3): THREE.Vector3 {
  const free = NACL_FREE[i]!
  const gas = NACL_GAS[i]!
  const site = saltPos(NACL_STORY[i]!.site)
  if (t >= T.toLattice[0]) {
    const u = naclSmooth(T.toLattice[0], T.toLattice[1], t)
    return out.set(lerp(gas[0], site[0], u), lerp(gas[1], site[1], u), lerp(gas[2], site[2], u))
  }
  if (t >= T.pair[0]) {
    const u = naclSmooth(T.pair[0], T.pair[1], t)
    return out.set(lerp(free[0], gas[0], u), lerp(free[1], gas[1], u), lerp(free[2], gas[2], u))
  }
  if (i <= I_NA2) {
    // Атом натрия выходит из ячейки металла по дуге (сублимация); второй — на 0,6 с позже.
    const m = metalPos(i === I_NA1 ? METAL_NA1 : METAL_NA2)
    const t0 = T.detach[0] + (i === I_NA2 ? 0.6 : 0)
    const u = naclSmooth(t0, t0 + T.flyFree, t)
    const arc = Math.sin(Math.PI * u) * 0.25 * (i === I_NA1 ? 1 : -1)
    return out.set(lerp(m[0], free[0], u), lerp(m[1], free[1], u) + arc, lerp(m[2], free[2], u))
  }
  // Хлор: в молекуле, натяжение связи перед разрывом, потом к свободному месту.
  const sy = i === I_CLA ? 1 : -1
  const stretch = 0.06 * naclSmooth(T.stress, T.brk, t)
  const u = naclSmooth(T.clFree[0], T.clFree[1], t)
  const mx = NACL_CL2_CENTER[0]
  const my = NACL_CL2_CENTER[1] + sy * (CL_HALF + stretch)
  return out.set(lerp(mx, free[0], u), lerp(my, free[1], u), lerp(NACL_CL2_CENTER[2], free[2], u))
}

/** Точка на валентной оболочке частицы: угол в плоскости кадра (без аллокаций). */
export function naclShellPoint(center: THREE.Vector3, radius: number, angle: number, out: THREE.Vector3): THREE.Vector3 {
  const r = radius + NACL_DOT_GAP
  return out.set(center.x + r * Math.cos(angle), center.y + r * Math.sin(angle), center.z)
}

/** Угол одиночного электрона Cl: от гомолиза (к партнёру по связи) к месту в схеме Льюиса. */
export function naclSingleAngle(i: number, t: number): number {
  const from = i === I_CLA ? 270 * DEG : 90 * DEG
  const to = NACL_CL_DOT_ANGLES[NACL_CL_SINGLE]!
  // clB идёт против часовой (90° → 192°), clA — по часовой (270° → 192°).
  return lerp(from, to, naclSmooth(T.clFree[0], T.clFree[1], t))
}

/**
 * Состояние кадра для момента t — пишет в заранее созданный объект (без аллокаций).
 * ЕДИНСТВЕННЫЙ источник правды: класс сцены только переносит его в объекты three.
 */
export function sampleNaclState(t: number, s: NaclState): NaclState {
  s.t = t
  const appear = naclSmooth(T.appear[0], T.appear[1], t)
  s.appear = appear
  s.storyOn = t < T.handover
  s.drawScale = naclDrawScale(t)

  // ——— Частицы сюжета ———
  for (let i = 0; i < 4; i++) storyPos(i, t, s.pos[i]!)
  let flying = 0
  for (let k = 0 as 0 | 1; k < 2; k = (k + 1) as 0 | 1) {
    const [di, ai] = NACL_PAIRS[k]!
    const e = T.e[k]!
    const m = naclMorphAt(k, t)
    s.morph[di] = m
    s.morph[ai] = m
    s.radius[di] = lerp(NACL_R.na, NACL_R.naIon, m) * s.drawScale
    s.radius[ai] = lerp(NACL_R.cl, NACL_R.clIon, m) * s.drawScale
    // Баланс: Na⁺ — с кадра ухода электрона, Cl⁻ — с кадра поглощения.
    s.charge[di] = t >= e.leave ? 1 : 0
    s.charge[ai] = t >= e.arrive ? -1 : 0
    if (t >= e.leave && t < e.arrive) flying++
    const fu = (t - e.arrive) / (T.morph * 1.6)
    const f = fu <= 0 || fu >= 1 ? 0 : Math.sin(Math.PI * fu)
    s.flash[di] = f
    s.flash[ai] = f
  }
  s.chargeSum = s.charge[0]! + s.charge[1]! + s.charge[2]! + s.charge[3]! - flying

  // ——— Металл: ячейка ОЦК, затем уходит влево и гаснет до нуля ———
  const out = naclSmooth(T.metalOut[0], T.metalOut[1], t)
  s.metal.opacity = appear * (1 - out)
  s.metal.shiftX = -0.7 * out * out
  s.metal.edges = naclSmooth(T.metalEdges[0], T.metalEdges[1], t) * (1 - naclSmooth(T.detach[0] - 0.4, T.detach[0], t))

  // ——— Cl–Cl: одна σ-связь, натяжение и гомолиз ———
  s.bond.opacity = appear * (1 - naclSmooth(T.brk, T.brk + 0.4, t))
  s.bond.stretch = naclSmooth(T.stress, T.brk, t)
  s.split = naclSmooth(T.brk, T.brk + 0.6, t)
  s.single = appear * (1 - naclSmooth(T.valenceOut[0], T.valenceOut[1], t))
  s.valence = naclSmooth(T.valenceIn[0], T.valenceIn[1], t) * (1 - naclSmooth(T.valenceOut[0], T.valenceOut[1], t))

  // ——— Электроны: 3s¹ натрия → свободное место оболочки Cl (кубическая Безье) ———
  for (let k = 0 as 0 | 1; k < 2; k = (k + 1) as 0 | 1) {
    const el = s.electrons[k]
    const e = T.e[k]!
    const [di, ai] = NACL_PAIRS[k]!
    const curve = NACL_ELECTRON_CURVES[k]
    if (t < T.valenceIn[0]) {
      el.phase = 'none'
      el.amount = 0
      el.glow = 0
      el.u = 0
      naclShellPoint(s.pos[di]!, s.radius[di]!, NACL_NA_DOT_ANGLE, el.pos)
    } else if (t < e.leave) {
      el.phase = 'dot'
      el.u = 0
      el.amount = s.valence
      el.glow = naclSmooth(e.leave - T.windUp, e.leave, t)
      naclShellPoint(s.pos[di]!, s.radius[di]!, NACL_NA_DOT_ANGLE, el.pos)
    } else if (t < e.arrive) {
      el.phase = 'flying'
      el.u = smoother((t - e.leave) / (e.arrive - e.leave))
      el.amount = 1
      el.glow = 1
      curve.getPoint(el.u, el.pos)
    } else {
      el.phase = 'absorbed'
      el.u = 1
      el.amount = s.valence
      el.glow = 1 - naclSmooth(e.arrive, e.arrive + 0.45, t)
      naclShellPoint(s.pos[ai]!, s.radius[ai]!, NACL_CL_ARRIVE_ANGLE, el.pos)
    }
  }

  // ——— Шаг 4: линии поля и расстояние газовой пары ———
  s.field = windowFade(T.field[0], T.field[1], 0.5, t)
  s.dimGas = windowFade(naclCueAt('contact') - 0.6, T.toLattice[0] + 0.4, 0.3, t)

  // ——— Решётка ———
  s.saltEdges = naclSmooth(T.saltEdges[0], T.saltEdges[1], t)
  const tail = naclSmooth(T.finish[0], T.finish[0] + 0.45, t)
  s.octa = naclSmooth(T.octa[0], T.octa[1], t) * (1 - tail)
  s.dimA = naclSmooth(T.dimA[0], T.dimA[1], t) * (1 - naclSmooth(T.finalLabels - 0.3, T.finalLabels, t))
  s.spin = naclSpinAt(t)
  s.handoff = naclSmooth(T.finish[0], T.finish[1], t)
  s.light = 1 - s.handoff

  // ——— Подписи: окна, смена текста по ключам; в хвосте всё гаснет ———
  for (let li = 0; li < NACL_LABELS.length; li++) {
    const def = NACL_LABELS[li]!
    let op = 0
    for (let w = 0; w < def.windows.length; w++) {
      const win = def.windows[w]!
      const o = windowFade(win[0], win[1], 0.3, t)
      if (o > op) op = o
    }
    s.labelOpacity[li] = op * (1 - tail)
    let text = def.keys[0]!.text
    for (let k = 1; k < def.keys.length; k++) if (t >= def.keys[k]!.t) text = def.keys[k]!.text
    s.labelText[li] = text
  }

  naclShotAt(t, s.shot)
  return s
}

/** «Шторка» окна [a, b) с мягкими краями fade; конец сцены держит 1 (окна до NACL_END). */
function windowFade(a: number, b: number, fade: number, t: number): number {
  if (t < a) return 0
  if (b >= NACL_END - 1e-9) return Math.min(1, (t - a) / fade)
  if (t >= b) return 0
  return Math.min(1, (t - a) / fade, (b - t) / fade)
}

/** Точка e⁻ на кривой (для теста и подписи) — без аллокаций. */
export function naclElectronPoint(k: 0 | 1, u: number, out: THREE.Vector3): THREE.Vector3 {
  return NACL_ELECTRON_CURVES[k].getPoint(u, out)
}

// ─────────────────────────────────────────────────────────────────────────────
// Габарит композиции шага (кадрирование хостом)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Габарит композиции ШАГА в кадре (мир, уже с зумом и поворотом шага) — по нему адаптер вписывает
 * сцену в свободную от панелей область. Один общий габарит на всю сцену либо резал шаги с высокой
 * композицией (две ионные пары друг над другом уходили под док реактора), либо на узком экране
 * оставлял половину области пустой. Здесь у каждого шага свой — композиция занимает область
 * целиком и ничего не уходит под панели.
 *
 * Чистая функция раскадровки: считается один раз при загрузке модуля, без WebGL. Точки берутся
 * ровно те же, что рисует класс: частицы сюжета, ячейка металла, ионы решётки (с их прилётом и
 * ростом) и якоря подписей, привязанных к сцене (stage / решётка).
 */
/** Габарит композиции в кадре: размер и ЦЕНТР (композиция редко симметрична относительно цели). */
export type NaclExtent = { w: number; h: number; cx: number; cy: number }

/** Запас под подпись, привязанную к сцене (высота плашки в мире при типичном масштабе). */
const LABEL_PAD = 0.34

const _exSt = createNaclState()
const _exQ = new THREE.Quaternion()
const _exE = new THREE.Euler()
const _exV = new THREE.Vector3()
const _exLat = { grow: 0, travel: 0 }

/**
 * МГНОВЕННЫЙ габарит композиции в момент t (мир, уже с зумом и поворотом шага). Точки берутся
 * ровно те же, что рисует класс: частицы сюжета, дуга летящего электрона, ячейка металла, ионы
 * решётки (с их прилётом и ростом) и якоря подписей, привязанных к сцене.
 */
export function naclInstantExtent(t: number, out: NaclExtent): NaclExtent {
  const s = sampleNaclState(t, _exSt)
  _exE.set(s.shot.pitch, s.shot.yaw, 0, 'YXZ')
  _exQ.setFromEuler(_exE)
  const z = s.shot.zoom
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  // wt < 1 — «уходящий» объект: его вклад стягивается к центру кадра вместе с непрозрачностью,
  // поэтому габарит не прыгает ступенькой в кадр, когда объект гаснет (порог видимости давал
  // разрыв на 4 % ровно там, где гасла ячейка металла).
  const add = (x: number, y: number, zz: number, r: number, spin: number, wt = 1) => {
    if (spin !== 0) {
      const c = Math.cos(spin)
      const sn = Math.sin(spin)
      _exV.set(x * c + zz * sn, y, -x * sn + zz * c)
    } else _exV.set(x, y, zz)
    _exV.sub(s.shot.target).applyQuaternion(_exQ).multiplyScalar(z * wt)
    const rr = r * z * wt
    if (_exV.x - rr < x0) x0 = _exV.x - rr
    if (_exV.x + rr > x1) x1 = _exV.x + rr
    if (_exV.y - rr < y0) y0 = _exV.y - rr
    if (_exV.y + rr > y1) y1 = _exV.y + rr
  }
  if (s.storyOn) for (let k = 0; k < 4; k++) if (s.radius[k]! * s.appear > 1e-3) add(s.pos[k]!.x, s.pos[k]!.y, s.pos[k]!.z, s.radius[k]! * s.appear, 0)
  // Ещё летящие к узлам ионы кадр не расширяют.
  // Дуга электрона (Безье) с запасом под подпись e⁻: она уходит выше линии Na–Cl. Вклад
  // ПЛАВНО появляется перед вылетом и плавно гаснет после поглощения — иначе на кадре
  // поглощения габарит прыгал ступенькой.
  for (let k = 0; k < 2; k++) {
    const e = T.e[k]!
    const wt = naclSmooth(e.leave - 0.35, e.leave, t) * (1 - naclSmooth(e.arrive, e.arrive + 0.35, t))
    if (wt <= 0.002) continue
    const curve = NACL_ELECTRON_CURVES[k]!
    for (let u = 0; u <= 1.0001; u += 0.1) {
      const p = curve.getPoint(u)
      add(p.x, p.y, p.z, 0.26, 0, wt)
    }
  }
  if (s.metal.opacity > 0.002) {
    for (const si of NACL_METAL_REST) {
      const p = naclMetalPos(si)
      add(p[0] + s.metal.shiftX, p[1], p[2], NACL_R.na * s.appear, 0, s.metal.opacity)
    }
  }
  if (s.drawScale > 0) {
    for (let k = 0; k < SALT_FRAG.sites.length; k++) {
      naclLatticeIonAt(k, t, _exLat)
      // Ион, который ещё летит к своему узлу и не дорос, входит в габарит ПОСТЕПЕННО: жёсткий
      // порог видимости давал ступеньку кадра в момент, когда очередной слой «включался».
      const wt = naclSmooth(0.3, 0.7, _exLat.grow) * naclSmooth(0.6, 0.9, _exLat.travel)
      if (wt <= 0.002) continue
      const p = SALT_FRAG.sites[k]!.posScene
      const off = NACL_T.grow.reach * (1 - _exLat.travel)
      const r = (SALT_FRAG.sites[k]!.el === 'Na' ? NACL_LATTICE_R.naIon : NACL_LATTICE_R.clIon) * _exLat.grow
      add(p[0] + NACL_LATTICE_DIR[k * 3]! * off, p[1] + NACL_LATTICE_DIR[k * 3 + 1]! * off, p[2] + NACL_LATTICE_DIR[k * 3 + 2]! * off, r, s.spin, wt)
    }
  }
  for (let k = 0; k < NACL_LABELS.length; k++) {
    if (s.labelOpacity[k]! <= 0.02) continue
    const def = NACL_LABELS[k]!
    const an = def.anchor
    // Подпись, вынесенная за силуэт решётки, стоит ВПЛОТНУЮ к нему (класс кладёт её по экранному
    // габариту): в кадре она занимает строку текста, а не полосу по якорю.
    const pad = def.outside ? LABEL_PAD + 0.14 : LABEL_PAD
    if (an.kind === 'stage') add(an.p[0], an.p[1], an.p[2], pad, 0)
    else if (an.kind === 'lattice') add(an.p[0], an.p[1], an.p[2], pad, s.spin)
    else if (an.kind === 'octa') {
      const c = SALT_FRAG.sites[NACL_OCTA[an.index]!.center]!.posScene
      add(c[0], c[1], c[2], pad + NACL_H, s.spin)
    }
  }
  if (x0 > x1) {
    x0 = x1 = y0 = y1 = 0
  }
  out.w = x1 - x0
  out.h = y1 - y0
  out.cx = (x0 + x1) / 2
  out.cy = (y0 + y1) / 2
  return out
}

/** Шаг таблицы габарита, с. */
const EXTENT_DT = 1 / 20
/** Заглядывание вперёд: камера успевает разъехаться ДО того, как объект войдёт в кадр, с. */
const EXTENT_LOOKAHEAD = 0.2
/** Предел относительного изменения габарита за шаг таблицы: камера не дёргается. */
const EXTENT_RATE = 0.03

/**
 * Габарит кадра по времени — ОГИБАЮЩАЯ мгновенного габарита: максимум на окне заглядывания вперёд,
 * затем ограничение скорости изменения в обе стороны (значения только ПОДНИМАЮТСЯ, поэтому кадр
 * нигде не режет композицию). Раньше на весь шаг брался ОДИН максимум, и на паузе (где смотрят и
 * снимают) композиция вписывалась в самый широкий кадр шага: решётка шага 5 занимала треть
 * отведённого ей места, потому что в начале того же шага в кадре стояли крупные газовые пары.
 */
const NACL_EXTENT_TABLE: Float32Array = (() => {
  const n = Math.ceil(NACL_END / EXTENT_DT) + 2
  // Четыре канала — расстояния от цели кадра до его краёв: влево, вправо, вниз, вверх.
  // Огибающая берётся по каждому отдельно, поэтому кадр растёт ровно туда, где появился объект.
  const raw = new Float32Array(n * 4)
  const tmp: NaclExtent = { w: 0, h: 0, cx: 0, cy: 0 }
  for (let i = 0; i < n; i++) {
    naclInstantExtent(Math.min(NACL_END, i * EXTENT_DT), tmp)
    raw[i * 4] = tmp.w / 2 - tmp.cx
    raw[i * 4 + 1] = tmp.w / 2 + tmp.cx
    raw[i * 4 + 2] = tmp.h / 2 - tmp.cy
    raw[i * 4 + 3] = tmp.h / 2 + tmp.cy
  }
  const look = Math.round(EXTENT_LOOKAHEAD / EXTENT_DT)
  const out = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 4; a++) {
      let m = 0
      for (let k = i; k <= Math.min(n - 1, i + look); k++) if (raw[k * 4 + a]! > m) m = raw[k * 4 + a]!
      out[i * 4 + a] = m
    }
  }
  // Ограничение скорости: назад — чтобы подъём начался заранее, вперёд — чтобы спад был плавным.
  for (let i = n - 2; i >= 0; i--) for (let a = 0; a < 4; a++) out[i * 4 + a] = Math.max(out[i * 4 + a]!, out[(i + 1) * 4 + a]! * (1 - EXTENT_RATE))
  for (let i = 1; i < n; i++) for (let a = 0; a < 4; a++) out[i * 4 + a] = Math.max(out[i * 4 + a]!, out[(i - 1) * 4 + a]! * (1 - EXTENT_RATE))
  return out
})()

/** Габарит кадра в момент t: линейная выборка из таблицы огибающей. */
export function naclExtentAt(t: number, out: NaclExtent): NaclExtent {
  const n = NACL_EXTENT_TABLE.length / 4
  const x = Math.min(n - 1, Math.max(0, t / EXTENT_DT))
  const i = Math.min(n - 2, Math.floor(x))
  const u = x - i
  const l = lerp(NACL_EXTENT_TABLE[i * 4]!, NACL_EXTENT_TABLE[(i + 1) * 4]!, u)
  const r = lerp(NACL_EXTENT_TABLE[i * 4 + 1]!, NACL_EXTENT_TABLE[(i + 1) * 4 + 1]!, u)
  const b = lerp(NACL_EXTENT_TABLE[i * 4 + 2]!, NACL_EXTENT_TABLE[(i + 1) * 4 + 2]!, u)
  const tp = lerp(NACL_EXTENT_TABLE[i * 4 + 3]!, NACL_EXTENT_TABLE[(i + 1) * 4 + 3]!, u)
  out.w = l + r
  out.h = b + tp
  out.cx = (r - l) / 2
  out.cy = (tp - b) / 2
  return out
}

/** Габарит ШАГА — максимум огибающей внутри шага (для тестов и отладки). */
export const NACL_STEP_EXTENT: readonly NaclExtent[] = NACL_STEPS.map((step, i) => {
  const to = i === NACL_STEPS.length - 1 ? NACL_FINISH.from : step.to
  const acc: NaclExtent = { w: 0, h: 0, cx: 0, cy: 0 }
  const tmp: NaclExtent = { w: 0, h: 0, cx: 0, cy: 0 }
  for (let t = step.from; t <= to + 1e-6; t += EXTENT_DT) {
    naclExtentAt(t, tmp)
    if (tmp.w > acc.w) {
      acc.w = tmp.w
      acc.cx = tmp.cx
    }
    if (tmp.h > acc.h) {
      acc.h = tmp.h
      acc.cy = tmp.cy
    }
  }
  return acc
})

/** Проверка модели — в dev и в тесте. Бросает на первой ошибке. */
export function validateNaclModel(): void {
  const n = NACL_LATTICE_CELLS[0] * 2 + 1
  if (SALT_FRAG.sites.length !== n * n * n) throw new Error(`nacl: во фрагменте ${SALT_FRAG.sites.length} ионов, ожидалось ${n ** 3}`)
  if (METAL_FRAG.sites.length !== 9) throw new Error('nacl: ячейка ОЦК — 9 атомов')
  for (const s of NACL_STORY) {
    if (SALT_FRAG.sites[s.site]!.el !== s.el) throw new Error(`nacl: частица ${s.id} стоит в чужом узле`)
  }
  NACL_OCTA.forEach((o, k) => {
    if (SALT_FRAG.sites[o.center]!.el !== o.el) throw new Error(`nacl: центр октаэдра ${k} не ${o.el}`)
    const sh = NACL_OCTA_SHELLS[k]!
    if (sh.neighbors.length !== 6) throw new Error(`nacl: у центра октаэдра ${k} ${sh.neighbors.length} соседей`)
    for (const j of sh.neighbors) if (SALT_FRAG.sites[j]!.el === o.el) throw new Error('nacl: вершина октаэдра того же знака')
  })
  if (!(NACL_R.naIon < NACL_R.na)) throw new Error('nacl: Na⁺ обязан быть меньше атома Na')
  if (!(NACL_R.clIon > NACL_R.cl)) throw new Error('nacl: Cl⁻ обязан быть больше атома Cl')
  if (!(NACL_R.na > NACL_R.cl)) throw new Error('nacl: нейтральный Na (металлический радиус) крупнее Cl (ковалентного)')
}
