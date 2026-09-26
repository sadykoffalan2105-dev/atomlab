import type { Vec3 } from '../../types/chemistry'
import {
  type OrganicAtom,
  type OrganicElement,
  type OrganicGraph,
  freeValence,
  stripHydrogens,
  usedValence,
} from './organicGraph'

export const ANGLE_TETRA = 109.5
export const ANGLE_TRIGONAL = 120
export const ANGLE_LINEAR = 180

/** Внутренний угол правильного n-угольника (учебная модель плоскости кольца). */
export function planarRingAngleDeg(n: number): number {
  if (n < 3) return ANGLE_TETRA
  return ((n - 2) * 180) / n
}

export type Hybridization = 'sp3' | 'sp2' | 'sp' | 'terminal'

export function hybridizationOf(graph: OrganicGraph, atomId: string): Hybridization {
  const atom = graph.atoms.find((a) => a.id === atomId)
  if (!atom) return 'terminal'
  if (atom.element === 'H') return 'terminal'

  let maxOrder = 1
  let degree = 0
  for (const b of graph.bonds) {
    if (b.a !== atomId && b.b !== atomId) continue
    degree += 1
    maxOrder = Math.max(maxOrder, b.order)
  }
  if (maxOrder >= 3) return 'sp'
  if (maxOrder === 2) return 'sp2'
  if (degree <= 1 && atom.element !== 'C') return 'terminal'
  return 'sp3'
}

export function targetAngleDeg(hyb: Hybridization): number {
  if (hyb === 'sp') return ANGLE_LINEAR
  if (hyb === 'sp2') return ANGLE_TRIGONAL
  return ANGLE_TETRA
}

function vecSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function vecLen(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2])
}

function vecDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function vecNorm(v: Vec3): Vec3 {
  const L = vecLen(v) || 1
  return [v[0] / L, v[1] / L, v[2] / L]
}

function vecAdd(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function vecScale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s]
}

export function angleAtAtomDeg(
  graph: OrganicGraph,
  centerId: string,
  aId: string,
  bId: string,
): number {
  const c = graph.atoms.find((x) => x.id === centerId)
  const a = graph.atoms.find((x) => x.id === aId)
  const b = graph.atoms.find((x) => x.id === bId)
  if (!c || !a || !b) return 0
  const va = vecSub(a.pos, c.pos)
  const vb = vecSub(b.pos, c.pos)
  const la = vecLen(va)
  const lb = vecLen(vb)
  if (la < 1e-6 || lb < 1e-6) return 0
  const cos = Math.min(1, Math.max(-1, vecDot(va, vb) / (la * lb)))
  return (Math.acos(cos) * 180) / Math.PI
}

/** Найти простой цикл, содержащий три атома (центр и два соседа). */
export function findRingSizeThrough(
  graph: OrganicGraph,
  centerId: string,
  aId: string,
  bId: string,
): number | null {
  const heavy = new Set(stripHydrogens(graph).atoms.map((a) => a.id))
  if (!heavy.has(centerId) || !heavy.has(aId) || !heavy.has(bId)) return null

  const adj = new Map<string, string[]>()
  for (const id of heavy) adj.set(id, [])
  for (const bond of graph.bonds) {
    if (!heavy.has(bond.a) || !heavy.has(bond.b)) continue
    adj.get(bond.a)!.push(bond.b)
    adj.get(bond.b)!.push(bond.a)
  }

  // BFS от aId до bId, не проходя через center — длина пути + 2 = размер кольца
  const q: { id: string; dist: number }[] = [{ id: aId, dist: 0 }]
  const seen = new Set<string>([centerId, aId])
  while (q.length) {
    const cur = q.shift()!
    for (const n of adj.get(cur.id) ?? []) {
      if (n === bId) return cur.dist + 2
      if (seen.has(n)) continue
      seen.add(n)
      q.push({ id: n, dist: cur.dist + 1 })
    }
  }
  return null
}

