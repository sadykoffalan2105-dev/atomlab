/**
 * ЕДИНЫЙ КРИТЕРИЙ «УЧИТЕЛЬ ОБЪЯСНИЛ ПОЛНОЦЕННО».
 *
 * Раньше критерия не было, и два независимых счёта по одному и тому же набору вопросов
 * расходились вдвое (17 из 30 против 28 из 30): один считал полным любой длинный абзац,
 * другой требовал формулу и пример. Здесь определение записано один раз, и им пользуются
 * и тест движка (scripts/test-teacher-live-engine.mts), и прогоны качества в .smoke/teacher-qa.
 *
 * ОБЯЗАТЕЛЬНОЕ (нет хотя бы одного — ответ не засчитывается вовсе):
 *   1) по сути вопроса — в ответе есть ожидаемые основы темы;
 *   2) объяснение на уровне частиц — названа причина (потому что / поэтому / because /
 *      chunki …) и она про частицы (атомы, молекулы, электроны, ионы, связи, энергия),
 *      а не пересказ вопроса;
 *   3) язык ответа = язык вопроса (чужой алфавит в теле ответа — не больше 20 %);
 *   4) нет нерелевантной цитаты — если учитель цитирует учебник, цитата обязана нести
 *      слова темы вопроса (промах поиска в кавычках хуже честного «не знаю»).
 * ЖЕЛАТЕЛЬНОЕ (для вердикта FULL нужно не меньше двух):
 *   • формула или уравнение; • пример; • проверочный вопрос ученику в конце.
 *
 * ВЕРДИКТ: FULL — всё обязательное и ≥ 2 желательных; MINIMAL — всё обязательное;
 * FAIL — иначе. Приёмка набора: FULL ≥ FULL_ACCEPTANCE, MINIMAL = 100 %.
 */
import { contentStems, foldText, stemsMatch } from './textStems'

export type QualityLang = 'ru' | 'en' | 'uz'
export type QualityKind = 'chem' | 'offtopic' | 'gibberish'
export type QualityVerdict = 'FULL' | 'MINIMAL' | 'FAIL'

/** Доля ответов, обязанных быть FULL. Ниже — качество просело, тест падает. */
export const FULL_ACCEPTANCE = 0.9

export interface QualityInput {
  question: string
  answer: string
  lang: QualityLang
  kind?: QualityKind
  /** Основы, без которых ответ не по сути вопроса. */
  expect?: readonly string[]
  /** Движок считает ответ уверенным (для offtopic/мусора обязан быть false). */
  confident?: boolean
}

export interface QualityReport {
  verdict: QualityVerdict
  /** Обязательные признаки. */
  onTopic: boolean
  particles: boolean
  langOk: boolean
  quoteOk: boolean
  /** Желательные признаки. */
  formula: boolean
  example: boolean
  asksBack: boolean
  /** Для offtopic/мусора. */
  refused: boolean
  clarified: boolean
  quotesInput: boolean
  words: number
  why: string[]
}

/* ------------------------------------------------------------------ признаки */

/** Причинная связка: без неё «объяснение» — это просто определение. */
const CAUSE_RE =
  /(потому что|так как|поэтому|из-за|благодаря|причин|почему|значит|отсюда|следовательно|because|since|\bwhy\b|the reason|the cause|as a result|chunki|shuning uchun|sabab|nega|demak)/iu

/**
 * Уровень частиц и механизма: атомы, молекулы, электроны, ионы, связи — и физические
 * величины, через которые школьный ответ объясняет причину (теплота, плотность, скорость).
 * Без такого слова «причина» в ответе — это пересказ вопроса, а не объяснение.
 */
