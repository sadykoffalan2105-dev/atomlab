/**
 * Обёртка Web Speech API (распознавание речи ученика).
 *
 * Режимы:
 *  • разовый (startListening) — одна фраза, диктовка в поле;
 *  • непрерывный (startOralListening) — живой диалог: continuous + interim, перезапуски
 *    с растущей паузой 250 → 500 → 1000 мс; 5 пустых сессий подряд → «не отвечает»
 *    (в Chrome так выглядит недоступность серверов Google); два таких эпизода → переход
 *    в режим удержания кнопки (push-to-talk);
 *  • push-to-talk (startPushToTalk / stopPushToTalk) — continuous=false, interimResults=true.
 *
 * Везде maxAlternatives = 5 и выбор альтернативы по «химическому» счёту + контексту диалога (chemTranscript).
 * 'uz-UZ' в Chrome не поддерживается → сразу 'ru-RU' (профиль браузера) или повтор после ошибки,
 * пометка 'language-fallback'.
 *
 * Не терять сказанное: Chrome закрывает continuous-сессию после тишины/≈60 с, и interim-хвост,
 * не успевший стать финалом, раньше пропадал. Теперь при onend такой хвост дописывается в
 * committed, а новая сессия стартует через 60 мс (после результата) или 250 мс (после тишины).
 * 'aborted' (Edge при смене вкладки/устройства) — тихий перезапуск.
 * Жёсткая пауза на время речи учителя: pauseListening() / resumeListening(delayMs).
 *
 * Конструктор SpeechRecognition и таймеры внедряются (тесты на моках:
 * scripts/test-voice-recognition.mts).
 */
import { pickBestAlternative, type SttAlternative } from './brain/speech/chemTranscript'
import { getVoiceStatus, setVoiceStatus } from './brain/speech/voiceStatus'
import { realScheduler, type TimingScheduler } from './brain/voice/conversationTiming'
import { currentBrowserVoiceProfile, type BrowserVoiceProfile } from './brain/speech/browserProfile'

export type RecognitionLocale = 'ru' | 'en' | 'uz'

const SPEECH_LOCALE: Record<RecognitionLocale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  uz: 'uz-UZ',
}

export type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort?: () => void
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function domRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return domRecognitionCtor() !== null
}

/** Паузы перезапуска непрерывного режима (мс). */
export const RESTART_BACKOFF_MS = [250, 500, 1000] as const
/** Сессия закрылась после речи ученика — новая сразу (меньше «глухое окно» между сессиями). */
export const RESTART_AFTER_RESULT_MS = 60
/** Столько 'aborted' подряд перезапускаем молча (дальше — как пустая сессия). */
export const ABORTED_SILENT_RESTARTS = 3
/** Столько пустых сессий подряд → «распознавание не отвечает». */
export const EMPTY_SESSIONS_LIMIT = 5
/** Столько эпизодов «не отвечает» → переход в push-to-talk. */
export const UNRESPONSIVE_EPISODES_TO_PTT = 2

/** Лучшая альтернатива результата (maxAlternatives = 5). */
function bestOf(result: SpeechRecognitionResult | undefined): string {
  if (!result) return ''
  const alts: SttAlternative[] = []
  for (let i = 0; i < result.length; i++) {
    const a = result[i]
    if (a?.transcript) alts.push({ transcript: a.transcript, confidence: a.confidence })
  }
  return pickBestAlternative(alts)
}

export interface LearnSpeechRecognitionOptions {
  ctor?: SpeechRecognitionCtor | null
  scheduler?: TimingScheduler
  /** Профиль браузера (Chrome без uz-UZ → сразу ru-RU). По умолчанию — без предположений. */
  profile?: Pick<BrowserVoiceProfile, 'vendor' | 'supportedLocales'> | null
}

export class LearnSpeechRecognition {
  private recognition: SpeechRecognitionLike | null = null
  private listening = false
  private oralListenActive = false
  private oralRestartTimer: unknown = null
  private oralGeneration = 0
  private paused = false
  private pttActive = false
  private unresponsiveEpisodes = 0
  private readonly ctorOverride: SpeechRecognitionCtor | null | undefined
  private readonly s: TimingScheduler
  private readonly profile: LearnSpeechRecognitionOptions['profile']

