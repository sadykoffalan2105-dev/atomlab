/**
 * ML-поиск учителя: семантические векторы основ, обученные на корпусе учебников Kimyo 7–11.
 *
 *   npx tsx scripts/teacher-ml/train-vectors.mts            → src/data/kb/index/kb-vectors.json (≤ 1,2 МБ)
 *                                                           → scripts/teacher-ml/vectors-neighbors.txt (sanity-проверка)
 *
 * Как устроено (без внешних моделей, всё на Float64Array):
 *   1) корпус src/data/kb/corpus/kb-corpus-*.json + глоссарий → токены общим анализатором (stemRussian + fold,
 *      формулы — отдельные токены, стоп-слова RU/EN/UZ выброшены);
 *   2) словарь: основы с частотой ≥ 3, не более 12 000 по частоте;
 *   3) матрица совместной встречаемости в окне ±5 с весом 1/расстояние (внутри чанка);
 *   4) PPMI со сглаживанием контекстов α = 0,75;
 *   5) понижение размерности до 64: рандомизированная симметричная декомпозиция (подпространственные итерации
 *      на разреженной матрице + метод Якоби для малой матрицы 80×80), векторы = U·√λ;
 *   6) нормировка, квантование в int8, base64.
 *
 * Факты в файле нет — только статистика слов корпуса; учитель по-прежнему цитирует учебники.
 */
import fs from 'node:fs'
import path from 'node:path'
import { analyzeTokens } from '../../src/learn/kb/analyzer'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const CORPUS_DIR = path.join(ROOT, 'src', 'data', 'kb', 'corpus')
const OUT_FILE = path.join(ROOT, 'src', 'data', 'kb', 'index', 'kb-vectors.json')
const NEIGHBORS_FILE = path.join(import.meta.dirname, 'vectors-neighbors.txt')

const DIM = 64
const OVERSAMPLE = 16 // ранг подпространства = DIM + OVERSAMPLE
const POWER_ITERS = 4
const WINDOW = 5
const MIN_FREQ = 3
const MAX_VOCAB = 12_000
const MAX_BYTES = 1.2 * 1024 * 1024
const PMI_ALPHA = 0.75

type Chunk = { id: string; title?: string; text: string; type?: string }

function loadChunks(): Chunk[] {
  const out: Chunk[] = []
  for (const f of fs.readdirSync(CORPUS_DIR)) {
    if (!/^kb-corpus-.*\.json$/.test(f)) continue
    const data = JSON.parse(fs.readFileSync(path.join(CORPUS_DIR, f), 'utf8')) as { chunks?: Chunk[] }
    for (const c of data.chunks ?? []) out.push(c)
  }
  // глоссарий: русское название + переводы + формула в одной «фразе» — связывает RU/EN/UZ/формулу
  const glossaryFile = path.join(CORPUS_DIR, 'kb-glossary.json')
  if (fs.existsSync(glossaryFile)) {
    const g = JSON.parse(fs.readFileSync(glossaryFile, 'utf8')) as {
      entries?: { ru?: string; en?: string[]; uz?: string[]; formula?: string[]; definition?: string }[]
    }
    for (const [i, e] of (g.entries ?? []).entries()) {
      const parts = [e.ru ?? '', ...(e.en ?? []), ...(e.uz ?? []), ...(e.formula ?? []), e.definition ?? ''].filter(Boolean)
      if (parts.length > 1) out.push({ id: `gloss-${i}`, text: parts.join(' . ') })
    }
  }
  return out
}

function log(msg: string) {
  console.log(`[vectors] ${msg}`)
}

// ---------------------------------------------------------------- 1. токены
const t0 = performance.now()
const chunks = loadChunks()
const docs: string[][] = []
const freq = new Map<string, number>()
const df = new Map<string, number>()
let totalTokens = 0
for (const c of chunks) {
  const terms = analyzeTokens(`${c.title ?? ''}\n${c.text}`).map((t) => t.term)
  if (!terms.length) continue
  docs.push(terms)
  totalTokens += terms.length
  const seen = new Set<string>()
  for (const t of terms) {
    freq.set(t, (freq.get(t) ?? 0) + 1)
    if (!seen.has(t)) {
      seen.add(t)
      df.set(t, (df.get(t) ?? 0) + 1)
    }
  }
}
log(`чанков ${docs.length}, токенов ${totalTokens}, уникальных основ ${freq.size}`)

// ---------------------------------------------------------------- 2. словарь
let vocab = [...freq.entries()]
  .filter(([, n]) => n >= MIN_FREQ)
  .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  .slice(0, MAX_VOCAB)
  .map(([t]) => t)
const index = new Map<string, number>()
vocab.forEach((t, i) => index.set(t, i))
log(`словарь: ${vocab.length} основ (частота ≥ ${MIN_FREQ})`)

