import type { SpeechPrepLocale } from './learnSpeechText'

/**
 * Голос Articulate Tutor Natural — мужской, спокойный, «живой» диктор.
 * ru-RU-DmitryNeural — ближайший neural-аналог без клона ElevenLabs.
 */
export const TEACHER_VOICE_EDGE: Record<SpeechPrepLocale, string> = {
  ru: 'ru-RU-DmitryNeural',
  en: 'en-US-GuyNeural',
  uz: 'ru-RU-DmitryNeural',
}

/** Просодия ATOMLAB Teacher — спокойный живой мужской учитель. */
export const TEACHER_VOICE_EDGE_PROSODY: Record<
  SpeechPrepLocale,
  { rate: string; pitch: string; volume: string }
> = {
  ru: { rate: '-15%', pitch: '-5Hz', volume: '+4%' },
  en: { rate: '-15%', pitch: '-5Hz', volume: '+4%' },
  uz: { rate: '-15%', pitch: '-5Hz', volume: '+4%' },
}

export const TEACHER_VOICE_OPENAI: Record<SpeechPrepLocale, string> = {
  ru: 'onyx',
  en: 'onyx',
  uz: 'onyx',
}

export const TEACHER_VOICE_OPENAI_SPEED: Record<SpeechPrepLocale, number> = {
  ru: 0.94,
  en: 0.94,
  uz: 0.94,
}

export const TEACHER_VOICE_CLONE_SPEED: Record<SpeechPrepLocale, number> = {
  ru: 0.94,
  en: 0.94,
  uz: 0.94,
}

export const TEACHER_VOICE_OPENAI_INSTRUCTIONS = {
  ru: `Russian only. Warm male chemistry teacher, Articulate Tutor style. Calm storytelling pace, natural pauses at commas and periods. Enunciate clearly but conversationally — not robotic, not rushed.`,
  en: `Warm male teacher, natural tutor pace, gentle pauses, conversational tone.`,
} as const

/**
 * Браузерные голоса Web Speech API — учитель мужчина, поэтому МУЖСКИЕ голоса
 * первыми (Дмитрий/Pavel/Maxim/Guy), затем — самые «человечные».
 */
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
  uz: ['microsoft sardor online', 'sardor', 'google', 'uz-uz'],
}

/** Имена мужских голосов — повышаем приоритет (учитель мужчина). */
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
  'male',
]

/** Имена женских голосов — понижаем приоритет. */
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

/** Быстрее обычного темпа, но без «тараторения». */
export const TEACHER_BROWSER_RATE: Record<SpeechPrepLocale, number> = {
  ru: 1.14,
  en: 1.1,
  uz: 1.14,
}

export const TEACHER_BROWSER_PITCH: Record<SpeechPrepLocale, number> = {
  ru: 1.02,
  en: 1.0,
  uz: 1.02,
}
