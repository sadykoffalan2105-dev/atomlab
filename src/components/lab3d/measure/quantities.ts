/**
 * Измерительный слой 3D-лаборатории: количества веществ, сосуды, газы, растворы, тепло и скорость реакции.
 * Чистая логика без React и three — ею пользуются задачи-опыты (src/data/labTasks), приборы установок и тесты.
 *
 * Правила школьной химии (Kimyo 7–9):
 *  • относительные атомные массы — школьные округлённые (Cl = 35,5, остальные целые);
 *  • молярный объём газа при н.у. (0 °C, 101,3 кПа) — 22,4 л/моль;
 *  • в классе 20–25 °C: газ занимает больший объём, его приводят к н.у. по V₀ = V · 273 / (273 + t).
 */
import { parseEquationText, parseFormula } from '../../../chemistry/equationFormula'

/* ── Атомные и молярные массы ── */

/** Относительные атомные массы, как в учебниках Kimyo (таблица Менделеева в конце книги). */
export const SCHOOL_AR: Readonly<Record<string, number>> = {
  H: 1,
  C: 12,
  N: 14,
  O: 16,
  Na: 23,
  Mg: 24,
  Al: 27,
  Si: 28,
  P: 31,
  S: 32,
  Cl: 35.5,
  K: 39,
  Ca: 40,
  Mn: 55,
  Fe: 56,
  Cu: 64,
  Zn: 65,
  Br: 80,
  Ag: 108,
  I: 127,
  Ba: 137,
}

/** Молярная масса (г/моль) по школьным атомным массам: «CuSO4*5H2O» → 250, «Ca(OH)2» → 74. */
export function molarMass(formula: string): number {
  const parsed = parseFormula(formula)
  if (!parsed || parsed.electron) throw new Error(`molarMass: не разобрана формула «${formula}»`)
  let m = 0
  for (const [el, n] of Object.entries(parsed.counts)) {
    const a = SCHOOL_AR[el]
    if (a == null) throw new Error(`molarMass: нет школьной атомной массы для ${el} («${formula}»)`)
    m += a * n
  }
  return Math.round(m * 1000) / 1000
}

/** Число Авогадро, как в учебнике: 6,02·10²³ частиц в 1 моль. */
export const AVOGADRO = 6.02e23

/* ── Газы ── */

/** Молярный объём газа при н.у., мл/моль. */
export const VM_ML = 22400
/** 0 °C в кельвинах — как в школьной формуле приведения к н.у. */
export const T0_K = 273
/** Нормальное давление, кПа. */
export const P0_KPA = 101.3
/** Комнатная температура в классе по умолчанию, °C. */
export const ROOM_T_C = 22

/** Объём газа (мл) при н.у. для n моль. */
export function gasNormalMl(nMol: number): number {
  return nMol * VM_ML
}

/** Объём газа (мл) при температуре t °C и давлении p кПа (сухой газ): V = V₀ · (273 + t) / 273 · p₀ / p. */
export function gasMlAt(nMol: number, tC = ROOM_T_C, pKPa = P0_KPA): number {
  return gasNormalMl(nMol) * ((T0_K + tC) / T0_K) * (P0_KPA / pKPa)
}

/** Привести объём газа к н.у. (школьная формула): V₀ = V · 273 / (273 + t) · p / p₀. */
export function toNormalMl(vMl: number, tC = ROOM_T_C, pKPa = P0_KPA): number {
  return vMl * (T0_K / (T0_K + tC)) * (pKPa / P0_KPA)
}

/** Давление насыщенного водяного пара (кПа) при 15–30 °C: газ, собранный над водой, влажный. */
export function waterVaporKPa(tC: number): number {
  // формула Магнуса — точность ±1 % в этом диапазоне
  return 0.6112 * Math.exp((17.62 * tC) / (243.12 + tC))
}

/* ── Растворы ── */

/**
 * Плотность водных растворов (г/мл) при 20 °C — справочные значения для концентраций из задач.
 * Ключ — формула растворённого вещества, значения — пары [массовая доля, ρ].
 */
const DENSITY_TABLE: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  H2O: [[0, 0.998]],
  H2SO4: [[0, 0.998], [0.1, 1.066], [0.2, 1.139], [0.3, 1.219]],
  HCl: [[0, 0.998], [0.05, 1.023], [0.1, 1.047], [0.2, 1.098]],
  NaOH: [[0, 0.998], [0.1, 1.109], [0.2, 1.219], [0.3, 1.328]],
  CuSO4: [[0, 0.998], [0.1, 1.107], [0.2, 1.226]],
  AgNO3: [[0, 0.998], [0.05, 1.042], [0.1, 1.088]],
  BaCl2: [[0, 0.998], [0.05, 1.044], [0.1, 1.092]],
  Na2SO4: [[0, 0.998], [0.05, 1.044], [0.1, 1.091]],
  Na2CO3: [[0, 0.998], [0.05, 1.050], [0.1, 1.103]],
  MgCl2: [[0, 0.998], [0.02, 1.015], [0.05, 1.039]],
}

