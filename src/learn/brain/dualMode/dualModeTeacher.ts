/**
 * TeacherIntelligence — «Двухрежимный разум» ИИ-преподавателя химии (живой диалог).
 *
 * Связывает:
 *  • камеру  → EngagementTracker → UnifiedBrain (вовлечённость, мимика, честность);
 *  • микрофон → DuplexVoiceSession (непрерывное STT, быстрый конец реплики,
 *    перебивание голосом, озвучка фраза за фразой);
 *  • знания → TrainingModeEngine (стриминг «умного ИИ» или локальный ответ из базы);
 *  • экзамен → QuestionGenerator / ExamModeEngine (устные пулы 7–11 класса).
 *
 * Все входы ученика (голос, набранный текст, кнопки-команды) проходят через FIFO
 * TurnQueue и никогда не теряются — даже если учитель в этот момент говорит
 * приветствие, объявление режима или реплику по камере: новая реплика ученика
 * сразу прерывает речь учителя и обрабатывается по порядку.
 *
 *   TRAINING — наставник: короткие живые объяснения, follow-up «почему/пример/проще».
 *   EXAM     — строгий экзаменатор, правило «НЕТ ОТВЕТАМ», сократовский диалог.
 */
import type { LearnSpeechController } from '../../learnSpeech'
import { isSmartAiConnected } from '../../learnPuterChat'
import type { FusedContext, ReasoningStepSnapshot, VisionSignal, EmotionState } from '../brainTypes'
import { UnifiedBrain } from '../unifiedBrain'
import { EngagementTracker } from '../vision/engagementTracker'
import { DuplexVoiceSession, type BargeInEvent, type TeacherTurnHandle, type UserUtteranceMeta } from '../voice/duplexVoiceSession'
import type { DialogTurn } from '../voice/interruptionController'
import type { LiveTtsPath } from '../voice/liveSpeechOutput'
import { splitIntoSentences } from '../voice/sentenceStream'
import { TurnQueue, type TurnInput, type TurnInputKind } from '../voice/turnQueue'
import { ConversationStateManager, type ConversationSnapshot } from './conversationStateManager'
import { ExamModeEngine } from './examModeEngine'
import { isSubstantiveQuestion } from './followUps'
import { QuestionGenerator } from './questionGenerator'
import { TrainingModeEngine } from './trainingModeEngine'
import { parseVoiceIntent } from './intentParser'
import { personaForMode, switchAnnouncement } from './personaProfiles'
import { emotionReactiveLine, reengageReactiveLine } from './cameraEmotionCoach'
import type {
  AssistantLang,
  LiveTurnMetrics,
  QuestionCard,
  QueuedStudentTurn,
  TeacherReplyOrigin,
  TeacherResponse,
  TutorMode,
  TutorPersona,
  VoiceIntent,
} from './dualModeTypes'

export interface TeacherDraft {
  turnId: number
  text: string
  source: TeacherReplyOrigin
}

export interface DualModeTeacherCallbacks {
  /** Итоговая реплика учителя (текст для чата). При стриминге приходит после черновиков. */
  onResponse?: (response: TeacherResponse) => void
  /** Черновик реплики учителя, пока «умный ИИ» пишет ответ (тот же turnId, что у onResponse). */
  onTeacherDraft?: (draft: TeacherDraft) => void
  /** Ученик перебил учителя (голосом, кнопкой или набранным текстом). */
  onTeacherInterrupted?: (info: { turnId: number | null; source: BargeInEvent['source']; stopLatencyMs: number }) => void
  onModeChange?: (mode: TutorMode, persona: TutorPersona) => void
  onEngagement?: (fused: FusedContext) => void
  onPartialTranscript?: (text: string) => void
  /** Реплика ученика принята в обработку (для ленты диалога). */
  onStudentUtterance?: (text: string, info?: { id: number; kind: TurnInputKind }) => void
  onTurnChange?: (turn: DialogTurn) => void
  onSpeakingChange?: (speaking: boolean) => void
  /** Учитель «думает» над ответом (ищет знания / ждёт LLM). */
  onThinkingChange?: (thinking: boolean) => void
  onStateChange?: (snapshot: ConversationSnapshot) => void
  /** Громкость микрофона (RMS 0..1) ~30 раз/с — для индикатора уровня в UI. */
  onMicLevel?: (rms: number) => void
  /** Очередь реплик ученика изменилась. */
  onQueueChange?: (pending: QueuedStudentTurn[]) => void
  /** Учитель начал произносить фразу `index` реплики `turnId`. */
  onSpokenSentence?: (turnId: number, index: number, text: string) => void
  onMetrics?: (metrics: LiveTurnMetrics) => void
  onTtsPath?: (path: LiveTtsPath) => void
  /** Ошибка распознавания речи; fatal — голосом больше не слушаем (нет разрешения/сервиса). */
  onSttError?: (code: string, fatal: boolean) => void
}

