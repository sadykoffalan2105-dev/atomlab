/**
 * ATOMLAB Cinema kit — ФРАГМЕНТ КРИСТАЛЛИЧЕСКОЙ РЕШЁТКИ из базиса ядра.
 *
 * Единственный источник геометрии — `CRYSTAL_DATA[id]` (crystalData.ts): параметры ячейки, углы,
 * установка и `basis` — полное содержимое конвенциональной ячейки (дроби, элементы, заряды).
 * Здесь нет ни одного числа химии: только трансляции ячейки, матрица «дроби → пм» и пересчёт
 * расстояний. Всё строится ОДИН раз (useMemo / модуль сцены), в кадре — только чтение массивов.
 *
 * Законы документа (OPUS-3D-FORMATION-11), которые обеспечивает генератор:
 *  • фрагмент — ЦЕЛОЕ число ячеек (nx × ny × nz); includeBoundary добавляет атомы на гранях, рёбрах
 *    и вершинах, чтобы куб был замкнут: NaCl 2×2×2 → 5 ионов по ребру, 125 ионов;
 *  • рёбра элементарных ячеек — отдельный список отрезков (для гексагональной установки —
 *    ромбическая призма ячейки с γ = 120°), рисуются слоем CinemaCellEdges, не связями;
 *  • КЧ каждого узла считается по ПЕРИОДИЧЕСКОЙ решётке (у узла на краю фрагмента соседей меньше,
 *    но его КЧ — как в кристалле);
 *  • оси: кристаллографическая c смотрит ВВЕРХ (ось Y сцены) — слои графита и глёта лежат
 *    горизонтально. Поворот собственный (det = +1), поэтому энантиоморф кварца P3₂21 не зеркалится.
 */
import { getCrystal, type CrystalDatum, type ElementSymbol } from '../../../../chemistry/data'
import { pmToScene } from './cpkAtoms'

export type Vec3 = [number, number, number]

export type LatticeSite = {
  el: ElementSymbol
  /** формальный заряд иона из базиса; у ковалентных каркасов и металлов 0 */
  charge: number
  /** позиция в мировых единицах сцены (pmToScene), уже с учётом center */
  posScene: Vec3
  /** дробные координаты В ФРАГМЕНТЕ: целая часть — номер ячейки, 0…n включительно */
  frac: Vec3
  /** координационное число узла в бесконечном кристалле (по периодическому окружению) */
  cn: number
  /** индекс атома в CrystalDatum.basis */
  basisIndex: number
}

/** Связь фрагмента: индексы узлов и длина, пм. */
export type LatticeBond = [number, number, number]

export type LatticeSegment = [Vec3, Vec3]

export type LatticeBounds = {
  min: Vec3
  max: Vec3
  center: Vec3
  /** радиус описанной сферы вокруг center, мировые единицы */
  radius: number
}

export type LatticeFragment = {
  crystalId: string
  cells: Vec3
  sites: LatticeSite[]
  bonds: LatticeBond[]
  cellEdges: LatticeSegment[]
  boundsScene: LatticeBounds
  /** позиции узлов в пм (без center) — для точных пересчётов в тестах и coordinationShell */
  posPm: Vec3[]
  /** сдвиг center в мировых единицах: posScene = pmToScene(posPm) + offset */
  offsetScene: Vec3
}

export type LatticeOptions = {
  /** сдвинуть фрагмент так, чтобы центр рамки ячеек был в начале координат; по умолчанию true */
  center?: boolean
  /**
   * Порог связи, пм. Без него — «первая координационная сфера» каждого узла: соседи не дальше
   * FIRST_SHELL_RATIO × кратчайшего расстояния узла (у обоих концов связи).
   */
  cutoffPm?: number
  /** добавить атомы на гранях/рёбрах/вершинах, замыкающие фрагмент; по умолчанию true */
  includeBoundary?: boolean
}

