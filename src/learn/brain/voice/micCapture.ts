/**
 * Захват микрофона для голосового урока: один поток → кадры PCM16 16 кГц + адаптивный VAD.
 *
 *  • openMicOnGesture() — СИНХРОННО в обработчике клика «Начать урок»: AudioContext(16 кГц)
 *    + resume() и getUserMedia в цепочке жеста (iOS/autoplay). Возвращает {context, stream: Promise}.
 *  • MicCapture — AudioWorklet public/worklets/pcm-capture.js (запасной — ScriptProcessor),
 *    кольцевой пре-ролл 400 мс, AdaptiveVad (noiseFloor.ts), события frame/speechStart/speechEnd.
 *    Дорожка пропала (track.onended / devicechange) → состояние 'lost' и одно авто-переоткрытие.
 *  • CaptureVad — VadLike для DuplexVoiceSession поверх того же захвата (второй AudioContext не нужен).
 *
 * Аудио не покидает страницу, кроме сегментов реплик для /stt (serverRecognition.ts).
 */
import { publicAssetUrl } from '../../../utils/publicAssetUrl'
import { currentBrowserVoiceProfile } from '../speech/browserProfile'
import { patchVoiceDiag, setVoiceStatus, voiceLog, type MicState } from '../speech/voiceStatus'
import { AdaptiveVad } from './noiseFloor'
import type { CaptureListener, CaptureSource } from './serverRecognition'
import type { VadLike } from './duplexVoiceSession'
import { FRAME_MS, FRAME_SAMPLES, floatToPcm16, rmsOf, StreamResampler, STT_SAMPLE_RATE } from './wavEncode'

type AudioCtxCtor = typeof AudioContext

function audioCtor(): AudioCtxCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: AudioCtxCtor; webkitAudioContext?: AudioCtxCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

export const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
}

/** Микрофон, открытый в обработчике жеста. */
export interface MicHandle {
  context: AudioContext | null
  stream: Promise<MediaStream | null>
  /** Имя ошибки getUserMedia (NotAllowedError / NotFoundError / NotReadableError…), если была. */
  error(): string | null
  deviceId?: string
  /** Захват уже забрал этот микрофон (повторный монтаж в StrictMode откроет новый). */
  claimed?: boolean
}

export function hasGetUserMedia(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

/** getUserMedia с запасными ограничениями; ошибка — в errorRef. */
export async function requestMicStream(deviceId?: string, errorRef?: { name: string | null }): Promise<MediaStream | null> {
  if (!hasGetUserMedia()) {
    if (errorRef) errorRef.name = 'NotSupportedError'
    return null
  }
  const base = MIC_CONSTRAINTS.audio as MediaTrackConstraints
  const tries: MediaStreamConstraints[] = [
    { audio: deviceId ? { ...base, deviceId: { exact: deviceId } } : base },
    { audio: deviceId ? { deviceId: { exact: deviceId } } : true },
  ]
  for (const c of tries) {
    try {
      return await navigator.mediaDevices.getUserMedia(c)
    } catch (e) {
      if (errorRef) errorRef.name = (e as DOMException)?.name ?? 'Error'
      // Запрет — второй вариант ограничений не поможет.
      if (errorRef?.name === 'NotAllowedError' || errorRef?.name === 'SecurityError') return null
    }
  }
  return null
}

let resumeHookInstalled = new WeakSet<AudioContext>()

/** resume() на любом касании, пока контекст не 'running' (iOS/autoplay). */
function resumeOnGesture(ctx: AudioContext): void {
  if (resumeHookInstalled.has(ctx) || typeof document === 'undefined') return
  resumeHookInstalled.add(ctx)
  const onDown = () => {
    if (ctx.state === 'closed') {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onDown, true)
      return
    }
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined)
  }
  document.addEventListener('pointerdown', onDown, true)
  document.addEventListener('keydown', onDown, true)
}

/** Только для тестов: сбросить отметки. */
export function _resetResumeHooks(): void {
  resumeHookInstalled = new WeakSet<AudioContext>()
}

