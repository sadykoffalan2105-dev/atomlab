/**
 * Разбор химических формул и уравнений из текста (учебник, банк реакций, ссылки).
 *
 * Формулы: скобки () и [], гидраты через · • * ∙ ⋅, подстрочные ₀–₉, заряды
 * (надстрочные ⁺⁻²³…, «^2-», хвостовой «+»/«-»), электрон e / ē / e⁻.
 * Уравнения: стрелки → -> => ⟶ = ⇌ ⇄ <=> ↔, условия над стрелкой «→(t°)»,
 * коэффициенты целые, десятичные, дроби 1/2 и ½, пометки ↑ ↓ (г) (р-р) (конц.).
 *
 * Модуль без зависимостей от каталога — годится и для скриптов сборки.
 */

export type FormulaCounts = Record<string, number>

export type ParsedFormula = {
  /** Число атомов каждого элемента в формульной единице (порядок — как в записи). */
  counts: FormulaCounts
  /** Заряд частицы (0 для нейтральной). */
  charge: number
  /** Электрон (e⁻). */
  electron: boolean
}

export type EquationSpecies = {
  /** Нормализованная ASCII-формула без коэффициента, заряда и пометок (напр. «Ca(OH)2», «CuSO4*5H2O»). */
  formula: string
  coeff: number
  /** null — формулу не удалось разобрать (обобщённая схема, «Me», «R», «CnH2n+2»…). */
  counts: FormulaCounts | null
  charge: number
  electron: boolean
}

export type EquationArrow = '→' | '⇌' | '='

export type ParsedEquationText = {
  reactants: EquationSpecies[]
  products: EquationSpecies[]
  arrow: EquationArrow
  /** Есть ионы или электроны. */
  isIonic: boolean
  /** Обобщённая схема или цепочка превращений (несколько стрелок / «;», неразобранные формулы). */
  isScheme: boolean
  /** Условия над стрелкой, если были записаны в скобках: «t°», «>570 °C», «MnO2». */
  conditions: string | null
}

const ELEMENT_SYMBOLS = new Set(
  (
    'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr ' +
    'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu ' +
    'Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr ' +
    'Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'
  ).split(' '),
)

const SUB_DIGITS: Readonly<Record<string, string>> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
}
const SUP_CHARS: Readonly<Record<string, string>> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-',
}
const SUB_OUT = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'] as const
const SUP_OUT: Readonly<Record<string, string>> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻',
}
const UNICODE_FRACTIONS: Readonly<Record<string, number>> = {
  '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅕': 1 / 5, '⅙': 1 / 6, '⅛': 1 / 8,
}

export function isElementSymbol(sym: string): boolean {
  return ELEMENT_SYMBOLS.has(sym)
}