// ---------------------------------------------------------------- 3. совместная встречаемость
const V = vocab.length
const rows: Map<number, number>[] = Array.from({ length: V }, () => new Map())
for (const terms of docs) {
  const ids = terms.map((t) => index.get(t) ?? -1)
  for (let i = 0; i < ids.length; i += 1) {
    const a = ids[i]
    if (a < 0) continue
    for (let j = i + 1; j <= i + WINDOW && j < ids.length; j += 1) {
      const b = ids[j]
      if (b < 0 || b === a) continue
      const w = 1 / (j - i)
      rows[a].set(b, (rows[a].get(b) ?? 0) + w)
      rows[b].set(a, (rows[b].get(a) ?? 0) + w)
    }
  }
}

// ---------------------------------------------------------------- 4. PPMI (CSR)
const rowSum = new Float64Array(V)
let total = 0
for (let i = 0; i < V; i += 1) {
  let s = 0
  for (const v of rows[i].values()) s += v
  rowSum[i] = s
  total += s
}
// сглаживание распределения контекстов: p(c)^α
const ctxSum = new Float64Array(V)
let ctxTotal = 0
for (let i = 0; i < V; i += 1) {
  ctxSum[i] = Math.pow(rowSum[i], PMI_ALPHA)
  ctxTotal += ctxSum[i]
}
const csrOffs = new Uint32Array(V + 1)
const colsTmp: number[] = []
const valsTmp: number[] = []
for (let i = 0; i < V; i += 1) {
  csrOffs[i] = colsTmp.length
  for (const [j, n] of rows[i]) {
    const pmi = Math.log((n / total) / ((rowSum[i] / total) * (ctxSum[j] / ctxTotal)))
    if (pmi > 0) {
      colsTmp.push(j)
      valsTmp.push(pmi)
    }
  }
  rows[i].clear()
}
csrOffs[V] = colsTmp.length
const cols = Uint32Array.from(colsTmp)
const vals = Float64Array.from(valsTmp)
log(`PPMI: ненулевых ${vals.length} (${((vals.length / (V * V)) * 100).toFixed(2)} % матрицы)`)

// ---------------------------------------------------------------- 5. рандомизированная декомпозиция
const R = DIM + OVERSAMPLE

/** Y = M · X, X и Y — плотные V×R (row-major). */
function mulSparse(X: Float64Array, Y: Float64Array) {
  Y.fill(0)
  for (let i = 0; i < V; i += 1) {
    const yo = i * R
    for (let p = csrOffs[i]; p < csrOffs[i + 1]; p += 1) {
      const j = cols[p]
      const v = vals[p]
      const xo = j * R
      for (let k = 0; k < R; k += 1) Y[yo + k] += v * X[xo + k]
    }
  }
}

/** Ортонормирование столбцов (модифицированный Грам — Шмидт) на месте. */
function orthonormalize(Y: Float64Array) {
  for (let k = 0; k < R; k += 1) {
    for (let m = 0; m < k; m += 1) {
      let dot = 0
      for (let i = 0; i < V; i += 1) dot += Y[i * R + k] * Y[i * R + m]
      for (let i = 0; i < V; i += 1) Y[i * R + k] -= dot * Y[i * R + m]
    }
    let norm = 0
    for (let i = 0; i < V; i += 1) norm += Y[i * R + k] * Y[i * R + k]
    norm = Math.sqrt(norm) || 1
    for (let i = 0; i < V; i += 1) Y[i * R + k] /= norm
  }
}

// детерминированный генератор (воспроизводимая сборка)
let seed = 20261002
function rand(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
function gauss(): number {
  const u = rand() || 1e-12
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

let Q = new Float64Array(V * R)
for (let i = 0; i < Q.length; i += 1) Q[i] = gauss()
let Y = new Float64Array(V * R)
for (let it = 0; it <= POWER_ITERS; it += 1) {
  mulSparse(Q, Y)
  orthonormalize(Y)
  ;[Q, Y] = [Y, Q]
}
// T = Qᵀ · M · Q  (R×R, симметричная)
mulSparse(Q, Y)
const T = new Float64Array(R * R)
for (let a = 0; a < R; a += 1) {
  for (let b = a; b < R; b += 1) {
    let s = 0
    for (let i = 0; i < V; i += 1) s += Q[i * R + a] * Y[i * R + b]
    T[a * R + b] = s
    T[b * R + a] = s
  }
}

/** Метод Якоби для симметричной матрицы: возвращает собственные значения и матрицу векторов (столбцы). */
function jacobiEigen(A: Float64Array, n: number): { values: Float64Array; vectors: Float64Array } {
  const a = Float64Array.from(A)
  const v = new Float64Array(n * n)
  for (let i = 0; i < n; i += 1) v[i * n + i] = 1
  for (let sweep = 0; sweep < 100; sweep += 1) {
    let off = 0
    for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) off += a[p * n + q] * a[p * n + q]
    if (off < 1e-18) break
    for (let p = 0; p < n; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        const apq = a[p * n + q]
        if (Math.abs(apq) < 1e-300) continue
        const theta = (a[q * n + q] - a[p * n + p]) / (2 * apq)
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k += 1) {
          const akp = a[k * n + p]
          const akq = a[k * n + q]
          a[k * n + p] = c * akp - s * akq
          a[k * n + q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k += 1) {
          const apk = a[p * n + k]
          const aqk = a[q * n + k]
          a[p * n + k] = c * apk - s * aqk
          a[q * n + k] = s * apk + c * aqk
        }
        for (let k = 0; k < n; k += 1) {
          const vkp = v[k * n + p]
          const vkq = v[k * n + q]
          v[k * n + p] = c * vkp - s * vkq
          v[k * n + q] = s * vkp + c * vkq
        }
      }
    }
  }
  const values = new Float64Array(n)
  for (let i = 0; i < n; i += 1) values[i] = a[i * n + i]
  return { values, vectors: v }
}

