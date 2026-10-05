/**
 * Органика v2 · синтез — маленькая векторная математика без three.js (сценарий считается и в тестах на Node).
 */
export type V3 = [number, number, number]

export const v3 = (x = 0, y = 0, z = 0): V3 => [x, y, z]
export const add = (a: readonly number[], b: readonly number[]): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: readonly number[], k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: readonly number[], b: readonly number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: readonly number[], b: readonly number[]): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const len = (a: readonly number[]): number => Math.hypot(a[0], a[1], a[2])
export const dist = (a: readonly number[], b: readonly number[]): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
export function norm(a: readonly number[], fallback: V3 = [1, 0, 0]): V3 {
  const l = len(a)
  return l < 1e-9 ? [...fallback] as V3 : [a[0] / l, a[1] / l, a[2] / l]
}
export const lerp3 = (a: readonly number[], b: readonly number[], s: number): V3 => [
  a[0] + (b[0] - a[0]) * s,
  a[1] + (b[1] - a[1]) * s,
  a[2] + (b[2] - a[2]) * s,
]

export function centroid(ps: readonly (readonly number[])[], w?: readonly number[]): V3 {
  let x = 0
  let y = 0
  let z = 0
  let sw = 0
  ps.forEach((p, i) => {
    const k = w ? w[i] : 1
    x += p[0] * k
    y += p[1] * k
    z += p[2] * k
    sw += k
  })
  return sw > 0 ? [x / sw, y / sw, z / sw] : [0, 0, 0]
}

/** Матрица 3×3 построчно. */
export type M3 = [number, number, number, number, number, number, number, number, number]
export const IDENT: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]
export const mulMV = (m: M3, v: readonly number[]): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
]

/** Поворот, переводящий единичный a в единичный b (формула Родрига). */
export function rotateOnto(a: V3, b: V3): M3 {
  const v = cross(a, b)
  const c = dot(a, b)
  if (c > 1 - 1e-9) return [...IDENT] as M3
  if (c < -1 + 1e-9) {
    // разворот на 180° вокруг любой оси ⟂ a
    const ax = norm(cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]))
    const [x, y, z] = ax
    return [2 * x * x - 1, 2 * x * y, 2 * x * z, 2 * x * y, 2 * y * y - 1, 2 * y * z, 2 * x * z, 2 * y * z, 2 * z * z - 1]
  }
  const k = 1 / (1 + c)
  const [x, y, z] = v
  return [
    1 - k * (y * y + z * z), -z + k * x * y, y + k * x * z,
    z + k * x * y, 1 - k * (x * x + z * z), -x + k * y * z,
    -y + k * x * z, x + k * y * z, 1 - k * (x * x + y * y),
  ]
}

/** Собственные векторы симметричной матрицы n×n (метод Якоби). Возвращает значения и векторы-столбцы. */
export function jacobiEigen(a0: number[][]): { values: number[]; vectors: number[][] } {
  const n = a0.length
  const a = a0.map((r) => [...r])
  const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j): number => (i === j ? 1 : 0)))
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q]
    if (off < 1e-14) break
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q])
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k++) {
          const akp = a[k][p]
          const akq = a[k][q]
          a[k][p] = c * akp - s * akq
          a[k][q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k]
          const aqk = a[q][k]
          a[p][k] = c * apk - s * aqk
          a[q][k] = s * apk + c * aqk
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p]
          const vkq = v[k][q]
          v[k][p] = c * vkp - s * vkq
          v[k][q] = s * vkp + c * vkq
        }
      }
    }
  }
  return { values: a.map((r, i) => r[i]), vectors: v }
}

/**
 * Наилучший поворот (Кабш/Хорн, кватернион): R·(q − cq) + cp ≈ p. Веса — у H поменьше, чтобы скелет совпадал точнее.
 */
export function kabsch(q: readonly V3[], p: readonly V3[], w: readonly number[]): { R: M3; cq: V3; cp: V3 } {
  const cq = centroid(q, w)
  const cp = centroid(p, w)
  if (q.length < 2) return { R: [...IDENT] as M3, cq, cp }
  let Sxx = 0, Sxy = 0, Sxz = 0, Syx = 0, Syy = 0, Syz = 0, Szx = 0, Szy = 0, Szz = 0
  for (let i = 0; i < q.length; i++) {
    const a = sub(q[i], cq)
    const b = sub(p[i], cp)
    const k = w[i]
    Sxx += k * a[0] * b[0]; Sxy += k * a[0] * b[1]; Sxz += k * a[0] * b[2]
    Syx += k * a[1] * b[0]; Syy += k * a[1] * b[1]; Syz += k * a[1] * b[2]
    Szx += k * a[2] * b[0]; Szy += k * a[2] * b[1]; Szz += k * a[2] * b[2]
  }
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ]
  const { values, vectors } = jacobiEigen(N)
  let best = 0
  for (let i = 1; i < 4; i++) if (values[i] > values[best]) best = i
  const [w0, x, y, z] = [vectors[0][best], vectors[1][best], vectors[2][best], vectors[3][best]]
  const R: M3 = [
    w0 * w0 + x * x - y * y - z * z, 2 * (x * y - w0 * z), 2 * (x * z + w0 * y),
    2 * (x * y + w0 * z), w0 * w0 - x * x + y * y - z * z, 2 * (y * z - w0 * x),
    2 * (x * z - w0 * y), 2 * (y * z + w0 * x), w0 * w0 - x * x - y * y + z * z,
  ]
  return { R, cq, cp }
}

/** Главные оси облака точек: столбцы по убыванию разброса (x — самая длинная ось). */
export function principalAxes(ps: readonly V3[]): { axes: [V3, V3, V3]; c: V3 } {
  const c = centroid(ps)
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (const p of ps) {
    const d = sub(p, c)
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j]
  }
  const { values, vectors } = jacobiEigen(C)
  const order = [0, 1, 2].sort((i, j) => values[j] - values[i])
  const col = (k: number): V3 => [vectors[0][k], vectors[1][k], vectors[2][k]]
  const a0 = norm(col(order[0]))
  let a1 = norm(col(order[1]))
  a1 = norm(sub(a1, scale(a0, dot(a0, a1))), [0, 1, 0])
  const a2 = cross(a0, a1)
  return { axes: [a0, a1, a2], c }
}

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
export const easeInOut = (x: number): number => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
