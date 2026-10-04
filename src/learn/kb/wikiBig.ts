/**
 * Большая энциклопедия учителя (wf16): десятки тысяч вступлений статей русской Википедии (CC BY-SA 4.0) —
 * химия за пределами школы, биология и человек, медицина и питание, физика, Земля и экология, астрономия,
 * быт и безопасность, история науки, учёные мира и Узбекистана.
 *
 * Данные НЕ в бандле: public/kb/wiki/ (scripts/teacher-ml/wiki-big-build.mts), грузятся по требованию:
 *   meta.json  — заголовки (один раз, при первом вопросе к энциклопедии);
 *   i/<k>.json — кусок обратного индекса по первой букве термина (только буквы слов вопроса);
 *   s/<n>.json — шард текстов (только тот, где лежит найденная статья).
 * Всё кешируется в памяти (и в Cache API браузера, если он есть) — второй вопрос не ходит в сеть.
 * Ни одного исключения наружу: при сбое сети — пустой результат (учитель ответит из своих баз).
 */
import { analyzeTerms } from './analyzer'
import type { KbHit } from './types'

export type WikiBigMeta = { v: number; n: number; shards: number; keys: string[]; titles: string[]; tags: string; license: string; source: string }
type IndexShard = { T: Record<string, number[]>; A: Record<string, number[]>; K: Record<string, number[]> }
export type WikiBigLoader = (rel: string) => Promise<unknown>

export type WikiBigHit = KbHit & {
  /** Номер статьи в базе. */
  doc: number
  /** Похожие статьи с тем же названием («Меркурий (планета)» / «Меркурий (мифология)») — для уточняющего вопроса. */
  alts?: string[]
}

const CACHE_NAME = 'atomlab-kb-wiki-v1'

function baseUrl(): string {
  try {
    const b = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL
    return b ?? '/'
  } catch {
    return '/'
  }
}

/** Загрузка по умолчанию: fetch из public/kb/wiki/ (+ Cache API, если доступен). */
const defaultLoader: WikiBigLoader = async (rel) => {
  const url = `${baseUrl()}kb/wiki/${rel}`
  const caches_ = (globalThis as { caches?: CacheStorage }).caches
  if (caches_) {
    try {
      const cache = await caches_.open(CACHE_NAME)
      const hit = await cache.match(url)
      if (hit) return await hit.json()
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      void cache.put(url, res.clone()).catch(() => undefined)
      return await res.json()
    } catch {
      /* Cache API недоступен (file://, приватный режим) — обычный fetch */
    }
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.json()
}

let loader: WikiBigLoader = defaultLoader
const memo = new Map<string, Promise<unknown>>()

/** Тесты (node): читать файлы с диска вместо fetch. */
export function setWikiBigLoader(fn: WikiBigLoader): void {
  loader = fn
  memo.clear()
  metaPromise = null
}

function load<T>(rel: string): Promise<T> {
  let p = memo.get(rel)
  if (!p) {
    p = loader(rel).catch((e) => {
      memo.delete(rel) // сбой сети — в следующий раз попробуем снова
      throw e
    })
    memo.set(rel, p)
  }
  return p as Promise<T>
}

let metaPromise: Promise<WikiBigMeta | null> | null = null
export function loadWikiBigMeta(): Promise<WikiBigMeta | null> {
  if (!metaPromise) {
    metaPromise = load<WikiBigMeta>('meta.json').catch(() => {
      metaPromise = null
      return null
    })
  }
  return metaPromise
}

/** Слова вопроса, которые не несут темы («как работает», «кто открыл», «почему»). */
const QUERY_NOISE = new Set(
  analyzeTerms(
    'кто такой такая такие что это такое расскажи расскажите про о об объясни почему зачем как работает работают устроен устроена ' +
      'делают производят получают происходит бывает нужен нужна нужно нужны открыл открыла изобрел изобрела придумал создал ' +
      'был была были жил жила знаешь знаете скажи вообще коротко подробно интересного интересное значит означает мне нам ' +
      'вопрос ответ учитель пожалуйста можно ли где когда сколько какой какая какие каков чем отличается',
  ),
)

/** Частые вопросы «почему…», у которых ответ — статья с другим названием. */
const PHRASE_TITLES: { re: RegExp; title: string }[] = [
  { re: /неб[а-яё]*\s+(голуб|син)|(голуб|син)[а-яё]*\s+неб/i, title: 'Рэлеевское рассеяние' },
  { re: /(закат|рассвет)[а-яё]*\s+(красн|оранж)|(красн|оранж)[а-яё]*\s+(закат|рассвет)/i, title: 'Рэлеевское рассеяние' },
  { re: /почему\s+(трава|листья|растения)\s+зел[её]н/i, title: 'Хлорофилл' },
  { re: /почему\s+кровь\s+красн/i, title: 'Гемоглобин' },
  { re: /как\s+работает\s+вакцин|прививк/i, title: 'Вакцина' },
  { re: /почему\s+море\s+сол[её]н/i, title: 'Морская вода' },
  { re: /откуда\s+(берется|берётся)\s+радуга|почему\s+бывает\s+радуга/i, title: 'Радуга' },
  { re: /почему\s+(идет|идёт)\s+дождь/i, title: 'Дождь' },
  { re: /почему\s+железо\s+ржавеет/i, title: 'Ржавчина' },
]

function norm(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е')
}
const baseTitle = (t: string) => t.replace(/\s*\([^)]*\)\s*$/, '').trim()

