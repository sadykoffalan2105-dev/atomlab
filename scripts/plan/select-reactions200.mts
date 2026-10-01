/**
 * 200 основных реакций школьной неорганики (docs/plans/reactions-top200.md, п. 1).
 *
 * Источник — выверенные уравнения учебников 7–11 (src/data/textbook/equations-gN.json) и банк школьных реакций
 * (SCHOOL_REACTION_BANK). Кандидат проходит, если:
 *  • открывается в реакторе с запуском синтеза (resolveReactorEquation ok, stageOnly null);
 *  • все вещества — из 200 веществ каталога (catalogTop200) или простые вещества;
 *  • у уравнения единственный минимальный целочисленный набор коэффициентов (ядро матрицы состава одномерно),
 *    и он совпадает с коэффициентами учебника/банка.
 * Дубли (тот же набор веществ слева и справа) сливаются. Рейтинг: сколько раз реакция встречается в учебниках
 * (параграфы, классы), есть ли она в банке, насколько употребительны её вещества (порядок catalogTop200).
 * Тип — по строению уравнения (соединение / разложение / замещение / обмен / нейтрализация / горение / ОВР);
 * у каждого типа есть минимум мест, остальное — по рейтингу.
 *
 * Run: npx tsx scripts/plan/select-reactions200.mts [--write] [--list]
 */
import fs from 'node:fs'
import { formulaToUnicode, parseEquationText, type EquationSpecies } from '../../src/chemistry/equationFormula.ts'
import { SCHOOL_REACTION_BANK } from '../../src/chemistry/schoolReactionBank.ts'
import { CATALOG_TOP200_IDS } from '../../src/data/catalog/catalogTop200.ts'
import { compoundById } from '../../src/data/compounds.ts'
import { getElementByZ } from '../../src/data/elements.ts'
import { resolveReactorEquation, type ReactorLinkOk } from '../../src/lab/reactorDeepLink.ts'
import { minimalIntegerCoefficients } from '../../src/chemistry/equationNullspace.ts'
import { ATOMIC_DATA, isElementSymbol as isCoreElementSymbol } from '../../src/chemistry/data/index.ts'
import { formationPlan } from '../../src/chemistry/formationPlan.ts'
import { BOOK_GRADES, readBook } from './bookSpecies.mts'

const WRITE = process.argv.includes('--write')
const LIST = process.argv.includes('--list')

const RANK = new Map(CATALOG_TOP200_IDS.map((id, i) => [id, i]))

type RxType = 'combination' | 'decomposition' | 'substitution' | 'exchange' | 'neutralization' | 'combustion' | 'redox'

type Occurrence = { grade: number; unitId: string; rxId: string; page: number | null; type: string }

type Candidate = {
  key: string
  equation: string
  /** текст для resolveReactorEquation (Unicode, целые коэффициенты) */
  res: ReactorLinkOk
  parsed: { reactants: EquationSpecies[]; products: EquationSpecies[] }
  coeffs: number[]
  bankIds: string[]
  bankTitle: string | null
  bankClass: string | null
  occ: Occurrence[]
  compounds: string[]
  simple: string[]
}

const isSimpleCompound = (id: string) => {
  const c = compoundById[id]
  return Boolean(c && Object.keys(c.composition).length === 1)
}

/** Вещества реакции: id каталога и простые вещества «Na», «Cl₂». */
function speciesOf(res: ReactorLinkOk): { compounds: string[]; simple: string[] } {
  const compounds: string[] = []
  const simple: string[] = []
  const addEl = (z: number, diatomic?: boolean) => {
    const sym = getElementByZ(z)?.symbol ?? `z${z}`
    simple.push(diatomic ? `${sym}₂` : sym)
  }
  for (const t of res.leftTerms) {
    if (t.compoundId) compounds.push(t.compoundId)
    else addEl(t.z, t.diatomic)
  }
  for (const cp of res.coProducts) {
    if (cp.compoundId != null) compounds.push(cp.compoundId)
    else if (cp.z != null) addEl(cp.z, cp.diatomic)
  }
  compounds.push(res.productCompoundId)
  return { compounds, simple }
}

