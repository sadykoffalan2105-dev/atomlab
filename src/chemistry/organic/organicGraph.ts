import type { Atom3D, Vec3 } from '../../types/chemistry'

export type OrganicElement = 'C' | 'H' | 'O' | 'N' | 'Cl'

export type OrganicAtom = {
  id: string
  element: OrganicElement
  pos: Vec3
}

export type OrganicBond = {
  id: string
  a: string
  b: string
  order: 1 | 2 | 3
}

export type OrganicGraph = {
  atoms: OrganicAtom[]
  bonds: OrganicBond[]
}

export type ValenceError = {
  atomId: string
  element: OrganicElement
  used: number
  max: number
}

const MAX_VALENCE: Record<OrganicElement, number> = {
  C: 4,
  H: 1,
  O: 2,
  N: 3,
  Cl: 1,
}

let idSeq = 0
export function nextOrganicId(prefix: string): string {
  idSeq += 1
  return `${prefix}_${idSeq}`
}

export function resetOrganicIdSeq(n = 0): void {
  idSeq = n
}

export function emptyOrganicGraph(): OrganicGraph {
  return { atoms: [], bonds: [] }
}

/** Разложить все атомы формулы на «лоток» — без связей, сразу видно весь состав. */
export function createFormulaKit(
  counts: Readonly<Partial<Record<OrganicElement, number>>>,
): OrganicGraph {
  resetOrganicIdSeq(0)
  const atoms: OrganicAtom[] = []
  const groups: OrganicElement[] = ['C', 'O', 'N', 'Cl', 'H']
  let groupIndex = 0
  for (const el of groups) {
    const n = counts[el] ?? 0
    if (n <= 0) continue
    const cols = el === 'H' ? Math.min(6, n) : Math.min(5, n)
    for (let i = 0; i < n; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const spacing = el === 'H' ? 0.78 : 1.25
      const x = groupIndex * 3.4 + col * spacing - ((cols - 1) * spacing) / 2
      const y = el === 'H' ? -1.35 - row * 0.65 : 0.15 + row * 1.15
      const z = el === 'H' ? 1.8 + (col % 3) * 0.25 : (row % 2) * 0.35
      atoms.push({ id: nextOrganicId(el), element: el, pos: [x, y, z] })
    }
    groupIndex += 1
  }
  return { atoms, bonds: [] }
}

export function compositionCounts(
  counts: Readonly<Partial<Record<OrganicElement, number>>>,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(counts)) {
    if (v && v > 0) out[k] = v
  }
  return out
}

export function compositionsEqual(
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    if ((a[k] ?? 0) !== (b[k] ?? 0)) return false
  }
  return true
}

/** Привязать свободные H из набора к атомам со свободной валентностью. */
export function autoBondKitHydrogens(graph: OrganicGraph): OrganicGraph {
  let next: OrganicGraph = { atoms: [...graph.atoms], bonds: [...graph.bonds] }
  const unboundH = () =>
    next.atoms.filter((a) => a.element === 'H' && usedValence(next, a.id) === 0)

  for (const atom of next.atoms.filter((a) => a.element !== 'H')) {
    while (freeValence(next, atom.id) > 0) {
      const pool = unboundH()
      if (pool.length === 0) break
      pool.sort((a, b) => {
        const da =
          (a.pos[0] - atom.pos[0]) ** 2 +
          (a.pos[1] - atom.pos[1]) ** 2 +
          (a.pos[2] - atom.pos[2]) ** 2
        const db =
          (b.pos[0] - atom.pos[0]) ** 2 +
          (b.pos[1] - atom.pos[1]) ** 2 +
          (b.pos[2] - atom.pos[2]) ** 2
        return da - db
      })
      const bonded = addBond(next, atom.id, pool[0]!.id, 1)
      if (!bonded) break
      next = bonded
    }
  }
  return next
}

export function removeBondBetween(graph: OrganicGraph, aId: string, bId: string): OrganicGraph {
  return {
    ...graph,
    bonds: graph.bonds.filter(
      (b) => !((b.a === aId && b.b === bId) || (b.a === bId && b.b === aId)),
    ),
  }
}

export function setBondOrder(
  graph: OrganicGraph,
  aId: string,
  bId: string,
  order: 1 | 2 | 3,
): OrganicGraph | null {
  const existing = graph.bonds.find(
    (b) => (b.a === aId && b.b === bId) || (b.a === bId && b.b === aId),
  )
  if (!existing) return null
  // временно убрать связь, проверить валентность с новым order
  const without = {
    ...graph,
    bonds: graph.bonds.filter((b) => b.id !== existing.id),
  }
  if (freeValence(without, aId) < order || freeValence(without, bId) < order) return null
  return {
    ...graph,
    bonds: graph.bonds.map((b) => (b.id === existing.id ? { ...b, order } : b)),
  }
}

