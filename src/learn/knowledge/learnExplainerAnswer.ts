/**
 * Ответ учителя по карточке объяснения: «что → почему → формула → пример → проверка».
 *
 * Работает полностью офлайн. Карточки (learnExplainerCards) закрывают типовые школьные
 * «почему / что такое / чем отличается», на которые извлечение фраз из учебника отвечает
 * мимо вопроса. Если карточка не подошла — возвращаем null, и дальше работает обычный
 * составитель (brain/dualMode/localAnswerComposer).
 */
import type { ComposeStyle, ComposedAnswer } from '../brain/dualMode/localAnswerComposer'
import { contentStems, foldText, stemsMatch, type StemLang } from '../brain/dualMode/textStems'
import { EXPLAINER_CARDS, explainerCardById, type ExplainerCard, type ExplainerCardText, type ExplainerKind } from './learnExplainerCards'
import { EXPLAINER_CARDS_I18N } from './learnExplainerCardsI18n'
import { matchSafetyQuestion } from './learnSafetyQuestions'

export interface ExplainerMatch {
  card: ExplainerCard
  /** Слоты на языке ученика (ru — из самой карточки). */
  text: ExplainerCardText
  lang: StemLang
  /** Сколько смысловых слов вопроса покрыл триггер. */
  score: number
}

/** Слова, по которым нельзя опознать тему (они есть почти в каждом вопросе). */
const WEAK_STEMS = [
  'вещество', 'веществ', 'химическ', 'химия', 'реакц', 'урок', 'тема', 'параграф', 'пример', 'задач',
  'substanc', 'chemical', 'chemistr', 'reaction', 'lesson', 'topic', 'example',
  'modda', 'kimyo', 'reaksiya', 'dars', 'mavzu', 'misol',
]

/**
 * Слабая основа — с учётом форм слова: «chemistry» из «What is a mole in chemistry?»
 * это та же основа «chemistr». Иначе «в химии» перевешивало сам вопрос про моль.
 */
function isWeakStem(stem: string): boolean {
  return WEAK_STEMS.some((w) => stem.startsWith(w) || (stem.length >= 4 && w.startsWith(stem)))
}

const KIND_RE: Record<Exclude<ExplainerKind, 'what'>, RegExp> = {
  why: /(почему|отчего|зачем|с чем связан|чем объясн|why|how come|nega|nima uchun|nimaga)/iu,
  how: /(как\s|каким образом|как определ|как найти|как получ|как составить|how (?:to|do|can)|qanday)/iu,
  compare: /(чем отлич|в чём разниц|в чем разниц|отличие|разница|сравни|difference|compare|farq)/iu,
  example: /(пример|например|example|misol)/iu,
}

function questionKinds(query: string): ExplainerKind[] {
  const q = foldText(query)
  const kinds: ExplainerKind[] = []
  for (const [kind, re] of Object.entries(KIND_RE) as [Exclude<ExplainerKind, 'what'>, RegExp][]) {
    if (re.test(q)) kinds.push(kind)
  }
  if (kinds.length === 0 || /(что такое|что это|кто такой|what is|what are|nima|qanday modda)/iu.test(q)) kinds.push('what')
  return kinds
}

/** Числовая задача («сколько граммов в 2 молях») — её решает расчётный решатель, не карточка. */
const CALC_QUERY_RE = /\d+(?:[.,]\d+)?\s*(?:г|кг|мл|л|моль|мол[ьяей]|грамм|литр|%|°)/iu

function cardText(card: ExplainerCard, lang: StemLang): ExplainerCardText | null {
  if (lang === 'ru') return card
  const tr = EXPLAINER_CARDS_I18N[card.id]?.[lang]
  return tr ?? null
}

function cardTerms(card: ExplainerCard, lang: StemLang): readonly string[] {
  if (lang === 'ru') return card.terms
  return EXPLAINER_CARDS_I18N[card.id]?.[lang]?.terms ?? []
}

/**
 * Подобрать карточку под вопрос ученика.
 * Условия строгие: все слова триггера должны быть в вопросе, и вопрос не должен
 * содержать больше одного «лишнего» смыслового слова — иначе это вопрос о другом.
 */
