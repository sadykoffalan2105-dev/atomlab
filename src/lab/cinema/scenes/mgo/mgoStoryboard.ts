import * as THREE from 'three'
import { bondEnthalpyKJ, bondLengthPm, getCrystal, isCationSite } from '../../../../chemistry/data'
import { mix, smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, windowFade, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { bondLength, pmToScene, speciesRadius } from '../kit/cpkAtoms'
import { createElectronJump, sampleElectronJump, type ElectronJump } from '../kit/electronFx'
import {
  appearTrack,
  createLabelStates,
  fadeTrack,
  rampTrack,
  sampleLabels,
  validateTracks,
  type SceneLabelDef,
  type SceneLabelState,
} from '../kit/sceneKit'
import { MGO_FINISH, MGO_END, mgoCueAt } from './mgoSteps'

export {
  MGO_CUES,
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
 *
 * Вся химия — из src/chemistry/data (ни одного числа руками):
 *   • Mg металлический: ГПУ, P6₃/mmc (194), a = 320,94 пм, c = 521,08 пм, КЧ 12;
 *     в кадре — координационный многогранник: центральный атом и 12 соседей
 *     (слои A-B-A: шесть в своём слое, по три сверху и снизу НАД ОДНИМИ И ТЕМИ ЖЕ
 *     лунками — этим ГПУ отличается от ГЦК);
 *   • O₂: длина двойной связи 120,8 пм, D(O=O) = 498 кДж/моль;
 *   • MgO: периклаз, структурный тип каменной соли, Fm-3m (225), две ГЦК-подрешётки,
 *     a = 421,12 пм, d(Mg²⁺–O²⁻) = 210,56 пм, КЧ 6/6, Z = 4, ρ = 3,58 г/см³,
 *     t_пл = 2852 °C;
 *   • радиусы: Mg⁰ 160 пм (металлический) → Mg²⁺ 72 пм; O⁰ 66 пм (ковалентный,
 *     в молекуле O₂) → O²⁻ 140 пм. На экране O²⁻ ровно в 1,94 раза крупнее Mg²⁺.
 *
 * Ячейка MgO (421 пм) заметно МЕНЬШЕ ячейки NaCl (564 пм), а заряды вдвое больше —
 * отсюда энергия решётки −3789 против −787 кДж/моль. Это видно прямо в кадре:
 * тот же мотив каменной соли, но куб компактнее.
 *
 * ЧТО НАРИСОВАНО СХЕМАТИЧНО (и так сказано в тексте урока):
 *   • светящаяся оболочка вокруг магния — знак «здесь два внешних электрона 3s²»,
 *     а не форма орбитали;
 *   • «полёт» электрона по дуге: переход электрона квантовый, траектории нет;
 *   • белое пламя показано свечением и вспышкой — настоящее горение магния
 *     даёт ещё и жёсткий ультрафиолет, смотреть на него нельзя;
 *   • показаны 64 иона фрагмента 4×4×4 и 13 атомов металла, в настоящей ленте
 *     магния их порядка 10²¹.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

const PERICLASE = getCrystal('mgo')!
const METAL = getCrystal('mg_metal')!

/** Половина расстояния Mg²⁺–O²⁻ = a/4: узлы решётки стоят в НЕЧЁТНЫХ кратных этой величины. */
const HALF = pmToScene(PERICLASE.cationAnionPm) / 2
/** Ребро ячейки MgO, мировые единицы (= 4·HALF). */
const CELL = pmToScene(PERICLASE.cellPm.a)
/** Параметры ГПУ-ячейки магния, мировые единицы. */
const MA = pmToScene(METAL.cellPm.a)
const MC = pmToScene(METAL.cellPm.c!)
/** Половина длины двойной связи O=O. */
const OH = bondLength('O=O') / 2

const R = {
  mg: speciesRadius('Mg', 0),
  mgIon: speciesRadius('Mg', 2),
  o: speciesRadius('O', 0),
  oIon: speciesRadius('O', -2),
} as const

/** Радиус светящейся оболочки вокруг атома магния (схематичная 3s²). */
const SHELL_MG = R.mg * 1.3

export const MGO_GEOM = {
  radius: R,
  half: HALF,
  cell: CELL,
  oHalf: OH,
  shellMg: SHELL_MG,
  /** расстояние Mg²⁺–O²⁻ в решётке, мировые единицы */
  latticeMgO: HALF * 2,
  /** справочные числа для подписей и тестов */
  data: {
    spaceGroup: PERICLASE.spaceGroup,
    spaceGroupNo: PERICLASE.spaceGroupNo,
    latticeType: PERICLASE.latticeType,
    structureType: PERICLASE.structureType,
    cellPm: PERICLASE.cellPm.a,
    mgOPm: PERICLASE.cationAnionPm,
    coordination: PERICLASE.coordination,
    z: PERICLASE.z,
    densityGCm3: PERICLASE.densityGCm3,
    meltingC: PERICLASE.meltingC!,
    /** длина двойной связи O=O, пм, и её энергия */
    ooPm: bondLengthPm('O=O'),
    ooKJ: bondEnthalpyKJ('O=O'),
    metal: {
      spaceGroup: METAL.spaceGroup,
      latticeType: METAL.latticeType,
      cellPm: METAL.cellPm.a,
      cellCPm: METAL.cellPm.c!,
      nearestPm: METAL.cationAnionPm,
      coordination: METAL.coordination.Mg!,
    },
  },
} as const

/** Масштаб рига камеры: в кадре мало частиц, детали важны. */
export const MGO_RIG_SCALE = 1.15

// ─────────────────────────────────────────────────────────────────────────────
// Узлы решётки и металлический фрагмент
// ─────────────────────────────────────────────────────────────────────────────

export type MgoElement = 'Mg' | 'O'
export type MgoAtomId =
  | 'mg1'
  | 'mg2'
  | 'oA'
  | 'oB'
  | 'mg3'
  | 'mg4'
  | 'oC'
  | 'oD'
  | `L${number}`
  | `M${number}`

type Site = readonly [number, number, number]

/**
 * Узлы каменной соли: все координаты НЕЧЁТНЫЕ (в единицах a/4), соседи отличаются
 * на 2 по одной оси — это ровно d(Mg²⁺–O²⁻) = a/2. Знак заряда определяет общий
 * для проекта предикат isCationSite() по «шахматному» индексу узла (s + 1)/2,
 * поэтому одноимённые ионы физически не могут оказаться соседями.
 */
const siteIndex = (s: Site): [number, number, number] => [(s[0] + 1) / 2, (s[1] + 1) / 2, (s[2] + 1) / 2]
const elementAtSite = (s: Site): MgoElement => {
  const [i, j, k] = siteIndex(s)
  return isCationSite(i, j, k) ? 'Mg' : 'O'
}

/**
 * Восемь центральных узлов — ионы сюжета. Пара mg1/oA собирается спереди-сверху,
 * пара mg2/oB — сзади-снизу: магний приходит СЛЕВА (из металла), кислород СПРАВА
 * (из молекулы), поэтому их пути не пересекаются.
 */
const STORY_SITES: Record<'mg1' | 'mg2' | 'oA' | 'oB' | 'mg3' | 'mg4' | 'oC' | 'oD', Site> = {
  mg1: [-1, 1, 1],
  oA: [1, 1, 1],
  mg2: [-1, -1, -1],
  oB: [1, -1, -1],
  mg3: [1, -1, 1],
  oC: [-1, -1, 1],
  mg4: [1, 1, -1],
  oD: [-1, 1, -1],
}

const LATTICE_IONS: { id: MgoAtomId; el: MgoElement; site: Site }[] = []
{
  const coords = [-3, -1, 1, 3]
  let n = 0
  for (const x of coords)
    for (const y of coords)
      for (const z of coords) {
        if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) === 1) continue
        LATTICE_IONS.push({ id: `L${n++}`, el: elementAtSite([x, y, z]), site: [x, y, z] })
      }
}

