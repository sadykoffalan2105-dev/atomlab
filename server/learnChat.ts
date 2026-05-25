import type { IncomingMessage, ServerResponse } from 'node:http'

type ChatBody = {
  system?: string
  messages?: { role: string; content: string }[]
}

/** POST /api/learn/chat → OpenAI-compatible API (key on server only). */
export async function handleLearnChat(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }

  let body = ''
  for await (const chunk of req) {
    body += chunk
  }

  let parsed: ChatBody
  try {
    parsed = JSON.parse(body) as ChatBody
  } catch {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'invalid_json' }))
    return
  }

  const apiKey = process.env.OPENAI_API_KEY ?? process.env.VITE_OPENAI_API_KEY
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

  if (!apiKey) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        reply: null,
        error: 'OPENAI_API_KEY not set — configure in .env for AI teacher',
      }),
    )
    return
  }

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: parsed.system ?? 'You are a chemistry teacher.' },
          ...(parsed.messages ?? []),
        ],
        max_tokens: 600,
        temperature: 0.4,
      }),
    })

    if (!upstream.ok) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'upstream', status: upstream.status }))
      return
    }

    const data = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const reply = data.choices?.[0]?.message?.content ?? ''
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ reply }))
  } catch (e) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: String(e) }))
  }
}