export function matchExplainerCard(query: string, lang: StemLang): ExplainerMatch | null {
  const q = query.trim()
  if (q.length < 3 || CALC_QUERY_RE.test(q)) return null
  const qStems = contentStems(q)
  if (qStems.length === 0) return null
  const kinds = questionKinds(q)

  let best: ExplainerMatch | null = null
  for (const card of EXPLAINER_CARDS) {
    const text = cardText(card, lang)
    if (!text) continue
    for (const term of cardTerms(card, lang)) {
      const tStems = contentStems(term)
      if (tStems.length === 0) continue
      const matched = tStems.filter((t) => qStems.some((s) => stemsMatch(s, t)))
      // Пропуск одного слова из длинного триггера («signs of a chemical reaction» против
      // «how do I know that a chemical reaction has happened») — ещё попадание, но со штрафом.
      const missed = tStems.length - matched.length
      const nearMiss = missed === 1 && tStems.length >= 3 && matched.length >= 2
      if (missed > 0 && !nearMiss) continue
      // Короткая основа («хим» из «химия») годится как опора темы только в совсем коротком вопросе.
      const strong = matched.filter((t) => (!isWeakStem(t) || qStems.length <= 1) && (t.length >= 4 || qStems.length <= 2))
      if (strong.length === 0) continue
      // «Лишние» слова вопроса: их не покрыл триггер — значит спрашивают про что-то ещё.
      const leftover = qStems.filter((s) => s.length >= 4 && !isWeakStem(s) && !tStems.some((t) => stemsMatch(s, t)))
      const allowExtra = tStems.length >= 3 ? 2 : 1
      if (leftover.length > allowExtra) continue
      // «Чем ион отличается от атома?» нельзя закрывать карточкой «что такое атом»:
      // у вопроса явный признак сравнения, а карточка сравнение не описывает.
      if (kinds.includes('compare') && !card.kinds.includes('compare')) continue
      const kindBonus = card.kinds.some((k) => kinds.includes(k)) ? 3 : 0
      // Точное совпадение основы важнее префиксного: «оксидлар» → карточка «оксид»,
      // а не «оксидланиш» (горение), где основа лишь начинается так же.
      const exact = strong.filter((t) => qStems.includes(t)).length
      const score = strong.length * 4 + exact * 3 + kindBonus - leftover.length - (nearMiss ? 4 : 0)
      if (kindBonus === 0 && leftover.length > 0) continue
      if (nearMiss && kindBonus === 0) continue
      if (!best || score > best.score) best = { card, text, lang, score }
    }
  }
  return best
}

/* ---------------------------------------------------------------- фразировка */

type Pools = {
  openers: string[]
  why: string[]
  formulaEq: string[]
  formulaPlain: string[]
  example: string[]
  mistake: string[]
  lab: (see: string, href: string) => string
  checkLead: string[]
}

const POOLS: Record<'ru' | 'en' | 'uz', Pools> = {
  ru: {
    openers: ['Смотри.', 'Разберём по порядку.', 'Коротко и по делу.', 'Давай по шагам.', 'Объясняю.', 'Вот суть.'],
    why: ['Почему так:', 'Причина вот в чём:', 'А теперь — почему:', 'Разберёмся в причине:'],
    formulaEq: ['Записывают это так:', 'Вот уравнение:', 'На языке химии:', 'Уравнение реакции:'],
    formulaPlain: ['Формула:', 'Запомни формулу:', 'Считают по формуле:'],
    example: ['Пример:', 'Вот пример:', 'На практике:', 'Из жизни:'],
    mistake: ['Частая ошибка:', 'Тут обычно путают:', 'Обрати внимание:'],
    lab: (see, href) => `Хочешь увидеть — открой в лаборатории: ${href}, там видно, ${see}.`,
    checkLead: ['Теперь ты:', 'Проверим:', 'Вопрос тебе:', 'А теперь сам:', 'Держи вопрос:'],
  },
  en: {
    openers: ['Here it is.', 'Step by step.', 'Short and clear.', 'Let me explain.'],
    why: ['Why it happens:', 'The reason:', 'Here is the cause:'],
    formulaEq: ['In chemical language:', 'The equation:', 'Written like this:'],
    formulaPlain: ['The formula:', 'Remember the formula:'],
    example: ['Example:', 'For example:', 'In practice:'],
    mistake: ['Common mistake:', 'Careful here:'],
    lab: (see, href) => `Want to see it? Open the lab: ${href} — there you can watch ${see}.`,
    checkLead: ['Your turn:', 'Quick check:', 'Now you:'],
  },
  uz: {
    openers: ['Mana qara.', 'Tartib bilan koʻramiz.', 'Qisqacha.', 'Tushuntiraman.'],
    why: ['Sababi:', 'Nega bunday:', 'Mana sababi:'],
    formulaEq: ['Kimyo tilida:', 'Reaksiya tenglamasi:', 'Mana tenglama:'],
    formulaPlain: ['Formula:', 'Formulani eslab qol:'],
    example: ['Misol:', 'Masalan:', 'Amalda:'],
    mistake: ['Koʻp uchraydigan xato:', 'Diqqat:'],
    lab: (see, href) => `Koʻrmoqchimisan — laboratoriyani och: ${href}, u yerda ${see} koʻrinadi.`,
    checkLead: ['Endi sen:', 'Tekshiramiz:', 'Savol senga:'],
  },
}