const keyOf = (term: string) => term.codePointAt(0)!.toString(36)

/**
 * Поиск по большой энциклопедии: лучшие статьи с текстом (лучшая — с похожими по названию, если есть).
 * Только русские статьи; вопрос на en/uz — с добавленными русскими терминами (это делает вызывающий код).
 */
export async function searchWikiBig(query: string, opts: { limit?: number } = {}): Promise<WikiBigHit[]> {
  try {
    const meta = await loadWikiBigMeta()
    if (!meta?.n) return []
    const limit = opts.limit ?? 3
    const qTerms = [...new Set(analyzeTerms(query, { query: true }))].filter((t) => !QUERY_NOISE.has(t))
    const forced = PHRASE_TITLES.find((p) => p.re.test(query))
    const forcedDoc = forced ? meta.titles.indexOf(forced.title) : -1
    if (!qTerms.length && forcedDoc < 0) return []
    const keys = [...new Set(qTerms.map(keyOf))].filter((k) => meta.keys.includes(k))
    const shards = await Promise.all(keys.map((k) => load<IndexShard>(`i/${k}.json`).catch(() => null)))
    const byKey = new Map(keys.map((k, i) => [k, shards[i]]))
    const scores = new Map<number, number>()
    const titleMatched = new Map<number, number>()
    for (const t of qTerms) {
      const sh = byKey.get(keyOf(t))
      if (!sh) continue
      const T = sh.T[t] ?? []
      const A = sh.A[t] ?? []
      const K = sh.K[t] ?? []
      const df = T.length + A.length + K.length
      if (!df) continue
      const idf = Math.log(1 + meta.n / df)
      for (const d of T) {
        scores.set(d, (scores.get(d) ?? 0) + 4 * idf)
        titleMatched.set(d, (titleMatched.get(d) ?? 0) + 1)
      }
      for (const d of A) scores.set(d, (scores.get(d) ?? 0) + 2.5 * idf)
      for (const d of K) scores.set(d, (scores.get(d) ?? 0) + 1 * idf)
    }
    if (forcedDoc >= 0) scores.set(forcedDoc, (scores.get(forcedDoc) ?? 0) + 100)
    if (!scores.size) return []
    // уточнение по заголовку: все слова заголовка есть в вопросе — бонус; лишние слова заголовка — штраф
    const prelim = [...scores].sort((a, b) => b[1] - a[1]).slice(0, 60)
    const qSet = new Set(qTerms)
    const ranked = prelim
      .map(([d, s]) => {
        const title = meta.titles[d]!
        const tTerms = [...new Set(analyzeTerms(baseTitle(title)))]
        const matched = tTerms.filter((t) => qSet.has(t)).length
        const extra = tTerms.length - matched
        let score = s
        if (tTerms.length && matched === tTerms.length) score += 6 + 2 * matched
        score -= 1.5 * extra
        if (meta.tags[d] === 'k') score += 1.5
        if (/\(значения\)/.test(title)) score -= 20
        return { d, score, matched, full: tTerms.length > 0 && matched === tTerms.length }
      })
      .sort((a, b) => b.score - a.score)
    const best = ranked[0]
    if (!best) return []
    // слишком слабое совпадение (ни одного слова заголовка и мало ключевых слов) — честно «не знаю»
    if (!best.full && best.matched === 0 && best.score < 6 && best.d !== forcedDoc) return []
    const top = ranked.slice(0, limit)
    const texts = await Promise.all(
      top.map(async ({ d }) => {
        const arr = await load<string[]>(`s/${d % meta.shards}.json`).catch(() => null)
        return arr?.[Math.floor(d / meta.shards)] ?? null
      }),
    )
    const bestBase = norm(baseTitle(meta.titles[best.d]!))
    const alts = ranked
      .slice(1, 8)
      .filter((r) => r.score >= best.score * 0.6 && norm(baseTitle(meta.titles[r.d]!)) === bestBase)
      .map((r) => meta.titles[r.d]!)
    const out: WikiBigHit[] = []
    top.forEach(({ d, score }, i) => {
      const text = texts[i]
      if (!text) return
      out.push({
        id: `wb-${d}`,
        doc: d,
        grade: null,
        title: meta.titles[d]!,
        type: 'encyclopedia',
        lang: 'ru',
        text,
        source: 'Википедия (CC BY-SA 4.0)',
        score,
        ...(i === 0 && alts.length ? { alts } : {}),
      })
    })
    return out
  } catch {
    return []
  }
}