/** Целевой угол с учётом кольца (циклоалканы по учебнику). */
export function targetAngleForTriple(
  graph: OrganicGraph,
  centerId: string,
  aId: string,
  bId: string,
): number {
  const hyb = hybridizationOf(graph, centerId)
  const base = targetAngleDeg(hyb)
  if (hyb !== 'sp3') return base

  const a = graph.atoms.find((x) => x.id === aId)
  const b = graph.atoms.find((x) => x.id === bId)
  const c = graph.atoms.find((x) => x.id === centerId)
  if (!a || !b || !c) return base
  if (a.element !== 'C' || b.element !== 'C' || c.element !== 'C') return base

  const ring = findRingSizeThrough(graph, centerId, aId, bId)
  if (!ring) return base
  // C₆ в кресле ≈ 109.5°; малые кольца — планарная модель как в таблице
  if (ring === 6) return ANGLE_TETRA
  if (ring >= 3 && ring <= 5) return planarRingAngleDeg(ring)
  if (ring > 6) return planarRingAngleDeg(Math.min(ring, 8))
  return base
}

export type AngleScore = {
  centerId: string
  aId: string
  bId: string
  measured: number
  target: number
  delta: number
  status: 'ok' | 'close' | 'bad'
}

export function scoreBondAngles(graph: OrganicGraph): AngleScore[] {
  const scores: AngleScore[] = []
  for (const atom of graph.atoms) {
    if (atom.element === 'H') continue
    const hyb = hybridizationOf(graph, atom.id)
    if (hyb === 'terminal') continue
    const neigh = graph.bonds
      .filter((b) => b.a === atom.id || b.b === atom.id)
      .map((b) => (b.a === atom.id ? b.b : b.a))
    for (let i = 0; i < neigh.length; i++) {
      for (let j = i + 1; j < neigh.length; j++) {
        const measured = angleAtAtomDeg(graph, atom.id, neigh[i]!, neigh[j]!)
        const target = targetAngleForTriple(graph, atom.id, neigh[i]!, neigh[j]!)
        const delta = Math.abs(measured - target)
        // у малых колец допуск шире (напряжение / учебная модель)
        const ring = findRingSizeThrough(graph, atom.id, neigh[i]!, neigh[j]!)
        const okTol = ring && ring <= 4 ? 12 : 8
        const closeTol = ring && ring <= 4 ? 28 : 18
        const status = delta <= okTol ? 'ok' : delta <= closeTol ? 'close' : 'bad'
        scores.push({
          centerId: atom.id,
          aId: neigh[i]!,
          bId: neigh[j]!,
          measured,
          target,
          delta,
          status,
        })
      }
    }
  }
  return scores
}

export function anglesOk(graph: OrganicGraph, maxBad = 0): boolean {
  const scores = scoreBondAngles(graph)
  if (scores.length === 0) return graph.atoms.length > 0
  return scores.filter((s) => s.status === 'bad').length <= maxBad
}

const BOND_LEN: Record<string, number> = {
  CC: 1.54,
  CH: 1.09,
  CO: 1.43,
  OH: 0.96,
  CN: 1.47,
  NH: 1.01,
  CCl: 1.78,
  HCl: 1.27,
  BrC: 1.94,
  CS: 1.82,
  HS: 1.34,
  OO: 1.48,
  NN: 1.45,
  default: 1.4,
}

function bondKey(a: OrganicElement, b: OrganicElement): string {
  return [a, b].sort().join('')
}

function bondLength(a: OrganicElement, b: OrganicElement): number {
  return BOND_LEN[bondKey(a, b)] ?? BOND_LEN.default!
}

const TETRA_DIRS: Vec3[] = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
].map((v) => {
  const L = Math.hypot(v[0], v[1], v[2])
  return [v[0] / L, v[1] / L, v[2] / L] as Vec3
})

