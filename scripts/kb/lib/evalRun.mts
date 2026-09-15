import fs from 'node:fs'
import path from 'node:path'
import { KbEngine, type KbTuning } from '../../../src/learn/kb/engine.ts'
import { SHARD_NAMES, type KbLexiconFile, type KbShardFile } from '../../../src/learn/kb/shardFormat.ts'
import { analyzeTerms } from '../../../src/learn/kb/analyzer.ts'
import { answerTerms, bearsAnswer, sectionKey, type EvalItem } from './evalSet.mts'

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..')
export const INDEX_DIR = path.join(ROOT, 'src', 'data', 'kb', 'index')

export function loadEngine(tuning: Partial<KbTuning> = {}): { engine: KbEngine; loadMs: Record<string, number> } {
  const engine = new KbEngine(tuning)
  const loadMs: Record<string, number> = {}
  let t = performance.now()
  engine.setLexicon(JSON.parse(fs.readFileSync(path.join(INDEX_DIR, 'kb-lexicon.json'), 'utf8')) as KbLexiconFile)
  loadMs.lexicon = performance.now() - t
  for (const name of SHARD_NAMES) {
    const raw = fs.readFileSync(path.join(INDEX_DIR, `kb-index-${name}.json`), 'utf8')
    t = performance.now()
    engine.addShard(JSON.parse(raw) as KbShardFile)
    loadMs[name] = performance.now() - t
  }
  return { engine, loadMs }
}

/** Sections (and "-<chunkId>" keys) present in the index; questions about anything else are unanswerable. */
export function indexedSections(engine: KbEngine): Set<string> {
  const out = new Set<string>()
  for (const s of engine.shards.values()) {
    for (const d of s.docs) {
      const k = sectionKey(d[1], d[2], d[3])
      if (k) out.add(k)
      out.add(`-${d[0]}`)
    }
  }
  return out
}

export type RunOptions = { useGrade: boolean; variant: 'q' | 'qa'; limit?: number }
/**
 * rank: 1-based rank of the first hit in a gold section (0 = not in the top-k).
 * ans:  1-based rank of the first hit whose text bears the quiz answer (0 = none, -1 = item has no checkable answer).
 */
export type ItemResult = { item: EvalItem; rank: number; ans: number; ms: number; top: string[] }

const termCache = new Map<string, Set<string>>()
function chunkTerms(id: string, text: string): Set<string> {
  let t = termCache.get(id)
  if (!t) {
    t = new Set(analyzeTerms(text))
    termCache.set(id, t)
  }
  return t
}

/** Rank of the first text (in order) that bears the answer; -1 when the answer cannot be checked. */
export function answerRank(item: EvalItem, texts: { id: string; text: string }[]): number {
  const aTerms = answerTerms(item.answer)
  if (!aTerms) return -1
  const idx = texts.findIndex((x) => bearsAnswer(chunkTerms(x.id, x.text), aTerms))
  return idx < 0 ? 0 : idx + 1
}

export function runItems(engine: KbEngine, items: EvalItem[], opts: RunOptions): ItemResult[] {
  const out: ItemResult[] = []
  for (const item of items) {
    const query = opts.variant === 'qa' ? (item.queryQA ?? item.query) : item.query
    const t = performance.now()
    const hits = engine.search(query, { grade: opts.useGrade ? item.grade : undefined, locale: item.lang, limit: opts.limit ?? 10 })
    const ms = performance.now() - t
    const keys = hits.map((h) => sectionKey(h.grade, h.chapterId, h.sectionId) ?? `-${h.id}`)
    const gold = new Set(item.gold)
    const idx = keys.findIndex((k) => gold.has(k))
    const ans = answerRank(item, hits.map((h) => ({ id: h.id, text: `${h.title}
${h.text}` })))
    out.push({ item, rank: idx < 0 ? 0 : idx + 1, ans, ms, top: keys.slice(0, 3) })
  }
  return out
}

