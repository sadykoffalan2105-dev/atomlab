/**
 * «Сфотографируй задачу» на стороне сайта: фото тетради/задачи → JPEG для мозга.
 *   • длинная сторона ≤ 1280 px, JPEG ~0,8 (обычно 150–400 КБ) — модель читает текст, а сеть школы не страдает;
 *   • перекодирование через canvas: EXIF (в том числе GPS и модель телефона) не уходит никуда;
 *   • поворот по EXIF учитывается при декодировании (createImageBitmap imageOrientation / <img> браузера);
 *   • не больше двух фото в сообщении; если JPEG всё ещё > ~1,4 МБ — качество и размер снижаются.
 * Фото уходит только на сервер мозга (streamChat images) и нигде не хранится: в ленте чата — маленькая миниатюра.
 */

export const PHOTO_MAX_SIDE = 1280
export const PHOTO_QUALITY = 0.8
export const PHOTO_MAX_COUNT = 2
/** Чуть меньше лимита сервера (1,5 МБ): запас на чужие кодировщики. */
export const PHOTO_MAX_BYTES = 1_400_000
const THUMB_SIDE = 160

export type ChatPhoto = {
  id: string
  /** JPEG в base64 без «data:» — то, что уходит мозгу */
  base64: string
  /** миниатюра (data:URL, ~5–10 КБ) для превью и ленты */
  thumb: string
  width: number
  height: number
  bytes: number
}

/** Текст по умолчанию, если ученик прислал только фото. */
export const PHOTO_DEFAULT_TEXT: Record<'ru' | 'en' | 'uz', string> = {
  ru: 'Объясни задачу',
  en: 'Explain the task',
  uz: 'Masalani tushuntiring',
}

export function photoDefaultText(lang: string | null | undefined): string {
  return PHOTO_DEFAULT_TEXT[lang === 'en' || lang === 'uz' ? lang : 'ru']
}

/** Подпись к фото — только текст по умолчанию (ученик ничего не написал сам). */
export function isPhotoDefaultText(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[.!?]+$/, '')
  return !t || Object.values(PHOTO_DEFAULT_TEXT).some((d) => d.toLowerCase() === t)
}

/** Размер под ограничение длинной стороны (без увеличения). */
export function fitSize(w: number, h: number, max = PHOTO_MAX_SIDE): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 }
  const k = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

type Drawable = { source: CanvasImageSource; width: number; height: number; close: () => void }

/** Декодировать картинку с учётом поворота по EXIF. */
async function decode(file: Blob): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
    } catch {
      /* старый Safari / неизвестный формат — пробуем через <img> */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode'))
      img.src = url
    })
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function draw(src: Drawable, w: number, h: number): HTMLCanvasElement {
  const c = canvasOf(w, h)
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('canvas')
  // прозрачный PNG → белый лист (иначе в JPEG фон станет чёрным и текст пропадёт)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src.source, 0, 0, w, h)
  return c
}

function toJpeg(c: HTMLCanvasElement, q: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', q))
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''))
    r.onerror = () => reject(r.error ?? new Error('read'))
    r.readAsDataURL(b)
  })
}

let seq = 0

/**
 * Фото с камеры / из файла → JPEG ≤ 1280 px без EXIF + миниатюра. Ошибка — не картинка или браузер не смог её
 * открыть (например, HEIC в Chrome): сайт показывает «не удалось открыть фото».
 */
export async function prepareChatPhoto(file: Blob): Promise<ChatPhoto> {
  if (file.type && !file.type.startsWith('image/')) throw new Error('not_image')
  const src = await decode(file)
  try {
    let side = PHOTO_MAX_SIDE
    let q = PHOTO_QUALITY
    for (let attempt = 0; attempt < 5; attempt++) {
      const { w, h } = fitSize(src.width, src.height, side)
      if (!w || !h) throw new Error('empty')
      const blob = await toJpeg(draw(src, w, h), q)
      if (blob.size <= PHOTO_MAX_BYTES || attempt === 4) {
        if (blob.size > PHOTO_MAX_BYTES) throw new Error('too_large')
        const t = fitSize(w, h, THUMB_SIDE)
        const thumb = draw(src, t.w, t.h).toDataURL('image/jpeg', 0.7)
        return { id: `p${Date.now().toString(36)}${(seq++).toString(36)}`, base64: await blobToBase64(blob), thumb, width: w, height: h, bytes: blob.size }
      }
      // крупный и «шумный» снимок: сначала качество, потом размер
      if (q > 0.62) q = 0.65
      else side = Math.round(side * 0.8)
    }
    throw new Error('too_large')
  } finally {
    src.close()
  }
}
