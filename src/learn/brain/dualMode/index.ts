/**
 * Двухрежимный разум ИИ-преподавателя химии — публичный API подсистемы.
 *
 * TRAINING (профессор-наставник) ↔ EXAM (строгий экзаменатор, «НЕТ ОТВЕТАМ»),
 * единый голосовой + видео-интерфейс, State Machine и Conversation State Manager.
 */
export type {
  AssistantLang,
  AnswerPolicy,
  QuestionCard,
  TeacherResponse,
  TutorMode,
  TutorPersona,
  VoiceIntent,
} from './dualModeTypes'

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
} from './dualModeTeacher'
export {
  useDualModeTeacher,
  type UseDualModeTeacherOptions,
  type DualModeTeacherState,
  type LiveMessage,
} from './useDualModeTeacher'
