/**
 * Лимиты /stt по сессии сайта (query session=… или заголовок X-Brain-Session; без них — по адресу ученика).
 * Потолок по адресу (config.stt.rate.ipPerMin) считает общий ограничитель server.ts (группа 'stt') — здесь только
 * сессия: финальные реплики (минута + сутки) и partial (минута) считаются раздельно, плюс «один в полёте»
 * на сессию и вид запроса (финальный не ждёт, пока вернётся partial той же сессии).
 * Всё в памяти: перезапуск мозга обнуляет счётчики.
 */
import type { SttConfig } from '../config.ts'
import { RateLimiter, type RateRule } from '../http/rateLimit.ts'

const MIN = 60_000
const DAY = 24 * 60 * MIN

/** Формат идентификатора сессии сайта (brainSessionId). */
export const SESSION_RE = /^[A-Za-z0-9_-]{1,64}$/

export type SttVerdict = { ok: true } | { ok: false; code: 'rate' | 'busy'; rule: string; retryAfterSec: number }

export class SttLimits {
  private limiter: RateLimiter
  private inFlight = new Set<string>()

  constructor(now: () => number = Date.now) {
    this.limiter = new RateLimiter(now)
  }

  /** Правила сессии: финальные — минута и сутки, partial — своя минута. */
  static rules(rate: SttConfig['rate'], partial: boolean): RateRule[] {
    return partial
      ? [{ name: 'stt_partial_minute', windowMs: MIN, max: rate.partialPerMin }]
      : [
          { name: 'stt_session_minute', windowMs: MIN, max: rate.sessionPerMin },
          { name: 'stt_session_day', windowMs: DAY, max: rate.sessionPerDay },
        ]
  }

  /**
   * Пустить запрос: сначала «один в полёте» (429 busy, Retry-After 2), потом счётчики сессии (429 rate).
   * limited=false (владелец с этого ПК / админ) — счётчики не трогаем, «один в полёте» остаётся.
   * ok → вызывающий обязан вызвать release(session, partial) в finally.
   */
  acquire(session: string, partial: boolean, rate: SttConfig['rate'], limited: boolean): SttVerdict {
    const key = `${partial ? 'p' : 'f'}:${session}`
    if (this.inFlight.has(key)) return { ok: false, code: 'busy', rule: 'stt_in_flight', retryAfterSec: 2 }
    if (limited) {
      const v = this.limiter.hit(partial ? 'stt_partial' : 'stt_final', session, SttLimits.rules(rate, partial))
      if (!v.ok) return { ok: false, code: 'rate', rule: v.rule, retryAfterSec: v.retryAfterSec }
    }
    this.inFlight.add(key)
    return { ok: true }
  }

  release(session: string, partial: boolean): void {
    this.inFlight.delete(`${partial ? 'p' : 'f'}:${session}`)
  }

  get running(): number {
    return this.inFlight.size
  }
}

/** Правило потолка по адресу для общего ограничителя server.ts (группа 'stt'). */
export function sttIpRule(rate: SttConfig['rate']): { group: string; rules: RateRule[] } {
  return { group: 'stt', rules: [{ name: 'stt_ip_minute', windowMs: MIN, max: rate.ipPerMin }] }
}
