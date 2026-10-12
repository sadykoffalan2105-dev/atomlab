/**
 * Школьный ответ по карте программы (без модели — запасной путь; с моделью — выбор единицы для §-карточки и цитаты):
 *   definitionFor()      — термин вопроса → определение единицы (класс ученика первым): текст определения учебника
 *                          и точный § «[Kimyo 8, §12, стр. 50]»;
 *   unitForTopic()       — «почему …» → § класса ученика по теме вопроса (правила тем brain/kb/topicMap.ts + понятия карты);
 *   sectionAnswer()      — «о чём §12?» → название, страницы, понятия, главное определение и реакции § на языке вопроса;
 *   termDefinitionUzEn() — uz/en: определения учебника русские, перевода нет — честная рамка на языке вопроса
 *                          (термин, где его изучают, связанные понятия), без русских цитат в узбекском ответе.
 * Карты нет — вызывающий просто не идёт этим путём.
 */
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import { RULES } from '../kb/topicMap.ts'
import type { Lang } from '../pipeline/normalize.ts'
import type { CurriculumMap } from './map.ts'
import type { Unit } from './types.ts'

export type UnitDefinition = Unit['definitions'][number]
export type DefHit = { unit: Unit; def: UnitDefinition; index: number; termCov: number; qCov: number; inGrade: boolean }

const order = new WeakMap<CurriculumMap, Map<string, number>>()
function orderOf(map: CurriculumMap, u: Unit): number {
  let m = order.get(map)
  if (!m) {
    m = new Map(map.units.map((x, i) => [x.id, i]))
    order.set(map, m)
  }
  return m.get(u.id) ?? 0
}
const termStems = new WeakMap<UnitDefinition, string[]>()
const stemsOf = (d: UnitDefinition) => {
  let s = termStems.get(d)
  if (!s) termStems.set(d, (s = [...new Set(analyzeTerms(d.term.ru))]))
  return s
}

/**
 * Определение термина вопроса в карте. terms — стемы вопроса (для uz/en — русские стемы перевода из KbEngine.analyzeQuery).
 * Лучшее: термин определения целиком в вопросе и вопрос целиком о термине; класс ученика — первым, затем ближайший класс.
 * null — нет определения, покрывающего хотя бы половину термина и половину вопроса.
 */
/** Слова самого вопроса-определения («Что означает термин …», «понятие …») — не термин. */
const Q_NOISE = new Set(['термин', 'определен', 'определ', 'означа', 'понят', 'понятие', 'смысл', 'значен'])
export const termTerms = (terms: Set<string>): Set<string> => {
  const out = new Set([...terms].filter((t) => !Q_NOISE.has(t)))
  return out.size ? out : terms
}

export function definitionFor(map: CurriculumMap, allTerms: Set<string>, grade: number | null): DefHit | null {
  const terms = termTerms(allTerms)
  if (!terms.size) return null
  let best: DefHit | null = null
  let bestKey = -Infinity
  for (const u of map.units) {
    u.definitions.forEach((d, index) => {
      const tt = stemsOf(d)
      if (!tt.length) return
      const hit = tt.filter((t) => terms.has(t)).length
      if (!hit) return
      const termCov = hit / tt.length
      const qCov = hit / terms.size
      // термин целиком в вопросе (и вопрос не шире вдвое) или вопрос целиком в чуть более длинном термине;
      // «водородная связь» ≠ «химическая связь» (по половине с каждой стороны — другое понятие)
      if (!((termCov === 1 && qCov >= 0.5) || (qCov === 1 && termCov >= 0.66))) return
      const inGrade = grade == null || u.grade === grade
      let key = termCov + qCov + (termCov === 1 && qCov === 1 ? 1 : 0)
      key += inGrade ? 2 : -0.1 * Math.abs(u.grade - (grade ?? u.grade))
      if (d.source === 'textbook') key += 0.05 // строка учебника точнее банка вопросов
      key -= orderOf(map, u) * 1e-5 // при равенстве — раньше в книге
      if (key > bestKey) {
        bestKey = key
        best = { unit: u, def: d, index, termCov, qCov, inGrade }
      }
    })
  }
  return best
}