/** Создать AudioContext (16 кГц, если браузер умеет; Firefox — родная частота: смешивать частоты он не даёт). */
export function createCaptureContext(): AudioContext | null {
  const Ctor = audioCtor()
  if (!Ctor) return null
  const firefox = currentBrowserVoiceProfile().vendor === 'firefox'
  try {
    return firefox ? new Ctor() : new Ctor({ sampleRate: STT_SAMPLE_RATE })
  } catch {
    try {
      return new Ctor()
    } catch {
      return null
    }
  }
}

/**
 * Открыть микрофон В ОБРАБОТЧИКЕ КЛИКА (синхронно): контекст + resume() + getUserMedia в цепочке жеста.
 */
export function openMicOnGesture(deviceId?: string): MicHandle {
  const context = createCaptureContext()
  if (context) {
    if (context.state !== 'running') void context.resume().catch(() => undefined)
    resumeOnGesture(context)
  }
  const err = { name: null as string | null }
  const stream = requestMicStream(deviceId, err)
  voiceLog('mic_open', { rate: context?.sampleRate ?? null, state: context?.state ?? null })
  return { context, stream, error: () => err.name, deviceId }
}

export interface MicFrame {
  pcm: Int16Array
  rms: number
  at: number
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** Ошибка getUserMedia → код для UI. */
export function micErrorCode(name: string | null): 'not_allowed' | 'not_found' | 'in_use' | 'not_supported' | 'unknown' {
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'not_allowed'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'not_found'
    case 'NotReadableError':
    case 'AbortError':
      return 'in_use'
    case 'NotSupportedError':
      return 'not_supported'
    default:
      return 'unknown'
  }
}

export class MicCapture implements CaptureSource {
  private handle: MicHandle | null
  private ctx: AudioContext | null = null
  private ownsContext = false
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private node: AudioNode | null = null
  private sink: GainNode | null = null
  private ring: MicFrame[] = []
  private readonly ringMs: number
  private listeners = new Set<CaptureListener>()
  private stateListeners = new Set<(s: MicState) => void>()
  private state: MicState = 'off'
  private errorName: string | null = null
  private reopenedOnce = false
  private stopped = false
  private frames = 0
  private lastDiagAt = 0
  readonly vad: AdaptiveVad
  private onDeviceChange: (() => void) | null = null

  constructor(handle: MicHandle | null, options: { ringMs?: number } = {}) {
    // Один захват на открытие: второй (повторный монтаж) открывает микрофон заново.
    this.handle = handle && !handle.claimed ? handle : null
    if (handle) handle.claimed = true
    this.ringMs = options.ringMs ?? 1_000
    this.vad = new AdaptiveVad({
      onSpeechStart: () => this.listeners.forEach((l) => l.speechStart?.(now())),
      onSpeechEnd: (d) => this.listeners.forEach((l) => l.speechEnd?.(d, now())),
    })
  }

  getState(): MicState {
    return this.state
  }

  getError(): string | null {
    return this.errorName
  }

  getStream(): MediaStream | null {
    return this.stream
  }

  getContext(): AudioContext | null {
    return this.ctx
  }

  /** Сколько кадров пришло (0 — AudioContext не запустился). */
  frameCount(): number {
    return this.frames
  }

  onState(listener: (s: MicState) => void): () => void {
    this.stateListeners.add(listener)
    return () => {
      this.stateListeners.delete(listener)
    }
  }

  private setState(s: MicState): void {
    if (this.state === s) return
    this.state = s
    patchVoiceDiag({ mic: s })
    if (s === 'lost') setVoiceStatus('mic_lost')
    this.stateListeners.forEach((l) => l(s))
  }

