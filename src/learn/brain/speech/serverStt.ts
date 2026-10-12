/**
 * Клиент серверного распознавания речи мозга ATOMLAB (контракт «Голос» v1):
 *   POST {brainUrl}/stt?lang=&session=&partial=  (тело — WAV PCM16 16 кГц моно, ≤ 25 с)
 *   GET  {brainUrl}/stt/health                    (опрос ≤ 1 раза в 30 с, кеш 60 с)
 *
 * fetch и часы внедряются (тесты: scripts/test-voice-stt-engine.mts). Аудио и текст не логируются —
 * только байты/мс/язык/код ([voice]-события).
 */

export type SttLang = 'ru' | 'uz' | 'en' | 'unknown'

export interface SttResult {
  ok: true
  text: string
  lang: SttLang
  langSource?: 'hint' | 'script' | 'whisper'
  confidence?: number | null
  engine?: string
  device?: 'cuda' | 'cpu'
  ms?: { queue?: number; decode?: number; infer?: number; total?: number }
  durationMs?: number
  partial?: boolean
}

export interface SttHealth {
  ok: boolean
  available: boolean
  langs?: string[]
  maxSeconds?: number
  engines?: { name: string; device?: string; loaded?: boolean; langs?: string[] }[]
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** Ошибка /stt: HTTP-код + код контракта + Retry-After (мс). status 0 — сеть/таймаут. */
export class SttHttpError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfterMs: number | null
  constructor(status: number, code: string, message: string, retryAfterMs: number | null) {
    super(message)
    this.name = 'SttHttpError'
    this.status = status
    this.code = code
    this.retryAfterMs = retryAfterMs
  }
  /** Сервер распознавания не работает (переключаемся на браузер после 2 подряд). */
  get unavailable(): boolean {
    return this.status === 0 || this.status === 503 || this.status >= 500 || this.status === 404
  }
}

/** Таймаут одного запроса /stt (мс). */
export const STT_REQUEST_TIMEOUT_MS = 8_000

const defaultFetch: FetchLike = (input, init) => fetch(input, init)

function parseRetryAfter(v: string | null): number | null {
  if (!v) return null
  const sec = Number(v)
  return Number.isFinite(sec) && sec >= 0 ? Math.round(sec * 1000) : null
}

export interface PostSttOptions {
  baseUrl: string
  wav: Uint8Array
  lang: 'ru' | 'uz' | 'en' | 'auto'
  session: string
  partial: boolean
  signal?: AbortSignal
  timeoutMs?: number
  fetchImpl?: FetchLike
}

export async function postStt(opts: PostSttOptions): Promise<SttResult> {
  const f = opts.fetchImpl ?? defaultFetch
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  opts.signal?.addEventListener('abort', onAbort)
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? STT_REQUEST_TIMEOUT_MS)
  const session = opts.session.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'web'
  const url = `${opts.baseUrl.replace(/\/+$/, '')}/stt?lang=${opts.lang}&session=${session}&partial=${opts.partial ? 1 : 0}`
  let res: Response
  try {
    res = await f(url, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      // Копия в собственный ArrayBuffer: тело должно быть ровно WAV, без чужих байтов.
      body: opts.wav.slice().buffer as ArrayBuffer,
      signal: ctrl.signal,
      cache: 'no-store',
    })
  } catch (e) {
    if (opts.signal?.aborted) throw e
    throw new SttHttpError(0, ctrl.signal.aborted ? 'timeout' : 'network', String((e as Error)?.message ?? e), null)
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }
  const data: unknown = await res.json().catch(() => null)
  const body = (data ?? {}) as { ok?: boolean; error?: { code?: string; message?: string } } & Partial<SttResult>
  if (!res.ok || body.ok !== true) {
    const code = body.error?.code ?? (res.status === 429 ? 'rate' : res.status === 503 ? 'stt_unavailable' : 'http')
    throw new SttHttpError(res.status || 500, code, body.error?.message ?? `HTTP ${res.status}`, parseRetryAfter(res.headers.get('Retry-After')))
  }
  return {
    ok: true,
    text: typeof body.text === 'string' ? body.text : '',
    lang: (body.lang as SttLang) ?? 'unknown',
    langSource: body.langSource,
    confidence: body.confidence ?? null,
    engine: body.engine,
    device: body.device,
    ms: body.ms,
    durationMs: body.durationMs,
    partial: body.partial,
  }
}

export async function fetchSttHealth(baseUrl: string, fetchImpl: FetchLike = defaultFetch, timeoutMs = 4_000): Promise<SttHealth | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/stt/health`, { method: 'GET', signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<SttHealth>
    return data && typeof data === 'object' ? { ok: data.ok === true, available: data.available === true, ...data } as SttHealth : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface SttHealthCacheOptions {
  getBaseUrl: () => string | null
  fetchImpl?: FetchLike
  now?: () => number
  /** Сколько верить ответу (мс). */
  ttlMs?: number
  /** Не чаще (мс) — лимит группы 'other' на сервере. */
  minIntervalMs?: number
}

/** Кеш /stt/health: ответ живёт 60 с, запрос не чаще раза в 30 с. */
export class SttHealthCache {
  private readonly o: Required<Omit<SttHealthCacheOptions, 'fetchImpl'>> & { fetchImpl?: FetchLike }
  private value: SttHealth | null = null
  private valueUrl: string | null = null
  private checkedAt = -Infinity
  private inflight: Promise<boolean> | null = null

  constructor(options: SttHealthCacheOptions) {
    this.o = {
      getBaseUrl: options.getBaseUrl,
      fetchImpl: options.fetchImpl,
      now: options.now ?? (() => Date.now()),
      ttlMs: options.ttlMs ?? 60_000,
      minIntervalMs: options.minIntervalMs ?? 30_000,
    }
  }

  /** Что известно сейчас (без запроса): true/false или null — не проверяли/устарело. */
  peek(): boolean | null {
    const url = this.o.getBaseUrl()
    if (!url) return false
    if (url !== this.valueUrl || this.o.now() - this.checkedAt > this.o.ttlMs) return null
    return Boolean(this.value?.available)
  }

  health(): SttHealth | null {
    return this.value
  }

  /** Проверить (с учётом кеша и минимального интервала). force — только если прошло ≥ minInterval. */
  check(force = false): Promise<boolean> {
    const url = this.o.getBaseUrl()
    if (!url) return Promise.resolve(false)
    const age = this.o.now() - this.checkedAt
    const sameUrl = url === this.valueUrl
    if (sameUrl && (age < this.o.minIntervalMs || (!force && age <= this.o.ttlMs))) {
      return Promise.resolve(Boolean(this.value?.available))
    }
    if (this.inflight) return this.inflight
    this.inflight = fetchSttHealth(url, this.o.fetchImpl)
      .then((h) => {
        this.value = h
        this.valueUrl = url
        this.checkedAt = this.o.now()
        return Boolean(h?.available)
      })
      .finally(() => {
        this.inflight = null
      })
    return this.inflight
  }

  /** Сервер распознавания ответил ошибкой — считаем недоступным до следующей проверки. */
  markUnavailable(): void {
    this.value = { ok: false, available: false }
    this.valueUrl = this.o.getBaseUrl()
    this.checkedAt = this.o.now()
  }
}
