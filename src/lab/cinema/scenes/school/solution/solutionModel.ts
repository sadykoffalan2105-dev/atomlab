/**
 * МОДЕЛЬ КАДРА сцены «обмен в растворе» — единственный источник правды: sampleSolutionState(m, t).
 * Чистые функции без three: класс SolutionExchangeScene только переносит состояние в объекты,
 * тест scripts/test-solution-scene.mts проверяет его на любом t. Все длины — пм (система сцены).
 *
 * Сюжет по шагам (SOLUTION_STEP_IDS):
 *   tubes   — макро: две пробирки, вторую сливают в первую, белая муть, первые крупинки на дне;
 *   ions    — микро: Ba²⁺ и 2Cl⁻ | [SO₄]²⁻ и 2H₃O⁺ в своих водных оболочках, частицы дрожат;
 *   meet    — растворы смешиваются: ионы блуждают зигзагами, Ba²⁺ и SO₄²⁻ сближаются (пунктир
 *             притяжения), вода между ними отходит; H₃O⁺ и Cl⁻ проходят мимо друг друга;
 *   nucleus — зародыш барита (узлы — решётка ядра), пара садится в свои узлы, Ba²⁺ меняет радиус
 *             142 → 161 пм в кадр посадки (КЧ 8 в воде → КЧ 12 в кристалле), SO₄ поворачивается
 *             в ориентацию узла; за ней садятся ещё две пары из остального объёма;
 *   settle  — макро: муть оседает, слой осадка растёт, над ним соляная кислота;
 *   result  — микро: кристаллик и наблюдатели H₃O⁺, Cl⁻ в воде, уравнения.
 *
 * Химия — из ядра: радиусы Шеннона (Ba²⁺ КЧ 8/12, Cl⁻), S–O и ∠O–S–O сульфат-иона, O–H и ∠ H₃O⁺,
 * O–H и ∠ воды, H···O водородной связи, ковалентные радиусы (Кордеро) для шаров внутри частиц,
 * узлы и ориентации групп — решётка барита (kit/lattice, CRYSTAL_DATA.barite).
 * Блуждание — детерминированное (синусы от зерна): тест воспроизводим.
 */
import {
  ATOMIC_DATA,
  bondAngleDeg,
  bondLengthPm,
  ionicRadiusPm,
  reagentAngleDeg,
  reagentBondPm,
  type ElementSymbol,
} from '../../../../../chemistry/data'
import { pmToScene } from '../../kit/cpkAtoms'
import { latticeGroupedFragment } from '../../kit/lattice'
import { defineSceneTiming, type SceneFinish, type SceneStep, type SceneTiming } from '../../kit/sceneKit'
import { SOLUTION_STEP_IDS, type L10n, type SolutionStepId } from '../specs/types'
import type { SolutionSceneSpec, SV3 } from './solutionSpec'

export type V3 = [number, number, number]
/** Кватернион [x, y, z, w]. */
export type Q4 = [number, number, number, number]

export type SolutionCueId = 'mix' | 'meet' | 'land' | 'embryo' | 'birth' | 'complete'

/** Параметры рисунка (как SCHOOL_DRAW школьных сцен): шар — доля радиуса, палочки, подписи. */
export const SOLUTION_DRAW = {
  /** Доля радиуса для шара (как у школьных сцен: 0,62 — у ионов от радиуса Шеннона, у атомов частиц — от Кордеро). */
  ballScale: 0.62,
  stickR: 5.2,
  waterStickR: 3.2,
  /**
   * Рисуемый шар одноатомного иона (Ba²⁺, Cl⁻) крупнее: символ с зарядом читается внутри и на телефоне.
   * Модельный радиус (atomR) — прежний, Шеннона; зазоры до воды и до O в кристалле остаются.
   */
  ionView: 1.32,
  /** вода — второй план: шары мельче; ближняя оболочка у ионов — чуть крупнее фоновой */
  waterView: 0.78,
  bgWaterView: 0.62,
  hydroniumView: 1.15,
  bgWaterStickR: 2.4,
  /**
   * Зазор (пм) между рисуемыми шарами воды и чужими шарами, который держит раздвижка воды в каждом кадре
   * (по описанным сферам — с запасом); тест требует ≥ minGap между самими шарами и палочками.
   */
  pushGap: 18,
  minGap: 6,
} as const

/** Во сколько раз рисуемый шар атома больше модельного atomR (вид: ионы крупнее, вода мельче). */
export function solutionViewScale(el: ElementSymbol, water: boolean, background = false): number {
  if (water) return background ? SOLUTION_DRAW.bgWaterView : SOLUTION_DRAW.waterView
  return el === 'Ba' || el === 'Cl' ? SOLUTION_DRAW.ionView : 1
}

// ─── Числа ядра ──────────────────────────────────────────────────────────────

/** Все числа геометрии сцены — из ядра (тест сверяет каждое). */
export function solutionCore() {
  const baWater = ionicRadiusPm('Ba', 2, 8)!
  const baCrystal = ionicRadiusPm('Ba', 2, 12)!
  const cl = ionicRadiusPm('Cl', -1)!
  // Контакт «ион — кислород воды»: сумма радиусов Шеннона (O²⁻ при КЧ 6 у катиона, КЧ 2 у аниона):
  // Ba–O 142 + 140 = 282 пм (Persson 1995: 282), Cl···O 181 + 135 = 316 пм (Ohtaki & Radnai: 310–320).
  const o6 = ionicRadiusPm('O', -2, 6)!
  const o2 = ionicRadiusPm('O', -2, 2)!
  return {
    baWater,
    baCrystal,
    cl,
    baO: baWater + o6,
    clO: cl + o2,
    so: reagentBondPm('sulfate', 'S–O'),
    oso: reagentAngleDeg('sulfate', '∠O–S–O'),
    h3oOH: reagentBondPm('hydronium', 'O–H'),
    h3oHOH: reagentAngleDeg('hydronium', '∠H–O–H'),
    wOH: bondLengthPm('O-H'),
    wHOH: bondAngleDeg('water'),
    hbond: bondLengthPm('O-H...O'),
  }
}

// ─── Векторная алгебра (без аллокаций в кадре) ───────────────────────────────

const smooth = (a: number, b: number, t: number) => {
  if (b <= a) return t >= b ? 1 : 0
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}
export { smooth as solutionSmooth }
const lerp = (a: number, b: number, u: number) => a + (b - a) * u
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
function qMul(a: Q4, b: Q4, out: Q4 = [0, 0, 0, 1]): Q4 {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  out[0] = aw * bx + ax * bw + ay * bz - az * by
  out[1] = aw * by - ax * bz + ay * bw + az * bx
  out[2] = aw * bz + ax * by - ay * bx + az * bw
  out[3] = aw * bw - ax * bx - ay * by - az * bz
  return out
}
function qAxis(axis: V3, ang: number, out: Q4 = [0, 0, 0, 1]): Q4 {
  const n = norm(axis)
  const s = Math.sin(ang / 2)
  out[0] = n[0] * s
  out[1] = n[1] * s
  out[2] = n[2] * s
  out[3] = Math.cos(ang / 2)
  return out
}
function qRot(q: Q4, v: Readonly<V3>, out: V3 = [0, 0, 0]): V3 {
  const [x, y, z, w] = q
  const [vx, vy, vz] = v
  const tx = 2 * (y * vz - z * vy)
  const ty = 2 * (z * vx - x * vz)
  const tz = 2 * (x * vy - y * vx)
  out[0] = vx + w * tx + (y * tz - z * ty)
  out[1] = vy + w * ty + (z * tx - x * tz)
  out[2] = vz + w * tz + (x * ty - y * tx)
  return out
}
function qSlerp(a: Q4, b: Q4, u: number, out: Q4 = [0, 0, 0, 1]): Q4 {
  let [bx, by, bz, bw] = b
  let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw
  if (cos < 0) {
    cos = -cos
    bx = -bx
    by = -by
    bz = -bz
    bw = -bw
  }
  let k0 = 1 - u
  let k1 = u
  if (cos < 0.9995) {
    const th = Math.acos(cos)
    const s = Math.sin(th)
    k0 = Math.sin((1 - u) * th) / s
    k1 = Math.sin(u * th) / s
  }
  out[0] = a[0] * k0 + bx * k1
  out[1] = a[1] * k0 + by * k1
  out[2] = a[2] * k0 + bz * k1
  out[3] = a[3] * k0 + bw * k1
  const l = Math.hypot(out[0], out[1], out[2], out[3]) || 1
  out[0] /= l
  out[1] /= l
  out[2] /= l
  out[3] /= l
  return out
}
/** Поворот, переводящий единичный вектор a в b. */
function qFromTo(a: V3, b: V3): Q4 {
  const u = norm(a)
  const v = norm(b)
  const d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  if (d < -0.999999) {
    const axis: V3 = Math.abs(u[0]) < 0.9 ? [0, -u[2], u[1]] : [-u[2], 0, u[0]]
    return qAxis(axis, Math.PI)
  }
  const c: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const q: Q4 = [c[0], c[1], c[2], 1 + d]
  const l = Math.hypot(...q)
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}

/**
 * Лучший поворот (метод Хорна): переводит идеальные векторы e_i в векторы узла u_i (минимум Σ|R·e − u|²).
 * Перебираются все 24 соответствия вершин тетраэдра.
 */
function hornFit(e: readonly V3[], u: readonly V3[]): { q: Q4; rms: number } {
  const perms: number[][] = []
  const permute = (arr: number[], k: number) => {
    if (k === arr.length) perms.push([...arr])
    for (let i = k; i < arr.length; i++) {
      ;[arr[k], arr[i]] = [arr[i]!, arr[k]!]
      permute(arr, k + 1)
      ;[arr[k], arr[i]] = [arr[i]!, arr[k]!]
    }
  }
  permute(e.map((_, i) => i), 0)
  let best: { q: Q4; rms: number } = { q: [0, 0, 0, 1], rms: Infinity }
  for (const p of perms) {
    const S = [0, 0, 0, 0, 0, 0, 0, 0, 0]
    for (let i = 0; i < u.length; i++) {
      const a = e[p[i]!]!
      const b = u[i]!
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r * 3 + c]! += a[r]! * b[c]!
    }
    const [xx, xy, xz, yx, yy, yz, zx, zy, zz] = S as [number, number, number, number, number, number, number, number, number]
    const N = [
      [xx + yy + zz, yz - zy, zx - xz, xy - yx],
      [yz - zy, xx - yy - zz, xy + yx, zx + xz],
      [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
      [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
    ]
    const shift = 10
    let v = [1, 0.1, 0.1, 0.1]
    for (let it = 0; it < 200; it++) {
      const w = [0, 0, 0, 0]
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) w[r]! += (N[r]![c]! + (r === c ? shift : 0)) * v[c]!
      const l = Math.hypot(...w)
      v = w.map((x) => x / l)
    }
    const q: Q4 = [v[1]!, v[2]!, v[3]!, v[0]!]
    let err = 0
    for (let i = 0; i < u.length; i++) {
      const r = qRot(q, e[p[i]!]!)
      err += (r[0] - u[i]![0]) ** 2 + (r[1] - u[i]![1]) ** 2 + (r[2] - u[i]![2]) ** 2
    }
    const rms = Math.sqrt(err / u.length)
    if (rms < best.rms) best = { q, rms }
  }
  return best
}

// ─── Детерминированное блуждание ─────────────────────────────────────────────

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Wobble = { amp: number; f: V3; ph: V3; rotAmp: number; rf: V3; rph: V3 }
function makeWobble(r: () => number, amp: number, rotAmp: number): Wobble {
  const f = (): V3 => [0.9 + 0.9 * r(), 0.8 + 0.9 * r(), 0.7 + 0.8 * r()]
  const ph = (): V3 => [6.283 * r(), 6.283 * r(), 6.283 * r()]
  return { amp, f: f(), ph: ph(), rotAmp, rf: f(), rph: ph() }
}
function wobblePos(w: Wobble, t: number, out: V3): V3 {
  out[0] = w.amp * Math.sin(w.f[0] * t + w.ph[0])
  out[1] = w.amp * Math.sin(w.f[1] * t + w.ph[1])
  out[2] = 0.6 * w.amp * Math.sin(w.f[2] * t + w.ph[2])
  return out
}
const _wq1: Q4 = [0, 0, 0, 1]
const _wq2: Q4 = [0, 0, 0, 1]
function wobbleRot(w: Wobble, t: number, out: Q4): Q4 {
  qAxis([1, 0, 0], w.rotAmp * Math.sin(w.rf[0] * t + w.rph[0]), _wq1)
  qAxis([0, 1, 0], w.rotAmp * Math.sin(w.rf[1] * t + w.rph[1]), _wq2)
  qMul(_wq1, _wq2, out)
  qAxis([0, 0, 1], w.rotAmp * Math.sin(w.rf[2] * t + w.rph[2]), _wq1)
  return qMul(out, _wq1, out)
}

/** Ключевые точки пути: гладко (smoothstep) между соседними, вне — держим крайние. */
type Key = { readonly t: number; readonly p: SV3 }
function keyed(keys: readonly Key[], t: number, out: V3): V3 {
  if (t <= keys[0]!.t) {
    out[0] = keys[0]!.p[0]
    out[1] = keys[0]!.p[1]
    out[2] = keys[0]!.p[2]
    return out
  }
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i]!
    if (t <= b.t) {
      const a = keys[i - 1]!
      const u = smooth(a.t, b.t, t)
      out[0] = lerp(a.p[0], b.p[0], u)
      out[1] = lerp(a.p[1], b.p[1], u)
      out[2] = lerp(a.p[2], b.p[2], u)
      return out
    }
  }
  const z = keys[keys.length - 1]!
  out[0] = z.p[0]
  out[1] = z.p[1]
  out[2] = z.p[2]
  return out
}
/** Зигзаг поперёк пути: ноль на концах окна (непрерывно). */
function zig(t: number, t0: number, t1: number, amp: number, half: number): number {
  if (t <= t0 || t >= t1) return 0
  const u = (t - t0) / (t1 - t0)
  return amp * Math.sin(Math.PI * half * u) * Math.sin(Math.PI * u)
}

