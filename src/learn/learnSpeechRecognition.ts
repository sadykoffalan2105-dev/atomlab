export type RecognitionLocale = 'ru' | 'en' | 'uz'

const SPEECH_LOCALE: Record<RecognitionLocale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  uz: 'uz-UZ',
}

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

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return recognitionCtor() !== null
}

export class LearnSpeechRecognition {
  private recognition: SpeechRecognitionLike | null = null
  private listening = false
  private oralListenActive = false
  private oralRestartTimer: ReturnType<typeof setTimeout> | null = null

  startListening(
    locale: RecognitionLocale,
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

  startOralListening(
    locale: RecognitionLocale,
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

  isListening(): boolean {
    return this.listening
  }
}
