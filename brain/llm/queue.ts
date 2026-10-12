/**
 * Очередь к модели: одновременно генерируют не больше llm.parallel ответов (ноутбук без GPU — 1, ПК с RTX — 4),
 * остальные ждут по порядку. Пока ждут — сервер шлёт в SSE событие 'queue' {position, etaSec} и «сердцебиение».
 * Очередь полна (queueCap) или ждать дольше queueWaitMs → ученик сразу получает честный запасной путь
 * (поиск + расчёты + шаблоны) с done.reason 'busy' — а не тишину и не тайм-аут.
 *
 * Конвейер (brain/pipeline) об очереди не знает: на каждый запрос сервер даёт ему QueueTicket — обёртку LlmClient,
 * которая занимает слот при первом обращении к модели (классификация или ответ) и держит его до конца запроса.
 * Эмбеддинги (поиск, доли секунды) идут мимо очереди.
 */
import type { ChatStreamOptions, ChatStreamResult, LlmClient, LlmMessage, LlmStatus } from './ollama.ts'

export type QueueOptions = { parallel: number; queueCap: number; queueWaitMs: number }
/** overflow — очередь полна; predicted — по оценке ждать дольше queueWaitMs (не томим зря); timeout — ждали; abort — ушёл */
export type QueueBusy = 'overflow' | 'predicted' | 'timeout' | 'abort'
export type QueuePosition = { position: number; waiting: number; etaSec?: number }

type Waiter = {
  grant: () => void
  fail: (why: QueueBusy) => void
  onPosition?: (p: QueuePosition) => void
  lastPos: number
  /** срок ожидания (мс, Date.now()); пауза окна картинок продлевает его (rearm) */
  deadline: number
  rearm: (at: number) => void
}

/** Минимум на первый токен после ожидания в очереди (ожидание вычитается из config.timeouts.firstTokenMs). */
const MIN_FIRST_TOKEN_MS = 8000

export class LlmQueue {
  opts: QueueOptions
  running = 0
  private waiting: Waiter[] = []
  /** скользящее среднее времени, которое запрос держит слот (для оценки ожидания) */
  private avgHoldMs = 0
  /** когда заняты текущие слоты (id → мс) — сколько им ещё осталось по среднему */
  private holding = new Map<number, number>()
  private nextId = 1
  readonly counters = { served: 0, queued: 0, busyOverflow: 0, busyPredicted: 0, busyTimeout: 0, aborted: 0, maxWaitingSeen: 0 }
  /**
   * Пауза (окно картинок, brain/llm/gpuArbiter.ts): новые слоты не выдаются, идущие ответы дорабатывают,
   * ждущие остаются в очереди — их сроки продлеваются на время паузы (никто не получает «занят» из-за картинки).
   */
  paused = false
  pauseReason = ''
  private pauseUntil = 0

  constructor(opts: QueueOptions) {
    this.opts = { ...opts }
  }

  stats() {
    return {
      parallel: this.opts.parallel,
      running: this.running,
      waiting: this.waiting.length,
      cap: this.opts.queueCap,
      ...this.counters,
      paused: this.paused,
      pauseReason: this.paused ? this.pauseReason : '',
      pauseRemainingMs: this.pauseRemainingMs(),
    }
  }

  /** Сколько ещё (по оценке) продлится пауза, мс; 0 — паузы нет. */
  pauseRemainingMs(now = Date.now()): number {
    return this.paused ? Math.max(0, this.pauseUntil - now) : 0
  }

  /** Поставить выдачу слотов на паузу на etaMs (оценка); сроки ждущих продлеваются на etaMs. */
  pause(reason: string, etaMs: number): void {
    const now = Date.now()
    const eta = Math.max(0, etaMs)
    if (this.paused) return this.extendPause(eta)
    this.paused = true
    this.pauseReason = reason
    this.pauseUntil = now + eta
    for (const w of this.waiting) w.rearm(w.deadline + eta)
  }

  /** Пауза затягивается (долгий дренаж, вторая картинка): ещё etaMs и ждущим, и оценке. */
  extendPause(etaMs: number): void {
    if (!this.paused) return
    const eta = Math.max(0, etaMs)
    this.pauseUntil = Math.max(this.pauseUntil, Date.now()) + eta
    for (const w of this.waiting) w.rearm(w.deadline + eta)
  }

