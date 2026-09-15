/**
 * Озвучка живого диалога: фраза за фразой, с мгновенной отменой (барджин).
 *
 * Путь выбирается по наименьшей задержке и по тому, что можно прервать сразу:
 *   1) Electron IPC neural TTS (десктоп-приложение);
 *   2) Microsoft Edge — neural-голос через Read-Aloud WebSocket;
 *   3) системный speechSynthesis с лучшим голосом локали (Online (Natural) / Google / …);
 *   4) Puter TTS — только если ученик сам подключил «умный ИИ» и уже вошёл, а
 *      системного голоса для языка нет.
 * Для neural-путей следующая фраза синтезируется заранее (prefetch), пока звучит
 * текущая. Если neural-путь не ответил — переходим на системный голос до конца сессии.
 *
 * Зависимости от DOM внедряемы (`LiveSpeechBackend`), поэтому очередь и отмена
 * тестируются в Node (scripts/test-teacher-live-engine.mts).
 */
import type { AssistantLang } from '../brainTypes'

export type LiveTtsPath = 'electron' | 'edge' | 'browser' | 'puter' | 'silent'

export type NeuralAudio = { audioBase64: string; mimeType: string }

export interface LiveTtsEnvironment {
  desktop: boolean
  edge: boolean
  browserSupported: boolean
  browserVoices: number
  puterSignedIn: boolean
}

/** Чистый выбор пути озвучки (покрыт тестом). */
export function chooseLiveTtsPath(env: LiveTtsEnvironment): LiveTtsPath {
  if (env.desktop) return 'electron'
  if (env.edge) return 'edge'
  if (env.browserSupported && env.browserVoices > 0) return 'browser'
  if (env.puterSignedIn) return 'puter'
  if (env.browserSupported) return 'browser'
  return 'silent'
}

export interface LiveSpeechBackend {
  /** Модули/голоса загружены (до этого окружение неточное). */
  ready(): Promise<void>
  /** null — backend ещё не готов. */
  environment(lang: AssistantLang): LiveTtsEnvironment | null
  /** Подготовка текста к речи (формулы словами, ударения…). */
  prepare(text: string, lang: AssistantLang): string
  synthesize(path: 'electron' | 'edge' | 'puter', text: string, lang: AssistantLang, signal: AbortSignal): Promise<NeuralAudio | null>
  play(audio: NeuralAudio, signal: AbortSignal): Promise<void>
  speakBrowser(text: string, lang: AssistantLang, onStart: () => void): { done: Promise<unknown>; cancel: () => void }
  /** Захватить общий «канал речи» приложения; вернуть проверку «канал всё ещё наш». */
  claimChannel(): Promise<() => boolean>
  /** Мгновенно заглушить всё (neural + системный голос). */
  hardStop(): void
}

export interface LiveSpeechOutputOptions {
  lang: AssistantLang
  backend?: LiveSpeechBackend
  /** Принудительный путь (тесты / настройки). */
  path?: LiveTtsPath
  /** Сколько ждать синтеза одной фразы neural-путём, прежде чем уйти на системный голос. */
  neuralTimeoutMs?: number
  onPathChange?: (path: LiveTtsPath) => void
  onSentenceStart?: (utteranceId: number, index: number, text: string) => void
  onAudioStart?: (utteranceId: number) => void
}

export type UtteranceOutcome = 'completed' | 'cancelled'

export interface LiveUtterance {
  readonly id: number
  push(sentence: string): void
  end(): void
  cancel(): void
  readonly done: Promise<UtteranceOutcome>
  /** Сколько фраз начало звучать. */
  spokenCount(): number
  sentences(): readonly string[]
}

type Item = { raw: string; prepared: string; audio: Promise<NeuralAudio | null> | null }

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export class LiveSpeechOutput {
  private readonly o: LiveSpeechOutputOptions
  private readonly backend: LiveSpeechBackend
  private path: LiveTtsPath | null
  private degraded = false
  private nextId = 1
  private current: UtteranceImpl | null = null

  constructor(options: LiveSpeechOutputOptions) {
    this.o = options
    this.backend = options.backend ?? createDomLiveSpeechBackend()
    this.path = options.path ?? null
  }

  /** Дождаться загрузки backend (модули озвучки, список голосов). */
  ready(): Promise<void> {
    return this.backend.ready()
  }

  getPath(): LiveTtsPath {
    if (this.path && !(this.degraded && this.path !== 'browser')) return this.path
    const env = this.backend.environment(this.o.lang)
    if (!env) return 'browser'
    const chosen = this.degraded ? (env.browserSupported ? 'browser' : 'silent') : chooseLiveTtsPath(env)
    if (chosen !== this.path) {
      this.path = chosen
      this.o.onPathChange?.(chosen)
    }
    return chosen
  }

  /** neural-путь не справился — до конца сессии говорим системным голосом. */
  degradeToBrowser(): void {
    if (this.degraded) return
    this.degraded = true
    this.path = null
    this.getPath()
  }

  isSpeaking(): boolean {
    return Boolean(this.current && !this.current.finished)
  }

  /** Начать новую реплику учителя (предыдущая отменяется). */
  begin(): LiveUtterance {
    this.current?.cancel()
    const u = new UtteranceImpl(this.nextId++, this, this.backend, this.o)
    this.current = u
    void u.done.then(() => {
      if (this.current === u) this.current = null
    })
    return u
  }

  /** Мгновенно замолчать. Возвращает true, если что-то звучало/ждало очереди. */
  cancel(): boolean {
    const u = this.current
    this.current = null
    if (!u || u.finished) {
      this.backend.hardStop()
      return false
    }
    u.cancel()
    return true
  }
}