export function maxValence(el: OrganicElement): number {
  return MAX_VALENCE[el]
}

export function usedValence(graph: OrganicGraph, atomId: string): number {
  let sum = 0
  for (const b of graph.bonds) {
    if (b.a === atomId || b.b === atomId) sum += b.order
  }
  return sum
}

export function freeValence(graph: OrganicGraph, atomId: string): number {
  const atom = graph.atoms.find((a) => a.id === atomId)
  if (!atom) return 0
  return maxValence(atom.element) - usedValence(graph, atomId)
}

export function valenceErrors(graph: OrganicGraph): ValenceError[] {
  const out: ValenceError[] = []
  for (const atom of graph.atoms) {
    const used = usedValence(graph, atom.id)
    const max = maxValence(atom.element)
    if (used > max) {
      out.push({ atomId: atom.id, element: atom.element, used, max })
    }
  }
  return out
}

export function isValenceOk(graph: OrganicGraph): boolean {
  return valenceErrors(graph).length === 0 && graph.atoms.every((a) => freeValence(graph, a.id) === 0)
}

export function addAtom(
  graph: OrganicGraph,
  element: OrganicElement,
  pos: Vec3 = [0, 0, 0],
): OrganicGraph {
  return {
    ...graph,
    atoms: [...graph.atoms, { id: nextOrganicId(element), element, pos }],
  }
}

export function removeAtom(graph: OrganicGraph, atomId: string): OrganicGraph {
  return {
    atoms: graph.atoms.filter((a) => a.id !== atomId),
    bonds: graph.bonds.filter((b) => b.a !== atomId && b.b !== atomId),
  }
}

export function canBond(
  graph: OrganicGraph,
  aId: string,
  bId: string,
  order: 1 | 2 | 3 = 1,
): boolean {
  if (aId === bId) return false
  const a = graph.atoms.find((x) => x.id === aId)
  const b = graph.atoms.find((x) => x.id === bId)
  if (!a || !b) return false
  if (graph.bonds.some((x) => (x.a === aId && x.b === bId) || (x.a === bId && x.b === aId))) {
    return false
  }
  if (freeValence(graph, aId) < order) return false
  if (freeValence(graph, bId) < order) return false
  return true
}

export function addBond(
  graph: OrganicGraph,
  aId: string,
  bId: string,
  order: 1 | 2 | 3 = 1,
): OrganicGraph | null {
  if (!canBond(graph, aId, bId, order)) return null
  return {
    ...graph,
    bonds: [...graph.bonds, { id: nextOrganicId('b'), a: aId, b: bId, order }],
  }
}

export function removeBond(graph: OrganicGraph, bondId: string): OrganicGraph {
  return { ...graph, bonds: graph.bonds.filter((b) => b.id !== bondId) }
}

export function setAtomPos(graph: OrganicGraph, atomId: string, pos: Vec3): OrganicGraph {
  return {
    ...graph,
    atoms: graph.atoms.map((a) => (a.id === atomId ? { ...a, pos } : a)),
  }
}

/** Достроить H на свободные валентности (кроме уже заполненных). */
export function autoFillHydrogens(graph: OrganicGraph): OrganicGraph {
  let next = { atoms: [...graph.atoms], bonds: [...graph.bonds] }
  const heavy = next.atoms.filter((a) => a.element !== 'H')
  for (const atom of heavy) {
    let free = freeValence(next, atom.id)
    let i = 0
    while (free > 0) {
      const hid = nextOrganicId('H')
      const offset: Vec3 = [
        atom.pos[0] + 0.9 * Math.cos(i * 1.7),
        atom.pos[1] + 0.55,
        atom.pos[2] + 0.9 * Math.sin(i * 1.7),
      ]
      next.atoms.push({ id: hid, element: 'H', pos: offset })
      next.bonds.push({ id: nextOrganicId('b'), a: atom.id, b: hid, order: 1 })
      free -= 1
      i += 1
    }
  }
  return next
}

export function stripHydrogens(graph: OrganicGraph): OrganicGraph {
  const keep = new Set(graph.atoms.filter((a) => a.element !== 'H').map((a) => a.id))
  return {
    atoms: graph.atoms.filter((a) => keep.has(a.id)),
    bonds: graph.bonds.filter((b) => keep.has(b.a) && keep.has(b.b)),
  }
}

export function compositionOf(graph: OrganicGraph): Record<string, number> {
  const c: Record<string, number> = {}
  for (const a of graph.atoms) {
    c[a.element] = (c[a.element] ?? 0) + 1
  }
  return c
}

