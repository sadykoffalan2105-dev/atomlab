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
  /** 1 — подпись видима и участвует в раскладке; 2 — видима, но закреплена (символ внутри шара) */
  on: Uint8Array
  /** Радиус препятствия, px, вокруг закреплённой подписи (шар атома): подвижные подписи его обходят; 0 — нет. */
  r: Float32Array
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
    r: new Float32Array(m),
    order: new Int32Array(m),
  }
}

/** Средняя ширина глифа и высота строки по стилю подписи, px (шрифты CinemaDomLabels). */
const GLYPH_W: Record<string, number> = { speciesLines: 8.2, atom: 9.6, atomDark: 9.6, species: 8.2, ox: 7.4, delta: 8.4, token: 8.0, measure: 7.6, condition: 10.5, callout: 7.4, equationPlate: 9.4 }
const LINE_H: Record<string, number> = { speciesLines: 17, atom: 18, atomDark: 18, species: 17, ox: 19, delta: 17, token: 15, measure: 20, condition: 27, callout: 18.5, equationPlate: 31 }
const PAD_W: Record<string, number> = { speciesLines: 4, atom: 2, atomDark: 2, species: 4, ox: 14, delta: 4, token: 4, measure: 16, condition: 26, callout: 28, equationPlate: 30 }
/** Подписи в несколько строк (выноска-пояснение): строки разделены переводом строки, высота — по их числу. */
const MULTILINE_PAD_H: Record<string, number> = { callout: 18, speciesLines: 2 }

/** Карточки фиксированного размера (px): pH-метр — шкала 0–14 и подпись в две строки (CinemaDomLabels). */
const FIXED_BOX: Record<string, { w: number; h: number }> = { ph: { w: 232, h: 96 } }

/** Оценка размера подписи в px (без чтения DOM). */
export function estimateLabelSize(kind: string, text: string, scale: number, out: { w: number; h: number }): void {
  const box = FIXED_BOX[kind]
  if (box) {
    out.w = box.w * scale
    out.h = box.h * scale
    return
  }
  const g = GLYPH_W[kind] ?? GLYPH_W.species!
  const lh = LINE_H[kind] ?? LINE_H.species!
  const pad = PAD_W[kind] ?? PAD_W.species!
  const padH = MULTILINE_PAD_H[kind]
  if (padH != null) {
    // самая длинная строка и число строк — без аллокаций (text.split в кадре не зовём)
    let lines = 1
    let run = 0
    let longest = 0
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) {
        lines++
        run = 0
      } else if (++run > longest) longest = run
    }
    out.w = (longest * g + pad) * scale
    out.h = (lines * lh + padH) * scale
    return
  }
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
 * Подвижная подпись i не лежит на препятствиях (шарах атомов, on = 2 и r > 0): если коробка задевает
 * круг, подпись уходит по вертикали на ту сторону, где её центр (над центром шара — вверх).
 */
function avoidObstacles(b: LabelLayoutBuffers, n: number, i: number, gap: number): void {
  const hw = b.w[i]! * 0.5
  const hh = b.h[i]! * 0.5
  for (let pass = 0; pass < 3; pass++) {
    let moved = false
    for (let j = 0; j < n; j++) {
      const r = b.r[j]!
      if (b.on[j] !== 2 || !(r > 0)) continue
      const gx = Math.max(0, Math.abs(b.x[i]! - b.x[j]!) - hw)
      if (gx >= r) continue
      const gy = Math.max(0, Math.abs(b.y[i]! - b.y[j]!) - hh)
      if (gx * gx + gy * gy >= r * r) continue
      const need = hh + Math.sqrt(r * r - gx * gx) + gap
      b.y[i] = b.y[j]! + (b.y[i]! < b.y[j]! ? -need : need)
      moved = true
    }
    if (!moved) return
  }
}

