import * as THREE from 'three'
import { getCrystal } from '../../../../chemistry/data'
import { smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { orbitTrack, sampleShot, shotTrack, type ShotTrack } from '../kit/camera'
import { bondLength, LATTICE_BALL_SCALE, pmToScene, speciesRadius } from '../kit/cpkAtoms'
import { cellEdges, cellMatrix, fracToPm, latticeCaption, latticeFragment, type LatticeSegment } from '../kit/lattice'
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
import { CO2_DHF_KJ, CO2_FACTS, CO_DHF_KJ } from './co2Energetics'
import { CO2_END, CO2_FINISH, CO2_STAGES, CO2_STEPS, co2CueAt } from './co2Steps'

export {
  CO2_CUES,
  CO2_END,
  CO2_FINISH,
  CO2_SEGMENTS,
  CO2_STAGES,
  CO2_STEPS,
  CO2_STEP_IDS,
  CO2_TIMING,
  co2StepIndexAt,
  type Co2CueId,
  type Co2StepId,
} from './co2Steps'

/**
 * Раскадровка C (графит) + O₂ (г.) → CO₂ (г.) — ЧИСТАЯ функция времени сюжета.
 *
 * Ни одного числа химии: графит и сухой лёд — из crystalData через kit/lattice (позиции узлов,
 * связи первой сферы, рёбра ячеек), длины связей — из bondData (O=O, C=O карбонила, C≡O, C=O в CO₂,
 * O–H), радиусы — ковалентные (Кордеро) через speciesRadius, энергии — из thermoData.
 *
 * Механизм — как в реальном горении угля (закон «Химия»):
 *   • O₂ садится на ДВА краевых атома верхнего слоя; O=O рвётся только когда обе связи C–O уже
 *     замкнуты (диссоциативная хемосорбция) — гомолиза O₂ в газе нет;
 *   • краевой атом уходит ВМЕСТЕ с кислородом — молекулой CO; свободного атома C (г.) нет ни в один кадр;
 *   • CO дожигается радикалом ·OH: CO + ·OH → CO₂ + H·; π-пара второй связи CO переходит в новую C=O;
 *   • молекула CO₂ сразу линейная (угловых промежуточных частиц нет);
 *   • финал — фрагмент сухого льда (Pa-3): центральная молекула сюжета и 12 соседей.
 *
 * Правила эталона (scenes/nacl), выполненные по построению:
 *   • у каждого атома есть span [первый, последний шаг]; вне него непрозрачность строго 0;
 *   • каждый видимый атом подписан (label.hosts); на паузе шага все видимые атомы непрозрачны;
 *   • огня, свечения, дыма, вспышек нет вовсе; эмиссия каждого атома постоянна всю сцену;
 *   • π — лепестки kit/bondVisual, σ — трубка; двойная связь в решётке — две полосы трубки.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

const GRAPHITE = getCrystal('graphite')!
const DRY = getCrystal('dry_ice')!

/**
 * Доля ковалентного радиуса, которую рисуем шаром (ball-and-stick, параметр рисунка): одна на все
 * атомы сцены — отношения C : O : H честные, а связи и π-лепестки видны между шарами.
 */
export const CO2_BALL_SCALE = LATTICE_BALL_SCALE

const R = {
  C: speciesRadius('C', 0, CO2_BALL_SCALE),
  O: speciesRadius('O', 0, CO2_BALL_SCALE),
  H: speciesRadius('H', 0, CO2_BALL_SCALE),
} as const

/** C–C внутри слоя графита и расстояние между слоями (c/2), мировые единицы. */
const D_CC = pmToScene(GRAPHITE.cationAnionPm)
const D_LAYER = pmToScene(GRAPHITE.cellPm.c! / 2)
/** Длины связей сюжета, мировые единицы (bondData). */
const D_OO = bondLength('O=O')
const D_CO_SURF = bondLength('C=O')
const D_CO_TRIPLE = bondLength('C#O')
const D_CO2 = bondLength('C=O(CO2)')
const D_OH = bondLength('O-H')

type V3 = readonly [number, number, number]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2])
const unit = (a: V3): V3 => scale(a, 1 / (len(a) || 1))
const mid = (a: V3, b: V3): V3 => scale(add(a, b), 0.5)

// ─── Графит: два слоя из базиса ядра ────────────────────────────────────────

/** Источник узлов: 6×6×1 ячеек P6₃/mmc (c → +Y, слои горизонтальны), из него вырезаются два слоя. */
const G_SRC = latticeFragment('graphite', [6, 6, 1])
/** Радиус выреза в плоскости слоя — 2,7 длины связи: центральное кольцо и шесть соседних (параметр рисунка). */
const FLAKE_RADIUS = 2.7 * D_CC

const G_Y = G_SRC.sites.map((s) => s.posScene[1])
const TOP_Y = Math.max(...G_Y)
const BOT_Y = Math.min(...G_Y)
const layerOf = (y: number) => G_SRC.sites.map((_, i) => i).filter((i) => Math.abs(G_SRC.sites[i]!.posScene[1] - y) < 1e-6)
const TOP_SRC = layerOf(TOP_Y)
const BOT_SRC = layerOf(BOT_Y)
const inPlane = (i: number, x: number, z: number) => Math.hypot(G_SRC.sites[i]!.posScene[0] - x, G_SRC.sites[i]!.posScene[2] - z)

/**
 * Центр шестиугольника слоя: узел ДРУГОГО слоя, над которым в укладке AB нет атома этого слоя,
 * а на расстоянии C–C вокруг — ровно шесть. Берётся ближайший к точке (x0, z0).
 */
function hexCenter(layer: readonly number[], other: readonly number[], x0: number, z0: number): [number, number] {
  let best: [number, number] | null = null
  let bestD = Infinity
  for (const j of other) {
    const [x, , z] = G_SRC.sites[j]!.posScene
    let ring = 0
    let eclipsed = false
    for (const i of layer) {
      const d = inPlane(i, x, z)
      if (d < 1e-4) eclipsed = true
      else if (Math.abs(d - D_CC) < 1e-4) ring++
    }
    if (eclipsed || ring !== 6) continue
    const d0 = Math.hypot(x - x0, z - z0)
    if (d0 < bestD) {
      bestD = d0
      best = [x, z]
    }
  }
  if (!best) throw new Error('co2: в слое графита не найден центр шестиугольника')
  return best
}
const CT = hexCenter(TOP_SRC, BOT_SRC, 0, 0)
const CB = hexCenter(BOT_SRC, TOP_SRC, CT[0], CT[1])

/** Связь слоя: пара узлов фрагмента на расстоянии первой сферы (связи генератора решётки). */
const G_BOND_SET = new Set(G_SRC.bonds.map(([i, j]) => `${Math.min(i, j)}|${Math.max(i, j)}`))
const bonded = (i: number, j: number) => G_BOND_SET.has(`${Math.min(i, j)}|${Math.max(i, j)}`)

/** Вырез слоя вокруг центра шестиугольника; атомы с одним соседом отбрасываются (висячих нет). */
function crop(layer: readonly number[], c: readonly [number, number]): number[] {
  let keep = layer.filter((i) => inPlane(i, c[0], c[1]) <= FLAKE_RADIUS + 1e-6)
  for (;;) {
    const next = keep.filter((i) => keep.filter((j) => j !== i && bonded(i, j)).length >= 2)
    if (next.length === keep.length) return keep
    keep = next
  }
}
const FLAKE_SRC: readonly number[] = [...crop(TOP_SRC, CT), ...crop(BOT_SRC, CB)]

/** Центр фрагмента графита в мире и сдвиг «узел ядра → мир» (только перенос: решётка не искажается). */
const GRAPHITE_CENTER: V3 = [-1.95, -0.22, -0.15]
const G_SHIFT: V3 = [GRAPHITE_CENTER[0] - CT[0], GRAPHITE_CENTER[1], GRAPHITE_CENTER[2] - CT[1]]
const srcPos = (i: number): V3 => add(G_SRC.sites[i]!.posScene, G_SHIFT)
/** Высота верхнего слоя в мире. */
const TOP_WORLD_Y = TOP_Y + G_SHIFT[1]

