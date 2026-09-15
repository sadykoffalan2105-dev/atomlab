/**
 * Text analysis shared by the offline index build (scripts/kb/build-index.mts) and the runtime search.
 *
 * - Unicode folding: sub/superscripts → ASCII, ё → е, apostrophe variants unified, soft hyphens removed.
 * - Chemical formulas become single terms: "H₂SO₄" / "H2SO4" / "Н2SО4" (Cyrillic look-alikes) → "h2so4",
 *   "Ca(OH)₂" → "caoh2". Leading coefficients and ion charges are dropped.
 * - Cyrillic words → Russian Snowball stems. Latin words → one light stemmer for English and Uzbek
 *   (the same one is used at build and query time, so both sides always agree).
 *
 * Any change here changes the terms stored in the prebuilt index: rebuild with `npm run kb:index`.
 */
import { stemRussian } from './stemRu'

export const ANALYZER_VERSION = 4

const ELEMENT_SYMBOLS = new Set(
  (
    'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr ' +
    'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu ' +
    'Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg ' +
    'Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'
  ).split(' '),
)

export function isElementSymbol(s: string): boolean {
  return ELEMENT_SYMBOLS.has(s)
}

const SUB_SUP: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '₊': '+', '₋': '-', '₍': '(', '₎': ')',
}
const SUPERSCRIPT: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-',
}

/** Unicode/ё/apostrophe folding. Keeps case (formula detection needs it). */
export function foldText(input: string): string {
  let s = input
    // superscript runs (charges, exponents) become a separate "^.." piece so "SO₄²⁻" stays "SO4"
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, (m) => '^' + [...m].map((c) => SUPERSCRIPT[c] ?? c).join('') + ' ')
    .replace(/[₀-₉₊₋₍₎]/g, (c) => SUB_SUP[c] ?? c)
    .replace(/­/g, '')
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/ё/g, 'е')
    .replace(/Ё/g, 'Е')
  s = s.normalize('NFKC')
  // "свой- ства" / "ве-\nщество" (hyphenated line breaks left by PDF extraction)
  s = s.replace(/([а-яе])-\s+([а-я])/g, '$1$2')
  return s
}

const CYR_TO_LAT: Record<string, string> = {
  А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', О: 'O', Р: 'P', Т: 'T', Х: 'X',
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', і: 'i',
}
const LOOKALIKE_ONLY = /^[АВСЕНКМОРТХаеорсху0-9A-Za-z()[\]]+$/

const FORMULA_RE = /^(?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d*|\[(?:[A-Z][a-z]?\d*)+\]\d*)+$/

/**
 * If `span` is a chemical formula, return its normalised term ("h2so4"), else null.
 * Single symbols ("Na", "O") are returned too; the caller decides whether to keep them.
 */
