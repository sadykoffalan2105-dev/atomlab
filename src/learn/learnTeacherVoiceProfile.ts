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

export const TEACHER_BROWSER_VOICE_HINTS: Record<SpeechPrepLocale, string[]> = {
  ru: [
    'dmitryneural',
    'dmitry online',
    'microsoft dmitry',
    'pavel',
    'svetlananeural',
    'natural',
    'neural',
  ],
  en: ['guyneural', 'guy online', 'microsoft guy', 'david', 'natural', 'neural'],
  uz: ['dmitryneural', 'sardor', 'microsoft', 'neural'],
}

export const TEACHER_BROWSER_RATE: Record<SpeechPrepLocale, number> = {
  ru: 0.86,
  en: 0.86,
  uz: 0.86,
}

export const TEACHER_BROWSER_PITCH = 0.92
