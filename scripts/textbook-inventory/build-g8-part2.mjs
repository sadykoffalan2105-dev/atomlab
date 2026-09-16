/**
 * Builds src/data/textbook/inventory-g8-part2.json from the compact batch files in ./g8p2/.
 * - expands tuples, derives formulaUnicode, parses equations into reactants/products,
 * - checks atom + charge balance, maps substances to catalog ids, reactions to SCHOOL_REACTION_BANK ids,
 * - auto-adds substances that appear only inside equations (nameFromBook=false).
 * Requires scripts/textbook-inventory/.cache/catalog.json (run: npx tsx scripts/textbook-inventory/dump-catalog.mts).
 * Usage: node scripts/textbook-inventory/build-g8-part2.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'))

const catalog = JSON.parse(fs.readFileSync(path.join(here, '.cache', 'catalog.json'), 'utf8'))
const sectionsIdx = readJson('src/data/kb/corpus/kb-sections.json').g8.book
const chunks = readJson('src/data/kb/corpus/kb-corpus-g8.json').chunks

const batches = []
for (const f of ['batch1.mjs', 'batch2.mjs', 'batch3.mjs', 'batch4.mjs']) {
  const mod = await import(pathToFileURL(path.join(here, 'g8p2', f)).href)
  batches.push(...mod.default)
}

// ---------- formula helpers ----------
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' }
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' }
const UNSUB = Object.fromEntries(Object.entries(SUB).map(([k, v]) => [v, k]))
const UNSUP = Object.fromEntries(Object.entries(SUP).map(([k, v]) => [v, k]))

function toUnicode(f) {
  if (!f) return null
  let [body, charge] = f.split('^')
  const parts = body.split('·').map((part, i) => {
    let lead = ''
    if (i > 0) {
      const m = part.match(/^(\d+(?:\.\d+)?)(.*)$/)
      if (m) {
        lead = m[1] === '0.5' ? '½' : m[1]
        part = m[2]
      }
    }
    return lead + part.replace(/([A-Za-z)\]])(\d+)/g, (_, a, d) => a + [...d].map((c) => SUB[c]).join(''))
  })
  let out = parts.join('·')
  if (charge) {
    const m = charge.match(/^(\d*)([+-])$/)
    out += (m[1] === '1' ? '' : [...m[1]].map((c) => SUP[c]).join('')) + SUP[m[2]]
  }
  return out
}

function fromUnicode(s) {
  return s
    .replace(/[₀-₉]/g, (c) => UNSUB[c])
    .replace(/([⁰-⁹]*)([⁺⁻])/g, (_, d, sgn) => '^' + [...d].map((c) => UNSUP[c]).join('') + UNSUP[sgn])
    .replace(/[•∙⋅]/g, '·')
}

/** Parses an ASCII formula into {counts, charge}. Returns null for non-formulas. */
function parseFormula(f) {
  if (!f || /[^A-Za-z0-9()[\]·.^+\-]/.test(f)) return null
  let [body, chargeStr] = f.split('^')
  let charge = 0
  if (chargeStr) {
    const m = chargeStr.match(/^(\d*)([+-])$/)
    if (!m) return null
    charge = (m[1] ? Number(m[1]) : 1) * (m[2] === '+' ? 1 : -1)
  }
  const counts = {}
  for (const [i, partRaw] of body.split('·').entries()) {
    let part = partRaw
    let mult = 1
    if (i > 0) {
      const m = part.match(/^(\d+(?:\.\d+)?)(.*)$/)
      if (m) {
        mult = Number(m[1])
        part = m[2]
      }
    }
    const stack = [{}]
    let j = 0
    while (j < part.length) {
      const ch = part[j]
      if (ch === '(' || ch === '[') {
        stack.push({})
        j++
      } else if (ch === ')' || ch === ']') {
        j++
        let num = ''
        while (j < part.length && /\d/.test(part[j])) num += part[j++]
        const grp = stack.pop()
        const top = stack[stack.length - 1]
        for (const [el, n] of Object.entries(grp)) top[el] = (top[el] || 0) + n * (num ? Number(num) : 1)
      } else if (/[A-Z]/.test(ch)) {
        let el = ch
        j++
        while (j < part.length && /[a-z]/.test(part[j])) el += part[j++]
        let num = ''
        while (j < part.length && /\d/.test(part[j])) num += part[j++]
        const top = stack[stack.length - 1]
        top[el] = (top[el] || 0) + (num ? Number(num) : 1)
      } else return null
    }
    if (stack.length !== 1) return null
    for (const [el, n] of Object.entries(stack[0])) counts[el] = (counts[el] || 0) + n * mult
  }
  return { counts, charge }
}