/** Реагирующая пара: два связанных краевых атома верхнего слоя (по два соседа), обращённые к O₂ (+x). */
const EDGE_PAIR = (() => {
  const top = FLAKE_SRC.filter((i) => TOP_SRC.includes(i))
  const deg = (i: number) => FLAKE_SRC.filter((j) => j !== i && bonded(i, j)).length
  const edge = top.filter((i) => deg(i) === 2)
  let best: [number, number] | null = null
  let bestScore = -Infinity
  for (const i of edge) {
    for (const j of edge) {
      if (j <= i || !bonded(i, j)) continue
      const m = mid(srcPos(i), srcPos(j))
      const score = m[0] + 0.25 * m[2]
      if (score > bestScore) {
        bestScore = score
        best = srcPos(i)[0] >= srcPos(j)[0] ? [i, j] : [j, i]
      }
    }
  }
  if (!best) throw new Error('co2: на краю верхнего слоя нет пары связанных атомов с двумя соседями')
  return best
})()
const SRC_C0 = EDGE_PAIR[0]
const SRC_C1 = EDGE_PAIR[1]

/** Направление sp²-связи наружу у краевого атома: против суммы направлений на двух соседей (120° к обоим). */
function outward(i: number): V3 {
  const p = srcPos(i)
  let s: V3 = [0, 0, 0]
  for (const j of FLAKE_SRC) if (j !== i && bonded(i, j)) s = add(s, unit(sub(srcPos(j), p)))
  return unit(scale(s, -1))
}
const OUT0 = outward(SRC_C0)
const OUT1 = outward(SRC_C1)
const C0_SITE = srcPos(SRC_C0)
const C1_SITE = srcPos(SRC_C1)

/** Ячейка графита (ромбическая призма, a·a·c) у центра верхнего фрагмента — рёбра из kit/lattice. */
const G_CELL_CORNER: V3 = (() => {
  const m = cellMatrix('graphite')
  let best: V3 = [0, 0, 0]
  let bestD = Infinity
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      const c = fracToPm(m, [i + 0.5, j + 0.5, 0.5])
      const x = pmToScene(c[0]) + G_SRC.offsetScene[0]
      const z = pmToScene(c[2]) + G_SRC.offsetScene[2]
      const d = Math.hypot(x - CT[0], z - CT[1])
      if (d < bestD) {
        bestD = d
        const o = fracToPm(m, [i, j, 0])
        best = [pmToScene(o[0]) + G_SRC.offsetScene[0], pmToScene(o[1]) + G_SRC.offsetScene[1], pmToScene(o[2]) + G_SRC.offsetScene[2]]
      }
    }
  }
  return add(best, G_SHIFT)
})()
/** Рёбра одной ячейки графита в мире (12 отрезков: 4 по a, 4 по b, 4 по c). */
export const GRAPHITE_CELL_EDGES: readonly LatticeSegment[] = cellEdges('graphite', [1, 1, 1], { center: false }).map(
  ([p, q]) => [add(p, G_CELL_CORNER) as [number, number, number], add(q, G_CELL_CORNER) as [number, number, number]],
)
export const GRAPHITE_CAPTION = latticeCaption('graphite')

// ─── Сухой лёд: целые молекулы из фрагмента 2×2×2, ячейка 1×1×1 вокруг центральной ───────────

const DRY_SRC = latticeFragment('dry_ice', [2, 2, 2])
type DryMolecule = { c: number; o: [number, number] }
/** Целые молекулы фрагмента: C с обеими связями C–O внутри фрагмента (первая сфера генератора). */
const DRY_MOLECULES: readonly DryMolecule[] = (() => {
  const out: DryMolecule[] = []
  DRY_SRC.sites.forEach((s, i) => {
    if (s.el !== 'C') return
    const os = DRY_SRC.bonds.filter(([a, b]) => a === i || b === i).map(([a, b]) => (a === i ? b : a))
    if (os.length === 2) out.push({ c: i, o: [os[0]!, os[1]!] })
  })
  return out
})()
const DRY_CENTRAL = DRY_MOLECULES.find((m) => len(DRY_SRC.sites[m.c]!.posScene) < 1e-6)!
const DRY_NEIGHBOURS = DRY_MOLECULES.filter((m) => m !== DRY_CENTRAL)
const dryPos = (i: number): V3 => DRY_SRC.sites[i]!.posScene
/**
 * C=O внутри молекулы в кристалле — из базиса ячейки (x(O)·√3·a), а не из округлённого cationAnionPm:
 * молекула сюжета встаёт ТОЧНО в узлы центральной молекулы, как и её соседи.
 */
const D_CO_SOLID = len(dryPos(DRY_CENTRAL.o[0]))
/** Ось центральной молекулы (к тому O, что лежит в +x) — туда повернётся молекула сюжета. */
const DRY_O_PLUS = dryPos(DRY_CENTRAL.o[0])[0] >= dryPos(DRY_CENTRAL.o[1])[0] ? DRY_CENTRAL.o[0] : DRY_CENTRAL.o[1]
const DRY_O_MINUS = DRY_O_PLUS === DRY_CENTRAL.o[0] ? DRY_CENTRAL.o[1] : DRY_CENTRAL.o[0]
const DRY_AXIS: V3 = unit(dryPos(DRY_O_PLUS))
/** Рёбра одной элементарной ячейки сухого льда вокруг центральной молекулы. */
export const DRY_CELL_EDGES: readonly LatticeSegment[] = cellEdges('dry_ice', [1, 1, 1])
export const DRY_CAPTION = latticeCaption('dry_ice')

export const CO2_GEOM = {
  radius: R,
  ballScale: CO2_BALL_SCALE,
  cc: D_CC,
  layer: D_LAYER,
  oo: D_OO,
  coSurface: D_CO_SURF,
  coTriple: D_CO_TRIPLE,
  co2: D_CO2,
  oh: D_OH,
  coSolid: D_CO_SOLID,
  flakeCount: FLAKE_SRC.length,
  dryMolecules: DRY_MOLECULES.length,
  dryAxis: DRY_AXIS,
  data: {
    graphite: { spaceGroup: GRAPHITE.spaceGroup, a: GRAPHITE.cellPm.a, c: GRAPHITE.cellPm.c!, cc: GRAPHITE.cationAnionPm, layer: GRAPHITE.cellPm.c! / 2 },
    dry: { spaceGroup: DRY.spaceGroup, a: DRY.cellPm.a, co: DRY.cationAnionPm, z: DRY.z, t: DRY.temperatureK!, neighbours: DRY.coordination['CO₂ (соседних молекул)']! },
  },
} as const

/** Масштаб рига камеры. */
export const CO2_RIG_SCALE = 1.12

// ─────────────────────────────────────────────────────────────────────────────
// Состав кадра: атомы, их шаги и подписи
// ─────────────────────────────────────────────────────────────────────────────

export type Co2Element = 'C' | 'O' | 'H'
export type Co2AtomKind = 'story' | 'graphite' | 'dry'

export type Co2AtomDef = {
  id: string
  el: Co2Element
  kind: Co2AtomKind
  /** индексы шагов [первый, последний], на которых атом имеет право быть видимым */
  span: readonly [number, number]
}

const LAST_STEP = CO2_STEPS.length - 1
const stepFrom = (i: number) => CO2_STEPS[i]!.from
const stepTo = (i: number) => CO2_STEPS[i]!.to

const G_REST = FLAKE_SRC.filter((i) => i !== SRC_C0)
const DRY_REST: readonly number[] = DRY_NEIGHBOURS.flatMap((m) => [m.c, m.o[0], m.o[1]])

