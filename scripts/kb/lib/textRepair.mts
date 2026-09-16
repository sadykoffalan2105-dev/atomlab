/**
 * Text repairs for the textbook corpus (KB-1), applied after extraction:
 *
 * - chemical formulas: Cyrillic look-alikes → Latin ("NаОН" → "NaOH"), grade 8 case noise ("h3PO4" → "H3PO4",
 *   "cl" → "Cl"), OCR subscript noise in grade 11 ("Na,O" → "Na2O", "MnSOy" → "MnSO4", "H,0" → "H2O");
 *   every candidate must parse into real element symbols, known formulas from app data win ties;
 * - broken small caps ("эНеРгетичесКие" → "энергетические"), letter-spaced headings ("Э л е к т р о" → "Электро");
 * - lost capitals at sentence starts (grades 8/9);
 * - duplicated uz/ru unit glyphs ("mоlмоль" → "моль");
 * - OCR only: "$" → "§"/"s", Roman numerals in parentheses ("(ПШ)" → "(III)"), Latin look-alike words that are
 *   known Russian words ("rasa" → "газа"), "62r" → "62 г".
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..')

const ELEMENTS = new Set(
  (JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/periodicTableRaw.json'), 'utf8')) as { symbol: string }[]).map(
    (e) => e.symbol,
  ),
)
/** Elements that actually occur in school chemistry (tie-breaker between parses such as "PO4" and "Po4"). */
const SCHOOL = new Set(
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Cr Mn Fe Co Ni Cu Zn Br Ag Sn I Ba Pt Au Hg Pb'.split(' '),
)

const KNOWN = new Set<string>()

/** Register formulas from app data ("H₂SO₄", "Ca(OH)₂", "CuSO₄·5H₂O" …). */
export function addKnownFormulas(list: Iterable<string>) {
  for (const raw of list) {
    for (const part of toAsciiFormula(raw).split(/[·•*.\s+=→]+/)) {
      const f = part.replace(/^\d+/, '').replace(/[+-]+$/, '')
      if (f.length >= 2 && parseFormula(f)) KNOWN.add(f)
    }
  }
}

export function knownFormulaCount() {
  return KNOWN.size
}

/**
 * r10: formulas printed on each page of each book (textbook inventory). While a page is repaired, an OCR/case variant
 * that is printed on that page wins over another known formula with fewer changed characters ("СН," on a page about
 * methane → "CH4", not "CH2"; "CuCl," next to "CuCl2" → "CuCl2").
 */
const PAGE_FORMULAS = new Map<string, Set<string>>()
let pagePrior: Set<string> | null = null
export function registerPageFormulas(grade: number, byPage: Map<number, string[]>) {
  for (const [page, list] of byPage) PAGE_FORMULAS.set(`${grade}:${page}`, new Set(list.map((f) => f.replace(/^\d+/, ''))))
}
export function enterPage(grade: number | null, page?: number) {
  pagePrior = grade == null || page == null ? null : (PAGE_FORMULAS.get(`${grade}:${page}`) ?? null)
}

const SUBS: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '⁰': '', '¹': '', '²': '', '³': '', '⁴': '', '⁵': '', '⁶': '', '⁷': '', '⁸': '', '⁹': '', '⁺': '', '⁻': '',
}
export function toAsciiFormula(s: string) {
  return s.replace(/[₀-₉⁰-⁹⁺⁻¹²³]/g, (c) => SUBS[c] ?? c)
}

const CYR_TO_LAT: Record<string, string> = {
  А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', О: 'O', Р: 'P', Т: 'T', Х: 'X',
  а: 'a', с: 'c', е: 'e', о: 'o', р: 'p', х: 'x', у: 'y', І: 'I', і: 'i',
}
const CYR_LOOKALIKE = /^[АВСЕНКМОРТХасеорхуІі]$/

