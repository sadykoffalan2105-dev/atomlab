/**
 * Единый «микрофон» приложения: lab и learn не говорят одновременно,
 * системный speechSynthesis не перебивает neural-учителя.
 */
import { stopNeuralPlayback } from './learnSpeechPlayback'
import { stopBrowserSpeech } from './learnSpeechBrowser'

export type SpeechChannelOwner = 'none' | 'lab' | 'learn'

let epoch = 0
let owner: SpeechChannelOwner = 'none'

function hardSilenceBrowser(): void {
  stopBrowserSpeech()
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      // Chrome иногда продолжает текущую utterance — повторный cancel помогает.
      window.setTimeout(() => {
        try {
          window.speechSynthesis.cancel()
        } catch {
          /* ignore */
        }
      }, 0)
    }
  } catch {
    /* ignore */
  }
}

/** Захватить канал: глушит neural + системный голос. */
export function claimSpeechChannel(next: 'lab' | 'learn'): number {
  epoch += 1
  owner = next
  stopNeuralPlayback()
  hardSilenceBrowser()
  return epoch
}

export function silenceForeignSpeech(forOwner: 'lab' | 'learn'): void {
  if (owner !== forOwner && owner !== 'none') {
    stopNeuralPlayback()
  }
  hardSilenceBrowser()
}

export function isSpeechChannelCurrent(token: number, who: 'lab' | 'learn'): boolean {
  return token === epoch && owner === who
}

export function releaseSpeechChannel(who: 'lab' | 'learn', token: number): void {
  if (owner === who && token === epoch) owner = 'none'
}

export function getSpeechChannelOwner(): SpeechChannelOwner {
  return owner
}

/** Полная тишина — выход из лаборатории / смена экрана. */
export function stopAllAppSpeech(): void {
  epoch += 1
  owner = 'none'
  stopNeuralPlayback()
  hardSilenceBrowser()
}
