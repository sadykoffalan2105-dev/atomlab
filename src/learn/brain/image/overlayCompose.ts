/**
 * «Сохранить PNG» / «Копировать» в диалоге «Нарисовать»: картинка сервера (data:image/webp) + SVG-слой
 * формулы и подписи (formulaSvg.ts) склеиваются на canvas в один PNG размером с картинку.
 * Всё в браузере, без сети: data:-картинка и SVG без внешних ссылок canvas не «пачкают» (toBlob работает).
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

/** SVG-строка → data:-адрес (без Blob URL — его не нужно освобождать, и Safari рисует его на canvas). */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Картинка + SVG-слой → PNG (размер — width×height, обычно 1024² / 1216×832 / 832×1216). */
export async function composePng(imageDataUrl: string, svgString: string, size: { width: number; height: number }): Promise<Blob> {
  const width = Math.max(1, Math.round(size.width))
  const height = Math.max(1, Math.round(size.height))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d unavailable')
  const img = await loadImage(imageDataUrl)
  ctx.drawImage(img, 0, 0, width, height)
  if (svgString.trim()) {
    const layer = await loadImage(svgToDataUrl(svgString))
    ctx.drawImage(layer, 0, 0, width, height)
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}

/** Скачать файл (через временную ссылку). */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000)
}

/** Браузер умеет класть картинку в буфер обмена (иначе кнопка «Копировать» скрыта). */
export function canCopyImage(): boolean {
  try {
    return typeof ClipboardItem !== 'undefined' && typeof navigator !== 'undefined' && typeof navigator.clipboard?.write === 'function'
  } catch {
    return false
  }
}

/** PNG в буфер обмена; false — браузер не дал (нет разрешения, не HTTPS). */
export async function copyImageBlob(blob: Blob): Promise<boolean> {
  if (!canCopyImage()) return false
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })])
    return true
  } catch {
    return false
  }
}

/** Имя файла: atomlab-<presetId|draw>-<seed>.png (только латиница, цифры и «-»). */
export function pngFileName(presetId: string | null | undefined, seed: number): string {
  const id = (presetId || 'draw').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'draw'
  return `atomlab-${id}-${Math.max(0, Math.floor(seed || 0))}.png`
}
