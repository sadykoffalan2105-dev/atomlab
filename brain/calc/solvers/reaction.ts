/**
 * Решатели «по уравнению реакции»: equation_stoich, excess_limiting, yield, impurities, air_volume, thermochem.
 * Уравнение: (a) из текста (extractEquation + balanceEquation), (b) карта программы A (kb.curriculum.reactionsFor,
 * если загружена), (c) реакции учебника qaBank по набору веществ, (d) шаблоны классов (металл + кислота, оксид +
 * кислота, основание + кислота, карбонат + кислота, горение CxHy(Oz), разложения, восстановление водородом) —
 * только если вещества распознаны и уравнение уравнивается. Масса раствора с ω % → масса растворённого вещества.
 */
import type { EquationSpecies } from '../../../src/chemistry/equationFormula.ts'
import { pretty } from '../../pipeline/entities.ts'
import { balanceEquation, extractEquation } from '../../pipeline/tools.ts'
import { O2_IN_AIR, VM } from '../constants.ts'
import { L, fnum, unitLabel, withUnit, type CalcValue, type Line, type Solution } from '../format.ts'
import { isAmount, type Ctx, type Qty, type Species } from '../parse.ts'
import type { Solver, TaskTypeId } from '../registry.ts'
import { GASES, Mof, fromMoles, givenOf, toMoles, vm } from './common.ts'

type Balanced = { eq: string; reactants: EquationSpecies[]; products: EquationSpecies[] }

const strip = (eq: string) => eq.replace(/(→|⇄|⇌|=)\s*\([^)]*\)/g, '$1').replace(/[↑↓]/g, '').replace(/\s*[+−-]\s*\d+(?:[.,]\d+)?\s*(кДж|kJ|kj)(?![\p{L}]).*$/iu, '')

function balance(eq: string): Balanced | null {
  const b = balanceEquation(strip(eq))
  return b && typeof b === 'object' ? b : null
}

// ---------------------------------------------------------------- шаблоны реакций классов
const VAL1 = new Set(['Li', 'Na', 'K', 'Ag', 'Rb', 'Cs'])
const VAL2 = new Set(['Mg', 'Ca', 'Ba', 'Zn', 'Fe', 'Sr', 'Ni', 'Sn', 'Pb', 'Mn', 'Cu', 'Be', 'Cd', 'Co', 'Hg'])
const VAL3 = new Set(['Al', 'Cr', 'Ga'])
const ACTIVE = new Set(['Li', 'Na', 'K', 'Mg', 'Ca', 'Ba', 'Zn', 'Fe', 'Al', 'Sr', 'Ni', 'Sn', 'Pb', 'Mn', 'Cr', 'Be', 'Cd', 'Co'])
const ACIDS: Record<string, { anion: string; z: number }> = { HCl: { anion: 'Cl', z: 1 }, HBr: { anion: 'Br', z: 1 }, HI: { anion: 'I', z: 1 }, H2SO4: { anion: 'SO4', z: 2 }, HNO3: { anion: 'NO3', z: 1 }, H3PO4: { anion: 'PO4', z: 3 }, CH3COOH: { anion: 'CH3COO', z: 1 } }
const valence = (m: string) => (VAL1.has(m) ? 1 : VAL2.has(m) ? 2 : VAL3.has(m) ? 3 : null)
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

function salt(metal: string, v: number, acid: string): string | null {
  const a = ACIDS[acid]
  if (!a) return null
  const g = gcd(v, a.z)
  const nm = a.z / g
  const na = v / g
  const poly = a.anion.length > 2 || /[A-Z].*[A-Z]/.test(a.anion)
  const an = na > 1 ? (poly ? `(${a.anion})${na}` : `${a.anion}${na}`) : a.anion
  return `${metal}${nm > 1 ? nm : ''}${an}`
}