/** Задела бы подпись i с центром на высоте y шар-препятствие. */
function hitsObstacle(b: LabelLayoutBuffers, n: number, i: number, y: number): boolean {
  const hw = b.w[i]! * 0.5
  const hh = b.h[i]! * 0.5
  for (let j = 0; j < n; j++) {
    const r = b.r[j]!
    if (b.on[j] !== 2 || !(r > 0)) continue
    const gx = Math.max(0, Math.abs(b.x[i]! - b.x[j]!) - hw)
    const gy = Math.max(0, Math.abs(y - b.y[j]!) - hh)
    if (gx * gx + gy * gy < r * r) return true
  }
  return false
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
    // on = 2 — подпись закреплена (символ внутри шара): не зажимается и не разносится.
    if (b.on[i] !== 1) continue
    if (rect) clampInto(b, i, rect, margin)
    // вставка по возрастанию y — подписей единицы-десятки, сортировка вставками без аллокаций
    let k = m++
    while (k > 0 && b.y[b.order[k - 1]!]! > b.y[i]!) {
      b.order[k] = b.order[k - 1]!
      k--
    }
    b.order[k] = i
  }
  for (let a = 0; a < m; a++) avoidObstacles(b, n, b.order[a]!, gap)
  // Разнос: нижняя уступает верхней. Если после разноса подпись легла на шар, она обходит его — но не
  // ценой нового наложения на подписи выше (подпись на подписи хуже, чем подпись у края шара).
  const below = (a: number, j: number) => {
    for (let c = 0; c < a; c++) {
      const i = b.order[c]!
      const dx = Math.abs(b.x[i]! - b.x[j]!) * 2
      if (dx >= b.w[i]! + b.w[j]!) continue
      const need = (b.h[i]! + b.h[j]!) * 0.5 + gap
      if (Math.abs(b.y[j]! - b.y[i]!) >= need) continue
      // Под верхней подписью — если там не шар; иначе над ней (подпись угла под заголовком итога
      // ложилась на атом O).
      const down = b.y[i]! + need
      const up = b.y[i]! - need
      b.y[j] = hitsObstacle(b, n, j, down) && !hitsObstacle(b, n, j, up) ? up : down
    }
  }
  for (let a = 0; a < m; a++) {
    const j = b.order[a]!
    below(a, j)
    avoidObstacles(b, n, j, gap)
    below(a, j)
  }
  if (!rect) return
  for (let a = 0; a < m; a++) {
    const i = b.order[a]!
    const over = b.y[i]! + b.h[i]! * 0.5 + margin - rect.bottom
    if (over > 0) b.y[i] = b.y[i]! - over
    clampInto(b, i, rect, margin)
  }
  // Зажим мог снова положить подписи друг на друга (на телефоне обе упираются в верх кадра — «N +7 )2 )5»
  // на «O +8 )2 )6» у N₂O₅): разводим такие пары по горизонтали, каждую на половину перекрытия.
  for (let pass = 0; pass < 3; pass++) {
    let moved = false
    for (let a = 0; a < m; a++) {
      for (let c = a + 1; c < m; c++) {
        const i = b.order[a]!
        const j = b.order[c]!
        if (!labelsOverlap(b, i, j)) continue
        const need = (b.w[i]! + b.w[j]!) * 0.5 + gap - Math.abs(b.x[i]! - b.x[j]!)
        const s = b.x[i]! <= b.x[j]! ? -1 : 1
        b.x[i] = b.x[i]! + s * need * 0.5
        b.x[j] = b.x[j]! - s * need * 0.5
        clampInto(b, i, rect, margin)
        clampInto(b, j, rect, margin)
        moved = true
      }
    }
    if (!moved) break
  }
}

/** Пересекаются ли коробки i и j (для тестов). */
export function labelsOverlap(b: LabelLayoutBuffers, i: number, j: number): boolean {
  return (
    Math.abs(b.x[i]! - b.x[j]!) * 2 < b.w[i]! + b.w[j]! - 1e-3 &&
    Math.abs(b.y[i]! - b.y[j]!) * 2 < b.h[i]! + b.h[j]! - 1e-3
  )
}