/**
 * Граница первой координационной сферы относительно кратчайшего расстояния узла.
 * Не число химии, а правило разбиения: самая широкая первая сфера в наших структурах — массикот
 * (222.1…248.1 пм, отношение 1.117), самая близкая вторая — ОЦК-металл (a / (a√3/2) = 1.155).
 * 1.13 лежит между ними с запасом в обе стороны; тест проверяет однозначность разбиения.
 */
export const FIRST_SHELL_RATIO = 1.13

const EPS_FRAC = 1e-6

// ─── Ячейка ─────────────────────────────────────────────────────────────────

/** Векторы ячейки в пм, в системе сцены (c → +Y). Кэш по id — матрица считается один раз. */
export type CellMatrix = { a: Vec3; b: Vec3; c: Vec3 }

const cellCache = new Map<string, CellMatrix>()

function requireCrystal(crystalId: string): CrystalDatum & { basis: NonNullable<CrystalDatum['basis']> } {
  const c = getCrystal(crystalId)
  if (!c) throw new Error(`[lattice] нет кристалла «${crystalId}» в crystalData`)
  if (!c.basis || c.basis.length === 0) throw new Error(`[lattice] у кристалла «${crystalId}» нет basis`)
  return c as CrystalDatum & { basis: NonNullable<CrystalDatum['basis']> }
}

/**
 * Матрица ячейки из a, b, c, α, β, γ (стандартная установка International Tables: a ∥ x,
 * b в плоскости xy, c — по остатку), затем поворот (x, y, z) → (x, z, −y), чтобы c смотрела вверх.
 * Недостающие параметры по установке: у кубической b = c = a; у тетрагональной и гексагональной b = a;
 * у гексагональной и ромбоэдрической в гексагональной установке γ = 120°, если углы не заданы.
 */
export function cellMatrix(crystalId: string): CellMatrix {
  const hit = cellCache.get(crystalId)
  if (hit) return hit
  const cr = requireCrystal(crystalId)
  const setting = cr.setting ?? 'cubic'
  const a = cr.cellPm.a
  const b = cr.cellPm.b ?? a
  const c = cr.cellPm.c ?? (setting === 'cubic' ? a : NaN)
  if (!Number.isFinite(c)) throw new Error(`[lattice] у «${crystalId}» (${setting}) не задан параметр c`)
  const hexLike = setting === 'hexagonal' || setting === 'rhombohedral-hex'
  const ang = cr.cellAnglesDeg ?? { alpha: 90, beta: 90, gamma: hexLike ? 120 : 90 }
  const d2r = Math.PI / 180
  const ca = Math.cos(ang.alpha * d2r)
  const cb = Math.cos(ang.beta * d2r)
  const cg = Math.cos(ang.gamma * d2r)
  const sg = Math.sin(ang.gamma * d2r)
  const cx = c * cb
  const cy = (c * (ca - cb * cg)) / sg
  const cz = Math.sqrt(Math.max(0, c * c - cx * cx - cy * cy))
  // кристаллографические (x, y, z) → сцена (x, z, −y)
  const m: CellMatrix = {
    a: [a, 0, 0],
    b: [b * cg, 0, -b * sg],
    c: [cx, cz, -cy],
  }
  cellCache.set(crystalId, m)
  return m
}

/** Дроби → пм в системе сцены. */
export function fracToPm(m: CellMatrix, f: Readonly<Vec3>, out: Vec3 = [0, 0, 0]): Vec3 {
  out[0] = f[0] * m.a[0] + f[1] * m.b[0] + f[2] * m.c[0]
  out[1] = f[0] * m.a[1] + f[1] * m.b[1] + f[2] * m.c[1]
  out[2] = f[0] * m.a[2] + f[1] * m.b[2] + f[2] * m.c[2]
  return out
}