  constructor(options: LearnSpeechRecognitionOptions = {}) {
    this.ctorOverride = options.ctor
    this.s = options.scheduler ?? realScheduler
    // Настоящий браузер (без внедрённого конструктора) — берём его профиль; в тестах — без предположений.
    this.profile = options.profile !== undefined ? options.profile : options.ctor === undefined ? currentBrowserVoiceProfile() : null
  }

  /** Язык, который браузер точно не распознаёт (Chrome + uz) → сразу ru, без лишней ошибки. */
  private preferredLocale(locale: RecognitionLocale): RecognitionLocale | null {
    const p = this.profile
    if (!p || p.vendor !== 'chrome') return null
    return p.supportedLocales.includes(locale) ? null : 'ru'
  }

  private ctor(): SpeechRecognitionCtor | null {
    return this.ctorOverride !== undefined ? this.ctorOverride : domRecognitionCtor()
  }

  /* ------------------------------------------------------------ разовый режим */

  startListening(
    locale: RecognitionLocale,
    onResult: (transcript: string) => void,
    onError?: (code: string) => void,
  ): boolean {
    const Ctor = this.ctor()
    if (!Ctor || this.listening) return false

    this.stopListening()
    const recognition = new Ctor()
    recognition.lang = SPEECH_LOCALE[locale]
    recognition.interimResults = false
    recognition.maxAlternatives = 5
    recognition.continuous = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = bestOf(event.results[0]).trim()
      if (transcript) onResult(transcript)
    }
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = event.error
      if (code === 'language-not-supported' && locale === 'uz') {
        // Chrome не знает uz-UZ: та же фраза ещё раз по-русски.
        this.listening = false
        this.recognition = null
        setVoiceStatus('language_fallback')
        this.startListening('ru', onResult, onError)
        return
      }
      setVoiceStatus(statusForError(code))
      onError?.(code)
    }
    recognition.onend = () => {
      this.listening = false
      this.recognition = null
    }

    this.recognition = recognition
    this.listening = true
    try {
      recognition.start()
      setVoiceStatus('listening')
      return true
    } catch {
      this.listening = false
      this.recognition = null
      return false
    }
  }

  /* ------------------------------------------------------- непрерывный режим */

  startOralListening(
    locale: RecognitionLocale,
    session: { committed: string },
    onUpdate: (fullText: string, interimText: string) => void,
    onError?: (code: string, fatal: boolean) => void,
  ): boolean {
    const Ctor = this.ctor()
    if (!Ctor || this.oralListenActive) return false

    this.stopListening()
    this.oralListenActive = true
    this.listening = true
    this.paused = false
    // Поколение сессии: onend/onerror старого распознавания (после stop → start)
    // не должны запускать второе распознавание параллельно новому.
    const generation = ++this.oralGeneration
    const isCurrent = () => this.oralListenActive && this.oralGeneration === generation
    /** Пустые сессии подряд (без единого результата) — растущая пауза, потом «не отвечает». */
    let emptySessions = 0
    let abortedInRow = 0
    let langOverride: RecognitionLocale | null = this.preferredLocale(locale)
    if (langOverride) {
      setVoiceStatus('language_fallback')
      onError?.('language-fallback', false)
    }

    const scheduleNextSession = (delayMs: number) => {
      if (!isCurrent() || this.paused) return
      if (this.oralRestartTimer) this.s.clearTimeout(this.oralRestartTimer)
      this.oralRestartTimer = this.s.setTimeout(() => {
        this.oralRestartTimer = null
        if (isCurrent() && !this.paused) startSession()
      }, delayMs)
    }
    const backoff = () => RESTART_BACKOFF_MS[Math.min(Math.max(0, emptySessions - 1), RESTART_BACKOFF_MS.length - 1)]!

    const registerEmpty = () => {
      emptySessions++
      if (emptySessions === EMPTY_SESSIONS_LIMIT) {
        this.unresponsiveEpisodes++
        if (this.unresponsiveEpisodes >= UNRESPONSIVE_EPISODES_TO_PTT) {
          // Непрерывный режим в этом браузере не живёт — переходим на удержание кнопки.
          setVoiceStatus('push_to_talk', 'push_to_talk')
          onError?.('push-to-talk', false)
          this.stopListening()
          return false
        }
        setVoiceStatus('unresponsive')
        onError?.('unresponsive', false)
        emptySessions = 0
      }
      return true
    }

    const startSession = () => {
      if (!isCurrent()) return

      const recognition = new Ctor()
      recognition.lang = SPEECH_LOCALE[langOverride ?? locale]
      recognition.interimResults = true
      recognition.maxAlternatives = 5
      recognition.continuous = true
      let gotResult = false
      let gotNoSpeech = false
      /** Последний interim этой сессии, ещё не ставший финалом (не терять при onend). */
      let pendingInterim = ''

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Финальные куски остановленной сессии (stop() дожидается их) — это та же речь ученика.
        if (!isCurrent() && this.oralGeneration !== generation) return
        gotResult = true
        emptySessions = 0
        abortedInRow = 0
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (!result) continue
          // Interim — первая альтернатива (она ещё меняется), финал — лучшая по словарю и контексту.
          const text = result.isFinal ? bestOf(result) : (result[0]?.transcript ?? '')
          if (!text) continue
          if (result.isFinal) session.committed = `${session.committed}${text.trim()} `
          else interim += text
        }
        pendingInterim = interim.trim()
        onUpdate(session.committed.trim(), pendingInterim)
      }

      /** Сессия закрылась, а хвост так и остался interim — дописываем его, чтобы слова не пропали. */
      const promotePendingInterim = () => {
        if (!pendingInterim) return
        session.committed = `${session.committed}${pendingInterim} `
        pendingInterim = ''
        onUpdate(session.committed.trim(), '')
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (!isCurrent()) return
        const code = event.error
        if (code === 'aborted') {
          // Edge/Chrome обрывают сессию при смене устройства/вкладки — перезапуск без штрафа (до 3 раз подряд).
          abortedInRow++
          if (abortedInRow <= ABORTED_SILENT_RESTARTS) {
            gotNoSpeech = true
            scheduleNextSession(RESTART_BACKOFF_MS[0])
          }
          return
        }
        if (code === 'language-not-supported' && (langOverride ?? locale) === 'uz') {
          langOverride = 'ru'
          setVoiceStatus('language_fallback')
          onError?.('language-fallback', false)
          scheduleNextSession(RESTART_BACKOFF_MS[0])
          return
        }
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'language-not-supported') {
          // Без разрешения / без сервиса распознавания перезапуск бесполезен.
          setVoiceStatus(statusForError(code))
          onError?.(code, true)
          this.stopListening()
          return
        }
        if (code === 'no-speech') {
          // Chrome закрывает сессию после тишины; это признак, что сервис жив — перезапуск сразу.
          gotNoSpeech = true
          setVoiceStatus('no_speech')
          scheduleNextSession(RESTART_BACKOFF_MS[0])
          return
        }
        if (code === 'network' || code === 'audio-capture') {
          setVoiceStatus(statusForError(code))
          if (!registerEmpty()) return
          onError?.(code, false)
          scheduleNextSession(backoff())
          return
        }
        onError?.(code, false)
        if (!registerEmpty()) return
        scheduleNextSession(backoff())
      }

      recognition.onend = () => {
        if (this.recognition === recognition) this.recognition = null
        // Закрылась сама (тишина/лимит) или по stop() — недослушанный interim не теряем.
        if (this.oralGeneration === generation) promotePendingInterim()
        if (!isCurrent()) {
          if (this.oralGeneration === generation) this.listening = false
          return
        }
        if (this.paused) return
        // Если перезапуск уже запланирован (onerror) — не дублируем.
        if (this.oralRestartTimer) return
        if (gotResult) {
          emptySessions = 0
          scheduleNextSession(RESTART_AFTER_RESULT_MS)
          return
        }
        if (gotNoSpeech) {
          emptySessions = 0
          scheduleNextSession(RESTART_BACKOFF_MS[0])
          return
        }
        // Сессия закрылась молча и без результата — так Chrome ведёт себя без серверов Google.
        if (!registerEmpty()) return
        scheduleNextSession(backoff())
      }

      this.recognition = recognition
      try {
        recognition.start()
        setVoiceStatus('listening', 'continuous')
      } catch {
        if (registerEmpty()) scheduleNextSession(backoff())
      }
    }

    this.restartCurrent = startSession
    startSession()
    return true
  }

  /** Жёсткая пауза на время речи учителя: распознавание останавливаем, сессия остаётся живой. */
  pauseListening(): void {
    if (!this.oralListenActive || this.paused) return
    this.paused = true
    if (this.oralRestartTimer) {
      this.s.clearTimeout(this.oralRestartTimer)
      this.oralRestartTimer = null
    }
    const r = this.recognition
    this.recognition = null
    if (r) {
      // Поздний onend/onerror остановленного экземпляра не должен плодить перезапуски.
      r.onend = null
      r.onerror = null
      try {
        r.stop()
      } catch {
        /* already stopped */
      }
    }
  }

  /** Снять паузу: новое распознавание через delayMs (хвост эха в колонках дозвучит). */
  resumeListening(delayMs = 500): void {
    if (!this.oralListenActive || !this.paused) return
    this.paused = false
    const generation = this.oralGeneration
    if (this.oralRestartTimer) this.s.clearTimeout(this.oralRestartTimer)
    this.oralRestartTimer = this.s.setTimeout(() => {
      this.oralRestartTimer = null
      if (!this.oralListenActive || this.oralGeneration !== generation || this.paused) return
      // Перезапуск через тот же startOralListening невозможен (замыкание) — эмулируем onend-рестарт.
      this.restartCurrent?.()
    }, delayMs)
  }

  isPaused(): boolean {
    return this.paused
  }

  /** Назначается startOralListening для resumeListening. */
  private restartCurrent: (() => void) | null = null

  /* --------------------------------------------------------- push-to-talk */

  /** Удержание кнопки: continuous=false, interim показываем, финал — лучшая альтернатива. */
  startPushToTalk(
    locale: RecognitionLocale,
    onUpdate: (interimText: string) => void,
    onFinal: (text: string) => void,
    onError?: (code: string) => void,
  ): boolean {
    const Ctor = this.ctor()
    if (!Ctor || this.pttActive) return false
    this.stopListening()
    this.pttActive = true
    this.listening = true
    const recognition = new Ctor()
    recognition.lang = SPEECH_LOCALE[locale]
    recognition.interimResults = true
    recognition.maxAlternatives = 5
    recognition.continuous = false
    let finalText = ''
    let lastInterim = ''
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (!result) continue
        if (result.isFinal) finalText = `${finalText} ${bestOf(result)}`.trim()
        else interim += result[0]?.transcript ?? ''
      }
      lastInterim = interim.trim()
      onUpdate(lastInterim)
    }
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted') return
      setVoiceStatus(statusForError(event.error), 'push_to_talk')
      onError?.(event.error)
    }
    recognition.onend = () => {
      if (this.recognition === recognition) this.recognition = null
      this.pttActive = false
      this.listening = false
      // Кнопку отпустили раньше, чем пришёл финал, — отдаём последний interim, а не пустоту.
      const text = `${finalText} ${lastInterim}`.replace(/\s+/g, ' ').trim()
      if (text) onFinal(text)
    }
    this.recognition = recognition
    try {
      recognition.start()
      setVoiceStatus('listening', 'push_to_talk')
      return true
    } catch {
      this.pttActive = false
      this.listening = false
      this.recognition = null
      return false
    }
  }

  /** Кнопку отпустили: stop() дожидается финала, onend отдаст текст. */
  stopPushToTalk(): void {
    if (!this.pttActive) return
    try {
      this.recognition?.stop()
    } catch {
      /* already stopped */
    }
  }

  /* -------------------------------------------------------------------- общее */

  stopListening(): void {
    this.oralListenActive = false
    this.pttActive = false
    this.paused = false
    this.restartCurrent = null
    if (this.oralRestartTimer) {
      this.s.clearTimeout(this.oralRestartTimer)
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
    const cur = getVoiceStatus().code
    if (cur === 'listening' || cur === 'no_speech') setVoiceStatus('idle')
  }

  isListening(): boolean {
    return this.listening
  }

  /** Сколько раз непрерывный режим признавался «не отвечающим» (для UI/тестов). */
  getUnresponsiveEpisodes(): number {
    return this.unresponsiveEpisodes
  }
}

function statusForError(code: string) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'not_allowed' as const
    case 'network':
      return 'network' as const
    case 'audio-capture':
      return 'audio_capture' as const
    case 'no-speech':
      return 'no_speech' as const
    case 'language-not-supported':
      return 'not_supported' as const
    default:
      return 'idle' as const
  }
}
