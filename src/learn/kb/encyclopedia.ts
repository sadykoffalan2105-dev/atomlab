/**
 * Энциклопедия (wf15): когда к школьному поиску подключать шард Википедии (CC BY-SA 4.0) и как искать в нём.
 *
 * Шард «wiki-a/wiki-b» (type 'encyclopedia') не участвует в обычном поиске — школьные учебники приоритетнее.
 * Он подгружается лениво и ищется, когда:
 *   (а) вопрос «за пределами школы»: «кто такой…», «кто открыл…», «история…», «нобелевск…», «в промышленности»,
 *       «в быту», «биография», «учёный/химик», who is / who discovered / tell me about, kim / kashf etgan / haqida;
 *   (б) в вопросе есть фамилия учёного из src/data/teacher/scientistsIndex.json (строится вместе с корпусом);
 *   (в) школьные результаты слабые (пусто или лучший балл ниже порога).
 * Фрагменты энциклопедии добавляются ПОСЛЕ школьных: при равных оценках учебник важнее.
 */
import type { KbHit, KbLang, KbSearchOptions } from './types'

export type ScientistEntry = {
  id: string
  title: string
  surname: string
  variants: string[]
  years?: string
  where?: string
  known?: string
}

type KbApi = {
  searchKnowledge: (query: string, opts?: KbSearchOptions) => Promise<KbHit[]>
  getChunksById: (ids: readonly string[]) => KbHit[]
  preloadEncyclopedia?: () => Promise<void>
}

