/**
 * Ещё шесть школьных типов задач Kimyo 8–11 (спецификация программы, «Дано → Решение → Ответ», школьные Ar):
 *   gas_mixture        — объёмные доли газов → средняя M, масса/объём/число молекул смеси, D (Kimyo 8 §25, 11 §6);
 *   equilibrium        — Kc по равновесным концентрациям «[N₂] = 0,1 моль/л» (Kimyo 11 §25–27);
 *   redox_balance      — электронный баланс полуреакциями: окислитель, восстановитель, коэффициенты (8 §20, 9 §32, 11 §28);
 *   mixture_fraction   — состав смеси по газу/воде/осадку: реагирует один компонент или оба (система 2×2) (9 §16, §37);
 *   combustion_formula — формула органического вещества по продуктам сгорания и M/D (Kimyo 10, гл. 2, тема 23–24);
 *   metal_plate        — изменение массы пластинки в растворе соли: Δm на моль реакции.
 * Каждый срабатывает только при полной уверенности, иначе null (дальше — другие решатели и старые инструменты).
 */
import { balanceEquation, extractEquation, oxidationStates } from '../../pipeline/tools.ts'
import { pretty } from '../../pipeline/entities.ts'
import { M_AIR, NA, VM, molarMass, schoolAr } from '../constants.ts'
import { L, fnum, molarMassLine, unitLabel, type CalcValue, type Line, type Solution } from '../format.ts'
import { isAmount, speciesOf, type Ctx, type Qty, type Species } from '../parse.ts'
import type { Solver } from '../registry.ts'
import { relDensity } from './basic.ts'
import { GASES, Mof, formulaOf, givenOf, na, nearInt, toMoles, vm } from './common.ts'
import { ACIDS, findEquation, salt, valence } from './reaction.ts'

type Bal = { eq: string; reactants: { formula: string; coeff: number; counts?: Record<string, number> | null; charge: number }[]; products: { formula: string; coeff: number; counts?: Record<string, number> | null; charge: number }[] }
const bal = (eq: string): Bal | null => {
  const b = balanceEquation(eq.replace(/[↑↓]/g, '').replace(/(→|⇄|⇌|=)\s*\([^)]*\)/g, '$1'))
  return b && typeof b === 'object' ? (b as unknown as Bal) : null
}
const near = (ctx: Ctx, q: { index: number; end: number }, re: RegExp, before = 45, after = 45) => re.test(ctx.text.slice(Math.max(0, q.index - before), q.end + after).toLowerCase())
const MIX_RE = /(смес\p{L}*|сплав\p{L}*|aralashma\p{L}*|qotishma\p{L}*|mixture|alloy)/iu