function speciesKeyOf(parsed: { reactants: EquationSpecies[]; products: EquationSpecies[] }): string {
  const k = (s: EquationSpecies) =>
    Object.entries(s.counts ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([e, n]) => `${e}${n}`)
      .join('')
  return `${parsed.reactants.map(k).sort().join('+')}>${parsed.products.map(k).sort().join('+')}`
}

const candidates = new Map<string, Candidate>()
const rejected: Record<string, number> = {}
const reject = (why: string) => (rejected[why] = (rejected[why] ?? 0) + 1)

function consider(
  equation: string,
  from: { bankId?: string; occ?: Occurrence },
): void {
  const res = resolveReactorEquation({ equation, reactionId: from.bankId ?? null })
  if (!res.ok) return reject(`reactor:${res.code}`)
  if (res.stageOnly) return reject(`stageOnly:${res.stageOnly}`)
  const parsed = parseEquationText(res.equationUnicode)
  if (!parsed || parsed.isScheme || parsed.isIonic) return reject('parse')
  const { compounds, simple } = speciesOf(res)
  if (compounds.some((id) => !RANK.has(id) && !isSimpleCompound(id))) return reject('notTop200')
  const coeffs = [...parsed.reactants, ...parsed.products].map((s) => s.coeff)
  const minimal = minimalIntegerCoefficients([...parsed.reactants, ...parsed.products].map((s) => s.counts ?? {}), parsed.reactants.length)
  if (!minimal) return reject('nullspace')
  if (minimal.some((v, i) => v !== coeffs[i])) return reject('notMinimal')
  const key = speciesKeyOf(parsed)
  let c = candidates.get(key)
  if (!c) {
    c = {
      key,
      equation: res.equationUnicode,
      res,
      parsed,
      coeffs,
      bankIds: [],
      bankTitle: null,
      bankClass: null,
      occ: [],
      compounds,
      simple,
    }
    candidates.set(key, c)
  }
  if (from.bankId && !c.bankIds.includes(from.bankId)) {
    c.bankIds.push(from.bankId)
    const b = SCHOOL_REACTION_BANK.find((r) => r.id === from.bankId)
    if (b && !c.bankTitle) {
      c.bankTitle = b.titleRu
      c.bankClass = b.reactionClass
    }
  }
  if (from.occ) c.occ.push(from.occ)
}

for (const r of SCHOOL_REACTION_BANK) consider(r.equationRu, { bankId: r.id })
for (const g of BOOK_GRADES) {
  for (const u of readBook(g)) {
    for (const r of u.reactions) {
      if (r.isIonic || r.isGeneralScheme) continue
      const type = (r as unknown as { type?: string }).type ?? 'other'
      consider(r.equation, { occ: { grade: g, unitId: u.unitId, rxId: r.id, page: r.page, type } })
    }
  }
}

// ── степени окисления (для ОВР): ионные вещества — по ионам «Как образуется», молекулы — по правилам школы ──
const EN = (el: string) => (isCoreElementSymbol(el) ? (ATOMIC_DATA[el].electronegativity ?? 1) : 1)
const TYPICAL_NEG: Record<string, number> = { F: -1, Cl: -1, Br: -1, I: -1, O: -2, S: -2, Se: -2, N: -3, P: -3, C: -4, Si: -4, H: -1 }
const FIXED_POS: Record<string, number> = { Li: 1, Na: 1, K: 1, Rb: 1, Cs: 1, Ag: 1, Be: 2, Mg: 2, Ca: 2, Sr: 2, Ba: 2, Zn: 2, Al: 3 }

