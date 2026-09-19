import * as THREE from 'three'
import { getCrystal } from '../../../../chemistry/data'
import { smoothstep } from '../../core/easing'
import { sampleScalar, sampleVec3, type ScalarTrack, type Vec3Track } from '../../core/tracks'
import { bondLength, pmToScene, speciesRadius } from '../kit/cpkAtoms'
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
import { CO2_FACTS } from './co2Energetics'
import { CO2_FINISH, CO2_END, co2CueAt } from './co2Steps'

export {
  CO2_CUES,
  CO2_END,
  CO2_FINISH,
  CO2_SEGMENTS,
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
 * Вся химия — из src/chemistry/data (ни одного числа руками):
 *   • графит: P6₃/mmc (194), гексагональная, a = 246,12 пм, c = 670,9 пм,
 *     C–C внутри слоя 141,8 пм, КЧ 3, между слоями 335,45 пм = c/2, ρ = 2,266 г/см³;
 *   • O₂: длина связи 120,8 пм, D(O=O) = 498 кДж/моль, молекула ДВУХАТОМНАЯ;
 *   • CO₂: линейная, угол O=C=O = 180°, C=O 116,0 пм, E(C=O) = 799 кДж/моль,
 *     μ = 0 Д при Δχ(O − C) = 0,89 — связи полярны, молекула нет;
 *   • CO (угарный газ): C≡O 112,8 пм, 1072 кДж/моль — короче и прочнее, чем C=O.
 *
 * ЧТО НАРИСОВАНО СХЕМАТИЧНО (и так сказано в тексте урока):
 *   • фрагмент графита — 2 слоя по 24 атома («коронен»), в крупинке угля их 10²⁰ и больше;
 *   • sp-гибридные лепестки и π-облака — светящиеся точки, это ЗНАК области
 *     повышенной электронной плотности, а не изоповерхность волновой функции;
 *   • стрелки диполей связей — учебное обозначение вектора μ, а не объект микромира;
 *   • свободный атом C (г.) — ступень РАСЧЁТА по закону Гесса, а не частица пламени:
 *     уголь горит на поверхности твёрдой фазы.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия из научного ядра
// ─────────────────────────────────────────────────────────────────────────────

const GRAPHITE = getCrystal('graphite')!

/** C–C внутри слоя графита, мировые единицы. */
const D_CC = pmToScene(GRAPHITE.cationAnionPm)
/** Расстояние между слоями графита = c/2, мировые единицы. */
const D_LAYER = pmToScene(GRAPHITE.cellPm.c! / 2)
/** Длина связи O=O в молекуле кислорода. */
const D_OO = bondLength('O=O')
/** Длина связи C=O в CO₂. */
const D_CO = bondLength('C=O(CO2)')
/** Длина тройной связи C≡O в угарном газе. */
const D_CO3 = bondLength('C#O')
/** Длина связи O–H в воде. */
const D_OH = bondLength('O-H')

const R = {
  c: speciesRadius('C', 0),
  o: speciesRadius('O', 0),
  h: speciesRadius('H', 0),
} as const

export const CO2_GEOM = {
  radius: R,
  ccScene: D_CC,
  layerScene: D_LAYER,
  coScene: D_CO,
  ooScene: D_OO,
  /** справочные числа для подписей и тестов */
  data: CO2_FACTS,
} as const

/** Масштаб рига камеры: в кадре и решётка, и одна молекула — детали важны. */
export const CO2_RIG_SCALE = 1.12

// ─────────────────────────────────────────────────────────────────────────────
// Фрагмент графита: два слоя сот в укладке AB (Бернал)
// ─────────────────────────────────────────────────────────────────────────────

type Vec2 = readonly [number, number]

const SQ3 = Math.sqrt(3)
/** Векторы трансляции сот: a1 = (√3·d, 0), a2 = (√3·d/2, 3d/2). */
const A1: Vec2 = [SQ3 * D_CC, 0]
const A2: Vec2 = [(SQ3 * D_CC) / 2, 1.5 * D_CC]
/** Центр шестиугольника, вокруг которого вырезан фрагмент. */
const RING_CENTER: Vec2 = [(SQ3 * D_CC) / 2, D_CC / 2]
/**
 * Радиус выреза 2,7·d даёт ровно 24 атома: центральное кольцо плюс шесть
 * приросших — фрагмент строения коронена, 7 шестиугольников и 30 связей C–C.
 */
const FLAKE_R = 2.7 * D_CC

/** Плоские координаты одного слоя сот. */
function flakeSites(): Vec2[] {
  const out: Vec2[] = []
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      const bx = i * A1[0] + j * A2[0]
      const by = i * A1[1] + j * A2[1]
      // Две подрешётки сот: узел и смещённый на одну связь вверх.
      for (const dy of [0, D_CC]) {
        const u = bx - RING_CENTER[0]
        const v = by + dy - RING_CENTER[1]
        if (Math.hypot(u, v) <= FLAKE_R + 1e-6) out.push([u, v])
      }
    }
  }
  out.sort((p, q) => p[1] - q[1] || p[0] - q[0])
  return out
}

const SHEET: readonly Vec2[] = flakeSites()

/**
 * Укладка AB (Бернал): нижний слой сдвинут в плоскости ровно на ОДНУ связь C–C.
 * Тогда половина его атомов стоит точно под атомами верхнего слоя, а половина —
 * под центрами шестиугольников. Именно так уложен графит 2H (P6₃/mmc).
 */
const AB_SHIFT: Vec2 = [0, D_CC]

/** Наклон пластинки: видно и рисунок сот, и разделение на слои. */
const TILT_X = -0.95
const TILT_Y = 0.3
const E_U = new THREE.Vector3(Math.cos(TILT_Y), 0, -Math.sin(TILT_Y))
const E_V = new THREE.Vector3(
  Math.sin(TILT_Y) * Math.sin(TILT_X),
  Math.cos(TILT_X),
  Math.cos(TILT_Y) * Math.sin(TILT_X),
)
const E_W = new THREE.Vector3(
  Math.sin(TILT_Y) * Math.cos(TILT_X),
  -Math.sin(TILT_X),
  Math.cos(TILT_Y) * Math.cos(TILT_X),
)