const singleMetal = (s: Species) => Object.keys(s.counts).length === 1 && valence(Object.keys(s.counts)[0]!) != null
const oxideMetal = (s: Species) => {
  const ks = Object.keys(s.counts)
  if (ks.length !== 2 || !s.counts.O) return null
  const m = ks.find((k) => k !== 'O')!
  const v = (2 * s.counts.O) / s.counts[m]!
  return Number.isInteger(v) && valence(m) != null ? { m, v } : null
}
const hydroxideMetal = (s: Species) => {
  const ks = Object.keys(s.counts)
  if (ks.length !== 3 || !s.counts.O || !s.counts.H || s.counts.O !== s.counts.H) return null
  const m = ks.find((k) => k !== 'O' && k !== 'H')!
  return valence(m) != null && s.counts[m] === 1 ? { m, v: s.counts.O } : null
}
const carbonateMetal = (s: Species) => {
  const ks = Object.keys(s.counts)
  if (ks.length !== 3 || !s.counts.C || !s.counts.O || s.counts.O !== 3 * s.counts.C) return null
  const m = ks.find((k) => k !== 'O' && k !== 'C')!
  const v = (2 * s.counts.C) / s.counts[m]!
  return valence(m) != null && Number.isInteger(v) ? { m, v } : null
}

const DECOMP: Record<string, string> = {
  CaCO3: 'CaCO3 → CaO + CO2', MgCO3: 'MgCO3 → MgO + CO2', BaCO3: 'BaCO3 → BaO + CO2', 'Cu(OH)2': 'Cu(OH)2 → CuO + H2O', 'Fe(OH)3': 'Fe(OH)3 → Fe2O3 + H2O',
  'Fe(OH)2': 'Fe(OH)2 → FeO + H2O', 'Al(OH)3': 'Al(OH)3 → Al2O3 + H2O', KMnO4: 'KMnO4 → K2MnO4 + MnO2 + O2', KClO3: 'KClO3 → KCl + O2', H2O2: 'H2O2 → H2O + O2',
  HgO: 'HgO → Hg + O2', KNO3: 'KNO3 → KNO2 + O2', NaNO3: 'NaNO3 → NaNO2 + O2', NaHCO3: 'NaHCO3 → Na2CO3 + CO2 + H2O', H2O: 'H2O → H2 + O2', Ag2O: 'Ag2O → Ag + O2',
}

/** Шаблонные уравнения по распознанным веществам. */
function templates(sp: Species[]): string[] {
  const out: string[] = []
  const acids = sp.filter((s) => ACIDS[s.ascii])
  for (const s of sp) {
    if (DECOMP[s.ascii]) out.push(DECOMP[s.ascii]!)
    const isC = s.counts.C && s.counts.H && Object.keys(s.counts).every((e) => e === 'C' || e === 'H' || e === 'O')
    if (isC) out.push(`${s.ascii} + O2 → CO2 + H2O`)
    if (s.ascii === 'C') out.push('C + O2 → CO2')
    if (s.ascii === 'S') out.push('S + O2 → SO2')
    if (s.ascii === 'P') out.push('P + O2 → P2O5')
    if (s.ascii === 'H2') out.push('H2 + O2 → H2O')
    if (singleMetal(s)) {
      const m = s.ascii
      const v = valence(m)!
      if (sp.some((x) => x.ascii === 'O2')) out.push(`${m} + O2 → ${v === 1 ? `${m}2O` : v === 2 ? `${m}O` : `${m}2O3`}`)
      if (ACTIVE.has(m)) for (const a of acids) if (a.ascii !== 'HNO3') out.push(`${m} + ${a.ascii} → ${salt(m, v, a.ascii)} + H2`)
      if (sp.some((x) => x.ascii === 'Cl2')) out.push(`${m} + Cl2 → ${salt(m, m === 'Fe' ? 3 : v, 'HCl')}`)
      if (sp.some((x) => x.ascii === 'S')) out.push(`${m} + S → ${v === 1 ? `${m}2S` : v === 2 ? `${m}S` : `${m}2S3`}`)
      if (['Na', 'K', 'Li', 'Ca', 'Ba'].includes(m) && sp.some((x) => x.ascii === 'H2O')) out.push(`${m} + H2O → ${v === 1 ? `${m}OH` : `${m}(OH)2`} + H2`)
    }
    const ox = oxideMetal(s)
    if (ox) {
      for (const a of acids) out.push(`${s.ascii} + ${a.ascii} → ${salt(ox.m, ox.v, a.ascii)} + H2O`)
      if (sp.some((x) => x.ascii === 'H2') && ['Cu', 'Fe', 'Pb', 'Ag', 'Hg', 'Ni', 'Sn', 'Zn'].includes(ox.m)) out.push(`${s.ascii} + H2 → ${ox.m} + H2O`)
      if (sp.some((x) => x.ascii === 'CO') && ['Cu', 'Fe', 'Pb', 'Zn'].includes(ox.m)) out.push(`${s.ascii} + CO → ${ox.m} + CO2`)
      if (['Na', 'K', 'Li', 'Ca', 'Ba'].includes(ox.m) && sp.some((x) => x.ascii === 'H2O')) out.push(`${s.ascii} + H2O → ${ox.v === 1 ? `${ox.m}OH` : `${ox.m}(OH)2`}`)
    }
    const hy = hydroxideMetal(s)
    if (hy) for (const a of acids) out.push(`${s.ascii} + ${a.ascii} → ${salt(hy.m, hy.v, a.ascii)} + H2O`)
    const ca = carbonateMetal(s)
    if (ca) for (const a of acids) out.push(`${s.ascii} + ${a.ascii} → ${salt(ca.m, ca.v, a.ascii)} + H2O + CO2`)
  }
  return out
}

