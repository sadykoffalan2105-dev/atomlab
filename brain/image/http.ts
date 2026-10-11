/**
 * HTTP картинок (диспетчер из brain/server.ts):
 *   POST /image              — SSE: accepted → queue* → progress* → done | error (сердцебиение «: hb» каждые 5 с);
 *                              ?wait=1 или Accept: application/json — один JSON {ok:true, …done} | {ok:false, error};
 *   GET  /image/presets      — 48 тем (публично, кэш 5 мин);
 *   GET  /image/<jobId>      — готовая картинка image/webp (в памяти cacheTtlMs);
 *   GET  /admin/image/status — арбитр, счётчики, видеопамять, последние задания (без текстов) — только админ;
 *   POST /admin/image/test   — синхронная проверка одной темы (установщик, live-приёмка) — только админ;
 *                              работает и при image.enabled=false: проверить ComfyUI до включения.
 * Ошибки до потока (disabled / forbidden / not_ready / bad_request / busy) — JSON со статусом, если клиент не просил
 * text/event-stream; иначе одно событие error. 429 по лимитам — всегда JSON (как у /chat).
 */
import type http from 'node:http'
import type { BrainConfig } from '../config.ts'
import type { ClientInfo } from '../http/clientIp.ts'
import { json, jsonError, readJson } from '../http/guard.ts'
import { sseComment, sseHeaders, sseSend } from '../sse.ts'
import { GRADES, PRESETS, presetFitsGrade } from './presets.ts'
import { permit, resolveRole } from './roles.ts'
import { ImageService, type ImageSink } from './service.ts'
import { ERROR_STATUS, IMAGE_MESSAGES, IMAGE_SIZES, IMAGE_STYLES, type ImageErrorCode, type ImageLang, type ImageRequest, type ImageRole } from './types.ts'

export type ImageHttpContext = {
  req: http.IncomingMessage
  res: http.ServerResponse
  url: URL
  method: string
  cors: Record<string, string>
  client: ClientInfo
  admin: boolean
  brain: { deps: { config: BrainConfig; noJournal?: boolean }; image?: ImageService }
}

/** Тело POST /image не больше 16 КБ (картинку присылать не нужно — только тема или текст). */
export const IMAGE_BODY_LIMIT = 16 * 1024
const MAX_SEED = 2 ** 48 - 1

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

/** Проверить тело запроса; строка — текст ошибки 400. */
export function validateImageRequest(body: unknown): ImageRequest | string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'нужен JSON-объект'
  const b = body as Record<string, unknown>
  const sessionId = typeof b.sessionId === 'string' ? b.sessionId.trim() : ''
  if (!sessionId || sessionId.length > 128) return 'sessionId: строка 1–128 символов'
  if (b.studentId !== undefined && (typeof b.studentId !== 'string' || b.studentId.length > 128)) return 'studentId: строка ≤ 128'
  const lang = b.lang === undefined ? 'auto' : b.lang
  if (lang !== 'ru' && lang !== 'uz' && lang !== 'en' && lang !== 'auto') return 'lang: ru | uz | en | auto'
  if (b.prompt !== undefined && typeof b.prompt !== 'string') return 'prompt: строка'
  const prompt = typeof b.prompt === 'string' ? b.prompt.trim() : ''
  if ([...prompt].length > 500) return 'prompt ≤ 500 символов'
  if (b.presetId !== undefined && (typeof b.presetId !== 'string' || b.presetId.length > 64)) return 'presetId: строка ≤ 64'
  const size = b.size === undefined ? 'square' : b.size
  if (!IMAGE_SIZES.includes(size as never)) return 'size: square | wide | tall'
  if (b.style !== undefined && !IMAGE_STYLES.includes(b.style as never)) return 'style: illustration | diagram | photo | poster'
  if (b.seed !== undefined && (typeof b.seed !== 'number' || !Number.isInteger(b.seed) || b.seed < 0 || b.seed > MAX_SEED)) return 'seed: целое 0 … 2^48−1'
  let overlay: ImageRequest['overlay']
  if (b.overlay !== undefined) {
    const o = b.overlay as Record<string, unknown> | null
    if (!o || typeof o !== 'object') return 'overlay: объект'
    if (o.formula !== undefined && (typeof o.formula !== 'string' || o.formula.length > 80)) return 'overlay.formula ≤ 80 символов'
    if (o.caption !== undefined && (typeof o.caption !== 'string' || o.caption.length > 120)) return 'overlay.caption ≤ 120 символов'
    overlay = { ...(typeof o.formula === 'string' ? { formula: o.formula } : {}), ...(typeof o.caption === 'string' ? { caption: o.caption } : {}) }
  }
  let context: ImageRequest['context']
  if (b.context !== undefined) {
    const c = b.context as Record<string, unknown> | null
    if (!c || typeof c !== 'object') return 'context: объект'
    if (c.sectionTitle !== undefined && (typeof c.sectionTitle !== 'string' || c.sectionTitle.length > 200)) return 'context.sectionTitle ≤ 200 символов'
    const place = c.place === 'chat' || c.place === 'lab' ? c.place : undefined
    context = { ...(str(c.gradeId, 8) ? { gradeId: str(c.gradeId, 8) } : {}), ...(str(c.sectionTitle, 200) ? { sectionTitle: str(c.sectionTitle, 200) } : {}), ...(place ? { place } : {}) }
  }
  if (b.teacherKey !== undefined && (typeof b.teacherKey !== 'string' || b.teacherKey.length > 256)) return 'teacherKey: строка ≤ 256'
  return {
    sessionId,
    ...(typeof b.studentId === 'string' && b.studentId ? { studentId: b.studentId } : {}),
    lang,
    ...(typeof b.presetId === 'string' && b.presetId ? { presetId: b.presetId } : {}),
    ...(prompt ? { prompt } : {}),
    size: size as ImageRequest['size'],
    ...(b.style ? { style: b.style as ImageRequest['style'] } : {}),
    ...(typeof b.seed === 'number' ? { seed: b.seed } : {}),
    ...(overlay ? { overlay } : {}),
    ...(context ? { context } : {}),
    ...(typeof b.teacherKey === 'string' ? { teacherKey: b.teacherKey } : {}),
  }
}

