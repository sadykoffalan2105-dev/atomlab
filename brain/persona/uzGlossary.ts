/**
 * Узбекско-русско-английский словарь школьных терминов (учебник Kimyo 7–11 и понятия brain/kb/concepts.ts).
 * Зачем: учебники в базе русские, поэтому тема самодостаточного вопроса (StandaloneQuery.topic) всегда по-русски —
 * «valentlik nima?» → тема «валентность», и поиск SOURCES ищет по русскому учебнику.
 * Узбекский — латиницей с oʻ/gʻ (ʻ — U+02BB); при сравнении апострофы нормализуются.
 */

export type GlossaryPair = { uz: string; ru: string; en: string }

export const UZ_GLOSSARY: GlossaryPair[] = [
  // вещество и его виды
  { uz: 'modda', ru: 'вещество', en: 'substance' },
  { uz: 'oddiy modda', ru: 'простое вещество', en: 'simple substance' },
  { uz: 'murakkab modda', ru: 'сложное вещество', en: 'compound' },
  { uz: 'toza modda', ru: 'чистое вещество', en: 'pure substance' },
  { uz: 'aralashma', ru: 'смесь', en: 'mixture' },
  { uz: 'eritma', ru: 'раствор', en: 'solution' },
  { uz: 'erituvchi', ru: 'растворитель', en: 'solvent' },
  { uz: 'eruvchanlik', ru: 'растворимость', en: 'solubility' },
  { uz: 'toʻyingan eritma', ru: 'насыщенный раствор', en: 'saturated solution' },
  { uz: 'massa ulushi', ru: 'массовая доля', en: 'mass fraction' },
  { uz: 'konsentratsiya', ru: 'концентрация', en: 'concentration' },
  // классы неорганических веществ
  { uz: 'kislota', ru: 'кислота', en: 'acid' },
  { uz: 'asos', ru: 'основание', en: 'base' },
  { uz: 'ishqor', ru: 'щёлочь', en: 'alkali' },
  { uz: 'tuz', ru: 'соль', en: 'salt' },
  { uz: 'oksid', ru: 'оксид', en: 'oxide' },
  { uz: 'asosli oksid', ru: 'основный оксид', en: 'basic oxide' },
  { uz: 'kislotali oksid', ru: 'кислотный оксид', en: 'acidic oxide' },
  { uz: 'amfoter', ru: 'амфотерность', en: 'amphoterism' },
  { uz: 'gidroksid', ru: 'гидроксид', en: 'hydroxide' },
  { uz: 'metall', ru: 'металл', en: 'metal' },
  { uz: 'metallmas', ru: 'неметалл', en: 'non-metal' },
  { uz: 'galogen', ru: 'галоген', en: 'halogen' },
  { uz: 'inert gaz', ru: 'благородный газ', en: 'noble gas' },
  // строение вещества
  { uz: 'atom', ru: 'атом', en: 'atom' },
  { uz: 'molekula', ru: 'молекула', en: 'molecule' },
  { uz: 'ion', ru: 'ион', en: 'ion' },
  { uz: 'kation', ru: 'катион', en: 'cation' },
  { uz: 'anion', ru: 'анион', en: 'anion' },
  { uz: 'yadro', ru: 'ядро атома', en: 'nucleus' },
  { uz: 'proton', ru: 'протон', en: 'proton' },
  { uz: 'neytron', ru: 'нейтрон', en: 'neutron' },
  { uz: 'elektron', ru: 'электрон', en: 'electron' },
  { uz: 'elektron qavat', ru: 'электронный слой', en: 'electron shell' },
  { uz: 'elektron konfiguratsiya', ru: 'электронная конфигурация', en: 'electron configuration' },
  { uz: 'orbital', ru: 'орбиталь', en: 'orbital' },
  { uz: 'izotop', ru: 'изотопы', en: 'isotopes' },
  { uz: 'kimyoviy element', ru: 'химический элемент', en: 'chemical element' },
  { uz: 'element', ru: 'химический элемент', en: 'element' },
  { uz: 'tartib raqami', ru: 'порядковый номер', en: 'atomic number' },
  { uz: 'nisbiy atom massa', ru: 'относительная атомная масса', en: 'relative atomic mass' },
  // периодический закон
  { uz: 'davriy qonun', ru: 'периодический закон', en: 'periodic law' },
  { uz: 'davriy jadval', ru: 'периодическая система', en: 'periodic table' },
  { uz: 'davr', ru: 'период', en: 'period' },
  { uz: 'guruh', ru: 'группа', en: 'group' },
  { uz: 'elektromanfiylik', ru: 'электроотрицательность', en: 'electronegativity' },
  // валентность, степень окисления, количество вещества
  { uz: 'valentlik', ru: 'валентность', en: 'valence' },
  { uz: 'oksidlanish darajasi', ru: 'степень окисления', en: 'oxidation state' },
  { uz: 'molyar massa', ru: 'молярная масса', en: 'molar mass' },
  { uz: 'molekulyar massa', ru: 'молекулярная масса', en: 'molecular mass' },
  { uz: 'modda miqdori', ru: 'количество вещества', en: 'amount of substance' },
  { uz: 'mol', ru: 'моль', en: 'mole' },
  { uz: 'avogadro soni', ru: 'число Авогадро', en: 'Avogadro number' },
  { uz: 'avogadro qonuni', ru: 'закон Авогадро', en: "Avogadro's law" },
  { uz: 'molyar hajm', ru: 'молярный объём', en: 'molar volume' },
  { uz: 'massaning saqlanish qonuni', ru: 'закон сохранения массы', en: 'law of conservation of mass' },
  { uz: 'tarkibning doimiylik qonuni', ru: 'закон постоянства состава', en: 'law of definite proportions' },
  // химическая связь
  { uz: 'kimyoviy bogʻ', ru: 'химическая связь', en: 'chemical bond' },
  { uz: 'kovalent bogʻ', ru: 'ковалентная связь', en: 'covalent bond' },
  { uz: 'kovalent qutbli', ru: 'ковалентная полярная связь', en: 'polar covalent bond' },
  { uz: 'kovalent qutbsiz', ru: 'ковалентная неполярная связь', en: 'non-polar covalent bond' },
  { uz: 'ion bogʻ', ru: 'ионная связь', en: 'ionic bond' },
  { uz: 'ionli bogʻ', ru: 'ионная связь', en: 'ionic bond' },
  { uz: 'metall bogʻ', ru: 'металлическая связь', en: 'metallic bond' },
  { uz: 'vodorod bogʻ', ru: 'водородная связь', en: 'hydrogen bond' },
  { uz: 'kristall panjara', ru: 'кристаллическая решётка', en: 'crystal lattice' },
  { uz: 'allotropiya', ru: 'аллотропия', en: 'allotropy' },
  { uz: 'gibridlanish', ru: 'гибридизация', en: 'hybridization' },
  // реакции
  { uz: 'kimyoviy reaksiya', ru: 'химическая реакция', en: 'chemical reaction' },
  { uz: 'reaksiya belgilari', ru: 'признаки реакции', en: 'signs of a reaction' },
  { uz: 'reaksiya turlari', ru: 'типы реакций', en: 'types of reactions' },
  { uz: 'birikish', ru: 'реакция соединения', en: 'combination reaction' },
  { uz: 'parchalanish', ru: 'реакция разложения', en: 'decomposition reaction' },
  { uz: 'oʻrin olish', ru: 'реакция замещения', en: 'substitution reaction' },
  { uz: 'almashinish', ru: 'реакция обмена', en: 'exchange reaction' },
  { uz: 'ekzotermik', ru: 'экзотермическая реакция', en: 'exothermic reaction' },
  { uz: 'endotermik', ru: 'эндотермическая реакция', en: 'endothermic reaction' },
  { uz: 'issiqlik effekti', ru: 'тепловой эффект', en: 'heat effect' },
  { uz: 'katalizator', ru: 'катализатор', en: 'catalyst' },
  { uz: 'reaksiya tezligi', ru: 'скорость реакции', en: 'reaction rate' },
  { uz: 'kimyoviy muvozanat', ru: 'химическое равновесие', en: 'chemical equilibrium' },
  { uz: 'oksidlanish-qaytarilish', ru: 'окислительно-восстановительные реакции', en: 'redox reactions' },
  { uz: 'oksidlovchi', ru: 'окислитель', en: 'oxidizing agent' },
  { uz: 'qaytaruvchi', ru: 'восстановитель', en: 'reducing agent' },
  { uz: 'oksidlanish', ru: 'окисление', en: 'oxidation' },
  { uz: 'qaytarilish', ru: 'восстановление', en: 'reduction' },
  { uz: 'elektron balans', ru: 'электронный баланс', en: 'electron balance' },
  // растворы и электролиты
  { uz: 'gidroliz', ru: 'гидролиз', en: 'hydrolysis' },
  { uz: 'elektroliz', ru: 'электролиз', en: 'electrolysis' },
  { uz: 'dissotsilanish', ru: 'электролитическая диссоциация', en: 'electrolytic dissociation' },
  { uz: 'elektrolit', ru: 'электролит', en: 'electrolyte' },
  { uz: 'indikator', ru: 'индикатор', en: 'indicator' },
  { uz: 'lakmus', ru: 'лакмус', en: 'litmus' },
  { uz: 'fenolftalein', ru: 'фенолфталеин', en: 'phenolphthalein' },
  { uz: 'metiloranj', ru: 'метилоранж', en: 'methyl orange' },
  { uz: 'vodorod koʻrsatkich', ru: 'водородный показатель', en: 'pH' },
  { uz: 'neytrallanish', ru: 'реакция нейтрализации', en: 'neutralization' },
  { uz: 'choʻkma', ru: 'осадок', en: 'precipitate' },
  { uz: 'gaz ajralishi', ru: 'выделение газа', en: 'gas evolution' },
  // запись реакций
  { uz: 'tenglama', ru: 'уравнение реакции', en: 'equation' },
  { uz: 'koeffitsiyent', ru: 'коэффициент', en: 'coefficient' },
  { uz: 'koeffitsient', ru: 'коэффициент', en: 'coefficient' },
  { uz: 'indeks', ru: 'индекс', en: 'subscript' },
  { uz: 'kimyoviy formula', ru: 'химическая формула', en: 'chemical formula' },
  // вещества-«герои» школьного курса
  { uz: 'vodorod', ru: 'водород', en: 'hydrogen' },
  { uz: 'kislorod', ru: 'кислород', en: 'oxygen' },
  { uz: 'azot', ru: 'азот', en: 'nitrogen' },
  { uz: 'uglerod', ru: 'углерод', en: 'carbon' },
  { uz: 'oltingugurt', ru: 'сера', en: 'sulfur' },
  { uz: 'fosfor', ru: 'фосфор', en: 'phosphorus' },
  { uz: 'xlor', ru: 'хлор', en: 'chlorine' },
  { uz: 'natriy', ru: 'натрий', en: 'sodium' },
  { uz: 'kaliy', ru: 'калий', en: 'potassium' },
  { uz: 'kalsiy', ru: 'кальций', en: 'calcium' },
  { uz: 'temir', ru: 'железо', en: 'iron' },
  { uz: 'mis', ru: 'медь', en: 'copper' },
  { uz: 'alyuminiy', ru: 'алюминий', en: 'aluminium' },
  { uz: 'suv', ru: 'вода', en: 'water' },
  { uz: 'ozon', ru: 'озон', en: 'ozone' },
  { uz: 'ammiak', ru: 'аммиак', en: 'ammonia' },
  // органика (10–11 класс)
  { uz: 'organik birikma', ru: 'органическое вещество', en: 'organic compound' },
  { uz: 'uglevodorod', ru: 'углеводороды', en: 'hydrocarbons' },
  { uz: 'alkan', ru: 'алканы', en: 'alkanes' },
  { uz: 'alken', ru: 'алкены', en: 'alkenes' },
  { uz: 'alkin', ru: 'алкины', en: 'alkynes' },
  { uz: 'spirt', ru: 'спирты', en: 'alcohols' },
  { uz: 'izomeriya', ru: 'изомерия', en: 'isomerism' },
  { uz: 'polimer', ru: 'полимеры', en: 'polymers' },
  { uz: 'oqsil', ru: 'белки', en: 'proteins' },
  { uz: 'uglevod', ru: 'углеводы', en: 'carbohydrates' },
]

