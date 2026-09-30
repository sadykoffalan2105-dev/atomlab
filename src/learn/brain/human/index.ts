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
export { registerTeacherModel, askTeacherModels, availableTeacherModels } from './teacherModelRegistry'
export type { TeacherModelProvider } from './teacherModelRegistry'
