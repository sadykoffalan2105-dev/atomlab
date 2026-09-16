// Merge + normalise the two grade-8 inventory halves, apply verified fixes, re-run balance check,
// re-map catalog / reaction bank, and emit inventory-g8.json, substances-g8.json, reactions-g8.json.
// Usage: node scripts/textbook-inventory/merge-g8.mjs   (catalog cache: npx tsx scripts/textbook-inventory/dump-catalog.mts)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIXES } from './merge-g8-fixes.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))
const P1 = rd('src/data/textbook/inventory-g8-part1.json')
const P2 = rd('src/data/textbook/inventory-g8-part2.json')
const KB = rd('src/data/kb/corpus/kb-sections.json').g8
const CAT = rd('scripts/textbook-inventory/.cache/catalog.json')

// ---------------- chemistry utils ----------------
const ELEMENTS = new Set(('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' '))
const SUB = '₀₁₂₃₄₅₆₇₈₉'
const SUPD = '⁰¹²³⁴⁵⁶⁷⁸⁹'

function parseBody(s) {
  let i = 0
  const readNum = () => {
    const m = /^\d+/.exec(s.slice(i))
    if (!m) return 1
    i += m[0].length
    return Number(m[0])
  }
  const group = () => {
    const out = {}
    while (i < s.length) {
      const ch = s[i]
      if (ch === '(' || ch === '[') {
        i++
        const inner = group()
        if (s[i] !== ')' && s[i] !== ']') throw new Error(`bracket in ${s}`)
        i++
        const n = readNum()
        for (const [k, v] of Object.entries(inner)) out[k] = (out[k] ?? 0) + v * n
      } else if (ch === ')' || ch === ']') return out
      else if (/[A-Z]/.test(ch)) {
        let sym = ch
        if (/[a-z]/.test(s[i + 1] ?? '') && ELEMENTS.has(ch + s[i + 1])) sym = ch + s[i + 1]
        if (!ELEMENTS.has(sym)) throw new Error(`element ${sym} in ${s}`)
        i += sym.length
        const n = readNum()
        out[sym] = (out[sym] ?? 0) + n
      } else throw new Error(`char "${ch}" in ${s}`)
    }
    return out
  }
  const r = group()
  if (i !== s.length) throw new Error(`trailing in ${s}`)
  return r
}
export function parseFormula(f) {
  const [body, chargeStr] = f.split('^')
  let charge = 0
  if (chargeStr) {
    const m = /^(\d*)([+-])$/.exec(chargeStr)
    if (!m) throw new Error(`charge ${f}`)
    charge = (m[1] ? Number(m[1]) : 1) * (m[2] === '+' ? 1 : -1)
  }
  const counts = {}
  for (const part of body.split('·')) {
    const m = /^(\d+(?:\.\d+)?)?(.+)$/.exec(part)
    const k = m[1] ? Number(m[1]) : 1
    for (const [el, n] of Object.entries(parseBody(m[2]))) counts[el] = (counts[el] ?? 0) + n * k
  }
  return { counts, charge }
}
const tryParse = (f) => {
  try {
    return parseFormula(f)
  } catch {
    return null
  }
}
function compKey(p) {
  return Object.entries(p.counts).filter(([, n]) => n > 0).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, n]) => `${k}${n}`).join('') + (p.charge ? `^${p.charge}` : '')
}
function toUnicode(f) {
  if (f == null) return null
  const [body, charge] = f.split('^')
  const b = body.split('·').map((p) => {
    const m = /^(\d+(?:\.\d+)?)?(.*)$/.exec(p)
    const k = m[1] === '0.5' ? '½' : (m[1] ?? '')
    return k + m[2].replace(/(?<=[A-Za-z)\]])\d+/g, (d) => [...d].map((c) => SUB[+c]).join(''))
  }).join('·')
  if (!charge) return b
  return b + [...charge].map((c) => (c === '+' ? '⁺' : c === '-' ? '⁻' : SUPD[+c])).join('')
}
function fromUnicode(s) {
  return s
    .replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)))
    .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])/g, (_m, d, sg) => '^' + [...d].map((c) => SUPD.indexOf(c)).join('') + (sg === '⁺' ? '+' : '-'))
    .replace(/\*/g, '·')
    .replace(/\s+/g, '')
}
const normFormula = (f) => (f == null ? null : f.replace(/\*/g, '·').replace(/\s+/g, ''))
const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b))