// ─── Модель ──────────────────────────────────────────────────────────────────

export type BodyKind = 'cation' | 'anion' | 'group' | 'proton' | 'water' | 'lattice-cation' | 'lattice-group'

export type SolutionAtom = {
  readonly el: ElementSymbol
  readonly body: number
  /** координата в системе частицы, пм */
  readonly local: V3
  /** радиус шара, пм, до масштаба ballScale; у катиона-иона меняется при посадке (см. radiusAt) */
  readonly radiusPm: number
  /** подпись символа внутри шара (индекс подписи или −1) */
  label: number
}

export type SolutionBody = {
  readonly id: string
  readonly kind: BodyKind
  /** формула частицы: 'Ba²⁺', 'SO₄²⁻', 'H₃O⁺', 'H₂O' */
  readonly formula: string
  readonly charge: number
  readonly atoms: number[]
  /** посадка в кристалл: время и индекс узла (у ионов, которые садятся) */
  readonly land?: { readonly t: number; readonly site: number }
}

export type SolutionStick = { readonly a: number; readonly b: number; readonly water: boolean }

export type SolutionLabelKind = 'atom' | 'atomDark' | 'species' | 'measure' | 'equation' | 'equationPlate' | 'callout'

export type SolutionLabelDef = {
  readonly id: string
  readonly kind: SolutionLabelKind
  readonly text: L10n
  readonly from: number
  readonly to: number
  /** непрозрачность в окне (заряды в решётке — бледнее) */
  readonly peak?: number
}

/** Узел кристалла в системе кристалла (центр фрагмента), пм. */
export type CrystalSite = { readonly el: ElementSymbol; readonly pos: V3; readonly q?: Q4 }

export type SolutionModel = {
  readonly spec: SolutionSceneSpec
  readonly core: ReturnType<typeof solutionCore>
  readonly timing: SceneTiming<SolutionStepId, SolutionCueId>
  readonly finish: SceneFinish
  readonly step: Readonly<Record<SolutionStepId, { from: number; to: number }>>
  readonly atoms: SolutionAtom[]
  readonly bodies: SolutionBody[]
  readonly sticks: SolutionStick[]
  readonly labels: SolutionLabelDef[]
  /** узлы Ba и S (центры групп) кристалла, использованные сценой, и ориентация групп */
  readonly sites: CrystalSite[]
  /** все O групп из решётки (для проверки расстояний Ba–O) */
  readonly siteLigands: V3[][]
  /** рёбра ячеек фрагмента в системе кристалла, пм */
  readonly cellEdges: readonly (readonly [V3, V3])[]
  /** кратчайшее Ba–O в решётке барита, пм */
  readonly shortestCationO: number
  /** точки мути в пробирке */
  readonly turbidPoints: number
  /** макро: размеры пробирки */
  readonly tube: { readonly r: number; readonly h: number }
  /** индексы тел по ролям */
  readonly roles: {
    readonly cation: number
    readonly group: number
    readonly anions: readonly number[]
    readonly protons: readonly number[]
    readonly lattice: readonly number[]
    readonly later: readonly number[]
    readonly waters: readonly number[]
  }
  /**
   * Ореолы (микромир): кольцо-свечение вокруг иона по знаку заряда (+ тёплое, − холодное), подсветка H⁺
   * в H₃O⁺ и 12 атомов O вокруг одного Ba²⁺ в кристалле. atom ≥ 0 — ореол едет за атомом; иначе — узел
   * кристалла pos (система кристалла).
   */
  readonly halos: readonly SolutionHaloDef[]
  /** во сколько раз рисуемый шар атома больше atomR (ионы крупнее, вода мельче, фон — ещё мельче) */
  readonly viewK: Float32Array
  readonly clearance: SolutionClearance
  /** внутреннее: функции позы тел */
  readonly pose: readonly ((t: number, p: V3, q: Q4) => number)[]
  readonly radiusAt: (atom: number, t: number) => number
  /** муть: место (x, z), доля глубины y0, скорость оседания v, доля времени рождения birth (0…1 сливания) */
  readonly turbid: { readonly x: Float32Array; readonly y0: Float32Array; readonly z: Float32Array; readonly v: Float32Array; readonly birth: Float32Array }
}

/** Ореол шара: внешний радиус свечения — во столько раз больше рисуемого шара (кромки нет, спад мягкий). */
export const SOLUTION_HALO_BALL = 1.42

export type SolutionHaloKind = 'plus' | 'minus' | 'proton' | 'neighbor'
export type SolutionHaloDef = {
  readonly kind: SolutionHaloKind
  /** атом, за которым едет ореол (−1 — точка кристалла pos) */
  readonly atom: number
  readonly pos?: V3
  /**
   * Внешний радиус мягкого свечения, пм: у шара ('ball') — около 1,4 рисуемого радиуса (свечение по краю
   * шара, без резкой кромки); у многоатомного иона ('cloud') — облако чуть больше описанной сферы частицы.
   * −1 — от рисуемого радиуса шара (меняется при посадке Ba²⁺).
   */
  readonly radiusPm: number
  readonly shape: 'ball' | 'cloud'
  /** все атомы частицы, которые светятся по краю (френель) цветом знака */
  readonly rimAtoms: readonly number[]
  /** true — точка O соседней группы, которой нет во фрагменте кадра (светится без шара) */
  readonly ghost?: boolean
}

/** Раздвижка воды: описанные сферы молекул воды и «препятствия» — остальные частицы (пм, по рисуемым шарам). */
export type SolutionClearance = {
  /** тела воды, радиус описанной сферы, доля пути O → середина H–H до её центра */
  readonly waters: Int32Array
  readonly wR: Float32Array
  readonly wK: Float32Array
  /** тела-препятствия: центр — первый атом (Ba, Cl, S, O иона H₃O⁺), радиус описанной сферы */
  readonly obst: Int32Array
  readonly oR: Float32Array
  /** препятствие «вырастает» до появления тела (без рывка воды): 0 → 1 на [from, to] */
  readonly oFrom: Float32Array
  readonly oTo: Float32Array
  /** рабочий буфер кадра: центр описанной сферы воды после раздвижки и до неё (6 чисел на молекулу) */
  readonly scratch: Float32Array
  /** кристаллик — ещё и эллипсоид вокруг коробки ячеек (её полуразмеры в системе кристалла, пм): вода не заходит внутрь */
  readonly box: V3
  /** коробка «вырастает» из центра до появления зародыша: 0 → 1 на [from, to] */
  readonly boxFrom: number
  readonly boxTo: number
  /** 1 — вода, которую коробка выталкивает (фон и отставшая оболочка Ba²⁺/SO₄²⁻); шубки наблюдателей едут с ионом */
  readonly boxed: Uint8Array
}

export type SolutionState = {
  t: number
  step: number
  /** затухание хвоста (1 → 0) */
  fade: number
  microAlpha: number
  microScale: number
  macroAlpha: number
  macroScale: number
  atomPos: Float32Array
  /** радиус шара, пм (0 — не виден) */
  atomR: Float32Array
  stickA: Float32Array
  stickB: Float32Array
  stickAlpha: Float32Array
  labelPos: Float32Array
  labelOpacity: Float32Array
  /** проявление каждого тела (0…1) */
  bodyAppear: Float32Array
  /** пунктир притяжения Ba²⁺ ↔ SO₄²⁻ и граница двух растворов */
  attract: { a: V3; b: V3; alpha: number }
  divider: { alpha: number }
  /**
   * Пробирки: положение дна (x, y), наклон (рад), уровень (доля высоты, «как если бы стояла»), видимость;
   * surface — высота горизонтальной поверхности жидкости в системе макро-слоя (у наклонённой B жидкость
   * остаётся горизонтальной: рисуется всё, что ниже этой плоскости).
   */
  tubeA: { x: number; y: number; rot: number; level: number; alpha: number; surface: number }
  tubeB: { x: number; y: number; rot: number; level: number; alpha: number; liquid: number; surface: number }
  /** струя: a — носик B, b — вход в жидкость A; pts/rad — осевая линия параболы и радиус (сужается) */
  stream: { a: V3; b: V3; alpha: number; pts: Float32Array; rad: Float32Array }
  /** «лупа» макро ↔ микро: центр (система сцены), радиус круга, видимость оправы; u — 0 макро … 1 микро */
  lens: { c: V3; r: number; alpha: number; u: number }
  /** сдвиг слоёв при наезде (слой масштабируется вокруг центра лупы) */
  macroOffset: V3
  microOffset: V3
  /** пипетка HNO₃: кончик (x, y), видимость; капли — x, y, z, радиус */
  pipette: { x: number; y: number; alpha: number }
  drops: Float32Array
  /** выноски шага «осадок»: [цель, колено, конец полки] по x, y для осадка и раствора; видимость */
  callouts: Float32Array
  calloutAlpha: Float32Array
  /** муть (0…1), высота слоя осадка (доля высоты пробирки), сколько всего образовалось осадка */
  turbidity: number
  sediment: number
  formed: number
  turbidPos: Float32Array
  /** поза кристалла: центр и поворот вокруг вертикали */
  crystal: { c: V3; yaw: number; alpha: number }
  /** рёбра ячеек (проявляются после первых ионов зародыша) */
  edgeAlpha: number
  /** ореолы: центр, радиус (пм) и яркость 0…1 */
  haloPos: Float32Array
  haloR: Float32Array
  haloAlpha: Float32Array
  /** приглушение тела (1 — как есть, меньше — в тени: выделена другая пара) */
  bodyDim: Float32Array
  /** линии поля притяжения Ba²⁺ ↔ SO₄²⁻ (концы — attract.a/b) */
  field: { alpha: number }
}

const TUBE = { r: 115, h: 950 }
const TURBID_N = 360
/** точек осевой линии струи, капель HNO₃ */
export const STREAM_N = 18
export const DROP_N = 3
/** макро: пробирка A (куда сливают) и B (кислота) в штативе */
const TUBE_A_X = -210
const TUBE_B_X = 210

/** Тетраэдр SO₄: вершины (±1, ±1, ±1) с чётным числом минусов — ось C₂ по z (ни один O не закрывает S). */
function tetraLocal(so: number): V3[] {
  const k = so / Math.sqrt(3)
  return [
    [k, k, k],
    [k, -k, -k],
    [-k, k, -k],
    [-k, -k, k],
  ]
}
/**
 * Пирамида H₃O⁺: три H под углом ∠H–O–H. Ось C₃ (от O к плоскости трёх H) — вниз и от зрителя:
 * O — вершина над плоскостью H, плоскость видна сверху наискосок (треножник читается объёмным, а не плоской «Y»).
 * Первый H (пришедший от кислоты) — впереди снизу, два других — по бокам.
 */
function pyramidLocal(oh: number, hoh: number): V3[] {
  const cosA = Math.cos((hoh * Math.PI) / 180)
  const cosB = Math.sqrt((2 * cosA + 1) / 3)
  const sinB = Math.sqrt(1 - cosB * cosB)
  const tilt = qFromTo([0, 0, 1], norm([0, -1, -0.35]))
  return [0, 1, 2].map((i) => {
    const phi = Math.PI / 2 + (i * 2 * Math.PI) / 3
    return qRot(tilt, [oh * sinB * Math.cos(phi), oh * sinB * Math.sin(phi), oh * cosB])
  })
}
/** Вода: O в начале, биссектриса H–O–H по +y. */
function waterLocal(oh: number, hoh: number): V3[] {
  const a = ((hoh / 2) * Math.PI) / 180
  return [
    [oh * Math.sin(a), oh * Math.cos(a), 0],
    [-oh * Math.sin(a), oh * Math.cos(a), 0],
  ]
}

const cov = (el: ElementSymbol) => ATOMIC_DATA[el].covalentRadiusPm
/**
 * Проявление частицы кристалла: сразу с половины размера и до целого (без «точек» и голых палочек,
 * которые мелькали, пока шары росли из нуля). Палочки — только когда шары почти целые (sampleSolutionState).
 */
const popIn = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 + 0.5 * x)

