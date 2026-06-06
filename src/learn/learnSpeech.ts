import { splitTextForTts, stripMarkdownForSpeech } from './learnSpeechText'

export { stripMarkdownForSpeech } from './learnSpeechText'

/** Голос ИИ-учителя: нейро-TTS (OpenAI) + запасной Web Speech API. */

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

export type LearnSpeechLocale = 'ru' | 'en'

export type SpeechOutputMode = 'neural' | 'browser'

const SPEECH_LOCALE: Record<LearnSpeechLocale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
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

export function resolveLearnTtsUrl(): string {
  const explicit = import.meta.env.VITE_LEARN_TTS_URL as string | undefined
  if (explicit?.trim()) return explicit.trim()
  const chat = import.meta.env.VITE_LEARN_CHAT_URL as string | undefined
  if (chat?.trim()) return chat.trim().replace(/\/chat\/?$/, '/tts')
  return '/api/learn/tts'
}

function pickBrowserVoice(locale: LearnSpeechLocale): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  const langPrefix = locale === 'ru' ? 'ru' : 'en'
  const prefer = locale === 'ru'
    ? ['microsoft pavel', 'google русский', 'milena', 'dmitri', 'ru-ru']
    : ['microsoft aria', 'google us english', 'samantha', 'en-us']

  const lower = (s: string) => s.toLowerCase()
  for (const hint of prefer) {
    const hit = voices.find(
      (v) => lower(v.lang).includes(langPrefix) && lower(v.name).includes(hint),
    )
    if (hit) return hit
  }
  return voices.find((v) => lower(v.lang).startsWith(langPrefix)) ?? null
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
  private audio: HTMLAudioElement | null = null
  private objectUrl: string | null = null
  private fetchAbort: AbortController | null = null
  private neuralCache = new Map<string, NeuralCacheEntry>()
  private lastMode: SpeechOutputMode = 'browser'

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

    const neural = await this.speakNeural(text, locale, onMode)
    if (neural) {
      this.lastMode = 'neural'
      onMode?.('neural')
      onEnd?.()
      return true
    }

    const browserOk = await new Promise<boolean>((resolve) => {
      const started = this.speakBrowser(text, locale, () => {
        onEnd?.()
        resolve(true)
      })
      if (!started) resolve(false)
    })
    if (browserOk) {
      this.lastMode = 'browser'
      onMode?.('browser')
      return true
    }
    onEnd?.()
    return false
  }

  private cacheKey(locale: LearnSpeechLocale, chunk: string): string {
    return `${locale}:${chunk.slice(0, 120)}:${chunk.length}`
  }

  private async fetchNeuralChunk(
    chunk: string,
    locale: LearnSpeechLocale,
    signal: AbortSignal,
  ): Promise<NeuralCacheEntry | null> {
    const key = this.cacheKey(locale, chunk)
    const cached = this.neuralCache.get(key)
    if (cached) return cached

    const res = await fetch(resolveLearnTtsUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: chunk, locale }),
      signal,
    })
    if (!res.ok) return null

    const data = (await res.json()) as {
      audioBase64?: string
      mimeType?: string
      source?: string
      error?: string
    }
    if (!data.audioBase64 || data.source !== 'openai') return null

    const entry = { audioBase64: data.audioBase64, mimeType: data.mimeType ?? 'audio/mpeg' }
    this.neuralCache.set(key, entry)
    return entry
  }

  private playBase64(entry: NeuralCacheEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      this.revokeObjectUrl()
      const binary = atob(entry.audioBase64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: entry.mimeType })
      const url = URL.createObjectURL(blob)
      this.objectUrl = url

      const audio = new Audio(url)
      this.audio = audio
      audio.onended = () => resolve()
      audio.onerror = () => reject(new Error('audio_playback'))
      void audio.play().catch(reject)
    })
  }

  private async speakNeural(
    text: string,
    locale: LearnSpeechLocale,
    onMode?: (mode: SpeechOutputMode) => void,
  ): Promise<boolean> {
    const chunks = splitTextForTts(text)
    if (chunks.length === 0) return false

    this.fetchAbort = new AbortController()
    const signal = this.fetchAbort.signal

    try {
      for (const chunk of chunks) {
        if (signal.aborted) return false
        const entry = await this.fetchNeuralChunk(chunk, locale, signal)
        if (!entry) return false
        onMode?.('neural')
        await this.playBase64(entry)
        if (signal.aborted) return false
      }
      return true
    } catch {
      return false
    }
  }

  private speakBrowser(text: string, locale: LearnSpeechLocale, onEnd?: () => void): boolean {
    if (!speechSupported()) return false

    const utterance = new SpeechSynthesisUtterance(stripMarkdownForSpeech(text))
    utterance.lang = SPEECH_LOCALE[locale]
    utterance.rate = locale === 'ru' ? 0.92 : 0.96
    utterance.pitch = 1
    const voice = pickBrowserVoice(locale)
    if (voice) utterance.voice = voice

    utterance.onend = () => onEnd?.()
    utterance.onerror = () => onEnd?.()

    window.speechSynthesis.speak(utterance)
    return true
  }

  stop(): void {
    this.fetchAbort?.abort()
    this.fetchAbort = null

    if (this.audio) {
      this.audio.pause()
      this.audio.src = ''
      this.audio = null
    }
    this.revokeObjectUrl()

    if (speechSupported()) {
      window.speechSynthesis.cancel()
    }
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }
  }

  isSpeaking(): boolean {
    if (this.audio && !this.audio.paused) return true
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

  isListening(): boolean {
    return this.listening
  }
}

/** Предзагрузка голосов (Chrome отдаёт список асинхронно). */
export function preloadSpeechVoices(): void {
  if (!speechSupported()) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices()
  }
}
