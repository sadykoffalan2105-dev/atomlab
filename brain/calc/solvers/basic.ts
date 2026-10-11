/**
 * Решатели «одного вещества»: Mr, ω элемента, n ↔ m ↔ V ↔ N, плотность газа (D по H₂/воздуху, ρ = M/Vm),
 * формула по массовым долям (простейшая и истинная по M/D), строение атома (p, n, e; средняя Ar изотопов).
 */
import { findElements, findFormulas } from '../../pipeline/entities.ts'
import { M_AIR, VM, molarMass, schoolAr } from '../constants.ts'
import { L, fnum, molarMassLine, unitLabel, type CalcValue, type Line, type Solution } from '../format.ts'
import { isAmount, labeled, speciesOf, type Ctx, type Species } from '../parse.ts'
import type { Solver } from '../registry.ts'
import { GASES, Mof, formulaOf, fromMoles, givenOf, kindOf, nearInt, toMoles, vm } from './common.ts'

const compounds = (sp: Species[]) => sp.filter((s) => Object.keys(s.counts).length > 1)

// ---------------------------------------------------------------- Mr (школьное «относительная молекулярная масса»)
const molarMassSolver: Solver = {
  id: 'molar_mass',
  priority: 10,
  solve(ctx) {
    if (!/(относительн\p{L}* молекулярн\p{L}* масс|относительн\p{L}* формульн\p{L}* масс|\bmr\s*\(|nisbiy molekulyar massa|relative (molecular|formula) mass)/iu.test(ctx.cmp)) return null
    if (ctx.qs.some(isAmount)) return null
    const fs = compounds(ctx.species).slice(0, 3)
    if (!fs.length) return null
    const answers: CalcValue[] = []
    const steps: Line[] = []
    for (const f of fs) {
      const M = Mof(f)
      if (M == null) return null
      const line = molarMassLine(f.pretty, f.counts)
      steps.push((l) => line(l).replace(/^M\(/, 'Mr(').replace(/\s*(г\/моль|g\/mol)/, ''))
      answers.push({ label: `Mr(${f.pretty})`, value: M, unit: 'none', kind: 'M' })
    }
    return { type: 'molar_mass', given: [], find: answers.map((a) => a.label), steps, answers }
  },
}

// ---------------------------------------------------------------- ω элемента в веществе (и масса элемента в m г вещества)
const massFractionElement: Solver = {
  id: 'mass_fraction_element',
  priority: 20,
  solve(ctx) {
    if (!/(массов\p{L}* дол|ω|w\s*\(|процентн\p{L}* (содержан|состав)|mass (fraction|percent)|percent(age)? (by mass|composition)|massa ulush|foiz (tarkib|ulush)|сколько процентов)/iu.test(ctx.cmp)) return null
    if (/(раствор|eritma|solution|смес|aralashma|mixture|примес|выход|unum|yield)/iu.test(ctx.cmp)) return null
    const amounts = ctx.qs.filter(isAmount)
    if (amounts.length || ctx.qs.some((q) => q.unit === 'pct')) return null
    const sub = compounds(ctx.species)[0]
    if (!sub) return null
    // целевой элемент: ω(O), «кислорода», одиночный символ
    let target: string | null = ctx.text.match(/(?:ω|w)\s*\(\s*([A-Z][a-z]?)\s*\)/)?.[1] ?? null
    if (target && !sub.counts[target]) target = null
    if (!target) for (const e of findElements(ctx.text, ctx.kb)) if (sub.counts[e.item.s]) target = e.item.s
    if (!target) for (const f of findFormulas(ctx.text, true)) if (Object.keys(f.counts).length === 1 && !/\d/.test(f.raw) && sub.counts[f.ascii]) target = f.ascii
    const M = Mof(sub)
    if (M == null) return null
    const els = target ? [target] : Object.keys(sub.counts)
    const steps: Line[] = [molarMassLine(sub.pretty, sub.counts)]
    const answers: CalcValue[] = []
    for (const el of els) {
      const n = sub.counts[el]!
      const ar = schoolAr(el)!
      const w = ((n * ar) / M) * 100
      steps.push((l) => `ω(${el}) = ${n > 1 ? `${n}·` : ''}${fnum(ar, l, 'M')} / ${fnum(M, l, 'M')} · 100 % = ${fnum(w, l, 'pct')} %`)
      answers.push({ label: `ω(${el})`, value: w, unit: 'pct' })
    }
    return { type: 'mass_fraction_element', given: [], find: answers.map((a) => a.label), steps, answers }
  },
}

// ---------------------------------------------------------------- n ↔ m ↔ V ↔ N одного вещества
const molesSolver: Solver = {
  id: 'moles_mass_volume_particles',
  priority: 15,
  solve(ctx) {
    const amounts = ctx.qs.filter(isAmount)
    if (amounts.length !== 1) return null
    if (ctx.qs.some((q) => q.unit === 'pct' || q.unit === 'M' || q.unit === 'kPa' || q.unit === 'gml' || q.unit === 'kj')) return null
    const distinct = [...new Map(ctx.species.map((s) => [s.ascii, s])).values()]
    const q = amounts[0]!
    let sp = distinct.length === 1 ? distinct[0]! : null
    if (!sp && distinct.length > 1 && !ctx.species.some((s) => s.index >= ctx.ask.index)) sp = speciesOf(q, ctx.species, ctx.text)
    if (!sp) return null
    const given = kindOf(q)!
    const kinds = ctx.ask.kinds.filter((k) => (k === 'mass' || k === 'volume' || k === 'mol' || k === 'particles') && k !== given)
    if (!kinds.length) return null
    if (kinds.includes('volume') && !GASES.has(sp.ascii)) return null
    const steps: Line[] = []
    const n = toMoles(q, sp, steps)
    if (n == null) return null
    const answers: CalcValue[] = []
    if (!fromMoles(n, sp, kinds, steps, answers, { mLine: q.unit !== 'g' })) return null
    return { type: 'moles_mass_volume_particles', given: [givenOf(q, sp)], find: answers.map((a) => a.label), steps, answers }
  },
}

// ---------------------------------------------------------------- плотность газа
const D_H2 = /(?:D\s*\(?\s*(?:H2|H₂)\s*\)?\s*=\s*|(?:плотност\p{L}*|density|zichlig\p{L}*)[^\d]{0,40}?(?:по водороду|vodorodga nisbatan|relative to hydrogen|to hydrogen)[^\d]{0,15}?|(?:по водороду|vodorodga nisbatan|relative to hydrogen)[^\d]{0,25}?)(\d+(?:[.,]\d+)?)/iu
const D_AIR = /(?:D\s*\(?\s*(?:возд\p{L}*|air|havo)\s*\)?\s*=\s*|(?:плотност\p{L}*|density|zichlig\p{L}*)[^\d]{0,40}?(?:по воздуху|havoga nisbatan|relative to air|to air)[^\d]{0,15}?|(?:по воздуху|havoga nisbatan|relative to air)[^\d]{0,25}?)(\d+(?:[.,]\d+)?)/iu

export function relDensity(text: string): { M: number; line: Line; given: CalcValue } | null {
  const dh = labeled(text, D_H2)
  if (dh != null) return { M: dh * 2, line: (l) => `M = D(H₂) · M(H₂) = ${fnum(dh, l)} · 2 = ${fnum(dh * 2, l, 'M')} ${unitLabel('gmol', l)}`, given: { label: 'D(H₂)', value: dh, unit: 'none' } }
  const da = labeled(text, D_AIR)
  if (da != null) return { M: da * M_AIR, line: (l) => `M = D(${L(l, 'возд.', 'havo', 'air')}) · 29 = ${fnum(da, l)} · 29 = ${fnum(da * M_AIR, l, 'M')} ${unitLabel('gmol', l)}`, given: { label: L('ru', 'D(возд.)', '', ''), value: da, unit: 'none' } }
  return null
}

const gasDensity: Solver = {
  id: 'gas_density',
  priority: 35,
  solve(ctx) {
    const wantsD = /(плотност\p{L}*|density|zichlig\p{L}*)/iu.test(ctx.ask.text)
    const rel = relDensity(ctx.text)
    if (ctx.qs.some((q) => q.unit === 'pct')) return null // формула по ω % — formula_from_fractions
    if (rel) {
      // M по D; если спрашивают массу/объём/плотность — дальше по M
      const steps: Line[] = [rel.line]
      const answers: CalcValue[] = [{ label: 'M', value: rel.M, unit: 'gmol', kind: 'M' }]
      const amounts = ctx.qs.filter(isAmount)
      if (amounts.length > 1) return null
      if (amounts.length === 1) {
        const q = amounts[0]!
        const kinds = ctx.ask.kinds.filter((k) => k === 'mass' || k === 'volume' || k === 'mol')
        if (q.unit === 'l' && kinds.includes('mass')) {
          const m = (q.value / VM) * rel.M
          steps.push((l) => `m = V / Vm · M = ${fnum(q.value, l)} / ${vm(l)} · ${fnum(rel.M, l, 'M')} = ${fnum(m, l)} ${unitLabel('g', l)}`)
          answers.push({ label: 'm', value: m, unit: 'g' })
        } else if (q.unit === 'g' && kinds.includes('volume')) {
          const V = (q.value / rel.M) * VM
          steps.push((l) => `V = m / M · Vm = ${fnum(q.value, l)} / ${fnum(rel.M, l, 'M')} · ${vm(l)} = ${fnum(V, l)} ${unitLabel('l', l)}`)
          answers.push({ label: 'V', value: V, unit: 'l' })
        } else return null
      } else if (!/(молярн\p{L}* масс|molyar massa|molar mass|\bM\b)/iu.test(ctx.ask.text) && !/(молярн\p{L}* масс|molyar massa|molar mass)/iu.test(ctx.cmp)) return null
      return { type: 'gas_density', given: [rel.given], find: answers.map((a) => a.label), steps, answers }
    }
    if (!wantsD) return null
    const gas = ctx.species.find((s) => GASES.has(s.ascii) || Object.keys(s.counts).length > 1)
    if (!gas || ctx.qs.some(isAmount)) return null
    const M = Mof(gas)
    if (M == null) return null
    const steps: Line[] = [molarMassLine(gas.pretty, gas.counts)]
    const answers: CalcValue[] = []
    const a = ctx.ask.text
    if (/(водород|hydrogen|vodorod)/iu.test(a)) {
      steps.push((l) => `D(H₂) = M / 2 = ${fnum(M, l, 'M')} / 2 = ${fnum(M / 2, l)}`)
      answers.push({ label: `D(H₂)`, value: M / 2, unit: 'none' })
    }
    if (/(воздух|air|havo)/iu.test(a)) {
      steps.push((l) => `D(${L(l, 'возд.', 'havo', 'air')}) = M / 29 = ${fnum(M, l, 'M')} / 29 = ${fnum(M / 29, l)}`)
      answers.push({ label: L(ctx.lang, 'D(возд.)', 'D(havo)', 'D(air)'), value: M / 29, unit: 'none' })
    }
    if (!answers.length) {
      steps.push((l) => `ρ = M / Vm = ${fnum(M, l, 'M')} / ${vm(l)} = ${fnum(M / VM, l)} ${unitLabel('gl', l)}`)
      answers.push({ label: `ρ(${gas.pretty})`, value: M / VM, unit: 'gl' })
    }
    return { type: 'gas_density', given: [], find: answers.map((x) => x.label), steps, answers }
  },
}

// ---------------------------------------------------------------- формула по массовым долям
const ORDER = ['C', 'H', 'N', 'O', 'S', 'P', 'Cl', 'Br', 'I', 'F']

/** Пары «элемент — %»: «ω(C) = 85,7 %», «85,7 % углерода», «углерода — 85,7 %». */
export function elementFractions(ctx: Ctx): Record<string, number> | null {
  const out: Record<string, number> = {}
  const els = findElements(ctx.text, ctx.kb)
  for (const q of ctx.qs.filter((x) => x.unit === 'pct')) {
    const sym = ctx.text.slice(Math.max(0, q.index - 14), q.index).match(/(?:ω|w)\s*\(\s*([A-Z][a-z]?)\s*\)\s*[=:–—-]?\s*$/)?.[1]
    let el = sym ?? null
    if (!el) {
      // «доля углерода 85,7 %» (до числа, без запятой между) или «85,7 % углерода» (после, без запятой)
      const before = [...els].reverse().find((e) => e.index < q.index && q.index - e.index <= 24 && !/[\d,;]/.test(ctx.text.slice(e.index, q.index)))
      const after = els.find((e) => e.index >= q.end && e.index - q.end <= 12 && !/[,;]/.test(ctx.text.slice(q.end, e.index)))
      // «40 % серы» — элемент сразу после числа важнее «… серы и 60 % кислорода»
      const glued = after && /^\s*$/.test(ctx.text.slice(q.end, after.index)) ? after : null
      el = glued?.item.s ?? before?.item.s ?? after?.item.s ?? null
    }
    if (!el) {
      const symAfter = ctx.text.slice(q.end, q.end + 6).match(/^\s*([A-Z][a-z]?)(?![a-z])/)?.[1]
      const symBefore = ctx.text.slice(Math.max(0, q.index - 8), q.index).match(/([A-Z][a-z]?)\s*[-–—:=]?\s*$/)?.[1]
      el = symAfter ?? symBefore ?? null
    }
    if (!el || schoolAr(el) == null || out[el] != null) return null
    out[el] = q.value
  }
  if (Object.keys(out).length < 2) return null
  return out
}

/** Простейшая формула по ω: x : y : z = ω/Ar … → целые. */
export function simplestFormula(fr: Record<string, number>): { counts: Record<string, number>; ratios: Record<string, number> } | null {
  const ratios: Record<string, number> = {}
  for (const [el, w] of Object.entries(fr)) ratios[el] = w / schoolAr(el)!
  const min = Math.min(...Object.values(ratios))
  for (let k = 1; k <= 6; k++) {
    const counts: Record<string, number> = {}
    let ok = true
    for (const [el, r] of Object.entries(ratios)) {
      const x = (r / min) * k
      if (!nearInt(x, 0.12)) ok = false
      counts[el] = Math.round(x)
    }
    if (ok) return { counts, ratios }
  }
  return null
}

const formulaFromFractions: Solver = {
  id: 'formula_from_fractions',
  priority: 40,
  solve(ctx) {
    if (!/(формул|formula|formulasi)/iu.test(ctx.cmp)) return null
    const fr = elementFractions(ctx)
    if (!fr) return null
    const sum = Object.values(fr).reduce((a, b) => a + b, 0)
    if (sum > 100.5) return null
    if (sum < 99.5) {
      // остаток — кислород, если он назван
      if (fr.O == null && /(кислород|oxygen|kislorod)/iu.test(ctx.text)) fr.O = 100 - sum
      else return null
    }
    const sf = simplestFormula(fr)
    if (!sf) return null
    const order = [...ORDER.filter((e) => sf.counts[e]), ...Object.keys(sf.counts).filter((e) => !ORDER.includes(e))]
    const isOrganic = sf.counts.C != null && sf.counts.H != null
    const ord = isOrganic ? order : Object.keys(fr)
    const simple = formulaOf(sf.counts, ord)
    const Ms = molarMass(sf.counts, 'school')!
    const steps: Line[] = [
      (l) => `${Object.keys(fr).join(' : ')} = ${Object.entries(fr).map(([el, w]) => `${fnum(w, l, 'pct')}/${fnum(schoolAr(el)!, l, 'M')}`).join(' : ')} = ${Object.values(sf.ratios).map((r) => fnum(r, l)).join(' : ')}`,
      (l) => `${L(l, 'простейшая формула', 'eng oddiy formula', 'simplest formula')}: ${simple}, M = ${fnum(Ms, l, 'M')} ${unitLabel('gmol', l)}`,
    ]
    const given: CalcValue[] = Object.entries(fr).map(([el, w]) => ({ label: `ω(${el})`, value: w, unit: 'pct' }))
    let counts = sf.counts
    const rel = relDensity(ctx.text)
    const Mq = ctx.qs.find((q) => q.unit === 'gmol')?.value
    const Mtrue = rel?.M ?? Mq ?? null
    if (Mtrue != null) {
      const k = Math.round(Mtrue / Ms)
      if (k < 1 || Math.abs(Mtrue / Ms - k) > 0.08) return null
      if (rel) {
        steps.push(rel.line)
        given.push(rel.given)
      }
      counts = Object.fromEntries(Object.entries(sf.counts).map(([e, n]) => [e, n * k]))
      steps.push((l) => `k = ${fnum(Mtrue, l, 'M')} / ${fnum(Ms, l, 'M')} = ${k}`)
    }
    const f = formulaOf(counts, ord)
    return { type: 'formula_from_fractions', given, find: [L(ctx.lang, 'формула', 'formula', 'formula')], steps, answers: [{ label: '', value: 0, unit: 'none', text: f }] }
  },
}

// ---------------------------------------------------------------- строение атома: p, n, e; средняя Ar изотопов
const SUP_D: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }

const atomicStructure: Solver = {
  id: 'atomic_structure_counts',
  priority: 45,
  solve(ctx) {
    const t = ctx.text
    // средняя Ar по изотопам: «³⁵Cl — 75 %, ³⁷Cl — 25 %»
    if (/(изотоп|izotop|isotope)/iu.test(ctx.cmp) && /(средн\p{L}*|относительн\p{L}* атомн|o['ʻ’]rtacha|average|relative atomic)/iu.test(ctx.cmp)) {
      const pcts = ctx.qs.filter((q) => q.unit === 'pct')
      if (pcts.length < 2) return null
      const masses: number[] = []
      for (const q of pcts) {
        const near = t.slice(Math.max(0, q.index - 22), q.index)
        const A = [...near.matchAll(/(?:([⁰¹²³⁴⁵⁶⁷⁸⁹]+)[A-Z][a-z]?|\b(\d{1,3})\s*[A-Z][a-z]?\b|[A-Z][a-z]?\s*-\s*(\d{1,3})|\p{L}+\s*-\s*(\d{1,3}))/gu)].pop()
        const a = A ? Number(A[1] ? [...A[1]].map((c) => SUP_D[c]).join('') : A[2] ?? A[3] ?? A[4]) : NaN
        if (!Number.isFinite(a)) return null
        masses.push(a)
      }
      const sumW = pcts.reduce((s, q) => s + q.value, 0)
      if (Math.abs(sumW - 100) > 0.5) return null
      const Ar = pcts.reduce((s, q, i) => s + (masses[i]! * q.value) / 100, 0)
      return {
        type: 'atomic_structure_counts',
        given: pcts.map((q, i) => ({ label: `ω(${masses[i]})`, value: q.value, unit: 'pct' as const })),
        find: ['Ar'],
        steps: [(l) => `Ar = ${pcts.map((q, i) => `${masses[i]}·${fnum(q.value / 100, l)}`).join(' + ')} = ${fnum(Ar, l)}`],
        answers: [{ label: 'Ar', value: Ar, unit: 'none' }],
      }
    }
    if (!/(протон|нейтрон|электрон|proton|neutron|neytron|elektron|electron)/iu.test(ctx.cmp)) return null
    // строение атома/иона, а не «сколько электронов отдаёт» (это валентность)
    if (!/(протон|нейтрон|proton|neutron|neytron|в атоме|атом\p{L}*|atom\p{L}*|in an atom|ион\p{L}*|ion\p{L}*|ядр|yadro|nucleus)/iu.test(ctx.cmp)) return null
    if (!/(сколько|число|количеств|how many|number of|nechta|soni|necha|определ|найд|aniqla|toping)/iu.test(ctx.cmp)) return null
    if (ctx.qs.some(isAmount)) return null
    // элемент + массовое число: ⁵⁶Fe, 56Fe, Fe-56, «железа-56»; ион: Fe³⁺, Cl⁻
    let sym: string | null = null
    let A: number | null = null
    let charge = 0
    const iso = t.match(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\s*([A-Z][a-z]?)/) ?? t.match(/(?<![\w,.])(\d{1,3})\s*([A-Z][a-z]?)(?![a-z\d])/)
    if (iso) {
      sym = iso[2]!
      A = Number([...iso[1]!].map((c) => SUP_D[c] ?? c).join(''))
    }
    if (!sym) {
      const m = t.match(/([A-Z][a-z]?)\s*-\s*(\d{1,3})/)
      if (m) {
        sym = m[1]!
        A = Number(m[2])
      }
    }
    const els = findElements(t, ctx.kb)
    if (!sym && els.length === 1) {
      sym = els[0]!.item.s
      const after = t.slice(els[0]!.index).match(/^\p{L}+\s*-\s*(\d{1,3})/u)
      if (after) A = Number(after[1])
    }
    if (!sym) {
      const f = findFormulas(t, true).filter((x) => Object.keys(x.counts).length === 1)
      if (f.length !== 1) return null
      sym = Object.keys(f[0]!.counts)[0]!
      charge = f[0]!.charge
    } else {
      const ion = findFormulas(t, true).find((x) => x.counts[sym!] && Object.keys(x.counts).length === 1)
      if (ion) charge = ion.charge
    }
    const el = ctx.kb.elementBySymbol.get(sym)
    if (!el) return null
    const Z = el.z
    const mass = A ?? Math.round(schoolAr(sym) ?? el.A)
    if (mass < Z) return null
    const nN = mass - Z
    const e = Z - charge
    const steps: Line[] = [
      (l) => `${L(l, 'порядковый номер', 'tartib raqami', 'atomic number')} Z(${sym}) = ${Z} → p = ${Z}`,
      () => `n = A − Z = ${mass} − ${Z} = ${nN}`,
      () => `e = Z${charge ? ` − (${charge > 0 ? '+' : '−'}${Math.abs(charge)})` : ''} = ${e}`,
    ]
    return {
      type: 'atomic_structure_counts',
      given: [{ label: 'A', value: mass, unit: 'none', kind: 'int' }],
      find: ['p', 'n', 'e'],
      steps,
      answers: [
        { label: 'p', value: Z, unit: 'none', kind: 'int' },
        { label: 'n', value: nN, unit: 'none', kind: 'int' },
        { label: 'e', value: e, unit: 'none', kind: 'int' },
      ],
    }
  },
}

export const BASIC_SOLVERS: Solver[] = [molarMassSolver, massFractionElement, molesSolver, gasDensity, formulaFromFractions, atomicStructure]
export type { Solution }
