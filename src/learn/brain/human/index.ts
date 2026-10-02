export { humanTurn, humanizeBookAnswer, verifyClaim, setHumanClock, setHumanRandom, normalizeUtterance, fixTypos } from './humanTeacher'
export type { HumanTurn, HumanIntent, HumanTurnOptions } from './humanTeacher'
export {
  loadProfile,
  saveProfile,
  forgetEverything,
  applyFeedback,
  preferredDetail,
  subscribeProfile,
  setMemoryProfileBackend,
} from './studentProfile'
export type { StudentProfile, StudentNote } from './studentProfile'
export { speakLikeHuman, detectMood, detectVoiceIntent, resetVoiceMemory, canonSentence, splitVoiceSentences, MAX_ADDED_WORDS } from './personaVoice'
export type { SpeakOptions, VoiceKind, VoiceIntent, VoiceMood, VoiceLang } from './personaVoice'
export { scientistTalk, findScientists, SCIENTIST_SIGNATURE } from './scientistTalk'
export { registerTeacherModel, askTeacherModels, availableTeacherModels } from './teacherModelRegistry'
export type { TeacherModelProvider } from './teacherModelRegistry'
