/**
 * Кто прислал запрос: адрес ученика (для лимитов) и «владелец ли это с этого же ПК».
 *
 * За туннелем (Tailscale Funnel: https://<имя>.ts.net → http://127.0.0.1:8787) все запросы приходят с loopback,
 * а настоящий адрес — в заголовках прокси. Funnel ставит X-Forwarded-For (заменяет присланный клиентом),
 * X-Forwarded-Host, X-Forwarded-Proto и «Tailscale-Funnel-Request: ?1» (подделать нельзя — прокси его стирает).
 * Заголовкам верим ТОЛЬКО если сокет — loopback: из сети их может подставить кто угодно.
 *
 * Сырой адрес нигде не хранится: наружу — только солёный хеш (соль случайная на запуск процесса), IPv6 — по сети /64
 * (иначе один ученик обходит лимит сменой адреса внутри своей сети).
 *
 * Школьный NAT: 30 компьютеров класса выходят в интернет с ОДНОГО адреса. Поэтому лимиты «на ученика» — по паре
 * «адрес + сессия сайта» (заголовок X-Brain-Session, brainSessionId() на сайте), а по одному адресу — только щедрый
 * потолок (config.server.rate.perIp), чтобы смена сессий не обходила защиту. Нет заголовка (или он кривой) —
 * ученик = адрес, как раньше. Сессия, как и адрес, хранится только солёным хешем и только в памяти.
 */
import crypto from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import net from 'node:net'

/** Заголовки, по которым видно, что запрос шёл через прокси/туннель (а не напрямую с этого ПК). */
const PROXY_HEADERS = ['x-forwarded-for', 'x-real-ip', 'forwarded', 'x-forwarded-host', 'x-forwarded-proto', 'tailscale-funnel-request', 'cf-connecting-ip', 'via'] as const

const SALT = crypto.randomBytes(32)

/** Заголовок сессии сайта: лимиты на ученика за общим адресом школы. */
export const SESSION_HEADER = 'x-brain-session'
/** Допустимая сессия в заголовке; иное значение игнорируется (лимиты по адресу, как без заголовка). */
export const SESSION_HEADER_RE = /^[A-Za-z0-9_-]{8,64}$/

export type ClientInfo = {
  /** солёный хеш адреса (16 hex) — ключ потолка адреса; сырой адрес не хранится */
  key: string
  /**
   * ключ ученика для лимитов «на ученика»: с верной X-Brain-Session — «s» + солёный хеш пары адрес+сессия
   * (17 символов), без неё — равен key (ученик = адрес)
   */
  student: string
  /** прислана верная X-Brain-Session */
  session: boolean
  /** запрос прошёл через прокси/туннель (есть его заголовки) */
  forwarded: boolean
  /** сокет — loopback (127.0.0.0/8, ::1) */
  loopback: boolean
  /** владелец с этого же ПК: loopback, без заголовков прокси, Host — localhost/127.0.0.1 */
  local: boolean
  /** через Funnel из интернета (Tailscale-Funnel-Request) */
  funnel: boolean
}

export function isLoopback(addr: string | undefined): boolean {
  if (!addr) return false
  const a = addr.startsWith('::ffff:') ? addr.slice(7) : addr
  return a === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(a)
}

/** Host запроса — этот ПК (не чужое имя: защита от DNS rebinding для админских путей). */
export function isLocalHost(host: string | undefined): boolean {
  if (!host) return false
  const h = host.toLowerCase().replace(/:\d{1,5}$/, '')
  return h === 'localhost' || h === '[::1]' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)
}

function header(req: Pick<IncomingMessage, 'headers'>, name: string): string | undefined {
  const v = req.headers[name]
  return Array.isArray(v) ? v.join(',') : v
}

/** Адрес из «Forwarded: for=…» (RFC 7239), без порта и скобок. */
function forwardedFor(v: string): string | undefined {
  const parts = v.split(',').map((s) => s.match(/for="?\[?([^\]";,]+)\]?(?::\d+)?"?/i)?.[1]).filter(Boolean) as string[]
  return parts[parts.length - 1]
}