// equation string -> terms (for cross-checking arrays and parsing bank)
const ARROW_RE = /\s*(?:→|⇌|⇄|->|=)(?:\([^)]*\))?\s*/
function parseEquationString(eq) {
  const cleaned = eq.replace(/[;.,]\s*$/, '')
  const parts = cleaned.split(ARROW_RE)
  if (parts.length !== 2) throw new Error(`arrow count in ${eq}`)
  const side = (s) =>
    s.split(/\s+\+\s+/).map((t) => t.replace(/[↑↓]/g, '').replace(/\((?:конц|разб|сильно разб|р-р|тв|г|ж|белый|красный|kat)\.?\)/g, '').trim())
      .filter((t) => t && !/^[−-]?\s*Q$/.test(t) && !/кДж/.test(t))
      .map((t) => {
        const m = /^(\d*)\s*(.+)$/.exec(t)
        return { formula: fromUnicode(m[2]), coeff: m[1] ? Number(m[1]) : 1 }
      })
  return { reactants: side(parts[0]), products: side(parts[1]) }
}
function tally(terms) {
  const c = {}
  let q = 0
  for (const t of terms) {
    const p = parseFormula(t.formula)
    for (const [k, v] of Object.entries(p.counts)) c[k] = (c[k] ?? 0) + v * t.coeff
    q += p.charge * t.coeff
  }
  return { c, q }
}
function balanceOf(r) {
  const L = tally(r.reactants)
  const R = tally(r.products)
  const d = []
  for (const k of new Set([...Object.keys(L.c), ...Object.keys(R.c)])) if (Math.abs((L.c[k] ?? 0) - (R.c[k] ?? 0)) > 1e-9) d.push(`${k}: ${L.c[k] ?? 0} vs ${R.c[k] ?? 0}`)
  if (L.q !== R.q) d.push(`charge: ${L.q} vs ${R.q}`)
  return d
}
function speciesKey(r) {
  const s = (ts) => ts.map((t) => compKey(parseFormula(t.formula))).sort().join('+')
  return `${s(r.reactants)}=>${s(r.products)}`
}
function exactKey(r) {
  const all = [...r.reactants, ...r.products].reduce((a, t) => gcd(a, t.coeff), 0) || 1
  const s = (ts) => ts.map((t) => `${t.coeff / all}${compKey(parseFormula(t.formula))}`).sort().join('+')
  return `${s(r.reactants)}=>${s(r.products)}`
}

// ---------------- catalog ----------------
const compoundByKey = new Map()
for (const c of CAT.compounds) {
  let key
  try {
    key = compKey(parseFormula(fromUnicode(c.formulaUnicode)))
  } catch {
    if (!c.composition) continue
    key = compKey({ counts: c.composition, charge: 0 })
  }
  if (!compoundByKey.has(key)) compoundByKey.set(key, [])
  compoundByKey.get(key).push({ id: c.id, formula: fromUnicode(c.formulaUnicode), nameRu: c.nameRu })
}
const organicByKey = new Map()
for (const m of CAT.organic) {
  const p = tryParse(fromUnicode(m.formula))
  if (!p) continue
  const key = compKey(p)
  if (!organicByKey.has(key)) organicByKey.set(key, [])
  organicByKey.get(key).push({ id: m.id, formula: fromUnicode(m.formula), nameRu: m.nameRu })
}
const catalogNameById = new Map([...CAT.compounds.map((c) => [c.id, c.nameRu]), ...CAT.organic.map((m) => [m.id, m.nameRu])])
function mapCatalog(formula, nameRu) {
  if (!formula) return { catalogId: null, catalogSource: null }
  const p = tryParse(formula)
  if (!p) return { catalogId: null, catalogSource: null }
  const key = compKey(p)
  const inorg = compoundByKey.get(key) ?? []
  const org = organicByKey.get(key) ?? []
  const exact = inorg.find((c) => c.formula === formula)
  if (exact) return { catalogId: exact.id, catalogSource: 'inorganic', ...(inorg.length > 1 ? { catalogCandidates: inorg.map((c) => c.id) } : {}) }
  const orgExact = org.find((o) => o.formula === formula) ?? org.find((o) => nameRu && o.nameRu.toLowerCase() === String(nameRu).toLowerCase())
  if (orgExact) return { catalogId: orgExact.id, catalogSource: 'organic' }
  if (inorg.length === 1 && !org.length) return { catalogId: inorg[0].id, catalogSource: 'inorganic', catalogMatch: 'composition' }
  if (org.length === 1 && !inorg.length) return { catalogId: org[0].id, catalogSource: 'organic', catalogMatch: 'composition' }
  const cands = [...inorg.map((c) => c.id), ...org.map((o) => o.id)]
  return cands.length ? { catalogId: cands[0], catalogSource: inorg.length ? 'inorganic' : 'organic', catalogMatch: 'composition-ambiguous', catalogCandidates: cands } : { catalogId: null, catalogSource: null }
}

