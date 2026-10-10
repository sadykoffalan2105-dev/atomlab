/**
 * Клиент Ollama (http://127.0.0.1:11434): опрос /api/tags при старте и каждые pollMs,
 * потоковый /api/chat (NDJSON) с таймаутами первого токена и общего времени, /api/embed.
 * Ollama нет — available:false, и конвейер отвечает запасным путём (brain/pipeline/fallback.ts).
 * Появилась — следующий опрос включает LLM без перезапуска сервера.
 */
import type { BrainConfig } from '../config.ts'
import { PERSONA } from '../persona/systemPrompt.ts'

export type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type LlmStatus = {
  available: boolean
  chatModel: string | null
  fastModel: string | null
  embedModel: string | null
  checkedAt: number
  error?: string
}

export type ChatStreamOptions = {
  model: string
  messages: LlmMessage[]
  temperature: number
  /** узкий отбор токенов (меньше срывов на чужие языки); не задано — из config.sampling */
  topK?: number
  topP?: number
  repeatPenalty?: number
  numPredict: number
  numCtx: number
  firstTokenMs: number
  totalMs: number
  signal?: AbortSignal
  /** Вернуть false — остановить генерацию (лимит длины). */
  onToken: (text: string) => boolean | void
}

export type ChatStreamResult = {
  text: string
  stopped: 'done' | 'first_token_timeout' | 'total_timeout' | 'client_abort' | 'limit' | 'error'
  error?: string
  /** мс до первого токена модели (замер для журнала и eval) */
  firstMs?: number
  /** сколько токенов подсказки модель реально прочитала (после кеша префикса) и за сколько мс */
  promptTokens?: number
  promptMs?: number
}

export interface LlmClient {
  status(): LlmStatus
  refresh(): Promise<LlmStatus>
  chatStream(opts: ChatStreamOptions): Promise<ChatStreamResult>
  complete(opts: { model: string; messages: LlmMessage[]; temperature?: number; numPredict?: number; timeoutMs: number; signal?: AbortSignal }): Promise<string | null>
  embed(texts: string[], timeoutMs: number, signal?: AbortSignal): Promise<number[][] | null>
}

/** Подобрать модель из списка установленных: точное имя, «имя:latest» или семейство без тега. */
export function pickModel(candidates: readonly string[], installed: readonly string[]): string | null {
  for (const c of candidates) {
    const hit = installed.find((n) => n === c || n === `${c}:latest` || (!c.includes(':') && n.startsWith(`${c}:`)))
    if (hit) return hit
  }
  return null
}

const isEmbedName = (n: string) => /embed|bge|e5-|minilm|nomic/i.test(n)

function linkSignal(outer: AbortSignal | undefined, inner: AbortController): () => void {
  if (!outer) return () => {}
  if (outer.aborted) inner.abort('client_abort')
  const on = () => inner.abort('client_abort')
  outer.addEventListener('abort', on, { once: true })
  return () => outer.removeEventListener('abort', on)
}

export class OllamaClient implements LlmClient {
  private cfg: BrainConfig
  private st: LlmStatus = { available: false, chatModel: null, fastModel: null, embedModel: null, checkedAt: 0 }
  private timer: NodeJS.Timeout | null = null
  private warmed = new Set<string>()
  private keepTimer: NodeJS.Timeout | null = null

  constructor(cfg: BrainConfig) {
    this.cfg = cfg
  }

  get baseUrl(): string {
    return this.cfg.ollamaUrl.replace(/\/+$/, '')
  }

  status(): LlmStatus {
    return this.st
  }

