/**
 * Build a textbook inventory JSON from a hand-written line source (substances / reactions / lab works per book paragraph).
 *
 * Usage: npx tsx scripts/textbook-inventory/build-inventory.mts <grade> <part> <source.txt> <out.json>
 *
 * Source format (one item per line, "|" separated, "#" comments):
 *   @kp <kp> [pages=<a>-<b>] [note=<text>]            start of a book paragraph (metadata from kb-sections.json + corpus)
 *   S <formula>|<nameRu>|<kind or ->|<role>|<page>[|q=<quote key>][|note=<text>]
 *       formula: ASCII ("Ca(OH)2", "FeSO4*7H2O", ions "SO4^2-"), "-" = no formula; prefix "!" = formula not printed in the book
 *       nameRu: "a/b" = name + aliases; prefix "~" = name not printed in the book (standard name supplied)
 *       kind: simple|oxide|acid|base|salt|organic|other or "-" (inferred); role: studied|obtained|reagent|mentioned
 *   R <page>|<equation as in book>|<clean equation or ->|<conditions or ->|<type>|<flags>[|q=<quote key>][|note=<text>]
 *       flags: g = general letter scheme, i = ionic, x = from an exercise, e = described in words (equation not printed)
 *   L <page>|<title>|<formula,formula,...>
 */
import fs from 'node:fs'
import path from 'node:path'
import { addKnownFormulas, repairFormulas, repairLoneSymbols } from '../kb/lib/textRepair.mts'
import { appFormulas } from '../kb/lib/cards.mts'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const [gradeArg, partArg, srcArg, outArg] = process.argv.slice(2)
const GRADE = Number(gradeArg)
const PART = Number(partArg)

type Role = 'studied' | 'obtained' | 'reagent' | 'mentioned'
type Kind = 'simple' | 'oxide' | 'acid' | 'base' | 'salt' | 'organic' | 'other'
const ROLE_RANK: Record<Role, number> = { studied: 4, obtained: 3, reagent: 2, mentioned: 1 }
const KINDS = new Set(['simple', 'oxide', 'acid', 'base', 'salt', 'organic', 'other'])
const TYPES = new Set(['combination', 'decomposition', 'substitution', 'exchange', 'redox', 'neutralization', 'combustion', 'hydrolysis', 'polymerization', 'other'])

