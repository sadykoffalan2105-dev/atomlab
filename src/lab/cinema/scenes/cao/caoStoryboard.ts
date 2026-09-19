import * as THREE from 'three'
import { bondAngleDeg, bondLengthPm, getCrystal, radiusForSpecies } from '../../../../chemistry/data'
import { mix, smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, windowFade, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { bondLength, pmToScene, speciesRadius } from '../kit/cpkAtoms'
import { createElectronJump, sampleElectronJump, type ElectronJump } from '../kit/electronFx'
import {
  createLabelStates,
  fadeTrack,
  rampTrack,
  sampleLabels,
  validateTracks,
  type SceneLabelDef,
  type SceneLabelState,
} from '../kit/sceneKit'
import { CAO_DH_KJ, CAO_KILN_C } from './caoEnergetics'
import { CAO_END, CAO_FINISH, caoCueAt } from './caoSteps'

export {
  CAO_CUES,
  CAO_END,
  CAO_FINISH,
  CAO_SEGMENTS,
  CAO_STEPS,
  CAO_STEP_IDS,
  CAO_TIMING,
  caoStepIndexAt,
  type CaoCueId,
  type CaoStepId,
} from './caoSteps'

/**
 * Раскадровка «обжиг известняка» CaCO₃ (тв.) → CaO (тв.) + CO₂ (г.) —
 * ЧИСТАЯ функция времени сюжета.
 *
 * Вся химия — из src/chemistry/data (ни одного числа руками):
 *   • кальцит: R3̄c (167), гексагональная установка a = 499 пм, c = 1706,1 пм, Z = 6,
 *     d(Ca–O) = 235,9 пм, КЧ: Ca²⁺ по кислороду 6, C по кислороду 3, O по кальцию 2;
 *     слои Ca²⁺ идут через c/6 = 284,4 пм, слой CO₃²⁻ лежит ровно посередине (c/12);
 *   • ион CO₃²⁻: плоский правильный треугольник, все три связи C–O одинаковые,
 *     128,4 пм, угол O–C–O 120° (sp²; порядок связи 1⅓ из-за делокализации);
 *   • CO₂: ЛИНЕЙНАЯ молекула, C=O 116 пм, угол 180° — короче и прочнее карбонатной;
 *   • CaO: каменная соль Fm-3m (225), a = 481,1 пм, d(Ca–O) = 240,5 пм, КЧ 6/6, Z = 4;
 *   • радиусы: Ca²⁺ 100 пм (не меняется — кальций и до, и после обжига ион +2),
 *     кислород в ковалентной связи 66 пм → свободный O²⁻ 140 пм (больше вдвое);
 *   • H₂O: O–H 95,8 пм, угол H–O–H 104,45°.
 *
 * СТЕПЕНИ ОКИСЛЕНИЯ НЕ МЕНЯЮТСЯ (Ca +2, C +4, O −2) — это НЕ окислительно-
 * восстановительная реакция, а разрыв связи C–O с уходом пары на кислород.
 *
 * ЧТО НАРИСОВАНО СХЕМАТИЧНО (и так сказано в тексте урока):
 *   • взаимный поворот карбонатных групп и точная укладка слоёв кальцита — схема:
 *     настоящая ромбоэдрическая ячейка сложнее, показаны верные межслоевые
 *     расстояния и верная геометрия самой группы CO₃²⁻;
 *   • амплитуда тепловых колебаний преувеличена в несколько раз, иначе её не видно;
 *   • показаны 8 формульных единиц, в крупинке известняка их порядка 10¹⁹;
 *   • «гашение» и «известковая вода» разыграны на ОДНОЙ формульной единице CaO,
 *     вынесенной вперёд, чтобы кристалл остался в кадре целым.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

const CALCITE = getCrystal('calcite')!
const ROCK = getCrystal('cao')!

/** Расстояние Ca–Ca внутри слоя кальцита = параметр a гексагональной установки. */
const A_IN = pmToScene(CALCITE.cellPm.a)
/** Слой Ca²⁺ ↔ соседний слой CO₃²⁻ = c/12; слой Ca ↔ слой Ca = c/6. */
const CALCITE_C_PM = CALCITE.cellPm.c ?? 0
const LAYER = pmToScene(CALCITE_C_PM / 12)
/** Кратчайшее Ca–O в каменной соли CaO = a/2. */
const D_CAO = pmToScene(ROCK.cationAnionPm)
/** Длина связи внутри карбонат-иона и внутри CO₂. */
const CO3_LEN = bondLength('C-O(CO3)')
const CO2_LEN = bondLength('C=O(CO2)')
const OH_LEN = bondLength('O-H')

const ANG_CO3 = bondAngleDeg('carbonate')
const ANG_CO2 = bondAngleDeg('carbonDioxide')
const ANG_H2O = bondAngleDeg('water')

const DEG = Math.PI / 180
/** Полуугол между связью C–O и осью будущей молекулы: (180° − 120°)/2 = 30°. */
const HALF_OPEN = ((ANG_CO2 - ANG_CO3) / 2) * DEG

const R = {
  ca: speciesRadius('Ca', 2),
  /** кислород в ковалентной связи (карбонат, CO₂, вода, OH) */
  oCov: speciesRadius('O', 0),
  /** свободный оксид-ион */
  oIon: speciesRadius('O', -2),
  c: speciesRadius('C', 0),
  h: speciesRadius('H', 0),
} as const

export const CAO_GEOM = {
  radius: R,
  inPlane: A_IN,
  layer: LAYER,
  dCaO: D_CAO,
  co3Len: CO3_LEN,
  co2Len: CO2_LEN,
  /** справочные числа для подписей и тестов */
  data: {
    calcite: {
      spaceGroup: CALCITE.spaceGroup,
      spaceGroupNo: CALCITE.spaceGroupNo,
      aPm: CALCITE.cellPm.a,
      cPm: CALCITE_C_PM,
      caOPm: CALCITE.cationAnionPm,
      coordination: CALCITE.coordination,
      z: CALCITE.z,
      densityGCm3: CALCITE.densityGCm3,
    },
    rock: {
      spaceGroup: ROCK.spaceGroup,
      spaceGroupNo: ROCK.spaceGroupNo,
      aPm: ROCK.cellPm.a,
      caOPm: ROCK.cationAnionPm,
      coordination: ROCK.coordination,
      z: ROCK.z,
      densityGCm3: ROCK.densityGCm3,
    },
    co3Pm: bondLengthPm('C-O(CO3)'),
    co2Pm: bondLengthPm('C=O(CO2)'),
    ohPm: bondLengthPm('O-H'),
    angles: { co3: ANG_CO3, co2: ANG_CO2, water: ANG_H2O },
  },
} as const

/** Масштаб рига камеры. */
export const CAO_RIG_SCALE = 1.12

// ─────────────────────────────────────────────────────────────────────────────
// Узлы кальцита и решётки CaO
// ─────────────────────────────────────────────────────────────────────────────

export type CaoElement = 'Ca' | 'C' | 'O' | 'H'
export type CaoRole = 'ca' | 'carbon' | 'oxide' | 'gas' | 'demo' | 'water'

type Vec = readonly [number, number, number]

/** Векторы гексагональной сетки слоя: |a1| = |a2| = a, угол 120°. */
const A1: Vec = [A_IN, 0, 0]
const A2: Vec = [A_IN / 2, 0, (A_IN * Math.sqrt(3)) / 2]

/** Центроид треугольника Ca — над ним в соседнем слое стоит карбонатная группа. */
const CENTROID: Vec = [(A1[0] + A2[0]) / 3, 0, (A1[2] + A2[2]) / 3]

/** Слои снизу вверх: CO₃²⁻, Ca²⁺, CO₃²⁻, Ca²⁺ — межслоевое расстояние c/12. */
const LAYER_Y = [-1.5 * LAYER, -0.5 * LAYER, 0.5 * LAYER, 1.5 * LAYER] as const

type GroupDef = { id: number; site: THREE.Vector3; phi: number }
type CaDef = { id: string; site: THREE.Vector3; seed: number }

const CA_DEFS: CaDef[] = []
const GROUP_DEFS: GroupDef[] = []

{
  let caN = 0
  let gN = 0
  for (let layer = 0; layer < LAYER_Y.length; layer++) {
    const isCa = layer % 2 === 1
    const y = LAYER_Y[layer]!
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const u = i - 0.5
        const v = j - 0.5
        const x = u * A1[0] + v * A2[0] + (isCa ? 0 : CENTROID[0])
        const z = u * A1[2] + v * A2[2] + (isCa ? 0 : CENTROID[2])
        if (isCa) CA_DEFS.push({ id: `ca${caN}`, site: new THREE.Vector3(x, y, z), seed: caN++ })
        // Соседние карбонатные слои повёрнуты друг относительно друга на 60°
        // (для правильного треугольника это то же, что на 180°) — как в кальците.
        else GROUP_DEFS.push({ id: gN++, site: new THREE.Vector3(x, y, z), phi: layer === 0 ? Math.PI / 3 : 0 })
      }
    }
  }
}