export const CO2_ATOMS: readonly Co2AtomDef[] = [
  // c0 — краевой атом графита → C в CO → C в CO₂ → центральная молекула сухого льда
  { id: 'c0', el: 'C', kind: 'story', span: [0, LAST_STEP] },
  // oA, oB — молекула O₂; oA уходит с c0 в CO, oB остаётся на c1 комплексом C(O)
  { id: 'oA', el: 'O', kind: 'story', span: [0, LAST_STEP] },
  { id: 'oB', el: 'O', kind: 'story', span: [0, 2] },
  // oC, hC — радикал ·OH: O переходит в CO₂, H уходит радикалом H·
  { id: 'oC', el: 'O', kind: 'story', span: [3, LAST_STEP] },
  { id: 'hC', el: 'H', kind: 'story', span: [3, 3] },
  ...G_REST.map((_, k) => ({ id: `G${k}`, el: 'C' as Co2Element, kind: 'graphite' as const, span: [0, 2] as const })),
  ...DRY_REST.map((si, k) => ({ id: `D${k}`, el: DRY_SRC.sites[si]!.el as Co2Element, kind: 'dry' as const, span: [LAST_STEP, LAST_STEP] as const })),
]

export const CO2_ATOM_INDEX: ReadonlyMap<string, number> = new Map(CO2_ATOMS.map((a, i) => [a.id, i]))
const IDX = (id: string) => CO2_ATOM_INDEX.get(id)!
const I_C0 = IDX('c0')
const I_OA = IDX('oA')
const I_OB = IDX('oB')
const I_OC = IDX('oC')
const I_HC = IDX('hC')
const G_BASE = 5
const D_BASE = G_BASE + G_REST.length
const GRAPHITE_IDS = CO2_ATOMS.filter((a) => a.kind === 'graphite').map((a) => a.id)
const DRY_IDS = CO2_ATOMS.filter((a) => a.kind === 'dry').map((a) => a.id)
const STORY_MOL_IDS = ['c0', 'oA', 'oC'] as const

/** Узел графита (индекс источника) для атома кадра: c0 и G*. */
export const GRAPHITE_SITE_OF: ReadonlyMap<string, number> = new Map<string, number>([
  ['c0', SRC_C0],
  ...G_REST.map((si, k) => [`G${k}`, si] as [string, number]),
])
/** Узел сухого льда для атома кадра: молекула сюжета — центральная, D* — соседи. */
export const DRY_SITE_OF: ReadonlyMap<string, number> = new Map<string, number>([
  ['c0', DRY_CENTRAL.c],
  ['oA', DRY_O_PLUS],
  ['oC', DRY_O_MINUS],
  ...DRY_REST.map((si, k) => [`D${k}`, si] as [string, number]),
])
/** Атом, который держит второй кислород комплексом C(O). */
export const CO2_C1_ID = `G${G_REST.indexOf(SRC_C1)}`
const I_C1 = IDX(CO2_C1_ID)
export { DRY_SRC, G_SRC, DRY_MOLECULES }

// ─── Связи (слоты пула) ─────────────────────────────────────────────────────

export type Co2BondKind = 'oo' | 'coA' | 'surfB' | 'coC' | 'oh' | 'graphite' | 'graphiteBreak' | 'dry'
export type Co2BondDef = { kind: Co2BondKind; a: number; b: number }

const idOfSrc = (si: number) => (si === SRC_C0 ? I_C0 : G_BASE + G_REST.indexOf(si))
const idOfDry = (si: number) => D_BASE + DRY_REST.indexOf(si)

export const CO2_BONDS: readonly Co2BondDef[] = [
  { kind: 'oo', a: I_OA, b: I_OB },
  { kind: 'coA', a: I_C0, b: I_OA },
  { kind: 'surfB', a: I_C1, b: I_OB },
  { kind: 'coC', a: I_C0, b: I_OC },
  { kind: 'oh', a: I_OC, b: I_HC },
  ...G_SRC.bonds
    .filter(([i, j]) => FLAKE_SRC.includes(i) && FLAKE_SRC.includes(j))
    .map(([i, j]) => ({ kind: (i === SRC_C0 || j === SRC_C0 ? 'graphiteBreak' : 'graphite') as Co2BondKind, a: idOfSrc(i), b: idOfSrc(j) })),
  ...DRY_NEIGHBOURS.flatMap((m) => [
    { kind: 'dry' as const, a: idOfDry(m.c), b: idOfDry(m.o[0]) },
    { kind: 'dry' as const, a: idOfDry(m.c), b: idOfDry(m.o[1]) },
  ]),
]
export const B_OO = 0
export const B_COA = 1
export const B_SURFB = 2
export const B_COC = 3
export const B_OH = 4

// ─────────────────────────────────────────────────────────────────────────────
// Ключевые моменты и положения
// ─────────────────────────────────────────────────────────────────────────────

const ADS = CO2_STAGES.adsorb
const DES = CO2_STAGES.desorb
const OXI = CO2_STAGES.oxidize
const T_POLARITY = co2CueAt('polarity')
const T_CRYSTAL = co2CueAt('crystal')

/** Центр действия шагов 4–6: здесь стоит углерод молекулы и центр ячейки сухого льда. */
const MOL_HOME: V3 = [0, 0, 0]
const X_AXIS: V3 = [1, 0, 0]

/** Кислороды, севшие на край: C=O карбонила по направлению sp² наружу. */
const OA_ADS = add(C0_SITE, scale(OUT0, D_CO_SURF))
const OB_ADS = add(C1_SITE, scale(OUT1, D_CO_SURF))
/** O₂ над краем перед посадкой: ось параллельна паре, чуть снаружи и выше слоя. */
const PAIR_AXIS = unit(sub(OA_ADS, OB_ADS))
const O2_NEAR_C = add(add(mid(OA_ADS, OB_ADS), scale(unit(add(OUT0, OUT1)), 0.32)), [0, 0.12, 0])
const OA_NEAR = add(O2_NEAR_C, scale(PAIR_AXIS, D_OO / 2))
const OB_NEAR = add(O2_NEAR_C, scale(PAIR_AXIS, -D_OO / 2))
/** O₂ на шаге 1: справа от графита, та же ориентация (двухатомная, r_e из ядра). */
const O2_START_C: V3 = [0.95, TOP_WORLD_Y + 0.5, 0.4]
const OA_START = add(O2_START_C, scale(PAIR_AXIS, D_OO / 2))
const OB_START = add(O2_START_C, scale(PAIR_AXIS, -D_OO / 2))

/** Графит уходит влево и гаснет полностью до паузы шага 3 (после десорбции CO). */
const GR_OUT = { from: DES.at + 0.4, to: stepTo(2) - 0.7 }
const GR_EXIT: V3 = [-0.9, 0, 0]

/** Радикал ·OH входит слева и садится на свободный конец CO; H· уходит и гаснет до паузы шага 4. */
const OH_START: V3 = [-1.85, 0.45, 0.3]
const OC_BOND = add(MOL_HOME, scale(X_AXIS, -D_CO2))
const H_AT_OXI = add(MOL_HOME, scale(X_AXIS, -(D_CO2 + D_OH)))
const H_EXIT: V3 = [-1.35, 0.85, 0.35]
const OH_APPEAR = { from: stepFrom(3) + 0.2, to: stepFrom(3) + 0.8 }
const H_OUT = { from: OXI.at + 0.8, to: stepTo(3) - 0.6 }

