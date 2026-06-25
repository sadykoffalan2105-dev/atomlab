/**
 * Netlify Function: серверный neural TTS (ru-RU-DmitryNeural) для статичного сайта.
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

function corsHeaders(base: Record<string, string> | undefined): Record<string, string> {
  return { ...(base ?? {}) }
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin') ?? undefined

  if (req.method === 'OPTIONS') {
    const result = learnTtsOptionsResponse(origin, runtime)
    return new Response(null, { status: 204, headers: corsHeaders(result.headers) })
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
    { status: result.status, headers: corsHeaders(result.headers) },
  )
}