/** Степени окисления частицы с зарядом q (молекула, многоатомный ион): элемент → множество степеней. */
function solveParticle(comp: Record<string, number>, q: number): Map<string, Set<number>> | null {
  const els = Object.keys(comp)
  const out = new Map<string, Set<number>>()
  if (els.length === 1) {
    out.set(els[0]!, new Set([q / comp[els[0]!]!]))
    return out
  }
  const ox: Record<string, number> = {}
  const metalOnlyHydride = els.includes('H') && els.every((e) => e === 'H' || FIXED_POS[e] != null)
  for (const e of els) {
    if (e === 'F') ox[e] = -1
    else if (FIXED_POS[e] != null) ox[e] = FIXED_POS[e]!
    else if (e === 'H') ox[e] = metalOnlyHydride ? -1 : 1
  }
  if (els.includes('O') && !('O' in ox)) ox.O = -2
  const sumKnown = () => els.reduce((s, e) => s + (e in ox ? ox[e]! * comp[e]! : 0), 0)
  let unknown = els.filter((e) => !(e in ox))
  if (unknown.length === 0 && sumKnown() !== q && els.includes('O')) {
    // пероксиды и надпероксиды: кислород не −2
    delete ox.O
    unknown = ['O']
  }
  if (unknown.length === 2) {
    const [a, b] = unknown.sort((x, y) => EN(y) - EN(x))
    if (TYPICAL_NEG[a!] != null) ox[a!] = TYPICAL_NEG[a!]!
    unknown = [b!]
  }
  if (unknown.length === 1) {
    const e = unknown[0]!
    ox[e] = (q - sumKnown()) / comp[e]!
  }
  if (els.some((e) => !(e in ox))) return null
  for (const e of els) out.set(e, new Set([Math.round(ox[e]! * 1000) / 1000]))
  return out
}

function oxidationStatesOf(id: string | null, counts: Record<string, number>): Map<string, Set<number>> | null {
  if (Object.keys(counts).length === 1) return new Map([[Object.keys(counts)[0]!, new Set([0])]])
  const plan = id ? formationPlan(id) : null
  if (plan && plan.mode === 'ionic') {
    const out = new Map<string, Set<number>>()
    for (const sp of plan.species) {
      const part = solveParticle(sp.comp, sp.charge)
      if (!part) return null
      for (const [e, set] of part) {
        const cur = out.get(e) ?? new Set<number>()
        for (const v of set) cur.add(v)
        out.set(e, cur)
      }
    }
    return out
  }
  return solveParticle(counts, 0)
}

function isRedoxEquation(c: Candidate): boolean | null {
  const side = (list: EquationSpecies[]) => {
    const m = new Map<string, Set<number>>()
    for (const s of list) {
      const st = oxidationStatesOf(compoundOfSpecies(s), s.counts ?? {})
      if (!st) return null
      for (const [e, set] of st) {
        const cur = m.get(e) ?? new Set<number>()
        for (const v of set) cur.add(v)
        m.set(e, cur)
      }
    }
    return m
  }
  const l = side(c.parsed.reactants)
  const r = side(c.parsed.products)
  if (!l || !r) return null
  for (const [e, set] of l) {
    const other = r.get(e)
    if (!other || other.size !== set.size || [...set].some((v) => !other.has(v))) return true
  }
  return false
}

// ── тип реакции по строению ──
const OXIDE = (id: string) => compoundById[id]?.category === 'oxide'
const compoundByKey = new Map<string, string>()
for (const c of Object.values(compoundById)) {
  const k = Object.entries(c.composition as Record<string, number>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([e, n]) => `${e}${n}`)
    .join('')
  if (!compoundByKey.has(k)) compoundByKey.set(k, c.id)
}
function compoundOfSpecies(s: EquationSpecies): string | null {
  const counts = s.counts ?? {}
  if (Object.keys(counts).length === 1) return null
  const k = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([e, n]) => `${e}${n}`)
    .join('')
  return compoundByKey.get(k) ?? null
}
const isSimpleSpecies = (s: EquationSpecies) => Object.keys(s.counts ?? {}).length === 1

/**
 * Школьные уравнения, без которых список «основных» неполон (ОГЭ / Kimyo 8–9: получение газов в лаборатории,
 * свойства амфотерных веществ, кислотных оксидов, металлов с кислотами-окислителями, промышленные процессы).
 * Только поднимают рейтинг — проверки (реактор, 200 веществ, единственность коэффициентов) те же.
 */
