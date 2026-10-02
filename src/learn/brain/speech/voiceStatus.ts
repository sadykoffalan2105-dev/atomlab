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
    default:
      return null
  }
}