type Curriculum = { reactionsFor?: (r: string[], p?: string) => { reaction: { eq?: string; ascii?: string } }[] }

/** Уравнения-кандидаты, в которых есть все нужные вещества. */
export function findEquation(ctx: Ctx, must: Species[], prefer?: { reactant?: string; product?: string }): Balanced | null {
  const cands: string[] = []
  const inText = extractEquation(ctx.text)
  if (inText) cands.push(inText)
  // (b) карта программы (строитель A) — необязательная зависимость
  const cur = (ctx.kb as unknown as { curriculum?: Curriculum | null }).curriculum
  if (cur && typeof cur.reactionsFor === 'function') {
    try {
      for (const x of cur.reactionsFor(must.map((s) => s.ascii), prefer?.product).slice(0, 5)) {
        const e = x.reaction.ascii ?? x.reaction.eq
        if (e) cands.push(e)
      }
    } catch {
      /* карта необязательна */
    }
  }
  const mentioned = new Set(ctx.species.map((s) => s.ascii))
  const need = must.map((s) => s.ascii)
  const kbList = ctx.kb.qa.reactions
    .filter((r) => need.every((x) => r.r.includes(x) || r.p.includes(x)))
    .map((r) => {
      const all = [...r.r, ...r.p]
      let score = all.filter((x) => mentioned.has(x)).length * 10 - all.length
      if (prefer?.reactant && r.r.includes(prefer.reactant)) score += 5
      if (prefer?.product && r.p.includes(prefer.product)) score += 5
      // посторонние реагенты, которых нет в условии, — хуже
      score -= r.r.filter((x) => !mentioned.has(x) && x !== 'O2' && x !== 'H2O').length * 6
      return { eq: r.eq, score }
    })
    .sort((a, b) => b.score - a.score)
  const tpl = templates(ctx.species)
  // шаблон, где все реагенты названы в условии, надёжнее «чужой» реакции учебника
  const tplFull = tpl.filter((e) => e.split('→')[0]!.split('+').every((x) => mentioned.has(x.trim()) || x.trim() === 'O2'))
  for (const t of tplFull) cands.push(t)
  for (const r of kbList.slice(0, 6)) cands.push(r.eq)
  for (const t of tpl) cands.push(t)
  for (const eq of cands) {
    const b = balance(eq)
    if (!b) continue
    const all = [...b.reactants, ...b.products]
    if (need.every((x) => all.some((s) => s.formula === x))) return b
  }
  return null
}

// ---------------------------------------------------------------- роли величин
type Role = { q: Qty; sp: Species; pure: number; unitKey: 'g' | 'l' | 'mol' | 'particles'; note?: Line; given: CalcValue[] }