const MUST = new Set([
  '4NO₂ + 2H₂O + O₂ → 4HNO₃',
  'N₂O₅ + H₂O → 2HNO₃',
  '4Fe(OH)₂ + 2H₂O + O₂ → 4Fe(OH)₃',
  'NH₃ + HNO₃ → NH₄NO₃',
  'Zn(OH)₂ + 2NaOH → Na₂[Zn(OH)₄]',
  'SiO₂ + CaO → CaSiO₃',
  '2FeCl₃ + Fe → 3FeCl₂',
  'Mg + Cl₂ → MgCl₂',
  '4HNO₃ → 4NO₂ + O₂ + 2H₂O',
  '2AgNO₃ → 2Ag + 2NO₂ + O₂',
  'H₂SiO₃ → SiO₂ + H₂O',
  'Zn(OH)₂ → ZnO + H₂O',
  '2NaNO₃ → 2NaNO₂ + O₂',
  '(NH₄)₂Cr₂O₇ → Cr₂O₃ + N₂ + 4H₂O',
  '(NH₄)₂CO₃ → 2NH₃ + H₂O + CO₂',
  'Mg + 2HCl → MgCl₂ + H₂',
  'Mg + H₂SO₄ → MgSO₄ + H₂',
  'Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag',
  '2Al + 3CuSO₄ → Al₂(SO₄)₃ + 3Cu',
  '2NaBr + Cl₂ → 2NaCl + Br₂',
  'SiO₂ + 2Mg → 2MgO + Si',
  '2Mg + CO₂ → 2MgO + C',
  'Cr₂O₃ + 2Al → Al₂O₃ + 2Cr',
  'CuO + C → Cu + CO',
  'Mg + 2H₂O → Mg(OH)₂ + H₂',
  'Ba + 2H₂O → Ba(OH)₂ + H₂',
  '2NaOH + CO₂ → Na₂CO₃ + H₂O',
  '2KOH + CO₂ → K₂CO₃ + H₂O',
  '2NaOH + SO₂ → H₂O + Na₂SO₃',
  'SiO₂ + 2NaOH → H₂O + Na₂SiO₃',
  'Al₂O₃ + 2NaOH → 2NaAlO₂ + H₂O',
  'ZnO + 2HCl → ZnCl₂ + H₂O',
  'Na₂SO₃ + H₂SO₄ → Na₂SO₄ + H₂O + SO₂',
  'FeS + 2HCl → FeCl₂ + H₂S',
  'Na₂S + 2HCl → 2NaCl + H₂S',
  'Al₂(SO₄)₃ + 6NaOH → 2Al(OH)₃ + 3Na₂SO₄',
  'N₂O₅ + 2NaOH → 2NaNO₃ + H₂O',
  '2NaNO₃ + H₂SO₄ → Na₂SO₄ + 2HNO₃',
  'CuCl₂ + H₂S → CuS + 2HCl',
  '3CaO + 2H₃PO₄ → Ca₃(PO₄)₂ + 3H₂O',
  '4Li + O₂ → 2Li₂O',
  '2Ca + O₂ → 2CaO',
  '2Zn + O₂ → 2ZnO',
  '2ZnS + 3O₂ → 2ZnO + 2SO₂',
  'Si + O₂ → SiO₂',
  'SiH₄ + 2O₂ → SiO₂ + 2H₂O',
  '2H₂S + O₂ → 2S + 2H₂O',
  '4NH₃ + 5O₂ → 4NO + 6H₂O',
  'Zn + 2H₂O + 2NaOH → Na₂[Zn(OH)₄] + H₂',
  '3Cl₂ + 6KOH → KClO₃ + 5KCl + 3H₂O',
  'Cl₂ + 2KOH → KClO + KCl + H₂O',
  '2NaCl + 2H₂O → 2NaOH + Cl₂ + H₂',
  'CuO + CO → Cu + CO₂',
  'P + 5HNO₃ → H₃PO₄ + 5NO₂ + H₂O',
  'Zn + 2H₂SO₄ → ZnSO₄ + SO₂ + 2H₂O',
  'Ag + 2HNO₃ → AgNO₃ + NO₂ + H₂O',
  '2Fe + 6H₂SO₄ → Fe₂(SO₄)₃ + 3SO₂ + 6H₂O',
  '2Na₂O₂ + 2CO₂ → 2Na₂CO₃ + O₂',
  '2Na₂O₂ + 2H₂O → 4NaOH + O₂',
  'CaH₂ + 2H₂O → Ca(OH)₂ + 2H₂',
  '3CuO + 2NH₃ → 3Cu + 3H₂O + N₂',
  '6P + 5KClO₃ → 5KCl + 3P₂O₅',
  'Si + 2NaOH + H₂O → Na₂SiO₃ + 2H₂',
  '4Zn + 10HNO₃ → 4Zn(NO₃)₂ + NH₄NO₃ + 3H₂O',
  '3Zn + 8HNO₃ → 3Zn(NO₃)₂ + 2NO + 4H₂O',
  'Ca₃(PO₄)₂ + 5C + 3SiO₂ → 3CaSiO₃ + 2P + 5CO',
  '2Al + 6H₂O → 2Al(OH)₃ + 3H₂',
])

