/**
 * Шаг 6: поиск знаний.
 *   BM25F по шардам учебников (limit 30, класс/глава/параграф из контекста, типы textbook/definition/summary/card/faq/misconception);
 *   энциклопедия и указатель — при вопросах «кто/история/промышленность» или когда школьные ответы слабые;
 *   ∪ BM25 журнала (brain/kb/journal.ts) ∪ векторы bge-m3 (если Ollama + эмбеддинги есть).
 * Затем hybrid.ts: нормировка, веса, бонусы, MMR → top-6 (≤ 5000 символов) и уверенность
 *   conf_r = 0.6·s_top + 0.4·coverage, где s_top — абсолютная (калиброванная) сила лучшего совпадения,
 *   coverage — доля понятий вопроса, встреченных в top-3.
 */
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import type { KbChunkType, KbHit, KbLang } from '../../src/learn/kb/types.ts'
import type { BrainConfig } from '../config.ts'
import type { EmbedStore } from '../kb/embedStore.ts'
import type { Journal, JournalRecord } from '../kb/journal.ts'
import type { Knowledge } from '../kb/shards.ts'
import { normForHash } from '../kb/storage.ts'
import type { LlmClient } from '../llm/ollama.ts'
import { hybridScore, mmrSelect, type Candidate } from './hybrid.ts'
import type { Lang } from './normalize.ts'
import { normalizeVec } from '../kb/embedStore.ts'

const SCHOOL_TYPES: KbChunkType[] = ['textbook', 'definition', 'summary', 'card', 'faq', 'misconception']

export type RetrieveContext = { gradeId?: string; chapterId?: string; sectionId?: string }

export type RetrievalResult = {
  items: Candidate[]
  confR: number
  sTop: number
  coverage: number
  queryTerms: Set<string>
  usedVectors: boolean
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

export async function retrieve(
  text: string,
  lang: Lang,
  ctx: RetrieveContext,
  wantEncyclopedia: boolean,
  deps: RetrieveDeps,
  signal?: AbortSignal,
): Promise<RetrievalResult> {
  const t0 = performance.now()
  const { kb, journal, config } = deps
  const grade = gradeNum(ctx.gradeId)
  const locale = lang as KbLang
  const school = kb.engine.search(text, {
    grade: grade ?? undefined,
    chapterId: grade ? ctx.chapterId : undefined,
    sectionId: grade ? ctx.sectionId : undefined,
    limit: 30,
    types: SCHOOL_TYPES,
    locale,
  })
  const topSchool = school[0]?.score ?? 0
  let extra: KbHit[] = []
  if (wantEncyclopedia || topSchool < config.thresholds.schoolMin) {
    extra = kb.engine.search(text, { limit: 10, types: ['encyclopedia'], locale })
    if (topSchool < config.thresholds.schoolMin) extra.push(...kb.engine.search(text, { limit: 5, types: ['index'], locale }))
  }
  const analyzed = kb.engine.analyzeQuery(text, locale)
  const queryTerms = new Set(analyzed.terms.map((t) => t.term))
  const weighted = [...analyzed.terms.map((t) => ({ term: t.term, weight: t.weight })), ...analyzeTerms(text, { query: true }).map((term) => ({ term, weight: 1 }))]
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

  hybridScore(cands, { wBm: config.hybrid.wBm, wVec: config.hybrid.wVec, grade, queryTerms })
  const items = mmrSelect(cands, config.hybrid.mmrLambda, config.hybrid.topK, config.hybrid.maxChars)

  // уверенность
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
  const confR = 0.6 * sTop + 0.4 * coverage
  return { items, confR, sTop, coverage, queryTerms, usedVectors, ms: Math.round(performance.now() - t0) }
}

function dotSafe(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!
  return s
}
