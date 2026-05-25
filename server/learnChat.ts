import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  learnChatOptionsResponse,
  learnChatRuntimeFromEnv,
  processLearnChat,
  type LearnChatRequestBody,
} from '../src/learn/learnChatCore'

const runtime = learnChatRuntimeFromEnv(process.env as Record<string, string | undefined>)

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string') return fwd.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'local'
  return req.socket.remoteAddress ?? 'local'
}

/** POST /api/learn/chat → OpenAI (key on server only). */
export async function handleLearnChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined

  if (req.method === 'OPTIONS') {
    const result = learnChatOptionsResponse(origin, runtime)
    for (const [k, v] of Object.entries(result.headers ?? {})) {
      res.setHeader(k, v)
    }
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }

  let parsed: LearnChatRequestBody
  try {
    parsed = JSON.parse(await readBody(req)) as LearnChatRequestBody
  } catch {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'invalid_json' }))
    return
  }

  const result = await processLearnChat(parsed, { origin, clientIp: clientIp(req), runtime })

  for (const [k, v] of Object.entries(result.headers ?? {})) {
    res.setHeader(k, v)
  }
  res.statusCode = result.status
  res.setHeader('Content-Type', 'application/json')
  res.end(
    JSON.stringify({
      reply: result.reply,
      source: result.source,
      error: result.error,
    }),
  )
}
