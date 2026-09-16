/**
 * Serialized index formats (written by scripts/kb/build-index.mts, read by the runtime engine).
 *
 * Shard (src/data/kb/index/kb-index-<name>.json):
 *   docs[i] = [id, grade, chapterId, sectionId, kp, title, pageStart, pageEnd, type, lang, source, text]
 *             (optional fields are null)
 *   lens    = flat [titleLen, keywordsLen, textLen] per doc (analyzed term counts)
 *   terms   = "\n"-joined sorted term list; df[t] = document frequency of term t over ALL shards
 *   offs[t] = byte offset of term t's postings inside `post` (length terms + 1)
 *   post    = base64 of a varint stream; per posting: docDelta, tfTitle, tfKeywords, tfText
 * Global stats (N, avg field lengths) are identical in every shard, so scores are comparable
 * whichever shards are loaded.
 */
import type { KbChunkType, KbLang } from './types'

export const SHARD_FORMAT_VERSION = 1

export type ShardDoc = [
  id: string,
  grade: number | null,
  chapterId: string | null,
  sectionId: string | null,
  kp: string | null,
  title: string,
  pageStart: number | null,
  pageEnd: number | null,
  type: KbChunkType,
  lang: KbLang,
  source: string,
  text: string,
]

export type KbShardFile = {
  v: number
  analyzer: number
  shard: string
  N: number
  avg: [number, number, number]
  docs: ShardDoc[]
  lens: number[]
  terms: string
  df: number[]
  offs: number[]
  post: string
}

/**
 * Query-side expansion table (src/data/kb/index/kb-lexicon.json).
 * Key: "<ns>:<analyzed terms joined by space>", ns = ru | en | uz | f (formula / element symbol).
 * Value: list of [analyzed Russian (or formula) term sequence, weight].
 */
export type KbLexiconFile = {
  v: number
  analyzer: number
  maxPhrase: number
  phrases: Record<string, [string, number][]>
}

/** 'book' (r10): generated textbook index chunks (type 'index') with their own statistics — scripts/kb/lib/bookIndex.mts. */
export const SHARD_NAMES = ['common', 'g7', 'g8', 'g9', 'g10', 'g11', 'book'] as const
export type ShardName = (typeof SHARD_NAMES)[number]