export const SITE_BY_ID: Readonly<Record<string, Site>> = {
  ...STORY_SITES,
  ...Object.fromEntries(LATTICE_IONS.map((l) => [l.id, l.site])),
}

/**
 * Фрагмент металлического магния — координационный многогранник ГПУ:
 * центральный атом (M0), шесть соседей в своём слое на расстоянии a = 320,9 пм
 * и по три атома в слоях сверху и снизу НАД ОДНИМИ И ТЕМИ ЖЕ лунками (укладка
 * A-B-A). Всего КЧ = 12. Два атома верхнего и нижнего слоя (mg1, mg2) уходят
 * в реакцию, остальные одиннадцать остаются металлом.
 *
 * Базисная плоскость лежит в XZ, ось c — вдоль Y.
 */
const METAL_CENTER: Site = [-1.85, 0, -0.15]
const metalPos = (dx: number, dy: number, dz: number): [number, number, number] => [
  METAL_CENTER[0] + dx,
  METAL_CENTER[1] + dy,
  METAL_CENTER[2] + dz,
]

/** Радиус лунки соседнего слоя: a/√3 — центр треугольника из трёх атомов слоя. */
const GAP_R = MA / Math.sqrt(3)
/** Углы лунок укладки B (одни и те же сверху и снизу — это и есть ГПУ). */
const B_ANGLES = [30, 150, 270].map((d) => (d * Math.PI) / 180)

const hexPos = (k: number): [number, number, number] =>
  metalPos(MA * Math.cos((k * Math.PI) / 3), 0, MA * Math.sin((k * Math.PI) / 3))
const capPos = (a: number, up: 1 | -1): [number, number, number] =>
  metalPos(GAP_R * Math.cos(a), (up * MC) / 2, GAP_R * Math.sin(a))

/** mg1 и mg2 — верхний и нижний атомы над лункой со стороны кислорода (30°). */
const MG1_START = capPos(B_ANGLES[0]!, 1)
const MG2_START = capPos(B_ANGLES[0]!, -1)

/** Одиннадцать оставшихся узлов многогранника: центр + шесть в слое + 2 сверху + 2 снизу. */
const METAL_SITES: Array<[number, number, number]> = [
  metalPos(0, 0, 0),
  hexPos(0),
  hexPos(1),
  hexPos(2),
  hexPos(3),
  hexPos(4),
  hexPos(5),
  capPos(B_ANGLES[1]!, 1),
  capPos(B_ANGLES[2]!, 1),
  capPos(B_ANGLES[1]!, -1),
  capPos(B_ANGLES[2]!, -1),
]

export const METAL_ATOMS: readonly { id: MgoAtomId; pos: readonly [number, number, number] }[] = METAL_SITES.map(
  (pos, i) => ({ id: `M${i}` as MgoAtomId, pos }),
)

export const MGO_ATOMS: readonly { id: MgoAtomId; el: MgoElement; main: boolean }[] = [
  { id: 'mg1', el: 'Mg', main: true },
  { id: 'mg2', el: 'Mg', main: true },
  { id: 'oA', el: 'O', main: true },
  { id: 'oB', el: 'O', main: true },
  { id: 'mg3', el: 'Mg', main: false },
  { id: 'mg4', el: 'Mg', main: false },
  { id: 'oC', el: 'O', main: false },
  { id: 'oD', el: 'O', main: false },
  ...LATTICE_IONS.map((l) => ({ id: l.id, el: l.el, main: false })),
  ...METAL_ATOMS.map((m) => ({ id: m.id, el: 'Mg' as MgoElement, main: false })),
]

