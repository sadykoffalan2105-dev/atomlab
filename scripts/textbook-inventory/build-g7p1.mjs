/**
 * Build src/data/textbook/inventory-g7-part1.json from hand-extracted data files.
 * Usage: node scripts/textbook-inventory/build-g7p1.mjs <catalog-dump.json>
 *   (catalog dump produced by: npx tsx scripts/textbook-inventory/dump-catalog-g7p1.mts <out.json>)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { toUnicode, toAscii, parseFormula, compKey, parseEquation, checkBalance } from './chem-utils-g7p1.mjs'
import { C1 } from './g7p1-data-c1.mjs'
import { C2 } from './g7p1-data-c2.mjs'
import { C34 } from './g7p1-data-c34.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const catalogPath = process.argv[2]
if (!catalogPath) throw new Error('pass catalog dump path')
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))

const DATA = { ...C1, ...C2, ...C34 }

// ---- sections (part 1 = first ceil(N/2) sections of grade 7) ----
const sectionsAll = JSON.parse(fs.readFileSync(path.join(root, 'src/data/kb/corpus/kb-sections.json'), 'utf8')).g7
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'src/data/kb/corpus/kb-corpus-g7.json'), 'utf8')).chunks
const half = Math.ceil(sectionsAll.length / 2)
const part1 = sectionsAll.slice(0, half)
const pageRange = {}
for (const ch of corpus) {
  const k = `${ch.chapterId}-${ch.sectionId}`
  const r = (pageRange[k] ??= { ps: 1e9, pe: 0 })
  r.ps = Math.min(r.ps, ch.pageStart)
  r.pe = Math.max(r.pe, ch.pageEnd)
}

// ---- catalog indexes ----
const compByKey = new Map()
for (const c of catalog.compounds) {
  const k = compKey(c.composition)
  if (!compByKey.has(k)) compByKey.set(k, [])
  compByKey.get(k).push({ id: c.id, nameRu: c.nameRu, source: 'inorganic' })
}
const orgByKey = new Map()
for (const m of catalog.organic) {
  const k = compKey(parseFormula(toAscii(m.formula)))
  if (!k) continue
  if (!orgByKey.has(k)) orgByKey.set(k, [])
  orgByKey.get(k).push({ id: m.id, nameRu: m.nameRu, source: 'organic' })
}

const ELEMENTS = new Set(
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '),
)

function mapSubstance(s) {
  if (!s.formula) return { catalogId: null }
  const counts = parseFormula(s.formula)
  if (!counts) return { catalogId: null, parseError: true }
  for (const e of Object.keys(counts)) if (!ELEMENTS.has(e)) return { catalogId: null, parseError: true }
  const keys = Object.keys(counts)
  if (keys.length === 1) return { catalogId: null, element: keys[0] }
  const k = compKey(counts)
  let cands = [...(compByKey.get(k) ?? []), ...(orgByKey.get(k) ?? [])]
  if (cands.length > 1) {
    const nm = (s.nameRu ?? '').toLowerCase()
    const byName = cands.filter((c) => {
      const stem = c.nameRu.toLowerCase().replace(/[^а-яё]/g, '').slice(0, 5)
      return stem.length >= 4 && nm.includes(stem)
    })
    if (byName.length) cands = [...byName, ...cands.filter((c) => !byName.includes(c))]
  }
  const out = { catalogId: cands[0]?.id ?? null }
  if (cands.length > 1) out.catalogCandidates = cands.map((c) => c.id)
  return out
}

// ---- reaction bank index ----
function sideKeys(list) {
  return list
    .map((t) => `${t.coeff}*${compKey(parseFormula(t.formula))}`)
    .sort()
    .join('+')
}
function sideSpecies(list) {
  return list
    .map((t) => compKey(parseFormula(t.formula)))
    .sort()
    .join('+')
}
const bank = []
for (const r of catalog.reactions) {
  for (const part of r.equationRu.split(';')) {
    const p = parseEquation(part.trim())
    if (!p) continue
    if ([...p.reactants, ...p.products].some((t) => !parseFormula(t.formula))) continue
    bank.push({
      id: r.id,
      exact: sideKeys(p.reactants) + '=>' + sideKeys(p.products),
      species: sideSpecies(p.reactants) + '=>' + sideSpecies(p.products),
    })
  }
}

function mapReaction(reactants, products) {
  if (!reactants.length || !products.length) return { bankId: null }
  if ([...reactants, ...products].some((t) => !t.formula || !parseFormula(t.formula))) return { bankId: null }
  const exact = sideKeys(reactants) + '=>' + sideKeys(products)
  const species = sideSpecies(reactants) + '=>' + sideSpecies(products)
  const e = bank.find((b) => b.exact === exact)
  if (e) return { bankId: e.id, bankMatch: 'exact' }
  const s = bank.find((b) => b.species === species)
  if (s) return { bankId: s.id, bankMatch: 'same-species-different-coefficients' }
  return { bankId: null }
}

const warnings = []

function buildReaction(r, sectionId) {
  let reactants = r.reactants
  let products = r.products
  let arrow = null
  if (!reactants || !products) {
    const p = parseEquation(r.equation)
    if (!p) {
      warnings.push(`${sectionId} p${r.page}: cannot parse "${r.equation}"`)
      reactants = []
      products = []
    } else {
      reactants = p.reactants
      products = p.products
      arrow = p.arrow
    }
  }
  const bal =
    reactants.length && products.length && reactants.every((t) => t.formula) && products.every((t) => t.formula)
      ? checkBalance(reactants, products)
      : { balanced: null, parsed: false }
  if (bal.parsed && bal.balanced === false) warnings.push(`${sectionId} p${r.page}: UNBALANCED "${r.equation}" ${JSON.stringify(bal.diff)}`)
  const eqUnicode = r.equation
    .split(/(\s+)/)
    .map((tok) => (/^\d*[A-Z(\[][A-Za-z0-9()\[\]*^+-]*[↑↓]?$/.test(tok) ? uniTerm(tok) : tok))
    .join('')
    .replace(/e\^-/g, 'e⁻')
  const out = {
    equationAsInBook: r.equationAsInBook ?? null,
    equation: eqUnicode,
    equationAscii: r.equation,
    reactants: reactants.map((t) => ({ formula: t.formula ?? null, ...(t.name ? { name: t.name } : {}), coeff: t.coeff })),
    products: products.map((t) => ({ formula: t.formula ?? null, ...(t.name ? { name: t.name } : {}), coeff: t.coeff })),
    conditions: r.conditions ?? null,
    type: r.type,
    isGeneralScheme: r.isGeneralScheme ?? false,
    isIonic: r.isIonic ?? false,
    reversible: arrow === '⇌' || arrow === '⇄' || /⇌|⇄/.test(r.equation),
    balanced: bal.balanced,
    page: r.page,
    quote: r.quote,
    printedInBook: r.equationAsInBook != null && /[A-Z]/.test(r.equationAsInBook) && /→|=|⟶/.test(r.equationAsInBook),
    fromExercise: r.fromExercise ?? false,
    ...mapReaction(reactants, products),
  }
  if (r.note) out.note = r.note
  return out
}

function uniTerm(tok) {
  // leading coefficient stays normal digits; the rest -> subscripts
  const m = tok.match(/^(\d*)(.*?)([↑↓]?)$/)
  const body = m[2]
  const [f, charge] = body.includes('^') ? [body.slice(0, body.indexOf('^')), body.slice(body.indexOf('^'))] : [body, '']
  return m[1] + toUnicode(f + charge) + m[3]
}

const sections = []
let nSub = 0
let nReact = 0
let nLab = 0
const uniq = new Set()
for (const sec of part1) {
  const d = DATA[sec.id]
  if (!d) {
    warnings.push(`missing data for ${sec.id}`)
    continue
  }
  const [chapterId] = sec.id.split('-')
  const pr = pageRange[sec.id]
  const substances = d.substances.map((s) => {
    if (s.quote && s.quote.length > 160) warnings.push(`${sec.id}: quote >160 (${s.quote.length}) for ${s.nameRu}`)
    const m = mapSubstance(s)
    if (m.parseError) warnings.push(`${sec.id}: formula parse error ${s.formula}`)
    const o = {
      formula: s.formula,
      formulaUnicode: toUnicode(s.formula),
      formulaInBook: s.formulaInBook,
      nameRu: s.nameRu,
      kind: s.kind,
      role: s.role,
      page: s.page,
      quote: s.quote,
      catalogId: m.catalogId,
    }
    if (m.element) o.element = m.element
    if (m.catalogCandidates) o.catalogCandidates = m.catalogCandidates
    if (s.fromExercise) o.fromExercise = true
    if (s.note) o.note = s.note
    if (s.formula) uniq.add(compKey(parseFormula(s.formula)) + '|' + s.formula)
    return o
  })
  const reactions = d.reactions.map((r) => {
    if (r.quote && r.quote.length > 160) warnings.push(`${sec.id}: reaction quote >160 (${r.quote.length}) p${r.page}`)
    return buildReaction(r, sec.id)
  })
  nSub += substances.length
  nReact += reactions.length
  nLab += d.labWorks.length
  const entry = {
    sectionId: sec.id,
    chapterId,
    kp: sec.kp,
    title: sec.title,
    pageStart: pr.ps,
    pageEnd: pr.pe,
    substances,
    reactions,
    labWorks: d.labWorks,
  }
  if (d.elementsMentioned) entry.elementsMentioned = d.elementsMentioned
  if (d.notes) entry.notes = d.notes
  sections.push(entry)
}

// unique formulas by composition
const uniqKeys = new Set([...uniq].map((u) => u.split('|')[0]))
const allSubs = sections.flatMap((s) => s.substances)
const mapped = new Set(allSubs.filter((s) => s.catalogId).map((s) => s.catalogId))
const unmappedCompounds = [...new Set(allSubs.filter((s) => s.formula && !s.catalogId && !s.element).map((s) => s.formula))]
const allReacts = sections.flatMap((s) => s.reactions)

const out = {
  grade: 7,
  part: 1,
  source: 'public/textbooks/kimyo-7-ru-2022.pdf',
  generatedAt: new Date().toISOString(),
  generator: 'scripts/textbook-inventory/build-g7p1.mjs',
  sectionRange: { first: part1[0].id, last: part1[part1.length - 1].id, count: part1.length, ofTotal: sectionsAll.length },
  legend: {
    formulaInBook: 'true = formula printed in the book (text or verified picture); false = inferred from an unambiguous name',
    fromExercise: 'substance/reaction appears only in an exercise, test or problem',
    'reaction.equationAsInBook': 'null = reaction only described in words; equation reconstructed (see note)',
    bankMatch: 'exact | same-species-different-coefficients',
    element: 'simple substance: element symbol (catalog has no simple-substance ids)',
  },
  stats: {
    sections: sections.length,
    substances: allSubs.length,
    uniqueFormulas: uniqKeys.size,
    substancesWithoutFormula: allSubs.filter((s) => !s.formula).length,
    catalogIdsMatched: mapped.size,
    unmappedCompoundFormulas: unmappedCompounds.length,
    reactions: allReacts.length,
    reactionsWithFormulaEquationPrinted: allReacts.filter((r) => r.printedInBook).length,
    reactionsDescribedInWordsOnly: allReacts.filter((r) => !r.equationAsInBook).length,
    reactionsFromExercises: allReacts.filter((r) => r.fromExercise).length,
    reactionsWithBankId: allReacts.filter((r) => r.bankId).length,
    labWorks: nLab,
  },
  unmappedCompoundFormulas: unmappedCompounds,
  sections,
}
const outFile = path.join(root, 'src/data/textbook/inventory-g7-part1.json')
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n', 'utf8')
console.log(JSON.stringify(out.stats, null, 1))
console.log('warnings:\n' + warnings.join('\n'))