/** Сильное намерение: ответ из энциклопедии важнее школьного пересказа (учёные, история, премии, промышленность, быт). */
const STRONG_RE =
  /(?<![а-яa-z])(кто\s+так(ой|ая|ие)|кто\s+((его|её|ее|их|это|же)\s+)?(открыл|изобрел|придумал|создал|получил\s+нобел|разработал|основал|предложил|первым)|когда\s+(открыли|открыт|изобрели|был[аи]?\s+открыт)|биографи|жизн[ьи]\s+и\s+(деятельност|творчеств)|учен(ый|ая|ые|ого|ым)(?![а-я])|химик(а|и|ов|е|ом)?(?![а-я])|нобелевск|лауреат|истори[яи]\s+(химии|открыти|создани|развити|производств)|в\s+промышленност|промышленн(ое|ый|ым)\s+(способ|производств|получени)|в\s+быту|в\s+повседневной|узбекистан|who\s+(is|was|were|discovered|invented|created|founded|proposed)|tell\s+me\s+about\s+(the\s+)?(scientist|chemist|history|discovery|life)|nobel|biograph|history\s+of|in\s+industry|industrial\s+(production|process)|kim\s+(edi|bo'lgan|bo‘lgan|bolgan|u)(?![a-z])|kim\s*\??\s*$|kashf\s+(etgan|qilgan)|ixtiro\s+(qilgan|etgan)|olim(lar)?(?![a-z])|kimyogar|tarixi|sanoatda)/iu

/** Мягкое намерение: только добавить фрагменты энциклопедии (школьный ответ, если он уверенный, остаётся). */
const SOFT_RE =
  /(?<![а-яa-z])(расскажи(те)?\s+(мне\s+)?(о|об|про)\s|что\s+ты\s+знаешь\s+(о|об|про)\s|истори|открыти|зачем\s+нуж(ен|на|но|ны)|где\s+(применя|использу)|для\s+чего\s+(нужен|нужна|нужно|используют|применяют)|как\s+(делают|производят|получают)\s+.*(на\s+заводе|в\s+промышленност)|экологи|озонов|парников|кислотн\w+\s+дожд|переработк|аккумулятор|батаре|tell\s+me\s+about|what\s+do\s+you\s+know\s+about|why\s+do\s+we\s+need|where\s+is\s+.*\s+used|haqida|nima\s+uchun\s+kerak|qayerda\s+ishlatiladi)/iu

export function wantsEncyclopedia(query: string, _locale?: KbLang): 'strong' | 'soft' | null {
  const q = query.replace(/ё/g, 'е')
  if (STRONG_RE.test(q)) return 'strong'
  if (SOFT_RE.test(q)) return 'soft'
  return null
}

/**
 * Намерение с учётом словаря учёных: «расскажи о Лавуазье» (мягкое намерение + фамилия) — сильное:
 * статья энциклопедии важнее короткой школьной карточки.
 */
export async function encyclopediaIntent(query: string, locale?: KbLang): Promise<'strong' | 'soft' | null> {
  const base = wantsEncyclopedia(query, locale)
  if (base === 'strong' || isMarkedStrong(query)) return 'strong'
  const scientists = await findScientists(query)
  if (scientists.length && (base === 'soft' || query.trim().split(/\s+/).length <= 4)) return 'strong'
  return base
}

/** Прямой поиск по энциклопедии (запасной путь роутера, когда школьный ответ не уверенный, а фрагментов энциклопедии нет). */
export async function encyclopediaFallbackHits(query: string, locale: KbLang): Promise<KbHit[]> {
  try {
    const kb = await import('./index')
    let q = query
    if (locale !== 'ru') {
      // статьи русские: к вопросу на en/uz добавляем русские термины глоссария (как в teacherKnowledge)
      const { ruQueryTerms } = await import('./localeSupport')
      const terms = await ruQueryTerms(query, locale).catch(() => [] as string[])
      if (terms.length) q = `${query} ${terms.join(' ')}`
    }
    const hits = await encyclopediaHitsFor(kb, q, { locale }, [])
    if (hits.length) return hits
    // wf16: в малой энциклопедии пусто (вопрос без «кто такой…») — ищем в большой
    return await bigWikiHits(q)
  } catch {
    return []
  }
}

let scientistsPromise: Promise<ScientistEntry[]> | null = null
let variantIndex: Map<string, ScientistEntry[]> | null = null

/** Словарь учёных (маленький JSON, грузится один раз, лениво). */
export function loadScientists(): Promise<ScientistEntry[]> {
  if (!scientistsPromise) {
    scientistsPromise = import('../../data/teacher/scientistsIndex.json')
      .then((m) => {
        const list = ((m as { default?: { scientists?: ScientistEntry[] } }).default?.scientists ?? []) as ScientistEntry[]
        variantIndex = new Map()
        for (const s of list) {
          for (const v of s.variants) {
            if (v.length < 4) continue // «Бор», «Ли» — слишком похоже на обычные слова и элементы
            const key = v.toLowerCase().replace(/ё/g, 'е')
            const arr = variantIndex.get(key) ?? []
            arr.push(s)
            variantIndex.set(key, arr)
          }
        }
        return list
      })
      .catch(() => {
        variantIndex = new Map()
        return [] as ScientistEntry[]
      })
  }
  return scientistsPromise
}

/** Слова вопроса, с грубым снятием падежных окончаний: «Менделеева» → «менделеев». */
function wordForms(word: string): string[] {
  const w = word.toLowerCase().replace(/ё/g, 'е').replace(/['‘’]/g, '')
  const out = [w]
  // узбекская/английская латиница: Mendeleyev → mendeleev, Lomonosov, Kyuri; -iy → -i
  const lat = w.replace(/yev$/, 'ev').replace(/yov$/, 'ov').replace(/iy$/, 'i').replace(/kh/g, 'h')
  if (lat !== w) out.push(lat, lat.replace(/h/g, 'kh'))
  if (/[а-я]$/.test(w) && w.length >= 5) {
    out.push(w.slice(0, -1))
    if (w.length >= 6) out.push(w.slice(0, -2))
    if (/ым|ом|ем|ой|ей|ую|ых|их|ами|ями$/.test(w) && w.length >= 7) out.push(w.slice(0, -3))
  }
  if (/(ning|dagi|dan|ga|ni|da|ov|ev|ova|eva)$/.test(w) && w.length >= 6) out.push(w.replace(/(ning|dagi|dan|ga|ni|da)$/, ''))
  return out
}

/** Учёные, чьи фамилии встречаются в вопросе (по словарю, без выдумок). */
export async function findScientists(query: string): Promise<ScientistEntry[]> {
  await loadScientists()
  if (!variantIndex?.size) return []
  const found: ScientistEntry[] = []
  const seen = new Set<string>()
  for (const word of query.match(/[A-Za-zА-Яа-яЁё'‘’-]{4,}/gu) ?? []) {
    for (const f of wordForms(word)) {
      for (const s of variantIndex.get(f) ?? []) {
        if (seen.has(s.id)) continue
        seen.add(s.id)
        found.push(s)
      }
      if (found.length >= 3) return found
    }
  }
  return found
}

/** Порог «школьные результаты слабые»: BM25F-балл лучшего школьного фрагмента (калибровано на kb:eval). */
export const WEAK_SCHOOL_SCORE = 7

export function isWeakSchoolResult(hits: readonly { score?: number }[]): boolean {
  return hits.length === 0 || (hits[0]?.score ?? 0) < WEAK_SCHOOL_SCORE
}

/**
 * Фрагменты энциклопедии для вопроса (или пусто, если энциклопедия не нужна). Статья найденного учёного — первой.
 * Никогда не бросает исключение.
 */
export async function encyclopediaHitsFor(
  kb: KbApi,
  query: string,
  ctx: { locale: KbLang; limit?: number },
  schoolHits: readonly { score?: number; title?: string; text?: string }[],
): Promise<KbHit[]> {
  try {
    const intent = wantsEncyclopedia(query, ctx.locale)
    const scientists = await findScientists(query)
    // wf16: учебник «нашёл» что-то, но не про то («закон всемирного тяготения» → периодический закон)
    const schoolMisses = ctx.locale === 'ru' && (await schoolMissesTopic(query, schoolHits))
    if (!intent && !scientists.length && !isWeakSchoolResult(schoolHits) && !schoolMisses) return []
    const limit = ctx.limit ?? 4
    const out: KbHit[] = []
    const seen = new Set<string>()
    const push = (h: KbHit) => {
      if (seen.has(h.id)) return
      seen.add(h.id)
      out.push(h)
    }
    const wiki = await kb.searchKnowledge(`${query}${scientists.length ? ` ${scientists.map((s) => s.surname).join(' ')}` : ''}`, {
      limit: limit + 2,
      locale: ctx.locale,
      types: ['encyclopedia'],
    })
    // статья учёного по словарю — первой (BM25 может поставить выше «Менделеевские чтения»); + её en/uz версии
    if (scientists.length) {
      const ids = scientists.flatMap((s) => [s.id, `${s.id}-en`, `${s.id}-uz`])
      for (const h of kb.getChunksById(ids)) push({ ...h, score: Math.max(h.score, (wiki[0]?.score ?? 0) + 1) })
    }
    // статья, чей заголовок — слово вопроса («Кислород» для «кто открыл кислород»), выше случайных совпадений в тексте
    const forms = new Set((query.match(/[A-Za-zА-Яа-яЁё'‘’-]{3,}/gu) ?? []).flatMap((w) => wordForms(w)))
    const titleHit = (h: KbHit) => {
      const t = h.title.replace(/\s*\(.*\)$/, '').toLowerCase().replace(/ё/g, 'е')
      const words = t.split(/\s+/)
      return words.length <= 3 && words.every((w) => wordForms(w).some((f) => forms.has(f)))
    }
    const ranked = [...wiki].sort((a, b) => Number(titleHit(b)) - Number(titleHit(a)) || b.score - a.score)
    // en/uz: из лучших русских статей первой идёт та, у которой есть версия на языке ученика (ключевые темы)
    if (ctx.locale !== 'ru') {
      for (const h of ranked.slice(0, 6)) {
        const sib = kb.getChunksById([`${h.id}-${ctx.locale}`])
        if (sib.length) {
          push(sib[0]!)
          push(h)
          break
        }
      }
    }
    // en/uz: статья на языке ученика (Chromatography) по латинским словам вопроса — раньше русских совпадений
    if (ctx.locale !== 'ru') {
      const latin = (query.match(/[A-Za-z'‘’]{3,}/g) ?? []).join(' ')
      if (latin) {
        const own = await kb.searchKnowledge(latin, { limit: 4, locale: ctx.locale, types: ['encyclopedia'] })
        for (const h of own) if (h.lang === ctx.locale) push(h)
      }
    }
    for (const h of ranked) push(h)
    // версия на языке ученика для лучшей статьи (en/uz), если есть
    if (ctx.locale !== 'ru' && out[0]) {
      const base = out[0].id.replace(/-(en|uz)$/, '')
      for (const h of kb.getChunksById([`${base}-${ctx.locale}`])) push(h)
    }
    // wf16: большая энциклопедия (public/kb/wiki, ленивая загрузка) — когда в малой нет статьи с темой вопроса в названии
    if (!scientists.length && !out.some(titleHit) && (ctx.locale === 'ru' || !out.length)) {
      const big = await bigWikiHits(query, limit)
      if (big.length) {
        const { wikiQueryCoverage, wikiExactTopic } = await import('./wikiBig')
        const coverage = wikiQueryCoverage(big[0]!, query)
        // статья ровно о том, о чём спросили, а учебник об этом молчит — ответ энциклопедии важнее школьного пересказа
        const exact = wikiExactTopic(big[0]!, query)
        if (schoolMisses && exact) markStrong(query)
        if (exact || coverage >= 0.75 || !out.length) return [...big, ...out].slice(0, limit + 2)
        return [...out, ...big].slice(0, limit + 2)
      }
    }
    return out.slice(0, limit + 2)
  } catch {
    return []
  }
}

/**
 * wf16: вопросы, на которые большая энциклопедия нашла статью ровно по теме, а учебник — нет («кто такой Иван Павлов»,
 * «закон всемирного тяготения»): encyclopediaIntent для них — 'strong' (роутер отдаёт ответ энциклопедии).
 */
const strongQueries = new Set<string>()
const normQ = (q: string) => q.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
function markStrong(query: string) {
  if (strongQueries.size > 200) strongQueries.clear()
  strongQueries.add(normQ(query))
}
function isMarkedStrong(query: string): boolean {
  const q = normQ(query)
  for (const s of strongQueries) if (s === q || s.startsWith(`${q} `)) return true
  return false
}

/** Смысловое слово вопроса не встречается ни в одном из лучших школьных фрагментов — учебник «не про то». */
async function schoolMissesTopic(query: string, schoolHits: readonly { title?: string; text?: string }[]): Promise<boolean> {
  if (!schoolHits.length) return false
  try {
    const { queryContentTerms } = await import('./wikiBig')
    const { analyzeTerms } = await import('./analyzer')
    const q = queryContentTerms(query)
    if (!q.length) return false
    const have = new Set(schoolHits.slice(0, 3).flatMap((h) => analyzeTerms(`${h.title ?? ''} ${(h.text ?? '').slice(0, 600)}`)))
    return q.some((t) => !have.has(t))
  } catch {
    return false
  }
}

/** Большая энциклопедия с ограничением по времени (медленная сеть не задерживает ответ учителя). */
export async function bigWikiHits(query: string, limit = 3, timeoutMs = 2_500): Promise<KbHit[]> {
  try {
    const { searchWikiBig } = await import('./wikiBig')
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<KbHit[]>((resolve) => {
      timer = setTimeout(() => resolve([]), timeoutMs)
    })
    const res = await Promise.race([searchWikiBig(query, { limit }), timeout])
    if (timer) clearTimeout(timer)
    return res
  } catch {
    return []
  }
}