// ---------------------------------------------------------------- gas_mixture
const gasMixture: Solver = {
  id: 'gas_mixture',
  priority: 36,
  solve(ctx) {
    if (!MIX_RE.test(ctx.cmp) || /(массов\p{L}* дол|massa ulush|mass fraction|by mass)/iu.test(ctx.cmp)) return null
    const pcts = ctx.qs.filter((q) => q.unit === 'pct')
    if (pcts.length < 2) return null
    const parts: { sp: Species; phi: number }[] = []
    for (const p of pcts) {
      const after = ctx.species.find((s) => s.index >= p.end && s.index - p.end <= 40 && !/[\d;]/.test(ctx.text.slice(p.end, s.index)))
      const before = [...ctx.species].reverse().find((s) => s.end <= p.index && p.index - s.end <= 25 && !/[\d;]/.test(ctx.text.slice(s.end, p.index)))
      const sp = after ?? before
      if (!sp || !GASES.has(sp.ascii) || parts.some((x) => x.sp.ascii === sp.ascii)) return null
      parts.push({ sp, phi: p.value })
    }
    const sum = parts.reduce((s, x) => s + x.phi, 0)
    if (Math.abs(sum - 100) > 0.6) return null
    const steps: Line[] = []
    let Mavg = 0
    for (const x of parts) Mavg += (x.phi / 100) * Mof(x.sp)!
    steps.push((l) => `M(${L(l, 'смеси', 'aralashma', 'mixture')}) = ${parts.map((x) => `${fnum(x.phi / 100, l)}·${fnum(Mof(x.sp)!, l, 'M')}`).join(' + ')} = ${fnum(Mavg, l)} ${unitLabel('gmol', l)}`)
    const given: CalcValue[] = parts.map((x) => ({ label: `φ(${x.sp.pretty})`, value: x.phi, unit: 'pct', kind: 'exact' }))
    const answers: CalcValue[] = []
    const amounts = ctx.qs.filter(isAmount)
    if (amounts.length > 1) return null
    const mixWord = (l: Parameters<Line>[0]) => L(l, 'смеси', 'aralashma', 'mixture')
    const kinds = ctx.ask.kinds
    if (amounts.length === 1) {
      const q = amounts[0]!
      let n: number
      if (q.unit === 'l') {
        n = q.value / VM
        given.unshift({ label: `V(${mixWord(ctx.lang)})`, value: q.raw, unit: q.rawUnit === 'м³' ? 'm3' : q.rawUnit === 'мл' ? 'ml' : 'l' })
        steps.unshift((l) => `n(${mixWord(l)}) = V / Vm = ${fnum(q.value, l)} / ${vm(l)} = ${fnum(n, l)} ${unitLabel('mol', l)}`)
      } else if (q.unit === 'g') {
        n = q.value / Mavg
        given.unshift({ label: `m(${mixWord(ctx.lang)})`, value: q.value, unit: 'g' })
        steps.push((l) => `n(${mixWord(l)}) = m / M = ${fnum(q.value, l)} / ${fnum(Mavg, l)} = ${fnum(n, l)} ${unitLabel('mol', l)}`)
      } else if (q.unit === 'mol') {
        n = q.value
        given.unshift({ label: `n(${mixWord(ctx.lang)})`, value: q.value, unit: 'mol' })
      } else return null
      const ks = kinds.filter((k) => k === 'mass' || k === 'volume' || k === 'particles' || k === 'mol')
      for (const k of ks.length ? ks : [q.unit === 'g' ? 'volume' : 'mass']) {
        if (k === 'mass' && q.unit !== 'g') {
          const m = n * Mavg
          const kg = q.rawUnit === 'м³'
          steps.push((l) => `m(${mixWord(l)}) = n · M = ${fnum(n, l)} · ${fnum(Mavg, l)} = ${fnum(m, l)} ${unitLabel('g', l)}${kg ? ` = ${fnum(m / 1000, l)} ${unitLabel('kg', l)}` : ''}`)
          answers.push(kg ? { label: `m(${mixWord(ctx.lang)})`, value: m / 1000, unit: 'kg' } : { label: `m(${mixWord(ctx.lang)})`, value: m, unit: 'g' })
        } else if (k === 'volume' && q.unit !== 'l') {
          const V = n * VM
          steps.push((l) => `V(${mixWord(l)}) = n · Vm = ${fnum(n, l)} · ${vm(l)} = ${fnum(V, l)} ${unitLabel('l', l)}`)
          answers.push({ label: `V(${mixWord(ctx.lang)})`, value: V, unit: 'l' })
        } else if (k === 'particles') {
          const N = n * NA
          steps.push((l) => `N = n · Nₐ = ${fnum(n, l)} · ${na(l)} = ${fnum(N, l)}`)
          answers.push({ label: 'N', value: N, unit: 'none' })
        } else if (k === 'mol' && q.unit !== 'mol') answers.push({ label: `n(${mixWord(ctx.lang)})`, value: n, unit: 'mol' })
      }
    } else {
      const a = ctx.ask.sentence
      if (/(водород|vodorod|hydrogen)/iu.test(a) && /(плотност|zichlig|density)/iu.test(a)) {
        steps.push((l) => `D(H₂) = M / 2 = ${fnum(Mavg, l)} / 2 = ${fnum(Mavg / 2, l)}`)
        answers.push({ label: 'D(H₂)', value: Mavg / 2, unit: 'none' })
      }
      if (/(воздух|havo|\bair\b)/iu.test(a) && /(плотност|zichlig|density)/iu.test(a)) {
        steps.push((l) => `D(${L(l, 'возд.', 'havo', 'air')}) = M / 29 = ${fnum(Mavg, l)} / 29 = ${fnum(Mavg / M_AIR, l)}`)
        answers.push({ label: L(ctx.lang, 'D(возд.)', 'D(havo)', 'D(air)'), value: Mavg / M_AIR, unit: 'none' })
      }
      if (!answers.length) answers.push({ label: `M(${mixWord(ctx.lang)})`, value: Mavg, unit: 'gmol' })
    }
    if (!answers.length) return null
    return { type: 'gas_mixture', given, find: answers.map((x) => x.label), steps, answers }
  },
}

// ---------------------------------------------------------------- equilibrium: Kc
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const NUMS = String.raw`(\d+(?:[.,]\d+)?)`

