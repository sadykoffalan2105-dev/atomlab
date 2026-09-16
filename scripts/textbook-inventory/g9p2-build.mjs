// Builds src/data/textbook/inventory-g9-part2.json from the hand-authored data in g9p2-data*.mjs.
// Verifies book quotes/equations against the page text, balances equations, maps to catalog ids.
// Usage: node scripts/textbook-inventory/g9p2-build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import {
  formulaForms,
  unicodeToAscii,
  parseFormula,
  compKey,
  parseEquation,
  checkBalance,
  equationUnicode,
  inferKind,
} from './g9p2-lib.mjs'

const ROOT = new URL('../../', import.meta.url)
const rp = (p) => new URL(p, ROOT)

const DATA = {}
for (const f of ['g9p2-data-a.mjs', 'g9p2-data-b.mjs', 'g9p2-data-c.mjs', 'g9p2-data-d.mjs', 'g9p2-data-e.mjs']) {
  const u = new URL(f, import.meta.url)
  if (existsSync(u)) Object.assign(DATA, (await import(u.href)).DATA)
}

// ---------- page text ----------
const rawPages = readFileSync(rp('scripts/kb/.cache/raw/g9-raw.txt'), 'utf8').split('\f')
const linesJson = JSON.parse(readFileSync(rp('scripts/kb/.cache/lines-g9.json'), 'utf8'))
const cleanText = (t) =>
  (t || '')
    .replace(/­\s?/g, '')
    .replace(/http:eduportal\.uz\s?/g, '')
    .replace(/[ \t]+/g, ' ')
const pageText = (p) => {
  const raw = cleanText(rawPages[p - 1])
  const lj = linesJson.find((x) => x.page === p)
  const lines = lj ? cleanText(lj.lines.map((l) => l.t).join('\n')) : ''
  return { raw, lines }
}

const NORM_DROP = /[\s\p{Cc}\p{Co}\u2192\u21cc\u21c4=\u2191\u2193.,;:]/u
function normIndex(s) {
  let n = ''
  const map = []
  for (let i = 0; i < s.length; i++) {
    let ch = s[i]
    if (NORM_DROP.test(ch)) continue
    ch = unicodeToAscii(ch).toLowerCase()
    if (ch === 'ё') ch = 'е'
    for (const c of ch) {
      n += c
      map.push(i)
    }
  }
  return { n, map }
}
const normOnly = (s) => normIndex(s).n