/** Не «основные»: аллотропия (одно простое вещество → другое), упрощённые записи гидролиза, редкие частные случаи. */
const DROP = new Set([
  '3O₂ → 2O₃',
  'CaO + H₂CO₃ → CaCO₃ + H₂O',
  'FeCl₃ + 3H₂O ⇄ Fe(OH)₃ + 3HCl',
  '4CuO → 2Cu₂O + O₂',
  'CaCO₃ + H₃PO₄ → CaHPO₄ + H₂O + CO₂',
  '2H₂O + 2F₂ → 4HF + O₂',
  'CaO + 3C → CaC₂ + CO',
])

/** Тип по смыслу, а не по строению: медь не горит (окисление при нагревании), аммиак на Pt и процесс Дикона — каталитическое окисление. */
const TYPE_OVERRIDE: Record<string, RxType> = {
  '2Cu + O₂ → 2CuO': 'combination',
  '4NH₃ + 5O₂ → 4NO + 6H₂O': 'redox',
  '4HCl + O₂ → 2H₂O + 2Cl₂': 'redox',
}

function classify(c: Candidate, redox: boolean | null): RxType {
  const over = TYPE_OVERRIDE[c.equation]
  if (over) return over
  const { reactants, products } = c.parsed
  const hasO2 = reactants.some((s) => s.formula === 'O2')
  const anySimple = [...reactants, ...products].some(isSimpleSpecies)
  const bookTypes = c.occ.map((o) => o.type)
  const saysCombustion = bookTypes.filter((t) => t === 'combustion').length * 2 >= Math.max(1, bookTypes.length) || c.bankClass === 'combustion'
  if (reactants.length === 1) return 'decomposition'
  if (products.length === 1) return hasO2 && saysCombustion ? 'combustion' : 'combination'
  // горение: кислород + вещество → оксиды (и вода, и простое вещество — N₂ у аммиака, S при недостатке O₂)
  if (hasO2 && products.every((s) => s.formula === 'H2O' || (compoundOfSpecies(s) && OXIDE(compoundOfSpecies(s)!)) || isSimpleSpecies(s))) {
    return 'combustion'
  }
  if (reactants.length === 2 && products.length === 2) {
    const simpleL = reactants.filter(isSimpleSpecies).length
    const simpleR = products.filter(isSimpleSpecies).length
    if (simpleL === 1 && simpleR === 1) return 'substitution'
    if (!anySimple && !redox) {
      const cat = (s: EquationSpecies) => {
        const id = compoundOfSpecies(s)
        return id ? compoundById[id]?.category : undefined
      }
      const acid = reactants.some((s) => cat(s) === 'acid')
      const base = reactants.some((s) => cat(s) === 'base')
      const water = products.some((s) => s.formula === 'H2O')
      const salt = products.some((s) => cat(s) === 'salt')
      if (acid && base && water && salt) return 'neutralization'
      return 'exchange'
    }
  }
  return anySimple || redox ? 'redox' : 'exchange'
}

