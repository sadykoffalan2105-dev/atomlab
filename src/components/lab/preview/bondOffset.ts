/**
 * Смещение стержней кратной связи (двойной/тройной) в ball-and-stick.
 *
 * Чистая математика без three.js — тестируется в Node.
 *
 * Стержни кратной связи раздвигаем ⟂ оси связи и в плоскости σ-скелета:
 * берём соседа одного из концов связи и проецируем вектор «конец → сосед» на
 * плоскость, ⟂ связи. Так C=C этилена лежит в плоскости молекулы, а не «торчит»
 * в камеру. Если соседа нет или все соседи на одной прямой со связью
 * (O₂, CO₂, N≡N, HC≡CH) — любой устойчивый перпендикуляр: cross(связь, Z),
 * а при связи почти вдоль Z — cross(связь, X). Z первым, потому что камера
 * превью по умолчанию смотрит вдоль −Z: смещение остаётся в плоскости экрана.
 *
 * Старый вариант (−dz, 0, dx) вырождался в (0, 1, 0) для вертикальной связи —
 * параллельно самой связи, стержни сливались; а у концов from/to знак
 * перпендикуляра был разный, и стержни перекрещивались буквой X.
 */

export type BondVec3 = readonly [number, number, number]

/** Порог «почти коллинеарно» для |sin| угла между связью и направлением на соседа. */
const MIN_NEIGHBOR_SIN = 0.12
/** Связь почти вдоль Z — перпендикуляр строим через X. */
const Z_ALIGNED_COS = 0.9

/**
 * Единичная ось смещения кратной связи i–j (пишет в out и возвращает его).
 * Для одной пары (i, j) результат одинаков при вызове с (i, j) и (j, i) с точностью
 * до знака — и это не важно: слоты раскладываются симметрично вокруг оси связи.
 */
export function resolveMultipleBondAxis(
  atoms: readonly { readonly pos: BondVec3 }[],
  bonds: readonly (readonly [number, number])[],
  i: number,
  j: number,
  out: [number, number, number],
): [number, number, number] {
  const a = atoms[i]?.pos
  const b = atoms[j]?.pos
  if (!a || !b) {
    out[0] = 1
    out[1] = 0
    out[2] = 0
    return out
  }
  let dx = b[0] - a[0]
  let dy = b[1] - a[1]
  let dz = b[2] - a[2]
  const dl = Math.hypot(dx, dy, dz)
  if (dl < 1e-9) {
    out[0] = 1
    out[1] = 0
    out[2] = 0
    return out
  }
  dx /= dl
  dy /= dl
  dz /= dl

  // Лучший сосед: максимальная ⟂-составляющая (нормированная на длину) — самая устойчивая плоскость.
  let bestSin = MIN_NEIGHBOR_SIN
  let px = 0
  let py = 0
  let pz = 0
  for (const [bi, bj] of bonds) {
    let end: BondVec3 | undefined
    let other: number
    if (bi === i || bi === j) {
      end = bi === i ? a : b
      other = bj
    } else if (bj === i || bj === j) {
      end = bj === i ? a : b
      other = bi
    } else {
      continue
    }
    if (other === i || other === j) continue
    const n = atoms[other]?.pos
    if (!n) continue
    const vx = n[0] - end[0]
    const vy = n[1] - end[1]
    const vz = n[2] - end[2]
    const vl = Math.hypot(vx, vy, vz)
    if (vl < 1e-9) continue
    const dot = vx * dx + vy * dy + vz * dz
    const ux = vx - dot * dx
    const uy = vy - dot * dy
    const uz = vz - dot * dz
    const ul = Math.hypot(ux, uy, uz)
    const sin = ul / vl
    if (sin > bestSin) {
      bestSin = sin
      px = ux / ul
      py = uy / ul
      pz = uz / ul
    }
  }
  if (bestSin > MIN_NEIGHBOR_SIN) {
    out[0] = px
    out[1] = py
    out[2] = pz
    return out
  }

  // Фолбэк: cross(d, Z) либо cross(d, X), если связь почти вдоль Z.
  if (Math.abs(dz) < Z_ALIGNED_COS) {
    // d × (0,0,1) = (dy, −dx, 0)
    px = dy
    py = -dx
    pz = 0
  } else {
    // d × (1,0,0) = (0, dz, −dy)
    px = 0
    py = dz
    pz = -dy
  }
  const pl = Math.hypot(px, py, pz) || 1
  out[0] = px / pl
  out[1] = py / pl
  out[2] = pz / pl
  return out
}

export type BondStickSegment = {
  i: number
  j: number
  from: [number, number, number]
  to: [number, number, number]
}

/** Шаг между параллельными стержнями кратной связи (в единицах модели). */
export const MULTIPLE_BOND_SPACING = 0.08

/**
 * Список стержней ball-and-stick: повторы пары в bonds = порядок связи.
 * Концы уже смещены вдоль общей оси — оба конца одного стержня на одной стороне.
 */
export function buildBondStickSegments(
  atoms: readonly { readonly pos: BondVec3 }[],
  bonds: readonly (readonly [number, number])[],
  spacing = MULTIPLE_BOND_SPACING,
): BondStickSegment[] {
  const groups = new Map<string, { i: number; j: number; count: number }>()
  for (const [i, j] of bonds) {
    const lo = Math.min(i, j)
    const hi = Math.max(i, j)
    const key = `${lo}-${hi}`
    const g = groups.get(key)
    if (g) g.count += 1
    else groups.set(key, { i: lo, j: hi, count: 1 })
  }
  const axis: [number, number, number] = [0, 0, 0]
  const out: BondStickSegment[] = []
  for (const g of groups.values()) {
    const a = atoms[g.i]?.pos
    const b = atoms[g.j]?.pos
    if (!a || !b) continue
    if (g.count <= 1) {
      out.push({ i: g.i, j: g.j, from: [a[0], a[1], a[2]], to: [b[0], b[1], b[2]] })
      continue
    }
    resolveMultipleBondAxis(atoms, bonds, g.i, g.j, axis)
    const mid = (g.count - 1) / 2
    for (let s = 0; s < g.count; s++) {
      const off = (s - mid) * spacing
      const ox = axis[0] * off
      const oy = axis[1] * off
      const oz = axis[2] * off
      out.push({
        i: g.i,
        j: g.j,
        from: [a[0] + ox, a[1] + oy, a[2] + oz],
        to: [b[0] + ox, b[1] + oy, b[2] + oz],
      })
    }
  }
  return out
}
