/**
 * Двухрежимный разум ИИ-преподавателя химии — публичный API подсистемы.
 *
 * TRAINING (профессор-наставник) ↔ EXAM (строгий экзаменатор, «НЕТ ОТВЕТАМ»),
 * единый голосовой + видео-интерфейс, State Machine и Conversation State Manager.
 */
export type {
  AssistantLang,
  AnswerPolicy,
  LiveTurnMetrics,
  QuestionCard,
  QueuedStudentTurn,
  TeacherReplyOrigin,
  TeacherResponse,
  TutorMode,
  TutorPersona,
  VoiceIntent,
} from './dualModeTypes'

export { composeLocalAnswer, extractKeyTerm, type ComposeInput, type ComposeStyle, type ComposedAnswer } from './localAnswerComposer'
export { detectFollowUp, resolveTurn, isSubstantiveQuestion, type FollowUpKind, type ResolvedTurn } from './followUps'
export { loadOralPool, getOralPoolSync, type GradeOralItem } from './gradeOralPools'

export {
  EXAM_PERSONA,
  TRAINING_PERSONA,
  clarifyPrompt,
  personaForMode,
  reengagePrompt,
  switchAnnouncement,
} from './personaProfiles'

export { parseVoiceIntent } from './intentParser'
export {
  ConversationStateManager,
  type ConversationSnapshot,
  type TopicProgress,
} from './conversationStateManager'
export {
  QuestionGenerator,
  type QuestionGeneratorConfig,
} from './questionGenerator'
export { TrainingModeEngine, type TrainingEngineConfig } from './trainingModeEngine'
export {
  ExamModeEngine,
  type ExamEngineConfig,
  type ExamEvaluation,
} from './examModeEngine'
export {
  TeacherIntelligence,
  type DualModeTeacherConfig,
  type DualModeTeacherCallbacks,
  type TeacherCommand,
  type TeacherDraft,
} from './dualModeTeacher'
export {
  useDualModeTeacher,
  prewarmLiveTeacher,
  resolveStableStudentId,
  type UseDualModeTeacherOptions,
  type DualModeTeacherState,
  type LiveMessage,
} from './useDualModeTeacher'
