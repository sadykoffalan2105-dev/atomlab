/**
 * ML-поиск учителя: семантические векторы основ (scripts/teacher-ml/train-vectors.mts → src/data/kb/index/kb-vectors.json).
 *
 * Векторы обучены на корпусе учебников Kimyo 7–11 (PPMI + понижение размерности до 64), без внешних моделей.
 * Здесь они используются двумя способами:
 *   - expandQuery: основа запроса, которой нет в индексе (опечатка) или которая редка, получает до 3 соседей
 *     (исправление по редакционному расстоянию среди словаря векторов + ближайшие по косинусу) с весом 0,5;
 *     частая известная основа получает только морфологические варианты-соседи (атом ↔ ат, галог ↔ галоген);
 *   - rerankHits: первые кандидаты BM25F умножаются на 0,75 + 0,5·max(0, cos(запрос, чанк)).
 *
 * Загрузка ленивая (dynamic import — отдельный чанк Vite, как и шарды индекса). Пока векторы не загружены или
 * при любой ошибке поиск работает как раньше: все функции возвращают null / пустой список / исходный порядок.
 */
import { analyzeTokens } from './analyzer'
import type { AnalyzedQuery, KbEngine, SemanticHooks } from './engine'

export type KbVectorsFile = {
  version: number
  dim: number
  docs: number
  /** основы через "\n" в порядке убывания частоты */
  vocab: string
  idf: number[]
  /** base64 int8, нормированные векторы × 127 */
  vectors: string
}

type Model = {
  dim: number
  vocab: string[]
  index: Map<string, number>
  vec: Float32Array
  idf: Float32Array
  /** словарь по первым двум буквам — для поиска исправлений опечаток */
  buckets: Map<string, number[]>
}

export type SemanticTuning = {
  /** соседей на одну основу запроса */
  maxPerStem: number
  /** минимальный косинус соседа (для редких / неизвестных основ) */
  minCos: number
  /** косинус для морфологических вариантов частых основ */
  variantCos: number
  /** вес добавленной основы относительно исходной */
  weight: number
  /** основа считается редкой при df в индексе ниже этого порога */
  rareDf: number
  /** переранжирование: score × (floor + gain × max(0, cos)) */
  rerankFloor: number
  rerankGain: number
  rerankDepth: number
}

export const DEFAULT_SEMANTIC: SemanticTuning = {
  maxPerStem: 3,
  minCos: 0.45,
  variantCos: 0.6,
  weight: 0.5,
  rareDf: 3,
  rerankFloor: 0.75,
  rerankGain: 0.5,
  rerankDepth: 30,
}

let tuning: SemanticTuning = { ...DEFAULT_SEMANTIC }
export function setSemanticTuning(t: Partial<SemanticTuning>) {
  tuning = { ...DEFAULT_SEMANTIC, ...t }
}

/**
 * Пары, которые часто стоят рядом в тексте (и потому близки по вектору), но означают противоположное —
 * их нельзя подставлять друг вместо друга при расширении запроса.
 */
const ANTONYM_STEMS: [string, string][] = [
  ['окислител', 'восстановител'],
  ['окислен', 'восстановлен'],
  ['окисля', 'восстанавлива'],
  ['катион', 'анион'],
  ['металл', 'неметалл'],
  ['экзотермическ', 'эндотермическ'],
  ['кислот', 'щелоч'],
  ['кислот', 'основан'],
  ['кислотн', 'основн'],
  ['раствор', 'осадок'],
  ['обратим', 'необратим'],
  ['электролит', 'неэлектролит'],
  ['насыщен', 'ненасыщен'],
  ['предельн', 'непредельн'],
  ['oksidlovchi', 'qaytaruvchi'],
  ['oxidizing', 'reducing'],
]
const antonymKey = (a: string, b: string) => (a < b ? `${a}\n${b}` : `${b}\n${a}`)
const ANTONYMS = new Set(ANTONYM_STEMS.map(([a, b]) => antonymKey(a, b)))
function isAntonym(a: string, b: string): boolean {
  return ANTONYMS.has(antonymKey(a, b))
}

// ---------------------------------------------------------------- загрузка

let model: Model | null = null
let loading: Promise<boolean> | null = null

function decodeBase64(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
    return out
  }
  const B = (globalThis as { Buffer?: { from(s: string, enc: string): Uint8Array } }).Buffer
  if (B) return B.from(b64, 'base64')
  throw new Error('base64 decoder unavailable')
}

