/**
 * ATOMLAB Teacher Voice — neural-голос Microsoft (ru-RU-DmitryNeural) через
 * локальный Python edge-tts (/api/learn/tts), с фолбэком на браузерный Web Speech API.
 */
import { splitTextForTts, TTS_CHUNK_GAP_MS } from './learnSpeechText'

export { stripMarkdownForSpeech, prepareTextForHumanTts } from './learnSpeechText'

import {
  isBrowserSpeechActive,
  isBrowserSpeechSupported,
  preloadBrowserSpeechVoices,
  speakWithBrowserVoice,
  stopBrowserSpeech,
} from './learnSpeechBrowser'
import { preloadPuterTts } from './learnPuterTts'
import { LearnSpeechRecognition, isSpeechRecognitionSupported } from './learnSpeechRecognition'
import {
  isNeuralPlaybackActive,
  playNeuralAudioBase64,
  stopNeuralPlayback,
  unlockAudioPlayback,
} from './learnSpeechPlayback'
import {
  fetchTeacherTtsChunk,
  isTeacherTtsAvailable,
  primeTeacherVoiceOnUserGesture,
  teacherTtsLocale,
} from './learnTeacherTtsClient'

export type LearnSpeechLocale = 'ru' | 'en' | 'uz'
export type SpeechOutputMode = 'neural' | 'browser'

export function isSpeechSynthesisSupported(): boolean {
  return isBrowserSpeechSupported()
}

export { isSpeechRecognitionSupported }

export function isSpeechOutputSupported(): boolean {
  return isTeacherTtsAvailable() || isBrowserSpeechSupported()
}

export function preloadSpeechVoices(): void {
  preloadBrowserSpeechVoices()
  preloadPuterTts()
}

export class LearnSpeechController {
  private recognition = new LearnSpeechRecognition()
  private speakAborted = false
  private lastMode: SpeechOutputMode = 'neural'
  private neuralController: AbortController | null = null

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
    this.speakAborted = false
    primeTeacherVoiceOnUserGesture()
    await unlockAudioPlayback()

    const chunks = splitTextForTts(text, locale).filter((c) => this.isSpeakableChunk(c))
    if (chunks.length === 0) {
      onError?.('empty')
      onEnd?.()
      return false
    }

    // 1) Neural-голос учителя (Microsoft Dmitry через локальный edge-tts).
    const neural = await this.speakNeural(chunks, locale, onMode)
    if (neural === 'ok') {
      onEnd?.()
      return true
    }
    if (neural === 'aborted') {
      onEnd?.()
      return false
    }

    // 2) Фолбэк — системный голос браузера.
    if (this.speakAborted) {
      onEnd?.()
      return false
    }
    if (!isBrowserSpeechSupported()) {
      onError?.('unavailable')
      onEnd?.()
      return false
    }

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

  /**
   * Потоковая озвучка neural-голосом: все запросы уходят сразу (параллельно),
   * а воспроизведение строго по порядку — первый короткий фрагмент звучит уже
   * через пару секунд, пока синтезируются остальные.
   *
   * Откат на браузер — только если НЕ проиграл самый первый фрагмент (например,
   * neural недоступен или autoplay заблокирован). Если первый фрагмент пошёл —
   * остаёмся в neural, чтобы не дублировать речь роботом.
   */
  private async speakNeural(
    chunks: string[],
    locale: LearnSpeechLocale,
    onMode?: (mode: SpeechOutputMode) => void,
  ): Promise<'ok' | 'aborted' | 'fallback'> {
    if (!isTeacherTtsAvailable()) return 'fallback'

    const controller = new AbortController()
    this.neuralController = controller
    const ttsLocale = teacherTtsLocale(locale)

    try {
      // Запросы летят параллельно; daemon отдаёт их по порядку — играем по мере готовности.
      const inflight = chunks.map((chunk) => fetchTeacherTtsChunk(chunk, ttsLocale, controller.signal))

      const first = await inflight[0]
      if (this.speakAborted || controller.signal.aborted) return 'aborted'
      if (!first) return 'fallback'

      onMode?.('neural')
      this.lastMode = 'neural'

      try {
        await playNeuralAudioBase64(first.audioBase64, first.mimeType, controller.signal)
      } catch {
        // Первый фрагмент не проиграл (autoplay / нет звука) → чистый откат на браузер.
        return this.speakAborted ? 'aborted' : 'fallback'
      }

      for (let i = 1; i < inflight.length; i++) {
        if (this.speakAborted || controller.signal.aborted) return 'aborted'
        const entry = await inflight[i]
        if (this.speakAborted || controller.signal.aborted) return 'aborted'
        if (!entry) continue // редкий сбой одного фрагмента — пропускаем, не ломая голос
        try {
          await this.delay(TTS_CHUNK_GAP_MS)
          await playNeuralAudioBase64(entry.audioBase64, entry.mimeType, controller.signal)
        } catch {
          if (this.speakAborted) return 'aborted'
          break // уже в neural-режиме — не дублируем браузером
        }
      }

      return this.speakAborted ? 'aborted' : 'ok'
    } catch {
      return this.speakAborted ? 'aborted' : 'fallback'
    } finally {
      if (this.neuralController === controller) this.neuralController = null
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private isSpeakableChunk(chunk: string): boolean {
    const t = chunk.trim()
    if (t.length < 2) return false
    return /[a-zA-Zа-яА-ЯёЁ0-9]/.test(t)
  }

  stop(): void {
    this.speakAborted = true
    this.neuralController?.abort()
    this.neuralController = null
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
