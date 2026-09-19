import * as THREE from 'three'
import { bondLengthPm, getCrystal } from '../../../../chemistry/data'
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
import { NACL_FINISH, NACL_END, naclCueAt } from './naclSteps'

export {
  NACL_CUES,
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
 * Раскадровка 2 Na (тв.) + Cl₂ (г.) → 2 NaCl (тв.) — ЧИСТАЯ функция времени сюжета.
 *
 * Вся химия — из src/chemistry/data (ни одного числа руками):
 *   • Na металлический: ОЦК, Im-3m (229), a = 429,06 пм, КЧ 8, d = 371,6 пм;
 *   • Cl₂: длина связи 198,8 пм (D = 243,4 кДж/моль);
 *   • NaCl: каменная соль, Fm-3m (225), две ГЦК-подрешётки, a = 564,02 пм,
 *     d(Na⁺–Cl⁻) = 282,01 пм, КЧ 6/6, Z = 4, ρ = 2,165 г/см³;
 *   • радиусы: Na⁰ 186 пм (металлический) → Na⁺ 102 пм; Cl⁰ 99 пм (ковалентный,
 *     в молекуле Cl₂) → Cl⁻ 181 пм. На экране Cl⁻ ровно в 1,78 раза крупнее Na⁺.
 *
 * ЧТО НАРИСОВАНО СХЕМАТИЧНО (и так сказано в тексте урока):
 *   • светящаяся оболочка вокруг натрия — знак «здесь внешний электрон 3s¹»,
 *     а не форма орбитали;
 *   • «прыжок» электрона по дуге: электрон не летит по траектории, переход
 *     происходит мгновенно в квантовом смысле;
 *   • показаны 64 иона фрагмента 4×4×4, в кристалле соли их порядка 10²³.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

const SALT = getCrystal('nacl')!
const METAL = getCrystal('na_metal')!

/** Половина расстояния Na⁺–Cl⁻ = a/4: узлы решётки стоят в НЕЧЁТНЫХ кратных этой величины. */
const HALF = pmToScene(SALT.cationAnionPm) / 2
/** Ребро ячейки NaCl, мировые единицы (= 4·HALF). */
const CELL = pmToScene(SALT.cellPm.a)
/** Половина ребра ОЦК-ячейки натрия. */
const MH = pmToScene(METAL.cellPm.a) / 2
/** Половина длины связи Cl–Cl. */
const CH = bondLength('Cl-Cl') / 2

const R = {
  na: speciesRadius('Na', 0),
  naIon: speciesRadius('Na', 1),
  cl: speciesRadius('Cl', 0),
  clIon: speciesRadius('Cl', -1),
} as const

/** Радиус светящейся оболочки вокруг атома натрия (схематичная 3s¹). */
const SHELL_NA = R.na * 1.35

export const NACL_GEOM = {
  radius: R,
  half: HALF,
  cell: CELL,
  clHalf: CH,
  metalHalf: MH,
  shellNa: SHELL_NA,
  /** расстояние Na⁺–Cl⁻ в решётке, мировые единицы */
  latticeNaCl: HALF * 2,
  /** справочные числа для подписей и тестов */
  data: {
    spaceGroup: SALT.spaceGroup,
    spaceGroupNo: SALT.spaceGroupNo,
    latticeType: SALT.latticeType,
    cellPm: SALT.cellPm.a,
    naClPm: SALT.cationAnionPm,
    /** длина связи Cl–Cl, пм */
    clClPm: bondLengthPm('Cl-Cl'),
    coordination: SALT.coordination,
    z: SALT.z,
    densityGCm3: SALT.densityGCm3,
    metal: { spaceGroup: METAL.spaceGroup, cellPm: METAL.cellPm.a, coordination: METAL.coordination },
  },
} as const

/** Масштаб рига камеры: в кадре мало частиц, детали важны. */
export const NACL_RIG_SCALE = 1.15

// ─────────────────────────────────────────────────────────────────────────────
// Узлы решётки и металлический фрагмент
// ─────────────────────────────────────────────────────────────────────────────

export type NaclElement = 'Na' | 'Cl'
export type NaclAtomId =
  | 'na1'
  | 'na2'
  | 'clA'
  | 'clB'
  | 'na3'
  | 'na4'
  | 'clC'
  | 'clD'
  | `L${number}`
  | `M${number}`

type Site = readonly [number, number, number]

/**
 * Узлы каменной соли: все координаты НЕЧЁТНЫЕ (в единицах a/4), соседи отличаются
 * на 2 по одной оси — это ровно d(Na⁺–Cl⁻) = a/2. Знак заряда чередуется по сумме
 * координат, поэтому одноимённые ионы физически не могут оказаться соседями.
 */
const elementAtSite = (s: Site): NaclElement => ((((s[0] + s[1] + s[2]) % 4) + 4) % 4 === 1 ? 'Na' : 'Cl')

/**
 * Восемь центральных узлов — ионы сюжета. Пара na1/clA собирается спереди-сверху,
 * пара na2/clB — сзади-снизу: натрий приходит СЛЕВА (из металла), хлор СПРАВА
 * (из молекулы), поэтому их пути не пересекаются.
 */
const STORY_SITES: Record<'na1' | 'na2' | 'clA' | 'clB' | 'na3' | 'na4' | 'clC' | 'clD', Site> = {
  na1: [-1, 1, 1],
  clA: [1, 1, 1],
  na2: [-1, -1, -1],
  clB: [1, -1, -1],
  na3: [1, -1, 1],
  clC: [-1, -1, 1],
  na4: [1, 1, -1],
  clD: [-1, 1, -1],
}

const LATTICE_IONS: { id: NaclAtomId; el: NaclElement; site: Site }[] = []
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
 * Фрагмент металлического натрия: ОЦК-ячейка (8 вершин + центр).
 * Два атома из неё — na1 (вершина слева-сверху-спереди) и na2 (вершина
 * справа-снизу-спереди) — уходят в реакцию; остальные семь остаются металлом.
 */
const METAL_CENTER: Site = [-1.75, 0, -0.1]
const metalPos = (dx: number, dy: number, dz: number): [number, number, number] => [
  METAL_CENTER[0] + dx,
  METAL_CENTER[1] + dy,
  METAL_CENTER[2] + dz,
]

const NA1_START = metalPos(-MH, MH, MH)
const NA2_START = metalPos(MH, -MH, MH)

/** Семь оставшихся узлов ОЦК-ячейки: центр + шесть вершин. */
const METAL_SITES: Array<[number, number, number]> = [
  metalPos(0, 0, 0),
  metalPos(MH, MH, MH),
  metalPos(-MH, -MH, MH),
  metalPos(MH, MH, -MH),
  metalPos(-MH, MH, -MH),
  metalPos(MH, -MH, -MH),
  metalPos(-MH, -MH, -MH),
]

export const METAL_ATOMS: readonly { id: NaclAtomId; pos: readonly [number, number, number] }[] = METAL_SITES.map(
  (pos, i) => ({ id: `M${i}` as NaclAtomId, pos }),
)

export const NACL_ATOMS: readonly { id: NaclAtomId; el: NaclElement; main: boolean }[] = [
  { id: 'na1', el: 'Na', main: true },
  { id: 'na2', el: 'Na', main: true },
  { id: 'clA', el: 'Cl', main: true },
  { id: 'clB', el: 'Cl', main: true },
  { id: 'na3', el: 'Na', main: false },
  { id: 'na4', el: 'Na', main: false },
  { id: 'clC', el: 'Cl', main: false },
  { id: 'clD', el: 'Cl', main: false },
  ...LATTICE_IONS.map((l) => ({ id: l.id, el: l.el, main: false })),
  ...METAL_ATOMS.map((m) => ({ id: m.id, el: 'Na' as NaclElement, main: false })),
]

/** Шесть ближайших соседей Cl⁻ у иона na1 — подсветка координационного числа 6. */
export const NACL_COORDINATION_IDS: readonly NaclAtomId[] = NACL_ATOMS.filter((a) => {
  const s = SITE_BY_ID[a.id]
  if (!s) return false
  const c = STORY_SITES.na1
  const d = [Math.abs(s[0] - c[0]), Math.abs(s[1] - c[1]), Math.abs(s[2] - c[2])]
  return d.filter((v) => v === 2).length === 1 && d.filter((v) => v === 0).length === 2
}).map((a) => a.id)

/** Рёбра фрагмента: пары ближайших соседей Na⁺–Cl⁻ (144 ребра во фрагменте 4×4×4). */
export const NACL_EDGES: readonly (readonly [NaclAtomId, NaclAtomId])[] = (() => {
  const ids = NACL_ATOMS.filter((a) => SITE_BY_ID[a.id]).map((a) => a.id)
  const out: [NaclAtomId, NaclAtomId][] = []
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

/** Связи металла: центр ОЦК-ячейки — восемь вершин (КЧ 8, d = 371,6 пм). */
export const METAL_BONDS: readonly (readonly [NaclAtomId, NaclAtomId])[] = [
  ['M0', 'na1'],
  ['M0', 'na2'],
  ['M0', 'M1'],
  ['M0', 'M2'],
  ['M0', 'M3'],
  ['M0', 'M4'],
  ['M0', 'M5'],
  ['M0', 'M6'],
]

// ─────────────────────────────────────────────────────────────────────────────
// Ключевые моменты
// ─────────────────────────────────────────────────────────────────────────────

const T_SUB = naclCueAt('sublimate') // 5.2
const T_BREAK = naclCueAt('bondBreak') // 7.0
const T_TRANSFER = naclCueAt('transfer') // 11.0
const T_CONTACT = naclCueAt('contact') // 15.4
const T_LATTICE = naclCueAt('lattice') // 20.6
const T_EXO = naclCueAt('exo') // 21.8

const T_E1 = { leave: 9.4, arrive: T_TRANSFER }
const T_E2 = { leave: 9.75, arrive: T_TRANSFER + 0.35 }

/** Куда Na и Cl встают после сублимации/диссоциации — перед переходом электрона. */
const FREE = {
  na1: [-1.05, 0.72, 0.1] as const,
  na2: [-1.05, -0.72, -0.1] as const,
  clA: [1.15, 0.72, 0.1] as const,
  clB: [1.15, -0.72, -0.1] as const,
}

const siteXYZ = (id: keyof typeof STORY_SITES): [number, number, number] => {
  const s = STORY_SITES[id]
  return [s[0] * HALF, s[1] * HALF, s[2] * HALF]
}

// ─────────────────────────────────────────────────────────────────────────────
// Дорожки положений
// ─────────────────────────────────────────────────────────────────────────────

const POS: Partial<Record<NaclAtomId, Vec3Track>> = {
  na1: [
    { t: 0, v: NA1_START },
    { t: T_SUB - 0.9, v: NA1_START },
    { t: 6.2, v: FREE.na1, ease: 'smooth', arc: 0.18 },
    { t: 13, v: FREE.na1 },
    { t: T_CONTACT, v: siteXYZ('na1'), ease: 'inQuad' },
  ],
  na2: [
    { t: 0, v: NA2_START },
    { t: T_SUB - 0.3, v: NA2_START },
    { t: 6.8, v: FREE.na2, ease: 'smooth', arc: -0.18 },
    { t: 13, v: FREE.na2 },
    { t: T_CONTACT, v: siteXYZ('na2'), ease: 'inQuad' },
  ],
  clA: [
    { t: 0, v: [1.75, CH, 0] },
    { t: 4, v: [1.75, CH, 0] },
    { t: T_BREAK, v: [1.75, CH + 0.05, 0], ease: 'inQuad' },
    { t: 8.4, v: FREE.clA, ease: 'smooth' },
    { t: 13, v: FREE.clA },
    { t: T_CONTACT, v: siteXYZ('clA'), ease: 'inQuad' },
  ],
  clB: [
    { t: 0, v: [1.75, -CH, 0] },
    { t: 4, v: [1.75, -CH, 0] },
    { t: T_BREAK, v: [1.75, -CH - 0.05, 0], ease: 'inQuad' },
    { t: 8.4, v: FREE.clB, ease: 'smooth' },
    { t: 13, v: FREE.clB },
    { t: T_CONTACT, v: siteXYZ('clB'), ease: 'inQuad' },
  ],
  // Задний/передний доборы восьмёрки: приходят из глубины, когда ионная пара уже стоит.
  na3: [
    { t: 16, v: [1.15, -1.0, -1.7] },
    { t: 18.6, v: siteXYZ('na3'), ease: 'smooth' },
  ],
  na4: [
    { t: 16, v: [1.15, 1.0, -1.7] },
    { t: 18.6, v: siteXYZ('na4'), ease: 'smooth' },
  ],
  clC: [
    { t: 16, v: [-1.15, -1.0, -1.7] },
    { t: 18.6, v: siteXYZ('clC'), ease: 'smooth' },
  ],
  clD: [
    { t: 16, v: [-1.15, 1.0, -1.7] },
    { t: 18.6, v: siteXYZ('clD'), ease: 'smooth' },
  ],
}
for (const m of METAL_ATOMS) POS[m.id] = [{ t: 0, v: m.pos }]

// ——— Рост кристалла: 56 внешних ионов подлетают к готовой восьмёрке, ближние раньше ———
const T_GROW = { from: 17.4, to: T_LATTICE - 0.1 }

const noise = (n: number, k: number): number => {
  const s = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

type LatticeMeta = { id: NaclAtomId; start: number; arrive: number; track: Vec3Track }

export const LATTICE_META: readonly LatticeMeta[] = LATTICE_IONS.map((l, i) => {
  const [x, y, z] = l.site
  return { l, i, dist: Math.hypot(x, y, z) }
})
  .sort((a, b) => a.dist - b.dist || a.i - b.i)
  .map(({ l, i }, rank, all) => {
    const arrive = T_GROW.from + (rank / Math.max(1, all.length - 1)) * (T_GROW.to - T_GROW.from)
    const start = arrive - 1.9
    const [x, y, z] = l.site
    const far = 1.55 + 0.18 * noise(i, 1)
    const track: Vec3Track = [
      {
        t: start,
        v: [x * HALF * far + 0.2 * noise(i, 2), y * HALF * far + 0.2 * noise(i, 3), z * HALF * far + 0.2 * noise(i, 4)],
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

/** РАДИУС МЕНЯЕТСЯ РОВНО ТОГДА, КОГДА ЭЛЕКТРОН УХОДИТ / ПРИХОДИТ. */
const RADIUS_NA1 = rampTrack(T_E1.leave, R.na, T_E1.arrive + 0.2, R.naIon)
const RADIUS_NA2 = rampTrack(T_E2.leave, R.na, T_E2.arrive + 0.2, R.naIon)
const RADIUS_CLA = rampTrack(T_E1.arrive - 0.6, R.cl, T_E1.arrive + 0.7, R.clIon)
const RADIUS_CLB = rampTrack(T_E2.arrive - 0.6, R.cl, T_E2.arrive + 0.7, R.clIon)

const CHARGE_NA1 = rampTrack(T_E1.leave, 0, T_E1.arrive, 1, 'smooth')
const CHARGE_NA2 = rampTrack(T_E2.leave, 0, T_E2.arrive, 1, 'smooth')
const CHARGE_CLA = rampTrack(T_E1.arrive - 0.35, 0, T_E1.arrive + 0.3, -1, 'smooth')
const CHARGE_CLB = rampTrack(T_E2.arrive - 0.35, 0, T_E2.arrive + 0.3, -1, 'smooth')

/** Металл: остаётся в кадре, пока два атома не ушли, затем растворяется. */
const METAL_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.7, v: 1, ease: 'smooth' },
  { t: 6.8, v: 1 },
  { t: 8.2, v: 0, ease: 'smooth' },
]
const METAL_BOND_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.9, v: 0.55, ease: 'smooth' },
  { t: 4.2, v: 0.55 },
  { t: 6.0, v: 0.2, ease: 'smooth' },
  { t: 8.2, v: 0, ease: 'smooth' },
]

/** Восемь ионов сюжета: четыре доборных проявляются на шаге «решётка». */
const BACK_OPACITY = appearTrack(16, 1.3)

/** Связь Cl–Cl: натяжение растёт, затем ГОМОЛИТИЧЕСКИЙ разрыв (split = 0). */
const BOND_STRESS = rampTrack(4.4, 0, T_BREAK, 1, 'inQuad')
const BOND_SPLIT = rampTrack(T_BREAK - 0.15, 0, T_BREAK + 0.35, 1, 'outCubic')
const BOND_OPACITY = rampTrack(T_BREAK, 1, T_BREAK + 0.7, 0, 'smooth')

/** Рёбра решётки: проявляются, когда восьмёрка собрана. */
const EDGES: ScalarTrack = [
  { t: 18.4, v: 0 },
  { t: T_LATTICE, v: 0.5, ease: 'smooth' },
  { t: 24.4, v: 0.5 },
  { t: NACL_FINISH.to, v: 0, ease: 'smooth' },
]

const CAM_ZOOM: ScalarTrack = [
  { t: 0, v: 0.86 },
  { t: 4, v: 0.9, ease: 'smooth' },
  { t: 8, v: 1.04, ease: 'smooth' },
  { t: 13, v: 1.04 },
  { t: T_CONTACT, v: 1.16, ease: 'smooth' },
  { t: 16.6, v: 0.98, ease: 'smooth' },
  { t: T_LATTICE - 0.6, v: 0.5, ease: 'smooth' },
  { t: 25, v: 0.47, ease: 'smooth' },
]
const CAM_YAW: ScalarTrack = [
  { t: 16, v: 0 },
  { t: 21, v: 0.52, ease: 'smooth' },
  { t: 25, v: 0.66, ease: 'smooth' },
]
const CAM_ROLL: ScalarTrack = [
  { t: 16, v: 0 },
  { t: 21, v: -0.16, ease: 'smooth' },
]
const CAM_OFFSET: Vec3Track = [
  { t: 0, v: [0, 0.05, 0] },
  { t: 8, v: [0, 0.1, 0], ease: 'smooth' },
  { t: 16, v: [0, 0.02, 0], ease: 'smooth' },
  { t: 21, v: [0, 0.08, 0], ease: 'smooth' },
]
const FADE = fadeTrack(NACL_FINISH)

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Тексты подписей НЕ переводятся: это формулы и обозначения СИ, одинаковые
 * в ru/en/uz («Na⁺», «282 pm», «ΔH°f = −411 kJ/mol»). Все словесные пояснения
 * живут в naclMechanismText.{ts,en.ts,uz.ts} и показываются панелью урока.
 */
export type NaclLabelDef = SceneLabelDef & { anchor: NaclAtomId | 'cube' | 'cl2' | 'metal' | 'pair' }

const CELL_PM = Math.round(NACL_GEOM.data.cellPm * 10) / 10
const NACL_PM = Math.round(NACL_GEOM.data.naClPm)

export const NACL_LABELS: readonly NaclLabelDef[] = [
  { id: 'metal', kind: 'species', anchor: 'metal', dy: 0.95, keys: [{ t: 0, text: 'Na ({s})' }], windows: [[0.8, 6.6]] },
  { id: 'cl2', kind: 'species', anchor: 'cl2', dy: 0.24, keys: [{ t: 0, text: 'Cl₂ ({g})' }], windows: [[0.8, T_BREAK - 0.1]] },
  {
    id: 'na1',
    kind: 'species',
    anchor: 'na1',
    dy: 0.2,
    keys: [
      { t: 0, text: 'Na' },
      { t: T_E1.arrive + 0.2, text: 'Na⁺' },
    ],
    windows: [[5.4, T_LATTICE - 0.2]],
  },
  {
    id: 'na2',
    kind: 'species',
    anchor: 'na2',
    dy: 0.2,
    keys: [
      { t: 0, text: 'Na' },
      { t: T_E2.arrive + 0.2, text: 'Na⁺' },
    ],
    windows: [[6.0, T_LATTICE - 0.2]],
  },
  {
    id: 'clA',
    kind: 'species',
    anchor: 'clA',
    dy: 0.2,
    keys: [
      { t: 0, text: 'Cl' },
      { t: T_E1.arrive + 0.3, text: 'Cl⁻' },
    ],
    windows: [[T_BREAK + 0.3, T_LATTICE - 0.2]],
  },
  {
    id: 'clB',
    kind: 'species',
    anchor: 'clB',
    dy: 0.2,
    keys: [
      { t: 0, text: 'Cl' },
      { t: T_E2.arrive + 0.3, text: 'Cl⁻' },
    ],
    windows: [[T_BREAK + 0.3, T_LATTICE - 0.2]],
  },
  {
    id: 'oxNa1',
    kind: 'ox',
    anchor: 'na1',
    dy: -0.2,
    keys: [
      { t: 0, text: '0' },
      { t: T_E1.arrive, text: '+1' },
    ],
    windows: [[6.2, 19.4]],
  },
  {
    id: 'oxNa2',
    kind: 'ox',
    anchor: 'na2',
    dy: -0.2,
    keys: [
      { t: 0, text: '0' },
      { t: T_E2.arrive, text: '+1' },
    ],
    windows: [[6.8, 19.4]],
  },
  {
    id: 'oxClA',
    kind: 'ox',
    anchor: 'clA',
    dy: -0.2,
    keys: [
      { t: 0, text: '0' },
      { t: T_E1.arrive + 0.1, text: '−1' },
    ],
    windows: [[T_BREAK + 0.3, 19.4]],
  },
  {
    id: 'oxClB',
    kind: 'ox',
    anchor: 'clB',
    dy: -0.2,
    keys: [
      { t: 0, text: '0' },
      { t: T_E2.arrive + 0.1, text: '−1' },
    ],
    windows: [[T_BREAK + 0.3, 19.4]],
  },
  // Шаг 4: расстояние в ионной паре — то самое d(Na⁺–Cl⁻) из справочника.
  { id: 'pair', kind: 'delta', anchor: 'pair', dy: 0.46, keys: [{ t: 0, text: `${NACL_PM} {pm}` }], windows: [[T_CONTACT - 0.1, 16.9]] },
  // Шаг 5: параметр ячейки и координационное число.
  // dy разведены на 0.62, иначе «a = …» и КЧ налезают друг на друга над кубом.
  { id: 'cell', kind: 'delta', anchor: 'cube', dy: 3 * HALF + 1.17, keys: [{ t: 0, text: `a = ${CELL_PM} {pm}` }], windows: [[T_LATTICE - 0.2, 24.4]] },
  { id: 'coord', kind: 'token', anchor: 'cube', dy: 3 * HALF + 0.55, keys: [{ t: 0, text: 'Na⁺ : 6 Cl⁻ · Cl⁻ : 6 Na⁺' }], windows: [[22.2, 24.4]] },
  { id: 'nacl', kind: 'species', anchor: 'cube', dy: -(3 * HALF + 0.6), keys: [{ t: 0, text: 'NaCl ({s})' }], windows: [[T_LATTICE - 0.1, 24.6]] },
  { id: 'dH', kind: 'delta', anchor: 'cube', dy: -(3 * HALF + 1.05), keys: [{ t: 0, text: 'ΔH°f = −411 {kJmol}' }], windows: [[T_EXO, 24.6]] },
]

export type NaclLabelState = SceneLabelState

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type NaclFrame = {
  atoms: Record<NaclAtomId, THREE.Vector3>
  radius: Record<NaclAtomId, number>
  charge: Record<NaclAtomId, number>
  opacity: Record<NaclAtomId, number>
  emissive: Record<NaclAtomId, number>
  /** связь Cl–Cl */
  bond: { stress: number; split: number; opacity: number }
  /** прозрачность связей металлического натрия */
  metalBond: number
  /** прозрачность рёбер фрагмента решётки */
  edges: number
  electrons: [ElectronJump, ElectronJump]
  /** подсветка схематичной 3s-оболочки каждого натрия, 0..1 */
  shell: { na1: number; na2: number }
  /** сила линий электростатического поля между ионами пары, 0..1 */
  field: number
  /** подсветка координационного окружения Na⁺, 0..1 */
  coord: number
  env: { exo: number; fade: number }
  labels: NaclLabelState[]
  camera: { zoom: number; offset: THREE.Vector3; yaw: number; roll: number; shake: number; bloom: number; vignette: number }
  cubeCenter: THREE.Vector3
  metalCenter: THREE.Vector3
}

export function createNaclFrame(): NaclFrame {
  const atoms = {} as Record<NaclAtomId, THREE.Vector3>
  const radius = {} as Record<NaclAtomId, number>
  const charge = {} as Record<NaclAtomId, number>
  const opacity = {} as Record<NaclAtomId, number>
  const emissive = {} as Record<NaclAtomId, number>
  for (const a of NACL_ATOMS) {
    atoms[a.id] = new THREE.Vector3()
    radius[a.id] = a.el === 'Na' ? R.na : R.cl
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
    electrons: [createElectronJump('e1'), createElectronJump('e2')],
    shell: { na1: 0, na2: 0 },
    field: 0,
    coord: 0,
    env: { exo: 0, fade: 0 },
    labels: createLabelStates(NACL_LABELS),
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
  }
}

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleNaclFrame(t: number, frame: NaclFrame): NaclFrame {
  const { atoms, radius, charge, opacity, emissive } = frame

  for (const a of NACL_ATOMS) {
    const track = POS[a.id] ?? LATTICE_TRACK[a.id]
    if (track) sampleVec3(track, t, atoms[a.id])
  }

  radius.na1 = sampleScalar(RADIUS_NA1, t)
  radius.na2 = sampleScalar(RADIUS_NA2, t)
  radius.clA = sampleScalar(RADIUS_CLA, t)
  radius.clB = sampleScalar(RADIUS_CLB, t)
  radius.na3 = radius.na4 = R.naIon
  radius.clC = radius.clD = R.clIon

  charge.na1 = sampleScalar(CHARGE_NA1, t)
  charge.na2 = sampleScalar(CHARGE_NA2, t)
  charge.clA = sampleScalar(CHARGE_CLA, t)
  charge.clB = sampleScalar(CHARGE_CLB, t)
  charge.na3 = charge.na4 = 1
  charge.clC = charge.clD = -1

  const back = sampleScalar(BACK_OPACITY, t)
  opacity.na1 = opacity.na2 = opacity.clA = opacity.clB = 1
  opacity.na3 = opacity.na4 = opacity.clC = opacity.clD = back

  const metalA = sampleScalar(METAL_OPACITY, t)
  frame.metalBond = sampleScalar(METAL_BOND_OPACITY, t)
  for (const m of METAL_ATOMS) {
    radius[m.id] = R.na
    charge[m.id] = 0
    opacity[m.id] = metalA
  }

  // Внешние ионы решётки: уже готовые Na⁺ / Cl⁻, проявляются на подлёте.
  for (const l of LATTICE_IONS) {
    radius[l.id] = l.el === 'Na' ? R.naIon : R.clIon
    charge[l.id] = l.el === 'Na' ? 1 : -1
    const s = LATTICE_START[l.id]!
    opacity[l.id] = smoothstep(s, s + 0.55, t)
  }

  // ——— Схематичная оболочка 3s¹: разгорается перед отдачей электрона ———
  frame.shell.na1 = windowFade([T_E1.leave - 1.4, T_E1.leave + 0.25], t, 0.45)
  frame.shell.na2 = windowFade([T_E2.leave - 1.4, T_E2.leave + 0.25], t, 0.45)

  // ——— Электроны: 3s¹ натрия достраивает октет хлора ———
  sampleElectronJump(frame.electrons[0], t, {
    donor: atoms.na1,
    acceptor: atoms.clA,
    shellRadius: SHELL_NA,
    acceptorRadius: radius.clA,
    leave: T_E1.leave,
    arrive: T_E1.arrive,
    arcSign: 1,
  })
  sampleElectronJump(frame.electrons[1], t, {
    donor: atoms.na2,
    acceptor: atoms.clB,
    shellRadius: SHELL_NA,
    acceptorRadius: radius.clB,
    leave: T_E2.leave,
    arrive: T_E2.arrive,
    arcSign: -1,
  })

  // ——— Связь Cl–Cl и рёбра решётки ———
  frame.bond.stress = sampleScalar(BOND_STRESS, t)
  frame.bond.split = sampleScalar(BOND_SPLIT, t)
  frame.bond.opacity = sampleScalar(BOND_OPACITY, t)
  frame.edges = sampleScalar(EDGES, t)

  // ——— Шаг 4: электростатическое притяжение (закон Кулона) ———
  frame.field = windowFade([13.2, T_CONTACT + 0.4], t, 0.5)

  // ——— Шаг 5: координационное число 6 ———
  frame.coord = windowFade([22.0, 24.4], t, 0.4) * (0.7 + 0.3 * Math.sin(t * 5.5))

  // ——— Энергия: пик на cue exo, затем ровное тёплое свечение ———
  const exo = smoothstep(T_EXO - 0.7, T_EXO, t) * (1 - 0.55 * smoothstep(T_EXO, T_EXO + 1.6, t))
  frame.env.exo = exo
  frame.env.fade = sampleScalar(FADE, t)

  for (const a of NACL_ATOMS) {
    let e = (a.el === 'Na' ? 0.1 : 0.08) + exo * 0.42
    if (a.id === 'na1') e += frame.shell.na1 * 0.3 + frame.coord * 0.5
    if (a.id === 'na2') e += frame.shell.na2 * 0.3
    if (frame.coord > 0 && NACL_COORDINATION_IDS.includes(a.id)) e += frame.coord * 0.4
    emissive[a.id] = e
  }

  // ——— Центр фрагмента ———
  frame.cubeCenter.copy(atoms.na1).add(atoms.clA).add(atoms.na2).add(atoms.clB).multiplyScalar(0.25)
  if (back > 0) frame.cubeCenter.multiplyScalar(mix(1, 0, back))

  // ——— Подписи ———
  sampleLabels(NACL_LABELS, frame.labels, t, (def, st) => {
    const d = def as NaclLabelDef
    if (d.anchor === 'cube') {
      st.pos.copy(frame.cubeCenter)
      st.pos.y += d.dy
    } else if (d.anchor === 'metal') {
      st.pos.copy(frame.metalCenter)
      st.pos.y += d.dy
    } else if (d.anchor === 'cl2') {
      st.pos.copy(atoms.clA).lerp(atoms.clB, 0.5)
      st.pos.x += radius.clA + 0.26
      st.pos.y += d.dy - 0.2
    } else if (d.anchor === 'pair') {
      st.pos.copy(atoms.na1).lerp(atoms.clA, 0.5)
      st.pos.y += d.dy
    } else {
      st.pos.copy(atoms[d.anchor])
      st.pos.y += d.dy > 0 ? radius[d.anchor] + d.dy : -(radius[d.anchor] - d.dy)
    }
  }, frame.env.fade)

  // ——— Камера ———
  const cam = frame.camera
  cam.zoom = sampleScalar(CAM_ZOOM, t)
  sampleVec3(CAM_OFFSET, t, cam.offset)
  cam.yaw = sampleScalar(CAM_YAW, t)
  cam.roll = sampleScalar(CAM_ROLL, t)
  cam.shake = 0.3 * Math.max(0, 1 - Math.abs(t - T_BREAK) / 0.35) + 0.5 * Math.max(0, 1 - Math.abs(t - T_EXO) / 0.5)
  cam.bloom = 0.3 + 0.25 * frame.shell.na1 + 0.75 * exo
  cam.vignette = 0.3 + 0.15 * exo
  return frame
}

/** Проверка раскадровки — в dev и в тесте сцены. */
export function validateNaclStoryboard(): void {
  const vec: Record<string, Vec3Track> = {}
  for (const [id, track] of Object.entries(POS)) if (track) vec[`pos.${id}`] = track
  vec['cam.offset'] = CAM_OFFSET
  validateTracks(vec)
  validateTracks({
    RADIUS_NA1,
    RADIUS_NA2,
    RADIUS_CLA,
    RADIUS_CLB,
    CHARGE_NA1,
    CHARGE_NA2,
    CHARGE_CLA,
    CHARGE_CLB,
    METAL_OPACITY,
    METAL_BOND_OPACITY,
    BACK_OPACITY,
    BOND_STRESS,
    BOND_SPLIT,
    BOND_OPACITY,
    EDGES,
    CAM_ZOOM,
    CAM_YAW,
    CAM_ROLL,
    FADE,
  })

  if (NACL_ATOMS.length !== 71) throw new Error(`nacl: ожидалось 64 иона + 7 атомов металла, получилось ${NACL_ATOMS.length}`)
  if (LATTICE_IONS.length !== 56) throw new Error(`nacl: во фрагменте 4×4×4 вне восьмёрки должно быть 56 ионов, получилось ${LATTICE_IONS.length}`)
  if (NACL_EDGES.length !== 144) throw new Error(`nacl: ожидалось 144 ребра, получилось ${NACL_EDGES.length}`)
  if (NACL_COORDINATION_IDS.length !== 6) throw new Error(`nacl: КЧ(Na⁺) обязано быть 6, получилось ${NACL_COORDINATION_IDS.length}`)

  // Чередование зарядов: у каждого узла все ближайшие соседи — противоположного знака.
  const elById = new Map(NACL_ATOMS.map((a) => [a.id, a.el]))
  for (const [a, b] of NACL_EDGES) {
    if (elById.get(a) === elById.get(b)) throw new Error(`nacl: соседи ${a} и ${b} одноимённые — решётка построена неверно`)
  }

  // Физика размера: катион меньше атома, анион больше; Cl⁻ ≈ 1,78 · Na⁺.
  if (!(R.naIon < R.na)) throw new Error('nacl: Na⁺ обязан быть меньше атома Na')
  if (!(R.clIon > R.cl)) throw new Error('nacl: Cl⁻ обязан быть больше атома Cl')
  const ratio = R.clIon / R.naIon
  if (ratio < 1.7 || ratio > 1.85) throw new Error(`nacl: Cl⁻ / Na⁺ = ${ratio.toFixed(2)}, ожидалось ≈ 1,78`)

  if (NACL_END <= 0) throw new Error('nacl: пустой сюжет')
}