/** Плотность раствора (г/мл) с массовой долей w (0…1): линейно между табличными точками. */
export function solutionDensity(solute: string, w: number): number {
  const t = DENSITY_TABLE[solute]
  if (!t) throw new Error(`solutionDensity: нет плотностей для ${solute}`)
  if (w <= t[0]![0]) return t[0]![1]
  for (let i = 1; i < t.length; i++) {
    const [w1, r1] = t[i]!
    const [w0, r0] = t[i - 1]!
    if (w <= w1) return r0 + ((r1 - r0) * (w - w0)) / (w1 - w0)
  }
  // за таблицей — по последнему отрезку
  const [w1, r1] = t[t.length - 1]!
  const [w0, r0] = t[t.length - 2] ?? [0, 0.998]
  return r1 + ((r1 - r0) * (w - w1)) / Math.max(1e-9, w1 - w0)
}

/** Массовая доля (0…1): w = m(вещества) / m(раствора). */
export function massFraction(mSolute: number, mSolution: number): number {
  return mSolution > 0 ? mSolute / mSolution : 0
}

/* ── Стехиометрия ── */

export interface ReactionSide {
  readonly formula: string
  readonly coeff: number
}
export interface Reaction {
  readonly reactants: readonly ReactionSide[]
  readonly products: readonly ReactionSide[]
}

/** Уравнение из учебника → реакция (формулы ASCII без пометок ↑↓, коэффициенты). */
export function parseReaction(equation: string): Reaction {
  const eq = parseEquationText(equation)
  if (!eq) throw new Error(`parseReaction: не разобрано «${equation}»`)
  const side = (list: typeof eq.reactants) => list.map((s) => ({ formula: s.formula, coeff: s.coeff }))
  return { reactants: side(eq.reactants), products: side(eq.products) }
}

export interface ReactionResult {
  /** «Ход реакции» ξ, моль: сколько раз прошло уравнение. */
  readonly extent: number
  /** Вещество в недостатке (его хватило ровно на ξ). */
  readonly limiting: string
  /** Сколько каждого вещества вступило (моль). */
  readonly consumed: Readonly<Record<string, number>>
  /** Сколько каждого вещества образовалось (моль). */
  readonly formed: Readonly<Record<string, number>>
  /** Что осталось из взятого (моль); у вещества в избытке > 0. */
  readonly left: Readonly<Record<string, number>>
}

/**
 * Расчёт по уравнению «по недостатку»: даны количества (моль) реагентов, которые взяли; реакция идёт, пока не
 * кончится вещество в недостатке. Реагент, которого нет в amounts, считается в избытке.
 */
export function react(reaction: Reaction, amounts: Readonly<Record<string, number>>): ReactionResult {
  let extent = Infinity
  let limiting = ''
  for (const r of reaction.reactants) {
    const have = amounts[r.formula]
    if (have == null) continue
    const x = have / r.coeff
    if (x < extent) {
      extent = x
      limiting = r.formula
    }
  }
  if (!Number.isFinite(extent)) throw new Error('react: не задано ни одного реагента')
  const consumed: Record<string, number> = {}
  const left: Record<string, number> = {}
  for (const r of reaction.reactants) {
    consumed[r.formula] = extent * r.coeff
    if (amounts[r.formula] != null) left[r.formula] = Math.max(0, amounts[r.formula]! - extent * r.coeff)
  }
  const formed: Record<string, number> = {}
  for (const p of reaction.products) formed[p.formula] = extent * p.coeff
  return { extent, limiting, consumed, formed, left }
}

/** Баланс масс: сумма масс вступивших = сумма масс образовавшихся (г). Возвращает [вступило, образовалось]. */
export function massBalance(reaction: Reaction, result: ReactionResult): [number, number] {
  const a = reaction.reactants.reduce((s, r) => s + (result.consumed[r.formula] ?? 0) * molarMass(r.formula), 0)
  const b = reaction.products.reduce((s, p) => s + (result.formed[p.formula] ?? 0) * molarMass(p.formula), 0)
  return [a, b]
}

/* ── Тепло ── */

/** Удельная теплоёмкость воды и разбавленных растворов, Дж/(г·°C). */
export const C_WATER = 4.18

/**
 * Изменение температуры по простому тепловому балансу: Q = (Σ m·c) · ΔT.
 * qJ > 0 — тепло выделилось (температура растёт), < 0 — поглотилось. heatLoss — доля, ушедшая в воздух (0…1).
 */
