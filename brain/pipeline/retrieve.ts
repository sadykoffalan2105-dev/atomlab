/**
 * Шаг 6: поиск знаний «сначала школа» (мозг v2, retrieveV2; старый retrieve() — обёртка над ним).
 *   Вход — самодостаточный вопрос StandaloneQuery от DIALOG (текст + тема по-русски + сущности + класс + scope).
 *   BM25F по шардам учебников: P1 — с классом ученика (глава/параграф урока), P2 — без класса (другие классы без штрафа);
 *   энциклопедия и указатель — для широких вопросов (scope broad, «кто/история») или когда школа пуста;
 *   ∪ BM25 журнала (brain/kb/journal.ts; + тема, формулы-сущности, русские термы глоссария для uz/en)
 *   ∪ векторы bge-m3 (если Ollama + эмбеддинги есть).
 * Затем: тип источника и ярус (учебник своего класса → соседний → ATOMLAB/журнал → энциклопедия); hybrid.ts — нормировка,
 *   веса, бонусы; relevance.ts — проверка темы (имена собственные, персоналии, слабый терм); ярусные множители
 *   (config.retrievalV2.tierBoost); MMR; гарантия «учебник класса — первым», энциклопедия в школьном вопросе — не больше
 *   одного фрагмента и не выше 3-го места. Карта программы (brain/curriculum): ссылка «§12 Kimyo 8» отдаёт сам параграф,
 *   школьный вопрос с известным классом получает «§-карточку» первым знанием, подписи учебника — «[Kimyo 8, §12, стр. 50]».
 *   Уверенность conf_r = 0.6·s_top + 0.4·coverage (s_top — абсолютная сила
 *   лучшего совпадения, coverage — доля понятий вопроса в top-3); школьный вопрос без учебника — не выше «medium».
 */
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import { conceptUnitByName, conceptUnitFor, definitionByTerm, definitionFor, termOfQuestion, unitForTopic } from '../curriculum/answer.ts'
import { whyRuleFor, whyUnitFor } from '../curriculum/why.ts'
import { termToRu } from '../persona/uzGlossary.ts'
import { unitCard } from '../curriculum/card.ts'
import { sharedCurriculum } from '../curriculum/map.ts'
import { parseSectionRef } from '../curriculum/sectionRef.ts'
import type { Unit } from '../curriculum/types.ts'
import type { KbChunkType, KbHit, KbLang } from '../../src/learn/kb/types.ts'
import { DEFAULT_CONFIG, type BrainConfig } from '../config.ts'
import type { EmbedStore } from '../kb/embedStore.ts'
import type { Journal, JournalRecord } from '../kb/journal.ts'
import type { Knowledge } from '../kb/shards.ts'
import { normForHash } from '../kb/storage.ts'
import type { LlmClient } from '../llm/ollama.ts'
import type { GradeId, RankedFragment, RetrievalResultV2, RetrieveOptions, Scope, SourceKind, StandaloneQuery } from './dialogTypes.ts'
import { findConcepts, findFormulas } from './entities.ts'
import { hybridScore, mmrSelect, type Candidate } from './hybrid.ts'
import { applyRelevance, isPersonCandidate } from './relevance.ts'
import { cmpForm, type Lang } from './normalize.ts'
import { normalizeVec } from '../kb/embedStore.ts'

export const SCHOOL_TYPES: KbChunkType[] = ['textbook', 'definition', 'summary', 'card', 'faq', 'misconception']

export type RetrieveContext = { gradeId?: string; chapterId?: string; sectionId?: string }

/**
 * Результат старого входа retrieve(). На деле это RetrievalResultV2 (dialogTypes.ts): items несут sourceKind/tier,
 * есть scopeUsed/schoolHit/tiers — старые вызовы видят только эти поля и не ломаются.
 */
export type RetrievalResult = {
  items: Candidate[]
  confR: number
  sTop: number
  coverage: number
  queryTerms: Set<string>
  usedVectors: boolean
  /** сколько кандидатов отброшено проверкой темы (relevance.ts) */
  dropped: number
  /** первые отброшенные (заголовок, причина) — для отладки и scripts/brain/probe-retrieve.mts */
  droppedTop: { title: string; why: string }[]
  ms: number
}

export function gradeNum(gradeId?: string): number | null {
  const m = gradeId?.match(/^g(7|8|9|10|11)$/)
  return m ? Number(m[1]) : null
}

/**
 * Подпись источника. Учебник — через карту программы: «[Kimyo 8, §12, стр. 50]», для 7 и 10 кл. «[Kimyo 7, гл. 2, тема 6,
 * стр. 54]»; карты нет или такой единицы в ней нет — прежний формат «[Kimyo 7, §2.6, стр. 54]».
 */