export function buildSolutionModel(spec: SolutionSceneSpec): SolutionModel {
  const core = solutionCore()
  const r = rng(spec.seed)
  if (spec.steps.length !== SOLUTION_STEP_IDS.length) throw new Error(`solution scene «${spec.id}»: нужно ровно 6 шагов`)
  spec.steps.forEach((s, i) => {
    if (s.id !== SOLUTION_STEP_IDS[i]) throw new Error(`solution scene «${spec.id}»: шаг ${i + 1} — «${SOLUTION_STEP_IDS[i]}», а не «${s.id}»`)
  })
  const step = Object.fromEntries(spec.steps.map((s) => [s.id, { from: s.from, to: s.to }])) as Record<SolutionStepId, { from: number; to: number }>
  const last = spec.steps[spec.steps.length - 1]!
  const finish: SceneFinish = { from: last.to, to: last.to + 1.5, wall: 1.5, ease: 'none' }
  const steps: SceneStep<SolutionStepId>[] = spec.steps.map((s) => ({ id: s.id, from: s.from, to: s.to, wall: s.to - s.from, ease: 'none' }))
  const S = step
  // ключевые моменты сюжета
  const T = {
    // макро шага 1: подъём B (lift0…lift1), перенос к устью A (…pour0), струя (pour0…pour1), возврат (back0…back1)
    lift0: S.tubes.from + 0.35,
    lift1: S.tubes.from + 0.8,
    pour0: S.tubes.from + 1.75,
    pour1: S.tubes.from + 3.3,
    back0: S.tubes.from + 3.4,
    back1: S.tubes.from + 4.55,
    // «лупа» — целиком ВНУТРИ шага: на паузе между шагами кадр всегда в одном слое (без провалов)
    micro0: S.ions.from,
    micro1: S.ions.from + 1.1,
    mix0: S.meet.from,
    meet1: S.meet.to - 0.4,
    seed0: S.nucleus.from + 0.5,
    seed1: S.nucleus.from + 1.3,
    shed: S.nucleus.from + 0.35,
    land0: S.nucleus.from + 0.8,
    land: S.nucleus.from + 3.2,
    microOut0: S.settle.from,
    microOut1: S.settle.from + 1.0,
    // пипетка HNO₃: въезд, три капли, отъезд
    pip0: S.settle.from + 2.0,
    drop0: S.settle.from + 2.6,
    pip1: S.settle.from + 4.1,
    micro2: S.result.from,
    micro3: S.result.from + 1.0,
    relocate: (S.settle.from + S.result.from) / 2,
    /** выноска «что такое H₃O⁺» и подсветка его H⁺ */
    explain0: S.ions.from + 1.4,
    explain1: S.ions.to - 0.2,
  }
  const timing = defineSceneTiming<SolutionStepId, SolutionCueId>({
    steps,
    finish,
    cues: [
      { at: T.pour0 + 0.6, id: 'mix' },
      { at: S.meet.from + 1.5, id: 'meet' },
      { at: T.land, id: 'land' },
      { at: finish.from + 0.2, id: 'embryo' },
      { at: finish.from + 0.2, id: 'birth' },
      { at: finish.to, id: 'complete' },
    ],
  })
  timing.validate()

  const atoms: SolutionAtom[] = []
  const bodies: SolutionBody[] = []
  /** тело-препятствие для воды «вырастает» до своего появления: [from, to] (нет — есть всегда) */
  const presence = new Map<number, [number, number]>()
  const sticks: SolutionStick[] = []
  const labels: SolutionLabelDef[] = []
  const pose: ((t: number, p: V3, q: Q4) => number)[] = []
  const addLabel = (d: SolutionLabelDef) => {
    labels.push(d)
    return labels.length - 1
  }
  const sym = (el: ElementSymbol): L10n => ({ ru: el, en: el, uz: el })
  const eqText = (x: string): L10n => ({ ru: x, en: x, uz: x })
  const symKind = (el: ElementSymbol): SolutionLabelKind => (el === 'H' || el === 'S' || el === 'Cl' ? 'atomDark' : 'atom')
  /** Одноатомный ион — символ с зарядом прямо в шаре («Ba²⁺», «Cl⁻»): отдельная подпись заряда не нужна. */
  const ionSym = (el: ElementSymbol): L10n | null => (el === 'Ba' ? eqText('Ba²⁺') : el === 'Cl' ? eqText('Cl⁻') : null)
  const addBody = (b: Omit<SolutionBody, 'atoms'>, parts: { el: ElementSymbol; local: V3; radiusPm: number; symbol?: [number, number] }[], bonds: [number, number][], water: boolean) => {
    const bi = bodies.length
    const ids: number[] = []
    for (const p of parts) {
      const label = p.symbol ? addLabel({ id: `${b.id}-${p.el}${ids.length}`, kind: symKind(p.el), text: ionSym(p.el) ?? sym(p.el), from: p.symbol[0], to: p.symbol[1] }) : -1
      atoms.push({ el: p.el, body: bi, local: p.local, radiusPm: p.radiusPm, label })
      ids.push(atoms.length - 1)
    }
    for (const [x, y] of bonds) sticks.push({ a: ids[x]!, b: ids[y]!, water })
    bodies.push({ ...b, atoms: ids })
    return bi
  }

  // ——— решётка барита: узлы зародыша, нашей пары и следующих пар ———
  const frag = latticeGroupedFragment(spec.crystalId, [spec.crystalCells[0], spec.crystalCells[1], spec.crystalCells[2]], [{ center: 'S', ligand: 'O', ligands: 4 }])
  const tetra = tetraLocal(core.so)
  const ions = frag.sites.map((s, i) => ({ s, i })).filter((x) => x.s.role === 'ion')
  const centers = frag.sites.map((s, i) => ({ s, i })).filter((x) => x.s.role === 'center')
  const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  // Единицы BaSO₄ по ячейкам: Ba — с ближайшим S той же ячейки. Ячейка x = 0 — зародыш, x = 1 — наша пара
  // (самая верхняя: она садится сверху) и следующие пары.
  type Unit = { ba: (typeof ions)[number]; s: (typeof centers)[number] }
  const unitsOf = (cx: number): Unit[] => {
    const bas = ions.filter((x) => x.s.cell[0] === cx)
    const ss = centers.filter((x) => x.s.cell[0] === cx)
    return bas.map((ba) => {
      const s = [...ss].sort((a, b) => dist(a.s.posPm, ba.s.posPm) - dist(b.s.posPm, ba.s.posPm))[0]!
      ss.splice(ss.indexOf(s), 1)
      return { ba, s }
    })
  }
  const seedU = unitsOf(0)
  const nextU = unitsOf(1).sort((a, b) => b.ba.s.posPm[1] + b.s.s.posPm[1] - (a.ba.s.posPm[1] + a.s.s.posPm[1]))
  if (seedU.length !== spec.seedUnits || nextU.length !== 1 + spec.laterUnits) throw new Error(`solution scene «${spec.id}»: ячейки дают ${seedU.length} + ${nextU.length} единиц`)
  const units = [...seedU, ...nextU]
  const sites: CrystalSite[] = []
  const siteLigands: V3[][] = []
  for (const u of units) {
    sites.push({ el: 'Ba', pos: [...u.ba.s.posPm] as V3 })
    const sPos = u.s.s.posPm
    const ligs = frag.sites.filter((x) => x.role === 'ligand' && x.group === u.s.i).map((x) => x.posPm)
    const dirs = ligs.map((p) => norm([p[0] - sPos[0], p[1] - sPos[1], p[2] - sPos[2]]))
    const fit = hornFit(tetra.map((v) => norm(v)), dirs)
    sites.push({ el: 'S', pos: [...sPos] as V3, q: fit.q })
    siteLigands.push(ligs.map((p) => [...p] as V3))
  }
  const cellEdgesPm: [V3, V3][] = frag.cellEdges.map(([a, b]) => [a.map((v) => v / pmToScene(1)) as V3, b.map((v) => v / pmToScene(1)) as V3])
  // кратчайшее Ba–O решётки (для теста и подписи)
  let shortestCationO = Infinity
  for (const x of ions) for (const y of frag.sites) if (y.role === 'ligand') shortestCationO = Math.min(shortestCationO, dist(x.s.posPm, y.posPm))

  // ——— поза кристалла ———
  const crystalC = (t: number, out: V3) => (t < T.relocate ? ((out[0] = spec.nucleus.center[0]), (out[1] = spec.nucleus.center[1]), (out[2] = spec.nucleus.center[2])) : ((out[0] = spec.result.crystal[0]), (out[1] = spec.result.crystal[1]), (out[2] = spec.result.crystal[2])), out)
  const crystalYaw = (t: number) => spec.nucleus.yaw + spec.nucleus.yawRate * Math.max(0, t - S.nucleus.from)
  const _cc: V3 = [0, 0, 0]
  const _cq: Q4 = [0, 0, 0, 1]
  /** Поза узла кристалла в момент t: позиция (и ориентация группы). */
  const sitePose = (site: CrystalSite, t: number, p: V3, q: Q4) => {
    crystalC(t, _cc)
    qAxis([0, 1, 0], crystalYaw(t), _cq)
    qRot(_cq, site.pos, p)
    p[0] += _cc[0]
    p[1] += _cc[1]
    p[2] += _cc[2]
    if (site.q) qMul(_cq, site.q, q)
    else q.splice(0, 4, ..._cq)
  }

  const Rw = (el: ElementSymbol) => cov(el)
  const sulfateParts = (symbol?: [number, number]) => [
    { el: 'S' as ElementSymbol, local: [0, 0, 0] as V3, radiusPm: Rw('S'), symbol },
    ...tetra.map((v) => ({ el: 'O' as ElementSymbol, local: v, radiusPm: Rw('O'), symbol })),
  ]
  const sulfateBonds: [number, number][] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
  ]
  const microLabelWin: [number, number] = [T.micro0 + 0.4, finish.to]

  // ——— главные ионы ———
  const wob = () => makeWobble(r, 11, 0.07)
  const startQ: Q4 = [0, 0, 0, 1]
  const meetDir: V3 = [1, 0, 0]
  const meetBa: V3 = [spec.meet.center[0] - (spec.meet.gapPm / 2) * meetDir[0], spec.meet.center[1], spec.meet.center[2]]
  const meetS: V3 = [spec.meet.center[0] + (spec.meet.gapPm / 2) * meetDir[0], spec.meet.center[1], spec.meet.center[2]]

  /**
   * Свободный путь иона в растворе: ключи + зигзаг на шаге «встреча» + дрожь; к посадке — плавный
   * переход в позу узла кристалла (s = 0 → 1 на [land0, land]).
   */
  const makeFree = (keys: Key[], w: Wobble, zigAmp: number, zigAxis: V3, half = 3) => {
    const tmp: V3 = [0, 0, 0]
    return (t: number, out: V3) => {
      keyed(keys, t, out)
      const z = zig(t, S.meet.from, T.meet1, zigAmp, half)
      out[0] += z * zigAxis[0]
      out[1] += z * zigAxis[1]
      out[2] += z * zigAxis[2]
      wobblePos(w, t, tmp)
      out[0] += tmp[0]
      out[1] += tmp[1]
      out[2] += tmp[2]
      return out
    }
  }
  const landing = (free: (t: number, out: V3) => V3, freeQ: (t: number, out: Q4) => Q4, site: CrystalSite, t0: number, t1: number) => {
    const fp: V3 = [0, 0, 0]
    const fq: Q4 = [0, 0, 0, 1]
    const sp: V3 = [0, 0, 0]
    const sq: Q4 = [0, 0, 0, 1]
    return (t: number, p: V3, q: Q4) => {
      const s = smooth(t0, t1, t)
      if (s >= 1) {
        sitePose(site, t, p, q)
        return 1
      }
      free(t, fp)
      freeQ(t, fq)
      if (s <= 0) {
        p[0] = fp[0]
        p[1] = fp[1]
        p[2] = fp[2]
        q.splice(0, 4, ...fq)
        return 1
      }
      sitePose(site, t, sp, sq)
      p[0] = lerp(fp[0], sp[0], s)
      p[1] = lerp(fp[1], sp[1], s)
      p[2] = lerp(fp[2], sp[2], s)
      qSlerp(fq, sq, s, q)
      return 1
    }
  }

  // катион Ba²⁺ (наша пара — узел spec.seedUnits)
  const ourBa = sites[spec.seedUnits * 2]!
  const ourS = sites[spec.seedUnits * 2 + 1]!
  const baFree = makeFree(
    [
      { t: S.ions.from, p: spec.start.cation },
      { t: S.meet.from + 0.3, p: spec.start.cation },
      { t: T.meet1, p: meetBa },
      { t: S.nucleus.from + 0.6, p: [meetBa[0], meetBa[1] - 60, meetBa[2]] },
    ],
    wob(),
    90,
    [0, 1, 0],
  )
  const baW = wob()
  const cation = addBody({ id: 'Ba', kind: 'cation', formula: 'Ba²⁺', charge: 2, land: { t: T.land, site: spec.seedUnits * 2 } }, [{ el: 'Ba', local: [0, 0, 0], radiusPm: core.baWater, symbol: microLabelWin }], [], false)
  pose.push(landing(baFree, (t, q) => wobbleRot(baW, t, q), ourBa, T.land0, T.land))

  // сульфат-ион
  const sW = makeWobble(r, 11, 0.12)
  const sFree = makeFree(
    [
      { t: S.ions.from, p: spec.start.group },
      { t: S.meet.from + 0.3, p: spec.start.group },
      { t: T.meet1, p: meetS },
      { t: S.nucleus.from + 0.6, p: [meetS[0], meetS[1] - 60, meetS[2]] },
    ],
    sW,
    -80,
    [0, 1, 0],
  )
  const group = addBody({ id: 'SO4', kind: 'group', formula: 'SO₄²⁻', charge: -2, land: { t: T.land, site: spec.seedUnits * 2 + 1 } }, sulfateParts(microLabelWin), sulfateBonds, false)
  const sQ = (t: number, q: Q4) => {
    wobbleRot(sW, t, q)
    return qMul(startQ, q, q)
  }
  pose.push(landing(sFree, sQ, ourS, T.land0, T.land))

  // наблюдатели: 2 Cl⁻ и 2 H₃O⁺
  const specKeys = (a: SV3, b: SV3, c: SV3, d: SV3): Key[] => [
    { t: S.ions.from, p: a },
    { t: S.meet.from + 0.2, p: a },
    { t: T.meet1 + 0.2, p: b },
    // наблюдатели уходят вверх раньше, чем проявится зародыш (он внизу)
    { t: S.nucleus.from + 1.2, p: c },
    { t: T.relocate - 0.01, p: c },
    { t: T.relocate, p: d },
  ]
  const anions: number[] = []
  const protons: number[] = []
  const pyr = pyramidLocal(core.h3oOH, core.h3oHOH)
  for (let k = 0; k < 2; k++) {
    const w = wob()
    // верхний проходит поверху, нижний — понизу: мимо встречающейся пары Ba²⁺ и SO₄²⁻; нижние Cl⁻ и H₃O⁺
    // расходятся ещё и по глубине (Cl⁻ — позади, H₃O⁺ — впереди): не проходят друг сквозь друга
    const free = makeFree(specKeys(spec.start.anions[k]!, spec.mixed.anions[k]!, spec.spectators.anions[k]!, spec.result.anions[k]!), w, k ? 1 : 150, k ? [0, -300, -520] : [0, 1, 0], 1)
    anions.push(addBody({ id: `Cl${k + 1}`, kind: 'anion', formula: 'Cl⁻', charge: -1 }, [{ el: 'Cl', local: [0, 0, 0], radiusPm: core.cl, symbol: microLabelWin }], [], false))
    pose.push((t, p, q) => {
      free(t, p)
      wobbleRot(w, t, q)
      return 1
    })
  }
  for (let k = 0; k < 2; k++) {
    const w = makeWobble(r, 11, 0.16)
    const free = makeFree(specKeys(spec.start.protons[k]!, spec.mixed.protons[k]!, spec.spectators.protons[k]!, spec.result.protons[k]!), w, k ? 1 : 150, k ? [0, -100, 500] : [0, 1, 0], 1)
    protons.push(
      addBody(
        { id: `H3O${k + 1}`, kind: 'proton', formula: 'H₃O⁺', charge: 1 },
        [{ el: 'O', local: [0, 0, 0], radiusPm: Rw('O'), symbol: microLabelWin }, ...pyr.map((v) => ({ el: 'H' as ElementSymbol, local: v, radiusPm: Rw('H'), symbol: microLabelWin }))],
        [
          [0, 1],
          [0, 2],
          [0, 3],
        ],
        false,
      ),
    )
    pose.push((t, p, q) => {
      free(t, p)
      wobbleRot(w, t, q)
      return 1
    })
  }

  // ——— кристалл: зародыш и следующие пары ———
  const lattice: number[] = []
  const later: number[] = []
  const _p: V3 = [0, 0, 0]
  for (let k = 0; k < spec.seedUnits; k++) {
    const siteBa = sites[k * 2]!
    const siteS = sites[k * 2 + 1]!
    lattice.push(addBody({ id: `seedBa${k}`, kind: 'lattice-cation', formula: 'Ba²⁺', charge: 2 }, [{ el: 'Ba', local: [0, 0, 0], radiusPm: core.baCrystal, symbol: [T.seed0 + 0.3, finish.to] }], [], false))
    pose.push((t, p, q) => (sitePose(siteBa, t, p, q), popIn(smooth(T.seed0 + 0.1 * k, T.seed1 + 0.1 * k, t))))
    lattice.push(addBody({ id: `seedSO4${k}`, kind: 'lattice-group', formula: 'SO₄²⁻', charge: -2 }, sulfateParts(), sulfateBonds, false))
    pose.push((t, p, q) => (sitePose(siteS, t, p, q), popIn(smooth(T.seed0 + 0.1 * k, T.seed1 + 0.1 * k, t))))
    for (const b of lattice.slice(-2)) presence.set(b, [T.seed0 + 0.1 * k - 0.9, T.seed0 + 0.1 * k])
  }
  for (let k = 0; k < spec.laterUnits; k++) {
    const siteIdx = (spec.seedUnits + 1 + k) * 2
    const siteBa = sites[siteIdx]!
    const siteS = sites[siteIdx + 1]!
    const t0 = T.land + 0.05 + k * 0.45
    const t1 = t0 + 1.6
    const from = spec.laterFrom[k] ?? spec.laterFrom[0]!
    for (const [site, kind, isBa] of [
      [siteBa, 'lattice-cation', true],
      [siteS, 'lattice-group', false],
    ] as const) {
      const w = wob()
      const start: V3 = [from[0] + (isBa ? -190 : 190), from[1], from[2]]
      const free = (t: number, out: V3) => {
        out[0] = start[0]
        out[1] = start[1]
        out[2] = start[2]
        wobblePos(w, t, _p)
        out[0] += _p[0]
        out[1] += _p[1]
        out[2] += _p[2]
        return out
      }
      const b = isBa
        ? addBody({ id: `laterBa${k}`, kind, formula: 'Ba²⁺', charge: 2, land: { t: t1, site: siteIdx } }, [{ el: 'Ba', local: [0, 0, 0], radiusPm: core.baWater, symbol: [t0 + 0.3, finish.to] }], [], false)
        : addBody({ id: `laterSO4${k}`, kind, formula: 'SO₄²⁻', charge: -2, land: { t: t1, site: siteIdx + 1 } }, sulfateParts(), sulfateBonds, false)
      later.push(b)
      presence.set(b, [t0 - 1.1, t0 - 0.2])
      const land = landing(free, (t, q) => wobbleRot(w, t, q), site, t0, t1)
      pose.push((t, p, q) => (land(t, p, q), popIn(smooth(t0 - 0.2, t0 + 0.5, t))))
    }
  }

  // ——— вода: ближние оболочки и фон ———
  const wLocal = waterLocal(core.wOH, core.wHOH)
  const waters: number[] = []
  const hyd = new Map(spec.science.hydration.map((h) => [h.particle, h]))
  /** Вода, прикреплённая к хозяину (поза в системе хозяина), с отрывом в момент detach и дрейфом наружу. */
  const addWater = (id: string, host: number | null, localPos: V3, localQ: Q4, detach: number | null, drift: V3, resultPos: V3) => {
    // вода — второй план: дрожит спокойнее ионов
    const w = makeWobble(r, 8, 0.12)
    const bi = addBody(
      { id, kind: 'water', formula: 'H₂O', charge: 0 },
      [
        { el: 'O', local: [0, 0, 0], radiusPm: Rw('O') },
        { el: 'H', local: wLocal[0]!, radiusPm: Rw('H') },
        { el: 'H', local: wLocal[1]!, radiusPm: Rw('H') },
      ],
      [
        [0, 1],
        [0, 2],
      ],
      true,
    )
    waters.push(bi)
    const hp: V3 = [0, 0, 0]
    const hq: Q4 = [0, 0, 0, 1]
    const d0: V3 = [0, 0, 0]
    const dq: Q4 = [0, 0, 0, 1]
    const tmp: V3 = [0, 0, 0]
    const tq: Q4 = [0, 0, 0, 1]
    let cached = false
    const attached = (t: number, p: V3, q: Q4) => {
      if (host == null) {
        p[0] = localPos[0]
        p[1] = localPos[1]
        p[2] = localPos[2]
        q.splice(0, 4, ...localQ)
        return
      }
      pose[host]!(t, hp, hq)
      qRot(hq, localPos, p)
      p[0] += hp[0]
      p[1] += hp[1]
      p[2] += hp[2]
      qMul(hq, localQ, q)
    }
    const free = host == null || detach != null
    pose.push((t, p, q) => {
      if (free && t >= T.relocate) {
        p[0] = resultPos[0]
        p[1] = resultPos[1]
        p[2] = resultPos[2]
        wobblePos(w, t, tmp)
        p[0] += tmp[0]
        p[1] += tmp[1]
        p[2] += tmp[2]
        wobbleRot(w, t, q)
        qMul(localQ, q, q)
        return 1
      }
      if (detach == null || t <= detach) {
        attached(t, p, q)
        if (host == null) {
          wobblePos(w, t, tmp)
          p[0] += tmp[0]
          p[1] += tmp[1]
          p[2] += tmp[2]
          wobbleRot(w, t, tq)
          qMul(q, tq, q)
        }
        return 1
      }
      if (!cached) {
        attached(detach, d0, dq)
        cached = true
      }
      const u = smooth(detach, detach + 1.6, t)
      p[0] = d0[0] + drift[0] * u
      p[1] = d0[1] + drift[1] * u
      p[2] = d0[2] + drift[2] * u
      // дрожь нарастает от нуля в момент отрыва (непрерывно)
      wobblePos(w, t, tmp)
      p[0] += tmp[0] * u
      p[1] += tmp[1] * u
      p[2] += tmp[2] * u
      qAxis([0.3, 1, 0.2], 0.9 * u * Math.sin(0.7 * (t - detach)), tq)
      qMul(dq, tq, q)
      return 1
    })
  }
  // места воды на шаге «итог»: не ближе 300 пм друг к другу, в стороне от кристалла и наблюдателей
  const resultSpots: V3[] = []
  const blockers = [...spec.result.anions, ...spec.result.protons]
  for (let tries = 0; tries < 4000 && resultSpots.length < 44; tries++) {
    const p: V3 = [-1500 + 3000 * r(), -1000 + 2000 * r(), -220 + 440 * r()]
    const c = spec.result.crystal
    const inCrystal = Math.abs(p[0] - c[0]) < 1050 && Math.abs(p[1] - c[1]) < 560
    const nearIon = blockers.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 460)
    const crowded = resultSpots.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 300)
    if (!inCrystal && !nearIon && !crowded) resultSpots.push(p)
  }
  let spot = 0
  const nextSpot = (): V3 => resultSpots[spot++ % resultSpots.length]!
  // Ba²⁺: октаэдр с осью C₃ по z (передние три — не на луче к зрителю), кислород к иону.
  const baH = hyd.get('Ba')
  const octa: V3[] = []
  for (let i = 0; i < 6; i++) {
    const front = i % 2 === 0
    const pol = front ? Math.acos(1 / Math.sqrt(3)) : Math.PI - Math.acos(1 / Math.sqrt(3))
    const az = (i * Math.PI) / 3
    octa.push([Math.sin(pol) * Math.cos(az), Math.sin(pol) * Math.sin(az), Math.cos(pol)])
  }
  octa.slice(0, baH?.shown ?? 6).forEach((n, i) => {
    const pos: V3 = [n[0] * core.baO, n[1] * core.baO, n[2] * core.baO]
    const q = qMul(qFromTo([0, 1, 0], n), qAxis([0, 1, 0], r() * 6.28))
    // к партнёру (+x) смотрят две молекулы — они уходят при встрече, остальные — при посадке
    const toward = n[0] > 0.3
    const det = toward ? S.meet.from + 1.4 + 0.3 * i : T.shed + 0.15 * i
    // вода уходит вверх и в глубину — в сторону от будущего кристаллика (он внизу)
    addWater(`wBa${i}`, cation, pos, q, det, [n[0] * 260, 380 + Math.abs(n[1]) * 140, (n[2] >= 0 ? 1 : -1) * 260], nextSpot())
  })
  // Cl⁻: 4 молекулы, к иону обращён атом H (связь O–H смотрит на ион)
  const clH = hyd.get('Cl')
  const tetDirs: V3[] = [
    [0.82, 0, 0.57],
    [-0.82, 0, 0.57],
    [0, 0.82, -0.57],
    [0, -0.82, -0.57],
  ]
  anions.forEach((host, k) => {
    tetDirs.slice(0, clH?.shown ?? 4).forEach((n0, i) => {
      const n = norm(n0)
      const pos: V3 = [n[0] * core.clO, n[1] * core.clO, n[2] * core.clO]
      const q = qMul(qFromTo(norm(wLocal[0]!), [-n[0], -n[1], -n[2]]), qAxis(norm(wLocal[0]!), r() * 6.28))
      addWater(`wCl${k}${i}`, host, pos, q, null, [0, 0, 0], [0, 0, 0])
    })
  })
  // SO₄²⁻: по одной молекуле на атом O, H воды к O сульфата (водородная связь O–H···O)
  const soH = hyd.get('SO4')
  tetra.slice(0, soH?.shown ?? 4).forEach((v, i) => {
    const n = norm(v)
    const d = core.so + core.hbond + core.wOH
    const pos: V3 = [n[0] * d, n[1] * d, n[2] * d]
    const q = qMul(qFromTo(norm(wLocal[0]!), [-n[0], -n[1], -n[2]]), qAxis(norm(wLocal[0]!), r() * 6.28))
    const toward = n[0] < 0
    const det = toward ? S.meet.from + 1.6 + 0.3 * i : T.shed + 0.25 + 0.15 * i
    addWater(`wSO4${i}`, group, pos, q, det, [n[0] * 260, 400 + Math.abs(n[1]) * 140, (n[2] >= 0 ? 1 : -1) * 260], nextSpot())
  })
  // H₃O⁺: по молекуле на каждый H, кислород воды к H (O–H···O), водороды наружу
  const pH = hyd.get('H3O')
  protons.forEach((host, k) => {
    pyr.slice(0, pH?.shown ?? 3).forEach((v, i) => {
      const n = norm(v)
      const d = core.h3oOH + core.hbond
      const pos: V3 = [n[0] * d, n[1] * d, n[2] * d]
      const q = qMul(qFromTo([0, 1, 0], n), qAxis([0, 1, 0], r() * 6.28))
      addWater(`wH3O${k}${i}`, host, pos, q, null, [0, 0, 0], [0, 0, 0])
    })
  })
  // фоновые молекулы воды
  // фон — второй план: чуть глубже ионов (мельче в перспективе, класс ещё и приглушает их цвет)
  spec.waters.forEach((p, i) => {
    const q = qMul(qAxis([0, 0, 1], r() * 6.28), qAxis([1, 0, 0], r() * 6.28))
    addWater(`wBg${i}`, null, [p[0], p[1], p[2] - 220], q, null, [0, 0, 0], nextSpot())
  })

  // ——— подписи ———
  const cap = spec.science.captions
  const eqL10n = (s: string): L10n => ({ ru: s, en: s, uz: s })
  const chargeText = (s: string) => eqL10n(s)
  // Заряды Ba²⁺ и Cl⁻ — внутри их шаров (ionSym); подписью рядом — только у групп: [SO₄]²⁻ и H₃O⁺.
  const Lcharge = {
    group: addLabel({ id: 'q-SO4', kind: 'species', text: chargeText('[SO₄]²⁻'), from: T.micro1 - 0.2, to: S.nucleus.to }),
    protons: protons.map((_, k) => addLabel({ id: `q-H3O${k}`, kind: 'species', text: chargeText('H₃O⁺'), from: T.micro1 - 0.2, to: finish.to })),
  }
  const Lcap = {
    tubeA: addLabel({ id: 'tubeA', kind: 'species', text: cap.tubeA, from: S.tubes.from + 0.2, to: S.tubes.to }),
    tubeB: addLabel({ id: 'tubeB', kind: 'species', text: cap.tubeB, from: S.tubes.from + 0.2, to: T.lift0 + 0.3 }),
    solA: addLabel({ id: 'solA', kind: 'measure', text: cap.solutionA, from: T.micro1, to: S.meet.from + 0.6 }),
    solB: addLabel({ id: 'solB', kind: 'measure', text: cap.solutionB, from: T.micro1, to: S.meet.from + 0.6 }),
    crystal: addLabel({ id: 'crystal', kind: 'measure', text: cap.crystal, from: T.seed1, to: finish.to }),
    neighbors: addLabel({ id: 'neighbors', kind: 'measure', text: cap.neighbors, from: T.land + 0.3, to: S.nucleus.to }),
    precip: addLabel({ id: 'precip', kind: 'species', text: spec.callouts?.precipitate ?? cap.precipitate, from: S.settle.from + 1.2, to: S.settle.to + 0.3 }),
    acid: addLabel({ id: 'acid', kind: 'species', text: spec.callouts?.acid ?? cap.acid, from: S.settle.from + 1.7, to: S.settle.to + 0.3 }),
    nitric: addLabel({ id: 'nitric', kind: 'measure', text: cap.nitric, from: T.drop0 + 0.9, to: S.settle.to + 0.3 }),
    equation: addLabel({ id: 'equation', kind: 'equationPlate', text: eqL10n(spec.science.reaction.equation), from: S.result.from + 0.4, to: finish.to }),
    ionic: addLabel({ id: 'ionic', kind: 'measure', text: { ru: `9 кл.: ${spec.science.reaction.ionicShort}`, en: `Grade 9: ${spec.science.reaction.ionicShort}`, uz: `9-sinf: ${spec.science.reaction.ionicShort}` }, from: S.result.from + 1.8, to: finish.to }),
    stepEq: addLabel({ id: 'stepEq', kind: 'equation', text: eqL10n(spec.science.reaction.ionicShort), from: T.land + 0.6, to: S.nucleus.to }),
    // пояснения микромира: что такое H₃O⁺, притяжение пары, наблюдатели не соединяются, сверка атомов итога
    hydronium: addLabel({ id: 'hydronium', kind: 'callout', text: cap.hydronium, from: T.explain0, to: T.explain1 }),
    attract: addLabel({ id: 'attract', kind: 'measure', text: cap.attract, from: S.meet.from + 1.6, to: T.meet1 }),
    spectators: addLabel({ id: 'spectators', kind: 'measure', text: cap.spectators, from: T.meet1 - 1.7, to: S.nucleus.from + 0.9 }),
    balance: addLabel({ id: 'balance', kind: 'measure', text: cap.balance, from: S.result.from + 1.0, to: finish.to }),
    resultAcid: addLabel({ id: 'resultAcid', kind: 'species', text: cap.acid, from: S.result.from + 1.4, to: finish.to }),
  }

  // ——— ореолы ———
  const halos: SolutionHaloDef[] = []
  const atomOf = (body: number, k = 0) => bodies[body]!.atoms[k]!
  // Заряд — мягким свечением по краю шара (френель) цветом знака и ореолом без кромки: у одноатомного
  // иона — вокруг шара, у многоатомного — облако чуть больше описанной сферы частицы.
  halos.push({ kind: 'plus', atom: atomOf(cation), radiusPm: -1, shape: 'ball', rimAtoms: [atomOf(cation)] })
  halos.push({ kind: 'minus', atom: atomOf(group), radiusPm: 1.22 * (core.so + cov('O') * SOLUTION_DRAW.ballScale), shape: 'cloud', rimAtoms: [...bodies[group]!.atoms] })
  for (const a of anions) halos.push({ kind: 'minus', atom: atomOf(a), radiusPm: -1, shape: 'ball', rimAtoms: [atomOf(a)] })
  for (const p of protons) halos.push({ kind: 'plus', atom: atomOf(p), radiusPm: 1.3 * (core.h3oOH + cov('H') * SOLUTION_DRAW.ballScale), shape: 'cloud', rimAtoms: [...bodies[p]!.atoms] })
  // «вот он, H⁺»: один из трёх H первого H₃O⁺ — тот, что пришёл от кислоты и сел на молекулу воды
  halos.push({ kind: 'proton', atom: atomOf(protons[0]!, 1), radiusPm: -1, shape: 'ball', rimAtoms: [atomOf(protons[0]!, 1)] })
  // 12 атомов O вокруг одного Ba²⁺ кристалла (Hill 1977): решётка побольше — все соседние группы на месте.
  // Сам этот Ba²⁺ — с тёплым кольцом (halo 'plus' в окне подсветки: kind 'neighbor' у атома Ba).
  const neighborCount = (u: Unit): number => {
    let c = 0
    for (const ligs of siteLigands) for (const o of ligs) if (dist(o, u.ba.s.posPm) < 340) c++
    return c
  }
  const hiUnit = units.reduce((best, u, i) => (i < spec.seedUnits && neighborCount(u) > neighborCount(units[best]!) ? i : best), 0)
  const hiBa = units[hiUnit]!.ba.s
  const big = latticeGroupedFragment(spec.crystalId, [3, 3, 3], [{ center: 'S', ligand: 'O', ligands: 4 }])
  const bigBa = big.sites.find((x) => x.role === 'ion' && x.basisIndex === hiBa.basisIndex && x.cell.every((c) => c === 1))
  const neighborO: V3[] = []
  if (bigBa) {
    const rel = big.sites
      .filter((x) => x.role === 'ligand')
      .map((x) => [x.posPm[0] - bigBa.posPm[0], x.posPm[1] - bigBa.posPm[1], x.posPm[2] - bigBa.posPm[2]] as V3)
      .sort((a, b) => Math.hypot(...a) - Math.hypot(...b))
      .slice(0, 12)
    for (const v of rel) neighborO.push([hiBa.posPm[0] + v[0], hiBa.posPm[1] + v[1], hiBa.posPm[2] + v[2]])
  }
  // O во фрагменте кадра — ореол едет за своим атомом; O соседних групп за кадром — светящаяся точка узла
  const siteBody = new Map<number, number>()
  lattice.forEach((b, k) => siteBody.set(k, b))
  siteBody.set(spec.seedUnits * 2, cation)
  siteBody.set(spec.seedUnits * 2 + 1, group)
  later.forEach((b, k) => siteBody.set((spec.seedUnits + 1) * 2 + k, b))
  const hiBaBody = siteBody.get(hiUnit * 2)!
  halos.push({ kind: 'neighbor', atom: atomOf(hiBaBody), radiusPm: -1, shape: 'ball', rimAtoms: [atomOf(hiBaBody)] })
  const neighborAtoms: number[] = []
  for (const o of neighborO) {
    let hit = -1
    let best = 18
    sites.forEach((site, si) => {
      if (!site.q) return
      const b = siteBody.get(si)
      if (b == null) return
      bodies[b]!.atoms.forEach((ai, k) => {
        if (k === 0) return
        const w = qRot(site.q!, atoms[ai]!.local)
        const d = dist([site.pos[0] + w[0], site.pos[1] + w[1], site.pos[2] + w[2]], o)
        if (d < best) {
          best = d
          hit = ai
        }
      })
    })
    if (hit >= 0) neighborAtoms.push(hit)
    halos.push(
      hit >= 0
        ? { kind: 'neighbor', atom: hit, radiusPm: -1, shape: 'ball', rimAtoms: [hit] }
        : { kind: 'neighbor', atom: -1, pos: o, radiusPm: cov('O') * SOLUTION_DRAW.ballScale, shape: 'cloud', rimAtoms: [], ghost: true },
    )
  }

  // ——— муть ———
  // Хлопья мути рождаются там, где струя входит в раствор (время рождения — за время сливания),
  // растекаются к своему месту в жидкости (не выше точки входа) и потом оседают каждая со своей скоростью.
  const tx = new Float32Array(TURBID_N)
  const ty = new Float32Array(TURBID_N)
  const tz = new Float32Array(TURBID_N)
  const tv = new Float32Array(TURBID_N)
  const tb = new Float32Array(TURBID_N)
  for (let i = 0; i < TURBID_N; i++) {
    const a = r() * Math.PI * 2
    const rr = Math.sqrt(r()) * TUBE.r * 0.8
    tx[i] = Math.cos(a) * rr
    tz[i] = Math.sin(a) * rr
    tb[i] = r()
    ty[i] = r()
    tv[i] = 0.55 + 0.9 * r()
  }

  const radiusAt = (atom: number, t: number) => {
    const a = atoms[atom]!
    const b = bodies[a.body]!
    if (a.el === 'Ba' && b.land) return t >= b.land.t ? core.baCrystal : core.baWater
    return a.radiusPm
  }

  // ——— вид и раздвижка воды ———
  // H₃O⁺ — чуть крупнее (пирамида и подсвеченный H⁺ читаются и на телефоне)
  const viewK = Float32Array.from(atoms, (a) => {
    const b = bodies[a.body]!
    return solutionViewScale(a.el, b.kind === 'water', b.id.startsWith('wBg')) * (b.kind === 'proton' ? SOLUTION_DRAW.hydroniumView : 1)
  })
  const bs = SOLUTION_DRAW.ballScale
  const wIdx = bodies.map((b, i) => ({ b, i })).filter((x) => x.b.kind === 'water')
  const wK = new Float32Array(wIdx.length)
  const wR = new Float32Array(wIdx.length)
  wIdx.forEach(({ b }, w) => {
    // описанная сфера молекулы воды: центр на биссектрисе H–O–H (доля k пути O → середина H–H)
    const [o, h1, h2] = b.atoms.map((ai) => atoms[ai]!)
    const mid: V3 = [(h1!.local[0] + h2!.local[0]) / 2, (h1!.local[1] + h2!.local[1]) / 2, (h1!.local[2] + h2!.local[2]) / 2]
    const rO = o!.radiusPm * bs * viewK[b.atoms[0]!]!
    const rH = h1!.radiusPm * bs * viewK[b.atoms[1]!]!
    let best = Infinity
    let bestK = 0
    for (let k = 0; k <= 1.4; k += 0.005) {
      const c: V3 = [mid[0] * k, mid[1] * k, mid[2] * k]
      const rr = Math.max(Math.hypot(...c) + rO, dist(h1!.local, c) + rH, dist(h2!.local, c) + rH)
      if (rr < best) {
        best = rr
        bestK = k
      }
    }
    wK[w] = bestK
    wR[w] = best + 0.5
  })
  const oIdx = bodies.map((b, i) => ({ b, i })).filter((x) => x.b.kind !== 'water')
  const clearance: SolutionClearance = {
    waters: Int32Array.from(wIdx, (x) => x.i),
    wR,
    wK,
    obst: Int32Array.from(oIdx, (x) => x.i),
    // описанная сфера частицы по рисуемым шарам (у Ba²⁺ — наибольший радиус, КЧ 12: без скачка при посадке)
    oR: Float32Array.from(oIdx, ({ b }) =>
      Math.max(...b.atoms.map((ai) => Math.hypot(...atoms[ai]!.local) + (atoms[ai]!.el === 'Ba' ? core.baCrystal : atoms[ai]!.radiusPm) * bs * viewK[ai]!)),
    ),
    oFrom: Float32Array.from(oIdx, (x) => presence.get(x.i)?.[0] ?? -1e9),
    oTo: Float32Array.from(oIdx, (x) => presence.get(x.i)?.[1] ?? -1e9),
    scratch: new Float32Array(wIdx.length * 6),
    box: [0, 1, 2].map((k) => Math.max(...cellEdgesPm.flatMap(([a, b]) => [Math.abs(a[k]!), Math.abs(b[k]!)]))) as V3,
    boxFrom: T.seed0 - 1.4,
    boxTo: T.seed0,
    boxed: Uint8Array.from(wIdx, (x) => (x.b.id.startsWith('wCl') || x.b.id.startsWith('wH3O') ? 0 : 1)),
  }

  const model: SolutionModel = {
    spec,
    core,
    timing,
    finish,
    step,
    atoms,
    bodies,
    sticks,
    labels,
    sites,
    siteLigands,
    cellEdges: cellEdgesPm,
    shortestCationO,
    turbidPoints: TURBID_N,
    halos,
    viewK,
    clearance,
    tube: TUBE,
    roles: { cation, group, anions, protons, lattice, later, waters },
    pose,
    radiusAt,
    turbid: { x: tx, y0: ty, z: tz, v: tv, birth: tb },
  }
  ;(model as unknown as { _T: typeof T; _L: typeof Lcap; _Q: typeof Lcharge })._T = T
  ;(model as unknown as { _L: typeof Lcap })._L = Lcap
  ;(model as unknown as { _Q: typeof Lcharge })._Q = Lcharge
  ;(model as unknown as { _H: Internals['_H'] })._H = { hiBa: atomOf(hiBaBody), hiBaBody, neighborAtoms, neighborCount: neighborO.length }
  return model
}