function clean(ip: string | undefined): string | undefined {
  if (!ip) return undefined
  let s = ip.trim().replace(/^"|"$/g, '')
  if (s.startsWith('[')) s = s.slice(1, s.indexOf(']') > 0 ? s.indexOf(']') : undefined)
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(s)) s = s.replace(/:\d+$/, '')
  if (s.startsWith('::ffff:') && net.isIPv4(s.slice(7))) s = s.slice(7)
  return net.isIP(s) ? s : undefined
}

/**
 * Адрес ученика: заголовки прокси — только с loopback-сокета. Из X-Forwarded-For берём ПРАВЫЙ адрес:
 * его дописал ближайший (наш) прокси; левые мог прислать сам клиент. Funnel присылает ровно один адрес.
 */
export function clientAddress(req: Pick<IncomingMessage, 'headers' | 'socket'>, trustProxy = true): { ip: string; forwarded: boolean; loopback: boolean } {
  const sock = req.socket?.remoteAddress ?? ''
  const loopback = isLoopback(sock)
  const forwarded = PROXY_HEADERS.some((h) => header(req, h) !== undefined)
  let ip = clean(sock) ?? 'unknown'
  if (loopback && forwarded && trustProxy) {
    const xff = header(req, 'x-forwarded-for')
    const fromXff = xff
      ?.split(',')
      .map((s) => clean(s))
      .filter(Boolean)
      .pop()
    const fwd = header(req, 'forwarded')
    ip = fromXff ?? clean(header(req, 'cf-connecting-ip')) ?? clean(header(req, 'x-real-ip')) ?? (fwd ? clean(forwardedFor(fwd)) : undefined) ?? 'proxy-unknown'
  }
  return { ip, forwarded, loopback }
}

/** Ключ лимитов: IPv4 целиком, IPv6 — сеть /64; солёный sha256, 16 hex. */
export function hashAddress(ip: string): string {
  let unit = ip
  if (net.isIPv6(ip)) {
    // развернуть «::» и взять первые 4 группы (/64)
    const [l, r = ''] = ip.split('::')
    const left = l ? l.split(':') : []
    const right = r ? r.split(':') : []
    const groups = ip.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left
    unit = groups
      .slice(0, 4)
      .map((g) => (parseInt(g || '0', 16) || 0).toString(16))
      .join(':') + '::/64'
  }
  return crypto.createHmac('sha256', SALT).update(unit).digest('hex').slice(0, 16)
}

/** Сессия сайта из X-Brain-Session или null (нет, повторена, не по формату [A-Za-z0-9_-]{8,64}). */
export function sessionFromHeader(req: Pick<IncomingMessage, 'headers'>): string | null {
  const v = req.headers[SESSION_HEADER]
  if (typeof v !== 'string') return null
  const s = v.trim()
  return SESSION_HEADER_RE.test(s) ? s : null
}

/**
 * Ключ ученика: адрес + сессия (солёный хеш; та же сессия с другого адреса — другой ученик, чужую сессию «выбрать»
 * извне нельзя). Без сессии — ключ адреса.
 */
export function studentKey(ipKey: string, session: string | null): string {
  if (!session) return ipKey
  return 's' + crypto.createHmac('sha256', SALT).update(`${ipKey}|${session}`).digest('hex').slice(0, 16)
}

export function clientInfo(req: Pick<IncomingMessage, 'headers' | 'socket'>, trustProxy = true): ClientInfo {
  const a = clientAddress(req, trustProxy)
  const key = hashAddress(a.ip)
  const session = sessionFromHeader(req)
  return {
    key,
    student: studentKey(key, session),
    session: session !== null,
    forwarded: a.forwarded,
    loopback: a.loopback,
    local: a.loopback && !a.forwarded && isLocalHost(header(req, 'host')),
    funnel: a.loopback && header(req, 'tailscale-funnel-request') !== undefined,
  }
}
