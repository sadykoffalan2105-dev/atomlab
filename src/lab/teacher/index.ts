export {
  getClo2TeacherLine,
  getLabTeacherScriptProductIds,
  hasLabTeacherScript,
  CLO2_TEACHER_SFX,
  CLO2_SPEECH_SILENT,
  type Clo2TeacherLine,
  type Clo2TeacherLineId,
  type LabTeacherLocale,
} from './clo2TeacherScript'
export {
  getLabTeacherNarrator,
  LabTeacherNarrator,
  readLabTeacherVoiceEnabled,
  writeLabTeacherVoiceEnabled,
} from './LabTeacherNarrator'
export { LabTeacherDock } from './LabTeacherDock'
export { playLabReactionSfx, primeLabReactionSfx } from './labReactionSfx'
export { prepareLabTeacherSpeechRaw } from './labTeacherSpeechPrep'
export { buildClo2TeacherSegments, estimateLabSpeechMs } from './labTeacherTiming'