/** Центр фрагмента графита в мире. */
const GRAPHITE_CENTER = new THREE.Vector3(-1.42, 0.16, -0.3)

function sheetToWorld(u: number, v: number, w: number): [number, number, number] {
  return [
    GRAPHITE_CENTER.x + u * E_U.x + v * E_V.x + w * E_W.x,
    GRAPHITE_CENTER.y + u * E_U.y + v * E_V.y + w * E_W.y,
    GRAPHITE_CENTER.z + u * E_U.z + v * E_V.z + w * E_W.z,
  ]
}

export type Co2AtomId =
  | 'c0'
  | 'oA'
  | 'oB'
  | 'coC'
  | 'coO'
  | 'wO'
  | 'wH1'
  | 'wH2'
  | `G${number}`
  | `B${number}`

type GraphiteAtom = {
  id: Co2AtomId
  layer: 0 | 1
  uv: Vec2
  pos: readonly [number, number, number]
}

const GRAPHITE_ATOMS: GraphiteAtom[] = []
{
  let n = 0
  for (const [u, v] of SHEET) {
    GRAPHITE_ATOMS.push({ id: `G${n++}` as Co2AtomId, layer: 0, uv: [u, v], pos: sheetToWorld(u, v, D_LAYER / 2) })
  }
  n = 0
  for (const [u, v] of SHEET) {
    const su = u + AB_SHIFT[0]
    const sv = v + AB_SHIFT[1]
    GRAPHITE_ATOMS.push({ id: `B${n++}` as Co2AtomId, layer: 1, uv: [su, sv], pos: sheetToWorld(su, sv, -D_LAYER / 2) })
  }
}

/** Связи C–C внутри слоёв: соседи на расстоянии ровно d = 141,8 пм. */
const GRAPHITE_BONDS_ALL: [Co2AtomId, Co2AtomId][] = (() => {
  const out: [Co2AtomId, Co2AtomId][] = []
  for (let i = 0; i < GRAPHITE_ATOMS.length; i++) {
    for (let j = i + 1; j < GRAPHITE_ATOMS.length; j++) {
      const a = GRAPHITE_ATOMS[i]!
      const b = GRAPHITE_ATOMS[j]!
      if (a.layer !== b.layer) continue
      const d = Math.hypot(a.uv[0] - b.uv[0], a.uv[1] - b.uv[1])
      if (Math.abs(d - D_CC) < 1e-4) out.push([a.id, b.id])
    }
  }
  return out
})()

/** Сколько соседей внутри слоя у атома фрагмента. */
const NEIGHBOURS = new Map<Co2AtomId, number>()
for (const [a, b] of GRAPHITE_BONDS_ALL) {
  NEIGHBOURS.set(a, (NEIGHBOURS.get(a) ?? 0) + 1)
  NEIGHBOURS.set(b, (NEIGHBOURS.get(b) ?? 0) + 1)
}

/**
 * Реагирующий атом — краевой атом ВЕРХНЕГО слоя, у которого только два соседа
 * (внутри слоя у углерода КЧ 3, на краю — 2). Берём самый правый: к нему
 * подлетает кислород, и его уход хорошо виден.
 */
const REACTING = (() => {
  const edge = GRAPHITE_ATOMS.filter((a) => a.layer === 0 && NEIGHBOURS.get(a.id) === 2)
  edge.sort((a, b) => b.pos[0] - a.pos[0])
  const pick = edge[0]
  if (!pick) throw new Error('co2: во фрагменте графита не нашлось краевого атома с двумя соседями')
  return pick
})()

/** Атомы фрагмента, которые остаются решёткой (реагирующий вынесен в «c0»). */
const LATTICE_ATOMS: readonly GraphiteAtom[] = GRAPHITE_ATOMS.filter((a) => a.id !== REACTING.id)
const LATTICE_IDS = new Set<string>(LATTICE_ATOMS.map((a) => a.id))

/** Связи фрагмента, НЕ затронутые реакцией. */
export const GRAPHITE_BONDS: readonly (readonly [Co2AtomId, Co2AtomId])[] = GRAPHITE_BONDS_ALL.filter(
  ([a, b]) => a !== REACTING.id && b !== REACTING.id,
)

/** Две связи, которые рвутся, когда атом углерода покидает слой. */
export const BREAKING_BONDS: readonly (readonly [Co2AtomId, Co2AtomId])[] = GRAPHITE_BONDS_ALL.filter(
  ([a, b]) => a === REACTING.id || b === REACTING.id,
).map(([a, b]) => (a === REACTING.id ? (['c0', b] as const) : (['c0', a] as const)))

const C0_SITE = REACTING.pos

// ─────────────────────────────────────────────────────────────────────────────
// Ключевые моменты
// ─────────────────────────────────────────────────────────────────────────────

const T_IGNITE = co2CueAt('ignite') // 3.4
const T_DETACH = co2CueAt('detach') // 6.6
const T_BREAK = co2CueAt('o2Break') // 10.0
const T_BOND1 = co2CueAt('bond1') // 12.2
const T_BOND2 = co2CueAt('bond2') // 14.6
const T_LINEAR = co2CueAt('linear') // 17.4
const T_DIPOLE = co2CueAt('dipole') // 19.6
const T_EXO = co2CueAt('exo') // 22.6
const T_CO_WARN = co2CueAt('coWarn') // 24.4

/** Молекула CO₂ строится вокруг этой точки; ось молекулы — мировой X. */
const MOL_HOME: readonly [number, number, number] = [0.33, 0.22, 0.2]

/**
 * Углы присоединения кислородов к оси X. Второй кислород подходит СБОКУ,
 * и промежуточная частица получается УГЛОВОЙ: угол O=C=O = 125° − (−30°) = 155°.
 * Отталкивание двух областей электронной плотности (VSEPR, две σ-связи без
 * неподелённых пар на углероде) разводит их на максимум — молекула выпрямляется в 180°.
 */
const THETA_A_BENT = -30 * (Math.PI / 180)
const THETA_B_BENT = 125 * (Math.PI / 180)
const THETA_A_LINEAR = 0
const THETA_B_LINEAR = Math.PI
/** Угол O=C=O в промежуточной УГЛОВОЙ частице до выпрямления, градусы: 155. */
export const CO2_BENT_ANGLE_DEG = Math.round((THETA_B_BENT - THETA_A_BENT) * (180 / Math.PI))