/** Шесть ближайших соседей O²⁻ у иона mg1 — подсветка координационного числа 6. */
export const MGO_COORDINATION_IDS: readonly MgoAtomId[] = MGO_ATOMS.filter((a) => {
  const s = SITE_BY_ID[a.id]
  if (!s) return false
  const c = STORY_SITES.mg1
  const d = [Math.abs(s[0] - c[0]), Math.abs(s[1] - c[1]), Math.abs(s[2] - c[2])]
  return d.filter((v) => v === 2).length === 1 && d.filter((v) => v === 0).length === 2
}).map((a) => a.id)

/** Рёбра фрагмента: пары ближайших соседей Mg²⁺–O²⁻ (144 ребра во фрагменте 4×4×4). */
export const MGO_EDGES: readonly (readonly [MgoAtomId, MgoAtomId])[] = (() => {
  const ids = MGO_ATOMS.filter((a) => SITE_BY_ID[a.id]).map((a) => a.id)
  const out: [MgoAtomId, MgoAtomId][] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = SITE_BY_ID[ids[i]!]!
      const b = SITE_BY_ID[ids[j]!]!
      const d = [Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])]
      if (d.filter((v) => v === 2).length === 1 && d.filter((v) => v === 0).length === 2) out.push([ids[i]!, ids[j]!])
    }
  }
  return out
})()

/** Связи металла: центр многогранника — все двенадцать соседей (КЧ 12). */
export const METAL_BONDS: readonly (readonly [MgoAtomId, MgoAtomId])[] = [
  ['M0', 'mg1'],
  ['M0', 'mg2'],
  ...METAL_ATOMS.slice(1).map((m) => ['M0', m.id] as const),
]

// ─────────────────────────────────────────────────────────────────────────────
// Ключевые моменты
// ─────────────────────────────────────────────────────────────────────────────

const T_SUB = mgoCueAt('sublimate') // 5.0
const T_IGNITE = mgoCueAt('ignite') // 6.2
const T_BREAK = mgoCueAt('bondBreak') // 7.0
const T_TRANSFER = mgoCueAt('transfer') // 11.9
const T_CONTACT = mgoCueAt('contact') // 15.9
const T_LATTICE = mgoCueAt('lattice') // 21.1
const T_EXO = mgoCueAt('exo') // 22.2

/**
 * Четыре электрона: по ДВА с каждого атома магния. Первый уходит легче
 * (IE₁ = 737,7), второй — вдвое дороже (IE₂ = 1450,7), поэтому он стартует позже
 * и летит медленнее. Кислород принимает первый электрон с выигрышем (EA₁ = −141),
 * а второй — с ЗАТРАТОЙ (EA₂ = +744): на подлёте он «упирается».
 */
const E = {
  a1: { leave: 9.3, arrive: 10.9 },
  a2: { leave: 9.8, arrive: 11.6 },
  b1: { leave: 9.55, arrive: 11.15 },
  b2: { leave: 10.05, arrive: 11.85 },
} as const

/** Куда Mg и O встают после сублимации/диссоциации — перед переходом электронов. */
const FREE = {
  mg1: [-1.02, 0.7, 0.1] as const,
  mg2: [-1.02, -0.7, -0.1] as const,
  oA: [1.02, 0.7, 0.1] as const,
  oB: [1.02, -0.7, -0.1] as const,
}

const siteXYZ = (id: keyof typeof STORY_SITES): [number, number, number] => {
  const s = STORY_SITES[id]
  return [s[0] * HALF, s[1] * HALF, s[2] * HALF]
}

// ─────────────────────────────────────────────────────────────────────────────
// Дорожки положений
// ─────────────────────────────────────────────────────────────────────────────

const POS: Partial<Record<MgoAtomId, Vec3Track>> = {
  mg1: [
    { t: 0, v: MG1_START },
    { t: T_SUB - 0.9, v: MG1_START },
    { t: 6.4, v: FREE.mg1, ease: 'smooth', arc: 0.16 },
    { t: 13.5, v: FREE.mg1 },
    { t: T_CONTACT, v: siteXYZ('mg1'), ease: 'inQuad' },
  ],
  mg2: [
    { t: 0, v: MG2_START },
    { t: T_SUB - 0.3, v: MG2_START },
    { t: 6.9, v: FREE.mg2, ease: 'smooth', arc: -0.16 },
    { t: 13.5, v: FREE.mg2 },
    { t: T_CONTACT, v: siteXYZ('mg2'), ease: 'inQuad' },
  ],
  oA: [
    { t: 0, v: [1.62, OH, 0] },
    { t: 4, v: [1.62, OH, 0] },
    { t: T_BREAK, v: [1.62, OH + 0.04, 0], ease: 'inQuad' },
    { t: 8.6, v: FREE.oA, ease: 'smooth' },
    { t: 13.5, v: FREE.oA },
    { t: T_CONTACT, v: siteXYZ('oA'), ease: 'inQuad' },
  ],
  oB: [
    { t: 0, v: [1.62, -OH, 0] },
    { t: 4, v: [1.62, -OH, 0] },
    { t: T_BREAK, v: [1.62, -OH - 0.04, 0], ease: 'inQuad' },
    { t: 8.6, v: FREE.oB, ease: 'smooth' },
    { t: 13.5, v: FREE.oB },
    { t: T_CONTACT, v: siteXYZ('oB'), ease: 'inQuad' },
  ],
  // Задний/передний доборы восьмёрки: приходят из глубины, когда ионная пара уже стоит.
  mg3: [
    { t: 16.5, v: [1.0, -0.9, -1.5] },
    { t: 19.0, v: siteXYZ('mg3'), ease: 'smooth' },
  ],
  mg4: [
    { t: 16.5, v: [1.0, 0.9, -1.5] },
    { t: 19.0, v: siteXYZ('mg4'), ease: 'smooth' },
  ],
  oC: [
    { t: 16.5, v: [-1.0, -0.9, -1.5] },
    { t: 19.0, v: siteXYZ('oC'), ease: 'smooth' },
  ],
  oD: [
    { t: 16.5, v: [-1.0, 0.9, -1.5] },
    { t: 19.0, v: siteXYZ('oD'), ease: 'smooth' },
  ],
}
for (const m of METAL_ATOMS) POS[m.id] = [{ t: 0, v: m.pos }]