export function deltaT(qJ: number, parts: readonly (readonly [massG: number, c: number])[], heatLoss = 0): number {
  const cap = parts.reduce((s, [m, c]) => s + m * c, 0)
  return cap > 0 ? (qJ * (1 - heatLoss)) / cap : 0
}

/* ── Скорость реакции (школьная картинка, не кинетика из вуза) ── */

/**
 * Доля прореагировавшего (0…1) за время t (с) реального опыта:
 *  • 'instant' — осадок AgCl, BaSO₄, Cu(OH)₂: за секунды;
 *  • 'decay'  — Zn или Al в кислоте, CuSO₄ + Fe: сначала быстро, потом медленнее (металл и кислота расходуются);
 *  • 'dehydrate' — нагревание кристаллогидрата: сначала прогрев, потом ровная потеря воды, в конце — медленно.
 * half — время (с), за которое проходит половина.
 */
export function reactedFraction(kind: 'instant' | 'decay' | 'dehydrate', tSec: number, half: number): number {
  if (tSec <= 0) return 0
  if (kind === 'instant') return 1 - Math.exp((-tSec * Math.LN2) / Math.max(0.1, half))
  if (kind === 'decay') return 1 - Math.pow(0.5, tSec / Math.max(0.1, half))
  // dehydrate: S-образная кривая (прогрев → потеря воды → «досушивание»)
  const x = tSec / Math.max(0.1, half)
  return (x * x) / (1 + x * x)
}

/* ── Сосуды: объём ↔ высота уровня ── */

export type VesselKind = 'tube' | 'cylinder' | 'beaker' | 'flask' | 'dish' | 'burette'

export interface VesselGeom {
  readonly kind: VesselKind
  /** Внутренний радиус цилиндрической части, м. */
  readonly ri: number
  /** Дно: круглое (пробирка — полусфера радиуса ri) или плоское. */
  readonly bottom: 'round' | 'flat'
  /** Высота внутренней полости до края, м (для проверки переполнения). */
  readonly h: number
}

/** Пробирка Ø18 × 150 мм (glassware.tsx: TUBE_R = 9 мм, жидкость — ri = 0,86 · TUBE_R). */
export const TUBE_GEOM: VesselGeom = { kind: 'tube', ri: 0.009 * 0.86, bottom: 'round', h: 0.15 }
/** Химический стакан «100 мл» (glassware.tsx: BEAKER_R = 26 мм, стенка ~1 мм). */
export const BEAKER100_GEOM: VesselGeom = { kind: 'beaker', ri: 0.0255, bottom: 'flat', h: 0.072 }

/** Объём жидкости (мл) при высоте уровня h (м) от дна. */
export function volumeForHeight(g: VesselGeom, h: number): number {
  if (h <= 0) return 0
  const r = g.ri
  let v: number
  if (g.bottom === 'round') {
    if (h <= r) v = Math.PI * h * h * (r - h / 3) // сферический сегмент
    else v = (2 / 3) * Math.PI * r ** 3 + Math.PI * r * r * (h - r)
  } else v = Math.PI * r * r * h
  return v * 1e6
}

/** Высота уровня (м) для объёма ml — обратная к volumeForHeight (в полусфере — делением пополам). */
export function heightForVolume(g: VesselGeom, ml: number): number {
  if (ml <= 0) return 0
  const v = ml / 1e6
  const r = g.ri
  if (g.bottom === 'flat') return v / (Math.PI * r * r)
  const hemi = (2 / 3) * Math.PI * r ** 3
  if (v >= hemi) return r + (v - hemi) / (Math.PI * r * r)
  let lo = 0
  let hi = r
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (volumeForHeight(g, mid) / 1e6 < v) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Мерный цилиндр: вместимость → внутренний радиус и высота шкалы (как у стандартных цилиндров ГОСТ 1770). */
export function cylinderGeom(capacityMl: number): VesselGeom & { readonly scaleH: number } {
  const SPEC: Record<number, [ri: number, scaleH: number]> = {
    10: [0.0065, 0.075],
    25: [0.0085, 0.11],
    50: [0.0105, 0.145],
    100: [0.0135, 0.175],
    250: [0.0195, 0.21],
    500: [0.0255, 0.245],
  }
  const s = SPEC[capacityMl]
  if (!s) throw new Error(`cylinderGeom: нет цилиндра на ${capacityMl} мл`)
  const [ri, scaleH] = s
  return { kind: 'cylinder', ri, bottom: 'flat', h: scaleH + 0.025, scaleH }
}

/* ── Округление показаний ── */

/** Округлить к цене деления (или половине — у стрелочных/шкальных приборов отсчёт «на глаз»). */
export function quantize(value: number, step: number): number {
  if (step <= 0) return value
  const k = Math.round(value / step)
  // убрать хвосты двоичной арифметики: 26.030000000000001 → 26.03
  const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + 1)
  return Number((k * step).toFixed(d))
}