  subscribe(listener: CaptureListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  preRoll(ms: number): { pcm: Int16Array; at: number }[] {
    const n = Math.ceil(ms / FRAME_MS)
    return this.ring.slice(-n)
  }

  /** Дождаться потока и собрать граф. true — микрофон открыт (кадры пойдут, когда контекст запустится). */
  async start(): Promise<boolean> {
    if (this.stopped) return false
    this.setState('opening')
    const handle = this.handle ?? openMicOnGesture()
    this.handle = handle
    const stream = await handle.stream
    if (this.stopped) {
      stream?.getTracks().forEach((t) => t.stop())
      return false
    }
    if (!stream) {
      this.errorName = handle.error()
      this.setState(micErrorCode(this.errorName) === 'not_allowed' ? 'denied' : 'error')
      voiceLog('mic_error', { error: this.errorName })
      return false
    }
    this.stream = stream
    this.watchTracks(stream)
    if (!this.ctx) {
      this.ctx = handle.context ?? createCaptureContext()
      this.ownsContext = true
      if (this.ctx) resumeOnGesture(this.ctx)
    }
    this.setState('live')
    await this.buildGraph()
    return true
  }

  private async buildGraph(): Promise<void> {
    const ctx = this.ctx
    const stream = this.stream
    if (!ctx || !stream || this.stopped) return
    try {
      this.source = ctx.createMediaStreamSource(stream)
    } catch (e) {
      voiceLog('mic_error', { error: 'source', detail: String((e as Error)?.name ?? e) })
      return
    }
    this.sink = ctx.createGain()
    this.sink.gain.value = 0
    this.sink.connect(ctx.destination)
    const inRate = ctx.sampleRate
    let ok = false
    if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
      try {
        await ctx.audioWorklet.addModule(publicAssetUrl('worklets/pcm-capture.js'))
        if (this.stopped || !this.source) return
        const node = new AudioWorkletNode(ctx, 'atomlab-pcm-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 })
        node.port.onmessage = (ev: MessageEvent) => {
          const d = ev.data as { type: string; pcm?: ArrayBuffer; rms?: number }
          if (d.type === 'frame' && d.pcm) this.pushFrame(new Int16Array(d.pcm), d.rms ?? 0)
          else if (d.type === 'ready') voiceLog('worklet_ready', { rate: inRate })
        }
        this.source.connect(node)
        node.connect(this.sink)
        this.node = node
        ok = true
      } catch (e) {
        voiceLog('worklet_error', { detail: String((e as Error)?.message ?? e) })
      }
    }
    if (!ok) {
      // Старые iOS (< 14.5) — ScriptProcessorNode в главном потоке.
      try {
        const proc = ctx.createScriptProcessor(2048, 1, 1)
        const rs = new StreamResampler(inRate, STT_SAMPLE_RATE)
        let acc = new Float32Array(0)
        proc.onaudioprocess = (ev) => {
          const chunk = rs.process(ev.inputBuffer.getChannelData(0))
          const merged = new Float32Array(acc.length + chunk.length)
          merged.set(acc, 0)
          merged.set(chunk, acc.length)
          let off = 0
          while (merged.length - off >= FRAME_SAMPLES) {
            const f = merged.subarray(off, off + FRAME_SAMPLES)
            this.pushFrame(floatToPcm16(f), rmsOf(f))
            off += FRAME_SAMPLES
          }
          acc = merged.slice(off)
        }
        this.source.connect(proc)
        proc.connect(this.sink)
        this.node = proc
        voiceLog('worklet_ready', { rate: inRate, fallback: 'script_processor' })
      } catch (e) {
        voiceLog('mic_error', { error: 'processor', detail: String((e as Error)?.message ?? e) })
      }
    }
  }

  private pushFrame(pcm: Int16Array, rms: number): void {
    if (this.stopped) return
    const at = now()
    this.frames++
    const frame = { pcm, rms, at }
    this.ring.push(frame)
    const max = Math.ceil(this.ringMs / FRAME_MS)
    if (this.ring.length > max) this.ring.splice(0, this.ring.length - max)
    this.vad.process(rms, FRAME_MS, at)
    this.listeners.forEach((l) => l.frame?.(pcm, rms, at))
    if (this.vad.isSpeaking()) patchVoiceDiag({ lastHeardAt: Date.now() }, true)
    if (at - this.lastDiagAt > 500) {
      this.lastDiagAt = at
      patchVoiceDiag({ vadFloor: this.vad.noise.floor, vadStart: this.vad.noise.startThreshold }, true)
    }
  }

  private watchTracks(stream: MediaStream): void {
    for (const track of stream.getAudioTracks()) {
      track.onended = () => {
        if (this.stream !== stream || this.stopped) return
        voiceLog('mic_lost', { reason: 'ended' })
        void this.handleLost()
      }
      track.onmute = () => {
        if (this.stream === stream && !this.stopped) patchVoiceDiag({ mic: 'lost' })
      }
      track.onunmute = () => {
        if (this.stream === stream && !this.stopped) patchVoiceDiag({ mic: this.state })
      }
    }
    if (!this.onDeviceChange && typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      this.onDeviceChange = () => {
        const live = this.stream?.getAudioTracks().some((t) => t.readyState === 'live')
        if (!live && !this.stopped && this.state === 'live') {
          voiceLog('mic_lost', { reason: 'devicechange' })
          void this.handleLost()
        }
      }
      navigator.mediaDevices.addEventListener('devicechange', this.onDeviceChange)
    }
  }

  private async handleLost(): Promise<void> {
    this.setState('lost')
    if (this.reopenedOnce) return
    this.reopenedOnce = true
    await this.reopen()
  }

  /** Переоткрыть микрофон (авто — один раз; дальше — кнопка «Повторить»). */
  async reopen(): Promise<boolean> {
    if (this.stopped) return false
    this.teardownGraph()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    const err = { name: null as string | null }
    const stream = await requestMicStream(this.handle?.deviceId, err)
    if (this.stopped) {
      stream?.getTracks().forEach((t) => t.stop())
      return false
    }
    if (!stream) {
      this.errorName = err.name
      this.setState('lost')
      return false
    }
    this.stream = stream
    this.watchTracks(stream)
    this.setState('live')
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined)
    await this.buildGraph()
    return true
  }

