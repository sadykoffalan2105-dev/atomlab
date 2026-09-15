/**
 * useDualModeTeacher — React-мост для живого ИИ-преподавателя.
 *
 * Инкапсулирует TeacherIntelligence: захват микрофона (echoCancellation), камеры,
 * режимы (обучение ↔ экзамен), реактивное состояние для UI и команды.
 *
 * Состояние для UI (контракт для вёрстки):
 *   messages[]          — лента; сообщение учителя обновляется «на месте» при стриминге
 *                         (`streaming: true`), помечается `interrupted`, если перебили;
 *   partial             — живой промежуточный текст ученика;
 *   queued[]            — реплики ученика в очереди (не теряются, пока учитель говорит/думает);
 *   thinking / aiSpeaking / turn — что сейчас происходит;
 *   speakingMessageId + spokenSentenceIndex — какое сообщение и какая фраза звучат;
 *   interruptedAt       — время последнего перебивания (для вспышки «Перебили»);
 *   metrics             — задержки последнего хода (мс);  ttsPath — путь озвучки;
 *   smartAi             — «умный ИИ» подключён (Puter), иначе ответы из локальной базы.
 * Действия: start, stop, sendText, askAnother, nextTopic, setMode, interrupt, setMicMuted,
 *   checkHomework, connectSmartAi (из обработчика клика!), subscribeMicLevel.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { LearnSpeechController } from '../../learnSpeech'
import {
  connectSmartAi as connectSmartAiImpl,
  getSmartAiState,
  isSmartAiConnected,
  subscribeSmartAi,
  warmSmartAi,
  type SmartAiState,
} from '../../learnPuterChat'
import { preloadTeacherKnowledge } from '../../teacherKnowledge'
import type { FusedContext, ReasoningStepSnapshot } from '../brainTypes'
import type { DialogTurn } from '../voice/interruptionController'
import { warmLiveSpeech, type LiveTtsPath } from '../voice/liveSpeechOutput'
import { TeacherIntelligence } from './dualModeTeacher'
import { loadOralPool } from './gradeOralPools'
import type { ConversationSnapshot } from './conversationStateManager'
import type {
  AssistantLang,
  LiveTurnMetrics,
  QuestionCard,
  QueuedStudentTurn,
  TeacherReplyOrigin,
  TeacherResponse,
  TutorMode,
  TutorPersona,
} from './dualModeTypes'

export interface UseDualModeTeacherOptions {
  /** Ученик из списка класса; пусто/'guest' → стабильный анонимный id этого браузера. */
  studentId?: string | null
  lang: AssistantLang
  gradeId: string
  chapterId: string
  sectionTitle?: string
  sectionId?: string
  studentName?: string | null
  topics?: string[]
  initialMode?: TutorMode
  useAiGrading?: boolean
  videoEl?: HTMLVideoElement | null
  /** Захватывать микрофон (для голосового диалога). */
  voice?: boolean
}

export interface LiveMessage {
  id: number
  role: 'teacher' | 'you'
  text: string
  /** Учитель ещё пишет ответ (стриминг). */
  streaming?: boolean
  /** Ученик перебил эту реплику учителя. */
  interrupted?: boolean
  source?: TeacherReplyOrigin
  /** Номер реплики учителя в движке. */
  turnId?: number
}

export interface DualModeTeacherState {
  running: boolean
  mode: TutorMode
  persona: TutorPersona | null
  tutorText: string
  messages: LiveMessage[]
  reasoning: ReasoningStepSnapshot[]
  fused: FusedContext | null
  partial: string
  turn: DialogTurn
  aiSpeaking: boolean
  /** Учитель думает над ответом (поиск знаний / ожидание LLM). */
  thinking: boolean
  question: QuestionCard | null
  lastVerdict: TeacherResponse['verdict']
  snapshot: ConversationSnapshot | null
  micActive: boolean
  /** Микрофон на паузе кнопкой в UI (сессия продолжается). */
  micMuted: boolean
  finished: boolean
  queued: QueuedStudentTurn[]
  speakingMessageId: number | null
  spokenSentenceIndex: number
  /** Текст произносимой фразы (как её озвучивает TTS) — для подсветки субтитров. */
  spokenSentenceText: string
  interruptedAt: number | null
  metrics: LiveTurnMetrics | null
  ttsPath: LiveTtsPath | null
  smartAi: SmartAiState
  /**
   * Распознавание речи недоступно до конца сессии ('not-allowed' | 'service-not-allowed' |
   * 'language-not-supported'): UI предлагает писать текстом. null — всё в порядке.
   */
  sttError: string | null
}