/** Подключить векторы из уже прочитанного файла (Node: eval и тесты; браузер делает это сам через loadSemanticVectors). */
export function setSemanticVectors(file: KbVectorsFile): void {
  const vocab = file.vocab.split('\n')
  const dim = file.dim
  const bytes = decodeBase64(file.vectors)
  const q = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const vec = new Float32Array(vocab.length * dim)
  for (let i = 0; i < vocab.length; i += 1) {
    let n = 0
    for (let d = 0; d < dim; d += 1) n += q[i * dim + d] * q[i * dim + d]
    n = Math.sqrt(n) || 1
    for (let d = 0; d < dim; d += 1) vec[i * dim + d] = q[i * dim + d] / n
  }
  const index = new Map<string, number>()
  const buckets = new Map<string, number[]>()
  vocab.forEach((t, i) => {
    index.set(t, i)
    const key = t.slice(0, 2)
    const b = buckets.get(key)
    if (b) b.push(i)
    else buckets.set(key, [i])
  })
  model = { dim, vocab, index, vec, idf: Float32Array.from(file.idf), buckets }
  chunkCache.clear()
  neighborCache.clear()
  similarCache.clear()
}

/** Ленивая загрузка kb-vectors.json. Повторные вызовы возвращают тот же промис; ошибка → false, без исключений. */
export function loadSemanticVectors(): Promise<boolean> {
  if (model) return Promise.resolve(true)
  if (!loading) {
    loading = import('../../data/kb/index/kb-vectors.json')
      .then((mod) => {
        setSemanticVectors((mod as { default: KbVectorsFile }).default)
        return true
      })
      .catch((err: unknown) => {
        loading = null // можно повторить при следующем вызове
        console.warn('[kb] semantic vectors not loaded', err)
        return false
      })
  }
  return loading
}

export function semanticReady(): boolean {
  return model !== null
}

export function semanticVocabSize(): number {
  return model?.vocab.length ?? 0
}

// ---------------------------------------------------------------- векторы

export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i += 1) s += a[i] * b[i]
  return s
}

export function vectorOfTerm(term: string): Float32Array | null {
  if (!model) return null
  const i = model.index.get(term)
  if (i === undefined) return null
  return model.vec.subarray(i * model.dim, (i + 1) * model.dim)
}

export function idfOfTerm(term: string): number {
  if (!model) return 0
  const i = model.index.get(term)
  return i === undefined ? 0 : model.idf[i]
}

/** Нормированное idf-взвешенное среднее векторов основ (null, если ни одна основа не известна). */
export function vectorOfStems(stems: readonly string[], weights?: readonly number[]): Float32Array | null {
  if (!model) return null
  const acc = new Float32Array(model.dim)
  let used = 0
  for (let k = 0; k < stems.length; k += 1) {
    const i = model.index.get(stems[k])
    if (i === undefined) continue
    const w = (weights?.[k] ?? 1) * (model.idf[i] + 0.1)
    const off = i * model.dim
    for (let d = 0; d < model.dim; d += 1) acc[d] += w * model.vec[off + d]
    used += 1
  }
  if (!used) return null
  let n = 0
  for (let d = 0; d < model.dim; d += 1) n += acc[d] * acc[d]
  n = Math.sqrt(n) || 1
  for (let d = 0; d < model.dim; d += 1) acc[d] /= n
  return acc
}

/** Вектор запроса: текст (через общий анализатор) или готовые основы. */
export function vectorOfQuery(query: string | readonly string[], weights?: readonly number[]): Float32Array | null {
  const stems = typeof query === 'string' ? analyzeTokens(query, { query: true }).map((t) => t.term) : query
  return vectorOfStems(stems, weights)
}

const chunkCache = new Map<string, Float32Array | null>()
const CHUNK_CACHE_MAX = 6000

/** Вектор чанка по его тексту; кеш по id (считается при первом обращении). */
export function vectorOfChunk(id: string, text: string, title = ''): Float32Array | null {
  if (!model) return null
  const cached = chunkCache.get(id)
  if (cached !== undefined) return cached
  const stems = analyzeTokens(title ? `${title}\n${text}` : text).map((t) => t.term)
  const v = vectorOfStems(stems)
  if (chunkCache.size >= CHUNK_CACHE_MAX) chunkCache.clear()
  chunkCache.set(id, v)
  return v
}

const neighborCache = new Map<string, { term: string; cos: number }[]>()
const NEIGHBOR_CACHE_MAX = 4000

/** Ближайшие по косинусу основы словаря (сама основа исключена); кеш по основе. */
export function nearestTerms(term: string, k = 5): { term: string; cos: number }[] {
  if (!model) return []
  const key = `${term}\u0000${k}`
  const cached = neighborCache.get(key)
  if (cached) return cached
  const res = scanNearest(term, k)
  if (neighborCache.size >= NEIGHBOR_CACHE_MAX) neighborCache.clear()
  neighborCache.set(key, res)
  return res
}

