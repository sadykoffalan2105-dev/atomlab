/**
 * Ответы по химии без учебника — только из данных проекта (таблица элементов, атомные массы,
 * каталог веществ). Никаких выдуманных чисел: если данных нет — возвращаем null,
 * и учитель честно говорит, что не знает.
 */
import { ELEMENTS, estimateNeutrons } from '../../../data/elements'
import { ELEMENT_NAMES_EN } from '../../../data/elementNamesEn'
import { ELEMENT_NAMES_UZ } from '../../../data/elementNamesUz'
import { compoundById } from '../../../data/compounds'
import { atomicMassU, isElementSymbol } from '../../../chemistry/data/atomicData'
import type { ElementViewModel } from '../../../types/chemistry'
import { foldText } from '../dualMode/textStems'
import { formatNumber, type MathLang } from './safeMath'
import type { TalkEntity } from './studentProfile'

export type ChemProperty =
  | 'mass'
  | 'number'
  | 'electrons'
  | 'neutrons'
  | 'position'
  | 'state'
  | 'electronegativity'
  | 'valency'
  | 'melting'
  | 'formula'
  | 'about'

const PROPERTY_RE: [ChemProperty, RegExp][] = [
  ['neutrons', /нейтрон|neutron/iu],
  ['electronegativity', /электроотрицат|electronegativ|elektromanfiy/iu],
  ['electrons', /электрон|конфигурац|оболочк|electron|configuration|elektron|qobiq/iu],
  ['number', /порядков|номер|заряд\p{L}*\s+ядр|протон|atomic\s+number|proton|tartib\s+raqam|raqami/iu],
  ['mass', /масс|вес|весит|mass|weigh|massa|og'?irlig/iu],
  ['position', /групп|период|где\s+(стоит|находится|расположен)|group|period|guruh|davr/iu],
  ['state', /агрегатн|состояни|газ\s+или|жидк|тверд|state\s+of|holat/iu],
  ['valency', /валентн|степен\p{L}*\s+окислен|valen|oxidation|oksidlanish/iu],
  ['melting', /плав|кипи|кипен|melt|boil|suyuqlan|qayna/iu],
  ['formula', /формул|formula/iu],
]

export function detectChemProperty(text: string): ChemProperty | null {
  for (const [p, re] of PROPERTY_RE) if (re.test(text)) return p
  return null
}

/* ---------------------------------------------------------- элементы */

const RU_FORMS = new Map<string, number>()
const LAT_NAMES = new Map<string, number>()

function addRuForms(name: string, z: number) {
  const n = foldText(name)
  const forms = new Set([n])
  if (/ий$/.test(n)) {
    const b = n.slice(0, -2)
    for (const e of ['ия', 'ию', 'ием', 'ии']) forms.add(b + e)
  } else if (/а$/.test(n)) {
    const b = n.slice(0, -1)
    for (const e of ['ы', 'е', 'у', 'ой']) forms.add(b + e)
  } else if (/о$/.test(n)) {
    const b = n.slice(0, -1)
    for (const e of ['а', 'у', 'ом', 'е']) forms.add(b + e)
  } else if (/ь$/.test(n)) {
    const b = n.slice(0, -1)
    for (const e of ['и', 'ью']) forms.add(b + e)
  } else {
    for (const e of ['а', 'у', 'ом', 'е']) forms.add(n + e)
  }
  for (const f of forms) if (!RU_FORMS.has(f)) RU_FORMS.set(f, z)
}

for (const el of ELEMENTS) {
  addRuForms(el.nameRu, el.z)
  const en = ELEMENT_NAMES_EN[el.z - 1]
  if (en) LAT_NAMES.set(foldText(en), el.z)
  const uz = ELEMENT_NAMES_UZ[el.z - 1]
  if (uz) LAT_NAMES.set(foldText(uz), el.z)
}
// Формы, совпадающие с названиями стран («Германия», «Франция», «Индия»), — не элементы.
for (const w of ['германия', 'германии', 'франция', 'франции', 'индия', 'индии', 'галлия', 'галлии']) RU_FORMS.delete(w)

const UZ_SUFFIX = /^(|ning|ni|ga|da|dan|ning|dagi|i)$/

/** Английские слова, совпадающие с символами элементов — символом их не считаем. */
const SYMBOL_STOP = new Set(['He', 'In', 'At', 'As', 'Be', 'No', 'Am', 'Ho', 'La', 'Pa', 'Po', 'Os', 'Es', 'Mo', 'Ga', 'Da'])

export function elementByZ(z: number): ElementViewModel | undefined {
  return ELEMENTS[z - 1]?.z === z ? ELEMENTS[z - 1] : ELEMENTS.find((e) => e.z === z)
}

/** Найти элемент в реплике: по названию (ru/en/uz, с падежами) или символу. */
export function findElementInText(text: string): ElementViewModel | null {
  const words = foldText(text).split(/[^\p{L}']+/u).filter(Boolean)
  for (const w of words) {
    const z = RU_FORMS.get(w)
    if (z) return elementByZ(z) ?? null
  }
  for (const w of words) {
    if (!/^[a-z']+$/.test(w)) continue
    for (const [name, z] of LAT_NAMES) {
      if (w.startsWith(name) && UZ_SUFFIX.test(w.slice(name.length))) return elementByZ(z) ?? null
    }
  }
  // Символ: «Fe», «Na» — с учётом регистра; однобуквенные — только если это вся реплика или «элемент X».
  const tokens = text.match(/(?<![A-Za-z])[A-Z][a-z]?(?![A-Za-z0-9(])/g) ?? []
  for (const tok of tokens) {
    if (!isElementSymbol(tok) || SYMBOL_STOP.has(tok)) continue
    if (tok.length === 1 && !(text.trim().replace(/[?!.]/g, '') === tok || /(элемент|element|символ|symbol|у\s+|of\s+)\s*$/iu.test(text.slice(0, text.indexOf(tok))))) continue
    return ELEMENTS.find((e) => e.symbol === tok) ?? null
  }
  return null
}

/* ----------------------------------------------------------- формулы */

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

export function plainFormula(f: string): string {
  return [...f].map((ch) => (SUB.includes(ch) ? String(SUB.indexOf(ch)) : ch)).join('').replace(/[·•*]/g, '·')
}

export function prettyFormula(f: string): string {
  return plainFormula(f).replace(/(?<=[A-Za-z)])(\d+)/g, (d) => [...d].map((c) => SUB[Number(c)]).join(''))
}

/** Состав формулы со скобками и кристаллогидратом: Ca(OH)2, CuSO4·5H2O. null — не формула. */
export function parseFormulaDeep(raw: string): Record<string, number> | null {
  const f = plainFormula(raw).replace(/\s+/g, '')
  if (!/^[A-Z]/.test(f)) return null
  const parts = f.split('·')
  const total: Record<string, number> = {}
  for (const part of parts) {
    const m = part.match(/^(\d*)(.+)$/)
    if (!m) return null
    const k = m[1] ? Number(m[1]) : 1
    const counts = parseGroup(m[2]!)
    if (!counts) return null
    for (const [s, n] of Object.entries(counts)) total[s] = (total[s] ?? 0) + n * k
  }
  return Object.keys(total).length ? total : null
}

function parseGroup(s: string): Record<string, number> | null {
  const stack: Record<string, number>[] = [{}]
  let i = 0
  while (i < s.length) {
    const ch = s[i]!
    if (ch === '(' || ch === '[') {
      stack.push({})
      i++
    } else if (ch === ')' || ch === ']') {
      i++
      let j = i
      while (j < s.length && /\d/.test(s[j]!)) j++
      const k = j > i ? Number(s.slice(i, j)) : 1
      i = j
      const top = stack.pop()
      if (!top || !stack.length) return null
      const into = stack[stack.length - 1]!
      for (const [el, n] of Object.entries(top)) into[el] = (into[el] ?? 0) + n * k
    } else if (/[A-Z]/.test(ch)) {
      let j = i + 1
      if (j < s.length && /[a-z]/.test(s[j]!)) j++
      const sym = s.slice(i, j)
      if (!isElementSymbol(sym)) return null
      let k = j
      while (k < s.length && /\d/.test(s[k]!)) k++
      const n = k > j ? Number(s.slice(j, k)) : 1
      const into = stack[stack.length - 1]!
      into[sym] = (into[sym] ?? 0) + n
      i = k
    } else return null
  }
  return stack.length === 1 ? stack[0]! : null
}

/** Найти формулу в реплике: «H2SO4», «Ca(OH)₂», «M(NaCl)». */
export function findFormulaInText(text: string): string | null {
  const re = /(?<![A-Za-z])((?:[A-Z][a-z]?[\d₀-₉]*|\([A-Za-z\d₀-₉]+\)[\d₀-₉]*)+(?:[·•][\d]*(?:[A-Z][a-z]?[\d₀-₉]*)+)?)(?![a-z])/g
  for (const m of text.matchAll(re)) {
    const f = m[1]!
    const counts = parseFormulaDeep(f)
    if (!counts) continue
    const atoms = Object.values(counts).reduce((a, b) => a + b, 0)
    // «Fe» или «O» — это элемент, а не формула вещества; «O2», «NaCl» — формулы.
    if (atoms < 2) continue
    if (SYMBOL_STOP.has(f)) continue
    return plainFormula(f)
  }
  return null
}

export interface MolarBreakdown {
  total: number
  parts: { symbol: string; count: number; mass: number }[]
}

export function molarMassOf(formula: string): MolarBreakdown | null {
  const counts = parseFormulaDeep(formula)
  if (!counts) return null
  const parts = Object.entries(counts).map(([symbol, count]) => ({
    symbol,
    count,
    mass: atomicMassU(symbol as Parameters<typeof atomicMassU>[0]),
  }))
  const total = parts.reduce((s, p) => s + p.mass * p.count, 0)
  return { total, parts }
}

/* ---------------------------------------------------- каталог веществ */

interface CatalogHit {
  id: string
  nameRu: string
  formula: string
  category: string
  description: string
}

let catalogIndex: { byFormula: Map<string, CatalogHit>; byName: [string, CatalogHit][] } | null = null

function catalog() {
  if (catalogIndex) return catalogIndex
  const byFormula = new Map<string, CatalogHit>()
  const byName: [string, CatalogHit][] = []
  for (const c of Object.values(compoundById)) {
    const hit: CatalogHit = {
      id: c.id,
      nameRu: c.nameRu,
      formula: plainFormula(c.formulaUnicode),
      category: c.category,
      description: c.descriptionRu ?? '',
    }
    const key = hit.formula.replace(/\s+/g, '')
    if (!byFormula.has(key)) byFormula.set(key, hit)
    const name = foldText(c.nameRu).replace(/\s*\(.*?\)\s*/g, ' ').trim()
    if (name.length >= 4) byName.push([name, hit])
  }
  byName.sort((a, b) => b[0].length - a[0].length)
  catalogIndex = { byFormula, byName }
  return catalogIndex
}

export function compoundByFormula(formula: string): CatalogHit | null {
  return catalog().byFormula.get(plainFormula(formula).replace(/\s+/g, '')) ?? null
}

/** Название вещества из каталога в тексте («серная кислота», «вода», «поваренная соль»). */
export function compoundByNameInText(text: string): CatalogHit | null {
  const t = ` ${foldText(text).replace(/[^\p{L}\d\s]/gu, ' ').replace(/\s+/g, ' ')} `
  for (const [name, hit] of catalog().byName) {
    // Падеж последнего слова: «серной кислоты» ~ «серная кислота» — сверяем по основам слов.
    const words = name.split(' ')
    const pattern = words.map((w) => (w.length >= 4 ? `${w.slice(0, w.length - (w.length > 5 ? 2 : 1))}\\p{L}{0,3}` : w)).join('\\s+')
    if (new RegExp(`(?<!\\p{L})${pattern}(?!\\p{L})`, 'u').test(t)) return hit
  }
  return null
}

const CATEGORY: Record<MathLang, Record<string, string>> = {
  ru: { oxide: 'оксид', acid: 'кислота', base: 'основание', salt: 'соль', simple: 'простое вещество', organic: 'органическое вещество' },
  en: { oxide: 'oxide', acid: 'acid', base: 'base', salt: 'salt', simple: 'simple substance', organic: 'organic compound' },
  uz: { oxide: 'oksid', acid: 'kislota', base: 'asos', salt: 'tuz', simple: 'oddiy modda', organic: 'organik modda' },
}

/* ------------------------------------------------------------ ответы */

const BLOCK: Record<MathLang, Record<string, string>> = {
  ru: {
    Nonmetal: 'неметалл',
    'Noble gas': 'благородный (инертный) газ',
    'Alkali metal': 'щелочной металл',
    'Alkaline earth metal': 'щелочноземельный металл',
    Metalloid: 'полуметалл',
    Halogen: 'галоген',
    'Post-transition metal': 'металл',
    'Transition metal': 'переходный металл',
    Lanthanide: 'лантаноид',
    Actinide: 'актиноид',
  },
  en: {},
  uz: {
    Nonmetal: 'metallmas',
    'Noble gas': 'inert gaz',
    'Alkali metal': 'ishqoriy metall',
    'Alkaline earth metal': 'ishqoriy-yer metall',
    Metalloid: 'yarimmetall',
    Halogen: 'galogen',
    'Post-transition metal': 'metall',
    'Transition metal': 'oʻtish metali',
    Lanthanide: 'lantanoid',
    Actinide: 'aktinoid',
  },
}

const STATE: Record<MathLang, Record<string, string>> = {
  ru: { Gas: 'газ', Liquid: 'жидкость', Solid: 'твёрдое вещество' },
  en: { Gas: 'a gas', Liquid: 'a liquid', Solid: 'a solid' },
  uz: { Gas: 'gaz', Liquid: 'suyuqlik', Solid: 'qattiq modda' },
}

function prettyConfig(cfg: string): string {
  return cfg.replace(/([spdf])(\d+)/g, (_, l: string, n: string) => l + [...n].map((c) => SUP_DIGITS[Number(c)]).join('')).replace(/\]\s*/g, '] ')
}

function periodOf(el: ElementViewModel): number | null {
  const shells = [...el.electronConfiguration.matchAll(/(\d)[spdf]/g)].map((m) => Number(m[1]))
  const nobleBase: Record<string, number> = { He: 1, Ne: 2, Ar: 3, Kr: 4, Xe: 5, Rn: 6 }
  const base = el.electronConfiguration.match(/\[(\w+)\]/)?.[1]
  const fromBase = base ? (nobleBase[base] ?? 0) + 1 : 0
  const max = Math.max(fromBase, ...shells)
  return max > 0 ? max : null
}

function groupOf(el: ElementViewModel): number | null {
  if (el.groupBlock === 'Lanthanide' || el.groupBlock === 'Actinide') return null
  return el.gridX >= 1 && el.gridX <= 18 ? el.gridX : null
}

function elementName(el: ElementViewModel, lang: MathLang): string {
  if (lang === 'en') return ELEMENT_NAMES_EN[el.z - 1] ?? el.symbol
  if (lang === 'uz') return ELEMENT_NAMES_UZ[el.z - 1] ?? el.symbol
  return el.nameRu
}

export interface ChemAnswer {
  text: string
  entity: TalkEntity
  property: ChemProperty
  /** Числа ответа (для проверки в тестах). */
  numbers: Record<string, number>
}

export function answerElement(el: ElementViewModel, property: ChemProperty, lang: MathLang): ChemAnswer {
  const name = elementName(el, lang)
  const n = (v: number, d = 3) => formatNumber(Number(v.toFixed(d)), lang)
  const neutrons = estimateNeutrons(el.atomicMass, el.z)
  const period = periodOf(el)
  const group = groupOf(el)
  const block = BLOCK[lang][el.groupBlock] ?? el.groupBlock.toLowerCase()
  const state = STATE[lang][el.standardState] ?? null
  const entity: TalkEntity = { kind: 'element', key: el.symbol, label: name }
  const numbers = { z: el.z, mass: el.atomicMass, neutrons }
  const L = <T,>(ru: T, en: T, uz: T) => (lang === 'en' ? en : lang === 'uz' ? uz : ru)
  let text: string
  switch (property) {
    case 'mass':
      text = L(
        `Относительная атомная масса элемента ${name} (${el.symbol}) — Ar ≈ ${n(el.atomicMass)}. Значит, 1 моль атомов ${el.symbol} весит около ${n(el.atomicMass, 2)} г. В задачах обычно округляют до ${Math.round(el.atomicMass) === 35 ? '35,5' : Math.round(el.atomicMass)}.`,
        `The relative atomic mass of ${name} (${el.symbol}) is Ar ≈ ${n(el.atomicMass)}. So 1 mole of ${el.symbol} atoms weighs about ${n(el.atomicMass, 2)} g. In problems it is usually rounded to ${Math.round(el.atomicMass) === 35 ? '35.5' : Math.round(el.atomicMass)}.`,
        `${name} (${el.symbol}) ning nisbiy atom massasi Ar ≈ ${n(el.atomicMass)}. Demak, 1 mol ${el.symbol} atomi taxminan ${n(el.atomicMass, 2)} g keladi.`,
      )
      break
    case 'number':
      text = L(
        `${name} (${el.symbol}) стоит в таблице под номером ${el.z}. Порядковый номер — это заряд ядра: в ядре ${el.z} протонов, а в нейтральном атоме столько же электронов — ${el.z}.`,
        `${name} (${el.symbol}) has atomic number ${el.z}. That is the nuclear charge: ${el.z} protons in the nucleus and, in a neutral atom, ${el.z} electrons.`,
        `${name} (${el.symbol}) ning tartib raqami ${el.z}. Bu yadro zaryadi: yadroda ${el.z} ta proton, neytral atomda esa ${el.z} ta elektron bor.`,
      )
      break
    case 'neutrons':
      text = L(
        `У самого распространённого изотопа элемента ${name} примерно ${neutrons} нейтронов. Считаем так: округлённая масса ${Math.round(el.atomicMass)} минус порядковый номер ${el.z} = ${neutrons}.`,
        `The most common isotope of ${name} has about ${neutrons} neutrons: rounded mass ${Math.round(el.atomicMass)} minus atomic number ${el.z} = ${neutrons}.`,
        `${name} ning eng keng tarqalgan izotopida taxminan ${neutrons} ta neytron bor: yaxlitlangan massa ${Math.round(el.atomicMass)} minus tartib raqami ${el.z} = ${neutrons}.`,
      )
      break
    case 'electrons':
      text = L(
        `В атоме элемента ${name} ${el.z} электронов. Электронная конфигурация: ${prettyConfig(el.electronConfiguration)}.${period ? ` Электроны расположены на ${period} энергетических уровнях — столько же, сколько номер периода.` : ''}`,
        `A ${name} atom has ${el.z} electrons. Electron configuration: ${prettyConfig(el.electronConfiguration)}.${period ? ` They occupy ${period} energy levels — the same as the period number.` : ''}`,
        `${name} atomida ${el.z} ta elektron bor. Elektron konfiguratsiyasi: ${prettyConfig(el.electronConfiguration)}.${period ? ` Ular ${period} ta energetik pogʻonada joylashgan — davr raqamiga teng.` : ''}`,
      )
      break
    case 'position':
      text = L(
        `${name} (${el.symbol}) находится в ${period ?? '?'}-м периоде${group ? `, в ${group}-й группе (по длинной таблице)` : ''}. Это ${block}.`,
        `${name} (${el.symbol}) is in period ${period ?? '?'}${group ? `, group ${group}` : ''}. It is a ${block}.`,
        `${name} (${el.symbol}) ${period ?? '?'}-davrda${group ? `, ${group}-guruhda` : ''} joylashgan. Bu — ${block}.`,
      )
      break
    case 'state':
      text = state
        ? L(`При обычных условиях ${name} — ${state}.`, `Under normal conditions ${name} is ${state}.`, `Oddiy sharoitda ${name} — ${state}.`)
        : L(`Точного агрегатного состояния для элемента ${name} у меня в данных нет.`, `I do not have the state of ${name} in my data.`, `${name} ning holati maʼlumotlarimda yoʻq.`)
      break
    case 'electronegativity':
      text =
        el.electronegativity != null
          ? L(
              `Электроотрицательность элемента ${name} по Полингу — ${n(el.electronegativity, 2)}. Для сравнения: у фтора (самого электроотрицательного) 3,98.`,
              `The Pauling electronegativity of ${name} is ${n(el.electronegativity, 2)}. For comparison, fluorine (the highest) has 3.98.`,
              `${name} ning Poling boʻyicha elektromanfiyligi — ${n(el.electronegativity, 2)}. Taqqoslash uchun: ftorda 3,98.`,
            )
          : L(`Электроотрицательности для элемента ${name} в моих данных нет.`, `I have no electronegativity value for ${name}.`, `${name} uchun elektromanfiylik maʼlumoti yoʻq.`)
      break
    case 'valency':
      text = L(
        `Степени окисления элемента ${name}: ${el.oxidationStates}. Самые частые в школьных задачах смотри в учебнике — а если хочешь, разберём на примере соединения.`,
        `Oxidation states of ${name}: ${el.oxidationStates}.`,
        `${name} ning oksidlanish darajalari: ${el.oxidationStates}.`,
      )
      break
    case 'melting':
      text =
        el.meltingPoint != null
          ? L(
              `${name} плавится при ${n(el.meltingPoint - 273.15, 1)} °C${el.boilingPoint != null ? `, а кипит при ${n(el.boilingPoint - 273.15, 1)} °C` : ''}.`,
              `${name} melts at ${n(el.meltingPoint - 273.15, 1)} °C${el.boilingPoint != null ? ` and boils at ${n(el.boilingPoint - 273.15, 1)} °C` : ''}.`,
              `${name} ${n(el.meltingPoint - 273.15, 1)} °C da suyuqlanadi${el.boilingPoint != null ? `, ${n(el.boilingPoint - 273.15, 1)} °C da qaynaydi` : ''}.`,
            )
          : L(`Температуры плавления для элемента ${name} у меня в данных нет.`, `I have no melting point for ${name}.`, `${name} uchun suyuqlanish harorati yoʻq.`)
      break
    default:
      text = L(
        `${name} (${el.symbol}) — элемент № ${el.z}, ${block}.\n• Атомная масса: Ar ≈ ${n(el.atomicMass)}.\n• В атоме ${el.z} протонов, ${el.z} электронов и обычно ${neutrons} нейтронов.\n• Место в таблице: ${period ?? '?'}-й период${group ? `, ${group}-я группа` : ''}.\n• Электронная конфигурация: ${prettyConfig(el.electronConfiguration)}.${state ? `\n• При обычных условиях — ${state}.` : ''}\nГлавное: номер ${el.z} сразу говорит, сколько протонов и электронов в атоме.`,
        `${name} (${el.symbol}) is element No. ${el.z}, a ${block}.\n• Atomic mass: Ar ≈ ${n(el.atomicMass)}.\n• ${el.z} protons, ${el.z} electrons and usually ${neutrons} neutrons.\n• Period ${period ?? '?'}${group ? `, group ${group}` : ''}.\n• Electron configuration: ${prettyConfig(el.electronConfiguration)}.${state ? `\n• Under normal conditions it is ${state}.` : ''}\nKey idea: the number ${el.z} tells you how many protons and electrons the atom has.`,
        `${name} (${el.symbol}) — ${el.z}-element, ${block}.\n• Atom massasi: Ar ≈ ${n(el.atomicMass)}.\n• ${el.z} ta proton, ${el.z} ta elektron va odatda ${neutrons} ta neytron.\n• ${period ?? '?'}-davr${group ? `, ${group}-guruh` : ''}.\n• Elektron konfiguratsiyasi: ${prettyConfig(el.electronConfiguration)}.${state ? `\n• Oddiy sharoitda — ${state}.` : ''}\nAsosiysi: ${el.z} raqami atomda nechta proton va elektron borligini bildiradi.`,
      )
  }
  return { text, entity, property, numbers }
}

function firstSentences(text: string, max = 2): string {
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[А-ЯA-ZЁ])/u)
  return parts.slice(0, max).join(' ')
}

export function answerFormula(formula: string, property: ChemProperty, lang: MathLang, moles?: number): ChemAnswer | null {
  const mm = molarMassOf(formula)
  if (!mm) return null
  const hit = compoundByFormula(formula)
  const pf = prettyFormula(formula)
  const L = <T,>(ru: T, en: T, uz: T) => (lang === 'en' ? en : lang === 'uz' ? uz : ru)
  const sum = mm.parts
    .map((p) => (p.count > 1 ? `${p.count}·${formatNumber(Number(p.mass.toFixed(3)), lang)}` : formatNumber(Number(p.mass.toFixed(3)), lang)))
    .join(' + ')
  const total = formatNumber(Number(mm.total.toFixed(2)), lang)
  const label = hit ? (lang === 'ru' ? `${hit.nameRu} (${pf})` : pf) : pf
  const cls = hit ? CATEGORY[lang][hit.category] : null
  const entity: TalkEntity = { kind: hit ? 'compound' : 'formula', key: formula, label: hit && lang === 'ru' ? hit.nameRu : pf }
  const numbers: Record<string, number> = { molar: mm.total }
  let text: string
  if (moles != null && moles > 0) {
    const mass = moles * mm.total
    numbers.mass = mass
    text = L(
      `Считаем по формуле m = n · M.\nM(${pf}) = ${sum} = ${total} г/моль.\nm = ${formatNumber(moles, lang)} моль · ${total} г/моль = ${formatNumber(Number(mass.toFixed(2)), lang)} г.\nОтвет: ${formatNumber(Number(mass.toFixed(2)), lang)} г.`,
      `We use m = n · M.\nM(${pf}) = ${sum} = ${total} g/mol.\nm = ${formatNumber(moles, lang)} mol · ${total} g/mol = ${formatNumber(Number(mass.toFixed(2)), lang)} g.`,
      `m = n · M formulasidan foydalanamiz.\nM(${pf}) = ${sum} = ${total} g/mol.\nm = ${formatNumber(moles, lang)} mol · ${total} g/mol = ${formatNumber(Number(mass.toFixed(2)), lang)} g.`,
    )
    return { text, entity, property: 'mass', numbers }
  }
  if (property === 'mass' || property === 'about' || property === 'formula') {
    const massLine = L(
      `Молярная масса ${label}: M = ${sum} = ${total} г/моль.`,
      `Molar mass of ${label}: M = ${sum} = ${total} g/mol.`,
      `${label} ning molyar massasi: M = ${sum} = ${total} g/mol.`,
    )
    const how = L(
      'Складываем атомные массы всех атомов формулы с учётом индексов.',
      'We add up the atomic masses of all atoms, taking the subscripts into account.',
      'Formuladagi barcha atomlarning massalarini indekslarni hisobga olib qoʻshamiz.',
    )
    if (property === 'mass') {
      text = `${massLine}\n${how}`
    } else {
      const intro = hit
        ? L(`${hit.nameRu} (${pf}) — ${cls}.`, `${pf} is ${cls ? `a ${cls}` : 'a substance from the catalogue'}.`, `${pf} — ${cls}.`)
        : L(`${pf} — такого вещества нет в каталоге ATOMLAB, но посчитать могу.`, `${pf} is not in the ATOMLAB catalogue, but I can still calculate.`, `${pf} ATOMLAB katalogida yoʻq, lekin hisoblay olaman.`)
      const desc = hit && lang === 'ru' && hit.description ? ` ${firstSentences(hit.description, 2)}` : ''
      text = `${intro}${desc}\n${massLine}`
    }
    return { text, entity, property: property === 'formula' ? 'about' : property, numbers }
  }
  return null
}

/** Разбор «2 моль воды», «0,5 mol NaCl». */
export function molesInText(text: string): number | null {
  const m = text.replace(/(\d),(\d)/g, '$1.$2').match(/(\d+(?:\.\d+)?)\s*(моль|mol)(?!\p{L}*\s*ярн)/iu)
  return m ? Number(m[1]) : null
}

export function entityLabelForLang(entity: TalkEntity, lang: MathLang): string {
  if (entity.kind === 'element') {
    const el = ELEMENTS.find((e) => e.symbol === entity.key)
    return el ? elementName(el, lang) : entity.label
  }
  return entity.label
}

export function elementBySymbol(sym: string): ElementViewModel | null {
  return ELEMENTS.find((e) => e.symbol === sym) ?? null
}