/** Качественная реакция: осадок/газ — признак иона (Kimyo 8–9, таблица качественных реакций). */
function qualitativeOf(c: Candidate, type: RxType): string | null {
  if (type !== 'exchange' && type !== 'neutralization') return null
  const leftIds = c.compounds.slice(0, c.res.leftTerms.filter((t) => t.compoundId).length)
  const prodIds = c.compounds.slice(leftIds.length)
  const p = (id: string) => prodIds.includes(id)
  const leftCat = (cat: string) => leftIds.some((id) => compoundById[id]?.category === cat)
  if (p('salt_ag_cl')) return 'Cl⁻'
  if (p('salt_ba_so4')) return 'SO₄²⁻'
  if (p('salt_ag_br')) return 'Br⁻'
  if (p('salt_ag_i')) return 'I⁻'
  if (p('tb_ag3po4')) return 'PO₄³⁻'
  // карбонат + кислота → CO₂ (без сплавления с SiO₂ и совместного гидролиза)
  if (p('co2') && leftCat('acid') && leftIds.some((id) => /co3/.test(id) || id === 'salt_nahco3')) return 'CO₃²⁻'
  if (p('nh3') && leftCat('base') && leftIds.some((id) => /nh4/.test(id))) return 'NH₄⁺'
  if (leftCat('base') && p('fe_oh_3')) return 'Fe³⁺'
  if (leftCat('base') && p('fe_oh_2')) return 'Fe²⁺'
  if (leftCat('base') && p('cu_oh_2')) return 'Cu²⁺'
  return null
}

type Scored = Candidate & { type: RxType; redox: boolean; score: number; qualitative: string | null; grades: number[] }

const unknownRedox: string[] = []
const scored: Scored[] = [...candidates.values()]
  .filter((c) => !DROP.has(c.equation))
  .map((c) => {
    const redoxRaw = isRedoxEquation(c)
    if (redoxRaw == null) unknownRedox.push(c.equation)
    const anySimple = [...c.parsed.reactants, ...c.parsed.products].some(isSimpleSpecies)
    const redox = redoxRaw ?? anySimple
    const type = classify(c, redox)
    const units = new Set(c.occ.map((o) => `${o.grade}:${o.unitId}`))
    const grades = [...new Set(c.occ.map((o) => o.grade))]
    for (const id of c.bankIds) {
      const b = SCHOOL_REACTION_BANK.find((r) => r.id === id)
      for (const g of b?.grades ?? []) if (!grades.includes(g)) grades.push(g)
    }
    grades.sort((a, b) => a - b)
    const subst = c.compounds.reduce((s, id) => s + (RANK.has(id) ? (200 - RANK.get(id)!) / 200 : 0.6), 0) / Math.max(1, c.compounds.length)
    const score =
      Math.min(units.size, 6) * 3 +
      grades.length * 1.5 +
      (c.bankIds.length > 0 ? 5 : 0) +
      subst * 6 +
      (grades.some((g) => g <= 9) ? 2 : 0) +
      (MUST.has(c.equation) ? 25 : 0)
    return { ...c, type, redox, score, qualitative: qualitativeOf(c, type), grades }
  })
scored.sort((a, b) => b.score - a.score || a.equation.localeCompare(b.equation))
if (unknownRedox.length) console.log('степени окисления не определены:', unknownRedox)
const missingMust = [...MUST].filter((e) => !scored.some((c) => c.equation === e))
if (missingMust.length) throw new Error(`обязательные реакции не прошли проверки: ${missingMust.join(' | ')}`)

// ── квоты по типам ──
const QUOTA: Record<RxType, number> = {
  combination: 34,
  decomposition: 24,
  substitution: 32,
  exchange: 44,
  neutralization: 18,
  combustion: 18,
  redox: 30,
}
const picked: Scored[] = []
const pickedKeys = new Set<string>()
const take = (c: Scored) => {
  if (pickedKeys.has(c.key) || picked.length >= 200) return
  picked.push(c)
  pickedKeys.add(c.key)
}
// по одной лучшей качественной реакции на каждый ион
for (const ion of new Set(scored.map((c) => c.qualitative).filter(Boolean))) take(scored.find((c) => c.qualitative === ion)!)
for (const type of Object.keys(QUOTA) as RxType[]) {
  const have = () => picked.filter((c) => c.type === type).length
  for (const c of scored.filter((x) => x.type === type)) {
    if (have() >= QUOTA[type]) break
    take(c)
  }
}
for (const c of scored) take(c)