/** Молекула кислорода-реагента до разрыва: центр и ось. */
const O2_HOME = new THREE.Vector3(1.86, 0.5, 0.16)
const O2_AXIS = new THREE.Vector3(0.22, 0.95, 0.12).normalize()

const oxygenStart = (sign: number): [number, number, number] => [
  O2_HOME.x + sign * O2_AXIS.x * (D_OO / 2),
  O2_HOME.y + sign * O2_AXIS.y * (D_OO / 2),
  O2_HOME.z + sign * O2_AXIS.z * (D_OO / 2),
]

/** Куда кислород встаёт в момент образования связи (угловая конфигурация). */
const attachPoint = (theta: number): [number, number, number] => [
  MOL_HOME[0] + Math.cos(theta) * D_CO,
  MOL_HOME[1] + Math.sin(theta) * D_CO,
  MOL_HOME[2],
]

// ─────────────────────────────────────────────────────────────────────────────
// Дорожки положений
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Атом углерода уходит из слоя ПЕРПЕНДИКУЛЯРНО плоскости — так и отрывается
 * частица с поверхности, а не «сквозь» соседей по слою.
 */
const C0_LIFT: readonly [number, number, number] = [
  C0_SITE[0] + E_W.x * 0.24,
  C0_SITE[1] + E_W.y * 0.24,
  C0_SITE[2] + E_W.z * 0.24,
]

const POS: Partial<Record<Co2AtomId, Vec3Track>> = {
  // Атом углерода: сидит в слое, отрывается и становится центром будущей молекулы.
  // К моменту T_BOND1 он ОБЯЗАН стоять ровно в MOL_HOME: с этого мгновения
  // положения кислородов считаются от него, и любое расхождение дало бы рывок.
  c0: [
    { t: 0, v: C0_SITE },
    { t: T_DETACH - 0.5, v: C0_SITE },
    { t: T_DETACH + 0.45, v: C0_LIFT, ease: 'outSine' },
    { t: 9.4, v: [MOL_HOME[0] - 0.16, MOL_HOME[1] + 0.09, MOL_HOME[2] + 0.04], ease: 'smooth', arc: 0.1 },
    { t: 11.4, v: MOL_HOME, ease: 'smooth' },
    { t: CO2_END, v: MOL_HOME },
  ],
  // НИЖНИЙ атом кислорода идёт по нижнему пути и садится на углерод первым,
  // ВЕРХНИЙ обходит молекулу сверху и приходит вторым: пути двух половинок
  // разорванной молекулы расходятся сразу и нигде не пересекаются.
  oA: [
    { t: 0, v: oxygenStart(-1) },
    { t: 6.0, v: oxygenStart(-1) },
    { t: T_BREAK, v: [1.83, 0.31, 0.12], ease: 'smooth' },
    { t: T_BOND1, v: attachPoint(THETA_A_BENT), ease: 'smooth', arc: 0.08 },
    { t: CO2_END, v: attachPoint(THETA_A_BENT) },
  ],
  oB: [
    { t: 0, v: oxygenStart(1) },
    { t: 6.0, v: oxygenStart(1) },
    { t: T_BREAK, v: [1.78, 0.68, 0.18], ease: 'smooth' },
    { t: 11.6, v: [1.35, 0.85, 0.3], ease: 'smooth' },
    { t: 13.2, v: [0.62, 1.0, 0.34], ease: 'smooth' },
    { t: T_BOND2, v: attachPoint(THETA_B_BENT), ease: 'smooth' },
    { t: CO2_END, v: attachPoint(THETA_B_BENT) },
  ],
  // Камео воды на шаге «полярность»: CO₂ + H₂O ⇌ H₂CO₃.
  wO: [
    { t: 19.2, v: [0.62, -1.45, 0.5] },
    { t: 20.6, v: [0.6, -0.62, 0.38], ease: 'smooth' },
    { t: CO2_END, v: [0.6, -0.62, 0.38] },
  ],
}

/** Угарный газ: неподвижная «призрачная» молекула-предупреждение. */
const CO_CENTER: readonly [number, number, number] = [1.42, -0.92, 0.12]
POS.coC = [{ t: 0, v: [CO_CENTER[0] - D_CO3 / 2, CO_CENTER[1], CO_CENTER[2]] }]
POS.coO = [{ t: 0, v: [CO_CENTER[0] + D_CO3 / 2, CO_CENTER[1], CO_CENTER[2]] }]

/** Решётка графита неподвижна. */
for (const a of LATTICE_ATOMS) POS[a.id] = [{ t: 0, v: a.pos }]

// ─────────────────────────────────────────────────────────────────────────────
// Скалярные дорожки
// ─────────────────────────────────────────────────────────────────────────────

/** Угол связи C=O к оси X: молекула выпрямляется из угловой в линейную. */
const THETA_A: ScalarTrack = [
  { t: 0, v: THETA_A_BENT },
  { t: 15.2, v: THETA_A_BENT },
  { t: T_LINEAR, v: THETA_A_LINEAR, ease: 'inOutSine' },
]
const THETA_B: ScalarTrack = [
  { t: 0, v: THETA_B_BENT },
  { t: 15.2, v: THETA_B_BENT },
  { t: T_LINEAR, v: THETA_B_LINEAR, ease: 'inOutSine' },
]

/** Насколько кислород «пристёгнут» к углероду (0 — свободный полёт, 1 — связан). */
const ATTACH_A = rampTrack(T_BOND1 - 0.45, 0, T_BOND1 + 0.2, 1, 'smooth')
const ATTACH_B = rampTrack(T_BOND2 - 0.45, 0, T_BOND2 + 0.2, 1, 'smooth')

/** Связь O=O: натяжение, затем ГОМОЛИТИЧЕСКИЙ разрыв (split = 0, пара делится поровну). */
const O2_STRESS = rampTrack(7.6, 0, T_BREAK, 1, 'inQuad')
const O2_THIN = rampTrack(T_BREAK - 0.2, 0, T_BREAK + 0.4, 1, 'outCubic')
const O2_OPACITY = rampTrack(T_BREAK, 1, T_BREAK + 0.65, 0, 'smooth')

