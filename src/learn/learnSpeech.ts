import {
  BROWSER_NEURAL_HINTS,
  BROWSER_SENTENCE_GAP_MS,
  BROWSER_SPEECH_RATE,
  prepareTextForHumanTts,
  splitTextForTts,
  TTS_CHUNK_GAP_MS,
} from './learnSpeechText'

export { stripMarkdownForSpeech, prepareTextForHumanTts } from './learnSpeechText'

import { TEACHER_BROWSER_PITCH } from './learnTeacherVoiceProfile'

/** Голос ИИ-учителя: Microsoft Dmitry Neural → OpenAI → клон → браузер. */

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
  const teacher = import.meta.env.VITE_TEACHER_SERVICE_URL as string | undefined
  if (teacher?.trim()) return `${teacher.trim().replace(/\/$/, '')}/v1/tts`
  if (import.meta.env.DEV) return '/teacher-api/v1/tts'
  const explicit = import.meta.env.VITE_LEARN_TTS_URL as string | undefined
  if (explicit?.trim()) return explicit.trim()
  const chat = import.meta.env.VITE_LEARN_CHAT_URL as string | undefined
  if (chat?.trim()) return chat.trim().replace(/\/chat\/?$/, '/tts')
  return '/api/learn/tts'
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
  if (n.includes('svetlana') || n.includes('irina') || n.includes('jenny') || n.includes('aria') || n.includes('nova') || n.includes('shimmer') || n.includes('coral')) {
    return false
  }
  return n.includes('dmitry') || n.includes('guy') || n.includes('pavel') || n.includes('david') || n.includes('male') || n.includes('мужск')
}

function pickBrowserVoice(locale: LearnSpeechLocale, neuralOnly = false): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  const langPrefix = locale === 'ru' ? 'ru' : 'en'
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
  return voices.find((v) => lower(v.lang).startsWith(langPrefix)) ?? null
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
  private audio: HTMLAudioElement | null = null
  private objectUrl: string | null = null
  private fetchAbort: AbortController | null = null
  private neuralCache = new Map<string, NeuralCacheEntry>()
  private browserAbort = false
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

    const browserOk = await this.speakBrowserQueued(text, locale, false)
    if (browserOk) {
      this.lastMode = 'browser'
      onMode?.('browser')
      onEnd?.()
      return true
    }

    onEnd?.()
    return false
  }

  private cacheKey(locale: LearnSpeechLocale, chunk: string): string {
    return `${locale}:${chunk.slice(0, 120)}:${chunk.length}`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
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
    if (!data.audioBase64 || !['openai', 'edge', 'clone'].includes(data.source ?? '')) return null

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
      audio.playbackRate = 1.0
      audio.volume = 1.0
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
    const chunks = splitTextForTts(text, locale)
    if (chunks.length === 0) return false

    this.fetchAbort = new AbortController()
    const signal = this.fetchAbort.signal

    try {
      let pending: Promise<NeuralCacheEntry | null> = this.fetchNeuralChunk(chunks[0]!, locale, signal)

      for (let i = 0; i < chunks.length; i++) {
        if (signal.aborted) return false
        const entry = await pending
        if (!entry) return false

        if (i + 1 < chunks.length) {
          pending = this.fetchNeuralChunk(chunks[i + 1]!, locale, signal)
        }

        onMode?.('neural')
        await this.playBase64(entry)

        if (i + 1 < chunks.length && !signal.aborted) {
          await this.sleep(TTS_CHUNK_GAP_MS)
        }
      }
      return true
    } catch {
      return false
    }
  }

  private speakOneBrowserUtterance(
    sentence: string,
    locale: LearnSpeechLocale,
    voice: SpeechSynthesisVoice | null,
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!speechSupported() || this.browserAbort) {
        resolve()
        return
      }

      const utterance = new SpeechSynthesisUtterance(sentence)
      utterance.lang = SPEECH_LOCALE[locale]
      utterance.rate = BROWSER_SPEECH_RATE[locale]
      utterance.pitch = TEACHER_BROWSER_PITCH
      utterance.volume = 1.0
      if (voice) utterance.voice = voice

      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()

      window.speechSynthesis.speak(utterance)
    })
  }

  private async speakBrowserQueued(
    text: string,
    locale: LearnSpeechLocale,
    neuralOnly: boolean,
  ): Promise<boolean> {
    if (!speechSupported()) return false

    const voice = pickBrowserVoice(locale, neuralOnly)
    if (neuralOnly && !voice) return false

    const prepared = prepareTextForHumanTts(text, locale)
    const sentences = prepared.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0)
    if (sentences.length === 0) return false

    this.browserAbort = false
    window.speechSynthesis.cancel()
    await this.sleep(40)

    for (let i = 0; i < sentences.length; i++) {
      if (this.browserAbort) return false
      await this.speakOneBrowserUtterance(sentences[i]!, locale, voice)
      if (i + 1 < sentences.length && !this.browserAbort) {
        await this.sleep(BROWSER_SENTENCE_GAP_MS)
      }
    }

    return !this.browserAbort
  }

  stop(): void {
    this.browserAbort = true
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

export function preloadSpeechVoices(): void {
  if (!speechSupported()) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices()
  }
}

