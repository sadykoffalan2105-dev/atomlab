/**
 * Real-Time Duplex Transport — двусторонний канал для непрерывного голосового
 * диалога. Абстракция над транспортом: сервер реального времени (WebSocket)
 * либо локальный контур (без сервера), когда работаем полностью в браузере.
 *
 * Кадры протокола (JSON) намеренно простые и совместимы с WebRTC-датаканалом,
 * если позже понадобится перейти на peer-to-peer аудио.
 */
export type RealtimeState = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

/** Кадры от клиента к серверу. */
export type ClientFrame =
  | { type: 'session.start'; lang: string; studentId: string; topic?: string }
  | { type: 'audio.chunk'; seq: number; b64: string; final?: boolean }
  | { type: 'user.transcript'; text: string; final: boolean }
  | { type: 'barge_in' }
  | { type: 'session.end' }

/** Кадры от сервера к клиенту. */
export type ServerFrame =
  | { type: 'ready' }
  | { type: 'tutor.text'; text: string; turnId: string }
  | { type: 'tutor.audio'; seq: number; b64: string; mime: string; final?: boolean }
  | { type: 'tutor.done'; turnId: string }
  | { type: 'error'; message: string }

export interface RealtimeTransport {
  readonly kind: 'websocket' | 'local'
  connect(): Promise<void>
  send(frame: ClientFrame): void
  onMessage(handler: (frame: ServerFrame) => void): void
  onStateChange(handler: (state: RealtimeState) => void): void
  getState(): RealtimeState
  close(): void
}

// --------------------------- WebSocket-транспорт ---------------------------

export interface WebSocketTransportConfig {
  url: string
  protocols?: string | string[]
  maxReconnect?: number
  reconnectBaseMs?: number
}

export class WebSocketDuplexTransport implements RealtimeTransport {
  readonly kind = 'websocket' as const
  private ws: WebSocket | null = null
  private state: RealtimeState = 'idle'
  private readonly cfg: Required<Omit<WebSocketTransportConfig, 'protocols'>> &
    Pick<WebSocketTransportConfig, 'protocols'>
  private messageHandler: ((frame: ServerFrame) => void) | null = null
  private stateHandler: ((state: RealtimeState) => void) | null = null
  private reconnectAttempts = 0
  private outbox: ClientFrame[] = []
  private manualClose = false

  constructor(config: WebSocketTransportConfig) {
    this.cfg = {
      url: config.url,
      protocols: config.protocols,
      maxReconnect: config.maxReconnect ?? 5,
      reconnectBaseMs: config.reconnectBaseMs ?? 700,
    }
  }

  private setState(state: RealtimeState): void {
    if (this.state === state) return
    this.state = state
    this.stateHandler?.(state)
  }

  connect(): Promise<void> {
    this.manualClose = false
    return new Promise<void>((resolve, reject) => {
      let settled = false
      try {
        this.setState('connecting')
        this.ws = new WebSocket(this.cfg.url, this.cfg.protocols)
        this.ws.binaryType = 'arraybuffer'
      } catch (err) {
        this.setState('error')
        reject(err instanceof Error ? err : new Error('WebSocket construction failed'))
        return
      }

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.setState('open')
        this.flushOutbox()
        if (!settled) {
          settled = true
          resolve()
        }
      }
      this.ws.onmessage = (event) => this.handleRaw(event.data)
      this.ws.onerror = () => {
        this.setState('error')
        if (!settled) {
          settled = true
          reject(new Error('WebSocket error'))
        }
      }
      this.ws.onclose = () => {
        this.setState('closed')
        if (!this.manualClose) this.scheduleReconnect()
      }
    })
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.cfg.maxReconnect) return
    const delay = this.cfg.reconnectBaseMs * Math.pow(2, this.reconnectAttempts)
    this.reconnectAttempts += 1
    setTimeout(() => {
      if (!this.manualClose) void this.connect().catch(() => {})
    }, delay)
  }

  private handleRaw(data: unknown): void {
    if (typeof data !== 'string') return
    try {
      const frame = JSON.parse(data) as ServerFrame
      this.messageHandler?.(frame)
    } catch {
      /* некорректный кадр — игнорируем */
    }
  }

  private flushOutbox(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    for (const frame of this.outbox) this.ws.send(JSON.stringify(frame))
    this.outbox = []
  }

  send(frame: ClientFrame): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame))
    } else {
      this.outbox.push(frame)
    }
  }

  onMessage(handler: (frame: ServerFrame) => void): void {
    this.messageHandler = handler
  }

  onStateChange(handler: (state: RealtimeState) => void): void {
    this.stateHandler = handler
  }

  getState(): RealtimeState {
    return this.state
  }

  close(): void {
    this.manualClose = true
    try {
      this.ws?.close()
    } catch {
      /* ignore */
    }
    this.ws = null
    this.setState('closed')
  }
}