function scanNearest(term: string, k: number): { term: string; cos: number }[] {
  if (!model) return []
  const v = vectorOfTerm(term)
  if (!v) return []
  const m = model
  const best: { term: string; cos: number }[] = []
  for (let j = 0; j < m.vocab.length; j += 1) {
    if (m.vocab[j] === term) continue
    const off = j * m.dim
    let s = 0
    for (let d = 0; d < m.dim; d += 1) s += v[d] * m.vec[off + d]
    if (best.length < k || s > best[best.length - 1].cos) {
      let pos = best.length
      while (pos > 0 && best[pos - 1].cos < s) pos -= 1
      best.splice(pos, 0, { term: m.vocab[j], cos: s })
      if (best.length > k) best.pop()
    }
  }
  return best
}

// ---------------------------------------------------------------- опечатки

/** Редакционное расстояние (Дамерау — Левенштейн, OSA) с отсечкой по max. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const la = a.length
  const lb = b.length
  let prev2: number[] = []
  let prev = Array.from({ length: lb + 1 }, (_, j) => j)
  for (let i = 1; i <= la; i += 1) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= lb; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur.push(v)
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev2 = prev
    prev = cur
  }
  return prev[lb]
}

const similarCache = new Map<string, { term: string; distance: number }[]>()

/**
 * Похожие основы словаря для неизвестной основы (исправление опечатки): редакционное расстояние ≤ 1 (короткие)
 * или ≤ 2, той же письменности; при равном расстоянии — замена букв (та же длина) раньше вставки/пропуска,
 * затем более частые. Правильная основа-префикс («валентн» для «валентнаст») тоже кандидат.
 */
export function similarStems(stem: string, k = 2): { term: string; distance: number }[] {
  if (!model || stem.length < 4) return []
  const key = `${stem}\u0000${k}`
  const cached = similarCache.get(key)
  if (cached) return cached
  const max = stem.length <= 5 ? 1 : 2
  const cyr = /[а-я]/.test(stem)
  const out: { term: string; distance: number; lenDiff: number; rank: number }[] = []
  const m = model
  for (let i = 0; i < m.vocab.length; i += 1) {
    const cand = m.vocab[i]
    if (cand === stem || cand.length < 4 || /[а-я]/.test(cand) !== cyr) continue
    const lenDiff = Math.abs(cand.length - stem.length)
    if (lenDiff <= max) {
      const d = editDistance(stem, cand, max)
      if (d <= max) {
        out.push({ term: cand, distance: d, lenDiff, rank: i })
        continue
      }
    }
    // основа словаря — префикс опечатки (стеммер не снял искажённое окончание)
    if (cand.length >= 5 && stem.length - cand.length <= 4 && stem.startsWith(cand)) {
      out.push({ term: cand, distance: 2, lenDiff: stem.length - cand.length, rank: i })
    }
  }
  out.sort((a, b) => a.distance - b.distance || a.lenDiff - b.lenDiff || a.rank - b.rank)
  const res = out.slice(0, k).map(({ term, distance }) => ({ term, distance }))
  if (similarCache.size >= NEIGHBOR_CACHE_MAX) similarCache.clear()
  similarCache.set(key, res)
  return res
}

// ---------------------------------------------------------------- расширение запроса

export type Expansion = { term: string; weight: number; source: string; why: 'typo' | 'neighbor' | 'variant' }

/** Морфологические варианты одной основы: общий префикс 4 буквы или одна основа — начало другой (ат → атом, cos ≥ 0,75). */
function sharesRoot(a: string, b: string, cos: number): boolean {
  const n = Math.min(a.length, b.length)
  if (n >= 4 && a.slice(0, 4) === b.slice(0, 4)) return true
  if (n >= 2 && (a.startsWith(b) || b.startsWith(a))) return n >= 4 || cos >= 0.75
  return false
}

/**
 * Дополнительные основы для основ запроса.
 *   df(term) — документная частота в индексе (0 — основы нет в индексе). Без df считается, что все основы известны.
 * Веса — доли от веса исходной основы (0..1).
 */