/** Центр фрагмента кальцита: слои Ca и CO₃ сдвинуты друг относительно друга. */
const CALCITE_CENTER = new THREE.Vector3()
for (const c of CA_DEFS) CALCITE_CENTER.add(c.site)
for (const g of GROUP_DEFS) CALCITE_CENTER.add(g.site)
CALCITE_CENTER.multiplyScalar(1 / (CA_DEFS.length + GROUP_DEFS.length))
for (const c of CA_DEFS) c.site.sub(CALCITE_CENTER)
for (const g of GROUP_DEFS) g.site.sub(CALCITE_CENTER)

/**
 * Фрагмент CaO: 4 × 2 × 2 узла каменной соли с шагом d(Ca–O) = 240,5 пм —
 * это ровно ДВЕ элементарные ячейки (ребро ячейки a = 2 d = 481,1 пм).
 * Знак заряда чередуется по чётности суммы индексов, поэтому одноимённые
 * ионы физически не могут оказаться соседями.
 */
type RockSite = { index: number; pos: THREE.Vector3; cation: boolean; ijk: readonly [number, number, number] }

const ROCK_SITES: RockSite[] = []
{
  let n = 0
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 2; k++) {
        ROCK_SITES.push({
          index: n++,
          pos: new THREE.Vector3((i - 1.5) * D_CAO, (j - 0.5) * D_CAO, (k - 0.5) * D_CAO),
          cation: (i + j + k) % 2 === 0,
          ijk: [i, j, k],
        })
      }
    }
  }
}

/** Рёбра фрагмента: пары ближайших соседей Ca²⁺–O²⁻. */
const ROCK_EDGE_SITES: (readonly [number, number])[] = []
for (let a = 0; a < ROCK_SITES.length; a++) {
  for (let b = a + 1; b < ROCK_SITES.length; b++) {
    const p = ROCK_SITES[a]!.ijk
    const q = ROCK_SITES[b]!.ijk
    const d = Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2])
    if (d === 1) ROCK_EDGE_SITES.push([a, b])
  }
}

/** Жадное назначение «кто куда встанет»: ближайший свободный источник к каждому узлу. */
function assign(
  sources: readonly { id: string; from: THREE.Vector3 }[],
  sites: readonly RockSite[],
  owner: Map<number, string>,
): Map<string, THREE.Vector3> {
  const out = new Map<string, THREE.Vector3>()
  const free = sources.map((s) => ({ ...s, taken: false }))
  for (const site of sites) {
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < free.length; i++) {
      const f = free[i]!
      if (f.taken) continue
      const d = f.from.distanceToSquared(site.pos)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    if (best < 0) throw new Error('[cao] не хватает частиц для узлов решётки CaO')
    free[best]!.taken = true
    out.set(free[best]!.id, site.pos)
    owner.set(site.index, free[best]!.id)
  }
  return out
}

/** Статичное положение кислорода, который остаётся при кальции (индекс 0 в группе). */
function stayStart(g: GroupDef): THREE.Vector3 {
  return new THREE.Vector3(g.site.x + Math.cos(g.phi) * CO3_LEN, g.site.y, g.site.z + Math.sin(g.phi) * CO3_LEN)
}

/** Узел решётки → id частицы, которая в нём окажется. */
const SITE_OWNER = new Map<number, string>()

const CA_TARGET = assign(
  CA_DEFS.map((c) => ({ id: c.id, from: c.site })),
  ROCK_SITES.filter((s) => s.cation),
  SITE_OWNER,
)
const O_TARGET = assign(
  GROUP_DEFS.map((g) => ({ id: `o${g.id}s`, from: stayStart(g) })),
  ROCK_SITES.filter((s) => !s.cation),
  SITE_OWNER,
)

export const ROCK_EDGES: readonly (readonly [string, string])[] = ROCK_EDGE_SITES.map(([a, b]) => [
  SITE_OWNER.get(a)!,
  SITE_OWNER.get(b)!,
])

// ─────────────────────────────────────────────────────────────────────────────
// Список частиц кадра
// ─────────────────────────────────────────────────────────────────────────────

export type CaoAtomDef = { id: string; el: CaoElement; role: CaoRole; group?: number }

export const CAO_ATOMS: readonly CaoAtomDef[] = [
  ...CA_DEFS.map((c) => ({ id: c.id, el: 'Ca' as CaoElement, role: 'ca' as CaoRole })),
  ...GROUP_DEFS.flatMap((g) => [
    { id: `c${g.id}`, el: 'C' as CaoElement, role: 'carbon' as CaoRole, group: g.id },
    { id: `o${g.id}s`, el: 'O' as CaoElement, role: 'oxide' as CaoRole, group: g.id },
    { id: `o${g.id}a`, el: 'O' as CaoElement, role: 'gas' as CaoRole, group: g.id },
    { id: `o${g.id}b`, el: 'O' as CaoElement, role: 'gas' as CaoRole, group: g.id },
  ]),
  // Шаг 5: вынесенная вперёд формульная единица CaO и молекула воды.
  { id: 'dCa', el: 'Ca', role: 'demo' },
  { id: 'dO', el: 'O', role: 'demo' },
  { id: 'wO', el: 'O', role: 'water' },
  { id: 'wH1', el: 'H', role: 'water' },
  { id: 'wH2', el: 'H', role: 'water' },
]