  start(): void {
    void this.refresh()
    this.timer = setInterval(() => void this.refresh(), Math.max(500, this.cfg.pollMs))
    this.timer.unref?.()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.keepTimer) clearInterval(this.keepTimer)
    this.keepTimer = null
  }

  async refresh(): Promise<LlmStatus> {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 1500)
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: ac.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = (await res.json()) as { models?: { name?: string; model?: string }[] }
      const names = (j.models ?? []).map((m) => m.name ?? m.model ?? '').filter(Boolean)
      const chatNames = names.filter((n) => !isEmbedName(n))
      const chatModel = pickModel(this.cfg.chatModels, chatNames) ?? chatNames[0] ?? null
      const fastModel = pickModel(this.cfg.fastModels, chatNames) ?? chatModel
      const embedModel = pickModel([this.cfg.embedModel], names)
      const was = this.st.available
      this.st = { available: !!chatModel, chatModel, fastModel, embedModel, checkedAt: Date.now() }
      if (this.st.available && !was) console.log(`[brain] Ollama: модели ${chatModel}${fastModel !== chatModel ? ` / ${fastModel}` : ''}${embedModel ? `, эмбеддинги ${embedModel}` : ''}`)
      if (chatModel) this.warm(chatModel)
      if (fastModel && fastModel !== chatModel) this.warm(fastModel)
    } catch (err) {
      if (this.st.available) console.log('[brain] Ollama недоступна — запасной путь')
      this.st = { available: false, chatModel: null, fastModel: null, embedModel: null, checkedAt: Date.now(), error: (err as Error).message }
    } finally {
      clearTimeout(t)
    }
    return this.st
  }

  /** Подгрузить модель в память заранее, чтобы первый ответ ученику не ждал загрузки. */
  /**
   * Прогрев: та же num_ctx, что у ответов (иначе Ollama перезагрузит модель), и русская персона — её KV-кеш
   * остаётся в слоте, и первый вопрос ученика не перечитывает системную часть. Пока сервер работает,
   * keep_alive продлевается раз в keepAliveRefreshMs (пустой запрос: модель не считает, только остаётся в памяти).
   */
  private warm(model: string): void {
    if (this.warmed.has(model)) return
    this.warmed.add(model)
    const t0 = performance.now()
    fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: PERSONA.ru },
          { role: 'user', content: 'Привет' },
        ],
        stream: false,
        keep_alive: this.cfg.keepAlive,
        options: { num_predict: 1, num_ctx: this.cfg.numCtx },
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        console.log(`[brain] прогрев ${model}: ${Math.round(performance.now() - t0)} мс (персона в кеше, keep_alive ${this.cfg.keepAlive})`)
      })
      .catch(() => this.warmed.delete(model))
    if (!this.keepTimer && this.cfg.keepAliveRefreshMs > 0) {
      this.keepTimer = setInterval(() => {
        for (const m of this.warmed) {
          fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: m, messages: [], keep_alive: this.cfg.keepAlive, options: { num_ctx: this.cfg.numCtx } }),
          }).catch(() => {})
        }
      }, this.cfg.keepAliveRefreshMs)
      this.keepTimer.unref?.()
    }
  }

  async chatStream(o: ChatStreamOptions): Promise<ChatStreamResult> {
    const ac = new AbortController()
    const unlink = linkSignal(o.signal, ac)
    let text = ''
    let gotToken = false
    const t0 = performance.now()
    let firstMs: number | undefined
    const stats = (): Pick<ChatStreamResult, 'firstMs' | 'promptTokens' | 'promptMs'> => ({ firstMs, promptTokens, promptMs })
    let promptTokens: number | undefined
    let promptMs: number | undefined
    const first = setTimeout(() => {
      if (!gotToken) ac.abort('first_token_timeout')
    }, o.firstTokenMs)
    const total = setTimeout(() => ac.abort('total_timeout'), o.totalMs)
    const reason = (): ChatStreamResult['stopped'] => {
      const r = ac.signal.reason
      return r === 'first_token_timeout' || r === 'total_timeout' || r === 'client_abort' || r === 'limit' ? r : 'error'
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({
          model: o.model,
          messages: o.messages,
          stream: true,
          keep_alive: this.cfg.keepAlive,
          options: {
            temperature: o.temperature,
            top_k: o.topK ?? this.cfg.sampling.topK,
            top_p: o.topP ?? this.cfg.sampling.topP,
            repeat_penalty: o.repeatPenalty ?? this.cfg.sampling.repeatPenalty,
            num_ctx: o.numCtx,
            num_predict: o.numPredict,
          },
        }),
      })
      if (!res.ok || !res.body) return { text, stopped: 'error', error: `HTTP ${res.status}` }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line) continue
          let j: { message?: { content?: string }; done?: boolean; error?: string; prompt_eval_count?: number; prompt_eval_duration?: number }
          try {
            j = JSON.parse(line)
          } catch {
            continue
          }
          if (j.error) return { text, stopped: 'error', error: j.error, ...stats() }
          const piece = j.message?.content ?? ''
          if (piece) {
            if (!gotToken) firstMs = Math.round(performance.now() - t0)
            gotToken = true
            text += piece
            if (o.onToken(piece) === false) {
              ac.abort('limit')
              await reader.cancel().catch(() => {})
              return { text, stopped: 'limit', ...stats() }
            }
          }
          if (j.done) {
            promptTokens = j.prompt_eval_count
            promptMs = typeof j.prompt_eval_duration === 'number' ? Math.round(j.prompt_eval_duration / 1e6) : undefined
            return { text, stopped: 'done', ...stats() }
          }
        }
      }
      return { text, stopped: 'done', ...stats() }
    } catch (err) {
      if (ac.signal.aborted) return { text, stopped: reason(), ...stats() }
      return { text, stopped: 'error', error: (err as Error).message, ...stats() }
    } finally {
      clearTimeout(first)
      clearTimeout(total)
      unlink()
    }
  }

  async complete(o: { model: string; messages: LlmMessage[]; temperature?: number; numPredict?: number; timeoutMs: number; signal?: AbortSignal }): Promise<string | null> {
    const ac = new AbortController()
    const unlink = linkSignal(o.signal, ac)
    const t = setTimeout(() => ac.abort('total_timeout'), o.timeoutMs)
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({
          model: o.model,
          messages: o.messages,
          stream: false,
          keep_alive: this.cfg.keepAlive,
          options: { temperature: o.temperature ?? 0, num_predict: o.numPredict ?? 400, num_ctx: this.cfg.numCtx },
        }),
      })
      if (!res.ok) return null
      const j = (await res.json()) as { message?: { content?: string } }
      return j.message?.content ?? null
    } catch {
      return null
    } finally {
      clearTimeout(t)
      unlink()
    }
  }

  async embed(texts: string[], timeoutMs: number, signal?: AbortSignal): Promise<number[][] | null> {
    const model = this.st.embedModel
    if (!model || !texts.length) return null
    const ac = new AbortController()
    const unlink = linkSignal(signal, ac)
    const t = setTimeout(() => ac.abort('total_timeout'), timeoutMs)
    try {
      const res = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({ model, input: texts, keep_alive: this.cfg.keepAlive }),
      })
      if (!res.ok) return null
      const j = (await res.json()) as { embeddings?: number[][] }
      return Array.isArray(j.embeddings) && j.embeddings.length === texts.length ? j.embeddings : null
    } catch {
      return null
    } finally {
      clearTimeout(t)
      unlink()
    }
  }
}
