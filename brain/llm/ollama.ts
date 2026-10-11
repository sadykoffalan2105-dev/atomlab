/**
 * Клиент Ollama (http://127.0.0.1:11434): опрос /api/tags при старте и каждые pollMs,
 * потоковый /api/chat (NDJSON) с таймаутами первого токена и общего времени, /api/embed.
 * Ollama нет — available:false, и конвейер отвечает запасным путём (brain/pipeline/fallback.ts).
 * Появилась — следующий опрос включает LLM без перезапуска сервера.
 */
import type { BrainConfig } from '../config.ts'
import { PERSONA } from '../persona/systemPrompt.ts'
import type { Lang } from '../pipeline/normalize.ts'

const WARM_GREETING: Record<Lang, string> = { ru: 'Привет', uz: 'Salom', en: 'Hello' }

/** images — фото задачи (base64 без «data:»): Ollama /api/chat принимает их у реплики; уходят только моделям со зрением. */
export type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string; images?: string[] }

export type LlmStatus = {
  available: boolean
  chatModel: string | null
  fastModel: string | null
  embedModel: string | null
  checkedAt: number
  error?: string
  /** чат-модель в видеопамяти (GET /api/ps: size_vram ≥ половины size) → профиль gpu; null — ещё не известно */
  gpu?: boolean | null
  /** чат-модель понимает картинки (/api/show capabilities ∋ 'vision') — фото задачи; null — ещё не известно */
  vision?: boolean | null
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
  /** false — выключить «мышление» у моделей, которые его умеют (qwen3; поле шлётся только им, см. /api/show) */
  think?: boolean
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
  /** умеет ли модель «мышление» (/api/show capabilities ∋ 'thinking') — только таким шлём think:false */
  private thinking = new Map<string, boolean>()
  /** понимает ли модель картинки (/api/show capabilities ∋ 'vision') — только таким шлём фото (messages[].images) */
  private vision = new Map<string, boolean>()

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
      this.st = {
        available: !!chatModel,
        chatModel,
        fastModel,
        embedModel,
        checkedAt: Date.now(),
        gpu: this.st.chatModel === chatModel ? (this.st.gpu ?? null) : null,
        vision: chatModel ? (this.vision.get(chatModel) ?? null) : null,
      }
      if (chatModel) void this.probeModel(chatModel)
      if (fastModel && fastModel !== chatModel) void this.probeModel(fastModel)
      if (this.st.available && !was) console.log(`[brain] Ollama: модели ${chatModel}${fastModel !== chatModel ? ` / ${fastModel}` : ''}${embedModel ? `, эмбеддинги ${embedModel}` : ''}`)
      // чат-модель — персонами всех языков по очереди (последний остаётся в слоте кеша), быстрая — русской (живой голос)
      if (chatModel) this.warm(chatModel, this.cfg.warmLangs)
      if (fastModel && fastModel !== chatModel) this.warm(fastModel, ['ru'])
    } catch (err) {
      if (this.st.available) console.log('[brain] Ollama недоступна — запасной путь')
      this.st = { available: false, chatModel: null, fastModel: null, embedModel: null, checkedAt: Date.now(), error: (err as Error).message }
    } finally {
      clearTimeout(t)
    }
    return this.st
  }

  /** Узнать у Ollama, умеет ли модель «мышление» и картинки (/api/show), и лежит ли чат-модель в видеопамяти (/api/ps). */
  private async probeModel(model: string): Promise<void> {
    await this.probeCaps(model)
    if (model === this.st.chatModel) await this.probeGpu()
  }

  /** /api/show → capabilities: 'thinking' (шлём think:false) и 'vision' (шлём фото); кеш на модель. */
  private async probeCaps(model: string, timeoutMs = 3000): Promise<void> {
    if (this.thinking.has(model) && this.vision.has(model)) return
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), timeoutMs)
    try {
      const r = await fetch(`${this.baseUrl}/api/show`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }), signal: ac.signal })
      const j = r.ok ? ((await r.json()) as { capabilities?: string[] }) : null
      if (!j) return
      this.thinking.set(model, !!j.capabilities?.includes('thinking'))
      // старая Ollama без capabilities — картинок не шлём (честный ответ «фото не поддерживается»)
      this.vision.set(model, !!j.capabilities?.includes('vision'))
      if (model === this.st.chatModel) this.st = { ...this.st, vision: this.vision.get(model) ?? null }
    } catch {
      /* нет ответа /api/show — think и фото не шлём, спросим при следующем опросе */
    } finally {
      clearTimeout(t)
    }
  }

  /** Фото задачи: перед ответом убедиться, что известно, умеет ли чат-модель картинки (≤ timeoutMs). */
  async ensureCapabilities(timeoutMs = 3000): Promise<boolean> {
    const model = this.st.chatModel
    if (!model) return false
    await this.probeCaps(model, timeoutMs)
    return this.vision.get(model) === true
  }

  /** Картинки — только модели со зрением: остальным реплики уходят без images (иначе Ollama ответит ошибкой). */
  private forModel(model: string, messages: LlmMessage[]): LlmMessage[] {
    const ok = this.vision.get(model) === true
    return messages.map((m) => {
      if (!('images' in m)) return m
      const { images, ...rest } = m
      return ok && images?.length ? { ...rest, images } : rest
    })
  }

  /** GET /api/ps: size_vram ≥ 0,5·size у чат-модели → gpu (после прогрева модель уже загружена). */
  async probeGpu(): Promise<boolean | null> {
    try {
      const r = await fetch(`${this.baseUrl}/api/ps`)
      if (!r.ok) return this.st.gpu ?? null
      const j = (await r.json()) as { models?: { name?: string; model?: string; size?: number; size_vram?: number }[] }
      const m = (j.models ?? []).find((x) => x.name === this.st.chatModel || x.model === this.st.chatModel)
      if (m && typeof m.size === 'number' && m.size > 0) this.st = { ...this.st, gpu: (m.size_vram ?? 0) >= 0.5 * m.size }
    } catch {
      /* нет /api/ps — профиль остаётся неизвестным (laptop) */
    }
    return this.st.gpu ?? null
  }

  /**
   * Прогрев (в фоне: сервер уже слушает порт и отвечает на /health): модель загружается в память, а персоны языков
   * читаются по очереди — та же num_ctx, что у ответов (иначе Ollama перезагрузит модель). Первый вопрос на uz/en
   * не ждёт загрузки модели и не упирается в тайм-аут первого токена; последний язык списка остаётся в слоте кеша
   * префикса. Запросы идут цепочкой (warmChain) — процессор не делится между двумя прогревами сразу.
   * Пока сервер работает, keep_alive продлевается раз в keepAliveRefreshMs (пустой запрос: модель только остаётся в памяти).
   */
  private warmChain: Promise<void> = Promise.resolve()

  private warm(model: string, langs: readonly string[]): void {
    // скрипты без чата (brain:embed, brain:corpus) не держат модели чата в памяти
    if (process.env.BRAIN_NO_WARM === '1') return
    if (this.warmed.has(model)) return
    this.warmed.add(model)
    const list = langs.filter((l): l is Lang => l === 'ru' || l === 'uz' || l === 'en')
    this.warmChain = this.warmChain.then(async () => {
      for (const lang of list.length ? list : (['ru'] as Lang[])) {
        const t0 = performance.now()
        try {
          const r = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: PERSONA[lang] },
                { role: 'user', content: WARM_GREETING[lang] },
              ],
              stream: false,
              keep_alive: this.cfg.keepAlive,
              options: { num_predict: 1, num_ctx: this.cfg.numCtx },
            }),
          })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          await r.json().catch(() => null)
          console.log(`[brain] прогрев ${model} [${lang}]: ${Math.round(performance.now() - t0)} мс (персона прочитана, keep_alive ${this.cfg.keepAlive})`)
          if (model === this.st.chatModel && this.st.gpu == null) void this.probeGpu()
        } catch {
          this.warmed.delete(model) // следующий опрос /api/tags попробует снова
          return
        }
      }
    })
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
          messages: this.forModel(o.model, o.messages),
          stream: true,
          keep_alive: this.cfg.keepAlive,
          ...(o.think === false && this.thinking.get(o.model) ? { think: false } : {}),
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
          messages: this.forModel(o.model, o.messages),
          stream: false,
          keep_alive: this.cfg.keepAlive,
          ...(this.cfg.dialog?.think === false && this.thinking.get(o.model) ? { think: false } : {}),
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