/** Смысловые слова вопроса (без «что такое», «кто открыл», «как работает»). */
export function queryContentTerms(query: string): string[] {
  return [...new Set(analyzeTerms(query, { query: true }))].filter((t) => !QUERY_NOISE.has(t))
}

/**
 * Доля смысловых слов вопроса, которые есть в названии статьи или в других её названиях (начало первой фразы):
 * 1 — статья ровно о том, что спросили («кто такой Иван Павлов» → «Павлов, Иван Петрович»).
 * Вопросы из таблицы «почему небо голубое → Рэлеевское рассеяние» — тоже 1.
 */
export function wikiQueryCoverage(hit: { title: string; text: string; score?: number }, query: string): number {
  if ((hit.score ?? 0) >= 90) return 1
  const q = queryContentTerms(query)
  if (!q.length) return 0
  const head = hit.text.split(/\s[—–]\s/)[0]!.slice(0, 200)
  const have = new Set(analyzeTerms(`${hit.title} ${head}`))
  return q.filter((t) => have.has(t)).length / q.length
}

/**
 * Статья ровно о теме вопроса: из таблицы «почему…»; или все слова названия есть в вопросе, а все смысловые слова
 * вопроса — в названии/первой фразе; или учёный «Фамилия, Имя Отчество», когда в вопросе фамилия и все слова вопроса
 * есть в названии. «что такое кислоты» → «Дезоксирибонуклеиновая кислота» — НЕ ровно о теме.
 */
export function wikiExactTopic(hit: { title: string; text: string; score?: number }, query: string): boolean {
  if ((hit.score ?? 0) >= 90) return true
  if (wikiQueryCoverage(hit, query) < 0.99) return false
  const q = new Set(queryContentTerms(query))
  const title = baseTitle(hit.title)
  const person = title.match(/^([^,]+),\s+\S/)
  if (person) {
    const surname = analyzeTerms(person[1]!)
    return surname.length > 0 && surname.every((t) => q.has(t))
  }
  const t = analyzeTerms(title).filter((w) => !GENERIC_TITLE_TERMS.has(w))
  return t.length > 0 && t.every((w) => q.has(w))
}

/** Слова названия, которые ученик обычно не говорит: «почки» → «Почка человека». */
const GENERIC_TITLE_TERMS = new Set(analyzeTerms('человека человек организма земли'))

/** Совпадает ли заголовок статьи с темой вопроса (все слова заголовка — в вопросе). */
export function wikiTitleCovered(title: string, query: string): boolean {
  const q = new Set(analyzeTerms(query, { query: true }))
  const t = analyzeTerms(baseTitle(title))
  return t.length > 0 && t.every((w) => q.has(w))
}