export function formulaTerm(span: string): string | null {
  let s = span.replace(/^\d+(?=[A-ZА-Я(])/, '') // stoichiometric coefficient
  if (!s) return null
  if (/[а-яА-Я]/.test(s)) {
    if (!LOOKALIKE_ONLY.test(s) || !/[0-9A-Za-z]/.test(s)) return null
    s = [...s].map((c) => CYR_TO_LAT[c] ?? c).join('')
  }
  if (!FORMULA_RE.test(s)) return null
  const symbols = s.match(/[A-Z][a-z]?/g) ?? []
  if (!symbols.length || !symbols.every((x) => ELEMENT_SYMBOLS.has(x))) return null
  // "Ca(OH)2" → "caoh2"
  return s.replace(/[()[\]]/g, '').toLowerCase()
}

export const RU_STOPWORDS = new Set(
  (
    'и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от ' +
    'меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ' +
    'ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего ' +
    'раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем ' +
    'чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот ' +
    'через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть ' +
    'том нельзя такой им более всегда конечно всю между это эта также которые который которая которое которых ' +
    'котором такие таких такое является являются называется называют т е др см рис стр др'
  ).split(' '),
)

/** Conversational / quiz-meta words ignored in queries (not in documents). */
export const RU_QUERY_STOPWORDS = new Set(
  (
    'что такое такая каков какова каково какие каких какое какую каким почему зачем объясни объясните ' +
    'расскажи расскажите скажи скажите пожалуйста помоги помогите можешь можете привет учитель мне понять ' +
    'вопрос ответ ответь выберите выбери отметьте отметь найдите найди верно верный верное верная неверно ' +
    'правильно правильный правильное правильная правильным утверждение утверждения вариант варианты ' +
    'формулировка формулировку перечисленного сказано здесь именно считают считать нужно запомнить ' +
    'пример примеры означает значит определение дай кратко подробно простыми словами'
  ).split(' '),
)

export const EN_STOPWORDS = new Set(
  (
    'a an the of in on at to for from by with and or not is are was were be been being it its this that these ' +
    'those as into than then there their them they he she we you your our i me my do does did done can could ' +
    'should would will shall may might must what which who whom whose why how when where explain tell please ' +
    'describe define definition meaning mean about some any all each such only also very more most other ' +
    'answer correct true false option statement choose select following according textbook lesson paragraph ' +
    'called call example examples related concept concepts similar idea ideas accurately distinguishes ' +
    'distinguish specifically only check'
  ).split(' '),
)

export const UZ_STOPWORDS = new Set(
  (
    "va bu u ular bilan uchun nima nimani nimaga nimalar qanday qaysi qaysisi nechta ham yoki esa emas deb " +
    "bo'ladi boladi hisoblanadi ataladi deyiladi degan degani nega nechun qachon qayerda kim kimlar bir " +
    "shu ushbu o'sha osha har barcha hamma juda eng ko'p kop kam ba'zi bazi agar lekin ammo biroq chunki " +
    "tushuntir tushuntiring ayting aytib bering iltimos savol javob to'g'ri togri noto'g'ri notogri variant " +
    "tanlang belgilang toping darslik bo'yicha boyicha paragraf mavzu misol misollar " +
    // question / quiz wording: "haqida" (about), "yagona" (only), "tushuncha" (concept), "o'xshash g'oya" (similar idea) …
    "haqida haqidagi yagona tushuncha o'xshash oxshash g'oya goya aniqroq ajratib turadi tavsif ma'no mano " +
    "orasida so'z soz tegishli balki o'zi ozi xos"
  ).split(' '),
)

/** Stems of UZ_STOPWORDS entries, so inflected forms ("tushunchasiga", "variantni") are dropped too. */
let uzStopStems: Set<string> | null = null
function isUzStopword(word: string): boolean {
  const bare = word.replace(/'/g, '')
  if (UZ_STOPWORDS.has(word) || UZ_STOPWORDS.has(bare)) return true
  if (!uzStopStems) uzStopStems = new Set([...UZ_STOPWORDS].map((w) => stemLatin(w)))
  return bare.length > 4 && uzStopStems.has(stemLatin(word))
}

const UZ_SUFFIXES = [
  'larining', 'larini', 'larida', 'laridan', 'lariga', 'larning', 'larni', 'larda', 'lardan', 'larga', 'lari',
  'lar', 'ining', 'ning', 'dagi', 'idagi', 'sidagi', 'lik', 'ligi', 'likni', 'ligini', 'dan', 'ini', 'ni', 'ga',
  'ka', 'qa', 'da', 'si', 'dir',
].sort((a, b) => b.length - a.length)

const LATIN_EXCEPTIONS: Record<string, string> = { gases: 'gas', bases: 'base', analyses: 'analysis' }

const latinCache = new Map<string, string>()

/**
 * Light stemmer for Latin-script words (English + Uzbek Latin). Deliberately conservative:
 * plural / case suffixes only, min stem length 3–4. Also used for glossary keys.
 */
export function stemLatin(word: string): string {
  const cached = latinCache.get(word)
  if (cached !== undefined) return cached
  let w = word.replace(/'/g, '')
  if (LATIN_EXCEPTIONS[w]) return LATIN_EXCEPTIONS[w]
  // Uzbek agglutinative suffixes (up to two passes: modda-lar-ning)
  for (let pass = 0; pass < 2; pass += 1) {
    let stripped = false
    for (const suf of UZ_SUFFIXES) {
      if (w.length - suf.length >= 3 && w.endsWith(suf)) {
        w = w.slice(0, -suf.length)
        stripped = true
        break
      }
    }
    if (!stripped) break
  }
  // English
  if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y'
  else if (w.length > 4 && /(ss|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1)
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith('ed') && !w.endsWith('eed')) w = w.slice(0, -2)
  if (/([bdfglmnprt])\1$/.test(w) && w.length > 4) w = w.slice(0, -1)
  if (latinCache.size > 20000) latinCache.clear()
  latinCache.set(word, w)
  return w
}

export type TokenKind = 'ru' | 'lat' | 'formula' | 'symbol'
export type AnalyzedToken = { term: string; kind: TokenKind; surface: string }

const SPAN_RE = /[\p{L}\p{N}()[\]']+/gu

/** Latin look-alikes inside Cyrillic words ("Meталлы", "Oксид" typed with a Latin M/O). */
const LAT_TO_CYR: Record<string, string> = {
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
  a: 'а', c: 'с', e: 'е', k: 'к', o: 'о', p: 'р', x: 'х', y: 'у',
}

/** Replace Latin look-alike letters by Cyrillic ones ("Ko" → "Ко"); null when some letter has no look-alike. */
export function latinToCyrillic(s: string): string | null {
  let out = ''
  for (const c of s) {
    if (/[A-Za-z]/.test(c)) {
      const m = LAT_TO_CYR[c]
      if (!m) return null
      out += m
    } else out += c
  }
  return out
}

/**
 * Formulas broken by a space before a subscript ("Fe(OH) 3", "Al 2O3", "H 2O" from PDF/OCR text or
 * typing): join the digits back when the part before the space is itself a formula.
 */
const FORMULA_GAP_RE = /([A-Z][A-Za-z()[\]\d]*)\s(\d{1,2})(?=[A-Z([\s,.;:∙·•)\]]|$)/g

function joinFormulaGaps(text: string): string {
  if (!/[A-Z]/.test(text)) return text
  return text.replace(FORMULA_GAP_RE, (m, head: string, digits: string) =>
    !/\d$/.test(head) && formulaTerm(head) ? head + digits : m,
  )
}

function countChar(s: string, ch: string): number {
  let n = 0
  for (const c of s) if (c === ch) n += 1
  return n
}

/** Strip quotes and unbalanced brackets around a span: "(гелий" → "гелий", "(NH4)2SO4" stays. */
function trimSpan(input: string): string {
  let t = input.replace(/^'+|'+$/g, '')
  for (const [open, close] of [['(', ')'], ['[', ']']] as const) {
    while (t.startsWith(open) && countChar(t, open) > countChar(t, close)) t = t.slice(1)
    while (t.endsWith(close) && countChar(t, close) > countChar(t, open)) t = t.slice(0, -1)
    if (t.startsWith(open) && t.endsWith(close) && countChar(t, open) === 1) t = t.slice(1, -1)
  }
  return t.replace(/^'+|'+$/g, '')
}

export type AnalyzeOptions = {
  /** Drop conversational words ("объясни", "what is") — for queries. */
  query?: boolean
}

/** Tokenise + normalise + stem. Returns tokens in text order (duplicates kept). */
export function analyzeTokens(text: string, opts: AnalyzeOptions = {}): AnalyzedToken[] {
  const out: AnalyzedToken[] = []
  const folded = joinFormulaGaps(foldText(text))
  for (const m of folded.matchAll(SPAN_RE)) {
    const span = trimSpan(m[0])
    if (!span) continue
    if (/[A-ZА-Я0-9]/.test(span) && /[A-Za-z0-9]/.test(span)) {
      const f = formulaTerm(span)
      if (f) {
        const bare = span.replace(/^\d+/, '')
        const isSymbol = /^[A-Z][a-z]?$/.test(bare)
        out.push({ term: f, kind: isSymbol ? 'symbol' : 'formula', surface: span })
        continue
      }
    }
    // split remaining span into words (brackets and digits separate words)
    for (const w of span.split(/[()[\]]+/)) {
      if (!w) continue
      for (const part of w.match(/\p{L}[\p{L}']*|\p{N}+/gu) ?? []) {
        if (/^\p{N}+$/u.test(part)) continue
        const mixed = /[a-zA-Z]/.test(part) && /[а-яА-ЯёЁ]/.test(part)
        const lower = (mixed ? part.replace(/[A-Za-z]/g, (c) => LAT_TO_CYR[c] ?? c) : part).toLowerCase()
        if (/[а-я]/.test(lower)) {
          const word = lower.replace(/[^а-я]/g, '')
          if (word.length < 2 || RU_STOPWORDS.has(word)) continue
          if (opts.query && RU_QUERY_STOPWORDS.has(word)) continue
          out.push({ term: stemRussian(word), kind: 'ru', surface: part })
        } else if (/[a-z]/.test(lower)) {
          const word = lower.replace(/[^a-z']/g, '').replace(/^'+|'+$/g, '')
          if (word.replace(/'/g, '').length < 2) continue
          if (EN_STOPWORDS.has(word) || isUzStopword(word)) continue
          out.push({ term: stemLatin(word), kind: 'lat', surface: part })
        }
      }
    }
  }
  return out
}

export function analyzeTerms(text: string, opts: AnalyzeOptions = {}): string[] {
  return analyzeTokens(text, opts).map((t) => t.term)
}

/** Script-based locale guess for a query (Uzbek vs English uses marker words/letters). */
export function detectLocale(input: string): 'ru' | 'en' | 'uz' {
  // formulas and element symbols are language-neutral ("H₂SO₄ свойства" is Russian, "NaCl" alone defaults to ru)
  const text = foldText(input).replace(/[A-Za-z0-9()[\]]+/g, (s) => (/[A-Z]/.test(s) && formulaTerm(s) ? ' ' : s))
  const cyr = (text.match(/[а-яё]/gi) ?? []).length
  const lat = (text.match(/[a-z]/gi) ?? []).length
  if (cyr >= lat) return 'ru'
  const t = text.toLowerCase().replace(/[ʻʼ‘’`´]/g, "'")
  let uz = 0
  if (/[og]'/.test(t)) uz += 2
  if (/\b(nima|qanday|qaysi|va|bilan|uchun|modda|kislota|tuz|asos|eritma|nega|haqida|bo'?ladi|deb|ning|lar)\b/.test(t)) uz += 2
  if (/(lar|ning|dagi|lari|ni|ga|da|dan)\b/.test(t)) uz += 1
  if (/\b(the|what|is|are|how|why|of|which|does|do|and|with)\b/.test(t)) uz -= 2
  if (/q(?!u)/.test(t)) uz += 1
  return uz > 0 ? 'uz' : 'en'
}

const UZ_TRANSLIT: [RegExp, string][] = [
  [/o'/g, 'о'], [/g'/g, 'г'], [/sh/g, 'ш'], [/ch/g, 'ч'], [/ts/g, 'ц'], [/yo/g, 'е'], [/yu/g, 'ю'], [/ya/g, 'я'],
  [/ye/g, 'е'], [/^e/, 'э'], [/x/g, 'х'], [/q/g, 'к'], [/j/g, 'ж'], [/y/g, 'й'], [/h/g, 'х'], [/c/g, 'к'], [/w/g, 'в'],
]
const EN_TRANSLIT: [RegExp, string][] = [
  [/tion/g, 'ция'], [/sion/g, 'сия'], [/ph/g, 'ф'], [/ch/g, 'х'], [/th/g, 'т'], [/sh/g, 'ш'], [/qu/g, 'кв'], [/ck/g, 'к'],
  [/x/g, 'кс'], [/c(?=[eiy])/g, 'ц'], [/c/g, 'к'], [/^y/, 'й'], [/y/g, 'и'], [/w/g, 'в'], [/j/g, 'дж'], [/^h/, 'г'], [/h/g, 'х'],
  [/ee/g, 'и'], [/oo/g, 'у'], [/ou/g, 'у'], [/^e/, 'э'], [/e$/, ''],
]
const LAT_BASE: Record<string, string> = {
  a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', i: 'и', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', r: 'р',
  s: 'с', t: 'т', u: 'у', v: 'в', z: 'з',
}

/**
 * Cyrillic stem candidates for a Latin word, for international chemistry terms that the glossary does not
 * cover ("allotropiya" / "allotropy" → "аллотроп", "sublimatsiya" → "сублимац"). Used as a low-weight
 * fallback only when the resulting stem exists in the index vocabulary.
 */
export function cyrillicCandidates(surface: string, locale: 'en' | 'uz'): string[] {
  const word = surface.toLowerCase().replace(/[ʻʼ‘’`´]/g, "'").replace(/[^a-z']/g, '')
  if (word.replace(/'/g, '').length < 5) return []
  const out = new Set<string>()
  const orders = locale === 'uz' ? [UZ_TRANSLIT, EN_TRANSLIT] : [EN_TRANSLIT, UZ_TRANSLIT]
  for (const rules of orders) {
    let w = word
    for (const [re, rep] of rules) w = w.replace(re, rep)
    w = w.replace(/'/g, '').replace(/[a-z]/g, (ch) => LAT_BASE[ch] ?? '')
    if (w.length >= 4) out.add(stemRussian(w))
  }
  return [...out]
}