// ---------------- reaction bank ----------------
const bankExact = new Map()
const bankSpecies = new Map()
const bankStep = new Map()
const bankUnparsed = []
for (const r of CAT.reactions) {
  const steps = r.equationRu.split(/;\s*/)
  for (const step of steps) {
    try {
      const eq = parseEquationString(step)
      const target = steps.length > 1 ? bankStep : null
      const ek = exactKey(eq)
      const sk = speciesKey(eq)
      if (target) {
        if (!bankStep.has(sk)) bankStep.set(sk, [])
        bankStep.get(sk).push(r.id)
        continue
      }
      if (!bankExact.has(ek)) bankExact.set(ek, [])
      bankExact.get(ek).push(r.id)
      if (!bankSpecies.has(sk)) bankSpecies.set(sk, [])
      bankSpecies.get(sk).push(r.id)
    } catch (e) {
      bankUnparsed.push(`${r.id}: ${step} (${e.message})`)
    }
  }
}
function mapBank(r) {
  if (r.isGeneralScheme) return { bankId: null, bankMatch: null }
  let ek, sk
  try {
    ek = exactKey(r)
    sk = speciesKey(r)
  } catch {
    return { bankId: null, bankMatch: null }
  }
  const pick = (ids, match) => ({ bankId: ids[0], bankMatch: match, ...(ids.length > 1 ? { bankIdAlternatives: ids.slice(1) } : {}) })
  if (bankExact.has(ek)) return pick(bankExact.get(ek), 'exact')
  if (bankSpecies.has(sk)) return pick(bankSpecies.get(sk), 'species')
  if (bankStep.has(sk)) return pick(bankStep.get(sk), 'step-of-multistep')
  return { bankId: null, bankMatch: null }
}

// ---------------- normalisation ----------------
const KIND_ION = 'ion'
function normSubstance(x, part) {
  const formula = normFormula(x.formula)
  const p = formula ? tryParse(formula) : null
  const isIon = !!(p && p.charge)
  const o = {
    formula,
    formulaUnicode: formula ? toUnicode(formula) : null,
    formulaInBook: part === 1 ? x.formulaInBook !== false && formula != null : formula != null && !x.formulaInferred,
    nameRu: x.nameRu,
    nameInBook: part === 1 ? x.nameInBook !== false : x.nameFromBook !== false,
    kind: isIon ? KIND_ION : x.kind,
    role: x.role,
    page: x.page,
    pages: x.pages ?? [x.page],
    context: x.context ?? null,
    quote: x.quote ?? null,
  }
  if (x.elementSymbol) o.elementSymbol = x.elementSymbol
  if (x.aliasesRu) o.aliasesRu = x.aliasesRu
  if (x.autoFromEquation) o.fromEquationOnly = true
  if (x.nameSource) o.nameSource = x.nameSource
  if (x.note) o.note = x.note
  o.sourcePart = part
  o._prevCatalogId = x.catalogId ?? null
  return o
}
function normReaction(x, part) {
  const equation = part === 1 ? x.equation : x.equationAscii
  const unicode = part === 1 ? x.equationUnicode : x.equation
  const o = {
    equationAsInBook: x.equationAsInBook ?? null,
    equation,
    equationUnicode: unicode,
    reactants: x.reactants.map((t) => ({ formula: normFormula(t.formula), coeff: t.coeff })),
    products: x.products.map((t) => ({ formula: normFormula(t.formula), coeff: t.coeff })),
    arrow: x.arrow ?? (/⇌|⇄/.test(equation) ? '⇌' : '→'),
    conditions: x.conditions ?? null,
    type: x.type,
    isGeneralScheme: !!x.isGeneralScheme,
    isIonic: !!x.isIonic,
    context: part === 1 ? (x.fromExercise ? 'exercise' : null) : x.context,
    writtenInBook: part === 1 ? x.writtenInBook !== false : !x.describedOnly,
    page: x.page,
    pages: x.pages ?? [x.page],
    quote: x.quote ?? null,
  }
  if (x.note) o.note = x.note
  o.sourcePart = part
  o._prevBankId = x.bankId ?? null
  return o
}