  /** Снять паузу и раздать свободные слоты ждущим по порядку. Повторный вызов безопасен. */
  resume(): void {
    if (!this.paused) return
    this.paused = false
    this.pauseReason = ''
    this.pauseUntil = 0
    this.next()
  }

  /**
   * Оценка ожидания для места position (1 — следующий), мс: слоты освобождаются через «среднее − уже прошло»,
   * дальше каждый ждущий занимает слот на среднее время. undefined — замеров мало (меньше 3 ответов).
   * Во время паузы прибавляется её остаток (без замеров — только остаток паузы).
   */
  estimateWaitMs(position: number, now = Date.now()): number | undefined {
    const base = this.baseEstimateMs(position, now)
    const pause = this.pauseRemainingMs(now)
    if (!pause) return base
    return (base ?? 0) + pause
  }

  private baseEstimateMs(position: number, now = Date.now()): number | undefined {
    if (!this.avgHoldMs || this.counters.served < 3) return undefined
    const par = Math.max(1, this.opts.parallel)
    const free = [...this.holding.values()].map((t) => Math.max(0, this.avgHoldMs - (now - t)))
    while (free.length < par) free.push(0)
    free.sort((a, b) => a - b)
    let at = 0
    for (let i = 0; i < position; i++) {
      at = free.shift()!
      free.push(at + this.avgHoldMs)
      free.sort((a, b) => a - b)
    }
    return at
  }

  private eta(position: number): number | undefined {
    const ms = this.estimateWaitMs(position)
    return ms === undefined ? undefined : Math.max(1, Math.round(ms / 1000))
  }

  private notify(): void {
    this.waiting.forEach((w, i) => {
      const position = i + 1
      if (position === w.lastPos) return
      w.lastPos = position
      const eta = this.eta(position)
      w.onPosition?.({ position, waiting: this.waiting.length, ...(eta ? { etaSec: eta } : {}) })
    })
  }

  /**
   * Занять слот. Успех — { release, waitedMs } (release вызвать ровно один раз); иначе — причина отказа.
   * onPosition вызывается при постановке в очередь и при каждом продвижении.
   */
  acquire(o: { onPosition?: (p: QueuePosition) => void; signal?: AbortSignal } = {}): Promise<{ release: () => void; waitedMs: number } | { busy: QueueBusy }> {
    const t0 = Date.now()
    const slot = () => {
      this.running++
      let done = false
      const held = Date.now()
      const id = this.nextId++
      this.holding.set(id, held)
      return {
        waitedMs: Date.now() - t0,
        release: () => {
          if (done) return
          done = true
          this.running--
          this.holding.delete(id)
          const hold = Date.now() - held
          this.avgHoldMs = this.avgHoldMs ? this.avgHoldMs * 0.8 + hold * 0.2 : hold
          this.counters.served++
          this.next()
        },
      }
    }
    if (o.signal?.aborted) return Promise.resolve({ busy: 'abort' as const })
    if (!this.paused && this.running < Math.max(1, this.opts.parallel) && !this.waiting.length) return Promise.resolve(slot())
    if (this.waiting.length >= this.opts.queueCap) {
      this.counters.busyOverflow++
      return Promise.resolve({ busy: 'overflow' as const })
    }
    // по замерам очередь не дойдёт за queueWaitMs (с запасом 25 %) — сразу честный запасной путь, без пустого ожидания
    // (оценка без паузы: из-за окна картинок «занят» не выдаётся — срок ожидания продлевается ниже)
    const est = this.baseEstimateMs(this.waiting.length + 1)
    if (est !== undefined && est > this.opts.queueWaitMs * 1.25) {
      this.counters.busyPredicted++
      return Promise.resolve({ busy: 'predicted' as const })
    }
    return new Promise((resolve) => {
      let timer: NodeJS.Timeout | null = null
      const cleanup = () => {
        if (timer) clearTimeout(timer)
        o.signal?.removeEventListener('abort', onAbort)
        const i = this.waiting.indexOf(w)
        if (i >= 0) this.waiting.splice(i, 1)
      }
      const w: Waiter = {
        lastPos: 0,
        deadline: 0,
        rearm: (at) => {
          w.deadline = at
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => w.fail('timeout'), Math.max(0, at - Date.now()))
          timer.unref?.()
        },
        onPosition: o.onPosition,
        grant: () => {
          cleanup()
          resolve(slot())
        },
        fail: (why) => {
          cleanup()
          if (why === 'timeout') this.counters.busyTimeout++
          if (why === 'abort') this.counters.aborted++
          resolve({ busy: why })
          this.notify()
        },
      }
      const onAbort = () => w.fail('abort')
      o.signal?.addEventListener('abort', onAbort, { once: true })
      // в паузе срок = queueWaitMs + остаток паузы (окно картинок не съедает время ученика)
      w.rearm(Date.now() + Math.max(0, this.opts.queueWaitMs) + this.pauseRemainingMs())
      this.waiting.push(w)
      this.counters.queued++
      this.counters.maxWaitingSeen = Math.max(this.counters.maxWaitingSeen, this.waiting.length)
      this.notify()
    })
  }

  private next(): void {
    while (!this.paused && this.running < Math.max(1, this.opts.parallel) && this.waiting.length) {
      const w = this.waiting[0]!
      w.grant() // grant убирает его из списка и занимает слот
    }
    this.notify()
  }
}

