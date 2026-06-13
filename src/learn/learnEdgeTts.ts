import type { SpeechPrepLocale } from './learnSpeechText'
import {
  TEACHER_VOICE_EDGE,
  TEACHER_VOICE_EDGE_PROSODY,
} from './learnTeacherVoiceProfile'
import { synthesizeEdgeNeuralSpeechBrowser } from './learnEdgeTtsBrowser'

export { TEACHER_VOICE_EDGE as EDGE_NEURAL_VOICE, TEACHER_VOICE_EDGE_PROSODY as EDGE_NEURAL_PROSODY }

/** Node-only Edge TTS (Vite middleware, Vercel API). */
export async function synthesizeEdgeNeuralSpeechNode(
  text: string,
  locale: SpeechPrepLocale,
  voiceOverride?: string,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (!text.trim()) return null
  const { synthesizeEdgeNeuralSpeechWs } = await import('./learnEdgeTtsNode')
  return synthesizeEdgeNeuralSpeechWs(text, locale, voiceOverride)
}

/** Neural TTS в браузере — только WebSocket. */
export async function synthesizeEdgeNeuralSpeech(
  text: string,
  locale: SpeechPrepLocale,
  voiceOverride?: string,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (!text.trim()) return null

  if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
    return synthesizeEdgeNeuralSpeechBrowser(text, locale, voiceOverride)
  }

  return synthesizeEdgeNeuralSpeechNode(text, locale, voiceOverride)
}
