/**
 * Server-Sent Events: «event: <имя>\ndata: <JSON>\n\n». Сокет держим открытым до done/error.
 */
import type { ServerResponse } from 'node:http'

export function sseHeaders(res: ServerResponse, extra: Record<string, string> = {}): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...extra,
  })
  res.flushHeaders?.()
}

export function sseSend(res: ServerResponse, event: string, data: unknown): void {
  if (res.writableEnded || res.destroyed) return
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/** Разбор SSE-потока на стороне клиента (eval, smoke). */
export function parseSse(raw: string): { event: string; data: unknown }[] {
  const out: { event: string; data: unknown }[] = []
  for (const block of raw.split(/\n\n/)) {
    if (!block.trim()) continue
    let event = 'message'
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }
    try {
      out.push({ event, data: JSON.parse(data.join('\n')) })
    } catch {
      out.push({ event, data: data.join('\n') })
    }
  }
  return out
}
