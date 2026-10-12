/**
 * Клиент сайдкара atomlab-stt (Python, только 127.0.0.1:8788 — brain/stt/sidecar/server.py):
 *   POST /transcribe — сырой WAV, заголовки X-Lang-Hint (ru|uz|en|auto), X-Partial (0|1), X-Engine (auto|gigaam|whisper)
 *                      → {ok:true, text, engine, device, ms:{queue,decode,infer}, durationMs, lang?, confidence?}
 *                      | {ok:false, code: too_long|bad_audio|busy|timeout|not_loaded};
 *   GET  /health     — {ok, engines:[{name,device,loaded,langs}], queue:{running,waiting}, maxSeconds};
 *   POST /gpu        — {mode:'release'|'acquire'} → {ok, state:'cpu'|'cuda'} (для арбитра GPU, подключается после слияния).
 * Таймауты везде: сайдкар лежит → ошибка за миллисекунды (отказ соединения), висит → по timeoutMs.
 * Аудио и текст не пишутся никуда — только передаются.
 */

export type SidecarEngine = { name: string; device: 'cuda' | 'cpu' | string; loaded: boolean; langs: string[] }
export type SidecarHealth = { ok: boolean; engines: SidecarEngine[]; queue: { running: number; waiting: number }; maxSeconds: number }
export type SidecarMs = { queue: number; decode: number; infer: number }
export type SidecarResult =
  | { ok: true; text: string; engine: string; device: string; ms: SidecarMs; durationMs: number; lang?: string; confidence?: number | null }
  | { ok: false; code: 'too_long' | 'bad_audio' | 'busy' | 'timeout' | 'not_loaded' | 'unavailable' | 'internal'; message?: string }

const HEALTH_TTL_MS = 5000
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0)

export class SttSidecar {
  readonly url: string
  private cached: { at: number; health: SidecarHealth | null } | null = null
  private pending: Promise<SidecarHealth | null> | null = null

  constructor(url: string) {
    this.url = url.replace(/\/+$/, '')
  }

  /**
   * Сайдкар только что не ответил — несколько секунд отвечаем 503 сразу, не дожидаясь соединения
   * (на Windows отказ соединения с закрытым портом длится до 2 с из-за повторов SYN).
   */
  private downUntil = 0

  async transcribe(wav: Buffer, o: { lang: string; partial: boolean; engine?: 'auto' | 'gigaam' | 'whisper'; timeoutMs: number; signal?: AbortSignal }): Promise<SidecarResult> {
    if (Date.now() < this.downUntil) return { ok: false, code: 'unavailable' }
    const r = await this.post(wav, o)
    if (!r.ok && r.code === 'unavailable') this.downUntil = Date.now() + DOWN_HOLD_MS
    return r
  }

  private async post(wav: Buffer, o: { lang: string; partial: boolean; engine?: 'auto' | 'gigaam' | 'whisper'; timeoutMs: number; signal?: AbortSignal }): Promise<SidecarResult> {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), o.timeoutMs)
    const onAbort = () => ac.abort()
    o.signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const r = await fetch(`${this.url}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav', 'X-Lang-Hint': o.lang, 'X-Partial': o.partial ? '1' : '0', 'X-Engine': o.engine ?? 'auto' },
        body: new Uint8Array(wav), // копия в памяти (тип BodyInit); на диск ничего
        signal: ac.signal,
      })
      let j: Record<string, unknown> | null = null
      try {
        j = (await r.json()) as Record<string, unknown>
      } catch {
        j = null
      }
      if (!j) return { ok: false, code: 'unavailable', message: `HTTP ${r.status}` }
      if (j.ok === true && typeof j.text === 'string') {
        const ms = (j.ms ?? {}) as Record<string, unknown>
        return {
          ok: true,
          text: j.text,
          engine: typeof j.engine === 'string' ? j.engine : 'gigaam',
          device: typeof j.device === 'string' ? j.device : 'cpu',
          ms: { queue: num(ms.queue), decode: num(ms.decode), infer: num(ms.infer) },
          durationMs: num(j.durationMs),
          ...(typeof j.lang === 'string' ? { lang: j.lang } : {}),
          ...(typeof j.confidence === 'number' ? { confidence: j.confidence } : {}),
        }
      }
      const code = String(j.code ?? '')
      const known = ['too_long', 'bad_audio', 'busy', 'timeout', 'not_loaded'] as const
      return { ok: false, code: (known as readonly string[]).includes(code) ? (code as (typeof known)[number]) : 'internal' }
    } catch {
      // отказ соединения, обрыв, таймаут — сайдкар недоступен (сайт уйдёт на Web Speech)
      return { ok: false, code: ac.signal.aborted && !o.signal?.aborted ? 'timeout' : 'unavailable' }
    } finally {
      clearTimeout(timer)
      o.signal?.removeEventListener('abort', onAbort)
    }
  }

  /** /health сайдкара с кешем 5 с; null — не отвечает. */
  async health(timeoutMs = 2000): Promise<SidecarHealth | null> {
    const now = Date.now()
    if (this.cached && now - this.cached.at < HEALTH_TTL_MS) return this.cached.health
    this.pending ??= (async () => {
      let h: SidecarHealth | null = null
      try {
        const r = await fetch(`${this.url}/health`, { signal: AbortSignal.timeout(timeoutMs) })
        const j = (await r.json()) as Record<string, unknown>
        if (j && j.ok === true) {
          const engines = Array.isArray(j.engines) ? (j.engines as Record<string, unknown>[]) : []
          const q = (j.queue ?? {}) as Record<string, unknown>
          h = {
            ok: true,
            engines: engines.map((e) => ({ name: String(e.name ?? ''), device: String(e.device ?? 'cpu'), loaded: e.loaded === true, langs: Array.isArray(e.langs) ? e.langs.map(String) : [] })),
            queue: { running: num(q.running), waiting: num(q.waiting) },
            maxSeconds: num(j.maxSeconds) || 25,
          }
        }
      } catch {
        h = null
      }
      this.cached = { at: Date.now(), health: h }
      this.pending = null
      return h
    })()
    return this.pending
  }

  /** Последнее известное состояние без ожидания (для /health мозга); устарело — обновить в фоне. */
  peek(): SidecarHealth | null {
    if (!this.cached || Date.now() - this.cached.at >= HEALTH_TTL_MS) void this.health()
    return this.cached?.health ?? null
  }

  /** Сбросить кеш (после ошибки запроса — следующий /stt/health спросит заново). */
  invalidate(): void {
    this.cached = null
  }

  /** Арбитр GPU: 'release' — модели на CPU (видеопамять для картинок), 'acquire' — обратно на видеокарту. */
  async gpu(mode: 'release' | 'acquire', timeoutMs = 20_000): Promise<'cpu' | 'cuda' | null> {
    try {
      const r = await fetch(`${this.url}/gpu`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }), signal: AbortSignal.timeout(timeoutMs) })
      const j = (await r.json()) as { ok?: boolean; state?: string }
      this.invalidate()
      return j.ok && (j.state === 'cpu' || j.state === 'cuda') ? j.state : null
    } catch {
      return null
    }
  }
  release(): Promise<'cpu' | 'cuda' | null> {
    return this.gpu('release')
  }
  acquire(): Promise<'cpu' | 'cuda' | null> {
    return this.gpu('acquire')
  }
}