const eig = jacobiEigen(T, R)
const order = [...Array(R).keys()].sort((x, y) => eig.values[y] - eig.values[x]).slice(0, DIM)
const kept = order.filter((k) => eig.values[k] > 0)
log(`собственные значения: топ ${eig.values[order[0]].toFixed(1)}, ${DIM}-е ${eig.values[order[DIM - 1]].toFixed(1)}; положительных ${kept.length}`)

// векторы = Q · W_k · √λ_k
const emb = new Float64Array(V * DIM)
for (let i = 0; i < V; i += 1) {
  for (let d = 0; d < DIM; d += 1) {
    const k = order[d]
    const lam = eig.values[k]
    if (lam <= 0) continue
    let s = 0
    for (let a = 0; a < R; a += 1) s += Q[i * R + a] * eig.vectors[a * R + k]
    emb[i * DIM + d] = s * Math.sqrt(lam)
  }
}
for (let i = 0; i < V; i += 1) {
  let n = 0
  for (let d = 0; d < DIM; d += 1) n += emb[i * DIM + d] ** 2
  n = Math.sqrt(n) || 1
  for (let d = 0; d < DIM; d += 1) emb[i * DIM + d] /= n
}

// ---------------------------------------------------------------- 6. квантование и запись
function cosine(a: number, b: number): number {
  let s = 0
  for (let d = 0; d < DIM; d += 1) s += emb[a * DIM + d] * emb[b * DIM + d]
  return s
}

function neighbors(term: string, k: number): { term: string; cos: number }[] {
  const i = index.get(term)
  if (i === undefined) return []
  const scored: { term: string; cos: number }[] = []
  for (let j = 0; j < V; j += 1) if (j !== i) scored.push({ term: vocab[j], cos: cosine(i, j) })
  scored.sort((a, b) => b.cos - a.cos)
  return scored.slice(0, k)
}

const N = docs.length
function build(vocabCount: number) {
  const q = new Int8Array(vocabCount * DIM)
  for (let i = 0; i < vocabCount * DIM; i += 1) q[i] = Math.max(-127, Math.min(127, Math.round(emb[i] * 127)))
  const idf = vocab.slice(0, vocabCount).map((t) => Math.round(Math.log((N + 1) / ((df.get(t) ?? 0) + 1)) * 100) / 100)
  const json = JSON.stringify({
    version: 1,
    dim: DIM,
    window: WINDOW,
    docs: N,
    vocab: vocab.slice(0, vocabCount).join('\n'),
    idf,
    vectors: Buffer.from(q.buffer, q.byteOffset, q.byteLength).toString('base64'),
  })
  return json
}

let count = V
let json = build(count)
while (Buffer.byteLength(json, 'utf8') > MAX_BYTES && count > 1000) {
  count = Math.floor(count * 0.95)
  json = build(count)
}
if (count < V) {
  log(`словарь обрезан до ${count} основ, чтобы уложиться в ${(MAX_BYTES / 1024 / 1024).toFixed(1)} МБ`)
  vocab = vocab.slice(0, count)
}
fs.writeFileSync(OUT_FILE, json)
log(`записано ${OUT_FILE}: ${(Buffer.byteLength(json, 'utf8') / 1024).toFixed(0)} КБ, ${vocab.length} × ${DIM} int8`)

// sanity-проверка соседей
const PROBES = [
  'кислота', 'щёлочь', 'оксид', 'валентность', 'моль', 'электролит', 'катализатор', 'восстановитель', 'галоген', 'изотоп',
  'окислитель', 'основание', 'соль', 'раствор', 'металл', 'молекула', 'атом', 'реакция', 'индикатор', 'водород',
  'kislota', 'acid', 'h2so4', 'nacl', 'ph',
]
const lines: string[] = [`# соседи по косинусу (dim ${DIM}, словарь ${vocab.length}, корпус ${N} чанков) — ${new Date().toISOString()}`]
for (const probe of PROBES) {
  const stem = analyzeTokens(probe)[0]?.term ?? probe
  const nb = neighbors(stem, 5)
  const line = `${probe} → ${stem}: ${nb.length ? nb.map((x) => `${x.term} ${x.cos.toFixed(2)}`).join(', ') : '— (нет в словаре)'}`
  lines.push(line)
  console.log('  ' + line)
}
fs.writeFileSync(NEIGHBORS_FILE, lines.join('\n') + '\n')
log(`готово за ${((performance.now() - t0) / 1000).toFixed(1)} с`)
