/**
 * Единственность коэффициентов уравнения: ядро матрицы состава (элементы × вещества).
 * Реагенты входят со знаком «+», продукты — со знаком «−»; уравнение уравнено, когда A·k = 0.
 * Если ядро одномерно и его вектор можно сделать целым положительным — это единственный
 * минимальный набор коэффициентов (как в школе: наименьшие целые). Иначе — null
 * (уравнение не уравнивается или уравнивается несколькими независимыми способами).
 * Точная арифметика на BigInt-дробях: без ошибок округления.
 */

type Frac = { n: bigint; d: bigint }

const babs = (x: bigint) => (x < 0n ? -x : x)
function bgcd(a: bigint, b: bigint): bigint {
  let x = babs(a)
  let y = babs(b)
  while (y) [x, y] = [y, x % y]
  return x
}
function frac(n: bigint, d: bigint = 1n): Frac {
  if (d < 0n) {
    n = -n
    d = -d
  }
  const g = bgcd(n, d) || 1n
  return { n: n / g, d: d / g }
}
const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d)
const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d)
const div = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n)

/**
 * counts — состав каждого вещества (реагенты, затем продукты); nReactants — сколько из них реагентов.
 * Заряд учитывается строкой «±» (charges, по умолчанию 0).
 */
export function minimalIntegerCoefficients(
  counts: readonly Readonly<Record<string, number>>[],
  nReactants: number,
  charges?: readonly number[],
): number[] | null {
  const m = counts.length
  if (m < 2) return null
  const elements = [...new Set(counts.flatMap((c) => Object.keys(c)))]
  const rows: Frac[][] = elements.map((el) => counts.map((c, j) => frac(BigInt((c[el] ?? 0) * (j < nReactants ? 1 : -1)))))
  if (charges && charges.some((q) => q !== 0)) rows.push(charges.map((q, j) => frac(BigInt(q * (j < nReactants ? 1 : -1)))))

  // приведение к ступенчатому виду
  const pivots: number[] = []
  let r = 0
  for (let col = 0; col < m && r < rows.length; col++) {
    let p = -1
    for (let i = r; i < rows.length; i++) if (rows[i]![col]!.n !== 0n) (p = p < 0 ? i : p)
    if (p < 0) continue
    ;[rows[r], rows[p]] = [rows[p]!, rows[r]!]
    const pv = rows[r]![col]!
    rows[r] = rows[r]!.map((x) => div(x, pv))
    for (let i = 0; i < rows.length; i++) {
      if (i === r || rows[i]![col]!.n === 0n) continue
      const f = rows[i]![col]!
      rows[i] = rows[i]!.map((x, j) => sub(x, mul(f, rows[r]![j]!)))
    }
    pivots.push(col)
    r++
  }
  const free = [...Array(m).keys()].filter((j) => !pivots.includes(j))
  if (free.length !== 1) return null
  const fc = free[0]!
  const v: Frac[] = Array.from({ length: m }, () => frac(0n))
  v[fc] = frac(1n)
  pivots.forEach((col, i) => {
    v[col] = frac(-rows[i]![fc]!.n, rows[i]![fc]!.d)
  })
  // к целым
  let l = 1n
  for (const x of v) l = (l * x.d) / bgcd(l, x.d)
  let ints = v.map((x) => (x.n * l) / x.d)
  let g = 0n
  for (const x of ints) g = bgcd(g, x)
  if (g === 0n) return null
  ints = ints.map((x) => x / g)
  if (ints.every((x) => x < 0n)) ints = ints.map((x) => -x)
  if (ints.some((x) => x <= 0n)) return null
  return ints.map((x) => Number(x))
}
