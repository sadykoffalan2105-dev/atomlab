/**
 * Химические обозначения вслух: величины, единицы, операторы и разбор формул.
 *
 * Раньше учитель произносил «Ar(Fe)» как «аргон, железо», «г/моль» как «г, или моль»,
 * а уравнение читал латинскими буквами. Здесь это чинится до словаря элементов:
 *   • Ar/Mr/M/n/N/V/m/ω/ρ(X) → «относительная атомная масса железа», «молярная масса…»;
 *   • единицы: «г/моль» → «грамм на моль», «моль⁻¹» → «на моль»;
 *   • операторы: «·» → «умножить на», «=» → «равно», «→» → «образуется», «↑» → «газ выделяется»;
 *   • незнакомая формула читается по элементам: H₂SO₄ → «аш два эс о четыре».
 *
 * Для ru запускается до словаря формул (там H₂O станет «вода»), остаток разбирается
 * поэлементно уже после него. Для en/uz формулы раскрываются целиком — иначе голос
 * читает «en-ay-two-oh».
 */
import { ELEMENTS } from '../data/elements'
import { ELEMENT_NAMES_EN } from '../data/elementNamesEn'
import { ELEMENT_NAMES_UZ } from '../data/elementNamesUz'

export type ChemSpeechLocale = 'ru' | 'en' | 'uz'

/* ------------------------------------------------------------- имена элементов */

const NAME_RU = new Map<string, string>(ELEMENTS.map((el) => [el.symbol, el.nameRu.toLowerCase()]))
/** Символ → порядковый номер: списки названий на en/uz идут по номеру элемента. */
const Z_BY_SYMBOL = new Map<string, number>(
  ELEMENTS.map((el) => [el.symbol, (el as { z?: number; atomicNumber?: number }).z ?? (el as { atomicNumber?: number }).atomicNumber ?? 0]),
)

/** Родительный падеж названия элемента: «железо» → «железа», «натрий» → «натрия». */
export function elementGenitiveRu(name: string): string {
  const n = name.toLowerCase()
  if (n.endsWith('ий')) return `${n.slice(0, -2)}ия`
  if (n.endsWith('ец')) return `${n.slice(0, -2)}ца`
  if (n.endsWith('о')) return `${n.slice(0, -1)}а`
  if (n.endsWith('а')) return `${n.slice(0, -1)}ы`
  if (n.endsWith('ь')) return `${n.slice(0, -1)}и`
  if (n.endsWith('й')) return `${n.slice(0, -1)}я`
  return `${n}а`
}

/** Русские названия букв — так учитель читает формулу: H₂SO₄ → «аш два эс о четыре». */
const LETTER_RU: Record<string, string> = {
  A: 'а', B: 'бэ', C: 'цэ', D: 'дэ', E: 'е', F: 'эф', G: 'жэ', H: 'аш', I: 'и', J: 'йот', K: 'ка',
  L: 'эль', M: 'эм', N: 'эн', O: 'о', P: 'пэ', Q: 'ку', R: 'эр', S: 'эс', T: 'тэ', U: 'у', V: 'вэ',
  W: 'дубль-вэ', X: 'икс', Y: 'игрек', Z: 'зэт',
}

const DIGIT_WORDS: Record<ChemSpeechLocale, string[]> = {
  ru: ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'],
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
  uz: ['nol', 'bir', 'ikki', 'uch', 'toʻrt', 'besh', 'olti', 'yetti', 'sakkiz', 'toʻqqiz'],
}

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'

function digitsToWords(digits: string, locale: ChemSpeechLocale): string {
  const words = DIGIT_WORDS[locale]
  return [...digits]
    .map((ch) => {
      const i = SUB.indexOf(ch) >= 0 ? SUB.indexOf(ch) : SUP.indexOf(ch) >= 0 ? SUP.indexOf(ch) : Number(ch)
      return Number.isFinite(i) && i >= 0 && i <= 9 ? words[i]! : ch
    })
    .join(' ')
}

function symbolSpoken(symbol: string, locale: ChemSpeechLocale): string | null {
  if (locale === 'ru') {
    if (symbol.length === 1) return LETTER_RU[symbol] ?? null
    return NAME_RU.get(symbol) ?? null
  }
  const names = locale === 'en' ? ELEMENT_NAMES_EN : ELEMENT_NAMES_UZ
  const z = Z_BY_SYMBOL.get(symbol)
  const name = z ? names[z - 1] : undefined
  if (name) return name.toLowerCase()
  return symbol.length === 1 ? symbol : null
}

