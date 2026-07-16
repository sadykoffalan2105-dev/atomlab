/**
 * Edge Neural TTS через WebSocket — Node.js (Vite middleware, Vercel API).
 * Тот же протокол, что в learnEdgeTtsBrowser.ts.
 */
import type { SpeechPrepLocale } from './learnSpeechText'
import {
  TEACHER_VOICE_EDGE,
  TEACHER_VOICE_EDGE_PROSODY,
} from './learnTeacherVoiceProfile'
import { buildTeacherSsml } from './learnEdgeSsml'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WSS_BASE =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const SYNTH_TIMEOUT_MS = 22_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  if (typeof btoa === 'function') return btoa(binary)
  throw new Error('base64_unavailable')
}

function toUint8Array(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  return new Uint8Array()
}

function uuid(): string {
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

type WsLike = {
  binaryType?: string
  send: (data: string) => void
  close: () => void
  on: (event: 'open' | 'message' | 'error' | 'close', cb: (...args: unknown[]) => void) => void
}

export async function synthesizeEdgeNeuralSpeechWs(
  text: string,
  locale: SpeechPrepLocale,
  voiceOverride?: string,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (!text.trim()) return null

  const voice = voiceOverride?.trim() || TEACHER_VOICE_EDGE[locale]
  const prosody = TEACHER_VOICE_EDGE_PROSODY[locale]
  const lang = locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU'
  const ssml = buildTeacherSsml(text, voice, prosody.rate, prosody.pitch, prosody.volume, lang)

  let WebSocketImpl: new (url: string, opts?: { headers?: Record<string, string> }) => WsLike
  try {
    const mod = (await import('ws')) as { default: new (url: string, opts?: { headers?: Record<string, string> }) => WsLike }
    WebSocketImpl = mod.default
  } catch {
    return null
  }

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

    let ws: WsLike
    try {
      ws = new WebSocketImpl(url, {
        headers: {
          Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
        },
      })
    } catch {
      finish(null)
      return
    }

    ws.binaryType = 'arraybuffer'

    ws.on('open', () => {
      ws.send(
        'Content-Type:application/json; charset=utf-8\r\n' +
          'Path:speech.config\r\n\r\n' +
          '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}',
      )
      const requestId = uuid().replace(/-/g, '')
      ws.send(
        `X-RequestId:${requestId}\r\n` +
          'Content-Type:application/ssml+xml\r\n' +
          'Path:ssml\r\n\r\n' +
          ssml,
      )
    })

    ws.on('message', (data: unknown) => {
      if (typeof data === 'string') {
        if (data.includes('Path:turn.end') && audioParts.length > 0) {
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

      const raw = toUint8Array(data)
      const headerEnd = findHeaderEnd(raw)
      if (headerEnd >= 0 && headerEnd + 1 < raw.length) {
        audioParts.push(raw.subarray(headerEnd + 1))
      }
    })

    ws.on('error', () => finish(null))
    ws.on('close', () => {
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
    })
  })
}
