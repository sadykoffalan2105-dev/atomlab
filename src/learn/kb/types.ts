/** Public contract of the ATOMLAB knowledge base (src/learn/kb). Keep stable: other modules depend on it. */

/**
 * 'index' (r10): generated textbook index facts (formula and name of a substance, a reaction with its products, the
 * reactions and substances of a §, where a substance is in the book) — shard 'book'; searched only with types: ['index'].
 */
export type KbChunkType = 'textbook' | 'definition' | 'summary' | 'card' | 'quiz' | 'faq' | 'misconception' | 'index'
export type KbLang = 'ru' | 'en' | 'uz'

export type KbChunk = {
  id: string
  grade: number | null
  chapterId?: string
  sectionId?: string
  /** Paragraph / topic number as printed in the book: "23" (§23) or "2.3" (chapter 2, topic 3). */
  kp?: string
  title: string
  pageStart?: number
  pageEnd?: number
  type: KbChunkType
  lang: KbLang
  text: string
  /** "Kimyo 8" for textbooks, "ATOMLAB: …" for generated cards. */
  source: string
}

export type KbHit = KbChunk & { score: number }

export type KbSearchOptions = {
  /** Student's grade: boosts that grade (other grades still match, with a penalty). */
  grade?: number
  /** Current chapter ("c2") within `grade`: boost. */
  chapterId?: string
  /** Current section ("s03") within `grade`/`chapterId`: stronger boost. */
  sectionId?: string
  limit?: number
  /** Only return these chunk types. */
  types?: KbChunkType[]
  /** Query language; detected from the script when omitted. */
  locale?: KbLang
}