type Internals = {
  _T: {
    lift0: number
    lift1: number
    pour0: number
    pour1: number
    back0: number
    back1: number
    micro0: number
    micro1: number
    mix0: number
    meet1: number
    seed0: number
    seed1: number
    shed: number
    land0: number
    land: number
    microOut0: number
    microOut1: number
    pip0: number
    drop0: number
    pip1: number
    micro2: number
    micro3: number
    relocate: number
    explain0: number
    explain1: number
  }
  _L: Record<'tubeA' | 'tubeB' | 'solA' | 'solB' | 'crystal' | 'neighbors' | 'precip' | 'acid' | 'nitric' | 'equation' | 'ionic' | 'stepEq' | 'hydronium' | 'attract' | 'spectators' | 'balance' | 'resultAcid', number>
  _Q: { group: number; protons: number[] }
  /** подсветка «12 O вокруг Ba²⁺»: атом и тело этого Ba²⁺, атомы O кадра среди 12 соседей */
  _H: { hiBa: number; hiBaBody: number; neighborAtoms: number[]; neighborCount: number }
}
const internals = (m: SolutionModel) => m as unknown as SolutionModel & Internals

export function createSolutionState(m: SolutionModel): SolutionState {
  const n = m.atoms.length
  const k = m.sticks.length
  const l = m.labels.length
  return {
    t: 0,
    step: 0,
    fade: 1,
    microAlpha: 0,
    microScale: 1,
    macroAlpha: 1,
    macroScale: 1,
    atomPos: new Float32Array(n * 3),
    atomR: new Float32Array(n),
    stickA: new Float32Array(k * 3),
    stickB: new Float32Array(k * 3),
    stickAlpha: new Float32Array(k),
    labelPos: new Float32Array(l * 3),
    labelOpacity: new Float32Array(l),
    bodyAppear: new Float32Array(m.bodies.length),
    attract: { a: [0, 0, 0], b: [0, 0, 0], alpha: 0 },
    divider: { alpha: 0 },
    tubeA: { x: 0, y: 0, rot: 0, level: 0, alpha: 0, surface: 0 },
    tubeB: { x: 0, y: 0, rot: 0, level: 0, alpha: 0, liquid: 0, surface: 0 },
    stream: { a: [0, 0, 0], b: [0, 0, 0], alpha: 0, pts: new Float32Array(STREAM_N * 3), rad: new Float32Array(STREAM_N) },
    lens: { c: [0, 0, 0], r: 0, alpha: 0, u: 0 },
    macroOffset: [0, 0, 0],
    microOffset: [0, 0, 0],
    pipette: { x: 0, y: 0, alpha: 0 },
    drops: new Float32Array(DROP_N * 4),
    callouts: new Float32Array(2 * 6),
    calloutAlpha: new Float32Array(2),
    turbidity: 0,
    sediment: 0,
    formed: 0,
    turbidPos: new Float32Array(m.turbidPoints * 3),
    crystal: { c: [0, 0, 0], yaw: 0, alpha: 0 },
    edgeAlpha: 0,
    haloPos: new Float32Array(m.halos.length * 3),
    haloR: new Float32Array(m.halos.length),
    haloAlpha: new Float32Array(m.halos.length),
    bodyDim: new Float32Array(m.bodies.length).fill(1),
    field: { alpha: 0 },
  }
}