const POS: Record<string, Vec3Track> = {
  c0: [
    { t: 0, v: C0_SITE },
    { t: DES.start, v: C0_SITE },
    { t: DES.at, v: add(C0_SITE, scale(OUT0, 0.14)), ease: 'smooth' },
    { t: stepTo(2) - 0.8, v: MOL_HOME, ease: 'smooth', arc: 0.15 },
  ],
  // До посадки O₂ летит целой молекулой; с кадра ADS.at кислороды «пристёгнуты» к углероду (sampleCo2Frame).
  oA: [
    { t: 0, v: OA_START },
    { t: stepFrom(1) + 0.3, v: OA_START },
    { t: ADS.start + 0.4, v: OA_NEAR, ease: 'smooth', arc: 0.12 },
    { t: ADS.at, v: OA_ADS, ease: 'smooth' },
  ],
  oB: [
    { t: 0, v: OB_START },
    { t: stepFrom(1) + 0.3, v: OB_START },
    { t: ADS.start + 0.4, v: OB_NEAR, ease: 'smooth', arc: 0.12 },
    { t: ADS.at, v: OB_ADS, ease: 'smooth' },
  ],
  oC: [
    { t: OH_APPEAR.from, v: OH_START },
    { t: OXI.at, v: OC_BOND, ease: 'smooth', arc: 0.1 },
  ],
  hC: [
    { t: OXI.at, v: H_AT_OXI },
    { t: H_OUT.to, v: H_EXIT, ease: 'smooth' },
  ],
}
/** Сдвиг графита при уходе (0 → GR_EXIT). */
const GR_SHIFT: ScalarTrack = [
  { t: GR_OUT.from, v: 0 },
  { t: GR_OUT.to, v: 1, ease: 'inQuad' },
]

// ─── Сухой лёд: соседи подлетают радиально и вырастают из точки ─────────────

const GROW = { from: stepFrom(5) + 0.7, to: T_CRYSTAL - 0.6, flight: 1.2, appear: 0.7, reach: 0.9 }
/** Старт каждого из 12 соседей (ранжирование по id — все соседи равноудалены от центра). */
export const DRY_ARRIVAL: readonly { start: number; arrive: number }[] = DRY_NEIGHBOURS.map((_, k) => {
  const start = GROW.from + (k / Math.max(1, DRY_NEIGHBOURS.length - 1)) * (GROW.to - GROW.from - GROW.flight)
  return { start, arrive: start + GROW.flight }
})
const DRY_DIR: readonly V3[] = DRY_NEIGHBOURS.map((m) => unit(dryPos(m.c)))

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

const APPEAR: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.6, v: 1, ease: 'smooth' },
]
const GRAPHITE_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.6, v: 1, ease: 'smooth' },
  { t: GR_OUT.from, v: 1 },
  { t: GR_OUT.to, v: 0, ease: 'smooth' },
]
const OH_OPACITY: ScalarTrack = [
  { t: OH_APPEAR.from, v: 0 },
  { t: OH_APPEAR.to, v: 1, ease: 'smooth' },
]
const H_OPACITY: ScalarTrack = [
  { t: H_OUT.from, v: 1 },
  { t: H_OUT.to, v: 0, ease: 'smooth' },
]

/** O=O: натяжение при посадке, разрыв в кадр ADS.at (split 0 — пара делится поровну между двумя C–O). */
const OO_STRESS: ScalarTrack = [
  { t: ADS.start, v: 0 },
  { t: ADS.at, v: 1, ease: 'inQuad' },
]
const OO_THIN: ScalarTrack = [
  { t: ADS.at - 0.2, v: 0 },
  { t: ADS.at + 0.3, v: 1, ease: 'outCubic' },
]
const OO_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.6, v: 1, ease: 'smooth' },
  { t: ADS.at, v: 1 },
  { t: ADS.at + 0.5, v: 0, ease: 'smooth' },
]
/** Две связи C–O замыкаются РАНЬШЕ, чем рвётся O=O: к кадру ADS.at обе уже целые. */
const CO_FORM: ScalarTrack = [
  { t: ADS.at - 0.6, v: 0 },
  { t: ADS.at - 0.05, v: 1, ease: 'smooth' },
]
/** Связи C–C краевого атома: натяжение → разрыв в кадр DES.at. */
const CC_STRESS: ScalarTrack = [
  { t: DES.start, v: 0 },
  { t: DES.at, v: 1, ease: 'inQuad' },
]
const CC_THIN: ScalarTrack = [
  { t: DES.at - 0.2, v: 0 },
  { t: DES.at + 0.3, v: 1, ease: 'outCubic' },
]
const CC_OPACITY: ScalarTrack = [
  { t: DES.at, v: 1 },
  { t: DES.at + 0.5, v: 0, ease: 'smooth' },
]
/** O–H радикала: разрыв в кадр OXI.at; C–O из ·OH замыкается к этому кадру. */
const OH_STRESS: ScalarTrack = [
  { t: OXI.start, v: 0 },
  { t: OXI.at, v: 1, ease: 'inQuad' },
]
const OH_THIN: ScalarTrack = [
  { t: OXI.at - 0.2, v: 0 },
  { t: OXI.at + 0.3, v: 1, ease: 'outCubic' },
]
const OH_BOND_OPACITY: ScalarTrack = [
  { t: OXI.at, v: 1 },
  { t: OXI.at + 0.45, v: 0, ease: 'smooth' },
]
const COC_FORM: ScalarTrack = [
  { t: OXI.at - 0.5, v: 0 },
  { t: OXI.at - 0.05, v: 1, ease: 'smooth' },
]

/** Длина C–O сюжета: карбонил (122) → C≡O (112,8) после ухода с края → C=O в CO₂ (116,0) → в кристалле. */
const LEN_A: ScalarTrack = [
  { t: DES.at, v: D_CO_SURF },
  { t: DES.at + 0.8, v: D_CO_TRIPLE, ease: 'smooth' },
  { t: OXI.at - 0.2, v: D_CO_TRIPLE },
  { t: OXI.at + 0.6, v: D_CO2, ease: 'smooth' },
  { t: stepFrom(5) + 0.3, v: D_CO2 },
  { t: stepFrom(5) + 1.9, v: D_CO_SOLID, ease: 'smooth' },
]
const LEN_C: ScalarTrack = [
  { t: stepFrom(5) + 0.3, v: D_CO2 },
  { t: stepFrom(5) + 1.9, v: D_CO_SOLID, ease: 'smooth' },
]
/** Поворот оси CO: sp²-направление края → ось x (шаг 3); ось x → ось центральной молекулы решётки (шаг 6). */
const TURN_1: ScalarTrack = [
  { t: DES.at, v: 0 },
  { t: stepTo(2) - 0.8, v: 1, ease: 'smooth' },
]
const TURN_2: ScalarTrack = [
  { t: stepFrom(5) + 0.3, v: 0 },
  { t: stepFrom(5) + 1.9, v: 1, ease: 'smooth' },
]

/**
 * π-связи (лепестки kit/bondVisual). Язык связи:
 *   O₂ — одна π; C(O) на краю — одна π (⟂ слою); CO — две π (вторая растёт при уходе с края);
 *   при CO + ·OH вторая π CO переходит в новую связь C=O — в CO₂ две π в ПЕРПЕНДИКУЛЯРНЫХ плоскостях.
 *   В середине шага 5 лепестки сворачиваются в запись двойной связи двумя полосами трубки (PI_OFF/ORDER_2).
 */
const PI_OFF = { from: T_POLARITY - 0.6, to: T_POLARITY }
const PI_SURF: ScalarTrack = [
  { t: ADS.at - 0.4, v: 0 },
  { t: ADS.at + 0.2, v: 1, ease: 'smooth' },
  { t: PI_OFF.from, v: 1 },
  { t: PI_OFF.to, v: 0, ease: 'smooth' },
]
const PI_CO_SECOND: ScalarTrack = [
  { t: DES.at, v: 0 },
  { t: DES.at + 0.5, v: 1, ease: 'smooth' },
  { t: OXI.at, v: 1 },
  { t: OXI.at + 0.4, v: 0, ease: 'smooth' },
]
const PI_BOND_C: ScalarTrack = [
  { t: OXI.at - 0.1, v: 0 },
  { t: OXI.at + 0.4, v: 1, ease: 'smooth' },
  { t: PI_OFF.from, v: 1 },
  { t: PI_OFF.to, v: 0, ease: 'smooth' },
]
const ORDER_2: ScalarTrack = [
  { t: PI_OFF.from, v: 1 },
  { t: PI_OFF.to + 0.1, v: 2, ease: 'smooth' },
]

