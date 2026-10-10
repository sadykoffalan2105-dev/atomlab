/**
 * Векторы эмбеддингов записей журнала (bge-m3 через Ollama, dim 1024, нормированные):
 *   derived/embeddings/<model>/vectors.f32   — Float32 подряд, N × dim;
 *   derived/embeddings/<model>/manifest.json — {model, dim, count, ids[]}: id → номер строки.
 * Пересобираемо (scripts/brain/embed.mts), возобновляемо: уже посчитанные id пропускаются.
 */
import fs from 'node:fs'
import path from 'node:path'
import { DIRS } from '../config.ts'
import { appendDerived, writeDerived } from './storage.ts'

export type EmbedManifest = { model: string; dim: number; count: number; ids: string[] }

export function normalizeVec(v: ArrayLike<number>): Float32Array {
  const out = new Float32Array(v.length)
  let s = 0
  for (let i = 0; i < v.length; i++) s += v[i]! * v[i]!
  const n = Math.sqrt(s) || 1
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / n
  return out
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) s += a[i]! * b[i]!
  return s
}

export class EmbedStore {
  readonly model: string
  dim = 0
  ids: string[] = []
  private index = new Map<string, number>()
  private vecs = new Float32Array(0)

  constructor(model: string) {
    this.model = model
  }

  get dir(): string {
    return path.join(DIRS.derived, 'embeddings', this.model.replace(/[^A-Za-z0-9._-]/g, '_'))
  }

  get size(): number {
    return this.ids.length
  }

  load(): this {
    const mf = path.join(this.dir, 'manifest.json')
    const vf = path.join(this.dir, 'vectors.f32')
    if (!fs.existsSync(mf) || !fs.existsSync(vf)) return this
    try {
      const m = JSON.parse(fs.readFileSync(mf, 'utf8')) as EmbedManifest
      const buf = fs.readFileSync(vf)
      const n = Math.min(m.ids.length, Math.floor(buf.byteLength / 4 / (m.dim || 1)))
      const copy = new Uint8Array(n * m.dim * 4)
      copy.set(buf.subarray(0, copy.byteLength))
      this.vecs = new Float32Array(copy.buffer)
      this.dim = m.dim
      this.ids = m.ids.slice(0, n)
      this.index = new Map(this.ids.map((id, i) => [id, i]))
    } catch (err) {
      console.warn('[brain] векторы не загружены:', (err as Error).message)
    }
    return this
  }

  has(id: string): boolean {
    return this.index.has(id)
  }

  get(id: string): Float32Array | null {
    const i = this.index.get(id)
    if (i === undefined || !this.dim) return null
    return this.vecs.subarray(i * this.dim, (i + 1) * this.dim)
  }

  /** Дописать векторы (нормируются) и обновить manifest. */
  append(ids: readonly string[], vectors: readonly ArrayLike<number>[]): void {
    if (!ids.length) return
    const dim = vectors[0]!.length
    if (this.dim && dim !== this.dim) throw new Error(`размерность ${dim} ≠ ${this.dim}`)
    this.dim = dim
    const block = new Float32Array(ids.length * dim)
    vectors.forEach((v, i) => block.set(normalizeVec(v), i * dim))
    appendDerived(path.join(this.dir, 'vectors.f32'), new Uint8Array(block.buffer))
    const merged = new Float32Array(this.vecs.length + block.length)
    merged.set(this.vecs)
    merged.set(block, this.vecs.length)
    this.vecs = merged
    for (const id of ids) {
      this.index.set(id, this.ids.length)
      this.ids.push(id)
    }
    const manifest: EmbedManifest = { model: this.model, dim: this.dim, count: this.ids.length, ids: this.ids }
    writeDerived(path.join(this.dir, 'manifest.json'), JSON.stringify(manifest))
  }

  /** Полный перебор косинусов (векторы нормированы): ближайшие k. */
  topK(q: Float32Array, k: number, accept?: (id: string) => boolean): { id: string; cos: number }[] {
    if (!this.dim || q.length !== this.dim) return []
    const best: { id: string; cos: number }[] = []
    let floor = -Infinity
    for (let i = 0; i < this.ids.length; i++) {
      let s = 0
      const off = i * this.dim
      for (let j = 0; j < this.dim; j++) s += q[j]! * this.vecs[off + j]!
      if (s <= floor && best.length >= k) continue
      const id = this.ids[i]!
      if (accept && !accept(id)) continue
      best.push({ id, cos: s })
      if (best.length > k * 2) {
        best.sort((a, b) => b.cos - a.cos)
        best.length = k
        floor = best[k - 1]!.cos
      }
    }
    best.sort((a, b) => b.cos - a.cos)
    return best.slice(0, k)
  }
}
