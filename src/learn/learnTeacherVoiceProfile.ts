import type { SpeechPrepLocale } from './learnSpeechText'

/** Профиль голоса ИИ-учителя — мужской, чёткий, спокойный дикторский тембр. */
export const TEACHER_VOICE_EDGE: Record<SpeechPrepLocale, string> = {
  ru: 'ru-RU-DmitryNeural',
  en: 'en-US-GuyNeural',
}

/** Просодия: профессиональный диктор, чёткое произношение каждого слова. */
export const TEACHER_VOICE_EDGE_PROSODY: Record<
  SpeechPrepLocale,
  { rate: string; pitch: string; volume: string }
> = {
  ru: { rate: '+4%', pitch: '+0Hz', volume: '+0%' },
  en: { rate: '+4%', pitch: '+0Hz', volume: '+0%' },
}

export const TEACHER_VOICE_OPENAI: Record<SpeechPrepLocale, string> = {
  ru: 'onyx',
  en: 'onyx',
}

export const TEACHER_VOICE_OPENAI_SPEED: Record<SpeechPrepLocale, number> = {
  ru: 1.04,
  en: 1.04,
}

/** ElevenLabs clone — множитель скорости (1.0 = норма). */
export const TEACHER_VOICE_CLONE_SPEED: Record<SpeechPrepLocale, number> = {
  ru: 1.04,
  en: 1.04,
}

export const TEACHER_VOICE_OPENAI_INSTRUCTIONS = {
  ru: `Russian only. Professional male school teacher. Enunciate every word clearly. Natural classroom pace — not rushed. Correct grammar in speech rhythm. Pause briefly at commas.`,
  en: `Professional male teacher. Clear enunciation, natural classroom pace.`,
} as const

/** Браузер: только мужские neural / дикторские голоса. */
export const TEACHER_BROWSER_VOICE_HINTS: Record<SpeechPrepLocale, string[]> = {
  ru: [
    'dmitryneural',
    'dmitry online',
    'microsoft dmitry',
    'pavel',
    'yandex',
    'male',
    'мужской',
  ],
  en: ['guyneural', 'guy online', 'microsoft guy', 'david', 'male'],
}

export const TEACHER_BROWSER_RATE: Record<SpeechPrepLocale, number> = {
  ru: 1.04,
  en: 1.04,
}

/** Нейтральная высота — лучше разборчивость слов. */
export const TEACHER_BROWSER_PITCH = 1.0