/** Состав → стабильный ключ «Ca:1|H:2|O:2» (совпадает с reactorEquationBalance.compositionKey). */
export function formulaCompositionKey(counts: Readonly<FormulaCounts>): string {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}:${n}`)
    .join('|')
}

/** Подстрочные цифры → обычные, надстрочный заряд → «^2-», точки гидрата → «*». */
function normalizeFormulaChars(raw: string): string {
  let core = ''
  let charge = ''
  for (const ch of raw) {
    const sub = SUB_DIGITS[ch]
    if (sub != null) {
      core += sub
      continue
    }
    const sup = SUP_CHARS[ch]
    if (sup != null) {
      charge += sup
      continue
    }
    if (ch === '·' || ch === '•' || ch === '∙' || ch === '⋅' || ch === '×') {
      core += '*'
      continue
    }
    if (ch === '−' || ch === '–') {
      core += '-'
      continue
    }
    core += ch
  }
  return charge ? `${core}^${charge}` : core
}

function parseChargeText(text: string): number | null {
  // «2-», «-2», «+», «3+», «--»
  const t = text.trim()
  let m = t.match(/^(\d*)([+-])$/)
  if (m) return (m[1] ? Number(m[1]) : 1) * (m[2] === '+' ? 1 : -1)
  m = t.match(/^([+-])(\d+)$/)
  if (m) return Number(m[2]) * (m[1] === '+' ? 1 : -1)
  m = t.match(/^([+-])\1+$/)
  if (m) return t.length * (m[1] === '+' ? 1 : -1)
  return null
}

function parseCoreCounts(core: string): FormulaCounts | null {
  if (!core) return null
  const total: FormulaCounts = {}
  const parts = core.split('*')
  for (const [partIdx, part0] of parts.entries()) {
    let part = part0
    let mult = 1
    // У гидратной части множитель может быть дробным: «CaSO₄·0.5H₂O», «CaSO₄·½H₂O».
    const mm = partIdx > 0 ? part.match(/^(\d+(?:[.,]\d+)?|½)(.*)$/) : part.match(/^(\d+)(.*)$/)
    if (mm) {
      mult = mm[1] === '½' ? 0.5 : Number(mm[1]!.replace(',', '.'))
      part = mm[2]!
    }
    if (!part || mult <= 0) return null
    const stack: FormulaCounts[] = [{}]
    const openers: string[] = []
    let i = 0
    while (i < part.length) {
      const ch = part[i]!
      if (ch === '(' || ch === '[' || ch === '{') {
        stack.push({})
        openers.push(ch)
        i++
      } else if (ch === ')' || ch === ']' || ch === '}') {
        const opener = openers.pop()
        const expected = ch === ')' ? '(' : ch === ']' ? '[' : '{'
        if (opener !== expected) return null
        i++
        let n = ''
        while (i < part.length && /\d/.test(part[i]!)) n += part[i++]
        const grp = stack.pop()!
        if (Object.keys(grp).length === 0) return null
        const k = n ? Number(n) : 1
        if (k <= 0) return null
        const top = stack[stack.length - 1]!
        for (const [el, c] of Object.entries(grp)) top[el] = (top[el] ?? 0) + c * k
      } else if (/[A-Z]/.test(ch)) {
        let el = ch
        i++
        while (i < part.length && /[a-z]/.test(part[i]!)) el += part[i++]
        if (!ELEMENT_SYMBOLS.has(el)) return null
        let n = ''
        while (i < part.length && /\d/.test(part[i]!)) n += part[i++]
        const k = n ? Number(n) : 1
        if (k <= 0) return null
        const top = stack[stack.length - 1]!
        top[el] = (top[el] ?? 0) + k
      } else {
        return null
      }
    }
    if (stack.length !== 1) return null
    for (const [el, c] of Object.entries(stack[0]!)) total[el] = (total[el] ?? 0) + c * mult
  }
  return Object.keys(total).length > 0 ? total : null
}

const STATE_SUFFIX_RE =
  /\s*\((?:aq|g|l|s|solid|gas|р-р|р\.|р|раств\.?|тв\.?|г|ж|конц\.?|разб\.?|conc\.?|dil\.?|изб\.?|недост\.?)\)\s*$/i

function stripSpeciesMarks(text: string): string {
  let s = text.replace(/[↑↓]/g, '').trim()
  for (let guard = 0; guard < 3; guard++) {
    const next = s.replace(STATE_SUFFIX_RE, '').trim()
    if (next === s) break
    s = next
  }
  return s
}

function splitCoreAndCharge(raw: string): { core: string; charge: number; electron: boolean } | null {
  const s = normalizeFormulaChars(raw).replace(/\s+/g, '')
  if (!s) return null
  // Электрон: e, e-, e^-, ē
  if (/^(?:e|ē)(?:\^?-)?$/.test(s)) return { core: '', charge: -1, electron: true }
  const caret = s.indexOf('^')
  if (caret >= 0) {
    const charge = parseChargeText(s.slice(caret + 1))
    if (charge == null) return null
    return { core: s.slice(0, caret), charge, electron: false }
  }
  // ASCII-хвост: «Na+», «Cl-», «(2-)».
  const paren = s.match(/^(.*?)\((\d*[+-]|[+-]\d*)\)$/)
  if (paren) {
    const charge = parseChargeText(paren[2]!)
    if (charge != null) return { core: paren[1]!, charge, electron: false }
  }
  // «Fe3+», «Cu2+»: у одноатомного иона цифры перед знаком — заряд, а не индекс.
  const mono = s.match(/^([A-Z][a-z]?)(\d+)([+-])$/)
  if (mono && ELEMENT_SYMBOLS.has(mono[1]!)) {
    const charge = parseChargeText(`${mono[2]}${mono[3]}`)
    if (charge != null) return { core: mono[1]!, charge, electron: false }
  }
  const tail = s.match(/^(.*[A-Za-z0-9)\]])([+-]+)$/)
  if (tail) {
    const charge = parseChargeText(tail[2]!)
    if (charge != null) return { core: tail[1]!, charge, electron: false }
  }
  return { core: s, charge: 0, electron: false }
}

/** Разбор одной формулы. null — не формула (обобщённая запись, неизвестный символ, ошибка скобок). */
export function parseFormula(raw: string): ParsedFormula | null {
  const stripped = stripSpeciesMarks(raw)
  const split = splitCoreAndCharge(stripped)
  if (!split) return null
  if (split.electron) return { counts: {}, charge: -1, electron: true }
  const counts = parseCoreCounts(split.core)
  if (!counts) return null
  return { counts, charge: split.charge, electron: false }
}

/** ASCII-формула «Ca(OH)2», «SO4^2-», «CuSO4*5H2O» → «Ca(OH)₂», «SO₄²⁻», «CuSO₄·5H₂O». */
export function formulaToUnicode(ascii: string): string {
  const norm = normalizeFormulaChars(ascii)
  if (/^(?:e|ē)(?:\^?-)?$/.test(norm)) return 'ē'
  const caret = norm.indexOf('^')
  const core = caret >= 0 ? norm.slice(0, caret) : norm
  const charge = caret >= 0 ? norm.slice(caret + 1) : ''
  let out = ''
  let prevIsSym = false
  for (const ch of core) {
    if (/[0-9]/.test(ch) && prevIsSym) {
      out += SUB_OUT[Number(ch)]
      continue
    }
    out += ch === '*' ? '·' : ch
    prevIsSym = /[A-Za-z)\]}]/.test(ch)
  }
  if (charge) out += [...charge].map((c) => SUP_OUT[c] ?? c).join('')
  return out
}

// ───────────────────────── уравнения ─────────────────────────

type ArrowToken = { text: string; kind: EquationArrow }

/** Длинные — раньше коротких («<=>» раньше «=>» и «=»). */
const ARROW_TOKENS: readonly ArrowToken[] = [
  { text: '<=>', kind: '⇌' },
  { text: '<->', kind: '⇌' },
  { text: '-->', kind: '→' },
  { text: '==>', kind: '→' },
  { text: '->', kind: '→' },
  { text: '=>', kind: '→' },
  { text: '⇌', kind: '⇌' },
  { text: '⇄', kind: '⇌' },
  { text: '↔', kind: '⇌' },
  { text: '⟷', kind: '⇌' },
  { text: '⥂', kind: '⇌' },
  { text: '→', kind: '→' },
  { text: '⟶', kind: '→' },
  { text: '⟹', kind: '→' },
  { text: '⇒', kind: '→' },
  { text: '=', kind: '=' },
]

type ArrowHit = { index: number; length: number; kind: EquationArrow }

function findArrows(text: string): ArrowHit[] {
  const hits: ArrowHit[] = []
  let depth = 0
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if ((ch === ')' || ch === ']' || ch === '}') && depth > 0) depth--
    if (depth === 0) {
      const tok = ARROW_TOKENS.find((a) => text.startsWith(a.text, i))
      if (tok) {
        hits.push({ index: i, length: tok.text.length, kind: tok.kind })
        i += tok.text.length
        continue
      }
    }
    i++
  }
  return hits
}

function isTermStart(ch: string | undefined): boolean {
  if (!ch) return false
  return /[0-9A-Z([{½⅓⅔¼¾⅕⅙⅛eē]/.test(ch)
}

/** Условия сразу после стрелки: «→(t°) CaO…», «=[MnO2] 2KCl…». */
function takeArrowConditions(right: string): { conditions: string | null; rest: string } {
  const s = right.replace(/^\s+/, '')
  const open = s[0]
  if (open !== '(' && open !== '[' && open !== '{') return { conditions: null, rest: right }
  const close = open === '(' ? ')' : open === '[' ? ']' : '}'
  let depth = 0
  let end = -1
  for (let i = 0; i < s.length; i++) {
    if (s[i] === open) depth++
    else if (s[i] === close) {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end < 0) return { conditions: null, rest: right }
  const after = s.slice(end + 1)
  // «(NH₄)₂SO₄» — это вещество: за скобкой сразу индекс или символ.
  if (after.length > 0 && !/^\s/.test(after)) return { conditions: null, rest: right }
  const afterTrim = after.trim()
  // «→ (NH4)2 …» уже отсеяно; «→ (MnO2)» в конце или перед « + » — вещество.
  if (afterTrim.length === 0 || afterTrim.startsWith('+')) return { conditions: null, rest: right }
  if (!isTermStart(afterTrim[0])) return { conditions: null, rest: right }
  return { conditions: s.slice(1, end).trim() || null, rest: after }
}

/** Короткие пометки над стрелкой без скобок: «= t° CaO», «→ kat. 2SO3». */
function takeBareConditions(right: string): { conditions: string | null; rest: string } {
  const m = right.match(/^\s*((?:t°?|t\s*°C?|°t|hν|hv|kat\.?|кат\.?|t,\s*kat\.?|t,\s*p|p,\s*t)(?=\s))\s+/i)
  if (!m) return { conditions: null, rest: right }
  return { conditions: m[1]!.trim(), rest: right.slice(m[0].length) }
}

/** Условия, прилепленные к концу левой части: «2KClO3 (t) = …». */
function takeTrailingConditions(left: string): { conditions: string | null; rest: string } {
  const m = left.match(/\s+\(([^()]*(?:°|t|kat|кат|MnO2|MnO₂|Pt|Ni|Fe|V2O5|V₂O₅)[^()]*)\)\s*$/)
  if (!m) return { conditions: null, rest: left }
  // «… + (NH4)2SO4» за скобкой был бы индекс — сюда не попадёт.
  return { conditions: m[1]!.trim(), rest: left.slice(0, m.index) }
}

function splitTerms(side: string): string[] | null {
  const out: string[] = []
  let cur = ''
  let depth = 0
  const s = side
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if ((ch === ')' || ch === ']' || ch === '}') && depth > 0) depth--
    if (ch === '+' && depth === 0) {
      // «^+» / «^2+» — это заряд.
      if (/\^\d*$/.test(cur)) {
        cur += ch
        continue
      }
      let j = i + 1
      while (j < s.length && /\s/.test(s[j]!)) j++
      const next = s[j]
      if (cur.trim().length > 0 && isTermStart(next)) {
        out.push(cur)
        cur = ''
        continue
      }
      cur += ch
      continue
    }
    cur += ch
  }
  if (cur.trim().length > 0) out.push(cur)
  const terms = out.map((t) => t.trim()).filter(Boolean)
  return terms.length > 0 ? terms : null
}

function parseCoeffText(text: string): number | null {
  const t = text.replace(',', '.')
  const frac = UNICODE_FRACTIONS[t]
  if (frac != null) return frac
  const mixed = t.match(/^(\d+)([½⅓⅔¼¾⅕⅙⅛])$/)
  if (mixed) return Number(mixed[1]) + UNICODE_FRACTIONS[mixed[2]!]!
  const f = t.match(/^(\d+)\/(\d+)$/)
  if (f) {
    const d = Number(f[2])
    return d > 0 ? Number(f[1]) / d : null
  }
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseSpecies(termRaw: string): EquationSpecies {
  const term = stripSpeciesMarks(termRaw)
  let coeff = 1
  let body = term
  const m = term.match(/^(\d+(?:[.,]\d+)?(?:\/\d+)?|\d*[½⅓⅔¼¾⅕⅙⅛])\s*(.+)$/)
  if (m) {
    const c = parseCoeffText(m[1]!)
    if (c != null) {
      coeff = c
      body = m[2]!
    }
  }
  const split = splitCoreAndCharge(body)
  if (!split) return { formula: body.replace(/\s+/g, ''), coeff, counts: null, charge: 0, electron: false }
  if (split.electron) return { formula: 'e', coeff, counts: {}, charge: -1, electron: true }
  const counts = parseCoreCounts(split.core)
  return { formula: split.core, coeff, counts, charge: split.charge, electron: false }
}

/** «Fe − 2e⁻» → { main: «Fe», electrons: «2e» }; null — в члене нет «− nē». */
function splitElectronLoss(term: string): { main: string; electrons: string } | null {
  const m = term.match(/^(.*\S)\s+[−–-]\s*(\d*)\s*[eē](?:⁻|\^?-)?$/)
  if (!m) return null
  return { main: m[1]!.trim(), electrons: `${m[2] ?? ''}e` }
}

/** Из текста учебника: неразрывные пробелы, «−», двойные пробелы. */
function normalizeEquationText(text: string): string {
  return text
    .replace(/[\u00a0\u2009\u202f]/g, ' ')
    .replace(/[−–—](?=\s*>)/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Разбор уравнения. null — нет стрелки/знака «=» или пустая сторона.
 * Цепочка «A → B → C» или «…; …» разбирается по первому шагу с isScheme=true.
 */
export function parseEquationText(textRaw: string): ParsedEquationText | null {
  if (!textRaw) return null
  const text = normalizeEquationText(textRaw)
  if (!text) return null
  const steps = text.split(/\s*[;\n]\s*/).filter((s) => s.trim().length > 0)
  if (steps.length === 0) return null
  const first = steps[0]!
  const arrows = findArrows(first)
  if (arrows.length === 0) return null
  const a0 = arrows[0]!
  const leftRaw = first.slice(0, a0.index)
  const rightEnd = arrows.length > 1 ? arrows[1]!.index : first.length
  let rightRaw = first.slice(a0.index + a0.length, rightEnd)

  let conditions: string | null = null
  const cond = takeArrowConditions(rightRaw)
  if (cond.conditions) {
    conditions = cond.conditions
    rightRaw = cond.rest
  } else {
    const bare = takeBareConditions(rightRaw)
    if (bare.conditions) {
      conditions = bare.conditions
      rightRaw = bare.rest
    }
  }
  let leftText = leftRaw
  if (!conditions) {
    const trailing = takeTrailingConditions(leftRaw)
    if (trailing.conditions) {
      conditions = trailing.conditions
      leftText = trailing.rest
    }
  }

  const leftSplit = splitTerms(leftText)
  const rightSplit = splitTerms(rightRaw)
  if (!leftSplit || !rightSplit) return null
  // Полуреакция окисления «Fe − 2e⁻ → Fe²⁺»: отданные электроны переносим вправо
  // («Fe → Fe²⁺ + 2e⁻») — та же реакция, но все члены с положительными коэффициентами.
  const leftTerms: string[] = []
  const rightTerms: string[] = []
  const moveLost = (terms: readonly string[], keep: string[], other: string[]) => {
    for (const t of terms) {
      const lost = splitElectronLoss(t)
      if (lost) {
        keep.push(lost.main)
        other.push(lost.electrons)
      } else keep.push(t)
    }
  }
  moveLost(leftSplit, leftTerms, rightTerms)
  const rightOwn: string[] = []
  moveLost(rightSplit, rightOwn, leftTerms)
  rightTerms.unshift(...rightOwn)
  const reactants = leftTerms.map(parseSpecies)
  const products = rightTerms.map(parseSpecies)
  const all = [...reactants, ...products]
  const isIonic = all.some((s) => s.electron || s.charge !== 0)
  const isScheme = steps.length > 1 || arrows.length > 1 || all.some((s) => s.counts == null)
  return { reactants, products, arrow: a0.kind, isIonic, isScheme, conditions }
}

/** Разница атомов (и заряда) между сторонами; пустой массив — уравнение уравнено. */
export function equationImbalance(eq: Pick<ParsedEquationText, 'reactants' | 'products'>): string[] {
  const sum = (list: readonly EquationSpecies[]) => {
    const c: FormulaCounts = {}
    let q = 0
    for (const s of list) {
      if (!s.counts) return null
      for (const [el, n] of Object.entries(s.counts)) c[el] = (c[el] ?? 0) + n * s.coeff
      q += s.charge * s.coeff
    }
    return { c, q }
  }
  const L = sum(eq.reactants)
  const R = sum(eq.products)
  if (!L || !R) return ['unparsed']
  const diffs: string[] = []
  const els = new Set([...Object.keys(L.c), ...Object.keys(R.c)])
  for (const el of els) {
    if (Math.abs((L.c[el] ?? 0) - (R.c[el] ?? 0)) > 1e-9) diffs.push(`${el}: ${L.c[el] ?? 0}≠${R.c[el] ?? 0}`)
  }
  if (Math.abs(L.q - R.q) > 1e-9) diffs.push(`charge: ${L.q}≠${R.q}`)
  return diffs
}

export function isParsedEquationBalanced(eq: Pick<ParsedEquationText, 'reactants' | 'products'>): boolean {
  return equationImbalance(eq).length === 0
}

function formatCoeff(n: number): string {
  if (n === 1) return ''
  if (Number.isInteger(n)) return String(n)
  for (const [glyph, v] of Object.entries(UNICODE_FRACTIONS)) if (Math.abs(v - n) < 1e-9) return glyph
  return String(Number(n.toFixed(3)))
}

function speciesToUnicode(s: EquationSpecies): string {
  if (s.electron) return `${formatCoeff(s.coeff)}ē`
  const q = s.charge
  const chargeText = q === 0 ? '' : `^${Math.abs(q) === 1 ? '' : Math.abs(q)}${q > 0 ? '+' : '-'}`
  return `${formatCoeff(s.coeff)}${formulaToUnicode(s.formula + chargeText)}`
}

/** Обратно в текст: «2H₂ + O₂ → 2H₂O». */
export function formatEquationUnicode(eq: Pick<ParsedEquationText, 'reactants' | 'products' | 'arrow'>): string {
  const side = (list: readonly EquationSpecies[]) => list.map(speciesToUnicode).join(' + ')
  return `${side(eq.reactants)} ${eq.arrow} ${side(eq.products)}`
}

/** ASCII-запись для URL: «2H2 + O2 = 2H2O». */
export function formatEquationAscii(eq: Pick<ParsedEquationText, 'reactants' | 'products' | 'arrow'>): string {
  const sp = (s: EquationSpecies) => {
    const c = s.coeff === 1 ? '' : Number.isInteger(s.coeff) ? String(s.coeff) : String(Number(s.coeff.toFixed(4)))
    if (s.electron) return `${c}e`
    const q = s.charge
    const chargeText = q === 0 ? '' : `^${Math.abs(q) === 1 ? '' : Math.abs(q)}${q > 0 ? '+' : '-'}`
    return `${c}${s.formula}${chargeText}`
  }
  const arrow = eq.arrow === '⇌' ? '<=>' : eq.arrow === '=' ? '=' : '->'
  return `${eq.reactants.map(sp).join(' + ')} ${arrow} ${eq.products.map(sp).join(' + ')}`
}
