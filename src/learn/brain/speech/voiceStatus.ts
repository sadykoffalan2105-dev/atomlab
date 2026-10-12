/**
 * Статус микрофона/распознавания для UI — крошечное внешнее хранилище (useSyncExternalStore).
 * Пишет learnSpeechRecognition / duplexVoiceSession, читают панели учителя.
 */
export type VoiceStatusCode =
  | 'idle'
  | 'listening'
  | 'no_speech'
  | 'network'
  | 'not_allowed'
  | 'audio_capture'
  | 'language_fallback'
  | 'push_to_talk'
  | 'unresponsive'
  | 'not_supported'
  /** Дорожка микрофона пропала (выдернули гарнитуру, сменилось устройство). */
  | 'mic_lost'
  /** Сервер распознавания ATOMLAB не отвечает — слушаю через браузер. */
  | 'server_unavailable'
  /** Первые 1,5 с: меряю шум комнаты для порога речи. */
  | 'calibrating'

export interface VoiceStatus {
  code: VoiceStatusCode
  /** Непрерывный режим или удержание кнопки. */
  mode: 'continuous' | 'push_to_talk'
  at: number
}

let state: VoiceStatus = { code: 'idle', mode: 'continuous', at: 0 }
const listeners = new Set<() => void>()

export function getVoiceStatus(): VoiceStatus {
  return state
}

export function setVoiceStatus(code: VoiceStatusCode, mode?: VoiceStatus['mode']): void {
  const next: VoiceStatus = { code, mode: mode ?? state.mode, at: Date.now() }
  if (next.code === state.code && next.mode === state.mode) return
  state = next
  listeners.forEach((l) => l())
}

export function subscribeVoiceStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Ключ i18n для статуса (учитель RU/EN/UZ). */
export function voiceStatusMessageKey(code: VoiceStatusCode): string | null {
  switch (code) {
    case 'no_speech':
      return 'learn.voice.status.noSpeech'
    case 'network':
      return 'learn.voice.status.network'
    case 'not_allowed':
      return 'learn.voice.status.notAllowed'
    case 'audio_capture':
      return 'learn.voice.status.audioCapture'
    case 'language_fallback':
      return 'learn.voice.status.languageFallback'
    case 'push_to_talk':
      return 'learn.voice.status.pushToTalk'
    case 'unresponsive':
      return 'learn.voice.status.unresponsive'
    case 'not_supported':
      return 'learn.voice.status.notSupported'
    case 'mic_lost':
      return 'learn.voice.status.micLost'
    case 'server_unavailable':
      return 'learn.voice.status.serverUnavailable'
    default:
      return null
  }
}

/* ------------------------------------------------------------------ диагностика */

/** Путь распознавания: сервер ATOMLAB, браузер (Web Speech) или недоступно. */
export type SttPath = 'server' | 'web_speech' | 'none'

export type MicState = 'off' | 'opening' | 'live' | 'lost' | 'denied' | 'error'

/**
 * Диагностика голоса для ламп «микрофон слышит» / «распознаю», чипа пути и ?debugVoice=1.
 * Часто меняющиеся поля (lastHeardAt, уровни) пишутся без оповещения — UI читает их по таймеру.
 */
export interface VoiceDiag {
  path: SttPath
  /** Поставщик браузерного распознавания (для чипа: Google / Microsoft). */
  webVendor: 'google' | 'microsoft' | 'apple' | 'other'
  mic: MicState
  /** Последний кадр громче порога речи (Date.now). */
  lastHeardAt: number
  /** Последний текст от распознавания — partial или final (Date.now). */
  lastTextAt: number
  /** Последний успешный ответ сервера /stt (Date.now). */
  lastServerOkAt: number
  /** Запрос /stt в полёте или сессия Web Speech жива. */
  sttBusy: boolean
  /** VAD видит речь, а текста нет ≥ 8 с. */
  sttStalled: boolean
  uploadBytes: number
  sttServerMs: number | null
  sttRoundTripMs: number | null
  lang: string | null
  vadFloor: number
  vadStart: number
  errors: string[]
}

const DIAG_INITIAL: VoiceDiag = {
  path: 'none',
  webVendor: 'other',
  mic: 'off',
  lastHeardAt: 0,
  lastTextAt: 0,
  lastServerOkAt: 0,
  sttBusy: false,
  sttStalled: false,
  uploadBytes: 0,
  sttServerMs: null,
  sttRoundTripMs: null,
  lang: null,
  vadFloor: 0,
  vadStart: 0,
  errors: [],
}

let diag: VoiceDiag = { ...DIAG_INITIAL }
const diagListeners = new Set<() => void>()

export function getVoiceDiag(): VoiceDiag {
  return diag
}

/** Обновить диагностику. quiet — без оповещения (частые поля: уровни, lastHeardAt). */
export function patchVoiceDiag(patch: Partial<VoiceDiag>, quiet = false): void {
  diag = { ...diag, ...patch }
  if (!quiet) diagListeners.forEach((l) => l())
}

/** Ошибка в журнал отчёта (последние 20, без персональных данных). */
export function noteVoiceError(code: string): void {
  const errors = [...diag.errors, `${new Date().toISOString().slice(11, 19)} ${code}`].slice(-20)
  patchVoiceDiag({ errors })
}

export function resetVoiceDiag(): void {
  diag = { ...DIAG_INITIAL }
  diagListeners.forEach((l) => l())
}

export function subscribeVoiceDiag(listener: () => void): () => void {
  diagListeners.add(listener)
  return () => {
    diagListeners.delete(listener)
  }
}

/** Структурный лог голоса: console.info('[voice]', {ev, ...}) — без аудио и текста. */
export function voiceLog(ev: string, data: Record<string, unknown> = {}): void {
  if (typeof console === 'undefined') return
  if (typeof window === 'undefined') return // тесты в node — без шума
  console.info('[voice]', { ev, ...data })
}
