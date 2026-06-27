/**
 * Neural TTS через msedge-tts (Node / Electron / Vite middleware).
 * Актуальный Sec-MS-GEC — без ручного WebSocket.
 */
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import type { SpeechPrepLocale } from './learnSpeechText'
import { TEACHER_VOICE_EDGE } from './learnTeacherVoiceProfile'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  if (typeof btoa === 'function') return btoa(binary)
  return Buffer.from(bytes).toString('base64')
}

export async function synthesizeMsEdgeTeacherSpeech(
  text: string,
  locale: SpeechPrepLocale,
  voiceOverride?: string,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (!text.trim()) return null

  const voice = voiceOverride?.trim() || TEACHER_VOICE_EDGE[locale]

  try {
    const tts = new MsEdgeTTS()
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
      voiceLocale: locale === 'en' ? 'en-US' : 'ru-RU',
    })
    const { audioStream } = tts.toStream(text)
    const chunks: Uint8Array[] = []
    for await (const chunk of audioStream) {
      chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk))
    }
    if (chunks.length === 0) return null
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const merged = new Uint8Array(total)
    let off = 0
    for (const c of chunks) {
      merged.set(c, off)
      off += c.length
    }
    return { audioBase64: bytesToBase64(merged), mimeType: 'audio/mpeg' }
  } catch {
    return null
  }
}
