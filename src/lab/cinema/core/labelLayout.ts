/**
 * ATOMLAB Cinema — раскладка 3D-подписей на экране (чистая логика, проверяется в Node).
 *
 * Две задачи, обе без аллокаций в кадре (буферы — у вызывающего):
 *   • зажать подпись в прямоугольник свободной области (safe area), чтобы текст
 *     не уходил под панель урока, реактор или край канваса;
 *   • развести пересекающиеся подписи по вертикали — нижняя уступает верхней.
 *
 * Размер подписи оценивается по числу символов (чтение раскладки DOM в кадре
 * запрещено): ширина ≈ длина × средняя ширина глифа + поля. Оценка намеренно
 * с запасом — лучше лишние 4 px зазора, чем налезание.
 */

export type LabelRect = { left: number; right: number; top: number; bottom: number }

/** Буферы раскладки на n подписей — создаются один раз вместе со слоем подписей. */
export type LabelLayoutBuffers = {
  x: Float32Array
  y: Float32Array
  w: Float32Array
  h: Float32Array
  /** 1 — подпись видима и участвует в раскладке */
  on: Uint8Array
  /** порядок обхода по y (индексы видимых), заполняется layoutLabels */
  order: Int32Array
}

export function createLabelLayoutBuffers(n: number): LabelLayoutBuffers {
  const m = Math.max(1, n)
  return {
    x: new Float32Array(m),
    y: new Float32Array(m),
    w: new Float32Array(m),
    h: new Float32Array(m),
    on: new Uint8Array(m),
    order: new Int32Array(m),
  }
}

/** Средняя ширина глифа и высота строки по стилю подписи, px (шрифты CinemaDomLabels). */
const GLYPH_W: Record<string, number> = { species: 8.2, ox: 7.4, delta: 8.4, token: 8.0 }
const LINE_H: Record<string, number> = { species: 17, ox: 19, delta: 17, token: 15 }
const PAD_W: Record<string, number> = { species: 4, ox: 14, delta: 4, token: 4 }

/** Оценка размера подписи в px (без чтения DOM). */
export function estimateLabelSize(kind: string, text: string, scale: number, out: { w: number; h: number }): void {
  const g = GLYPH_W[kind] ?? GLYPH_W.species!
  const lh = LINE_H[kind] ?? LINE_H.species!
  const pad = PAD_W[kind] ?? PAD_W.species!
  out.w = (text.length * g + pad) * scale
  out.h = lh * scale
}

/** Зажать центр (x, y) коробки w×h в прямоугольник с полем margin. Возвращает через буфер. */
function clampInto(b: LabelLayoutBuffers, i: number, rect: LabelRect, margin: number): void {
  const hw = b.w[i]! * 0.5 + margin
  const hh = b.h[i]! * 0.5 + margin
  const x0 = rect.left + hw
  const x1 = rect.right - hw
  const y0 = rect.top + hh
  const y1 = rect.bottom - hh
  // Область уже подписи — ставим по центру области, а не прыгаем от края к краю.
  b.x[i] = x0 <= x1 ? Math.min(x1, Math.max(x0, b.x[i]!)) : (rect.left + rect.right) * 0.5
  b.y[i] = y0 <= y1 ? Math.min(y1, Math.max(y0, b.y[i]!)) : (rect.top + rect.bottom) * 0.5
}

/**
 * Раскладка: зажим в rect (если задан) → вертикальный разнос пересекающихся
 * подписей (сверху вниз, нижняя сдвигается под верхнюю с зазором gap) → если
 * разнос вытолкнул подпись за нижний край, вся колонка поднимается, а затем
 * повторный зажим. n — число подписей; невидимые (on = 0) не участвуют.
 */
export function layoutLabels(b: LabelLayoutBuffers, n: number, rect: LabelRect | null, gap = 3, margin = 6): void {
  let m = 0
  for (let i = 0; i < n; i++) {
    if (!b.on[i]) continue
    if (rect) clampInto(b, i, rect, margin)
    // вставка по возрастанию y — подписей единицы-десятки, сортировка вставками без аллокаций
    let k = m++
    while (k > 0 && b.y[b.order[k - 1]!]! > b.y[i]!) {
      b.order[k] = b.order[k - 1]!
      k--
    }
    b.order[k] = i
  }
  for (let a = 0; a < m; a++) {
    const j = b.order[a]!
    for (let c = 0; c < a; c++) {
      const i = b.order[c]!
      const dx = Math.abs(b.x[i]! - b.x[j]!) * 2
      if (dx >= b.w[i]! + b.w[j]!) continue
      const need = (b.h[i]! + b.h[j]!) * 0.5 + gap
      if (b.y[j]! - b.y[i]! < need) b.y[j] = b.y[i]! + need
    }
  }
  if (!rect) return
  for (let a = 0; a < m; a++) {
    const i = b.order[a]!
    const over = b.y[i]! + b.h[i]! * 0.5 + margin - rect.bottom
    if (over > 0) b.y[i] = b.y[i]! - over
    clampInto(b, i, rect, margin)
  }
}

/** Пересекаются ли коробки i и j (для тестов). */
export function labelsOverlap(b: LabelLayoutBuffers, i: number, j: number): boolean {
  return (
    Math.abs(b.x[i]! - b.x[j]!) * 2 < b.w[i]! + b.w[j]! - 1e-3 &&
    Math.abs(b.y[i]! - b.y[j]!) * 2 < b.h[i]! + b.h[j]! - 1e-3
  )
}
