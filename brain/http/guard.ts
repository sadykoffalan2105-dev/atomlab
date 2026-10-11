/**
 * Защита публичного сервера: CORS по списку из конфига, ключ админа, чтение тела с лимитом и проверкой типа,
 * ответы JSON без внутренностей (путей, стеков).
 */
import crypto from 'node:crypto'
import type http from 'node:http'
import type { BrainConfig } from '../config.ts'
import type { ClientInfo } from './clientIp.ts'

/** Заголовок ключа админа. */
export const ADMIN_HEADER = 'x-brain-admin'

/**
 * Origin: null — запрос без Origin (curl, скрипты, сам сервер): CORS не нужен; строка — разрешён (её и вернуть
 * в Access-Control-Allow-Origin); false — чужой сайт (403).
 */
export function checkOriginWith(origin: string | undefined, cfg: Pick<BrainConfig['server'], 'corsOrigins' | 'corsLocalhost'>): string | null | false {
  if (!origin) return null
  const o = origin.replace(/\/+$/, '')
  if (cfg.corsOrigins.some((a) => a.replace(/\/+$/, '').toLowerCase() === o.toLowerCase())) return origin
  if (cfg.corsLocalhost && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i.test(o)) return origin
  return false
}

export function corsHeaders(origin: string | null, req: http.IncomingMessage): Record<string, string> {
  if (!origin) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Brain-Admin',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    // сайт с GitHub Pages ходит на http://127.0.0.1 ноутбука владельца (Private Network Access в Chrome)
    ...(req.headers['access-control-request-private-network'] ? { 'Access-Control-Allow-Private-Network': 'true' } : {}),
  }
}

/** Сравнение ключей за постоянное время (по хешам: длины не утекают). */
function sameSecret(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest()
  const hb = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}

/**
 * Админ? Ключ задан — нужен заголовок X-Brain-Admin с ним (откуда угодно). Ключ пуст — только владелец с этого же ПК
 * (loopback без заголовков прокси, Host — localhost): через туннель админских путей нет вообще.
 */
export function isAdmin(req: http.IncomingMessage, client: ClientInfo, adminToken: string): boolean {
  const token = adminToken.trim()
  const got = req.headers[ADMIN_HEADER]
  const v = Array.isArray(got) ? got[0] : got
  if (token) return typeof v === 'string' && v.length > 0 && sameSecret(v.trim(), token)
  return client.local
}

const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

export function json(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  if (res.headersSent) {
    res.end()
    return
  }
  const data = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(data)), ...SECURITY_HEADERS, ...headers })
  res.end(data)
}

export function jsonError(res: http.ServerResponse, status: number, code: string, message: string, headers: Record<string, string> = {}, extra: Record<string, unknown> = {}): void {
  json(res, status, { ok: false, error: { code, message }, ...extra }, headers)
}

/** POST-тело только JSON: text/plain и формы (без preflight CORS) отклоняются — 415. */
export function isJsonContentType(req: http.IncomingMessage): boolean {
  const ct = String(req.headers['content-type'] ?? '').toLowerCase()
  return /^application\/json\s*(;|$)/.test(ct)
}

export class BodyError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** Тело запроса не больше limit байт (по Content-Length сразу, иначе — по мере чтения): иначе 413. */
export function readBody(req: http.IncomingMessage, limit: number): Promise<string> {
  const declared = Number(req.headers['content-length'])
  if (Number.isFinite(declared) && declared > limit) {
    req.resume() // дочитать в никуда, чтобы ответ 413 дошёл до клиента
    return Promise.reject(new BodyError(413, 'too_large', `тело больше ${limit} байт`))
  }
  return new Promise((resolve, reject) => {
    let size = 0
    let over = false
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      if (over) return
      size += c.length
      if (size > limit) {
        over = true
        chunks.length = 0
        reject(new BodyError(413, 'too_large', `тело больше ${limit} байт`))
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      if (!over) resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', (e) => {
      if (!over) reject(e)
    })
  })
}

/** Разобрать JSON тела; BodyError 400/413/415 — готовый ответ. */
export async function readJson(req: http.IncomingMessage, limit: number): Promise<unknown> {
  if (!isJsonContentType(req)) throw new BodyError(415, 'unsupported_media_type', 'нужен Content-Type: application/json')
  const raw = await readBody(req, limit)
  try {
    return JSON.parse(raw)
  } catch {
    throw new BodyError(400, 'bad_request', 'нужен JSON')
  }
}

/** Лимиты /chat до конвейера: сообщений ≤ maxMessages, каждое ≤ maxMessageChars (строка — текст ошибки 400). */
export function checkChatLimits(body: unknown, s: Pick<BrainConfig['server'], 'maxMessages' | 'maxMessageChars'>): string | null {
  if (!body || typeof body !== 'object') return null
  const msgs = (body as { messages?: unknown }).messages
  if (!Array.isArray(msgs)) return null
  if (msgs.length > s.maxMessages) return `messages: не больше ${s.maxMessages}`
  for (const m of msgs) {
    const c = m && typeof m === 'object' ? (m as { content?: unknown }).content : undefined
    if (typeof c === 'string' && c.length > s.maxMessageChars) return `content ≤ ${s.maxMessageChars} символов`
  }
  return null
}
