import type { SpeechPrepLocale } from './learnSpeechText'
import { TEACHER_VOICE_CLONE_SPEED } from './learnTeacherVoiceProfile'
import teacherVoiceBundle from '../data/teacherElevenLabsVoice.json'

export type ElevenLabsTtsConfig = {
  apiKey?: string
  voiceId?: string
  modelId?: string
}

const DEFAULT_MODEL = 'eleven_multilingual_v2'

function loadBundledVoiceId(): string | undefined {
  const id = (teacherVoiceBundle as { voiceId?: string }).voiceId?.trim()
  return id || undefined
}

function resolveVoiceId(config: ElevenLabsTtsConfig): string | null {
  if (config.voiceId?.trim()) return config.voiceId.trim()
  const bundled = loadBundledVoiceId()
  return bundled ?? null
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

/**
 * Озвучка клонированным голосом — каждое слово в тембре образца MP3.
 * Требует ELEVENLABS_API_KEY + voice id (npm run clone:teacher-voice).
 */
export async function synthesizeClonedTeacherSpeech(
  text: string,
  locale: SpeechPrepLocale,
  config: ElevenLabsTtsConfig,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  const apiKey = config.apiKey?.trim()
  if (!apiKey || !text.trim()) return null

  const voiceId = resolveVoiceId(config)
  if (!voiceId) return null

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: config.modelId ?? DEFAULT_MODEL,
      language_code: locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru',
      apply_text_normalization: 'on',
      voice_settings: {
        stability: 0.68,
        similarity_boost: 0.78,
        style: 0.0,
        use_speaker_boost: true,
        speed: TEACHER_VOICE_CLONE_SPEED[locale],
      },
    }),
  })

  if (!res.ok) return null

  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length < 128) return null

  return { audioBase64: bytesToBase64(bytes), mimeType: 'audio/mpeg' }
}

export function elevenLabsConfigured(config: ElevenLabsTtsConfig): boolean {
  return !!(config.apiKey?.trim() && resolveVoiceId(config))
}