/** Связи кадра: карбонат/CO₂ (3 на группу), рёбра CaO, гидроксилы и карбонат шага 5. */
export type CaoBondDef = { a: string; b: string; kind: 'stay' | 'co2' | 'edge' | 'oh' | 'carb' }

export const CAO_BONDS: readonly CaoBondDef[] = [
  ...GROUP_DEFS.flatMap((g): CaoBondDef[] => [
    { a: `c${g.id}`, b: `o${g.id}s`, kind: 'stay' },
    { a: `c${g.id}`, b: `o${g.id}a`, kind: 'co2' },
    { a: `c${g.id}`, b: `o${g.id}b`, kind: 'co2' },
  ]),
  ...ROCK_EDGES.map((e): CaoBondDef => ({ a: e[0], b: e[1], kind: 'edge' })),
  { a: 'wO', b: 'wH1', kind: 'oh' },
  { a: 'wO', b: 'wH2', kind: 'oh' },
  { a: 'dO', b: 'wH2', kind: 'oh' },
  { a: 'dO', b: 'wH1', kind: 'oh' },
  { a: 'c0', b: 'wO', kind: 'carb' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Ключевые моменты
// ─────────────────────────────────────────────────────────────────────────────

const T_HEAT = caoCueAt('heat') // 7.2
const T_SPLIT = caoCueAt('split') // 11.4
const T_ESCAPE = caoCueAt('escape') // 13.2
const T_ROCK = caoCueAt('rocksalt') // 18.8
const T_SLAKE = caoCueAt('slake') // 21.8
const T_LIME = caoCueAt('limewater') // 23.6

/** Разрыв связи C–O идёт каскадом: группы распадаются не разом. */
const splitAt = (g: number): number => T_SPLIT - 0.5 + (g % 4) * 0.22 + Math.floor(g / 4) * 0.34
const escapeAt = (g: number): number => splitAt(g) + 1.45

// ─────────────────────────────────────────────────────────────────────────────
// Шаг 5: вынесенная вперёд формульная единица CaO, вода и карбонат
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_X = 0.12
const DEMO_Y = -1.26
const DEMO_Z = 0.62

const DEMO_CA = new THREE.Vector3(DEMO_X - D_CAO / 2, DEMO_Y, DEMO_Z)
const DEMO_O = new THREE.Vector3(DEMO_X + D_CAO / 2, DEMO_Y, DEMO_Z)

/** Направление «вверх от Ca²⁺», вдоль которого садится гидроксил, а потом карбонат. */
const CARB_N = new THREE.Vector3(0.18, 0.93, 0.32).normalize()
/** Гидроксил OH⁻ у Ca²⁺: кислород на расстоянии d(Ca–O) каменной соли. */
const OH_O = DEMO_CA.clone().addScaledVector(CARB_N, D_CAO)
/**
 * Углерод карбоната CaCO₃: так, чтобы кислород, смотрящий на Ca²⁺, оказался
 * ровно на d(Ca–O) кальцита = 235,9 пм — настоящее расстояние в известняке.
 */
const CARB_C = DEMO_CA.clone().addScaledVector(CARB_N, pmToScene(CALCITE.cationAnionPm) + CO3_LEN)
/** Нормаль плоскости карбонатного треугольника шага 5. */
const CARB_M = new THREE.Vector3().crossVectors(CARB_N, new THREE.Vector3(0, 0, 1)).normalize()

/** Куда уходит молекула воды, родившаяся при карбонизации. */
const WATER_OUT = new THREE.Vector3(DEMO_X + 1.32, DEMO_Y + 0.48, DEMO_Z + 0.34)

/** Наклон оси CO₂ после всплытия (конец дорожки GROUP_TILT). */
const TILT_FINAL = (g: number): number => 1.15 * (g % 2 === 0 ? 1 : -1)

/** Направление связи C=O линейной молекулы CO₂ после всплытия — величина постоянная. */
function co2DirFinal(g: GroupDef, sign: 1 | -1, out: THREE.Vector3): THREE.Vector3 {
  const axis = g.phi + Math.PI / 2
  const tilt = TILT_FINAL(g.id)
  out.set(Math.cos(axis) * sign, 0, Math.sin(axis) * sign).multiplyScalar(Math.cos(tilt))
  return out.addScaledVector(new THREE.Vector3(0, 1, 0), Math.sin(tilt) * sign).normalize()
}

/** Направления двух «газовых» связей в восстановленном карбонате шага 5. */
const CARB_DIR: readonly THREE.Vector3[] = [carbonateDir(0, new THREE.Vector3()), carbonateDir(1, new THREE.Vector3())]

/**
 * Кому из двух кислородов CO₂ какая вершина треугольника достанется: берём
 * пару с МЕНЬШИМ поворотом, иначе интерполяция направлений проходит через
 * вырожденное «антипараллельно» и атом дёргается.
 */
const CARB_TARGET = (() => {
  const a = co2DirFinal(GROUP_DEFS[0]!, 1, new THREE.Vector3())
  const straight = a.dot(CARB_DIR[0]!) >= a.dot(CARB_DIR[1]!)
  return { a: straight ? CARB_DIR[0]! : CARB_DIR[1]!, b: straight ? CARB_DIR[1]! : CARB_DIR[0]! }
})()

// ─────────────────────────────────────────────────────────────────────────────
// Дорожки: кальций
// ─────────────────────────────────────────────────────────────────────────────

const CA_POS: Record<string, Vec3Track> = {}
for (const c of CA_DEFS) {
  const to = CA_TARGET.get(c.id)!
  CA_POS[c.id] = [
    { t: 0, v: [c.site.x, c.site.y, c.site.z] },
    { t: 15.2, v: [c.site.x, c.site.y, c.site.z] },
    { t: 18.4, v: [to.x, to.y, to.z], ease: 'smooth' },
  ]
}

const O_POS: Record<string, Vec3Track> = {}
for (const g of GROUP_DEFS) {
  const from = stayStart(g)
  const to = O_TARGET.get(`o${g.id}s`)!
  O_POS[`o${g.id}s`] = [
    { t: 0, v: [from.x, from.y, from.z] },
    { t: splitAt(g.id), v: [from.x, from.y, from.z] },
    { t: 15.4, v: [from.x, from.y, from.z] },
    { t: 18.6, v: [to.x, to.y, to.z], ease: 'smooth' },
  ]
}

/** Центр карбонатной группы: стоит в решётке, после разрыва поднимается газом. */
const GROUP_POS: Record<number, Vec3Track> = {}
for (const g of GROUP_DEFS) {
  const s = g.site
  const tS = splitAt(g.id)
  const tE = escapeAt(g.id)
  const drift = ((g.id % 3) - 1) * 0.26
  const driftZ = ((Math.floor(g.id / 2) % 3) - 1) * 0.2
  if (g.id === 0) {
    // Группа 0 возвращается на шаге 5: она пойдёт гасить известковую воду.
    GROUP_POS[g.id] = [
      { t: 0, v: [s.x, s.y, s.z] },
      { t: tS, v: [s.x, s.y, s.z] },
      { t: tE, v: [s.x + drift * 0.4, s.y + 0.42, s.z + driftZ * 0.4], ease: 'smooth' },
      { t: 16.2, v: [s.x + drift, s.y + 1.75, s.z + driftZ], ease: 'smooth' },
      { t: 21.7, v: [DEMO_X, DEMO_Y + 1.55, DEMO_Z + 0.18], ease: 'smooth' },
      { t: 23.4, v: [CARB_C.x, CARB_C.y, CARB_C.z], ease: 'smooth' },
    ]
  } else {
    GROUP_POS[g.id] = [
      { t: 0, v: [s.x, s.y, s.z] },
      { t: tS, v: [s.x, s.y, s.z] },
      { t: tE, v: [s.x + drift * 0.4, s.y + 0.5, s.z + driftZ * 0.4], ease: 'smooth' },
      { t: tE + 3.4, v: [s.x + drift, s.y + 2.9, s.z + driftZ], ease: 'smooth' },
    ]
  }
}

/** Раскрытие угла O–C–O: 120° → 180° ровно в момент разрыва связи C–O. */
const GROUP_OPEN: Record<number, ScalarTrack> = {}
/** Наклон оси CO₂ при всплытии (молекула поднимается «носом вверх»). */
const GROUP_TILT: Record<number, ScalarTrack> = {}
for (const g of GROUP_DEFS) {
  const tS = splitAt(g.id)
  GROUP_OPEN[g.id] = rampTrack(tS, 0, tS + 0.85, 1, 'smooth')
  GROUP_TILT[g.id] = [
    { t: tS + 0.9, v: 0 },
    { t: tS + 3.0, v: TILT_FINAL(g.id), ease: 'smooth' },
  ]
}

/** Прозрачность улетающего CO₂. Группа 0 гаснет раньше и возвращается на шаге 5. */
const GROUP_OPACITY: Record<number, ScalarTrack> = {}
for (const g of GROUP_DEFS) {
  const tE = escapeAt(g.id)
  GROUP_OPACITY[g.id] =
    g.id === 0
      ? [
          { t: 0, v: 1 },
          { t: 15.6, v: 1 },
          { t: 16.6, v: 0, ease: 'smooth' },
          { t: 21.6, v: 0 },
          { t: 22.2, v: 1, ease: 'smooth' },
          { t: 24.8, v: 1 },
          { t: 25.6, v: 0, ease: 'smooth' },
        ]
      : [
          { t: 0, v: 1 },
          { t: tE + 1.9, v: 1 },
          { t: tE + 3.4, v: 0, ease: 'smooth' },
        ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Шаг 5: дорожки вынесенной формульной единицы
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_OPACITY: ScalarTrack = [
  { t: 19.9, v: 0 },
  { t: 20.6, v: 1, ease: 'smooth' },
  { t: 25.2, v: 1 },
  { t: 26.0, v: 0, ease: 'smooth' },
]

const WATER_POS: Vec3Track = [
  { t: 20.2, v: [DEMO_X + 1.5, DEMO_Y + 1.35, DEMO_Z + 0.5] },
  { t: 21.5, v: [OH_O.x, OH_O.y, OH_O.z], ease: 'smooth', arc: 0.14 },
  { t: 22.7, v: [OH_O.x, OH_O.y, OH_O.z] },
  { t: 23.4, v: [CARB_C.x - CARB_N.x * CO3_LEN, CARB_C.y - CARB_N.y * CO3_LEN, CARB_C.z - CARB_N.z * CO3_LEN], ease: 'smooth' },
]

const WATER_OPACITY: ScalarTrack = [
  { t: 20.1, v: 0 },
  { t: 20.7, v: 1, ease: 'smooth' },
  { t: 25.2, v: 1 },
  { t: 26.0, v: 0, ease: 'smooth' },
]

/** Протон, перескакивающий на оксид-ион: O²⁻ + H₂O → 2 OH⁻ — механизм гашения. */
const H1_HOP = rampTrack(21.25, 0, T_SLAKE + 0.05, 1, 'smooth')
/** Второй протон уходит к тому же кислороду при карбонизации → H₂O. */
const H2_HOP = rampTrack(22.9, 0, T_LIME + 0.1, 1, 'smooth')
/** Родившаяся вода отплывает от кристалла. */
const WATER_LEAVE = rampTrack(T_LIME + 0.3, 0, 25.1, 1, 'smooth')

/** Направления связей O–H: угол между ними — настоящие 104,45°. */
const H_DIR_A = new THREE.Vector3(-0.62, 0.55, 0.56).normalize()
const H_DIR_B = (() => {
  // Строим второй луч так, чтобы угол H–O–H был ровно табличным.
  const ref = new THREE.Vector3(0.83, 0.34, -0.45)
  const perp = ref.clone().addScaledVector(H_DIR_A, -ref.dot(H_DIR_A)).normalize()
  const a = ANG_H2O * DEG
  return H_DIR_A.clone().multiplyScalar(Math.cos(a)).addScaledVector(perp, Math.sin(a)).normalize()
})()
/** Гидроксил на оксид-ионе решётки смотрит наружу кристалла. */
const H_DIR_OXIDE = new THREE.Vector3(0.52, 0.72, 0.46).normalize()
const H_DIR_OXIDE2 = (() => {
  const ref = new THREE.Vector3(-0.35, 0.42, -0.84)
  const perp = ref.clone().addScaledVector(H_DIR_OXIDE, -ref.dot(H_DIR_OXIDE)).normalize()
  const a = ANG_H2O * DEG
  return H_DIR_OXIDE.clone().multiplyScalar(Math.cos(a)).addScaledVector(perp, Math.sin(a)).normalize()
})()

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки сцены
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ТЕМПЕРАТУРА = АМПЛИТУДА. При 25 °C узлы уже колеблются, просто слабо;
 * в печи амплитуда растёт в десяток раз. Значение преувеличено ради наглядности.
 */
const JITTER: ScalarTrack = [
  { t: 0, v: 0.006 },
  { t: 4.5, v: 0.01, ease: 'smooth' },
  { t: T_HEAT, v: 0.07, ease: 'smooth' },
  { t: 11.2, v: 0.07 },
  { t: 14.2, v: 0, ease: 'smooth' },
]

/** Радиус кислорода: ковалентно связанный 66 пм → свободный ион O²⁻ 140 пм. */
const OXIDE_RADIUS: Record<number, ScalarTrack> = {}
const OXIDE_CHARGE: Record<number, ScalarTrack> = {}
for (const g of GROUP_DEFS) {
  const tS = splitAt(g.id)
  OXIDE_RADIUS[g.id] = rampTrack(tS, R.oCov, tS + 0.9, R.oIon)
  // В CO₃²⁻ заряд −2 делокализован по трём кислородам (порядок связи 1⅓),
  // поэтому стартуем не с нуля, а с −0,6; после разрыва — полный O²⁻.
  OXIDE_CHARGE[g.id] = rampTrack(tS, -0.6, tS + 0.9, -1, 'smooth')
}

/** Рёбра фрагмента CaO: проявляются, когда решётка собрана. */
const EDGES: ScalarTrack = [
  { t: 18.0, v: 0 },
  { t: T_ROCK, v: 0.55, ease: 'smooth' },
  { t: 28.6, v: 0.55 },
  { t: CAO_FINISH.to, v: 0, ease: 'smooth' },
]

/** Накал печи: оранжевое свечение и подсветка граней. */
const KILN: ScalarTrack = [
  { t: 4.6, v: 0 },
  { t: T_HEAT, v: 1, ease: 'smooth' },
  { t: 14.6, v: 0.55, ease: 'smooth' },
  { t: 19.6, v: 0.18, ease: 'smooth' },
  { t: 25.0, v: 0.1, ease: 'smooth' },
]

const CAM_ZOOM: ScalarTrack = [
  { t: 0, v: 0.72 },
  { t: 4.5, v: 0.84, ease: 'smooth' },
  { t: 9.0, v: 0.96, ease: 'smooth' },
  { t: 12.6, v: 1.02, ease: 'smooth' },
  { t: 15.6, v: 0.86, ease: 'smooth' },
  { t: T_ROCK, v: 1.0, ease: 'smooth' },
  { t: 20.8, v: 1.12, ease: 'smooth' },
  { t: 24.8, v: 1.06, ease: 'smooth' },
  { t: 26.4, v: 0.7, ease: 'smooth' },
  { t: 29.0, v: 0.66, ease: 'smooth' },
]
const CAM_YAW: ScalarTrack = [
  { t: 0, v: -0.22 },
  { t: 6.0, v: 0.1, ease: 'smooth' },
  { t: 15.0, v: 0.1 },
  { t: T_ROCK, v: 0.56, ease: 'smooth' },
  { t: 24.6, v: 0.34, ease: 'smooth' },
  { t: 29.0, v: 0.5, ease: 'smooth' },
]
const CAM_ROLL: ScalarTrack = [
  { t: 0, v: 0.05 },
  { t: 9.0, v: -0.05, ease: 'smooth' },
  { t: 20.0, v: -0.12, ease: 'smooth' },
  { t: 26.0, v: -0.04, ease: 'smooth' },
]
const CAM_OFFSET: Vec3Track = [
  { t: 0, v: [0, 0.02, 0] },
  { t: 9.5, v: [0, 0.16, 0], ease: 'smooth' },
  { t: 15.0, v: [0, 0.06, 0], ease: 'smooth' },
  { t: 20.4, v: [-DEMO_X * 0.6, -DEMO_Y * 0.62, 0], ease: 'smooth' },
  { t: 25.4, v: [0, 0.04, 0], ease: 'smooth' },
]
const FADE = fadeTrack(CAO_FINISH)

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D (только формулы и обозначения СИ; слова — в текстах урока)
// ─────────────────────────────────────────────────────────────────────────────

export type CaoLabelDef = SceneLabelDef & { anchor: string }

const A_PM = Math.round(CAO_GEOM.data.calcite.aPm)
const LAYER_PM = Math.round((CALCITE_C_PM / 6) * 10) / 10
const ROCK_A_PM = Math.round(CAO_GEOM.data.rock.aPm)
const ROCK_D_PM = Math.round(CAO_GEOM.data.rock.caOPm * 10) / 10
const CO3_PM = CAO_GEOM.data.co3Pm
const CO2_PM = CAO_GEOM.data.co2Pm
/** Радиусы для подписей, пикометры — из того же справочника, что и геометрия кадра. */
const OXIDE_PM = Math.round(radiusForSpecies('O', -2))
const CA_ION_PM = Math.round(radiusForSpecies('Ca', 2))

export const CAO_LABELS: readonly CaoLabelDef[] = [
  { id: 'calcite', kind: 'species', anchor: 'crystal', dy: 1.36, keys: [{ t: 0, text: 'CaCO₃ ({s})' }], windows: [[0.7, 10.6]] },
  { id: 'cellA', kind: 'delta', anchor: 'crystal', dy: -1.24, keys: [{ t: 0, text: `a = ${A_PM} {pm}` }], windows: [[1.6, 4.4]] },
  { id: 'layers', kind: 'delta', anchor: 'crystal', dy: -1.78, keys: [{ t: 0, text: `c/6 = ${LAYER_PM} {pm}` }], windows: [[2.4, 4.4]] },
  { id: 'co3', kind: 'species', anchor: 'g0', dy: 0.58, keys: [{ t: 0, text: 'CO₃²⁻' }], windows: [[2.6, T_SPLIT - 0.2]] },
  { id: 'co3ang', kind: 'token', anchor: 'g0', dy: -0.62, keys: [{ t: 0, text: `O–C–O = ${ANG_CO3}° · C–O ${CO3_PM} {pm}` }], windows: [[3.0, 4.4]] },
  { id: 'temp', kind: 'delta', anchor: 'crystal', dy: 1.9, keys: [
      { t: 0, text: '25 °C' },
      { t: 5.4, text: '300 °C' },
      { t: 6.3, text: '600 °C' },
      { t: T_HEAT, text: `${CAO_KILN_C} °C` },
    ], windows: [[4.7, 12.0]] },
  { id: 'co2', kind: 'species', anchor: 'g0', dy: 0.56, keys: [{ t: 0, text: 'CO₂ ({g})' }], windows: [[T_SPLIT + 0.4, 15.4], [22.4, 23.2]] },
  { id: 'co2len', kind: 'token', anchor: 'g0', dy: -0.6, keys: [{ t: 0, text: `O=C=O ${ANG_CO2}° · C=O ${CO2_PM} {pm}` }], windows: [[T_ESCAPE - 0.4, 15.4]] },
  { id: 'oxide', kind: 'species', anchor: 'o0s', dy: 0.24, keys: [{ t: 0, text: `O²⁻ ${OXIDE_PM} {pm}` }], windows: [[T_SPLIT + 0.5, 16.4]] },
  { id: 'cation', kind: 'species', anchor: 'ca0', dy: 0.22, keys: [{ t: 0, text: `Ca²⁺ ${CA_ION_PM} {pm}` }], windows: [[T_SPLIT + 0.9, 16.4]] },
  { id: 'cao', kind: 'species', anchor: 'crystal', dy: 1.06, keys: [{ t: 0, text: 'CaO ({s})' }], windows: [[T_ROCK - 0.6, 28.8]] },
  { id: 'rockA', kind: 'delta', anchor: 'crystal', dy: -0.96, keys: [{ t: 0, text: `a = ${ROCK_A_PM} {pm}` }], windows: [[T_ROCK, 20.0]] },
  { id: 'rockD', kind: 'delta', anchor: 'crystal', dy: -1.5, keys: [{ t: 0, text: `d(Ca–O) = ${ROCK_D_PM} {pm}` }], windows: [[T_ROCK + 0.3, 20.0]] },
  { id: 'coord', kind: 'token', anchor: 'crystal', dy: 1.62, keys: [{ t: 0, text: 'Ca²⁺ : 6 O²⁻ · O²⁻ : 6 Ca²⁺' }], windows: [[T_ROCK + 0.2, 20.0]] },
  { id: 'slake', kind: 'token', anchor: 'demo', dy: -0.66, keys: [{ t: 0, text: 'CaO + H₂O → Ca(OH)₂' }], windows: [[20.9, 22.8]] },
  { id: 'lime', kind: 'token', anchor: 'demo', dy: -0.66, keys: [{ t: 0, text: 'Ca(OH)₂ + CO₂ → CaCO₃↓ + H₂O' }], windows: [[23.0, 25.2]] },
  { id: 'dH', kind: 'delta', anchor: 'crystal', dy: -1.06, keys: [{ t: 0, text: `ΔH = +${CAO_DH_KJ} {kJmol}` }], windows: [[25.6, 28.8]] },
  { id: 'eq', kind: 'token', anchor: 'crystal', dy: -1.6, keys: [{ t: 0, text: 'CaCO₃ → CaO + CO₂↑' }], windows: [[26.2, 28.8]] },
]

export type CaoLabelState = SceneLabelState

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export type CaoFrame = {
  atoms: Record<string, THREE.Vector3>
  radius: Record<string, number>
  charge: Record<string, number>
  opacity: Record<string, number>
  emissive: Record<string, number>
  /** непрозрачность связей по индексу в CAO_BONDS */
  bondOpacity: number[]
  /** натяжение связи C–O перед разрывом, по индексу в CAO_BONDS */
  bondStress: number[]
  /** электронная пара, остающаяся на кислороде (группа 0) */
  electrons: [ElectronJump, ElectronJump]
  /** подсветка схематичной оболочки уходящего кислорода, 0..1 */
  shell: number
  /** линии электростатического поля Ca²⁺ ↔ O²⁻, 0..1 */
  field: number
  /** накал печи 0..1 и помутнение известковой воды 0..1 */
  env: { kiln: number; cloud: number; fade: number }
  labels: CaoLabelState[]
  camera: { zoom: number; offset: THREE.Vector3; yaw: number; roll: number; shake: number; bloom: number; vignette: number }
  crystalCenter: THREE.Vector3
  demoCenter: THREE.Vector3
}

export function createCaoFrame(): CaoFrame {
  const atoms: Record<string, THREE.Vector3> = {}
  const radius: Record<string, number> = {}
  const charge: Record<string, number> = {}
  const opacity: Record<string, number> = {}
  const emissive: Record<string, number> = {}
  for (const a of CAO_ATOMS) {
    atoms[a.id] = new THREE.Vector3()
    radius[a.id] = a.el === 'Ca' ? R.ca : a.el === 'C' ? R.c : a.el === 'H' ? R.h : R.oCov
    charge[a.id] = 0
    opacity[a.id] = a.role === 'demo' || a.role === 'water' ? 0 : 1
    emissive[a.id] = 0.08
  }
  return {
    atoms,
    radius,
    charge,
    opacity,
    emissive,
    bondOpacity: CAO_BONDS.map(() => 0),
    bondStress: CAO_BONDS.map(() => 0),
    electrons: [createElectronJump('pair1'), createElectronJump('pair2')],
    shell: 0,
    field: 0,
    env: { kiln: 0, cloud: 0, fade: 0 },
    labels: createLabelStates(CAO_LABELS),
    camera: { zoom: 1, offset: new THREE.Vector3(), yaw: 0, roll: 0, shake: 0, bloom: 0.3, vignette: 0.3 },
    crystalCenter: new THREE.Vector3(),
    demoCenter: new THREE.Vector3(DEMO_X, DEMO_Y, DEMO_Z),
  }
}

// ——— рабочие векторы: аллокаций в кадре нет ———
const _wob = new THREE.Vector3()
const _dirA = new THREE.Vector3()
const _dirB = new THREE.Vector3()
const _tmp = new THREE.Vector3()
const _tmp2 = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

/** Поворот направления по дуге большого круга: |out| = 1 на всём пути. */
function slerpDir(a: THREE.Vector3, b: THREE.Vector3, s: number, out: THREE.Vector3): THREE.Vector3 {
  const d = Math.min(1, Math.max(-1, a.dot(b)))
  const omega = Math.acos(d)
  if (omega < 1e-3) return out.copy(b)
  const so = Math.sin(omega)
  return out
    .copy(a)
    .multiplyScalar(Math.sin((1 - s) * omega) / so)
    .addScaledVector(b, Math.sin(s * omega) / so)
}

/** Тепловое колебание узла: медленное, детерминированное, без скачков между кадрами. */
function wobble(t: number, seed: number, out: THREE.Vector3): void {
  const w = 4.3 + (seed % 7) * 0.41
  out.set(
    Math.sin(t * w + seed * 2.399963),
    Math.sin(t * w * 0.81 + seed * 1.7182),
    Math.sin(t * w * 1.13 + seed * 0.9137),
  )
}

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleCaoFrame(t: number, frame: CaoFrame): CaoFrame {
  const { atoms, radius, charge, opacity, emissive } = frame
  const amp = sampleScalar(JITTER, t)

  // ——— Ионы кальция: как были Ca²⁺, так и остались; меняется только окружение ———
  for (const c of CA_DEFS) {
    const p = atoms[c.id]!
    sampleVec3(CA_POS[c.id]!, t, p)
    wobble(t, c.seed, _wob)
    p.addScaledVector(_wob, amp)
    radius[c.id] = R.ca
    charge[c.id] = 1
    opacity[c.id] = 1
  }

  // ——— Карбонатные группы: треугольник CO₃²⁻ → линейная CO₂ + оксид-ион ———
  for (const g of GROUP_DEFS) {
    const cId = `c${g.id}`
    const sId = `o${g.id}s`
    const aId = `o${g.id}a`
    const bId = `o${g.id}b`
    const cPos = atoms[cId]!
    sampleVec3(GROUP_POS[g.id]!, t, cPos)
    const gone = smoothstep(splitAt(g.id), escapeAt(g.id), t)
    wobble(t, g.id + 11, _wob)
    cPos.addScaledVector(_wob, amp * (1 - gone))

    const open = sampleScalar(GROUP_OPEN[g.id]!, t)
    const tilt = sampleScalar(GROUP_TILT[g.id]!, t)
    const len = mix(CO3_LEN, CO2_LEN, open)
    const theta = HALF_OPEN * (1 - open)
    const axis = g.phi + Math.PI / 2

    // Плоские направления двух «газовых» кислородов: 120° → 180° вокруг оси.
    _dirA.set(Math.cos(axis + theta), 0, Math.sin(axis + theta))
    _dirB.set(-Math.cos(axis - theta), 0, -Math.sin(axis - theta))
    if (tilt !== 0) {
      // Наклон антисимметричный — угол 180° сохраняется ТОЧНО.
      const ct = Math.cos(tilt)
      const st = Math.sin(tilt)
      _dirA.multiplyScalar(ct).addScaledVector(UP, st)
      _dirB.multiplyScalar(ct).addScaledVector(UP, -st)
    }

    const carb = g.id === 0 ? smoothstep(22.9, T_LIME, t) : 0
    if (carb > 0) {
      // Возврат к треугольнику CO₃²⁻ на шаге 5: поворот по дуге большого круга
      // (линейная интерполяция направлений прошла бы через вырожденную точку).
      const l = mix(len, CO3_LEN, carb)
      atoms[aId]!.copy(cPos).addScaledVector(slerpDir(_dirA, CARB_TARGET.a, carb, _tmp), l)
      atoms[bId]!.copy(cPos).addScaledVector(slerpDir(_dirB, CARB_TARGET.b, carb, _tmp2), l)
    } else {
      atoms[aId]!.copy(cPos).addScaledVector(_dirA, len)
      atoms[bId]!.copy(cPos).addScaledVector(_dirB, len)
    }

    // Кислород, который остаётся при кальции: сначала на связи, потом свободный ион.
    const detach = smoothstep(splitAt(g.id), splitAt(g.id) + 0.3, t)
    const sPos = atoms[sId]!
    sampleVec3(O_POS[sId]!, t, sPos)
    wobble(t, g.id + 11, _wob)
    sPos.addScaledVector(_wob, amp * (1 - detach))

    radius[sId] = sampleScalar(OXIDE_RADIUS[g.id]!, t)
    charge[sId] = sampleScalar(OXIDE_CHARGE[g.id]!, t)
    opacity[sId] = 1

    const gasA = sampleScalar(GROUP_OPACITY[g.id]!, t)
    radius[cId] = R.c
    radius[aId] = radius[bId] = R.oCov
    charge[cId] = 0.6
    charge[aId] = charge[bId] = mix(-0.6, -0.35, open)
    opacity[cId] = opacity[aId] = opacity[bId] = gasA
  }

  // ——— Шаг 5: формульная единица CaO, вода, гидроксилы, карбонат ———
  sampleDemo(t, frame)

  // ——— Связи ———
  const edges = sampleScalar(EDGES, t)
  for (let i = 0; i < CAO_BONDS.length; i++) {
    const b = CAO_BONDS[i]!
    let o = 0
    let stress = 0
    if (b.kind === 'edge') {
      o = edges * Math.min(opacity[b.a]!, opacity[b.b]!)
    } else if (b.kind === 'stay') {
      const g = Number(b.a.slice(1))
      const tS = splitAt(g)
      stress = smoothstep(tS - 2.2, tS, t)
      o = (1 - smoothstep(tS - 0.05, tS + 0.4, t)) * opacity[b.b]!
    } else if (b.kind === 'co2') {
      o = Math.min(opacity[b.a]!, opacity[b.b]!)
    } else {
      o = frame.bondOpacity[i]!
    }
    frame.bondOpacity[i] = o
    frame.bondStress[i] = stress
  }

  // ——— Электронная пара остаётся на кислороде (гетеролитический разрыв C–O) ———
  const tS0 = splitAt(0)
  sampleElectronJump(frame.electrons[0], t, {
    donor: atoms.c0!,
    acceptor: atoms.o0s!,
    shellRadius: R.c * 1.5,
    acceptorRadius: radius.o0s!,
    leave: tS0 - 0.15,
    arrive: tS0 + 0.55,
    arcSign: 1,
    arcHeight: 0.14,
    lead: 1.1,
  })
  sampleElectronJump(frame.electrons[1], t, {
    donor: atoms.c0!,
    acceptor: atoms.o0s!,
    shellRadius: R.c * 1.5,
    acceptorRadius: radius.o0s!,
    leave: tS0 - 0.05,
    arrive: tS0 + 0.7,
    arcSign: -1,
    arcHeight: 0.14,
    lead: 1.1,
  })
  frame.shell = windowFade([tS0 - 0.4, tS0 + 2.4], t, 0.5)
  frame.field = windowFade([T_ROCK - 1.6, 20.0], t, 0.7)

  // ——— Среда: накал печи, помутнение известковой воды, затемнение хвоста ———
  const kiln = sampleScalar(KILN, t)
  frame.env.kiln = kiln
  frame.env.cloud = windowFade([T_LIME - 0.25, 25.3], t, 0.55)
  frame.env.fade = sampleScalar(FADE, t)

  for (const a of CAO_ATOMS) {
    emissive[a.id] = 0.08 + kiln * 0.34 + (a.role === 'oxide' ? frame.shell * 0.2 : 0)
  }

  // ——— Центры ———
  frame.crystalCenter.set(0, 0, 0)
  let n = 0
  for (const c of CA_DEFS) {
    frame.crystalCenter.add(atoms[c.id]!)
    n++
  }
  frame.crystalCenter.multiplyScalar(1 / n)

  // ——— Подписи ———
  sampleLabels(
    CAO_LABELS,
    frame.labels,
    t,
    (def, st) => {
      const d = def as CaoLabelDef
      if (d.anchor === 'crystal') {
        st.pos.copy(frame.crystalCenter)
        st.pos.y += d.dy
      } else if (d.anchor === 'demo') {
        st.pos.copy(frame.demoCenter)
        st.pos.y += d.dy
      } else if (d.anchor === 'g0') {
        st.pos.copy(atoms.c0!)
        st.pos.y += d.dy
      } else {
        st.pos.copy(atoms[d.anchor]!)
        st.pos.y += d.dy > 0 ? radius[d.anchor]! + d.dy : -(radius[d.anchor]! - d.dy)
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
    0.34 * Math.max(0, 1 - Math.abs(t - T_SPLIT) / 0.5) +
    0.22 * Math.max(0, 1 - Math.abs(t - T_SLAKE) / 0.45) +
    0.3 * kiln * Math.max(0, 1 - Math.abs(t - T_HEAT) / 1.6)
  cam.bloom = 0.3 + 0.5 * kiln + 0.3 * frame.env.cloud
  cam.vignette = 0.3 + 0.16 * kiln
  return frame
}

const bondIndex = (a: string, b: string): number => {
  const i = CAO_BONDS.findIndex((x) => x.a === a && x.b === b)
  if (i < 0) throw new Error(`[cao] нет связи ${a}–${b}`)
  return i
}

const BOND_IX = {
  wOwH1: bondIndex('wO', 'wH1'),
  wOwH2: bondIndex('wO', 'wH2'),
  dOwH2: bondIndex('dO', 'wH2'),
  dOwH1: bondIndex('dO', 'wH1'),
  c0wO: bondIndex('c0', 'wO'),
} as const

/** Направление k-й связи карбоната шага 5 (k = 0, 1 — два «газовых» кислорода). */
function carbonateDir(k: 0 | 1, out: THREE.Vector3): THREE.Vector3 {
  const a = (k === 0 ? 120 : 240) * DEG
  return out
    .copy(CARB_N)
    .multiplyScalar(-Math.cos(a))
    .addScaledVector(CARB_M, Math.sin(a))
    .normalize()
}

/** Шаг 5: гашение извести и помутнение известковой воды на одной формульной единице. */
function sampleDemo(t: number, frame: CaoFrame): void {
  const { atoms, radius, charge, opacity } = frame
  const vis = sampleScalar(DEMO_OPACITY, t)
  const leave = sampleScalar(WATER_LEAVE, t)

  atoms.dCa!.copy(DEMO_CA)
  radius.dCa = R.ca
  charge.dCa = 1
  opacity.dCa = vis

  // Оксид-ион: после гашения он гидроксил, после карбонизации — кислород воды.
  const h1 = sampleScalar(H1_HOP, t)
  const h2 = sampleScalar(H2_HOP, t)
  atoms.dO!.copy(DEMO_O).lerp(WATER_OUT, leave)
  radius.dO = mix(R.oIon, R.oCov, h1)
  charge.dO = mix(-1, -0.45, h1)
  opacity.dO = vis

  // Кислород воды: приходит, садится гидроксилом на Ca²⁺, затем уходит в карбонат.
  const wVis = sampleScalar(WATER_OPACITY, t)
  sampleVec3(WATER_POS, t, atoms.wO!)
  radius.wO = R.oCov
  charge.wO = -0.45
  opacity.wO = wVis

  // Протон 1: H₂O + O²⁻ → 2 OH⁻ (настоящий механизм гашения извести).
  _tmp.copy(atoms.wO!).addScaledVector(H_DIR_B, OH_LEN)
  _tmp2.copy(atoms.dO!).addScaledVector(H_DIR_OXIDE, OH_LEN)
  atoms.wH1!.copy(_tmp).lerp(_tmp2, h1)
  atoms.wH1!.y += 0.16 * Math.sin(Math.PI * h1)

  // Протон 2: остаётся на кислороде воды, при карбонизации уходит к тому же O → H₂O.
  _tmp.copy(atoms.wO!).addScaledVector(H_DIR_A, OH_LEN)
  _tmp2.copy(atoms.dO!).addScaledVector(H_DIR_OXIDE2, OH_LEN)
  atoms.wH2!.copy(_tmp).lerp(_tmp2, h2)
  atoms.wH2!.y += 0.14 * Math.sin(Math.PI * h2)

  radius.wH1 = radius.wH2 = R.h
  charge.wH1 = charge.wH2 = 0.35
  opacity.wH1 = opacity.wH2 = wVis

  // Связи шага 5 (индексы в CAO_BONDS найдены один раз при загрузке модуля).
  const bonds = frame.bondOpacity
  bonds[BOND_IX.wOwH1] = wVis * (1 - h1)
  bonds[BOND_IX.wOwH2] = wVis * (1 - h2)
  bonds[BOND_IX.dOwH2] = wVis * h2
  bonds[BOND_IX.dOwH1] = wVis * h1
  bonds[BOND_IX.c0wO] = wVis * smoothstep(23.0, T_LIME, t) * (frame.opacity.c0 ?? 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Проверка раскадровки — в dev и в тесте сцены
// ─────────────────────────────────────────────────────────────────────────────

export function validateCaoStoryboard(): void {
  const vec: Record<string, Vec3Track> = { 'cam.offset': CAM_OFFSET, water: WATER_POS }
  for (const [id, track] of Object.entries(CA_POS)) vec[`ca.${id}`] = track
  for (const [id, track] of Object.entries(O_POS)) vec[`o.${id}`] = track
  for (const [id, track] of Object.entries(GROUP_POS)) vec[`g.${id}`] = track
  validateTracks(vec)

  const scal: Record<string, ScalarTrack> = {
    JITTER,
    EDGES,
    KILN,
    CAM_ZOOM,
    CAM_YAW,
    CAM_ROLL,
    FADE,
    DEMO_OPACITY,
    WATER_OPACITY,
    H1_HOP,
    H2_HOP,
    WATER_LEAVE,
  }
  for (const [id, track] of Object.entries(GROUP_OPEN)) scal[`open.${id}`] = track
  for (const [id, track] of Object.entries(GROUP_TILT)) scal[`tilt.${id}`] = track
  for (const [id, track] of Object.entries(GROUP_OPACITY)) scal[`gas.${id}`] = track
  for (const [id, track] of Object.entries(OXIDE_RADIUS)) scal[`rO.${id}`] = track
  for (const [id, track] of Object.entries(OXIDE_CHARGE)) scal[`qO.${id}`] = track
  validateTracks(scal)

  // Стехиометрия фрагмента: на каждый Ca²⁺ ровно один карбонат-ион.
  if (CA_DEFS.length !== GROUP_DEFS.length) {
    throw new Error(`cao: Ca²⁺ ${CA_DEFS.length} ≠ CO₃²⁻ ${GROUP_DEFS.length} — формула CaCO₃ нарушена`)
  }
  if (CAO_ATOMS.length !== CA_DEFS.length + GROUP_DEFS.length * 4 + 5) {
    throw new Error(`cao: неверный состав кадра, частиц ${CAO_ATOMS.length}`)
  }
  if (ROCK_SITES.length !== CA_DEFS.length + GROUP_DEFS.length) {
    throw new Error(`cao: узлов CaO ${ROCK_SITES.length}, а ионов ${CA_DEFS.length + GROUP_DEFS.length}`)
  }
  if (ROCK_SITES.filter((s) => s.cation).length !== CA_DEFS.length) {
    throw new Error('cao: в решётке CaO число катионных узлов обязано равняться числу Ca²⁺')
  }
  if (ROCK_EDGE_SITES.length !== 28) {
    throw new Error(`cao: во фрагменте 4×2×2 должно быть 28 рёбер, получилось ${ROCK_EDGE_SITES.length}`)
  }

  // Чередование зарядов: соседи в решётке всегда разноимённые.
  for (const [a, b] of ROCK_EDGE_SITES) {
    if (ROCK_SITES[a]!.cation === ROCK_SITES[b]!.cation) {
      throw new Error(`cao: узлы ${a} и ${b} одноимённые — решётка построена неверно`)
    }
  }

  // Физика размера: оксид-ион ВДВОЕ крупнее ковалентно связанного кислорода,
  // а Ca²⁺ меньше своего атома (ион кальция в обеих решётках один и тот же).
  if (!(R.oIon > R.oCov * 1.8)) throw new Error('cao: O²⁻ обязан быть заметно крупнее связанного кислорода')
  if (!(R.ca < speciesRadius('Ca', 0))) throw new Error('cao: катион Ca²⁺ обязан быть меньше атома Ca')

  // Геометрия справочника.
  if (!(CO2_LEN < CO3_LEN)) throw new Error('cao: связь C=O в CO₂ обязана быть короче C–O в карбонате')
  if (ANG_CO3 !== 120 || ANG_CO2 !== 180) throw new Error('cao: углы карбоната и CO₂ обязаны быть 120° и 180°')
  if (Math.abs(D_CAO * 2 - pmToScene(ROCK.cellPm.a)) > 1e-6) {
    throw new Error('cao: ребро ячейки CaO обязано равняться двум d(Ca–O)')
  }

  if (CAO_END <= 0) throw new Error('cao: пустой сюжет')
}