/** Крупнейший простой цикл по тяжёлым атомам (DFS). */
export function findLargestHeavyCycle(graph: OrganicGraph): string[] | null {
  const heavy = stripHydrogens(graph).atoms
  if (heavy.length < 3) return null
  const adj = new Map<string, string[]>()
  for (const a of heavy) adj.set(a.id, [])
  for (const b of graph.bonds) {
    if (!adj.has(b.a) || !adj.has(b.b)) continue
    adj.get(b.a)!.push(b.b)
    adj.get(b.b)!.push(b.a)
  }

  let best: string[] | null = null

  const dfs = (start: string, cur: string, parent: string, path: string[]) => {
    for (const n of adj.get(cur) ?? []) {
      if (n === parent) continue
      if (n === start && path.length >= 3) {
        if (!best || path.length > best.length) best = [...path]
        continue
      }
      if (path.includes(n)) continue
      if (path.length > 12) continue
      path.push(n)
      dfs(start, n, cur, path)
      path.pop()
    }
  }

  for (const a of heavy) {
    dfs(a.id, a.id, '', [a.id])
  }
  return best
}

function polygonPositions(n: number, bondLen: number): Vec3[] {
  const r = bondLen / (2 * Math.sin(Math.PI / n))
  const out: Vec3[] = []
  for (let i = 0; i < n; i++) {
    const ang = (2 * Math.PI * i) / n - Math.PI / 2
    out.push([r * Math.cos(ang), 0, r * Math.sin(ang)])
  }
  return out
}

/** Кресло циклогексана (учебные координаты, C–C ≈ bondLen). */
function chairHexanePositions(bondLen: number): Vec3[] {
  const s = bondLen / 1.54
  const raw: Vec3[] = [
    [1.0, 0.0, 0.0],
    [0.5, 0.35, 0.866],
    [-0.5, 0.0, 0.866],
    [-1.0, 0.35, 0.0],
    [-0.5, 0.0, -0.866],
    [0.5, 0.35, -0.866],
  ]
  return raw.map((p) => [p[0] * s, p[1] * s, p[2] * s] as Vec3)
}

function placeHydrogens(graph: OrganicGraph, pos: Map<string, Vec3>): void {
  const adj = new Map<string, string[]>()
  for (const a of graph.atoms) adj.set(a.id, [])
  for (const b of graph.bonds) {
    adj.get(b.a)!.push(b.b)
    adj.get(b.b)!.push(b.a)
  }

  for (const atom of graph.atoms) {
    if (atom.element === 'H') continue
    const neighbors = adj.get(atom.id) ?? []
    const heavyN = neighbors.filter((id) => graph.atoms.find((x) => x.id === id)?.element !== 'H')
    const hN = neighbors.filter((id) => graph.atoms.find((x) => x.id === id)?.element === 'H')
    if (hN.length === 0) continue

    const cPos = pos.get(atom.id) ?? atom.pos
    const heavyDirs = heavyN.map((id) => {
      const p = pos.get(id) ?? graph.atoms.find((x) => x.id === id)!.pos
      return vecNorm(vecSub(p, cPos))
    })

    // среднее направление «от соседей» — ось для H
    let away: Vec3 = [0, 1, 0]
    if (heavyDirs.length > 0) {
      away = [0, 0, 0]
      for (const d of heavyDirs) {
        away = vecAdd(away, d)
      }
      away = vecNorm(vecScale(away, -1))
      if (vecLen(away) < 0.2) away = [0, 1, 0]
    }

    const side: Vec3 =
      Math.abs(away[1]) < 0.9
        ? vecNorm([away[2], 0, -away[0]])
        : vecNorm([1, 0, 0])
    const up = vecNorm([
      away[1] * side[2] - away[2] * side[1],
      away[2] * side[0] - away[0] * side[2],
      away[0] * side[1] - away[1] * side[0],
    ])

    const len = bondLength(atom.element, 'H')
    hN.forEach((hid, i) => {
      let dir: Vec3
      if (hN.length === 1) {
        dir = away
      } else if (hN.length === 2) {
        const sign = i === 0 ? 1 : -1
        dir = vecNorm(vecAdd(away, vecScale(up, sign * 0.85)))
      } else {
        const dirTetra = TETRA_DIRS[i % TETRA_DIRS.length]!
        dir = dirTetra
      }
      pos.set(hid, vecAdd(cPos, vecScale(dir, len)))
    })
  }
}

