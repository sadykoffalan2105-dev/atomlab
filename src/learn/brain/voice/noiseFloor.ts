/**
 * Адаптивный порог речи (VAD) по уровню шума — вместо фиксированных 0.03 / 0.016.
 *
 *  • floor — медиана RMS первых 1,5 с (калибровка), дальше — EMA только в тишине;
 *  • start = max(0.012, floor × 3), end = max(0.008, floor × 1.8);
 *  • речь: громче start ≥ minSpeech (120 мс) не нужно — начало сразу, но конец короче minSpeech
 *    приходит с duration < minSpeech (потребитель считает это щелчком), hangover 250 мс.
 *
 * Тихий ноутбучный микрофон (шум 0.006, речь 0.02) теперь «слышит», шумный класс (шум 0.02)
 * не держит VAD в «говорит» постоянно. Индикатору уровня отдаём уровень относительно шума:
 * нормированный так, что порог start ≈ 0.03 (как раньше) — кольцо микрофона и барджин
 * работают в привычной шкале.
 *
 * Чистый модуль (время передаётся параметром) — тесты: scripts/test-voice-capture.mts.
 */

export interface NoiseFloorOptions {
  calibrateMs?: number
  minStart?: number
  minEnd?: number
  startFactor?: number
  endFactor?: number
  /** Вес нового значения в EMA тишины. */
  emaAlpha?: number
  /** Потолок шума: выше — считаем, что это речь, а не шум (VAD не «глохнет»). */
  maxFloor?: number
}

const DEFAULTS: Required<NoiseFloorOptions> = {
  calibrateMs: 1_500,
  minStart: 0.012,
  minEnd: 0.008,
  startFactor: 3,
  endFactor: 1.8,
  emaAlpha: 0.03,
  maxFloor: 0.06,
}

/** Вес кадра тише текущего шума (быстрый спуск: 0.06 → 0.0005 примерно за 0,3 с). */
const FAST_DOWN_ALPHA = 0.3

/** Начальная оценка шума до калибровки (типичный ноутбук с шумоподавлением). */
const INITIAL_FLOOR = 0.004

export class NoiseFloor {
  private readonly o: Required<NoiseFloorOptions>
  private samples: number[] = []
  private elapsedMs = 0
  private value = INITIAL_FLOOR
  private calibrated = false

  constructor(options: NoiseFloorOptions = {}) {
    this.o = { ...DEFAULTS, ...options }
  }

  get floor(): number {
    return this.value
  }

  get calibrating(): boolean {
    return !this.calibrated
  }

  get startThreshold(): number {
    return Math.max(this.o.minStart, this.value * this.o.startFactor)
  }

  get endThreshold(): number {
    return Math.max(this.o.minEnd, this.value * this.o.endFactor)
  }

  /** Очередной кадр: rms и его длительность. speaking — VAD сейчас в «речи» (шум не обновляем). */
  push(rms: number, frameMs: number, speaking: boolean): void {
    if (!this.calibrated) {
      this.elapsedMs += frameMs
      this.samples.push(rms)
      // Медиана устойчива к коротким словам во время калибровки.
      this.value = Math.min(this.o.maxFloor, median(this.samples))
      if (this.elapsedMs >= this.o.calibrateMs) {
        this.calibrated = true
        this.samples = []
      }
      return
    }
    if (speaking) return
    // Тише текущего шума — быстро вниз: шум не может быть громче тихих кадров (калибровка пришлась на речь —
    // ученик заговорил сразу при открытии микрофона — и порог взлетел до 0.18; без этого VAD «глох» надолго).
    if (rms < this.value) {
      this.value = Math.max(0, this.value * (1 - FAST_DOWN_ALPHA) + rms * FAST_DOWN_ALPHA)
      return
    }
    // В тишине — медленно следим за шумом (вентилятор включили/выключили).
    if (rms < this.startThreshold) {
      const a = this.o.emaAlpha
      this.value = Math.min(this.o.maxFloor, this.value * (1 - a) + rms * a)
    }
  }

  /** Уровень для индикатора/барджина: 0 на уровне шума, ≈ 0.03 на пороге начала речи. */
  normalized(rms: number): number {
    const span = Math.max(0.004, this.startThreshold - this.value)
    return Math.max(0, ((rms - this.value) / span) * 0.03)
  }
}

function median(values: readonly number[]): number {
  if (values.length === 0) return INITIAL_FLOOR
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

export interface AdaptiveVadOptions extends NoiseFloorOptions {
  hangoverMs?: number
  minSpeechMs?: number
  onSpeechStart?: () => void
  /** Приходит на каждый onSpeechStart; durationMs < minSpeechMs — щелчок. */
  onSpeechEnd?: (durationMs: number) => void
  /** rms — нормированный уровень (см. NoiseFloor.normalized), raw — исходный. */
  onLevel?: (rms: number, speaking: boolean, raw: number) => void
}

/** VAD с гистерезисом по адаптивным порогам. Время — от внешних часов (мс). */
export class AdaptiveVad {
  readonly noise: NoiseFloor
  private readonly hangoverMs: number
  readonly minSpeechMs: number
  private readonly o: AdaptiveVadOptions
  private speaking = false
  private speechStartAt = 0
  private lastLoudAt = 0

  constructor(options: AdaptiveVadOptions = {}) {
    this.o = options
    this.noise = new NoiseFloor(options)
    this.hangoverMs = options.hangoverMs ?? 250
    this.minSpeechMs = options.minSpeechMs ?? 120
  }

  isSpeaking(): boolean {
    return this.speaking
  }

  /** Сколько длится текущая речь (мс), 0 — тишина. */
  speechMs(nowMs: number): number {
    return this.speaking ? nowMs - this.speechStartAt : 0
  }

  process(rms: number, frameMs: number, nowMs: number): void {
    // Пока шум не откалиброван — не ниже прежнего фиксированного порога (шумный класс не «говорит» с первой секунды).
    const cal = this.noise.calibrating
    const start = cal ? Math.max(0.03, this.noise.startThreshold) : this.noise.startThreshold
    const end = cal ? Math.max(0.016, this.noise.endThreshold) : this.noise.endThreshold
    // Сравнение с допуском: 0.02 × 3 в двоичной арифметике чуть больше 0.06.
    if (rms >= start - 1e-9) {
      this.lastLoudAt = nowMs
      if (!this.speaking) {
        this.speaking = true
        this.speechStartAt = nowMs
        this.o.onSpeechStart?.()
      }
    } else if (this.speaking && rms < end && nowMs - this.lastLoudAt > this.hangoverMs) {
      this.speaking = false
      this.o.onSpeechEnd?.(nowMs - this.speechStartAt)
    }
    this.noise.push(rms, frameMs, this.speaking)
    this.o.onLevel?.(this.noise.normalized(rms), this.speaking, rms)
  }

  reset(): void {
    if (this.speaking) {
      this.speaking = false
      this.o.onSpeechEnd?.(0)
    }
  }
}