export function citationOf(source: string, title: string, kp?: string | null, page?: number | null, type?: string): string {
  const kg = source.match(/^Kimyo\s*(\d+)/i)
  if (kg && kp) {
    const viaMap = sharedCurriculum()?.citeFor(Number(kg[1]), String(kp), page)
    if (viaMap) return viaMap
  }
  if (/^Kimyo/i.test(source)) return `[${source}${kp ? `, §${kp}` : ''}${page ? `, стр. ${page}` : ''}]`
  if (type === 'encyclopedia' || /википед|wikipedia/i.test(source)) return `[Википедия: ${title} — CC BY-SA]`
  if (/^ATOMLAB/i.test(source)) return `[${source.replace(/\s+/g, ' ').slice(0, 80)}]`
  return `[${source.slice(0, 80)}]`
}

/** номер печатной единицы фрагмента учебника (Candidate его не несёт; нужен для §-карточки) */
const hitKp = new WeakMap<Candidate, { grade: number; kp: string }>()

function fromHit(h: KbHit): Candidate {
  const c: Candidate = {
    key: normForHash(h.text).slice(0, 160),
    id: h.id,
    title: h.title,
    text: h.text,
    type: h.type,
    lang: h.lang,
    grade: h.grade,
    source: h.source,
    citation: citationOf(h.source, h.title, h.kp, h.pageStart, h.type),
    origin: 'shard',
    bm: h.score,
    sBm: 0,
    vec: null,
    cos: null,
    score: 0,
    terms: new Set(analyzeTerms(`${h.title} ${h.text}`)),
    titleTerms: new Set(analyzeTerms(h.title)),
  }
  if (h.grade != null && h.kp) hitKp.set(c, { grade: h.grade, kp: String(h.kp) })
  return c
}

/** Старая подпись журнала «[Kimyo 7, §2.6, стр. 51]» → через карту «[Kimyo 7, гл. 2, тема 6, стр. 51]» (строки журнала не правим — только показ). */
function remapCite(cite: string): string {
  const m = cite.match(/^\[Kimyo\s*(\d+), §([\d.]+|lab)(?:, стр\. (\d+))?\]$/u)
  if (!m) return cite
  return sharedCurriculum()?.citeFor(Number(m[1]), m[2]!, m[3] ? Number(m[3]) : null) ?? cite
}

function fromRecord(r: JournalRecord, score: number): Candidate {
  const cite = typeof r.meta.cite === 'string' ? remapCite(r.meta.cite) : r.kind === 'correction' ? '[ATOMLAB: правка учителя]' : citationOf(r.source || 'ATOMLAB: журнал', r.title, null, null)
  const g = r.tags.find((t) => t.startsWith('grade:'))
  return {
    key: normForHash(r.text).slice(0, 160),
    id: r.id,
    title: r.title,
    text: r.text,
    type: typeof r.meta.type === 'string' ? r.meta.type : r.kind,
    lang: r.lang,
    grade: g ? Number(g.slice(6)) || null : null,
    source: r.source,
    citation: cite,
    origin: 'journal',
    kind: r.kind,
    bm: score,
    sBm: 0,
    vec: null,
    cos: null,
    score: 0,
    terms: new Set(analyzeTerms(`${r.title} ${r.text.slice(0, 4000)}`)),
    titleTerms: new Set(analyzeTerms(r.title)),
  }
}

/** Результат retrieveV2 + сведения карты программы (локальное расширение, dialogTypes.ts не меняем). */
export type CurriculumInfo = {
  unitId: string
  cite: string
  viaRef: boolean
  /** вопрос-определение: номер определения единицы (unit.definitions[defIndex]), чей термин — термин вопроса */
  defIndex?: number
  /** вопрос-определение: термин — в «Изучаемых понятиях» единицы (определения в карте нет — ответ из текста §) */
  concept?: boolean
  /** подпись со страницей — первая цитата школьного ответа */
  citeFull?: string
}
export type RetrievalResultV2x = RetrievalResultV2 & {
  /** §-карточка в items[0]: какая единица и откуда (ссылка на § в вопросе или подбор по теме) */
  curriculum?: CurriculumInfo
  /** в вопросе была ссылка на § — нашлась ли такая единица */
  sectionRef?: { asked: true; found: boolean; grade?: number; kp?: string }
}

/** Вопросы, к которым §-карточка не нужна: история/персоналии, широкие, болтовня, «да/повтори». */
const NO_CARD_KINDS = new Set(['who_history', 'broad', 'chitchat', 'confirm', 'repeat'])

