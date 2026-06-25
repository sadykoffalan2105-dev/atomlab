/**
 * Standalone HTTP-сервер neural TTS для Render / Railway / VPS.
 * Запуск: node server/tts-standalone.mjs
 */
import { createServer } from 'node:http'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

const PORT = Number(process.env.PORT ?? process.env.TTS_PORT ?? 8787)
const VOICES = { ru: 'ru-RU-DmitryNeural', en: 'en-US-GuyNeural' }

function cors(origin) {
  const allow =
    !origin ||
    /\.github\.io$/i.test(origin) ||
    /\.netlify\.app$/i.test(origin) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
      ? origin ?? '*'
      : '*'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

async function synthesize(text, locale) {
  const voice = VOICES[locale === 'en' ? 'en' : 'ru']
  const tts = new MsEdgeTTS()
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
  const { audioStream } = await tts.toStream(text)
  const chunks = []
  for await (const c of audioStream) chunks.push(Buffer.from(c))
  if (!chunks.length) return null
  const merged = Buffer.concat(chunks)
  return { audioBase64: merged.toString('base64'), mimeType: 'audio/mpeg', source: 'edge' }
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin
  const headers = { 'Content-Type': 'application/json', ...cors(origin) }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers)
    res.end()
    return
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, headers)
    res.end(JSON.stringify({ ok: true, service: 'atomlab-learn-tts' }))
    return
  }

  if (req.method !== 'POST' || req.url !== '/api/learn/tts') {
    res.writeHead(404, headers)
    res.end(JSON.stringify({ error: 'not_found', source: 'error' }))
    return
  }

  let raw = ''
  for await (const chunk of req) raw += chunk
  let body
  try {
    body = JSON.parse(raw)
  } catch {
    res.writeHead(400, headers)
    res.end(JSON.stringify({ error: 'invalid_json', source: 'error' }))
    return
  }

  const text = String(body.text ?? '').trim()
  if (!text) {
    res.writeHead(400, headers)
    res.end(JSON.stringify({ error: 'empty_text', source: 'error' }))
    return
  }

  try {
    const locale = body.locale === 'en' ? 'en' : 'ru'
    const out = await synthesize(text, locale)
    if (!out) {
      res.writeHead(502, headers)
      res.end(JSON.stringify({ error: 'tts_unavailable', source: 'error' }))
      return
    }
    res.writeHead(200, headers)
    res.end(JSON.stringify(out))
  } catch {
    res.writeHead(502, headers)
    res.end(JSON.stringify({ error: 'tts_failed', source: 'error' }))
  }
})

server.listen(PORT, () => {
  console.log(`[atomlab-tts] listening on :${PORT}`)
})
