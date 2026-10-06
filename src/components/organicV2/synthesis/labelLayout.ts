/**
 * Органика v2 · раскладка подписей веществ без наложений (экранные рамки, px).
 * Рамки, которые пересекаются, раздвигаются по оси наименьшего перекрытия (по половине каждой),
 * пока пересечений не останется (до 400 проходов; 16 подписей — доли миллисекунды). Чистая функция — проверяется в test-organic-v2-synthesis.
 */
export interface LabelBox {
  /** центр рамки на экране */
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** зазор между рамками, px */
export const LABEL_GAP = 4

export function spreadLabels(boxes: readonly LabelBox[], gap = LABEL_GAP): { dx: number; dy: number }[] {
  const n = boxes.length
  const x = boxes.map((b) => b.x)
  const y = boxes.map((b) => b.y)
  for (let it = 0; it < 400; it++) {
    let moved = false
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ox = (boxes[i].w + boxes[j].w) / 2 + gap - Math.abs(x[i] - x[j])
        const oy = (boxes[i].h + boxes[j].h) / 2 + gap - Math.abs(y[i] - y[j])
        if (ox <= 0 || oy <= 0) continue
        moved = true
        // по вертикали двигать дешевле (подписи стоят под молекулами в ряд) — множитель 0,6
        if (oy * 0.6 <= ox) {
          const s = y[i] < y[j] || (y[i] === y[j] && i < j) ? -1 : 1
          y[i] += (s * (oy + 0.01)) / 2
          y[j] -= (s * (oy + 0.01)) / 2
        } else {
          const s = x[i] < x[j] || (x[i] === x[j] && i < j) ? -1 : 1
          x[i] += (s * (ox + 0.01)) / 2
          x[j] -= (s * (ox + 0.01)) / 2
        }
      }
    }
    if (!moved) break
  }
  return boxes.map((b, i) => ({ dx: x[i] - b.x, dy: y[i] - b.y }))
}

/** Есть ли пересечения рамок (для теста и кадров). */
export function labelsOverlap(boxes: readonly LabelBox[], gap = 0): boolean {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const ox = (boxes[i].w + boxes[j].w) / 2 + gap - Math.abs(boxes[i].x - boxes[j].x)
      const oy = (boxes[i].h + boxes[j].h) / 2 + gap - Math.abs(boxes[i].y - boxes[j].y)
      if (ox > 1e-6 && oy > 1e-6) return true
    }
  }
  return false
}
