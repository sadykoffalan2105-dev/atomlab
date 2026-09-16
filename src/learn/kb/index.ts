/**
 * ATOMLAB knowledge base: offline textbook + reference search for the AI teacher.
 *
 * Data: prebuilt BM25F shards in src/data/kb/index (npm run kb:index). They are loaded with dynamic
 * import(), so Vite emits them as separate chunks: nothing lands in the initial bundle, and loading works
 * the same on GitHub Pages (sub-path base) and in Electron over file:// (no fetch of file URLs).
 * The student's grade loads first; other grades follow in the background.
 *
 *   await preloadKnowledge({ grade: 8 })
 *   const hits = await searchKnowledge('что такое оксиды', { grade: 8, limit: 6 })
 *   const block = formatKnowledgeForPrompt(hits, 8000)
 */
import { KbEngine } from './engine'
import type { KbLexiconFile, KbShardFile, ShardName } from './shardFormat'
import type { KbChunkType, KbHit, KbSearchOptions } from './types'

export type { KbChunk, KbChunkType, KbHit, KbLang, KbSearchOptions } from './types'
export { citationFor, formatKnowledgeForPrompt } from './format'

type JsonModule = { default: unknown }

const IMPORTERS: Record<ShardName | 'lexicon', () => Promise<JsonModule>> = {
  lexicon: () => import('../../data/kb/index/kb-lexicon.json'),
  common: () => import('../../data/kb/index/kb-index-common.json'),
  g7: () => import('../../data/kb/index/kb-index-g7.json'),
  g8: () => import('../../data/kb/index/kb-index-g8.json'),
  g9: () => import('../../data/kb/index/kb-index-g9.json'),
  g10: () => import('../../data/kb/index/kb-index-g10.json'),
  g11: () => import('../../data/kb/index/kb-index-g11.json'),
  // r10: textbook index (formulas, reactions, § contents, pages) — loaded on the first request for types: ['index']
  book: () => import('../../data/kb/index/kb-index-book.json'),
}

const GRADE_SHARDS: ShardName[] = ['g7', 'g8', 'g9', 'g10', 'g11']

const engine = new KbEngine()
const pending = new Map<string, Promise<void>>()
const timings: Record<string, number> = {}
let backgroundScheduled = false

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function load(name: ShardName | 'lexicon'): Promise<void> {
  if (name === 'lexicon' ? engine.hasLexicon : engine.hasShard(name)) return Promise.resolve()
  let p = pending.get(name)
  if (!p) {
    const t0 = now()
    p = IMPORTERS[name]()
      .then((mod) => {
        const data = mod.default
        if (name === 'lexicon') engine.setLexicon(data as KbLexiconFile)
        else engine.addShard(data as KbShardFile)
        timings[name] = Math.round(now() - t0)
      })
      .catch((err: unknown) => {
        pending.delete(name) // allow a retry on the next call
        console.warn(`[kb] failed to load ${name}`, err)
      })
    pending.set(name, p)
  }
  return p
}

function shardForGrade(grade: number | undefined): ShardName | null {
  if (grade == null) return null
  const name = `g${grade}` as ShardName
  return GRADE_SHARDS.includes(name) ? name : null
}

function idle(fn: () => void) {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  if (ric) ric(fn, { timeout: 2000 })
  else setTimeout(fn, 50)
}

function scheduleBackground(grade: number | undefined) {
  if (backgroundScheduled) return
  backgroundScheduled = true
  const order: ShardName[] = [...GRADE_SHARDS].sort((a, b) => {
    const ga = Number(a.slice(1))
    const gb = Number(b.slice(1))
    return grade == null ? ga - gb : Math.abs(ga - grade) - Math.abs(gb - grade)
  })
  order.push('book') // r10: textbook index last
  const next = () => {
    const name = order.shift()
    if (!name) return
    void load(name).then(() => idle(next))
  }
  idle(next)
}

/**
 * Load the knowledge needed for `grade` (lexicon, reference cards, that grade's textbook) and start
 * loading the other grades in the background. Without a grade every shard is loaded before resolving.
 * Safe to call repeatedly.
 */
export async function preloadKnowledge(opts: { grade?: number } = {}): Promise<void> {
  const own = shardForGrade(opts.grade)
  if (own) {
    await Promise.all([load('lexicon'), load('common'), load(own)])
    scheduleBackground(opts.grade)
  } else {
    await Promise.all([load('lexicon'), load('common'), load('book'), ...GRADE_SHARDS.map((g) => load(g))])
  }
}

/**
 * Search the knowledge base. Resolves once the lexicon, reference cards and the requested grade are
 * loaded; other grades are searched as soon as their background load finishes.
 */
export async function searchKnowledge(query: string, opts: KbSearchOptions = {}): Promise<KbHit[]> {
  if (!query.trim()) return []
  await preloadKnowledge({ grade: opts.grade })
  if (opts.types?.includes('index')) await load('book')
  return engine.search(query, opts)
}

/** Load the textbook index shard (types: ['index']) — searchKnowledge does it on request; getChunksById needs it loaded. */
export function preloadBookIndex(): Promise<void> {
  return load('book')
}

/** Chunks by id from the already loaded shards (neighbour chunks of a hit: "g9-p17-t01" → "g9-p17-t02"). */
export function getChunksById(ids: readonly string[]): KbHit[] {
  return engine.chunksById(ids)
}

/** All loaded chunks of one printed paragraph (grade + kp), optionally filtered by type, in book order. */
export function getParagraphChunks(grade: number, kp: string, types?: readonly KbChunkType[]): KbHit[] {
  return engine.paragraphChunks(grade, kp, types)
}

/** Diagnostics: loaded shards, document count and per-shard load time (ms). */
export function getKnowledgeStatus(): { shards: string[]; docs: number; loadMs: Record<string, number> } {
  return { shards: [...engine.shards.keys()], docs: engine.docCount, loadMs: { ...timings } }
}