function dist(p: Readonly<Vec3>, q: Readonly<Vec3>): number {
  const dx = p[0] - q[0]
  const dy = p[1] - q[1]
  const dz = p[2] - q[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// ─── Периодическое окружение базиса ─────────────────────────────────────────

export type PeriodicNeighbors = {
  /** кратчайшее расстояние до любого другого атома кристалла, пм */
  minPm: number
  /** расстояния первой сферы (или до cutoffPm), по возрастанию */
  shellPm: number[]
  /** элементы соседей первой сферы, в том же порядке */
  shellEl: ElementSymbol[]
  /** отношение первого расстояния ЗА сферой к последнему в сфере (однозначность разбиения) */
  gapRatio: number
}

const periodicCache = new Map<string, PeriodicNeighbors[]>()

/**
 * Окружение каждого атома базиса в бесконечном кристалле: образы в блоке трансляций, число
 * которых по каждой оси выбрано так, чтобы покрыть сферу 2 × кратчайшего параметра ячейки.
 */
export function periodicNeighbors(crystalId: string, cutoffPm?: number): PeriodicNeighbors[] {
  const key = `${crystalId}|${cutoffPm ?? ''}`
  const hit = periodicCache.get(key)
  if (hit) return hit
  const cr = requireCrystal(crystalId)
  const m = cellMatrix(crystalId)
  const lens = [m.a, m.b, m.c].map((v) => Math.hypot(v[0], v[1], v[2]))
  const reach = Math.max(cutoffPm ?? 0, 2 * Math.min(...lens))
  const rng = lens.map((l) => Math.ceil(reach / l) + 1)
  const pos = cr.basis.map((s) => fracToPm(m, s.frac as Vec3))
  const out: PeriodicNeighbors[] = []
  const t: Vec3 = [0, 0, 0]
  const q: Vec3 = [0, 0, 0]
  for (let i = 0; i < cr.basis.length; i++) {
    const all: { d: number; el: ElementSymbol }[] = []
    for (let u = -rng[0]!; u <= rng[0]!; u++) {
      for (let v = -rng[1]!; v <= rng[1]!; v++) {
        for (let w = -rng[2]!; w <= rng[2]!; w++) {
          fracToPm(m, [u, v, w], t)
          for (let j = 0; j < cr.basis.length; j++) {
            q[0] = pos[j]![0] + t[0]
            q[1] = pos[j]![1] + t[1]
            q[2] = pos[j]![2] + t[2]
            const d = dist(pos[i]!, q)
            if (d > 1e-6 && d <= reach) all.push({ d, el: cr.basis[j]!.el })
          }
        }
      }
    }
    all.sort((x, y) => x.d - y.d)
    const minPm = all[0]!.d
    const lim = cutoffPm ?? minPm * FIRST_SHELL_RATIO
    const shell = all.filter((x) => x.d <= lim + 1e-6)
    const next = all.find((x) => x.d > lim + 1e-6)
    out.push({
      minPm,
      shellPm: shell.map((x) => x.d),
      shellEl: shell.map((x) => x.el),
      gapRatio: next ? next.d / shell[shell.length - 1]!.d : Infinity,
    })
  }
  periodicCache.set(key, out)
  return out
}

// ─── Фрагмент ────────────────────────────────────────────────────────────────

/**
 * Фрагмент решётки из целого числа ячеек.
 *
 * @param crystalId ключ CRYSTAL_DATA ('nacl', 'quartz', 'litharge', …)
 * @param cells     число ячеек по a, b, c (целые ≥ 1)
 */
export function latticeFragment(crystalId: string, cells: Readonly<Vec3>, opts: LatticeOptions = {}): LatticeFragment {
  const cr = requireCrystal(crystalId)
  const [nx, ny, nz] = cells
  for (const n of cells) {
    if (!Number.isInteger(n) || n < 1) throw new Error(`[lattice] число ячеек должно быть целым ≥ 1, получено ${cells.join('×')}`)
  }
  const boundary = opts.includeBoundary ?? true
  const m = cellMatrix(crystalId)
  const periodic = periodicNeighbors(crystalId, opts.cutoffPm)

  const sites: LatticeSite[] = []
  const posPm: Vec3[] = []
  const lo = boundary ? -1 : 0
  for (let bi = 0; bi < cr.basis.length; bi++) {
    const s = cr.basis[bi]!
    for (let i = lo; i <= nx; i++) {
      const fx = s.frac[0] + i
      if (!inRange(fx, nx, boundary)) continue
      for (let j = lo; j <= ny; j++) {
        const fy = s.frac[1] + j
        if (!inRange(fy, ny, boundary)) continue
        for (let k = lo; k <= nz; k++) {
          const fz = s.frac[2] + k
          if (!inRange(fz, nz, boundary)) continue
          const frac: Vec3 = [fx, fy, fz]
          posPm.push(fracToPm(m, frac))
          sites.push({ el: s.el, charge: s.charge ?? 0, posScene: [0, 0, 0], frac, cn: periodic[bi]!.shellPm.length, basisIndex: bi })
        }
      }
    }
  }

  // Центр — середина рамки ячеек (а не центр масс атомов): рёбра куба симметричны относительно начала.
  const mid = fracToPm(m, [nx / 2, ny / 2, nz / 2])
  const center = opts.center ?? true
  const offsetScene: Vec3 = center ? [-pmToScene(mid[0]), -pmToScene(mid[1]), -pmToScene(mid[2])] : [0, 0, 0]
  for (let i = 0; i < sites.length; i++) {
    const p = posPm[i]!
    const o = sites[i]!.posScene
    o[0] = pmToScene(p[0]) + offsetScene[0]
    o[1] = pmToScene(p[1]) + offsetScene[1]
    o[2] = pmToScene(p[2]) + offsetScene[2]
  }

  // Связи: пары, где расстояние в пределах первой сферы ОБОИХ концов (или ≤ cutoffPm).
  const bonds: LatticeBond[] = []
  for (let i = 0; i < sites.length; i++) {
    const li = opts.cutoffPm ?? periodic[sites[i]!.basisIndex]!.minPm * FIRST_SHELL_RATIO
    for (let j = i + 1; j < sites.length; j++) {
      const lj = opts.cutoffPm ?? periodic[sites[j]!.basisIndex]!.minPm * FIRST_SHELL_RATIO
      const d = dist(posPm[i]!, posPm[j]!)
      if (d <= Math.min(li, lj) + 1e-6) bonds.push([i, j, d])
    }
  }

  const edges = cellEdgesPm(m, cells)
  const cellEdgesOut: LatticeSegment[] = edges.map(([p, q]) => [toScene(p, offsetScene), toScene(q, offsetScene)])

  // Рамка: по узлам и по вершинам ячеек (у гексагональной призмы вершины выходят за атомы).
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  const grow = (p: Readonly<Vec3>) => {
    for (let a = 0; a < 3; a++) {
      if (p[a]! < min[a]!) min[a] = p[a]!
      if (p[a]! > max[a]!) max[a] = p[a]!
    }
  }
  for (const s of sites) grow(s.posScene)
  for (const [p, q] of cellEdgesOut) {
    grow(p)
    grow(q)
  }
  const bc: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  let radius = 0
  for (const s of sites) radius = Math.max(radius, dist(s.posScene, bc))
  for (const [p, q] of cellEdgesOut) radius = Math.max(radius, dist(p, bc), dist(q, bc))

  return {
    crystalId,
    cells: [nx, ny, nz],
    sites,
    bonds,
    cellEdges: cellEdgesOut,
    boundsScene: { min, max, center: bc, radius },
    posPm,
    offsetScene,
  }
}

function inRange(f: number, n: number, boundary: boolean): boolean {
  return boundary ? f >= -EPS_FRAC && f <= n + EPS_FRAC : f >= -EPS_FRAC && f < n - EPS_FRAC
}

function toScene(p: Readonly<Vec3>, off: Readonly<Vec3>): Vec3 {
  return [pmToScene(p[0]) + off[0], pmToScene(p[1]) + off[1], pmToScene(p[2]) + off[2]]
}

/** Уникальные рёбра сетки ячеек в пм: вдоль a — (nx)·(ny+1)·(nz+1) и т. д. */
function cellEdgesPm(m: CellMatrix, cells: Readonly<Vec3>): LatticeSegment[] {
  const [nx, ny, nz] = cells
  const out: LatticeSegment[] = []
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      for (let k = 0; k <= nz; k++) {
        const p = fracToPm(m, [i, j, k])
        if (i < nx) out.push([p, fracToPm(m, [i + 1, j, k])])
        if (j < ny) out.push([p, fracToPm(m, [i, j + 1, k])])
        if (k < nz) out.push([p, fracToPm(m, [i, j, k + 1])])
      }
    }
  }
  return out
}

