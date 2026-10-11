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
 *   одного фрагмента и не выше 3-го места. Уверенность conf_r = 0.6·s_top + 0.4·coverage (s_top — абсолютная сила
 *   лучшего совпадения, coverage — доля понятий вопроса в top-3); школьный вопрос без учебника — не выше «medium».
 */
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import type { KbChunkType, KbHit, KbLang } from '../../src/learn/kb/types.ts'
import { DEFAULT_CONFIG, type BrainConfig } from '../config.ts'
import type { EmbedStore } from '../kb/embedStore.ts'
import type { Journal, JournalRecord } from '../kb/journal.ts'
import type { Knowledge } from '../kb/shards.ts'
import { normForHash } from '../kb/storage.ts'
import type { LlmClient } from '../llm/ollama.ts'
import type { GradeId, RankedFragment, RetrievalResultV2, RetrieveOptions, Scope, SourceKind, StandaloneQuery } from './dialogTypes.ts'
import { findFormulas } from './entities.ts'
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

export function citationOf(source: string, title: string, kp?: string | null, page?: number | null, type?: string): string {
  if (/^Kimyo/i.test(source)) return `[${source}${kp ? `, §${kp}` : ''}${page ? `, стр. ${page}` : ''}]`
  if (type === 'encyclopedia' || /википед|wikipedia/i.test(source)) return `[Википедия: ${title} — CC BY-SA]`
  if (/^ATOMLAB/i.test(source)) return `[${source.replace(/\s+/g, ' ').slice(0, 80)}]`
  return `[${source.slice(0, 80)}]`
}

function fromHit(h: KbHit): Candidate {
  return {
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
}

function fromRecord(r: JournalRecord, score: number): Candidate {
  const cite = typeof r.meta.cite === 'string' ? r.meta.cite : r.kind === 'correction' ? '[ATOMLAB: правка учителя]' : citationOf(r.source || 'ATOMLAB: журнал', r.title, null, null)
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
  // слово вопроса начинается с основы варианта (uz-окончания: «valentligi», «kislotalar»); короткие слова — точно
  const hit = (w: string, a: string) => (a.length < 4 ? w === a : w.startsWith(a.length > 6 ? a.slice(0, a.length - 2) : a))
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
export async function retrieveV2(opts: RetrieveOptions, deps: RetrieveDeps, signal?: AbortSignal): Promise<RetrievalResultV2> {
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
  for (const ru of glossaryRuTerms(sq.text, lang, kb)) for (const term of analyzeTerms(ru, { query: true })) weighted.push({ term, weight: rc.glossaryWeight })
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
  }
}

function dotSafe(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!
  return s
}
