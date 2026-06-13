/**
 * Microsoft Edge Neural TTS — прямой WebSocket из браузера (без Node.js).
 */
import {
  TEACHER_VOICE_EDGE,
  TEACHER_VOICE_EDGE_PROSODY,
} from './learnTeacherVoiceProfile'
import type { SpeechPrepLocale } from './learnSpeechText'
import { buildTeacherSsml } from './learnEdgeSsml'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WSS_BASE =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const SYNTH_TIMEOUT_MS = 18_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function findHeaderEnd(buf: Uint8Array): number {
  for (let i = 0; i < buf.length - 3; i++) {
    if (buf[i] === 0x0d && buf[i + 1] === 0x0a && buf[i + 2] === 0x0d && buf[i + 3] === 0x0a) {
      return i + 3
    }
  }
  return -1
}

export async function synthesizeEdgeNeuralSpeechBrowser(
  text: string,
  locale: SpeechPrepLocale,
  voiceOverride?: string,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (!text.trim() || typeof WebSocket === 'undefined') return null

  const voice = voiceOverride?.trim() || TEACHER_VOICE_EDGE[locale]
  const prosody = TEACHER_VOICE_EDGE_PROSODY[locale]
  const lang = locale === 'en' ? 'en-US' : 'ru-RU'
  const ssml = buildTeacherSsml(
    text,
    voice,
    prosody.rate,
    prosody.pitch,
    prosody.volume,
    lang,
  )

  const connectionId = uuid().replace(/-/g, '')
  const url =
    `${WSS_BASE}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&ConnectionId=${connectionId}`

  return new Promise((resolve) => {
    const audioParts: Uint8Array[] = []
    let settled = false

    const finish = (result: { audioBase64: string; mimeType: string } | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      resolve(result)
    }

    const timer = setTimeout(() => finish(null), SYNTH_TIMEOUT_MS)

    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch {
      finish(null)
      return
    }

    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      const requestId = uuid().replace(/-/g, '')
      ws.send(
        'Content-Type:application/json; charset=utf-8\r\n' +
          'Path:speech.config\r\n\r\n' +
          '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}',
      )
      ws.send(
        `X-RequestId:${requestId}\r\n` +
          'Content-Type:application/ssml+xml\r\n' +
          'Path:ssml\r\n\r\n' +
          ssml,
      )
    }

    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        if (ev.data.includes('Path:turn.end') && audioParts.length > 0) {
          const total = audioParts.reduce((a, p) => a + p.length, 0)
          const merged = new Uint8Array(total)
          let off = 0
          for (const p of audioParts) {
            merged.set(p, off)
            off += p.length
          }
          finish({ audioBase64: bytesToBase64(merged), mimeType: 'audio/mpeg' })
        }
        return
      }

      const buf = new Uint8Array(ev.data as ArrayBuffer)
      const headerEnd = findHeaderEnd(buf)
      if (headerEnd >= 0 && headerEnd + 1 < buf.length) {
        audioParts.push(buf.subarray(headerEnd + 1))
      }
    }

    ws.onerror = () => finish(null)
    ws.onclose = () => {
      if (settled) return
      if (audioParts.length > 0) {
        const total = audioParts.reduce((a, p) => a + p.length, 0)
        const merged = new Uint8Array(total)
        let off = 0
        for (const p of audioParts) {
          merged.set(p, off)
          off += p.length
        }
        finish({ audioBase64: bytesToBase64(merged), mimeType: 'audio/mpeg' })
      } else {
        finish(null)
      }
    }
  })
}