/**
 * Рёбра элементарных ячеек фрагмента в мировых единицах, с тем же центрированием, что у
 * latticeFragment (по умолчанию центр рамки — в начале координат). У гексагональной установки —
 * ромбическая призма (a, b под 120°), не шестиугольная.
 */
export function cellEdges(crystalId: string, cells: Readonly<Vec3>, opts: { center?: boolean } = {}): LatticeSegment[] {
  const m = cellMatrix(crystalId)
  const mid = fracToPm(m, [cells[0] / 2, cells[1] / 2, cells[2] / 2])
  const off: Vec3 = (opts.center ?? true) ? [-pmToScene(mid[0]), -pmToScene(mid[1]), -pmToScene(mid[2])] : [0, 0, 0]
  return cellEdgesPm(m, cells).map(([p, q]) => [toScene(p, off), toScene(q, off)])
}

// ─── Координационный многогранник ────────────────────────────────────────────

export type CoordinationShell = {
  site: number
  /** индексы соседей во фрагменте, по возрастанию расстояния */
  neighbors: number[]
  distancesPm: number[]
  /**
   * Рёбра многогранника (пары индексов узлов фрагмента): рёбра выпуклой оболочки соседей;
   * у плоского окружения — стороны многоугольника (квадрат, треугольник), у КЧ 2 — пусто.
   * Диагонали квадратных граней (куб, пирамида PbO₄) в рёбра не входят.
   */
  edges: [number, number][]
}

