/**
 * Interruption Handling (barge-in).
 *
 * Следит за состоянием диалога. Перебивание ИИ разрешено только если
 * `bargeInEnabled === true`. В half-duplex (анти-эхо) VAD во время речи ИИ
 * игнорируется на уровне duplex-сессии, а контроллер тоже не глушит TTS.
 */
export type DialogTurn = 'idle' | 'ai_speaking' | 'user_speaking' | 'thinking'

export interface InterruptionOptions {
  /** Сколько мс непрерывной речи ученика считается настоящим перебиванием. */
  bargeInConfirmMs?: number
  /** Разрешить глушить ИИ при речи ученика. По умолчанию false. */
  bargeInEnabled?: boolean
  /** Немедленно заглушить ИИ. */
  onStopAiSpeech: () => void
  /** Ученик перебил ИИ — нужно зафиксировать поток и пересчитать ответ. */
  onBargeIn: () => void
  onTurnChange?: (turn: DialogTurn) => void
}

export class InterruptionController {
  private readonly opts: Required<
    Omit<InterruptionOptions, 'onStopAiSpeech' | 'onBargeIn' | 'onTurnChange'>
  > &
    Pick<InterruptionOptions, 'onStopAiSpeech' | 'onBargeIn' | 'onTurnChange'>

  private turn: DialogTurn = 'idle'
  private userSpeechStartMs = 0
  private bargeFired = false

  constructor(options: InterruptionOptions) {
    this.opts = {
      bargeInConfirmMs: options.bargeInConfirmMs ?? 320,
      bargeInEnabled: options.bargeInEnabled === true,
      onStopAiSpeech: options.onStopAiSpeech,
      onBargeIn: options.onBargeIn,
      onTurnChange: options.onTurnChange,
    }
  }

  getTurn(): DialogTurn {
    return this.turn
  }

  private setTurn(turn: DialogTurn): void {
    if (this.turn === turn) return
    this.turn = turn
    this.opts.onTurnChange?.(turn)
  }

  /** ИИ начал говорить. */
  aiSpeechStarted(): void {
    this.bargeFired = false
    this.setTurn('ai_speaking')
  }

  /** ИИ закончил говорить сам (без перебивания). */
  aiSpeechEnded(): void {
    if (this.turn === 'ai_speaking') this.setTurn('idle')
  }

  /** ИИ «думает» (идёт оценка/генерация ответа). */
  thinkingStarted(): void {
    this.setTurn('thinking')
  }

  /** VAD зафиксировал начало речи ученика. */
  userSpeechStarted(): void {
    this.userSpeechStartMs = Date.now()
    if (this.turn === 'ai_speaking') {
      if (!this.opts.bargeInEnabled || this.bargeFired) return
      this.opts.onStopAiSpeech()
      return
    }
    this.setTurn('user_speaking')
  }

  /** VAD присылает уровень — подтверждаем реальный барджин по длительности. */
  userSpeechTick(): void {
    if (!this.opts.bargeInEnabled) return
    if (this.bargeFired) return
    if (this.turn !== 'ai_speaking' && this.turn !== 'user_speaking') return
    const speaking = Date.now() - this.userSpeechStartMs
    if (speaking >= this.opts.bargeInConfirmMs) {
      this.bargeFired = true
      this.setTurn('user_speaking')
      this.opts.onBargeIn()
    }
  }

  /** Речь ученика завершилась (тишина). */
  userSpeechEnded(): void {
    if (this.turn === 'user_speaking') this.setTurn('idle')
  }

  reset(): void {
    this.bargeFired = false
    this.setTurn('idle')
  }
}