/** Ответ одним JSON (?wait=1, /admin/image/test): заголовки сразу, пробелы-«сердцебиение» (JSON их допускает), итог. */
function jsonWaiter(res: http.ServerResponse, cors: Record<string, string>): { sink: ImageSink; end: () => void } {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no', ...cors })
  res.flushHeaders?.()
  const hb = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(' ')
  }, 5000)
  let final: Record<string, unknown> | null = null
  return {
    sink: {
      send: (event, data) => {
        if (event === 'done') final = { ok: true, ...data }
        else if (event === 'error') {
          const { code, message, retryAfterSec } = data as { code: string; message: string; retryAfterSec?: number }
          final = { ok: false, error: { code, message }, ...(retryAfterSec ? { retryAfterSec } : {}) }
        }
      },
    },
    end: () => {
      clearInterval(hb)
      if (!res.writableEnded && !res.destroyed) res.end(JSON.stringify(final ?? { ok: false, error: { code: 'internal', message: IMAGE_MESSAGES.internal.ru } }))
    },
  }
}

function sseWriter(res: http.ServerResponse, cors: Record<string, string>): { sink: ImageSink; end: () => void } {
  sseHeaders(res, cors)
  sseComment(res, 'image')
  const hb = setInterval(() => sseComment(res, 'hb'), 5000)
  return {
    sink: { send: (event, data) => sseSend(res, event, data) },
    end: () => {
      clearInterval(hb)
      if (!res.writableEnded) res.end()
    },
  }
}