const _bp: V3 = [0, 0, 0]
const _bq: Q4 = [0, 0, 0, 1]
const _v: V3 = [0, 0, 0]

/** Окно подписи с мягкими краями. */
function windowAlpha(from: number, to: number, t: number, edge = 0.35): number {
  return Math.min(smooth(from, from + edge, t), 1 - smooth(to - edge, to, t))
}

/** Состояние кадра в момент t (без аллокаций). */
export function sampleSolutionState(m: SolutionModel, t: number, out: SolutionState): SolutionState {
  const { _T: T, _L: L, _Q: Q, _H: HI } = internals(m)
  const S = m.step
  out.t = t
  out.step = m.timing.stepIndexAt(t)
  out.fade = 1 - smooth(m.finish.from, m.finish.to, t)

  // ——— макро ↔ микро: «лупа» ———
  // Круг наплывает на точку пробирки (облачко мути, слой осадка), макро-слой наезжает на неё и гаснет,
  // мир частиц растёт из той же точки внутри круга. Переходы целиком внутри шага: на паузе между
  // шагами кадр всегда полностью в одном слое (без тёмных провалов и «пробирок-призраков»).
  const u = lensAt(m, t, out.lens.c)
  out.lens.u = u
  const macroA = 1 - smooth(0.5, 0.95, u)
  const microA = smooth(0.04, 0.4, u)
  out.macroAlpha = macroA * out.fade
  // мир частиц в хвосте не гаснет целиком: вода и ионы-наблюдатели растворяются, кристалл остаётся и
  // передаёт кадр герою (без передачи класс гасит его по fade)
  out.microAlpha = microA
  out.macroScale = 1 + 2.4 * Math.pow(u, 1.4)
  out.microScale = 0.22 + 0.78 * smooth(0, 1, u)
  out.lens.r = 60 + 2300 * Math.pow(u, 1.6)
  out.lens.alpha = u > 0 && u < 1 ? smooth(0, 0.12, u) * (1 - smooth(0.78, 0.98, u)) : 0
  for (let c = 0; c < 2; c++) {
    out.macroOffset[c] = out.lens.c[c]! * (1 - out.macroScale)
    out.microOffset[c] = out.lens.c[c]! * (1 - out.microScale)
  }
  out.macroOffset[2] = 0
  out.microOffset[2] = 0

  // ——— тела и атомы ———
  const finKeep = 1 - smooth(m.finish.from, m.finish.from + 0.8, t)
  const n = m.atoms.length
  for (let bi = 0; bi < m.bodies.length; bi++) {
    const b = m.bodies[bi]!
    const appear = m.pose[bi]!(t, _bp, _bq) * (b.land || b.kind === 'lattice-cation' || b.kind === 'lattice-group' ? 1 : finKeep)
    for (const ai of b.atoms) {
      const a = m.atoms[ai]!
      qRot(_bq, a.local, _v)
      const o = ai * 3
      out.atomPos[o] = _bp[0] + _v[0]
      out.atomPos[o + 1] = _bp[1] + _v[1]
      out.atomPos[o + 2] = _bp[2] + _v[2]
      out.atomR[ai] = m.radiusAt(ai, t) * SOLUTION_DRAW.ballScale * appear
    }
    out.bodyAppear[bi] = appear
  }
  resolveWaterClearance(m, t, out)
  // ——— палочки ———
  for (let k = 0; k < m.sticks.length; k++) {
    const s = m.sticks[k]!
    for (let c = 0; c < 3; c++) {
      out.stickA[k * 3 + c] = out.atomPos[s.a * 3 + c]!
      out.stickB[k * 3 + c] = out.atomPos[s.b * 3 + c]!
    }
    // палочка — только у почти целых шаров: без голых «спичек» при проявлении кристалла
    out.stickAlpha[k] = out.atomR[s.a]! > 0 ? smooth(0.78, 1, out.bodyAppear[m.atoms[s.a]!.body]!) : 0
  }

  // ——— кристалл ———
  out.crystal.alpha = smooth(T.seed0, T.seed1, t)
  const relocated = t >= T.relocate
  const cc = relocated ? m.spec.result.crystal : m.spec.nucleus.center
  out.crystal.c[0] = cc[0]
  out.crystal.c[1] = cc[1]
  out.crystal.c[2] = cc[2]
  out.crystal.yaw = m.spec.nucleus.yaw + m.spec.nucleus.yawRate * Math.max(0, t - S.nucleus.from)
  // рёбра ячеек — после того как проявились ионы зародыша (не раньше: пустая коробка читалась как мусор)
  out.edgeAlpha = smooth(T.seed1 + 0.1, T.seed1 + 0.9, t)

  // ——— пунктир притяжения и граница растворов ———
  const ba = m.bodies[m.roles.cation]!.atoms[0]!
  const sAtom = m.bodies[m.roles.group]!.atoms[0]!
  // пунктир — от поверхности шара Ba²⁺ до поверхности шара S: не перечёркивает символы внутри шаров
  {
    const dx = out.atomPos[sAtom * 3]! - out.atomPos[ba * 3]!
    const dy = out.atomPos[sAtom * 3 + 1]! - out.atomPos[ba * 3 + 1]!
    const dz = out.atomPos[sAtom * 3 + 2]! - out.atomPos[ba * 3 + 2]!
    const len = Math.hypot(dx, dy, dz)
    const ra = len > 1e-6 ? Math.min(0.45, (out.atomR[ba]! * 1.08) / len) : 0
    const rb = len > 1e-6 ? Math.min(0.45, (out.atomR[sAtom]! * 1.1) / len) : 0
    const d = [dx, dy, dz]
    for (let c = 0; c < 3; c++) {
      out.attract.a[c] = out.atomPos[ba * 3 + c]! + d[c]! * ra
      out.attract.b[c] = out.atomPos[sAtom * 3 + c]! - d[c]! * rb
    }
  }
  out.attract.alpha = windowAlpha(S.meet.from + 1.2, T.land0 + 0.6, t, 0.5)
  out.field.alpha = out.attract.alpha
  sampleMicroFocus(m, t, out, T, HI)
  out.divider.alpha = windowAlpha(T.micro1 - 0.3, S.meet.from + 0.9, t, 0.5)

  sampleMacro(m, t, out)

  // ——— подписи ———
  let k = out.microScale
  let off = out.microOffset
  const setLabel = (li: number, x: number, y: number, z: number, alpha: number) => {
    out.labelPos[li * 3] = x * k + off[0]
    out.labelPos[li * 3 + 1] = y * k + off[1]
    out.labelPos[li * 3 + 2] = z * k + off[2]
    out.labelOpacity[li] = alpha
  }
  // символы внутри шаров (видимы с микро-слоем)
  for (let ai = 0; ai < n; ai++) {
    const a = m.atoms[ai]!
    if (a.label < 0) continue
    const d = m.labels[a.label]!
    const o = ai * 3
    const vis = out.atomR[ai]! > 1 ? 1 : 0
    setLabel(a.label, out.atomPos[o]!, out.atomPos[o + 1]!, out.atomPos[o + 2]!, windowAlpha(d.from, d.to, t) * out.microAlpha * vis)
  }
  // заряды — справа сверху от иона
  const chargeAt = (li: number, atom: number, off: number, peak: number) => {
    const o = atom * 3
    setLabel(li, out.atomPos[o]! + off * 0.72, out.atomPos[o + 1]! + off * 0.86, out.atomPos[o + 2]!, windowAlpha(m.labels[li]!.from, m.labels[li]!.to, t) * out.microAlpha * peak)
  }

  // после посадки заряд группы не подписываем: в кристалле у соседей его тоже нет (на итоге — кольцом)
  chargeAt(Q.group, sAtom, 250, 1 - smooth(T.land - 0.3, T.land + 0.2, t))
  Q.protons.forEach((li, k) => chargeAt(li, m.bodies[m.roles.protons[k]!]!.atoms[0]!, 190, 1))
  // подписи макро-кадра — в системе пробирок, с масштабом и сдвигом макро-слоя
  k = out.macroScale
  off = out.macroOffset
  const H = m.tube.h
  const ma = out.macroAlpha
  const win = (li: number) => windowAlpha(m.labels[li]!.from, m.labels[li]!.to, t)
  setLabel(L.tubeA, TUBE_A_X, -H / 2 - 90, 0, win(L.tubeA) * ma)
  setLabel(L.tubeB, TUBE_B_X, -H / 2 - 90, 0, win(L.tubeB) * ma)
  // выноски шага «осадок»: подпись — у конца полки (класс сдвигает её вправо на полширины текста)
  const co = out.callouts
  setLabel(L.precip, co[4]!, co[5]!, 0, win(L.precip) * ma)
  setLabel(L.acid, co[10]!, co[11]!, 0, win(L.acid) * ma)
  out.calloutAlpha[0] = win(L.precip) * ma
  out.calloutAlpha[1] = win(L.acid) * ma
  // «+ HNO₃ — осадок не растворяется» — справа от устья, куда капала пипетка
  setLabel(L.nitric, TUBE_A_X + m.tube.r + 150, H / 2 + 70, 0, win(L.nitric) * ma)
  off = out.microOffset
  // подписи микро-кадра
  k = out.microScale
  const mi = out.microAlpha
  setLabel(L.solA, -620, 780, 0, windowAlpha(m.labels[L.solA]!.from, m.labels[L.solA]!.to, t) * mi)
  setLabel(L.solB, 620, 780, 0, windowAlpha(m.labels[L.solB]!.from, m.labels[L.solB]!.to, t) * mi)
  const cBottom = out.crystal.c[1] - 470
  setLabel(L.crystal, out.crystal.c[0], cBottom, 0, windowAlpha(m.labels[L.crystal]!.from, m.labels[L.crystal]!.to, t) * mi * out.crystal.alpha)
  // «у Ba²⁺ — 12 соседних O» — над подсвеченным ионом
  {
    const o = HI.hiBa * 3
    setLabel(L.neighbors, out.atomPos[o]!, out.atomPos[o + 1]! + 430, out.atomPos[o + 2]!, windowAlpha(m.labels[L.neighbors]!.from, m.labels[L.neighbors]!.to, t) * mi)
  }
  // уравнение шага есть в панели урока — в 3D его не дублируем
  setLabel(L.stepEq, out.crystal.c[0], cBottom - 300, 0, 0)
  setLabel(L.equation, 150, -700, 0, windowAlpha(m.labels[L.equation]!.from, m.labels[L.equation]!.to, t) * mi)
  setLabel(L.balance, 150, -870, 0, windowAlpha(m.labels[L.balance]!.from, m.labels[L.balance]!.to, t) * mi)
  setLabel(L.ionic, 150, -1010, 0, windowAlpha(m.labels[L.ionic]!.from, m.labels[L.ionic]!.to, t) * mi)
  sampleMicroLabels(m, t, out, L, setLabel)
  // хвост: подписи уходят вместе с водой (у героя — свои)
  if (finKeep < 1) for (let li = 0; li < m.labels.length; li++) out.labelOpacity[li] = out.labelOpacity[li]! * finKeep
  return out
}

