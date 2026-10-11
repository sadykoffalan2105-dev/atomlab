/**
 * Решатели «растворы»: ω раствора (приготовление, смешивание, разбавление, упаривание, добавление соли),
 * m = ρ·V, молярная и нормальная концентрация (из m, n, ω и ρ; разбавление C₁V₁ = C₂V₂), растворимость,
 * кристаллогидраты.
 */
import { findFormulas, pretty } from '../../pipeline/entities.ts'
import { molarMass } from '../constants.ts'
import { L, fnum, molarMassLine, unitLabel, type CalcValue, type Line } from '../format.ts'
import type { Ctx, Qty, Species } from '../parse.ts'
import type { Solver } from '../registry.ts'
import { Mof } from './common.ts'

const SOL = /(раствор|eritma|solution)/iu
const role = (q: Qty) => (/^\s*(\p{L}+\s+)?(вод|suv|water|h2o|h₂o)/iu.test(q.after) ? 'water' : /^\s*(\p{L}+\s+)?(раствор|eritma|solution)/iu.test(q.after) || /(раствор(?:а|ом|е|у)?|eritma(?:si|ning)?|solution)\s*(массой|of)?\s*$/iu.test(q.before) ? 'solution' : 'solute')

/** Растворённое вещество: первое не-вода. */
const solute = (ctx: Ctx): Species | null => ctx.species.find((s) => s.ascii !== 'H2O') ?? null
const pctOf = (l: string, x: number) => `${fnum(x, l as 'ru', 'pct')} %`

