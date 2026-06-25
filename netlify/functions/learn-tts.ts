/**
 * Netlify Function: neural TTS учителя (ru-RU-DmitryNeural).
 * Минимальный handler — быстрый cold start, CORS для GitHub Pages.
 */
import { learnApiCorsHeaders } from '../../src/learn/learnApiCors'
import { synthesizeEdgeForServerless } from '../../server/edgeTtsServerless'

type Body = { text?: string; locale?: 'ru' | 'en'; prepared?: boolean }

function json(
  data: unknown,
  status: number,
  origin?: string,
): Response {
  const headers = {
    'Content-Type': 'application/json',
    ...learnApiCorsHeaders(origin, []),
  }
  return new Response(JSON.stringify(data), { status, headers })
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin') ?? undefined

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: learnApiCorsHeaders(origin, []),
    })
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed', source: 'error' }, 405, origin)
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json({ error: 'invalid_json', source: 'error' }, 400, origin)
  }

  const text = (body.text ?? '').trim()
  if (!text) {
    return json({ error: 'empty_text', source: 'error' }, 400, origin)
  }

  const locale = body.locale === 'en' ? 'en' : 'ru'
  const result = await synthesizeEdgeForServerless(text, locale)

  if (!result) {
    return json({ error: 'tts_unavailable', source: 'error' }, 502, origin)
  }

  return json(
    {
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
      source: 'edge',
    },
    200,
    origin,
  )
}