/** Проходов раздвижки воды за кадр (Гаусс — Зейдель по описанным сферам). */
const PUSH_ITERS = 6

/**
 * Раздвижка воды: молекула воды (жёсткая — сдвигается целиком) никогда не заходит в чужие частицы и в
 * другие молекулы воды. Чистая функция кадра: от поз из pose, без памяти между кадрами; непрерывна по t
 * (препятствие, которое ещё проявится, «вырастает» заранее — вода отходит плавно, без рывка).
 */
function resolveWaterClearance(m: SolutionModel, t: number, out: SolutionState): void {
  const C = m.clearance
  const nw = C.waters.length
  const no = C.obst.length
  const P = out.atomPos
  const c = C.scratch
  const gap = SOLUTION_DRAW.pushGap
  for (let w = 0; w < nw; w++) {
    const at = m.bodies[C.waters[w]!]!.atoms
    const o = at[0]! * 3
    const h1 = at[1]! * 3
    const h2 = at[2]! * 3
    const k = C.wK[w]!
    for (let d = 0; d < 3; d++) {
      const v = P[o + d]! + ((P[h1 + d]! + P[h2 + d]!) / 2 - P[o + d]!) * k
      c[w * 6 + d] = v
      c[w * 6 + 3 + d] = v
    }
  }
  for (let it = 0; it < PUSH_ITERS; it++) {
    // вода ↔ вода: расходятся поровну
    for (let a = 0; a < nw; a++) {
      const ra = C.wR[a]!
      for (let b = a + 1; b < nw; b++) {
        const need = ra + C.wR[b]! + gap
        const dx = c[a * 6]! - c[b * 6]!
        const dy = c[a * 6 + 1]! - c[b * 6 + 1]!
        const dz = c[a * 6 + 2]! - c[b * 6 + 2]!
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 >= need * need) continue
        const d = Math.sqrt(d2)
        const inv = d > 1e-6 ? 1 / d : 0
        const push = (need - d) / 2
        const nx = d > 1e-6 ? dx * inv : 0
        const ny = d > 1e-6 ? dy * inv : 1
        const nz = d > 1e-6 ? dz * inv : 0
        c[a * 6] = c[a * 6]! + nx * push
        c[a * 6 + 1] = c[a * 6 + 1]! + ny * push
        c[a * 6 + 2] = c[a * 6 + 2]! + nz * push
        c[b * 6] = c[b * 6]! - nx * push
        c[b * 6 + 1] = c[b * 6 + 1]! - ny * push
        c[b * 6 + 2] = c[b * 6 + 2]! - nz * push
      }
    }
    // вода ↔ ионы и частицы: сдвигается только вода
    for (let o = 0; o < no; o++) {
      const pres = C.oTo[o]! < -1e8 ? 1 : smooth(C.oFrom[o]!, C.oTo[o]!, t)
      if (pres <= 0) continue
      const ai = m.bodies[C.obst[o]!]!.atoms[0]! * 3
      const ox = P[ai]!
      const oy = P[ai + 1]!
      const oz = P[ai + 2]!
      const ro = C.oR[o]! * pres + gap
      for (let w = 0; w < nw; w++) {
        const need = C.wR[w]! + ro
        const dx = c[w * 6]! - ox
        const dy = c[w * 6 + 1]! - oy
        const dz = c[w * 6 + 2]! - oz
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 >= need * need) continue
        const d = Math.sqrt(d2)
        const k = d > 1e-6 ? (need - d) / d : 0
        c[w * 6] = c[w * 6]! + dx * k
        c[w * 6 + 1] = c[w * 6 + 1]! + (d > 1e-6 ? dy * k : need)
        c[w * 6 + 2] = c[w * 6 + 2]! + dz * k
      }
    }
    // вода ↔ коробка ячеек кристалла: выталкивается через ближнюю грань (в системе кристалла)
    const bp = smooth(C.boxFrom, C.boxTo, t)
    if (bp > 0) {
      const cc = out.crystal.c
      const cy = Math.cos(out.crystal.yaw)
      const sy = Math.sin(out.crystal.yaw)
      for (let w = 0; w < nw; w++) {
        if (!C.boxed[w]) continue
        const dx = c[w * 6]! - cc[0]
        const dy = c[w * 6 + 1]! - cc[1]
        const dz = c[w * 6 + 2]! - cc[2]
        const l0 = dx * cy - dz * sy
        const l2 = dx * sy + dz * cy
        // эллипсоид вокруг коробки ячеек: вытолкнуть по лучу из центра — непрерывно (у коробки на
        // стыке граней вода перескакивала бы с одной грани на другую)
        const e = (C.wR[w]! + gap) * bp
        const h0 = C.box[0] * 1.12 * bp + e
        const h1 = C.box[1] * 1.12 * bp + e
        const h2 = C.box[2] * 1.12 * bp + e
        const q = (l0 / h0) ** 2 + (dy / h1) ** 2 + (l2 / h2) ** 2
        if (q >= 1 || q < 1e-9) continue
        const k = 1 / Math.sqrt(q)
        const n0 = l0 * k
        const n1 = dy * k
        const n2 = l2 * k
        // обратно в систему сцены (поворот вокруг y на yaw)
        c[w * 6] = cc[0] + n0 * cy + n2 * sy
        c[w * 6 + 1] = cc[1] + n1
        c[w * 6 + 2] = cc[2] - n0 * sy + n2 * cy
      }
    }
  }
  for (let w = 0; w < nw; w++) {
    const dx = c[w * 6]! - c[w * 6 + 3]!
    const dy = c[w * 6 + 1]! - c[w * 6 + 4]!
    const dz = c[w * 6 + 2]! - c[w * 6 + 5]!
    if (dx === 0 && dy === 0 && dz === 0) continue
    for (const ai of m.bodies[C.waters[w]!]!.atoms) {
      P[ai * 3] = P[ai * 3]! + dx
      P[ai * 3 + 1] = P[ai * 3 + 1]! + dy
      P[ai * 3 + 2] = P[ai * 3 + 2]! + dz
    }
  }
}