/** Полярность: частичные заряды δ± и векторы диполей связей (гаснут в начале шага 6). */
const POLAR: ScalarTrack = [
  { t: T_POLARITY - 0.4, v: 0 },
  { t: T_POLARITY + 0.2, v: 1, ease: 'smooth' },
  { t: stepFrom(5), v: 1 },
  { t: stepFrom(5) + 0.5, v: 0, ease: 'smooth' },
]

/** Рёбра ячеек: графит (шаги 1–2), затем сухой лёд (шаг 6). */
const GRAPHITE_EDGES: ScalarTrack = [
  { t: 0.3, v: 0 },
  { t: 1.1, v: 1, ease: 'smooth' },
  { t: stepTo(1), v: 1 },
  { t: DES.start, v: 0, ease: 'smooth' },
]
const DRY_EDGES: ScalarTrack = [
  { t: T_CRYSTAL - 1.2, v: 0 },
  { t: T_CRYSTAL, v: 1, ease: 'smooth' },
  { t: CO2_FINISH.from, v: 1 },
  { t: CO2_FINISH.to, v: 0, ease: 'smooth' },
]
/** С какого момента пул рёбер держит ячейку сухого льда (обе дорожки в этот момент = 0). */
export const EDGE_SWITCH_T = stepFrom(3)

const FADE = fadeTrack(CO2_FINISH)

/** Камера: общий план, наезд на край слоя, проводка CO, крупно молекула, облёт сухого льда. */
const EDGE_TARGET = mid(C0_SITE, C1_SITE)
export const CO2_CAMERA: ShotTrack = shotTrack([
  { t: 0, zoom: 0.7, yaw: -0.12, pitch: 0.55, target: [-0.75, TOP_WORLD_Y - 0.1, 0] },
  { t: stepTo(0), zoom: 0.72 },
  { t: ADS.at - 0.4, zoom: 1.0, pitch: 0.5, target: [EDGE_TARGET[0] + 0.15, EDGE_TARGET[1], EDGE_TARGET[2]] },
  { t: stepTo(1), zoom: 1.0 },
  { t: stepTo(2) - 0.8, zoom: 0.96, yaw: -0.04, pitch: 0.26, target: [-0.45, 0.05, 0] },
  { t: stepTo(2), zoom: 0.96 },
  { t: OXI.at - 0.2, zoom: 1.04, yaw: 0, pitch: 0.12, target: [-0.4, 0.05, 0] },
  { t: stepTo(3), zoom: 1.04 },
  { t: stepFrom(4) + 1.4, zoom: 1.42, pitch: 0.08, target: MOL_HOME },
  { t: stepTo(4), zoom: 1.42 },
  { t: stepFrom(5) + 2.0, zoom: 0.95, yaw: 0.3, pitch: 0.32 },
  ...orbitTrack(stepFrom(5) + 2.2, stepTo(5), 0.3, 0.8, 0.32, 0.95),
])

/** Эмиссия — постоянная подсветка по элементу (почти чёрный CPK-углерод иначе не читается на тёмном поле). */
export const CO2_BASE_EMISSIVE: Readonly<Record<Co2Element, number>> = { C: 0.2, O: 0.08, H: 0.08 }
const BASE_BLOOM = 0.3

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D — только формулы, числа и символы единиц (токены)
// ─────────────────────────────────────────────────────────────────────────────

export type Co2LabelDef = SceneLabelDef & {
  anchor: 'flake' | 'layerGap' | 'ccBond' | 'cellTop' | 'cellEdge' | 'mid' | 'atom' | 'mol' | 'cubeAbove' | 'dryEdge'
  /** атомы якоря 'mid' / 'atom' */
  a?: string
  b?: string
  dx?: number
  hosts: readonly string[]
}

const fmt1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1)
const fmt2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2)
const signed = (v: number) => (v < 0 ? `−${fmt1(-v)}` : `+${fmt1(v)}`)

const T_GAS_TO_SOLID = stepFrom(5) + 1.1
const W_GRAPHITE_LABELS = GR_OUT.to - 0.1

export const CO2_LABELS: readonly Co2LabelDef[] = [
  // Шаг 1: графит (ячейка, связь, слои) и O₂
  { id: 'graphite', kind: 'species', anchor: 'flake', dy: 0.72, keys: [{ t: 0, text: 'C ({s})' }], windows: [[0.3, W_GRAPHITE_LABELS]], hosts: [...GRAPHITE_IDS, 'c0'] },
  { id: 'gSg', kind: 'token', anchor: 'cellTop', dy: 0.3, keys: [{ t: 0, text: GRAPHITE.spaceGroup }], windows: [[0.8, DES.start]], hosts: [] },
  { id: 'gA', kind: 'measure', anchor: 'cellEdge', dy: -0.28, keys: [{ t: 0, text: GRAPHITE_CAPTION[0]! }], windows: [[0.9, DES.start]], hosts: [] },
  { id: 'gCC', kind: 'measure', anchor: 'ccBond', dy: 0.28, keys: [{ t: 0, text: `C–C ${fmt1(GRAPHITE.cationAnionPm)} {pm}` }], windows: [[1.2, DES.start]], hosts: [] },
  { id: 'gLayer', kind: 'measure', anchor: 'layerGap', dy: 0, keys: [{ t: 0, text: `${fmt2(GRAPHITE.cellPm.c! / 2)} {pm}` }], windows: [[1.4, DES.start]], hosts: [] },
  { id: 'o2', kind: 'species', anchor: 'mid', a: 'oA', b: 'oB', dy: 0.36, keys: [{ t: 0, text: 'O₂ ({g})' }], windows: [[0.3, ADS.at]], hosts: ['oA', 'oB'] },
  { id: 'oo', kind: 'measure', anchor: 'mid', a: 'oA', b: 'oB', dy: -0.34, keys: [{ t: 0, text: `O=O ${fmt2(CO2_FACTS.o2Pm)} {pm}` }], windows: [[0.8, ADS.start]], hosts: [] },
  // Шаг 2: поверхностные комплексы C(O)
  { id: 'cOA', kind: 'species', anchor: 'mid', a: 'c0', b: 'oA', dy: 0.3, keys: [{ t: 0, text: 'C(O)' }], windows: [[ADS.at, DES.at]], hosts: ['c0', 'oA'] },
  { id: 'cOB', kind: 'species', anchor: 'mid', a: CO2_C1_ID, b: 'oB', dy: -0.3, keys: [{ t: 0, text: 'C(O)' }], windows: [[ADS.at, W_GRAPHITE_LABELS]], hosts: [CO2_C1_ID, 'oB'] },
  // Шаг 3: CO уходит с края
  { id: 'co', kind: 'species', anchor: 'mid', a: 'c0', b: 'oA', dy: 0.34, keys: [{ t: 0, text: 'CO ({g})' }], windows: [[DES.at, OXI.at]], hosts: ['c0', 'oA'] },
  { id: 'coLen', kind: 'measure', anchor: 'mid', a: 'c0', b: 'oA', dy: -0.34, keys: [{ t: 0, text: `C≡O ${fmt1(CO2_FACTS.coTriplePm)} {pm}` }], windows: [[DES.at + 0.6, OXI.start]], hosts: [] },
  { id: 'dHco', kind: 'delta', anchor: 'mol', dy: 0.78, keys: [{ t: 0, text: `ΔH°f = ${signed(CO_DHF_KJ)} {kJmol}` }], windows: [[DES.at + 0.8, OXI.at]], hosts: [] },
  // Шаг 4: CO + ·OH → CO₂ + H·
  { id: 'oh', kind: 'species', anchor: 'mid', a: 'oC', b: 'hC', dy: 0.3, keys: [{ t: 0, text: '·OH' }], windows: [[OH_APPEAR.from, OXI.at]], hosts: ['oC', 'hC'] },
  { id: 'h', kind: 'species', anchor: 'atom', a: 'hC', dy: 0.2, keys: [{ t: 0, text: 'H·' }], windows: [[OXI.at, H_OUT.to]], hosts: ['hC'] },
  { id: 'co2g', kind: 'species', anchor: 'mol', dy: -0.62, keys: [{ t: 0, text: 'CO₂ ({g})' }], windows: [[OXI.at, T_GAS_TO_SOLID]], hosts: [...STORY_MOL_IDS] },
  { id: 'dH', kind: 'delta', anchor: 'mol', dy: 0.78, keys: [{ t: 0, text: `ΔH°f = ${signed(CO2_DHF_KJ)} {kJmol}` }], windows: [[OXI.at + 0.4, stepFrom(4) + 1.6]], hosts: [] },
  // Шаг 5: строение и полярность
  { id: 'coLen2', kind: 'measure', anchor: 'mid', a: 'c0', b: 'oA', dy: -0.36, keys: [{ t: 0, text: `C=O ${fmt1(CO2_FACTS.coPm)} {pm}` }], windows: [[stepFrom(4) + 0.2, stepFrom(5) + 0.4]], hosts: [] },
  { id: 'angle', kind: 'measure', anchor: 'mol', dy: 0.78, keys: [{ t: 0, text: `${CO2_FACTS.angleDeg}°` }], windows: [[stepFrom(4) + 1.7, stepFrom(5) + 0.4]], hosts: [] },
  { id: 'dqC', kind: 'ox', anchor: 'atom', a: 'c0', dy: 0.2, keys: [{ t: 0, text: 'δ+' }], windows: [[T_POLARITY - 0.3, stepFrom(5) + 0.5]], hosts: [] },
  { id: 'dqA', kind: 'ox', anchor: 'atom', a: 'oA', dy: 0.2, keys: [{ t: 0, text: 'δ−' }], windows: [[T_POLARITY - 0.3, stepFrom(5) + 0.5]], hosts: [] },
  { id: 'dqC2', kind: 'ox', anchor: 'atom', a: 'oC', dy: 0.2, keys: [{ t: 0, text: 'δ−' }], windows: [[T_POLARITY - 0.3, stepFrom(5) + 0.5]], hosts: [] },
  { id: 'chi', kind: 'delta', anchor: 'mol', dy: -1.0, keys: [{ t: 0, text: `Δχ = ${fmt2(CO2_FACTS.deltaChi)}` }], windows: [[T_POLARITY - 0.2, stepFrom(5) + 0.5]], hosts: [] },
  { id: 'mu', kind: 'delta', anchor: 'mol', dy: 1.18, keys: [{ t: 0, text: `Σμ = ${CO2_FACTS.dipoleD}` }], windows: [[T_POLARITY, stepFrom(5) + 0.5]], hosts: [] },
  // Шаг 6: сухой лёд
  { id: 'solid', kind: 'species', anchor: 'cubeAbove', dy: 1.05, keys: [{ t: 0, text: 'CO₂ ({s})' }], windows: [[T_GAS_TO_SOLID, CO2_END]], hosts: [...DRY_IDS, ...STORY_MOL_IDS] },
  { id: 'dryA', kind: 'measure', anchor: 'dryEdge', dy: -0.3, keys: [{ t: 0, text: DRY_CAPTION[0]! }], windows: [[T_CRYSTAL - 0.8, CO2_END]], hosts: [] },
  { id: 'drySg', kind: 'token', anchor: 'cubeAbove', dy: 0.5, dx: -0.55, keys: [{ t: 0, text: DRY.spaceGroup }], windows: [[T_CRYSTAL - 0.6, CO2_END]], hosts: [] },
  { id: 'dryCn', kind: 'token', anchor: 'cubeAbove', dy: 0.5, dx: 0.55, keys: [{ t: 0, text: `{cn} ${CO2_GEOM.data.dry.neighbours}` }], windows: [[T_CRYSTAL - 0.4, CO2_END]], hosts: [] },
]

