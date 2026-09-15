/**
 * FIFO-очередь реплик ученика для живого диалога.
 *
 * Раньше реплика, пришедшая пока учитель говорил приветствие/объявление режима
 * или реагировал на камеру, записывалась в единственный слот и терялась.
 * Теперь каждая реплика (голос, набранный текст, команда кнопки) попадает в
 * очередь и обрабатывается строго по порядку, по одной.
 *
 * Модуль чистый (без DOM) — покрыт тестами.
 */

export type TurnInputKind = 'voice' | 'text' | 'command'

export interface TurnInput {
  id: number
  kind: TurnInputKind
  text: string
  /** Время постановки в очередь (мс, часы из options.now). */
  at: number
  meta?: Record<string, unknown>
}

export interface TurnQueueOptions {
  handler: (item: TurnInput) => Promise<void>
  /** Склеивать подряд идущие голосовые куски, если второй пришёл в пределах окна. */
  coalesceVoiceMs?: number
  now?: () => number
  onError?: (error: unknown, item: TurnInput) => void
  onChange?: (pending: readonly TurnInput[], processing: TurnInput | null) => void
}

export class TurnQueue {
  private readonly opts: Required<Pick<TurnQueueOptions, 'coalesceVoiceMs'>> & TurnQueueOptions
  private readonly items: TurnInput[] = []
  private current: TurnInput | null = null
  private nextId = 1
  private pumping = false
  private idleWaiters: Array<() => void> = []
  private closed = false

  constructor(options: TurnQueueOptions) {
    this.opts = { coalesceVoiceMs: 2500, ...options }
  }

  private now(): number {
    return this.opts.now ? this.opts.now() : Date.now()
  }

  /** Поставить реплику в очередь. Никогда не отбрасывает непустой текст. */
  enqueue(kind: TurnInputKind, text: string, meta?: Record<string, unknown>): TurnInput | null {
    const clean = text.trim()
    if (!clean || this.closed) return null
    const at = this.now()

    const last = this.items[this.items.length - 1]
    if (
      kind === 'voice' &&
      last &&
      last.kind === 'voice' &&
      at - last.at <= this.opts.coalesceVoiceMs
    ) {
      // Ученик договаривает мысль паузой — это одна реплика, а не две.
      last.text = `${last.text} ${clean}`.replace(/\s+/g, ' ')
      last.at = at
      this.emitChange()
      return last
    }

    const item: TurnInput = { id: this.nextId++, kind, text: clean, at, meta }
    this.items.push(item)
    this.emitChange()
    void this.pump()
    return item
  }

  get size(): number {
    return this.items.length
  }

  pending(): readonly TurnInput[] {
    return [...this.items]
  }

  processing(): TurnInput | null {
    return this.current
  }

  isBusy(): boolean {
    return this.current !== null || this.items.length > 0
  }

  /** Удалить ожидающие (не текущую). Возвращает удалённые. */
  clear(): TurnInput[] {
    const dropped = this.items.splice(0, this.items.length)
    this.emitChange()
    return dropped
  }

  /** Закрыть очередь (сессия завершена). */
  close(): void {
    this.closed = true
    this.clear()
  }

  reopen(): void {
    this.closed = false
  }

  whenIdle(): Promise<void> {
    if (!this.isBusy()) return Promise.resolve()
    return new Promise((resolve) => this.idleWaiters.push(resolve))
  }

  private emitChange(): void {
    this.opts.onChange?.(this.pending(), this.current)
  }

  private async pump(): Promise<void> {
    if (this.pumping) return
    this.pumping = true
    try {
      while (this.items.length > 0) {
        const item = this.items.shift()!
        this.current = item
        this.emitChange()
        try {
          await this.opts.handler(item)
        } catch (error) {
          this.opts.onError?.(error, item)
        } finally {
          this.current = null
        }
      }
    } finally {
      this.pumping = false
      this.emitChange()
      if (!this.isBusy()) {
        const waiters = this.idleWaiters
        this.idleWaiters = []
        waiters.forEach((w) => w())
      }
    }
  }
}
