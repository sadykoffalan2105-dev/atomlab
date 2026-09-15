/**
 * Тайминги живого разговора: перебивание (barge-in) и конец реплики ученика.
 *
 * Чистые state-machine без DOM и без реальных таймеров — часы и таймеры
 * внедряются (`TimingScheduler`), поэтому логика тестируется с фейковым временем
 * (scripts/test-teacher-live-engine.mts).
 */

export interface TimingScheduler {
  now(): number
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export const realScheduler: TimingScheduler = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
}

/* ------------------------------------------------------------------ barge-in */

export type BargeInState = 'idle' | 'ai_speaking' | 'fired'

export interface BargeInInfo {
  /** Текст ученика, который подтвердил перебивание. */
  text: string
  /** Сколько мс длилась громкая речь к моменту решения. */
  speechMs: number
  at: number
}

export interface BargeInOptions {
  scheduler?: TimingScheduler
  /** Минимальная длительность громкой речи (мс). */
  minSpeechMs?: number
  /** Порог RMS во время речи учителя (выше обычного VAD — эхо колонок тише). */
  energyThreshold?: number
  /** Короткие провалы громкости внутри слова не обнуляют счётчик. */
  gapToleranceMs?: number
  /** Сколько живёт подтверждающий транскрипт. */
  transcriptWindowMs?: number
  /** VAD недоступен (нет AudioContext) → хватает не-эхо транскрипта. */
  vadAvailable?: boolean
  /** Первые мс речи учителя игнорируем (щелчок/начало фразы в колонках). */
  aiStartGraceMs?: number
  isEcho: (text: string) => boolean
  onBargeIn: (info: BargeInInfo) => void
}

const STOP_WORDS_RE = /(^|[^\p{L}])(стоп|подожди|погоди|хватит|stop|wait|to[‘'`ʻ]?xta|kuting?)([^\p{L}]|$)/iu

function meaningfulTranscript(text: string): boolean {
  const words = text.trim().split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w))
  if (STOP_WORDS_RE.test(text)) return true
  if (words.length >= 2) return true
  return words.length === 1 && words[0]!.length >= 5
}

/**
 * Решает, что ученик действительно перебивает учителя:
 * громкость выше порога ≥ minSpeechMs И не-эхо транскрипт в пределах окна.
 */
export class BargeInDetector {
  private readonly s: TimingScheduler
  private readonly o: Required<Omit<BargeInOptions, 'scheduler' | 'isEcho' | 'onBargeIn'>> &
    Pick<BargeInOptions, 'isEcho' | 'onBargeIn'>
  private stateValue: BargeInState = 'idle'
  private loudStart: number | null = null
  private lastLoud = 0
  private lastRunMs = 0
  private lastRunEndAt = -Infinity
  private aiStartAt = 0
  private transcriptText = ''
  private transcriptAt = -Infinity
  private enabled = true

  constructor(options: BargeInOptions) {
    this.s = options.scheduler ?? realScheduler
    this.o = {
      minSpeechMs: options.minSpeechMs ?? 220,
      energyThreshold: options.energyThreshold ?? 0.04,
      gapToleranceMs: options.gapToleranceMs ?? 140,
      transcriptWindowMs: options.transcriptWindowMs ?? 1800,
      vadAvailable: options.vadAvailable ?? true,
      aiStartGraceMs: options.aiStartGraceMs ?? 120,
      isEcho: options.isEcho,
      onBargeIn: options.onBargeIn,
    }
  }

  get state(): BargeInState {
    return this.stateValue
  }