/** Locate hint in a page; returns {src, start, end, text} with exact original substring or null */
function locate(hint, page) {
  const { raw, lines } = pageText(page)
  const h = normOnly(hint)
  if (!h) return null
  for (const [src, s] of [
    ['raw', raw],
    ['lines', lines],
  ]) {
    const { n, map } = normIndex(s)
    const isF = /^[A-Z][A-Za-z0-9()*]*$/.test(hint)
    let k = n.indexOf(h)
    while (k >= 0 && isF && /[A-Za-z0-9(]/.test(s[map[k + h.length - 1] + 1] || "")) k = n.indexOf(h, k + 1)
    if (k >= 0) {
      const start = map[k]
      const end = map[k + h.length - 1] + 1
      return { src, s, start, end, text: s.slice(start, end) }
    }
  }
  return null
}

function quoteAround(loc) {
  const s = loc.s
  let a = loc.start
  const back = Math.max(0, loc.start - 110)
  for (let i = loc.start - 1; i >= back; i--) {
    if (/[.!?]/.test(s[i]) && /\s/.test(s[i + 1] || '') && !/\d/.test(s[i - 1] || '')) {
      a = i + 2
      break
    }
    if (s[i] === '\n' && /[А-ЯA-Z•\d]/.test(s[i + 1] || '')) {
      a = i + 1
      break
    }
    if (i === back) a = back
  }
  let b = Math.min(s.length, a + 160)
  if (loc.end > b) {
    a = Math.max(0, loc.end - 150)
    b = Math.min(s.length, a + 160)
  }
  for (let i = Math.max(loc.end, a + 60); i < b; i++) {
    if (/[.!?]/.test(s[i]) && (/\s/.test(s[i + 1] || '') || i + 1 === s.length)) {
      b = i + 1
      break
    }
  }
  return s.slice(a, b).replace(/\s+/g, ' ').trim().slice(0, 160)
}

// ---------- catalog ----------
const catalog = JSON.parse(readFileSync(rp('.smoke/textbook-inventory/g9p2-catalog.json'), 'utf8'))
const byKey = new Map()
for (const c of catalog.compounds) {
  const k = compKey(c.composition)
  if (!byKey.has(k)) byKey.set(k, [])
  byKey.get(k).push({ id: c.id, nameRu: c.nameRu, src: 'compound' })
}
const orgByKey = new Map()
for (const m of catalog.organic) {
  const p = parseFormula(unicodeToAscii(m.formula))
  if (!p) continue
  const k = compKey(p.counts)
  if (!orgByKey.has(k)) orgByKey.set(k, [])
  orgByKey.get(k).push({ id: m.id, nameRu: m.nameRu, src: 'organic' })
}
function mapCatalog(ascii, nameRu, kind) {
  if (!ascii) return { catalogId: null }
  const p = parseFormula(ascii)
  if (!p || p.charge) return { catalogId: null }
  const k = compKey(p.counts)
  const res = {}
  const inorg = byKey.get(k)
  const org = orgByKey.get(k)
  const nm = (nameRu || '').toLowerCase()
  if (kind === 'organic' && org) {
    const hit = org.find((o) => nm && (o.nameRu.toLowerCase().includes(nm.split(' ')[0]) || nm.includes(o.nameRu.toLowerCase().split(' ')[0])))
    res.catalogId = (hit ?? (org.length === 1 ? org[0] : null))?.id ?? null
    if (!res.catalogId) res.catalogCandidates = org.map((o) => o.id)
  } else if (inorg) {
    res.catalogId = inorg[0].id
  } else if (org && kind === 'organic') {
    res.catalogId = org[0].id
  } else res.catalogId = null
  if (!res.catalogId && ascii.includes('*')) {
    const anh = parseFormula(ascii.split('*')[0])
    const hit = anh && byKey.get(compKey(anh.counts))
    if (hit) res.catalogIdAnhydrous = hit[0].id
  }
  return res
}

const sig = (arr) =>
  arr
    .map(({ formula, coeff }) => {
      const p = parseFormula(formula)
      return `${coeff}x${p ? compKey(p.counts) + (p.charge ? `^${p.charge}` : '') : formula}`
    })
    .sort()
    .join(' + ')
const species = (arr) =>
  arr
    .map(({ formula }) => {
      const p = parseFormula(formula)
      return p ? compKey(p.counts) : formula
    })
    .sort()
    .join(' + ')
const bank = []
for (const r of catalog.reactions) {
  if (r.equationRu.includes(';')) continue
  const eq = unicodeToAscii(r.equationRu)
    .replace(/[↑↓]/g, '')
    .replace(/⇄|⇌/g, '<=>')
    .replace(/→\([^)]*\)/g, '->')
    .replace(/→/g, '->')
  const p = parseEquation(eq)
  if (!p) continue
  bank.push({ id: r.id, full: `${sig(p.reactants)} > ${sig(p.products)}`, sp: `${species(p.reactants)} > ${species(p.products)}` })
}

// ---------- build ----------
const sectionsMeta = JSON.parse(readFileSync(rp('src/data/kb/corpus/kb-sections.json'), 'utf8')).g9.book
const chunks = JSON.parse(readFileSync(rp('src/data/kb/corpus/kb-corpus-g9.json'), 'utf8')).chunks
const half = Math.ceil(sectionsMeta.length / 2)
const part2 = sectionsMeta.slice(half)
const warnings = []
const ROLE_RANK = { studied: 0, obtained: 1, reagent: 2, mentioned: 3 }