const byType: Record<string, number> = {}
for (const c of picked) byType[c.type] = (byType[c.type] ?? 0) + 1
const availByType: Record<string, number> = {}
for (const c of scored) availByType[c.type] = (availByType[c.type] ?? 0) + 1
console.log(`кандидатов: ${scored.length}; отклонено:`, rejected)
console.log('доступно по типам:', availByType)
console.log(`отобрано: ${picked.length}`, byType, `качественных: ${picked.filter((c) => c.qualitative).length}`)
if (picked.length !== 200) throw new Error(`отобрано ${picked.length}, нужно 200`)

const TYPE_ORDER: RxType[] = ['combination', 'decomposition', 'substitution', 'exchange', 'neutralization', 'combustion', 'redox']
// внутри типа — по школьной значимости (без надбавки списка MUST)
const natural = (c: Scored) => c.score - (MUST.has(c.equation) ? 25 : 0)
picked.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || natural(b) - natural(a) || a.equation.localeCompare(b.equation))
if (LIST) for (const c of picked) console.log(c.type.padEnd(15), c.equation, c.qualitative ? `[${c.qualitative}]` : '', c.grades.join(','), c.score.toFixed(1))
if (process.argv.includes('--rest')) {
  for (const type of TYPE_ORDER) {
    console.log(`── не вошли (${type}) ──`)
    for (const c of scored.filter((x) => x.type === type && !pickedKeys.has(x.key)).slice(0, 40)) {
      console.log('  ', c.equation, c.qualitative ? `[${c.qualitative}]` : '', c.grades.join(','), c.score.toFixed(1))
    }
  }
}

// ── условия в реакторе (нагрев / давление / катализатор) — школьные условия ЭТОЙ реакции ──
type Lab = { heat?: true; pressure?: true; catalyst?: string }
const LAB_OVERRIDE: Record<string, Lab> = {
  'N₂ + 3H₂ ⇄ 2NH₃': { heat: true, pressure: true, catalyst: 'Fe' },
  '2SO₂ + O₂ ⇄ 2SO₃': { heat: true, catalyst: 'V₂O₅' },
  '4NH₃ + 5O₂ → 4NO + 6H₂O': { heat: true, catalyst: 'Pt' },
  '2KClO₃ → 2KCl + 3O₂': { heat: true, catalyst: 'MnO₂' },
  '2H₂O₂ → 2H₂O + O₂': { catalyst: 'MnO₂' },
  'N₂ + O₂ ⇄ 2NO': { heat: true },
  'SiO₂ + CaO → CaSiO₃': { heat: true },
  'CO₂ + C ⇄ 2CO': { heat: true },
  'Mg + 2H₂O → Mg(OH)₂ + H₂': { heat: true },
  '3Fe + 4H₂O → Fe₃O₄ + 4H₂': { heat: true },
  'C + H₂O → CO + H₂': { heat: true },
  '2Mg + CO₂ → 2MgO + C': { heat: true },
  '2NaNO₃ + H₂SO₄ → Na₂SO₄ + 2HNO₃': { heat: true },
  '2NaCl + H₂SO₄ → Na₂SO₄ + 2HCl': { heat: true },
  'Al₂O₃ + 2NaOH → 2NaAlO₂ + H₂O': { heat: true },
  'SiO₂ + 2NaOH → H₂O + Na₂SiO₃': { heat: true },
  '2NH₄Cl + Ca(OH)₂ → CaCl₂ + 2H₂O + 2NH₃': { heat: true },
  // оксид меди(II) растворяют в кислотах при нагревании (школьный опыт)
  'CuO + H₂SO₄ → CuSO₄ + H₂O': { heat: true },
  'CuO + 2HCl → CuCl₂ + H₂O': { heat: true },
  'CuO + 2HNO₃ → Cu(NO₃)₂ + H₂O': { heat: true },
  'Cu + 2H₂SO₄ → CuSO₄ + SO₂ + 2H₂O': { heat: true },
  '2Fe + 6H₂SO₄ → Fe₂(SO₄)₃ + 3SO₂ + 6H₂O': { heat: true },
  'MnO₂ + 4HCl → MnCl₂ + Cl₂ + 2H₂O': { heat: true },
  'P + 5HNO₃ → H₃PO₄ + 5NO₂ + H₂O': { heat: true },
  '3Cl₂ + 6KOH → KClO₃ + 5KCl + 3H₂O': { heat: true },
  '6P + 5KClO₃ → 5KCl + 3P₂O₅': { heat: true },
  '3CuO + 2NH₃ → 3Cu + 3H₂O + N₂': { heat: true },
  'Ca₃(PO₄)₂ + 5C + 3SiO₂ → 3CaSiO₃ + 2P + 5CO': { heat: true },
  'H₂ + I₂ ⇄ 2HI': { heat: true },
  // идут без нагревания: газы в присутствии воды, пероксид натрия с водой и CO₂
  'SO₂ + 2H₂S → 3S + 2H₂O': {},
  '2Na₂O₂ + 2H₂O → 4NaOH + O₂': {},
  '2Na₂O₂ + 2CO₂ → 2Na₂CO₃ + O₂': {},
}
/** Разложение без нагрева: неустойчивые кислоты распадаются сами. */
const SELF_DECOMP = new Set(['h2co3', 'h2so3'])

