/**
 * Движок распознавания урока: выбор пути и переключение между ними без потери сессии.
 *
 *  • 'server'     — мозг online и GET /stt/health → {available:true}: сегменты реплик → /stt;
 *  • 'web_speech' — Web Speech браузера (Chrome → Google, Edge → Microsoft) — запасной путь;
 *  • 'none'       — ни того, ни другого: только текст.
 * Отладка: ?stt=server|web|auto.
 *
 * Сам движок — RecognitionLike (DuplexVoiceSession не знает, какой путь сейчас). Ошибки сервера
 * 2 раза подряд → браузерный путь с баннером «сервер распознавания недоступен», повторная
 * проверка через 60 с и возврат на сервер в паузе между репликами.
 * Android + Web Speech: дорожки getUserMedia освобождаются перед стартом (конфликт микрофона),
 * сессия работает без VAD.
 *
 * Один экземпляр на страницу (getSharedSttEngine) — чтобы устный экзамен/чат не обрывали урок
 * ('aborted'). Подключение LearnAssistantPanel/устного экзамена — после слияния (см. заметки).
 */
import type { LearnSpeechLocale } from '../../learnSpeech'
import type { AssistantLang } from '../brainTypes'
import { realScheduler, type TimingScheduler } from './conversationTiming'
import type { RecognitionLike, SessionHooks, SttUpdateInfo } from './duplexVoiceSession'
import { ServerRecognition, type CaptureSource, type SttPoster } from './serverRecognition'
import { postStt, SttHealthCache, type FetchLike } from '../speech/serverStt'
import { patchVoiceDiag, setVoiceStatus, voiceLog, noteVoiceError, type SttPath } from '../speech/voiceStatus'

export type { SttPath }
export type SttOverride = 'server' | 'web' | 'auto'

/** ?stt=server|web|auto (в search или в hash). */
export function sttOverride(loc?: { search: string; hash: string }): SttOverride {
  const l = loc ?? (typeof window !== 'undefined' ? window.location : { search: '', hash: '' })
  const m = /[?&]stt=(server|web|auto)\b/.exec(`${l.search}&${l.hash}`)
  return (m?.[1] as SttOverride | undefined) ?? 'auto'
}

export interface PathInputs {
  override: SttOverride
  brainOnline: boolean
  /** /stt/health: true/false, null — ещё не знаем. */
  serverAvailable: boolean | null
  hasWebSpeech: boolean
  /** Есть захват кадров (AudioWorklet/ScriptProcessor) — без него серверу нечего слать. */
  hasCapture: boolean
}

/** Чистый выбор пути. */
export function chooseSttPath(i: PathInputs): SttPath {
  if (i.override === 'web') return i.hasWebSpeech ? 'web_speech' : 'none'
  if (i.override === 'server') return i.hasCapture ? 'server' : i.hasWebSpeech ? 'web_speech' : 'none'
  if (i.hasCapture && i.brainOnline && i.serverAvailable === true) return 'server'
  if (i.hasWebSpeech) return 'web_speech'
  return 'none'
}

export interface SttEngineOptions {
  lang: AssistantLang
  /** Захват (MicCapture); null — микрофона нет. */
  capture: (CaptureSource & { release?(): void; reopen?(): Promise<boolean>; frameCount?(): number }) | null
  /** Браузерное распознавание (LearnSpeechController); null — конструктора нет. */
  web: RecognitionLike | null
  brainOnline: () => boolean
  getBaseUrl: () => string | null
  sessionId: () => string
  health?: SttHealthCache
  fetchImpl?: FetchLike
  scheduler?: TimingScheduler
  override?: SttOverride
  /** Android: Web Speech конфликтует с открытым микрофоном. */
  releaseMicForWebSpeech?: boolean
  /** Через сколько повторно проверять сервер после сбоя (мс). */
  recheckMs?: number
  /** Нет кадров столько мс после старта серверного пути — AudioContext не запустился → браузер. */
  noFramesMs?: number
  onPathChange?: (path: SttPath, reason: string) => void
  /** Внедрение poster (тесты). */
  post?: SttPoster
}

type StartArgs = {
  locale: LearnSpeechLocale
  session: { committed: string }
  onUpdate: (fullText: string, interimText: string, info?: SttUpdateInfo) => void
  onError?: (code: string, fatal: boolean) => void
}

export class SttEngine implements RecognitionLike {
  private readonly o: SttEngineOptions
  private readonly s: TimingScheduler
  readonly health: SttHealthCache
  private readonly server: ServerRecognition | null
  private path: SttPath = 'none'
  private impl: RecognitionLike | null = null
  private args: StartArgs | null = null
  private paused = false
  private aiSpeaking = false
  private speaking = false
  private sessionHooks: SessionHooks | null = null
  private recheckTimer: unknown = null
  private framesTimer: unknown = null
  private pendingSwitch: { path: SttPath; reason: string } | null = null
  private releasedMic = false
  private offSpeech: (() => void) | null = null

