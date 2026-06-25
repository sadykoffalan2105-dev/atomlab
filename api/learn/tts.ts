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

type Req = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

type Res = {
  status: (code: number) => Res
  setHeader: (key: string, value: string) => void
  end: (body?: string) => void
  json: (body: unknown) => void
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined

  if (req.method === 'OPTIONS') {
    const result = learnTtsOptionsResponse(origin, runtime)
    for (const [k, v] of Object.entries(result.headers ?? {})) {
      res.setHeader(k, v)
    }
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  let body: LearnTtsRequestBody
  try {
    body =
      typeof req.body === 'string'
        ? (JSON.parse(req.body) as LearnTtsRequestBody)
        : (req.body as LearnTtsRequestBody)
  } catch {
    res.status(400).json({ error: 'invalid_json' })
    return
  }

  const fwd = req.headers['x-forwarded-for']
  const ip =
    typeof fwd === 'string'
      ? fwd.split(',')[0]?.trim()
      : Array.isArray(fwd)
        ? fwd[0]
        : 'vercel'

  const result = await processLearnTts(body, { origin, clientIp: ip ?? 'vercel', runtime })

  for (const [k, v] of Object.entries(result.headers ?? {})) {
    res.setHeader(k, v)
  }
  res.status(result.status).json({
    audioBase64: result.audioBase64,
    mimeType: result.mimeType,
    source: result.source,
    error: result.error,
  })
}
