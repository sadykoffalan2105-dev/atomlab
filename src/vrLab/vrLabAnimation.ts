/** Easing и интерполяция для VR-лаборатории. */
export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

export function mixHexColors(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ] as const
  }
  try {
    const [r1, g1, b1] = parse(a)
    const [r2, g2, b2] = parse(b)
    const r = Math.round(lerp(r1, r2, t))
    const g = Math.round(lerp(g1, g2, t))
    const bl = Math.round(lerp(b1, b2, t))
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`
  } catch {
    return t < 0.5 ? a : b
  }
}

export const VR_POUR_MS = 1400
export const VR_COMBINE_MS = 1600
export const VR_REACT_MS = 2800
