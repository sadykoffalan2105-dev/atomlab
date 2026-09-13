/**
 * Подготовка реплик лабораторного учителя к озвучке:
 * разговорные паузы, химия «как говорит преподаватель», без сырых формул.
 *
 * Работает до normalizeChemicalNotation, поэтому каждое правило понимает и
 * символы (Cl₂, ClO₂⁻, e⁻), и ASCII-запись (Cl2, ClO2-, e-).
 */

type LabSpeechLocale = 'ru' | 'en' | 'uz'

type Rule = readonly [RegExp, string | ((...m: string[]) => string)]

type LocaleWords = {
  digits: readonly string[]
  plus: string
  minus: string
  /** «+3 → +4» */
  becomes: string
  electrons: (n: number) => string
  delta: string
}

const WORDS: Record<LabSpeechLocale, LocaleWords> = {
  ru: {
    digits: ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'],
    plus: 'плюс',
    minus: 'минус',
    becomes: 'стало',
    electrons: (n) => (n === 1 ? 'электрон' : n >= 2 && n <= 4 ? 'электрона' : 'электронов'),
    delta: 'дельта',
  },
  en: {
    digits: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
    plus: 'plus',
    minus: 'minus',
    becomes: 'becomes',
    electrons: (n) => (n === 1 ? 'electron' : 'electrons'),
    delta: 'delta',
  },
  uz: {
    digits: ['nol', 'bir', 'ikki', 'uch', 'toʻrt', 'besh', 'olti', 'yetti', 'sakkiz', 'toʻqqiz'],
    plus: 'plyus',
    minus: 'minus',
    becomes: 'keyin',
    electrons: () => 'elektron',
    delta: 'delta',
  },
}

/** Знак: ASCII-плюс/дефис, типографский минус и надстрочные ⁺⁻. */
const SIGN = '[+\\u2212\\u207A\\u207B-]'
/** Граница «не часть слова / числа». */
const NB = '(?<![\\p{L}\\d])'
const NA = '(?![\\p{L}\\d])'

function isMinus(sign: string): boolean {
  return sign !== '+' && sign !== '⁺'
}

/** «+3», «−1», «0» → слова. */
function spokenOxidation(raw: string, w: LocaleWords): string {
  const sign = raw.length > 1 ? raw[0]! : ''
  const digit = w.digits[Number(raw[raw.length - 1])] ?? raw
  if (!sign) return digit
  return `${isMinus(sign) ? w.minus : w.plus} ${digit}`
}

/** Правила, общие по форме для всех языков: степени окисления, электроны, δ±. */
function notationRules(w: LocaleWords): Rule[] {
  const ox = `(?:${SIGN}[0-7]|0)`
  return [
    // «2e⁻», «−2 e-» — электроны до степеней окисления, иначе «−2» съест знак.
    [
      new RegExp(`${NB}(?:(${SIGN})\\s?)?(\\d)\\s?e(?:\\u207B|-)${NA}`, 'gu'),
      (_m, sign, n) => {
        const count = Number(n)
        const head = sign ? `${isMinus(sign) ? w.minus : w.plus} ` : ''
        return `${head}${w.digits[count] ?? n} ${w.electrons(count)}`
      },
    ],
    [new RegExp(`${NB}e(?:\\u207B|-)${NA}`, 'gu'), w.electrons(1)],
    // «+3 → +4», «0 → −1»
    [
      new RegExp(`${NB}(${ox})\\s*(?:→|->)\\s*(${ox})(?!\\d)`, 'gu'),
      (_m, a, b) => `${spokenOxidation(a, w)}, ${w.becomes} ${spokenOxidation(b, w)}`,
    ],
    [new RegExp(`${NB}(${SIGN}[0-7])(?![\\d.,]?\\d)`, 'gu'), (_m, a) => spokenOxidation(a, w)],
    [/δ\s*[+⁺]/g, `${w.delta} ${w.plus}`],
    [/δ\s*[−⁻-]/g, `${w.delta} ${w.minus}`],
  ]
}

/** Формулы частиц: длинные раньше коротких (NaClO₂ до ClO₂, Cl₂O₂ до Cl₂). */
function formulaRules(names: {
  adduct: string
  clOClO: string
  cl2o2: string
  naClO2: string
  chlorite: string
  clO2: string
  naCl: string
  chloride: string
  sodium: string
  cl2: string
  /** атомы в записи связей «O–Cl–O» */
  atomCl: string
  atomO: string
}): Rule[] {
  const minus = '(?:\\u207B|-(?![\\p{L}\\d]))'
  const atom = (symbol: string | undefined) => (symbol === 'O' ? names.atomO : names.atomCl)
  return [
    // «Clᵟ⁺»: надстрочная дельта — буква и склеилась бы с символом; отделяем, дальше это «δ+»
    [/ᵟ/g, ' δ'],
    [/\[?\s*ClOCl\(O\)OClO\s*\]?\s*[⁻-]?/gu, names.adduct],
    // «Cl–Cl», «O–Cl–O» — связи; до правила Cl⁻, иначе дефис прочтётся как заряд
    [
      /(?<![\p{L}\d])(Cl|O)\s*[–—-]\s*(Cl|O)(?:\s*[–—-]\s*(Cl|O))?(?![\p{L}\d])/gu,
      (_m, a, b, c) => [a, b, c].filter(Boolean).map(atom).join('-'),
    ],
    [new RegExp(`${NB}ClOClO${NA}`, 'gu'), names.clOClO],
    [new RegExp(`${NB}Cl[₂2]O[₂2]${NA}`, 'gu'), names.cl2o2],
    [new RegExp(`${NB}NaClO[₂2]${NA}`, 'gu'), names.naClO2],
    [new RegExp(`${NB}ClO[₂2]${minus}`, 'gu'), names.chlorite],
    [new RegExp(`${NB}ClO[₂2]${NA}`, 'gu'), names.clO2],
    [new RegExp(`${NB}NaCl${NA}`, 'gu'), names.naCl],
    [new RegExp(`${NB}Cl${minus}`, 'gu'), names.chloride],
    [new RegExp(`${NB}Na(?:\\u207A|\\+)`, 'gu'), names.sodium],
    [new RegExp(`${NB}Cl[₂2]${NA}`, 'gu'), names.cl2],
    [new RegExp(`${NB}Cl${NA}`, 'gu'), names.atomCl],
  ]
}

