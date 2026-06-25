import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import type { LearnTtsLocale } from '../src/learn/learnTtsCore'
import { TEACHER_VOICE_EDGE } from '../src/learn/learnTeacherVoiceProfile'

/** Edge Neural TTS (ru-RU-DmitryNeural) — мужской голос на serverless/Netlify/Vercel. */
export async function synthesizeEdgeForServerless(
  text: string,
  locale: LearnTtsLocale,
  voice?: string,
  _prepared?: boolean,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (!text.trim()) return null

  const prepLocale = locale === 'en' ? 'en' : 'ru'
  const voiceName = voice?.trim() || TEACHER_VOICE_EDGE[prepLocale]

  try {
    const tts = new MsEdgeTTS()
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    const { audioStream } = await tts.toStream(text)
    const chunks: Buffer[] = []
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk))
    }
    if (chunks.length === 0) return null
    const merged = Buffer.concat(chunks)
    return { audioBase64: merged.toString('base64'), mimeType: 'audio/mpeg' }
  } catch {
    return null
  }
}
