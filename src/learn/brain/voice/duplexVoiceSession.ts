/**
 * Duplex Voice Session — движок живого голосового разговора (бесплатно, в браузере).
 *
 *  • Слушаем непрерывно (Web Speech, continuous + interim) — промежуточный текст
 *    сразу уходит в UI (`onPartial`).
 *  • Быстрый конец реплики (TurnEndDetector): финальный результат STT (+220 мс) или
 *    ~650 мс тишины после речи по VAD.
 *  • Перебивание (барджин) включено по умолчанию (BargeInDetector): громкость выше
 *    порога ≥ 220 мс И не-эхо транскрипт → учитель замолкает сразу (<150 мс),
 *    реплика помечается «прервана», слушаем ученика. Эхо колонок отсекается
 *    echoCancellation микрофона и сравнением с фразами учителя (looksLikeTeacherEcho).
 *  • Речь учителя — фраза за фразой через LiveSpeechOutput (стриминг из LLM).
 *
 * Совместимость: speak / begin / end / markThinking / isAiSpeaking / getTurn
 * используются VoiceExamOrchestrator.
 */
import type { LearnSpeechController, LearnSpeechLocale } from '../../learnSpeech'
import type { AssistantLang } from '../brainTypes'
import { AudioActivityDetector } from './audioActivityDetector'
import { BargeInDetector, TurnEndDetector, realScheduler, type TimingScheduler, type TurnCommit } from './conversationTiming'
import { looksLikeAnyTeacherEcho, looksLikeTeacherEcho as looksLikeTeacherEchoImpl, sameUtterance } from './echoFilter'
import type { DialogTurn } from './interruptionController'
import { LiveSpeechOutput, type LiveTtsPath, type LiveUtterance } from './liveSpeechOutput'
import { splitIntoSentences } from './sentenceStream'

/** @deprecated импортируйте из ./echoFilter — оставлено для совместимости. */
export const looksLikeTeacherEcho = looksLikeTeacherEchoImpl

export interface BargeInEvent {
  text: string
  speechMs: number
  /** Сколько заняла остановка озвучки (мс). */
  stopLatencyMs: number
  source: 'voice' | 'manual' | 'typed'
}

export interface UserUtteranceMeta {
  reason: TurnCommit['reason'] | 'barge_in'
  /** Когда закончилась речь ученика (performance.now), если известно. */
  speechEndAt: number | null
  commitAt: number
  afterBargeIn: boolean
}

/** Минимальный интерфейс распознавания (внедряется в тестах). */
export interface RecognitionLike {
  start(
    locale: LearnSpeechLocale,
    session: { committed: string },
    onUpdate: (fullText: string, interimText: string) => void,
    onError?: (code: string, fatal: boolean) => void,
  ): boolean
  stop(): void
}

export interface VadLike {
  attach(stream: MediaStream): Promise<boolean>
  detach(): void
}

export interface DuplexSessionConfig {
  lang: AssistantLang
  controller: LearnSpeechController
  /** Перебивание голосом. По умолчанию ВКЛ (раньше было выключено). */
  bargeInEnabled?: boolean
  /** @deprecated больше не нужен: STT не выключается во время речи учителя. */
  postSpeakDelayMs?: number
  onPartial?: (text: string) => void
  onUserUtterance: (finalText: string, meta?: UserUtteranceMeta) => void
  onTurnChange?: (turn: DialogTurn) => void
  onAiSpeakingChange?: (speaking: boolean) => void
  onLevel?: (rms: number) => void
  onBargeIn?: (event: BargeInEvent) => void
  onSentenceStart?: (utteranceId: number, index: number, text: string) => void
  onAudioStart?: (utteranceId: number) => void
  onTtsPath?: (path: LiveTtsPath) => void
  onSttError?: (code: string, fatal: boolean) => void
  /* ---- внедрение зависимостей (тесты) ---- */
  speechOutput?: LiveSpeechOutput
  recognition?: RecognitionLike
  createVad?: (handlers: {
    onSpeechStart: () => void
    onSpeechEnd: (durationMs: number) => void
    onLevel: (rms: number, speaking: boolean) => void
  }) => VadLike
  scheduler?: TimingScheduler
  /** Тишина после речи (мс) до конца реплики. */
  silenceMs?: number
}

