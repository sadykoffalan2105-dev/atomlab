/**
 * Builds src/data/textbook/inventory-g9-part1.json from the hand-authored
 * data in g9p1-data.mjs (read from textbook page text) + catalog dump.
 * Read-only for repo sources.
 *
 * Run: node scripts/textbook-inventory/build-g9-part1.mjs <catalog.json>
 *  (catalog.json produced by: npx tsx scripts/textbook-inventory/dump-catalog-g7p1.mts <out>)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { SECTIONS, CHAPTERS } from './g9p1-data.mjs'

const ROOT = new URL('../../', import.meta.url)
const catalogPath = process.argv[2]
const catalog = catalogPath ? JSON.parse(readFileSync(catalogPath, 'utf8')) : { compounds: [], organic: [], reactions: [] }

// ---------- page text ----------
const layout = readFileSync(new URL('scripts/kb/.cache/raw/g9-layout.txt', ROOT), 'utf8').split('\f')
function norm(s) {
  return s
    .replace(/http:eduportal\.uz/g, ' ')
    .replace(/­\s*/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim()
}
const pageText = (p) => norm(layout[p - 1] ?? '')

// ---------- formula utils ----------
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' }
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' }
const SUB_REV = Object.fromEntries(Object.entries(SUB).map(([k, v]) => [v, k]))
const SUP_REV = Object.fromEntries(Object.entries(SUP).map(([k, v]) => [v, k]))

/** ASCII formula like "SO4^2-", "Ca(OH)2", "CuSO4*5H2O" -> unicode */
export function toUnicode(f) {
  if (f == null) return null
  if (f === 'e') return 'ē'
  let [core, charge] = f.split('^')
  let out = ''
  let prevIsSym = false
  for (let i = 0; i < core.length; i++) {
    const ch = core[i]
    if (/[0-9]/.test(ch) && prevIsSym) {
      out += SUB[ch]
    } else {
      out += ch === '*' ? '·' : ch
      prevIsSym = /[A-Za-z)\]]/.test(ch) || (prevIsSym && /[0-9]/.test(ch))
      if (ch === '*' || ch === ' ') prevIsSym = false
    }
  }
  if (charge) out += [...charge].map((c) => SUP[c] ?? c).join('')
  return out
}
function fromUnicode(u) {
  let s = ''
  let charge = ''
  for (const ch of u) {
    if (SUB_REV[ch] != null) s += SUB_REV[ch]
    else if (SUP_REV[ch] != null) charge += SUP_REV[ch]
    else if (ch === '·' || ch === '•') s += '*'
    else s += ch
  }
  return charge ? `${s}^${charge}` : s
}

