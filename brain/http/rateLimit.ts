/**
 * Лимиты частоты запросов. Ключи — солёные хеши (см. clientIp.ts): ученик (адрес + сессия сайта) и потолок адреса
 * (школьный NAT). Только в памяти: перезапуск сервера обнуляет счётчики (это нормально — лимит защищает модель
 * от перегрузки, а не считает деньги). Окна фиксированные (минута, сутки), отсчёт с первого запроса в окне.
 * Старые ключи выметаются, память ограничена.
 */

export type RateRule = { name: string; windowMs: number; max: number }
export type RateVerdict = { ok: true } | { ok: false; rule: string; retryAfterSec: number }
/** Одна проверка: группа правил на ключ (ученик или адрес). */
export type RateCheck = { group: string; key: string; rules: readonly RateRule[] }

type Window = { resetAt: number; count: number }

/** Не больше стольких ключей в памяти: дальше выметаем просроченные, потом самые старые. */
const MAX_KEYS = 50_000

export class RateLimiter {
  private buckets = new Map<string, Window[]>()
  private sweptAt = 0
  private now: () => number

  constructor(now: () => number = Date.now) {
    this.now = now
  }

  /** Засчитать запрос по всем правилам группы; превышение любого — отказ (запрос НЕ засчитывается). */
  hit(group: string, key: string, rules: readonly RateRule[]): RateVerdict {
    return this.hitAll([{ group, key, rules }])
  }

  /**
   * Несколько проверок разом (лимит ученика + потолок адреса): превышение любой — отказ, и тогда НЕ засчитывается
   * ни одна (отказ по потолку адреса не съедает лимит ученика, и наоборот). Отказ — правило с самым долгим ожиданием.
   */
  hitAll(checks: readonly RateCheck[]): RateVerdict {
    const t = this.now()
    this.sweep(t)
    let worst: { rule: string; retryAfterSec: number } | null = null
    const all: Window[] = []
    for (const c of checks) {
      const id = `${c.group}:${c.key}`
      let ws = this.buckets.get(id)
      if (!ws || ws.length !== c.rules.length) {
        ws = c.rules.map((r) => ({ resetAt: t + r.windowMs, count: 0 }))
        this.buckets.set(id, ws)
      }
      c.rules.forEach((r, i) => {
        const w = ws![i]!
        if (t >= w.resetAt) {
          w.resetAt = t + r.windowMs
          w.count = 0
        }
        if (r.max > 0 && w.count >= r.max) {
          const sec = Math.max(1, Math.ceil((w.resetAt - t) / 1000))
          if (!worst || sec > worst.retryAfterSec) worst = { rule: r.name, retryAfterSec: sec }
        }
      })
      all.push(...ws)
    }
    if (worst) return { ok: false, ...(worst as { rule: string; retryAfterSec: number }) }
    for (const w of all) w.count++
    return { ok: true }
  }

  get size(): number {
    return this.buckets.size
  }

  private sweep(t: number): void {
    if (t - this.sweptAt < 60_000 && this.buckets.size < MAX_KEYS) return
    this.sweptAt = t
    for (const [k, ws] of this.buckets) if (ws.every((w) => t >= w.resetAt)) this.buckets.delete(k)
    // всё ещё много — выбрасываем самые старые (Map хранит порядок вставки)
    for (const k of this.buckets.keys()) {
      if (this.buckets.size < MAX_KEYS * 0.9) break
      this.buckets.delete(k)
    }
  }
}

/** Сколько потоков /chat держит каждый ученик (и каждый адрес) сейчас. */
export class StreamCounter {
  private open = new Map<string, number>()
  tryOpen(key: string, max: number): boolean {
    const n = this.open.get(key) ?? 0
    if (max > 0 && n >= max) return false
    this.open.set(key, n + 1)
    return true
  }
  /**
   * Открыть поток сразу по нескольким ключам (ученик + потолок адреса): все или ни одного. Отказ — индекс ключа,
   * упёршегося в лимит; успех — -1 (закрывать каждый ключ через close).
   */
  tryOpenAll(entries: readonly { key: string; max: number }[]): number {
    const bad = entries.findIndex((e) => e.max > 0 && (this.open.get(e.key) ?? 0) >= e.max)
    if (bad >= 0) return bad
    for (const e of entries) this.open.set(e.key, (this.open.get(e.key) ?? 0) + 1)
    return -1
  }
  close(key: string): void {
    const n = (this.open.get(key) ?? 1) - 1
    if (n <= 0) this.open.delete(key)
    else this.open.set(key, n)
  }
  get total(): number {
    let s = 0
    for (const n of this.open.values()) s += n
    return s
  }
}