// ---------- formulas ----------
const ELEMENTS = new Set(
  (JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/periodicTableRaw.json'), 'utf8')) as { symbol: string }[]).map((e) => e.symbol),
)
const METALS = new Set(
  'Li Be Na Mg Al K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Rb Sr Y Zr Nb Mo Ag Cd In Sn Sb Cs Ba La Ce W Pt Au Hg Tl Pb Bi Fr Ra U'.split(' '),
)

type Counts = Record<string, number>
type Parsed = { counts: Counts; charge: number }

function parseBody(s: string): Counts {
  let i = 0
  function group(): Counts {
    const out: Counts = {}
    while (i < s.length) {
      const ch = s[i]
      if (ch === '(' || ch === '[') {
        i += 1
        const inner = group()
        if (s[i] !== ')' && s[i] !== ']') throw new Error(`unbalanced bracket in ${s}`)
        i += 1
        const n = readNum()
        for (const [k, v] of Object.entries(inner)) out[k] = (out[k] ?? 0) + v * n
      } else if (ch === ')' || ch === ']') {
        return out
      } else if (/[A-Z]/.test(ch)) {
        let sym = ch
        if (i + 1 < s.length && /[a-z]/.test(s[i + 1]) && ELEMENTS.has(ch + s[i + 1])) sym = ch + s[i + 1]
        if (!ELEMENTS.has(sym)) throw new Error(`unknown element ${sym} in ${s}`)
        i += sym.length
        const n = readNum()
        out[sym] = (out[sym] ?? 0) + n
      } else {
        throw new Error(`bad char "${ch}" in ${s}`)
      }
    }
    return out
  }
  function readNum(): number {
    const m = /^\d+/.exec(s.slice(i))
    if (!m) return 1
    i += m[0].length
    return Number(m[0])
  }
  const r = group()
  if (i !== s.length) throw new Error(`trailing text in ${s}`)
  return r
}

function parseFormula(f: string): Parsed {
  const [body, chargeStr] = f.split('^')
  let charge = 0
  if (chargeStr) {
    const m = /^(\d*)([+-])$/.exec(chargeStr)
    if (!m) throw new Error(`bad charge ${f}`)
    charge = (m[1] ? Number(m[1]) : 1) * (m[2] === '+' ? 1 : -1)
  }
  const counts: Counts = {}
  for (const part of body.split('*')) {
    const m = /^(\d*)(.+)$/.exec(part)!
    const k = m[1] ? Number(m[1]) : 1
    for (const [el, n] of Object.entries(parseBody(m[2]))) counts[el] = (counts[el] ?? 0) + n * k
  }
  return { counts, charge }
}

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻' }
function toUnicode(f: string): string {
  const [body, charge] = f.split('^')
  const b = body
    .split('*')
    .map((p) => {
      const m = /^(\d*)(.*)$/.exec(p)!
      return m[1] + m[2].replace(/(?<=[A-Za-z)\]])\d+/g, (d) => [...d].map((c) => SUB[Number(c)]).join(''))
    })
    .join('·')
  return b + (charge ? [...(charge === '+' || charge === '-' ? charge : charge)].map((c) => SUP[c]).join('') : '')
}

function compKey(p: Parsed): string {
  return (
    Object.entries(p.counts)
      .filter(([, n]) => n > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, n]) => `${k}${n}`)
      .join('') + (p.charge ? `^${p.charge}` : '')
  )
}

function inferKind(f: string): Kind {
  const p = parseFormula(f)
  const els = Object.keys(p.counts)
  if (p.charge) return 'other'
  if (els.length === 1) return 'simple'
  const body = f.split('*')[0]
  if (els.includes('C') && els.includes('H') && !/CO3|CN/.test(body)) return 'organic'
  if (els.length === 2 && els.includes('O') && !els.includes('F')) return 'oxide'
  const hasMetal = els.some((e) => METALS.has(e))
  if (hasMetal && els.every((e) => METALS.has(e) || e === 'O' || e === 'H') && /OH/.test(body) && els.includes('H')) return 'base'
  if (/^H[A-Z\d]/.test(body) && body !== 'H2O' && body !== 'H2O2') return 'acid'
  if (els.length === 2 && els.includes('H')) return 'other'
  if (hasMetal || /NH4/.test(body)) return 'salt'
  return 'other'
}

