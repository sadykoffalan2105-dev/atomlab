/**
 * Готовые картинки в памяти для GET /image/<jobId> (ссылка «открыть/сохранить»): TTL и общий лимит байт,
 * старые выметаются при вставке. На диск ничего не пишется.
 */
export class ImageCache {
  private items = new Map<string, { bytes: Buffer; at: number }>()
  private total = 0
  private ttlMs: () => number
  private maxBytes: () => number

  constructor(ttlMs: () => number, maxBytes: () => number) {
    this.ttlMs = ttlMs
    this.maxBytes = maxBytes
  }

  put(id: string, bytes: Buffer, now = Date.now()): void {
    this.sweep(now)
    const max = this.maxBytes()
    if (bytes.length > max) return
    this.drop(id)
    // не помещается — выбрасываем самые старые (Map хранит порядок вставки)
    for (const k of this.items.keys()) {
      if (this.total + bytes.length <= max) break
      this.drop(k)
    }
    this.items.set(id, { bytes, at: now })
    this.total += bytes.length
  }

  get(id: string, now = Date.now()): Buffer | null {
    const it = this.items.get(id)
    if (!it) return null
    if (now - it.at > this.ttlMs()) {
      this.drop(id)
      return null
    }
    return it.bytes
  }

  get size(): number {
    return this.items.size
  }

  get bytes(): number {
    return this.total
  }

  private drop(id: string): void {
    const it = this.items.get(id)
    if (!it) return
    this.total -= it.bytes.length
    this.items.delete(id)
  }

  private sweep(now: number): void {
    const ttl = this.ttlMs()
    for (const [k, it] of this.items) if (now - it.at > ttl) this.drop(k)
  }
}