  constructor(options: SttEngineOptions) {
    this.o = options
    this.s = options.scheduler ?? realScheduler
    this.health =
      options.health ?? new SttHealthCache({ getBaseUrl: options.getBaseUrl, fetchImpl: options.fetchImpl })
    const post: SttPoster =
      options.post ??
      ((wav, partial, signal) => {
        const baseUrl = options.getBaseUrl()
        if (!baseUrl) return Promise.reject(new Error('brain offline'))
        return postStt({
          baseUrl,
          wav,
          partial,
          signal,
          lang: options.lang,
          session: options.sessionId(),
          fetchImpl: options.fetchImpl,
        })
      })
    this.server = options.capture
      ? new ServerRecognition({
          source: options.capture,
          post,
          scheduler: this.s,
          onFailure: (err) => this.onServerFailure(err.code),
        })
      : null
    patchVoiceDiag({ path: 'none' })
  }

  getPath(): SttPath {
    return this.path
  }

  private inputs(): PathInputs {
    return {
      override: this.o.override ?? sttOverride(),
      brainOnline: this.o.brainOnline(),
      serverAvailable: this.health.peek(),
      hasWebSpeech: Boolean(this.o.web),
      hasCapture: Boolean(this.server),
    }
  }

  /* ------------------------------------------------------------ RecognitionLike */

  start(
    locale: LearnSpeechLocale,
    session: { committed: string },
    onUpdate: (fullText: string, interimText: string, info?: SttUpdateInfo) => void,
    onError?: (code: string, fatal: boolean) => void,
  ): boolean {
    if (this.args) return false
    this.args = { locale, session, onUpdate, onError }
    // Пауза между репликами — момент для отложенного переключения пути.
    this.offSpeech =
      this.o.capture?.subscribe({
        speechStart: () => {
          this.speaking = true
        },
        speechEnd: () => {
          this.speaking = false
          this.s.setTimeout(() => this.applyPendingSwitch(), 50)
        },
      }) ?? null
    const inputs = this.inputs()
    let path = chooseSttPath(inputs)
    // Сервер ещё не проверяли, а браузерного пути нет (Firefox) — пробуем сервер сразу.
    if (path === 'none' && inputs.hasCapture && inputs.brainOnline && inputs.serverAvailable === null) path = 'server'
    this.activate(path, 'start')
    // Сервер ещё не проверен — проверяем; если доступен, переходим в паузе между репликами.
    if (inputs.override === 'auto' && inputs.serverAvailable === null && inputs.brainOnline && this.server) {
      void this.health.check().then((ok) => {
        if (!this.args) return
        if (ok && this.path !== 'server') this.requestSwitch('server', 'health_ok')
        if (!ok && this.path === 'server') this.requestSwitch(this.o.web ? 'web_speech' : 'none', 'health_fail')
      })
    }
    return this.path !== 'none' || Boolean(this.server)
  }

  stop(): void {
    this.impl?.stop()
    this.impl = null
    this.args = null
    this.offSpeech?.()
    this.offSpeech = null
    this.clearTimers()
    this.pendingSwitch = null
  }

  pause(): void {
    this.paused = true
    this.impl?.pause?.()
  }

  resume(delayMs: number): void {
    this.paused = false
    this.impl?.resume?.(delayMs)
  }

  setAiSpeaking(on: boolean): void {
    this.aiSpeaking = on
    this.server?.setAiSpeaking(on)
    if (!on) this.s.setTimeout(() => this.applyPendingSwitch(), 50)
  }

  hold(on: boolean): Promise<void> | void {
    return this.impl?.hold?.(on)
  }

  bindSession(hooks: SessionHooks): void {
    this.sessionHooks = hooks
    hooks.setPathListenMode?.(this.pathListenMode())
  }

  /**
   * Серверный путь слушает и во время речи учителя (барджин): захват getUserMedia идёт с AEC, эхо
   * отсекает текстовый фильтр, а реплика ученика поверх приветствия не теряется (раньше в Chrome
   * жёсткая пауза выбрасывала её целиком). Android (громкая связь телефона) и браузерный путь — по
   * профилю браузера (Chrome: жёсткая пауза).
   */
  private pathListenMode(): 'soft_echo_filter' | null {
    return this.path === 'server' && !this.o.releaseMicForWebSpeech ? 'soft_echo_filter' : null
  }

  /* ------------------------------------------------------------------- пути */

