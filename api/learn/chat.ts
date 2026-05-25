import {
  learnChatOptionsResponse,
  learnChatRuntimeFromEnv,
  processLearnChat,
} from '../../src/learn/learnChatCore'
import type { LearnChatRequestBody } from '../../src/learn/learnChatCore'

const runtime = learnChatRuntimeFromEnv(process.env as Record<string, string | undefined>)

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
    const result = learnChatOptionsResponse(origin, runtime)
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

  let body: LearnChatRequestBody
  try {
    body =
      typeof req.body === 'string'
        ? (JSON.parse(req.body) as LearnChatRequestBody)
        : (req.body as LearnChatRequestBody)
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

  const result = await processLearnChat(body, { origin, clientIp: ip ?? 'vercel', runtime })

  for (const [k, v] of Object.entries(result.headers ?? {})) {
    res.setHeader(k, v)
  }
  res.status(result.status).json({
    reply: result.reply,
    source: result.source,
    error: result.error,
  })
}
