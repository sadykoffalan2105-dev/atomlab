/**
 * useUnifiedBrainSession — React-мост между UI обучения и супер-мозгом.
 *
 * Связывает:
 *  • EngagementTracker (камера) → UnifiedBrain.ingestVision,
 *  • DuplexVoiceSession/VoiceExamOrchestrator (микрофон, STT, TTS, барджин),
 *  • реактивное состояние для интерфейса (эмоция, внимание, трасса мыслей,
 *    транскрипт, реплики учителя, оценки, ход диалога).
 *
 * Готов к вставке в LearnOralExamPanel: передайте videoEl камеры и вопросы.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { LearnSpeechController } from '../learnSpeech'
import type { AssistantLang, FusedContext, ReasoningStepSnapshot } from './brainTypes'
import { UnifiedBrain } from './unifiedBrain'
import { EngagementTracker } from './vision/engagementTracker'
import { VoiceExamOrchestrator, type VoiceExamQuestion, type VoiceExamSummary } from './voice/voiceExamOrchestrator'
import type { DialogTurn } from './voice/interruptionController'
import type { ExamGradeResult } from '../learnExamGrader'

export interface UseUnifiedBrainOptions {
  studentId: string
  lang: AssistantLang
  studentName?: string | null
  questions?: VoiceExamQuestion[]
  videoEl?: HTMLVideoElement | null
  useAiGrading?: boolean
  /** Разрешить перебивание ИИ голосом. */
  bargeInEnabled?: boolean
}

export interface BrainSessionState {
  running: boolean
  fused: FusedContext | null
  reasoning: ReasoningStepSnapshot[]
  tutorText: string
  partial: string
  turn: DialogTurn
  aiSpeaking: boolean
  questionIndex: number
  grades: (ExamGradeResult | null)[]
  summary: VoiceExamSummary | null
  micActive: boolean
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

export function useUnifiedBrainSession(options: UseUnifiedBrainOptions) {
  const brainRef = useRef<UnifiedBrain | null>(null)
  const trackerRef = useRef<EngagementTracker | null>(null)
  const orchestratorRef = useRef<VoiceExamOrchestrator | null>(null)
  const controllerRef = useRef<LearnSpeechController | null>(null)
  const micRef = useRef<MediaStream | null>(null)
  const lastFusedEmitRef = useRef(0)
  const unsubFusedRef = useRef<(() => void) | null>(null)

  const [state, setState] = useState<BrainSessionState>({
    running: false,
    fused: null,
    reasoning: [],
    tutorText: '',
    partial: '',
    turn: 'idle',
    aiSpeaking: false,
    questionIndex: 0,
    grades: [],
    summary: null,
    micActive: false,
  })

  const patch = useCallback((p: Partial<BrainSessionState>) => {
    setState((prev) => ({ ...prev, ...p }))
  }, [])

  const stop = useCallback(() => {
    orchestratorRef.current?.stop()
    orchestratorRef.current = null
    trackerRef.current?.stop()
    trackerRef.current = null
    unsubFusedRef.current?.()
    unsubFusedRef.current = null
    micRef.current?.getTracks().forEach((t) => t.stop())
    micRef.current = null
    controllerRef.current?.stop()
    patch({ running: false, aiSpeaking: false, turn: 'idle', micActive: false })
  }, [patch])

  const start = useCallback(async () => {
    if (state.running) return

    const brain = new UnifiedBrain({
      studentId: options.studentId,
      lang: options.lang,
      studentName: options.studentName ?? null,
      useAiGrading: options.useAiGrading,
    })
    brainRef.current = brain

    // Камера → зрение → мозг.
    unsubFusedRef.current = brain.onFused((fused) => {
      const now = Date.now()
      if (now - lastFusedEmitRef.current < FUSED_THROTTLE_MS) return
      lastFusedEmitRef.current = now
      patch({ fused })
    })

    if (options.videoEl) {
      const tracker = new EngagementTracker(options.videoEl, {
        fps: 6,
        onSignal: (sig) => brain.ingestVision(sig),
      })
      trackerRef.current = tracker
      tracker.start()
    }

    // Микрофон нужен только для голосового опроса. В режиме «только зрение»
    // (без вопросов) микрофон НЕ занимаем, чтобы не конфликтовать со сторонним STT.
    const needsVoice = !!(options.questions && options.questions.length > 0)
    let mic: MediaStream | null = null
    if (needsVoice) {
      mic = await acquireMic()
      micRef.current = mic
    }
    patch({ micActive: !!mic, running: true, summary: null })

    if (needsVoice && mic) {
      const controller = controllerRef.current ?? new LearnSpeechController()
      controllerRef.current = controller
      const orchestrator = new VoiceExamOrchestrator({
        brain,
        controller,
        lang: options.lang,
        questions: options.questions!,
        bargeInEnabled: options.bargeInEnabled ?? false,
        callbacks: {
          onQuestionChange: (index) => patch({ questionIndex: index }),
          onReasoning: (reasoning) => patch({ reasoning }),
          onTutorText: (tutorText) => patch({ tutorText }),
          onPartial: (partial) => patch({ partial }),
          onTurnChange: (turn) => patch({ turn }),
          onAiSpeakingChange: (aiSpeaking) => patch({ aiSpeaking }),
          onGrade: (index, grade) =>
            setState((prev) => {
              const grades = [...prev.grades]
              grades[index] = grade
              return { ...prev, grades }
            }),
          onComplete: (summary) => {
            patch({ summary })
            stop()
          },
        },
      })
      orchestratorRef.current = orchestrator
      await orchestrator.start(mic)
    }
  }, [options, patch, state.running, stop])

  const submitText = useCallback((text: string) => {
    orchestratorRef.current?.submitText(text)
  }, [])

  useEffect(() => {
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { state, start, stop, submitText }
}
