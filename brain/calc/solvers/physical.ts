/**
 * Решатели «физхимия»: pV = nRT и приведение к н. у., законы Фарадея, скорость (Вант-Гофф, v = Δc/Δt),
 * степень диссоциации, эквиваленты (M_E вещества, закон эквивалентов через 11,2 л H₂), жёсткость воды.
 */
import { F, P0_KPA, R, T0, VEQ_H2 } from '../constants.ts'
import { L, fnum, molarMassLine, unitLabel, type CalcValue, type Line } from '../format.ts'
import { isAmount, labeled, type Ctx, type Species } from '../parse.ts'
import type { Solver } from '../registry.ts'
import { GASES, Mof } from './common.ts'
import { eqFactor } from './solutions.ts'

// ---------------------------------------------------------------- pV = nRT
const clapeyron: Solver = {
  id: 'clapeyron',
  priority: 32,
  solve(ctx) {
    const p = ctx.qs.find((q) => q.unit === 'kPa')
    const T = ctx.qs.find((q) => q.unit === 'K')
    if (!p || !T) return null
    const vols = ctx.qs.filter((q) => q.unit === 'l')
    const masses = ctx.qs.filter((q) => q.unit === 'g')
    const mols = ctx.qs.filter((q) => q.unit === 'mol')
    const sp: Species | undefined = ctx.species.find((s) => GASES.has(s.ascii))
    const steps: Line[] = []
    const given: CalcValue[] = [
      { label: 'p', value: p.value, unit: 'kPa' },
      { label: 'T', value: T.value, unit: 'K', kind: 'int' },
    ]
    const tLine: Line = (l) => (T.rawUnit === '°C' ? `T = ${fnum(T.raw, l)} + 273 = ${fnum(T.value, l)} ${unitLabel('K', l)}` : '')
    if (T.rawUnit === '°C') steps.push(tLine)
    if (p.rawUnit !== 'kPa' && p.rawUnit !== 'кПа') steps.push((l) => `p = ${fnum(p.value, l)} ${unitLabel('kPa', l)}`)
    const answers: CalcValue[] = []
    const wantNU = /(н\.\s*у|нормальн\p{L}* услов|n\.\s*sh|normal sharoit|stp|standard (conditions|temperature))/iu.test(ctx.cmp)
    if (vols.length === 1 && wantNU && !masses.length && !mols.length) {
      const V = vols[0]!.value
      const V0 = (p.value * V * T0) / (P0_KPA * T.value)
      given.push({ label: 'V', value: V, unit: 'l' })
      steps.push((l) => `V₀ = p·V·T₀ / (p₀·T) = ${fnum(p.value, l)} · ${fnum(V, l)} · 273 / (${l === 'en' ? '101.325' : '101,325'} · ${fnum(T.value, l)}) = ${fnum(V0, l)} ${unitLabel('l', l)}`)
      answers.push({ label: 'V₀', value: V0, unit: 'l' })
      return { type: 'clapeyron', given, find: ['V₀'], steps, answers }
    }
    if (vols.length === 1 && !masses.length && !mols.length) {
      const V = vols[0]!.value
      const n = (p.value * V) / (R * T.value)
      given.push({ label: 'V', value: V, unit: 'l' })
      steps.push((l) => `n = pV / RT = ${fnum(p.value, l)} · ${fnum(V, l)} / (${l === 'en' ? '8.314' : '8,314'} · ${fnum(T.value, l)}) = ${fnum(n, l)} ${unitLabel('mol', l)}`)
      if (ctx.ask.kinds.includes('mass') && sp) {
        const M = Mof(sp)!
        steps.push(molarMassLine(sp.pretty, sp.counts))
        steps.push((l) => `m = n · M = ${fnum(n, l)} · ${fnum(M, l, 'M')} = ${fnum(n * M, l)} ${unitLabel('g', l)}`)
        answers.push({ label: `m(${sp.pretty})`, value: n * M, unit: 'g' })
      } else answers.push({ label: 'n', value: n, unit: 'mol' })
      return { type: 'clapeyron', given, find: answers.map((a) => a.label), steps, answers }
    }
    if (!vols.length && (masses.length === 1 || mols.length === 1)) {
      let n: number
      if (mols.length) {
        n = mols[0]!.value
        given.push({ label: 'n', value: n, unit: 'mol' })
      } else {
        if (!sp) return null
        const M = Mof(sp)!
        const m = masses[0]!.value
        n = m / M
        given.push({ label: `m(${sp.pretty})`, value: m, unit: 'g' })
        steps.push(molarMassLine(sp.pretty, sp.counts))
        steps.push((l) => `n = m / M = ${fnum(m, l)} / ${fnum(M, l, 'M')} = ${fnum(n, l)} ${unitLabel('mol', l)}`)
      }
      const V = (n * R * T.value) / p.value
      steps.push((l) => `V = nRT / p = ${fnum(n, l)} · ${l === 'en' ? '8.314' : '8,314'} · ${fnum(T.value, l)} / ${fnum(p.value, l)} = ${fnum(V, l)} ${unitLabel('l', l)}`)
      answers.push({ label: `V${sp ? `(${sp.pretty})` : ''}`, value: V, unit: 'l' })
      return { type: 'clapeyron', given, find: answers.map((a) => a.label), steps, answers }
    }
    return null
  },
}

