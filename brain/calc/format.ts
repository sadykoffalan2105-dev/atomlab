/**
 * Школьный калькулятор: печать чисел и решения «Дано → Найти → Решение → Ответ» на трёх языках.
 * Округление: массы/объёмы/моли/концентрации — 2 знака, но не меньше 3 значащих цифр (0,0125); проценты — 1 знак;
 * pH — 2 знака; молярные массы — целое или ,5. Десятичная запятая для ru/uz, точка для en.
 */
import type { Lang } from '../pipeline/normalize.ts'
import { molarMass, differsFromPrecise } from './constants.ts'

export const L = (lang: Lang, ru: string, uz: string, en: string): string => (lang === 'ru' ? ru : lang === 'uz' ? uz : en)

export type NumKind = 'amount' | 'pct' | 'ph' | 'M' | 'int' | 'exact'

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
const toSup = (s: string) => [...s].map((c) => SUP[c] ?? c).join('')

/** Округление без ошибок двоичной записи (12,345 → 12,35). */
export function roundTo(x: number, d: number): number {
  const k = 10 ** d
  return Math.round((x + Math.sign(x) * Number.EPSILON * Math.abs(x)) * k) / k
}

/** Сколько знаков после запятой печатать у числа данного вида. */
export function decimalsFor(x: number, kind: NumKind): number {
  const a = Math.abs(x)
  if (kind === 'int') return 0
  if (kind === 'ph') return 2
  if (kind === 'M') return Math.abs(a * 2 - Math.round(a * 2)) < 1e-9 ? 1 : 2
  if (kind === 'pct') return a !== 0 && a < 1 ? Math.min(4, Math.max(2, 1 - Math.floor(Math.log10(a)))) : 1
  if (kind === 'exact') return 2
  if (a === 0) return 0
  return Math.min(6, Math.max(2, 2 - Math.floor(Math.log10(a))))
}

/** Число в школьном виде («0,0125», «56,7», «1,204·10²⁴»). */
export function fnum(x: number, lang: Lang, kind: NumKind = 'amount'): string {
  if (!Number.isFinite(x)) return String(x)
  const a = Math.abs(x)
  let s: string
  if (a !== 0 && (a >= 1e6 || a < 1e-4)) {
    const e = Math.floor(Math.log10(a))
    const m = roundTo(x / 10 ** e, 3)
    s = `${String(m)}·10${toSup(String(e))}`
  } else s = String(roundTo(x, decimalsFor(x, kind)))
  if (s.startsWith('-')) s = `−${s.slice(1)}`
  return lang === 'en' ? s : s.replace('.', ',')
}

export type UnitKey =
  | 'g' | 'kg' | 'l' | 'ml' | 'm3' | 'mol' | 'gmol' | 'moll' | 'pct' | 'kj' | 'kjmol' | 'C' | 'A' | 's' | 'min' | 'h' | 'K' | 'degC' | 'kPa'
  | 'atm' | 'mmHg' | 'gl' | 'gml' | 'eqL' | 'mmolEqL' | 'none' | 'times' | 'g100'

const UNITS: Record<UnitKey, [string, string, string]> = {
  g: ['г', 'g', 'g'], kg: ['кг', 'kg', 'kg'], l: ['л', 'l', 'L'], ml: ['мл', 'ml', 'mL'], m3: ['м³', 'm³', 'm³'], mol: ['моль', 'mol', 'mol'],
  gmol: ['г/моль', 'g/mol', 'g/mol'], moll: ['моль/л', 'mol/l', 'mol/L'], pct: ['%', '%', '%'], kj: ['кДж', 'kJ', 'kJ'], kjmol: ['кДж/моль', 'kJ/mol', 'kJ/mol'],
  C: ['Кл', 'C', 'C'], A: ['А', 'A', 'A'], s: ['с', 's', 's'], min: ['мин', 'min', 'min'], h: ['ч', 'soat', 'h'], K: ['К', 'K', 'K'], degC: ['°C', '°C', '°C'],
  kPa: ['кПа', 'kPa', 'kPa'], atm: ['атм', 'atm', 'atm'], mmHg: ['мм рт. ст.', 'mm sim. ust.', 'mmHg'], gl: ['г/л', 'g/l', 'g/L'], gml: ['г/мл', 'g/ml', 'g/mL'],
  eqL: ['моль-экв/л', 'mol-ekv/l', 'eq/L'], mmolEqL: ['ммоль-экв/л', 'mmol-ekv/l', 'mmol-eq/L'], none: ['', '', ''], times: ['раз(а)', 'marta', 'times'],
  g100: ['г на 100 г воды', 'g / 100 g suv', 'g per 100 g of water'],
}

export function unitLabel(u: UnitKey, lang: Lang): string {
  const t = UNITS[u]
  return lang === 'ru' ? t[0] : lang === 'uz' ? t[1] : t[2]
}