export interface DualModeTeacherConfig {
  lang: AssistantLang
  gradeId: string
  chapterId: string
  sectionTitle?: string
  sectionId?: string
  studentId: string
  studentName?: string | null
  /** Список тем экзамена (для очереди «следующая тема»). */
  topics?: string[]
  initialMode?: TutorMode
  useAiGrading?: boolean
  controller: LearnSpeechController
  callbacks?: DualModeTeacherCallbacks
  /** Для тестов: готовая сессия голоса. */
  duplex?: DuplexVoiceSession
}

/** Команды кнопок (не распознаются по тексту — приходят явно). */
export type TeacherCommand = 'ask_another' | 'next_topic' | 'mode:training' | 'mode:exam' | 'repeat'

const PROACTIVE_COOLDOWN_MS = 14_000
const REENGAGE_COOLDOWN_MS = 11_000
const EMOTION_COOLDOWN_MS = 16_000
/** Ученик договаривает мысль после паузы: склеиваем, если ответ ещё не зазвучал. */
const CONTINUATION_WINDOW_MS = 2_600

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function isAbort(error: unknown): boolean {
  return (error as DOMException)?.name === 'AbortError'
}

type TurnTrack = {
  turnId: number
  item: TurnInput
  startedAt: number
  commitAt: number
  speechEndAt: number | null
  firstSentenceAt: number | null
  firstAudioAt: number | null
  source: TeacherReplyOrigin
  abort: AbortController
  abortSource: BargeInEvent['source']
}

export class TeacherIntelligence {
  private readonly cfg: DualModeTeacherConfig
  private readonly lang: AssistantLang
  private persona: TutorPersona
  private readonly state: ConversationStateManager
  private readonly generator: QuestionGenerator
  private readonly training: TrainingModeEngine
  private readonly exam: ExamModeEngine
  private readonly brain: UnifiedBrain
  private readonly queue: TurnQueue
  private readonly duplex: DuplexVoiceSession

  private tracker: EngagementTracker | null = null
  private unsubscribeFused: (() => void) | null = null
  private micAttached = false

  private currentCard: QuestionCard | null = null
  private attempt = 0
  private running = false
  /** stop() уже вызван — новые реплики не принимаем. */
  private stopped = false
  /** Сколько реплик ученика принято (приветствие не нужно, если ученик уже заговорил). */
  private studentTurns = 0
  private started = false
  private thinking = false
  private lastProactiveMs = 0
  private lastReengageMs = 0
  private lastEmotionReactMs = 0
  private lastFusedEmotion: EmotionState = 'neutral'

  private teacherTurnSeq = 0
  private current: TurnTrack | null = null
  private readonly turnByUtterance = new Map<number, number>()
  private readonly waiters = new Map<number, (r: TeacherResponse) => void>()
  private readonly previousQuestions: string[] = []
  private lastTeacherSay = ''
  private speakingTurnId: number | null = null
  private proactive: { turnId: number; handle: Promise<boolean> } | null = null

  constructor(config: DualModeTeacherConfig) {
    this.cfg = config
    this.lang = config.lang
    const initialMode = config.initialMode ?? 'training'
    this.persona = personaForMode(initialMode)
    this.state = new ConversationStateManager(initialMode, config.topics ?? [])
    this.generator = new QuestionGenerator({
      gradeId: config.gradeId,
      chapterId: config.chapterId,
      sectionId: config.sectionId,
      lang: config.lang,
    })
    this.training = new TrainingModeEngine({
      lang: config.lang,
      gradeId: config.gradeId,
      chapterId: config.chapterId,
      sectionId: config.sectionId,
      sectionTitle: config.sectionTitle,
    })
    this.exam = new ExamModeEngine({
      lang: config.lang,
      generator: this.generator,
      useAiGrading: config.useAiGrading,
      gradeId: config.gradeId,
      chapterId: config.chapterId,
    })
    this.brain = new UnifiedBrain({
      studentId: config.studentId,
      lang: config.lang,
      studentName: config.studentName ?? null,
      useAiGrading: config.useAiGrading,
    })
    this.queue = new TurnQueue({
      handler: (item) => this.processTurn(item),
      coalesceVoiceMs: 1_200,
      onError: () => this.setThinking(false),
      onChange: (pending) => this.cfg.callbacks?.onQueueChange?.(pending.map((p) => this.queuedView(p))),
    })
    const cb = () => this.cfg.callbacks
    this.duplex =
      config.duplex ??
      new DuplexVoiceSession({
        lang: this.lang,
        controller: config.controller,
        bargeInEnabled: true,
        onPartial: (t) => cb()?.onPartialTranscript?.(t),
        onUserUtterance: (text, meta) => {
          void this.enqueue('voice', text, { speech: meta })
        },
        onTurnChange: (turn) => cb()?.onTurnChange?.(turn),
        onAiSpeakingChange: (s) => {
          if (!s) this.speakingTurnId = null
          cb()?.onSpeakingChange?.(s)
        },
        onLevel: (rms) => cb()?.onMicLevel?.(rms),
        onBargeIn: (ev) => this.onBargeIn(ev),
        onSentenceStart: (utteranceId, index, text) => {
          const turnId = this.turnByUtterance.get(utteranceId)
          if (turnId == null) return
          this.speakingTurnId = turnId
          cb()?.onSpokenSentence?.(turnId, index, text)
        },
        onAudioStart: (utteranceId) => this.onAudioStart(utteranceId),
        onTtsPath: (p) => cb()?.onTtsPath?.(p),
        onSttError: (code, fatal) => cb()?.onSttError?.(code, fatal),
      })
  }