export type Co2LabelState = SceneLabelState

/** Якоря подписей графита (в мире без сдвига ухода — сдвиг добавляется в кадре). */
const CC_BOND_MID: V3 = (() => {
  let best: V3 = [0, 0, 0]
  let bestZ = -Infinity
  for (const [i, j] of G_SRC.bonds) {
    if (!FLAKE_SRC.includes(i) || !FLAKE_SRC.includes(j) || !TOP_SRC.includes(i)) continue
    if (i === SRC_C0 || j === SRC_C0 || i === SRC_C1 || j === SRC_C1) continue
    const m = mid(srcPos(i), srcPos(j))
    if (m[2] > bestZ) {
      bestZ = m[2]
      best = m
    }
  }
  return best
})()
const LAYER_GAP: V3 = [GRAPHITE_CENTER[0] - FLAKE_RADIUS - 0.35, GRAPHITE_CENTER[1], GRAPHITE_CENTER[2]]
const CELL_TOP: V3 = (() => {
  const top = Math.max(...GRAPHITE_CELL_EDGES.flatMap(([p, q]) => [p[1], q[1]]))
  const c = GRAPHITE_CELL_EDGES.reduce<V3>((s, [p, q]) => add(s, scale(add(p, q), 1 / (2 * GRAPHITE_CELL_EDGES.length))), [0, 0, 0])
  return [c[0], top, c[2]]
})()
/** Подпись a — у нижнего переднего ребра ячейки графита вдоль a. */
const CELL_EDGE_A: V3 = (() => {
  const bottom = Math.min(...GRAPHITE_CELL_EDGES.flatMap(([p, q]) => [p[1], q[1]]))
  const cand = GRAPHITE_CELL_EDGES.filter(([p, q]) => Math.abs(p[1] - bottom) < 1e-6 && Math.abs(q[1] - bottom) < 1e-6)
  cand.sort((u, v) => mid(v[0], v[1])[2] - mid(u[0], u[1])[2])
  return mid(cand[0]![0], cand[0]![1])
})()
const DRY_TOP_Y = Math.max(...DRY_MOLECULES.flatMap((m) => [m.c, m.o[0], m.o[1]]).map((i) => dryPos(i)[1]))
const DRY_EDGE_A: V3 = (() => {
  const bottom = Math.min(...DRY_CELL_EDGES.flatMap(([p, q]) => [p[1], q[1]]))
  const front = Math.max(...DRY_CELL_EDGES.flatMap(([p, q]) => [p[2], q[2]]))
  const e = DRY_CELL_EDGES.find(
    ([p, q]) => Math.abs(p[1] - bottom) < 1e-6 && Math.abs(q[1] - bottom) < 1e-6 && Math.abs(p[2] - front) < 1e-6 && Math.abs(q[2] - front) < 1e-6,
  )!
  return mid(e[0], e[1])
})()

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

/** π-пары кадра: связь (атомы), нормаль π и количество 0…1. */
export type Co2Pi = { a: number; b: number; normal: THREE.Vector3; amount: number }
export const PI_O2 = 0
export const PI_A = 1
export const PI_A2 = 2
export const PI_SURF_B = 3
export const PI_C = 4

export type Co2Frame = {
  t: number
  pos: THREE.Vector3[]
  radius: Float32Array
  opacity: Float32Array
  /** частичный заряд для окраски кромки (δ±, не ионы) */
  charge: Float32Array
  emissive: Float32Array
  material: SubstanceKind[]
  bond: { opacity: Float32Array; stress: Float32Array; thinning: Float32Array; form: Float32Array; order: Float32Array }
  pi: [Co2Pi, Co2Pi, Co2Pi, Co2Pi, Co2Pi]
  /** какой набор рёбер ячеек в пуле и его прозрачность */
  edgeSet: 'graphite' | 'dry'
  edges: number
  /** амплитуды аннотаций (тест: в финале 0): векторы диполей и π-лепестки */
  fx: { dipole: number; lobes: number }
  /** сдвиг графита при уходе (для подписей) */
  grShift: THREE.Vector3
  labels: Co2LabelState[]
  camera: SceneCamera
  fade: number
}

const Y_UP = new THREE.Vector3(0, 1, 0)
const Z_FWD = new THREE.Vector3(0, 0, 1)

function createPi(a: number, b: number, normal: THREE.Vector3): Co2Pi {
  return { a, b, normal: normal.clone(), amount: 0 }
}

