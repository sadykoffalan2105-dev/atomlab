import {
  BROWSER_NEURAL_HINTS,
  splitTextForTts,
  TTS_CHUNK_GAP_MS,
} from './learnSpeechText'

export { stripMarkdownForSpeech, prepareTextForHumanTts } from './learnSpeechText'

import {
  TEACHER_BROWSER_PITCH,
  TEACHER_BROWSER_RATE,
} from './learnTeacherVoiceProfile'
import { synthesizeEdgeNeuralSpeechBrowser } from './learnEdgeTtsBrowser'
import { isNeuralPlaybackActive, playNeuralAudioBase64, stopNeuralPlayback, unlockAudioPlayback } from './learnSpeechPlayback'
import { isPlausibleSpeechAudio } from './learnSpeechValidate'
import { prepareTextForHumanTts } from './learnSpeechText'

/** Голос: Python Edge (dev) → браузерный Edge Neural → Dmitry в системе. */

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

export type LearnSpeechLocale = 'ru' | 'en' | 'uz'

export type SpeechOutputMode = 'neural' | 'browser'

const SPEECH_LOCALE: Record<LearnSpeechLocale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  uz: 'uz-UZ',
}

function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function resolveLearnTtsUrls(): string[] {
  const urls: string[] = []

  if (import.meta.env.DEV) {
    urls.push('/api/learn/tts')
  }

  const teacher = import.meta.env.VITE_TEACHER_SERVICE_URL as string | undefined
  if (teacher?.trim()) {
    urls.push(`${teacher.trim().replace(/\/$/, '')}/v1/tts`)
  }

  if (import.meta.env.DEV) {
    urls.push('/teacher-api/v1/tts')
  }

  const explicit = import.meta.env.VITE_LEARN_TTS_URL as string | undefined
  if (explicit?.trim()) urls.push(explicit.trim())

  const chat = import.meta.env.VITE_LEARN_CHAT_URL as string | undefined
  if (chat?.trim()) urls.push(chat.trim().replace(/\/chat\/?$/, '/tts'))

  if (!import.meta.env.DEV) {
    urls.push('/api/learn/tts')
  }

  return [...new Set(urls)]
}

export function resolveLearnTtsUrl(): string {
  return resolveLearnTtsUrls()[0] ?? '/api/learn/tts'
}

function lower(s: string): string {
  return s.toLowerCase()
}

function isNeuralVoiceName(name: string): boolean {
  const n = lower(name)
  return n.includes('neural') || n.includes('online (natural)') || n.includes('natural')
}

function isMaleVoiceName(name: string): boolean {
  const n = lower(name)
  if (
    n.includes('svetlana') ||
    n.includes('irina') ||
    n.includes('jenny') ||
    n.includes('aria') ||
    n.includes('nova') ||
    n.includes('shimmer') ||
    n.includes('coral') ||
    n.includes('madina')
  ) {
    return false
  }
  return (
    n.includes('dmitry') ||
    n.includes('guy') ||
    n.includes('pavel') ||
    n.includes('david') ||
    n.includes('male') ||
    n.includes('мужск')
  )
}

function pickBrowserVoice(locale: LearnSpeechLocale, neuralOnly = false): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  const langPrefix = locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru'
  const hints = BROWSER_NEURAL_HINTS[locale]

  for (const hint of hints) {
    const hit = voices.find((v) => {
      const name = lower(v.name)
      const lang = lower(v.lang)
      if (!lang.startsWith(langPrefix) && !lang.includes(langPrefix)) return false
      return name.includes(hint)
    })
    if (hit && (!neuralOnly || isNeuralVoiceName(hit.name)) && isMaleVoiceName(hit.name)) return hit
  }

  const neural = voices.find(
    (v) =>
      lower(v.lang).startsWith(langPrefix) &&
      isNeuralVoiceName(v.name) &&
      isMaleVoiceName(v.name) &&
      (v.localService || lower(v.name).includes('microsoft')),
  )
  if (neural) return neural

  if (neuralOnly) return null

  const local = voices.find((v) => lower(v.lang).startsWith(langPrefix) && v.localService)
  if (local) return local
  const any = voices.find((v) => lower(v.lang).startsWith(langPrefix))
  if (any) return any
  if (locale === 'uz') return pickBrowserVoice('ru', neuralOnly)
  return null
}