const INITIAL: DualModeTeacherState = {
  running: false,
  mode: 'training',
  persona: null,
  tutorText: '',
  messages: [],
  reasoning: [],
  fused: null,
  partial: '',
  turn: 'idle',
  aiSpeaking: false,
  thinking: false,
  question: null,
  lastVerdict: null,
  snapshot: null,
  micActive: false,
  micMuted: false,
  finished: false,
  queued: [],
  speakingMessageId: null,
  spokenSentenceIndex: -1,
  spokenSentenceText: '',
  interruptedAt: null,
  metrics: null,
  ttsPath: null,
  smartAi: 'off',
  sttError: null,
}

const FUSED_THROTTLE_MS = 280
const STUDENT_ID_KEY = 'atomlab-live-student-id'

/** Стабильный id ученика: из списка класса, иначе анонимный id этого браузера (не 'guest'). */
export function resolveStableStudentId(studentId?: string | null): string {
  const given = studentId?.trim()
  if (given && given !== 'guest') return given
  try {
    const saved = localStorage.getItem(STUDENT_ID_KEY)
    if (saved) return saved
    const rand =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 12)
        : Math.random().toString(36).slice(2, 14)
    const id = `anon-${rand}`
    localStorage.setItem(STUDENT_ID_KEY, id)
    return id
  } catch {
    return 'guest'
  }
}

/**
 * Прогрев до начала урока (экран разрешений/лобби): база знаний класса, голоса озвучки,
 * устный пул экзамена. К нажатию «Начать урок» первый ответ уже не ждёт загрузки.
 * Безопасно вызывать многократно.
 */
export function prewarmLiveTeacher(opts: { gradeId: string; chapterId?: string; lang: AssistantLang }): void {
  preloadTeacherKnowledge({ gradeId: opts.gradeId })
  void warmLiveSpeech(opts.lang).catch(() => undefined)
  if (opts.chapterId) {
    void loadOralPool(opts.gradeId, opts.chapterId).catch(() => undefined)
  }
}

async function acquireMic(): Promise<MediaStream | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } })
    } catch {
      return null
    }
  }
}

