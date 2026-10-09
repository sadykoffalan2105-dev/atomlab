/**
 * Текст для VR: drei <Html> в шлеме не виден (это DOM поверх холста), поэтому подсказки, VR-доска и наручный HUD
 * рисуются на canvas-текстурах. Кэш LRU на 32 текстуры: одна и та же подсказка не перерисовывается каждый кадр.
 */
import * as THREE from 'three'

export interface TextStyle {
  readonly px?: number
  readonly maxWidth?: number
  readonly bg?: string
  readonly color?: string
  readonly weight?: number
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const LRU_MAX = 32
const cache = new Map<string, THREE.CanvasTexture>()

/** Перенос по словам в пределах ширины maxW (px); не больше maxLines строк, последняя — с многоточием. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines = 99): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (ctx.measureText(next).width <= maxW || !cur) cur = next
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines)
    let last = cut[maxLines - 1]!
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1)
    cut[maxLines - 1] = `${last}…`
    return cut
  }
  return lines
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Текстура «таблетки» с текстом (подсказка жеста над целью). Размер канвы — по тексту; aspect = w / h. */
export function makeTextTexture(text: string, style: TextStyle = {}): { texture: THREE.CanvasTexture; aspect: number } {
  const px = style.px ?? 48
  const maxWidth = style.maxWidth ?? 512
  const bg = style.bg ?? 'rgba(255,255,255,.92)'
  const color = style.color ?? '#0f172a'
  const key = `${text}|${px}|${maxWidth}|${bg}|${color}|${style.weight ?? 600}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return { texture: hit, aspect: (hit.userData as { aspect: number }).aspect }
  }
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `${style.weight ?? 600} ${px}px ${FONT}`
  ctx.font = font
  const lines = wrapText(ctx, text, maxWidth - px, 3)
  const tw = Math.min(maxWidth, Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width)) + px))
  const lh = Math.round(px * 1.2)
  const h = lh * lines.length + Math.round(px * 0.5)
  canvas.width = tw
  canvas.height = h
  ctx.font = font
  ctx.fillStyle = bg
  roundRect(ctx, 0, 0, tw, h, Math.min(h / 2, px * 0.7))
  ctx.fill()
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((l, i) => ctx.fillText(l, tw / 2, Math.round(px * 0.25) + lh * (i + 0.5)))
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.userData = { aspect: tw / h }
  cache.set(key, texture)
  if (cache.size > LRU_MAX) {
    const oldest = cache.keys().next().value as string
    cache.get(oldest)?.dispose()
    cache.delete(oldest)
  }
  return { texture, aspect: tw / h }
}

export { roundRect, FONT as XR_FONT }