// ——— Рост кристалла: 56 внешних ионов подлетают к готовой восьмёрке, ближние раньше ———
const T_GROW = { from: 17.8, to: T_LATTICE - 0.1 }

const noise = (n: number, k: number): number => {
  const s = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

type LatticeMeta = { id: MgoAtomId; start: number; arrive: number; track: Vec3Track }

export const LATTICE_META: readonly LatticeMeta[] = LATTICE_IONS.map((l, i) => {
  const [x, y, z] = l.site
  return { l, i, dist: Math.hypot(x, y, z) }
})
  .sort((a, b) => a.dist - b.dist || a.i - b.i)
  .map(({ l, i }, rank, all) => {
    const arrive = T_GROW.from + (rank / Math.max(1, all.length - 1)) * (T_GROW.to - T_GROW.from)
    const start = arrive - 1.9
    const [x, y, z] = l.site
    const far = 1.6 + 0.18 * noise(i, 1)
    const track: Vec3Track = [
      {
        t: start,
        v: [x * HALF * far + 0.18 * noise(i, 2), y * HALF * far + 0.18 * noise(i, 3), z * HALF * far + 0.18 * noise(i, 4)],
      },
      { t: arrive, v: [x * HALF, y * HALF, z * HALF], ease: 'smooth' },
    ]
    return { id: l.id, start, arrive, track }
  })

const LATTICE_TRACK: Record<string, Vec3Track> = Object.fromEntries(LATTICE_META.map((m) => [m.id, m.track]))
const LATTICE_START: Record<string, number> = Object.fromEntries(LATTICE_META.map((m) => [m.id, m.start]))
for (const m of LATTICE_META) POS[m.id] = m.track

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

/**
 * РАДИУС МЕНЯЕТСЯ РОВНО ТОГДА, КОГДА ЭЛЕКТРОНЫ УХОДЯТ / ПРИХОДЯТ.
 * Магний отдаёт два электрона и теряет целый электронный слой: 160 → 72 пм
 * (меньше половины). Кислород достраивает октет: 66 → 140 пм (вдвое больше).
 */
const RADIUS_MG1 = rampTrack(E.a1.leave, R.mg, E.a2.arrive + 0.2, R.mgIon)
const RADIUS_MG2 = rampTrack(E.b1.leave, R.mg, E.b2.arrive + 0.2, R.mgIon)
const RADIUS_OA = rampTrack(E.a1.arrive - 0.4, R.o, E.a2.arrive + 0.3, R.oIon)
const RADIUS_OB = rampTrack(E.b1.arrive - 0.4, R.o, E.b2.arrive + 0.3, R.oIon)

const CHARGE_MG1 = rampTrack(E.a1.leave, 0, E.a2.arrive, 2, 'smooth')
const CHARGE_MG2 = rampTrack(E.b1.leave, 0, E.b2.arrive, 2, 'smooth')
const CHARGE_OA = rampTrack(E.a1.arrive - 0.3, 0, E.a2.arrive + 0.2, -2, 'smooth')
const CHARGE_OB = rampTrack(E.b1.arrive - 0.3, 0, E.b2.arrive + 0.2, -2, 'smooth')

/** Металл: остаётся в кадре, пока два атома не ушли, затем растворяется. */
const METAL_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.7, v: 1, ease: 'smooth' },
  { t: 7.0, v: 1 },
  { t: 8.4, v: 0, ease: 'smooth' },
]
const METAL_BOND_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.9, v: 0.5, ease: 'smooth' },
  { t: 4.2, v: 0.5 },
  { t: 6.2, v: 0.2, ease: 'smooth' },
  { t: 8.4, v: 0, ease: 'smooth' },
]

/** Восемь ионов сюжета: четыре доборных проявляются на шаге «решётка». */
const BACK_OPACITY = appearTrack(16.5, 1.3)

/** Двойная связь O=O: натяжение растёт, затем ГОМОЛИТИЧЕСКИЙ разрыв (split = 0). */
const BOND_STRESS = rampTrack(4.4, 0, T_BREAK, 1, 'inQuad')
const BOND_SPLIT = rampTrack(T_BREAK - 0.15, 0, T_BREAK + 0.35, 1, 'outCubic')
const BOND_OPACITY = rampTrack(T_BREAK, 1, T_BREAK + 0.7, 0, 'smooth')

/** Рёбра решётки: проявляются, когда восьмёрка собрана. */
const EDGES: ScalarTrack = [
  { t: 18.8, v: 0 },
  { t: T_LATTICE, v: 0.5, ease: 'smooth' },
  { t: 25.0, v: 0.5 },
  { t: MGO_FINISH.to, v: 0, ease: 'smooth' },
]