  setEnabled(on: boolean): void {
    this.enabled = on
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setVadAvailable(on: boolean): void {
    this.o.vadAvailable = on
  }

  /** Учитель начал/закончил говорить. */
  setAiSpeaking(on: boolean): void {
    if (on) {
      if (this.stateValue === 'ai_speaking') return
      this.stateValue = 'ai_speaking'
      this.aiStartAt = this.s.now()
      this.loudStart = null
      this.lastRunMs = 0
      this.lastRunEndAt = -Infinity
      this.transcriptText = ''
      this.transcriptAt = -Infinity
    } else {
      this.stateValue = 'idle'
      this.loudStart = null
    }
  }

  /** Очередной кадр VAD (RMS 0..1). */
  level(rms: number): void {
    if (this.stateValue !== 'ai_speaking') return
    const now = this.s.now()
    if (now - this.aiStartAt < this.o.aiStartGraceMs) return
    if (rms >= this.o.energyThreshold) {
      if (this.loudStart === null) this.loudStart = now
      this.lastLoud = now
    } else if (this.loudStart !== null && now - this.lastLoud > this.o.gapToleranceMs) {
      // Серия закончилась — запоминаем её: транскрипт STT часто приходит позже звука.
      this.lastRunMs = this.lastLoud - this.loudStart
      this.lastRunEndAt = this.lastLoud
      this.loudStart = null
    }
    this.evaluate(now)
  }

  /** Промежуточный или финальный транскрипт, пришедший во время речи учителя. */
  transcript(text: string): void {
    if (this.stateValue !== 'ai_speaking') return
    const clean = text.trim()
    if (!clean || this.o.isEcho(clean) || !meaningfulTranscript(clean)) return
    const now = this.s.now()
    this.transcriptText = clean
    this.transcriptAt = now
    this.evaluate(now)
  }

  /** Длительность текущей громкой серии (мс), 0 если тишина. */
  loudMs(): number {
    return this.loudStart === null ? 0 : this.s.now() - this.loudStart
  }

  private evaluate(now: number): void {
    if (!this.enabled || this.stateValue !== 'ai_speaking') return
    const hasTranscript = now - this.transcriptAt <= this.o.transcriptWindowMs
    if (!hasTranscript) return
    let speechMs = 0
    if (this.o.vadAvailable) {
      if (this.loudStart !== null) {
        speechMs = now - this.loudStart
      } else if (now - this.lastRunEndAt <= this.o.transcriptWindowMs) {
        // Короткое «стоп»: звук уже кончился, а транскрипт пришёл следом.
        speechMs = this.lastRunMs
      }
      if (speechMs < this.o.minSpeechMs) return
    }
    this.stateValue = 'fired'
    this.loudStart = null
    this.o.onBargeIn({ text: this.transcriptText, speechMs, at: now })
  }
}

/* --------------------------------------------------------------- end of turn */

export type TurnCommitReason = 'final' | 'silence' | 'stable_interim' | 'forced'

export interface TurnCommit {
  text: string
  reason: TurnCommitReason
  /** В тексте есть незавершённый (interim) хвост — финал того же куска надо отбросить. */
  usedInterim: boolean
  at: number
}

export interface TurnEndOptions {
  scheduler?: TimingScheduler
  /** Тишина после речи (VAD), после которой реплика считается законченной. */
  silenceMs?: number
  /** После финального результата STT ждём ещё чуть-чуть (вдруг продолжит). */
  finalSettleMs?: number
  /** Без VAD: interim не меняется столько мс → коммит. */
  interimStableMs?: number
  /** Если VAD сказал «тишина», а текста ещё нет — ждём STT до этого срока. */
  transcriptGraceMs?: number
  vadAvailable?: boolean
  onCommit: (commit: TurnCommit) => void
}

/**
 * Быстрый конец реплики: финальный результат STT (+finalSettleMs) или
 * silenceMs тишины после речи по VAD — что наступит раньше.
 */
export class TurnEndDetector {
  private readonly s: TimingScheduler
  private readonly o: Required<Omit<TurnEndOptions, 'scheduler' | 'onCommit'>> &
    Pick<TurnEndOptions, 'onCommit'>
  private finalText = ''
  private interimText = ''
  private speaking = false
  private lastSpeechEndAt: number | null = null
  private timer: unknown = null
  private timerReason: TurnCommitReason | null = null
  private paused = false

