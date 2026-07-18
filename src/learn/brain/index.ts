/**
 * ATOMLAB Super-Brain — единая точка входа для UI-компонентов обучения.
 *
 * Модули:
 *  • brainTypes            — контракты мультимодальных сигналов и решений;
 *  • studentMemoryStore    — Big Data Layer (долгосрочная память ученика);
 *  • contextGraph          — сведение трёх потоков в единый контекст;
 *  • reasoningTrace        — журнал скрытых мыслей;
 *  • pedagogicalStrategy   — выбор тона/действия/подсказки;
 *  • unifiedBrain          — ядро принятия решений;
 *  • vision/*              — компьютерное зрение и вовлечённость;
 *  • voice/*               — реальное время: VAD, барджин, транспорт, опрос.
 */
export * from './brainTypes'
export { ReasoningTrace } from './reasoningTrace'
export {
  StudentMemoryStore,
  studentMemory,
  type StudentProfile,
  type SessionRecord,
  type TopicMastery,
  type Misconception,
  type RapportProfile,
} from './studentMemoryStore'
export { ContextGraph } from './contextGraph'
export { decideStrategy, type StrategyInput } from './pedagogicalStrategy'
export { composeTutorLine, type PhraseContext } from './brainPhrasing'
export {
  UnifiedBrain,
  type BrainConfig,
  type ActiveQuestion,
  type AnswerEvaluation,
} from './unifiedBrain'

export {
  EngagementTracker,
  HeuristicFaceAnalyzer,
  type FaceAnalyzer,
  type FaceObservation,
  type EngagementTrackerOptions,
} from './vision/engagementTracker'

export { AudioActivityDetector, type AudioActivityOptions } from './voice/audioActivityDetector'
export {
  InterruptionController,
  type DialogTurn,
  type InterruptionOptions,
} from './voice/interruptionController'
export {
  createRealtimeTransport,
  WebSocketDuplexTransport,
  LocalLoopbackTransport,
  type RealtimeTransport,
  type RealtimeState,
  type ClientFrame,
  type ServerFrame,
  type LocalBrainBridge,
} from './voice/realtimeTransport'
export { DuplexVoiceSession, type DuplexSessionConfig } from './voice/duplexVoiceSession'
export {
  VoiceExamOrchestrator,
  type VoiceExamConfig,
  type VoiceExamQuestion,
  type VoiceExamCallbacks,
  type VoiceExamSummary,
} from './voice/voiceExamOrchestrator'

export {
  useUnifiedBrainSession,
  type UseUnifiedBrainOptions,
  type BrainSessionState,
} from './useUnifiedBrainSession'

// --- Двухрежимный разум (State Machine: обучение ↔ строгий экзамен) ---
export {
  TeacherIntelligence,
  useDualModeTeacher,
  ConversationStateManager,
  QuestionGenerator,
  TrainingModeEngine,
  ExamModeEngine,
  EXAM_PERSONA,
  TRAINING_PERSONA,
  personaForMode,
  parseVoiceIntent,
  clarifyPrompt,
  reengagePrompt,
  switchAnnouncement,
  type TutorMode,
  type TutorPersona,
  type AnswerPolicy,
  type QuestionCard,
  type TeacherResponse,
  type VoiceIntent,
  type DualModeTeacherConfig,
  type DualModeTeacherCallbacks,
  type UseDualModeTeacherOptions,
  type DualModeTeacherState,
  type LiveMessage,
  type ConversationSnapshot,
  type TopicProgress,
  type QuestionGeneratorConfig,
  type TrainingEngineConfig,
  type ExamEngineConfig,
  type ExamEvaluation,
} from './dualMode'