/**
 * LlmClient одного запроса /chat: первый вызов модели занимает слот очереди, release() (сервер, в конце запроса)
 * его отдаёт. Не дождался — busy: status() дальше говорит «модели нет», и конвейер честно отвечает запасным путём.
 */
export class QueueTicket implements LlmClient {
  busy: QueueBusy | null = null
  waitedMs = 0
  private slot: Promise<boolean> | null = null
  private releaseFn: (() => void) | null = null
  private released = false
  private base: LlmClient
  private queue: LlmQueue
  private hooks: { onPosition?: (p: QueuePosition) => void; signal?: AbortSignal }

  constructor(base: LlmClient, queue: LlmQueue, hooks: { onPosition?: (p: QueuePosition) => void; signal?: AbortSignal } = {}) {
    this.base = base
    this.queue = queue
    this.hooks = hooks
  }

  status(): LlmStatus {
    const st = this.base.status()
    return this.busy ? { ...st, available: false } : st
  }

  refresh(): Promise<LlmStatus> {
    return this.base.refresh()
  }

  /** Занять слот один раз на весь запрос. */
  private ensureSlot(signal?: AbortSignal): Promise<boolean> {
    if (this.busy) return Promise.resolve(false)
    if (this.released) return Promise.resolve(false)
    if (!this.slot) {
      let queued = false
      const onPosition = (p: QueuePosition) => {
        queued = true
        this.hooks.onPosition?.(p)
      }
      this.slot = this.queue.acquire({ onPosition, signal: signal ?? this.hooks.signal }).then((r) => {
        if ('busy' in r) {
          this.busy = r.busy
          return false
        }
        this.waitedMs = r.waitedMs
        // дождался — position 0: сайт убирает «в очереди» и показывает «Думаю…»
        if (queued) this.hooks.onPosition?.({ position: 0, waiting: this.queue.stats().waiting })
        if (this.released) {
          r.release() // запрос уже закончился, пока ждали
          return false
        }
        this.releaseFn = r.release
        return true
      })
    }
    return this.slot
  }

  /** Отдать слот (сервер зовёт в finally запроса). Повторный вызов безопасен. */
  release(): void {
    this.released = true
    this.releaseFn?.()
    this.releaseFn = null
  }

  async chatStream(o: ChatStreamOptions): Promise<ChatStreamResult> {
    if (!(await this.ensureSlot(o.signal))) {
      return { text: '', stopped: this.busy === 'abort' || o.signal?.aborted ? 'client_abort' : 'error', error: `busy:${this.busy ?? 'released'}` }
    }
    // ожидание в очереди съедает срок первого токена: сайт ждёт первый кусок ответа фиксированное время
    const firstTokenMs = this.waitedMs > 0 ? Math.min(o.firstTokenMs, Math.max(MIN_FIRST_TOKEN_MS, o.firstTokenMs - this.waitedMs)) : o.firstTokenMs
    return this.base.chatStream({ ...o, firstTokenMs })
  }

  async complete(o: { model: string; messages: LlmMessage[]; temperature?: number; numPredict?: number; timeoutMs: number; signal?: AbortSignal }): Promise<string | null> {
    if (!(await this.ensureSlot(o.signal))) return null
    return this.base.complete(o)
  }

  embed(texts: string[], timeoutMs: number, signal?: AbortSignal): Promise<number[][] | null> {
    return this.base.embed(texts, timeoutMs, signal)
  }
}
