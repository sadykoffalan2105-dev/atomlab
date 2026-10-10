/**
 * «Как образуется» v2 в лаборатории: какие реакции реактора и какие запуски синтеза показывают образование вещества
 * из 200 основных (каталог). Лёгкий модуль без three — его читают панель реактора, страница и сцена лаборатории.
 */
import { CATALOG_TOP200 } from '../../../../data/catalog/catalogTop200'
import { compoundById } from '../../../../data/compounds'
import { equationSides, formationEquation } from '../../../../chemistry/formationEquation'

/** Вещество реакции, образование которого можно показать: сначала главный продукт, затем остальные продукты. */
export function formationLabProductFor(productId: string | null | undefined, coProductIds: readonly (string | null | undefined)[] = []): string | null {
  for (const id of [productId, ...coProductIds]) if (id && CATALOG_TOP200.has(id) && compoundById[id]) return id
  return null
}

/** Формула участника запуска: вещество каталога — его формула, элемент — символ (двухатомный — с ₂). */
export function labTermFormula(compoundId: string | null | undefined, symbol: string, diatomic: boolean): string {
  const c = compoundId ? compoundById[compoundId] : undefined
  return c ? c.formulaUnicode : `${symbol}${diatomic ? '₂' : ''}`
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')

/**
 * Реагенты уравнения, которое показывает история «Как образуется» (из простых веществ, иначе лабораторный способ) —
 * формулы без коэффициентов. Лабораторный способ при наличии прямого не считается: показ играет именно прямой путь.
 */
export function formationReagentSets(compoundId: string): string[][] {
  const eq = formationEquation(compoundId)
  const e = eq ? (eq.direct ?? eq.lab) : null
  const s = e ? equationSides(e) : null
  return s ? [[...new Set(s.left.map(([, f]) => f))]] : []
}

/**
 * Запуск синтеза = уравнение образования вещества (тот же набор реагентов, продукт — вещество из 200)?
 * Тогда вместо общей анимации играет показ v2 этого вещества. Возвращает id вещества или null.
 */
export function formationForLabRun(leftFormulas: readonly string[], productId: string | null | undefined): string | null {
  if (!productId || !leftFormulas.length || !CATALOG_TOP200.has(productId)) return null
  const left = [...new Set(leftFormulas)]
  return formationReagentSets(productId).some((set) => sameSet(set, left)) ? productId : null
}