export type Metrics = {
  n: number
  r1: number
  r5: number
  r10: number
  mrr: number
  /** items with a checkable answer, and the share whose answer is in a top-5 / top-10 text */
  na: number
  a5: number
  a10: number
  p50: number
  p95: number
}

export function metrics(results: { rank: number; ans?: number; ms: number }[]): Metrics {
  const n = results.length
  if (!n) return { n: 0, r1: 0, r5: 0, r10: 0, mrr: 0, na: 0, a5: 0, a10: 0, p50: 0, p95: 0 }
  const within = (k: number) => results.filter((r) => r.rank > 0 && r.rank <= k).length / n
  const withAns = results.filter((r) => r.ans != null && r.ans >= 0)
  const na = withAns.length
  const ansWithin = (k: number) => (na ? withAns.filter((r) => r.ans! > 0 && r.ans! <= k).length / na : 0)
  const mrr = results.reduce((s, r) => s + (r.rank > 0 && r.rank <= 10 ? 1 / r.rank : 0), 0) / n
  const ms = results.map((r) => r.ms).sort((a, b) => a - b)
  const pct = (p: number) => ms[Math.min(ms.length - 1, Math.floor(p * (ms.length - 1)))]
  return { n, r1: within(1), r5: within(5), r10: within(10), mrr, na, a5: ansWithin(5), a10: ansWithin(10), p50: pct(0.5), p95: pct(0.95) }
}

export function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const r of rows) {
    const k = key(r)
    const list = m.get(k)
    if (list) list.push(r)
    else m.set(k, [r])
  }
  return m
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`.padStart(6)
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : ms.toFixed(2)).padStart(8)

export function formatTable(title: string, rows: [string, Metrics][]): string {
  const lines = [
    title,
    `${'group'.padEnd(14)} ${'n'.padStart(4)}  ${'R@1'.padStart(6)} ${'R@5'.padStart(6)} ${'R@10'.padStart(6)} ${'MRR'.padStart(6)}  ${'nA'.padStart(4)} ${'A@5'.padStart(6)} ${'A@10'.padStart(6)}  ${'p50ms'.padStart(8)} ${'p95ms'.padStart(8)}`,
  ]
  for (const [name, m] of rows) {
    lines.push(
      `${name.padEnd(14)} ${String(m.n).padStart(4)}  ${pct(m.r1)} ${pct(m.r5)} ${pct(m.r10)} ${m.mrr.toFixed(3).padStart(6)}  ${String(m.na).padStart(4)} ${m.na ? pct(m.a5) : '    - '} ${m.na ? pct(m.a10) : '    - '}  ${fmtMs(m.p50)} ${fmtMs(m.p95)}`,
    )
  }
  return lines.join('\n')
}

export function summarize(results: ItemResult[]): [string, Metrics][] {
  const rows: [string, Metrics][] = []
  const byGrade = groupBy(results.filter((r) => !r.item.id.startsWith('card-')), (r) => `g${r.item.grade}-${r.item.lang}`)
  const order = [...byGrade.keys()].sort((a, b) => {
    const [ga, la] = a.split('-')
    const [gb, lb] = b.split('-')
    return Number(ga.slice(1)) - Number(gb.slice(1)) || ['ru', 'en', 'uz'].indexOf(la) - ['ru', 'en', 'uz'].indexOf(lb)
  })
  for (const k of order) rows.push([k, metrics(byGrade.get(k)!)])
  const cards = results.filter((r) => r.item.id.startsWith('card-'))
  if (cards.length) rows.push(['cards', metrics(cards)])
  for (const lang of ['ru', 'en', 'uz']) {
    const sub = results.filter((r) => r.item.lang === lang)
    if (sub.length) rows.push([`ALL-${lang}`, metrics(sub)])
  }
  rows.push(['ALL', metrics(results)])
  return rows
}