const conceptStems = new WeakMap<object, string[]>()
const cStemsOf = (c: Unit['concepts'][number]) => {
  let s = conceptStems.get(c)
  if (!s) conceptStems.set(c, (s = [...new Set(analyzeTerms(c.ru))]))
  return s
}

/**
 * Единица класса ученика, где понятие вопроса стоит в «Изучаемых понятиях» (все стемы понятия — в вопросе и понятие
 * покрывает не меньше половины вопроса); точное совпадение — первым, затем раньше в книге. Нет класса — null.
 */
export function conceptUnitFor(map: CurriculumMap, allTerms: Set<string>, grade: number | null): Unit | null {
  const terms = termTerms(allTerms)
  if (grade == null || !terms.size) return null
  let best: Unit | null = null
  let bestKey = -Infinity
  for (const u of map.byGrade.get(grade) ?? []) {
    if (u.kind === 'review') continue
    for (const c of u.concepts) {
      const cs = cStemsOf(c)
      if (!cs.length || !cs.every((t) => terms.has(t))) continue
      const qCov = cs.length / terms.size
      if (qCov < 0.5) continue
      const key = qCov + (u.kind === 'paragraph' ? 0.1 : 0) - orderOf(map, u) * 1e-5
      if (key > bestKey) {
        bestKey = key
        best = u
      }
    }
  }
  return best
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е')
/** Темы вопроса по правилам topicMap (все сработавшие, а не только первое). */
export function topicsOf(text: string): string[] {
  const t = norm(text)
  return [...new Set(RULES.filter((r) => r.re.test(t)).map((r) => r.topic))]
}

/**
 * § класса ученика по теме вопроса («почему металлы проводят ток» → § о металлах этого класса): совпавшие темы карты
 * (topics единицы) + доля термов вопроса в названии/понятиях. null — в классе нет единицы ни по теме, ни по понятиям.
 */
export function unitForTopic(map: CurriculumMap, text: string, terms: Set<string>, grade: number | null, extra = ''): Unit | null {
  if (grade == null) return null
  const units = map.byGrade.get(grade) ?? []
  // темы самого вопроса весят вдвое больше тем из пояснения понятий (extra)
  // + русские стемы вопроса (у uz/en — перевод KbEngine.analyzeQuery): правила тем в основном на русских корнях
  const own = new Set(topicsOf(`${text} ${[...terms].join(' ')}`))
  const topics = new Set([...own, ...topicsOf(extra)])
  const byQuery = new Map(map.unitsForQuery(terms, grade).map((x) => [x.unit.id, x.score]))
  let best: Unit | null = null
  let bestKey = 0
  for (const u of units) {
    if (u.kind === 'review') continue
    const tHit = u.topics.filter((t) => topics.has(t)).length + u.topics.filter((t) => own.has(t)).length
    const q = byQuery.get(u.id) ?? 0
    const key = (tHit ? 1 + 0.2 * tHit : 0) + q - orderOf(map, u) * 1e-5
    if ((tHit || q >= 0.5) && key > bestKey) {
      bestKey = key
      best = u
    }
  }
  return best
}

/** Подпись единицы со страницей: «[Kimyo 8, §12, стр. 50]». */
export function unitCite(u: Unit, page?: number | null): string {
  const p = page ?? u.pages.start
  return p ? `${u.cite.slice(0, -1)}, стр. ${p}]` : u.cite
}

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/u, '') + '…')
const PAGES: Record<Lang, (a: number, b: number) => string> = {
  ru: (a, b) => (a === b || !b ? `стр. ${a}` : `стр. ${a}–${b}`),
  uz: (a, b) => (a === b || !b ? `${a}-bet` : `${a}–${b}-betlar`),
  en: (a, b) => (a === b || !b ? `p. ${a}` : `pp. ${a}–${b}`),
}
/** Название единицы на языке вопроса; узбекского нет (uzSource 'ru') — null, чтобы не вставлять русский текст. */
function titleOf(u: Unit, lang: Lang): string | null {
  if (lang === 'ru') return u.title.ru
  if (lang === 'uz') return u.title.uzSource === 'ru' || /[а-яё]/iu.test(u.title.uz) ? null : u.title.uz
  return /[а-яё]/iu.test(u.title.en) ? null : u.title.en
}
function conceptsOf(u: Unit, lang: Lang, n: number): string[] {
  const xs = u.concepts.map((c) => (lang === 'ru' ? c.ru : c[lang])).filter((x): x is string => !!x && (lang === 'ru' || !/[а-яё]/iu.test(x)))
  return [...new Set(xs)].slice(0, n)
}