export function createCo2Frame(): Co2Frame {
  const n = CO2_ATOMS.length
  const nb = CO2_BONDS.length
  return {
    t: 0,
    pos: CO2_ATOMS.map(() => new THREE.Vector3()),
    radius: new Float32Array(n),
    opacity: new Float32Array(n),
    charge: new Float32Array(n),
    emissive: Float32Array.from(CO2_ATOMS, (a) => CO2_BASE_EMISSIVE[a.el]),
    material: CO2_ATOMS.map(() => 'default' as SubstanceKind),
    bond: {
      opacity: new Float32Array(nb),
      stress: new Float32Array(nb),
      thinning: new Float32Array(nb),
      form: new Float32Array(nb).fill(1),
      order: new Float32Array(nb).fill(1),
    },
    pi: [
      createPi(I_OA, I_OB, Y_UP),
      createPi(I_C0, I_OA, Y_UP),
      createPi(I_C0, I_OA, Z_FWD),
      createPi(I_C1, I_OB, Y_UP),
      createPi(I_C0, I_OC, Z_FWD),
    ],
    edgeSet: 'graphite',
    edges: 0,
    fx: { dipole: 0, lobes: 0 },
    grShift: new THREE.Vector3(),
    labels: createLabelStates(CO2_LABELS),
    camera: createSceneCamera(),
    fade: 0,
  }
}

const G_BASE_POS: readonly THREE.Vector3[] = G_REST.map((si) => new THREE.Vector3(...srcPos(si)))
const DRY_SITE_POS: readonly THREE.Vector3[] = DRY_REST.map((si) => new THREE.Vector3(...dryPos(si)))
const DRY_MOL_OF_ATOM: readonly number[] = DRY_REST.map((_, k) => Math.floor(k / 3))
const DRY_DIR_V: readonly THREE.Vector3[] = DRY_DIR.map((d) => new THREE.Vector3(...d))
const V_OUT0 = new THREE.Vector3(...OUT0)
const V_OUT1 = new THREE.Vector3(...OUT1)
const V_X = new THREE.Vector3(1, 0, 0)
const V_DRY_AXIS = new THREE.Vector3(...DRY_AXIS)
const V_GR_EXIT = new THREE.Vector3(...GR_EXIT)
const TRACK_OF: readonly (Vec3Track | undefined)[] = CO2_ATOMS.map((a) => POS[a.id])
const _dir = new THREE.Vector3()
const _tmp = new THREE.Vector3()

/** Кадр, для которого сейчас считаются подписи (anchorLabel — модульная функция, без замыканий). */
let _cur: Co2Frame | null = null

function anchorLabel(def: SceneLabelDef, st: SceneLabelState): void {
  const f = _cur!
  const d = def as Co2LabelDef
  const p = f.pos
  switch (d.anchor) {
    case 'flake':
      st.pos.set(GRAPHITE_CENTER[0], TOP_WORLD_Y + d.dy, GRAPHITE_CENTER[2]).add(f.grShift)
      return
    case 'layerGap':
      st.pos.set(LAYER_GAP[0], LAYER_GAP[1] + d.dy, LAYER_GAP[2]).add(f.grShift)
      return
    case 'ccBond':
      st.pos.set(CC_BOND_MID[0], CC_BOND_MID[1] + d.dy, CC_BOND_MID[2]).add(f.grShift)
      return
    case 'cellTop':
      st.pos.set(CELL_TOP[0], CELL_TOP[1] + d.dy, CELL_TOP[2])
      return
    case 'cellEdge':
      st.pos.set(CELL_EDGE_A[0], CELL_EDGE_A[1] + d.dy, CELL_EDGE_A[2])
      return
    case 'mid':
      st.pos.copy(p[IDX(d.a!)]!).lerp(p[IDX(d.b!)]!, 0.5)
      st.pos.y += d.dy
      return
    case 'atom': {
      const i = IDX(d.a!)
      st.pos.copy(p[i]!)
      st.pos.y += d.dy > 0 ? f.radius[i]! + d.dy : -(f.radius[i]! - d.dy)
      return
    }
    case 'mol':
      st.pos.copy(p[I_C0]!)
      st.pos.y += d.dy
      return
    case 'cubeAbove':
      st.pos.set(d.dx ?? 0, DRY_TOP_Y + d.dy, 0)
      return
    case 'dryEdge':
      st.pos.set(DRY_EDGE_A[0], DRY_EDGE_A[1] + d.dy, DRY_EDGE_A[2])
      return
  }
}

/** Направление C → oA в момент t: sp²-наружу → ось x (шаг 3) → ось центральной молекулы решётки (шаг 6). */
function writeAxisA(t: number, out: THREE.Vector3): THREE.Vector3 {
  const u1 = sampleScalar(TURN_1, t)
  const u2 = sampleScalar(TURN_2, t)
  if (u2 > 0) return out.copy(V_X).lerp(V_DRY_AXIS, u2).normalize()
  return out.copy(V_OUT0).lerp(V_X, u1).normalize()
}

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleCo2Frame(t: number, frame: Co2Frame): Co2Frame {
  frame.t = t
  const { pos, radius, opacity, charge, material, bond } = frame

  for (let i = 0; i < CO2_ATOMS.length; i++) {
    const tr = TRACK_OF[i]
    if (tr) sampleVec3(tr, t, pos[i]!)
    radius[i] = R[CO2_ATOMS[i]!.el]
    charge[i] = 0
  }

  // ——— Графит: неподвижные слои, после десорбции CO уходят влево и гаснут полностью ———
  const gA = sampleScalar(GRAPHITE_OPACITY, t)
  frame.grShift.copy(V_GR_EXIT).multiplyScalar(sampleScalar(GR_SHIFT, t))
  for (let k = 0; k < G_BASE_POS.length; k++) {
    const i = G_BASE + k
    pos[i]!.copy(G_BASE_POS[k]!).add(frame.grShift)
    opacity[i] = gA
    material[i] = 'polar'
  }

  // ——— Атомы сюжета ———
  const appear = sampleScalar(APPEAR, t)
  opacity[I_C0] = appear
  opacity[I_OA] = appear
  opacity[I_OB] = t < GR_OUT.from ? appear : gA
  const ohA = sampleScalar(OH_OPACITY, t)
  opacity[I_OC] = ohA
  opacity[I_HC] = t < OXI.at ? ohA : sampleScalar(H_OPACITY, t)

  material[I_C0] = t < DES.at ? 'polar' : 'covalent'
  material[I_OA] = t < ADS.at ? 'gas' : t < DES.at ? 'polar' : 'covalent'
  material[I_OB] = t < ADS.at ? 'gas' : 'polar'
  material[I_OC] = t < OXI.at ? 'gas' : 'covalent'
  material[I_HC] = 'gas'

  // Ось CO / CO₂ и длины: с кадра посадки кислород «пристёгнут» к своему углероду.
  const axis = writeAxisA(t, _dir)
  if (t >= ADS.at) {
    pos[I_OA]!.copy(pos[I_C0]!).addScaledVector(axis, sampleScalar(LEN_A, t))
    pos[I_OB]!.copy(pos[I_C1]!).addScaledVector(V_OUT1, D_CO_SURF)
  }
  if (t >= OXI.at) pos[I_OC]!.copy(pos[I_C0]!).addScaledVector(axis, -sampleScalar(LEN_C, t))
  if (t < OXI.at) {
    // H радикала — за своим O, наружу от углерода: O–H длиной из ядра.
    _tmp.copy(pos[I_OC]!).sub(pos[I_C0]!).normalize()
    pos[I_HC]!.copy(pos[I_OC]!).addScaledVector(_tmp, D_OH)
  }

  // ——— Сухой лёд: 12 соседних молекул подлетают радиально и вырастают из точки ———
  for (let k = 0; k < DRY_SITE_POS.length; k++) {
    const i = D_BASE + k
    const m = DRY_MOL_OF_ATOM[k]!
    const arr = DRY_ARRIVAL[m]!
    const u = smoothstep(arr.start, arr.arrive, t)
    const grow = t <= arr.start ? 0 : smoothstep(arr.start, arr.start + GROW.appear, t)
    pos[i]!.copy(DRY_SITE_POS[k]!).addScaledVector(DRY_DIR_V[m]!, GROW.reach * (1 - u))
    radius[i] = radius[i]! * grow
    opacity[i] = grow * 3 >= 1 ? 1 : grow * 3
    material[i] = 'covalent'
  }

  // ——— Связи ———
  writeBondTracks(t, frame, gA)

  // ——— π-связи (нормали — ⟂ слою и ⟂ ему: в CO₂ две π в перпендикулярных плоскостях) ———
  const pi = frame.pi
  pi[PI_O2]!.amount = bond.opacity[B_OO]! * (1 - sampleScalar(OO_THIN, t))
  pi[PI_A]!.amount = sampleScalar(PI_SURF, t)
  pi[PI_A2]!.amount = sampleScalar(PI_CO_SECOND, t)
  pi[PI_SURF_B]!.amount = sampleScalar(PI_SURF, t) * (t < GR_OUT.from ? 1 : gA)
  pi[PI_C]!.amount = sampleScalar(PI_BOND_C, t)
  let lobes = 0
  for (let k = 0; k < 5; k++) lobes = Math.max(lobes, pi[k]!.amount)
  frame.fx.lobes = lobes

  // ——— Полярность: δ+ на C, δ− на O (частичные заряды, не ионы) ———
  const polar = sampleScalar(POLAR, t)
  frame.fx.dipole = polar
  charge[I_C0] = 0.5 * polar
  charge[I_OA] = -0.35 * polar
  charge[I_OC] = -0.35 * polar

  // ——— Рёбра ячеек ———
  if (t < EDGE_SWITCH_T) {
    frame.edgeSet = 'graphite'
    frame.edges = sampleScalar(GRAPHITE_EDGES, t)
  } else {
    frame.edgeSet = 'dry'
    frame.edges = sampleScalar(DRY_EDGES, t)
  }

  frame.fade = sampleScalar(FADE, t)

  // ——— Подписи ———
  _cur = frame
  sampleLabels(CO2_LABELS, frame.labels, t, anchorLabel, frame.fade)
  _cur = null

  // ——— Камера ———
  const cam = frame.camera
  sampleShot(CO2_CAMERA, t, cam)
  cam.shake = 0
  cam.bloom = BASE_BLOOM
  cam.vignette = Math.max(0.3, frame.fade)
  return frame
}