  // ---------------------------------------------------------------- lifecycle

  /** Запуск: подключает камеру и микрофон, начинает вести диалог. */
  async start(video: HTMLVideoElement | null, micStream: MediaStream | null): Promise<void> {
    if (this.stopped || this.started) return
    this.started = true
    this.running = true

    if (video) this.attachVision(video)
    this.unsubscribeFused = this.brain.onFused((fused) => this.handleEngagement(fused))

    this.micAttached = Boolean(micStream)
    await this.duplex.begin(micStream)
    if (!this.running) return

    // Первая реплика — только если ученик ещё ничего не сказал/не написал
    // (набранный до старта текст уже в очереди и обрабатывается).
    if (this.queue.isBusy() || this.studentTurns > 0) return
    if (this.state.getMode() === 'exam') {
      await this.enqueue('command', 'ask_another', { silentStudent: true, label: '' })
    } else {
      await this.speakProactive(this.buildResponse(this.greeting(), null, null, false))
    }
  }

  /** Подключить камеру позже (диалог уже идёт — не ждём MediaStream видео). */
  attachVision(video: HTMLVideoElement): void {
    if (!this.running || !video) return
    this.tracker?.stop()
    this.tracker = new EngagementTracker(video, {
      fps: 6,
      onSignal: (sig: VisionSignal) => this.brain.ingestVision(sig),
    })
    this.tracker.start()
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    const wasStarted = this.started
    this.running = false
    this.queue.close()
    this.current?.abort.abort()
    this.tracker?.stop()
    this.tracker = null
    this.duplex.end()
    this.unsubscribeFused?.()
    this.unsubscribeFused = null
    this.setThinking(false)
    for (const [, resolve] of this.waiters) resolve(this.buildResponse('', this.currentCard, null, true))
    this.waiters.clear()
    if (!wasStarted) return
    const topic = this.state.currentTopic() ?? this.cfg.sectionTitle ?? 'chemistry'
    void this.brain.endSession(topic, null)
  }

  isRunning(): boolean {
    return this.running
  }

  /** Сессия ещё принимает реплики (до start() тоже — ничего не теряется, пока открывается микрофон). */
  isAcceptingInput(): boolean {
    return !this.stopped
  }

  /** Пауза микрофона из UI (диалог и камера продолжают работать). */
  setMicMuted(muted: boolean): void {
    this.duplex.setMuted(muted)
  }

  /** «Перебить / стоп»: учитель замолкает сразу, недоговорённый ответ отменяется. */
  interrupt(): boolean {
    const wasSpeaking = this.duplex.interrupt('manual')
    if (this.current) {
      this.current.abortSource = 'manual'
      this.current.abort.abort()
    }
    return wasSpeaking
  }

  getTtsPath(): LiveTtsPath {
    return this.duplex.getTtsPath()
  }

  // -------------------------------------------------------------- mode switch

  getMode(): TutorMode {
    return this.state.getMode()
  }

  getPersona(): TutorPersona {
    return this.persona
  }

  snapshot(): ConversationSnapshot {
    return this.state.snapshot()
  }

  /** Переключение режима (через очередь — не пересекается с ответом). */
  setMode(mode: TutorMode): Promise<TeacherResponse> {
    return this.enqueue('command', `mode:${mode}`, { silentStudent: true, label: '' })
  }

  // ------------------------------------------------------------------- inputs

  /**
   * Единый вход речи/текста ученика. Реплика ставится в FIFO-очередь; если учитель
   * говорит — он сразу замолкает. Промис завершается ответом учителя.
   */
  handleIncomingVoice(transcript: string, mode?: TutorMode): Promise<TeacherResponse> {
    if (mode && mode !== this.state.getMode()) void this.setMode(mode)
    return this.enqueue('voice', transcript)
  }

