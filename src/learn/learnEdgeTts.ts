import type { SpeechPrepLocale } from './learnSpeechText'

/** Microsoft Edge Neural — нативный русский/английский, без API-ключа. */
export const EDGE_NEURAL_VOICE: Record<SpeechPrepLocale, string> = {
  ru: 'ru-RU-DmitryNeural',
  en: 'en-US-JennyNeural',
}

/** Просодия: чуть медленнее и спокойнее — как учитель на уроке. */
export const EDGE_NEURAL_PROSODY: Record<SpeechPrepLocale, { rate: string; pitch: string; volume: string }> = {
  ru: { rate: '-8%', pitch: '-2Hz', volume: '+0%' },
  en: { rate: '-5%', pitch: '-1Hz', volume: '+0%' },
}

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
    const voice = voiceOverride?.trim() || EDGE_NEURAL_VOICE[locale]
    const prosody = EDGE_NEURAL_PROSODY[locale]
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