// ─── Макро: пробирки, струя, муть, пипетка ───────────────────────────────────

/** Прогресс «лупы» (0 — макро, 1 — микро) и её центр (система сцены) в момент t. */
function lensAt(m: SolutionModel, t: number, c: V3): number {
  const T = internals(m)._T
  const H = m.tube.h
  const bottom = -H / 2
  c[0] = TUBE_A_X
  c[2] = 0
  if (t < T.microOut0) {
    // в облачко мути (середина жидкости)
    c[1] = bottom + 0.4 * H
    return smooth(T.micro0, T.micro1, t)
  }
  if (t < T.micro2) {
    // обратно — к белому слою на дне (кристаллики и есть осадок)
    c[1] = bottom + m.tube.r * 0.6
    return 1 - smooth(T.microOut0, T.microOut1, t)
  }
  // в раствор над осадком (соляная кислота и кристаллик)
  c[1] = bottom + 0.26 * H
  return smooth(T.micro2, T.micro3, t)
}

const _pa: V3 = [0, 0, 0]
const _pb: V3 = [0, 0, 0]

/** Поза пробирки (дно x, y и наклон) с носиком — нижней точкой отогнутого края — в точке (lipX, lipY). */
function poseByLip(m: SolutionModel, lipX: number, lipY: number, rot: number, out: V3): V3 {
  const H = m.tube.h
  const rim = m.tube.r * 1.1
  out[0] = lipX + Math.sin(rot) * H + Math.cos(rot) * rim
  out[1] = lipY - Math.cos(rot) * H + Math.sin(rot) * rim
  out[2] = rot
  return out
}

/** Носик (нижняя точка кромки устья) пробирки с дном в (x, y) и наклоном rot. */
export function tubeLip(m: SolutionModel, x: number, y: number, rot: number, out: V3): V3 {
  const H = m.tube.h
  const rim = m.tube.r * 1.1
  out[0] = x - Math.sin(rot) * H - Math.cos(rot) * rim
  out[1] = y + Math.cos(rot) * H - Math.sin(rot) * rim
  out[2] = 0
  return out
}

/**
 * Поверхность жидкости в наклонённой пробирке — горизонтальная плоскость. Объём «как у стоящей» до
 * уровня level; для прямого цилиндра плоскость через точку оси на той же длине отсекает тот же объём
 * (клинья выше и ниже равны). Наклон больше 90° — жидкость собирается у устья.
 */
function tiltedSurface(m: SolutionModel, y: number, rot: number, level: number): number {
  const H = m.tube.h
  const lv = level * H
  const c = Math.cos(rot)
  const s = c >= 0 ? lv : H - Math.max(0, lv - m.tube.r * 0.35)
  return y + s * c
}

/** Поза пробирки B (кислота): стоит → поднимается → носиком над устьем A → льёт → возвращается. */
function tubeBPose(m: SolutionModel, t: number, out: V3): V3 {
  const T = internals(m)._T
  const H = m.tube.h
  const bottom = -H / 2
  // носик на 50 пм выше кромки A и чуть правее оси: струя падает в середину устья
  const lipX = TUBE_A_X + 40
  const lipY = H / 2 + 50
  const rot0 = (100 * Math.PI) / 180
  const rot1 = (115 * Math.PI) / 180
  const liftY = bottom + 270
  if (t <= T.lift0) {
    out[0] = TUBE_B_X
    out[1] = bottom
    out[2] = 0
    return out
  }
  if (t <= T.lift1) {
    out[0] = TUBE_B_X
    out[1] = lerp(bottom, liftY, smooth(T.lift0, T.lift1, t))
    out[2] = 0
    return out
  }
  if (t <= T.pour0) {
    const u = smooth(T.lift1, T.pour0, t)
    poseByLip(m, lipX, lipY, rot0, _pa)
    out[0] = lerp(TUBE_B_X, _pa[0], u)
    out[1] = lerp(liftY, _pa[1], u)
    out[2] = lerp(0, _pa[2], u)
    return out
  }
  if (t <= T.back0) {
    // льёт: поворот вокруг носика (жидкости всё меньше — наклон больше)
    return poseByLip(m, lipX, lipY, lerp(rot0, rot1, smooth(T.pour0, T.pour1, t)), out)
  }
  // возврат: сначала носик вверх и вправо (прочь от A), потом вниз на своё место
  const tm = T.back0 + 0.55 * (T.back1 - T.back0)
  _pb[0] = 600
  _pb[1] = 150
  _pb[2] = 0.75
  if (t <= tm) {
    poseByLip(m, lipX, lipY, rot1, _pa)
    const u = smooth(T.back0, tm, t)
    for (let c = 0; c < 3; c++) out[c] = lerp(_pa[c]!, _pb[c]!, u)
    return out
  }
  const u = smooth(tm, T.back1, t)
  out[0] = lerp(_pb[0], TUBE_B_X, u)
  out[1] = lerp(_pb[1], bottom, u)
  out[2] = lerp(_pb[2], 0, u)
  return out
}

const _pose: V3 = [0, 0, 0]
const _lip: V3 = [0, 0, 0]