  /** Набранный текст ученика. */
  sendText(text: string): Promise<TeacherResponse> {
    return this.enqueue('text', text)
  }

  /** Кнопка-команда («ещё вопрос», «следующая тема»…). */
  sendCommand(command: TeacherCommand, label = ''): Promise<TeacherResponse> {
    return this.enqueue('command', command, { label })
  }

  private queuedView(item: TurnInput): QueuedStudentTurn {
    const label = typeof item.meta?.label === 'string' && item.meta.label ? item.meta.label : item.text
    return { id: item.id, kind: item.kind, text: item.text, label }
  }

  private enqueue(kind: TurnInputKind, text: string, meta?: Record<string, unknown>): Promise<TeacherResponse> {
    const clean = text.trim()
    if (!clean || this.stopped) return Promise.resolve(this.buildResponse('', this.currentCard, null, false))

    // Ученик договаривает мысль голосом, а ответ ещё не зазвучал — отвечаем на всю фразу.
    const cur = this.current
    if (
      kind === 'voice' &&
      cur &&
      cur.item.kind === 'voice' &&
      cur.firstAudioAt === null &&
      now() - cur.commitAt < CONTINUATION_WINDOW_MS
    ) {
      cur.abort.abort()
      const merged = `${cur.item.text} ${clean}`
      const item = this.queue.enqueue('voice', merged, { ...meta, continuation: true })
      return this.waitFor(item)
    }

    const startup = Boolean(meta?.silentStudent) && !cur && !this.duplex.isAiSpeaking()
    // Новая реплика ученика важнее текущей речи учителя: прерываем сразу
    // (голос во время речи учителя сюда попадает уже после барджина).
    // ВАЖНО: прерываем ДО постановки в очередь — очередь запускает обработчик
    // синхронно, и `this.current` после enqueue — это уже новый ход, а не старый.
    if (!startup && (kind !== 'voice' || this.duplex.isAiSpeaking())) {
      if (this.duplex.isAiSpeaking()) this.duplex.interrupt('typed')
      if (cur) {
        cur.abortSource = 'typed'
        cur.abort.abort()
      }
    }
    const item = this.queue.enqueue(kind, clean, meta)
    return this.waitFor(item)
  }

  private waitFor(item: TurnInput | null): Promise<TeacherResponse> {
    if (!item) return Promise.resolve(this.buildResponse('', this.currentCard, null, false))
    return new Promise((resolve) => {
      const prev = this.waiters.get(item.id)
      this.waiters.set(item.id, (r) => {
        prev?.(r)
        resolve(r)
      })
    })
  }

  private settleWaiter(item: TurnInput, response: TeacherResponse): void {
    const w = this.waiters.get(item.id)
    this.waiters.delete(item.id)
    w?.(response)
  }

  private setThinking(on: boolean): void {
    if (this.thinking === on) return
    this.thinking = on
    if (on) this.duplex.markThinking()
    else this.duplex.markIdle()
    this.cfg.callbacks?.onThinkingChange?.(on)
  }

  // --------------------------------------------------------------- processing

  private intentFor(item: TurnInput): VoiceIntent {
    if (item.kind === 'command') {
      const cmd = item.text
      if (cmd === 'ask_another') return { kind: 'next_question' }
      if (cmd === 'next_topic') return { kind: 'next_topic' }
      if (cmd === 'repeat') return { kind: 'repeat' }
      if (cmd === 'mode:exam') return { kind: 'switch_mode', target: 'exam' }
      if (cmd === 'mode:training') return { kind: 'switch_mode', target: 'training' }
    }
    return parseVoiceIntent(item.text, this.lang)
  }