const BOND_KIND: readonly Co2BondKind[] = CO2_BONDS.map((b) => b.kind)

function writeBondTracks(t: number, frame: Co2Frame, gA: number): void {
  const { opacity, stress, thinning, form, order } = frame.bond
  const ooA = sampleScalar(OO_OPACITY, t)
  const coForm = sampleScalar(CO_FORM, t)
  const order2 = sampleScalar(ORDER_2, t)
  const ccStress = sampleScalar(CC_STRESS, t)
  const ccThin = sampleScalar(CC_THIN, t)
  const ccA = sampleScalar(CC_OPACITY, t)
  const cocForm = sampleScalar(COC_FORM, t)
  for (let k = 0; k < BOND_KIND.length; k++) {
    stress[k] = 0
    thinning[k] = 0
    form[k] = 1
    order[k] = 1
    switch (BOND_KIND[k]) {
      case 'oo':
        opacity[k] = ooA
        stress[k] = sampleScalar(OO_STRESS, t)
        thinning[k] = sampleScalar(OO_THIN, t)
        break
      case 'coA':
        opacity[k] = t < ADS.at - 0.6 ? 0 : coForm
        form[k] = coForm
        order[k] = order2
        break
      case 'surfB':
        opacity[k] = coForm * (t < GR_OUT.from ? 1 : gA)
        form[k] = coForm
        break
      case 'coC':
        opacity[k] = cocForm
        form[k] = cocForm
        order[k] = order2
        break
      case 'oh':
        opacity[k] = frame.opacity[I_OC]! * sampleScalar(OH_BOND_OPACITY, t)
        stress[k] = sampleScalar(OH_STRESS, t)
        thinning[k] = sampleScalar(OH_THIN, t)
        break
      case 'graphite':
        opacity[k] = gA
        break
      case 'graphiteBreak':
        opacity[k] = gA * ccA
        stress[k] = ccStress
        thinning[k] = ccThin
        break
      case 'dry': {
        // Связь молекулы решётки проявляется вместе с ростом её шаров (доля радиуса C), без щелчка.
        opacity[k] = frame.radius[CO2_BONDS[k]!.a]! / R.C
        order[k] = 2
        break
      }
    }
  }
}

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validateCo2Storyboard(): void {
  const vec: Record<string, Vec3Track> = {}
  for (const [id, track] of Object.entries(POS)) vec[`pos.${id}`] = track
  vec['cam.offset'] = CO2_CAMERA.offset
  validateTracks(vec)
  validateTracks({
    GR_SHIFT,
    APPEAR,
    GRAPHITE_OPACITY,
    OH_OPACITY,
    H_OPACITY,
    OO_STRESS,
    OO_THIN,
    OO_OPACITY,
    CO_FORM,
    CC_STRESS,
    CC_THIN,
    CC_OPACITY,
    OH_STRESS,
    OH_THIN,
    OH_BOND_OPACITY,
    COC_FORM,
    LEN_A,
    LEN_C,
    TURN_1,
    TURN_2,
    PI_SURF,
    PI_CO_SECOND,
    PI_BOND_C,
    ORDER_2,
    POLAR,
    GRAPHITE_EDGES,
    DRY_EDGES,
    FADE,
    camZoom: CO2_CAMERA.zoom,
    camYaw: CO2_CAMERA.yaw,
    camPitch: CO2_CAMERA.pitch,
  })

  // Графит: оба слоя из узлов ядра, у каждого атома ≥ 2 соседей в слое, связи = C–C ядра.
  const top = FLAKE_SRC.filter((i) => TOP_SRC.includes(i))
  const bot = FLAKE_SRC.filter((i) => BOT_SRC.includes(i))
  if (top.length === 0 || bot.length === 0) throw new Error('co2: во фрагменте графита обязаны быть два слоя')
  for (const i of FLAKE_SRC) {
    const n = FLAKE_SRC.filter((j) => j !== i && bonded(i, j)).length
    if (n < 2 || n > GRAPHITE.coordination['C (в слое)']!) throw new Error(`co2: у атома графита ${i} ${n} соседей`)
  }
  if (Math.abs(TOP_Y - BOT_Y - D_LAYER) > 1e-9) throw new Error('co2: расстояние между слоями ≠ c/2')
  const c0Bonds = CO2_BONDS.filter((b) => b.kind === 'graphiteBreak')
  if (c0Bonds.length !== 2) throw new Error(`co2: краевой атом держится на ${c0Bonds.length} связях, а не на двух`)
  if (!bonded(SRC_C0, SRC_C1)) throw new Error('co2: реагирующая пара обязана быть связанной')

  // Сухой лёд: 13 целых молекул — центральная и 12 соседей на a/√2 (КЧ ядра), Z = 1 + 12·¼.
  if (DRY_NEIGHBOURS.length !== CO2_GEOM.data.dry.neighbours) {
    throw new Error(`co2: у центральной молекулы ${DRY_NEIGHBOURS.length} соседей, а КЧ ядра ${CO2_GEOM.data.dry.neighbours}`)
  }
  if (1 + DRY_NEIGHBOURS.length / 4 !== DRY.z) throw new Error('co2: в ячейке сухого льда Z = 1 + 12·¼ обязано совпасть с ядром')
  if (DRY_CELL_EDGES.length !== 12) throw new Error('co2: у одной ячейки 12 рёбер')

  // Никаких событий лаборатории до конца последнего шага.
  if (CO2_END <= stepTo(LAST_STEP)) throw new Error('co2: хвост сцены пустой')
}