class UtteranceImpl implements LiveUtterance {
  readonly id: number
  readonly done: Promise<UtteranceOutcome>
  finished = false
  private readonly items: Item[] = []
  private ended = false
  private cancelled = false
  private started = 0
  private wake: (() => void) | null = null
  private readonly abort = new AbortController()
  private currentBrowserCancel: (() => void) | null = null
  private resolveDone!: (o: UtteranceOutcome) => void
  private readonly out: LiveSpeechOutput
  private readonly backend: LiveSpeechBackend
  private readonly o: LiveSpeechOutputOptions
  private audioStarted = false

  constructor(id: number, out: LiveSpeechOutput, backend: LiveSpeechBackend, o: LiveSpeechOutputOptions) {
    this.id = id
    this.out = out
    this.backend = backend
    this.o = o
    this.done = new Promise((resolve) => {
      this.resolveDone = resolve
    })
    void this.run()
  }

  spokenCount(): number {
    return this.started
  }

  sentences(): readonly string[] {
    return this.items.map((i) => i.raw)
  }

  push(sentence: string): void {
    const raw = sentence.trim()
    if (!raw || this.cancelled || this.ended) return
    const prepared = this.backend.prepare(raw, this.o.lang).trim()
    if (!/[\p{L}\p{N}]/u.test(prepared)) return
    this.items.push({ raw, prepared, audio: null })
    // Prefetch: текущая и следующая фразы синтезируются заранее.
    const index = this.items.length - 1
    if (index <= this.started + 1) this.prefetch(index)
    this.wakeUp()
  }

  end(): void {
    this.ended = true
    this.wakeUp()
  }

  cancel(): void {
    if (this.cancelled || this.finished) return
    this.cancelled = true
    this.abort.abort()
    this.currentBrowserCancel?.()
    this.currentBrowserCancel = null
    this.backend.hardStop()
    this.wakeUp()
    this.finish('cancelled')
  }

  private finish(outcome: UtteranceOutcome): void {
    if (this.finished) return
    this.finished = true
    this.resolveDone(outcome)
  }

  private wakeUp(): void {
    const w = this.wake
    this.wake = null
    w?.()
  }

  private prefetch(index: number): void {
    const item = this.items[index]
    if (!item || item.audio) return
    const path = this.out.getPath()
    if (path !== 'electron' && path !== 'edge' && path !== 'puter') return
    item.audio = this.backend.synthesize(path, item.prepared, this.o.lang, this.abort.signal).catch(() => null)
  }

  private async waitForWork(): Promise<void> {
    if (this.cancelled || this.ended || this.started < this.items.length) return
    await new Promise<void>((resolve) => {
      this.wake = resolve
    })
  }

  private markStart(index: number, text: string): void {
    if (this.cancelled) return
    if (!this.audioStarted) {
      this.audioStarted = true
      this.o.onAudioStart?.(this.id)
    }
    this.o.onSentenceStart?.(this.id, index, text)
  }

  private async run(): Promise<void> {
    let stillOurs: () => boolean = () => true
    let claimed = false
    try {
      for (;;) {
        await this.waitForWork()
        if (this.cancelled) return
        if (this.started >= this.items.length) {
          if (this.ended) break
          continue
        }
        if (!claimed) {
          claimed = true
          stillOurs = await this.backend.claimChannel()
          if (this.cancelled) return
        }
        if (!stillOurs()) {
          this.cancel()
          return
        }
        const index = this.started
        const item = this.items[index]!
        this.started++
        this.prefetch(index)
        this.prefetch(index + 1)
        await this.speakItem(index, item)
      }
      this.finish('completed')
    } catch {
      if (!this.cancelled) this.finish('completed')
    }
  }

  private async speakItem(index: number, item: Item): Promise<void> {
    const path = this.out.getPath()
    if (path === 'silent') {
      this.markStart(index, item.raw)
      return
    }
    if ((path === 'electron' || path === 'edge' || path === 'puter') && item.audio) {
      const timeoutMs = this.o.neuralTimeoutMs ?? 4_500
      const t0 = now()
      const audio = await Promise.race([
        item.audio,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ])
      if (this.cancelled) return
      if (audio) {
        this.markStart(index, item.raw)
        try {
          await this.backend.play(audio, this.abort.signal)
        } catch {
          /* отмена или сбой одного клипа */
        }
        return
      }
      // Neural не успел/не смог — эта и следующие фразы системным голосом.
      void t0
      this.out.degradeToBrowser()
    }
    if (this.cancelled) return
    const handle = this.backend.speakBrowser(item.prepared, this.o.lang, () => this.markStart(index, item.raw))
    this.currentBrowserCancel = handle.cancel
    let startedByEvent = false
    const guard = setTimeout(() => {
      // Некоторые движки не шлют onstart — считаем, что фраза пошла.
      if (!startedByEvent) this.markStart(index, item.raw)
    }, 400)
    try {
      await handle.done
    } finally {
      startedByEvent = true
      clearTimeout(guard)
      if (this.currentBrowserCancel === handle.cancel) this.currentBrowserCancel = null
    }
  }
}

