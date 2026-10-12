/**
 * Лимиты /stt по сессии сайта (query session=… или заголовок X-Brain-Session; без них — по адресу ученика)
 * и щедрый потолок по адресу (школьный NAT: 30 учеников за одним адресом). Ответ 429 — по контракту «Голос»
 * ({ok:false, error:{code:'rate'|'busy'}} + Retry-After), поэтому всё здесь, а не в общем ограничителе server.ts
 * (тот для /stt ничего не считает — sttIpRule отдаёт пустой набор правил).
 *   финальные реплики — минута + сутки на сессию, потолок адреса ipPerMin в минуту;
 *   partial — своя минута на сессию, потолок адреса 2 × ipPerMin (подсказки «на лету» необязательны);
 *   «один в полёте» на сессию и вид запроса (финальный не ждёт, пока вернётся partial той же сессии).
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
   * Пустить запрос: «один в полёте» (429 busy, Retry-After 2) → счётчики сессии → потолок адреса (429 rate).
   * limited=false (владелец с этого ПК / админ) — счётчики не трогаем, «один в полёте» остаётся.
   * ok → вызывающий обязан вызвать release(session, partial) в finally.
   */
  acquire(session: string, ip: string, partial: boolean, rate: SttConfig['rate'], limited: boolean): SttVerdict {
    const key = `${partial ? 'p' : 'f'}:${session}`
    if (this.inFlight.has(key)) return { ok: false, code: 'busy', rule: 'stt_in_flight', retryAfterSec: 2 }
    if (limited) {
      const v = this.limiter.hit(partial ? 'stt_partial' : 'stt_final', session, SttLimits.rules(rate, partial))
      if (!v.ok) return { ok: false, code: 'rate', rule: v.rule, retryAfterSec: v.retryAfterSec }
      const ipRule = partial ? { name: 'stt_ip_partial_minute', windowMs: MIN, max: rate.ipPerMin * 2 } : { name: 'stt_ip_minute', windowMs: MIN, max: rate.ipPerMin }
      const vi = this.limiter.hit(partial ? 'stt_ip_partial' : 'stt_ip', ip, [ipRule])
      if (!vi.ok) return { ok: false, code: 'rate', rule: vi.rule, retryAfterSec: vi.retryAfterSec }
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

/**
 * Группа общего ограничителя server.ts для POST /stt: своя (не 'other' — 60/мин на адрес мало для класса) и пустая —
 * сессия и потолок адреса считаются в SttLimits, чтобы 429 был по контракту «Голос».
 */
export function sttIpRule(_rate: SttConfig['rate']): { group: string; rules: RateRule[] } {
  return { group: 'stt', rules: [] }
}