export type TeacherTurnOutcome = 'completed' | 'interrupted' | 'cancelled'

export interface TeacherTurnHandle {
  readonly utteranceId: number
  push(sentence: string): void
  end(): void
  /** Отменить без пометки «перебили» (например, ответ устарел). */
  cancel(): void
  readonly done: Promise<TeacherTurnOutcome>
  spokenCount(): number
}

function toSpeechLocale(lang: AssistantLang): LearnSpeechLocale {
  return lang
}

/** Сколько мс после речи учителя ещё считаем возможным «хвост эха». */
const ECHO_TAIL_MS = 1_600
/** Текст, распознанный после барджина, но уже закоммиченный из interim, — окно дедупликации. */
const INTERIM_SKIP_MS = 3_000
/** Короче — щелчок, а не речь. */
const VAD_MIN_SPEECH_MS = 90

export class DuplexVoiceSession {
  private readonly cfg: DuplexSessionConfig
  private readonly s: TimingScheduler
  private readonly output: LiveSpeechOutput
  private readonly recognition: RecognitionLike
  private readonly bargeIn: BargeInDetector
  private readonly turnEnd: TurnEndDetector
  private vad: VadLike | null = null
  private vadOk = false

  private readonly sttSession = { committed: '' }
  private consumedLen = 0
  private lastInterim = ''
  private listening = false
  private active = false
  private muted = false
  private aiSpeaking = false
  private turn: DialogTurn = 'idle'
  private bargeInEnabled: boolean

  private currentTurn: TeacherTurnImpl | null = null
  private teacherTexts: string[] = []
  private aiEndedAt = -Infinity
  private afterBargeIn = false
  private interimSkip: { text: string; at: number } | null = null
  private lastSpeechEndAt: number | null = null

  constructor(config: DuplexSessionConfig) {
    this.cfg = config
    this.s = config.scheduler ?? realScheduler
    this.bargeInEnabled = config.bargeInEnabled !== false
    this.output =
      config.speechOutput ??
      new LiveSpeechOutput({
        lang: config.lang,
        onPathChange: (p) => config.onTtsPath?.(p),
        onSentenceStart: (u, i, t) => config.onSentenceStart?.(u, i, t),
        onAudioStart: (u) => config.onAudioStart?.(u),
      })
    this.recognition = config.recognition ?? {
      start: (locale, session, onUpdate, onError) => config.controller.startOralListening(locale, session, onUpdate, onError),
      stop: () => config.controller.stopOralListening(),
    }
    this.bargeIn = new BargeInDetector({
      scheduler: this.s,
      minSpeechMs: 220,
      energyThreshold: 0.04,
      isEcho: (text) => this.isEcho(text),
      onBargeIn: (info) => this.fireBargeIn(info.text, info.speechMs, 'voice'),
    })
    this.turnEnd = new TurnEndDetector({
      scheduler: this.s,
      silenceMs: config.silenceMs ?? 450,
      finalSettleMs: 220,
      onCommit: (commit) => this.onTurnCommit(commit),
    })
  }

  /* ------------------------------------------------------------ lifecycle */

  /** Запустить сессию. Без микрофона (текстовый режим) работает только озвучка. */
  async begin(micStream: MediaStream | null): Promise<boolean> {
    this.active = true
    this.consumedLen = 0
    this.sttSession.committed = ''
    // teacherTexts не сбрасываем: ответ на набранный до старта текст может уже звучать (анти-эхо).
    void this.output.ready()
    if (!micStream) {
      this.bargeIn.setVadAvailable(false)
      this.turnEnd.setVadAvailable(false)
      return false
    }
    const handlers = {
      onSpeechStart: () => this.onVadSpeechStart(),
      onSpeechEnd: (durationMs: number) => this.onVadSpeechEnd(durationMs),
      onLevel: (rms: number) => {
        this.cfg.onLevel?.(rms)
        if (this.aiSpeaking && !this.muted) this.bargeIn.level(rms)
      },
    }
    this.vad = this.cfg.createVad
      ? this.cfg.createVad(handlers)
      : new AudioActivityDetector({
          startThreshold: 0.03,
          endThreshold: 0.016,
          silenceHangoverMs: 200,
          minSpeechMs: VAD_MIN_SPEECH_MS,
          ...handlers,
        })
    this.vadOk = await this.vad.attach(micStream)
    this.bargeIn.setVadAvailable(this.vadOk)
    this.turnEnd.setVadAvailable(this.vadOk)
    this.startStt()
    return this.vadOk
  }

