import type { OrganicGraph, OrganicAtom, OrganicBond, OrganicElement } from '../../../chemistry/organic/organicGraph'
import type { Vec3 } from '../../../types/chemistry'

/** β-D-Глюкопираноза — учебное кресловое кольцо C₅O + CH₂OH (упрощённая геометрия Kimyo). */
export function glucosePyranoseGraph(): OrganicGraph {
  // Ring: C1-C2-C3-C4-C5-O5, exocyclic C6 on C5
  const ring: { el: OrganicElement; pos: Vec3 }[] = [
    { el: 'C', pos: [1.2, 0.35, 0.55] }, // C1
    { el: 'C', pos: [0.6, -0.55, -0.45] }, // C2
    { el: 'C', pos: [-0.75, -0.55, -0.45] }, // C3
    { el: 'C', pos: [-1.35, 0.35, 0.55] }, // C4
    { el: 'C', pos: [-0.55, 1.15, -0.15] }, // C5
    { el: 'O', pos: [0.7, 1.05, -0.2] }, // O5 ring
    { el: 'C', pos: [-1.05, 2.35, 0.55] }, // C6
    { el: 'O', pos: [2.35, 0.55, -0.15] }, // O1 (β-OH on C1)
    { el: 'O', pos: [1.15, -1.65, 0.25] }, // O2
    { el: 'O', pos: [-1.25, -1.65, 0.25] }, // O3
    { el: 'O', pos: [-2.55, 0.55, -0.15] }, // O4
    { el: 'O', pos: [-2.25, 2.55, 0.15] }, // O6
  ]

  const atoms: OrganicAtom[] = ring.map((r, i) => ({
    id: `gp_${r.el}_${i}`,
    element: r.el,
    pos: r.pos,
  }))

  const heavyEdges: Array<readonly [number, number] | readonly [number, number, 1 | 2 | 3]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 0],
    [4, 6],
    [0, 7],
    [1, 8],
    [2, 9],
    [3, 10],
    [6, 11],
  ]

  const bonds: OrganicBond[] = heavyEdges.map((e, i) => ({
    id: `gp_b_${i}`,
    a: atoms[e[0]]!.id,
    b: atoms[e[1]]!.id,
    order: (e[2] ?? 1) as 1 | 2 | 3,
  }))

  // Add hydrogens for remaining valence (C=4, O=2)
  let hSeq = 0
  const addH = (center: OrganicAtom, dir: Vec3) => {
    const hid = `gp_H_${hSeq++}`
    atoms.push({
      id: hid,
      element: 'H',
      pos: [center.pos[0] + dir[0], center.pos[1] + dir[1], center.pos[2] + dir[2]],
    })
    bonds.push({ id: `gp_bh_${hSeq}`, a: center.id, b: hid, order: 1 })
  }

  const used = (id: string) =>
    bonds.filter((b) => b.a === id || b.b === id).reduce((s, b) => s + b.order, 0)

  const dirs: Vec3[] = [
    [0.7, 0.7, 0.5],
    [-0.7, 0.7, 0.5],
    [0.7, -0.5, -0.7],
    [-0.5, -0.7, 0.6],
  ]

  for (const a of [...atoms]) {
    if (a.element === 'H') continue
    const max = a.element === 'C' ? 4 : a.element === 'O' ? 2 : 1
    let free = max - used(a.id)
    let di = 0
    while (free > 0) {
      addH(a, dirs[di % dirs.length]!)
      di += 1
      free -= 1
    }
  }

  return { atoms, bonds }
}