// ---------------------------------------------------------------- законы Фарадея
const ZGAS: Record<string, number> = { H2: 2, O2: 4, Cl2: 2 }
const METAL_Z: Record<string, number> = { Ag: 1, Na: 1, K: 1, Cu: 2, Zn: 2, Ni: 2, Fe: 2, Pb: 2, Sn: 2, Cd: 2, Mg: 2, Ca: 2, Al: 3, Cr: 3, Au: 3 }

function zOf(target: Species, ctx: Ctx): number | null {
  if (ZGAS[target.ascii]) return ZGAS[target.ascii]!
  const els = Object.keys(target.counts)
  if (els.length !== 1) return null
  const m = els[0]!
  // заряд иона из соли в условии: CuSO₄ → Cu²⁺ (z = 2), AgNO₃ → 1, FeCl₃ → 3
  const salt = ctx.species.find((s) => s !== target && s.counts[m] && Object.keys(s.counts).length > 1)
  if (salt) {
    const z = eqFactor(salt)
    const ANION: Record<string, number> = { Cl: 1, Br: 1, I: 1, NO3: 1, SO4: 2, CO3: 2, PO4: 3 }
    const an = Object.keys(ANION).find((a) => salt.ascii.includes(a))
    if (an) {
      const cnt = salt.ascii.match(new RegExp(`(?:\\(${an}\\)(\\d))|(?:${an}(\\d)?)$`))
      const nAn = Number(cnt?.[1] ?? cnt?.[2] ?? 1)
      return (ANION[an]! * nAn) / salt.counts[m]!
    }
    if (z) return z / salt.counts[m]!
  }
  return METAL_Z[m] ?? null
}

const faraday: Solver = {
  id: 'electrolysis_faraday',
  priority: 34,
  solve(ctx) {
    const I = ctx.qs.find((q) => q.unit === 'A')
    const t = ctx.qs.find((q) => q.unit === 's')
    const Qc = ctx.qs.find((q) => q.unit === 'coul')
    if (!((I && t) || Qc)) return null
    const target = ctx.species.find((s) => s.index >= ctx.ask.index && (ZGAS[s.ascii] || Object.keys(s.counts).length === 1)) ?? ctx.species.find((s) => Object.keys(s.counts).length === 1 && !ZGAS[s.ascii])
    if (!target) return null
    const z = zOf(target, ctx)
    const M = Mof(target)
    if (!z || M == null) return null
    const q = Qc ? Qc.value : I!.value * t!.value
    const steps: Line[] = []
    const given: CalcValue[] = Qc ? [{ label: 'Q', value: Qc.value, unit: 'C' }] : [{ label: 'I', value: I!.value, unit: 'A' }, { label: 't', value: t!.value, unit: 's', kind: 'int' }]
    if (!Qc && t!.rawUnit !== 'с' && t!.rawUnit !== 's') steps.push((l) => `t = ${fnum(t!.raw, l)} ${t!.rawUnit} = ${fnum(t!.value, l)} ${unitLabel('s', l)}`)
    steps.push(molarMassLine(target.pretty, target.counts))
    const m = (M * q) / (z * F)
    steps.push((l) => `m = M · I · t / (z · F) = ${fnum(M, l, 'M')} · ${Qc ? fnum(q, l) : `${fnum(I!.value, l)} · ${fnum(t!.value, l)}`} / (${z} · 96500) = ${fnum(m, l)} ${unitLabel('g', l)}`)
    const answers: CalcValue[] = []
    if (ZGAS[target.ascii] && ctx.ask.kinds.includes('volume')) {
      const V = (m / M) * 22.4
      steps.push((l) => `V = m / M · 22,4 = ${fnum(m, l)} / ${fnum(M, l, 'M')} · ${l === 'en' ? '22.4' : '22,4'} = ${fnum(V, l)} ${unitLabel('l', l)}`.replace('22,4 =', l === 'en' ? '22.4 =' : '22,4 ='))
      answers.push({ label: `V(${target.pretty})`, value: V, unit: 'l' })
    } else answers.push({ label: `m(${target.pretty})`, value: m, unit: 'g' })
    return { type: 'electrolysis_faraday', given, find: answers.map((a) => a.label), steps, answers }
  },
}