/** Element-symbol parse: optional coefficient, symbols with counts, (groups)n, trailing count letters n/x. */
export function parseFormula(t: string): { atoms: number; symbols: string[] } | null {
  const body = t.replace(/^\d+/, '')
  if (!body || !/^[A-Z([]/.test(body)) return null
  let i = 0
  let depth = 0
  let atoms = 0
  const symbols: string[] = []
  while (i < body.length) {
    const ch = body[i]
    if (ch === '(' || ch === '[') {
      depth += 1
      i += 1
      continue
    }
    if (ch === ')' || ch === ']') {
      depth -= 1
      if (depth < 0) return null
      i += 1
      while (i < body.length && /[\dn]/.test(body[i])) i += 1
      continue
    }
    if (/[A-Z]/.test(ch)) {
      const two = body.slice(i, i + 2)
      let sym: string
      if (two.length === 2 && /[a-z]/.test(two[1]) && ELEMENTS.has(two)) sym = two
      else if (ELEMENTS.has(ch)) sym = ch
      else return null
      i += sym.length
      symbols.push(sym)
      atoms += 1
      while (i < body.length && /\d/.test(body[i])) i += 1
      if (i < body.length && body[i] === 'n' && (i + 1 === body.length || /[A-Z(\d)+-]/.test(body[i + 1]))) i += 1
      continue
    }
    return null
  }
  if (depth !== 0) return null
  return { atoms, symbols }
}

function formulaScore(f: string, changes: number): number {
  const p = parseFormula(f)
  if (!p) return -Infinity
  let s = KNOWN.has(f.replace(/^\d+/, '')) ? 100 : 0
  if (pagePrior?.has(f.replace(/^\d+/, ''))) s += 3
  for (const sym of p.symbols) s += SCHOOL.has(sym) ? 1 : -3
  return s - changes * 0.5
}

type Variant = { text: string; changes: number }

/** Enumerate per-character alternatives (capped) and return the best-scoring valid formula. */
function bestVariant(chars: string[][], base: string): string | null {
  let variants: Variant[] = [{ text: '', changes: 0 }]
  for (const opts of chars) {
    const next: Variant[] = []
    for (const v of variants) {
      opts.forEach((o, k) => next.push({ text: v.text + o, changes: v.changes + (k === 0 ? 0 : 1) }))
    }
    variants = next.length > 256 ? next.sort((a, b) => a.changes - b.changes).slice(0, 256) : next
  }
  let best: string | null = null
  let bestScore = -Infinity
  for (const v of variants) {
    const s = formulaScore(v.text, v.changes)
    if (s > bestScore) {
      bestScore = s
      best = v.text
    }
  }
  if (best == null || bestScore === -Infinity) return null
  // a plain valid formula that is not known must not be "improved" into a different unknown one
  if (best !== base && !KNOWN.has(best.replace(/^\d+/, '')) && parseFormula(base)) return base
  return best
}

export type FormulaMode = 'layout' | 'case' | 'ocr'

const TOKEN_RE = /[A-Za-zА-Яа-яЁё0-9()[\],;$]+/g

/**
 * Repair formula-like tokens in a line of text.
 * layout: look-alike mapping only; case: + lowercase letters may be capitals (grade 8); ocr: + subscript noise.
 */
export function repairFormulas(text: string, mode: FormulaMode): string {
  return text.replace(TOKEN_RE, (tok) => repairToken(tok, mode))
}

function repairToken(tok: string, mode: FormulaMode): string {
  {
    // separators at the ends are punctuation, not subscripts
    const open = (s: string) => (s.match(/[([]/g) ?? []).length
    const close = (s: string) => (s.match(/[)\]]/g) ?? []).length
    let lead = /^[,;$]*/.exec(tok)![0]
    let trail = /[,;]*$/.exec(tok)![0]
    let core = tok.slice(lead.length, tok.length - trail.length)
    // unbalanced brackets belong to the sentence: "(NaCl, MgO)"
    if (/^[([]/.test(core) && open(core) > close(core)) {
      const m = /^[([,;]+/.exec(core)![0]
      lead += m
      core = core.slice(m.length)
    }
    if (/[)\]][,;]*$/.test(core) && close(core) > open(core)) {
      const m = /[)\],;]+$/.exec(core)![0]
      trail = m + trail
      core = core.slice(0, core.length - m.length)
    }
    if (core.length < 2) return tok
    // fully bracketed: "[H20]", "(Сu)" → repair the inside
    const wrapped = /^([([])([^()[\]]+)([)\]])$/.exec(core)
    if (wrapped) {
      const inner = repairToken(wrapped[2], mode)
      return lead + wrapped[1] + inner + wrapped[3] + trail
    }
    const letters = core.replace(/[^A-Za-zА-Яа-яЁё]/g, '')
    if (!letters) return tok
    if (![...letters].every((c) => /[A-Za-z]/.test(c) || CYR_LOOKALIKE.test(c) || (mode === 'ocr' && /[пи]/.test(c)))) {
      return repairFunctionNotation(tok, lead, core, trail, mode)
    }
    const hasLatin = /[A-Za-z]/.test(core)
    const hasCyr = /[А-Яа-яЁё]/.test(core)
    const hasDigit = /\d/.test(core)
    const hasNoise = mode === 'ocr' && (/[,;$]|[A-Z)]y|Os$|[A-Za-z]0/.test(core) || trail !== '')
    if (/^[IVXХ]+$/.test(core) && hasCyr) return lead + core.replace(/Х/g, 'X') + trail // Roman numerals
    // OCR "Си$О,", "Ее$": Cyrillic-only tokens with lost-subscript noise may still be formulas (kept only when known)
    const ocrOnlyNoise = mode === 'ocr' && !hasLatin && !hasDigit && /[,;$]/.test(core + trail)
    if (!hasLatin && !((hasDigit || ocrOnlyNoise || (hasNoise && /[,;]/.test(core))) && /^\d*[А-ЯЁ]/.test(core))) return tok // Russian words ("ОН", "СО")
    if (!hasDigit && !hasNoise && !hasCyr && mode !== 'case') return tok // already clean Latin
    if (/^[a-z]/.test(core) && mode !== 'case') return tok
    if (mode !== 'case' && /[a-z]{3,}/.test(core.replace(/[А-Яа-яЁё]/g, (c) => CYR_TO_LAT[c] ?? c))) return tok // Latin words
    const chars: string[][] = []
    for (let i = 0; i < core.length; i += 1) {
      const c = core[i]
      const lat = CYR_TO_LAT[c] ?? (mode === 'ocr' && c === 'п' ? 'n' : c)
      const prev = i > 0 ? core[i - 1] : ''
      let opts = [lat]
      if (mode === 'case' && /[a-z]/.test(lat)) opts.push(lat.toUpperCase())
      if (mode === 'ocr') {
        if (c === ',' || c === ';') opts = c === ',' ? ['2', '3', '4', ''] : ['3', '2', '4', '']
        else if (c === '$') opts = ['S']
        else if (c === 'М') opts = ['M', 'N']
        else if (c === 'Е') opts = ['E', 'F']
        else if (c === 'и' && /[СC]/.test(prev)) opts = ['u']
        else if (c === '1' && /[СC]/.test(prev)) opts = ['1', 'l']
        else if (c === '8' && /[A-Za-zА-Яа-я,;]/.test(prev)) opts = ['8', 'S']
        else if (lat === 's' && prev !== 'O') opts.push('S')
        else if (lat === 'y' && i > 0) opts = [prev === 'H' || prev === 'e' ? '2' : '4', '4', '3', '2', '', 'y']
        else if (lat === 's' && prev === 'O') opts.push('3')
        else if (c === '0' && /[A-Za-zА-Яа-я,;)]/.test(prev)) opts.unshift('O')
        else if (c === '0' && /\d/.test(prev)) opts.push('O')
        else if (lat === 'o' && i > 0) opts.push('O', '2')
      }
      chars.push([...new Set(opts)])
    }
    const base = chars.map((o) => o[0]).join('')
    const stripped = (f: string) => f.replace(/^\d+/, '')
    let best = bestVariant(chars, base)
    let tail = trail
    if (mode === 'ocr' && trail && (!best || !KNOWN.has(stripped(best)))) {
      // "NH;" / "Cu(NO;3)," / "FeSO," : the trailing separator is a lost subscript
      for (const add of trail[0] === ';' ? ['3', '4', '2'] : ['2', '4', '3']) {
        const withTail = bestVariant([...chars, [add]], base + add)
        if (withTail && KNOWN.has(stripped(withTail))) {
          best = withTail
          tail = trail.slice(1)
          break
        }
      }
    }
    if (!best) return repairFunctionNotation(tok, lead, core, trail, mode)
    if (mode === 'case' && best !== base && !KNOWN.has(stripped(best))) {
      // unknown re-cased formula: a lower-case letter completing a school symbol stays ("Pb(Oh)2" → "Pb(OH)2", not "PB(OH)2")
      const keep = chars.map((o, i) => (i > 0 && /^[A-Z]$/.test(chars[i - 1][0]) && /^[a-z]$/.test(o[0]) && SCHOOL.has(chars[i - 1][0] + o[0]) ? [o[0]] : o))
      const alt = bestVariant(keep, base)
      if (!alt || alt === base || !plausibleCaseRepair(base, alt)) return tok
      if (process.env.KB_DEBUG_CASE) console.log('[case]', JSON.stringify(tok), '→', JSON.stringify(lead + alt + tail))
      best = alt
    }
    if (ocrOnlyNoise && !KNOWN.has(stripped(best))) return tok
    const p = parseFormula(best)!
    if (p.atoms < 2 && !/\d/.test(best) && !(hasCyr && hasLatin)) return tok
    return lead + best + tail
  }
}