// ---------- equations ----------
type Term = { formula: string; coeff: number }
const ARROW_RE = /\s*(?:→(?:\([^)]*\))?|⇄|⇌|->|=)\s*/
function cleanTerm(t: string): string {
  return t
    .replace(/[↑↓]/g, '')
    .replace(/\((?:конц|разб|р-р|тв|г|ж)\.?\)/g, '')
    .trim()
}
function parseSide(side: string): Term[] {
  return side
    .split(/\s+\+\s+/)
    .map((t) => cleanTerm(t))
    .filter(Boolean)
    .map((t) => {
      const m = /^(\d*)\s*(.+)$/.exec(t)!
      return { formula: m[2], coeff: m[1] ? Number(m[1]) : 1 }
    })
}
function parseEquation(eq: string): { reactants: Term[]; products: Term[] } {
  const parts = eq.split(ARROW_RE)
  if (parts.length !== 2) throw new Error(`equation must have one arrow: ${eq}`)
  return { reactants: parseSide(parts[0]), products: parseSide(parts[1]) }
}
function balance(r: { reactants: Term[]; products: Term[] }): { ok: boolean; diff: string } {
  const tally = (terms: Term[]) => {
    const c: Counts = {}
    let q = 0
    for (const t of terms) {
      const p = parseFormula(t.formula)
      for (const [k, v] of Object.entries(p.counts)) c[k] = (c[k] ?? 0) + v * t.coeff
      q += p.charge * t.coeff
    }
    return { c, q }
  }
  const L = tally(r.reactants)
  const R = tally(r.products)
  const diffs: string[] = []
  for (const k of new Set([...Object.keys(L.c), ...Object.keys(R.c)])) if ((L.c[k] ?? 0) !== (R.c[k] ?? 0)) diffs.push(`${k}:${L.c[k] ?? 0}/${R.c[k] ?? 0}`)
  if (L.q !== R.q) diffs.push(`charge:${L.q}/${R.q}`)
  return { ok: diffs.length === 0, diff: diffs.join(' ') }
}
function unicodeEquation(eq: string, conditions: string | null): string {
  const { reactants, products } = parseEquation(eq)
  const arrow = /⇌|⇄/.test(eq) ? '⇌' : '→'
  const side = (ts: Term[], raw: string) =>
    ts
      .map((t) => {
        const gas = new RegExp(escapeRe(t.formula) + '\\s*↑').test(raw) ? '↑' : new RegExp(escapeRe(t.formula) + '\\s*↓').test(raw) ? '↓' : ''
        return (t.coeff > 1 ? t.coeff : '') + toUnicode(t.formula) + gas
      })
      .join(' + ')
  const [l, r] = eq.split(ARROW_RE)
  return `${side(reactants, l)} ${arrow}${conditions ? `(${conditions})` : ''} ${side(products, r)}`
}
function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ---------- catalog ----------
const { compoundById } = await import('../../src/data/compounds.ts')
const { ORGANIC_MOLECULES } = await import('../../src/data/organicLab/organicMoleculeRegistry.ts')
const { SCHOOL_REACTION_BANK } = await import('../../src/chemistry/schoolReactionBank.ts')

function fromUnicode(s: string): string {
  return s
    .replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)))
    .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])/g, (_m, d: string, sign: string) => '^' + [...d].map((c) => Object.keys(SUP).find((k) => SUP[k] === c)).join('') + (sign === '⁺' ? '+' : '-'))
    .replace(/·/g, '*')
    .replace(/\s+/g, '')
}
const compoundByKey = new Map<string, { id: string; formula: string }[]>()
for (const c of Object.values(compoundById) as { id: string; formulaUnicode: string; composition?: Counts }[]) {
  let key: string
  try {
    key = compKey(parseFormula(fromUnicode(c.formulaUnicode)))
  } catch {
    if (!c.composition) continue
    key = compKey({ counts: c.composition, charge: 0 })
  }
  const arr = compoundByKey.get(key) ?? []
  arr.push({ id: c.id, formula: fromUnicode(c.formulaUnicode) })
  compoundByKey.set(key, arr)
}
const organicByKey = new Map<string, { id: string; formula: string; nameRu: string }[]>()
for (const m of ORGANIC_MOLECULES as { id: string; formula: string; nameRu: string }[]) {
  try {
    const key = compKey(parseFormula(fromUnicode(m.formula)))
    const arr = organicByKey.get(key) ?? []
    arr.push({ id: m.id, formula: fromUnicode(m.formula), nameRu: m.nameRu })
    organicByKey.set(key, arr)
  } catch {
    /* non-parsable organic formula (skeletal names) */
  }
}
function mapCatalog(formula: string, nameRu: string): { catalogId: string | null; catalogKind: 'inorganic' | 'organic' | null; catalogCandidates?: string[] } {
  const key = compKey(parseFormula(formula))
  const inorg = compoundByKey.get(key) ?? []
  const exact = inorg.find((c) => c.formula === formula)
  if (exact) return { catalogId: exact.id, catalogKind: 'inorganic' }
  if (inorg.length === 1) return { catalogId: inorg[0].id, catalogKind: 'inorganic' }
  const org = organicByKey.get(key) ?? []
  const byName = org.find((o) => o.nameRu.toLowerCase() === nameRu.toLowerCase())
  if (byName) return { catalogId: byName.id, catalogKind: 'organic' }
  if (org.length === 1) return { catalogId: org[0].id, catalogKind: 'organic' }
  const cands = [...inorg.map((c) => c.id), ...org.map((o) => o.id)]
  return cands.length ? { catalogId: null, catalogKind: null, catalogCandidates: cands } : { catalogId: null, catalogKind: null }
}
const nameByKey = new Map<string, string>()
for (const c of Object.values(compoundById) as { formulaUnicode: string; nameRu: string }[]) {
  try {
    nameByKey.set(compKey(parseFormula(fromUnicode(c.formulaUnicode))), c.nameRu)
  } catch {
    /* ignore */
  }
}