  end(): void {
    this.active = false
    this.currentTurn?.cancelInternal('cancelled')
    this.currentTurn = null
    this.output.cancel()
    this.setAiSpeaking(false)
    this.stopStt()
    this.vad?.detach()
    this.vad = null
    this.turnEnd.reset()
    this.setTurn('idle')
  }

  /* ---------------------------------------------------------------- state */

  getTurn(): DialogTurn {
    return this.turn
  }

  isAiSpeaking(): boolean {
    return this.aiSpeaking
  }

  isMuted(): boolean {
    return this.muted
  }

  isVadAvailable(): boolean {
    return this.vadOk
  }

  getTtsPath(): LiveTtsPath {
    return this.output.getPath()
  }

  /** Есть незаконченная речь ученика (interim/final ещё не закоммичены). */
  hasPendingUserSpeech(): boolean {
    return this.turnEnd.isSpeaking() || this.turnEnd.pendingText().length > 0
  }

  setBargeInEnabled(on: boolean): void {
    this.bargeInEnabled = on
    this.bargeIn.setEnabled(on)
  }

  private setTurn(turn: DialogTurn): void {
    if (this.turn === turn) return
    this.turn = turn
    this.cfg.onTurnChange?.(turn)
  }

  private setAiSpeaking(v: boolean): void {
    if (this.aiSpeaking === v) return
    this.aiSpeaking = v
    this.bargeIn.setAiSpeaking(v)
    if (!v) this.aiEndedAt = this.s.now()
    this.cfg.onAiSpeakingChange?.(v)
  }

  /** Явно сообщить «я думаю» (пока идёт оценка/генерация). */
  markThinking(): void {
    if (!this.aiSpeaking) this.setTurn('thinking')
  }

  markIdle(): void {
    if (!this.aiSpeaking && this.turn === 'thinking') this.setTurn('idle')
  }

  /* ------------------------------------------------------------------ mic */

  setMuted(muted: boolean): void {
    if (this.muted === muted) return
    this.muted = muted
    if (muted) {
      this.stopStt()
      this.turnEnd.reset()
      this.cfg.onPartial?.('')
      if (this.turn === 'user_speaking') this.setTurn('idle')
    } else if (this.active) {
      this.skipBuffered()
      this.startStt()
    }
  }

  private startStt(): void {
    if (!this.active || this.listening || this.muted || !this.vad) return
    const ok = this.recognition.start(
      toSpeechLocale(this.cfg.lang),
      this.sttSession,
      (full, interim) => this.onSttUpdate(full, interim),
      (code, fatal) => {
        // Фатально (нет разрешения / сервиса распознавания) — голосом не слушаем, остаётся ввод текстом.
        if (fatal) this.listening = false
        this.cfg.onSttError?.(code, fatal)
      },
    )
    this.listening = ok
  }

  private stopStt(): void {
    if (!this.listening) return
    this.recognition.stop()
    this.listening = false
  }

  /** Всё уже распознанное считаем прочитанным (эхо, мусор до включения микрофона). */
  private skipBuffered(): void {
    this.consumedLen = this.sttSession.committed.length
    this.lastInterim = ''
  }

  private isEcho(text: string): boolean {
    return looksLikeAnyTeacherEcho(text, this.teacherTexts.slice(-6))
  }

  private freshFinal(full: string): string {
    return full.slice(Math.min(this.consumedLen, full.length)).trim()
  }