const PARTICLE_RE =
  /(атом|молекул|электрон|протон|нейтрон|ион|частиц|связ[ьиеяй]|решётк|решетк|энерги|заряд|валентн|оболочк|элемент|окислен|тепло|теплот|плотност|температур|давлен|скорост|раствор|orbital|atom|molecul|electron|proton|neutron|particle|bond|lattice|energy|charge|shell|element|oxidation|heat|density|temperature|pressure|rate|dissolv|zarracha|elektron|molekul|bog['ʻʼ]|panjara|energiya|zaryad|qobiq|oksidlan|issiqlik|zichlik|harorat|bosim|tezlik|eritm)/iu

/** Формула или уравнение. */
const FORMULA_RE =
  /(?:[A-Z][a-z]?[₀-₉0-9]*\s*(?:\+|→|=|⇌|->)\s*)|(?:\b[A-Z][a-z]?[₀-₉0-9]+\b)|\b(H₂O|H2O|CO₂|CO2|O₂|O2|NaCl|CaO|HCl|NH₃|NH3)\b|(?:\bn\s*=\s*m\s*\/\s*M\b)|ω\s*=/u

const EXAMPLE_RE = /(например|к примеру|на практике|из жизни|пример[:\s]|for example|in practice|such as|e\.g\.|masalan|amalda|misol)/iu

/** Цитата учебника: «…» длиннее нескольких слов. */
const QUOTE_RE = /«([^»]{20,})»/u

const CYR_RE = /[А-Яа-яЁё]/g
const LAT_RE = /[A-Za-z]/g

/** Отказ «в базе нет ответа» — честный, без выдумки. */
const REFUSAL_RE =
  /(не по химии|не относится к химии|в моей базе нет|нет точного ответа|точного ответа[^.]{0,40}нет|выдумывать не буду|выдумывать я не буду|я помогаю с химией|not about chemistry|no exact answer|knowledge base has no|i (will not|won'?t|do not|don'?t) make (it )?up|i help with chemistry|kimyo(ga oid)? emas|bazamda[^.]{0,30}yo['ʻʼ‘’`]q|aniq javob yo['ʻʼ‘’`]q|o['ʻʼ‘’`]ylab topmayman)/iu

/** Переспрос на нераспознанный ввод. */
const CLARIFY_RE =
  /(не расслышал|не разобрал|не понял вопрос|повтори|переспрош|скажи ещё раз|скажи еще раз|уточни|набор букв|случайн[оы]|did not catch|didn'?t catch|could not read|couldn'?t read|say (that )?again|repeat the question|random letters|tushunmadim|eshitmadim|qaytar|tasodifiy harf)/iu

/**
 * Доля кириллицы в теле ответа. Формулы, символы элементов, подписи источников и ссылка
 * в лабораторию латиницей — не «язык ответа», иначе русский ответ с уравнением считался бы
 * английским.
 */
export function cyrillicShare(text: string): number {
  const body = text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/#\/\S*/g, ' ')
    .replace(/\b(?:[A-Z][a-z]?[₀-₉0-9]+|(?:[A-Z][a-z]?){2,}|[A-Za-z]{1,2})\b/g, ' ')
  const c = (body.match(CYR_RE) ?? []).length
  const l = (body.match(LAT_RE) ?? []).length
  return c + l === 0 ? 0 : c / (c + l)
}

/** Цитата несёт слова темы вопроса (иначе это промах поиска в кавычках). */
function quoteRelevant(question: string, answer: string): boolean {
  const quote = QUOTE_RE.exec(answer)?.[1]
  if (!quote) return true
  const qStems = contentStems(question).filter((s) => s.length >= 4)
  if (qStems.length === 0) return true
  const quoteFold = foldText(quote)
  const hit = qStems.filter((s) => quoteFold.includes(s.slice(0, Math.max(4, s.length - 1)))).length
  return hit >= 1
}

/** Ответ цитирует сам ввод ученика (для мусора запрещено: выглядит как принятая тема). */
function quotesTheInput(question: string, answer: string): boolean {
  const q = foldText(question).replace(/[^\p{L}\s]/gu, ' ').trim()
  if (q.length < 4) return false
  const a = foldText(answer)
  if (a.includes(q)) return true
  const words = q.split(/\s+/).filter((w) => w.length >= 4)
  return words.length > 0 && words.every((w) => a.includes(w))
}

/* ------------------------------------------------------------------- вердикт */

/** Слова вопроса, по которым тему опознать нельзя (есть почти в любом вопросе). */
const HEAD_WEAK = [
  'веществ', 'химическ', 'хими', 'реакц', 'найт', 'наход', 'определ', 'посчит', 'вычисл', 'получ', 'объясн', 'расскаж',
  'бывают', 'вид', 'такое', 'прост', 'словам', 'суть', 'тем', 'урок', 'параграф',
  'substanc', 'chemic', 'reaction', 'find', 'calcul', 'determin', 'explain', 'kind', 'type', 'simpl',
  'modda', 'kimyo', 'reaksiya', 'top', 'hisobla', 'aniqla', 'tushuntir', 'tur',
]

function questionHeadsCovered(question: string, answer: string): boolean {
  const heads = contentStems(question).filter((s) => s.length >= 4 && !HEAD_WEAK.some((w) => s.startsWith(w)))
  if (heads.length === 0) return true
  const aStems = contentStems(answer)
  return heads.some((h) => aStems.some((a) => stemsMatch(a, h)))
}

export function gradeAnswer(input: QualityInput): QualityReport {
  const text = (input.answer ?? '').trim()
  const kind = input.kind ?? 'chem'
  const flat = foldText(text)
  const words = text.split(/\s+/).filter(Boolean).length
  const share = cyrillicShare(text)

  const refused = REFUSAL_RE.test(text)
  const clarified = CLARIFY_RE.test(text)
  const quotesInput = quotesTheInput(input.question, text)
  const langOk = input.lang === 'ru' ? share >= 0.8 : share <= 0.2
  // Без явного expect тема выводится из самого вопроса: хотя бы одно его смысловое слово
  // («эквивалент», «изомерия») обязано встретиться в ответе. Иначе красивый ответ про Mr
  // на вопрос про эквивалент проходил как FULL.
  const onTopic =
    (input.expect ?? []).length > 0
      ? (input.expect ?? []).some((w) => flat.includes(foldText(w)))
      : questionHeadsCovered(input.question, text)
  const particles = CAUSE_RE.test(text) && PARTICLE_RE.test(text) && words >= 25
  const quoteOk = quoteRelevant(input.question, text)
  const formula = FORMULA_RE.test(text)
  const example = EXAMPLE_RE.test(text)
  // Проверочный вопрос ученику — это и прямой вопрос, и задание («Составь формулу…»).
  const lastSentence = text.split(/(?<=[.!?])\s+/u).at(-1) ?? ''
  const asksBack =
    /\?\s*[»"']?\s*$/u.test(text) ||
    /(назови|составь|определи|расставь|объясни|посчитай|приведи|запиши|реши|name |write |work out|explain |give |calculate |ayt|tuz|aniqla|hisobla|tushuntir)/iu.test(lastSentence)

  const why: string[] = []
  if (kind === 'offtopic') {
    if (!refused) why.push('нет честного отказа')
    if (input.confident) why.push('уверенный ответ на вопрос не по химии')
    if (!langOk) why.push(`язык отказа не совпал (кир. ${Math.round(share * 100)}%)`)
    const verdict: QualityVerdict = why.length === 0 ? 'FULL' : 'FAIL'
    return { verdict, onTopic: true, particles: false, langOk, quoteOk: true, formula: false, example: false, asksBack, refused, clarified, quotesInput, words, why }
  }
  if (kind === 'gibberish') {
    if (!clarified) why.push('нет переспроса')
    if (quotesInput) why.push('ввод процитирован как тема вопроса')
    if (!langOk) why.push(`язык переспроса не совпал (кир. ${Math.round(share * 100)}%)`)
    const verdict: QualityVerdict = why.length === 0 ? 'FULL' : 'FAIL'
    return { verdict, onTopic: true, particles: false, langOk, quoteOk: true, formula: false, example: false, asksBack, refused, clarified, quotesInput, words, why }
  }

  if (!onTopic) why.push('не по сути вопроса')
  if (!particles) why.push(`нет объяснения на уровне частиц (${words} сл.)`)
  if (!langOk) why.push(`язык не совпал (кир. ${Math.round(share * 100)}%)`)
  if (!quoteOk) why.push('нерелевантная цитата')
  if (refused) why.push('отказ на химический вопрос')
  if (input.confident === false) why.push('ответ не уверенный')

  const wanted = [formula, example, asksBack].filter(Boolean).length
  const verdict: QualityVerdict = why.length > 0 ? 'FAIL' : wanted >= 2 ? 'FULL' : 'MINIMAL'
  if (verdict === 'MINIMAL') {
    if (!formula) why.push('нет формулы')
    if (!example) why.push('нет примера')
    if (!asksBack) why.push('нет вопроса ученику')
  }
  return { verdict, onTopic, particles, langOk, quoteOk, formula, example, asksBack, refused, clarified, quotesInput, words, why }
}

/** Свод по набору: сколько FULL, сколько хотя бы MINIMAL. */
export function summarizeQuality(reports: readonly QualityReport[]): {
  total: number
  full: number
  minimal: number
  failed: number
  fullShare: number
  accepted: boolean
} {
  const total = reports.length
  const full = reports.filter((r) => r.verdict === 'FULL').length
  const minimal = reports.filter((r) => r.verdict !== 'FAIL').length
  const fullShare = total === 0 ? 0 : full / total
  return { total, full, minimal, failed: total - minimal, fullShare, accepted: minimal === total && fullShare >= FULL_ACCEPTANCE }
}
