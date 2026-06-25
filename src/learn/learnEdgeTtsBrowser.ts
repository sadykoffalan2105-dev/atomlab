/**
 * Microsoft Edge Neural TTS — WebSocket из браузера (без Python).
 * Протокол с Sec-MS-GEC (обязателен с 2024+) — как @travisvn/edge-tts.
 */
import {
  TEACHER_VOICE_EDGE,
  TEACHER_VOICE_EDGE_PROSODY,
} from './learnTeacherVoiceProfile'
import type { SpeechPrepLocale } from './learnSpeechText'
import { buildTeacherSsml } from './learnEdgeSsml'
import {
  EDGE_TTS_SEC_MS_GEC_VERSION,
  edgeTtsUtcTimestamp,
  generateEdgeTtsSecMsGec,
} from './edgeTtsSecMsGec'

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

function parseBinaryMessage(buf: Uint8Array): { path: string; data: Uint8Array } | null {
  if (buf.length < 2) return null
  const headerLength = (buf[0]! << 8) | buf[1]!
  if (headerLength + 2 > buf.length) return null
  const headerString = new TextDecoder().decode(buf.subarray(2, headerLength + 2))
  const headers: Record<string, string> = {}
  for (const line of headerString.split('\r\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return {
    path: headers.Path ?? '',
    data: buf.subarray(headerLength + 2),
  }
}

function ssmlMessage(requestId: string, timestamp: string, ssml: string): string {
  return (
    `X-RequestId:${requestId}\r` +
    `Content-Type:application/ssml+xml\r` +
    `X-Timestamp:${timestamp}Z\r` +
    `Path:ssml\r` +
    `\r` +
    `${ssml}`
  )
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
  const secGec = await generateEdgeTtsSecMsGec()
  const url =
    `${WSS_BASE}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${secGec}` +
    `&Sec-MS-GEC-Version=${EDGE_TTS_SEC_MS_GEC_VERSION}` +
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
      const ts = edgeTtsUtcTimestamp()
      const requestId = uuid().replace(/-/g, '')
      ws.send(
        `X-Timestamp:${ts}\r` +
          'Content-Type:application/json; charset=utf-8\r' +
          'Path:speech.config\r' +
          '\r' +
          '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r',
      )
      ws.send(ssmlMessage(requestId, ts, ssml))
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

      const parsed = parseBinaryMessage(new Uint8Array(ev.data as ArrayBuffer))
      if (parsed?.path === 'audio' && parsed.data.length > 0) {
        audioParts.push(parsed.data)
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