/** Макро-слой: пробирки, уровни, струя, муть, осадок, пипетка HNO₃ и выноски. */
function sampleMacro(m: SolutionModel, t: number, out: SolutionState): void {
  const T = internals(m)._T
  const S = m.step
  const H = m.tube.h
  const R = m.tube.r
  const bottom = -H / 2

  // уровни: в A прибывает, в B убывает (немного остаётся на стенках и на дне)
  const flow = smooth(T.pour0 + 0.15, T.pour1 + 0.05, t)
  out.tubeA.x = TUBE_A_X
  out.tubeA.y = bottom
  out.tubeA.rot = 0
  out.tubeA.level = 0.3 + 0.26 * flow
  out.tubeA.alpha = 1
  out.tubeA.surface = bottom + out.tubeA.level * H
  tubeBPose(m, t, _pose)
  out.tubeB.x = _pose[0]
  out.tubeB.y = _pose[1]
  out.tubeB.rot = _pose[2]
  out.tubeB.level = 0.3 - 0.24 * flow
  // после шага 1 вторая пробирка не нужна: в кадре осадка — одна пробирка
  out.tubeB.alpha = t < S.ions.from + 0.5 ? 1 : 0
  out.tubeB.liquid = 1
  out.tubeB.surface = tiltedSurface(m, out.tubeB.y, out.tubeB.rot, out.tubeB.level)

  // струя: носик B → поверхность в A; парабола (x ∝ √падения), сужается по мере разгона
  tubeLip(m, out.tubeB.x, out.tubeB.y, out.tubeB.rot, _lip)
  const ex = Math.min(TUBE_A_X + 0.55 * R, Math.max(TUBE_A_X - 0.55 * R, _lip[0] - 45))
  const ey = out.tubeA.surface
  out.stream.a[0] = _lip[0]
  out.stream.a[1] = _lip[1]
  out.stream.a[2] = 0
  out.stream.b[0] = ex
  out.stream.b[1] = ey
  out.stream.b[2] = 0
  const head = smooth(T.pour0, T.pour0 + 0.3, t)
  const tail = smooth(T.pour1, T.pour1 + 0.3, t)
  out.stream.alpha = head - tail > 0.004 ? Math.min(1, (head - tail) * 10) : 0
  const drop = _lip[1] - ey
  for (let i = 0; i < STREAM_N; i++) {
    const f = lerp(tail, head, i / (STREAM_N - 1))
    out.stream.pts[i * 3] = _lip[0] + (ex - _lip[0]) * Math.sqrt(f)
    out.stream.pts[i * 3 + 1] = _lip[1] - f * drop
    out.stream.pts[i * 3 + 2] = 0
    out.stream.rad[i] = 15 * Math.pow(1 + 12 * f, -0.25)
  }

  // муть: хлопья рождаются в точке входа струи, растекаются, потом оседают; слой на дне растёт
  out.formed = smooth(T.pour0 + 0.2, T.pour1 + 0.4, t)
  const fall = 0.12 * smooth(T.back0, S.tubes.to, t) + 0.88 * smooth(S.settle.from + 0.4, S.settle.from + 3.4, t)
  out.sediment = 0.12 * out.formed * fall
  out.turbidity = out.formed * (1 - 0.8 * fall)
  const sedTop = R * 0.25 + out.sediment * H
  const tb = m.turbid
  const b0 = T.pour0 + 0.2
  const bSpan = T.pour1 - T.pour0 - 0.1
  for (let i = 0; i < m.turbidPoints; i++) {
    const bt = b0 + tb.birth[i]! * bSpan
    const o = i * 3
    if (t < bt) {
      // ещё не родилась — вне кадра
      out.turbidPos[o] = 0
      out.turbidPos[o + 1] = -1e5
      out.turbidPos[o + 2] = 0
      continue
    }
    // точка входа струи в момент рождения (уровень A тогда ниже)
    const eyB = (0.3 + 0.26 * smooth(T.pour0 + 0.15, T.pour1 + 0.05, bt)) * H
    const ty = R * 0.35 + Math.pow(tb.y0[i]!, 0.8) * (eyB - 30 - R * 0.35)
    const w = 1 - Math.pow(1 - Math.min(1, (t - bt) / 0.95), 3)
    const ySpread = eyB - 10 + (ty - eyB + 10) * w
    out.turbidPos[o] = (ex - TUBE_A_X) * (1 - w) + tb.x[i]! * w
    out.turbidPos[o + 1] = Math.max(sedTop, ySpread - tb.v[i]! * fall * H * 0.7)
    out.turbidPos[o + 2] = tb.z[i]! * w
  }

  // пипетка HNO₃ (шаг «осадок»): въезжает сверху справа, три капли в раствор, уезжает
  const pipIn = smooth(T.pip0, T.pip0 + 0.55, t)
  const pipOut = smooth(T.pip1, T.pip1 + 0.55, t)
  const tipX = TUBE_A_X
  const tipY = H / 2 + 70
  const pu = pipIn * (1 - pipOut)
  out.pipette.x = lerp(TUBE_A_X + 620, tipX, pu)
  out.pipette.y = lerp(H / 2 + 760, tipY, pu)
  out.pipette.alpha = pipIn > 0 && pipOut < 1 ? smooth(0, 0.25, pipIn) * (1 - smooth(0.75, 1, pipOut)) : 0
  const surfA = out.tubeA.surface
  for (let d = 0; d < DROP_N; d++) {
    const tau = t - (T.drop0 + d * 0.4)
    const o = d * 4
    out.drops[o] = tipX
    out.drops[o + 2] = 0
    if (tau >= -0.28 && tau < 0) {
      // капля набухает на кончике
      out.drops[o + 1] = tipY - 12
      out.drops[o + 3] = 13 * (1 + tau / 0.28)
    } else if (tau >= 0 && tau <= 0.34) {
      const u = tau / 0.34
      out.drops[o + 1] = tipY - 12 - (tipY - 12 - surfA) * u * u
      out.drops[o + 3] = 13
    } else {
      out.drops[o + 1] = tipY
      out.drops[o + 3] = 0
    }
  }

  // выноски: осадок (слой на дне) и раствор над ним; полка вправо, подпись — у её конца
  const co = out.callouts
  const kneeX = TUBE_A_X + R + 80
  const endX = TUBE_A_X + R + 200
  co[0] = TUBE_A_X + 0.3 * R
  co[1] = bottom + Math.max(R * 0.3, sedTop * 0.55)
  co[2] = kneeX
  co[3] = bottom - 40
  co[4] = endX
  co[5] = bottom - 40
  co[6] = TUBE_A_X + 0.35 * R
  co[7] = bottom + (sedTop + out.tubeA.level * H) * 0.5
  co[8] = kneeX
  co[9] = bottom + out.tubeA.level * H * 0.8
  co[10] = endX
  co[11] = bottom + out.tubeA.level * H * 0.8
}

// ─── Микромир: фокус кадра (ореолы зарядов, приглушение, пояснения) ─────────

type SetLabel = (li: number, x: number, y: number, z: number, alpha: number) => void

/**
 * Фокус микромира: кольца зарядов (+ тёплое, − холодное), «вот он, H⁺» в H₃O⁺, на встрече — пара
 * Ba²⁺ + SO₄²⁻ ярко, остальное в тени; в кристаллике — 12 атомов O вокруг одного Ba²⁺.
 */
function sampleMicroFocus(m: SolutionModel, t: number, out: SolutionState, T: Internals['_T'], HI: Internals['_H']): void {
  const S = m.step
  const R = m.roles
  const mi = out.microAlpha
  const meetDim = windowAlpha(S.meet.from + 0.9, T.land0 + 0.3, t, 0.6)
  const nbDim = windowAlpha(T.land + 0.5, S.nucleus.to - 0.05, t, 0.5)
  for (let bi = 0; bi < m.bodies.length; bi++) {
    const kind = m.bodies[bi]!.kind
    let d = 1
    if (bi !== R.cation && bi !== R.group) d -= (kind === 'water' ? 0.6 : 0.4) * meetDim
    if ((kind === 'lattice-cation' || kind === 'lattice-group' || bi === R.cation || bi === R.group) && bi !== HI.hiBaBody) d -= 0.62 * nbDim
    out.bodyDim[bi] = d
  }
  const pairWin = Math.max(windowAlpha(T.micro1 - 0.2, T.land + 0.3, t, 0.45), windowAlpha(S.result.from + 0.8, m.finish.to, t, 0.5))
  const specWin = windowAlpha(T.micro1 - 0.2, m.finish.to, t, 0.45)
  const pairAtoms0 = m.bodies[R.cation]!.atoms[0]!
  const pairAtoms1 = m.bodies[R.group]!.atoms[0]!
  const cy = Math.cos(out.crystal.yaw)
  const sy = Math.sin(out.crystal.yaw)
  let nb = 0
  for (let h = 0; h < m.halos.length; h++) {
    const def = m.halos[h]!
    const o = h * 3
    let seen = 1
    if (def.atom >= 0) {
      const a = def.atom * 3
      out.haloPos[o] = out.atomPos[a]!
      out.haloPos[o + 1] = out.atomPos[a + 1]!
      out.haloPos[o + 2] = out.atomPos[a + 2]!
      seen = out.atomR[def.atom]! > 0 ? 1 : 0
      out.haloR[h] = def.radiusPm < 0 ? out.atomR[def.atom]! * m.viewK[def.atom]! * SOLUTION_HALO_BALL : def.radiusPm
    } else if (def.pos) {
      const p = def.pos
      out.haloPos[o] = out.crystal.c[0] + p[0] * cy + p[2] * sy
      out.haloPos[o + 1] = out.crystal.c[1] + p[1]
      out.haloPos[o + 2] = out.crystal.c[2] - p[0] * sy + p[2] * cy
      out.haloR[h] = def.radiusPm
    }
    let a: number
    if (def.kind === 'plus' || def.kind === 'minus') {
      a = def.atom === pairAtoms0 || def.atom === pairAtoms1 ? pairWin : specWin * out.bodyDim[m.atoms[def.atom]!.body]!
    } else if (def.kind === 'proton') {
      a = windowAlpha(T.explain0 + 0.3, T.explain1, t, 0.4) * (0.8 + 0.2 * Math.sin(t * 5.5))
    } else {
      a = windowAlpha(T.land + 0.6 + 0.07 * nb, S.nucleus.to - 0.05, t, 0.35)
      nb++
    }
    out.haloAlpha[h] = a * mi * seen
  }
}

/** Подписи-пояснения микромира: выноска H₃O⁺, притяжение пары, наблюдатели, соляная кислота на итоге. */
function sampleMicroLabels(m: SolutionModel, t: number, out: SolutionState, L: Internals['_L'], setLabel: SetLabel): void {
  const mi = out.microAlpha
  const win = (li: number) => windowAlpha(m.labels[li]!.from, m.labels[li]!.to, t) * mi
  const P = out.atomPos
  const R = m.roles
  const h0 = m.bodies[R.protons[0]!]!.atoms[0]! * 3
  setLabel(L.hydronium, P[h0]! - 80, P[h0 + 1]! + 380, P[h0 + 2]!, win(L.hydronium))
  const a = out.attract
  setLabel(L.attract, (a.a[0] + a.b[0]) / 2, Math.max(a.a[1], a.b[1]) + 250, (a.a[2] + a.b[2]) / 2, win(L.attract))
  const c0 = m.bodies[R.anions[0]!]!.atoms[0]! * 3
  setLabel(L.spectators, (P[c0]! + P[h0]!) / 2, Math.max(P[c0 + 1]!, P[h0 + 1]!) + 270, 0, win(L.spectators))
  // «соляная кислота» — над наблюдателями (не между ними: на узком экране подпись ложилась на нижнюю пару)
  let x = 0
  let y = -Infinity
  const spect = R.anions.length + R.protons.length
  for (const b of R.anions) {
    x += P[m.bodies[b]!.atoms[0]! * 3]!
    y = Math.max(y, P[m.bodies[b]!.atoms[0]! * 3 + 1]!)
  }
  for (const b of R.protons) {
    x += P[m.bodies[b]!.atoms[0]! * 3]!
    y = Math.max(y, P[m.bodies[b]!.atoms[0]! * 3 + 1]!)
  }
  setLabel(L.resultAcid, x / spect, y + 440, 0, win(L.resultAcid))
}

/** Габарит кадра по времени (пм): w, h, центр — хост вписывает его в свободную область. */
export function solutionExtentAt(m: SolutionModel, t: number): { w: number; h: number; cx: number; cy: number } {
  const S = m.step
  const T = internals(m)._T
  const keys: { t: number; e: [number, number, number, number] }[] = [
    { t: S.tubes.from, e: [900, 1250, 0, -120] },
    { t: T.lift0, e: [900, 1250, 0, -120] },
    { t: T.pour0 - 0.2, e: [1450, 1800, 200, 300] },
    { t: T.pour1 + 0.1, e: [1450, 1800, 200, 300] },
    { t: T.back0 + 0.55 * (T.back1 - T.back0), e: [1450, 1800, 200, 300] },
    { t: T.back1, e: [900, 1250, 0, -120] },
    // лёгкий наезд на пробирку с мутью перед «лупой»
    { t: T.micro0, e: [720, 1080, -190, -60] },
    { t: T.micro1, e: [2600, 1560, 0, 20] },
    { t: S.meet.from, e: [2600, 1560, 0, 20] },
    { t: S.meet.to - 0.6, e: [2300, 1650, 0, 0] },
    { t: S.nucleus.from + 1.2, e: [2400, 1950, 0, -150] },
    { t: S.nucleus.to, e: [2400, 1950, 0, -150] },
    // шаг «осадок»: одна пробирка и выноски справа, медленный наезд
    { t: T.microOut1, e: [1250, 1320, 110, 10] },
    // пипетка HNO₃ въезжает сверху — кадр чуть выше
    { t: T.pip0, e: [1250, 1320, 110, 10] },
    { t: T.pip0 + 0.6, e: [1250, 1600, 110, 110] },
    { t: T.pip1, e: [1250, 1600, 110, 110] },
    { t: T.micro2, e: [1150, 1280, 90, -10] },
    { t: T.micro3 + 0.3, e: [3000, 2150, -120, -180] },
  ]
  const out = { w: 0, h: 0, cx: 0, cy: 0 }
  let a = keys[0]!
  let b = keys[0]!
  for (let i = 0; i < keys.length; i++) {
    if (keys[i]!.t <= t) a = keys[i]!
    if (keys[i]!.t >= t) {
      b = keys[i]!
      break
    }
    b = keys[i]!
  }
  const u = b.t > a.t ? smooth(a.t, b.t, t) : 1
  out.w = lerp(a.e[0], b.e[0], u)
  out.h = lerp(a.e[1], b.e[1], u)
  out.cx = lerp(a.e[2], b.e[2], u)
  out.cy = lerp(a.e[3], b.e[3], u)
  return out
}

/** Внутренние моменты сюжета — для теста. */
export function solutionMoments(m: SolutionModel): Internals['_T'] {
  return internals(m)._T
}