export function formulaUnicode(graph: OrganicGraph): string {
  const c = compositionOf(graph)
  const order = ['C', 'H', 'O', 'N', 'Cl'] as const
  let s = ''
  for (const el of order) {
    const n = c[el]
    if (!n) continue
    s += el + (n > 1 ? toSub(n) : '')
  }
  return s || '—'
}

function toSub(n: number): string {
  return String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]!)
}

/**
 * Каноническая подпись тяжёлого скелета (без H):
 * мультимножество меток узлов element + sorted neighbor (element, order) tuples.
 * Для ациклических школьных молекул достаточно для различения н-/изо-/нео и спирт/эфир.
 */
export function canonicalizeSkeleton(graph: OrganicGraph): string {
  const heavy = stripHydrogens(graph)
  if (heavy.atoms.length === 0) return ''

  const neighbors = new Map<string, { el: OrganicElement; order: number }[]>()
  for (const a of heavy.atoms) neighbors.set(a.id, [])
  for (const b of heavy.bonds) {
    const aEl = heavy.atoms.find((x) => x.id === b.a)!.element
    const bEl = heavy.atoms.find((x) => x.id === b.b)!.element
    neighbors.get(b.a)!.push({ el: bEl, order: b.order })
    neighbors.get(b.b)!.push({ el: aEl, order: b.order })
  }

  const nodeSig = (id: string): string => {
    const atom = heavy.atoms.find((a) => a.id === id)!
    const neigh = [...neighbors.get(id)!]
      .map((n) => `${n.el}${n.order}`)
      .sort()
      .join(',')
    return `${atom.element}[${neigh}]`
  }

  // Weisfeiler–Lehman–lite: refine labels a few rounds
  let labels = new Map<string, string>()
  for (const a of heavy.atoms) labels.set(a.id, nodeSig(a.id))

  for (let round = 0; round < 4; round++) {
    const next = new Map<string, string>()
    for (const a of heavy.atoms) {
      const neighLabs = heavy.bonds
        .filter((b) => b.a === a.id || b.b === a.id)
        .map((b) => {
          const other = b.a === a.id ? b.b : b.a
          return `${labels.get(other)}:${b.order}`
        })
        .sort()
      next.set(a.id, `${a.element}(${neighLabs.join('|')})`)
    }
    labels = next
  }

  return [...labels.values()].sort().join(';')
}

export function skeletonsMatch(a: OrganicGraph, b: OrganicGraph): boolean {
  return canonicalizeSkeleton(a) === canonicalizeSkeleton(b)
}

/** Эталон из списка рёбер тяжёлых атомов: элементы + пары индексов и order. */
export type SkeletonSpec = {
  elements: readonly OrganicElement[]
  /** [i, j, order?] индексы в elements */
  edges: readonly (readonly [number, number] | readonly [number, number, 1 | 2 | 3])[]
}

export function graphFromSkeletonSpec(spec: SkeletonSpec): OrganicGraph {
  resetOrganicIdSeq(0)
  const atoms: OrganicAtom[] = spec.elements.map((element, i) => ({
    id: `t_${element}_${i}`,
    element,
    pos: [i * 1.4, 0, 0] as Vec3,
  }))
  const bonds: OrganicBond[] = spec.edges.map((e, i) => {
    const order = (e[2] ?? 1) as 1 | 2 | 3
    return {
      id: `tb_${i}`,
      a: atoms[e[0]]!.id,
      b: atoms[e[1]]!.id,
      order,
    }
  })
  return { atoms, bonds }
}

export function matchesSkeletonSpec(graph: OrganicGraph, spec: SkeletonSpec): boolean {
  return skeletonsMatch(graph, graphFromSkeletonSpec(spec))
}

export function toCompoundPreview(
  graph: OrganicGraph,
  id = 'organic-preview',
): {
  id: string
  atoms: Atom3D[]
  bonds: readonly (readonly [number, number])[]
  composition: Record<string, number>
} {
  const index = new Map(graph.atoms.map((a, i) => [a.id, i]))
  const atoms: Atom3D[] = graph.atoms.map((a) => ({ symbol: a.element, pos: a.pos }))
  const bonds: (readonly [number, number])[] = []
  for (const b of graph.bonds) {
    const i = index.get(b.a)
    const j = index.get(b.b)
    if (i === undefined || j === undefined) continue
    // кратные связи — несколько цилиндров чуть смещены в layout; здесь одна запись на ребро
    bonds.push([i, j])
    if (b.order >= 2) bonds.push([i, j])
    if (b.order >= 3) bonds.push([i, j])
  }
  return { id, atoms, bonds, composition: compositionOf(graph) }
}
