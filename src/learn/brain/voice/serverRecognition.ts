/**
 * Серверное распознавание (мозг ATOMLAB → /stt) в интерфейсе RecognitionLike.
 *
 * DuplexVoiceSession, TurnEndDetector, эхо-страж и барджин не меняются: этот класс так же, как
 * Web Speech, зовёт onUpdate(committed, interim). Отличия:
 *  • реплика режется по VAD захвата: сегмент = пре-ролл 400 мс + речь (+ хвост hangover VAD),
 *    ≤ 25 с (дальше — принудительный финал и новый сегмент);
 *  • финал: WAV 16 кГц → POST /stt partial=0 → committed += text; финалы уходят строго по очереди;
 *  • промежуточные: каждые 1,2 с речи POST partial=1 (≤ 1 в полёте) → interim;
 *    во время речи учителя — первый partial уже через 300 мс речи (барджин по тексту);
 *  • pause()/resume() = «не отправлять» (захват не останавливается — глухих окон нет):
 *    сегмент, начатый во время речи учителя, не уходит (кроме «нажми и говори»), после resume
 *    первые 200 мс отрезаются (хвост эха колонок);
 *  • 429 → ждём Retry-After (5 с по умолчанию) и повторяем сегмент один раз;
 *    503/сеть 2 раза подряд → onFailure (движок переключится на браузерное распознавание).
 *
 * Время и сеть внедряются — тесты: scripts/test-voice-stt-engine.mts.
 */
import type { LearnSpeechLocale } from '../../learnSpeech'
import { realScheduler, type TimingScheduler } from './conversationTiming'
import { concatPcm16, encodeWavPcm16, FRAME_MS, STT_SAMPLE_RATE } from './wavEncode'
import { SttHttpError, type SttResult } from '../speech/serverStt'
import { patchVoiceDiag, voiceLog } from '../speech/voiceStatus'
import type { RecognitionLike, SttUpdateInfo } from './duplexVoiceSession'

/** Кадр захвата: PCM16 16 кГц (обычно 20 мс), время — часы планировщика (мс). */
export interface CaptureListener {
  frame?: (pcm: Int16Array, rms: number, at: number) => void
  speechStart?: (at: number) => void
  speechEnd?: (durationMs: number, at: number) => void
}

export interface CaptureSource {
  subscribe(listener: CaptureListener): () => void
  /** Последние ms миллисекунд аудио (кадры с временем). */
  preRoll(ms: number): { pcm: Int16Array; at: number }[]
}

export type SttPoster = (wav: Uint8Array, partial: boolean, signal: AbortSignal) => Promise<SttResult>

export interface ServerRecognitionOptions {
  source: CaptureSource
  post: SttPoster
  scheduler?: TimingScheduler
  partialEveryMs?: number
  /** Первый partial во время речи учителя (барджин). */
  bargePartialMs?: number
  maxSegmentMs?: number
  preRollMs?: number
  /** Сколько отрезать после конца речи учителя. */
  resumeCutMs?: number
  /** Сколько подряд «недоступно» до onFailure. */
  failuresToSwitch?: number
  /** Сервер недоступен (2 подряд) — движок переключит путь. */
  onFailure?: (error: SttHttpError) => void
}

interface Segment {
  id: number
  frames: Int16Array[]
  samples: number
  startedAt: number
  /** Сколько мс речи (по кадрам) на момент последнего partial. */
  lastPartialAtMs: number
  partialSent: boolean
  drop: boolean
  hold: boolean
}

const MIN_SEGMENT_SAMPLES = Math.round(STT_SAMPLE_RATE * 0.3)

export class ServerRecognition implements RecognitionLike {
  private readonly o: Required<Omit<ServerRecognitionOptions, 'onFailure' | 'scheduler'>> &
    Pick<ServerRecognitionOptions, 'onFailure'>
  private readonly s: TimingScheduler
  private unsubscribe: (() => void) | null = null
  private session: { committed: string } = { committed: '' }
  private onUpdate: ((full: string, interim: string, info?: SttUpdateInfo) => void) | null = null
  private onError: ((code: string, fatal: boolean) => void) | undefined
  private active = false
  private paused = false
  private aiSpeaking = false
  private cutUntil = -Infinity
  private seg: Segment | null = null
  private segSeq = 0
  private partialCtrl: AbortController | null = null
  private partialBlockedUntil = -Infinity
  private finalChain: Promise<void> = Promise.resolve()
  private finalsInFlight = 0
  private consecutiveFailures = 0
  private holdWaiters: (() => void)[] = []

  constructor(options: ServerRecognitionOptions) {
    this.s = options.scheduler ?? realScheduler
    this.o = {
      source: options.source,
      post: options.post,
      partialEveryMs: options.partialEveryMs ?? 1_200,
      bargePartialMs: options.bargePartialMs ?? 300,
      maxSegmentMs: options.maxSegmentMs ?? 25_000,
      preRollMs: options.preRollMs ?? 400,
      resumeCutMs: options.resumeCutMs ?? 200,
      failuresToSwitch: options.failuresToSwitch ?? 2,
      onFailure: options.onFailure,
    }
  }

