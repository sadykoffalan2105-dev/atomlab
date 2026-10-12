/**
 * Точный § учебника для ответов инструментов (уравнять / закончить уравнение / как получить / расчёт по уравнению):
 * по карте программы (src/data/kb/curriculum/kimyo-map.json) — в каких единицах Kimyo 7–11 напечатано это уравнение
 * (тот же набор веществ слева и справа), где вещество получают, где учат этот тип задачи.
 *
 * Инструменты не знают класса ученика (runTools(text, cmp, lang, kb)), поэтому отдают подпись по умолчанию (первая
 * единица в порядке книг) и citeByGrade — первую единицу каждого класса; запасной путь (fallback.ts) берёт подпись
 * класса из самодостаточного вопроса (sq.grade). Карты нет — null, инструменты пишут прежнее «[ATOMLAB: …]».
 */
import type { Knowledge } from '../kb/shards.ts'
import type { CurriculumMap } from '../curriculum/map.ts'
import type { Unit, UnitReaction } from '../curriculum/types.ts'

const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
// «<=>» — обратимые реакции карты в ASCII («CO2 + H2 <=> CO + H2O»): раньше делились по «=» и не находились (12.10)
const ARROW_RE = /\s*(?:→|->|⟶|⇄|⇌|<=>|<->|=)\s*(?:\([^)]{0,24}\)\s*)?/

/** Формула вещества без коэффициента, ↑↓, пометок «(конц.)», «(р-р)», «(aq)» — ASCII. */
export function speciesAscii(s: string): string {
  return s
    .replace(/[₀-₉]/g, (c) => SUB[c]!)
    .replace(/[↑↓]/g, '')
    .replace(/\((?=[^()]*[a-zа-яё°.])[^()A-Z]*\)/g, '')
    .replace(/^\s*\d+\s*/, '')
    .replace(/\s+/g, '')
    .trim()
}

/** Ключ уравнения: отсортированные формулы слева «>» справа (коэффициенты и порядок не важны). null — не уравнение. */
export function eqSpeciesKey(eq: string): string | null {
  const parts = eq.split(ARROW_RE)
  if (parts.length !== 2) return null
  const side = (x: string) =>
    x
      .split(/\s\+\s|\s\+(?=\s*\d*[A-Z(])|(?<=[A-Za-z0-9₀-₉)\]↑↓])\+(?=\s*\d*[A-Z(])/)
      .map(speciesAscii)
      .filter(Boolean)
      .sort()
  const l = side(parts[0]!)
  const r = side(parts[1]!)
  if (!l.length || !r.length) return null
  return `${l.join('+')}>${r.join('+')}`
}

type Entry = { unit: Unit; reaction: UnitReaction; key: string; left: string[]; right: string[] }
const INDEX = new WeakMap<CurriculumMap, { list: Entry[]; byKey: Map<string, Entry[]> }>()

function indexOf(map: CurriculumMap) {
  let ix = INDEX.get(map)
  if (ix) return ix
  const list: Entry[] = []
  const byKey = new Map<string, Entry[]>()
  for (const unit of map.units)
    for (const reaction of unit.reactions) {
      if (reaction.isGeneral) continue
      const key = eqSpeciesKey(reaction.ascii || reaction.eq)
      if (!key) continue
      const [l, r] = key.split('>') as [string, string]
      const e: Entry = { unit, reaction, key, left: l.split('+'), right: r.split('+') }
      list.push(e)
      byKey.set(key, [...(byKey.get(key) ?? []), e])
    }
  ix = { list, byKey }
  INDEX.set(map, ix)
  return ix
}

export const curriculumOf = (kb: Knowledge): CurriculumMap | null => (kb as unknown as { curriculum?: CurriculumMap | null }).curriculum ?? null

export type UnitCites = { cite: string; citeByGrade: Record<string, string> }

