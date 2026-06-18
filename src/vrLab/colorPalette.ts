/**
 * Палитра из 80 различимых цветов для растворов VR-лаборатории.
 * HSL-распределение: оттенок × насыщенность × яркость.
 */
const VR_LAB_PALETTE_RAW: readonly string[] = (() => {
  const out: string[] = []
  const hues = 20
  const variants = 4
  for (let h = 0; h < hues; h++) {
    for (let v = 0; v < variants; v++) {
      const hue = (h * 360) / hues + v * 4
      const sat = 62 + (v % 2) * 12
      const light = 38 + (v % 3) * 9
      out.push(`hsl(${hue}, ${sat}%, ${light}%)`)
    }
  }
  return out.slice(0, 80)
})()

export const VR_LAB_PALETTE: readonly string[] = VR_LAB_PALETTE_RAW

/** Стабильный индекс палитры по id вещества. */
export function paletteIndexForId(id: string, modulo = VR_LAB_PALETTE.length): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % modulo
}

export function colorFromPalette(id: string): string {
  return VR_LAB_PALETTE[paletteIndexForId(id)]!
}

/** HSL → hex для Three.js (упрощённо через canvas API не нужен — ручная конверсия). */
export function hslToHex(hsl: string): string {
  const m = /hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/i.exec(hsl)
  if (!m) return hsl.startsWith('#') ? hsl : '#5ad8ff'
  const h = Number(m[1]) / 360
  const s = Number(m[2]) / 100
  const l = Number(m[3]) / 100
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  let r: number
  let g: number
  let b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function resolveLiquidHex(id: string, accentFallback?: string): string {
  if (accentFallback?.startsWith('#')) {
    return saturateHex(accentFallback, 1.35)
  }
  if (accentFallback?.startsWith('hsl')) return saturateHex(hslToHex(accentFallback), 1.25)
  return saturateHex(hslToHex(colorFromPalette(id)), 1.2)
}

function saturateHex(hex: string, boost: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1]!, 16)
  let r = (n >> 16) & 255
  let g = (n >> 8) & 255
  let b = n & 255
  const avg = (r + g + b) / 3
  r = Math.min(255, Math.round(r + (r - avg) * (boost - 1) + 12))
  g = Math.min(255, Math.round(g + (g - avg) * (boost - 1) + 12))
  b = Math.min(255, Math.round(b + (b - avg) * (boost - 1) + 12))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