/** «О чём §12?» — содержание единицы на языке вопроса. */
export function sectionAnswer(u: Unit, lang: Lang): string {
  const title = titleOf(u, lang)
  const pages = u.pages.start ? PAGES[lang](u.pages.start, u.pages.end) : ''
  const concepts = conceptsOf(u, lang, 6)
  const rx = u.reactions.filter((r) => !r.isGeneral).slice(0, 2).map((r) => r.eq)
  const out: string[] = []
  if (lang === 'ru') {
    out.push(`${u.label.ru} — «${title}»${pages ? ` (${pages})` : ''}.`)
    if (concepts.length) out.push(`Что изучают: ${concepts.join(', ')}.`)
    const d = u.definitions.find((x) => x.source === 'textbook') ?? u.definitions[0]
    if (d) out.push(`Главное определение: ${clip(d.text.ru.replace(/\.$/, ''), 220)}.`)
    if (rx.length) out.push(`Реакции параграфа: ${rx.join('; ')}.`)
    if (u.tasks.examples.length || u.tasks.exercises.length) out.push('В конце — задачи и упражнения по теме.')
  } else if (lang === 'uz') {
    const chapter = /[а-яё]/iu.test(u.chapter.title.uz) ? null : u.chapter.title.uz
    out.push(`${u.label.uz}${title ? ` — «${title}»` : ''}${pages ? ` (${pages})` : ''}.`)
    if (chapter) out.push(`Bu «${chapter}» bobidagi mavzu.`)
    if (concepts.length) out.push(`Unda oʻrganiladigan tushunchalar: ${concepts.join(', ')}.`)
    else out.push('Unda mavzuning asosiy tushunchalari, taʼriflari va misollari beriladi.')
    if (rx.length) out.push(`Reaksiyalar: ${rx.join('; ')}.`)
    if (u.tasks.examples.length || u.tasks.exercises.length) out.push('Oxirida mavzu boʻyicha masala va mashqlar bor.')
  } else {
    const chapter = /[а-яё]/iu.test(u.chapter.title.en) ? null : u.chapter.title.en
    out.push(`${u.label.en}${title ? ` — “${title}”` : ''}${pages ? ` (${pages})` : ''}.`)
    if (chapter) out.push(`It is part of the chapter “${chapter}”.`)
    if (concepts.length) out.push(`Key concepts: ${concepts.join(', ')}.`)
    else out.push('It gives the main concepts, definitions and examples of the topic.')
    if (rx.length) out.push(`Reactions: ${rx.join('; ')}.`)
    if (u.tasks.examples.length || u.tasks.exercises.length) out.push('It ends with problems and exercises on the topic.')
  }
  return out.join(' ')
}

