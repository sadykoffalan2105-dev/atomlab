import { Communicate } from '@travisvn/edge-tts'
import type { LearnTtsLocale } from '../src/learn/learnTtsCore'
import {
  TEACHER_VOICE_EDGE,
  TEACHER_VOICE_EDGE_PROSODY,
} from '../src/learn/learnTeacherVoiceProfile'

/** Edge Neural TTS на Vercel/serverless (тот же Dmitry, что локальный Python). */
export async function synthesizeEdgeForServerless(
  text: string,
  locale: LearnTtsLocale,
  voice?: string,
  _prepared?: boolean,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (!text.trim()) return null

  const prepLocale = locale === 'en' ? 'en' : 'ru'
  const voiceName = voice?.trim() || TEACHER_VOICE_EDGE[prepLocale]
  const prosody = TEACHER_VOICE_EDGE_PROSODY[prepLocale]

  try {
    const communicate = new Communicate(text, {
      voice: voiceName,
      rate: prosody.rate,
      pitch: prosody.pitch,
      volume: prosody.volume,
      connectionTimeout: 22_000,
    })

    const parts: Buffer[] = []
    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio' && chunk.data && chunk.data.length > 0) {
        parts.push(Buffer.from(chunk.data))
      }
    }
    if (parts.length === 0) return null

    const merged = Buffer.concat(parts)
    return { audioBase64: merged.toString('base64'), mimeType: 'audio/mpeg' }
  } catch {
    return null
  }
}