  private onSttUpdate(fullRaw: string, interimRaw: string): void {
    if (!this.active || this.muted) return
    // Полный текст берём из sttSession.committed: он растёт только вперёд и
    // переживает перезапуски распознавания.
    void fullRaw
    const interim = interimRaw.trim()
    let fresh = this.freshFinal(this.sttSession.committed)

    // Финал куска, который мы уже закоммитили из interim при барджине/тишине.
    if (this.interimSkip) {
      if (this.s.now() - this.interimSkip.at > INTERIM_SKIP_MS) {
        this.interimSkip = null
      } else if (fresh && sameUtterance(fresh, this.interimSkip.text)) {
        this.consumedLen = this.sttSession.committed.length
        this.interimSkip = null
        fresh = ''
      }
    }

    const pending = `${fresh} ${interim}`.replace(/\s+/g, ' ').trim()

    if (this.aiSpeaking) {
      if (!pending) return
      if (this.isEcho(pending)) {
        // Эхо озвучки: финальные куски сразу считаем прочитанными.
        if (fresh && this.isEcho(fresh)) this.consumedLen = this.sttSession.committed.length
        return
      }
      if (!this.bargeInEnabled) {
        if (fresh) this.consumedLen = this.sttSession.committed.length
        return
      }
      this.bargeIn.transcript(pending)
      return
    }

    // Хвост эха сразу после речи учителя.
    if (this.s.now() - this.aiEndedAt < ECHO_TAIL_MS && pending && this.isEcho(pending)) {
      if (fresh) this.consumedLen = this.sttSession.committed.length
      return
    }

    this.cfg.onPartial?.(pending)
    if (pending && this.turn !== 'user_speaking' && this.turn !== 'thinking') this.setTurn('user_speaking')
    if (interim !== this.lastInterim) {
      this.lastInterim = interim
      this.turnEnd.interim(interim)
    }
    if (fresh) this.turnEnd.final(fresh)
  }

  private onVadSpeechStart(): void {
    if (!this.active || this.muted) return
    if (this.aiSpeaking) return // барджин решает BargeInDetector по уровню + транскрипту
    this.turnEnd.speechStart()
  }

  private onVadSpeechEnd(durationMs = Infinity): void {
    if (!this.active || this.muted || this.aiSpeaking) return
    // Щелчок/стук короче минимальной речи: не «реплика», но и не зависаем в «говорит».
    if (durationMs >= VAD_MIN_SPEECH_MS) this.lastSpeechEndAt = this.s.now()
    this.turnEnd.speechEnd()
  }

  private onTurnCommit(commit: TurnCommit): void {
    const text = commit.text.trim()
    if (commit.usedInterim) this.interimSkip = { text: this.lastInterim || text, at: this.s.now() }
    this.consumedLen = this.sttSession.committed.length
    this.lastInterim = ''
    this.cfg.onPartial?.('')
    if (text.length < 2) return
    if (this.s.now() - this.aiEndedAt < ECHO_TAIL_MS * 2 && this.isEcho(text)) {
      if (this.turn === 'user_speaking') this.setTurn('idle')
      return
    }
    const meta: UserUtteranceMeta = {
      reason: commit.reason,
      speechEndAt: this.lastSpeechEndAt,
      commitAt: commit.at,
      afterBargeIn: this.afterBargeIn,
    }
    this.afterBargeIn = false
    this.lastSpeechEndAt = null
    this.setTurn('thinking')
    this.cfg.onUserUtterance(text, meta)
  }

  /* ------------------------------------------------------------- barge-in */

  private fireBargeIn(text: string, speechMs: number, source: BargeInEvent['source']): void {
    const t0 = this.s.now()
    const turn = this.currentTurn
    this.output.cancel()
    turn?.cancelInternal('interrupted')
    this.currentTurn = null
    this.setAiSpeaking(false)
    const stopLatencyMs = Math.round(this.s.now() - t0)
    if (source === 'voice') {
      // То, что ученик уже сказал, — начало его реплики.
      this.afterBargeIn = true
      this.aiEndedAt = -Infinity
      this.setTurn('user_speaking')
      this.turnEnd.speechStart()
      this.cfg.onPartial?.(text)
      const fresh = this.freshFinal(this.sttSession.committed)
      if (fresh && !this.isEcho(fresh)) this.turnEnd.final(fresh)
      else if (fresh) this.consumedLen = this.sttSession.committed.length
      if (this.lastInterim || text) this.turnEnd.interim(this.lastInterim || text)
      // Если VAD не увидит конца речи (тихо договорил) — страховка по тишине.
      this.s.setTimeout(() => {
        if (this.turnEnd.isSpeaking() && !this.aiSpeaking) this.turnEnd.speechEnd()
      }, 2_500)
    } else {
      this.skipBuffered()
      this.setTurn('idle')
    }
    this.cfg.onBargeIn?.({ text, speechMs, stopLatencyMs, source })
  }