const out = { grade: 9, part: 2, source: 'Kimyo 9 (ru), public/textbooks/kimyo-9-ru.pdf', generatedAt: new Date().toISOString(), sections: [] }

for (const meta of part2) {
  const kp = meta.kp
  const ch = chunks.filter((c) => c.kp === kp)
  const pageStart = Math.min(...ch.map((c) => c.pageStart))
  const pageEnd = Math.max(...ch.map((c) => c.pageEnd))
  const freq = {}
  for (const c of ch) if (c.chapterId) freq[`${c.chapterId}|${c.sectionId}`] = (freq[`${c.chapterId}|${c.sectionId}`] || 0) + 1
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]
  const [chapterId, sectionId] = top ? top[0].split('|') : [null, null]
  const d = DATA[kp] ?? { S: [], R: [], L: [] }
  if (!DATA[kp]) warnings.push(`§${kp}: no authored data`)

  // substances
  const subs = []
  const seen = new Map()
  for (const row of d.S) {
    const [formula0, nameRu, role, page, hint, extra = {}] = row
    const forms = formula0 ? formulaForms(formula0) : null
    const kind = extra.kind ?? (formula0 ? inferKind(formula0) : 'other')
    const key = forms ? forms.ascii : `name:${nameRu}`
    let loc = null
    const hints = [hint, forms?.ascii, nameRu].filter(Boolean)
    const pagesToTry = [page, page - 1, page + 1]
    outer: for (const h of hints)
      for (const p of pagesToTry) {
        loc = locate(h, p)
        if (loc) {
          if (p !== page) warnings.push(`§${kp} substance ${key}: hint found on p.${p} not p.${page}`)
          break outer
        }
      }
    if (!loc) warnings.push(`§${kp} substance ${key} (${nameRu}): quote hint "${hint}" not found on p.${page}`)
    const pages = new Set([page])
    if (forms && !forms.ascii.includes('^')) {
      const re = new RegExp(`(^|[^A-Za-z0-9(])${forms.ascii.replace(/[()*[\]]/g, (m) => (m === '*' ? '[.·∙ ]*' : '\\' + m))}(?![a-z0-9])`)
      for (let p = pageStart; p <= pageEnd; p++) if (re.test(pageText(p).raw.replace(/\s+(?=\d)/g, ''))) pages.add(p)
    }
    const entry = {
      formula: forms ? forms.ascii : null,
      formulaUnicode: forms ? forms.unicode : null,
      nameRu,
      kind,
      role,
      page,
      pages: [...pages].sort((a, b) => a - b),
      quote: loc ? quoteAround(loc) : null,
      ...mapCatalog(forms?.ascii, nameRu, kind),
    }
    if (formula0 && parseFormula(formula0) == null) warnings.push(`§${kp} unparsable formula ${formula0}`)
    for (const k of ['note', 'formulaInBook', 'inExercise', 'inWorkedExample', 'mineral', 'aliases']) if (extra[k] !== undefined) entry[k] = extra[k]
    if (seen.has(key)) {
      const prev = seen.get(key)
      if (ROLE_RANK[role] < ROLE_RANK[prev.role]) prev.role = role
      prev.pages = [...new Set([...prev.pages, ...entry.pages])].sort((a, b) => a - b)
      if (entry.nameRu !== prev.nameRu && !(prev.aliases || []).includes(entry.nameRu)) prev.aliases = [...(prev.aliases || []), entry.nameRu]
      continue
    }
    seen.set(key, entry)
    subs.push(entry)
  }

  // reactions
  const reactions = []
  for (const row of d.R) {
    const [bookHint, eqAscii, type, conditions, page, extra = {}] = row
    let loc = null
    for (const p of [page, page - 1, page + 1]) {
      loc = locate(bookHint ?? eqAscii, p)
      if (loc) {
        if (p !== page) warnings.push(`§${kp} reaction "${eqAscii}": found on p.${p} not p.${page}`)
        break
      }
    }
    if (!loc) warnings.push(`§${kp} reaction "${bookHint ?? eqAscii}" not found in text of p.${page}`)
    const parsed = parseEquation(eqAscii)
    if (!parsed) warnings.push(`§${kp} reaction "${eqAscii}" unparsable`)
    const isGeneralScheme = !!extra.isGeneralScheme
    const isIonic = !!extra.isIonic || /\^/.test(eqAscii)
    const bal = parsed && !isGeneralScheme && !extra.skipBalance ? checkBalance(parsed) : { ok: null }
    const entry = {
      equationAsInBook: extra.noEquationInBook ? null : loc ? loc.text.replace(/\s+/g, ' ').trim() : bookHint ?? eqAscii,
      equation: parsed ? equationUnicode(parsed, conditions) : eqAscii,
      equationAscii: eqAscii,
      reactants: parsed ? parsed.reactants.map((x) => ({ formula: formulaForms(x.formula).ascii, coeff: x.coeff })) : [],
      products: parsed ? parsed.products.map((x) => ({ formula: formulaForms(x.formula).ascii, coeff: x.coeff })) : [],
      conditions: conditions || null,
      type,
      isGeneralScheme,
      isIonic,
      balanced: bal.ok,
      page,
      quote: loc ? quoteAround(loc) : null,
      bankId: null,
    }
    if (bal.ok === false) {
      warnings.push(`§${kp} UNBALANCED "${eqAscii}": ${bal.reason}`)
      entry.balanceIssue = bal.reason
    }
    if (parsed && !isGeneralScheme) {
      const full = `${sig(parsed.reactants)} > ${sig(parsed.products)}`
      const sp = `${species(parsed.reactants)} > ${species(parsed.products)}`
      const hit = bank.find((b) => b.full === full)
      if (hit) entry.bankId = hit.id
      else {
        const near = bank.find((b) => b.sp === sp)
        if (near) entry.bankIdSameSubstances = near.id
      }
    }
    for (const k of ['note', 'inExercise', 'inWorkedExample', 'fromTable', 'described', 'repeatedOnPages', 'noEquationInBook', 'labWork']) if (extra[k] !== undefined) entry[k] = extra[k]
    if (loc?.src === 'lines') entry.textSource = 'lines-cache'
    reactions.push(entry)
  }

  out.sections.push({
    sectionId,
    chapterId,
    appSections: meta.appSections,
    kp,
    title: meta.title,
    pageStart,
    pageEnd,
    substances: subs,
    reactions,
    labWorks: d.L ?? [],
    ...(d.extraNotes ? { notes: d.extraNotes } : {}),
  })
}

