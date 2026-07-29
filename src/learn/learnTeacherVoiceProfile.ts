import type { SpeechPrepLocale } from './learnSpeechText'

/**
 * Голос ATOMLAB Teacher — мужской neural (Dmitry / Guy / Sardor).
 */
export const TEACHER_VOICE_EDGE: Record<SpeechPrepLocale, string> = {
  ru: 'ru-RU-DmitryNeural',
  en: 'en-US-GuyNeural',
  uz: 'uz-UZ-SardorNeural',
}

/** Просодия — чуть быстрее, живой темп (не медленный). */
export const TEACHER_VOICE_EDGE_PROSODY: Record<
  SpeechPrepLocale,
  { rate: string; pitch: string; volume: string }
> = {
  ru: { rate: '-10%', pitch: '-3Hz', volume: '+6%' },
  en: { rate: '-8%', pitch: '-3Hz', volume: '+5%' },
  uz: { rate: '-6%', pitch: '-2Hz', volume: '+5%' },
}

/** Лаборатория: чуть быстрее — короткие cue должны укладываться в wall-gap. */
export const TEACHER_VOICE_EDGE_PROSODY_LAB: Record<
  SpeechPrepLocale,
  { rate: string; pitch: string; volume: string }
> = {
  ru: { rate: '+2%', pitch: '-2Hz', volume: '+9%' },
  en: { rate: '+2%', pitch: '-2Hz', volume: '+7%' },
  uz: { rate: '+2%', pitch: '-1Hz', volume: '+7%' },
}

export type TeacherTtsProsodyMode = 'default' | 'lab'

let teacherTtsProsodyMode: TeacherTtsProsodyMode = 'default'

export function setTeacherTtsProsodyMode(mode: TeacherTtsProsodyMode): void {
  teacherTtsProsodyMode = mode
}

export function getTeacherTtsProsodyMode(): TeacherTtsProsodyMode {
  return teacherTtsProsodyMode
}

export function resolveTeacherEdgeProsody(
  locale: SpeechPrepLocale,
  mode?: TeacherTtsProsodyMode,
): {
  rate: string
  pitch: string
  volume: string
} {
  const resolved = mode ?? teacherTtsProsodyMode
  return resolved === 'lab'
    ? TEACHER_VOICE_EDGE_PROSODY_LAB[locale]
    : TEACHER_VOICE_EDGE_PROSODY[locale]
}

export const TEACHER_BROWSER_RATE_LAB: Record<SpeechPrepLocale, number> = {
  ru: 1.08,
  en: 1.06,
  uz: 1.08,
}

export const TEACHER_VOICE_OPENAI: Record<SpeechPrepLocale, string> = {
  ru: 'onyx',
  en: 'onyx',
  uz: 'onyx',
}

export const TEACHER_VOICE_OPENAI_SPEED: Record<SpeechPrepLocale, number> = {
  ru: 1.02,
  en: 1.0,
  uz: 1.02,
}

export const TEACHER_VOICE_CLONE_SPEED: Record<SpeechPrepLocale, number> = {
  ru: 1.02,
  en: 1.0,
  uz: 1.02,
}

export const TEACHER_VOICE_OPENAI_INSTRUCTIONS: Record<SpeechPrepLocale, string> = {
  ru: `Russian only. Warm male chemistry teacher. Clear pace — not slow, not rushed. Natural pauses at commas and periods. Enunciate chemistry terms clearly.`,
  en: `English only. Warm male teacher, natural tutor pace, clear chemistry pronunciation.`,
  uz: `Uzbek Latin only. Warm male chemistry teacher. Clear pace, natural pauses. Chemistry terms in standard Uzbek.`,
}

export const TEACHER_BROWSER_VOICE_HINTS: Record<SpeechPrepLocale, string[]> = {
  ru: [
    'microsoft dmitry',
    'dmitry',
    'dmitri',
    'microsoft pavel',
    'pavel',
    'maxim',
    'yuri',
    'aleksandr',
    'russian',
  ],
  en: [
    'microsoft guy online',
    'microsoft andrew online',
    'microsoft guy',
    'microsoft david',
    'microsoft mark',
    'google us english',
    'daniel',
    'alex',
    'english united states',
  ],
  uz: ['microsoft sardor online', 'sardor', 'uz-uz', 'uzbek'],
}

export const TEACHER_VOICE_MALE_NAMES = [
  'dmitry',
  'dmitri',
  'pavel',
  'maxim',
  'yuri',
  'aleksandr',
  'artem',
  'guy',
  'andrew',
  'matthew',
  'david',
  'mark',
  'daniel',
  'alex',
  'fred',
  'sardor',
  'male',
]

export const TEACHER_VOICE_FEMALE_NAMES = [
  'irina',
  'tatyana',
  'svetlana',
  'dariya',
  'milena',
  'elena',
  'katja',
  'aria',
  'jenny',
  'zira',
  'samantha',
  'victoria',
  'female',
  'google русский',
  'google russian',
]

export const TEACHER_BROWSER_RATE: Record<SpeechPrepLocale, number> = {
  ru: 1.18,
  en: 1.14,
  uz: 1.16,
}

export const TEACHER_BROWSER_PITCH: Record<SpeechPrepLocale, number> = {
  ru: 1.02,
  en: 1.0,
  uz: 1.02,
}

export function edgeLangForLocale(locale: SpeechPrepLocale): string {
  if (locale === 'en') return 'en-US'
  if (locale === 'uz') return 'uz-UZ'
  return 'ru-RU'
}
