/**
 * ATOMLAB Teacher Voice — neural-голос Microsoft (ru-RU-DmitryNeural) через
 * локальный Python edge-tts (/api/learn/tts), с фолбэком на браузерный Web Speech API.
 */
import { splitTextForTts, TTS_CHUNK_GAP_MS, TTS_LAB_CHUNK_GAP_MS, type SplitTtsProfile } from './learnSpeechText'

export { stripMarkdownForSpeech, prepareTextForHumanTts } from './learnSpeechText'

import {
  isBrowserSpeechActive,
  isBrowserSpeechSupported,
  preloadBrowserSpeechVoices,
  speakWithBrowserVoice,
} from './learnSpeechBrowser'
import { preloadPuterTts } from './learnPuterTts'
import { LearnSpeechRecognition, isSpeechRecognitionSupported } from './learnSpeechRecognition'
import {
  isNeuralPlaybackActive,
  playNeuralAudioBase64,
  unlockAudioPlayback,
} from './learnSpeechPlayback'
import {
  fetchTeacherTtsChunk,
  isTeacherTtsAvailable,
  primeTeacherVoiceOnUserGesture,
  teacherTtsLocale,
} from './learnTeacherTtsClient'
import {
  claimSpeechChannel,
  isSpeechChannelCurrent,
  stopAllAppSpeech,
} from './learnSpeechExclusive'

export type LearnSpeechLocale = 'ru' | 'en' | 'uz'
export type SpeechOutputMode = 'neural' | 'browser'

export type SpeakOptions = {
  profile?: SplitTtsProfile
  onEnd?: () => void
  onMode?: (mode: SpeechOutputMode) => void
  onError?: (code: 'empty' | 'unavailable') => void
}

function resolveSpeakOptions(
  onEnd?: (() => void) | SpeakOptions,
  onMode?: (mode: SpeechOutputMode) => void,
  onError?: (code: 'empty' | 'unavailable') => void,
): Required<Pick<SpeakOptions, 'profile'>> & SpeakOptions {
  if (onEnd && typeof onEnd === 'object') {
    return { profile: onEnd.profile ?? 'default', ...onEnd }
  }
  return { profile: 'default', onEnd, onMode, onError }
}

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
  private channelEpoch = 0

  getLastOutputMode(): SpeechOutputMode {
    return this.lastMode
  }

  async speak(
    text: string,
    locale: LearnSpeechLocale,
    onEnd?: (() => void) | SpeakOptions,
    onMode?: (mode: SpeechOutputMode) => void,
    onError?: (code: 'empty' | 'unavailable') => void,
  ): Promise<boolean> {
    const opts = resolveSpeakOptions(onEnd, onMode, onError)
    if (!text.trim()) {
      opts.onError?.('empty')
      opts.onEnd?.()
      return false
    }

    this.stop()
    this.speakAborted = false
    this.channelEpoch = claimSpeechChannel('learn')
    const channelEpoch = this.channelEpoch
    primeTeacherVoiceOnUserGesture()
    await unlockAudioPlayback()
    if (!isSpeechChannelCurrent(channelEpoch, 'learn') || this.speakAborted) {
      opts.onEnd?.()
      return false
    }

    const chunks = splitTextForTts(text, locale, opts.profile).filter((c) => this.isSpeakableChunk(c))
    if (chunks.length === 0) {
      opts.onError?.('empty')
      opts.onEnd?.()
      return false
    }

    // 1) Neural-голос учителя (Microsoft Dmitry через локальный edge-tts).
    const gapMs = opts.profile === 'lab' ? TTS_LAB_CHUNK_GAP_MS : TTS_CHUNK_GAP_MS
    const neural = await this.speakNeural(chunks, locale, opts.onMode, gapMs)
    if (neural === 'ok') {
      opts.onEnd?.()
      return true
    }
    if (neural === 'aborted') {
      opts.onEnd?.()
      return false
    }

    // 2) Фолбэк — системный голос браузера (только Learn, не lab).
    if (this.speakAborted || !isSpeechChannelCurrent(channelEpoch, 'learn')) {
      opts.onEnd?.()
      return false
    }
    if (!isBrowserSpeechSupported()) {
      opts.onError?.('unavailable')
      opts.onEnd?.()
      return false
    }

    opts.onMode?.('browser')
    const browserOk = await speakWithBrowserVoice(chunks, locale, () => this.speakAborted || !isSpeechChannelCurrent(channelEpoch, 'learn'))
    if (browserOk && !this.speakAborted && isSpeechChannelCurrent(channelEpoch, 'learn')) {
      this.lastMode = 'browser'
      opts.onEnd?.()
      return true
    }

    if (!this.speakAborted) {
      opts.onError?.('unavailable')
    }
    opts.onEnd?.()
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
    gapMs = TTS_CHUNK_GAP_MS,
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
          await this.delay(gapMs)
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
    return /[a-zA-Zа-яА-ЯёЁ0-9ʻʼ'qwgʻshch]/i.test(t)
  }

  stop(): void {
    this.speakAborted = true
    this.neuralController?.abort()
    this.neuralController = null
    stopAllAppSpeech()
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
