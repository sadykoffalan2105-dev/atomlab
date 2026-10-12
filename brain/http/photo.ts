/**
 * «Сфотографируй задачу»: фото в последней реплике ученика (messages[-1].images — base64 без «data:…»).
 * Проверки до конвейера: не больше maxImages фото, каждое ≤ maxImageBytes после декодирования, сигнатура JPEG/PNG/WebP
 * (по первым байтам, а не по словам клиента). Тело с фото может быть больше обычного (photo.bodyLimitBytes), без фото
 * действует прежний bodyLimitBytes. Фото никуда не пишутся (в журнал — только флаг hasImage) и не кешируются;
 * лимит фото на ученика — отдельный (photoRules), поверх обычного лимита /chat; потолок фото на адрес — photoIpRules
 * (школьный NAT, config.server.rate.perIp).
 */
import type { BrainConfig, RatePerIp } from '../config.ts'
import { DEFAULT_CONFIG } from '../config.ts'
import type { RateRule } from './rateLimit.ts'

export type PhotoLimits = BrainConfig['server']['photo']

/** Лимиты фото из config.server (старый config.json без блока photo — умолчания). */
export function photoLimits(sc: Partial<Pick<BrainConfig['server'], 'photo'>>): PhotoLimits {
  return { ...DEFAULT_CONFIG.server.photo, ...(sc.photo ?? {}) }
}

const MIN = 60_000
const DAY = 24 * 60 * MIN

/** Отдельный лимит фото-запросов на ученика (минута и сутки). */
export function photoRules(p: PhotoLimits): RateRule[] {
  return [
    { name: 'photo_minute', windowMs: MIN, max: p.perMin },
    { name: 'photo_day', windowMs: DAY, max: p.perDay },
  ]
}

/** Потолок фото на один адрес (весь класс за NAT школы); имена photo_ip_* — сайт тоже понимает их как «лимит фото». */
export function photoIpRules(ip: Pick<RatePerIp, 'photoPerMin' | 'photoPerDay'>): RateRule[] {
  return [
    { name: 'photo_ip_minute', windowMs: MIN, max: ip.photoPerMin },
    { name: 'photo_ip_day', windowMs: DAY, max: ip.photoPerDay },
  ]
}

export type ImageKind = 'jpeg' | 'png' | 'webp'

/** Тип картинки по сигнатуре (магическим байтам); null — не JPEG/PNG/WebP. */
export function imageKind(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png'
  // RIFF....WEBP
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'
  return null
}

export type PhotoCheck = { ok: true; images: string[] } | { ok: false; status: 400 | 413 | 415; code: string; message: string }

const B64 = /^[A-Za-z0-9+/]+={0,2}$/

/**
 * Фото последней реплики: images отсутствует или пуст — { ok, images: [] } (обычный текстовый вопрос, старые клиенты).
 * Ошибки: 400 — не список строк / больше maxImages / не base64; 413 — фото больше maxImageBytes; 415 — не JPEG/PNG/WebP.
 * Префикс «data:image/…;base64,» терпим (снимается). Возвращает чистый base64 — его и ждёт Ollama (messages[].images).
 */
export function checkChatImages(body: unknown, lim: PhotoLimits): PhotoCheck {
  if (!body || typeof body !== 'object') return { ok: true, images: [] }
  const msgs = (body as { messages?: unknown }).messages
  if (!Array.isArray(msgs) || !msgs.length) return { ok: true, images: [] }
  const last = msgs[msgs.length - 1]
  const raw = last && typeof last === 'object' ? (last as { images?: unknown }).images : undefined
  if (raw === undefined || raw === null) return { ok: true, images: [] }
  if (!Array.isArray(raw) || raw.some((x) => typeof x !== 'string')) return { ok: false, status: 400, code: 'bad_request', message: 'images: список строк base64' }
  if (!raw.length) return { ok: true, images: [] }
  if (raw.length > lim.maxImages) return { ok: false, status: 400, code: 'too_many_images', message: `не больше ${lim.maxImages} фото в сообщении` }
  const out: string[] = []
  for (const s of raw as string[]) {
    const b64 = s.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s+/g, '')
    if (!b64 || !B64.test(b64)) return { ok: false, status: 400, code: 'bad_image', message: 'фото: нужен base64 без «data:»' }
    // размер после декодирования — по длине строки, до самого декодирования (большое фото не держим в памяти дважды)
    const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
    const bytes = Math.floor((b64.length * 3) / 4) - pad
    if (bytes > lim.maxImageBytes) return { ok: false, status: 413, code: 'image_too_large', message: `фото больше ${Math.round(lim.maxImageBytes / 1024)} КБ` }
    const head = Buffer.from(b64.slice(0, 24), 'base64')
    if (!imageKind(head)) return { ok: false, status: 415, code: 'bad_image', message: 'нужно фото JPEG, PNG или WebP' }
    out.push(b64)
  }
  return { ok: true, images: out }
}

/** Текст по умолчанию, если ученик прислал только фото (контракт: content — непустая строка). */
export const PHOTO_EMPTY_TEXT: Record<'ru' | 'uz' | 'en', string> = {
  ru: 'Объясни задачу на фото',
  uz: 'Rasmdagi masalani tushuntiring',
  en: 'Explain the task in the photo',
}

/** Фото без подписи: пустой content последней реплики заменить текстом по умолчанию на языке запроса (на месте). */
export function fillPhotoText(body: unknown): void {
  const b = body as { lang?: unknown; messages?: { content?: unknown }[] }
  const last = Array.isArray(b?.messages) ? b.messages[b.messages.length - 1] : undefined
  if (!last || typeof last !== 'object') return
  if (typeof last.content === 'string' && last.content.trim()) return
  const lang = b.lang === 'uz' || b.lang === 'en' ? b.lang : 'ru'
  last.content = PHOTO_EMPTY_TEXT[lang]
}
