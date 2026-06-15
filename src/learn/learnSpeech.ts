/**
 * ATOMLAB Teacher Voice v3
 *
 * Правило: один ответ = один голос. Никогда neural + браузер подряд.
 * 1. Подготовка текста
 * 2. Проба neural → если ВСЕ фрагменты готовы → Dmitry MP3
 * 3. Иначе только системный Dmitry (speechSynthesis)
 */
import { splitTextForTts, TTS_CHUNK_GAP_MS } from './learnSpeechText'

export { stripMarkdownForSpeech, prepareTextForHumanTts } from './learnSpeechText'

import {
  isBrowserSpeechActive,
  isBrowserSpeechSupported,
  preloadBrowserSpeechVoices,
  speakWithBrowserVoice,
  stopBrowserSpeech,
  hasNativeBrowserNeuralVoice,
} from './learnSpeechBrowser'
import { LearnSpeechRecognition, isSpeechRecognitionSupported } from './learnSpeechRecognition'
import {
  fetchAllTeacherTtsChunks,
  isTeacherTtsAvailable,
  primaryTeacherTtsUrl,
  resolveTeacherTtsUrls,
  teacherTtsLocale,
} from './learnTeacherTtsClient'
import {
  isNeuralPlaybackActive,
  playNeuralAudioBase64,
  stopNeuralPlayback,
  unlockAudioPlayback,
} from './learnSpeechPlayback'

export type LearnSpeechLocale = 'ru' | 'en' | 'uz'
export type SpeechOutputMode = 'neural' | 'browser'

type NeuralEntry = { audioBase64: string; mimeType: string }

export function resolveLearnTtsUrls(): string[] {
  return resolveTeacherTtsUrls()
}

export function resolveLearnTtsUrl(): string {
  return primaryTeacherTtsUrl()
}

export function isSpeechSynthesisSupported(): boolean {
  return isBrowserSpeechSupported()
}

export { isSpeechRecognitionSupported, hasNativeBrowserNeuralVoice }

export function isSpeechOutputSupported(): boolean {
  return isBrowserSpeechSupported() || isTeacherTtsAvailable()
}

export function preloadSpeechVoices(): void {
  preloadBrowserSpeechVoices()
}

export class LearnSpeechController {
  private recognition = new LearnSpeechRecognition()
  private fetchAbort: AbortController | null = null
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

    this.stop()
    await unlockAudioPlayback()

    const chunks = splitTextForTts(text, locale).filter((c) => this.isSpeakableChunk(c))
    if (chunks.length === 0) {
      onError?.('empty')
      onEnd?.()
      return false
    }

    const ttsLocale = teacherTtsLocale(locale)

    this.fetchAbort = new AbortController()
    const signal = this.fetchAbort.signal
    const timeout = setTimeout(() => this.fetchAbort?.abort(), 240_000)

    try {
      const entries = await fetchAllTeacherTtsChunks(chunks, ttsLocale, signal)
      const allNeural = entries.length === chunks.length && entries.every((e) => e !== null)

      if (allNeural && !signal.aborted) {
        const played = await this.playNeuralEntries(entries as NeuralEntry[], signal)
        if (played && !signal.aborted) {
          this.lastMode = 'neural'
          onMode?.('neural')
          onEnd?.()
          return true
        }
      }

      if (signal.aborted) {
        onEnd?.()
        return false
      }

      const browserOk = await speakWithBrowserVoice(chunks, locale, () =>
        Boolean(this.fetchAbort?.signal.aborted),
      )
      if (browserOk) {
        this.lastMode = 'browser'
        onMode?.('browser')
        onEnd?.()
        return true
      }

      if (!signal.aborted) {
        onError?.('unavailable')
      }
      onEnd?.()
      return false
    } catch {
      if (!signal.aborted) {
        const browserOk = await speakWithBrowserVoice(chunks, locale, () => true)
        if (browserOk) {
          this.lastMode = 'browser'
          onMode?.('browser')
          onEnd?.()
          return true
        }
        onError?.('unavailable')
      }
      onEnd?.()
      return false
    } finally {
      clearTimeout(timeout)
      this.fetchAbort = null
    }
  }

  private isSpeakableChunk(chunk: string): boolean {
    const t = chunk.trim()
    if (t.length < 2) return false
    return /[a-zA-Zа-яА-ЯёЁ0-9]/.test(t)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async playNeuralEntries(
    entries: NeuralEntry[],
    signal: AbortSignal,
  ): Promise<boolean> {
    let played = 0
    for (let i = 0; i < entries.length; i++) {
      if (signal.aborted) break
      const entry = entries[i]!
      await playNeuralAudioBase64(entry.audioBase64, entry.mimeType, signal)
      played++
      if (i + 1 < entries.length && !signal.aborted) {
        await this.sleep(TTS_CHUNK_GAP_MS)
      }
    }
    return played > 0
  }

  stop(): void {
    this.fetchAbort?.abort()
    this.fetchAbort = null
    stopNeuralPlayback()
    stopBrowserSpeech()
  }

  isSpeaking(): boolean {
    return isNeuralPlaybackActive() || isBrowserSpeechActive()
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