/* --------------------------------------------------------------------- формулы */

/** Токен формулы: Na₂CO₃, H2SO4, Ca(OH)2, Fe³⁺ — но не римские цифры и не обычное слово. */
const FORMULA_TOKEN_RE = /(?<![\p{L}])((?:[A-Z][a-z]?[₀-₉0-9]*|\((?:[A-Z][a-z]?[₀-₉0-9]*)+\)[₀-₉0-9]*){1,8})(?![\p{L}])/gu

const ROMAN_RE = /^[IVXLCDM]+$/

function looksLikeFormula(token: string): boolean {
  if (token.length < 2) return false
  if (ROMAN_RE.test(token)) return false
  // «AB» из двух заглавных без индексов — скорее аббревиатура, но если оба символа элементов, читаем.
  const parts = token.match(/[A-Z][a-z]?/g) ?? []
  if (parts.length === 0) return false
  const known = parts.filter((p) => NAME_RU.has(p)).length
  if (known === 0) return false
  return /[₀-₉0-9()]/.test(token) || known === parts.length
}

/** Прочитать формулу по элементам: H₂SO₄ → «аш два эс о четыре». */
export function readFormulaAloud(token: string, locale: ChemSpeechLocale): string {
  const out: string[] = []
  const re = /([A-Z][a-z]?)([₀-₉0-9]*)|(\()|(\))([₀-₉0-9]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(token))) {
    if (m[1]) {
      const spoken = symbolSpoken(m[1], locale)
      if (!spoken) return token
      out.push(spoken)
      if (m[2]) out.push(digitsToWords(m[2], locale))
    } else if (m[4]) {
      if (m[5]) out.push(digitsToWords(m[5], locale))
    }
  }
  return out.join(' ').replace(/\s{2,}/g, ' ').trim()
}

/** Раскрыть все оставшиеся формулы в тексте (для ru — уже после словаря названий). */
export function expandRemainingFormulas(text: string, locale: ChemSpeechLocale): string {
  return text.replace(FORMULA_TOKEN_RE, (token) => (looksLikeFormula(token) ? readFormulaAloud(token, locale) : token))
}

/* ------------------------------------------------------------------- величины */

type QuantityNames = Record<string, string>

const QUANTITY_RU: QuantityNames = {
  Ar: 'относительная атомная масса',
  Mr: 'относительная молекулярная масса',
  M: 'молярная масса',
  m: 'масса',
  n: 'количество вещества',
  N: 'число частиц',
  V: 'объём',
  Vm: 'молярный объём',
  ω: 'массовая доля',
  φ: 'объёмная доля',
  ρ: 'плотность',
  c: 'концентрация',
  Q: 'тепловой эффект',
  W: 'выход продукта',
}

const QUANTITY_EN: QuantityNames = {
  Ar: 'relative atomic mass',
  Mr: 'relative molecular mass',
  M: 'molar mass',
  m: 'mass',
  n: 'amount of substance',
  N: 'number of particles',
  V: 'volume',
  Vm: 'molar volume',
  ω: 'mass fraction',
  ρ: 'density',
  c: 'concentration',
  Q: 'heat effect',
}

const QUANTITY_UZ: QuantityNames = {
  Ar: 'nisbiy atom massasi',
  Mr: 'nisbiy molekulyar massasi',
  M: 'molyar massa',
  m: 'massa',
  n: 'modda miqdori',
  N: 'zarrachalar soni',
  V: 'hajm',
  Vm: 'molyar hajm',
  ω: 'massa ulushi',
  ρ: 'zichlik',
  c: 'konsentratsiya',
  Q: 'issiqlik effekti',
}

const QUANTITIES: Record<ChemSpeechLocale, QuantityNames> = { ru: QUANTITY_RU, en: QUANTITY_EN, uz: QUANTITY_UZ }

/** Постоянные, которые иначе читаются как случайные буквы. */
const CONSTANTS: Record<ChemSpeechLocale, ReadonlyArray<readonly [RegExp, string]>> = {
  ru: [
    [/(?<![\p{L}])N\s*[ₐA]|(?<![\p{L}])Nₐ/gu, 'число Авогадро'],
    [/(?<![\p{L}])V\s*m(?![\p{L}])/gu, 'молярный объём'],
    [/(?<![\p{L}])н\.\s*у\./gu, 'нормальные условия'],
  ],
  en: [
    [/(?<![\p{L}])N\s*[ₐA]|(?<![\p{L}])Nₐ/gu, 'the Avogadro number'],
    [/(?<![\p{L}])V\s*m(?![\p{L}])/gu, 'the molar volume'],
  ],
  uz: [
    [/(?<![\p{L}])N\s*[ₐA]|(?<![\p{L}])Nₐ/gu, 'Avogadro soni'],
    [/(?<![\p{L}])V\s*m(?![\p{L}])/gu, 'molyar hajm'],
  ],
}