const solutionMassFraction: Solver = {
  id: 'solution_mass_fraction',
  priority: 25,
  solve(ctx) {
    if (!SOL.test(ctx.cmp)) return null
    if (ctx.qs.some((q) => q.unit === 'mol' || q.unit === 'M' || q.unit === 'N' || q.unit === 'kPa')) return null
    if (/(растворимост|eruvchanlik|solubility|насыщенн|to['ʻ’]yingan|saturated)/iu.test(ctx.cmp)) return null
    let masses = ctx.qs.filter((q) => q.unit === 'g')
    const pcts = ctx.qs.filter((q) => q.unit === 'pct')
    const vols = ctx.qs.filter((q) => q.unit === 'l')
    const dens = ctx.qs.find((q) => q.unit === 'gml')
    const steps: Line[] = []
    const given: CalcValue[] = []
    let type: 'solution_mass_fraction' | 'solution_density_volume' = 'solution_mass_fraction'
    // V·ρ → масса раствора
    if (dens && vols.length === 1 && masses.length <= 1) {
      const V = vols[0]!.value * 1000
      const m = V * dens.value
      steps.push((l) => `m(${L(l, 'р-ра', 'eritma', 'solution')}) = ρ · V = ${fnum(dens.value, l)} · ${fnum(V, l)} = ${fnum(m, l)} ${unitLabel('g', l)}`)
      given.push({ label: 'V', value: V, unit: 'ml' }, { label: 'ρ', value: dens.value, unit: 'gml' })
      masses = [{ ...vols[0]!, value: m, unit: 'g', after: ' раствора' }, ...masses]
      type = 'solution_density_volume'
    } else if (vols.length) return null
    const sp = solute(ctx)
    const name = sp?.pretty ?? L(ctx.lang, 'в-ва', 'modda', 'solute')
    const answers: CalcValue[] = []
    const add = /(добав|прилил|прибав|qo['ʻ’]sh|add)/iu.test(ctx.cmp)
    const evap = /(выпар|упар|испар|bug['ʻ’]lat|evaporat)/iu.test(ctx.cmp)
    if (masses.length === 1 && pcts.length === 1) {
      // приготовление: m(р-ра), ω → m(в-ва), m(воды)
      const m = masses[0]!.value
      const w = pcts[0]!.value
      if (role(masses[0]!) === 'water') return null
      const ms = (m * w) / 100
      if (!given.length) given.push({ label: L(ctx.lang, 'm(р-ра)', 'm(eritma)', 'm(solution)'), value: m, unit: 'g' })
      given.push({ label: 'ω', value: w, unit: 'pct' })
      steps.push((l) => `m(${name}) = m(${L(l, 'р-ра', 'eritma', 'solution')}) · ω = ${fnum(m, l)} · ${fnum(w / 100, l)} = ${fnum(ms, l)} ${unitLabel('g', l)}`)
      answers.push({ label: `m(${name})`, value: ms, unit: 'g' })
      if (/(вод|suv|water)/iu.test(ctx.ask.text) && type === 'solution_mass_fraction') {
        steps.push((l) => `m(H₂O) = ${fnum(m, l)} − ${fnum(ms, l)} = ${fnum(m - ms, l)} ${unitLabel('g', l)}`)
        answers.push({ label: 'm(H₂O)', value: m - ms, unit: 'g' })
      }
      return { type, given, find: answers.map((a) => a.label), steps, answers }
    }
    if (masses.length === 2 && pcts.length === 0) {
      const r = masses.map(role)
      const iS = r.indexOf('solute')
      if (iS < 0) return null
      const s = masses[iS]!.value
      const other = masses[1 - iS]!
      const total = r[1 - iS] === 'water' ? s + other.value : r[1 - iS] === 'solution' ? other.value : null
      if (total == null || s > total) return null
      const w = (s / total) * 100
      given.push({ label: `m(${name})`, value: s, unit: 'g' }, { label: r[1 - iS] === 'water' ? 'm(H₂O)' : L(ctx.lang, 'm(р-ра)', 'm(eritma)', 'm(solution)'), value: other.value, unit: 'g' })
      steps.push((l) => `ω = m(${name}) / m(${L(l, 'р-ра', 'eritma', 'solution')}) · 100 % = ${fnum(s, l)} / ${fnum(total, l)} · 100 % = ${pctOf(l, w)}`)
      answers.push({ label: `ω(${name})`, value: w, unit: 'pct' })
      return { type, given, find: answers.map((a) => a.label), steps, answers }
    }
    if (masses.length === 2 && pcts.length === 1 && (add || evap)) {
      // разбавление / упаривание / добавление соли
      const [m1q, m2q] = masses as [Qty, Qty]
      const w1 = pcts[0]!.value
      const m1 = m1q.value
      const m2 = m2q.value
      const sIn = (m1 * w1) / 100
      const isWater = role(m2q) === 'water' || /(вод|suv|water)/iu.test(m2q.after)
      let s2 = sIn
      let tot = m1
      if (evap) tot = m1 - m2
      else if (isWater) tot = m1 + m2
      else {
        s2 = sIn + m2
        tot = m1 + m2
      }
      if (tot <= 0) return null
      const w2 = (s2 / tot) * 100
      given.push({ label: 'm₁', value: m1, unit: 'g' }, { label: 'ω₁', value: w1, unit: 'pct' }, { label: evap ? L(ctx.lang, 'm(выпар.)', 'm(bugʻlangan)', 'm(evap.)') : isWater ? 'm(H₂O)' : `m(${name})`, value: m2, unit: 'g' })
      steps.push((l) => `m(${name}) = ${fnum(m1, l)} · ${fnum(w1 / 100, l)} = ${fnum(sIn, l)} ${unitLabel('g', l)}`)
      steps.push((l) => `ω₂ = ${fnum(s2, l)} / ${fnum(tot, l)} · 100 % = ${pctOf(l, w2)}`)
      answers.push({ label: 'ω₂', value: w2, unit: 'pct' })
      return { type, given, find: ['ω₂'], steps, answers }
    }
    if (masses.length === 2 && pcts.length === 2) {
      // смешивание двух растворов
      const [a, b] = masses as [Qty, Qty]
      const [wa, wb] = pcts as [Qty, Qty]
      const s = (a.value * wa.value + b.value * wb.value) / 100
      const tot = a.value + b.value
      const w = (s / tot) * 100
      given.push({ label: 'm₁', value: a.value, unit: 'g' }, { label: 'ω₁', value: wa.value, unit: 'pct' }, { label: 'm₂', value: b.value, unit: 'g' }, { label: 'ω₂', value: wb.value, unit: 'pct' })
      steps.push((l) => `m(${name}) = ${fnum(a.value, l)} · ${fnum(wa.value / 100, l)} + ${fnum(b.value, l)} · ${fnum(wb.value / 100, l)} = ${fnum(s, l)} ${unitLabel('g', l)}`)
      steps.push((l) => `ω₃ = ${fnum(s, l)} / (${fnum(a.value, l)} + ${fnum(b.value, l)}) · 100 % = ${pctOf(l, w)}`)
      answers.push({ label: 'ω₃', value: w, unit: 'pct' })
      return { type, given, find: ['ω₃'], steps, answers }
    }
    return null
  },
}

// ---------------------------------------------------------------- молярная / нормальная концентрация
/** Число эквивалентности z: кислота — число H, основание — число OH, соль — (число атомов металла) × валентность. */
export function eqFactor(sp: Species): number | null {
  const c = sp.counts
  const els = Object.keys(c)
  const metal = els.find((e) => !['H', 'O', 'C', 'N', 'S', 'P', 'Cl', 'Br', 'I', 'F', 'Si', 'B'].includes(e))
  if (!metal && c.H && sp.ascii.startsWith('H')) return sp.ascii === 'CH3COOH' ? 1 : (sp.ascii.match(/^H(\d?)/)?.[1] ? Number(sp.ascii.match(/^H(\d)/)![1]) : 1)
  if (metal && /\(OH\)(\d)$/.test(sp.ascii)) return Number(sp.ascii.match(/\(OH\)(\d)$/)![1])
  if (metal && /OH$/.test(sp.ascii)) return 1
  if (metal) {
    const V: Record<string, number> = { Li: 1, Na: 1, K: 1, Ag: 1, Mg: 2, Ca: 2, Ba: 2, Zn: 2, Cu: 2, Fe: 2, Al: 3, Cr: 3 }
    const v = V[metal]
    return v ? v * c[metal]! : null
  }
  return null
}

const molarity: Solver = {
  id: 'molarity',
  priority: 24,
  solve(ctx) {
    const normal = ctx.qs.some((q) => q.unit === 'N') || /(нормальн\p{L}* концентрац|normal(ity| concentration)|normal konsentratsiya|эквивалентн\p{L}* концентрац)/iu.test(ctx.cmp)
    if (!normal && !/(молярн\p{L}* концентрац|молярност|концентрац|моль\/л|molar(ity| concentration)|molyar konsentratsiya|konsentratsiya)/iu.test(ctx.cmp) && !ctx.qs.some((q) => q.unit === 'M')) return null
    const sp = solute(ctx)
    const vols = ctx.qs.filter((q) => q.unit === 'l')
    const masses = ctx.qs.filter((q) => q.unit === 'g')
    const mols = ctx.qs.filter((q) => q.unit === 'mol')
    const Cs = ctx.qs.filter((q) => q.unit === 'M' || q.unit === 'N')
    const pct = ctx.qs.find((q) => q.unit === 'pct')
    const dens = ctx.qs.find((q) => q.unit === 'gml')
    const steps: Line[] = []
    const given: CalcValue[] = []
    const answers: CalcValue[] = []
    const z = sp ? eqFactor(sp) : null
    const unitC = normal ? 'eqL' : 'moll'
    const cLabel = normal ? `Cн(${sp?.pretty ?? ''})` : `C(${sp?.pretty ?? ''})`
    // ω и ρ → C
    if (pct && dens && sp && !vols.length) {
      const M = Mof(sp)
      if (M == null) return null
      const C = (10 * pct.value * dens.value) / M
      steps.push(molarMassLine(sp.pretty, sp.counts))
      steps.push((l) => `C = 10 · ω · ρ / M = 10 · ${fnum(pct.value, l, 'pct')} · ${fnum(dens.value, l)} / ${fnum(M, l, 'M')} = ${fnum(C, l)} ${unitLabel('moll', l)}`)
      given.push({ label: 'ω', value: pct.value, unit: 'pct' }, { label: 'ρ', value: dens.value, unit: 'gml' })
      answers.push({ label: `C(${sp.pretty})`, value: C, unit: 'moll' })
      if (normal && z) {
        steps.push((l) => `Cн = z · C = ${z} · ${fnum(C, l)} = ${fnum(C * z, l)} ${unitLabel('eqL', l)}`)
        answers.push({ label: `Cн(${sp.pretty})`, value: C * z, unit: 'eqL' })
      }
      return { type: normal ? 'normality' : 'molarity', given, find: answers.map((a) => a.label), steps, answers }
    }
    // разбавление C₁V₁ = C₂V₂
    if (Cs.length === 2 && vols.length === 1 && !masses.length) {
      const [c1, c2] = Cs as [Qty, Qty]
      const V2 = (c1.value * vols[0]!.value) / c2.value
      steps.push((l) => `C₁V₁ = C₂V₂ → V₂ = ${fnum(c1.value, l)} · ${fnum(vols[0]!.value, l)} / ${fnum(c2.value, l)} = ${fnum(V2, l)} ${unitLabel('l', l)}`)
      given.push({ label: 'C₁', value: c1.value, unit: unitC }, { label: 'V₁', value: vols[0]!.value, unit: 'l' }, { label: 'C₂', value: c2.value, unit: unitC })
      answers.push({ label: 'V₂', value: V2, unit: 'l' })
      return { type: normal ? 'normality' : 'molarity', given, find: ['V₂'], steps, answers }
    }
    if (Cs.length === 1 && vols.length === 2 && !masses.length) {
      const [v1, v2] = vols as [Qty, Qty]
      const C2 = (Cs[0]!.value * v1.value) / v2.value
      steps.push((l) => `C₂ = C₁ · V₁ / V₂ = ${fnum(Cs[0]!.value, l)} · ${fnum(v1.value, l)} / ${fnum(v2.value, l)} = ${fnum(C2, l)} ${unitLabel(unitC, l)}`)
      given.push({ label: 'C₁', value: Cs[0]!.value, unit: unitC }, { label: 'V₁', value: v1.value, unit: 'l' }, { label: 'V₂', value: v2.value, unit: 'l' })
      answers.push({ label: 'C₂', value: C2, unit: unitC })
      return { type: normal ? 'normality' : 'molarity', given, find: ['C₂'], steps, answers }
    }
    // Cн из C_M: Cн = z · C
    if (normal && sp && z && Cs.length === 1 && Cs[0]!.unit === 'M' && !vols.length && !masses.length) {
      const C = Cs[0]!.value
      steps.push((l) => `z(${sp.pretty}) = ${z}; Cн = z · C = ${z} · ${fnum(C, l)} = ${fnum(C * z, l)} ${unitLabel('eqL', l)}`)
      return { type: 'normality', given: [{ label: `C(${sp.pretty})`, value: C, unit: 'moll' }], find: [`Cн(${sp.pretty})`], steps, answers: [{ label: `Cн(${sp.pretty})`, value: C * z, unit: 'eqL' }] }
    }
    if (vols.length !== 1 || !sp) return null
    const V = vols[0]!.value
    const M = Mof(sp)
    if (M == null) return null
    if (Cs.length === 1 && !masses.length && !mols.length) {
      // C, V → n, m
      const C = Cs[0]!.value
      const n = normal ? (C * V) / (z ?? NaN) : C * V
      if (!Number.isFinite(n)) return null
      given.push({ label: cLabel, value: C, unit: unitC }, { label: 'V', value: V, unit: 'l' })
      steps.push((l) => (normal ? `n = Cн · V / z = ${fnum(C, l)} · ${fnum(V, l)} / ${z} = ${fnum(n, l)} ${unitLabel('mol', l)}` : `n = C · V = ${fnum(C, l)} · ${fnum(V, l)} = ${fnum(n, l)} ${unitLabel('mol', l)}`))
      steps.push(molarMassLine(sp.pretty, sp.counts))
      steps.push((l) => `m = n · M = ${fnum(n, l)} · ${fnum(M, l, 'M')} = ${fnum(n * M, l)} ${unitLabel('g', l)}`)
      answers.push({ label: `m(${sp.pretty})`, value: n * M, unit: 'g' })
      return { type: normal ? 'normality' : 'molarity', given, find: answers.map((a) => a.label), steps, answers }
    }
    if (Cs.length) return null
    let n: number
    if (mols.length === 1 && !masses.length) {
      n = mols[0]!.value
      given.push({ label: `n(${sp.pretty})`, value: n, unit: 'mol' })
    } else if (masses.length === 1 && !mols.length) {
      const m = masses[0]!.value
      n = m / M
      given.push({ label: `m(${sp.pretty})`, value: m, unit: 'g' })
      steps.push(molarMassLine(sp.pretty, sp.counts))
      steps.push((l) => `n = m / M = ${fnum(m, l)} / ${fnum(M, l, 'M')} = ${fnum(n, l)} ${unitLabel('mol', l)}`)
    } else return null
    given.push({ label: 'V', value: V, unit: 'l' })
    const C = n / V
    steps.push((l) => `C = n / V = ${fnum(n, l)} / ${fnum(V, l)} = ${fnum(C, l)} ${unitLabel('moll', l)}`)
    if (normal) {
      if (!z) return null
      steps.push((l) => `Cн = z · C = ${z} · ${fnum(C, l)} = ${fnum(C * z, l)} ${unitLabel('eqL', l)}`)
      answers.push({ label: `Cн(${sp.pretty})`, value: C * z, unit: 'eqL' })
      return { type: 'normality', given, find: answers.map((a) => a.label), steps, answers }
    }
    answers.push({ label: `C(${sp.pretty})`, value: C, unit: 'moll' })
    return { type: 'molarity', given, find: answers.map((a) => a.label), steps, answers }
  },
}

// ---------------------------------------------------------------- растворимость
const solubility: Solver = {
  id: 'solubility',
  priority: 27,
  solve(ctx) {
    if (!/(растворимост|eruvchanlik|solubility|насыщенн|to['ʻ’]yingan|saturated|коэффициент растворим)/iu.test(ctx.cmp)) return null
    const masses = ctx.qs.filter((q) => q.unit === 'g')
    const sp = solute(ctx)
    const name = sp?.pretty ?? L(ctx.lang, 'в-ва', 'modda', 'solute')
    const per100 = /(на|в)\s*100\s*(г|g)\s*(вод|suv|water)|100\s*g\s*suv|per\s*100\s*g/iu.test(ctx.text)
    const steps: Line[] = []
    const answers: CalcValue[] = []
    if (per100) {
      const s = masses.find((q) => q.value !== 100 || !/^\s*(г|g)?\s*(вод|suv|water)/iu.test(q.after))
      if (!s) return null
      const rest = masses.filter((q) => q !== s && !(q.value === 100 && /(вод|suv|water)/iu.test(q.after.slice(0, 12))))
      if (rest.length === 0) {
        const w = (s.value / (100 + s.value)) * 100
        steps.push((l) => `ω = s / (100 + s) · 100 % = ${fnum(s.value, l)} / ${fnum(100 + s.value, l)} · 100 % = ${pctOf(l, w)}`)
        answers.push({ label: `ω(${name})`, value: w, unit: 'pct' })
        return { type: 'solubility', given: [{ label: 's', value: s.value, unit: 'g100' }], find: answers.map((a) => a.label), steps, answers }
      }
      if (rest.length === 1) {
        const q = rest[0]!
        const isW = /^\s*(г\s*)?(вод|suv|water)/iu.test(q.after)
        if (isW) {
          const m = (s.value * q.value) / 100
          steps.push((l) => `m(${name}) = s · m(H₂O) / 100 = ${fnum(s.value, l)} · ${fnum(q.value, l)} / 100 = ${fnum(m, l)} ${unitLabel('g', l)}`)
          answers.push({ label: `m(${name})`, value: m, unit: 'g' })
        } else {
          const m = (q.value * s.value) / (100 + s.value)
          steps.push((l) => `m(${name}) = m(${L(l, 'р-ра', 'eritma', 'solution')}) · s / (100 + s) = ${fnum(q.value, l)} · ${fnum(s.value, l)} / ${fnum(100 + s.value, l)} = ${fnum(m, l)} ${unitLabel('g', l)}`)
          steps.push((l) => `m(H₂O) = ${fnum(q.value, l)} − ${fnum(m, l)} = ${fnum(q.value - m, l)} ${unitLabel('g', l)}`)
          answers.push({ label: `m(${name})`, value: m, unit: 'g' }, { label: 'm(H₂O)', value: q.value - m, unit: 'g' })
        }
        return { type: 'solubility', given: [{ label: 's', value: s.value, unit: 'g100' }, { label: 'm', value: q.value, unit: 'g' }], find: answers.map((a) => a.label), steps, answers }
      }
      return null
    }
    // «в 50 г воды растворили 18 г соли (насыщенный)» → s
    if (masses.length === 2) {
      const w = masses.find((q) => /^\s*(г\s*)?(вод|suv|water)/iu.test(q.after))
      const s = masses.find((q) => q !== w)
      if (!w || !s) return null
      const k = (s.value / w.value) * 100
      steps.push((l) => `s = m(${name}) / m(H₂O) · 100 = ${fnum(s.value, l)} / ${fnum(w.value, l)} · 100 = ${fnum(k, l)} ${unitLabel('g100', l)}`)
      answers.push({ label: 's', value: k, unit: 'g100' })
      return { type: 'solubility', given: [{ label: `m(${name})`, value: s.value, unit: 'g' }, { label: 'm(H₂O)', value: w.value, unit: 'g' }], find: ['s'], steps, answers }
    }
    return null
  },
}

// ---------------------------------------------------------------- кристаллогидраты
const crystalHydrate: Solver = {
  id: 'crystal_hydrate',
  priority: 28,
  solve(ctx) {
    const f = findFormulas(ctx.text, false).find((x) => /\*\d*H2O$/.test(x.ascii))
    if (!f) return null
    const hm = f.ascii.match(/^(.*)\*(\d*)H2O$/)!
    const anhAscii = hm[1]!
    const k = Number(hm[2] || 1)
    const anh = findFormulas(anhAscii, true)[0]
    if (!anh) return null
    const Mh = molarMass(f.counts, 'school')
    const Ma = molarMass(anh.counts, 'school')
    if (Mh == null || Ma == null) return null
    const masses = ctx.qs.filter((q) => q.unit === 'g')
    const pcts = ctx.qs.filter((q) => q.unit === 'pct')
    const steps: Line[] = [molarMassLine(f.pretty, f.counts)]
    const answers: CalcValue[] = []
    if (!masses.length && !pcts.length && /(массов\p{L}* дол|ω|mass fraction|massa ulush)/iu.test(ctx.cmp)) {
      const w = ((k * 18) / Mh) * 100
      steps.push((l) => `ω(H₂O) = ${k}·18 / ${fnum(Mh, l, 'M')} · 100 % = ${pctOf(l, w)}`)
      answers.push({ label: 'ω(H₂O)', value: w, unit: 'pct' })
      return { type: 'crystal_hydrate', given: [], find: ['ω(H₂O)'], steps, answers }
    }
    if (masses.length === 1 && pcts.length === 1 && SOL.test(ctx.cmp)) {
      const m = masses[0]!.value
      const w = pcts[0]!.value
      const mA = (m * w) / 100
      const mH = (mA * Mh) / Ma
      steps.push(molarMassLine(anh.pretty, anh.counts))
      steps.push((l) => `m(${anh.pretty}) = ${fnum(m, l)} · ${fnum(w / 100, l)} = ${fnum(mA, l)} ${unitLabel('g', l)}`)
      steps.push((l) => `m(${f.pretty}) = ${fnum(mA, l)} · ${fnum(Mh, l, 'M')} / ${fnum(Ma, l, 'M')} = ${fnum(mH, l)} ${unitLabel('g', l)}`)
      steps.push((l) => `m(H₂O) = ${fnum(m, l)} − ${fnum(mH, l)} = ${fnum(m - mH, l)} ${unitLabel('g', l)}`)
      answers.push({ label: `m(${f.pretty})`, value: mH, unit: 'g' }, { label: 'm(H₂O)', value: m - mH, unit: 'g' })
      return { type: 'crystal_hydrate', given: [{ label: L(ctx.lang, 'm(р-ра)', 'm(eritma)', 'm(solution)'), value: m, unit: 'g' }, { label: `ω(${anh.pretty})`, value: w, unit: 'pct' }], find: answers.map((a) => a.label), steps, answers }
    }
    return null
  },
}

export const SOLUTION_SOLVERS: Solver[] = [solutionMassFraction, molarity, solubility, crystalHydrate]
export { pretty }