  private async processTurn(item: TurnInput): Promise<void> {
    if (this.stopped) return
    if (!item.meta?.silentStudent) this.studentTurns++
    // Всё, что учитель ещё говорил (приветствие, камера), — замолкает.
    if (this.duplex.isAiSpeaking()) this.duplex.interrupt('typed')

    const speech = item.meta?.speech as UserUtteranceMeta | undefined
    const track: TurnTrack = {
      turnId: ++this.teacherTurnSeq,
      item,
      startedAt: now(),
      commitAt: speech?.commitAt ?? now(),
      speechEndAt: speech?.speechEndAt ?? null,
      firstSentenceAt: null,
      firstAudioAt: null,
      source: 'system',
      abort: new AbortController(),
      abortSource: 'manual',
    }
    this.current = track

    const silent = Boolean(item.meta?.silentStudent)
    if (!silent) {
      this.state.pushTurn('student', item.kind === 'command' ? String(item.meta?.label || item.text) : item.text)
      this.cfg.callbacks?.onStudentUtterance?.(
        item.kind === 'command' ? String(item.meta?.label || item.text) : item.text,
        { id: item.id, kind: item.kind },
      )
    }

    let response: TeacherResponse = this.buildResponse('', this.currentCard, null, false)
    this.setThinking(true)
    try {
      const intent = this.intentFor(item)
      switch (intent.kind) {
        case 'hush':
          break
        case 'switch_mode':
          response = await this.switchMode(intent.target, track)
          break
        case 'stop':
          response = this.buildResponse(this.byeLine(), null, null, true)
          await this.deliver(response, track)
          this.stop()
          break
        case 'next_topic':
          response = await this.advanceTopic()
          await this.deliver(response, track)
          break
        case 'next_question':
          response = await this.buildNextQuestionResponse()
          await this.deliver(response, track)
          break
        case 'repeat':
          response = this.repeatLine()
          await this.deliver(response, track)
          break
        case 'explain':
        case 'answer':
        default:
          if (this.state.getMode() === 'exam') {
            response =
              intent.kind === 'explain'
                ? this.examNoExplain()
                : await this.evaluateResponse(item.text, this.currentTopic(), this.state.getDifficulty())
            await this.deliver(response, track)
          } else {
            response = await this.answerTraining(item, track)
          }
          break
      }
    } catch (error) {
      if (!isAbort(error)) {
        response = this.buildResponse(this.fallbackLine(), null, null, false)
        await this.deliver(response, track).catch(() => undefined)
      }
    } finally {
      if (this.current === track) this.current = null
      this.setThinking(false)
      this.settleWaiter(item, response)
    }
  }

  private async answerTraining(item: TurnInput, track: TurnTrack): Promise<TeacherResponse> {
    const signal = track.abort.signal
    let handle: TeacherTurnHandle | null = null
    let draft = ''
    const smart = isSmartAiConnected()
    track.source = smart ? 'smart' : 'local'
    // История без текущей реплики ученика (она добавлена в processTurn).
    const history = this.state.history(9).slice(0, -1)

    const openHandle = (): TeacherTurnHandle => {
      if (handle) return handle
      const h = this.duplex.beginTeacherTurn()
      this.turnByUtterance.set(h.utteranceId, track.turnId)
      handle = h
      return h
    }

    try {
      const res = await this.training.answer({
        text: item.text,
        history,
        previousQuestions: this.previousQuestions.slice(-4),
        emotion: this.lastFusedEmotion,
        signal,
        smartAi: smart,
        onSentence: (sentence) => {
          if (signal.aborted) return
          if (track.firstSentenceAt === null) track.firstSentenceAt = now()
          this.setThinking(false)
          openHandle().push(sentence)
        },
        onText: (text) => {
          if (signal.aborted) return
          draft = text
          this.cfg.callbacks?.onTeacherDraft?.({ turnId: track.turnId, text, source: track.source })
        },
      })
      track.source = res.source
      if (res.resolved.repeatLast && this.lastTeacherSay) {
        // «Повтори» без новой темы — повторяем последнюю реплику учителя дословно.
        const h = handle as TeacherTurnHandle | null
        h?.cancel()
        handle = null
        const repeat = this.buildResponse(this.lastTeacherSay, null, null, false)
        await this.deliver(repeat, track)
        return repeat
      }
      if (isSubstantiveQuestion(item.text)) {
        this.previousQuestions.push(res.resolved.query)
        if (this.previousQuestions.length > 12) this.previousQuestions.shift()
      }
      const response = this.buildResponse(res.display, null, null, false)
      response.turnId = track.turnId
      response.source = res.source
      response.citations = res.citations
      this.state.pushTurn('tutor', res.text)
      this.lastTeacherSay = res.text
      this.cfg.callbacks?.onResponse?.(response)

      const h = openHandle()
      h.end()
      await h.done
      this.emitMetrics(track, res.timings.knowledgeMs, res.timings.firstTokenMs, res.fellBack)
      return response
    } catch (error) {
      const h = handle as TeacherTurnHandle | null
      h?.cancel()
      if (isAbort(error) && draft.trim()) {
        // Ответ прервали на середине — оставляем в ленте то, что успело появиться.
        const partial = this.buildResponse(draft, null, null, false)
        partial.turnId = track.turnId
        partial.source = track.source
        this.state.pushTurn('tutor', draft)
        this.cfg.callbacks?.onResponse?.(partial)
        this.cfg.callbacks?.onTeacherInterrupted?.({ turnId: track.turnId, source: track.abortSource, stopLatencyMs: 0 })
      }
      throw error
    }
  }

  private onBargeIn(ev: BargeInEvent): void {
    const turnId = this.speakingTurnId ?? this.proactive?.turnId ?? null
    this.speakingTurnId = null
    // Голосом перебили, пока «умный ИИ» ещё пишет ответ — дальше не генерируем.
    if (ev.source === 'voice' && this.current && this.current.item.kind !== 'command') this.current.abort.abort()
    this.cfg.callbacks?.onTeacherInterrupted?.({ turnId, source: ev.source, stopLatencyMs: ev.stopLatencyMs })
  }