/** element counts + charge. Handles (), [], hydrates with '*'. */
export function parseFormula(f) {
  let [core, chargeStr] = f.split('^')
  let charge = 0
  if (chargeStr) {
    const m = chargeStr.match(/^(\d*)([+-])$/)
    if (!m) throw new Error('bad charge ' + f)
    charge = (m[1] ? Number(m[1]) : 1) * (m[2] === '+' ? 1 : -1)
  }
  if (core === 'e') return { counts: {}, charge: -1 }
  const total = {}
  for (const part0 of core.split('*')) {
    let part = part0
    let mult = 1
    const mm = part.match(/^(\d+)(.*)$/)
    if (mm) {
      mult = Number(mm[1])
      part = mm[2]
    }
    const stack = [{}]
    let i = 0
    while (i < part.length) {
      const ch = part[i]
      if (ch === '(' || ch === '[') {
        stack.push({})
        i++
      } else if (ch === ')' || ch === ']') {
        i++
        let n = ''
        while (i < part.length && /\d/.test(part[i])) n += part[i++]
        const grp = stack.pop()
        const k = n ? Number(n) : 1
        const top = stack[stack.length - 1]
        for (const [el, c] of Object.entries(grp)) top[el] = (top[el] ?? 0) + c * k
      } else if (/[A-Z]/.test(ch)) {
        let el = ch
        i++
        while (i < part.length && /[a-z]/.test(part[i])) el += part[i++]
        let n = ''
        while (i < part.length && /\d/.test(part[i])) n += part[i++]
        const top = stack[stack.length - 1]
        top[el] = (top[el] ?? 0) + (n ? Number(n) : 1)
      } else {
        throw new Error(`bad char '${ch}' in ${f}`)
      }
    }
    if (stack.length !== 1) throw new Error('unbalanced parens ' + f)
    for (const [el, c] of Object.entries(stack[0])) total[el] = (total[el] ?? 0) + c * mult
  }
  return { counts: total, charge }
}
const compKey = (counts) =>
  Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}:${n}`)
    .join('|')

// ---------- equation parsing ----------
const ARROWS = [
  ['<=>', '⇄'],
  ['->', '→'],
]
function parseSide(side) {
  return side
    .split(/\s\+\s/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      t = t.replace(/[↑↓]/g, '').trim()
      const m = t.match(/^(\d+(?:\/\d+)?)\s*(.+)$/)
      let coeff = 1
      let formula = t
      if (m && /^[A-Z(\[e]/.test(m[2])) {
        coeff = m[1].includes('/') ? eval(m[1]) : Number(m[1])
        formula = m[2]
      }
      return { formula, coeff }
    })
}
function parseEquation(e) {
  let arrow = null
  for (const [a, u] of ARROWS) {
    if (e.includes(` ${a} `)) {
      arrow = [a, u]
      break
    }
  }
  if (!arrow) throw new Error('no arrow: ' + e)
  const [l, r] = e.split(` ${arrow[0]} `)
  return { reactants: parseSide(l), products: parseSide(r), arrow: arrow[1] }
}
function balanceCheck(reactants, products) {
  const sum = (list) => {
    const c = {}
    let q = 0
    for (const { formula, coeff } of list) {
      const p = parseFormula(formula)
      for (const [el, n] of Object.entries(p.counts)) c[el] = (c[el] ?? 0) + n * coeff
      q += p.charge * coeff
    }
    return { c, q }
  }
  const L = sum(reactants)
  const R = sum(products)
  const els = new Set([...Object.keys(L.c), ...Object.keys(R.c)])
  const diffs = []
  for (const el of els) if (Math.abs((L.c[el] ?? 0) - (R.c[el] ?? 0)) > 1e-9) diffs.push(`${el}: ${L.c[el] ?? 0}≠${R.c[el] ?? 0}`)
  if (Math.abs(L.q - R.q) > 1e-9) diffs.push(`charge: ${L.q}≠${R.q}`)
  return diffs
}
const fmtSide = (list) =>
  list.map(({ formula, coeff }) => `${coeff === 1 ? '' : coeff}${toUnicode(formula)}`).join(' + ')

// ---------- catalog maps ----------
const compByKey = new Map()
const compByAscii = new Map()
for (const c of catalog.compounds) {
  if (c.composition) {
    const k = compKey(c.composition)
    if (!compByKey.has(k)) compByKey.set(k, [])
    compByKey.get(k).push(c)
  }
  compByAscii.set(fromUnicode(c.formulaUnicode).replace(/\s/g, ''), c)
}
const orgByAscii = new Map()
const orgByKey = new Map()
for (const m of catalog.organic) {
  const a = fromUnicode(m.formula).replace(/\s/g, '')
  if (!orgByAscii.has(a)) orgByAscii.set(a, [])
  orgByAscii.get(a).push(m)
  try {
    const k = compKey(parseFormula(a).counts)
    if (!orgByKey.has(k)) orgByKey.set(k, [])
    orgByKey.get(k).push(m)
  } catch {}
}
const lc = (s) => (s ?? '').toLowerCase().replace(/ё/g, 'е')
// Book names → organic registry ids (only when the book name unambiguously denotes that molecule)
const ORGANIC_NAME_ALIASES = {
  'спирт': 'ethanol',
  'этиловый спирт': 'ethanol',
  'этанол': 'ethanol',
  'метиловый спирт': 'methanol',
  'глюкоза': 'glucose-open',
  'фруктоза': 'fructose',
  'сахар': 'sucrose',
  'уксусная кислота': 'acetic-acid',
  'толуол': 'toluene',
}
function mapSubstance(formula, nameRu, kind) {
  const alias = ORGANIC_NAME_ALIASES[lc(nameRu)]
  if (alias && catalog.organic.some((m) => m.id === alias)) {
    if (!formula) return { catalogId: alias, catalogMatch: 'name-alias' }
    try {
      const m = catalog.organic.find((x) => x.id === alias)
      if (compKey(parseFormula(formula).counts) === compKey(parseFormula(fromUnicode(m.formula)).counts)) return { catalogId: alias, catalogMatch: 'formula+name-alias' }
    } catch {}
  }
  if (!formula) {
    const byName = catalog.organic.find((m) => lc(m.nameRu) === lc(nameRu)) ?? catalog.compounds.find((c) => lc(c.nameRu) === lc(nameRu))
    return byName ? { catalogId: byName.id, catalogMatch: 'name' } : { catalogId: null }
  }
  if (formula.includes('^')) return { catalogId: null }
  const ascii = formula.replace(/\s/g, '')
  let counts
  try {
    counts = parseFormula(ascii).counts
  } catch {
    return { catalogId: null }
  }
  if (Object.keys(counts).length === 1 && kind === 'simple') return { catalogId: null, elementSymbol: Object.keys(counts)[0] }
  if (kind === 'organic') {
    const exact = orgByAscii.get(ascii)
    if (exact?.length === 1) return { catalogId: exact[0].id, catalogMatch: 'formula' }
    const cands = [...(exact ?? []), ...(orgByKey.get(compKey(counts)) ?? [])]
    const byName = cands.find((m) => lc(m.nameRu) === lc(nameRu))
    if (byName) return { catalogId: byName.id, catalogMatch: 'formula+name' }
    if (exact?.length) return { catalogId: exact[0].id, catalogMatch: 'formula', catalogAmbiguous: exact.map((m) => m.id) }
    if (cands.length === 1) return { catalogId: cands[0].id, catalogMatch: 'composition' }
    if (cands.length > 1) return { catalogId: null, catalogCandidates: [...new Set(cands.map((m) => m.id))] }
  }
  const exact = compByAscii.get(ascii)
  if (exact) return { catalogId: exact.id, catalogMatch: 'formula' }
  const byComp = compByKey.get(compKey(counts))
  if (byComp?.length === 1) return { catalogId: byComp[0].id, catalogMatch: 'composition' }
  if (byComp?.length > 1) {
    const byName = byComp.find((c) => lc(c.nameRu) === lc(nameRu))
    return byName
      ? { catalogId: byName.id, catalogMatch: 'composition+name' }
      : { catalogId: byComp[0].id, catalogMatch: 'composition', catalogAmbiguous: byComp.map((c) => c.id) }
  }
  const org = orgByKey.get(compKey(counts))
  if (org?.length === 1) return { catalogId: org[0].id, catalogMatch: 'organic-composition' }
  return { catalogId: null }
}

const bankIndex = []
for (const r of catalog.reactions) {
  try {
    const eq = fromUnicode(r.equationRu)
      .replace(/\s*=\s*/g, ' -> ')
      .replace(/⇄|⇌|↔/g, '->')
      .replace(/→/g, '->')
      .replace(/\(([^)]*°[^)]*|t|kat|кат[^)]*)\)/g, '')
    const arrowIdx = eq.indexOf('->')
    const lhs = eq.slice(0, arrowIdx).replace(/-+$/, '')
    const rhs = eq.slice(arrowIdx + 2).replace(/^[^A-Z0-9(]*/, '')
    const key = (side) =>
      parseSide(side.replace(/\[[^\]]*\]/g, ''))
        .map(({ formula, coeff }) => `${coeff}${compKey(parseFormula(formula.replace(/\s/g, '')).counts)}`)
        .sort()
        .join('+')
    bankIndex.push({ id: r.id, key: key(lhs) + '=>' + key(rhs) })
  } catch {}
}
function mapReaction(reactants, products) {
  try {
    const key = (list) =>
      list
        .map(({ formula, coeff }) => `${coeff}${compKey(parseFormula(formula).counts)}`)
        .sort()
        .join('+')
    const k = key(reactants) + '=>' + key(products)
    const hit = bankIndex.find((b) => b.key === k)
    return hit ? hit.id : null
  } catch {
    return null
  }
}

// ---------- quotes ----------
function clip(text, idx, len) {
  const start = Math.max(0, idx - 60)
  let q = text.slice(start, start + 160)
  if (start > 0) q = q.replace(/^\S*\s/, '')
  return q.trim().slice(0, 160)
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function findQuote(pages, needles) {
  for (const p of pages) {
    const t = pageText(p)
    for (const n of needles) {
      if (!n) continue
      const isFormula = /^[A-Z(]/.test(n) && /[A-Z]/.test(n) && !/[а-яё]/i.test(n)
      const re = new RegExp(`(^|[^A-Za-z${isFormula ? '' : '0-9'}А-Яа-яё])${escapeRe(n)}${isFormula ? '(?![a-z])' : ''}`, isFormula ? '' : 'i')
      const m = re.exec(t)
      if (m) return { page: p, quote: clip(t, m.index + m[1].length, n.length) }
    }
  }
  return null
}
function findQuoteRe(pages, regs) {
  for (const p of pages) {
    const t = pageText(p)
    for (const re of regs) {
      const m = re.exec(t)
      if (m) return { page: p, quote: clip(t, m.index, 0) }
    }
  }
  return null
}
const stem = (name) => {
  const w = name.replace(/^~/, '').split(/\s+/)[0]
  return w.length > 6 ? w.slice(0, w.length - 2) : w
}

// ---------- build ----------
const KIND = { s: 'simple', ox: 'oxide', a: 'acid', b: 'base', salt: 'salt', org: 'organic', x: 'other' }
const ROLE = { st: 'studied', ob: 'obtained', re: 'reagent', me: 'mentioned' }
const problems = []
const KB_BOOK = JSON.parse(readFileSync(new URL('src/data/kb/corpus/kb-sections.json', ROOT), 'utf8')).g9.book
const out = {
  grade: 9,
  part: 1,
  source: 'Kimyo 9 (ru), public/textbooks/kimyo-9-ru.pdf',
  scope: `book sections §1–§${SECTIONS.length} of ${KB_BOOK.length} in kb-sections.json (part 1 = first ceil(N/2)); pages are PDF page numbers (= printed page numbers)`,
  generatedAt: new Date().toISOString(),
  notes: [
    'substances: one entry per substance mention per section (same formula may repeat across sections and, with a different book name, within a section); formula = ASCII, ions as SO4^2-, hydrates with *',
    "nameInBook=false: the book gives only the formula, nameRu is a standard name; formulaInBook=false: the book gives only the name, formula added",
    'simple substances: catalogId=null (the compound catalog has no elements), elementSymbol is given instead',
    "reactions.subtype: dissociation | full-ionic | net-ionic | half-reaction | electrode | qualitative (табл. 7, уравнение составлено по описанию) | exercise (в книге только левая часть/словесное задание, правая часть дописана) | chain | scheme | step-N | photosynthesis",
    'isIonic=true for any equation containing ions or electrons (dissociation, ionic, electrode); use subtype to filter',
    'balanced: checked by atoms and charge; book errors are fixed in equation/equationAscii and explained in note; equationAsInBook keeps the book text (the text layer loses ⇄: such arrows were verified on page renders)',
    'bankId: exact match of species+coefficients against SCHOOL_REACTION_BANK (molecular equations only)',
    'labWorks: part 1 contains no numbered лабораторные/практические работы (they are in the final "lab" section, part 2); two in-text demonstration experiments are listed with kind=demonstration',
  ],
  chapters: CHAPTERS,
  sections: [],
}

for (const sec of SECTIONS) {
  const pages = []
  for (let p = sec.pageStart; p <= sec.pageEnd; p++) pages.push(p)
  const substances = []
  for (const row of sec.subs) {
    const [formulaRaw, nameRaw, kindC, roleC, page, quoteOverride, note] = row
    const formulaInBook = formulaRaw ? !formulaRaw.startsWith('!') : null
    const formula = formulaRaw ? formulaRaw.replace(/^!/, '') : null
    const kind = KIND[kindC]
    const role = ROLE[roleC]
    if (!kind || !role) problems.push(`bad kind/role ${sec.kp} ${formula} ${nameRaw}`)
    if (formula) {
      try {
        parseFormula(formula)
      } catch (e) {
        problems.push(`formula parse ${sec.kp} ${formula}: ${e.message}`)
      }
    }
    const nameInBook = !nameRaw.startsWith('~')
    const nameRu = nameRaw.replace(/^~/, '')
    let quote = quoteOverride ?? null
    let qPage = page
    if (!quote) {
      const order = [page, ...pages.filter((x) => x !== page)]
      const needles = []
      if (nameInBook) needles.push(nameRu, stem(nameRu))
      if (formula && formulaInBook) needles.push(formula.split('^')[0].replace('*', '.'), formula.split('^')[0])
      let f = findQuote(order, needles)
      if (!f) {
        // loose fallback: letters of the stem / formula may be separated by stray spaces in the text layer
        const loose = (s) => new RegExp([...s.replace(/\s+/g, '')].map(escapeRe).join('\\s?'), /[А-Яа-яё]/.test(s) ? 'i' : '')
        const regs = needles.filter((n) => n && n.replace(/\s/g, '').length >= 3).map((n) => loose(n.length > 5 && /[а-яё]/i.test(n) ? n.slice(0, 5) : n))
        f = findQuoteRe(order, regs)
      }
      if (f) {
        quote = f.quote
        if (!page) qPage = f.page
      } else problems.push(`no quote: kp${sec.kp} ${formula} ${nameRu}`)
    }
    const s = {
      formula: formula ?? null,
      formulaUnicode: toUnicode(formula),
      ...(formula && !formulaInBook ? { formulaInBook: false } : {}),
      nameRu,
      nameInBook,
      kind,
      role,
      page: qPage,
      quote,
      ...mapSubstance(formula, nameRu, kind),
    }
    if (note) s.note = note
    substances.push(s)
  }
  const reactions = []
  for (const r of sec.rx) {
    let parsed
    try {
      parsed = parseEquation(r.e)
    } catch (e) {
      problems.push(`eq parse kp${sec.kp}: ${r.e} ${e.message}`)
      continue
    }
    let diffs = []
    if (!r.g) {
      try {
        diffs = balanceCheck(parsed.reactants, parsed.products)
      } catch (e) {
        diffs = ['parse: ' + e.message]
      }
    }
    if (diffs.length && !r.unbalancedOk) problems.push(`UNBALANCED kp${sec.kp} p${r.p}: ${r.e} [${diffs.join(', ')}]`)
    const isIonic = r.i ?? [...parsed.reactants, ...parsed.products].some((x) => x.formula.includes('^') || x.formula === 'e')
    const eqU = `${fmtSide(parsed.reactants)} ${parsed.arrow}${r.c ? `(${r.c})` : ''} ${fmtSide(parsed.products)}`
    let quote = r.q ?? null
    if (!quote) {
      const lhsBook = r.b.split(/\s*[→=⇄]/)[0].trim()
      const loose = (s) => escapeRe(s).replace(/\s+/g, '\\s*')
      const f = findQuoteRe([r.p, ...pages.filter((x) => x !== r.p)], [
        new RegExp(loose(lhsBook) + '\\s*[→=⇄;]'),
        new RegExp(loose(lhsBook.split(/\s\+\s/)[0]) + '\\s*[+→=⇄]'),
      ]) ?? findQuote([r.p], [lhsBook.split(/\s\+\s/)[0]])
      quote = f ? f.quote : r.b.slice(0, 160)
      if (!f && !['qualitative', 'exercise', 'chain'].includes(r.st) && !r.n) problems.push(`no rx quote kp${sec.kp}: ${r.b}`)
    }
    const rx = {
      equationAsInBook: r.b,
      equation: eqU,
      equationAscii: r.e,
      reactants: parsed.reactants,
      products: parsed.products,
      conditions: r.c ?? null,
      type: r.t,
      subtype: r.st ?? null,
      isGeneralScheme: !!r.g,
      isIonic,
      balanced: r.g ? null : diffs.length === 0,
      page: r.p,
      quote,
      bankId: r.g || isIonic ? null : mapReaction(parsed.reactants, parsed.products),
    }
    if (r.n) rx.note = r.n
    reactions.push(rx)
  }
  out.sections.push({
    sectionId: `g9-p${String(sec.kp).padStart(2, '0')}`,
    chapterId: `g9-ch${String(sec.chapter).padStart(2, '0')}`,
    kp: String(sec.kp),
    title: sec.title,
    pageStart: sec.pageStart,
    pageEnd: sec.pageEnd,
    appSections: KB_BOOK.find((b) => b.kp === String(sec.kp))?.appSections ?? [],
    elementsMentioned: sec.elements ?? [],
    substances,
    reactions,
    labWorks: sec.labs ?? [],
    ...(sec.notes ? { notes: sec.notes } : {}),
  })
}

// counts
const allSubs = out.sections.flatMap((s) => s.substances)
const uniq = new Set(allSubs.filter((s) => s.formula).map((s) => s.formula))
const uniqNames = new Set(allSubs.filter((s) => !s.formula).map((s) => s.nameRu.toLowerCase()))
out.stats = {
  sections: out.sections.length,
  substances: allSubs.length,
  uniqueFormulas: uniq.size,
  uniqueNameOnly: uniqNames.size,
  reactions: out.sections.reduce((a, s) => a + s.reactions.length, 0),
  labWorks: out.sections.reduce((a, s) => a + s.labWorks.length, 0),
  substancesMapped: allSubs.filter((s) => s.catalogId).length,
  uniqueFormulasMapped: new Set(allSubs.filter((s) => s.catalogId && s.formula).map((s) => s.formula)).size,
  reactionsMappedToBank: out.sections.reduce((a, s) => a + s.reactions.filter((r) => r.bankId).length, 0),
}
mkdirSync(new URL('src/data/textbook/', ROOT), { recursive: true })
writeFileSync(new URL('src/data/textbook/inventory-g9-part1.json', ROOT), JSON.stringify(out, null, 2) + '\n', 'utf8')
console.log(JSON.stringify(out.stats))
if (problems.length) console.log('PROBLEMS:\n' + problems.join('\n'))