/** «13 г», «56,7 %», «7» (без единицы). */
export function withUnit(x: number, u: UnitKey, lang: Lang, kind: NumKind = 'amount'): string {
  const v = fnum(x, lang, u === 'pct' && kind === 'amount' ? 'pct' : kind)
  const ul = unitLabel(u, lang)
  return ul ? `${v} ${ul}` : v
}

/** Величина решения: «m(H₂) = 0,4 г». */
export type CalcValue = { label: string; value: number; unit: UnitKey; kind?: NumKind; /** нечисловой ответ (формула, «Zn в избытке») */ text?: string }

/** Число ответа в школьном виде (то, что модель обязана переписать). */
export const valueNum = (v: CalcValue, lang: Lang) => v.text ?? fnum(v.value, lang, v.kind ?? (v.unit === 'pct' ? 'pct' : v.unit === 'gmol' ? 'M' : 'amount'))

export const valueStr = (v: CalcValue, lang: Lang) => {
  if (v.text != null) return v.label ? `${v.label} = ${v.text}` : v.text
  const n = valueNum(v, lang)
  const u = unitLabel(v.unit, lang)
  return `${v.label} = ${n}${u ? (v.unit === 'pct' ? ' %' : ` ${u}`) : ''}`
}

/** Шаг решения — строка на языке ответа. */
export type Line = (lang: Lang) => string

/** «M(H₂SO₄) = 2·1 + 32 + 4·16 = 98 г/моль (точнее 98,08)» — школьная разбивка и точное значение при расхождении > 0,1 %. */
export function molarMassLine(pretty: string, counts: Record<string, number>): Line {
  return (lang) => {
    const M = molarMass(counts, 'school')!
    const Mp = molarMass(counts, 'precise')!
    const parts = Object.entries(counts).map(([el, n]) => {
      const a = molarMass({ [el]: 1 }, 'school')!
      return `${n > 1 ? `${n}·` : ''}${fnum(a, lang, 'M')}`
    })
    const sum = parts.length > 1 || (Object.values(counts)[0] ?? 1) > 1 ? ` = ${parts.join(' + ')}` : ''
    const precise = differsFromPrecise(M, Mp) ? ` (${L(lang, 'точнее', 'aniqroq', 'more precisely')} ${fnum(Mp, lang, 'exact')})` : ''
    return `M(${pretty})${sum} = ${fnum(M, lang, 'M')} ${unitLabel('gmol', lang)}${precise}`
  }
}

export type Solution = {
  type: string
  given: CalcValue[]
  find: string[]
  steps: Line[]
  answers: CalcValue[]
  /** уравнение реакции (уже уравненное), если задача по уравнению */
  equation?: string
  notes?: Line[]
}

const HEAD = {
  given: ['Дано', 'Berilgan', 'Given'],
  find: ['Найти', 'Topish kerak', 'Find'],
  sol: ['Решение', 'Yechish', 'Solution'],
  ans: ['Ответ', 'Javob', 'Answer'],
} as const
const h = (k: keyof typeof HEAD, lang: Lang) => HEAD[k][lang === 'ru' ? 0 : lang === 'uz' ? 1 : 2]

/** Строка ответа: «Ответ: V(H₂) = 4,48 л.» */
export function answerLine(sol: Solution, lang: Lang): string {
  return `${h('ans', lang)}: ${sol.answers.map((a) => valueStr(a, lang)).join('; ')}.`
}

/** «Дано: … Найти: … Решение: 1) … Ответ: …» (≤ 900 символов: лишние средние шаги сворачиваются). */
export function render(sol: Solution, lang: Lang, maxChars = 900): string {
  const given = sol.given.length ? `${h('given', lang)}: ${sol.given.map((g) => valueStr(g, lang)).join('; ')}.` : ''
  const find = sol.find.length ? `${h('find', lang)}: ${sol.find.join(', ')} — ?` : ''
  let steps = sol.steps.map((s) => s(lang)).filter(Boolean)
  const notes = (sol.notes ?? []).map((n) => n(lang)).filter(Boolean)
  const build = () =>
    [given, find, `${h('sol', lang)}:`, ...steps.map((s, i) => `${i + 1}) ${s}`), ...notes, answerLine(sol, lang)].filter(Boolean).join('\n')
  let out = build()
  while (out.length > maxChars && steps.length > 2) {
    steps = [steps[0]!, ...steps.slice(2)]
    out = build()
  }
  return out
}

/** Шаги одной строкой для промпта: «1) …; 2) …; Ответ: …». */
export function factsLine(sol: Solution, lang: Lang): string {
  return [...sol.steps.map((s, i) => `${i + 1}) ${s(lang)}`), answerLine(sol, lang)].join('; ')
}
