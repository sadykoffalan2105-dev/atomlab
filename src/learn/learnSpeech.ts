/**
 * ATOMLAB Teacher Voice — браузерный синтез речи (Web Speech API).
 * Без neural Dmitry / Python TTS: мгновенный старт, один системный голос.
 */
import { splitTextForTts } from './learnSpeechText'

export { stripMarkdownForSpeech, prepareTextForHumanTts } from './learnSpeechText'

import {
  isBrowserSpeechActive,
  isBrowserSpeechSupported,
  preloadBrowserSpeechVoices,
  speakWithBrowserVoice,
  stopBrowserSpeech,
} from './learnSpeechBrowser'
import { LearnSpeechRecognition, isSpeechRecognitionSupported } from './learnSpeechRecognition'
import { unlockAudioPlayback } from './learnSpeechPlayback'

export type LearnSpeechLocale = 'ru' | 'en' | 'uz'
export type SpeechOutputMode = 'browser'

export function isSpeechSynthesisSupported(): boolean {
  return isBrowserSpeechSupported()
}

export { isSpeechRecognitionSupported }

export function isSpeechOutputSupported(): boolean {
  return isBrowserSpeechSupported()
}

export function preloadSpeechVoices(): void {
  preloadBrowserSpeechVoices()
}

export class LearnSpeechController {
  private recognition = new LearnSpeechRecognition()
  private speakAborted = false
  private lastMode: SpeechOutputMode = 'browser'

  getLastOutputMode(): SpeechOutputMode {
    return this.lastMode
  }

  async speak(
    text: string,
    locale: LearnSpeechLocale,
    onEnd?: () => void,
    onMode?: (mode: SpeechOutputMode) => void,
    onError?: (code: 'empty' | 'unavailable') => void,
  ): Promise<boolean> {
    if (!text.trim()) {
      onError?.('empty')
      onEnd?.()
      return false
    }

    if (!isBrowserSpeechSupported()) {
      onError?.('unavailable')
      onEnd?.()
      return false
    }

    this.stop()
    await unlockAudioPlayback()

    const chunks = splitTextForTts(text, locale).filter((c) => this.isSpeakableChunk(c))
    if (chunks.length === 0) {
      onError?.('empty')
      onEnd?.()
      return false
    }

    this.speakAborted = false
    onMode?.('browser')

    const browserOk = await speakWithBrowserVoice(chunks, locale, () => this.speakAborted)
    if (browserOk && !this.speakAborted) {
      this.lastMode = 'browser'
      onEnd?.()
      return true
    }

    if (!this.speakAborted) {
      onError?.('unavailable')
    }
    onEnd?.()
    return false
  }

  private isSpeakableChunk(chunk: string): boolean {
    const t = chunk.trim()
    if (t.length < 2) return false
    return /[a-zA-Zа-яА-ЯёЁ0-9]/.test(t)
  }

  stop(): void {
    this.speakAborted = true
    stopBrowserSpeech()
  }

  isSpeaking(): boolean {
    return isBrowserSpeechActive()
  }

  startListening(
    locale: LearnSpeechLocale,
    onResult: (transcript: string) => void,
    onError?: (code: string) => void,
  ): boolean {
    return this.recognition.startListening(locale, onResult, onError)
  }

  stopListening(): void {
    this.recognition.stopListening()
  }

  startOralListening(
    locale: LearnSpeechLocale,
    session: { committed: string },
    onUpdate: (fullText: string, interimText: string) => void,
    onError?: (code: string, fatal: boolean) => void,
  ): boolean {
    return this.recognition.startOralListening(locale, session, onUpdate, onError)
  }

  stopOralListening(): void {
    this.recognition.stopListening()
  }

  isListening(): boolean {
    return this.recognition.isListening()
  }
}