  constructor(options: TurnEndOptions) {
    this.s = options.scheduler ?? realScheduler
    this.o = {
      silenceMs: options.silenceMs ?? 650,
      finalSettleMs: options.finalSettleMs ?? 220,
      interimStableMs: options.interimStableMs ?? 1100,
      transcriptGraceMs: options.transcriptGraceMs ?? 900,
      vadAvailable: options.vadAvailable ?? true,
      onCommit: options.onCommit,
    }
  }

  setVadAvailable(on: boolean): void {
    this.o.vadAvailable = on
  }

  /** Пауза (учитель говорит в half-duplex) — ничего не коммитим. */
  setPaused(on: boolean): void {
    this.paused = on
    if (on) this.cancelTimer()
  }

  pendingText(): string {
    return `${this.finalText} ${this.interimText}`.replace(/\s+/g, ' ').trim()
  }

  isSpeaking(): boolean {
    return this.speaking
  }

  speechStart(): void {
    this.speaking = true
    this.lastSpeechEndAt = null
    this.cancelTimer()
  }

  speechEnd(): void {
    if (!this.speaking) return
    this.speaking = false
    this.lastSpeechEndAt = this.s.now()
    // Финальный текст уже есть и хвоста interim нет — ждать полную тишину незачем.
    if (this.finalText && !this.interimText) this.arm('final', Math.min(this.o.finalSettleMs, this.o.silenceMs))
    else this.arm('silence', this.o.silenceMs)
  }

  /** Промежуточный текст текущего куска речи. */
  interim(text: string): void {
    const clean = text.trim()
    if (clean === this.interimText) return
    this.interimText = clean
    if (!clean) return
    if (this.timerReason === 'final') this.cancelTimer()
    if (!this.o.vadAvailable) {
      this.arm('stable_interim', this.o.interimStableMs)
    } else if (!this.speaking && this.lastSpeechEndAt !== null) {
      // Текст догнал уже закончившуюся речь — коммитим по оставшейся тишине.
      const left = this.o.silenceMs - (this.s.now() - this.lastSpeechEndAt)
      this.arm('silence', Math.max(0, left))
    }
  }

  /** Весь новый финальный текст (накопленный с последнего коммита). */
  final(text: string): void {
    const clean = text.trim()
    if (!clean) return
    this.finalText = clean
    this.interimText = ''
    if (this.speaking && this.o.vadAvailable) return
    this.arm('final', this.o.finalSettleMs)
  }

  /** Принудительно закоммитить то, что есть (кнопка / смена режима). */
  flush(): TurnCommit | null {
    return this.commit('forced')
  }

  reset(): void {
    this.cancelTimer()
    this.finalText = ''
    this.interimText = ''
    this.speaking = false
    this.lastSpeechEndAt = null
  }

  private arm(reason: TurnCommitReason, ms: number): void {
    if (this.paused) return
    this.cancelTimer()
    this.timerReason = reason
    this.timer = this.s.setTimeout(() => {
      this.timer = null
      this.timerReason = null
      this.onTimer(reason)
    }, ms)
  }

  private cancelTimer(): void {
    if (this.timer !== null) this.s.clearTimeout(this.timer)
    this.timer = null
    this.timerReason = null
  }

  private onTimer(reason: TurnCommitReason): void {
    if (this.paused) return
    if (this.speaking && this.o.vadAvailable && reason !== 'stable_interim') return
    if (!this.pendingText()) {
      if (reason === 'silence' && this.lastSpeechEndAt !== null) {
        const waited = this.s.now() - this.lastSpeechEndAt
        const left = this.o.silenceMs + this.o.transcriptGraceMs - waited
        if (left > 0) this.arm('silence', left)
      }
      return
    }
    this.commit(reason)
  }

  private commit(reason: TurnCommitReason): TurnCommit | null {
    const text = this.pendingText()
    this.cancelTimer()
    if (text.length < 2) return null
    const commit: TurnCommit = {
      text,
      reason,
      usedInterim: this.interimText.length > 0,
      at: this.s.now(),
    }
    this.finalText = ''
    this.interimText = ''
    this.lastSpeechEndAt = null
    this.o.onCommit(commit)
    return commit
  }
}