function labFor(c: Scored): Lab {
  const over = LAB_OVERRIDE[c.equation]
  if (over) return over
  const r = c.parsed.reactants
  const oxideReactant = r.some((s) => {
    const id = compoundOfSpecies(s)
    return Boolean(id && OXIDE(id) && s.formula !== 'H2O' && s.formula !== 'CO2')
  })
  switch (c.type) {
    case 'combustion':
      return { heat: true }
    case 'decomposition':
      return r.some((s) => SELF_DECOMP.has(compoundOfSpecies(s) ?? '')) ? {} : { heat: true }
    case 'combination':
      // простые вещества соединяются при нагревании (поджигании); оксиды с водой, аммиак с кислотой — без условий
      return r.every(isSimpleSpecies) ? { heat: true } : {}
    case 'substitution':
    case 'redox':
      // восстановление оксидов водородом, углём, CO, алюминием, магнием — при нагревании
      return oxideReactant ? { heat: true } : {}
    default:
      return {}
  }
}

if (LIST) for (const c of picked) {
  const l = labFor(c)
  const s = [l.heat ? 't' : '', l.pressure ? 'p' : '', l.catalyst ? `kat ${l.catalyst}` : ''].filter(Boolean).join(', ')
  if (s) console.log('   условия:', c.equation, '—', s)
}

if (WRITE) {
  const rows = picked.map((c, i) => {
    const first = [...c.occ].sort((a, b) => a.grade - b.grade || (a.page ?? 999) - (b.page ?? 999))[0]
    return {
      id: `mr${String(i + 1).padStart(3, '0')}`,
      equation: c.equation,
      type: c.type,
      redox: c.redox,
      ...(c.qualitative ? { qualitative: c.qualitative } : {}),
      lab: labFor(c),
      grades: c.grades,
      main: c.res.productCompoundId,
      species: [...c.parsed.reactants, ...c.parsed.products].map((sp) => (isSimpleSpecies(sp) ? formulaToUnicode(sp.formula) : (compoundOfSpecies(sp) ?? sp.formula))),
      ...(c.bankIds[0] ? { bankId: c.bankIds[0] } : {}),
      ...(c.bankTitle ? { titleRu: c.bankTitle } : {}),
      ...(first ? { book: { grade: first.grade, page: first.page, unitId: first.unitId, rxId: first.rxId } } : {}),
      ...(c.res.conditions ? { conditions: c.res.conditions } : {}),
    }
  })
  const body = `/**
 * 200 основных реакций школьной неорганики (docs/plans/reactions-top200.md, п. 1).
 * Сгенерировано: npx tsx scripts/plan/select-reactions200.mts --write — не править руками.
 * Каждая открывается в реакторе с коэффициентами 1 (ученик только уравнивает), вещества — из 200 каталога
 * или простые, коэффициенты уравнения — единственный минимальный целочисленный набор.
 */
import type { MainReaction } from './mainReactionTypes'

export const MAIN_REACTIONS_200: readonly MainReaction[] = [
${rows.map((r) => `  ${JSON.stringify(r)},`).join('\n')}
]
`
  fs.writeFileSync('src/data/catalog/mainReactions200.ts', body.replace(/\r\n/g, '\n'))
  console.log('записано src/data/catalog/mainReactions200.ts')
}
