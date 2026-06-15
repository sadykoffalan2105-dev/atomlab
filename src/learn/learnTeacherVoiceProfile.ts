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

/** Локальные системные голоса — «роботский» TTS, без Neural/Dmitry. */
export const TEACHER_BROWSER_VOICE_HINTS: Record<SpeechPrepLocale, string[]> = {
  ru: [
    'microsoft pavel',
    'google русский',
    'milena',
    'dmitri',
    'yandex',
    'ru-ru',
    'russian',
  ],
  en: [
    'microsoft david',
    'google us english',
    'samantha',
    'microsoft mark',
    'en-us',
    'english united states',
  ],
  uz: ['sardor', 'microsoft', 'google', 'uz-uz'],
}

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