/** Связи C=O: волна образования. */
const FORM_A = rampTrack(T_BOND1 - 0.25, 0, T_BOND1 + 0.75, 1, 'smooth')
const FORM_B = rampTrack(T_BOND2 - 0.25, 0, T_BOND2 + 0.75, 1, 'smooth')
const BOND_A_OPACITY = appearTrack(T_BOND1 - 0.2, 0.5)
const BOND_B_OPACITY = appearTrack(T_BOND2 - 0.2, 0.5)

/** Две связи, которые рвутся при уходе атома из слоя. */
const EDGE_STRESS = rampTrack(5.1, 0, T_DETACH, 1, 'inQuad')
const EDGE_THIN = rampTrack(T_DETACH - 0.2, 0, T_DETACH + 0.35, 1, 'outCubic')
const EDGE_OPACITY = rampTrack(T_DETACH, 1, T_DETACH + 0.55, 0, 'smooth')

/** Фрагмент графита: виден всю сцену, но на шагах про молекулу уходит на второй план. */
const GRAPHITE_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 0.8, v: 1, ease: 'smooth' },
  { t: 13.4, v: 1 },
  { t: 15.4, v: 0.34, ease: 'smooth' },
  { t: 21.6, v: 0.34 },
  { t: 23.0, v: 0.8, ease: 'smooth' },
]
const GRAPHITE_BOND_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 1.0, v: 0.72, ease: 'smooth' },
  { t: 13.4, v: 0.72 },
  { t: 15.4, v: 0.2, ease: 'smooth' },
  { t: 21.6, v: 0.2 },
  { t: 23.0, v: 0.5, ease: 'smooth' },
]

/** Раскалённый уголь: разгорается к моменту поджига и снова вспыхивает на экзоэффекте. */
const HEAT: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 2.2, v: 0.15, ease: 'smooth' },
  { t: T_IGNITE, v: 0.75, ease: 'smooth' },
  { t: 8.4, v: 0.5, ease: 'smooth' },
  { t: 15.4, v: 0.22, ease: 'smooth' },
  { t: T_EXO, v: 1, ease: 'smooth' },
  { t: CO2_END, v: 0.72, ease: 'smooth' },
]

/** Фоновые молекулы кислорода: газ вокруг угля. Уходят, когда камера берёт молекулу крупно. */
const BG_OPACITY: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 1.2, v: 0.75, ease: 'smooth' },
  { t: 12.6, v: 0.75 },
  { t: 14.4, v: 0, ease: 'smooth' },
]

/** sp-гибридные лепестки на углероде: показаны, пока молекула выпрямляется. */
const SP: ScalarTrack = [
  { t: 14.0, v: 0 },
  { t: 15.4, v: 1, ease: 'smooth' },
  { t: 18.2, v: 1 },
  { t: 19.2, v: 0, ease: 'smooth' },
]
/** π-облака над и под осью молекулы (и в перпендикулярной плоскости). */
const PI: ScalarTrack = [
  { t: 15.8, v: 0 },
  { t: T_LINEAR, v: 1, ease: 'smooth' },
  { t: 18.6, v: 1 },
  { t: 19.6, v: 0.25, ease: 'smooth' },
  { t: 21.6, v: 0, ease: 'smooth' },
]
/** Стрелки дипольных моментов связей и их взаимное гашение. */
const DIPOLE: ScalarTrack = [
  { t: 18.4, v: 0 },
  { t: T_DIPOLE, v: 1, ease: 'smooth' },
  { t: 21.2, v: 1 },
  { t: 21.6, v: 0, ease: 'smooth' },
]
/** Частичные заряды δ+ / δ−: появляются вместе с разговором о полярности. */
const PARTIAL = rampTrack(18.2, 0, T_DIPOLE, 1, 'smooth')

/** Камео воды: приходит и уходит внутри шага «полярность». */
const WATER: ScalarTrack = [
  { t: 19.2, v: 0 },
  { t: 20.2, v: 0.9, ease: 'smooth' },
  { t: 21.2, v: 0.9 },
  { t: 21.6, v: 0, ease: 'smooth' },
]

/** Предупреждение про угарный газ на шаге 6. */
const CO_WARN: ScalarTrack = [
  { t: T_CO_WARN - 0.6, v: 0 },
  { t: T_CO_WARN + 0.5, v: 0.85, ease: 'smooth' },
  { t: 25.6, v: 0.85 },
  { t: CO2_FINISH.to, v: 0, ease: 'smooth' },
]

const CAM_ZOOM: ScalarTrack = [
  { t: 0, v: 0.72 },
  { t: 3.6, v: 0.82, ease: 'smooth' },
  { t: T_DETACH, v: 1.02, ease: 'smooth' },
  { t: 9.2, v: 0.96, ease: 'smooth' },
  { t: T_BOND1, v: 1.12, ease: 'smooth' },
  { t: T_LINEAR, v: 1.3, ease: 'smooth' },
  { t: T_DIPOLE, v: 1.24, ease: 'smooth' },
  { t: 21.6, v: 1.2 },
  { t: T_EXO, v: 0.78, ease: 'smooth' },
  { t: 25.4, v: 0.7, ease: 'smooth' },
]
const CAM_YAW: ScalarTrack = [
  { t: 0, v: -0.1 },
  { t: 4.2, v: -0.26, ease: 'smooth' },
  { t: 9.0, v: -0.05, ease: 'smooth' },
  { t: 13.4, v: 0.08, ease: 'smooth' },
  { t: T_LINEAR, v: 0.46, ease: 'smooth' },
  { t: 18.8, v: 0.02, ease: 'smooth' },
  { t: 21.6, v: 0.02 },
  { t: 24.4, v: -0.22, ease: 'smooth' },
]
const CAM_ROLL: ScalarTrack = [
  { t: 0, v: 0 },
  { t: 13.4, v: 0 },
  { t: T_LINEAR, v: -0.1, ease: 'smooth' },
  { t: 19.0, v: 0, ease: 'smooth' },
]
const CAM_OFFSET: Vec3Track = [
  { t: 0, v: [-0.1, 0.04, 0] },
  { t: T_DETACH, v: [-0.42, 0.3, 0], ease: 'smooth' },
  { t: 9.6, v: [0.1, 0.28, 0], ease: 'smooth' },
  { t: T_BOND1, v: [0.32, 0.2, 0], ease: 'smooth' },
  { t: T_LINEAR, v: [0.33, 0.2, 0], ease: 'smooth' },
  { t: T_DIPOLE, v: [0.34, 0.06, 0], ease: 'smooth' },
  { t: 21.6, v: [0.34, 0.06, 0] },
  { t: T_EXO, v: [0.0, -0.04, 0], ease: 'smooth' },
]
const FADE = fadeTrack(CO2_FINISH)