/**
 * Grade 8 case noise in formulas the app does not know ("cr(Oh)2", "(cuOh)2cO3", "Nh4al(SO4)2", "Fecl"): accept the
 * re-cased formula when it is built from school elements only, the token shows formula structure (digits, brackets,
 * an inner capital "crO", or 4+ characters) and no two neighbouring letters had to be capitalised (Latin words:
 * "Sof" → "SOF", "Bosh" → "BOSH" stay as they are).
 */
function plausibleCaseRepair(base: string, best: string): boolean {
  if (base.length !== best.length) return false
  // electron configurations ("1s2", "3s23p4") and "n" multipliers ("nSO3", "n(OH)") are not formulas to re-case
  if (/^(\d?[spdf]\d{0,2})+$/.test(base) || /^n/.test(base)) return false
  const p = parseFormula(best)
  if (!p || p.atoms < 2 || p.symbols.some((s) => !SCHOOL.has(s))) return false
  const structural = /[\d()[\]]/.test(base) || (p.atoms >= 2 && (/.[A-Z]/.test(base) || (base.length >= 4 && /^[A-Z]/.test(base))))
  if (!structural) return false
  let run = 0
  for (let i = 0; i < base.length; i += 1) {
    run = base[i] !== best[i] ? run + 1 : 0
    if (run >= 2) return false
  }
  return true
}