const NEAR = (ctx: Ctx, q: Qty, re: RegExp) => re.test(ctx.text.slice(Math.max(0, q.index - 45), q.end + 45).toLowerCase())
const YIELD_RE = /(выход|unum|yield|hosil bo['ʻ’]lish unumi)/iu
const IMPUR_RE = /(примес|aralashma|impurit|qo['ʻ’]shimcha)/iu
const PURE_RE = /(чист\p{L}*|содерж\p{L}*|tarkibida|pure|contain\p{L}*|технич\p{L}*)/iu
const SOL_RE = /(раствор|eritma|solution)/iu

export type Reactionish = {
  roles: Role[]
  yieldPct: number | null
  target: Species | null
  askedAir: boolean
}

function speciesNear(ctx: Ctx, q: Qty): Species | null {
  const after = ctx.species.find((s) => s.index >= q.end && s.index - q.end <= 60 && !/[\d;?]/.test(ctx.text.slice(q.end, s.index)))
  if (after) return after
  const before = [...ctx.species].reverse().find((s) => s.end <= q.index && q.index - s.end <= 30 && !/[\d;?]/.test(ctx.text.slice(s.end, q.index)))
  return before ?? null
}

export function rolesOf(ctx: Ctx): Reactionish | null {
  const pcts = ctx.qs.filter((q) => q.unit === 'pct')
  const amounts = ctx.qs.filter(isAmount)
  if (!amounts.length || amounts.length > 2) return null
  let yieldPct: number | null = null
  const usedPct = new Set<Qty>()
  const roles: Role[] = []
  for (const q of amounts) {
    // проценты, относящиеся к этой величине: ω раствора, примеси, чистое вещество (ближайшие в пределах 60 символов)
    const near = pcts.filter((p) => !usedPct.has(p) && Math.abs(p.index - q.index) < 70 && !NEAR(ctx, p, YIELD_RE))
    const nearest = near.sort((a, b) => Math.abs(a.index - q.index) - Math.abs(b.index - q.index))[0]
    let pure = q.value
    const given: CalcValue[] = []
    let note: Line | undefined
    let sp = speciesNear(ctx, q)
    if (nearest && q.unit === 'g') {
      usedPct.add(nearest)
      const ctxText = ctx.text.slice(Math.min(q.index, nearest.index) - 0, Math.max(q.end, nearest.end) + 40).toLowerCase()
      if (IMPUR_RE.test(ctxText) || NEAR(ctx, nearest, IMPUR_RE)) {
        pure = (q.value * (100 - nearest.value)) / 100
        const w = nearest.value
        note = (l) => `m(${L(l, 'чист.', 'sof', 'pure')}) = ${fnum(q.value, l)} · (100 − ${fnum(w, l, 'pct')}) / 100 = ${fnum(pure, l)} ${unitLabel('g', l)}`
        given.push({ label: L(ctx.lang, 'm(образца)', 'm(namuna)', 'm(sample)'), value: q.value, unit: 'g' }, { label: L(ctx.lang, 'ω(примесей)', 'ω(aralashma)', 'ω(impurities)'), value: w, unit: 'pct' })
      } else if (SOL_RE.test(ctxText) || NEAR(ctx, nearest, SOL_RE)) {
        pure = (q.value * nearest.value) / 100
        const w = nearest.value
        note = (l) => `m(${L(l, 'в-ва', 'modda', 'solute')}) = m(${L(l, 'р-ра', 'eritma', 'solution')}) · ω = ${fnum(q.value, l)} · ${fnum(w / 100, l)} = ${fnum(pure, l)} ${unitLabel('g', l)}`
        given.push({ label: L(ctx.lang, 'm(р-ра)', 'm(eritma)', 'm(solution)'), value: q.value, unit: 'g' }, { label: 'ω', value: w, unit: 'pct' })
      } else if (PURE_RE.test(ctxText)) {
        pure = (q.value * nearest.value) / 100
        const w = nearest.value
        note = (l) => `m(${L(l, 'чист.', 'sof', 'pure')}) = ${fnum(q.value, l)} · ${fnum(w / 100, l)} = ${fnum(pure, l)} ${unitLabel('g', l)}`
        given.push({ label: L(ctx.lang, 'm(образца)', 'm(namuna)', 'm(sample)'), value: q.value, unit: 'g' }, { label: 'ω', value: w, unit: 'pct' })
      } else return null
      // вещество раствора/образца — после «раствора …» / «известняка, содержащего … CaCO₃»
      if (!sp) sp = ctx.species.find((s) => s.index > Math.max(q.end, nearest.end) && s.index - Math.max(q.end, nearest.end) < 70) ?? null
    }
    if (!sp) return null
    if (!given.length) given.push(givenOf(q, sp))
    roles.push({ q, sp, pure, unitKey: q.unit as Role['unitKey'], note, given })
  }
  for (const p of pcts) {
    if (usedPct.has(p)) continue
    if (NEAR(ctx, p, YIELD_RE)) yieldPct = p.value
    else return null
  }
  // искомое вещество: в вопросе, не среди данных
  const givenSet = new Set(roles.map((r) => r.sp.ascii))
  const askedAir = /(воздух|havo|\bair\b)/iu.test(ctx.ask.text)
  let target = ctx.species.find((s) => s.index >= ctx.ask.index && !givenSet.has(s.ascii)) ?? null
  // узбекский порядок слов: искомое — в том же предложении до глагола-вопроса («…necha gramm magniy oksidi hosil boʻladi»)
  if (!target) target = [...ctx.species].reverse().find((s) => s.index >= ctx.ask.sentenceIndex && s.index < ctx.ask.index && !givenSet.has(s.ascii)) ?? null
  if (!target) target = ctx.species.find((s) => !givenSet.has(s.ascii) && s.index > Math.max(...roles.map((r) => r.q.index))) ?? null
  // «вычислите выход аммиака»: искомое — продукт среди данных (практическая масса)
  if (!target && roles.length === 2 && YIELD_RE.test(ctx.ask.sentence)) target = roles.find((r) => r.sp.index >= ctx.ask.sentenceIndex)?.sp ?? ctx.species.find((s) => s.index >= ctx.ask.sentenceIndex && givenSet.has(s.ascii)) ?? roles[1]!.sp
  if (askedAir && !target) target = { ascii: 'O2', pretty: 'O₂', counts: { O: 2 }, index: ctx.ask.index, end: ctx.ask.index, charge: 0 }
  return { roles, yieldPct, target, askedAir }
}

/** n по роли (с учётом чистого вещества/растворённого вещества). */
function roleMoles(r: Role, steps: Line[]): number | null {
  if (r.note) steps.push(r.note)
  const q: Qty = { ...r.q, value: r.pure }
  return toMoles(q, r.sp, steps)
}

const coefOf = (b: Balanced, f: string) => [...b.reactants, ...b.products].find((s) => s.formula === f)?.coeff ?? null
const isReactant = (b: Balanced, f: string) => b.reactants.some((s) => s.formula === f)

/** Общий решатель по уравнению; тип задачи — по модификаторам. */
function solveReaction(ctx: Ctx): Solution | null {
  const ri = rolesOf(ctx)
  if (!ri || !ri.target) return null
  const { roles, target, yieldPct } = ri
  if (roles.some((r) => r.sp.ascii === target.ascii)) {
    // «сколько выход» — η: данное — реагент, практическая масса продукта
    if (!(yieldPct == null && roles.length === 2 && YIELD_RE.test(ctx.ask.sentence))) return null
  }
  const must = [...new Map([...roles.map((r) => r.sp), target].map((s) => [s.ascii, s])).values()]
  if (must.length < 2) return null
  const b = findEquation(ctx, must, { reactant: roles[0]!.sp.ascii, product: target.ascii })
  if (!b) return null
  const steps: Line[] = [() => b.eq]
  const given: CalcValue[] = roles.flatMap((r) => r.given)
  const answers: CalcValue[] = []
  const notes: Line[] = []
  let type: TaskTypeId = roles.some((r) => r.note && IMPUR_RE.test(ctx.text)) ? 'impurities' : 'equation_stoich'
  const kT = coefOf(b, target.ascii)!
  // η как искомое: реагент (теор.) + практическая масса продукта
  if (roles.length === 2 && roles.some((r) => r.sp.ascii === target.ascii) && YIELD_RE.test(ctx.ask.sentence)) {
    const src = roles.find((r) => r.sp.ascii !== target.ascii)!
    const prac = roles.find((r) => r.sp.ascii === target.ascii)!
    const n = roleMoles(src, steps)
    if (n == null) return null
    const kS = coefOf(b, src.sp.ascii)!
    const nT = (n * kT) / kS
    steps.push((l) => `n(${target.pretty}) = ${fnum(n, l)} · ${kT}/${kS} = ${fnum(nT, l)} ${unitLabel('mol', l)}`)
    const theo: CalcValue[] = []
    if (!fromMoles(nT, target, [prac.unitKey === 'l' ? 'volume' : prac.unitKey === 'mol' ? 'mol' : 'mass'], steps, theo)) return null
    const th = theo[0]!.value
    const eta = (prac.pure / th) * 100
    steps.push((l) => `η = ${L(l, 'практ.', 'amaliy', 'actual')} / ${L(l, 'теор.', 'nazariy', 'theor.')} · 100 % = ${fnum(prac.pure, l)} / ${fnum(th, l)} · 100 % = ${fnum(eta, l, 'pct')} %`)
    answers.push({ label: 'η', value: eta, unit: 'pct' })
    return { type: 'yield', given, find: ['η'], steps, answers, equation: b.eq }
  }
  let kinds = ctx.ask.kinds.filter((k) => k === 'mass' || k === 'volume' || k === 'mol' || k === 'particles')
  if (ri.askedAir) kinds = ['volume']
  if (!kinds.length) kinds = [GASES.has(target.ascii) && /(газ|gaz|gas)/iu.test(ctx.ask.text) ? 'volume' : 'mass']
  if (kinds.includes('volume') && !GASES.has(target.ascii)) return null
  let nT: number
  if (roles.length === 2) {
    // избыток / недостаток: оба реагента даны
    const [r1, r2] = roles as [Role, Role]
    if (!isReactant(b, r1.sp.ascii) || !isReactant(b, r2.sp.ascii) || r1.sp.ascii === r2.sp.ascii) return null
    const n1 = roleMoles(r1, steps)
    const n2 = roleMoles(r2, steps)
    if (n1 == null || n2 == null) return null
    const k1 = coefOf(b, r1.sp.ascii)!
    const k2 = coefOf(b, r2.sp.ascii)!
    const lim = n1 / k1 <= n2 / k2 ? r1 : r2
    const exc = lim === r1 ? r2 : r1
    const nL = lim === r1 ? n1 : n2
    const nE = lim === r1 ? n2 : n1
    const kL = lim === r1 ? k1 : k2
    const kE = lim === r1 ? k2 : k1
    steps.push((l) => `${fnum(n1, l)}/${k1} ${n1 / k1 <= n2 / k2 ? '<' : '>'} ${fnum(n2, l)}/${k2} → ${exc.sp.pretty} ${L(l, 'в избытке, считаем по', 'ortiqcha, hisob', 'is in excess, calculate by')} ${lim.sp.pretty}${L(l, '', ' boʻyicha', '')}`)
    nT = (nL * kT) / kL
    steps.push((l) => `n(${target.pretty}) = ${fnum(nL, l)} · ${kT}/${kL} = ${fnum(nT, l)} ${unitLabel('mol', l)}`)
    answers.push({ label: L(ctx.lang, 'в избытке', 'ortiqcha', 'in excess'), value: 0, unit: 'none', text: exc.sp.pretty })
    if (/(остан|осталось|избыт\p{L}* масс|ortib qol|ortiqcha qism|left over|remain)/iu.test(ctx.cmp)) {
      const left = nE - (nL * kE) / kL
      const M = Mof(exc.sp)
      if (M != null && left > 0) {
        steps.push((l) => `m(${exc.sp.pretty})${L(l, 'ост.', 'qol.', 'left')} = (${fnum(nE, l)} − ${fnum((nL * kE) / kL, l)}) · ${fnum(M, l, 'M')} = ${fnum(left * M, l)} ${unitLabel('g', l)}`)
        answers.push({ label: `m(${exc.sp.pretty})`, value: left * M, unit: 'g' })
      }
    }
    type = 'excess_limiting'
  } else {
    const r = roles[0]!
    const n = roleMoles(r, steps)
    if (n == null) return null
    const kG = coefOf(b, r.sp.ascii)!
    let nn = n
    // обратная задача на выход: дан практический продукт, нужен реагент
    if (yieldPct != null && !isReactant(b, r.sp.ascii) && isReactant(b, target.ascii)) {
      nn = n / (yieldPct / 100)
      const n0 = n
      steps.push((l) => `n(${r.sp.pretty})${L(l, 'теор.', 'nazariy', 'theor.')} = ${fnum(n0, l)} / ${fnum(yieldPct / 100, l)} = ${fnum(nn, l)} ${unitLabel('mol', l)}`)
      type = 'yield'
    }
    nT = (nn * kT) / kG
    steps.push((l) => `n(${target.pretty}) = n(${r.sp.pretty}) · ${kT}/${kG} = ${fnum(nT, l)} ${unitLabel('mol', l)}`)
  }
  if (yieldPct != null && type !== 'yield') {
    const nTh = nT
    nT = (nT * yieldPct) / 100
    steps.push((l) => `n(${target.pretty})${L(l, 'практ.', 'amaliy', 'actual')} = ${fnum(nTh, l)} · ${fnum(yieldPct / 100, l)} = ${fnum(nT, l)} ${unitLabel('mol', l)}`)
    type = 'yield'
  }
  if (type === 'yield') given.push({ label: 'η', value: yieldPct!, unit: 'pct' })
  const before = answers.length
  if (ri.askedAir) {
    if (target.ascii !== 'O2') return null
    const VO2 = nT * VM
    const Vair = VO2 / O2_IN_AIR
    steps.push((l) => `V(O₂) = ${fnum(nT, l)} · ${vm(l)} = ${fnum(VO2, l)} ${unitLabel('l', l)}`)
    steps.push((l) => `V(${L(l, 'воздуха', 'havo', 'air')}) = V(O₂) / 0,21 = ${fnum(VO2, l)} / ${l === 'en' ? '0.21' : '0,21'} = ${fnum(Vair, l)} ${unitLabel('l', l)}`)
    answers.push({ label: `V(${L(ctx.lang, 'воздуха', 'havo', 'air')})`, value: Vair, unit: 'l' })
    type = 'air_volume'
  } else if (!fromMoles(nT, target, kinds, steps, answers)) return null
  if (answers.length === before) return null
  // число «в избытке» — текстовый ответ — ставим после числовых
  answers.sort((a, b2) => (a.text ? 1 : 0) - (b2.text ? 1 : 0))
  return { type, given, find: answers.filter((a) => !a.text).map((a) => a.label), steps, answers, equation: b.eq, notes }
}

const reactionSolver: Solver = {
  id: 'equation_stoich',
  priority: 30,
  solve(ctx) {
    if (ctx.species.length < 2 && !/(воздух|havo|\bair\b)/iu.test(ctx.ask.text)) return null
    if (ctx.qs.some((q) => q.unit === 'kj' || q.unit === 'M' || q.unit === 'A' || q.unit === 's' || q.unit === 'kPa')) return null
    return solveReaction(ctx)
  },
}

// ---------------------------------------------------------------- термохимия по уравнению с Q
const thermochem: Solver = {
  id: 'thermochem',
  priority: 33,
  solve(ctx) {
    const eqm = ctx.text.match(/([^.?!]*?(?:→|->|=)[^.?!]*?)([+−-])\s*(\d+(?:[.,]\d+)?)\s*(кДж|kJ|kj)/iu)
    const dh = ctx.text.match(/Δ\s*H\s*=\s*([+−-]?)\s*(\d+(?:[.,]\d+)?)\s*(кДж|kJ)/iu)
    if (!eqm && !dh) return null
    const eqText = extractEquation(eqm ? eqm[1]! : ctx.text)
    if (!eqText) return null
    const b = balance(eqText)
    if (!b) return null
    // Q уравнения: «+ Q» справа — тепло выделяется; ΔH = −Q
    const Q = eqm ? (eqm[2] === '+' ? 1 : -1) * Number(eqm[3]!.replace(',', '.')) : -(dh![1] === '-' || dh![1] === '−' ? -1 : 1) * Number(dh![2]!.replace(',', '.'))
    const qEqIdx = eqm ? (eqm.index ?? 0) + eqm[0].length : (dh!.index ?? 0) + dh![0].length
    const rest = ctx.qs.filter((q) => q.index >= qEqIdx || q.end <= (eqm?.index ?? dh!.index ?? 0))
    const amounts = rest.filter(isAmount)
    const heat = rest.filter((q) => q.unit === 'kj')
    const steps: Line[] = []
    const all = [...b.reactants, ...b.products]
    const spOf = (f: string): Species | null => {
      const s = ctx.species.find((x) => x.ascii === f)
      return s ?? (all.some((x) => x.formula === f) ? { ascii: f, pretty: pretty(f), counts: all.find((x) => x.formula === f)!.counts!, index: 0, end: 0, charge: 0 } : null)
    }
    const Qabs = Math.abs(Q)
    const sign = Q > 0
    const kindLine: Line = (l) => (sign ? L(l, 'реакция экзотермическая (тепло выделяется)', 'reaksiya ekzotermik (issiqlik ajraladi)', 'the reaction is exothermic (heat is released)') : L(l, 'реакция эндотермическая (тепло поглощается)', 'reaksiya endotermik (issiqlik yutiladi)', 'the reaction is endothermic (heat is absorbed)'))
    if (amounts.length === 1 && !heat.length) {
      const q = amounts[0]!
      // вещество: рядом с величиной и есть в уравнении
      const near = ctx.species.filter((s) => all.some((x) => x.formula === s.ascii)).sort((a, c) => Math.abs(a.index - q.end) - Math.abs(c.index - q.end))[0]
      if (!near) return null
      const k = all.find((x) => x.formula === near.ascii)!.coeff
      const n = toMoles(q, near, steps)
      if (n == null) return null
      const Qx = (n / k) * Qabs
      steps.unshift((l) => `${b.eq}; Q = ${fnum(Qabs, l)} ${unitLabel('kj', l)} ${L(l, `на ${k} моль`, `${k} mol uchun`, `per ${k} mol`)} ${near.pretty}`)
      steps.push((l) => `Q = ${fnum(n, l)} / ${k} · ${fnum(Qabs, l)} = ${fnum(Qx, l)} ${unitLabel('kj', l)}; ${kindLine(l)}`)
      return { type: 'thermochem', given: [givenOf(q, near)], find: ['Q'], steps, answers: [{ label: 'Q', value: Qx, unit: 'kj' }], equation: b.eq }
    }
    if (heat.length === 1 && !amounts.length) {
      const hq = heat[0]!.value
      const target = ctx.species.filter((s) => s.index >= ctx.ask.index && all.some((x) => x.formula === s.ascii))[0] ?? (ctx.species.length ? spOf(ctx.species[0]!.ascii) : null)
      if (!target) return null
      const k = all.find((x) => x.formula === target.ascii)?.coeff
      if (!k) return null
      const n = (hq / Qabs) * k
      steps.push((l) => `${b.eq}; ${fnum(Qabs, l)} ${unitLabel('kj', l)} — ${k} ${unitLabel('mol', l)} ${target.pretty}`)
      steps.push((l) => `n(${target.pretty}) = ${fnum(hq, l)} / ${fnum(Qabs, l)} · ${k} = ${fnum(n, l)} ${unitLabel('mol', l)}`)
      const answers: CalcValue[] = []
      let kinds = ctx.ask.kinds.filter((x) => x === 'mass' || x === 'volume' || x === 'mol')
      if (!kinds.length) kinds = ['mass']
      if (!fromMoles(n, target, kinds, steps, answers)) return null
      return { type: 'thermochem', given: [{ label: 'Q', value: hq, unit: 'kj' }], find: answers.map((a) => a.label), steps, answers, equation: b.eq }
    }
    return null
  },
}

export const REACTION_SOLVERS: Solver[] = [reactionSolver, thermochem]
export { withUnit }