// ─────────────────────────────────────────────────────────────────────────────
// Подписи в 3D
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Тексты подписей НЕ переводятся: это формулы, числа и обозначения СИ
 * («O₂ (г.)», «116 пм», «180°», «μ = 0 D»). Агрегатные состояния и единицы
 * идут ТОКЕНАМИ ({s}, {g}, {pm}, {kJmol}) — сцена подставляет язык один раз
 * за кадр через localizeSceneLabels(). Все словесные пояснения живут
 * в co2MechanismText.{ts,en.ts,uz.ts} и показываются панелью урока.
 */
export type Co2LabelDef = SceneLabelDef & {
  anchor: Co2AtomId | 'flake' | 'mol' | 'o2' | 'co' | 'water' | 'piUp'
}

const CC_PM = CO2_FACTS.graphite.ccPm
const LAYER_PM = Math.round(CO2_FACTS.graphite.layerPm)
const CO_PM = Math.round(CO2_FACTS.coPm)
const OO_PM = CO2_FACTS.o2Pm
const CO3_PM = CO2_FACTS.coTriplePm

/**
 * dy соседних подписей одного якоря разведены минимум на 0.44 мировых единицы,
 * иначе строки налезают друг на друга; пересекающиеся по времени подписи
 * не ставятся на одну высоту.
 */
export const CO2_LABELS: readonly Co2LabelDef[] = [
  // ——— Шаг 1: графит и кислород ———
  { id: 'flake', kind: 'species', anchor: 'flake', dy: 1.45, keys: [{ t: 0, text: 'C ({s})' }], windows: [[0.7, 8.6]] },
  { id: 'sg', kind: 'token', anchor: 'flake', dy: 1.0, keys: [{ t: 0, text: CO2_FACTS.graphite.spaceGroup }], windows: [[1.4, 5.2]] },
  { id: 'cc', kind: 'delta', anchor: 'flake', dy: -1.0, keys: [{ t: 0, text: `C–C  ${CC_PM} {pm}` }], windows: [[1.8, 6.2]] },
  { id: 'layers', kind: 'delta', anchor: 'flake', dy: -1.46, keys: [{ t: 0, text: `${LAYER_PM} {pm}` }], windows: [[2.4, 6.2]] },
  { id: 'o2', kind: 'species', anchor: 'o2', dy: 0.48, keys: [{ t: 0, text: 'O₂ ({g})' }], windows: [[0.7, T_BREAK - 0.1]] },
  { id: 'oo', kind: 'delta', anchor: 'o2', dy: -0.48, keys: [{ t: 0, text: `${OO_PM} {pm}` }], windows: [[1.8, 5.4]] },

  // ——— Шаг 2–3: свободные атомы (ступень РАСЧЁТА, см. note в тексте шага) ———
  { id: 'cFree', kind: 'species', anchor: 'c0', dy: 0.22, keys: [{ t: 0, text: 'C' }], windows: [[T_DETACH + 0.4, T_BOND1 - 0.2]] },
  { id: 'oAfree', kind: 'species', anchor: 'oA', dy: 0.2, keys: [{ t: 0, text: 'O' }], windows: [[T_BREAK + 0.4, T_BOND1 - 0.2]] },
  { id: 'oBfree', kind: 'species', anchor: 'oB', dy: 0.2, keys: [{ t: 0, text: 'O' }], windows: [[T_BREAK + 0.4, T_BOND2 - 0.2]] },

  // ——— Шаг 4: готовая молекула ———
  { id: 'mol', kind: 'species', anchor: 'mol', dy: -1.05, keys: [{ t: 0, text: 'O=C=O ({g})' }], windows: [[T_LINEAR - 0.4, 25.6]] },
  { id: 'coLen', kind: 'delta', anchor: 'mol', dy: 0.68, keys: [{ t: 0, text: `C=O  ${CO_PM} {pm}` }], windows: [[T_LINEAR - 0.2, 19.2]] },
  { id: 'angle', kind: 'delta', anchor: 'mol', dy: 1.14, keys: [{ t: 0, text: `${CO2_FACTS.angleDeg}°` }], windows: [[T_LINEAR, 19.2]] },
  { id: 'sp', kind: 'token', anchor: 'c0', dy: -0.3, keys: [{ t: 0, text: 'sp' }], windows: [[15.6, 18.7]] },
  { id: 'pi', kind: 'token', anchor: 'piUp', dy: 0.16, keys: [{ t: 0, text: 'π' }], windows: [[T_LINEAR - 0.2, 18.7]] },

  // ——— Шаг 5: полярность ———
  { id: 'dqC', kind: 'ox', anchor: 'c0', dy: 0.26, keys: [{ t: 0, text: 'δ+' }], windows: [[18.8, 21.4]] },
  { id: 'dqA', kind: 'ox', anchor: 'oA', dy: 0.24, keys: [{ t: 0, text: 'δ−' }], windows: [[18.8, 21.4]] },
  { id: 'dqB', kind: 'ox', anchor: 'oB', dy: 0.24, keys: [{ t: 0, text: 'δ−' }], windows: [[18.8, 21.4]] },
  { id: 'chi', kind: 'delta', anchor: 'mol', dy: 1.14, keys: [{ t: 0, text: `Δχ = ${CO2_FACTS.deltaChi}` }], windows: [[19.3, 21.2]] },
  { id: 'mu', kind: 'delta', anchor: 'mol', dy: 0.68, keys: [{ t: 0, text: `μ = ${CO2_FACTS.dipoleD} D` }], windows: [[T_DIPOLE, 21.5]] },
  { id: 'acid', kind: 'token', anchor: 'water', dy: -0.5, keys: [{ t: 0, text: 'CO₂ + H₂O ⇌ H₂CO₃' }], windows: [[20.4, 21.5]] },

  // ——— Шаг 6: энергия и предупреждение про угарный газ ———
  { id: 'dH', kind: 'delta', anchor: 'mol', dy: 0.68, keys: [{ t: 0, text: `ΔH°f = ${CO2_FACTS.dHfText} {kJmol}` }], windows: [[T_EXO, 25.6]] },
  { id: 'coWarn', kind: 'species', anchor: 'co', dy: 0.46, keys: [{ t: 0, text: 'C≡O ({g})' }], windows: [[T_CO_WARN, 25.6]] },
  { id: 'coEq', kind: 'token', anchor: 'co', dy: -0.46, keys: [{ t: 0, text: '2 C + O₂ → 2 CO' }], windows: [[T_CO_WARN + 0.2, 25.6]] },
  { id: 'coDh', kind: 'delta', anchor: 'co', dy: -0.94, keys: [{ t: 0, text: `${CO2_FACTS.coDHfText} {kJmol} · ${CO3_PM} {pm}` }], windows: [[T_CO_WARN + 0.4, 25.6]] },
]