  /**
   * «Перебить» кнопкой или набранным текстом: учитель замолкает сразу.
   * Возвращает true, если учитель говорил.
   */
  interrupt(source: 'manual' | 'typed' = 'manual'): boolean {
    if (!this.aiSpeaking && !this.currentTurn) return false
    this.fireBargeIn('', 0, source)
    return true
  }

  /* ------------------------------------------------------------ speaking */

  /** Начать реплику учителя; фразы добавляются по мере готовности (стриминг). */
  beginTeacherTurn(): TeacherTurnHandle {
    this.currentTurn?.cancelInternal('cancelled')
    const utterance = this.output.begin()
    const turn = new TeacherTurnImpl(utterance, {
      onFirstPush: () => {
        this.setAiSpeaking(true)
        this.setTurn('ai_speaking')
        // Всё, что STT успел накопить до речи учителя и не закоммитил, — не трогаем:
        // ученик может договаривать. Эхо отсечётся фильтром.
      },
      onSentence: (sentence) => {
        this.teacherTexts.push(sentence)
        if (this.teacherTexts.length > 24) this.teacherTexts.shift()
      },
      onDone: (outcome) => {
        if (this.currentTurn === turn) this.currentTurn = null
        if (outcome !== 'interrupted') {
          this.setAiSpeaking(false)
          if (this.turn === 'ai_speaking') this.setTurn('idle')
        }
      },
    })
    this.currentTurn = turn
    return turn
  }

  /**
   * Озвучить реплику целиком (фраза за фразой). true — договорил до конца,
   * false — перебили/отменили.
   */
  async speak(text: string): Promise<boolean> {
    const sentences = splitIntoSentences(text)
    if (sentences.length === 0) return false
    const turn = this.beginTeacherTurn()
    for (const s of sentences) turn.push(s)
    turn.end()
    return (await turn.done) === 'completed'
  }
}

class TeacherTurnImpl implements TeacherTurnHandle {
  readonly utteranceId: number
  readonly done: Promise<TeacherTurnOutcome>
  private resolve!: (o: TeacherTurnOutcome) => void
  private settled = false
  private pushed = 0
  private readonly utterance: LiveUtterance
  private readonly hooks: {
    onFirstPush: () => void
    onSentence: (s: string) => void
    onDone: (o: TeacherTurnOutcome) => void
  }

  constructor(
    utterance: LiveUtterance,
    hooks: { onFirstPush: () => void; onSentence: (s: string) => void; onDone: (o: TeacherTurnOutcome) => void },
  ) {
    this.utterance = utterance
    this.hooks = hooks
    this.utteranceId = utterance.id
    this.done = new Promise((resolve) => {
      this.resolve = resolve
    })
    void utterance.done.then((outcome) => this.settle(outcome === 'completed' ? 'completed' : 'cancelled'))
  }

  spokenCount(): number {
    return this.utterance.spokenCount()
  }

  push(sentence: string): void {
    if (this.settled) return
    const clean = sentence.trim()
    if (!clean) return
    if (this.pushed === 0) this.hooks.onFirstPush()
    this.pushed++
    this.hooks.onSentence(clean)
    this.utterance.push(clean)
  }

  end(): void {
    this.utterance.end()
  }

  cancel(): void {
    this.cancelInternal('cancelled')
  }

  cancelInternal(outcome: TeacherTurnOutcome): void {
    if (this.settled) return
    this.settle(outcome)
    this.utterance.cancel()
  }

  private settle(outcome: TeacherTurnOutcome): void {
    if (this.settled) return
    this.settled = true
    this.hooks.onDone(outcome)
    this.resolve(outcome)
  }
}