/** Апострофы узбекской латиницы к одному виду (oʻ, gʻ — U+02BB), нижний регистр. */
export function foldUz(s: string): string {
  return s
    .toLowerCase()
    .replace(/(?<=[og])['’‘`ʼ]/g, 'ʻ')
    .replace(/['’‘`ʼ]/g, 'ʼ')
    .replace(/\s+/g, ' ')
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Основа термина с чередованием перед гласным аффиксом: valentlik → valentligi, toʻliq → toʻligʻi. */
function termRe(term: string): string {
  if (/k$/.test(term)) return `(?:${esc(term)}|${esc(term.slice(0, -1))}g)`
  if (/q$/.test(term)) return `(?:${esc(term)}|${esc(term.slice(0, -1))}gʻ)`
  return esc(term)
}

/** Совпадение основы: узбекские окончания (-ning, -ni, -da, -dan, -lar, -ga, -chi…) — до 8 букв хвоста. */
function uzHas(text: string, term: string): boolean {
  return new RegExp(`(^|[^\\p{L}ʻʼ])${termRe(term)}[\\p{L}ʻʼ-]{0,8}(?![\\p{L}ʻʼ])`, 'u').test(text)
}

let SORTED: GlossaryPair[] | null = null

/**
 * Русские термины из узбекского текста — длинные сочетания первыми («kovalent bogʻ» раньше «bogʻ»),
 * уже совпавшие слова не учитываются повторно. Порядок — как в тексте.
 */
export function uzToRuTerms(text: string): string[] {
  SORTED ??= [...UZ_GLOSSARY].sort((a, b) => b.uz.length - a.uz.length)
  let t = ` ${foldUz(text)} `
  const hits: { at: number; ru: string }[] = []
  for (const p of SORTED) {
    const term = foldUz(p.uz)
    if (!uzHas(t, term)) continue
    const at = t.search(new RegExp(`(^|[^\\p{L}ʻʼ])${termRe(term)}`, 'u'))
    hits.push({ at, ru: p.ru })
    // вырезаем совпавшее, чтобы «bogʻ» не нашёлся второй раз внутри «kovalent bogʻ»
    t = t.replace(new RegExp(`${termRe(term)}[\\p{L}ʻʼ-]{0,8}`, 'u'), (m) => ' '.repeat(m.length))
  }
  return hits
    .sort((a, b) => a.at - b.at)
    .map((h) => h.ru)
    .filter((x, i, a) => a.indexOf(x) === i)
}

/** Вещества и элементы словаря — это сущности, а не тема («kislorodning valentligi» → тема «валентность»). */
const ENTITY_RU = new Set(['водород', 'кислород', 'азот', 'углерод', 'сера', 'фосфор', 'хлор', 'натрий', 'калий', 'кальций', 'железо', 'медь', 'алюминий', 'вода', 'озон', 'аммиак'])

/** Термины-темы (без веществ и элементов) из узбекского текста. */
export function uzTopicTerms(text: string): string[] {
  return uzToRuTerms(text).filter((t) => !ENTITY_RU.has(t))
}

/** Русский термин → узбекский (для шаблонов standalone на uz: «Soddaroq tushuntir: valentlik»). */
export function ruToUz(ru: string): string | null {
  const k = ru.toLowerCase().replace(/ё/g, 'е')
  return UZ_GLOSSARY.find((p) => p.ru.toLowerCase().replace(/ё/g, 'е') === k)?.uz ?? null
}

/** Русский термин → английский. */
export function ruToEn(ru: string): string | null {
  const k = ru.toLowerCase().replace(/ё/g, 'е')
  return UZ_GLOSSARY.find((p) => p.ru.toLowerCase().replace(/ё/g, 'е') === k)?.en ?? null
}

// ---------------------------------------------------------------- аффиксы для шаблонов standalone

/** Сочетание → [начало с пробелом, последнее слово] (аффикс получает последнее слово). */
function splitLast(term: string): [string, string] {
  const t = term.trim()
  const i = t.lastIndexOf(' ')
  return [t.slice(0, i + 1), t.slice(i + 1)]
}

/**
 * Притяжательная форма 3-го лица: valentlik → valentligi, mol → moli, molyar massa → molyar massasi;
 * изафет уже с аффиксом («oksidlanish darajasi», «massa ulushi», «reaksiya tezligi») — как есть.
 */
export function uzPossessive(term: string): string {
  const [head, w] = splitLast(term)
  if (head && /[^aeiouʻʼ']i$/i.test(w)) return head + w
  if (/[aeiou]$/i.test(w)) return `${head}${w}si`
  if (/k$/i.test(w) && w.length > 3) return `${head}${w.slice(0, -1)}gi`
  if (/q$/i.test(w) && w.length > 3) return `${head}${w.slice(0, -1)}gʻi`
  return `${head}${w}i`
}

/** Дательный падеж: valentlik → valentlikka, toʻliq → toʻliqqa, mol → molga. */
export function uzDative(term: string): string {
  const [head, w] = splitLast(term)
  if (/k$/i.test(w)) return `${head}${w}ka`
  if (/q$/i.test(w)) return `${head}${w}qa`
  return `${head}${w}ga`
}

/** Винительный падеж: valentlik → valentlikni. */
export function uzAccusative(term: string): string {
  return `${term.trim()}ni`
}

/** Родительный падеж: natriy → natriyning. */
export function uzGenitive(term: string): string {
  return `${term.trim()}ning`
}