/** "M(MnSOy)", "m(FeSO,)", "E(FeSO4)": repair the formula inside a quantity symbol. */
function repairFunctionNotation(tok: string, lead: string, core: string, trail: string, mode: FormulaMode): string {
  const m = /^([A-Za-zА-Яа-я]{1,3})\(([^()]+)\)$/.exec(core)
  if (!m) return tok
  const inner = repairToken(m[2], mode)
  return inner === m[2] ? tok : lead + m[1] + '(' + inner + ')' + trail
}

/** Grade 8: lone "c"/"h"/"cl" are element symbols typed in a font whose capitals come out lowercase. */
export function repairLoneSymbols(text: string): string {
  return text
    .replace(/\((i{1,3}|iv|vi{0,3}|ix)\)/gi, (m) => m.toUpperCase())
    .replace(/(^|[\s,(:;])(cl|c|h)(?=[\s,.;:)]|$)/g, (_m, a: string, s: string) => a + (s === 'cl' ? 'Cl' : s.toUpperCase()))
    .replace(/°\s?c\b/g, '°C')
    // two-letter symbols in half-reactions / ion notation: "al – 3e → al+3", "fe2+"
    .replace(
      /(^|[\s,(:;])(al|na|mg|ca|fe|cu|zn|ag|ba|li|mn|cr|pb|hg|au|sn|si|br|cl)(?=\d|\+|\s?[–—+→=-]\s?\d?[eе]?)/g,
      (_m, a: string, sym: string) => a + sym[0].toUpperCase() + sym[1],
    )
}

/** OCR of drawings: "нннннненнн", "еенннненн" — tokens with 3+ repeated letters or almost no distinct letters. */
export function dropOcrJunk(text: string): string {
  return text
    // check-mark bullets come out as "У’" / "V’"
    .replace(/(^|\s)[УV][’'`]+(?=\s|$)/g, '$1•')
    .replace(/\S*([А-Яа-яЁё])\1\1\S*/g, '')
    .replace(/[А-Яа-яЁё]{10,}/g, (w) => (new Set(w.toLowerCase()).size <= 4 ? '' : w))
    .replace(/[ \t]{2,}/g, ' ')
}

const ONE_LETTER_WORDS = new Set(['в', 'и', 'с', 'к'])
const SHORT_WORDS = new Set(
  'на по из за от до не ни во со ко об для при без над под про что как это или но его ее их все так уже же бы ли то та те тот эта эти этот если чем где когда они она оно он мы вы их им ими два три при раз'.split(' '),
)

/**
 * Split words glued by lost spaces ("периодическойтаблицехимических", "Еслипоусловию") into known words.
 * `freq`: lowercase word → frequency in the books. Only tokens that are themselves (almost) unknown are split;
 * the first piece may be unknown when a drop-cap letter is missing ("олярностьсвязи…").
 */
export function segmentGlued(
  text: string,
  freq: (w: string) => number,
  isKnownWord: (w: string) => boolean = () => false,
  minLen = 12,
): string {
  return text.replace(/[А-Яа-яЁё]+/g, (tok) => {
    if (tok.length < minLen) return tok
    const low = tok.toLowerCase()
    if (freq(low) >= 2 || isKnownWord(low)) return tok
    const n = low.length
    // A token seen once (usually itself) counts as a word below, so a lost space is only undone by a "strong" split:
    // every piece a frequent word ("однакоэтогонепроисходит" → однако|этого|не|происходит), optionally after a lost
    // drop-cap start (≤ 7 letters). Rare real words ("предназначена", "координационной") are not cut into пред|на|…
    const strong = strongSplit(low, freq)
    if (strong) return renderPieces(tok, strong)
    const known = (a: number, b: number) => {
      const piece = low.slice(a, b)
      if (piece.length === 1) return ONE_LETTER_WORDS.has(piece)
      if (piece.length <= 3) return SHORT_WORDS.has(piece)
      if (piece.length === 4) return SHORT_WORDS.has(piece) || freq(piece) >= 5
      if (piece.length > 25) return false
      // long words seen elsewhere in the books count as words
      return freq(piece) >= 3 || (piece.length >= 9 && freq(piece) >= 1)
    }
    /** cost of a piece that is a word: 1; a rare form of a common stem ("асимметрией") 1.6; one letter 0.5; else 0 */
    const wordCost = (a: number, b: number) =>
      known(a, b) ? (b - a === 1 ? 0.5 : 1) : b - a >= 6 && isKnownWord(low.slice(a, b)) ? 1.6 : 0
    // Cheapest cover of the token by words; unknown pieces cost 3 + 0.3/letter at the start (lost drop-cap letter:
    // "олярность…", not limited by share) or the end (≤ 3 letters of a word cut at the line end), 4 + 0.3/letter
    // inside tokens of 18+ letters (6–14 letters); inner unknown letters ≤ 30 % of the token (45 % from 30 letters).
    type State = { cost: number; cuts: number[]; unknownChars: number; unknown: number }
    const maxUnknown = n >= 24 ? 2 : 1
    const maxShare = n >= 30 ? 0.45 : 0.3
    const best: (State | null)[][] = Array.from({ length: n + 1 }, () => new Array(maxUnknown + 1).fill(null))
    best[0][0] = { cost: 0, cuts: [], unknownChars: 0, unknown: 0 }
    const relax = (i: number, j: number, from: State, cost: number, unknownPiece: boolean) => {
      const unknown = from.unknown + (unknownPiece ? 1 : 0)
      const unknownChars = from.unknownChars + (unknownPiece && i > 0 && j < n ? j - i : 0)
      if (unknown > maxUnknown || unknownChars > n * maxShare) return
      const cand: State = { cost: from.cost + cost, cuts: [...from.cuts, j], unknownChars, unknown }
      const cur = best[j][unknown]
      if (!cur || cur.cost > cand.cost) best[j][unknown] = cand
    }
    for (let i = 0; i < n; i += 1) {
      for (const st of best[i]) {
        if (!st) continue
        for (let j = Math.min(n, i + 25); j > i; j -= 1) {
          const len = j - i
          const wc = wordCost(i, j)
          if (wc) relax(i, j, st, wc, false)
          else if (i === 0 && len <= 14 && n - j >= 8) relax(i, j, st, 3 + 0.3 * len, true)
          else if (j === n && i > 0 && len <= 3) relax(i, j, st, 3 + 0.3 * len, true)
          else if (n >= 18 && len >= 6 && len <= 14 && i > 0 && j < n) relax(i, j, st, 4 + 0.3 * len, true)
        }
      }
    }
    const done = best[n].filter((s): s is State => !!s).sort((a, b) => a.cost - b.cost)[0]
    if (!done || done.cuts.length < 2 || done.cuts.length - done.unknown < 2) return tok
    // at least two known pieces of 5+ letters: "пред|на|значен" (a word joined across lines) stays whole
    const longKnown = done.cuts.filter((b, k) => {
      const a = k ? done.cuts[k - 1] : 0
      return b - a >= 5 && (known(a, b) || isKnownWord(low.slice(a, b)))
    }).length
    if (longKnown < 2) return tok
    return renderPieces(tok, done.cuts)
  })
}

function renderPieces(tok: string, cuts: number[]): string {
  const pieces: string[] = []
  let a = 0
  for (const b of cuts) {
    pieces.push(tok.slice(a, b))
    a = b
  }
  // "окислительновосстановительных" → "окислительно-восстановительных"
  let out = pieces[0]
  for (let i = 1; i < pieces.length; i += 1) {
    const hyphen = pieces[i - 1].length >= 6 && pieces[i].length >= 6 && /(ск|льн|ческ|тельн)о$/i.test(pieces[i - 1])
    out += (hyphen ? '-' : ' ') + pieces[i]
  }
  return out
}

/** Cover of `low` by frequent words (fewest pieces); null unless it has ≥ 3 word pieces or 2 long ones. */
function strongSplit(low: string, freq: (w: string) => number): number[] | null {
  const n = low.length
  const strongWord = (w: string) =>
    w.length === 1 ? ONE_LETTER_WORDS.has(w) : w.length <= 3 ? SHORT_WORDS.has(w) : SHORT_WORDS.has(w) || (w.length <= 25 && freq(w) >= (w.length === 4 ? 30 : 8))
  type St = { pieces: number; cuts: number[]; lost: boolean }
  const best: (St | null)[] = new Array(n + 1).fill(null)
  best[0] = { pieces: 0, cuts: [], lost: false }
  for (let i = 0; i < n; i += 1) {
    const st = best[i]
    if (!st) continue
    for (let j = i + 1; j <= Math.min(n, i + 25); j += 1) {
      const w = low.slice(i, j)
      const lost = i === 0 && j <= 7 && !strongWord(w) && freq(w) === 0
      if (!strongWord(w) && !lost) continue
      const cand: St = { pieces: st.pieces + 1, cuts: [...st.cuts, j], lost: st.lost || lost }
      const cur = best[j]
      if (!cur || cand.pieces < cur.pieces || (cand.pieces === cur.pieces && !cand.lost && cur.lost)) best[j] = cand
    }
  }
  const done = best[n]
  if (!done) return null
  const words = done.pieces - (done.lost ? 1 : 0)
  // word pieces of 5+ letters (a lost drop-cap start is not one): "светиль|ни|ко|в" has none → no split
  const long = done.cuts.filter((c, k) => c - (k ? done.cuts[k - 1] : 0) >= 5 && !(k === 0 && done.lost)).length
  return (words >= 3 && long >= 2) || (words === 2 && !done.lost && long === 2 && n >= 12) ? done.cuts : null
}

const UNIT_DUPES: [RegExp, string][] = [
  [/(?<![A-Za-z])m[оo]l(?=мол)/g, ''],
  [/(?<=мол[ьяеи]?)m[оo]l(?![a-z])/g, ''],
  [/(?<![A-Za-z])g\/mol(?=\s?г\/моль)/g, ''],
  [/(?<![A-Za-zа-я])gr?(?=г(?![а-я]))/g, ''],
  [/(?<=\dг)gr?(?![a-z])/g, ''],
  [/(?<![A-Za-z])k(?=г(?![а-я]))/g, 'к'],
  [/(?<![A-Za-zа-я])l(?=л(?![а-я]))/g, ''],
  [/(?<=[^а-я]л)l(?![a-z])/g, ''],
]

/** Uzbek/Latin unit glyphs printed over the Russian ones ("mоlмоль", "gг", "kг"). */
export function repairUnitDupes(text: string): string {
  let t = text
  for (const [re, rep] of UNIT_DUPES) t = t.replace(re, rep)
  return t
}

const UNITS = new Set(['кДж', 'кПа', 'гПа', 'МПа', 'кВт', 'мВт', 'МэВ', 'кэВ', 'мА', 'кВ', 'мВ'])

/** "эНеРгетичесКие" → "энергетические", "ПоДУРовНи" → "Подуровни" (broken small caps). */
export function repairCaseNoise(text: string): string {
  return text.replace(/[А-Яа-яЁё]{3,}/g, (w) => {
    if (UNITS.has(w)) return w
    // "БРом" (two capitals, then lower case)
    if (/^[А-ЯЁ]{2}[а-яё]{2,}$/.test(w)) return w[0] + w.slice(1).toLowerCase()
    if (!/[а-яё][А-ЯЁ]/.test(w)) return w
    if (w === w.toUpperCase()) return w
    const first = /[А-ЯЁ]/.test(w[0]) && /[а-яё]/.test(w[1]) ? w[0] : w[0].toLowerCase()
    return first + w.slice(1).toLowerCase()
  })
}

/** "т е ори я Э л е к т р о л и т и ч е с кой" → "теория Электролитической". */
export function joinLetterSpaced(text: string): string {
  return text.replace(/(?<![А-Яа-яЁё])(?:[А-Яа-яЁё]{1,3} ){4,}[А-Яа-яЁё]{1,4}(?![А-Яа-яЁё])/g, (run) => {
    const toks = run.split(' ')
    const singles = toks.filter((t) => t.length === 1).length
    if (toks.length < 5 || singles < 4 || singles / toks.length < 0.6) return run
    return toks.join('').replace(/([а-яё])([А-ЯЁ])/g, '$1 $2')
  })
}

const ABBREV = new Set(['др', 'см', 'рис', 'табл', 'стр', 'мин', 'сек', 'мл', 'кг', 'км', 'гг', 'вв', 'т.е', 'т.д', 'т.п', 'н.у', 'н.э', 'им', 'проф', 'акад', 'ок', 'прим', 'тыс', 'млн', 'млрд'])

/** Grades 8/9: capital letters at sentence starts come out lowercase. */
export function capitalizeSentences(text: string): string {
  let t = text.replace(/^([«"(]?)([а-яё])/, (_m, q: string, c: string) => q + c.toUpperCase())
  t = t.replace(/([А-Яа-яЁёA-Za-z.]{2,})([.!?])(\s+)([«"(]?)([а-яё])/g, (m, word: string, p: string, sp: string, q: string, c: string) => {
    const w = word.toLowerCase().replace(/\.$/, '')
    if (p === '.' && (ABBREV.has(w) || w.length < 3 || /\.[а-я]$/.test(w))) return m
    return word + p + sp + q + c.toUpperCase()
  })
  t = t.replace(/(^|\s)(\d{1,2}[.)]\s+)([а-яё])/g, (_m, a: string, n: string, c: string) => a + n + c.toUpperCase())
  return t
}

const ROMAN_OCR: Record<string, string> = {
  П: 'II', Ш: 'III', ПШ: 'III', ПТ: 'III', Ш1: 'III', У: 'V', ТУ: 'IV', ГУ: 'IV', '1У': 'IV', IУ: 'IV', lУ: 'IV',
  УТ: 'VI', УГ: 'VI', У1: 'VI', УI: 'VI', Уl: 'VI', УП: 'VII', УШ: 'VIII', УПТ: 'VIII', УП1: 'VIII',
}

const LAT_TO_CYR_OCR: Record<string, string> = {
  a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', k: 'к', r: 'г', u: 'и', n: 'п', m: 'т', b: 'ь', s: 'з',
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
}

/** Grade 11 OCR: paragraph markers "13 $ Растворимость", "3-$.", "$ 4.", "$18" → "§ 13 …" (run before formulas). */
export function repairOcrMarkers(text: string): string {
  let t = text
  t = t.replace(/(^|\s)(\d{1,2})\s*-?\s*[$§]\s*\.?(?=\s*[А-ЯЁA-Z«])/g, '$1§ $2 ')
  t = t.replace(/(^|\s)[$§]\s*(\d{1,2})(?![\d,])\s*\.?/g, '$1§ $2 ')
  return t.replace(/§ (\d+)\s{2,}/g, '§ $1 ')
}

/** Grade 11 OCR noise outside formulas (run after repairFormulas). `vocab`: lowercase words from the text-layer books. */
export function repairOcrText(text: string, vocab: Map<string, number>): string {
  let t = text
  t = t.replace(/\$/g, 's')
  // Roman numerals in parentheses after a word: "оксид хрома (ПШ)"
  t = t.replace(/([А-Яа-яЁё]\s?)\(([ПШУТГ1Il]{1,3})\)/g, (m, a: string, r: string) => (ROMAN_OCR[r] ? `${a}(${ROMAN_OCR[r]})` : m))
  // Greek letters lost by OCR: "а-распад", "у-излучение", "В-распад"
  t = t.replace(/(^|[\s(])[аa]\s?[-—–]\s?(распад|частиц|излуч)/g, '$1α-$2')
  t = t.replace(/(^|[\s(])[уy]\s?[-—–]?\s?(излуч|луч|частиц|квант)/g, '$1γ-$2')
  t = t.replace(/(^|[\s(])[ВB][’'":+-]?\s?[-—–]?\s?(распад)/g, '$1β-$2')
  // "62r" / "80 r" → grams
  t = t.replace(/(\d)\s?r(?![A-Za-zА-Яа-я])/g, '$1 г')
  // Latin look-alike words that are really Russian words
  t = t.replace(/[A-Za-zА-Яа-яЁё]{3,}/g, (w) => {
    if (!/[A-Za-z]/.test(w)) return w
    if (parseFormula(w) && !/[а-я]/.test(w)) return w
    const mapped = [...w].map((c) => LAT_TO_CYR_OCR[c] ?? c).join('')
    if (/[A-Za-z]/.test(mapped)) return w
    const lower = mapped.toLowerCase()
    if ((vocab.get(lower) ?? 0) < 2) return w
    return mapped
  })
  return t
}

const LOOK = 'аеорсухіАЕОРСХ'
const GLUED_PREFIX = new RegExp(String.raw`(?<![A-Za-zА-Яа-яЁё'’])([A-Za-z'’${LOOK}]{2,}[A-Za-z])([а-яё]{3,})(?![A-Za-zА-Яа-яЁё])`, 'g')
const GLUED_SUFFIX = new RegExp(String.raw`(?<![A-Za-zА-Яа-яЁё])([А-Яа-яЁё]*[а-яё]{2})([A-Za-z'’${LOOK}]{2,})(?![A-Za-zА-Яа-яЁё'’])`, 'g')

/**
 * Grades 7–10: Uzbek (Latin script) words printed over the Russian ones end up glued to them
 * ("qаytаruvchiвосстановитель", "сахарshakar", "илиyoki", "обычнойUshbu"). Drop the Latin part when the
 * Russian part is a known word and the Latin part is not a formula / symbol.
 */
export function stripGluedTranslations(text: string, vocab: Map<string, number>): string {
  const freq = (w: string) => vocab.get(w.toLowerCase().replace(/ё/g, 'е')) ?? 0
  const known = (w: string) => freq(w) >= 2
  const latinCount = (s: string) => (s.match(/[A-Za-z]/g) ?? []).length
  const isFormulaish = (s: string) => /\d/.test(s) || !!parseFormula(s.replace(/[’']/g, '')) || /^[A-Z]{1,3}$/.test(s)
  let t = text.replace(GLUED_PREFIX, (m, lat: string, cyr: string) =>
    latinCount(lat) >= 3 && !isFormulaish(lat) && (known(cyr) || (latinCount(lat) >= 5 && freq(cyr) >= 1)) ? cyr : m,
  )
  t = t.replace(GLUED_SUFFIX, (m, cyr: string, lat: string) =>
    latinCount(lat) >= 2 && !/[А-ЯЁ]/.test(lat) && !isFormulaish(lat) && known(cyr) && (latinCount(lat) >= 3 || /^[a-z]/.test(lat)) ? cyr : m,
  )
  return t
}