function pick<T>(list: readonly T[], seed: number): T {
  return list[((seed % list.length) + list.length) % list.length]!
}

function ensureSentence(text: string): string {
  const t = text.trim()
  if (!t) return t
  return /[.!?:;]$/.test(t) ? t : `${t}.`
}

/**
 * Связка + слот: после двоеточия русское слово пишем со строчной буквы
 * («Причина вот в чём: отрицательные концы…»), а формулы и символы элементов не трогаем.
 */
/** Имена и названия, которые со строчной буквы писать нельзя. */
const PROPER_RU = /^(Менделеев|Авогадро|Ле\s|Вант|Лавуазье|Ломоносов|Бор|Резерфорд|Дальтон|Аррениус|Кимё|Kimyo)/u

/** Имена и слова, которые в en/uz со строчной буквы писать нельзя. */
const PROPER_LAT = /^(I\s|Le\s|Mendeleev|Avogadro|Van|Lavoisier|Lomonosov|Bohr|Rutherford|Dalton|Arrhenius|Celsius|Kimyo)/u

function lead(prefix: string, body: string): string {
  let b = body.trim()
  if (/:$/.test(prefix)) {
    // «Причина вот в чём: отрицательные концы…», «The reason: on freezing…» — после двоеточия
    // продолжается та же фраза. Формулы и символы элементов (вторая буква — заглавная) не трогаем.
    if (/^[А-ЯЁ](?:[а-яё]|\s)/u.test(b) && !PROPER_RU.test(b)) b = b[0]!.toLowerCase() + b.slice(1)
    else if (/^[A-Z][a-z]+(?:\s|,)/u.test(b) && !PROPER_LAT.test(b)) b = b[0]!.toLowerCase() + b.slice(1)
  }
  return ensureSentence(`${prefix} ${b}`)
}

/** Ссылка в реактор лаборатории: «#/?reactor=1&eq=<уравнение>». */
export function labHrefForEquation(equation: string): string {
  return `#/?reactor=1&eq=${encodeURIComponent(equation)}`
}

/* ------------------------------------------------------------------- ответ */

export interface ExplainerAnswerInput {
  query: string
  lang: StemLang
  style?: ComposeStyle
  seed?: number
  /** Уже найденная карточка (иначе ищем по вопросу). */
  match?: ExplainerMatch | null
}

/**
 * Полный ответ по карточке. Порядок слотов — форма ответа по умолчанию:
 * что происходит → почему → уравнение/формула → пример → проверочный вопрос.
 */
export function composeExplainerAnswer(input: ExplainerAnswerInput): ComposedAnswer | null {
  const match = input.match ?? matchExplainerCard(input.query, input.lang)
  if (!match) return null
  const style = input.style ?? {}
  const seed = input.seed ?? 0
  const lang = (input.lang === 'ru' || input.lang === 'en' || input.lang === 'uz' ? input.lang : 'ru') as 'ru' | 'en' | 'uz'
  const P = POOLS[lang]
  const t = match.text
  const voice = style.channel === 'voice'
  const more = style.detail === 'more'
  const sentences: string[] = []

  if (style.simpler) {
    sentences.push(ensureSentence(t.simple ?? t.what))
    if (!t.simple && t.why) sentences.push(lead(pick(P.why, seed), firstClause(t.why)))
    if (t.example) sentences.push(lead(pick(P.example, seed + 1), t.example))
  } else if (style.wantExample && t.example) {
    sentences.push(lead(pick(P.example, seed), t.example))
    if (t.formula) sentences.push(formulaLine(P, t.formula, seed))
    if (more && t.why) sentences.push(lead(pick(P.why, seed + 2), t.why))
  } else if (style.wantWhy && t.why) {
    // Сначала вывод («лёд легче воды»), потом причина на уровне частиц — так ответ
    // на «почему» читается как объяснение, а не как обрывок середины мысли.
    if (!style.continuation) sentences.push(ensureSentence(t.what))
    sentences.push(lead(pick(P.why, seed), t.why))
    if (t.formula) sentences.push(formulaLine(P, t.formula, seed))
    if (!voice && t.example) sentences.push(lead(pick(P.example, seed + 1), t.example))
  } else {
    // Полная схема объяснения. «Подробнее» после обычного ответа определение не повторяет.
    const repeatWhat = style.continuation && more
    if (!voice && more) sentences.push(pick(P.openers, seed))
    if (!repeatWhat) sentences.push(ensureSentence(t.what))
    if (t.why) sentences.push(lead(pick(P.why, seed), voice ? firstClause(t.why) : t.why))
    if (t.formula && !voice) sentences.push(formulaLine(P, t.formula, seed))
    if (t.example && !voice) sentences.push(lead(pick(P.example, seed + 1), t.example))
    if (repeatWhat && sentences.length <= 1 && t.what) sentences.unshift(ensureSentence(t.what))
  }

  if (more && t.misconception && !sentences.some((s) => s.includes(t.misconception!))) {
    sentences.push(lead(pick(P.mistake, seed), t.misconception))
  }
  const labSee = lang === 'ru' ? match.card.lab?.see : EXPLAINER_CARDS_I18N[match.card.id]?.[lang]?.labSee
  if (!voice && match.card.lab && labSee && (more || !style.simpler)) {
    sentences.push(P.lab(labSee, labHrefForEquation(match.card.lab.eq)))
  }
  if (!style.noCheckQuestion) sentences.push(lead(pick(P.checkLead, seed), t.check))

  const text = sentences.join(' ')
  return {
    text,
    sentences,
    confident: true,
    usedTitles: [`explainer:${match.card.id}`],
    usedCitations: [],
    keyTerm: firstTerm(match),
  }
}