const compKey = (counts) =>
  Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}:${n}`)
    .join('|')

// ---------- catalog indexes ----------
const compoundsByKey = new Map()
for (const c of catalog.compounds) {
  const k = compKey(c.composition)
  if (!compoundsByKey.has(k)) compoundsByKey.set(k, [])
  compoundsByKey.get(k).push(c)
}
const organicByKey = new Map()
const organicByName = new Map()
for (const o of catalog.organic) {
  const p = parseFormula(fromUnicode(o.formula).replace(/\s/g, ''))
  if (p) {
    const k = compKey(p.counts)
    if (!organicByKey.has(k)) organicByKey.set(k, [])
    organicByKey.get(k).push(o)
  }
  organicByName.set(o.nameRu.toLowerCase(), o)
}

function mapCatalog(formula, nameRu, kind) {
  if (!formula) {
    const o = nameRu && organicByName.get(nameRu.toLowerCase())
    return o ? { catalogId: o.id, catalogSource: 'organic' } : { catalogId: null }
  }
  const p = parseFormula(formula)
  if (!p || p.charge !== 0) return { catalogId: null }
  const k = compKey(p.counts)
  const inorg = compoundsByKey.get(k) || []
  const org = organicByKey.get(k) || []
  const pick = (list) => list.find((c) => fromUnicode(c.formulaUnicode || c.formula || '').replace(/\s/g, '') === formula) || list[0]
  if (kind === 'organic' && org.length) return { catalogId: pick(org).id, catalogSource: 'organic' }
  if (inorg.length) {
    const c = pick(inorg)
    return { catalogId: c.id, catalogSource: 'inorganic', ...(inorg.length > 1 ? { catalogAlternatives: inorg.map((x) => x.id) } : {}) }
  }
  if (org.length) return { catalogId: pick(org).id, catalogSource: 'organic' }
  return { catalogId: null }
}

// ---------- equations ----------
const ARROW = /\s*(→|⇌|⇄|=)(\([^)]*\))?\s*/
function parseSide(side) {
  return side
    .split(/\s+\+\s+/)
    .map((t) => t.trim())
    .filter((t) => t && !/^Q$/.test(t))
    .map((t) => {
      let s = t.replace(/[↑↓]/g, '').replace(/\((конц|разб|сильно разб|хол|белый|красный)\.?\)/g, '').trim()
      const m = s.match(/^(\d+(?:\.\d+)?|n)?\s*(.+)$/)
      const coeff = m[1] === 'n' ? 'n' : m[1] ? Number(m[1]) : 1
      const f = m[2]
      const parsed = parseFormula(f)
      return { formula: parsed ? f : null, label: parsed ? undefined : f, coeff }
    })
}
function parseEquation(eq) {
  const clean = eq.replace(/\s*[−-]\s*Q\s*$/, '').replace(/\s*\+\s*Q\s*$/, '').replace(/\s*[+−-]\s*[\d,]+\s*кДж\s*$/, '')
  const m = clean.match(ARROW)
  if (!m) return null
  const idx = clean.indexOf(m[0])
  return {
    arrow: m[1] === '⇄' ? '⇌' : m[1],
    reactants: parseSide(clean.slice(0, idx)),
    products: parseSide(clean.slice(idx + m[0].length)),
  }
}
function balance(r) {
  const tally = (side) => {
    const acc = {}
    let charge = 0
    for (const t of side) {
      if (!t.formula || t.coeff === 'n') return null
      const p = parseFormula(t.formula)
      for (const [el, n] of Object.entries(p.counts)) acc[el] = (acc[el] || 0) + n * t.coeff
      charge += p.charge * t.coeff
    }
    return { acc, charge }
  }
  const L = tally(r.reactants)
  const R = tally(r.products)
  if (!L || !R) return { checked: false }
  const els = new Set([...Object.keys(L.acc), ...Object.keys(R.acc)])
  const diff = [...els].filter((e) => Math.abs((L.acc[e] || 0) - (R.acc[e] || 0)) > 1e-9)
  const chargeOk = Math.abs(L.charge - R.charge) < 1e-9
  return { checked: true, balanced: diff.length === 0 && chargeOk, ...(diff.length ? { unbalancedElements: diff } : {}), ...(chargeOk ? {} : { chargeMismatch: [L.charge, R.charge] }) }
}

// bank reactions
const bank = catalog.reactions.map((b) => {
  const eq = fromUnicode(b.equationRu)
  return { id: b.id, eq: b.equationRu, parsed: parseEquation(eq) }
})
const speciesKey = (side) => side.map((t) => t.formula || t.label).sort().join('+')
const coeffKey = (side) => side.map((t) => `${t.coeff}${t.formula || t.label}`).sort().join('+')
function mapBank(parsed) {
  if (!parsed) return {}
  const rs = speciesKey(parsed.reactants)
  const ps = speciesKey(parsed.products)
  for (const b of bank) {
    if (!b.parsed) continue
    const same = speciesKey(b.parsed.reactants) === rs && speciesKey(b.parsed.products) === ps
    if (same) {
      const exact = coeffKey(b.parsed.reactants) === coeffKey(parsed.reactants) && coeffKey(b.parsed.products) === coeffKey(parsed.products)
      return { bankId: b.id, ...(exact ? {} : { bankNote: `same species, different coefficients: ${b.eq}` }) }
    }
  }
  return { bankId: null }
}

// ---------- kind heuristic for auto-added substances ----------
function guessKind(formula, catalogHit) {
  const p = parseFormula(formula)
  if (!p) return 'other'
  if (p.charge !== 0) return 'other'
  const els = Object.keys(p.counts)
  if (els.length === 1) return 'simple'
  if (catalogHit?.catalogSource === 'organic') return 'organic'
  if (catalogHit?.catalogId) {
    const c = catalog.compounds.find((x) => x.id === catalogHit.catalogId)
    if (c && ['oxide', 'acid', 'base', 'salt'].includes(c.category)) return c.category === 'oxide' && formula === 'H2O' ? 'oxide' : c.category
  }
  if (els.length === 2 && els.includes('O')) return 'oxide'
  if (formula.startsWith('H') && !formula.includes('OH')) return 'acid'
  if (/OH\)|OH$/.test(formula)) return 'base'
  return 'salt'
}

const NAME_FALLBACK = { Na: 'натрий', Al: 'алюминий', Zn: 'цинк', Fe: 'железо', Cl2: 'хлор', F2: 'фтор', H2: 'водород', O2: 'кислород', S: 'сера', C: 'углерод', K: 'калий', N2: 'азот', Cu: 'медь', Pb: 'свинец', Ag: 'серебро', Ca: 'кальций', P: 'фосфор', SCl2: 'хлорид серы(II)', 'Ca3(PO4)2': 'фосфат кальция', Cu2S: 'сульфид меди(I)', NaHSO4: 'гидросульфат натрия', AuCl3: 'хлорид золота(III)', PtCl4: 'хлорид платины(IV)', P2S3: 'сульфид фосфора(III)', PCl3: 'хлорид фосфора(III)', Ca3P2: 'фосфид кальция', 'H^+': 'ион водорода', NaNH4HPO4: 'гидрофосфат натрия-аммония', NaPO3: 'метафосфат натрия', 'Ca(H2PO4)2': 'дигидрофосфат кальция', CaHPO4: 'гидрофосфат кальция' }
// ---------- assemble ----------
const bookByKp = new Map(sectionsIdx.map((s) => [s.kp, s]))
const uncertain = []
const out = { grade: 8, part: 2, source: 'public/textbooks/kimyo-8-ru.pdf (Химия 8, Аскаров/Гапиров/Тухтабаев, рус.)', generatedAt: new Date().toISOString(), splitRule: 'kb-sections.json g8.book: 45 entries; part 2 = entries 23..44 (kp 24–44 + lab)', sections: [] }
const splitStart = Math.ceil(sectionsIdx.length / 2)
const expectedKps = sectionsIdx.slice(splitStart).map((s) => s.kp)
const gotKps = batches.map((b) => b.kp)
if (expectedKps.join() !== gotKps.join()) throw new Error(`kp mismatch: expected ${expectedKps} got ${gotKps}`)

for (const b of batches) {
  const book = bookByKp.get(b.kp)
  const ch = chunks.filter((c) => c.kp === b.kp)
  const pageStart = b.pageStartOverride ?? Math.min(...ch.map((c) => c.pageStart))
  const pageEnd = b.kp === 'lab' ? 204 : Math.max(...ch.map((c) => c.pageEnd))
  const sec = {
    sectionId: ch[0]?.sectionId ?? null,
    chapterId: ch[0]?.chapterId ?? null,
    appSections: book.appSections,
    kp: b.kp,
    title: book.title,
    pageStart,
    pageEnd,
    substances: [],
    reactions: [],
    labWorks: [],
    transformationChains: [],
  }
  for (const [formula0, nameRu, kind, role, page, quote, context, extra = {}] of b.substances) {
    if (extra.skip) continue
    const formula = extra.nullFormula ? null : formula0
    if (formula && !/·n/.test(formula) && !parseFormula(formula)) uncertain.push(`§${b.kp}: unparsable formula ${formula}`)
    const map = mapCatalog(formula, nameRu, kind)
    const p = formula && parseFormula(formula)
    const s = {
      formula,
      formulaUnicode: toUnicode(formula),
      nameRu,
      nameFromBook: true,
      kind,
      role,
      page,
      quote: quote.slice(0, 160),
      context,
      ...(extra.inferred ? { formulaInferred: true } : {}),
      ...(p && Object.keys(p.counts).length === 1 && p.charge === 0 ? { elementSymbol: Object.keys(p.counts)[0] } : {}),
      ...(p && p.charge !== 0 ? { isIon: true } : {}),
      ...map,
      ...(extra.note ? { note: extra.note } : {}),
    }
    sec.substances.push(s)
  }
  for (const [asBook, equation, conditions, type, page, quote, flags = {}] of b.reactions) {
    const parsed = parseEquation(equation)
    if (!parsed) uncertain.push(`§${b.kp}: cannot parse equation ${equation}`)
    const bal = parsed && !flags.g ? balance(parsed) : { checked: false }
    if (bal.checked && !bal.balanced) uncertain.push(`§${b.kp} p.${page}: UNBALANCED ${equation} ${JSON.stringify(bal)}`)
    const r = {
      equationAsInBook: asBook,
      equation: equation.replace(/([A-Za-z)\]])(\d+)/g, (_, a, d) => a + [...d].map((c) => SUB[c]).join('')).replace(/\^(\d*)([+-])/g, (_, d, s) => [...d].map((c) => SUP[c]).join('') + SUP[s]),
      equationAscii: equation,
      reactants: parsed ? parsed.reactants : [],
      products: parsed ? parsed.products : [],
      arrow: parsed?.arrow ?? null,
      conditions,
      type,
      isGeneralScheme: Boolean(flags.g),
      isIonic: Boolean(flags.i),
      ...(flags.described ? { describedOnly: true } : {}),
      context: flags.ctx || 'text',
      page,
      quote: quote.slice(0, 160),
      balance: bal,
      ...(parsed && !flags.g ? mapBank(parsed) : { bankId: null }),
      ...(flags.note ? { note: flags.note } : {}),
    }
    sec.reactions.push(r)
    // auto-add species not listed explicitly
    if (parsed && !flags.g) {
      for (const [side, role] of [[parsed.reactants, 'reagent'], [parsed.products, 'obtained']]) {
        for (const t of side) {
          if (!t.formula) continue
          if (sec.substances.some((s) => s.formula === t.formula)) continue
          const map = mapCatalog(t.formula, null, null)
          const p = parseFormula(t.formula)
          const catName = map.catalogId ? (catalog.compounds.find((c) => c.id === map.catalogId) || catalog.organic.find((o) => o.id === map.catalogId))?.nameRu : null
          sec.substances.push({
            formula: t.formula,
            formulaUnicode: toUnicode(t.formula),
            nameRu: catName ?? NAME_FALLBACK[t.formula] ?? null,
            nameFromBook: false,
            nameSource: catName ? 'catalog' : NAME_FALLBACK[t.formula] ? 'inventory' : null,
            kind: guessKind(t.formula, map),
            role,
            page,
            quote: asBook.slice(0, 160),
            context: flags.ctx || 'text',
            ...(Object.keys(p.counts).length === 1 && p.charge === 0 ? { elementSymbol: Object.keys(p.counts)[0] } : {}),
            ...(p.charge !== 0 ? { isIon: true } : {}),
            ...map,
            autoFromEquation: true,
          })
        }
      }
    }
  }
  for (const [title, page, subs] of b.labWorks) {
    sec.labWorks.push({ title, page, substances: subs.map((f) => ({ formula: f, formulaUnicode: toUnicode(f), ...mapCatalog(f, null, null) })) })
  }
  for (const [scheme, page, context] of b.chains || []) sec.transformationChains.push({ scheme, page, context })
  out.sections.push(sec)
}

// ---------- summary ----------
const allSubs = out.sections.flatMap((s) => s.substances)
const allRx = out.sections.flatMap((s) => s.reactions)
const uniqFormulas = new Set(allSubs.filter((s) => s.formula).map((s) => s.formula))
const uniqNamedNoFormula = new Set(allSubs.filter((s) => !s.formula).map((s) => s.nameRu))
const unmapped = [...new Set(allSubs.filter((s) => s.formula && !s.catalogId && !s.elementSymbol && !s.isIon).map((s) => s.formula))].sort()
out.summary = {
  sections: out.sections.length,
  substanceEntries: allSubs.length,
  substanceEntriesFromBookText: allSubs.filter((s) => s.nameFromBook).length,
  uniqueFormulas: uniqFormulas.size,
  uniqueNameOnlySubstances: uniqNamedNoFormula.size,
  reactions: allRx.length,
  reactionsWithFormulaEquations: allRx.filter((r) => !r.isGeneralScheme).length,
  generalSchemes: allRx.filter((r) => r.isGeneralScheme).length,
  ionicEquations: allRx.filter((r) => r.isIonic).length,
  describedOnlyReactions: allRx.filter((r) => r.describedOnly).length,
  balanceChecked: allRx.filter((r) => r.balance.checked).length,
  balanceFailures: allRx.filter((r) => r.balance.checked && !r.balance.balanced).length,
  reactionsMappedToBank: allRx.filter((r) => r.bankId).length,
  uniqueBankIds: new Set(allRx.filter((r) => r.bankId).map((r) => r.bankId)).size,
  labWorks: out.sections.reduce((n, s) => n + s.labWorks.length, 0),
  transformationChains: out.sections.reduce((n, s) => n + s.transformationChains.length, 0),
  uniqueFormulasMappedToCatalog: [...uniqFormulas].filter((f) => allSubs.find((s) => s.formula === f && s.catalogId)).length,
  unmappedCompoundFormulas: unmapped,
}
out.uncertain = uncertain
const dest = path.join(root, 'src', 'data', 'textbook', 'inventory-g8-part2.json')
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n')
console.log(JSON.stringify(out.summary, null, 1))
console.log('uncertain:', uncertain)