  /** Освободить микрофон (Android: Web Speech конфликтует с открытым getUserMedia). Контекст остаётся. */
  release(): void {
    this.teardownGraph()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.vad.reset()
    this.setState('off')
  }

  private teardownGraph(): void {
    try {
      this.source?.disconnect()
      this.node?.disconnect()
      this.sink?.disconnect()
    } catch {
      /* уже отключено */
    }
    if (this.node && 'port' in this.node) (this.node as AudioWorkletNode).port.onmessage = null
    if (this.node && 'onaudioprocess' in this.node) (this.node as ScriptProcessorNode).onaudioprocess = null
    this.source = null
    this.node = null
    this.sink = null
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    this.teardownGraph()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    if (this.onDeviceChange) navigator.mediaDevices?.removeEventListener?.('devicechange', this.onDeviceChange)
    this.onDeviceChange = null
    // Контекст создан этим захватом (или передан из лобби именно для него) — закрываем.
    const ctx = this.ctx ?? this.handle?.context ?? null
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined)
    void this.ownsContext
    this.ctx = null
    this.listeners.clear()
    this.setState('off')
  }
}

/** VAD сессии поверх захвата: события того же AdaptiveVad, уровень — нормированный к шуму. */
export class CaptureVad implements VadLike {
  private readonly capture: MicCapture
  private readonly handlers: {
    onSpeechStart: () => void
    onSpeechEnd: (durationMs: number) => void
    onLevel: (rms: number, speaking: boolean) => void
  }
  private off: (() => void) | null = null

  constructor(
    capture: MicCapture,
    handlers: { onSpeechStart: () => void; onSpeechEnd: (durationMs: number) => void; onLevel: (rms: number, speaking: boolean) => void },
  ) {
    this.capture = capture
    this.handlers = handlers
  }

  async attach(): Promise<boolean> {
    const st = this.capture.getState()
    if (st !== 'live' && st !== 'opening') return false
    this.off?.()
    this.off = this.capture.subscribe({
      frame: (_pcm, rms) => this.handlers.onLevel(this.capture.vad.noise.normalized(rms), this.capture.vad.isSpeaking()),
      speechStart: () => this.handlers.onSpeechStart(),
      speechEnd: (d) => this.handlers.onSpeechEnd(d),
    })
    return true
  }

  detach(): void {
    this.off?.()
    this.off = null
  }
}