export function expandQuery(stems: readonly string[], df?: (term: string) => number): Expansion[] {
  if (!model) return []
  const T = tuning
  const out: Expansion[] = []
  const have = new Set(stems)
  const known = (t: string) => (df ? df(t) > 0 : model!.index.has(t))
  const push = (e: Expansion) => {
    if (have.has(e.term)) return
    if (!known(e.term)) return
    if (stems.some((s) => isAntonym(s, e.term))) return
    have.add(e.term)
    out.push(e)
  }
  for (const stem of stems) {
    if (!/^[a-zа-я]/.test(stem) || stem.length < 2) continue // формулы и символы не расширяем
    const inVocab = model.index.has(stem)
    const freq = df ? df(stem) : inVocab ? T.rareDf : 0
    let added = 0
    if (!inVocab || freq < T.rareDf) {
      // 1) исправления опечаток среди словаря векторов
      if (!inVocab || freq === 0) {
        for (const c of similarStems(stem, 2)) {
          if (added >= T.maxPerStem) break
          const before = out.length
          push({ term: c.term, weight: c.distance === 1 ? 0.7 : T.weight, source: stem, why: 'typo' })
          if (out.length > before) added += 1
        }
      }
      // 2) соседи по косинусу (самой основы или её исправления)
      const anchor = inVocab ? stem : out.find((e) => e.source === stem && e.why === 'typo')?.term
      if (anchor) {
        for (const nb of nearestTerms(anchor, T.maxPerStem + 3)) {
          if (added >= T.maxPerStem) break
          if (nb.cos < T.minCos) break
          if (isAntonym(anchor, nb.term)) continue
          const before = out.length
          push({ term: nb.term, weight: T.weight * Math.min(1, nb.cos / 0.8), source: stem, why: 'neighbor' })
          if (out.length > before) added += 1
        }
      }
    } else {
      // частая известная основа: только морфологические варианты (атом ↔ ат, галог ↔ галоген)
      for (const nb of nearestTerms(stem, 6)) {
        if (added >= 2) break
        if (nb.cos < T.variantCos) break
        if (!sharesRoot(stem, nb.term, nb.cos)) continue
        const before = out.length
        push({ term: nb.term, weight: T.weight, source: stem, why: 'variant' })
        if (out.length > before) added += 1
      }
    }
  }
  return out
}

// ---------------------------------------------------------------- переранжирование

/**
 * score' = score × (floor + gain × max(0, cos(запрос, чанк))). Возвращает новый массив, отсортированный по score;
 * без векторов (или если вектор запроса не построить) — исходный массив как есть.
 */
export function rerankHits<T extends { id: string; text: string; title?: string; score: number }>(
  query: string | readonly string[],
  hits: T[],
  depth = tuning.rerankDepth,
): T[] {
  if (!model || !hits.length) return hits
  const qv = vectorOfQuery(query)
  if (!qv) return hits
  const n = Math.min(depth, hits.length)
  const head = hits.slice(0, n).map((h) => {
    const cv = vectorOfChunk(h.id, h.text, h.title)
    const cos = cv ? Math.max(0, cosine(qv, cv)) : 0
    return { ...h, score: h.score * (tuning.rerankFloor + tuning.rerankGain * cos) }
  })
  head.sort((a, b) => b.score - a.score)
  return [...head, ...hits.slice(n)]
}

// ---------------------------------------------------------------- подключение к движку

/** Основы запроса, добавленные расширением (их не учитываем в векторе запроса). */
const expanded = new WeakMap<AnalyzedQuery, Set<string>>()

export const semanticHooks: SemanticHooks = {
  expandQuery(q, df) {
    if (!model) return
    const original = q.terms.filter((t) => t.weight > 0)
    const extra = expandQuery(
      original.map((t) => t.term),
      df,
    )
    if (!extra.length) return
    const byTerm = new Map(original.map((t) => [t.term, t]))
    const added = new Set<string>()
    for (const e of extra) {
      const src = byTerm.get(e.source)
      if (!src || byTerm.has(e.term)) continue
      q.terms.push({ term: e.term, weight: src.weight * e.weight, concept: src.concept })
      added.add(e.term)
    }
    if (added.size) expanded.set(q, added)
  },
  rerankHead(q, head) {
    if (!model || !head.length) return null
    const skip = expanded.get(q)
    const stems: string[] = []
    const weights: number[] = []
    for (const t of q.terms) {
      if (skip?.has(t.term)) continue
      stems.push(t.term)
      weights.push(t.weight)
    }
    const qv = vectorOfStems(stems, weights)
    if (!qv) return null
    const out = new Float64Array(head.length)
    for (let i = 0; i < head.length; i += 1) {
      const cv = vectorOfChunk(head[i].id, head[i].text, head[i].title)
      const cos = cv ? Math.max(0, cosine(qv, cv)) : 0
      out[i] = tuning.rerankFloor + tuning.rerankGain * cos
    }
    return out
  },
}

/** Подключить семантический слой к движку: векторы грузятся лениво, до загрузки движок работает как раньше. */
export function attachSemantic(engine: KbEngine): Promise<boolean> {
  engine.semantic = semanticHooks
  return loadSemanticVectors()
}