// ----------------------------- Локальный контур -----------------------------

/**
 * Локальный транспорт: сервера нет, весь интеллект — в браузере (UnifiedBrain
 * + TTS/STT). Реализует тот же интерфейс, чтобы duplex-сессия не зависела от
 * наличия бэкенда. Ответы генерирует переданный обработчик локального мозга.
 */
export interface LocalBrainBridge {
  onSessionStart?: (lang: string, studentId: string, topic?: string) => void
  onUserTranscript: (text: string, final: boolean) => Promise<{ text: string; turnId: string } | null>
  onBargeIn?: () => void
  onSessionEnd?: () => void
}

export class LocalLoopbackTransport implements RealtimeTransport {
  readonly kind = 'local' as const
  private state: RealtimeState = 'idle'
  private messageHandler: ((frame: ServerFrame) => void) | null = null
  private stateHandler: ((state: RealtimeState) => void) | null = null
  private readonly bridge: LocalBrainBridge

  constructor(bridge: LocalBrainBridge) {
    this.bridge = bridge
  }

  private setState(state: RealtimeState): void {
    if (this.state === state) return
    this.state = state
    this.stateHandler?.(state)
  }

  connect(): Promise<void> {
    this.setState('connecting')
    this.setState('open')
    queueMicrotask(() => this.messageHandler?.({ type: 'ready' }))
    return Promise.resolve()
  }

  send(frame: ClientFrame): void {
    switch (frame.type) {
      case 'session.start':
        this.bridge.onSessionStart?.(frame.lang, frame.studentId, frame.topic)
        break
      case 'barge_in':
        this.bridge.onBargeIn?.()
        break
      case 'session.end':
        this.bridge.onSessionEnd?.()
        break
      case 'user.transcript':
        void this.handleTranscript(frame.text, frame.final)
        break
      case 'audio.chunk':
        // Локально сырое аудио не декодируем — STT идёт через Web Speech.
        break
    }
  }

  private async handleTranscript(text: string, final: boolean): Promise<void> {
    const reply = await this.bridge.onUserTranscript(text, final)
    if (!reply) return
    this.messageHandler?.({ type: 'tutor.text', text: reply.text, turnId: reply.turnId })
    this.messageHandler?.({ type: 'tutor.done', turnId: reply.turnId })
  }

  onMessage(handler: (frame: ServerFrame) => void): void {
    this.messageHandler = handler
  }

  onStateChange(handler: (state: RealtimeState) => void): void {
    this.stateHandler = handler
  }

  getState(): RealtimeState {
    return this.state
  }

  close(): void {
    this.setState('closed')
  }
}

export interface TransportFactoryConfig {
  websocketUrl?: string | null
  localBridge: LocalBrainBridge
}

/**
 * Фабрика транспорта: если задан URL сервера реального времени — WebSocket,
 * иначе локальный контур в браузере. UI код от выбора не зависит.
 */
export function createRealtimeTransport(config: TransportFactoryConfig): RealtimeTransport {
  const url = config.websocketUrl?.trim()
  if (url) return new WebSocketDuplexTransport({ url })
  return new LocalLoopbackTransport(config.localBridge)
}