/**
 * Белое пламя горящего магния: вспыхивает на поджиге и светит весь синтез.
 * Настоящая лента магния горит при ≈ 3100 K, поэтому свет почти белый.
 */
const FLAME: ScalarTrack = [
  { t: T_IGNITE - 0.45, v: 0 },
  { t: T_IGNITE, v: 1, ease: 'outCubic' },
  { t: 8.6, v: 0.6, ease: 'smooth' },
  { t: 13.5, v: 0.36, ease: 'smooth' },
  { t: 16.5, v: 0.22, ease: 'smooth' },
  { t: T_LATTICE, v: 0.1, ease: 'smooth' },
  { t: 25.0, v: 0, ease: 'smooth' },
]

const CAM_ZOOM: ScalarTrack = [
  { t: 0, v: 0.9 },
  { t: 4, v: 0.94, ease: 'smooth' },
  { t: 8, v: 1.08, ease: 'smooth' },
  { t: 13.5, v: 1.12, ease: 'smooth' },
  { t: T_CONTACT, v: 1.46, ease: 'smooth' },
  { t: 17.2, v: 1.2, ease: 'smooth' },
  { t: T_LATTICE - 0.6, v: 0.76, ease: 'smooth' },
  { t: 25.5, v: 0.72, ease: 'smooth' },
]
const CAM_YAW: ScalarTrack = [
  { t: 16.5, v: 0 },
  { t: 21.5, v: 0.52, ease: 'smooth' },
  { t: 25.5, v: 0.66, ease: 'smooth' },
]
const CAM_ROLL: ScalarTrack = [
  { t: 16.5, v: 0 },
  { t: 21.5, v: -0.15, ease: 'smooth' },
]
const CAM_OFFSET: Vec3Track = [
  { t: 0, v: [0, 0.05, 0] },
  { t: 8, v: [0, 0.1, 0], ease: 'smooth' },
  { t: 16.5, v: [0, 0.02, 0], ease: 'smooth' },
  { t: 21.5, v: [0, 0.08, 0], ease: 'smooth' },
]
const FADE = fadeTrack(MGO_FINISH)

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Тексты подписей — формулы и числа; агрегатные состояния и единицы пишутся
 * ТОКЕНАМИ ({s}, {g}, {pm}, {kJmol}), а язык подставляет сцена один раз за кадр.
 * Все словесные пояснения живут в mgoMechanismText.{ts,en.ts,uz.ts}.
 */
export type MgoLabelDef = SceneLabelDef & { anchor: MgoAtomId | 'cube' | 'o2' | 'metal' | 'pair' }

const CELL_PM = Math.round(MGO_GEOM.data.cellPm * 10) / 10
const MGO_PM = Math.round(MGO_GEOM.data.mgOPm)

export const MGO_LABELS: readonly MgoLabelDef[] = [
  { id: 'metal', kind: 'species', anchor: 'metal', dy: 1.25, keys: [{ t: 0, text: 'Mg ({s})' }], windows: [[0.8, 6.8]] },
  { id: 'o2', kind: 'species', anchor: 'o2', dy: 0.24, keys: [{ t: 0, text: 'O₂ ({g})' }], windows: [[0.8, T_BREAK - 0.1]] },
  {
    id: 'mg1',
    kind: 'species',
    anchor: 'mg1',
    dy: 0.2,
    keys: [
      { t: 0, text: 'Mg' },
      { t: E.a2.arrive + 0.2, text: 'Mg²⁺' },
    ],
    windows: [[5.4, T_LATTICE - 0.2]],
  },
  {
    id: 'mg2',
    kind: 'species',
    anchor: 'mg2',
    dy: 0.2,
    keys: [
      { t: 0, text: 'Mg' },
      { t: E.b2.arrive + 0.2, text: 'Mg²⁺' },
    ],
    windows: [[6.0, T_LATTICE - 0.2]],
  },
  {
    id: 'oA',
    kind: 'species',
    anchor: 'oA',
    dy: 0.2,
    keys: [
      { t: 0, text: 'O' },
      { t: E.a2.arrive + 0.3, text: 'O²⁻' },
    ],
    windows: [[T_BREAK + 0.3, T_LATTICE - 0.2]],
  },
  {
    id: 'oB',
    kind: 'species',
    anchor: 'oB',
    dy: 0.2,
    keys: [
      { t: 0, text: 'O' },
      { t: E.b2.arrive + 0.3, text: 'O²⁻' },
    ],
    windows: [[T_BREAK + 0.3, T_LATTICE - 0.2]],
  },
  {
    id: 'oxMg1',
    kind: 'ox',
    anchor: 'mg1',
    dy: -0.2,
    keys: [
      { t: 0, text: '0' },
      { t: E.a2.arrive, text: '+2' },
    ],
    windows: [[6.4, 19.8]],
  },
  {
    id: 'oxMg2',
    kind: 'ox',
    anchor: 'mg2',
    dy: -0.2,
    keys: [
      { t: 0, text: '0' },
      { t: E.b2.arrive, text: '+2' },
    ],
    windows: [[6.9, 19.8]],
  },
  {
    id: 'oxOA',
    kind: 'ox',
    anchor: 'oA',
    dy: -0.2,
    keys: [
      { t: 0, text: '0' },
      { t: E.a2.arrive + 0.1, text: '−2' },
    ],
    windows: [[T_BREAK + 0.3, 19.8]],
  },
  {
    id: 'oxOB',
    kind: 'ox',
    anchor: 'oB',
    dy: -0.2,
    keys: [
      { t: 0, text: '0' },
      { t: E.b2.arrive + 0.1, text: '−2' },
    ],
    windows: [[T_BREAK + 0.3, 19.8]],
  },
  // Шаг 4: расстояние в ионной паре — то самое d(Mg²⁺–O²⁻) из справочника.
  { id: 'pair', kind: 'delta', anchor: 'pair', dy: 0.42, keys: [{ t: 0, text: `${MGO_PM} {pm}` }], windows: [[T_CONTACT - 0.1, 17.4]] },
  // Шаг 5: параметр ячейки и координационное число (dy разведены на 0.6, иначе налезают).
  { id: 'cell', kind: 'delta', anchor: 'cube', dy: 3 * HALF + 1.26, keys: [{ t: 0, text: `a = ${CELL_PM} {pm}` }], windows: [[T_LATTICE - 0.5, 25.0]] },
  { id: 'coord', kind: 'token', anchor: 'cube', dy: 3 * HALF + 0.66, keys: [{ t: 0, text: 'Mg²⁺ : 6 O²⁻ · O²⁻ : 6 Mg²⁺' }], windows: [[T_LATTICE - 0.2, 25.0]] },
  { id: 'mgo', kind: 'species', anchor: 'cube', dy: -(3 * HALF + 0.62), keys: [{ t: 0, text: 'MgO ({s})' }], windows: [[T_LATTICE - 0.5, 25.2]] },
  { id: 'ulat', kind: 'delta', anchor: 'cube', dy: -(3 * HALF + 1.2), keys: [{ t: 0, text: 'U = −3789 {kJmol}' }], windows: [[T_LATTICE - 0.2, 22.3]] },
  { id: 'dH', kind: 'delta', anchor: 'cube', dy: -(3 * HALF + 1.2), keys: [{ t: 0, text: 'ΔH°f = −601 {kJmol}' }], windows: [[22.4, 25.2]] },
]