export function useDualModeTeacher(options: UseDualModeTeacherOptions) {
  const [state, setState] = useState<DualModeTeacherState>({
    ...INITIAL,
    mode: options.initialMode ?? 'training',
    smartAi: getSmartAiState(),
  })

  const teacherRef = useRef<TeacherIntelligence | null>(null)
  const controllerRef = useRef<LearnSpeechController | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const lastFusedRef = useRef(0)
  const msgIdRef = useRef(0)
  /** turnId реплики учителя → id сообщения в ленте. */
  const turnMsgRef = useRef(new Map<number, number>())
  // Уровень микрофона идёт ~30 раз/с — не через React state, а подпиской.
  const micLevelListenersRef = useRef(new Set<(rms: number) => void>())
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const patch = useCallback((partial: Partial<DualModeTeacherState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  const pushMessage = useCallback((role: LiveMessage['role'], text: string, extra?: Partial<LiveMessage>) => {
    const clean = text.trim()
    if (!clean) return
    setState((prev) => {
      const next = [...prev.messages, { id: msgIdRef.current++, role, text: clean, ...extra }]
      return { ...prev, messages: next.slice(-60) }
    })
  }, [])

  /** Создать/обновить сообщение учителя по turnId. */
  const upsertTeacher = useCallback((turnId: number | undefined, text: string, extra: Partial<LiveMessage>) => {
    const clean = text.trim()
    setState((prev) => {
      const known = turnId != null ? turnMsgRef.current.get(turnId) : undefined
      if (known != null && prev.messages.some((m) => m.id === known)) {
        return {
          ...prev,
          messages: prev.messages.map((m) => (m.id === known ? { ...m, ...extra, text: clean || m.text } : m)),
        }
      }
      if (!clean) return prev
      const id = msgIdRef.current++
      if (turnId != null) turnMsgRef.current.set(turnId, id)
      const next = [...prev.messages, { id, role: 'teacher' as const, text: clean, turnId, ...extra }]
      return { ...prev, messages: next.slice(-60) }
    })
  }, [])

  const stop = useCallback(() => {
    teacherRef.current?.stop()
    teacherRef.current = null
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    patch({ running: false, micActive: false, turn: 'idle', aiSpeaking: false, thinking: false, queued: [], partial: '' })
  }, [patch])

  const start = useCallback(async () => {
    if (teacherRef.current) return
    const opts = optionsRef.current
    const controller = controllerRef.current ?? new LearnSpeechController()
    controllerRef.current = controller

    prewarmLiveTeacher({ gradeId: opts.gradeId, chapterId: opts.chapterId, lang: opts.lang })
    warmSmartAi()

    const teacher = new TeacherIntelligence({
      lang: opts.lang,
      gradeId: opts.gradeId,
      chapterId: opts.chapterId,
      sectionTitle: opts.sectionTitle,
      sectionId: opts.sectionId,
      studentId: resolveStableStudentId(opts.studentId),
      studentName: opts.studentName ?? null,
      topics: opts.topics,
      initialMode: opts.initialMode ?? 'training',
      useAiGrading: opts.useAiGrading,
      controller,
      callbacks: {
        onTeacherDraft: (d) => upsertTeacher(d.turnId, d.text, { streaming: true, source: d.source }),
        onResponse: (r: TeacherResponse) => {
          setState((prev) => ({
            ...prev,
            tutorText: r.say || prev.tutorText,
            question: r.question,
            lastVerdict: r.verdict,
            finished: r.finished,
            mode: r.mode,
            reasoning: r.reasoning.length > 0 ? r.reasoning : prev.reasoning,
          }))
          if (r.say.trim()) upsertTeacher(r.turnId, r.say, { streaming: false, source: r.source })
        },
        onTeacherInterrupted: ({ turnId }) => {
          const msgId = turnId != null ? turnMsgRef.current.get(turnId) : undefined
          setState((prev) => ({
            ...prev,
            interruptedAt: Date.now(),
            aiSpeaking: false,
            messages:
              msgId == null ? prev.messages : prev.messages.map((m) => (m.id === msgId ? { ...m, interrupted: true, streaming: false } : m)),
          }))
        },
        onStudentUtterance: (text) => pushMessage('you', text),
        onModeChange: (mode, persona) => patch({ mode, persona }),
        onEngagement: (fused) => {
          const t = Date.now()
          if (t - lastFusedRef.current < FUSED_THROTTLE_MS) return
          lastFusedRef.current = t
          patch({ fused })
        },
        onPartialTranscript: (t) => patch({ partial: t }),
        onTurnChange: (turn) => patch({ turn }),
        onSpeakingChange: (aiSpeaking) =>
          setState((prev) => ({
            ...prev,
            aiSpeaking,
            speakingMessageId: aiSpeaking ? prev.speakingMessageId : null,
            spokenSentenceIndex: aiSpeaking ? prev.spokenSentenceIndex : -1,
            spokenSentenceText: aiSpeaking ? prev.spokenSentenceText : '',
          })),
        onSpokenSentence: (turnId, index, text) => {
          const msgId = turnMsgRef.current.get(turnId) ?? null
          patch({ speakingMessageId: msgId, spokenSentenceIndex: index, spokenSentenceText: text })
        },
        onThinkingChange: (thinking) => patch({ thinking }),
        onQueueChange: (queued) => patch({ queued }),
        onStateChange: (snapshot) => patch({ snapshot }),
        onMetrics: (metrics) => {
          patch({ metrics })
          if (import.meta.env.DEV) console.info('[live-teacher] turn metrics', metrics)
        },
        onTtsPath: (ttsPath) => patch({ ttsPath }),
        onSttError: (code, fatal) => {
          if (fatal) patch({ sttError: code })
        },
        onMicLevel: (rms) => micLevelListenersRef.current.forEach((l) => l(rms)),
      },
    })
    teacherRef.current = teacher
    turnMsgRef.current.clear()

    patch({
      running: true,
      micActive: false,
      micMuted: false,
      persona: teacher.getPersona(),
      mode: teacher.getMode(),
      finished: false,
      messages: [],
      partial: '',
      queued: [],
      smartAi: getSmartAiState(),
      sttError: null,
    })

    let mic: MediaStream | null = null
    if (opts.voice) {
      mic = await acquireMic()
      if (teacherRef.current !== teacher) {
        mic?.getTracks().forEach((t) => t.stop())
        return
      }
      micStreamRef.current = mic
      patch({ micActive: Boolean(mic) })
    }
    await teacher.start(opts.videoEl ?? null, mic)
  }, [patch, pushMessage, upsertTeacher])

  // Камера может подняться позже микрофона — Vision подключаем без рестарта диалога.
  useEffect(() => {
    if (!options.videoEl || !teacherRef.current) return
    teacherRef.current.attachVision(options.videoEl)
  }, [options.videoEl])

  // «Умный ИИ» подключили/отключили — показываем в UI.
  useEffect(() => subscribeSmartAi((smartAi) => patch({ smartAi })), [patch])

  const setMode = useCallback(async (mode: TutorMode) => {
    await teacherRef.current?.setMode(mode)
  }, [])

  const sendText = useCallback(async (text: string) => {
    if (!text.trim()) return
    await teacherRef.current?.sendText(text)
  }, [])

  const askAnother = useCallback(async (label?: string) => {
    await teacherRef.current?.sendCommand('ask_another', label ?? '')
  }, [])

  const nextTopic = useCallback(async (label?: string) => {
    await teacherRef.current?.sendCommand('next_topic', label ?? '')
  }, [])

  const checkHomework = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (clean.length < 12) return
      const opts = optionsRef.current
      const { reviewHomework, formatHomeworkReportForChat, homeworkUserLabel, saveHomeworkReviewToHistory } =
        await import('../../homework')
      teacherRef.current?.interrupt()
      pushMessage('you', homeworkUserLabel(opts.lang, clean, true))
      patch({ thinking: true })
      try {
        const report = await reviewHomework({
          text: clean,
          source: 'upload',
          topicHint: opts.sectionTitle,
          gradeId: opts.gradeId,
          locale: opts.lang,
        })
        saveHomeworkReviewToHistory(report)
        pushMessage('teacher', formatHomeworkReportForChat(report, opts.lang), { source: 'local' })
        const speak =
          opts.lang === 'en'
            ? `Chemistry score ${report.chemistry.score}. Authorship ${report.authorship.authorship}.`
            : opts.lang === 'uz'
              ? `Kimyo ${report.chemistry.score}. Mualliflik ${report.authorship.authorship}.`
              : `Химия ${report.chemistry.score} из 100. Авторство: ${report.authorship.authorship}.`
        const controller = controllerRef.current
        if (controller) await controller.speak(speak, opts.lang)
      } finally {
        patch({ thinking: false })
      }
    },
    [patch, pushMessage],
  )

  const setMicMuted = useCallback(
    (muted: boolean) => {
      teacherRef.current?.setMicMuted(muted)
      patch(muted ? { micMuted: true, partial: '' } : { micMuted: false })
    },
    [patch],
  )

  /** «Перебить / стоп»: учитель замолкает сразу (<150 мс), слушаем ученика. */
  const interrupt = useCallback(() => {
    const t = teacherRef.current
    if (!t) return false
    const was = t.interrupt()
    if (was) patch({ interruptedAt: Date.now(), aiSpeaking: false })
    return was
  }, [patch])

  /** Подключить «умный ИИ» (Puter). ВЫЗЫВАТЬ ИЗ ОБРАБОТЧИКА КЛИКА. */
  const connectSmartAi = useCallback(async () => {
    const ok = await connectSmartAiImpl()
    patch({ smartAi: getSmartAiState() })
    return ok
  }, [patch])

  /** Подписка на уровень микрофона (RMS 0..1). Возвращает отписку. */
  const subscribeMicLevel = useCallback((listener: (rms: number) => void) => {
    const set = micLevelListenersRef.current
    set.add(listener)
    return () => {
      set.delete(listener)
    }
  }, [])

  useEffect(() => () => stop(), [stop])

  return {
    state,
    start,
    stop,
    setMode,
    sendText,
    askAnother,
    nextTopic,
    checkHomework,
    setMicMuted,
    interrupt,
    connectSmartAi,
    isSmartAiConnected,
    subscribeMicLevel,
  }
}