/** §-карточка единицы как фрагмент поиска: первое знание школьного ответа с точной подписью «[Kimyo 8, §12, стр. 50]». */
function cardFragment(unit: Unit, lang: Lang, g: number | null, maxChars: number, bm: number, score: number, queryTerms?: Set<string>, page?: number): RankedFragment {
  const title = `${unit.label.ru}: ${unit.title.ru}`
  const text = unitCard(unit, lang, maxChars, queryTerms)
  const sourceKind: SourceKind = g != null && unit.grade === g ? 'textbook_grade' : 'textbook_other'
  const gradeDelta = g != null ? Math.abs(unit.grade - g) : null
  return {
    key: `cur-${unit.id}`,
    id: `cur-${unit.id}`,
    title,
    text,
    type: 'summary',
    // не 'ru': запасной путь без LLM (fallback.ts берёт предложения только из ru-фрагментов) не вставляет служебные
    // строки карточки («Kimyo 9, §4 «…» — понятия: …») в текст ответа; модели карточка уходит как обычное знание
    lang: `card-${lang}`,
    grade: unit.grade,
    source: `Kimyo ${unit.grade}`,
    citation: page || unit.pages.start ? `${unit.cite.slice(0, -1)}, стр. ${page || unit.pages.start}]` : unit.cite,
    origin: 'shard',
    bm,
    sBm: 0,
    vec: null,
    cos: null,
    score,
    terms: new Set(analyzeTerms(`${title} ${text} ${unit.concepts.map((c) => c.ru).join(' ')}`)),
    titleTerms: new Set(analyzeTerms(title)),
    cov: 1,
    titleHit: true,
    sourceKind,
    gradeDelta,
    tier: tierOf(sourceKind, gradeDelta),
  }
}

export type RetrieveDeps = { kb: Knowledge; journal: Journal; embeds: EmbedStore | null; llm: LlmClient | null; config: BrainConfig }

/**
 * Старый вход (selftest, probe, chat.ts до слияния с DIALOG): тонкая обёртка над retrieveV2 с «пустым» самодостаточным
 * вопросом; бюджет — как раньше (config.hybrid: topK 6, ≤ 5000 символов).
 */
export async function retrieve(
  text: string,
  lang: Lang,
  ctx: RetrieveContext,
  wantEncyclopedia: boolean,
  deps: RetrieveDeps,
  signal?: AbortSignal,
): Promise<RetrievalResult> {
  const grade = /^g(7|8|9|10|11)$/.test(ctx.gradeId ?? '') ? (ctx.gradeId as GradeId) : null
  const query: StandaloneQuery = {
    text,
    lang,
    topic: null,
    entities: [],
    grade,
    scope: wantEncyclopedia ? 'broad' : 'school',
    kind: 'general',
    lengthClass: 'normal',
    followUp: 'none',
    resolvedBy: 'none',
    original: text,
  }
  const cfg = deps.config.hybrid
  return retrieveV2({ query, ctx, profile: 'laptop', budgetChars: Math.round(cfg.maxChars / 2), maxItems: cfg.topK }, deps, signal)
}

/** Умолчания блока retrievalV2 — если конфиг собран не через loadConfig (тесты с урезанным конфигом). */
function v2Config(config: BrainConfig): BrainConfig['retrievalV2'] {
  return config.retrievalV2 ?? DEFAULT_CONFIG.retrievalV2
}

/** Тип источника фрагмента и разница классов с классом ученика g. */
export function sourceKindOf(c: Candidate, g: number | null): { sourceKind: SourceKind; gradeDelta: number | null } {
  if (c.type === 'encyclopedia' || /википед|wikipedia/i.test(c.source)) return { sourceKind: 'encyclopedia', gradeDelta: null }
  if (c.type === 'index') return { sourceKind: 'index', gradeDelta: null }
  const k = c.source.match(/^Kimyo\s*(\d+)/i)
  if (k) {
    const kg = Number(k[1])
    if (g == null) return { sourceKind: 'textbook_other', gradeDelta: null }
    return { sourceKind: kg === g ? 'textbook_grade' : 'textbook_other', gradeDelta: Math.abs(kg - g) }
  }
  const delta = g != null && c.grade != null ? Math.abs(c.grade - g) : null
  if (/^ATOMLAB/i.test(c.source)) return { sourceKind: 'atomlab', gradeDelta: delta }
  if (c.origin === 'journal') return { sourceKind: 'journal', gradeDelta: delta }
  return { sourceKind: 'atomlab', gradeDelta: delta }
}

/** Ярус: 1 — учебник класса ученика; 2 — соседний класс (или класс не известен), ATOMLAB того же класса; 3 — дальние классы, ATOMLAB, журнал; 4 — энциклопедия, указатель. */
export function tierOf(sourceKind: SourceKind, gradeDelta: number | null): 1 | 2 | 3 | 4 {
  if (sourceKind === 'textbook_grade') return 1
  if (sourceKind === 'textbook_other') return gradeDelta == null || gradeDelta <= 1 ? 2 : 3
  if (sourceKind === 'atomlab') return gradeDelta === 0 ? 2 : 3
  if (sourceKind === 'journal') return 3
  return 4
}

function tierBoost(f: RankedFragment, scope: Scope, cfg: BrainConfig['retrievalV2']): number {
  const b = cfg.tierBoost
  switch (f.sourceKind) {
    case 'textbook_grade':
      return b.grade
    case 'textbook_other':
      return f.gradeDelta == null || f.gradeDelta <= 1 ? b.near : b.far
    case 'atomlab':
      return b.atomlab
    case 'journal':
      return b.journal
    case 'encyclopedia':
      return scope === 'school' ? b.encyclopediaSchool : b.encyclopediaBroad
    case 'index':
      return b.index
  }
}

