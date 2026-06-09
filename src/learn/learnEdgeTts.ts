import type { SpeechPrepLocale } from './learnSpeechText'
import {
  TEACHER_VOICE_EDGE,
  TEACHER_VOICE_EDGE_PROSODY,
} from './learnTeacherVoiceProfile'

export { TEACHER_VOICE_EDGE as EDGE_NEURAL_VOICE, TEACHER_VOICE_EDGE_PROSODY as EDGE_NEURAL_PROSODY }

const EDGE_SYNTH_TIMEOUT_MS = 18_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

export async function synthesizeEdgeNeuralSpeech(
  text: string,
  locale: SpeechPrepLocale,
  voiceOverride?: string,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (!text.trim()) return null

  try {
    const { EdgeTTS } = await import('@travisvn/edge-tts')
    const voice = voiceOverride?.trim() || TEACHER_VOICE_EDGE[locale]
    const prosody = TEACHER_VOICE_EDGE_PROSODY[locale]
    const tts = new EdgeTTS(text, voice, prosody)

    const result = await Promise.race([
      tts.synthesize(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('edge_tts_timeout')), EDGE_SYNTH_TIMEOUT_MS),
      ),
    ])

    const buf = new Uint8Array(await result.audio.arrayBuffer())
    if (buf.length < 128) return null

    const mimeType = result.audio.type || 'audio/mpeg'
    return { audioBase64: bytesToBase64(buf), mimeType }
  } catch {
    return null
  }
}