export async function handleImageRequest(c: ImageHttpContext): Promise<void> {
  const { req, res, url, method, cors, client, admin, brain } = c
  const path = url.pathname
  const cfg = brain.deps.config
  const ic = cfg.image
  const image = brain.image
  if (!image) {
    req.resume()
    return jsonError(res, 404, 'not_found', `${method} ${path.slice(0, 80)}`, cors)
  }
  const sc = cfg.server
  // как в server.ts: владелец с этого ПК и админ по ключу не ограничены
  const limited = !((sc.rate.exemptLocal && client.local) || (admin && cfg.adminToken))

  if (method === 'GET' && path === '/image/presets') {
    const grade = url.searchParams.get('grade') ?? undefined
    const lang = url.searchParams.get('lang')
    const L = lang === 'ru' || lang === 'uz' || lang === 'en' ? (lang as ImageLang) : null
    const presets = PRESETS.filter((p) => !grade || !GRADES.includes(grade as never) || presetFitsGrade(p, grade, ic.students.gradeWindow)).map((p) => ({
      id: p.id,
      ...(L ? { title: p.titles[L] } : { titles: p.titles }),
      grades: p.grades,
      topic: p.topic,
      style: p.style,
      size: p.size,
      ...(p.chapter ? { chapter: p.chapter } : {}),
    }))
    return json(res, 200, { ok: true, students: { enabled: !!ic.enabled && !!ic.students.enabled }, presets }, { ...cors, 'Cache-Control': 'public, max-age=300' })
  }

  if (method === 'GET' && /^\/image\/[0-9A-HJKMNP-TV-Z]{26}$/.test(path)) {
    const bytes = image.cache.get(path.slice('/image/'.length))
    if (!bytes) return jsonError(res, 404, 'not_found', 'картинка устарела или не найдена', cors)
    res.writeHead(200, { 'Content-Type': 'image/webp', 'Content-Length': String(bytes.length), 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff', ...cors })
    return void res.end(bytes)
  }

  if (method === 'GET' && path === '/admin/image/status') return json(res, 200, image.status(), cors)

  const isTest = method === 'POST' && path === '/admin/image/test'
  if (!(method === 'POST' && path === '/image') && !isTest) {
    req.resume()
    return jsonError(res, 404, 'not_found', `${method} ${path.slice(0, 80)}`, cors)
  }

  // ——— POST /image и /admin/image/test
  const body = await readJson(req, IMAGE_BODY_LIMIT)
  let ir: ImageRequest | string
  if (isTest) {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    ir = validateImageRequest({ sessionId: 'admin-test', lang: 'ru', presetId: typeof b.presetId === 'string' ? b.presetId : 'g8-zinc-acid', ...(b.size ? { size: b.size } : {}) })
  } else ir = validateImageRequest(body)
  if (typeof ir === 'string') return jsonError(res, 400, 'bad_request', ir, cors)
  const imgReq = ir
  const lang = ImageService.langOf(imgReq)
  const accept = String(req.headers.accept ?? '')
  const sseAccepted = /text\/event-stream/i.test(accept)
  // ответ одним JSON: ?wait=1, Accept: application/json (без text/event-stream), проверка админа; иначе — SSE
  const wantJson = isTest || url.searchParams.get('wait') === '1' || (/application\/json/i.test(accept) && !sseAccepted)
  // ошибки до потока — событием error только тому, кто явно ждёт SSE
  const wantSse = !wantJson && sseAccepted
  const role: ImageRole = isTest ? 'owner' : resolveRole(admin, imgReq.teacherKey, ic)

  /** Ошибка до потока: JSON со статусом (клиент не просил SSE) или одно событие error. */
  const early = (code: ImageErrorCode, extra: { message?: string; retryAfterSec?: number; rule?: string } = {}) => {
    const message = extra.message ?? IMAGE_MESSAGES[code][lang]
    if (code === 'rate') {
      const sec = extra.retryAfterSec ?? 10
      return json(res, 429, { ok: false, error: 'rate', code: 'rate', rule: extra.rule ?? 'image_streams', retryAfterSec: sec, message }, { ...cors, 'Retry-After': String(sec) })
    }
    if (!wantSse) {
      return jsonError(res, ERROR_STATUS[code], code, message, extra.retryAfterSec ? { ...cors, 'Retry-After': String(extra.retryAfterSec) } : cors, extra.retryAfterSec ? { retryAfterSec: extra.retryAfterSec } : {})
    }
    sseHeaders(res, cors)
    sseSend(res, 'error', { code, message, ...(extra.retryAfterSec ? { retryAfterSec: extra.retryAfterSec } : {}) })
    res.end()
  }

  const p = permit(role, imgReq, isTest ? { ...ic, enabled: true } : ic)
  if (!p.ok) return early(p.code, p.code === 'bad_request' ? { message: badRequestText(p.detail, lang) } : {})
  if (!(await image.ensureReady())) return early('not_ready')
  const r = image.reserve(client.key, limited && !isTest)
  if (!r.ok) return early(r.code, { retryAfterSec: r.retryAfterSec, rule: r.rule })

  const ac = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) ac.abort()
  })
  const out = wantJson ? jsonWaiter(res, cors) : sseWriter(res, cors)
  try {
    await image.run({ req: imgReq, role, permit: p, lang, clientKey: client.key, local: client.local, signal: ac.signal, release: r.release }, out.sink)
  } finally {
    r.release()
    out.end()
  }
}

const BAD_REQUEST_TEXT: Record<string, Record<ImageLang, string>> = {
  presets_only: IMAGE_MESSAGES.bad_request,
  preset_required: IMAGE_MESSAGES.bad_request,
  preset_grade: {
    ru: 'Эта тема — из учебника другого класса. Выберите тему своего класса из списка.',
    uz: 'Bu mavzu boshqa sinf darsligidan. Roʻyxatdan oʻz sinfingiz mavzusini tanlang.',
    en: 'This topic is from another grade’s textbook. Please pick a topic for your grade from the list.',
  },
  unknown_preset: IMAGE_MESSAGES.bad_request,
  free_text_off: IMAGE_MESSAGES.bad_request,
  preset_or_prompt: {
    ru: 'Выберите тему из списка или опишите, что нарисовать.',
    uz: 'Roʻyxatdan mavzu tanlang yoki nima chizishni yozing.',
    en: 'Pick a topic from the list or describe what to draw.',
  },
}

function badRequestText(detail: string, lang: ImageLang): string {
  return (BAD_REQUEST_TEXT[detail] ?? IMAGE_MESSAGES.bad_request)[lang]
}