// ---------------------------------------------------------------- скорость реакции
const rate: Solver = {
  id: 'reaction_rate',
  priority: 31,
  solve(ctx) {
    const gamma = labeled(ctx.text, /(?:γ|гамма|температурн\p{L}* коэффициент\p{L}*(?:\s+скорости)?(?:\s+реакции)?|temperatura koeffitsiyenti|temperature coefficient)\s*(?:равен|=|—|-|:)?\s*(\d+(?:[.,]\d+)?)/iu)
    const temps = ctx.qs.filter((q) => q.unit === 'K')
    if (gamma != null && temps.length === 2) {
      const [t1, t2] = temps as [typeof temps[0], typeof temps[0]]
      const dt = t2.value - t1.value
      const k = gamma ** (dt / 10)
      const steps: Line[] = [(l) => `v₂ / v₁ = γ^((t₂ − t₁)/10) = ${fnum(gamma, l)}^(${fnum(dt, l)}/10) = ${fnum(k, l)}`]
      return {
        type: 'reaction_rate',
        given: [{ label: 'γ', value: gamma, unit: 'none' }, { label: 't₁', value: t1.raw, unit: t1.rawUnit === '°C' ? 'degC' : 'K', kind: 'int' }, { label: 't₂', value: t2.raw, unit: t2.rawUnit === '°C' ? 'degC' : 'K', kind: 'int' }],
        find: ['v₂/v₁'],
        steps,
        answers: [{ label: 'v₂/v₁', value: k, unit: 'times' }],
      }
    }
    const cs = ctx.qs.filter((q) => q.unit === 'M')
    const t = ctx.qs.find((q) => q.unit === 's')
    if (cs.length === 2 && t && /(скорост|tezlik|rate)/iu.test(ctx.cmp)) {
      const v = Math.abs(cs[0]!.value - cs[1]!.value) / t.value
      return {
        type: 'reaction_rate',
        given: [{ label: 'C₁', value: cs[0]!.value, unit: 'moll' }, { label: 'C₂', value: cs[1]!.value, unit: 'moll' }, { label: 'Δt', value: t.value, unit: 's', kind: 'int' }],
        find: ['v'],
        steps: [(l) => `v = |ΔC| / Δt = ${fnum(Math.abs(cs[0]!.value - cs[1]!.value), l)} / ${fnum(t.value, l)} = ${fnum(v, l)} ${L(l, 'моль/(л·с)', 'mol/(l·s)', 'mol/(L·s)')}`],
        answers: [{ label: 'v', value: v, unit: 'none' }],
      }
    }
    return null
  },
}

// ---------------------------------------------------------------- степень диссоциации
const dissociation: Solver = {
  id: 'dissociation_degree',
  priority: 29,
  solve(ctx) {
    if (!/(степен\p{L}* диссоциац|dissotsilanish darajasi|degree of dissociation|диссоциировал|распал\p{L}* на ионы|ionlarga ajral)/iu.test(ctx.cmp)) return null
    const nums = [...ctx.text.matchAll(/(?<![\w,.])(\d+(?:[.,]\d+)?)(?![\d.,]*\s*(?:%|г|g|л|l|моль|mol))/g)].map((m) => Number(m[1]!.replace(',', '.')))
    const mols = ctx.qs.filter((q) => q.unit === 'mol')
    let total: number
    let diss: number
    if (mols.length === 2) {
      ;[total, diss] = [Math.max(mols[0]!.value, mols[1]!.value), Math.min(mols[0]!.value, mols[1]!.value)]
    } else if (nums.length === 2 && !ctx.qs.some(isAmount)) {
      ;[total, diss] = [Math.max(nums[0]!, nums[1]!), Math.min(nums[0]!, nums[1]!)]
    } else return null
    if (!(total > 0) || diss > total) return null
    const a = (diss / total) * 100
    return {
      type: 'dissociation_degree',
      given: [{ label: 'N₀', value: total, unit: 'none' }, { label: L(ctx.lang, 'N(дисс.)', 'N(diss.)', 'N(diss.)'), value: diss, unit: 'none' }],
      find: ['α'],
      steps: [(l) => `α = N(${L(l, 'дисс.', 'diss.', 'diss.')}) / N₀ · 100 % = ${fnum(diss, l)} / ${fnum(total, l)} · 100 % = ${fnum(a, l, 'pct')} %`],
      answers: [{ label: 'α', value: a, unit: 'pct' }],
    }
  },
}