/**
 * Соседи узла по связям фрагмента и рёбра его координационного многогранника.
 * У узла на краю фрагмента соседей может быть меньше КЧ (site.cn) — это проверяет вызывающий.
 */
export function coordinationShell(fragment: LatticeFragment, siteIndex: number): CoordinationShell {
  const nb: { j: number; d: number }[] = []
  for (const [i, j, d] of fragment.bonds) {
    if (i === siteIndex) nb.push({ j, d })
    else if (j === siteIndex) nb.push({ j: i, d })
  }
  nb.sort((x, y) => x.d - y.d || x.j - y.j)
  const neighbors = nb.map((x) => x.j)
  const pts = neighbors.map((j) => fragment.posPm[j]!)
  const local = hullEdges(pts)
  return {
    site: siteIndex,
    neighbors,
    distancesPm: nb.map((x) => x.d),
    edges: local.map(([a, b]) => [neighbors[a]!, neighbors[b]!] as [number, number]),
  }
}

type V = Vec3
const sub = (p: V, q: V): V => [p[0] - q[0], p[1] - q[1], p[2] - q[2]]
const cross = (p: V, q: V): V => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]]
const dot = (p: V, q: V) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2]
const norm = (p: V) => Math.hypot(p[0], p[1], p[2])

/**
 * Рёбра выпуклой оболочки малого набора точек (n ≤ 16) перебором опорных плоскостей.
 * Точки одной грани собираются вместе, и берутся только стороны плоского многоугольника грани,
 * поэтому диагонали квадратов не попадают в рёбра.
 */
