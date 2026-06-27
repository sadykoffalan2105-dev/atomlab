/**
 * Cloudflare Worker: neural TTS (ru-RU-DmitryNeural) для GitHub Pages.
 * Бесплатный хостинг, CORS для *.github.io.
 */

const TRUSTED = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const WIN_EPOCH = 11644473600
const GEC_VER = '1-143.0.3650.96'
const VOICES = { ru: 'ru-RU-DmitryNeural', en: 'en-US-GuyNeural' }

function cors(origin) {
  const h = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Origin': '*',
  }
  if (origin && (/\.github\.io$/i.test(origin) || /\.netlify\.app$/i.test(origin))) {
    h['Access-Control-Allow-Origin'] = origin
  }
  return h
}

async function sha256HexUpper(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

async function secGec() {
  let ticks = Date.now() / 1000 + WIN_EPOCH
  ticks -= ticks % 300
  ticks *= 1e7
  return sha256HexUpper(`${ticks.toFixed(0)}${TRUSTED}`)
}

function utcTs() {
  return new Date().toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)')
}

function uuid() {
  return crypto.randomUUID().replace(/-/g, '')
}

function ssml(text, voice, lang) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
    `<voice name='${voice}'>${esc}</voice></speak>`
  )
}

function parseBin(buf) {
  if (buf.byteLength < 2) return null
  const v = new Uint8Array(buf)
  const hl = (v[0] << 8) | v[1]
  if (hl + 2 > v.length) return null
  const hdr = new TextDecoder().decode(v.subarray(2, hl + 2))
  const path = hdr.match(/Path:([^\r]+)/)?.[1]?.trim() ?? ''
  return { path, data: v.subarray(hl + 2) }
}

async function synthesize(text, locale) {
  const prep = locale === 'en' ? 'en' : 'ru'
  const voice = VOICES[prep]
  const lang = prep === 'en' ? 'en-US' : 'ru-RU'
  const xml = ssml(text, voice, lang)
  const token = await secGec()
  const url =
    `${WSS}?TrustedClientToken=${TRUSTED}` +
    `&Sec-MS-GEC=${token}&Sec-MS-GEC-Version=${GEC_VER}&ConnectionId=${uuid()}`

  return new Promise((resolve, reject) => {
    const parts = []
    const ws = new WebSocket(url)
    const timer = setTimeout(() => {
      try {
        ws.close()
      } catch {}
      reject(new Error('timeout'))
    }, 25000)

    ws.addEventListener('open', () => {
      const ts = utcTs()
      const rid = uuid()
      ws.send(
        `X-Timestamp:${ts}\rContent-Type:application/json; charset=utf-8\rPath:speech.config\r\r` +
          '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r',
      )
      ws.send(
        `X-RequestId:${rid}\rContent-Type:application/ssml+xml\rX-Timestamp:${ts}Z\rPath:ssml\r\r${xml}`,
      )
    })

    ws.addEventListener('message', (ev) => {
      if (typeof ev.data === 'string') {
        if (ev.data.includes('Path:turn.end') && parts.length) {
          clearTimeout(timer)
          const total = parts.reduce((a, p) => a + p.length, 0)
          const out = new Uint8Array(total)
          let off = 0
          for (const p of parts) {
            out.set(p, off)
            off += p.length
          }
          resolve(out)
        }
        return
      }
      const parsed = parseBin(ev.data)
      if (parsed?.path === 'audio' && parsed.data.length) parts.push(parsed.data)
    })

    ws.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new Error('ws_error'))
    })

    ws.addEventListener('close', () => {
      if (parts.length) {
        clearTimeout(timer)
        const total = parts.reduce((a, p) => a + p.length, 0)
        const out = new Uint8Array(total)
        let off = 0
        for (const p of parts) {
          out.set(p, off)
          off += p.length
        }
        resolve(out)
      }
    })
  })
}

function b64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

export default {
  async fetch(request) {
    const origin = request.headers.get('origin') ?? undefined
    const headers = { 'Content-Type': 'application/json', ...cors(origin) }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) })
    }

    const url = new URL(request.url)
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return new Response(JSON.stringify({ ok: true, service: 'atomlab-learn-tts' }), { headers })
    }

    if (request.method !== 'POST' || url.pathname !== '/api/learn/tts') {
      return new Response(JSON.stringify({ error: 'not_found', source: 'error' }), {
        status: 404,
        headers,
      })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'invalid_json', source: 'error' }), {
        status: 400,
        headers,
      })
    }

    const text = String(body.text ?? '').trim()
    if (!text) {
      return new Response(JSON.stringify({ error: 'empty_text', source: 'error' }), {
        status: 400,
        headers,
      })
    }

    try {
      const locale = body.locale === 'en' ? 'en' : 'ru'
      const audio = await synthesize(text, locale)
      if (!audio || audio.length < 200) {
        return new Response(JSON.stringify({ error: 'tts_unavailable', source: 'error' }), {
          status: 502,
          headers,
        })
      }
      return new Response(
        JSON.stringify({
          audioBase64: b64(audio),
          mimeType: 'audio/mpeg',
          source: 'edge',
        }),
        { headers },
      )
    } catch {
      return new Response(JSON.stringify({ error: 'tts_failed', source: 'error' }), {
        status: 502,
        headers,
      })
    }
  },
}