  private onAudioStart(utteranceId: number): void {
    const turnId = this.turnByUtterance.get(utteranceId)
    const track = this.current
    if (track && turnId === track.turnId && track.firstAudioAt === null) track.firstAudioAt = now()
  }

  private emitMetrics(track: TurnTrack, knowledgeMs: number | null, firstTokenMs: number | null, fellBack: boolean): void {
    const ms = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.max(0, Math.round(a - b)))
    this.cfg.callbacks?.onMetrics?.({
      turnId: track.turnId,
      inputKind: track.item.kind,
      commitReason: (track.item.meta?.speech as UserUtteranceMeta | undefined)?.reason,
      speechEndToCommitMs: ms(track.commitAt, track.speechEndAt),
      commitToFirstSentenceMs: ms(track.firstSentenceAt, track.commitAt),
      commitToFirstAudioMs: ms(track.firstAudioAt, track.commitAt),
      speechEndToFirstAudioMs: ms(track.firstAudioAt, track.speechEndAt),
      knowledgeMs,
      firstTokenMs,
      totalMs: ms(now(), track.commitAt),
      source: track.source,
      fellBack,
    })
  }

  // --------------------------------------------------------------- evaluation

  /**
   * Оценка ответа ученика в экзамене. НИКОГДА не раскрывает решение —
   * возвращает сократовский наводящий вопрос.
   */
  async evaluateResponse(answer: string, topic: string, difficulty: number): Promise<TeacherResponse> {
    void difficulty // сложность учитывает QuestionGenerator при выборе следующего вопроса
    if (this.state.getMode() === 'training') {
      const text = await this.training.explainAsync(answer, topic, this.state.history(), this.lastFusedEmotion)
      return this.buildResponse(text, this.currentCard, null, false)
    }

    const card = this.currentCard
    if (!card) return this.buildNextQuestionResponse()

    this.attempt += 1
    let reasoning: ReasoningStepSnapshot[] = []
    let grade
    try {
      const evalResult = await this.brain.evaluateAnswer(answer)
      grade = evalResult.grade
      reasoning = evalResult.decision.reasoning
    } catch {
      grade = undefined
    }

    const examEval = grade ? this.exam.respond(grade, card, this.attempt) : await this.exam.evaluate(answer, card, this.attempt)

    this.state.recordResult(card.topic, card.id, examEval.grade.verdict)
    this.cfg.callbacks?.onStateChange?.(this.state.snapshot())

    if (examEval.passed) {
      const next = await this.buildNextQuestionResponse(examEval.say)
      next.reasoning = reasoning
      next.verdict = examEval.grade.verdict
      return next
    }

    const resp = this.buildResponse(examEval.say, card, examEval.grade.verdict, false)
    resp.reasoning = reasoning
    return resp
  }

  /** Следующий вопрос по теме с учётом «проблемных зон» ученика. */
  generateNextQuestion(topic: string, previousMistakes: string[]): QuestionCard | null {
    const asked = this.state.snapshot().progress.find((p) => p.topic === topic)?.askedIds ?? []
    return this.generator.generateNextQuestion(topic, previousMistakes, this.state.getDifficulty(), asked)
  }

  /** Постоянный CV-мониторинг: текущий сведённый контекст вовлечённости. */
  analyzeCameraEngagement(): FusedContext {
    return this.brain.fusedNow()
  }

  // ------------------------------------------------------------------ private

  private examNoExplain(): TeacherResponse {
    const card = this.currentCard
    const nudge =
      this.lang === 'en'
        ? 'In exam mode I cannot explain. Try to reason it out yourself.'
        : this.lang === 'uz'
          ? 'Imtihon rejimida tushuntira olmayman. O‘zingiz fikrlab ko‘ring.'
          : 'В режиме экзамена я не подсказываю. Попробуй рассуждать сам.'
    const socratic = card ? ` ${this.generator.socraticFollowUp(card, this.attempt + 1)}` : ''
    return this.buildResponse(`${nudge}${socratic}`.trim(), card, null, false)
  }

  private async switchMode(mode: TutorMode, track: TurnTrack): Promise<TeacherResponse> {
    if (mode === this.state.getMode()) return this.buildResponse('', this.currentCard, null, false)
    this.state.setMode(mode)
    this.persona = personaForMode(mode)
    this.currentCard = null
    this.attempt = 0
    this.cfg.callbacks?.onModeChange?.(mode, this.persona)
    this.cfg.callbacks?.onStateChange?.(this.state.snapshot())

    const announcement = switchAnnouncement(this.lang, mode)
    const resp = mode === 'exam' ? await this.buildNextQuestionResponse(announcement) : this.buildResponse(announcement, null, null, false)
    await this.deliver(resp, track)
    return resp
  }

  private async advanceTopic(): Promise<TeacherResponse> {
    const next = this.state.nextTopic()
    this.cfg.callbacks?.onStateChange?.(this.state.snapshot())
    if (!next) {
      if (this.state.getMode() === 'exam') return this.buildNextQuestionResponse(this.allTopicsDoneLine())
      return this.buildResponse(this.allTopicsDoneLine(), null, null, false)
    }
    if (this.state.getMode() === 'exam') return this.buildNextQuestionResponse()
    const invite =
      this.lang === 'en'
        ? `New topic: ${next}. What would you like to know about it?`
        : this.lang === 'uz'
          ? `Yangi mavzu: ${next}. Bu haqda nimani bilmoqchisiz?`
          : `Новая тема: ${next}. Что хочешь узнать о ней?`
    return this.buildResponse(invite, null, null, false)
  }

  /** Подобрать и «задать» новый вопрос экзамена (с необязательным префиксом). */
  private async buildNextQuestionResponse(prefix = ''): Promise<TeacherResponse> {
    await this.generator.ready()
    const topic = this.currentTopic()
    const mistakes = this.state.problemZones(topic)
    const card = this.generateNextQuestion(topic, mistakes)
    if (!card) {
      return this.buildResponse(`${prefix} ${this.noQuestionsLine()}`.trim(), null, null, this.state.getMode() === 'exam')
    }
    this.currentCard = card
    this.attempt = 0
    this.state.markAsked(card.topic, card.id)
    this.brain.setActiveQuestion({
      question: card.speak,
      rubric: card.rubric,
      sampleAnswer: card.sampleAnswer,
      topic: card.topic,
    })
    this.cfg.callbacks?.onStateChange?.(this.state.snapshot())
    const say = prefix ? `${prefix} ${card.speak}`.trim() : card.speak
    return this.buildResponse(say, card, null, false)
  }

  private repeatLine(): TeacherResponse {
    if (this.state.getMode() === 'exam' && this.currentCard) {
      return this.buildResponse(this.currentCard.speak, this.currentCard, null, false)
    }
    if (this.lastTeacherSay) return this.buildResponse(this.lastTeacherSay, this.currentCard, null, false)
    const line =
      this.lang === 'en'
        ? 'There is nothing to repeat yet.'
        : this.lang === 'uz'
          ? 'Hozircha takrorlaydigan narsa yo‘q.'
          : 'Пока нечего повторять.'
    return this.buildResponse(line, null, null, false)
  }

  /** Реакция на камеру: эмоции + внимание — только когда в разговоре пауза. */
  private handleEngagement(fused: FusedContext): void {
    this.cfg.callbacks?.onEngagement?.(fused)
    this.lastFusedEmotion = fused.emotion
    if (!this.running || this.thinking || this.queue.isBusy()) return
    if (this.duplex.isAiSpeaking() || this.duplex.hasPendingUserSpeech()) return
    if (this.duplex.getTurn() !== 'idle') return

    const t = Date.now()

    if (
      (fused.engagement === 'distracted' || fused.engagement === 'absent') &&
      fused.emotion !== 'bored' &&
      fused.emotion !== 'tired' &&
      t - this.lastReengageMs > REENGAGE_COOLDOWN_MS
    ) {
      this.lastReengageMs = t
      const line = reengageReactiveLine(this.lang, this.state.getMode(), t)
      const say = this.currentCard ? `${line} ${this.currentCard.speak}` : line
      void this.speakProactive(this.buildResponse(say, this.currentCard, null, false))
      return
    }

    if (
      this.state.getMode() === 'training' &&
      this.persona.proactiveClarify &&
      fused.emotionConfidence >= 0.38 &&
      fused.emotion !== 'neutral' &&
      t - this.lastEmotionReactMs > EMOTION_COOLDOWN_MS &&
      t - this.lastProactiveMs > PROACTIVE_COOLDOWN_MS
    ) {
      const line = emotionReactiveLine(this.lang, fused.emotion, t)
      if (!line) return
      this.lastEmotionReactMs = t
      this.lastProactiveMs = t
      const last = this.previousQuestions[this.previousQuestions.length - 1]
      if (fused.emotion === 'confused' && last) {
        void this.training.simplerExplanation(last).then((alt) => {
          if (!this.running || this.queue.isBusy() || this.duplex.isAiSpeaking()) return
          void this.speakProactive(this.buildResponse(alt ? `${line} ${alt}` : line, this.currentCard, null, false))
        })
        return
      }
      void this.speakProactive(this.buildResponse(line, this.currentCard, null, false))
    }
  }

  private buildResponse(
    say: string,
    question: QuestionCard | null,
    verdict: TeacherResponse['verdict'],
    finished: boolean,
  ): TeacherResponse {
    return {
      mode: this.state.getMode(),
      say: say.trim(),
      reasoning: [],
      question,
      verdict,
      topic: this.currentTopic(),
      finished,
      source: 'system',
    }
  }

  /** Озвучить служебную/экзаменационную реплику целиком в рамках хода ученика. */
  private async deliver(response: TeacherResponse, track: TurnTrack): Promise<void> {
    response.turnId ??= track.turnId
    if (response.say) {
      this.state.pushTurn('tutor', response.say)
      if (response.question || this.state.getMode() === 'training') this.lastTeacherSay = response.say
    }
    this.cfg.callbacks?.onResponse?.(response)
    const speakText = (response.saySpeak ?? response.say).trim()
    if (!speakText || track.abort.signal.aborted) return
    this.setThinking(false)
    const handle = this.duplex.beginTeacherTurn()
    this.turnByUtterance.set(handle.utteranceId, track.turnId)
    track.firstSentenceAt ??= now()
    for (const s of splitIntoSentences(speakText)) handle.push(s)
    handle.end()
    const onAbort = () => handle.cancel()
    track.abort.signal.addEventListener('abort', onAbort, { once: true })
    try {
      await handle.done
    } finally {
      track.abort.signal.removeEventListener('abort', onAbort)
    }
    this.emitMetrics(track, null, null, false)
  }

  /** Реплика по инициативе учителя (приветствие, камера) — не блокирует очередь ученика. */
  private async speakProactive(response: TeacherResponse): Promise<void> {
    if (!this.running) return
    const turnId = ++this.teacherTurnSeq
    response.turnId = turnId
    if (response.say) {
      this.state.pushTurn('tutor', response.say)
    }
    this.cfg.callbacks?.onResponse?.(response)
    const speakText = (response.saySpeak ?? response.say).trim()
    if (!speakText) return
    const handle = this.duplex.beginTeacherTurn()
    this.turnByUtterance.set(handle.utteranceId, turnId)
    for (const s of splitIntoSentences(speakText)) handle.push(s)
    handle.end()
    const done = handle.done.then((o) => o === 'completed')
    this.proactive = { turnId, handle: done }
    try {
      await done
    } finally {
      if (this.proactive?.turnId === turnId) this.proactive = null
    }
  }

  private currentTopic(): string {
    return this.state.currentTopic() ?? this.cfg.sectionTitle ?? 'chemistry'
  }

  private greeting(): string {
    const topic = this.cfg.sectionTitle?.trim()
    if (this.lang === 'en') {
      return topic
        ? `Hi! Let us talk about “${topic}”. Ask me anything — you can interrupt me at any moment.`
        : 'Hi! I am your chemistry mentor. Ask me anything — you can interrupt me at any moment.'
    }
    if (this.lang === 'uz') {
      return topic
        ? `Salom! «${topic}» haqida gaplashamiz. Istalgan savolni bering — meni istalgan payt to‘xtatishingiz mumkin.`
        : 'Salom! Men kimyo murabbiyingizman. Istalgan savolni bering — meni to‘xtatishingiz mumkin.'
    }
    return topic
      ? `Привет! Поговорим про «${topic}». Спрашивай что угодно — перебивать меня можно в любой момент.`
      : 'Привет! Я твой наставник по химии. Спрашивай что угодно — перебивать меня можно в любой момент.'
  }

  private fallbackLine(): string {
    if (this.lang === 'en') return 'Sorry, something went wrong. Could you repeat the question?'
    if (this.lang === 'uz') return 'Kechirasiz, nimadir xato ketdi. Savolni takrorlay olasizmi?'
    return 'Прости, что-то пошло не так. Повтори, пожалуйста, вопрос.'
  }

  private byeLine(): string {
    if (this.lang === 'en') return 'We are done. Well done today.'
    if (this.lang === 'uz') return 'Tugatdik. Bugun yaxshi ishladingiz.'
    return 'На этом закончим. Сегодня ты хорошо поработал.'
  }

  private noQuestionsLine(): string {
    if (this.lang === 'en') return 'There are no questions available for this chapter yet.'
    if (this.lang === 'uz') return 'Bu bob uchun hozircha savollar yo‘q.'
    return 'Для этой главы пока нет вопросов.'
  }

  private allTopicsDoneLine(): string {
    if (this.lang === 'en') return 'We have covered all the topics. Great job.'
    if (this.lang === 'uz') return 'Barcha mavzularni ko‘rib chiqdik. Zo‘r.'
    return 'Мы прошли все темы. Отличная работа.'
  }

  /** Микрофон подключён (иначе — текстовый режим). */
  hasMic(): boolean {
    return this.micAttached
  }
}
