/**
 * Мост «реактор лаборатории → синтез органики v2».
 *
 * Органическая реакция в реакторе (#/?reactor=1&eq=…&src=/learn/g/g10/book?…&unit=c1-s06&rx=r2) раньше была
 * только «шарами» (stageOnly 'organic'). Теперь, если для неё есть реакция v2 с атомным соответствием
 * (src/data/organicV2/reactions.json), кнопка «Проверить и запустить синтез» открывает SynthesisPlayer прямо
 * в сцене реактора.
 *
 * Таблица соответствия (в порядке доверия):
 *  1) source — id карточки учебника из ссылки «назад к учебнику» (src): g10-<unit>-<rx> = id реакции v2;
 *  2) equation — состав всех участников совпал (набор брутто-формул слева и справа, без коэффициентов;
 *     у звена полимера — состав звена);
 *  3) organicPart — совпали только органические участники (учебник и v2 по-разному пишут побочные H₂O, HCl…).
 * Среди нескольких кандидатов — сначала реакции учебника 10 кл., затем 11 кл., затем общие маршруты (gen-…).
 *
 * Модуль без React и three: его читают LaboratoryPage и scripts/test-organic-v2-reactor.mts.
 */
import { formulaCompositionKey, parseEquationText, type FormulaCounts } from '../chemistry/equationFormula'
import type { OV2Reaction, OV2Species } from '../data/organicV2/types'

export type OrganicV2MatchHow = 'source' | 'equation' | 'organicPart'

export interface OrganicV2Match {
  readonly reaction: OV2Reaction
  readonly how: OrganicV2MatchHow
}

export interface OrganicV2Query {
  /** id реакции v2 из ссылки учебника (organicV2IdFromBackHref) */
  readonly sourceId?: string | null
  /** уравнение реактора (Unicode или ASCII) */
  readonly equation: string
}

export interface OrganicV2Index {
  readonly byId: ReadonlyMap<string, OV2Reaction>
  readonly byFull: ReadonlyMap<string, readonly OV2Reaction[]>
  readonly byOrganic: ReadonlyMap<string, readonly OV2Reaction[]>
}