const equilibrium: Solver = {
  id: 'equilibrium',
  priority: 37,
  solve(ctx) {
    if (!/(равновес|muvozanat|equilibri)/iu.test(ctx.cmp) || !/(констант|konstanta|constant|\bk\s*[cс]?\b|kc)/iu.test(ctx.cmp)) return null
    const eqText = extractEquation(ctx.text)
    if (!eqText) return null
    const b = bal(eqText)
    if (!b) return null
    const conc = (f: string): number | null => {
      const forms = [...new Set([f, pretty(f)])].map(reEsc).join('|')
      const m = ctx.text.match(new RegExp(String.raw`(?:\[\s*(?:${forms})\s*\]|\bC\s*\(\s*(?:${forms})\s*\))\s*(?:равн\p{L}*|=|:|—|-)?\s*${NUMS}`, 'u'))
      return m ? Number(m[1]!.replace(',', '.')) : null
    }
    const all = [...b.reactants, ...b.products]
    const c: Record<string, number> = {}
    for (const s of all) {
      const v = conc(s.formula)
      if (v == null || v <= 0) return null
      c[s.formula] = v
    }
    const prod = (list: Bal['products']) => list.reduce((p, s) => p * c[s.formula]! ** s.coeff, 1)
    const K = prod(b.products) / prod(b.reactants)
    const term = (list: Bal['products'], l: Parameters<Line>[0]) => list.map((s) => `[${pretty(s.formula)}]${s.coeff > 1 ? (s.coeff === 2 ? '²' : s.coeff === 3 ? '³' : `^${s.coeff}`) : ''}`).join(' · ') + (l ? '' : '')
    const vals = (list: Bal['products'], l: Parameters<Line>[0]) => list.map((s) => `${fnum(c[s.formula]!, l)}${s.coeff > 1 ? (s.coeff === 2 ? '²' : s.coeff === 3 ? '³' : `^${s.coeff}`) : ''}`).join(' · ')
    const steps: Line[] = [
      () => b.eq,
      (l) => `Kc = ${term(b.products, l)} / (${term(b.reactants, l)})`,
      (l) => `Kc = ${vals(b.products, l)} / (${vals(b.reactants, l)}) = ${fnum(K, l)}`,
    ]
    const given: CalcValue[] = all.map((s) => ({ label: `[${pretty(s.formula)}]`, value: c[s.formula]!, unit: 'moll' }))
    return { type: 'equilibrium', given, find: ['Kc'], steps, answers: [{ label: 'Kc', value: K, unit: 'none' }], equation: b.eq }
  },
}