function reactionKey(terms: { reactants: Term[]; products: Term[] }): string {
  const side = (ts: Term[]) => {
    const g = ts.reduce((a, t) => gcd(a, t.coeff), 0) || 1
    return ts
      .map((t) => `${t.coeff / g}${compKey(parseFormula(t.formula))}`)
      .sort()
      .join('+')
  }
  // normalise the overall gcd across both sides
  const all = [...terms.reactants, ...terms.products].reduce((a, t) => gcd(a, t.coeff), 0) || 1
  const norm = (ts: Term[]) => ts.map((t) => ({ ...t, coeff: t.coeff / all }))
  void side
  const s = (ts: Term[]) =>
    norm(ts)
      .map((t) => `${t.coeff}${compKey(parseFormula(t.formula))}`)
      .sort()
      .join('+')
  return `${s(terms.reactants)}=>${s(terms.products)}`
}
function speciesKey(terms: { reactants: Term[]; products: Term[] }): string {
  const s = (ts: Term[]) => ts.map((t) => compKey(parseFormula(t.formula))).sort().join('+')
  return `${s(terms.reactants)}=>${s(terms.products)}`
}
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}
const bankExact = new Map<string, string>()
const bankSpecies = new Map<string, string>()
const bankUnparsed: string[] = []
for (const r of SCHOOL_REACTION_BANK as { id: string; equationRu: string }[]) {
  for (const step of r.equationRu.split(/;\s*/)) {
    try {
      const eq = parseEquation(fromUnicodeEq(step))
      const k = reactionKey(eq)
      if (!bankExact.has(k)) bankExact.set(k, r.id)
      const sk = speciesKey(eq)
      if (!bankSpecies.has(sk)) bankSpecies.set(sk, r.id)
    } catch {
      bankUnparsed.push(`${r.id}: ${step}`)
    }
  }
}
function fromUnicodeEq(s: string): string {
  return s
    .replace(/→\([^)]*\)/g, '→')
    .split(/(\s*(?:→|⇄|⇌|=)\s*)/)
    .map((part, i) => (i % 2 === 1 ? part : part.split(/\s+\+\s+/).map((t) => fromUnicode(t.replace(/[↑↓]/g, ''))).join(' + ')))
    .join('')
}

// ---------- page text (grade 8 case repair) ----------
addKnownFormulas(await appFormulas())
const linesFile = path.join(ROOT, `scripts/kb/.cache/lines-g${GRADE}.json`)
const pageText = new Map<number, string>()
for (const p of JSON.parse(fs.readFileSync(linesFile, 'utf8')) as { page: number; lines: { t: string }[] }[]) {
  const t = p.lines.map((l) => (GRADE === 8 ? repairLoneSymbols(repairFormulas(l.t, 'case')) : l.t)).join('\n')
  pageText.set(p.page, t.replace(/-\n(?=[а-яё])/g, '').replace(/\s+/g, ' ').trim())
}

