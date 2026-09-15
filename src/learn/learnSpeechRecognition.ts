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
  private oralGeneration = 0

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
    // Поколение сессии: onend/onerror старого распознавания (после stop → start)
    // не должны запускать второе распознавание параллельно новому.
    const generation = ++this.oralGeneration
    const isCurrent = () => this.oralListenActive && this.oralGeneration === generation
    /** Подряд идущие ошибки без результата — растущая пауза (офлайн не спамит перезапусками). */
    let failures = 0

    const scheduleNextSession = (delayMs = 80) => {
      if (!isCurrent()) return
      if (this.oralRestartTimer) clearTimeout(this.oralRestartTimer)
      this.oralRestartTimer = setTimeout(() => {
        this.oralRestartTimer = null
        if (isCurrent()) startSession()
      }, delayMs)
    }
    const backoff = (base: number) => Math.min(3_000, base * 2 ** Math.min(failures, 5))

    const startSession = () => {
      if (!isCurrent()) return

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
        // Финальные куски остановленной сессии (stop() дожидается их) — это та же речь ученика.
        if (!isCurrent() && this.oralGeneration !== generation) return
        failures = 0
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
        if (!isCurrent()) return
        const code = event.error
        if (code === 'aborted') return
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'language-not-supported') {
          // Без разрешения / без сервиса распознавания (Electron, часть сборок) перезапуск бесполезен.
          onError?.(code, true)
          this.stopListening()
          return
        }
        failures++
        if (code === 'no-speech') {
          failures = 0
          scheduleNextSession(120)
          return
        }
        if (code === 'network' || code === 'audio-capture') {
          if (failures === 3) onError?.(code, false)
          scheduleNextSession(backoff(160))
          return
        }
        onError?.(code, false)
        scheduleNextSession(backoff(160))
      }

      recognition.onend = () => {
        if (this.recognition === recognition) this.recognition = null
        if (!isCurrent()) {
          if (this.oralGeneration === generation) this.listening = false
          return
        }
        // Если перезапуск уже запланирован (onerror) — не дублируем.
        if (!this.oralRestartTimer) scheduleNextSession(60)
      }

      this.recognition = recognition
      try {
        recognition.start()
      } catch {
        scheduleNextSession(160)
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
