/**
 * Гибридное ранжирование кандидатов (BM25 шардов ∪ BM25 журнала ∪ векторы bge-m3):
 *   s_bm  = (bm25 − min) / (max − min + 1e-9) — по пулу своего источника (шкалы BM25F шардов и BM25 журнала разные);
 *   s_vec = max(0, cos(q, d)) при наличии векторов;
 *   s     = 0.55·s_bm + 0.45·s_vec, если у кандидата есть вектор, иначе s = s_bm;
 *   бонусы: заголовок совпал с ключевым термином ×1.15, тот же класс ×1.1, правка учителя (correction) ×1.25.
 * Разнообразие — MMR (λ = 0.7): косинус между выбранными, без векторов — Жаккар основ слов.
 * Альтернатива для сравнения — RRF: Σ 1/(60 + rank_i) (rrfScores).
 */
export type Candidate = {
  key: string
  id: string
  title: string
  text: string
  type: string
  lang: string
  grade: number | null
  source: string
  citation: string
  origin: 'shard' | 'journal'
  kind?: string
  bm: number
  sBm: number
  vec: Float32Array | null
  cos: number | null
  score: number
  terms: Set<string>
  titleTerms: Set<string>
}

export type HybridOptions = { wBm: number; wVec: number; grade: number | null; queryTerms: Set<string> }

function normalizeWithin(list: Candidate[]): void {
  if (!list.length) return
  let min = Infinity
  let max = -Infinity
  for (const c of list) {
    min = Math.min(min, c.bm)
    max = Math.max(max, c.bm)
  }
  for (const c of list) c.sBm = list.length === 1 ? 1 : (c.bm - min) / (max - min + 1e-9)
}

export function hybridScore(cands: Candidate[], opts: HybridOptions): void {
  normalizeWithin(cands.filter((c) => c.origin === 'shard'))
  normalizeWithin(cands.filter((c) => c.origin === 'journal'))
  for (const c of cands) {
    let s = c.cos != null ? opts.wBm * c.sBm + opts.wVec * Math.max(0, c.cos) : c.sBm
    if ([...c.titleTerms].some((t) => opts.queryTerms.has(t))) s *= 1.15
    if (opts.grade != null && c.grade === opts.grade) s *= 1.1
    if (c.kind === 'correction') s *= 1.25
    c.score = s
  }
}

/** Reciprocal Rank Fusion (для сравнения): Σ 1/(60 + rank) по спискам рангов. */
export function rrfScores(rankings: string[][], k = 60): Map<string, number> {
  const out = new Map<string, number>()
  for (const list of rankings) list.forEach((key, i) => out.set(key, (out.get(key) ?? 0) + 1 / (k + i + 1)))
  return out
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

function similarity(a: Candidate, b: Candidate): number {
  if (a.vec && b.vec && a.vec.length === b.vec.length) {
    let s = 0
    for (let i = 0; i < a.vec.length; i++) s += a.vec[i]! * b.vec[i]!
    return s
  }
  return jaccard(a.terms, b.terms)
}

/** MMR: λ·score − (1−λ)·max sim к уже выбранным; не больше topK и maxChars. */
export function mmrSelect(cands: Candidate[], lambda: number, topK: number, maxChars: number): Candidate[] {
  const pool = [...cands].sort((a, b) => b.score - a.score).slice(0, 40)
  const out: Candidate[] = []
  let chars = 0
  const top = pool[0]?.score || 1
  while (pool.length && out.length < topK) {
    let best = -1
    let bestVal = -Infinity
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i]!
      const maxSim = out.length ? Math.max(...out.map((o) => similarity(c, o))) : 0
      const val = lambda * (c.score / top) - (1 - lambda) * maxSim
      if (val > bestVal) {
        bestVal = val
        best = i
      }
    }
    const pick = pool.splice(best, 1)[0]!
    if (out.length && similarity(pick, out[0]!) > 0.9) continue // почти дубликат
    if (chars + Math.min(pick.text.length, 1200) > maxChars && out.length) break
    chars += Math.min(pick.text.length, 1200)
    out.push(pick)
  }
  return out
}