function findQuote(page: number, keys: string[]): string | null {
  const text = pageText.get(page)
  if (!text) return null
  // whitespace-insensitive search: map compact index -> original index
  const idx: number[] = []
  let compact = ''
  for (let i = 0; i < text.length; i += 1) {
    if (!/\s/.test(text[i])) {
      idx.push(i)
      compact += text[i]
    }
  }
  const lowerCompact = compact.toLowerCase()
  for (const rawKey of keys) {
    if (!rawKey) continue
    const key = rawKey.replace(/\s+/g, '')
    if (key.length < 1) continue
    let at = -1
    let orig = -1
    // 1) original text, token boundaries (a formula may be split by spaces: "H 2SO4"; a coefficient may precede it)
    const spaced = [...key].map(escapeRe).join('\\s?')
    const reTok = new RegExp(`(?<=(?:^|[\\s+(=→,;:«“"–—-])\\d*)${spaced}(?![A-Za-z0-9]|\\)\\d)`)
    const mt = reTok.exec(text)
    if (mt) orig = mt.index
    if (orig < 0) {
      const re = new RegExp(`(?<![A-Za-z0-9])${escapeRe(key)}(?![a-z0-9])`)
      const m = re.exec(compact)
      if (m) at = m.index
      if (at < 0) at = compact.indexOf(key)
      if (at < 0) at = lowerCompact.indexOf(key.toLowerCase())
      if (at < 0) continue
      orig = idx[at]
    }
    let start = Math.max(0, orig - 60)
    if (start > 0) {
      const sp = text.lastIndexOf(' ', start)
      start = sp >= 0 && orig - sp < 80 ? sp + 1 : start
    }
    let q = text.slice(start, start + 160)
    if (start + 160 < text.length) {
      const sp = q.lastIndexOf(' ')
      if (sp > 100) q = q.slice(0, sp)
    }
    return q.trim()
  }
  return null
}

// ---------- source ----------
type Sub = {
  formula: string | null
  formulaUnicode: string | null
  formulaInBook: boolean
  nameRu: string
  nameInBook: boolean
  aliasesRu?: string[]
  kind: Kind
  role: Role
  page: number
  pages: number[]
  quote: string | null
  catalogId: string | null
  catalogKind: 'inorganic' | 'organic' | null
  catalogCandidates?: string[]
  elementSymbol?: string
  fromEquationOnly?: boolean
  note?: string
}
type Rx = {
  equationAsInBook: string
  equation: string
  equationUnicode: string
  reactants: Term[]
  products: Term[]
  conditions: string | null
  type: string
  isGeneralScheme: boolean
  isIonic: boolean
  fromExercise: boolean
  writtenInBook: boolean
  balanced: boolean
  page: number
  pages: number[]
  quote: string | null
  bankId: string | null
  bankMatch?: 'exact' | 'same-species'
  note?: string
}
type Lab = { title: string; page: number; substances: string[] }
type Section = {
  sectionId: string | null
  chapterId: string | null
  appSections: string[]
  kp: string
  title: string
  pageStart: number
  pageEnd: number
  note?: string
  substances: Sub[]
  reactions: Rx[]
  labWorks: Lab[]
}