export type MgoLabelState = SceneLabelState

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type MgoFrame = {
  atoms: Record<MgoAtomId, THREE.Vector3>
  radius: Record<MgoAtomId, number>
  /** настоящая степень окисления: 0, +2, −2 (в пул пишется нормированной) */
  charge: Record<MgoAtomId, number>
  opacity: Record<MgoAtomId, number>
  emissive: Record<MgoAtomId, number>
  /** двойная связь O=O */
  bond: { stress: number; split: number; opacity: number }
  /** прозрачность связей металлического магния */
  metalBond: number
  /** прозрачность рёбер фрагмента решётки */
  edges: number
  /** четыре электрона: по два с каждого атома магния */
  electrons: [ElectronJump, ElectronJump, ElectronJump, ElectronJump]
  /** подсветка схематичной 3s²-оболочки каждого магния, 0..1 */
  shell: { mg1: number; mg2: number }
  /** сила линий электростатического поля между ионами пары, 0..1 */
  field: number
  /** подсветка координационного окружения Mg²⁺, 0..1 */
  coord: number
  env: { flame: number; exo: number; fade: number }
  labels: MgoLabelState[]
  camera: { zoom: number; offset: THREE.Vector3; yaw: number; roll: number; shake: number; bloom: number; vignette: number }
  cubeCenter: THREE.Vector3
  metalCenter: THREE.Vector3
  o2Center: THREE.Vector3
  /** где горит пламя: сперва у магния, потом в центре собирающегося кристалла */
  flameCenter: THREE.Vector3
}