/** Фруктоза — упрощённая открытая кетоза C₆H₁₂O₆ (учебная модель). */
export function fructoseOpenGraph(): OrganicGraph {
  const heavies: { el: OrganicElement; pos: Vec3 }[] = [
    { el: 'C', pos: [-2.4, 0.6, 0] },
    { el: 'C', pos: [-1.2, 0, 0] },
    { el: 'C', pos: [0, 0, 0] },
    { el: 'C', pos: [1.2, 0, 0] },
    { el: 'C', pos: [2.4, 0.4, 0] },
    { el: 'C', pos: [3.5, -0.3, 0.3] },
    { el: 'O', pos: [-1.2, 1.25, 0] },
    { el: 'O', pos: [-3.2, 0.2, 0.5] },
    { el: 'O', pos: [0, -1.2, 0.3] },
    { el: 'O', pos: [1.2, 1.2, 0.3] },
    { el: 'O', pos: [2.4, -0.8, 0.5] },
    { el: 'O', pos: [4.4, 0.3, 0] },
  ]

  const atoms: OrganicAtom[] = heavies.map((h, i) => ({
    id: `fr_${h.el}_${i}`,
    element: h.el,
    pos: h.pos,
  }))

  const edges: Array<readonly [number, number] | readonly [number, number, 1 | 2 | 3]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [1, 6, 2],
    [0, 7],
    [2, 8],
    [3, 9],
    [4, 10],
    [5, 11],
  ]

  const bonds: OrganicBond[] = edges.map((e, i) => ({
    id: `fr_b_${i}`,
    a: atoms[e[0]]!.id,
    b: atoms[e[1]]!.id,
    order: (e[2] ?? 1) as 1 | 2 | 3,
  }))

  let hSeq = 0
  const used = (id: string) =>
    bonds.filter((b) => b.a === id || b.b === id).reduce((s, b) => s + b.order, 0)
  const addH = (center: OrganicAtom, dir: Vec3) => {
    const hid = `fr_H_${hSeq++}`
    atoms.push({
      id: hid,
      element: 'H',
      pos: [center.pos[0] + dir[0], center.pos[1] + dir[1], center.pos[2] + dir[2]],
    })
    bonds.push({ id: `fr_bh_${hSeq}`, a: center.id, b: hid, order: 1 })
  }
  const dirs: Vec3[] = [
    [0.65, 0.65, 0.55],
    [-0.65, 0.55, 0.55],
    [0.55, -0.65, -0.55],
    [-0.55, -0.55, 0.65],
  ]
  for (const a of [...atoms]) {
    if (a.element === 'H') continue
    const max = a.element === 'C' ? 4 : a.element === 'O' ? 2 : 1
    let free = max - used(a.id)
    let di = 0
    while (free > 0) {
      addH(a, dirs[di % dirs.length]!)
      di += 1
      free -= 1
    }
  }
  return { atoms, bonds }
}

/** Сахароза — упрощённый дисахарид: два кольца, связанные гликозидно (учебная схема). */
export function sucroseSimplifiedGraph(): OrganicGraph {
  // Glucose-like hexagon + fructose-like pentagon, linked O
  const g = glucosePyranoseGraph()
  // Shift fructose fragment
  const fruBase: { el: OrganicElement; pos: Vec3 }[] = [
    { el: 'C', pos: [4.2, 0.4, 0.2] },
    { el: 'C', pos: [5.3, -0.3, -0.3] },
    { el: 'C', pos: [6.5, 0.2, 0.2] },
    { el: 'C', pos: [6.2, 1.5, -0.2] },
    { el: 'O', pos: [4.8, 1.4, -0.3] },
    { el: 'C', pos: [7.6, -0.4, 0.5] },
    { el: 'O', pos: [3.5, -0.5, 0.5] }, // bridge O — will reconnect
    { el: 'O', pos: [5.3, -1.5, 0.2] },
    { el: 'O', pos: [7.4, 1.0, 0.6] },
    { el: 'O', pos: [8.5, 0.2, 0] },
  ]

  const offset = g.atoms.length
  const atoms: OrganicAtom[] = [
    ...g.atoms,
    ...fruBase.map((h, i) => ({
      id: `su_${h.el}_${i}`,
      element: h.el,
      pos: h.pos,
    })),
  ]

  const bonds: OrganicBond[] = [...g.bonds]
  const localEdges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 0],
    [2, 5],
    [1, 7],
    [3, 8],
    [5, 9],
  ]
  for (const [a, b] of localEdges) {
    bonds.push({
      id: `su_b_${a}_${b}`,
      a: atoms[offset + a]!.id,
      b: atoms[offset + b]!.id,
      order: 1,
    })
  }
  // Glycosidic: glucose O1 (index 7 in glucose heavies = gp_O_7) to fructose C
  const gluO1 = g.atoms.find((a) => a.id === 'gp_O_7')
  const fruC = atoms[offset]
  if (gluO1 && fruC) {
    // remove H on O1 if excess, just add bond to fru if valence allows — simplify: bond O1-fruC0
    bonds.push({ id: 'su_glyco', a: gluO1.id, b: fruC.id, order: 1 })
  }

  return { atoms, bonds }
}