const sectionsMeta = (JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/kb/corpus/kb-sections.json'), 'utf8')) as Record<string, { book: { kp: string; title: string; page: number; appSections: string[] }[] }>)[`g${GRADE}`].book
const chunks = (JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/kb/corpus/kb-corpus-g${GRADE}.json`), 'utf8')) as { chunks: { kp: string; chapterId?: string; sectionId?: string; pageEnd: number; type: string }[] }).chunks

const warnings: string[] = []
const fileNotes: string[] = []
const sections: Section[] = []
let cur: Section | null = null
const lines = fs.readFileSync(srcArg, 'utf8').split(/\r?\n/)
lines.forEach((raw, lineNo) => {
  const line = raw.trim()
  if (!line || line.startsWith('#')) return
  const where = `line ${lineNo + 1}`
  try {
    if (line.startsWith('@note ')) {
      fileNotes.push(line.slice(6).trim())
      return
    }
    if (line.startsWith('@kp ')) {
      const m = /^@kp (\S+)(.*)$/.exec(line)!
      const kp = m[1]
      const opts = Object.fromEntries([...m[2].matchAll(/(\w+)=((?:(?!\s\w+=).)+)/g)].map((x) => [x[1], x[2].trim()]))
      const i = sectionsMeta.findIndex((s) => s.kp === kp)
      if (i < 0) throw new Error(`unknown kp ${kp}`)
      const meta = sectionsMeta[i]
      const first = chunks.find((c) => c.kp === kp && c.type === 'textbook')
      const next = sectionsMeta[i + 1]
      const [ps, pe] = opts.pages ? opts.pages.split('-').map(Number) : [meta.page, next ? next.page : Math.max(...chunks.filter((c) => c.kp === kp).map((c) => c.pageEnd))]
      cur = {
        sectionId: first?.sectionId ?? null,
        chapterId: first?.chapterId ?? null,
        appSections: meta.appSections,
        kp,
        title: meta.title,
        pageStart: ps,
        pageEnd: pe,
        ...(opts.note ? { note: opts.note } : {}),
        substances: [],
        reactions: [],
        labWorks: [],
      }
      sections.push(cur)
      return
    }
    if (!cur) throw new Error('item before @kp')
    const sec: Section = cur
    const [head, ...rest] = line.slice(2).split('|')
    const extra = (arr: string[]) => {
      const o: Record<string, string> = {}
      const pos: string[] = []
      for (const a of arr) {
        const m = /^(q|note)=(.*)$/.exec(a)
        if (m) o[m[1]] = m[2]
        else pos.push(a)
      }
      return { o, pos }
    }
    if (line.startsWith('S ')) {
      const { o, pos } = extra([head, ...rest])
      const [fRaw, nRaw, kRaw, roleRaw, pageRaw] = pos
      const formulaInBook = !fRaw.startsWith('!')
      const formula = fRaw.replace(/^!/, '') === '-' ? null : fRaw.replace(/^!/, '')
      const nameInBook = !nRaw.startsWith('~')
      const [nameRu, ...aliases] = nRaw.replace(/^~/, '').split('/').map((s) => s.trim())
      if (!['studied', 'obtained', 'reagent', 'mentioned'].includes(roleRaw)) throw new Error(`bad role ${roleRaw}`)
      const kind = (kRaw === '-' ? (formula ? inferKind(formula) : null) : kRaw) as Kind
      if (!kind || !KINDS.has(kind)) throw new Error(`bad kind ${kRaw}`)
      const page = Number(pageRaw)
      if (!(page >= sec.pageStart - 1 && page <= sec.pageEnd)) warnings.push(`${where}: page ${page} outside kp ${sec.kp} ${sec.pageStart}-${sec.pageEnd}`)
      addSubstance(sec, {
        formula,
        formulaUnicode: formula ? toUnicode(formula) : null,
        formulaInBook: formula ? formulaInBook : false,
        nameRu,
        nameInBook,
        ...(aliases.length ? { aliasesRu: aliases } : {}),
        kind,
        role: roleRaw as Role,
        page,
        pages: [page],
        quote: null,
        catalogId: null,
        catalogKind: null,
        ...(o.note ? { note: o.note } : {}),
        _q: o.q,
      } as Sub & { _q?: string })
      return
    }
    if (line.startsWith('R ')) {
      const { o, pos } = extra([head, ...rest])
      const [pageRaw, asInBook, eqRaw, condRaw, type, flags = ''] = pos
      const page = Number(pageRaw)
      if (!TYPES.has(type)) throw new Error(`bad type ${type}`)
      const equation = (eqRaw === '-' ? asInBook : eqRaw)
        .replace(/^[а-яa-z0-9]+\)\s*/i, '')
        .replace(/[;,.]\s*$/, '')
        .replace(/\s*=\s*/, ' → ')
        .replace(/\s+/g, ' ')
        .trim()
      const parsed = parseEquation(equation)
      const bal = flags.includes('g') ? { ok: true, diff: '' } : balance(parsed)
      if (!bal.ok) warnings.push(`${where}: UNBALANCED ${equation} (${bal.diff})`)
      const conditions = condRaw === '-' ? null : condRaw
      let bankId: string | null = null
      let bankMatch: Rx['bankMatch']
      if (!flags.includes('g')) {
        const ek = bankExact.get(reactionKey(parsed))
        if (ek) {
          bankId = ek
          bankMatch = 'exact'
        } else {
          const sk = bankSpecies.get(speciesKey(parsed))
          if (sk) {
            bankId = sk
            bankMatch = 'same-species'
          }
        }
      }
      const rx: Rx = {
        equationAsInBook: asInBook,
        equation,
        equationUnicode: unicodeEquation(equation, conditions),
        reactants: parsed.reactants,
        products: parsed.products,
        conditions,
        type,
        isGeneralScheme: flags.includes('g'),
        isIonic: flags.includes('i'),
        fromExercise: flags.includes('x'),
        writtenInBook: !flags.includes('e'),
        balanced: bal.ok,
        page,
        pages: [page],
        quote: findQuote(page, [o.q ?? '', asInBook.slice(0, 14), parsed.reactants[0]?.formula ?? '']),
        bankId,
        ...(bankMatch ? { bankMatch } : {}),
        ...(o.note ? { note: o.note } : {}),
      }
      if (!rx.quote) warnings.push(`${where}: no quote for reaction ${equation}`)
      const dup = sec.reactions.find((r) => reactionKey(r) === reactionKey(rx))
      if (dup) {
        if (!dup.pages.includes(page)) dup.pages.push(page)
      } else sec.reactions.push(rx)
      return
    }
    if (line.startsWith('L ')) {
      const [pageRaw, title, subs] = [head, ...rest]
      sec.labWorks.push({ title, page: Number(pageRaw), substances: subs ? subs.split(',').map((s) => s.trim()) : [] })
      return
    }
    throw new Error(`unknown line type`)
  } catch (err) {
    warnings.push(`${where}: ERROR ${(err as Error).message} :: ${line}`)
  }
})

function addSubstance(sec: Section, s: Sub & { _q?: string }) {
  const key = s.formula ?? `name:${s.nameRu.toLowerCase()}`
  const quoteKeys = [s._q ?? '', s.formula ? s.formula.split('^')[0].replace(/\*/g, '•') : '', s.nameRu.slice(0, Math.max(5, Math.min(9, s.nameRu.length)))]
  const existing = sec.substances.find((x) => (x.formula ?? `name:${x.nameRu.toLowerCase()}`) === key)
  const quote = findQuote(s.page, quoteKeys)
  if (existing) {
    if (!existing.pages.includes(s.page)) existing.pages.push(s.page)
    // aliases hold only names printed in the book; a supplied (~) name is kept only while no book name is known
    if (s.nameInBook) {
      if (!existing.nameInBook) {
        existing.nameRu = s.nameRu
        existing.nameInBook = true
        existing.aliasesRu = [...new Set(s.aliasesRu ?? [])]
      } else {
        const names = new Set([existing.nameRu, ...(existing.aliasesRu ?? [])])
        for (const n of [s.nameRu, ...(s.aliasesRu ?? [])]) if (!names.has(n)) (existing.aliasesRu ??= []).push(n)
      }
      if (existing.aliasesRu && !existing.aliasesRu.length) delete existing.aliasesRu
    }
    if (s.formulaInBook) existing.formulaInBook = true
    if (ROLE_RANK[s.role] > ROLE_RANK[existing.role]) {
      existing.role = s.role
      existing.page = s.page
      existing.quote = quote ?? existing.quote
    }
    if (!existing.quote) existing.quote = quote
    if (s.note) existing.note = existing.note ? `${existing.note}; ${s.note}` : s.note
    return
  }
  const { _q, ...clean } = s
  void _q
  const entry: Sub = { ...clean, quote }
  if (entry.formula) {
    Object.assign(entry, mapCatalog(entry.formula, entry.nameRu))
    const p = parseFormula(entry.formula)
    const els = Object.keys(p.counts)
    if (els.length === 1 && !p.charge) entry.elementSymbol = els[0]
  }
  sec.substances.push(entry)
}

// substances present only in equations → add (and warn so the source can name them)
for (const sec of sections) {
  for (const rx of sec.reactions) {
    if (rx.isGeneralScheme) continue
    for (const [terms, role] of [
      [rx.reactants, 'reagent'],
      [rx.products, 'obtained'],
    ] as const) {
      for (const t of terms) {
        const k = compKey(parseFormula(t.formula))
        const found = sec.substances.find((s) => s.formula && compKey(parseFormula(s.formula)) === k)
        if (found) {
          if (!found.pages.includes(rx.page)) found.pages.push(rx.page)
          if (ROLE_RANK[role] > ROLE_RANK[found.role] && found.role === 'mentioned') found.role = role
          continue
        }
        warnings.push(`kp ${sec.kp}: substance only in equation: ${t.formula} (p.${rx.page})`)
        addSubstance(sec, {
          formula: t.formula,
          formulaUnicode: toUnicode(t.formula),
          formulaInBook: rx.writtenInBook,
          nameRu: nameByKey.get(k)?.toLowerCase() ?? t.formula,
          nameInBook: false,
          kind: inferKind(t.formula),
          role,
          page: rx.page,
          pages: [rx.page],
          quote: null,
          catalogId: null,
          catalogKind: null,
          fromEquationOnly: true,
        })
      }
    }
  }
  for (const s of sec.substances) {
    s.pages.sort((a, b) => a - b)
    if (!s.quote) warnings.push(`kp ${sec.kp}: no quote for ${s.formula ?? s.nameRu} p.${s.page}`)
  }
}

const allSubs = sections.flatMap((s) => s.substances)
const uniqueFormulas = new Set(allSubs.filter((s) => s.formula).map((s) => s.formula))
const out = {
  grade: GRADE,
  part: PART,
  source: `public/textbooks/kimyo-${GRADE}-ru.pdf`,
  generatedAt: new Date().toISOString(),
  split: `kb-sections.json g${GRADE}.book, part ${PART}: kp ${sections[0]?.kp}..${sections[sections.length - 1]?.kp}`,
  notes: fileNotes,
  counts: {
    sections: sections.length,
    substances: allSubs.length,
    uniqueFormulas: uniqueFormulas.size,
    substancesWithoutFormula: allSubs.filter((s) => !s.formula).length,
    reactions: sections.reduce((a, s) => a + s.reactions.length, 0),
    reactionsMappedToBank: sections.reduce((a, s) => a + s.reactions.filter((r) => r.bankId).length, 0),
    substancesMappedToCatalog: allSubs.filter((s) => s.catalogId).length,
    labWorks: sections.reduce((a, s) => a + s.labWorks.length, 0),
  },
  sections,
}
fs.mkdirSync(path.dirname(outArg), { recursive: true })
fs.writeFileSync(outArg, JSON.stringify(out, null, 2) + '\n')
console.log(JSON.stringify(out.counts))
if (bankUnparsed.length) console.log('bank steps not parsed:', bankUnparsed.length, bankUnparsed.slice(0, 8).join(' || '))
console.log(`warnings (${warnings.length}):\n` + warnings.join('\n'))
