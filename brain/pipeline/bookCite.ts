/**
 * Подпись «§ учебника» для точных инструментов: уравнение, способ получения, расчётная задача → единица карты
 * программы Kimyo 7–11 (brain/curriculum/map.ts), где это напечатано, — сначала книга класса ученика (gradeId),
 * затем остальные книги. Карты нет — null (инструменты оставляют свою подпись «[ATOMLAB: …]»).
 *
 *   reactionUnits(map, left, right?, grade)  — единицы с реакцией этих веществ (порядок: класс ученика, затем по книге)
 *   eqUnits(map, eqs, grade)                 — единицы, где напечатано одно из уравнений (сравнение eqKey)
 *   taskTypeUnit(map, type, grade)           — § класса, где решают задачи этого типа (иначе первое введение)
 */
import type { CurriculumMap } from '../curriculum/map.ts'
import type { Unit, UnitReaction } from '../curriculum/types.ts'
import { eqKey } from './obtain.ts'

type RxRow = { unit: Unit; reaction: UnitReaction; left: string[]; right: string[]; order: number }
const INDEX = new WeakMap<CurriculumMap, { rows: RxRow[]; byKey: Map<string, RxRow[]> }>()

/** «2 H2 + O2 -> 2 H2O» → ['H2', 'O2'] без коэффициентов, зарядов-ионов и ↑↓ */
function speciesOf(side: string): string[] {
  return side
    .split(/\s\+\s/)
    .map((s) => s.trim().replace(/^\d+\s*/, '').replace(/[↑↓]/g, '').trim())
    .filter(Boolean)
}

function index(map: CurriculumMap) {
  let ix = INDEX.get(map)
  if (ix) return ix
  const rows: RxRow[] = []
  const byKey = new Map<string, RxRow[]>()
  map.units.forEach((unit, order) => {
    for (const reaction of unit.reactions) {
      if (reaction.isGeneral) continue
      // «<=>» — обратимые реакции карты («CO2 + H2 <=> CO + H2O»; раньше делились по «=» — § не находился, 12.10)
      const [l, r] = reaction.ascii.split(/\s*(?:<=>|->|=|⇄|<->)\s*/)
      if (!l || !r) continue
      const row = { unit, reaction, left: speciesOf(l), right: speciesOf(r), order }
      rows.push(row)
      const k = eqKey(reaction.eq)
      byKey.set(k, [...(byKey.get(k) ?? []), row])
    }
  })
  ix = { rows, byKey }
  INDEX.set(map, ix)
  return ix
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')
/** класс ученика первым, затем ближайшие классы, внутри — порядок книги */
const byGrade = (grade: number | null) => (a: RxRow, b: RxRow) => {
  const da = grade == null ? 0 : a.unit.grade === grade ? 0 : 1 + Math.abs(a.unit.grade - grade)
  const db = grade == null ? 0 : b.unit.grade === grade ? 0 : 1 + Math.abs(b.unit.grade - grade)
  return da - db || a.order - b.order
}

export function gradeOf(gradeId?: string | null): number | null {
  const m = /^g?(7|8|9|10|11)$/.exec(gradeId ?? '')
  return m ? Number(m[1]) : null
}

/** Реакции учебника с ровно этими исходными веществами (и этими продуктами, если заданы); ASCII-формулы. */
export function reactionUnits(map: CurriculumMap, left: string[], right: string[] | null, grade: number | null): RxRow[] {
  return index(map)
    .rows.filter((x) => !x.reaction.isIonic && sameSet(x.left, left) && (!right || sameSet(x.right, right)))
    .sort(byGrade(grade))
}

/** Единицы, где напечатано одно из уравнений (без условий/пробелов/↑↓). */
export function eqUnits(map: CurriculumMap, eqs: string[], grade: number | null): RxRow[] {
  const ix = index(map)
  const out: RxRow[] = []
  for (const e of eqs) for (const row of ix.byKey.get(eqKey(e)) ?? []) if (!out.includes(row)) out.push(row)
  return out.sort(byGrade(grade))
}

/** § класса ученика, где решают задачи этого типа; нет такого — где тип введён (по оглавлению). */
export function taskTypeUnit(map: CurriculumMap, type: string, grade: number | null): Unit | null {
  const tt = map.taskTypes.find((t) => t.id === type)
  const intro = (tt?.introducedIn ?? []).map((id) => map.byId.get(id)).filter((u): u is Unit => !!u)
  if (grade != null) {
    const inGrade = intro.find((u) => u.grade === grade) ?? (map.byGrade.get(grade) ?? []).find((u) => u.tasks.types.includes(type as never))
    if (inGrade) return inGrade
  }
  return intro[0] ?? null
}

/** Подпись цитаты единицы: «[Kimyo 8, §35, стр. 120]» (страница — если известна). */
export function unitCite(unit: Unit, page?: number | null): string {
  return page ? `${unit.cite.slice(0, -1)}, стр. ${page}]` : unit.cite
}