function layoutByBfs(graph: OrganicGraph): Map<string, Vec3> {
  const pos = new Map<string, Vec3>()
  const root =
    graph.atoms.find((a) => a.element === 'C') ??
    graph.atoms.find((a) => a.element !== 'H') ??
    graph.atoms[0]!
  pos.set(root.id, [0, 0, 0])

  const adj = new Map<string, { id: string; el: OrganicElement }[]>()
  for (const a of graph.atoms) adj.set(a.id, [])
  for (const b of graph.bonds) {
    const aEl = graph.atoms.find((x) => x.id === b.a)!.element
    const bEl = graph.atoms.find((x) => x.id === b.b)!.element
    adj.get(b.a)!.push({ id: b.b, el: bEl })
    adj.get(b.b)!.push({ id: b.a, el: aEl })
  }

  const queue = [root.id]
  const usedDirs = new Map<string, number>()

  while (queue.length) {
    const cur = queue.shift()!
    const curPos = pos.get(cur)!
    const curEl = graph.atoms.find((a) => a.id === cur)!.element
    const neigh = adj.get(cur) ?? []
    let slot = usedDirs.get(cur) ?? 0
    for (const n of neigh) {
      if (pos.has(n.id)) continue
      const dir = TETRA_DIRS[slot % TETRA_DIRS.length]!
      slot += 1
      const len = bondLength(curEl, n.el)
      pos.set(n.id, [
        curPos[0] + dir[0] * len,
        curPos[1] + dir[1] * len,
        curPos[2] + dir[2] * len,
      ])
      usedDirs.set(cur, slot)
      usedDirs.set(n.id, 1)
      queue.push(n.id)
    }
  }

  let orphan = 0
  for (const a of graph.atoms) {
    if (!pos.has(a.id)) {
      pos.set(a.id, [orphan * 1.6, 2.2, 0])
      orphan += 1
    }
  }
  return pos
}

/** BFS-layout + правильные кольца (C₃–C₆) и расстановка H. */
export function layoutOrganicGraph(graph: OrganicGraph): OrganicGraph {
  if (graph.atoms.length === 0) return graph

  const cycle = findLargestHeavyCycle(graph)
  const heavyCount = stripHydrogens(graph).atoms.length
  let pos: Map<string, Vec3>

  // Моноцикл: все тяжёлые атомы образуют одно кольцо
  if (cycle && cycle.length >= 3 && cycle.length <= 6 && cycle.length === heavyCount) {
    pos = new Map()
    const cc = bondLength('C', 'C')
    const ringPos =
      cycle.length === 6 ? chairHexanePositions(cc) : polygonPositions(cycle.length, cc)
    cycle.forEach((id, i) => pos.set(id, ringPos[i]!))

    const adj = new Map<string, { id: string; el: OrganicElement }[]>()
    for (const a of graph.atoms) adj.set(a.id, [])
    for (const b of graph.bonds) {
      const aEl = graph.atoms.find((x) => x.id === b.a)!.element
      const bEl = graph.atoms.find((x) => x.id === b.b)!.element
      adj.get(b.a)!.push({ id: b.b, el: bEl })
      adj.get(b.b)!.push({ id: b.a, el: aEl })
    }
    const queue = [...cycle]
    const usedDirs = new Map<string, number>()
    while (queue.length) {
      const cur = queue.shift()!
      const curPos = pos.get(cur)!
      const curEl = graph.atoms.find((a) => a.id === cur)!.element
      let slot = usedDirs.get(cur) ?? 0
      for (const n of adj.get(cur) ?? []) {
        if (pos.has(n.id)) continue
        if (n.el === 'H') continue
        const dir = TETRA_DIRS[slot % TETRA_DIRS.length]!
        slot += 1
        const len = bondLength(curEl, n.el)
        pos.set(n.id, [
          curPos[0] + dir[0] * len,
          curPos[1] + dir[1] * len,
          curPos[2] + dir[2] * len,
        ])
        usedDirs.set(cur, slot)
        queue.push(n.id)
      }
    }
    placeHydrogens(graph, pos)
    for (const a of graph.atoms) {
      if (!pos.has(a.id)) pos.set(a.id, a.pos)
    }
  } else {
    pos = layoutByBfs(graph)
    placeHydrogens(graph, pos)
  }

  return relaxOrganicGeometry({
    ...graph,
    atoms: graph.atoms.map((a) => ({ ...a, pos: pos.get(a.id) ?? a.pos })),
  })
}