function hullEdges(pts: readonly V[]): [number, number][] {
  const n = pts.length
  if (n < 3) return []
  const scale = Math.max(...pts.map((p) => norm(sub(p, pts[0]!)))) || 1
  const eps = 1e-6 * scale
  const set = new Set<string>()
  const add = (a: number, b: number) => set.add(a < b ? `${a}|${b}` : `${b}|${a}`)

  // Плоское окружение (треугольник графита, квадрат) — одна «грань».
  let planeN: V | null = null
  for (let i = 1; i < n && !planeN; i++) {
    for (let j = i + 1; j < n && !planeN; j++) {
      const c = cross(sub(pts[i]!, pts[0]!), sub(pts[j]!, pts[0]!))
      if (norm(c) > eps * scale) planeN = c
    }
  }
  if (!planeN) return []
  const allPlanar = pts.every((p) => Math.abs(dot(sub(p, pts[0]!), planeN!)) / norm(planeN!) < eps)
  if (allPlanar) {
    polygonEdges(pts, pts.map((_, i) => i), planeN, add)
  } else {
    const seen = new Set<string>()
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          const nn = cross(sub(pts[j]!, pts[i]!), sub(pts[k]!, pts[i]!))
          const ln = norm(nn)
          if (ln < eps * scale) continue
          let pos = 0
          let neg = 0
          const onPlane: number[] = []
          for (let q = 0; q < n; q++) {
            const s = dot(sub(pts[q]!, pts[i]!), nn) / ln
            if (s > eps) pos++
            else if (s < -eps) neg++
            else onPlane.push(q)
          }
          if (pos > 0 && neg > 0) continue
          const key = onPlane.join(',')
          if (seen.has(key)) continue
          seen.add(key)
          polygonEdges(pts, onPlane, nn, add)
        }
      }
    }
  }
  return [...set].map((s) => s.split('|').map(Number) as [number, number])
}