const LAB_SPOKEN_REWRITES_RU: readonly Rule[] = [
  ...formulaRules({
    adduct: 'промежуточный комплекс',
    clOClO: 'хлор о хлор о',
    cl2o2: 'хлор два о два',
    naClO2: 'хлорит натрия',
    chlorite: 'хлорит-ион',
    clO2: 'диоксид хлора',
    naCl: 'хлорид натрия',
    chloride: 'хлорид-ион',
    sodium: 'ион натрия',
    cl2: 'хлор',
    atomCl: 'хлор',
    atomO: 'кислород',
  }),
  ...notationRules(WORDS.ru),
  // «ClO₂⁻ ион» не должен стать «хлорит-ион ион»
  [/(?<![\p{L}])ион(?:\s+|-)ион(?![\p{L}])/gu, 'ион'],
  [/плюс трёх/gi, 'плюс три'],
  [/плюс четырёх/gi, 'плюс четыре'],
  [/минус одного/gi, 'минус один'],
  [/117\s*°/g, 'сто семнадцать градусов'],
  [/(?<![\p{L}\d])117(?![\p{L}\d])/gu, 'сто семнадцать'],
  [/(\d)\s*Å/g, '$1 ангстрема'],
]

const LAB_SPOKEN_REWRITES_EN: readonly Rule[] = [
  ...formulaRules({
    adduct: 'the intermediate complex',
    clOClO: 'C L O C L O',
    cl2o2: 'C L two O two',
    naClO2: 'sodium chlorite',
    chlorite: 'chlorite ion',
    clO2: 'chlorine dioxide',
    naCl: 'sodium chloride',
    chloride: 'chloride ion',
    sodium: 'sodium ion',
    cl2: 'chlorine',
    atomCl: 'chlorine',
    atomO: 'oxygen',
  }),
  ...notationRules(WORDS.en),
  [/\bions?\s+(ions?)\b/g, '$1'],
  [/\b117\s*°/g, 'one hundred seventeen degrees'],
  [/(?<![\p{L}\d])117(?![\p{L}\d])/gu, 'one hundred seventeen'],
  [/(\d)\s*Å/g, '$1 angstroms'],
  [/counter-ion/gi, 'counter ion'],
]

const LAB_SPOKEN_REWRITES_UZ: readonly Rule[] = [
  ...formulaRules({
    adduct: 'oraliq kompleks',
    clOClO: 'xlor o xlor o',
    cl2o2: 'xlor ikki o ikki',
    naClO2: 'natriy xlorit',
    chlorite: 'xlorit ioni',
    clO2: 'xlor dioksid',
    naCl: 'natriy xlorid',
    chloride: 'xlorid ioni',
    sodium: 'natriy ioni',
    cl2: 'xlor',
    atomCl: 'xlor',
    atomO: 'kislorod',
  }),
  ...notationRules(WORDS.uz),
  [/\bioni\s+(ioni|ionlari)\b/g, '$1'],
  [/qarshi-ion/gi, 'qarshi ion'],
  [/117\s*(?:°|daraja\b)/gi, 'bir yuz oʻn yetti daraja'],
  [/(?<![\p{L}\d])117(?![\p{L}\d])/gu, 'bir yuz oʻn yetti'],
  [/(\d)\s*Å/g, '$1 angstrem'],
]

/**
 * Паузы для Edge SSML. Тире — запятая (в «хлор — плюс три» точка рвала фразу),
 * двоеточие/точка с запятой — точка; после новой точки — заглавная буква,
 * иначе TTS читает хвост как обрывок.
 */
function cadenceForLabTeacher(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*\.\.\.\s*/g, '. ')
    .replace(/\s*…\s*/g, '. ')
    .replace(/\s*;\s*/g, '. ')
    .replace(/\s*:\s*/g, '. ')
    .replace(/,\s*,/g, ',')
    .replace(/\.\s*,/g, '.')
    .replace(/,\s*\./g, '.')
    .replace(/\.\s*\./g, '.')
    .replace(/([.!?])\s+(\p{Ll})/gu, (_m, p: string, c: string) => `${p} ${c.toUpperCase()}`)
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function applyRewrites(text: string, rules: readonly Rule[]): string {
  let out = text
  for (const [re, spoken] of rules) {
    out = typeof spoken === 'string' ? out.replace(re, spoken) : out.replace(re, spoken)
  }
  return out
}

/** Сырой текст реплики → речь лабораторного учителя (ещё до общего TTS-prep). */
export function prepareLabTeacherSpeechRaw(text: string, locale: LabSpeechLocale): string {
  let t = text.trim()
  if (!t) return ''

  if (locale === 'ru') {
    t = applyRewrites(t, LAB_SPOKEN_REWRITES_RU)
  } else if (locale === 'en') {
    t = applyRewrites(t, LAB_SPOKEN_REWRITES_EN)
  } else {
    t = applyRewrites(t, LAB_SPOKEN_REWRITES_UZ)
  }

  return cadenceForLabTeacher(t)
}