function expandConstants(text: string, locale: ChemSpeechLocale): string {
  let t = text
  for (const [re, spoken] of CONSTANTS[locale]) t = t.replace(re, spoken)
  return t
}

/** «Ar(Fe)», «M(NaOH)», «ω(O)» — величина и вещество словами (до словаря элементов!). */
function expandQuantities(text: string, locale: ChemSpeechLocale): string {
  const names = QUANTITIES[locale]
  const keys = Object.keys(names).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(?<![\\p{L}])(${keys.join('|')})\\s*\\(\\s*([A-Za-z₀-₉0-9()]+)\\s*\\)`, 'gu')
  return text.replace(re, (_all, sym: string, inner: string) => {
    const quantity = names[sym] ?? sym
    if (locale === 'ru') {
      const single = NAME_RU.get(inner)
      if (single) return `${quantity} ${elementGenitiveRu(single)}`
      return `${quantity}: ${inner}`
    }
    return `${quantity}: ${inner}`
  })
}

/* -------------------------------------------------------------------- единицы */

const UNITS_RU: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?<![\p{L}])г\s*\/\s*моль/gu, 'грамм на моль'],
  [/(?<![\p{L}])кг\s*\/\s*моль/gu, 'килограмм на моль'],
  [/(?<![\p{L}])л\s*\/\s*моль/gu, 'литр на моль'],
  [/(?<![\p{L}])моль\s*\/\s*л/gu, 'моль на литр'],
  [/(?<![\p{L}])г\s*\/\s*л/gu, 'грамм на литр'],
  [/(?<![\p{L}])мг\s*\/\s*л/gu, 'миллиграмм на литр'],
  [/(?<![\p{L}])г\s*\/\s*см\s*³/gu, 'грамм на кубический сантиметр'],
  [/(?<![\p{L}])кДж\s*\/\s*моль/gu, 'килоджоуль на моль'],
  [/(?<![\p{L}])Дж\s*\/\s*\(?моль/gu, 'джоуль на моль'],
  [/моль\s*⁻¹/gu, 'на моль'],
  [/моль\s*-\s*1(?![\d])/gu, 'на моль'],
  [/(?<![\p{L}])(\d)\s*°\s*С/gu, '$1 градусов'],
]

const UNITS_EN: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?<![\p{L}])g\s*\/\s*mol/giu, 'grams per mole'],
  [/(?<![\p{L}])L\s*\/\s*mol/giu, 'litres per mole'],
  [/(?<![\p{L}])mol\s*\/\s*L/giu, 'moles per litre'],
  [/(?<![\p{L}])kJ\s*\/\s*mol/giu, 'kilojoules per mole'],
  [/mol\s*⁻¹/gu, 'per mole'],
]

const UNITS_UZ: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?<![\p{L}])g\s*\/\s*mol/giu, 'gramm bo‘yicha mol'],
  [/(?<![\p{L}])l\s*\/\s*mol/giu, 'litr bo‘yicha mol'],
  [/(?<![\p{L}])mol\s*\/\s*l/giu, 'mol bo‘yicha litr'],
  [/mol\s*⁻¹/gu, 'mol ga teskari'],
]

const UNITS: Record<ChemSpeechLocale, ReadonlyArray<readonly [RegExp, string]>> = { ru: UNITS_RU, en: UNITS_EN, uz: UNITS_UZ }

/* ------------------------------------------------------------------ операторы */

type OperatorMap = { arrow: string; reversible: string; equals: string; approx: string; times: string; div: string; plus: string; up: string; down: string; power: string }

const OPERATORS: Record<ChemSpeechLocale, OperatorMap> = {
  ru: {
    arrow: ' образуется ',
    reversible: ' обратимо переходит в ',
    equals: ' равно ',
    approx: ' примерно равно ',
    times: ' умножить на ',
    div: ' делить на ',
    plus: ' плюс ',
    up: ', газ выделяется',
    down: ', выпадает осадок',
    power: ' в степени ',
  },
  en: {
    arrow: ' gives ',
    reversible: ' is reversible with ',
    equals: ' equals ',
    approx: ' about ',
    times: ' times ',
    div: ' divided by ',
    plus: ' plus ',
    up: ', gas is released',
    down: ', a precipitate forms',
    power: ' to the power of ',
  },
  uz: {
    arrow: ' hosil boʻladi ',
    reversible: ' qaytar reaksiya ',
    equals: ' teng ',
    approx: ' taxminan ',
    times: ' koʻpaytiriladi ',
    div: ' boʻlinadi ',
    plus: ' plyus ',
    up: ', gaz ajraladi',
    down: ', choʻkma tushadi',
    power: ' darajali ',
  },
}

/**
 * Про выделение газа (или выпадение осадка) в этой же фразе уже сказано словами.
 * Тогда значок «↑» / «↓» проговаривать не нужно — иначе выходит повтор.
 */
const SAID_ALREADY: Record<ChemSpeechLocale, { up: RegExp; down: RegExp }> = {
  ru: {
    up: /(выделен\w*\s+газ|газ\w*\s+выдел|выделяется\s+газ|с\s+выделением\s+газа)/iu,
    down: /(выпада\w*\s+осад|осад\w*\s+выпада|образуется\s+осадок)/iu,
  },
  en: {
    up: /(gas is (released|given off)|release of gas|with gas)/iu,
    down: /(precipitate (forms|appears)|a precipitate)/iu,
  },
  uz: {
    up: /(gaz ajra\w*|gaz chiq\w*)/iu,
    down: /(choʻkma tush\w*|cho'kma tush\w*)/iu,
  },
}

function saidAlready(text: string, locale: ChemSpeechLocale, kind: 'up' | 'down'): boolean {
  return SAID_ALREADY[locale][kind].test(text)
}

/** Уравнение или расчёт (там «+» — это «плюс», а «=» — «равно»). */
const EQUATION_LINE_RE = /(?:[A-Za-z₀-₉0-9)\]]\s*[+=]|[→⇌↔]|[=≈]\s*[\d(A-Za-z])/u

function expandOperators(text: string, locale: ChemSpeechLocale): string {
  const op = OPERATORS[locale]
  let t = text
    .replace(/→|⟶|-->|->/g, op.arrow)
    .replace(/⇌|↔|⟷/g, op.reversible)
    // «Реакция идёт с выделением газа: … H₂↑» — про газ уже сказано словами, второй раз
    // разворачивать «↑» не нужно: получается «с выделением газа … газ выделяется».
    .replace(/↑/g, saidAlready(text, locale, 'up') ? '' : op.up)
    .replace(/↓/g, saidAlready(text, locale, 'down') ? '' : op.down)
    .replace(/(\d)\s*·\s*10\s*([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/gu, (_a, d: string, p: string) => `${d}${op.times}десять${op.power}${superToWords(p, locale)}`)
    .replace(/·|×/g, op.times)
    .replace(/≈/g, op.approx)
  if (EQUATION_LINE_RE.test(text)) {
    t = t
      .replace(/(\d|\))\s*\/\s*(\d|\()/g, `$1${op.div}$2`)
      .replace(/\s*=\s*/g, op.equals)
      .replace(/([\p{L}\p{N})\]])\s*\+\s*([\p{L}\p{N}(])/gu, `$1${op.plus}$2`)
  }
  return t.replace(/\s{2,}/g, ' ')
}

/** Показатель степени: «10²³» → «10 в степени 23» (число голос читает сам). */
function superToWords(sup: string, locale: ChemSpeechLocale): string {
  const minus = sup.includes('⁻') ? (locale === 'ru' ? 'минус ' : 'minus ') : ''
  const digits = [...sup.replace(/⁻/g, '')].map((ch) => String(Math.max(0, SUP.indexOf(ch)))).join('')
  return `${minus}${digits}`.trim()
}

/* --------------------------------------------------------------------- фасад */

/**
 * Полная подготовка химической записи к озвучке.
 * Вызывать ДО словаря элементов (иначе «Ar» превратится в аргон, «N» — в азот).
 */
export function prepareChemNotationForSpeech(text: string, locale: ChemSpeechLocale): string {
  if (!/[A-Za-zωρφ₀-₉⁰-⁹→⇌↑↓·=≈]/u.test(text)) return text
  let t = expandConstants(text, locale)
  t = t.replace(/(?<![\p{L}\p{N}])(\d+)(?=[A-Z][a-z]?[₀-₉0-9(])/gu, '$1 ')
  t = expandQuantities(t, locale)
  for (const [re, spoken] of UNITS[locale]) t = t.replace(re, spoken)
  t = expandOperators(t, locale)
  return t.replace(/\s{2,}/g, ' ')
}
