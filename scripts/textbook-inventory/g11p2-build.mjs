/**
 * Build src/data/textbook/inventory-g11-part2.json from g11p2-data.mjs:
 *  - parses formulas/equations, checks atom + charge balance,
 *  - maps substances to catalog (compoundById / organic registry) and reactions to SCHOOL_REACTION_BANK,
 *  using the catalog cache scripts/textbook-inventory/.cache/catalog.json (made by dump-catalog.mts).
 * Usage: node scripts/textbook-inventory/g11p2-build.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SECTIONS } from './g11p2-data.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const catalog = JSON.parse(fs.readFileSync(path.join(here, '.cache', 'catalog.json'), 'utf8'))
const kbSections = JSON.parse(fs.readFileSync(path.join(root, 'src/data/kb/corpus/kb-sections.json'), 'utf8')).g11
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'src/data/kb/corpus/kb-corpus-g11.json'), 'utf8')).chunks

// ───────── formula utils ─────────
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' }
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' }
const UNSUB = Object.fromEntries(Object.entries(SUB).map(([k, v]) => [v, k]))
const UNSUP = Object.fromEntries(Object.entries(SUP).map(([k, v]) => [v, k]))

export function toUnicode(f) {
  if (f == null) return null
  const [body, charge] = f.split('^')
  const parts = body.split('·').map((p, i) => {
    let lead = ''
    if (i > 0) { const m = p.match(/^\d+/); if (m) { lead = m[0]; p = p.slice(lead.length) } }
    return lead + p.replace(/([A-Za-z)\]])(\d+)/g, (_, a, d) => a + [...d].map((c) => SUB[c]).join(''))
  })
  let out = parts.join('·')
  if (charge) {
    out += charge === 'e-' ? '' : [...charge].map((c) => SUP[c] ?? c).join('')
  }
  return out
}

const ELEMENTS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U'.split(' '))

/** returns {counts, charge} or null if not parseable (e.g. general scheme letters) */
export function parseFormula(f) {
  if (f === 'e^-' || f === 'e') return { counts: {}, charge: -1, electron: true }
  let [body, ch] = f.split('^')
  let charge = 0
  if (ch) {
    const m = ch.match(/^(\d*)([+-])$/)
    if (!m) return null
    charge = (m[1] ? Number(m[1]) : 1) * (m[2] === '+' ? 1 : -1)
  }
  const counts = {}
  for (let part of body.split('·')) {
    let mult = 1
    const lm = part.match(/^(\d+)(?=[A-Z(])/)
    if (lm) { mult = Number(lm[1]); part = part.slice(lm[1].length) }
    const stack = [{}]
    let i = 0
    while (i < part.length) {
      const c = part[i]
      if (c === '(' || c === '[') { stack.push({}); i++; continue }
      if (c === ')' || c === ']') {
        i++
        let d = ''
        while (i < part.length && /\d/.test(part[i])) d += part[i++]
        const n = d ? Number(d) : 1
        const top = stack.pop()
        const cur = stack[stack.length - 1]
        for (const [e, k] of Object.entries(top)) cur[e] = (cur[e] || 0) + k * n
        continue
      }
      const m = part.slice(i).match(/^([A-Z][a-z]?)(\d*)/)
      if (!m || !ELEMENTS.has(m[1])) return null
      const cur = stack[stack.length - 1]
      cur[m[1]] = (cur[m[1]] || 0) + (m[2] ? Number(m[2]) : 1)
      i += m[0].length
    }
    if (stack.length !== 1) return null
    for (const [e, k] of Object.entries(stack[0])) counts[e] = (counts[e] || 0) + k * mult
  }
  return { counts, charge }
}

const compKey = (p) => (p ? Object.keys(p.counts).sort().map((e) => `${e}${p.counts[e]}`).join('') + (p.charge ? `q${p.charge}` : '') : null)

// ───────── equation utils ─────────
function splitEquation(eq) {
  const m = eq.match(/\s(→|⇌|=|⇄|↔)\s/)
  if (!m) return null
  const idx = eq.indexOf(m[0])
  return { arrow: m[1], left: eq.slice(0, idx), right: eq.slice(idx + m[0].length) }
}
export function parseSide(side) {
  return side.split(/\s\+\s/).map((t) => t.trim()).filter(Boolean).map((t) => {
    t = t.replace(/[↑↓]/g, '')
    const m = t.match(/^(\d+)(?=[A-Za-z(\[])/)
    const coeff = m ? Number(m[1]) : 1
    const formula = m ? t.slice(m[1].length) : t
    return { formula, coeff }
  })
}
export function balanceCheck(reactants, products) {
  const tot = (list) => {
    const c = {}; let q = 0
    for (const { formula, coeff } of list) {
      const p = parseFormula(formula)
      if (!p) return null
      for (const [e, k] of Object.entries(p.counts)) c[e] = (c[e] || 0) + k * coeff
      q += p.charge * coeff
    }
    return { c, q }
  }
  const L = tot(reactants), R = tot(products)
  if (!L || !R) return { balanced: null, detail: 'unparseable species' }
  const els = new Set([...Object.keys(L.c), ...Object.keys(R.c)])
  const diff = [...els].filter((e) => (L.c[e] || 0) !== (R.c[e] || 0)).map((e) => `${e}: ${L.c[e] || 0}≠${R.c[e] || 0}`)
  if (L.q !== R.q) diff.push(`charge: ${L.q}≠${R.q}`)
  return { balanced: diff.length === 0, detail: diff.join('; ') || null }
}
const eqUnicode = (eq) => eq.split(/(\s\+\s|\s(?:→|⇌|=)\s|\s\/\s)/).map((tok) => {
  if (/^\s/.test(tok)) return tok
  const m = tok.match(/^(\d*)(.*?)([↑↓]?)$/)
  if (tok === 'e^-' || /^\d*e\^-$/.test(tok)) return tok.replace('e^-', 'e⁻')
  const isScheme = !parseFormula(m[2])
  return m[1] + (isScheme ? m[2] : toUnicode(m[2])) + m[3]
}).join('')
const eqAscii = (eq) => eq.replace(/→/g, '->').replace(/⇌/g, '<=>').replace(/[↑↓]/g, '')

// ───────── catalog maps ─────────
const fromUni = (s) => [...s].map((c) => UNSUB[c] ?? UNSUP[c] ?? c).join('')
const compoundsByKey = new Map()
for (const c of catalog.compounds) {
  if (!c.composition) continue
  const key = compKey({ counts: c.composition, charge: 0 })
  if (!compoundsByKey.has(key)) compoundsByKey.set(key, [])
  compoundsByKey.get(key).push(c)
}
const organicByKey = new Map()
const organicByFormula = new Map()
for (const m of catalog.organic) {
  const ascii = fromUni(m.formula || '')
  organicByFormula.set(ascii, m)
  const p = parseFormula(ascii.replace(/\s/g, ''))
  const key = compKey(p)
  if (!key) continue
  if (!organicByKey.has(key)) organicByKey.set(key, [])
  organicByKey.get(key).push(m)
}
const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').replace(/[()\s]/g, '')
const SYNONYMS = { 'этиловыйспирт': 'этанол' }
function pickByName(list, nameRu) {
  if (list.length === 1) return list[0]
  let n = norm(nameRu)
  n = SYNONYMS[n] ?? n
  return list.find((x) => n.includes(norm(x.nameRu)) || norm(x.nameRu).includes(n)) || null
}
const catalogMisses = []
function mapSubstance(sub) {
  if (!sub.formula) {
    const hit = [...catalog.compounds, ...catalog.organic].find((x) => norm(x.nameRu) === norm(sub.nameRu))
    return hit ? hit.id : null
  }
  const p = parseFormula(sub.formula)
  if (!p || p.charge) return null
  const key = compKey(p)
  if (sub.kind === 'organic') {
    const exact = organicByFormula.get(sub.formula)
    if (exact) return exact.id
    const list = organicByKey.get(key)
    if (list) { const hit = pickByName(list, sub.nameRu); if (hit) return hit.id }
  }
  const list = compoundsByKey.get(key)
  if (list) { const hit = pickByName(list, sub.nameRu) || list[0]; return hit.id }
  if (sub.kind !== 'organic') {
    const ol = organicByKey.get(key)
    if (ol) { const hit = pickByName(ol, sub.nameRu); if (hit) return hit.id }
  }
  return null
}

// bank reaction signatures
function reactionSig(reactants, products) {
  const side = (list) => list.map(({ formula, coeff }) => `${compKey(parseFormula(formula)) ?? formula}*${coeff}`).sort().join('|')
  return side(reactants) + '=>' + side(products)
}
const bankSigs = new Map()
for (const b of catalog.reactions) {
  if (!b.equationRu || b.equationRu.includes(';')) continue
  let eq = fromUni(b.equationRu).replace(/(→|⇄|⇌|=)\s*\([^)]*\)/g, '$1').replace(/[↑↓]/g, '')
  const sp = eq.match(/\s*(→|⇄|⇌|=)\s*/)
  if (!sp) continue
  const idx = eq.indexOf(sp[0])
  const L = parseSide(eq.slice(0, idx).replace(/\s*\+\s*/g, ' + '))
  const R = parseSide(eq.slice(idx + sp[0].length).replace(/\s*\+\s*/g, ' + '))
  if ([...L, ...R].some((x) => !parseFormula(x.formula))) continue
  bankSigs.set(reactionSig(L, R), b.id)
}

// ───────── build ─────────
const pageRange = {}
for (const ch of corpus) {
  const k = `${ch.chapterId}-${ch.sectionId}`
  pageRange[k] ??= [Infinity, 0]
  pageRange[k][0] = Math.min(pageRange[k][0], ch.pageStart)
  pageRange[k][1] = Math.max(pageRange[k][1], ch.pageEnd)
}

const problems = []
const outSections = SECTIONS.map((sec) => {
  const meta = kbSections.find((x) => x.id === sec.id)
  if (!meta) throw new Error('unknown section ' + sec.id)
  const substances = sec.substances.map((sub) => {
    const p = sub.formula ? parseFormula(sub.formula) : null
    if (sub.formula && !p) problems.push(`[${sec.id}] unparseable substance formula ${sub.formula}`)
    const isSimple = sub.kind === 'simple' && p && Object.keys(p.counts).length === 1
    const catalogId = mapSubstance(sub)
    if (!catalogId && sub.formula && !(p && p.charge)) catalogMisses.push(`${sub.formula} (${sub.nameRu})`)
    const o = {
      formula: sub.formula,
      formulaUnicode: toUnicode(sub.formula),
      nameRu: sub.nameRu,
      kind: sub.kind,
      role: sub.role,
      page: sub.pages[0],
      pages: sub.pages,
      quote: sub.quote.slice(0, 160),
      catalogId,
    }
    if (isSimple) o.elementSymbol = Object.keys(p.counts)[0]
    if (p && p.charge) o.isIon = true
    for (const k of ['nameInBook', 'formulaInBook', 'formulaAsInBook', 'note']) if (sub[k] !== undefined) o[k] = sub[k]
    if (sub.quote.length > 160) problems.push(`[${sec.id}] quote >160 for ${sub.formula || sub.nameRu} (${sub.quote.length})`)
    return o
  })
  const reactions = sec.reactions.map((rx) => {
    const sp = splitEquation(rx.eq)
    if (!sp) { problems.push(`[${sec.id}] cannot split ${rx.eq}`); return null }
    const reactants = parseSide(sp.left)
    const products = parseSide(sp.right)
    const scheme = !!rx.scheme
    let balanced = null, balanceDetail = null
    if (!scheme) {
      const bc = balanceCheck(reactants, products)
      balanced = bc.balanced; balanceDetail = bc.detail
      if (bc.balanced !== true && !rx.unbalanceable) problems.push(`[${sec.id}] NOT BALANCED ${rx.eq} :: ${bc.detail}`)
    }
    const bankId = scheme ? null : bankSigs.get(reactionSig(reactants, products)) ?? null
    const o = {
      equationAsInBook: rx.book,
      equation: eqUnicode(rx.eq),
      equationAscii: eqAscii(rx.eq),
      reactants,
      products,
      conditions: rx.cond ?? null,
      type: rx.type,
      subtype: rx.subtype ?? null,
      isGeneralScheme: scheme,
      isIonic: !!rx.ionic,
      balanced,
      page: [].concat(rx.pages)[0],
      pages: [].concat(rx.pages),
      quote: rx.quote.slice(0, 160),
      bankId,
      note: rx.note ?? null,
    }
    if (rx.words) o.describedInWords = true
    if (rx.variants) o.variantsAsInBook = rx.variants
    if (balanceDetail) o.balanceDetail = balanceDetail
    if (rx.quote.length > 160) problems.push(`[${sec.id}] reaction quote >160 (${rx.quote.length}): ${rx.quote.slice(0, 40)}`)
    return o
  }).filter(Boolean)
  const [ps, pe] = pageRange[sec.id]
  return {
    sectionId: sec.id,
    chapterId: sec.id.split('-')[0],
    kp: meta.kp,
    title: meta.title,
    pageStart: ps,
    pageEnd: pe,
    substances,
    reactions,
    labWorks: sec.labWorks,
  }
})

// stats
const allSubs = outSections.flatMap((s) => s.substances)
const allRx = outSections.flatMap((s) => s.reactions)
const uniqueFormulas = [...new Set(allSubs.map((s) => s.formula).filter(Boolean))]
const nonIon = uniqueFormulas.filter((f) => !f.includes('^'))
const mapped = [...new Set(allSubs.filter((s) => s.catalogId).map((s) => s.formula))]
const stats = {
  sections: outSections.length,
  substanceEntries: allSubs.length,
  uniqueFormulas: uniqueFormulas.length,
  uniqueFormulasExcludingIons: nonIon.length,
  nameOnlySubstances: allSubs.filter((s) => !s.formula).map((s) => s.nameRu),
  uniqueFormulasMappedToCatalog: mapped.length,
  reactions: allRx.length,
  reactionsNonScheme: allRx.filter((r) => !r.isGeneralScheme).length,
  generalSchemes: allRx.filter((r) => r.isGeneralScheme).length,
  ionicOrHalf: allRx.filter((r) => r.isIonic).length,
  describedInWords: allRx.filter((r) => r.describedInWords).length,
  reactionsMappedToBank: allRx.filter((r) => r.bankId).length,
  labWorks: outSections.reduce((n, s) => n + s.labWorks.length, 0),
  formalLabWorks: 0,
}
const out = {
  grade: 11,
  part: 2,
  source: 'public/textbooks/kimyo-11-ru.pdf (Общая химия, 11 класс, рус. изд.; OCR + визуальная проверка страниц)',
  generatedAt: new Date().toISOString(),
  notes: [
    'Part 2 = разделы kp 18–33 (c4-s07 … c8-s03), с. 85–154; с. 155–158 — ответы и содержание, с. 159–160 — выходные данные (веществ/реакций нет).',
    'В учебнике 11 класса нет оформленных «лабораторных/практических работ»; в labWorks перечислены опыты и демонстрации, описанные в тексте параграфов (isFormalLabWork: false).',
    'Вещество в разделе записано один раз; pages — все страницы раздела, где оно встречается. Реакции, повторяющиеся в разделе, объединены (variantsAsInBook).',
    'Схемы без коэффициентов из упражнений уравнены (note). Описанные словами реакции помечены describedInWords.',
    'Ионы: формула вида Cu^2+, isIon: true. Электрон в полуреакциях: e^-.',
    'catalogId — по составу из compoundById / organic registry (кэш scripts/textbook-inventory/.cache/catalog.json); bankId — по совпадению реагентов/продуктов и коэффициентов с SCHOOL_REACTION_BANK.',
  ],
  stats,
  sections: outSections,
}
fs.mkdirSync(path.join(root, 'src/data/textbook'), { recursive: true })
fs.writeFileSync(path.join(root, 'src/data/textbook/inventory-g11-part2.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify(stats, null, 1))
console.log('PROBLEMS:', problems.length ? '\n' + problems.join('\n') : 'none')
console.log('CATALOG MISSES (unique):', [...new Set(catalogMisses)].join(', '))
console.log('BANK MATCHES:', allRx.filter((r) => r.bankId).map((r) => `${r.bankId}`).join(', '))