/** «/learn/g/g10/book?page=26&unit=c1-s06&rx=r2» → «g10-c1-s06-r2» (тот же id, что у реакции v2). */
export function organicV2IdFromBackHref(backHref: string | null | undefined): string | null {
  if (!backHref) return null
  try {
    const u = new URL(backHref, 'http://x')
    const grade = /\/learn\/g\/(g1[01])\//.exec(u.pathname)?.[1]
    const unit = u.searchParams.get('unit')
    const rx = u.searchParams.get('rx')
    return grade && unit && rx ? `${grade}-${unit}-${rx}` : null
  } catch {
    return null
  }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** Состав, делённый на НОД (звено полимера: фрагмент из трёх звеньев v2 = одно звено учебника). */
function reduced(counts: Readonly<FormulaCounts>): FormulaCounts {
  const vals = Object.values(counts).filter((n) => n > 0)
  const g = vals.reduce((acc, n) => gcd(acc, n), 0) || 1
  const out: FormulaCounts = {}
  for (const [k, n] of Object.entries(counts)) if (n > 0) out[k] = n / g
  return out
}

function speciesCounts(s: OV2Species): FormulaCounts {
  const c: FormulaCounts = {}
  for (const a of s.atoms) c[a.el] = (c[a.el] ?? 0) + 1
  return s.ref.startsWith('polymer:') ? reduced(c) : c
}

/** Органический участник: есть углерод, но не CO, CO₂, карбонаты/гидрокарбонаты и не карбиды (CaC₂). */
function isOrganicCounts(c: Readonly<FormulaCounts>): boolean {
  const C = c.C ?? 0
  if (C === 0) return false
  const H = c.H ?? 0
  const O = c.O ?? 0
  if (C === 1 && (O === 3 || ((O === 1 || O === 2) && H === 0))) return false
  const nonMetal = ['H', 'O', 'N', 'S', 'P', 'F', 'Cl', 'Br', 'I']
  return Object.keys(c).some((el) => nonMetal.includes(el))
}

function sideKey(list: readonly FormulaCounts[], organicOnly: boolean): string {
  const keys = new Set<string>()
  for (const c of list) if (!organicOnly || isOrganicCounts(c)) keys.add(formulaCompositionKey(c))
  return [...keys].sort().join(' + ')
}

function keysOf(left: readonly FormulaCounts[], right: readonly FormulaCounts[]) {
  return {
    full: `${sideKey(left, false)} > ${sideKey(right, false)}`,
    organic: `${sideKey(left, true)} > ${sideKey(right, true)}`,
  }
}

export function ov2ReactionKeys(r: OV2Reaction): { full: string; organic: string } {
  const L = r.species.filter((s) => s.side === 'L').map(speciesCounts)
  const R = r.species.filter((s) => s.side === 'R').map(speciesCounts)
  return keysOf(L, R)
}

/** Ключи уравнения реактора; null — уравнение не разобрано или есть неизвестный состав. */
export function equationKeys(equation: string): { full: string; organic: string } | null {
  // радикал (Cl•, CH₃•) сравниваем по составу частицы
  const p = parseEquationText(equation.replace(/•/g, ''))
  if (!p) return null
  const all = [...p.reactants, ...p.products]
  if (all.some((s) => s.counts == null || s.electron)) return null
  const norm = (s: (typeof all)[number]) => (s.polymer ? reduced(s.counts!) : s.counts!)
  return keysOf(p.reactants.map(norm), p.products.map(norm))
}

/** Порядок кандидатов: учебник 10 кл. (по странице), учебник 11 кл., затем общие маршруты. */
function rank(r: OV2Reaction): number {
  const book = r.source.bookId ? 0 : 2
  const grade = r.source.grade === 10 ? 0 : 1
  return book * 10_000 + grade * 1_000 + (r.source.page ?? 999)
}

export function buildOrganicV2Index(reactions: readonly OV2Reaction[]): OrganicV2Index {
  const byId = new Map<string, OV2Reaction>()
  const byFull = new Map<string, OV2Reaction[]>()
  const byOrganic = new Map<string, OV2Reaction[]>()
  const push = (m: Map<string, OV2Reaction[]>, k: string, r: OV2Reaction) => {
    const a = m.get(k)
    if (a) a.push(r)
    else m.set(k, [r])
  }
  for (const r of reactions) {
    byId.set(r.id, r)
    const k = ov2ReactionKeys(r)
    push(byFull, k.full, r)
    if (!k.organic.startsWith(' >') && !k.organic.endsWith('> ')) push(byOrganic, k.organic, r)
  }
  for (const m of [byFull, byOrganic]) for (const a of m.values()) a.sort((x, y) => rank(x) - rank(y))
  return { byId, byFull, byOrganic }
}

/** Реакция v2 для уравнения реактора (или null — тогда реакция остаётся «шарами»). */
export function matchOrganicV2Reaction(index: OrganicV2Index, q: OrganicV2Query): OrganicV2Match | null {
  const bySource = q.sourceId ? index.byId.get(q.sourceId) : undefined
  const k = equationKeys(q.equation)
  if (bySource) {
    // Общая схема учебника (R-…): пример v2 может отличаться от примера реактора (триацетин ≠ тристеарин).
    // Тогда берём реакцию v2 ровно с веществами реактора, если она есть, — шарики и 3D покажут одно и то же.
    const vk = ov2ReactionKeys(bySource)
    const agrees = k != null && (vk.full === k.full || vk.organic === k.organic)
    if (agrees || !bySource.generic || !k) return { reaction: bySource, how: 'source' }
    const exact = index.byFull.get(k.full)?.[0]
    return exact ? { reaction: exact, how: 'equation' } : { reaction: bySource, how: 'source' }
  }
  if (!k) return null
  const full = index.byFull.get(k.full)?.[0]
  if (full) return { reaction: full, how: 'equation' }
  const org = index.byOrganic.get(k.organic)?.[0]
  if (org) return { reaction: org, how: 'organicPart' }
  return null
}

let indexPromise: Promise<OrganicV2Index> | null = null

/** Индекс по всем реакциям v2 (файл реакций грузится отдельным чанком один раз за сессию). */
export function loadOrganicV2Index(): Promise<OrganicV2Index> {
  indexPromise ??= import('../data/organicV2/reactions')
    .then((m) => m.loadOrganicV2Reactions())
    .then((file) => buildOrganicV2Index(file.reactions))
    .catch((e: unknown) => {
      indexPromise = null
      throw e
    })
  return indexPromise
}

export async function findOrganicV2ForReactor(q: OrganicV2Query): Promise<OrganicV2Match | null> {
  return matchOrganicV2Reaction(await loadOrganicV2Index(), q)
}
