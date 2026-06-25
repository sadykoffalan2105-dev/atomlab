/**
 * Netlify Function: серверный neural TTS учителя (тот же ru-RU-DmitryNeural).
 *
 * Зачем: Microsoft Edge Read-Aloud с конца 2025 требует WebSocket-заголовки,
 * которые браузеры Chrome/Firefox/Safari выставить НЕ могут → прямой вызов из
 * браузера падает с 403. На сервере (Node) заголовки доступны, поэтому синтез
 * работает. Статичный сайт (GitHub Pages) и Netlify-сайт ходят сюда по fetch.
 */
import {
  learnTtsOptionsResponse,
  learnTtsRuntimeFromEnv,
  processLearnTts,
  registerEdgeTtsBackend,
} from '../../src/learn/learnTtsCore'
import type { LearnTtsRequestBody } from '../../src/learn/learnTtsCore'
import { synthesizeEdgeForServerless } from '../../server/edgeTtsServerless'

registerEdgeTtsBackend(synthesizeEdgeForServerless)

const runtime = learnTtsRuntimeFromEnv(process.env as Record<string, string | undefined>)

function applyHeaders(base: Record<string, string> | undefined): Headers {
  const headers = new Headers()
  for (const [k, v] of Object.entries(base ?? {})) headers.set(k, v)
  return headers
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('origin') ?? undefined

  if (req.method === 'OPTIONS') {
    const result = learnTtsOptionsResponse(origin, runtime)
    return new Response(null, { status: 204, headers: applyHeaders(result.headers) })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: LearnTtsRequestBody
  try {
    body = (await req.json()) as LearnTtsRequestBody
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const fwd = req.headers.get('x-forwarded-for') ?? ''
  const ip = fwd.split(',')[0]?.trim() || 'netlify'

  const result = await processLearnTts(body, { origin, clientIp: ip, runtime })

  return new Response(
    JSON.stringify({
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
      source: result.source,
      error: result.error,
    }),
    { status: result.status, headers: applyHeaders(result.headers) },
  )
}

export const config = { path: '/api/learn/tts' }