  /* ------------------------------------------------------------ RecognitionLike */

  start(
    _locale: LearnSpeechLocale,
    session: { committed: string },
    onUpdate: (fullText: string, interimText: string, info?: SttUpdateInfo) => void,
    onError?: (code: string, fatal: boolean) => void,
  ): boolean {
    if (this.active) return false
    this.active = true
    this.session = session
    this.onUpdate = onUpdate
    this.onError = onError
    this.unsubscribe = this.o.source.subscribe({
      frame: (pcm, _rms, at) => this.onFrame(pcm, at),
      speechStart: (at) => this.onSpeechStart(at),
      speechEnd: () => this.onSpeechEnd(),
    })
    patchVoiceDiag({ sttBusy: true })
    return true
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    this.unsubscribe?.()
    this.unsubscribe = null
    this.seg = null
    this.partialCtrl?.abort()
    this.partialCtrl = null
    this.paused = false
    this.releaseHoldWaiters()
    patchVoiceDiag({ sttBusy: false })
  }

  pause(): void {
    this.paused = true
    // Сегмент, который идёт сейчас, — во время речи учителя: не отправляем (эхо).
    if (this.seg && !this.seg.hold) this.seg.drop = true
  }

  resume(delayMs: number): void {
    if (!this.paused) return
    this.paused = false
    this.cutUntil = this.s.now() + Math.min(Math.max(0, delayMs), this.o.resumeCutMs)
    // Ученик уже говорит (ответил, не дожидаясь конца фразы): сегмент начинается заново после отреза.
    if (this.seg && this.seg.drop && !this.seg.hold) this.seg = this.newSegment(false)
  }

  setAiSpeaking(on: boolean): void {
    this.aiSpeaking = on
  }

  /** «Нажми и говори»: сегмент от нажатия до отпускания, VAD не режет. false → Promise «финал готов». */
  hold(on: boolean): Promise<void> | void {
    if (on) {
      this.cutUntil = -Infinity
      if (this.seg) {
        this.seg.hold = true
        this.seg.drop = false
      } else {
        this.seg = this.newSegment(true)
      }
      return
    }
    const seg = this.seg
    if (!seg || !seg.hold) return Promise.resolve()
    seg.hold = false
    return new Promise<void>((resolve) => {
      this.holdWaiters.push(resolve)
      // Хвост 200 мс — последние слова, сказанные в момент отпускания.
      this.s.setTimeout(() => {
        if (this.seg === seg) this.finalize(seg)
        void this.finalChain.then(() => this.releaseHoldWaiters())
      }, 200)
      // Страховка: не ждём сервер дольше 4 с.
      this.s.setTimeout(() => this.releaseHoldWaiters(), 4_000)
    })
  }

  isActive(): boolean {
    return this.active
  }

  /* ------------------------------------------------------------------ сегменты */

  private releaseHoldWaiters(): void {
    const w = this.holdWaiters
    this.holdWaiters = []
    w.forEach((r) => r())
  }

  private newSegment(hold: boolean): Segment {
    const frames: Int16Array[] = []
    let samples = 0
    for (const f of this.o.source.preRoll(this.o.preRollMs)) {
      if (f.at < this.cutUntil) continue
      frames.push(f.pcm)
      samples += f.pcm.length
    }
    return {
      id: ++this.segSeq,
      frames,
      samples,
      startedAt: this.s.now(),
      lastPartialAtMs: 0,
      partialSent: false,
      drop: this.paused && !hold,
      hold,
    }
  }

  private onSpeechStart(at: number): void {
    if (!this.active || this.seg) return
    void at
    this.seg = this.newSegment(false)
  }

  private onSpeechEnd(): void {
    if (!this.active) return
    const seg = this.seg
    if (!seg || seg.hold) return
    this.finalize(seg)
  }

  private onFrame(pcm: Int16Array, at: number): void {
    if (!this.active) return
    const seg = this.seg
    if (!seg || at < this.cutUntil) return
    seg.frames.push(pcm)
    seg.samples += pcm.length
    const ms = (seg.samples / STT_SAMPLE_RATE) * 1000
    if (ms >= this.o.maxSegmentMs - FRAME_MS) {
      // 25 с — предел сервера: финал этого куска, речь продолжается в новом сегменте.
      this.finalize(seg)
      this.seg = { ...this.newSegment(seg.hold), frames: [], samples: 0 }
      return
    }
    if (seg.drop) return
    const speechMs = this.s.now() - seg.startedAt
    const due = this.aiSpeaking && !seg.partialSent
      ? speechMs >= this.o.bargePartialMs
      : speechMs - seg.lastPartialAtMs >= this.o.partialEveryMs
    if (due) this.sendPartial(seg, speechMs)
  }