// totals
const allSubs = out.sections.flatMap((s) => s.substances)
const allR = out.sections.flatMap((s) => s.reactions)
out.stats = {
  sections: out.sections.length,
  substances: allSubs.length,
  uniqueFormulas: new Set(allSubs.filter((s) => s.formula).map((s) => s.formula)).size,
  namedOnly: allSubs.filter((s) => !s.formula).length,
  substancesMappedToCatalog: allSubs.filter((s) => s.catalogId).length,
  uniqueFormulasMapped: new Set(allSubs.filter((s) => s.catalogId).map((s) => s.formula)).size,
  reactions: allR.length,
  reactionsUnbalanced: allR.filter((r) => r.balanced === false).length,
  reactionsMappedToBank: allR.filter((r) => r.bankId).length,
  labWorks: out.sections.reduce((n, s) => n + s.labWorks.length, 0),
}
mkdirSync(rp('src/data/textbook/'), { recursive: true })
writeFileSync(rp('src/data/textbook/inventory-g9-part2.json'), JSON.stringify(out, null, 1))
writeFileSync(rp('.smoke/textbook-inventory/g9p2-warnings.txt'), warnings.join('\n'))
console.log(JSON.stringify(out.stats))
console.log(`warnings: ${warnings.length}`)
console.log(warnings.slice(0, 80).join('\n'))