const sections = []
for (const [inv, part] of [[P1, 1], [P2, 2]]) {
  for (const s of inv.sections) {
    const sec = {
      sectionId: s.sectionId ?? null,
      chapterId: s.chapterId ?? null,
      appSections: s.appSections ?? [],
      kp: s.kp,
      title: s.title,
      pageStart: s.pageStart,
      pageEnd: s.pageEnd,
      ...(s.note ? { note: s.note } : {}),
      sourcePart: part,
      substances: s.substances.map((x) => normSubstance(x, part)),
      reactions: s.reactions.map((x) => normReaction(x, part)),
      labWorks: (s.labWorks ?? []).map((l) => ({ ...l, substances: l.substances.map((t) => ({ formula: normFormula(t.formula), formulaUnicode: toUnicode(normFormula(t.formula)) })) })),
      transformationChains: s.transformationChains ?? [],
    }
    sections.push(sec)
  }
}

// ---------------- fixes from verification sampling ----------------
const fixLog = []
const helpers = { normSubstance, normReaction, toUnicode, normFormula }
for (const fix of FIXES) {
  const sec = sections.find((s) => s.kp === fix.kp)
  if (!sec) throw new Error(`fix: no section ${fix.kp}`)
  const res = fix.apply(sec, helpers)
  fixLog.push({ kp: fix.kp, what: fix.what, result: res ?? 'ok' })
}

// ---------------- structure checks ----------------
const kbOrder = KB.book.map((b) => b.kp)
const problems = []
if (sections.length !== kbOrder.length) problems.push(`section count ${sections.length} vs kb ${kbOrder.length}`)
sections.sort((a, b) => kbOrder.indexOf(a.kp) - kbOrder.indexOf(b.kp))
kbOrder.forEach((kp, i) => {
  if (sections[i]?.kp !== kp) problems.push(`order/gap at ${i}: expected ${kp} got ${sections[i]?.kp}`)
})
const seenKp = new Set()
for (const s of sections) {
  if (seenKp.has(s.kp)) problems.push(`duplicate kp ${s.kp}`)
  seenKp.add(s.kp)
  const kb = KB.book.find((b) => b.kp === s.kp)
  if (kb && kb.title !== s.title) problems.push(`title mismatch kp ${s.kp}`)
}
for (let i = 1; i < sections.length; i++) if (sections[i].pageStart > sections[i - 1].pageEnd + 1) problems.push(`page gap between kp ${sections[i - 1].kp} (${sections[i - 1].pageEnd}) and ${sections[i].kp} (${sections[i].pageStart})`)

