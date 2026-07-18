/**
 * Voice Activity Detection (VAD) на Web Audio API.
 *
 * Слушает микрофонный MediaStream, считает RMS-громкость и по порогу с
 * гистерезисом определяет начало/конец речи. Это основа для «барджина»
 * (перебивания ИИ) и для детекции конца реплики ученика.
 */
export interface AudioActivityOptions {
  /** Порог начала речи (RMS 0..1). */
  startThreshold?: number
  /** Порог конца речи (ниже — тишина). */
  endThreshold?: number
  /** Сколько мс тишины считается концом реплики. */
  silenceHangoverMs?: number
  /** Минимальная длительность речи, чтобы не реагировать на щелчки. */
  minSpeechMs?: number
  onSpeechStart?: () => void
  onSpeechEnd?: (durationMs: number) => void
  onLevel?: (rms: number, speaking: boolean) => void
}

type AudioCtxCtor = typeof AudioContext

function getAudioContextCtor(): AudioCtxCtor | null {
  const w = window as unknown as { AudioContext?: AudioCtxCtor; webkitAudioContext?: AudioCtxCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

export class AudioActivityDetector {
  private readonly opts: Required<Omit<AudioActivityOptions, 'onSpeechStart' | 'onSpeechEnd' | 'onLevel'>> &
    Pick<AudioActivityOptions, 'onSpeechStart' | 'onSpeechEnd' | 'onLevel'>

  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private buffer = new Float32Array(0)
  private raf: number | null = null
  private timer: ReturnType<typeof setInterval> | null = null

  private speaking = false
  private speechStartMs = 0
  private lastLoudMs = 0
  private running = false

  constructor(options: AudioActivityOptions) {
    this.opts = {
      startThreshold: options.startThreshold ?? 0.045,
      endThreshold: options.endThreshold ?? 0.02,
      silenceHangoverMs: options.silenceHangoverMs ?? 900,
      minSpeechMs: options.minSpeechMs ?? 220,
      onSpeechStart: options.onSpeechStart,
      onSpeechEnd: options.onSpeechEnd,
      onLevel: options.onLevel,
    }
  }

  async attach(stream: MediaStream): Promise<boolean> {
    const Ctor = getAudioContextCtor()
    if (!Ctor) return false
    try {
      this.ctx = new Ctor()
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      this.source = this.ctx.createMediaStreamSource(stream)
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 1024
      this.analyser.smoothingTimeConstant = 0.6
      this.buffer = new Float32Array(this.analyser.fftSize)
      this.source.connect(this.analyser)
      this.running = true
      this.loop()
      return true
    } catch {
      this.detach()
      return false
    }
  }

  private currentRms(): number {
    if (!this.analyser) return 0
    this.analyser.getFloatTimeDomainData(this.buffer)
    let sum = 0
    for (let i = 0; i < this.buffer.length; i++) {
      const v = this.buffer[i]!
      sum += v * v
    }
    return Math.sqrt(sum / this.buffer.length)
  }

  private loop = (): void => {
    if (!this.running) return
    const rms = this.currentRms()
    const now = Date.now()

    if (rms >= this.opts.startThreshold) {
      this.lastLoudMs = now
      if (!this.speaking) {
        this.speaking = true
        this.speechStartMs = now
        this.opts.onSpeechStart?.()
      }
    } else if (this.speaking && rms < this.opts.endThreshold) {
      if (now - this.lastLoudMs > this.opts.silenceHangoverMs) {
        const duration = now - this.speechStartMs
        this.speaking = false
        if (duration >= this.opts.minSpeechMs) this.opts.onSpeechEnd?.(duration)
      }
    }

    this.opts.onLevel?.(rms, this.speaking)

    if (typeof requestAnimationFrame === 'function') {
      this.raf = requestAnimationFrame(this.loop)
    } else if (!this.timer) {
      this.timer = setInterval(this.loop, 50)
    }
  }

  isSpeaking(): boolean {
    return this.speaking
  }

  detach(): void {
    this.running = false
    if (this.raf != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.raf)
    this.raf = null
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    try {
      this.source?.disconnect()
      this.analyser?.disconnect()
    } catch {
      /* already disconnected */
    }
    if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close().catch(() => {})
    this.ctx = null
    this.analyser = null
    this.source = null
    this.speaking = false
  }
}