// ——— глоссарий ru ↔ uz/en: русские термы для вопросов на узбекском и английском (учебники русские)
const glossaryCache = new WeakMap<Knowledge, { lang: 'uz' | 'en'; words: string[]; ru: string }[]>()

function latWords(s: string): string[] {
  return (cmpForm(s).match(/[\p{L}']+/gu) ?? []).filter(Boolean)
}

/** Русские термины глоссария, чьи uz/en-варианты есть в вопросе: «natriyning valentligi» → ['валентность', 'натрий']. */
export function glossaryRuTerms(text: string, lang: Lang, kb: Knowledge): string[] {
  if (lang === 'ru' || !kb.glossary?.length) return []
  let idx = glossaryCache.get(kb)
  if (!idx) {
    idx = []
    for (const g of kb.glossary) {
      for (const alt of g.uz ?? []) idx.push({ lang: 'uz', words: latWords(alt), ru: g.ru })
      for (const alt of g.en ?? []) idx.push({ lang: 'en', words: latWords(alt), ru: g.ru })
    }
    glossaryCache.set(kb, idx)
  }
  const qw = latWords(text)
  if (!qw.length) return []
  // слово вопроса = вариант + окончание (uz: «valentligi», «kislotalar», «natriyniki»); короткие слова — точно;
  // окончание не длиннее 5 букв — «elektromanfiylik» не «elektron» + хвост
  const hit = (w: string, a: string) => (a.length < 4 ? w === a : (w.startsWith(a) || (a.length >= 6 && w.startsWith(a.slice(0, -1)))) && w.length - a.length <= 5)
  const out = new Set<string>()
  for (const e of idx) {
    if (e.lang !== lang || !e.words.length || e.words.join('').length < 4) continue
    if (e.words.every((a) => qw.some((w) => hit(w, a)))) out.add(e.ru)
  }
  return [...out].sort((a, b) => b.length - a.length).slice(0, 6)
}

/** Заголовок (без «Понятие:/Реакция:/Пример:» и «(§57)») состоит только из термов вопроса. */
function titleIsTopic(title: string, queryTerms: Set<string>): boolean {
  const core = title.replace(/^(понятие|реакция|пример|проверка|как понять|к экзамену)\s*:\s*/iu, '').replace(/\(\s*§[^)]*\)\s*$/u, '')
  const ts = analyzeTerms(core)
  return ts.length > 0 && ts.length <= 3 && ts.every((t) => queryTerms.has(t))
}

/** Все термы темы уже есть в тексте вопроса? Тогда тему не дописываем (иначе лишнее «понятие» в проверке темы). */
function coveredBy(text: string, extra: string): boolean {
  const have = new Set(analyzeTerms(text))
  const add = analyzeTerms(extra)
  return add.length > 0 && add.every((t) => have.has(t))
}

/**
 * Мозг v2: поиск «сначала школа». Учебник Kimyo класса ученика → соседние классы → ATOMLAB и журнал → энциклопедия
 * (в школьном вопросе — не больше одного фрагмента, не выше 3-го места; DIALOG кладёт его в блок «ФОН», не в цитаты).
 * Подробно — комментарии шагов a)–i) ниже и brain/README.md.
 */
export async function retrieveV2(opts: RetrieveOptions, deps: RetrieveDeps, signal?: AbortSignal): Promise<RetrievalResultV2x> {
  const t0 = performance.now()
  const { kb, journal, config } = deps
  const rc = v2Config(config)
  const sq = opts.query
  const lang = sq.lang
  const locale = lang as KbLang
  const g = gradeNum(sq.grade ?? opts.ctx.gradeId)
  const ctxGrade = gradeNum(opts.ctx.gradeId)

  // a) строка запроса: на уточнениях — + тема диалога по-русски (мост к русским учебникам для uz/en)
  let text = sq.text
  const topicExtra = sq.topic && !coveredBy(sq.text, sq.topic) ? sq.topic : null
  if (topicExtra && sq.followUp !== 'none') text = `${sq.text} ${topicExtra}`
  // uz/en: русские термины глоссария — только в поиск журнала (в сам запрос нельзя: лишние «понятия» роняют покрытие
  // в проверке темы — «Kristall panjara nima?» терял «Кристаллическую решётку»; перевод uz/en делает KbEngine.analyzeQuery)
  const glossRu = glossaryRuTerms(sq.text, lang, kb).filter((ru) => !coveredBy(text, ru))

  // b) школьные пулы: P1 — с классом ученика (глава/параграф урока — только если класс совпал с уроком), P2 — без класса
  const p1: KbHit[] = g != null
    ? kb.engine.search(text, {
        grade: g,
        chapterId: g === ctxGrade ? opts.ctx.chapterId : undefined,
        sectionId: g === ctxGrade ? opts.ctx.sectionId : undefined,
        limit: 30,
        types: SCHOOL_TYPES,
        locale,
      })
    : []
  const p2 = kb.engine.search(text, { limit: g != null ? 20 : 30, types: SCHOOL_TYPES, locale })
  const schoolHits = new Map<string, KbHit>()
  for (const h of [...p1, ...p2]) {
    const prev = schoolHits.get(h.id)
    if (!prev || prev.score < h.score) schoolHits.set(h.id, h)
  }
  const school = [...schoolHits.values()].sort((a, b) => b.score - a.score)
  const topSchool = school[0]?.score ?? 0
  const schoolWeak = topSchool < config.thresholds.schoolMin
  const wantEnc = sq.scope !== 'school' || sq.kind === 'who_history'
  let extra: KbHit[] = []
  if (wantEnc || schoolWeak) {
    extra = kb.engine.search(text, { limit: 10, types: ['encyclopedia'], locale })
    if (schoolWeak) extra.push(...kb.engine.search(text, { limit: 5, types: ['index'], locale }))
  }

  // журнал: термы вопроса + тема (вес topicWeight) + формулы-сущности (formulaWeight) + русские термы глоссария (uz/en)
  const analyzed = kb.engine.analyzeQuery(text, locale)
  const queryTerms = new Set(analyzed.terms.map((t) => t.term))
  const weighted = [...analyzed.terms.map((t) => ({ term: t.term, weight: t.weight })), ...analyzeTerms(text, { query: true }).map((term) => ({ term, weight: 1 }))]
  // тема, которой нет в тексте вопроса (и не дописанная в запрос на первом ходу), — с пониженным весом
  if (topicExtra && text === sq.text) for (const term of analyzeTerms(topicExtra, { query: true })) weighted.push({ term, weight: rc.topicWeight })
  for (const e of sq.entities) {
    const isFormula = findFormulas(e, true).length > 0
    for (const term of analyzeTerms(e, { query: true })) weighted.push({ term, weight: isFormula ? rc.formulaWeight : 1 })
  }
  for (const ru of glossRu) for (const term of analyzeTerms(ru, { query: true })) weighted.push({ term, weight: rc.glossaryWeight })
  const fromJournal = journal.search(weighted, 30)

  // слияние с дедупликацией по началу текста (копии учебника в журнале не удваиваются)
  const byKey = new Map<string, Candidate>()
  const add = (c: Candidate) => {
    const prev = byKey.get(c.key)
    if (!prev) byKey.set(c.key, c)
    else if (prev.origin === 'shard' && c.origin === 'journal') {
      if (c.kind === 'correction') byKey.set(c.key, c)
    }
  }
  for (const h of [...school, ...extra]) add(fromHit(h))
  for (const { rec, score } of fromJournal) add(fromRecord(rec, score))
  const cands = [...byKey.values()]

  // векторы (если есть Ollama + bge-m3 и посчитанные эмбеддинги)
  let usedVectors = false
  const status = deps.llm?.status()
  if (deps.embeds && deps.embeds.size && status?.available && status.embedModel) {
    const q = await deps.llm!.embed([text], config.timeouts.embedMs, signal)
    if (q?.[0]) {
      const qv = normalizeVec(q[0])
      usedVectors = true
      const vecOf = (c: Candidate): Float32Array | null => {
        if (c.origin === 'journal') return deps.embeds!.get(c.id)
        const jid = journal.bySrcId.get(c.id)
        return jid ? deps.embeds!.get(jid) : null
      }
      for (const c of cands.slice(0, config.hybrid.vecPool)) {
        c.vec = vecOf(c)
        if (c.vec) c.cos = dotSafe(qv, c.vec)
      }
      for (const { id, cos } of deps.embeds.topK(qv, 20, (id) => {
        const r = journal.get(id)
        return !!r && (r.kind === 'fact' || r.kind === 'qa' || r.kind === 'correction' || r.kind === 'note')
      })) {
        const r = journal.get(id)!
        const c = fromRecord(r, 0)
        if (byKey.has(c.key)) continue
        c.vec = deps.embeds.get(id)
        c.cos = cos
        byKey.set(c.key, c)
        cands.push(c)
      }
    }
  }

  // c) тип источника и ярус каждого кандидата
  const ranked: RankedFragment[] = cands.map((c) => {
    const sk = sourceKindOf(c, g)
    return Object.assign(c, sk, { tier: tierOf(sk.sourceKind, sk.gradeDelta) })
  })

  // d) гибридный балл и проверка темы: персоналии — только для широких вопросов и «кто/история»; слабый терм — drop
  hybridScore(ranked, { wBm: config.hybrid.wBm, wVec: config.hybrid.wVec, grade: g, queryTerms })
  const rel = applyRelevance(ranked, analyzed, text, {
    allowPeople: sq.scope !== 'school' || sq.kind === 'who_history',
    schoolQuestion: sq.scope === 'school',
    scope: sq.scope,
    weakTermMinTf: rc.weakTermMinTf,
  })
  let kept = rel.kept as RankedFragment[]
  const dropped = [...rel.dropped]

  // «кто открыл / история открытия X»: учёные, энциклопедия и фрагменты, где X в заголовке (а не «Глюкоза (открытая)»)
  if (sq.kind === 'who_history') {
    const cue = /^(истор|откр|изобр|когд|кто|перв|расскаж|discover|invent|histor|who|when|first|kashf|tarix|kim|qachon)/u
    const subject = new Set(analyzed.terms.filter((t) => !analyzed.terms.some((u) => u.concept === t.concept && cue.test(u.term))).map((t) => t.term))
    if (subject.size) {
      const fits = (f: RankedFragment) => isPersonCandidate(f) || f.sourceKind === 'encyclopedia' || [...f.titleTerms].some((t) => subject.has(t))
      for (const f of kept) if (!fits(f)) dropped.push({ c: f, why: 'history_subject' })
      kept = kept.filter(fits)
    }
  }
  const isSchoolSource = (f: RankedFragment) => f.sourceKind !== 'encyclopedia' && f.sourceKind !== 'index'

  // i) школа пуста, энциклопедия сильная — вопрос на деле широкий (DIALOG это увидит и смягчит формат)
  let scopeUsed: Scope = sq.scope
  if (sq.scope === 'school' && !kept.some(isSchoolSource)) {
    const enc = kept.filter((f) => f.sourceKind === 'encyclopedia').sort((a, b) => b.bm - a.bm)[0]
    if (enc && 1 - Math.exp(-enc.bm / 8) >= 0.5) scopeUsed = 'broad'
  }

  // энциклопедия в школьном вопросе — только если нет учебника своего/соседнего класса по теме (cov ≥ 0.5)
  if (scopeUsed === 'school' && kept.some((f) => f.tier <= 2 && (f.cov ?? 0) >= 0.5)) {
    for (const f of kept) if (!isSchoolSource(f)) dropped.push({ c: f, why: 'school_first' })
    kept = kept.filter(isSchoolSource)
  }

  // e) ярусные множители (правка учителя ×1.25 — уже в hybridScore), затем MMR;
  //    заголовок целиком о вопросе («Кислоты», «Понятие: Моль», «Валентность (§57)») — ×1.2 к «Соляной кислоте» на «что такое кислоты»
  for (const f of kept) {
    f.score *= tierBoost(f, scopeUsed, rc)
    if (titleIsTopic(f.title, queryTerms)) f.score *= 1.2
  }
  // один фрагмент на заголовок источника (четыре «Реакция: Оксиды» подряд вытесняют учебник)
  const byTitle = new Map<string, RankedFragment>()
  for (const f of kept) {
    const k = `${f.source}|${f.title}`
    const prev = byTitle.get(k)
    if (!prev || prev.score < f.score) byTitle.set(k, f)
  }
  kept = [...byTitle.values()]
  const mmrChars = Math.max(opts.budgetChars * 2, rc.minMmrChars)
  let items = mmrSelect(kept, config.hybrid.mmrLambda, Math.max(1, opts.maxItems), mmrChars)

  // f) гарантия школы: лучший учебник класса ученика по теме — первым; энциклопедия в школьном вопросе — не первой,
  //    не больше maxEncyclopediaSchool и не выше 3-го места
  //    (учебник по теме: cov = 1 или cov ≥ 0.5 и тема в заголовке; балл ≥ tier1MinShare от лучшего — слабое случайное
  //    совпадение «Хлорид водорода» на «кислород в лаборатории» вперёд не тащим)
  const topScore = items[0]?.score ?? 0
  const tier1 = kept
    .filter((f) => f.tier === 1 && ((f.cov ?? 0) >= 0.999 || ((f.cov ?? 0) >= 0.5 && f.titleHit)) && f.score >= rc.tier1MinShare * topScore)
    .sort((a, b) => b.score - a.score)[0]
  if (tier1 && items[0] !== tier1) {
    items = [tier1, ...items.filter((f) => f !== tier1)].slice(0, Math.max(1, opts.maxItems))
  }
  if (scopeUsed === 'school') {
    const school = items.filter(isSchoolSource)
    const bg = items.filter((f) => !isSchoolSource(f)).slice(0, rc.maxEncyclopediaSchool)
    if (school.length) {
      items = [...school]
      for (const f of bg) items.splice(Math.min(2, items.length), 0, f)
    } else items = bg
  }

  // j) карта программы: (а) ссылка на § — фрагменты этого параграфа без проверки темы (в «что в §12?» нет термов
  //    параграфа) и §-карточка первой; такого § нет — ничего не добавляем, но сообщаем sectionRef.found = false;
  //    (б) школьный вопрос с известным классом — §-карточка единицы по теме первым знанием
  const cur = kb.curriculum
  let curriculum: CurriculumInfo | undefined
  let sectionRef: RetrievalResultV2x['sectionRef']
  const cardChars = opts.budgetChars < 900 ? 300 : 600
  const maxItems = Math.max(1, opts.maxItems)
  if (cur) {
    const ref = parseSectionRef(sq.text, lang) ?? (sq.original && sq.original !== sq.text ? parseSectionRef(sq.original, lang) : null)
    if (ref) {
      const rg = ref.grade ?? g
      const unit = rg != null && ref.kp ? cur.unitFor(rg, ref.kp) : null
      sectionRef = { asked: true, found: !!unit, ...(rg != null ? { grade: rg } : {}), ...(ref.kp ? { kp: ref.kp } : {}) }
      if (unit) {
        const topBm = Math.max(1, ...items.map((f) => f.bm))
        const order: Record<string, number> = { summary: 0, definition: 1, textbook: 2 }
        const hits = kb.engine
          .paragraphChunks(unit.grade, unit.kp, ['textbook', 'definition', 'summary'])
          .map((h, i) => ({ h, i }))
          .sort((a, b) => (order[a.h.type] ?? 3) - (order[b.h.type] ?? 3) || a.i - b.i)
          .map(({ h }) => h)
        const frags: RankedFragment[] = hits.slice(0, maxItems - 1).map((h, i) => {
          const c = fromHit(h)
          const sk = sourceKindOf(c, g)
          c.bm = topBm * 1.5 - i * 0.01
          c.cov = 1
          return Object.assign(c, sk, { tier: tierOf(sk.sourceKind, sk.gradeDelta) })
        })
        const card = cardFragment(unit, lang, g, cardChars, topBm * 1.5 + 1, (items[0]?.score ?? 0) + 1)
        items = [card, ...frags]
        scopeUsed = 'school'
        curriculum = { unitId: unit.id, cite: unit.cite, viaRef: true, citeFull: card.citation }
      }
    }
    // (в) вопрос-определение: термин определён в учебнике класса ученика (термин целиком в вопросе) — вопрос школьный,
    //     даже если по словам он «широкий» («Что означает термин «вещество»?»): энциклопедия уходит, §-карточка — первой
    const wantsDef = !curriculum && !sectionRef && g != null && (sq.kind === 'definition' || sq.kind === 'properties') && sq.scope !== 'offtopic'
    // uz/en: термин вопроса целиком через словарь ru↔uz/en → русские стемы, как у такого же русского вопроса
    // («Valentlik deb nimaga aytiladi?» → «валентность» → § с определением валентности); перевод analyzeQuery шире
    // (синонимы, слова вопроса) и уводил к соседнему §. Нет полного перевода — как раньше, по queryTerms.
    const defTerms = wantsDef && lang !== 'ru' ? termStemsRu(sq.text, lang) : null
    // uz/en: термин вопроса = узбекский/английский термин определения карты класса — это определение (12.10, nextBuild #3;
    // brain/curriculum/answer.ts → definitionByTerm); иначе — по русским стемам перевода, как раньше
    const defByName = wantsDef && sq.kind === 'definition' && lang !== 'ru' ? definitionByTerm(cur, sq.text, lang, g) : null
    const defAny = defByName ?? (wantsDef && sq.kind === 'definition' ? ((defTerms && definitionFor(cur, defTerms, g)) || definitionFor(cur, queryTerms, g)) : null)
    const exactDef = !!defAny && defAny.inGrade && defAny.termCov === 1 && defAny.qCov === 1
    // понятие § (без определения в карте) точнее частичного совпадения определения: «общая формула» ≠ «развёрнутые формулы»
    // понятие § по названию на языке вопроса (у понятий карты есть uz/en-названия) — и для «что такое история химии?»,
    // который по словам похож на вопрос об истории (энциклопедия), а в программе это понятие § класса
    // (ru-определение и так находит понятие по русским стемам — там название только для «истории/применения»)
    const byName = !curriculum && !sectionRef && g != null && sq.scope !== 'offtopic' && !exactDef && NAME_KINDS.has(sq.kind) && (lang !== 'ru' || !wantsDef) ? conceptUnitByName(cur, sq.text, lang, g) : null
    // понятие по переводу термина — только когда определения в классе ученика не нашлось (иначе «Fosfor kislotasi»
    // уходил к перечню классов веществ §2 вместо § о фосфорной кислоте)
    const byConcept = wantsDef && !exactDef ? (conceptUnitFor(cur, queryTerms, g) || (defTerms && !defAny?.inGrade ? conceptUnitFor(cur, defTerms, g) : null) || (!(defAny?.inGrade && defAny.termCov === 1) ? byName : null)) : byName
    const defHit = byConcept ? null : defAny
    // «почему» с известной причиной (brain/curriculum/why.ts): § класса с этой темой — вопрос школьный
    const whyRule = !curriculum && !sectionRef && g != null && sq.kind === 'why' && sq.scope !== 'offtopic' ? whyRuleFor(sq.text) : null
    const byWhy = whyRule ? whyUnitFor(cur, whyRule, queryTerms, g) : null
    const strongDef = (!!defHit && defHit.inGrade && defHit.termCov === 1) || !!byConcept || !!byWhy
    if (strongDef && scopeUsed !== 'school') {
      scopeUsed = 'school'
      for (const f of items) if (!isSchoolSource(f)) dropped.push({ c: f, why: 'school_first' })
      items = items.filter(isSchoolSource)
    }
    if (!curriculum && !sectionRef && scopeUsed === 'school' && (sq.scope === 'school' || strongDef) && g != null && (!NO_CARD_KINDS.has(sq.kind) || !!byName)) {
      const byQuery = cur.unitsForQuery(queryTerms, g)[0]
      const bestSchool = items.find((f) => f.sourceKind === 'textbook_grade' && (f.cov ?? 0) >= 0.5)
      const bk = bestSchool ? hitKp.get(bestSchool) : undefined
      const byFragment = bk ? cur.unitFor(bk.grade, bk.kp) : null
      // определение — единица, где термин определён; «почему» — § класса по теме вопроса;
      // иначе: тема целиком в названии единицы → она; иначе единица лучшего фрагмента учебника класса; иначе по понятиям
      const byDef = defHit?.inGrade ? defHit.unit : null
      // тема «почему» — по вопросу и по понятиям ядра, о которых он (их определение и закон по-русски: «атом электронейтрален»
      // → протоны, электроны → строение атома), — так же, как темы единиц размечены по названию и понятиям
      const whyExtra = sq.kind === 'why' ? [sq.topic ?? '', ...findConcepts(sq.text).slice(0, 2).map((c) => `${c.def.ru} ${c.law.ru}`)].join(' ') : ''
      const byTopic = !byDef && !byConcept && sq.kind === 'why' ? (byWhy ?? unitForTopic(cur, sq.text, queryTerms, g, whyExtra)) : null
      const unit = byDef ?? byConcept ?? byTopic ?? (byQuery && byQuery.score >= 0.999 ? byQuery.unit : (byFragment ?? (byQuery && byQuery.score >= 0.5 ? byQuery.unit : null)))
      if (unit) {
        const page = byDef ? defHit!.def.page : undefined
        const card = cardFragment(unit, lang, g, cardChars, Math.max(0, ...items.map((f) => f.bm)) + 1, (items[0]?.score ?? 0) + 1, queryTerms, page)
        items = [card, ...items.filter((f) => f.id !== card.id)].slice(0, maxItems)
        curriculum = { unitId: unit.id, cite: unit.cite, viaRef: false, citeFull: card.citation, ...(byDef ? { defIndex: defHit!.index } : {}), ...(unit === byConcept ? { concept: true } : {}) }
      }
    }
  }

  // уверенность (по первому фрагменту)
  const best = items[0]
  let sTop = 0
  if (best) {
    const bmAbs = 1 - Math.exp(-best.bm / (best.origin === 'shard' ? 8 : 10))
    const vecAbs = best.cos != null ? Math.min(1, Math.max(0, (best.cos - 0.3) / 0.5)) : null
    sTop = vecAbs != null ? config.hybrid.wBm * bmAbs + config.hybrid.wVec * vecAbs : bmAbs
  }
  const conceptW = analyzed.conceptWeights
  let covered = 0
  let total = 0
  conceptW.forEach((w, ci) => {
    total += w
    const terms = analyzed.terms.filter((t) => t.concept === ci).map((t) => t.term)
    if (items.slice(0, 3).some((c) => terms.some((t) => c.terms.has(t)))) covered += w
  })
  const coverage = total ? covered / total : 0
  let confR = 0.6 * sTop + 0.4 * coverage
  // h) школьный вопрос без учебника своего/соседнего класса — честно «reasoned/medium», не «high»
  const schoolHit = items.some((f) => f.tier <= 2)
  if (scopeUsed === 'school' && !schoolHit) confR = Math.min(confR, config.thresholds.medium - 0.01)
  // §-карточка / ссылка на § — опора из учебника: не ниже «medium»
  if (curriculum) confR = Math.max(confR, config.thresholds.medium)
  const tiers: Partial<Record<SourceKind, number>> = {}
  for (const f of items) tiers[f.sourceKind] = (tiers[f.sourceKind] ?? 0) + 1
  return {
    items,
    confR,
    sTop,
    coverage,
    queryTerms,
    usedVectors,
    dropped: dropped.length,
    droppedTop: dropped.slice(0, 6).map((d) => ({ title: d.c.title.slice(0, 80), why: d.why })),
    ms: Math.round(performance.now() - t0),
    scopeUsed,
    schoolHit,
    encyclopediaUsed: items.some((f) => f.sourceKind === 'encyclopedia'),
    tiers,
    ...(curriculum ? { curriculum } : {}),
    ...(sectionRef ? { sectionRef } : {}),
  }
}

/** Виды вопроса, где термин можно искать по названию понятия § («что такое X?» может быть понят и как история/применение). */
const NAME_KINDS = new Set(['definition', 'properties', 'who_history', 'uses', 'general'])

/** uz/en: русские стемы термина вопроса через словарь (только полный перевод), иначе null. */
function termStemsRu(text: string, lang: 'uz' | 'en'): Set<string> | null {
  const term = termOfQuestion(text, lang)
  const ru = term ? termToRu(term, lang) : null
  if (!ru) return null
  const s = new Set(analyzeTerms(ru.join(' ')))
  return s.size ? s : null
}

function dotSafe(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!
  return s
}