  private finalize(seg: Segment): void {
    if (this.seg === seg) this.seg = null
    this.partialCtrl?.abort()
    this.partialCtrl = null
    if (seg.drop || seg.samples < MIN_SEGMENT_SAMPLES) {
      // Нечего отправлять, но interim прошлых partial надо снять.
      if (seg.partialSent && this.active) this.onUpdate?.(this.session.committed.trim(), '')
      return
    }
    const pcm = concatPcm16(seg.frames)
    seg.frames = []
    const wav = encodeWavPcm16(pcm)
    // Конец речи: interim снимаем сразу — TurnEndDetector ждёт финал, а не коммитит обрывок partial.
    if (seg.partialSent && this.active) this.onUpdate?.(this.session.committed.trim(), '')
    this.finalsInFlight++
    patchVoiceDiag({ sttBusy: true })
    this.finalChain = this.finalChain.then(() => this.sendFinal(wav, seg.id)).finally(() => {
      this.finalsInFlight--
    })
  }

  private async sendFinal(wav: Uint8Array, segId: number, retried = false): Promise<void> {
    if (!this.active) return
    const t0 = this.s.now()
    const ctrl = new AbortController()
    voiceLog('stt_request', { partial: 0, bytes: wav.length, seg: segId })
    patchVoiceDiag({ uploadBytes: wav.length })
    try {
      const res = await this.o.post(wav, false, ctrl.signal)
      this.consecutiveFailures = 0
      const rtt = Math.round(this.s.now() - t0)
      voiceLog('stt_response', { partial: 0, ms: rtt, server: res.ms?.total ?? null, lang: res.lang, chars: res.text.length })
      patchVoiceDiag({
        lastServerOkAt: Date.now(),
        sttServerMs: res.ms?.total ?? null,
        sttRoundTripMs: rtt,
        lang: res.lang,
        ...(res.text.trim() ? { lastTextAt: Date.now() } : {}),
      })
      if (!this.active) return
      const text = res.text.trim()
      if (text) this.session.committed = `${this.session.committed}${text} `
      this.onUpdate?.(this.session.committed.trim(), '', { lang: res.lang, path: 'server', serverMs: res.ms?.total ?? null })
    } catch (e) {
      const err = e instanceof SttHttpError ? e : new SttHttpError(0, 'network', String(e), null)
      voiceLog('stt_error', { partial: 0, status: err.status, code: err.code })
      if (err.status === 429 && !retried) {
        // Лимит: ждём Retry-After и повторяем тот же сегмент один раз — слова не теряются.
        const wait = err.retryAfterMs ?? 5_000
        await new Promise<void>((r) => this.s.setTimeout(r, wait))
        return this.sendFinal(wav, segId, true)
      }
      this.onError?.(`stt_${err.code}`, false)
      if (err.unavailable) this.noteFailure(err)
    }
  }

  private sendPartial(seg: Segment, speechMs: number): void {
    if (this.partialCtrl || this.s.now() < this.partialBlockedUntil) return
    seg.lastPartialAtMs = speechMs
    seg.partialSent = true
    const wav = encodeWavPcm16(concatPcm16(seg.frames))
    const ctrl = new AbortController()
    this.partialCtrl = ctrl
    const t0 = this.s.now()
    voiceLog('stt_request', { partial: 1, bytes: wav.length, seg: seg.id })
    void this.o
      .post(wav, true, ctrl.signal)
      .then((res) => {
        if (this.partialCtrl === ctrl) this.partialCtrl = null
        this.consecutiveFailures = 0
        voiceLog('stt_response', { partial: 1, ms: Math.round(this.s.now() - t0), lang: res.lang, chars: res.text.length })
        if (!this.active || this.seg !== seg || seg.drop) return
        const text = res.text.trim()
        if (!text) return
        patchVoiceDiag({ lastTextAt: Date.now(), lastServerOkAt: Date.now(), lang: res.lang })
        this.onUpdate?.(this.session.committed.trim(), text, { lang: res.lang, path: 'server', serverMs: res.ms?.total ?? null })
      })
      .catch((e) => {
        if (this.partialCtrl === ctrl) this.partialCtrl = null
        if (ctrl.signal.aborted) return
        const err = e instanceof SttHttpError ? e : new SttHttpError(0, 'network', String(e), null)
        voiceLog('stt_error', { partial: 1, status: err.status, code: err.code })
        if (err.status === 429) this.partialBlockedUntil = this.s.now() + (err.retryAfterMs ?? 5_000)
        else if (err.unavailable) this.noteFailure(err)
      })
  }

  private noteFailure(err: SttHttpError): void {
    this.consecutiveFailures++
    if (this.consecutiveFailures >= this.o.failuresToSwitch) {
      this.consecutiveFailures = 0
      this.o.onFailure?.(err)
    }
  }

  /** Для тестов/отладки: финалы ещё обрабатываются. */
  pendingFinals(): number {
    return this.finalsInFlight
  }

  /** Дождаться отправки всех финалов (тесты). */
  idle(): Promise<void> {
    return this.finalChain
  }
}