// ---------------------------------------------------------------- эквиваленты
const equivalent: Solver = {
  id: 'equivalent',
  priority: 36,
  solve(ctx) {
    if (!/(эквивалент|ekvivalent|equivalent)/iu.test(ctx.cmp)) return null
    const masses = ctx.qs.filter((q) => q.unit === 'g')
    const vols = ctx.qs.filter((q) => q.unit === 'l')
    // закон эквивалентов: m г металла вытесняют V л H₂ (н. у.)
    if (masses.length === 1 && vols.length === 1 && /(водород|vodorod|hydrogen|H2|H₂)/iu.test(ctx.text)) {
      const m = masses[0]!.value
      const V = vols[0]!.value
      const ME = (m * VEQ_H2) / V
      return {
        type: 'equivalent',
        given: [{ label: 'm(Me)', value: m, unit: 'g' }, { label: 'V(H₂)', value: V, unit: 'l' }],
        find: ['Mэ(Me)'],
        steps: [(l) => `Mэ = m · Vэ(H₂) / V(H₂) = ${fnum(m, l)} · ${l === 'en' ? '11.2' : '11,2'} / ${fnum(V, l)} = ${fnum(ME, l)} ${unitLabel('gmol', l)}`],
        answers: [{ label: 'Mэ', value: ME, unit: 'gmol', kind: 'amount' }],
      }
    }
    if (masses.length || vols.length) return null
    const sp = ctx.species.find((s) => Object.keys(s.counts).length > 1)
    if (!sp) return null
    const M = Mof(sp)
    let z = eqFactor(sp)
    const ks = Object.keys(sp.counts)
    // оксид: z = 2 · n(O)
    if (ks.length === 2 && sp.counts.O) z = 2 * sp.counts.O
    if (!z || M == null) return null
    return {
      type: 'equivalent',
      given: [],
      find: [`Mэ(${sp.pretty})`],
      steps: [molarMassLine(sp.pretty, sp.counts), (l) => `Mэ = M / z = ${fnum(M, l, 'M')} / ${z} = ${fnum(M / z, l)} ${unitLabel('gmol', l)}`],
      answers: [{ label: `Mэ(${sp.pretty})`, value: M / z, unit: 'gmol', kind: 'amount' }],
    }
  },
}

// ---------------------------------------------------------------- жёсткость воды
const hardness: Solver = {
  id: 'water_hardness',
  priority: 37,
  solve(ctx) {
    if (!/(жёсткост|жесткост|qattiqlik|hardness)/iu.test(ctx.cmp)) return null
    const masses = ctx.qs.filter((q) => q.unit === 'g')
    const vols = ctx.qs.filter((q) => q.unit === 'l')
    if (masses.length !== 1 || vols.length !== 1) return null
    const sp = ctx.species.find((s) => (s.counts.Ca || s.counts.Mg) && Object.keys(s.counts).length > 1) ?? ctx.species.find((s) => s.ascii === 'Ca' || s.ascii === 'Mg')
    if (!sp) return null
    const M = Mof(sp)
    const z = Object.keys(sp.counts).length === 1 ? 2 : eqFactor(sp)
    if (!z || M == null) return null
    const mg = masses[0]!.value * 1000
    const V = vols[0]!.value
    const ME = M / z
    const Zh = mg / (ME * V)
    return {
      type: 'water_hardness',
      given: [{ label: `m(${sp.pretty})`, value: mg, unit: 'none', text: `${fnum(mg, ctx.lang)} ${L(ctx.lang, 'мг', 'mg', 'mg')}` }, { label: 'V', value: V, unit: 'l' }],
      find: [L(ctx.lang, 'Ж', 'Q', 'H')],
      steps: [(l) => `Mэ(${sp.pretty}) = ${fnum(M, l, 'M')} / ${z} = ${fnum(ME, l)} ${unitLabel('gmol', l)}`, (l) => `${L(l, 'Ж', 'Q', 'H')} = m(${L(l, 'мг', 'mg', 'mg')}) / (Mэ · V) = ${fnum(mg, l)} / (${fnum(ME, l)} · ${fnum(V, l)}) = ${fnum(Zh, l)} ${unitLabel('mmolEqL', l)}`],
      answers: [{ label: L(ctx.lang, 'Ж', 'Q', 'H'), value: Zh, unit: 'mmolEqL' }],
    }
  },
}

export const PHYSICAL_SOLVERS: Solver[] = [clapeyron, faraday, rate, dissociation, equivalent, hardness]
