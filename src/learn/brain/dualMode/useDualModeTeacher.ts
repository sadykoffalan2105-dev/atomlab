/**
 * useDualModeTeacher — React-мост для «Двухрежимного разума» преподавателя.
 *
 * Инкапсулирует TeacherIntelligence: захват камеры/микрофона, переключение
 * режимов (обучение ↔ экзамен), реактивное состояние для UI (реплика учителя,
 * трасса мыслей, вовлечённость, текущий вопрос, ход диалога) и команды
 * управления голосом или с клавиатуры.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { LearnSpeechController } from '../../learnSpeech'
import type { FusedContext, ReasoningStepSnapshot } from '../brainTypes'
import type { DialogTurn } from '../voice/interruptionController'
import { TeacherIntelligence } from './dualModeTeacher'
import type { ConversationSnapshot } from './conversationStateManager'
import type {
  AssistantLang,
  QuestionCard,
  TeacherResponse,
  TutorMode,
  TutorPersona,
} from './dualModeTypes'

export interface UseDualModeTeacherOptions {
  studentId: string
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
  question: QuestionCard | null
  lastVerdict: TeacherResponse['verdict']
  snapshot: ConversationSnapshot | null
  micActive: boolean
  finished: boolean
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
  question: null,
  lastVerdict: null,
  snapshot: null,
  micActive: false,
  finished: false,
}

const FUSED_THROTTLE_MS = 280

async function acquireMic(): Promise<MediaStream | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      return null
    }
  }
}

export function useDualModeTeacher(options: UseDualModeTeacherOptions) {
  const [state, setState] = useState<DualModeTeacherState>({
    ...INITIAL,
    mode: options.initialMode ?? 'training',
  })

  const teacherRef = useRef<TeacherIntelligence | null>(null)
  const controllerRef = useRef<LearnSpeechController | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const lastFusedRef = useRef(0)
  const msgIdRef = useRef(0)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const pushMessage = useCallback((role: LiveMessage['role'], text: string) => {
    const clean = text.trim()
    if (!clean) return
    setState((prev) => {
      const next = [...prev.messages, { id: msgIdRef.current++, role, text: clean }]
      return { ...prev, messages: next.slice(-40) }
    })
  }, [])

  const patch = useCallback((partial: Partial<DualModeTeacherState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  const stop = useCallback(() => {
    teacherRef.current?.stop()
    teacherRef.current = null
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    patch({ running: false, micActive: false, turn: 'idle', aiSpeaking: false })
  }, [patch])

  const start = useCallback(async () => {
    if (teacherRef.current) return
    const opts = optionsRef.current
    const controller = controllerRef.current ?? new LearnSpeechController()
    controllerRef.current = controller

    const teacher = new TeacherIntelligence({
      lang: opts.lang,
      gradeId: opts.gradeId,
      chapterId: opts.chapterId,
      sectionTitle: opts.sectionTitle,
      sectionId: opts.sectionId,
      studentId: opts.studentId,
      studentName: opts.studentName ?? null,
      topics: opts.topics,
      initialMode: opts.initialMode ?? 'training',
      useAiGrading: opts.useAiGrading,
      controller,
      callbacks: {
        onResponse: (r) => {
          setState((prev) => ({
            ...prev,
            tutorText: r.say,
            question: r.question,
            lastVerdict: r.verdict,
            finished: r.finished,
            mode: r.mode,
            // Сохраняем прошлую трассу, если новая реплика без рассуждений.
            reasoning: r.reasoning.length > 0 ? r.reasoning : prev.reasoning,
            messages: r.say.trim()
              ? [...prev.messages, { id: msgIdRef.current++, role: 'teacher' as const, text: r.say.trim() }].slice(-40)
              : prev.messages,
          }))
        },
        onStudentUtterance: (text) => pushMessage('you', text),
        onModeChange: (mode, persona) => patch({ mode, persona }),
        onEngagement: (fused) => {
          const now = Date.now()
          if (now - lastFusedRef.current < FUSED_THROTTLE_MS) return
          lastFusedRef.current = now
          patch({ fused })
        },
        onPartialTranscript: (t) => patch({ partial: t }),
        onTurnChange: (turn) => patch({ turn }),
        onSpeakingChange: (aiSpeaking) => patch({ aiSpeaking }),
        onStateChange: (snapshot) => patch({ snapshot }),
      },
    })
    teacherRef.current = teacher

    let mic: MediaStream | null = null
    if (opts.voice) {
      mic = await acquireMic()
      micStreamRef.current = mic
    }
    patch({
      running: true,
      micActive: Boolean(mic),
      persona: teacher.getPersona(),
      mode: teacher.getMode(),
      finished: false,
      messages: [],
      partial: '',
    })
    await teacher.start(opts.videoEl ?? null, mic)
  }, [patch])

  const setMode = useCallback(async (mode: TutorMode) => {
    await teacherRef.current?.setMode(mode)
  }, [])

  const sendText = useCallback(async (text: string) => {
    if (!text.trim()) return
    await teacherRef.current?.handleIncomingVoice(text)
  }, [])

  const askAnother = useCallback(async () => {
    await teacherRef.current?.handleIncomingVoice(
      optionsRef.current.lang === 'en'
        ? 'give me another question'
        : optionsRef.current.lang === 'uz'
          ? 'yana savol ber'
          : 'дай мне ещё вопрос',
    )
  }, [])

  const nextTopic = useCallback(async () => {
    await teacherRef.current?.handleIncomingVoice(
      optionsRef.current.lang === 'en'
        ? 'next topic'
        : optionsRef.current.lang === 'uz'
          ? 'keyingi mavzu'
          : 'следующая тема',
    )
  }, [])

  useEffect(() => () => stop(), [stop])

  return { state, start, stop, setMode, sendText, askAnother, nextTopic }
}
