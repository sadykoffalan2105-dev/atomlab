/**
 * Простой BM25 (k1 = 1.2, b = 0.75) над записями журнала. Термы — стеммы анализатора базы знаний
 * (src/learn/kb/analyzer.ts), поэтому запрос и документы говорят на одном «языке основ».
 * Индекс дополняется по одной записи (инкрементально при /kb/append) и сохраняется в derived/.
 */
export type WeightedTerm = { term: string; weight: number }

export type Bm25Json = { v: 1; analyzer: number; lines: number; ids: string[]; lens: number[]; post: Record<string, number[]> }

export class Bm25 {
  readonly k1 = 1.2
  readonly b = 0.75
  ids: string[] = []
  lens: number[] = []
  /** term → плоский список [docIdx, tf, docIdx, tf, …] */
  post = new Map<string, number[]>()
  private totalLen = 0
  private idIndex = new Map<string, number>()

  get size(): number {
    return this.ids.length
  }

  has(id: string): boolean {
    return this.idIndex.has(id)
  }

  docIndex(id: string): number | undefined {
    return this.idIndex.get(id)
  }

  add(id: string, terms: readonly string[]): number {
    const existing = this.idIndex.get(id)
    if (existing !== undefined) return existing
    const doc = this.ids.length
    this.ids.push(id)
    this.lens.push(terms.length)
    this.idIndex.set(id, doc)
    this.totalLen += terms.length
    const tf = new Map<string, number>()
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1)
    for (const [t, n] of tf) {
      let list = this.post.get(t)
      if (!list) this.post.set(t, (list = []))
      list.push(doc, n)
    }
    return doc
  }

  df(term: string): number {
    return (this.post.get(term)?.length ?? 0) / 2
  }

  search(query: readonly WeightedTerm[], limit = 30, accept?: (doc: number) => boolean): { doc: number; score: number }[] {
    const N = this.ids.length
    if (!N || !query.length) return []
    const avg = this.totalLen / N || 1
    const scores = new Map<number, number>()
    const seen = new Set<string>()
    for (const { term, weight } of query) {
      if (seen.has(term)) continue
      seen.add(term)
      const list = this.post.get(term)
      if (!list) continue
      const df = list.length / 2
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
      for (let i = 0; i < list.length; i += 2) {
        const doc = list[i]!
        const tf = list[i + 1]!
        const norm = tf + this.k1 * (1 - this.b + (this.b * this.lens[doc]!) / avg)
        scores.set(doc, (scores.get(doc) ?? 0) + weight * idf * ((tf * (this.k1 + 1)) / norm))
      }
    }
    const out: { doc: number; score: number }[] = []
    for (const [doc, score] of scores) if (!accept || accept(doc)) out.push({ doc, score })
    out.sort((a, b) => b.score - a.score)
    return out.slice(0, limit)
  }

  toJSON(lines: number, analyzer: number): Bm25Json {
    return { v: 1, analyzer, lines, ids: this.ids, lens: this.lens, post: Object.fromEntries(this.post) }
  }

  static fromJSON(j: Bm25Json): Bm25 {
    const b = new Bm25()
    b.ids = j.ids
    b.lens = j.lens
    b.post = new Map(Object.entries(j.post))
    b.totalLen = j.lens.reduce((s, x) => s + x, 0)
    j.ids.forEach((id, i) => b.idIndex.set(id, i))
    return b
  }
}