export type Co2LabelState = SceneLabelState

// ─────────────────────────────────────────────────────────────────────────────
// Кадр
// ─────────────────────────────────────────────────────────────────────────────

export const CO2_ATOMS: readonly { id: Co2AtomId; el: 'C' | 'O' | 'H' }[] = [
  { id: 'c0', el: 'C' },
  { id: 'oA', el: 'O' },
  { id: 'oB', el: 'O' },
  ...LATTICE_ATOMS.map((a) => ({ id: a.id, el: 'C' as const })),
  { id: 'coC', el: 'C' },
  { id: 'coO', el: 'O' },
  { id: 'wO', el: 'O' },
  { id: 'wH1', el: 'H' },
  { id: 'wH2', el: 'H' },
]

/** Фоновые молекулы кислорода: центр и ось (газ вокруг раскалённого угля). */
export const BACKGROUND_O2: readonly { center: readonly [number, number, number]; axis: readonly [number, number, number]; seed: number }[] = [
  { center: [1.62, -1.12, -0.78], axis: [0.86, 0.32, 0.4], seed: 1 },
  { center: [0.42, 1.34, -0.92], axis: [0.3, -0.5, 0.81], seed: 2 },
]

export type Co2Frame = {
  atoms: Record<Co2AtomId, THREE.Vector3>
  radius: Record<Co2AtomId, number>
  charge: Record<Co2AtomId, number>
  opacity: Record<Co2AtomId, number>
  emissive: Record<Co2AtomId, number>
  /** связь O=O реагента */
  o2Bond: { stress: number; thinning: number; opacity: number }
  /** две связи C=O продукта */
  coBond: { formA: number; formB: number; opacityA: number; opacityB: number }
  /** рвущиеся связи атома, уходящего из слоя */
  edgeBond: { stress: number; thinning: number; opacity: number }
  graphite: { opacity: number; bondOpacity: number; heat: number }
  /** фоновые молекулы O₂ */
  bg: { opacity: number; pos: THREE.Vector3[] }
  /** sp-лепестки, π-облака, стрелки диполей, камео воды, предупреждение про CO */
  sp: number
  pi: number
  dipole: number
  water: number
  coWarn: number
  env: { exo: number; fade: number }
  labels: Co2LabelState[]
  camera: { zoom: number; offset: THREE.Vector3; yaw: number; roll: number; shake: number; bloom: number; vignette: number }
  /** центр молекулы CO₂ = положение атома углерода */
  molCenter: THREE.Vector3
  /** точка над осью молекулы — якорь подписи π */
  piAnchor: THREE.Vector3
  graphiteCenter: THREE.Vector3
  o2Center: THREE.Vector3
  coCenter: THREE.Vector3
}

export function createCo2Frame(): Co2Frame {
  const atoms = {} as Record<Co2AtomId, THREE.Vector3>
  const radius = {} as Record<Co2AtomId, number>
  const charge = {} as Record<Co2AtomId, number>
  const opacity = {} as Record<Co2AtomId, number>
  const emissive = {} as Record<Co2AtomId, number>
  for (const a of CO2_ATOMS) {
    atoms[a.id] = new THREE.Vector3()
    radius[a.id] = a.el === 'C' ? R.c : a.el === 'O' ? R.o : R.h
    charge[a.id] = 0
    opacity[a.id] = 0
    emissive[a.id] = 0.08
  }
  return {
    atoms,
    radius,
    charge,
    opacity,
    emissive,
    o2Bond: { stress: 0, thinning: 0, opacity: 1 },
    coBond: { formA: 0, formB: 0, opacityA: 0, opacityB: 0 },
    edgeBond: { stress: 0, thinning: 0, opacity: 1 },
    graphite: { opacity: 0, bondOpacity: 0, heat: 0 },
    bg: { opacity: 0, pos: BACKGROUND_O2.flatMap(() => [new THREE.Vector3(), new THREE.Vector3()]) },
    sp: 0,
    pi: 0,
    dipole: 0,
    water: 0,
    coWarn: 0,
    env: { exo: 0, fade: 0 },
    labels: createLabelStates(CO2_LABELS),
    camera: { zoom: 1, offset: new THREE.Vector3(), yaw: 0, roll: 0, shake: 0, bloom: 0.3, vignette: 0.3 },
    molCenter: new THREE.Vector3(),
    piAnchor: new THREE.Vector3(),
    graphiteCenter: GRAPHITE_CENTER.clone(),
    o2Center: O2_HOME.clone(),
    coCenter: new THREE.Vector3(CO_CENTER[0], CO_CENTER[1], CO_CENTER[2]),
  }
}

const _free = new THREE.Vector3()