/** Повернуть соседа (и его поддерево) вокруг центра вокруг оси Y. */
export function rotateNeighborAround(
  graph: OrganicGraph,
  centerId: string,
  neighborId: string,
  deltaDeg: number,
): OrganicGraph {
  const c = graph.atoms.find((a) => a.id === centerId)
  const n = graph.atoms.find((a) => a.id === neighborId)
  if (!c || !n) return graph

  const v: Vec3 = [n.pos[0] - c.pos[0], n.pos[1] - c.pos[1], n.pos[2] - c.pos[2]]
  const rad = (deltaDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const newPos: Vec3 = [
    c.pos[0] + (v[0] * cos - v[2] * sin),
    c.pos[1] + v[1],
    c.pos[2] + (v[0] * sin + v[2] * cos),
  ]

  const delta: Vec3 = [newPos[0] - n.pos[0], newPos[1] - n.pos[1], newPos[2] - n.pos[2]]
  const move = new Set<string>([neighborId])
  const q = [neighborId]
  while (q.length) {
    const cur = q.shift()!
    for (const b of graph.bonds) {
      const other = b.a === cur ? b.b : b.b === cur ? b.a : null
      if (!other || other === centerId || move.has(other)) continue
      move.add(other)
      q.push(other)
    }
  }

  return {
    ...graph,
    atoms: graph.atoms.map((a) => {
      if (!move.has(a.id)) return a
      return {
        ...a,
        pos: [a.pos[0] + delta[0], a.pos[1] + delta[1], a.pos[2] + delta[2]] as Vec3,
      }
    }),
  }
}

export function snapAnglesHint(graph: OrganicGraph): OrganicGraph {
  return layoutOrganicGraph(graph)
}

export function placeNewAtomNear(
  graph: OrganicGraph,
  element: OrganicElement,
  nearId?: string,
): Vec3 {
  if (!nearId) {
    return [graph.atoms.length * 1.5, 0, 0]
  }
  const near = graph.atoms.find((a) => a.id === nearId)
  if (!near) return [0, 0, 0]
  const slot = usedValence(graph, nearId)
  const dir = TETRA_DIRS[slot % TETRA_DIRS.length]!
  const len = bondLength(near.element, element)
  return [near.pos[0] + dir[0] * len, near.pos[1] + dir[1] * len, near.pos[2] + dir[2] * len]
}

export function suggestAttachTarget(graph: OrganicGraph): string | undefined {
  const heavy = stripHydrogens(graph).atoms
  for (const a of heavy) {
    if (freeValence(graph, a.id) > 0) return a.id
  }
  return graph.atoms.find((a) => freeValence(graph, a.id) > 0)?.id
}

/* ── Доводка геометрии: связи, углы по гибридизации, кольца, отталкивание несвязанных ── */

function bondTargetLen(a: OrganicElement, b: OrganicElement, order: number, aromatic: boolean): number {
  const key = bondKey(a, b)
  if (aromatic && key === 'CC') return 1.39
  if (order === 3) return key === 'CC' ? 1.2 : key === 'CN' ? 1.16 : bondLength(a, b) * 0.8
  if (order === 2) {
    if (key === 'CC') return 1.34
    if (key === 'CO') return 1.23
    if (key === 'CN') return 1.28
    return bondLength(a, b) * 0.88
  }
  return bondLength(a, b)
}

/** Кратчайший путь a → b, не проходя через center (для размера кольца угла a–center–b). */
function ringPathLen(adj: number[][], a: number, b: number, center: number, limit = 7): number | null {
  const dist = new Map<number, number>([[a, 0]])
  const q = [a]
  while (q.length) {
    const cur = q.shift()!
    const d = dist.get(cur)!
    if (d >= limit) continue
    for (const n of adj[cur]!) {
      if (n === center || dist.has(n)) continue
      if (n === b) return d + 1
      dist.set(n, d + 1)
      q.push(n)
    }
  }
  return null
}

/**
 * Позиционная релаксация (PBD): длины связей с учётом кратности, углы 109.5° / 120° / 180°
 * по гибридизации (в малых кольцах — угол многоугольника), отталкивание атомов через 3+ связи.
 * Раньше BFS-раскладка по тетраэдрическим направлениям давала наложения (H в 0.45 Å от C)
 * и незамкнутые кольца у замещённых циклов (толуол, метилциклопропан).
 */
export function relaxOrganicGeometry(graph: OrganicGraph, maxIterations = 320): OrganicGraph {
  const n = graph.atoms.length
  // крупные молекулы (жиры, каротин) — меньше итераций: пар «через 3+ связи» там десятки тысяч
  const iterations = n > 90 ? Math.round(maxIterations / 2) : maxIterations
  if (n < 3) return graph
  const idx = new Map(graph.atoms.map((a, i) => [a.id, i]))
  const el = graph.atoms.map((a) => a.element)
  const adj: number[][] = graph.atoms.map(() => [])
  const bonds: { i: number; j: number; order: number }[] = []
  for (const b of graph.bonds) {
    const i = idx.get(b.a)
    const j = idx.get(b.b)
    if (i == null || j == null) continue
    adj[i]!.push(j)
    adj[j]!.push(i)
    bonds.push({ i, j, order: b.order })
  }
  const orderOf = (i: number, j: number) => bonds.find((b) => (b.i === i && b.j === j) || (b.i === j && b.j === i))?.order ?? 1

  // Ароматическое (кекулевское) шестичленное кольцо из sp2-атомов C → все связи 1.39 Å
  const aromaticBond = new Set<string>()
  const heavyAdj = adj.map((ns, i) => (el[i] === 'H' ? [] : ns.filter((j) => el[j] !== 'H')))
  const visitRing = (path: number[]) => {
    const cur = path[path.length - 1]!
    if (path.length === 6) {
      if (!heavyAdj[cur]!.includes(path[0]!)) return
      const ring = [...path]
      let doubles = 0
      for (let k = 0; k < 6; k++) if (orderOf(ring[k]!, ring[(k + 1) % 6]!) === 2) doubles += 1
      if (doubles === 3 && ring.every((a) => el[a] === 'C')) {
        for (let k = 0; k < 6; k++) aromaticBond.add([ring[k]!, ring[(k + 1) % 6]!].sort((x, y) => x - y).join('-'))
      }
      return
    }
    for (const nx of heavyAdj[cur]!) {
      if (path.includes(nx) || nx < path[0]!) continue
      path.push(nx)
      visitRing(path)
      path.pop()
    }
  }
  for (let s = 0; s < n; s++) if (el[s] === 'C') visitRing([s])
  const isAromatic = (i: number, j: number) => aromaticBond.has([i, j].sort((x, y) => x - y).join('-'))

  const lenOf = (i: number, j: number) => bondTargetLen(el[i]!, el[j]!, orderOf(i, j), isAromatic(i, j))

  type Pair = { i: number; j: number; d: number; k: number }
  const pairs: Pair[] = bonds.map((b) => ({ i: b.i, j: b.j, d: lenOf(b.i, b.j), k: 1 }))
  const near = new Set<string>()
  const key = (i: number, j: number) => (i < j ? `${i}-${j}` : `${j}-${i}`)
  for (const b of bonds) near.add(key(b.i, b.j))

  for (let c = 0; c < n; c++) {
    const ns = adj[c]!
    if (ns.length < 2) continue
    let doubles = 0
    let triple = false
    for (const j of ns) {
      const o = orderOf(c, j)
      if (o === 2) doubles += 1
      if (o === 3) triple = true
    }
    const aromaticCenter = ns.some((j) => isAromatic(c, j))
    const linear = triple || doubles >= 2
    const trigonal = !linear && (doubles === 1 || aromaticCenter)
    for (let x = 0; x < ns.length; x++) {
      for (let y = x + 1; y < ns.length; y++) {
        const a = ns[x]!
        const b = ns[y]!
        let theta = linear ? 180 : trigonal ? 120 : 109.5
        const path = el[a] !== 'H' && el[b] !== 'H' ? ringPathLen(heavyAdj, a, b, c) : null
        const ringSize = path != null ? path + 2 : null
        if (ringSize != null && ringSize <= 5) theta = ((ringSize - 2) * 180) / ringSize
        else if (ringSize === 6 && !trigonal) theta = 111
        else if (!linear && !trigonal) {
          // экзоциклическая связь у атома малого кольца: угол шире тетраэдрического
          let smallest = 99
          for (let p = 0; p < ns.length; p++)
            for (let q2 = p + 1; q2 < ns.length; q2++) {
              const pl = ringPathLen(heavyAdj, ns[p]!, ns[q2]!, c)
              if (pl != null) smallest = Math.min(smallest, pl + 2)
            }
          if (smallest === 3) theta = 117
          else if (smallest === 4) theta = 114
          else if (smallest === 5) theta = 111
        }
        const la = lenOf(c, a)
        const lb = lenOf(c, b)
        const rad = (theta * Math.PI) / 180
        const d = Math.sqrt(la * la + lb * lb - 2 * la * lb * Math.cos(rad))
        pairs.push({ i: a, j: b, d, k: 0.6 })
        near.add(key(a, b))
      }
    }
  }

  const far: { i: number; j: number; d: number }[] = []
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (near.has(key(i, j))) continue
      const hi = el[i] === 'H'
      const hj = el[j] === 'H'
      far.push({ i, j, d: hi && hj ? 2.0 : hi || hj ? 2.4 : 2.7 })
    }

  // старт: текущие позиции + крошечный детерминированный сдвиг (выход из плоских ловушек)
  const P = graph.atoms.map((a, i) => [
    a.pos[0] + Math.sin(i * 12.9898) * 0.04,
    a.pos[1] + Math.sin(i * 78.233) * 0.04,
    a.pos[2] + Math.sin(i * 37.719) * 0.04,
  ])
  const project = (i: number, j: number, d: number, k: number, onlyPush = false) => {
    const pi = P[i]!
    const pj = P[j]!
    const dx = pj[0]! - pi[0]!
    const dy = pj[1]! - pi[1]!
    const dz = pj[2]! - pi[2]!
    const L = Math.hypot(dx, dy, dz) || 1e-6
    if (onlyPush && L >= d) return
    const f = ((L - d) / L) * 0.5 * k
    pi[0]! += dx * f
    pi[1]! += dy * f
    pi[2]! += dz * f
    pj[0]! -= dx * f
    pj[1]! -= dy * f
    pj[2]! -= dz * f
  }
  for (let it = 0; it < iterations; it++) {
    for (const p of pairs) project(p.i, p.j, p.d, p.k)
    const push = it < iterations * 0.85 ? 0.35 : 0.15
    for (const f of far) project(f.i, f.j, f.d, push, true)
  }
  // финальная доводка только связей и углов
  for (let it = 0; it < 40; it++) for (const p of pairs) project(p.i, p.j, p.d, p.k)

  // центрировать по тяжёлым атомам
  const heavyIdx = graph.atoms.map((a, i) => (a.element === 'H' ? -1 : i)).filter((i) => i >= 0)
  const ci = heavyIdx.length ? heavyIdx : graph.atoms.map((_, i) => i)
  const cx = ci.reduce((s, i) => s + P[i]![0]!, 0) / ci.length
  const cy = ci.reduce((s, i) => s + P[i]![1]!, 0) / ci.length
  const cz = ci.reduce((s, i) => s + P[i]![2]!, 0) / ci.length
  return {
    ...graph,
    atoms: graph.atoms.map((a, i) => ({
      ...a,
      pos: [P[i]![0]! - cx, P[i]![1]! - cy, P[i]![2]! - cz] as Vec3,
    })),
  }
}

export type { OrganicAtom }
