/**
 * Единая точка поиска знаний для ИИ-учителя (живой диалог, чат урока, коуч задач).
 *
 *   const k = await retrieveForTeacher('что такое оксиды', { locale: 'ru', gradeId: 'g8' })
 *   k.text       — блок для промпта LLM (с источниками), ≤ maxChars
 *   k.citations  — короткие подписи источников «[Kimyo 8, §2, стр. 10]»
 *   k.hits       — фрагменты { title, text, source } для локального ответа без LLM
 *
 * Источники (по порядку):
 *   1) база знаний src/learn/kb (BM25-индекс учебников Kimyo 7–11 + карточки, динамический
 *      import по классам, поиск ≈ 1–10 мс), цитаты «[Kimyo N, §X, стр. Y]»;
 *   2) запасной путь — retrieveChemistryKnowledge на небольших рукописных пакетах и учебнике
 *      (без старого мега-пакета) — только если KB не загрузилась.
 *
 * Бюджеты промпта (TEACHER_KNOWLEDGE_BUDGETS): чат — до 8 фрагментов / ≈9 тыс. символов,
 * живой голос — 3 фрагмента / ≈3,5 тыс. Короткий бюджет (maxChars ≤ 4000) включает
 * «голосовой» режим: в `text` идут только 3 лучших фрагмента, в `hits` — до `limit`.
 * Всё вне критического пути: уступаем event loop перед работой, кешируем по запросу,
 * ограничиваем ожидание (timeoutMs) — по таймауту возвращаем пустой результат, а
 * поиск досчитывается в фоне и попадает в кеш.
 */

export type TeacherKnowledgeLocale = 'ru' | 'en' | 'uz'

export interface TeacherKnowledgeContext {
  locale: TeacherKnowledgeLocale
  /** 'g7' … 'g11' */
  gradeId?: string
  /** 'c1' */
  chapterId?: string
  /** 's03' */
  sectionId?: string
  sectionTitle?: string
  /** Сколько фрагментов вернуть (по умолчанию 6). */
  limit?: number
  /** Лимит длины `text` (по умолчанию 4000). */
  maxChars?: number
  /** Максимум ожидания (мс). По умолчанию 2500. */
  timeoutMs?: number
  signal?: AbortSignal
}

export interface TeacherKnowledgeHit {
  title: string
  text: string
  source?: string
  citation?: string
  score?: number
  type?: string
}

export type TeacherKnowledgeProviderName = 'kb' | 'legacy' | 'custom' | 'none'

export interface TeacherKnowledgeResult {
  text: string
  citations: string[]
  hits: TeacherKnowledgeHit[]
  provider: TeacherKnowledgeProviderName
  /** Время ожидания вызывающим (мс). */
  ms: number
  cached: boolean
  timedOut: boolean
}

export type TeacherKnowledgeProvider = (
  query: string,
  ctx: TeacherKnowledgeContext,
) => Promise<Pick<TeacherKnowledgeResult, 'text' | 'citations' | 'hits'>>

/** Рекомендуемые бюджеты знаний в промпте. */
export const TEACHER_KNOWLEDGE_BUDGETS = {
  /** Чат урока / «умный ИИ» в тексте: 6–8 фрагментов, ≈8–10 тыс. символов. */
  chat: { limit: 8, maxChars: 9_000 },
  /** Живой голосовой диалог: 3 фрагмента, ≈3,5 тыс. символов. */
  live: { limit: 3, maxChars: 3_500 },
} as const

const DEFAULT_LIMIT = 6
const DEFAULT_MAX_CHARS = 4_000
const DEFAULT_TIMEOUT_MS = 2_500
const CACHE_MAX = 80
/** Потолки, чтобы ни один вызов не раздувал промпт. */
const MAX_LIMIT = 8
const MAX_PROMPT_CHARS = 10_000
/** Бюджет не больше этого — «голосовой»: в промпт только LIVE_PROMPT_CHUNKS лучших фрагментов. */
const LIVE_BUDGET_CHARS = 4_000
const LIVE_PROMPT_CHUNKS = TEACHER_KNOWLEDGE_BUDGETS.live.limit