export function createMgoFrame(): MgoFrame {
  const atoms = {} as Record<MgoAtomId, THREE.Vector3>
  const radius = {} as Record<MgoAtomId, number>
  const charge = {} as Record<MgoAtomId, number>
  const opacity = {} as Record<MgoAtomId, number>
  const emissive = {} as Record<MgoAtomId, number>
  for (const a of MGO_ATOMS) {
    atoms[a.id] = new THREE.Vector3()
    radius[a.id] = a.el === 'Mg' ? R.mg : R.o
    charge[a.id] = 0
    opacity[a.id] = a.main ? 1 : 0
    emissive[a.id] = 0.08
  }
  return {
    atoms,
    radius,
    charge,
    opacity,
    emissive,
    bond: { stress: 0, split: 0, opacity: 1 },
    metalBond: 0,
    edges: 0,
    electrons: [
      createElectronJump('e1a'),
      createElectronJump('e1b'),
      createElectronJump('e2a'),
      createElectronJump('e2b'),
    ],
    shell: { mg1: 0, mg2: 0 },
    field: 0,
    coord: 0,
    env: { flame: 0, exo: 0, fade: 0 },
    labels: createLabelStates(MGO_LABELS),
    camera: {
      zoom: 1,
      offset: new THREE.Vector3(),
      yaw: 0,
      roll: 0,
      shake: 0,
      bloom: 0.3,
      vignette: 0.3,
    },
    cubeCenter: new THREE.Vector3(),
    metalCenter: new THREE.Vector3(METAL_CENTER[0], METAL_CENTER[1], METAL_CENTER[2]),
    o2Center: new THREE.Vector3(),
    flameCenter: new THREE.Vector3(),
  }
}

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleMgoFrame(t: number, frame: MgoFrame): MgoFrame {
  const { atoms, radius, charge, opacity, emissive } = frame

  for (const a of MGO_ATOMS) {
    const track = POS[a.id] ?? LATTICE_TRACK[a.id]
    if (track) sampleVec3(track, t, atoms[a.id])
  }

  radius.mg1 = sampleScalar(RADIUS_MG1, t)
  radius.mg2 = sampleScalar(RADIUS_MG2, t)
  radius.oA = sampleScalar(RADIUS_OA, t)
  radius.oB = sampleScalar(RADIUS_OB, t)
  radius.mg3 = radius.mg4 = R.mgIon
  radius.oC = radius.oD = R.oIon

  charge.mg1 = sampleScalar(CHARGE_MG1, t)
  charge.mg2 = sampleScalar(CHARGE_MG2, t)
  charge.oA = sampleScalar(CHARGE_OA, t)
  charge.oB = sampleScalar(CHARGE_OB, t)
  charge.mg3 = charge.mg4 = 2
  charge.oC = charge.oD = -2

  const back = sampleScalar(BACK_OPACITY, t)
  opacity.mg1 = opacity.mg2 = opacity.oA = opacity.oB = 1
  opacity.mg3 = opacity.mg4 = opacity.oC = opacity.oD = back

  const metalA = sampleScalar(METAL_OPACITY, t)
  frame.metalBond = sampleScalar(METAL_BOND_OPACITY, t)
  for (const m of METAL_ATOMS) {
    radius[m.id] = R.mg
    charge[m.id] = 0
    opacity[m.id] = metalA
  }

  // Внешние ионы решётки: уже готовые Mg²⁺ / O²⁻, проявляются на подлёте.
  for (const l of LATTICE_IONS) {
    radius[l.id] = l.el === 'Mg' ? R.mgIon : R.oIon
    charge[l.id] = l.el === 'Mg' ? 2 : -2
    const s = LATTICE_START[l.id]!
    opacity[l.id] = smoothstep(s, s + 0.55, t)
  }

  // ——— Схематичная оболочка 3s²: разгорается перед отдачей электронов ———
  frame.shell.mg1 = windowFade([E.a1.leave - 1.4, E.a2.leave + 0.3], t, 0.45)
  frame.shell.mg2 = windowFade([E.b1.leave - 1.4, E.b2.leave + 0.3], t, 0.45)

  // ——— Электроны: 3s² магния достраивают октет кислорода ———
  sampleElectronJump(frame.electrons[0], t, {
    donor: atoms.mg1,
    acceptor: atoms.oA,
    shellRadius: SHELL_MG,
    acceptorRadius: radius.oA,
    leave: E.a1.leave,
    arrive: E.a1.arrive,
    arcSign: 1,
  })
  // Второй электрон летит по более высокой дуге: O⁻ уже заряжен отрицательно
  // и отталкивает его — это и есть эндотермическая EA₂ = +744 кДж/моль.
  sampleElectronJump(frame.electrons[1], t, {
    donor: atoms.mg1,
    acceptor: atoms.oA,
    shellRadius: SHELL_MG,
    acceptorRadius: radius.oA,
    leave: E.a2.leave,
    arrive: E.a2.arrive,
    arcSign: -1,
    arcHeight: 0.4,
  })
  sampleElectronJump(frame.electrons[2], t, {
    donor: atoms.mg2,
    acceptor: atoms.oB,
    shellRadius: SHELL_MG,
    acceptorRadius: radius.oB,
    leave: E.b1.leave,
    arrive: E.b1.arrive,
    arcSign: -1,
  })
  sampleElectronJump(frame.electrons[3], t, {
    donor: atoms.mg2,
    acceptor: atoms.oB,
    shellRadius: SHELL_MG,
    acceptorRadius: radius.oB,
    leave: E.b2.leave,
    arrive: E.b2.arrive,
    arcSign: 1,
    arcHeight: 0.4,
  })

  // ——— Связь O=O и рёбра решётки ———
  frame.bond.stress = sampleScalar(BOND_STRESS, t)
  frame.bond.split = sampleScalar(BOND_SPLIT, t)
  frame.bond.opacity = sampleScalar(BOND_OPACITY, t)
  frame.edges = sampleScalar(EDGES, t)

  // ——— Шаг 4: электростатическое притяжение (закон Кулона, заряды ±2) ———
  frame.field = windowFade([13.7, T_CONTACT + 0.4], t, 0.5)

  // ——— Шаг 5: координационное число 6 ———
  frame.coord = windowFade([T_LATTICE - 0.2, 25.0], t, 0.4) * (0.7 + 0.3 * Math.sin(t * 5.5))

  // ——— Энергия: белое пламя с поджига, пик выделения на cue exo ———
  const flame = sampleScalar(FLAME, t)
  const exo = smoothstep(T_EXO - 0.7, T_EXO, t) * (1 - 0.55 * smoothstep(T_EXO, T_EXO + 1.6, t))
  frame.env.flame = flame
  frame.env.exo = exo
  frame.env.fade = sampleScalar(FADE, t)

  for (const a of MGO_ATOMS) {
    let e = (a.el === 'Mg' ? 0.1 : 0.08) + flame * 0.3 + exo * 0.4
    if (a.id === 'mg1') e += frame.shell.mg1 * 0.3 + frame.coord * 0.5
    if (a.id === 'mg2') e += frame.shell.mg2 * 0.3
    if (frame.coord > 0 && MGO_COORDINATION_IDS.includes(a.id)) e += frame.coord * 0.4
    emissive[a.id] = e
  }

  // ——— Центры кадра ———
  frame.cubeCenter.copy(atoms.mg1).add(atoms.oA).add(atoms.mg2).add(atoms.oB).multiplyScalar(0.25)
  if (back > 0) frame.cubeCenter.multiplyScalar(mix(1, 0, back))
  frame.o2Center.copy(atoms.oA).lerp(atoms.oB, 0.5)
  // Пламя горит там, где горит магний: на поджиге — у ленты, потом — в кристалле.
  frame.flameCenter.copy(atoms.mg1).lerp(atoms.mg2, 0.5).lerp(frame.cubeCenter, smoothstep(12.5, 17.0, t))

  // ——— Подписи ———
  sampleLabels(
    MGO_LABELS,
    frame.labels,
    t,
    (def, st) => {
      const d = def as MgoLabelDef
      if (d.anchor === 'cube') {
        st.pos.copy(frame.cubeCenter)
        st.pos.y += d.dy
      } else if (d.anchor === 'metal') {
        st.pos.copy(frame.metalCenter)
        st.pos.y += d.dy
      } else if (d.anchor === 'o2') {
        st.pos.copy(frame.o2Center)
        st.pos.x += radius.oA + 0.26
        st.pos.y += d.dy - 0.2
      } else if (d.anchor === 'pair') {
        st.pos.copy(atoms.mg1).lerp(atoms.oA, 0.5)
        st.pos.y += d.dy
      } else {
        st.pos.copy(atoms[d.anchor])
        st.pos.y += d.dy > 0 ? radius[d.anchor] + d.dy : -(radius[d.anchor] - d.dy)
      }
    },
    frame.env.fade,
  )

  // ——— Камера ———
  const cam = frame.camera
  cam.zoom = sampleScalar(CAM_ZOOM, t)
  sampleVec3(CAM_OFFSET, t, cam.offset)
  cam.yaw = sampleScalar(CAM_YAW, t)
  cam.roll = sampleScalar(CAM_ROLL, t)
  cam.shake =
    0.55 * Math.max(0, 1 - Math.abs(t - T_IGNITE) / 0.45) +
    0.25 * Math.max(0, 1 - Math.abs(t - T_BREAK) / 0.35) +
    0.5 * Math.max(0, 1 - Math.abs(t - T_EXO) / 0.5)
  cam.bloom = 0.3 + 0.7 * flame + 0.75 * exo
  cam.vignette = 0.3 + 0.15 * exo
  return frame
}

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validateMgoStoryboard(): void {
  const vec: Record<string, Vec3Track> = {}
  for (const [id, track] of Object.entries(POS)) if (track) vec[`pos.${id}`] = track
  vec['cam.offset'] = CAM_OFFSET
  validateTracks(vec)
  validateTracks({
    RADIUS_MG1,
    RADIUS_MG2,
    RADIUS_OA,
    RADIUS_OB,
    CHARGE_MG1,
    CHARGE_MG2,
    CHARGE_OA,
    CHARGE_OB,
    METAL_OPACITY,
    METAL_BOND_OPACITY,
    BACK_OPACITY,
    BOND_STRESS,
    BOND_SPLIT,
    BOND_OPACITY,
    EDGES,
    FLAME,
    CAM_ZOOM,
    CAM_YAW,
    CAM_ROLL,
    FADE,
  })

  if (MGO_ATOMS.length !== 75) throw new Error(`mgo: ожидалось 64 иона + 11 атомов металла, получилось ${MGO_ATOMS.length}`)
  if (LATTICE_IONS.length !== 56) throw new Error(`mgo: во фрагменте 4×4×4 вне восьмёрки должно быть 56 ионов, получилось ${LATTICE_IONS.length}`)
  if (MGO_EDGES.length !== 144) throw new Error(`mgo: ожидалось 144 ребра, получилось ${MGO_EDGES.length}`)
  if (MGO_COORDINATION_IDS.length !== 6) throw new Error(`mgo: КЧ(Mg²⁺) обязано быть 6, получилось ${MGO_COORDINATION_IDS.length}`)
  if (METAL_BONDS.length !== 12) throw new Error(`mgo: КЧ магния в ГПУ обязано быть 12, получилось ${METAL_BONDS.length}`)

  // Чередование зарядов: у каждого узла все ближайшие соседи — противоположного знака.
  const elById = new Map(MGO_ATOMS.map((a) => [a.id, a.el]))
  for (const [a, b] of MGO_EDGES) {
    if (elById.get(a) === elById.get(b)) throw new Error(`mgo: соседи ${a} и ${b} одноимённые — решётка построена неверно`)
  }

  // Физика размера: катион меньше атома, анион больше; O²⁻ ≈ 1,94 · Mg²⁺.
  if (!(R.mgIon < R.mg)) throw new Error('mgo: Mg²⁺ обязан быть меньше атома Mg')
  if (!(R.oIon > R.o)) throw new Error('mgo: O²⁻ обязан быть больше атома O')
  const ratio = R.oIon / R.mgIon
  if (ratio < 1.88 || ratio > 2.0) throw new Error(`mgo: O²⁻ / Mg²⁺ = ${ratio.toFixed(2)}, ожидалось ≈ 1,94`)

  // Металлический фрагмент: все 12 соседей на одном расстоянии (ГПУ, c/a = 1,624).
  const c0 = new THREE.Vector3(...METAL_SITES[0]!)
  const neighbours = [MG1_START, MG2_START, ...METAL_SITES.slice(1)]
  for (const n of neighbours) {
    const d = c0.distanceTo(new THREE.Vector3(...n))
    if (Math.abs(d - pmToScene(METAL.cationAnionPm)) > pmToScene(6)) {
      throw new Error(`mgo: сосед магния на ${d.toFixed(3)} ед., ожидалось ${pmToScene(METAL.cationAnionPm).toFixed(3)}`)
    }
  }

  // Событие «перенос завершён» не может наступить раньше прихода последнего электрона.
  const lastArrive = Math.max(E.a1.arrive, E.a2.arrive, E.b1.arrive, E.b2.arrive)
  if (T_TRANSFER < lastArrive) {
    throw new Error(`mgo: cue transfer (${T_TRANSFER}) раньше прихода последнего электрона (${lastArrive})`)
  }

  if (MGO_END <= 0) throw new Error('mgo: пустой сюжет')
}