// ---------------- balance + mapping ----------------
const balanceReport = []
for (const s of sections) {
  // dedupe identical substance entries (same formula/name + role + page) inside a section
  const seen = new Map()
  const subs = []
  for (const x of s.substances) {
    const k = `${x.formula ?? 'name:' + x.nameRu}|${x.role}|${x.page}`
    if (seen.has(k)) continue
    seen.set(k, true)
    subs.push(x)
  }
  s.substances = subs
  for (const x of s.substances) {
    const m = mapCatalog(x.formula, x.nameRu)
    const { _prevCatalogId, ...rest } = x
    Object.assign(x, rest)
    delete x._prevCatalogId
    x.catalogId = m.catalogId
    x.catalogSource = m.catalogSource
    if (m.catalogMatch) x.catalogMatch = m.catalogMatch
    if (m.catalogCandidates) x.catalogCandidates = m.catalogCandidates
    if ((_prevCatalogId ?? null) !== (m.catalogId ?? null)) x.catalogIdChangedFrom = _prevCatalogId ?? null
    if (x.formula && !tryParse(x.formula)) x.formulaParseable = false
  }
  for (const l of s.labWorks) for (const t of l.substances) Object.assign(t, (({ catalogId, catalogSource }) => ({ catalogId, catalogSource }))(mapCatalog(t.formula, null)))
  for (const r of s.reactions) {
    const prev = r._prevBankId
    delete r._prevBankId
    if (r.isGeneralScheme) {
      r.balance = { checked: false, balanced: null, reason: 'general scheme' }
    } else {
      try {
        const d = balanceOf(r)
        r.balance = { checked: true, balanced: d.length === 0, ...(d.length ? { diff: d } : {}) }
        if (d.length) balanceReport.push({ kp: s.kp, page: r.page, equation: r.equation, diff: d, note: r.note ?? null })
      } catch (e) {
        r.balance = { checked: false, balanced: null, reason: e.message }
        balanceReport.push({ kp: s.kp, page: r.page, equation: r.equation, diff: [`unparseable: ${e.message}`], note: r.note ?? null })
      }
      // cross-check arrays vs equation string
      try {
        const pe = parseEquationString(r.equation)
        if (speciesKey(pe) !== speciesKey(r) || exactKey(pe) !== exactKey(r)) r.balance.arrayMismatch = true
      } catch {
        /* conditions text not parseable -> skip */
      }
    }
    Object.assign(r, mapBank(r))
    if ((prev ?? null) !== (r.bankId ?? null)) r.bankIdChangedFrom = prev ?? null
  }
}

// ---------------- unique substances ----------------
const SLUG_TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' }
const translit = (s) => [...String(s).toLowerCase()].map((c) => SLUG_TR[c] ?? c).join('')
const slugFormula = (f) => translit(f).replace(/\^(\d*)\+/g, '$1p').replace(/\^(\d*)-/g, '$1m').replace(/·/g, 'x').replace(/[^a-z0-9]+/g, '')
const ROLE_ORDER = ['studied', 'obtained', 'reagent', 'mentioned']
const uniq = new Map()
const bookOrder = (kp) => kbOrder.indexOf(kp)
for (const s of sections) {
  const all = [...s.substances.map((x) => ({ ...x, _lab: false })), ...s.labWorks.flatMap((l) => l.substances.map((t) => ({ formula: t.formula, formulaUnicode: t.formulaUnicode, nameRu: null, kind: null, role: 'lab', page: l.page, _lab: true })))]
  for (const x of all) {
    const p = x.formula ? tryParse(x.formula) : null
    const key = x.formula ? (p ? `f:${compKey(p)}` : `raw:${x.formula}`) : `n:${String(x.nameRu).toLowerCase().replace(/\s+/g, ' ').trim()}`
    let u = uniq.get(key)
    if (!u) {
      u = { key, formulas: new Map(), names: new Map(), kinds: new Map(), sections: new Set(), roles: new Set(), firstPage: x.page, catalogId: null, catalogSource: null, catalogCandidates: null, elementSymbol: null, formulaInBook: false, nameInBookAny: false, contexts: new Set(), labOnly: true }
      uniq.set(key, u)
    }
    if (x.formula) u.formulas.set(x.formula, (u.formulas.get(x.formula) ?? 0) + 1)
    if (x.nameRu) u.names.set(x.nameRu, (u.names.get(x.nameRu) ?? 0) + (x.nameInBook ? 10 : 1))
    if (x.kind) u.kinds.set(x.kind, (u.kinds.get(x.kind) ?? 0) + 1)
    u.sections.add(s.kp)
    u.roles.add(x.role)
    if (x.page < u.firstPage) u.firstPage = x.page
    if (!x._lab) {
      u.labOnly = false
      if (x.formulaInBook) u.formulaInBook = true
      if (x.nameInBook) u.nameInBookAny = true
      if (x.context) u.contexts.add(x.context)
      if (x.elementSymbol) u.elementSymbol = x.elementSymbol
    } else u.contexts.add('lab')
  }
}
const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
const substancesOut = []
for (const u of uniq.values()) {
  const formula = top(u.formulas)
  const nameRu = top(u.names)
  const m = mapCatalog(formula, nameRu)
  const p = formula ? tryParse(formula) : null
  let kind = top(u.kinds) ?? (p ? (p.charge ? 'ion' : Object.keys(p.counts).length === 1 ? 'simple' : 'other') : 'other')
  const rec = {
    formula,
    formulaUnicode: formula ? toUnicode(formula) : null,
    ...(u.formulas.size > 1 ? { formulaVariants: [...u.formulas.keys()] } : {}),
    nameRu: nameRu ?? (m.catalogId ? catalogNameById.get(m.catalogId) : null),
    nameInBook: u.nameInBookAny,
    formulaInBook: u.formulaInBook,
    kind,
    catalogId: m.catalogId,
    catalogSource: m.catalogSource,
    ...(m.catalogMatch ? { catalogMatch: m.catalogMatch } : {}),
    ...(m.catalogCandidates ? { catalogCandidates: m.catalogCandidates } : {}),
    ...(u.elementSymbol || (p && !p.charge && Object.keys(p.counts).length === 1) ? { elementSymbol: u.elementSymbol ?? Object.keys(p.counts)[0] } : {}),
    sections: [...u.sections].sort((a, b) => bookOrder(a) - bookOrder(b)),
    roles: ROLE_ORDER.concat('lab').filter((r) => u.roles.has(r)),
    contexts: [...u.contexts].sort(),
    firstPage: u.firstPage,
  }
  if (u.labOnly) rec.labOnly = true
  substancesOut.push(rec)
}
substancesOut.sort((a, b) => a.firstPage - b.firstPage || String(a.formula ?? a.nameRu).localeCompare(String(b.formula ?? b.nameRu)))

