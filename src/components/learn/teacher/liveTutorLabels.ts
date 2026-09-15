/**
 * Подписи состояний «мозга» по камере (эмоция, вовлечённость, темп).
 * Общие для онлайн-урока и HUD голосового опроса (BrainInsightPanel).
 */
import type { EmotionState, EngagementLevel } from '../../../learn/brain'

export type LabelLocale = 'ru' | 'en' | 'uz'

export function labelLocale(locale: string): LabelLocale {
  return locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru'
}

export const EMOTION_LABEL: Record<EmotionState, Record<LabelLocale, string>> = {
  neutral: { ru: 'спокоен', en: 'calm', uz: 'xotirjam' },
  confused: { ru: 'в замешательстве', en: 'confused', uz: 'hayron' },
  frustrated: { ru: 'напряжён', en: 'tense', uz: 'zo‘riqqan' },
  confident: { ru: 'уверен', en: 'confident', uz: 'ishonchli' },
  bored: { ru: 'скучает', en: 'bored', uz: 'zerikkan' },
  curious: { ru: 'любопытен', en: 'curious', uz: 'qiziqqan' },
  tired: { ru: 'устал', en: 'tired', uz: 'charchagan' },
}

export const ENGAGEMENT_LABEL: Record<EngagementLevel, Record<LabelLocale, string>> = {
  focused: { ru: 'вовлечён', en: 'focused', uz: 'jalb bo‘lgan' },
  distracted: { ru: 'отвлекается', en: 'distracted', uz: 'chalg‘igan' },
  absent: { ru: 'нет в кадре', en: 'out of frame', uz: 'kadrda yo‘q' },
  suspicious: { ru: 'подозрительно', en: 'suspicious', uz: 'shubhali' },
}

/** Что «мозг» делает с темпом, глядя на мимику ученика. */
export const PACE_HINT: Record<EmotionState, Record<LabelLocale, string>> = {
  neutral: { ru: 'темп ровный', en: 'steady pace', uz: 'bir tekis sur’at' },
  confused: { ru: 'объясняю проще', en: 'simplifying', uz: 'soddalashtiryapman' },
  frustrated: { ru: 'сбавляю темп', en: 'slowing down', uz: 'sur’atni pasaytiraman' },
  confident: { ru: 'ускоряюсь', en: 'speeding up', uz: 'tezlashtiraman' },
  bored: { ru: 'делаю живее', en: 'making it livelier', uz: 'jonliroq qilaman' },
  curious: { ru: 'углубляю тему', en: 'going deeper', uz: 'chuqurlashtiraman' },
  tired: { ru: 'короче и мягче', en: 'shorter & gentler', uz: 'qisqa va yumshoq' },
}

/** Тон индикатора вовлечённости (data-tone в CSS). */
export const ENGAGEMENT_TONE: Record<EngagementLevel, 'good' | 'warn' | 'mute' | 'bad'> = {
  focused: 'good',
  distracted: 'warn',
  absent: 'mute',
  suspicious: 'bad',
}
