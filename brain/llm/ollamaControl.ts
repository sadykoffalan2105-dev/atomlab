/**
 * Управление памятью Ollama для окна картинок (brain/llm/gpuArbiter.ts): выгрузить чат-модели из видеопамяти
 * (keep_alive 0), дождаться, что /api/ps их больше не показывает, и загрузить обратно с ТЕМ ЖЕ num_ctx, что у ответов
 * (иначе первый вопрос после окна заставит Ollama перезагрузить модель ещё раз). Клиент ответов (ollama.ts) не меняется.
 */

export type LoadedModel = { name: string; model: string; size: number; size_vram: number }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function post(url: string, body: unknown, timeoutMs: number): Promise<Response> {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) })
}

export class OllamaControl {
  private baseUrl: string
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  /** POST /api/generate {model, keep_alive: 0} без prompt — Ollama выгружает модель (ответ приходит сразу). */
  async unload(models: string[]): Promise<void> {
    for (const model of uniq(models)) {
      try {
        const r = await post(`${this.baseUrl}/api/generate`, { model, keep_alive: 0 }, 10_000)
        await r.arrayBuffer().catch(() => null)
      } catch {
        /* Ollama не отвечает — модели и так нет в памяти */
      }
    }
  }

  /** GET /api/ps — что сейчас в памяти; null — Ollama недоступна. */
  async loaded(): Promise<LoadedModel[] | null> {
    try {
      const r = await fetch(`${this.baseUrl}/api/ps`, { signal: AbortSignal.timeout(3000) })
      if (!r.ok) return null
      const j = (await r.json()) as { models?: Partial<LoadedModel>[] }
      return (j.models ?? []).map((m) => ({ name: String(m.name ?? m.model ?? ''), model: String(m.model ?? m.name ?? ''), size: Number(m.size) || 0, size_vram: Number(m.size_vram) || 0 }))
    } catch {
      return null
    }
  }

  /** Опрос /api/ps каждые 300 мс, пока моделей нет в памяти; true — выгружены (или Ollama недоступна). */
  async waitUnloaded(models: string[], maxMs: number): Promise<boolean> {
    const want = new Set(uniq(models))
    const t0 = Date.now()
    for (;;) {
      const ps = await this.loaded()
      if (!ps || !ps.some((m) => want.has(m.name) || want.has(m.model))) return true
      if (Date.now() - t0 >= maxMs) return false
      await sleep(300)
    }
  }

  /**
   * Загрузить модель: POST /api/generate {model, keep_alive, options:{num_ctx}} без prompt. Ждём ответа ≤ waitMs;
   * не дождались — не ошибка (Ollama догрузит сама при первом вопросе). true — загрузилась за срок.
   */
  async load(model: string, keepAlive: string | number, numCtx: number, waitMs: number): Promise<boolean> {
    try {
      const r = await post(`${this.baseUrl}/api/generate`, { model, keep_alive: keepAlive, options: { num_ctx: numCtx } }, Math.max(500, waitMs))
      await r.arrayBuffer().catch(() => null)
      return r.ok
    } catch {
      return false
    }
  }
}

function uniq(models: string[]): string[] {
  return [...new Set(models.filter((m): m is string => typeof m === 'string' && m.length > 0))]
}