// ---------------- unique reactions ----------------
const rxn = new Map()
for (const s of sections) {
  for (const r of s.reactions) {
    let key
    try {
      key = r.isGeneralScheme ? `gen:${r.equation}` : `${r.isIonic ? 'ion:' : ''}${speciesKey(r)}`
    } catch {
      key = `raw:${r.equation}`
    }
    let u = rxn.get(key)
    if (!u) {
      u = { first: r, sections: new Set(), pages: new Set(), conditions: new Set(), contexts: new Set(), writtenInBook: false, variants: new Set(), types: new Map() }
      rxn.set(key, u)
    }
    u.sections.add(s.kp)
    u.pages.add(r.page)
    if (r.conditions) u.conditions.add(r.conditions)
    if (r.context) u.contexts.add(r.context)
    if (r.writtenInBook) u.writtenInBook = true
    u.variants.add(r.equation)
    u.types.set(r.type, (u.types.get(r.type) ?? 0) + 1)
  }
}
const usedIds = new Map()
const reactionsOut = []
for (const u of rxn.values()) {
  const r = u.first
  let base = r.isGeneralScheme
    ? 'scheme-' + slugFormula(r.equation.replace(/[→⇌=].*$/, '')) + '--' + slugFormula(r.equation.replace(/^.*?[→⇌=](\([^)]*\))?/, ''))
    : r.reactants.map((t) => slugFormula(t.formula)).join('-') + '--' + r.products.map((t) => slugFormula(t.formula)).join('-')
  if (r.isIonic && !r.isGeneralScheme) base = 'ion-' + base
  let id = base
  const n = (usedIds.get(base) ?? 0) + 1
  usedIds.set(base, n)
  if (n > 1) id = `${base}-${n}`
  reactionsOut.push({
    id,
    equation: r.equation,
    equationUnicode: r.equationUnicode,
    ...(u.variants.size > 1 ? { equationVariants: [...u.variants] } : {}),
    reactants: r.reactants,
    products: r.products,
    arrow: r.arrow,
    conditions: [...u.conditions],
    type: top(u.types),
    sections: [...u.sections].sort((a, b) => bookOrder(a) - bookOrder(b)),
    page: Math.min(...u.pages),
    pages: [...u.pages].sort((a, b) => a - b),
    bankId: r.bankId,
    bankMatch: r.bankMatch,
    ...(r.bankIdAlternatives ? { bankIdAlternatives: r.bankIdAlternatives } : {}),
    isGeneralScheme: r.isGeneralScheme,
    isIonic: r.isIonic,
    writtenInBook: u.writtenInBook,
    contexts: [...u.contexts].sort(),
    balanced: r.balance.balanced,
  })
}
reactionsOut.sort((a, b) => a.page - b.page)