/** Нормализовать бюджет вызова: limit ≤ 8, maxChars ≤ 10 000. */
function budgetOf(ctx: TeacherKnowledgeContext): { limit: number; maxChars: number; promptChunks: number } {
  const limit = Math.max(1, Math.min(MAX_LIMIT, Math.round(ctx.limit ?? DEFAULT_LIMIT)))
  const maxChars = Math.max(400, Math.min(MAX_PROMPT_CHARS, Math.round(ctx.maxChars ?? DEFAULT_MAX_CHARS)))
  const promptChunks = maxChars <= LIVE_BUDGET_CHARS ? Math.min(limit, LIVE_PROMPT_CHUNKS) : limit
  return { limit, maxChars, promptChunks }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function gradeNumber(gradeId?: string): number | undefined {
  const n = Number(String(gradeId ?? '').replace(/^g/i, ''))
  return Number.isFinite(n) && n >= 7 && n <= 11 ? n : undefined
}

function yieldToEventLoop(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (sched?.yield) return sched.yield()
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function empty(provider: TeacherKnowledgeProviderName = 'none'): Pick<TeacherKnowledgeResult, 'text' | 'citations' | 'hits'> & {
  provider: TeacherKnowledgeProviderName
} {
  return { text: '', citations: [], hits: [], provider }
}

/* ------------------------------------------------------------------ providers */

type ProviderOutput = Pick<TeacherKnowledgeResult, 'text' | 'citations' | 'hits'> & { provider: TeacherKnowledgeProviderName }

let customProvider: TeacherKnowledgeProvider | null = null
let kbBroken = false
let kbFailures = 0

type KbModule = typeof import('./kb')
type KbHitRow = Awaited<ReturnType<KbModule['searchKnowledge']>>[number]

/** «Почему …», «как …», «что происходит …» — ответ часто в следующем фрагменте того же § (причина после факта). */
const EXPLAIN_QUERY_RE = /(почему|зачем|отчего|(^|\s)как\s|каким образом|что происходит|от чего завис|способ|получа|устран|защит|\bwhy\b|\bhow\b|\bnega\b|qanday|nima uchun)/iu
const CALC_QUERY_RE = /(сколько|рассчита|вычисл|найдите масс|calculate|how (much|many)|hisobla|qancha)/iu
const WHAT_IS_QUERY_RE = /(что так(ое|ая|ой|ие)|что значит|что называ|what (is|are)\b|\bnima\b)/iu

/**
 * Локальному ответу мало топ-фрагментов поиска (промпт LLM не меняется — `hits[0..limit)` те же):
 *   1) строки фрагментов-определений, разорванные вёрсткой («Прибор для определения … называются электролитами»),
 *      заменяются целой фразой из текста того же § (layoutRepair.repairDefinitionText);
 *   2) «почему/как»: соседние фрагменты лучших страниц учебника («…-t01» → «…-t02») — причина/способ часто там;
 *   3) «что такое X» на уроке: до 2 определений из всего класса (определение может быть в другом §).
 */
async function enrichKbHits(kb: KbModule, query: string, ctx: TeacherKnowledgeContext, hits: KbHitRow[], grade: number | undefined): Promise<KbHitRow[]> {
  let repairDefinitionText: ((text: string, paragraph: readonly string[]) => string) | null = null
  try {
    repairDefinitionText = (await import('./kb/layoutRepair')).repairDefinitionText
  } catch {
    /* без починки */
  }
  const paragraphs = new Map<string, string[]>()
  const repair = (h: KbHitRow): KbHitRow => {
    if (h.type !== 'definition' || h.grade == null || !h.kp || !repairDefinitionText) return h
    const key = `${h.grade}|${h.kp}`
    let texts = paragraphs.get(key)
    if (!texts) {
      texts = kb.getParagraphChunks(h.grade, h.kp, ['textbook']).map((c) => c.text)
      paragraphs.set(key, texts)
    }
    const text = repairDefinitionText(h.text, texts)
    return text === h.text ? h : { ...h, text }
  }
  const out = hits.map(repair)
  const have = new Set(out.map((h) => h.id))
  {
    // Следующий фрагмент лучших страниц учебника; для «почему/как» — и предыдущий.
    const explain = EXPLAIN_QUERY_RE.test(query)
    const ids: string[] = []
    for (const h of out.slice(0, 4).filter((x) => x.type === 'textbook').slice(0, 2)) {
      const m = h.id.match(/^(.*-t)(\d+)$/)
      if (!m) continue
      const n = Number(m[2])
      for (const x of explain ? [n + 1, n - 1] : [n + 1]) if (x > 0) ids.push(`${m[1]}${String(x).padStart(m[2]!.length, '0')}`)
    }
    for (const n of kb.getChunksById(ids.filter((id) => !have.has(id))).slice(0, 3)) {
      if (have.has(n.id)) continue
      have.add(n.id)
      out.push({ ...n, score: 0 })
    }
  }
  if (ctx.locale === 'ru' && (ctx.chapterId || ctx.sectionId) && !WHAT_IS_QUERY_RE.test(query)) {
    // Ворота доказательств (локальный ответ): поиск по всему классу (и карточкам) без фильтра урока — термин вопроса +
    // признак типа ответа («потому что», «например», «способом»). Добавляем ≤ 3 фрагмента с термином вопроса (score 0).
    try {
      const { extractKeyTerm } = await import('./brain/dualMode/localAnswerComposer')
      const term = extractKeyTerm(query, 'ru')
      const stems = (term ?? '').toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter((w) => w.length >= 4).map((w) => w.slice(0, Math.max(4, w.length - 2)))
      if (stems.length) {
        const marker = /почему|зачем|отчего/iu.test(query)
          ? ' потому что так как'
          : /пример/iu.test(query)
            ? ' например примеры'
            : /(^|\s)как\s|способ|получ/iu.test(query)
              ? ' способом'
              : ''
        // Смысловые слова вопроса (без «как/почему/влияет/приведи») + признак типа ответа.
        const content = query
          .replace(/[?!.,]+/gu, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 4 && !/^(почему|зачем|отчего|такое|такая|такой|такие|влия\S*|привед\S*|пример\S*|какой|какая|какие|каким|можно|нужно|объясни\S*|расскажи\S*)$/iu.test(w))
          .join(' ')
        const probe = await kb.searchKnowledge(`${content}${marker}`, { grade, limit: 8, locale: 'ru' })
        let added = 0
        for (const h of probe) {
          if (added >= 3) break
          const text = h.text.toLowerCase().replace(/ё/g, 'е')
          if (have.has(h.id) || !stems.every((s) => text.includes(s))) continue
          have.add(h.id)
          out.push(repair({ ...h, score: 0 }))
          added++
        }
      }
    } catch {
      /* без пробы */
    }
  }
  if (WHAT_IS_QUERY_RE.test(query) && (ctx.chapterId || ctx.sectionId)) {
    // ru: только фрагменты, где термин и определяется («Кислоты – сложные вещества …», «… называются кислотами»).
    const term = ctx.locale === 'ru' ? query.toLowerCase().replace(/ё/g, 'е').match(/что так(?:ое|ая|ой|ие)\s+([а-я-]{4,})/u)?.[1] : undefined
    const wide = await kb.searchKnowledge(query, { grade, limit: 8, locale: ctx.locale, types: ['definition', 'summary'] })
    // Определение класса веществ часто в другом § («Кислоты – сложные вещества …» в «Химических свойствах воды»):
    // второй запрос со словами определения находит его, фильтр ниже оставляет только настоящие определения.
    if (term) wide.push(...(await kb.searchKnowledge(`${term} сложные вещества состоящие`, { grade, limit: 8, locale: 'ru', types: ['definition', 'summary', 'textbook'] })))
    const stem = term ? term.slice(0, Math.max(4, Math.min(6, term.length - 2))) : ''
    const defines = (text: string) =>
      !stem || new RegExp(`(^|[\\n.!?]\\s*)${stem}[а-я]*\\s*[–—-]\\s|называ[а-я]*\\s+(?:[а-я]+\\s+)?${stem}`, 'iu').test(text.replace(/ё/g, 'е'))
    let added = 0
    for (const h of wide) {
      if (added >= 2) break
      if (have.has(h.id) || !defines(h.text)) continue
      have.add(h.id)
      out.push(repair({ ...h, score: 0 }))
      added++
    }
  }
  return out
}

async function searchViaKb(rawQuery: string, ctx: TeacherKnowledgeContext): Promise<ProviderOutput> {
  const kb = await import('./kb')
  // uz: падежные окончания («Galogenlarga», «oksidning») мешают поиску — ищем по основе с формой множественного числа.
  const query = ctx.locale === 'uz' ? rawQuery.replace(/(?<=[a-z'‘’]{4,})(ning|dagi|dan|ga|ni|da)(?=[\s?!.,]|$)/giu, '') : rawQuery
  const { limit, maxChars, promptChunks } = budgetOf(ctx)
  const grade = gradeNumber(ctx.gradeId)
  // Учебники русские: к вопросу на en/uz добавляем русские термины глоссария, иначе поиск идёт по чужим словам.
  let searchQuery = query
  if (ctx.locale !== 'ru') {
    try {
      const { ruQueryTerms } = await import('./kb/localeSupport')
      const terms = await ruQueryTerms(query, ctx.locale)
      if (terms.length) searchQuery = `${query} ${terms.join(' ')}`
    } catch {
      /* без глоссария — поиск по исходному вопросу */
    }
  }
  const hits = await kb.searchKnowledge(searchQuery, {
    grade,
    chapterId: ctx.chapterId,
    sectionId: ctx.sectionId,
    // Расчётная задача: карточка с формулой часто ниже 6-го места — голосу нужны те же 8 фрагментов, что и чату.
    limit: CALC_QUERY_RE.test(query) ? Math.max(limit, MAX_LIMIT) : limit,
    locale: ctx.locale,
  })
  // kb/index.ts глотает ошибки загрузки шардов (и повторяет попытку при следующем вызове):
  // пустая база — это сбой загрузки, а не «ничего не найдено».
  if (hits.length === 0) {
    const status = kb.getKnowledgeStatus()
    const ownShard = grade ? `g${grade}` : null
    if (status.docs === 0 || (ownShard && !status.shards.includes(ownShard))) {
      throw new Error(`KB shards not loaded (${status.shards.join(',') || 'none'})`)
    }
  }
  const citations: string[] = []
  const enriched = await enrichKbHits(kb, query, ctx, hits, grade)
  const out: TeacherKnowledgeHit[] = enriched.map((h, i) => {
    const citation = kb.citationFor(h)
    // Добавленные фрагменты (соседние/определения из других §) — после основных подписей.
    if (i < hits.length && !citations.includes(citation)) citations.push(citation)
    return { title: h.title, text: h.text, source: h.source, citation, score: h.score, type: h.type }
  })
  // en/uz: учебники русские — добавляем фразы на языке ученика (переводы тестов) и пары глоссария
  // (после основных фрагментов, чтобы hits[0] и блок промпта не менялись).
  if (ctx.locale !== 'ru') {
    try {
      const { localeHitsFor } = await import('./kb/localeSupport')
      out.push(...(await localeHitsFor(query, ctx.locale, out, grade)))
    } catch {
      /* без переводов — только русские фрагменты */
    }
  }
  return {
    text: kb.formatKnowledgeForPrompt(hits.slice(0, promptChunks), maxChars),
    citations,
    hits: out,
    provider: 'kb',
  }
}

/** Подпись фрагмента запасного пути: учебник — «[Kimyo N, §…]», остальное — «[ATOMLAB — тема]». */
function legacyCitation(c: { topic: string; textbook?: { gradeId?: string; page?: number } }): string {
  const g = gradeNumber(c.textbook?.gradeId)
  const kp = c.topic.match(/^§\s*([\d.]+?)\.?\s/)?.[1]
  if (g && kp) return `[Kimyo ${g}, §${kp}${c.textbook?.page ? `, стр. ${c.textbook.page}` : ''}]`
  return `[ATOMLAB — ${c.topic}]`
}

async function searchViaLegacy(query: string, ctx: TeacherKnowledgeContext): Promise<ProviderOutput> {
  const legacy = await import('./learnKnowledgeRetrieval')
  // Синхронный перебор — сначала отдаём управление UI.
  await yieldToEventLoop()
  const { limit, maxChars, promptChunks } = budgetOf(ctx)
  const retrieved = legacy.retrieveChemistryKnowledge(query, {
    maxChunks: limit,
    minScore: 3,
    gradeId: ctx.gradeId,
    chapterId: ctx.chapterId,
    sectionId: ctx.sectionId,
    sectionTitle: ctx.sectionTitle,
  })
  const hits: TeacherKnowledgeHit[] = []
  const citations: string[] = []
  const blocks: string[] = []
  let used = 0
  for (const c of retrieved.chunks) {
    const text = (ctx.locale === 'en' ? c.en : c.ru) || c.ru || c.en || ''
    if (!text.trim()) continue
    const citation = legacyCitation(c)
    hits.push({ title: c.topic, text, source: 'ATOMLAB', citation, type: c.textbook ? 'textbook' : 'card' })
    if (!citations.includes(citation)) citations.push(citation)
    const block = `${citation} ${c.topic}\n${text}`
    if (blocks.length < promptChunks && used + block.length <= maxChars) {
      blocks.push(block)
      used += block.length + 5
    }
  }
  return { text: blocks.join('\n---\n'), citations, hits, provider: 'legacy' }
}

async function runProviders(query: string, ctx: TeacherKnowledgeContext): Promise<ProviderOutput> {
  if (customProvider) {
    const r = await customProvider(query, ctx)
    return { ...r, provider: 'custom' }
  }
  if (!kbBroken) {
    try {
      const out = await searchViaKb(query, ctx)
      kbFailures = 0
      return out
    } catch (error) {
      // Модуль/шарды не загрузились: этот запрос отвечаем из запасных пакетов. Сам модуль kb
      // повторит загрузку при следующем вызове; «сломанной» считаем базу только после 3 сбоев подряд.
      kbFailures += 1
      if (kbFailures >= 3) kbBroken = true
      console.warn('[teacherKnowledge] KB unavailable, falling back to small hand-written packs', error)
    }
  }
  try {
    return await searchViaLegacy(query, ctx)
  } catch {
    return empty()
  }
}

/* ---------------------------------------------------------------------- cache */

const cache = new Map<string, Promise<ProviderOutput>>()

function cacheKey(query: string, ctx: TeacherKnowledgeContext): string {
  const q = query.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
  const { limit, maxChars } = budgetOf(ctx)
  return [ctx.locale, ctx.gradeId ?? '', ctx.chapterId ?? '', ctx.sectionId ?? '', limit, maxChars, q].join('|')
}

function remember(key: string, value: Promise<ProviderOutput>): void {
  cache.set(key, value)
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}

/* ------------------------------------------------------------------------ API */

/**
 * Найти знания для ответа учителя. Никогда не бросает исключение:
 * при таймауте/отмене/ошибке возвращает пустой результат.
 */
export async function retrieveForTeacher(query: string, ctx: TeacherKnowledgeContext): Promise<TeacherKnowledgeResult> {
  const t0 = now()
  const clean = query.trim()
  const done = (out: ProviderOutput, cached: boolean, timedOut = false): TeacherKnowledgeResult => ({
    ...out,
    ms: Math.round(now() - t0),
    cached,
    timedOut,
  })
  if (!clean || ctx.signal?.aborted) return done(empty(), false)

  const key = cacheKey(clean, ctx)
  let job = cache.get(key)
  const cached = Boolean(job)
  if (!job) {
    job = runProviders(clean, ctx).catch(() => empty())
    remember(key, job)
    // Пустой результат из-за сбоя не держим в кеше вечно.
    void job.then((r) => {
      if (r.hits.length === 0 && r.provider === 'none') cache.delete(key)
    })
  }

  const timeoutMs = ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  const guard = new Promise<'timeout' | 'abort'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs)
    if (ctx.signal) {
      onAbort = () => resolve('abort')
      ctx.signal.addEventListener('abort', onAbort, { once: true })
    }
  })
  try {
    const winner = await Promise.race([job, guard])
    if (winner === 'timeout') return done(empty(), cached, true)
    if (winner === 'abort') return done(empty(), cached)
    return done(winner, cached)
  } finally {
    if (timer) clearTimeout(timer)
    if (onAbort) ctx.signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Подпись источника в виде, который UI превращает в «чип» (components/learn/teacher/citations.ts):
 * учебник «[Kimyo 8, §2, стр. 10]» — как есть; карточки — «[Источник: ATOMLAB — …]».
 */
export function citationForDisplay(citation: string, locale: TeacherKnowledgeLocale): string {
  const inner = citation.replace(/^\[|\]$/g, '').trim()
  if (/§|стр\.|p\.\s?\d|bet\s?\d|параграф|paragraph|paragraf/i.test(inner)) return `[${inner}]`
  const label = locale === 'en' ? 'Source' : locale === 'uz' ? 'Manba' : 'Источник'
  return `[${label}: ${inner.replace(/^ATOMLAB:\s*/, 'ATOMLAB — ')}]`
}

/** Прогреть базу знаний для класса (например, при открытии онлайн-урока). */
export function preloadTeacherKnowledge(ctx: Pick<TeacherKnowledgeContext, 'gradeId'>): void {
  if (customProvider || kbBroken) return
  void import('./kb')
    .then((kb) => kb.preloadKnowledge({ grade: gradeNumber(ctx.gradeId) }))
    .catch(() => {
      kbBroken = true
    })
}

/** Подменить источник знаний (тесты, будущий шлюз). `null` — вернуть стандартный. */
export function setTeacherKnowledgeProvider(provider: TeacherKnowledgeProvider | null): void {
  customProvider = provider
  cache.clear()
}

export function clearTeacherKnowledgeCache(): void {
  cache.clear()
}