/** Стороны выпуклого многоугольника из копланарных точек (монотонная цепь в базисе плоскости). */
function polygonEdges(pts: readonly V[], idx: readonly number[], normal: V, add: (a: number, b: number) => void): void {
  if (idx.length === 3) {
    add(idx[0]!, idx[1]!)
    add(idx[1]!, idx[2]!)
    add(idx[0]!, idx[2]!)
    return
  }
  const o = pts[idx[0]!]!
  let u: V = [0, 0, 0]
  for (const q of idx) {
    const d = sub(pts[q]!, o)
    if (norm(d) > 1e-9) {
      u = d
      break
    }
  }
  const lu = norm(u)
  u = [u[0] / lu, u[1] / lu, u[2] / lu]
  const w = cross(normal, u)
  const lw = norm(w)
  const v: V = [w[0] / lw, w[1] / lw, w[2] / lw]
  const p2 = idx.map((q) => ({ q, x: dot(sub(pts[q]!, o), u), y: dot(sub(pts[q]!, o), v) }))
  p2.sort((a, b) => a.x - b.x || a.y - b.y)
  const crossZ = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const tol = 1e-9 * Math.max(1, ...p2.map((p) => Math.abs(p.x) + Math.abs(p.y)))
  const lower: typeof p2 = []
  for (const p of p2) {
    while (lower.length >= 2 && crossZ(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= tol) lower.pop()
    lower.push(p)
  }
  const upper: typeof p2 = []
  for (let i = p2.length - 1; i >= 0; i--) {
    const p = p2[i]!
    while (upper.length >= 2 && crossZ(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= tol) upper.pop()
    upper.push(p)
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1))
  for (let i = 0; i < hull.length; i++) add(hull[i]!.q, hull[(i + 1) % hull.length]!.q)
}

// ─── Подпись ────────────────────────────────────────────────────────────────

/**
 * Число для подписи: ВСЕГДА одна десятая (564.02 → «564.0», 397.5 → «397.5»).
 * Одна запись на одно число ядра: сцена урока показывает a в итоговой строке как «564,0 пм», и
 * подпись героя обязана совпадать с ней символ в символ (приёмка: «564» и «564,0» рядом).
 */
function fmtPm(v: number): string {
  return (Math.round(v * 10) / 10).toFixed(1)
}

/**
 * Подпись кристалла для 3D — только символы и числа (решение 8): параметры ячейки с токеном
 * единицы, пространственная группа и КЧ через токен {cn} (ru «КЧ», en «CN», uz «KS»).
 * Строки пропускаются через localizeLabelText, как любые подписи сцены.
 *   nacl     → ['a = 564 {pm}', 'Fm-3m', '{cn} 6:6']
 *   litharge → ['a = 397.5 {pm}', 'c = 502.3 {pm}', 'P4/nmm', '{cn} 4:4']
 */
export function latticeCaption(crystalId: string): string[] {
  const cr = requireCrystal(crystalId)
  const setting = cr.setting ?? 'cubic'
  const out = [`a = ${fmtPm(cr.cellPm.a)} {pm}`]
  if (setting === 'orthorhombic' && cr.cellPm.b != null) out.push(`b = ${fmtPm(cr.cellPm.b)} {pm}`)
  if (setting !== 'cubic' && cr.cellPm.c != null) out.push(`c = ${fmtPm(cr.cellPm.c)} {pm}`)
  out.push(cr.spaceGroup)
  out.push(`{cn} ${Object.values(cr.coordination).join(':')}`)
  return out
}

// ─── Пул рёбер ячейки (слой CinemaCellEdges) ────────────────────────────────

/**
 * Отрезки рёбер ячейки для слоя CinemaCellEdges: фиксированная ёмкость, без аллокаций в кадре.
 * seg — по 6 чисел на отрезок (x0 y0 z0 x1 y1 z1) в координатах рига. amount — общая
 * прозрачность слоя 0…1 (сцена ведёт её дорожкой). version растёт при смене отрезков.
 */
export type EdgePool = {
  capacity: number
  seg: Float32Array
  count: number
  version: number
  amount: number
}

export function createEdgePool(capacity: number): EdgePool {
  return { capacity, seg: new Float32Array(Math.max(1, capacity) * 6), count: 0, version: 0, amount: 0 }
}

/**
 * Записать рёбра в пул (один раз при сборке сцены или при смене фрагмента) со сдвигом и масштабом:
 * p' = p·scale + offset. Лишнее сверх ёмкости отбрасывается с ошибкой в dev — ёмкость задаёт сцена.
 */
export function writeCellEdges(
  pool: EdgePool,
  segments: readonly LatticeSegment[],
  offset: Readonly<Vec3> = [0, 0, 0],
  scale = 1,
): number {
  if (segments.length > pool.capacity) {
    throw new Error(`[lattice] рёбер ${segments.length} больше ёмкости пула ${pool.capacity}`)
  }
  for (let i = 0; i < segments.length; i++) {
    const [p, q] = segments[i]!
    const o = i * 6
    pool.seg[o] = p[0] * scale + offset[0]
    pool.seg[o + 1] = p[1] * scale + offset[1]
    pool.seg[o + 2] = p[2] * scale + offset[2]
    pool.seg[o + 3] = q[0] * scale + offset[0]
    pool.seg[o + 4] = q[1] * scale + offset[1]
    pool.seg[o + 5] = q[2] * scale + offset[2]
  }
  pool.count = segments.length
  pool.version++
  return pool.count
}

/** Прозрачность слоя рёбер в кадре (0 — слой прогрет, но ничего не рисует). */
export function setCellEdgesAmount(pool: EdgePool, amount: number): void {
  pool.amount = amount < 0 ? 0 : amount > 1 ? 1 : amount
}