/** Подписи по единицам: первая в порядке книг — по умолчанию, первая каждого класса — для класса ученика. */
function citesOf(units: Unit[], wrap: (u: Unit) => string = (u) => u.cite): UnitCites | null {
  if (!units.length) return null
  const citeByGrade: Record<string, string> = {}
  for (const u of units) citeByGrade[`g${u.grade}`] ??= wrap(u)
  return { cite: wrap(units[0]!), citeByGrade }
}

/** Единицы, где напечатано это уравнение (тот же набор веществ). */
export function unitsForEquation(kb: Knowledge, eq: string): Unit[] {
  const map = curriculumOf(kb)
  const key = eqSpeciesKey(eq)
  if (!map || !key) return []
  return [...new Set((indexOf(map).byKey.get(key) ?? []).map((e) => e.unit))]
}

export function citesForEquation(kb: Knowledge, eq: string, wrap?: (u: Unit) => string): UnitCites | null {
  return citesOf(unitsForEquation(kb, eq), wrap)
}

/** Реакции учебника с ровно этими исходными веществами (ASCII): уравнение → единицы; самые частые — первыми. */
export function textbookReactionsFrom(kb: Knowledge, reactantsAscii: string[]): { eq: string; units: Unit[] }[] {
  const map = curriculumOf(kb)
  if (!map) return []
  const want = [...new Set(reactantsAscii.map(speciesAscii))].sort().join('+')
  const groups = new Map<string, { eq: string; units: Unit[]; first: number }>()
  indexOf(map).list.forEach((e, i) => {
    if (e.left.join('+') !== want || e.reaction.isIonic) return
    const g = groups.get(e.key) ?? { eq: e.reaction.eq, units: [], first: i }
    if (!g.units.includes(e.unit)) g.units.push(e.unit)
    groups.set(e.key, g)
  })
  return [...groups.values()].sort((a, b) => b.units.length - a.units.length || a.first - b.first).map(({ eq, units }) => ({ eq, units }))
}

/**
 * «Как получить X»: единицы, где напечатано одно из уравнений ответа (с X справа); нет таких — где X вообще получают.
 */
export function citesForObtain(kb: Knowledge, targetAscii: string, eqs: string[]): UnitCites | null {
  const map = curriculumOf(kb)
  if (!map) return null
  const t = speciesAscii(targetAscii)
  const keys = new Set(eqs.map(eqSpeciesKey).filter((k): k is string => !!k))
  const ix = indexOf(map)
  const exact = ix.list.filter((e) => keys.has(e.key) && e.right.includes(t)).map((e) => e.unit)
  const any = ix.list.filter((e) => e.right.includes(t) && !e.reaction.isIonic).map((e) => e.unit)
  // по классу: сначала единица с уравнением из ответа, иначе — любая, где X получают
  const units = [...new Set([...exact, ...any])]
  const res = citesOf(units)
  if (!res) return null
  const byGrade: Record<string, string> = {}
  for (const u of [...exact, ...any]) byGrade[`g${u.grade}`] ??= u.cite
  return { cite: exact[0]?.cite ?? res.cite, citeByGrade: byGrade }
}

/** Расчёт: единицы класса, где учат этот тип задачи (tasks.types), затем — где тип введён (introducedIn). */
export function citesForTaskType(kb: Knowledge, type: string, wrap: (u: Unit) => string): UnitCites | null {
  const map = curriculumOf(kb)
  if (!map) return null
  const intro = (map.taskTypes.find((t) => t.id === type)?.introducedIn ?? []).map((id) => map.byId.get(id)).filter((u): u is Unit => !!u)
  const withType = map.units.filter((u) => u.tasks.types.includes(type as never))
  const res = citesOf([...new Set([...withType, ...intro])], wrap)
  if (!res) return null
  return { cite: intro[0] ? wrap(intro[0]) : res.cite, citeByGrade: res.citeByGrade }
}

/** Подпись инструмента для класса ученика («g8»); нет своей для класса — по умолчанию. */
export function toolCite(t: { cite?: string; citeByGrade?: Record<string, string> }, grade?: string | null): string {
  return (grade ? t.citeByGrade?.[grade] : undefined) ?? t.cite ?? '[ATOMLAB: расчёт]'
}