// ---------------- counts + write ----------------
const flatSubs = sections.flatMap((s) => s.substances)
const flatRx = sections.flatMap((s) => s.reactions)
const counts = {
  sections: sections.length,
  substanceEntries: flatSubs.length,
  reactionEntries: flatRx.length,
  labWorks: sections.reduce((a, s) => a + s.labWorks.length, 0),
  transformationChains: sections.reduce((a, s) => a + s.transformationChains.length, 0),
  uniqueSubstances: substancesOut.length,
  uniqueSubstancesWithFormula: substancesOut.filter((x) => x.formula).length,
  uniqueNameOnly: substancesOut.filter((x) => !x.formula).length,
  uniqueByKind: Object.fromEntries([...substancesOut.reduce((m, x) => m.set(x.kind, (m.get(x.kind) ?? 0) + 1), new Map())]),
  uniqueMappedToCatalog: substancesOut.filter((x) => x.catalogId).length,
  uniqueReactions: reactionsOut.length,
  uniqueReactionsGeneralSchemes: reactionsOut.filter((x) => x.isGeneralScheme).length,
  uniqueReactionsIonic: reactionsOut.filter((x) => x.isIonic).length,
  uniqueReactionsMappedToBank: reactionsOut.filter((x) => x.bankId).length,
  balanceProblems: balanceReport.length,
}
const out = {
  grade: 8,
  source: 'public/textbooks/kimyo-8-ru.pdf (Химия 8, рус. изд.)',
  generatedAt: new Date().toISOString(),
  mergedFrom: ['src/data/textbook/inventory-g8-part1.json (kp 1–23)', 'src/data/textbook/inventory-g8-part2.json (kp 24–44 + lab)'],
  schema: {
    substance: 'formula (ASCII digits, · for hydrates, ^n± charge) | formulaUnicode | formulaInBook (false = formula not printed, inferred from name) | nameRu | nameInBook | kind (simple/oxide/acid/base/salt/organic/ion/other) | role (studied/obtained/reagent/mentioned) | page | pages | context (text/example/exercise/table/figure/history/lab; null = not recorded in part 1) | quote | catalogId | catalogSource | catalogMatch? | catalogCandidates? | fromEquationOnly? | note? | sourcePart',
    reaction: 'equationAsInBook | equation (ASCII) | equationUnicode | reactants/products [{formula, coeff}] | arrow | conditions | type | isGeneralScheme | isIonic | context | writtenInBook (false = described in words / equation composed) | page | pages | quote | balance {checked, balanced, diff?} | bankId | bankMatch (exact/species/step-of-multistep) | note? | sourcePart',
  },
  notes: [...(P1.notes ?? []), ...(P2.uncertain ?? [])],
  verification: fixLog,
  structureProblems: problems,
  balanceReport,
  bankUnparsed,
  counts,
  sections,
}
const w = (p, d) => fs.writeFileSync(path.join(ROOT, p), JSON.stringify(d, null, 1) + '\n')
w('src/data/textbook/inventory-g8.json', out)
w('src/data/textbook/substances-g8.json', { grade: 8, generatedAt: out.generatedAt, from: 'src/data/textbook/inventory-g8.json', count: substancesOut.length, substances: substancesOut })
w('src/data/textbook/reactions-g8.json', { grade: 8, generatedAt: out.generatedAt, from: 'src/data/textbook/inventory-g8.json', count: reactionsOut.length, reactions: reactionsOut })

console.log(JSON.stringify(counts, null, 1))
console.log('structure problems:', problems)
console.log('balance problems:', JSON.stringify(balanceReport, null, 1))
console.log('bank unparsed:', bankUnparsed)
console.log('array/equation mismatches:', flatRx.filter((r) => r.balance.arrayMismatch).map((r) => `${r.page}: ${r.equation}`))
console.log('catalogId changed vs halves:', flatSubs.filter((x) => 'catalogIdChangedFrom' in x).map((x) => `${x.formula}: ${x.catalogIdChangedFrom} -> ${x.catalogId}`).filter((v, i, a) => a.indexOf(v) === i))
console.log('bankId changed vs halves:', flatRx.filter((r) => 'bankIdChangedFrom' in r).map((r) => `${r.page} ${r.equation}: ${r.bankIdChangedFrom} -> ${r.bankId} (${r.bankMatch})`))
console.log('unparseable formulas:', [...new Set(flatSubs.filter((x) => x.formulaParseable === false).map((x) => x.formula))])
console.log('fixes:', fixLog)