/** Записывает кадр сюжета для момента t в заранее созданный frame (без аллокаций). */
export function sampleCo2Frame(t: number, frame: Co2Frame): Co2Frame {
  const { atoms, radius, charge, opacity, emissive } = frame

  for (const a of CO2_ATOMS) {
    const track = POS[a.id]
    if (track) sampleVec3(track, t, atoms[a.id])
  }

  // ——— Кислороды: свободный полёт ↔ жёсткая посадка на связь C=O ———
  // После присоединения положение считается ОТ углерода: длина связи всегда
  // ровно 116,0 пм, а поворот к 180° идёт по углу, а не по прямой.
  const molC = atoms.c0
  for (const [id, thetaTrack, attachTrack] of [
    ['oA', THETA_A, ATTACH_A],
    ['oB', THETA_B, ATTACH_B],
  ] as const) {
    const w = sampleScalar(attachTrack, t)
    if (w <= 0) continue
    const theta = sampleScalar(thetaTrack, t)
    _free.copy(atoms[id])
    atoms[id].set(molC.x + Math.cos(theta) * D_CO, molC.y + Math.sin(theta) * D_CO, molC.z)
    // w < 1 — короткая «притирка»: дорожка свободного полёта заканчивается ровно
    // в этой же точке, поэтому шва нет ни на входе, ни на выходе.
    if (w < 1) atoms[id].lerp(_free, 1 - w)
  }

  // ——— Вода: два водорода на своём кислороде, угол 104,45° ———
  const wo = atoms.wO
  const half = (104.45 / 2) * (Math.PI / 180)
  atoms.wH1.set(wo.x + Math.sin(half) * D_OH, wo.y + Math.cos(half) * D_OH, wo.z)
  atoms.wH2.set(wo.x - Math.sin(half) * D_OH, wo.y + Math.cos(half) * D_OH, wo.z)

  // ——— Прозрачности ———
  const gA = sampleScalar(GRAPHITE_OPACITY, t)
  frame.graphite.opacity = gA
  frame.graphite.bondOpacity = sampleScalar(GRAPHITE_BOND_OPACITY, t)
  frame.graphite.heat = sampleScalar(HEAT, t)
  for (const a of LATTICE_ATOMS) opacity[a.id] = gA

  // Реагирующий атом: пока он в слое — живёт по прозрачности решётки, потом всегда виден.
  const detached = smoothstep(T_DETACH - 0.6, T_DETACH + 0.2, t)
  opacity.c0 = Math.max(gA, detached)
  opacity.oA = smoothstep(0.6, 1.4, t)
  opacity.oB = opacity.oA
  frame.bg.opacity = sampleScalar(BG_OPACITY, t)

  frame.water = sampleScalar(WATER, t)
  opacity.wO = opacity.wH1 = opacity.wH2 = frame.water
  frame.coWarn = sampleScalar(CO_WARN, t)
  opacity.coC = opacity.coO = frame.coWarn

  // ——— Фоновые молекулы кислорода: медленный дрейф ———
  for (let k = 0; k < BACKGROUND_O2.length; k++) {
    const m = BACKGROUND_O2[k]!
    const s = m.seed
    const dx = 0.12 * Math.sin(t * 0.32 + s * 1.7)
    const dy = 0.1 * Math.sin(t * 0.27 + s * 2.9)
    const dz = 0.1 * Math.sin(t * 0.21 + s * 0.8)
    const spin = t * 0.24 + s
    const ax = m.axis[0] * Math.cos(spin) - m.axis[2] * Math.sin(spin)
    const az = m.axis[0] * Math.sin(spin) + m.axis[2] * Math.cos(spin)
    const len = Math.hypot(ax, m.axis[1], az) || 1
    const hx = (ax / len) * (D_OO / 2)
    const hy = (m.axis[1] / len) * (D_OO / 2)
    const hz = (az / len) * (D_OO / 2)
    frame.bg.pos[k * 2]!.set(m.center[0] + dx + hx, m.center[1] + dy + hy, m.center[2] + dz + hz)
    frame.bg.pos[k * 2 + 1]!.set(m.center[0] + dx - hx, m.center[1] + dy - hy, m.center[2] + dz - hz)
  }

  // ——— Связи ———
  frame.o2Bond.stress = sampleScalar(O2_STRESS, t)
  frame.o2Bond.thinning = sampleScalar(O2_THIN, t)
  frame.o2Bond.opacity = sampleScalar(O2_OPACITY, t)
  frame.edgeBond.stress = sampleScalar(EDGE_STRESS, t)
  frame.edgeBond.thinning = sampleScalar(EDGE_THIN, t)
  frame.edgeBond.opacity = sampleScalar(EDGE_OPACITY, t) * gA
  frame.coBond.formA = sampleScalar(FORM_A, t)
  frame.coBond.formB = sampleScalar(FORM_B, t)
  frame.coBond.opacityA = sampleScalar(BOND_A_OPACITY, t)
  frame.coBond.opacityB = sampleScalar(BOND_B_OPACITY, t)

  // ——— Орбитали, диполи, энергия ———
  frame.sp = sampleScalar(SP, t)
  frame.pi = sampleScalar(PI, t)
  frame.dipole = sampleScalar(DIPOLE, t)

  // Частичные заряды: связь ПОЛЯРНА (Δχ = 0,89), поэтому δ+ на углероде и δ− на кислородах.
  // Это НЕ ионы: значения дробные и нарисованы только для окраски кромки.
  const partial = sampleScalar(PARTIAL, t)
  charge.c0 = 0.55 * partial
  charge.oA = charge.oB = -0.4 * partial

  const exo = smoothstep(T_EXO - 0.8, T_EXO, t) * (1 - 0.5 * smoothstep(T_EXO, T_EXO + 1.8, t))
  frame.env.exo = exo
  frame.env.fade = sampleScalar(FADE, t)

  const heat = frame.graphite.heat
  for (const a of CO2_ATOMS) {
    // Углерод по CPK почти чёрный (0x2a2a32), поэтому решётке дан собственный
    // базовый свет: иначе фрагмент графита сливается с ночным фоном сцены.
    let e = (LATTICE_IDS.has(a.id) ? 0.22 + heat * 0.5 : 0.08) + exo * 0.4
    if (a.id === 'c0') e = 0.22 + heat * 0.5 * (1 - detached) + frame.coBond.formA * 0.18 + exo * 0.4
    if (a.id === 'coC' || a.id === 'coO') e = 0.08 + frame.coWarn * 0.3
    emissive[a.id] = e
  }

  // Радиусы неизменны: в ковалентной реакции ионов не образуется, атом остаётся атомом.
  for (const a of CO2_ATOMS) radius[a.id] = a.el === 'C' ? R.c : a.el === 'O' ? R.o : R.h

  // ——— Якоря ———
  frame.molCenter.copy(molC)
  // Якорь подписи «π» — над серединой ЛЕВОЙ связи C=O, чтобы не спорить с подписями
  // длины и угла, которые висят над центром молекулы.
  frame.piAnchor.set(molC.x - D_CO * 0.5, molC.y + 0.4, molC.z)
  frame.o2Center.copy(atoms.oA).lerp(atoms.oB, 0.5)

  // ——— Подписи ———
  sampleLabels(
    CO2_LABELS,
    frame.labels,
    t,
    (def, st) => {
      const d = def as Co2LabelDef
      if (d.anchor === 'flake') {
        st.pos.copy(frame.graphiteCenter)
        st.pos.y += d.dy
      } else if (d.anchor === 'mol') {
        st.pos.copy(frame.molCenter)
        st.pos.y += d.dy
      } else if (d.anchor === 'o2') {
        st.pos.copy(frame.o2Center)
        st.pos.y += d.dy
        st.pos.x += 0.3
      } else if (d.anchor === 'co') {
        st.pos.copy(frame.coCenter)
        st.pos.y += d.dy
      } else if (d.anchor === 'water') {
        st.pos.copy(atoms.wO)
        st.pos.y += d.dy
      } else if (d.anchor === 'piUp') {
        st.pos.copy(frame.piAnchor)
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
    0.26 * Math.max(0, 1 - Math.abs(t - T_DETACH) / 0.35) +
    0.28 * Math.max(0, 1 - Math.abs(t - T_BREAK) / 0.35) +
    0.5 * Math.max(0, 1 - Math.abs(t - T_EXO) / 0.5)
  cam.bloom = 0.3 + 0.3 * heat + 0.7 * exo
  cam.vignette = 0.3 + 0.15 * exo
  return frame
}

// ─────────────────────────────────────────────────────────────────────────────
// Проверка раскадровки — в dev и в тесте сцены
// ─────────────────────────────────────────────────────────────────────────────

export function validateCo2Storyboard(): void {
  const vec: Record<string, Vec3Track> = {}
  for (const [id, track] of Object.entries(POS)) if (track) vec[`pos.${id}`] = track
  vec['cam.offset'] = CAM_OFFSET
  validateTracks(vec)
  validateTracks({
    THETA_A,
    THETA_B,
    ATTACH_A,
    ATTACH_B,
    O2_STRESS,
    O2_THIN,
    O2_OPACITY,
    FORM_A,
    FORM_B,
    BOND_A_OPACITY,
    BOND_B_OPACITY,
    EDGE_STRESS,
    EDGE_THIN,
    EDGE_OPACITY,
    GRAPHITE_OPACITY,
    GRAPHITE_BOND_OPACITY,
    HEAT,
    BG_OPACITY,
    SP,
    PI,
    DIPOLE,
    PARTIAL,
    WATER,
    CO_WARN,
    CAM_ZOOM,
    CAM_YAW,
    CAM_ROLL,
    FADE,
  })

  // ——— Фрагмент графита ———
  if (SHEET.length !== 24) throw new Error(`co2: в слое фрагмента ожидалось 24 атома (коронен), получилось ${SHEET.length}`)
  if (GRAPHITE_ATOMS.length !== 48) throw new Error(`co2: два слоя = 48 атомов, получилось ${GRAPHITE_ATOMS.length}`)
  if (GRAPHITE_BONDS_ALL.length !== 60) throw new Error(`co2: во фрагменте ожидалось 60 связей C–C, получилось ${GRAPHITE_BONDS_ALL.length}`)
  if (BREAKING_BONDS.length !== 2) throw new Error(`co2: краевой атом обязан держаться на двух связях, получилось ${BREAKING_BONDS.length}`)
  if (GRAPHITE_BONDS.length !== 58) throw new Error(`co2: после ухода атома должно остаться 58 связей, получилось ${GRAPHITE_BONDS.length}`)

  // КЧ углерода внутри слоя ровно 3 — иначе соты построены неверно.
  const inner = GRAPHITE_ATOMS.filter((a) => (NEIGHBOURS.get(a.id) ?? 0) === 3)
  if (inner.length !== 2 * 12) throw new Error(`co2: у фрагмента коронена 12 атомов на слой с КЧ 3, получилось ${inner.length / 2}`)
  for (const a of GRAPHITE_ATOMS) {
    const n = NEIGHBOURS.get(a.id) ?? 0
    if (n !== 2 && n !== 3) throw new Error(`co2: у атома ${a.id} ${n} соседей, в слое графита допустимо 2 (край) или 3`)
  }

  // Укладка AB: ровно половина атомов нижнего слоя стоит точно под атомами верхнего.
  const top = new Set(GRAPHITE_ATOMS.filter((a) => a.layer === 0).map((a) => `${a.uv[0].toFixed(4)}|${a.uv[1].toFixed(4)}`))
  const eclipsed = GRAPHITE_ATOMS.filter((a) => a.layer === 1 && top.has(`${a.uv[0].toFixed(4)}|${a.uv[1].toFixed(4)}`)).length
  if (eclipsed < 8) throw new Error(`co2: укладка AB обязана ставить часть нижнего слоя точно под верхний, совпало ${eclipsed}`)

  // ——— Геометрия молекулы ———
  if (Math.abs(THETA_B_LINEAR - THETA_A_LINEAR - Math.PI) > 1e-9) {
    throw new Error('co2: в линейной молекуле углы связей обязаны отличаться ровно на 180°')
  }
  if (!(CO2_BENT_ANGLE_DEG > 90 && CO2_BENT_ANGLE_DEG < CO2_FACTS.angleDeg)) {
    throw new Error(`co2: промежуточная частица обязана быть УГЛОВОЙ (90° < ${CO2_BENT_ANGLE_DEG}° < 180°)`)
  }
  if (!(D_CO3 < D_CO)) throw new Error('co2: тройная связь C≡O обязана быть короче двойной C=O')
  if (!(D_LAYER > 2 * D_CC)) throw new Error('co2: расстояние между слоями графита обязано быть много больше связи C–C')

  if (CO2_END <= 0) throw new Error('co2: пустой сюжет')
}
