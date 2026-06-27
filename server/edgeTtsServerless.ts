import { synthesizeMsEdgeTeacherSpeech } from '../src/learn/learnMsEdgeTts'
import type { LearnTtsLocale } from '../src/learn/learnTtsCore'

/** Edge Neural TTS (ru-RU-DmitryNeural) — serverless / Netlify / Vercel / dev middleware. */
export async function synthesizeEdgeForServerless(
  text: string,
  locale: LearnTtsLocale,
  voice?: string,
  _prepared?: boolean,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  return synthesizeMsEdgeTeacherSpeech(text, locale === 'en' ? 'en' : 'ru', voice)
}