function formulaLine(P: Pools, formula: string, seed: number): string {
  const isEquation = /→|⇌|=/u.test(formula)
  return lead(pick(isEquation ? P.formulaEq : P.formulaPlain, seed), formula)
}

/** Первая часть причины — для голоса (одна мысль вместо трёх). */
function firstClause(why: string): string {
  const parts = why.split(/(?<=[.!?])\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[1] ?? ''}`.trim() : why
}

function firstTerm(match: ExplainerMatch): string {
  const terms = match.lang === 'ru' ? match.card.terms : EXPLAINER_CARDS_I18N[match.card.id]?.[match.lang]?.terms ?? match.card.terms
  return terms[0] ?? match.card.id
}

/** Наводка для ученика, который сказал «не знаю» (без готового ответа). */
export function explainerHint(query: string, lang: StemLang): { hint: string; check: string } | null {
  const match = matchExplainerCard(query, lang)
  if (!match) return null
  const t = match.text
  if (!t.hint) return null
  return { hint: t.hint, check: t.check }
}

/* ------------------------------------------------------- вопросы безопасности */

/**
 * Ответ на вопрос БЕЗОПАСНОСТИ. Берётся только из привязанной карточки и ведёт с причины
 * («почему так делать нельзя»), а не с определения вещества. Поиска по корпусу здесь нет:
 * `null` означает «в базе нет ответа на языке ученика» — вызывающий обязан честно отказать,
 * а не искать фразу в учебнике (см. learnSafetyQuestions).
 */
export function composeSafetyAnswer(input: ExplainerAnswerInput): ComposedAnswer | null {
  const safety = matchSafetyQuestion(input.query, input.lang)
  if (!safety) return null
  const card = explainerCardById(safety.cardId)
  if (!card) return null
  const lang = input.lang === 'ru' || input.lang === 'en' || input.lang === 'uz' ? input.lang : 'ru'
  const base = lang === 'ru' ? (card as ExplainerCardText) : (EXPLAINER_CARDS_I18N[card.id]?.[lang] ?? null)
  // Слоты правила накрывают слоты карточки: для en/uz они и есть ответ, если перевода карточки нет.
  const over = safety.slots[lang]
  const text: ExplainerCardText | null = base ? { ...base, ...over } : over && over.what && over.why && over.check ? (over as ExplainerCardText) : null
  if (!text || !text.why) return null
  const match: ExplainerMatch = { card, text, lang, score: 100 }
  // Полная схема: правило → почему → как правильно → пример → проверка. Ученику нужен
  // именно ответ «почему нельзя», а не паспорт вещества, поэтому слоты заменены выше.
  return composeExplainerAnswer({ ...input, match, style: { ...(input.style ?? {}), wantWhy: false, wantExample: false, simpler: false, detail: 'more' } })
}

/** Вопрос безопасности опознан (ответ обязан прийти из карточки, поиск по корпусу запрещён). */
export function isSafetyQuestion(query: string, lang: StemLang): boolean {
  return matchSafetyQuestion(query, lang) !== null
}
