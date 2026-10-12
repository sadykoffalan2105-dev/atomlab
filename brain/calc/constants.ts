/**
 * Школьный калькулятор (brain/calc): константы «как в учебнике» Kimyo 7–11.
 * Учебники считают по округлённым Ar (Cu 64, Cl 35,5, S 32: «M(CuO) = 64 + 16 = 80», «BaSO₄ 233»),
 * Vm = 22,4 л/моль, Nₐ = 6,02·10²³. Режим 'precise' — точные IUPAC (atomicData) для «точнее …» в скобках.
 */
import { atomicMassU, isElementSymbol } from '../../src/chemistry/data/atomicData.ts'

export type CalcMode = 'school' | 'precise'

/** Ar, по которым считают учебники (остальные элементы — IUPAC, округлённые до целого). */
export const SCHOOL_AR: Readonly<Record<string, number>> = {
  H: 1, He: 4, Li: 7, Be: 9, B: 11, C: 12, N: 14, O: 16, F: 19, Ne: 20, Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, Ar: 40,
  K: 39, Ca: 40, Cr: 52, Mn: 55, Fe: 56, Co: 59, Ni: 59, Cu: 64, Zn: 65, Br: 80, Ag: 108, Sn: 119, I: 127, Ba: 137, W: 184, Pt: 195,
  Au: 197, Hg: 201, Pb: 207,
}

/** Молярный объём газа при н. у., л/моль */
export const VM = 22.4
/** Постоянная Авогадро (школьная), 1/моль */
export const NA = 6.02e23
/** Газовая постоянная, Дж/(моль·К) */
export const R = 8.314
/** Газовая постоянная для задач в атмосферах, л·атм/(моль·К) */
export const R_ATM = 0.082
/** Постоянная Фарадея (школьная), Кл/моль */
export const F = 96500
/** Нормальная температура, К (школьная: 0 °C = 273 К) */
export const T0 = 273
/** Нормальное давление */
export const P0_KPA = 101.325
export const P0_MMHG = 760
export const P0_ATM = 1
/** Средняя молярная масса воздуха, г/моль */
export const M_AIR = 29
/** Плотность воды, г/мл */
export const RHO_WATER = 1
/** Эквивалентные объёмы газов при н. у., л */
export const VEQ_H2 = 11.2
export const VEQ_O2 = 5.6
/** Объёмная доля кислорода в воздухе (школьная) */
export const O2_IN_AIR = 0.21

/**
 * Точные Ar (IUPAC, сокращённо) элементов, которых нет в atomicData (там 36 частых): B, Co, Sn, Pt из SCHOOL_AR и
 * редкие для задач («40 г As₂S₃», SrCO₃, TiO₂, CdS…). Школьное значение — округлённое до целого.
 */
const EXTRA_AR: Readonly<Record<string, number>> = {
  B: 10.81, Sc: 44.956, Ti: 47.867, Co: 58.933, Ga: 69.723, Ge: 72.63, As: 74.922, Se: 78.971, Kr: 83.798, Sr: 87.62, Y: 88.906,
  Zr: 91.224, Nb: 92.906, Mo: 95.95, Ru: 101.07, Rh: 102.91, Pd: 106.42, Cd: 112.41, In: 114.82, Sn: 118.71, Sb: 121.76, Te: 127.6,
  Xe: 131.29, La: 138.91, Ce: 140.12, Hf: 178.49, Ta: 180.95, Os: 190.23, Ir: 192.22, Pt: 195.08, Tl: 204.38, Bi: 208.98, Th: 232.04,
  U: 238.03, Ra: 226, Rn: 222, Po: 209, Fr: 223, Tc: 98,
}

/** Ar элемента в школьном режиме. */
export function schoolAr(sym: string): number | null {
  const s = SCHOOL_AR[sym]
  if (s != null) return s
  if (isElementSymbol(sym)) return Math.round(atomicMassU(sym))
  return EXTRA_AR[sym] != null ? Math.round(EXTRA_AR[sym]!) : null
}

export function arOf(sym: string, mode: CalcMode): number | null {
  if (mode === 'school') return schoolAr(sym)
  return isElementSymbol(sym) ? atomicMassU(sym) : (EXTRA_AR[sym] ?? null)
}

/** M = Σ n·Ar (null — в формуле неизвестный символ). */
export function molarMass(counts: Record<string, number>, mode: CalcMode = 'school'): number | null {
  let m = 0
  for (const [el, n] of Object.entries(counts)) {
    const a = arOf(el, mode)
    if (a == null) return null
    m += a * n
  }
  return m
}

/** Школьное и точное значения расходятся больше чем на 0,1 % — тогда точное пишем один раз в скобках. */
export function differsFromPrecise(school: number, precise: number): boolean {
  return precise > 0 && Math.abs(school - precise) / precise > 0.001
}