// ---------------------------------------------------------------- redox_balance: электронный баланс
const SUPD: Record<string, string> = { '+': '⁺', '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
const ox = (el: string, v: number) => `${el}${[...(v > 0 ? `+${v}` : v < 0 ? `-${-v}` : '0')].map((ch) => SUPD[ch] ?? ch).join('')}`
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
/** Степени окисления: общий расчёт tools.ts, а для солей кислородных кислот (Cr₂(SO₄)₃, Cu(NO₃)₂, Ca₃(PO₄)₂) — анион целиком. */
const ANION_OX: [string, number, number][] = [['S', 4, 6], ['N', 3, 5], ['P', 4, 5], ['C', 3, 4]]
function oxStates(ctx: Ctx, f: string, counts: Record<string, number>, charge: number): Record<string, number> | null {
  const r = oxidationStates(f, counts, charge, ctx.kb)
  if (r && !r.average.size) return r.states
  const els = Object.keys(counts)
  if (els.length !== 3 || !counts.O) return null
  for (const [x, o, st] of ANION_OX) {
    if (!counts[x] || counts.O !== o * counts[x]!) continue
    const m = els.find((e) => e !== x && e !== 'O')!
    const v = (charge - st * counts[x]! + 2 * counts.O) / counts[m]!
    if (!Number.isInteger(v) || v <= 0 || v > 8) return null
    return { [m]: v, [x]: st, O: -2 }
  }
  return null
}

const REDOX_RE = /(электронн\p{L}* баланс|окислител|восстановител|овр|окислительно-восстановительн|полуреакц|elektron balans|oksidlovchi|qaytaruvchi|oksidlanish-qaytarilish|electron(ic)? balance|oxidi[sz]ing agent|reducing agent|half-reaction|redox)/iu

const redoxBalance: Solver = {
  id: 'redox_balance',
  priority: 38,
  solve(ctx) {
    if (!REDOX_RE.test(ctx.cmp)) return null
    const eqText = extractEquation(ctx.text)
    if (!eqText) return null
    const b = bal(eqText)
    if (!b) return null
    // степени окисления каждого элемента в каждом веществе
    type Occ = { formula: string; side: 'l' | 'r'; el: string; st: number; atoms: number }
    const occ: Occ[] = []
    for (const [side, list] of [['l', b.reactants], ['r', b.products]] as const) {
      for (const s of list) {
        if (!s.counts) return null
        const st = oxStates(ctx, s.formula, s.counts, s.charge)
        if (!st) return null
        for (const el of Object.keys(s.counts)) occ.push({ formula: s.formula, side, el, st: st[el]!, atoms: s.counts[el]! })
      }
    }
    // k — атомов элемента в полуреакции: простое вещество задаёт его (O₂ → 2, Al → 1), иначе больше из двух (Cr₂O₇²⁻/Cr₂(SO₄)₃ → 2)
    type Change = { el: string; from: number; to: number; fromF: string; toF: string; k: number; simpleFrom: boolean; simpleTo: boolean }
    const changes: Change[] = []
    for (const el of new Set(occ.map((o) => o.el))) {
      const Ls = [...new Set(occ.filter((o) => o.el === el && o.side === 'l').map((o) => o.st))]
      const Rs = [...new Set(occ.filter((o) => o.el === el && o.side === 'r').map((o) => o.st))]
      const fresh = Rs.filter((x) => !Ls.includes(x))
      if (!fresh.length) continue
      const gone = Ls.filter((x) => !Rs.includes(x))
      const from = Ls.length === 1 ? Ls[0]! : gone.length === 1 ? gone[0]! : null
      if (from == null || fresh.length !== 1) return null
      const to = fresh[0]!
      const fromO = occ.find((o) => o.el === el && o.side === 'l' && o.st === from)!
      const toO = occ.find((o) => o.el === el && o.side === 'r' && o.st === to)!
      const sf = from === 0 && occ.filter((o) => o.formula === fromO.formula).length === 1
      const stt = to === 0 && occ.filter((o) => o.formula === toO.formula).length === 1
      const k = sf ? fromO.atoms : stt ? toO.atoms : Math.max(fromO.atoms, toO.atoms)
      changes.push({ el, from, to, fromF: fromO.formula, toF: toO.formula, k, simpleFrom: sf, simpleTo: stt })
    }
    if (changes.length !== 2) return null
    const red = changes.find((c) => c.to > c.from) // отдаёт e⁻ — восстановитель
    const oxi = changes.find((c) => c.to < c.from) // принимает e⁻ — окислитель
    if (!red || !oxi) return null
    const eRed = red.k * (red.to - red.from)
    const eOx = oxi.k * (oxi.from - oxi.to)
    const lcm = (eRed * eOx) / gcd(eRed, eOx)
    const kPre = (k: number) => (k > 1 ? `${k}` : '')
    const SUBN = '₀₁₂₃₄₅₆₇₈₉'
    const atom = (c: Change, st: number, simple: boolean) => (simple && c.k > 1 ? `${c.el}${[...String(c.k)].map((d) => SUBN[Number(d)]).join('')}⁰` : `${kPre(c.k)}${ox(c.el, st)}`)
    const half = (c: Change, e: number, sign: '+' | '−') => `${atom(c, c.from, c.simpleFrom)} ${sign} ${e}e⁻ → ${atom(c, c.to, c.simpleTo)}`
    const steps: Line[] = [
      (l) => `${L(l, 'степени окисления меняют', 'oksidlanish darajasini oʻzgartiradi', 'oxidation states change')}: ${ox(red.el, red.from)} → ${ox(red.el, red.to)}, ${ox(oxi.el, oxi.from)} → ${ox(oxi.el, oxi.to)}`,
      (l) => `${half(red, eRed, '−')} | ×${lcm / eRed} — ${L(l, 'окисление', 'oksidlanish', 'oxidation')}`,
      (l) => `${half(oxi, eOx, '+')} | ×${lcm / eOx} — ${L(l, 'восстановление', 'qaytarilish', 'reduction')}`,
      (l) => `${L(l, 'уравнение', 'tenglama', 'equation')}: ${b.eq}`,
    ]
    const answers: CalcValue[] = [
      { label: L(ctx.lang, 'окислитель', 'oksidlovchi', 'oxidising agent'), value: 0, unit: 'none', text: pretty(oxi.fromF) },
      { label: L(ctx.lang, 'восстановитель', 'qaytaruvchi', 'reducing agent'), value: 0, unit: 'none', text: pretty(red.fromF) },
      { label: '', value: 0, unit: 'none', text: b.eq },
    ]
    return { type: 'redox_balance', given: [], find: [L(ctx.lang, 'коэффициенты', 'koeffitsientlar', 'coefficients')], steps, answers, equation: b.eq }
  },
}

// ---------------------------------------------------------------- mixture_fraction: состав смеси
const INCR = /(увелич\p{L}*|возросл\p{L}*|тяжелее|ortdi|oshdi|ko['ʻ’]paydi|increased|heavier)/iu
const DECR = /(уменьш\p{L}*|легче|kamaydi|yengillashdi|decreased|lighter)/iu

const mixtureFraction: Solver = {
  id: 'mixture_fraction',
  priority: 39,
  solve(ctx) {
    if (!MIX_RE.test(ctx.cmp)) return null
    if (!/(дол|состав|ulush|tarkib|fraction|composition|percent|процент|foiz|масс\p{L}* (каждого|компонент)|massasini)/iu.test(ctx.ask.sentence)) return null
    const amounts = ctx.qs.filter(isAmount)
    if (amounts.length !== 2 || ctx.qs.some((q) => q.unit === 'pct')) return null
    const mixQ = amounts.find((q) => q.unit === 'g' && near(ctx, q, MIX_RE, 30, 40))
    if (!mixQ) return null
    const prodQ = amounts.find((q) => q !== mixQ)!
    const product = speciesOf(prodQ, ctx.species, ctx.text) ?? ctx.species.find((s) => s.index >= prodQ.end && s.index - prodQ.end <= 40) ?? null
    if (!product) return null
    // компоненты: два разных вещества рядом с «смесь … массой …» (до или после; не продукт и не кислота)
    const comps = [...new Map(ctx.species.filter((s) => s.index > mixQ.index - 40 && s.index - mixQ.end < 90 && s.ascii !== product.ascii && !ACIDS[s.ascii]).map((s) => [s.ascii, s])).values()].slice(0, 2)
    if (comps.length !== 2) return null
    const k: number[] = []
    let eqs: string[] = []
    for (const c of comps) {
      const b = findEquation(ctx, [c, product], { reactant: c.ascii, product: product.ascii })
      const rc = b?.reactants.find((s) => s.formula === c.ascii)
      const pp = b?.products.find((s) => s.formula === product.ascii)
      if (b && rc && pp && !b.reactants.some((s) => comps.some((o) => o !== c && o.ascii === s.formula))) {
        k.push(pp.coeff / rc.coeff)
        eqs.push(b.eq)
      } else k.push(0)
    }
    eqs = [...new Set(eqs)]
    if (!eqs.length) return null
    const steps: Line[] = eqs.map((e) => () => e)
    const nP = toMoles({ ...prodQ }, product, steps)
    if (nP == null) return null
    const M1 = Mof(comps[0]!)!
    const M2 = Mof(comps[1]!)!
    const m = mixQ.value
    let m1: number
    if (k[0]! > 0 && k[1]! > 0) {
      // оба компонента дают продукт: x·M₁ + y·M₂ = m; k₁x + k₂y = n
      const det = M1 * k[1]! - M2 * k[0]!
      if (Math.abs(det) < 1e-9) return null
      const x = (m * k[1]! - M2 * nP) / det
      const y = (M1 * nP - k[0]! * m) / det
      if (x < -1e-9 || y < -1e-9) return null
      m1 = x * M1
      const kx = (v: number, l: Parameters<Line>[0]) => (v === 1 ? '' : fnum(v, l))
      steps.push((l) => `x = n(${comps[0]!.pretty}), y = n(${comps[1]!.pretty}): ${fnum(M1, l, 'M')}x + ${fnum(M2, l, 'M')}y = ${fnum(m, l)}; ${kx(k[0]!, l)}x + ${kx(k[1]!, l)}y = ${fnum(nP, l)}`)
      steps.push((l) => `x = ${fnum(x, l)} ${unitLabel('mol', l)}, y = ${fnum(y, l)} ${unitLabel('mol', l)}`)
    } else {
      const i = k[0]! > 0 ? 0 : 1
      const c = comps[i]!
      const n = nP / k[i]!
      const mc = n * Mof(c)!
      m1 = i === 0 ? mc : m - mc
      steps.push(molarMassLine(c.pretty, c.counts))
      steps.push((l) => `n(${c.pretty}) = ${fnum(nP, l)} / ${fnum(k[i]!, l)} = ${fnum(n, l)} ${unitLabel('mol', l)}; m(${c.pretty}) = ${fnum(n, l)} · ${fnum(Mof(c)!, l, 'M')} = ${fnum(mc, l)} ${unitLabel('g', l)}`)
    }
    if (m1 < -1e-9 || m1 > m + 1e-9) return null
    const m2 = m - m1
    steps.push((l) => `m(${comps[0]!.pretty}) = ${fnum(m1, l)} ${unitLabel('g', l)}; m(${comps[1]!.pretty}) = ${fnum(m, l)} − ${fnum(m1, l)} = ${fnum(m2, l)} ${unitLabel('g', l)}`)
    steps.push((l) => `ω = m / m(${L(l, 'смеси', 'aralashma', 'mixture')}) · 100 %`)
    const given: CalcValue[] = [{ label: L(ctx.lang, 'm(смеси)', 'm(aralashma)', 'm(mixture)'), value: m, unit: 'g' }, givenOf(prodQ, product)]
    const answers: CalcValue[] = [
      { label: `ω(${comps[0]!.pretty})`, value: (m1 / m) * 100, unit: 'pct' },
      { label: `ω(${comps[1]!.pretty})`, value: (m2 / m) * 100, unit: 'pct' },
    ]
    return { type: 'mixture_fraction', given, find: answers.map((a) => a.label), steps, answers }
  },
}

// ---------------------------------------------------------------- combustion_formula: формула по продуктам сгорания
const BURN_RE = /(сжиг\p{L}*|сгоран\p{L}*|сгорел\p{L}*|горени\p{L}*|сожгли|yonish\p{L}*|yondiril\p{L}*|yondi\p{L}*|burn\p{L}*|combust\p{L}*)/iu

const combustionFormula: Solver = {
  id: 'combustion_formula',
  priority: 42,
  solve(ctx) {
    if (!BURN_RE.test(ctx.cmp) || !/(формул|formula)/iu.test(ctx.cmp)) return null
    const amounts = ctx.qs.filter(isAmount)
    let co2: Qty | null = null
    let h2o: Qty | null = null
    let n2: Qty | null = null
    let sub: Qty | null = null
    for (const q of amounts) {
      const sp = speciesOf(q, ctx.species, ctx.text)
      if (sp?.ascii === 'CO2' && !co2) co2 = q
      else if (sp?.ascii === 'H2O' && !h2o) h2o = q
      else if (sp?.ascii === 'N2' && !n2) n2 = q
      else if (q.unit === 'g' && !sub) sub = q
      else return null
    }
    if (!co2 || !h2o) return null
    const steps: Line[] = []
    const nC = co2.unit === 'l' ? co2.value / VM : co2.unit === 'g' ? co2.value / 44 : co2.unit === 'mol' ? co2.value : NaN
    const nH = 2 * (h2o.unit === 'g' ? h2o.value / 18 : h2o.unit === 'mol' ? h2o.value : NaN)
    const nN = n2 ? 2 * (n2.unit === 'l' ? n2.value / VM : n2.unit === 'g' ? n2.value / 28 : n2.unit === 'mol' ? n2.value : NaN) : 0
    if (!Number.isFinite(nC) || !Number.isFinite(nH) || !Number.isFinite(nN)) return null
    steps.push((l) => `n(C) = n(CO₂) = ${co2!.unit === 'l' ? `${fnum(co2!.value, l)} / ${vm(l)}` : co2!.unit === 'g' ? `${fnum(co2!.value, l)} / 44` : fnum(co2!.value, l)} = ${fnum(nC, l)} ${unitLabel('mol', l)}; m(C) = ${fnum(nC, l)} · 12 = ${fnum(nC * 12, l)} ${unitLabel('g', l)}`)
    steps.push((l) => `n(H) = 2 · n(H₂O) = 2 · ${h2o!.unit === 'g' ? `${fnum(h2o!.value, l)} / 18` : fnum(h2o!.value, l)} = ${fnum(nH, l)} ${unitLabel('mol', l)}; m(H) = ${fnum(nH, l)} ${unitLabel('g', l)}`)
    if (n2) steps.push((l) => `n(N) = 2 · n(N₂) = ${fnum(nN, l)} ${unitLabel('mol', l)}; m(N) = ${fnum(nN * 14, l)} ${unitLabel('g', l)}`)
    let nO = 0
    if (sub) {
      const mO = sub.value - nC * 12 - nH - nN * 14
      if (mO < -0.02 * sub.value) return null
      if (mO > 0.01 * sub.value) {
        nO = mO / 16
        steps.push((l) => `m(O) = ${fnum(sub!.value, l)} − ${fnum(nC * 12, l)} − ${fnum(nH, l)}${n2 ? ` − ${fnum(nN * 14, l)}` : ''} = ${fnum(mO, l)} ${unitLabel('g', l)}; n(O) = ${fnum(mO, l)} / 16 = ${fnum(nO, l)} ${unitLabel('mol', l)}`)
      } else steps.push((l) => `m(C) + m(H)${n2 ? ' + m(N)' : ''} = ${fnum(sub!.value, l)} ${unitLabel('g', l)} — ${L(l, 'кислорода в веществе нет', 'moddada kislorod yoʻq', 'there is no oxygen in the compound')}`)
    }
    const raw: Record<string, number> = { C: nC, H: nH }
    if (nN > 0) raw.N = nN
    if (nO > 0) raw.O = nO
    const min = Math.min(...Object.values(raw))
    let counts: Record<string, number> | null = null
    for (let f = 1; f <= 6 && !counts; f++) {
      const c: Record<string, number> = {}
      let ok = true
      for (const [el, v] of Object.entries(raw)) {
        const x = (v / min) * f
        if (!nearInt(x, 0.1)) ok = false
        c[el] = Math.round(x)
      }
      if (ok) counts = c
    }
    if (!counts) return null
    const order = ['C', 'H', 'N', 'O']
    const simple = formulaOf(counts, order)
    const Ms = molarMass(counts, 'school')!
    steps.push((l) => `${Object.keys(raw).join(' : ')} = ${Object.values(raw).map((v) => fnum(v, l)).join(' : ')} = ${Object.values(counts!).join(' : ')} → ${simple}, M = ${fnum(Ms, l, 'M')} ${unitLabel('gmol', l)}`)
    const given: CalcValue[] = []
    if (sub) given.push({ label: L(ctx.lang, 'm(в-ва)', 'm(modda)', 'm(compound)'), value: sub.value, unit: 'g' })
    given.push(givenOf(co2, { ascii: 'CO2', pretty: 'CO₂', counts: { C: 1, O: 2 }, index: 0, end: 0, charge: 0 }), givenOf(h2o, { ascii: 'H2O', pretty: 'H₂O', counts: { H: 2, O: 1 }, index: 0, end: 0, charge: 0 }))
    const rel = relDensity(ctx.text, ctx.lang)
    const Mq = ctx.qs.find((q) => q.unit === 'gmol')?.value ?? null
    const Mtrue = rel?.M ?? Mq
    let final = counts
    if (Mtrue != null) {
      const f = Math.round(Mtrue / Ms)
      if (f < 1 || Math.abs(Mtrue / Ms - f) > 0.06) return null
      if (rel) (steps.push(rel.line), given.push(rel.given))
      final = Object.fromEntries(Object.entries(counts).map(([e, x]) => [e, x * f]))
      steps.push((l) => `k = ${fnum(Mtrue, l, 'M')} / ${fnum(Ms, l, 'M')} = ${f}`)
    } else if (!sub) return null
    const formula = formulaOf(final, order)
    return { type: 'combustion_formula', given, find: [L(ctx.lang, 'формула', 'formula', 'formula')], steps, answers: [{ label: '', value: 0, unit: 'none', text: formula }] }
  },
}

// ---------------------------------------------------------------- metal_plate: пластинка в растворе соли
const PLATE_METAL: [RegExp, string][] = [
  [/^(железн|temir|iron)/u, 'Fe'], [/^(цинк|rux|zinc)/u, 'Zn'], [/^(медн|mis$|copper)/u, 'Cu'], [/^(алюмини|alyumin|alumin)/u, 'Al'],
  [/^(никел|nikel|nickel)/u, 'Ni'], [/^(свинц|qo.rg.oshin|lead)/u, 'Pb'], [/^(магни|magni)/u, 'Mg'], [/^(олов|qalay|tin)/u, 'Sn'],
]
const PLATE_RE = /(пластин\p{L}*|plastin\p{L}*|plate|стерж\p{L}*|гвозд\p{L}*|mix\b|nail|rod)/iu

const metalPlate: Solver = {
  id: 'metal_plate',
  priority: 43,
  solve(ctx) {
    if (!PLATE_RE.test(ctx.cmp)) return null
    const saltSp = ctx.species.find((s) => {
      const ks = Object.keys(s.counts)
      return ks.length >= 2 && ks.some((e) => valence(e) != null || e === 'Ag' || e === 'Hg' || e === 'Cu')
    })
    if (!saltSp) return null
    const metal2 = Object.keys(saltSp.counts).find((e) => valence(e) != null)
    if (!metal2) return null
    // анион соли: та же соль собирается из металла и кислоты (CuSO₄ = Cu + H₂SO₄, AgNO₃ = Ag + HNO₃)
    let acid: string | null = null
    let v2: number | null = null
    for (const a of Object.keys(ACIDS)) for (const v of [1, 2, 3]) if (!acid && salt(metal2, v, a) === saltSp.ascii) ((acid = a), (v2 = v))
    if (!acid || v2 == null) return null
    const plates = [...new Map(ctx.species.filter((s) => Object.keys(s.counts).length === 1 && s.counts[Object.keys(s.counts)[0]!] === 1 && valence(s.ascii) != null && s.ascii !== metal2).map((s) => [s.ascii, s])).values()]
    // металл пластинки — по слову перед «пластинка» («железную», «rux», «copper»), иначе единственный металл в условии
    const word = ctx.text.match(/(\p{L}+)\s+(?:пластин|plastin|plate|стерж|гвозд|mix|nail|rod)/iu)?.[1]?.toLowerCase() ?? ''
    const byWord = PLATE_METAL.find(([re]) => re.test(word))?.[1] ?? null
    const m1 = byWord && byWord !== metal2 ? byWord : plates.length === 1 ? plates[0]!.ascii : null
    if (!m1) return null
    const v1 = m1 === 'Fe' ? 2 : valence(m1)!
    const b = bal(`${m1} + ${saltSp.ascii} → ${salt(m1, v1, acid)} + ${metal2}`)
    if (!b) return null
    const k1 = b.reactants.find((s) => s.formula === m1)!.coeff
    const k2 = b.products.find((s) => s.formula === metal2)!.coeff
    const A1 = schoolAr(m1)!
    const A2 = schoolAr(metal2)!
    const dPer = k2 * A2 - k1 * A1
    if (!dPer) return null
    // Δm: «увеличилась на 0,8 г» / «0,1 g ga kamaydi» или две массы пластинки (до и после)
    const gs = ctx.qs.filter((q) => q.unit === 'g')
    let dm: number | null = null
    const masses: Qty[] = []
    for (const q of gs) {
      const win = ctx.text.slice(Math.max(0, q.index - 30), q.end + 16)
      const winAfter = ctx.text.slice(q.end, q.end + 16)
      if (INCR.test(win) && (/на\s*$|by\s*$/iu.test(ctx.text.slice(Math.max(0, q.index - 6), q.index)) || INCR.test(winAfter))) dm = q.value
      else if (DECR.test(win) && (/на\s*$|by\s*$/iu.test(ctx.text.slice(Math.max(0, q.index - 6), q.index)) || DECR.test(winAfter))) dm = -q.value
      else masses.push(q)
    }
    if (dm == null) {
      if (masses.length !== 2) return null
      dm = masses[1]!.value - masses[0]!.value
    }
    const n = dm / dPer
    if (!(n > 0)) return null
    const steps: Line[] = [
      () => b.eq,
      (l) => `Δm = ${k2 > 1 ? `${k2}·` : ''}${fnum(A2, l, 'M')} − ${k1 > 1 ? `${k1}·` : ''}${fnum(A1, l, 'M')} = ${fnum(dPer, l)} ${unitLabel('g', l)} ${L(l, `на ${k1} моль ${m1}`, `${k1} mol ${m1} uchun`, `per ${k1} mol ${m1}`)}`,
      (l) => `n = ${fnum(dm!, l)} / ${fnum(dPer, l)} = ${fnum(n, l)} ${unitLabel('mol', l)}`,
    ]
    // искомое: металл из соли (по умолчанию), растворившийся металл или соль — что названо в вопросе
    const asked = ctx.species.filter((s) => s.index >= ctx.ask.sentenceIndex).map((s) => s.ascii)
    const answers: CalcValue[] = []
    const want1 = asked.includes(m1) && !asked.includes(metal2)
    const wantSalt = asked.includes(saltSp.ascii) && !asked.includes(metal2)
    if (wantSalt) {
      const kS = b.reactants.find((s) => s.formula === saltSp.ascii)!.coeff
      const M = Mof(saltSp)!
      steps.push((l) => `m(${saltSp.pretty}) = ${kS > 1 ? `${kS} · ` : ''}${fnum(n, l)} · ${fnum(M, l, 'M')} = ${fnum(kS * n * M, l)} ${unitLabel('g', l)}`)
      answers.push({ label: `m(${saltSp.pretty})`, value: kS * n * M, unit: 'g' })
    } else if (want1) {
      steps.push((l) => `m(${m1}) = ${k1 > 1 ? `${k1} · ` : ''}${fnum(n, l)} · ${fnum(A1, l, 'M')} = ${fnum(k1 * n * A1, l)} ${unitLabel('g', l)}`)
      answers.push({ label: `m(${m1})`, value: k1 * n * A1, unit: 'g' })
    } else {
      steps.push((l) => `m(${metal2}) = ${k2 > 1 ? `${k2} · ` : ''}${fnum(n, l)} · ${fnum(A2, l, 'M')} = ${fnum(k2 * n * A2, l)} ${unitLabel('g', l)}`)
      answers.push({ label: `m(${metal2})`, value: k2 * n * A2, unit: 'g' })
    }
    const given: CalcValue[] = masses.length === 2 && Math.abs(masses[1]!.value - masses[0]!.value - dm) < 1e-9
      ? [{ label: L(ctx.lang, 'm₀(пластинки)', 'm₀(plastinka)', 'm₀(plate)'), value: masses[0]!.value, unit: 'g' }, { label: L(ctx.lang, 'm₁(пластинки)', 'm₁(plastinka)', 'm₁(plate)'), value: masses[1]!.value, unit: 'g' }]
      : [{ label: 'Δm', value: dm, unit: 'g' }]
    return { type: 'metal_plate', given, find: answers.map((a) => a.label), steps, answers, equation: b.eq }
  },
}

export const EXTRA_SOLVERS: Solver[] = [gasMixture, equilibrium, redoxBalance, mixtureFraction, combustionFormula, metalPlate]
export type { Solution }
