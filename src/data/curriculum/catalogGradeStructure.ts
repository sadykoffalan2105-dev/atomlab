/**
 * Структура каталога по классам школы (Kimyo 7–11): сортировка «как в учебнике»,
 * ссылки на вкладку «Реакции» каталога и фильтры реакций учебника.
 */
import type { ReaderGrade, ReaderGradeId, ReaderReaction, ReaderUnit } from '../textbook/bookReader'
import { isSchoolGrade, type SchoolGrade } from './compoundGradeIndex'

export type CatalogTab = 'inorganic' | 'organic' | 'reactions'

export function gradeToReaderId(grade: SchoolGrade): ReaderGradeId {
  return `g${grade}` as ReaderGradeId
}

/** «g8» → 8; иначе null. */
export function parseGradeParam(raw: string | null | undefined): SchoolGrade | null {
  if (!raw) return null
  const m = raw.trim().match(/^g?(\d{1,2})$/)
  if (!m) return null
  const n = Number(m[1])
  return isSchoolGrade(n) ? n : null
}

/** Путь роутера к реакции на вкладке «Реакции» каталога (для src= в ссылке в лабораторию). */
export function catalogReactionHref(gradeId: ReaderGradeId, unitId: string, rxId?: string): string {
  const q = new URLSearchParams()
  q.set('view', 'reactions')
  q.set('grade', gradeId)
  q.set('unit', unitId)
  if (rxId) q.set('rx', rxId)
  return `/catalog?${q.toString()}`
}

/** Ссылка лаборатории с заменённым src= (лаборатория покажет «назад» в каталог), опционально &balance=1. */
export function labHrefWithSrc(href: string, src: string, balance = false): string {
  const i = href.indexOf('?')
  const path = i >= 0 ? href.slice(0, i) : href
  const params = new URLSearchParams(i >= 0 ? href.slice(i + 1) : '')
  params.set('src', src)
  if (balance) params.set('balance', '1')
  else params.delete('balance')
  return `${path}?${params.toString()}`
}

/** Сортировка «как в учебнике»: по первой странице (нет страницы — в конец), затем по названию. */
export function compareByTextbookOrder<T>(
  a: T,
  b: T,
  firstPage: (x: T) => number | null,
  name: (x: T) => string,
  locale: string,
): number {
  const pa = firstPage(a)
  const pb = firstPage(b)
  if (pa != null && pb != null && pa !== pb) return pa - pb
  if (pa != null && pb == null) return -1
  if (pa == null && pb != null) return 1
  return name(a).localeCompare(name(b), locale)
}

const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉'

/** «H₂SO₄» → «h2so4» для поиска по формуле. */
export function normalizeFormulaQuery(s: string): string {
  let out = ''
  for (const ch of s) {
    const i = SUB_DIGITS.indexOf(ch)
    out += i >= 0 ? String(i) : ch
  }
  return out.toLowerCase().replace(/\s+/g, '')
}

export type ReactionFilter = {
  type: string | 'all'
  /** Поиск: нормализованная строка (см. normalizeFormulaQuery); пусто — без поиска. */
  query: string
  /** Формулы (ASCII, lower) веществ, чьё название совпало с запросом. */
  queryFormulas: readonly string[]
}

export function reactionMatches(r: ReaderReaction, f: ReactionFilter): boolean {
  if (f.type !== 'all' && r.type !== f.type) return false
  if (!f.query) return true
  const hay = normalizeFormulaQuery(`${r.equationAscii} ${r.equation} ${r.asInBook ?? ''} ${r.conditions ?? ''}`)
  if (hay.includes(f.query)) return true
  const eqLower = r.equationAscii.toLowerCase().replace(/\s+/g, '')
  return f.queryFormulas.some((formula) => formula.length > 0 && eqLower.includes(formula))
}

export type FilteredUnit = { unit: ReaderUnit; reactions: ReaderReaction[] }

export function filterUnits(grade: ReaderGrade, f: ReactionFilter): FilteredUnit[] {
  const out: FilteredUnit[] = []
  for (const unit of grade.units) {
    const reactions = unit.reactions.filter((r) => reactionMatches(r, f))
    if (reactions.length > 0) out.push({ unit, reactions })
  }
  return out
}

/** Число реакций по типам (после поиска, без фильтра типа) — для счётчиков чипов. */
export function countReactionTypes(grade: ReaderGrade, f: Omit<ReactionFilter, 'type'>): Map<string, number> {
  const m = new Map<string, number>()
  const ff: ReactionFilter = { ...f, type: 'all' }
  for (const unit of grade.units) {
    for (const r of unit.reactions) {
      if (reactionMatches(r, ff)) m.set(r.type, (m.get(r.type) ?? 0) + 1)
    }
  }
  return m
}

/** Порядок чипов типов реакций (как в учебнике: сначала 4 базовых типа). */
export const REACTION_TYPE_ORDER: readonly string[] = [
  'combination',
  'decomposition',
  'substitution',
  'exchange',
  'neutralization',
  'combustion',
  'redox',
  'hydrolysis',
  'polymerization',
  // органические типы § 1.6 (10 класс); чип без реакций в выбранном классе скрыт — см. ORGANIC_REACTION_TYPES
  'addition',
  'elimination',
  'isomerization',
  'condensation',
  'polycondensation',
  'radical',
  'other',
]

/** Типы органических реакций (§ 1.6 учебника 10 класса): в фильтре каталога показываются, только если такие реакции есть. */
export const ORGANIC_REACTION_TYPES: ReadonlySet<string> = new Set([
  'addition',
  'elimination',
  'isomerization',
  'condensation',
  'polycondensation',
  'radical',
])

/** Первые юниты, пока не наберётся limit реакций (юнит не режется); юнит с индексом mustInclude входит всегда. */
export function paginateUnits(units: readonly FilteredUnit[], limit: number, mustInclude = -1): FilteredUnit[] {
  const out: FilteredUnit[] = []
  let n = 0
  for (let i = 0; i < units.length; i++) {
    if (n >= limit && i > mustInclude) break
    out.push(units[i]!)
    n += units[i]!.reactions.length
  }
  return out
}

export function countRows(units: readonly FilteredUnit[]): number {
  let n = 0
  for (const u of units) n += u.reactions.length
  return n
}

export function gradeReactionStats(grade: ReaderGrade): { total: number; labOk: number } {
  let total = 0
  let labOk = 0
  for (const u of grade.units) {
    for (const r of u.reactions) {
      total++
      if (r.lab.ok) labOk++
    }
  }
  return { total, labOk }
}
