/**
 * ATOMLAB Super-Brain — общие типы мультимодального ядра ИИ-преподавателя.
 *
 * Три входящих потока сигналов сводятся в единый контекст:
 *  1) VisionSignal — камера (фокус внимания, эмоция, целостность),
 *  2) AudioSignal  — микрофон + STT (речь, темп, транскрипт),
 *  3) LabSignal    — действия в виртуальной химической лаборатории.
 *
 * Файл не содержит рантайм-логики (кроме констант) — только контракты типов,
 * чтобы модули мозга, зрения и голоса говорили на одном языке.
 */

export type Modality = 'vision' | 'audio' | 'lab'

/** Уровень вовлечённости, вычисляемый по камере. */
export type EngagementLevel = 'focused' | 'distracted' | 'absent' | 'suspicious'

/** Грубая оценка эмоционального состояния ученика. */
export type EmotionState =
  | 'neutral'
  | 'confused'
  | 'frustrated'
  | 'confident'
  | 'bored'
  | 'curious'
  | 'tired'

/** Тон преподавателя, выбираемый педагогической стратегией. */
export type TutorTone = 'strict' | 'neutral' | 'warm' | 'encouraging'

export type AssistantLang = 'ru' | 'en' | 'uz'

export interface GazeEstimate {
  /** Смотрит ли ученик в экран (виртуальную лабораторию). */
  onScreen: boolean
  /** Поворот головы влево/вправо: -1 (влево) … +1 (вправо). */
  yaw: number
  /** Наклон головы вниз/вверх: -1 (вниз) … +1 (вверх). */
  pitch: number
}

export interface VisionSignal {
  tsMs: number
  facePresent: boolean
  faceCount: number
  gaze: GazeEstimate
  engagement: EngagementLevel
  emotion: EmotionState
  /** Достоверность оценки эмоции/взгляда 0..1. */
  confidence: number
  /** Сколько миллисекунд подряд взгляд уходит с экрана. */
  lookingAwayMs: number
  /** Подозрение на второй экран/телефон (списывание). */
  secondaryScreenSuspected: boolean
  /** Средняя яркость кадра 0..1 (для диагностики условий съёмки). */
  brightness: number
}

export interface AudioSignal {
  tsMs: number
  /** Говорит ли ученик прямо сейчас (по громкости/VAD). */
  speaking: boolean
  /** Среднеквадратичная громкость 0..1. */
  rms: number
  /** Промежуточный (нефинальный) транскрипт текущей реплики. */
  partialTranscript: string
  /** Финальный транскрипт завершённой реплики. */
  finalTranscript: string
  /** Темп речи, слов в минуту (0 — неизвестно). */
  wordsPerMinute: number
}

export type LabCorrectness = 'ok' | 'warn' | 'error'

export interface LabSignal {
  tsMs: number
  /** Машинно-читаемое действие: 'pour', 'heat', 'set-coefficient', … */
  action: string
  correctness: LabCorrectness
  detail?: string
}

/** Мгновенный сведённый контекст — то, что «видит» мозг в конкретный тик. */
export interface FusedContext {
  tsMs: number
  /** Внимание 0..1 (сглаженное). */
  attention: number
  emotion: EmotionState
  emotionConfidence: number
  engagement: EngagementLevel
  speaking: boolean
  /** Риск списывания 0..1. */
  integrityRisk: number
  labCorrectness: LabCorrectness | null
  lastTranscript: string
  /** Присутствует ли ученик перед камерой. */
  present: boolean
}

export type PedagogicalAction =
  | 'ask_question'
  | 'give_hint'
  | 'encourage'
  | 're_engage'
  | 'integrity_nudge'
  | 'advance'
  | 'explain'
  | 'wait'

export interface StrategyDecision {
  tone: TutorTone
  action: PedagogicalAction
  /** Насколько развёрнутую подсказку давать: 0 (никакой) … 3 (почти ответ). */
  hintLevel: number
  verbosity: 'short' | 'normal' | 'full'
  /** Скорректировать сложность следующего вопроса. */
  difficultyDelta: -1 | 0 | 1
  rationale: string
}

/** Итоговое решение мозга на один «ход» диалога. */
export interface BrainDecision {
  strategy: StrategyDecision
  /** Готовый текст реплики для озвучки (уже с педагогикой, без разметки). */
  say: string
  /** Наводящий/корректирующий вопрос, если он есть. */
  followUpQuestion: string | null
  reasoning: ReasoningStepSnapshot[]
  fused: FusedContext
}

export type ReasoningStage =
  | 'ingest'
  | 'assess_answer'
  | 'check_emotion'
  | 'check_engagement'
  | 'check_lab'
  | 'recall_memory'
  | 'choose_strategy'
  | 'compose'

export interface ReasoningStepSnapshot {
  stage: ReasoningStage
  observation: string
  inference: string
  atMs: number
}

/** Мягкая деградация: значения по умолчанию, когда сигнал недоступен. */
export const DEFAULT_VISION_SIGNAL: VisionSignal = {
  tsMs: 0,
  facePresent: false,
  faceCount: 0,
  gaze: { onScreen: true, yaw: 0, pitch: 0 },
  engagement: 'focused',
  emotion: 'neutral',
  confidence: 0,
  lookingAwayMs: 0,
  secondaryScreenSuspected: false,
  brightness: 0.5,
}

export const DEFAULT_AUDIO_SIGNAL: AudioSignal = {
  tsMs: 0,
  speaking: false,
  rms: 0,
  partialTranscript: '',
  finalTranscript: '',
  wordsPerMinute: 0,
}