const UZ_Q_TAIL = /\s*(?:deb\s+nimaga\s+aytiladi|degani\s+nima|nimani\s+anglatadi|nima)\s*\??\s*$/iu
const EN_Q_HEAD = /^\s*(?:what\s+(?:is|are|does)\s+(?:an?\s+|the\s+)?|define\s+|definition\s+of\s+)/iu
/** Термин из вопроса «X nima?» / «What is X?» (как написал ученик). */
export function termOfQuestion(text: string, lang: Lang): string | null {
  const t = text.trim().replace(/[«»“”"]/g, '')
  const term = lang === 'uz' ? t.replace(UZ_Q_TAIL, '') : lang === 'en' ? t.replace(EN_Q_HEAD, '').replace(/\s*(?:mean)?\s*[?.!]\s*$/u, '') : t
  return term && term !== t && term.length <= 60 ? term.trim() : null
}

const RU_Q_HEAD = /^\s*(?:что\s+такое|что\s+означает\s+(?:термин|понятие)|дай(?:те)?\s+определение\s*:?|определение\s*:)\s*/iu
/** Термин вопроса-определения на любом языке («Что такое история химии?» → «история химии»). */
export function questionTerm(text: string, lang: Lang): string | null {
  if (lang !== 'ru') return termOfQuestion(text, lang)
  const t = text.trim().replace(/[«»“”"]/g, '')
  const term = t.replace(RU_Q_HEAD, '').replace(/\s*[?.!]\s*$/u, '')
  return term && term !== t.replace(/\s*[?.!]\s*$/u, '') && term.length <= 60 ? term.trim() : null
}

const foldName = (s: string) => norm(s).replace(/[ʻʼ‘’`´']/g, "'").replace(/\s+/g, ' ').trim()

/** Термин для сравнения: регистр, апострофы, кавычки; «X va Y» / «X and Y» ≡ «X, Y»; мн. число последнего слова (-lar, -s). */
function foldTermName(s: string, lang: Lang): string {
  const t = foldName(s.replace(/[«»“”"]/g, ' ')).replace(/\s+(?:va|and)\s+/g, ', ')
  const plural = lang === 'uz' ? /(\p{L}{3,})(?:lar|ler)$/u : /(\p{L}{3,}?)(?:es|s)$/u
  return t
    .split(/\s*,\s*/)
    .map((p) => p.replace(plural, '$1'))
    .join(', ')
}
/** Буква подуровня в начале термина: «s-электроны», «P электронами», «S-орбиталью» (кириллическая «р» = p). */
const SUBLEVEL_RE = /^([spdfр])(?:\s*[-‐–]\s*|\s+)(?=\p{L}{3})/iu
const sublevelOf = (s: string): { letter: string; stems: string } | null => {
  const t = s.trim()
  const m = SUBLEVEL_RE.exec(t)
  if (!m) return null
  const rest = t.slice(m[0].length).split(/\s*[,;]\s*|\s+и\s+/u)[0]!
  const stems = [...new Set(analyzeTerms(rest))].sort().join(' ')
  return stems ? { letter: m[1]!.toLowerCase().replace('р', 'p'), stems } : null
}
/**
 * ru: «Что такое s-электроны?» — стемы букву подуровня не видят («s-электроны» ≡ «электрон»), и вопрос уходил к
 * определению электрона (§7) вместо «Электроны на этом уровне называются s электронами» (§10, 12.10). Термин с буквой
 * подуровня — определение класса с той же буквой и теми же стемами; иначе null (работает поиск по стемам).
 */
function definitionBySublevel(map: CurriculumMap, text: string, grade: number): DefHit | null {
  const term = questionTerm(text, 'ru')
  const q = term ? sublevelOf(term) : null
  if (!q) return null
  for (const u of map.byGrade.get(grade) ?? []) {
    if (u.kind === 'review') continue
    const index = u.definitions.findIndex((d) => {
      const s = sublevelOf(d.term.ru)
      return !!s && s.letter === q.letter && s.stems === q.stems
    })
    if (index >= 0) return { unit: u, def: u.definitions[index]!, index, termCov: 1, qCov: 1, inGrade: true }
  }
  return null
}
const termNames = new WeakMap<UnitDefinition, { uz: string[]; en: string[] }>()
function namesOf(d: UnitDefinition): { uz: string[]; en: string[] } {
  let n = termNames.get(d)
  if (!n) {
    const of = (x: string | undefined, lang: 'uz' | 'en') => {
      if (!x || /[а-яё]/iu.test(x)) return []
      const whole = foldTermName(x, lang)
      const parts = whole.split(', ')
      return parts.length > 1 ? [whole, ...parts] : [whole]
    }
    termNames.set(d, (n = { uz: of(d.term.uz, 'uz'), en: of(d.term.en, 'en') }))
  }
  return n
}

/**
 * uz/en: определение § по термину вопроса на его языке («Sintez nima?», «Vinil radikali deb nimaga aytiladi?») —
 * термин совпал с узбекским/английским термином определения карты (definitions[].term.uz/en: перевод учебного термина
 * по brain/persona/uzGlossary.ts). Русские стемы перевода («vinil radikali» → «винильный радикал» → «радика») не всегда
 * совпадают со стемами термина, как он напечатан в книге («винильным радикалом» → «радикал»), и вопрос уходил к чужому §.
 * Только класс ученика (раньше в книге — первым); иначе null — работает поиск по русским стемам (definitionFor).
 */
export function definitionByTerm(map: CurriculumMap, text: string, lang: Lang, grade: number | null): DefHit | null {
  if (grade == null) return null
  if (lang === 'ru') return definitionBySublevel(map, text, grade)
  const term = termOfQuestion(text, lang)
  if (!term) return null
  const k = foldTermName(term, lang)
  if (!k) return null
  for (const u of map.byGrade.get(grade) ?? []) {
    if (u.kind === 'review') continue
    const index = u.definitions.findIndex((d) => namesOf(d)[lang].includes(k))
    if (index >= 0) return { unit: u, def: u.definitions[index]!, index, termCov: 1, qCov: 1, inGrade: true }
  }
  return null
}
/**
 * Понятие § по названию на языке вопроса: термин вопроса совпадает с понятием карты (у понятий есть uz/en-названия:
 * «kimyo tarixi», «history of chemistry») или с названием единицы — § класса ученика, раньше в книге первым.
 */
export function conceptUnitByName(map: CurriculumMap, text: string, lang: Lang, grade: number | null): Unit | null {
  if (grade == null) return null
  const term = questionTerm(text, lang)
  if (!term) return null
  const k = foldName(term)
  for (const u of map.byGrade.get(grade) ?? []) {
    if (u.kind === 'review') continue
    const names = [...u.concepts.map((c) => (lang === 'ru' ? c.ru : c[lang])), lang === 'ru' ? u.title.ru : lang === 'uz' && u.title.uzSource !== 'ru' ? u.title.uz : lang === 'en' ? u.title.en : undefined]
    if (names.some((n) => !!n && foldName(n) === k)) return u
  }
  return null
}

/**
 * uz/en: определение § по-русски, перевода нет — рамка на языке вопроса: термин (как в вопросе), где его изучают
 * (§ и название), связанные понятия §. Не выдумывает содержание определения.
 */
export function termFrameUzEn(term: string, u: Unit, lang: 'uz' | 'en'): string {
  const T = term.charAt(0).toUpperCase() + term.slice(1)
  const title = titleOf(u, lang)
  const near = conceptsOf(u, lang, 5).filter((c) => norm(c) !== norm(term))
  // факты § на языке вопроса: законы (uz/en-название из карты), вещества с узбекским названием и формулой, реакция §
  // «Avogadro's law» → «Avogadro law»: апостроф после o/g проверка языка читает как узбекский (oʻ, gʻ)
  const laws = u.laws
    .map((l) => l.name[lang]?.replace(/(\p{L})['’]s\b/gu, '$1'))
    .filter((x): x is string => !!x && !/[а-яё]/iu.test(x))
    .filter((x, i, a) => a.indexOf(x) === i)
    .slice(0, 2)
  const subs = lang === 'uz' ? u.substances.filter((x) => x.role === 'studied' && x.nameUz && !/[а-яё]/iu.test(x.nameUz)).slice(0, 3).map((x) => `${x.nameUz} (${x.formula})`) : []
  const rx = u.reactions.find((r) => !r.isGeneral)?.eq
  if (lang === 'uz') {
    let s = `«${T}» — ${u.label.uz}${title ? ` («${title}»)` : ''} mavzusida oʻrganiladigan tushuncha.`
    if (near.length) s += ` U bilan bogʻliq tushunchalar: ${near.join(', ')}.`
    if (laws.length) s += ` Mavzudagi qonunlar: ${laws.join(', ')}.`
    if (subs.length) s += ` Misollar: ${subs.join(', ')}.`
    if (rx) s += ` Reaksiya: ${rx}.`
    return s
  }
  let s = `“${T}” is a concept studied in ${u.label.en}${title ? ` (“${title}”)` : ''}.`
  if (near.length) s += ` Related concepts: ${near.join(', ')}.`
  if (laws.length) s += ` Laws of the topic: ${laws.join(', ')}.`
  if (rx) s += ` Reaction: ${rx}.`
  return s
}