/* ------------------------------------------------------------ DOM backend */

/** Реальный backend для браузера/Electron. Модули грузятся лениво (Node-тесты их не трогают). */
export function createDomLiveSpeechBackend(): LiveSpeechBackend {
  type Mods = {
    text: typeof import('../../learnSpeechText')
    playback: typeof import('../../learnSpeechPlayback')
    browser: typeof import('../../learnSpeechBrowser')
    tts: typeof import('../../learnTeacherTtsClient')
    puter: typeof import('../../learnPuterTts')
    exclusive: typeof import('../../learnSpeechExclusive')
  }
  let mods: Mods | null = null
  const loading = Promise.all([
    import('../../learnSpeechText'),
    import('../../learnSpeechPlayback'),
    import('../../learnSpeechBrowser'),
    import('../../learnTeacherTtsClient'),
    import('../../learnPuterTts'),
    import('../../learnSpeechExclusive'),
  ]).then(([text, playback, browser, tts, puter, exclusive]) => {
    mods = { text, playback, browser, tts, puter, exclusive }
    return mods
  })
  const ready = async (): Promise<Mods> => mods ?? loading

  let voicesReady: Promise<void> | null = null
  return {
    ready() {
      voicesReady ??= loading.then((m) => m.browser.ensureVoicesLoaded(1200)).catch(() => undefined)
      return voicesReady
    },
    environment(lang) {
      if (!mods) return null
      const { browser, tts, puter } = mods
      const voice = browser.getBestBrowserVoice(lang)
      return {
        desktop: tts.isDesktopTeacherTtsAvailable(),
        edge: tts.isMicrosoftEdgeBrowser(),
        browserSupported: browser.isBrowserSpeechSupported(),
        browserVoices: voice ? 1 : 0,
        puterSignedIn: puter.isSmartAiOptedIn() && puter.isPuterSignedInSync(),
      }
    },
    prepare(text, lang) {
      if (!mods) return text
      return mods.text.prepareTextForHumanTts(text, lang)
    },
    async synthesize(path, text, lang, signal) {
      const m = await ready()
      if (path === 'electron') return m.tts.fetchViaDesktopElectron(text, lang, signal, 6_000)
      if (path === 'edge') return m.tts.fetchViaBrowserEdge(text, lang, signal, undefined, 6_000)
      return m.tts.fetchViaPuter(text, lang, signal)
    },
    async play(audio, signal) {
      const m = await ready()
      await m.playback.playNeuralAudioBase64(audio.audioBase64, audio.mimeType, signal)
    },
    speakBrowser(text, lang, onStart) {
      if (!mods) {
        return { done: Promise.resolve(), cancel: () => {} }
      }
      return mods.browser.speakBrowserSentence(text, lang, { onStart })
    },
    async claimChannel() {
      const m = await ready()
      const token = m.exclusive.isSpeechChannelCurrent(currentToken, 'learn') ? currentToken : m.exclusive.claimSpeechChannel('learn')
      currentToken = token
      // claimSpeechChannel повторно гасит speechSynthesis через setTimeout(0) — не стартуем раньше.
      await new Promise((resolve) => setTimeout(resolve, 12))
      await m.playback.unlockAudioPlayback().catch(() => undefined)
      return () => m.exclusive.isSpeechChannelCurrent(token, 'learn')
    },
    hardStop() {
      if (!mods) return
      mods.playback.stopNeuralPlayback()
      mods.browser.stopBrowserSpeech()
    },
  }
}

let currentToken = -1

/** Прогреть модули и голоса заранее (например, при открытии онлайн-урока). */
export async function warmLiveSpeech(lang: AssistantLang): Promise<void> {
  const [browser, text] = await Promise.all([import('../../learnSpeechBrowser'), import('../../learnSpeechText')])
  // Первый вызов подготовки текста компилирует сотни RegExp (формулы, ударения) — делаем это
  // заранее в простое, а не на первой фразе ответа.
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  const warmText = () => {
    try {
      text.prepareTextForHumanTts('Химия — наука о веществах: H2O, CO2 и NaCl (т. е. вода, газ и соль).', lang)
    } catch {
      /* прогрев необязателен */
    }
  }
  if (idle) idle(warmText, { timeout: 1500 })
  else setTimeout(warmText, 0)
  await browser.ensureVoicesLoaded(1200)
  browser.getBestBrowserVoice(lang)
}