export function hasNativeBrowserNeuralVoice(locale: LearnSpeechLocale): boolean {
  return pickBrowserVoice(locale, true) !== null
}

export function isSpeechSynthesisSupported(): boolean {
  return speechSupported()
}

export function isSpeechRecognitionSupported(): boolean {
  return recognitionCtor() !== null
}

export function isSpeechOutputSupported(): boolean {
  return speechSupported() || !!resolveLearnTtsUrl()
}

type NeuralCacheEntry = { audioBase64: string; mimeType: string }

export class LearnSpeechController {
  private recognition: SpeechRecognitionLike | null = null
  private listening = false
  private oralListenActive = false
  private oralRestartTimer: ReturnType<typeof setTimeout> | null = null
  private fetchAbort: AbortController | null = null
  private neuralCache = new Map<string, NeuralCacheEntry>()
  private lastMode: SpeechOutputMode = 'browser'
  private neuralPlaybackStarted = false

  getLastOutputMode(): SpeechOutputMode {
    return this.lastMode
  }

  async speak(
    text: string,
    locale: LearnSpeechLocale,
    onEnd?: () => void,
    onMode?: (mode: SpeechOutputMode) => void,
  ): Promise<boolean> {
    if (!text.trim()) return false
    this.stop()
    this.neuralPlaybackStarted = false
    await unlockAudioPlayback()

    const neural = await this.speakNeural(text, locale, onMode)
    if (neural) {
      this.lastMode = 'neural'
      onMode?.('neural')
      onEnd?.()
      return true
    }

    // Только если neural вообще не заиграл — системный Dmitry Neural (не робот Windows)
    if (!this.neuralPlaybackStarted) {
      const browserOk = await this.speakBrowserNeural(text, locale, onMode)
      if (browserOk) {
        this.lastMode = 'browser'
        onMode?.('browser')
        onEnd?.()
        return true
      }
    }

    onEnd?.()
    return false
  }

