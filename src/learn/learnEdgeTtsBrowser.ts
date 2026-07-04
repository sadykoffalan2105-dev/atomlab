/**
 * Microsoft Edge Neural TTS — WebSocket из браузера.
 * Протокол совпадает с msedge-tts@2.x (Sec-MS-GEC 143.x).
 */
import {
  TEACHER_VOICE_EDGE,
  TEACHER_VOICE_EDGE_PROSODY,
  edgeLangForLocale,
} from './learnTeacherVoiceProfile'
import type { SpeechPrepLocale } from './learnSpeechText'
import {
  EDGE_TTS_SEC_MS_GEC_VERSION,
  generateEdgeTtsSecMsGec,
} from './edgeTtsSecMsGec'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WSS_BASE =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const SYNTH_TIMEOUT_MS = 24_000
const JSON_XML_DELIM = '\r\n\r\n'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

function escapeSsmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildSsml(text: string, voice: string, lang: string, rate: string, pitch: string, volume: string): string {
  const body = escapeSsmlText(text)
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}">` +
    `<voice name="${voice}"><prosody pitch="${pitch}" rate="${rate}" volume="${volume}">${body}</prosody></voice></speak>`
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
  const lang = edgeLangForLocale(locale)
  const ssml = buildSsml(text, voice, lang, prosody.rate, prosody.pitch, prosody.volume)

  const connectionId = randomHex(16)
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
      ws.send(
        `Content-Type:application/json; charset=utf-8\r\nPath:speech.config${JSON_XML_DELIM}` +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: {
                    sentenceBoundaryEnabled: 'false',
                    wordBoundaryEnabled: 'false',
                  },
                  outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
                },
              },
            },
          }),
      )
      const requestId = randomHex(16)
      ws.send(
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml${JSON_XML_DELIM}${ssml}`,
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

      const raw = new Uint8Array(ev.data as ArrayBuffer)
      const delim = new TextEncoder().encode(JSON_XML_DELIM)
      let headerEnd = -1
      outer: for (let i = 0; i <= raw.length - delim.length; i++) {
        for (let j = 0; j < delim.length; j++) {
          if (raw[i + j] !== delim[j]) continue outer
        }
        headerEnd = i + delim.length - 1
        break
      }
      if (headerEnd >= 0 && headerEnd + 1 < raw.length) {
        audioParts.push(raw.subarray(headerEnd + 1))
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