  private activate(path: SttPath, reason: string): void {
    const args = this.args
    if (!args) return
    const prev = this.path
    this.impl?.stop()
    this.impl = null
    this.path = path
    if (this.framesTimer) this.s.clearTimeout(this.framesTimer)
    this.framesTimer = null

    if (path === 'web_speech' && this.o.releaseMicForWebSpeech && this.o.capture?.release && !this.releasedMic) {
      // Android: открытый getUserMedia мешает Web Speech — отпускаем микрофон, VAD недоступен.
      this.o.capture.release()
      this.releasedMic = true
      this.sessionHooks?.setVadAvailable(false)
    } else if (path === 'server' && this.releasedMic && this.o.capture?.reopen) {
      this.releasedMic = false
      void this.o.capture.reopen().then((ok) => ok && this.sessionHooks?.setVadAvailable(true))
    }

    const impl = path === 'server' ? this.server : path === 'web_speech' ? this.o.web : null
    if (impl) {
      const ok = impl.start(args.locale, args.session, (full, interim, info) => {
        patchVoiceDiag(interim || full ? { lastTextAt: Date.now() } : {}, true)
        args.onUpdate(full, interim, info ?? { path: path === 'server' ? 'server' : 'web_speech' })
      }, (code, fatal) => {
        noteVoiceError(code)
        // Сервер только что признан недоступным — обратно не прыгаем (иначе «пинг-понг» server ↔ web).
        if (fatal && path === 'web_speech' && this.server && this.inputs().brainOnline && this.health.peek() !== false) {
          // Браузер запретил распознавание — пробуем сервер, если он есть.
          this.requestSwitch('server', `web_${code}`, true)
          return
        }
        if (fatal && path === 'web_speech' && this.path === 'web_speech') {
          // Браузерный путь умер, сервер недоступен — только текст до повторной проверки сервера.
          this.requestSwitch('none', `web_${code}`, true)
          args.onError?.(code, fatal)
          return
        }
        args.onError?.(code, fatal)
      })
      this.impl = ok ? impl : null
      if (ok && this.paused) impl.pause?.()
      if (ok && path === 'server') this.server?.setAiSpeaking(this.aiSpeaking)
      if (!ok) this.path = 'none'
    }
    patchVoiceDiag({ path: this.path, sttBusy: Boolean(this.impl) })
    this.sessionHooks?.setPathListenMode?.(this.pathListenMode())
    if (prev !== this.path || reason === 'start') {
      voiceLog('path_switch', { from: prev, to: this.path, reason })
      this.o.onPathChange?.(this.path, reason)
    }
    if (this.path === 'server') this.watchFrames()
    if (this.path === 'none') args.onError?.('stt_none', false)
  }

  /** Серверный путь без кадров (AudioContext так и не запустился) → браузерный. */
  private watchFrames(): void {
    const cap = this.o.capture
    if (!cap?.frameCount) return
    const before = cap.frameCount()
    this.framesTimer = this.s.setTimeout(() => {
      this.framesTimer = null
      if (this.path !== 'server' || !this.args) return
      if (cap.frameCount!() > before) return
      voiceLog('stt_error', { code: 'no_frames' })
      noteVoiceError('no_frames')
      if (this.o.web) this.activate('web_speech', 'no_frames')
    }, this.o.noFramesMs ?? 2_500)
  }

  /** Переключение — в паузе между репликами (не рвём фразу), now — сразу. */
  private requestSwitch(path: SttPath, reason: string, now = false): void {
    if (path === this.path) return
    this.pendingSwitch = { path, reason }
    if (now) this.applyPendingSwitch(true)
    else this.s.setTimeout(() => this.applyPendingSwitch(), 0)
  }

  private applyPendingSwitch(force = false): void {
    const p = this.pendingSwitch
    if (!p || !this.args) return
    if (!force && (this.speaking || this.aiSpeaking)) return
    this.pendingSwitch = null
    this.activate(p.path, p.reason)
  }

  private onServerFailure(code: string): void {
    this.health.markUnavailable()
    setVoiceStatus('server_unavailable')
    noteVoiceError(`server_${code}`)
    const next: SttPath = this.o.web ? 'web_speech' : 'none'
    this.requestSwitch(next, `server_${code}`, true)
    this.scheduleRecheck()
  }

  private scheduleRecheck(): void {
    if (this.recheckTimer) this.s.clearTimeout(this.recheckTimer)
    this.recheckTimer = this.s.setTimeout(() => {
      this.recheckTimer = null
      if (!this.args || this.path === 'server') return
      void this.health.check(true).then((ok) => {
        if (!this.args) return
        if (ok) {
          setVoiceStatus('listening')
          this.requestSwitch('server', 'recheck_ok')
        } else this.scheduleRecheck()
      })
    }, this.o.recheckMs ?? 60_000)
  }

  private clearTimers(): void {
    if (this.recheckTimer) this.s.clearTimeout(this.recheckTimer)
    if (this.framesTimer) this.s.clearTimeout(this.framesTimer)
    this.recheckTimer = null
    this.framesTimer = null
  }
}

/* ------------------------------------------------------------- общий экземпляр */

let shared: SttHealthCache | null = null

/**
 * Общий кеш /stt/health на страницу (лобби прогревает, урок и экран проверки читают).
 * getBaseUrl передаётся первым вызывающим (обычно getBrainUrl из brainClient).
 */
export function sharedSttHealth(getBaseUrl: () => string | null): SttHealthCache {
  if (!shared) shared = new SttHealthCache({ getBaseUrl })
  return shared
}