  private cacheKey(locale: LearnSpeechLocale, chunk: string): string {
    return `${locale}:${chunk}`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async fetchNeuralFromServer(
    chunk: string,
    locale: LearnSpeechLocale,
    signal: AbortSignal,
  ): Promise<NeuralCacheEntry | null> {
    for (const url of resolveLearnTtsUrls()) {
      if (signal.aborted) return null

      const chunkAbort = AbortSignal.timeout?.(22_000)
      const combined =
        chunkAbort && typeof AbortSignal.any === 'function'
          ? AbortSignal.any([signal, chunkAbort])
          : signal

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunk, locale, prepared: true }),
          signal: combined,
        })
        if (!res.ok) continue

        const data = (await res.json()) as {
          audioBase64?: string
          mimeType?: string
          source?: string
        }
        if (
          data.audioBase64 &&
          isPlausibleSpeechAudio(data.audioBase64, chunk) &&
          ['openai', 'edge', 'clone'].includes(data.source ?? 'edge')
        ) {
          return { audioBase64: data.audioBase64, mimeType: data.mimeType ?? 'audio/mpeg' }
        }
      } catch {
        /* try next endpoint */
      }
    }
    return null
  }

  /** Мусорные фрагменты не отправляем в TTS. */
  private isSpeakableChunk(chunk: string): boolean {
    const t = chunk.trim()
    if (t.length < 2) return false
    if (!/[a-zA-Zа-яА-ЯёЁ0-9]/.test(t)) return false
    return true
  }

  private async fetchNeuralChunk(
    chunk: string,
    locale: LearnSpeechLocale,
    signal: AbortSignal,
  ): Promise<NeuralCacheEntry | null> {
    if (!this.isSpeakableChunk(chunk)) return null

    const key = this.cacheKey(locale, chunk)
    const cached = this.neuralCache.get(key)
    if (cached) return cached

    const speechLocale = locale === 'uz' ? 'ru' : locale

    // Dev: Python Edge точнее читает текст; production: браузерный Edge
    const tryBrowserFirst = !import.meta.env.DEV

    const tryBrowser = async (): Promise<NeuralCacheEntry | null> => {
      if (signal.aborted) return null
      try {
        const browserEdge = await synthesizeEdgeNeuralSpeechBrowser(chunk, speechLocale)
        if (
          browserEdge &&
          isPlausibleSpeechAudio(browserEdge.audioBase64, chunk)
        ) {
          return { audioBase64: browserEdge.audioBase64, mimeType: browserEdge.mimeType }
        }
      } catch {
        /* ignore */
      }
      return null
    }

    if (tryBrowserFirst) {
      const browser = await tryBrowser()
      if (browser) {
        this.neuralCache.set(key, browser)
        return browser
      }
    }

    const server = await this.fetchNeuralFromServer(chunk, locale, signal)
    if (server) {
      this.neuralCache.set(key, server)
      return server
    }

    if (!tryBrowserFirst) {
      const browser = await tryBrowser()
      if (browser) {
        this.neuralCache.set(key, browser)
        return browser
      }
    }

    return null
  }

  private speakOneBrowserUtterance(
    sentence: string,
    locale: LearnSpeechLocale,
    voice: SpeechSynthesisVoice | null,
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!speechSupported()) {
        resolve()
        return
      }

      const utterance = new SpeechSynthesisUtterance(sentence)
      utterance.lang = SPEECH_LOCALE[locale]
      utterance.rate = TEACHER_BROWSER_RATE[locale === 'uz' ? 'ru' : locale]
      utterance.pitch = TEACHER_BROWSER_PITCH
      utterance.volume = 1.0
      if (voice) utterance.voice = voice

      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()

      window.speechSynthesis.speak(utterance)
    })
  }

  /** Последний fallback: встроенный Dmitry Neural в Windows/Edge (если есть). */
  private async speakBrowserNeural(
    text: string,
    locale: LearnSpeechLocale,
    onMode?: (mode: SpeechOutputMode) => void,
  ): Promise<boolean> {
    if (!speechSupported()) return false

    const voice = pickBrowserVoice(locale, true) ?? pickBrowserVoice(locale, false)
    if (!voice) return false

    const prepared = prepareTextForHumanTts(text, locale)
    const sentences = prepared.split(/(?<=[.!?])\s+/).filter((s) => this.isSpeakableChunk(s))
    if (sentences.length === 0) return false

    window.speechSynthesis.cancel()
    await this.sleep(40)

    onMode?.('browser')
    for (let i = 0; i < sentences.length; i++) {
      if (this.fetchAbort?.signal.aborted) return false
      await this.speakOneBrowserUtterance(sentences[i]!, locale, voice)
      if (i + 1 < sentences.length) await this.sleep(120)
    }

    return true
  }

  private playBase64(entry: NeuralCacheEntry, signal?: AbortSignal): Promise<void> {
    return playNeuralAudioBase64(entry.audioBase64, entry.mimeType, signal)
  }

  private async speakNeural(
    text: string,
    locale: LearnSpeechLocale,
    onMode?: (mode: SpeechOutputMode) => void,
  ): Promise<boolean> {
    const chunks = splitTextForTts(text, locale).filter((c) => this.isSpeakableChunk(c))
    if (chunks.length === 0) return false

    this.fetchAbort = new AbortController()
    const signal = this.fetchAbort.signal
    const timeout = setTimeout(() => this.fetchAbort?.abort(), 180_000)

    try {
      let played = 0
      let nextFetch: Promise<NeuralCacheEntry | null> | null = this.fetchNeuralChunk(
        chunks[0]!,
        locale,
        signal,
      )

      for (let i = 0; i < chunks.length; i++) {
        if (signal.aborted) break

        const entry = await nextFetch
        nextFetch =
          i + 1 < chunks.length
            ? this.fetchNeuralChunk(chunks[i + 1]!, locale, signal)
            : null

        if (!entry) continue

        onMode?.('neural')
        await this.playBase64(entry, signal)
        this.neuralPlaybackStarted = true
        played++

        if (i + 1 < chunks.length && !signal.aborted) {
          await this.sleep(TTS_CHUNK_GAP_MS)
        }
      }

      return played > 0
    } catch {
      return this.neuralPlaybackStarted
    } finally {
      clearTimeout(timeout)
    }
  }

  stop(): void {
    this.fetchAbort?.abort()
    this.fetchAbort = null
    stopNeuralPlayback()

    if (speechSupported()) {
      window.speechSynthesis.cancel()
    }
  }

  isSpeaking(): boolean {
    if (isNeuralPlaybackActive()) return true
    return speechSupported() && window.speechSynthesis.speaking
  }

  startListening(
    locale: LearnSpeechLocale,
    onResult: (transcript: string) => void,
    onError?: (code: string) => void,
  ): boolean {
    const Ctor = recognitionCtor()
    if (!Ctor || this.listening) return false

    this.stopListening()
    const recognition = new Ctor()
    recognition.lang = SPEECH_LOCALE[locale]
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.continuous = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (transcript) onResult(transcript)
    }
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      onError?.(event.error)
    }
    recognition.onend = () => {
      this.listening = false
      this.recognition = null
    }

    this.recognition = recognition
    this.listening = true
    try {
      recognition.start()
      return true
    } catch {
      this.listening = false
      this.recognition = null
      return false
    }
  }

  stopListening(): void {
    this.oralListenActive = false
    if (this.oralRestartTimer) {
      clearTimeout(this.oralRestartTimer)
      this.oralRestartTimer = null
    }
    if (this.recognition) {
      try {
        this.recognition.stop()
      } catch {
        /* already stopped */
      }
    }
    this.listening = false
    this.recognition = null
  }

  /** Непрерывное распознавание для голосового опроса — терпимо к паузам и тишине. */
  startOralListening(
    locale: LearnSpeechLocale,
    session: { committed: string },
    onUpdate: (fullText: string, interimText: string) => void,
    onError?: (code: string, fatal: boolean) => void,
  ): boolean {
    const Ctor = recognitionCtor()
    if (!Ctor || this.oralListenActive) return false

    this.stopListening()
    this.oralListenActive = true
    this.listening = true

    const scheduleNextSession = (delayMs = 320) => {
      if (!this.oralListenActive) return
      if (this.oralRestartTimer) clearTimeout(this.oralRestartTimer)
      this.oralRestartTimer = setTimeout(() => {
        this.oralRestartTimer = null
        if (this.oralListenActive) startSession()
      }, delayMs)
    }

    const startSession = () => {
      if (!this.oralListenActive) return

      const SessionCtor = recognitionCtor()
      if (!SessionCtor) {
        onError?.('not-supported', true)
        this.stopListening()
        return
      }

      const recognition = new SessionCtor()
      recognition.lang = SPEECH_LOCALE[locale]
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognition.continuous = true

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (!result) continue
          const text = result[0]?.transcript ?? ''
          if (!text) continue
          if (result.isFinal) session.committed = `${session.committed}${text} `
          else interim += text
        }
        onUpdate(session.committed.trim(), interim.trim())
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const code = event.error
        if (code === 'aborted') return
        if (code === 'not-allowed') {
          onError?.(code, true)
          this.stopListening()
          return
        }
        if (code === 'no-speech' || code === 'network' || code === 'audio-capture') {
          scheduleNextSession(360)
          return
        }
        onError?.(code, false)
        scheduleNextSession(360)
      }

      recognition.onend = () => {
        if (this.recognition === recognition) this.recognition = null
        if (!this.oralListenActive) {
          this.listening = false
          return
        }
        scheduleNextSession(320)
      }

      this.recognition = recognition
      try {
        recognition.start()
      } catch {
        scheduleNextSession(480)
      }
    }

    startSession()
    return true
  }

  stopOralListening(): void {
    this.stopListening()
  }

  isListening(): boolean {
    return this.listening
  }
}

export function preloadSpeechVoices(): void {
  if (!speechSupported()) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices()
  }
}

