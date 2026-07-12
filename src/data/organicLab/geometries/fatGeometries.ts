import type { OrganicGraph, OrganicAtom, OrganicBond } from '../../../chemistry/organic/organicGraph'
import type { Vec3 } from '../../../types/chemistry'

/**
 * Триацетин (учебная модель жира): глицерин + 3 ацетата.
 * Упрощённая геометрия для Kimyo 10 §3.16.
 */
export function triacetinGraph(): OrganicGraph {
  // Backbone glycerol C1–C2–C3
  const heavy: { el: 'C' | 'O'; pos: Vec3; id: string }[] = [
    { el: 'C', pos: [-1.4, 0, 0], id: 'ta_C1' },
    { el: 'C', pos: [0, 0, 0], id: 'ta_C2' },
    { el: 'C', pos: [1.4, 0, 0], id: 'ta_C3' },
    // ester O on each
    { el: 'O', pos: [-1.4, 1.2, 0], id: 'ta_O1' },
    { el: 'O', pos: [0, 1.2, 0], id: 'ta_O2' },
    { el: 'O', pos: [1.4, 1.2, 0], id: 'ta_O3' },
    // carbonyl C
    { el: 'C', pos: [-1.4, 2.3, 0.5], id: 'ta_C1a' },
    { el: 'C', pos: [0, 2.3, 0.5], id: 'ta_C2a' },
    { el: 'C', pos: [1.4, 2.3, 0.5], id: 'ta_C3a' },
    // carbonyl O
    { el: 'O', pos: [-2.4, 2.8, 0.9], id: 'ta_O1c' },
    { el: 'O', pos: [-0.9, 2.8, 1.2], id: 'ta_O2c' },
    { el: 'O', pos: [2.4, 2.8, 0.9], id: 'ta_O3c' },
    // methyl
    { el: 'C', pos: [-1.0, 3.3, -0.5], id: 'ta_C1m' },
    { el: 'C', pos: [0.5, 3.3, -0.5], id: 'ta_C2m' },
    { el: 'C', pos: [1.0, 3.3, -0.5], id: 'ta_C3m' },
  ]

  const atoms: OrganicAtom[] = heavy.map((h) => ({
    id: h.id,
    element: h.el,
    pos: h.pos,
  }))

  const edges: Array<readonly [string, string, 1 | 2]> = [
    ['ta_C1', 'ta_C2', 1],
    ['ta_C2', 'ta_C3', 1],
    ['ta_C1', 'ta_O1', 1],
    ['ta_C2', 'ta_O2', 1],
    ['ta_C3', 'ta_O3', 1],
    ['ta_O1', 'ta_C1a', 1],
    ['ta_O2', 'ta_C2a', 1],
    ['ta_O3', 'ta_C3a', 1],
    ['ta_C1a', 'ta_O1c', 2],
    ['ta_C2a', 'ta_O2c', 2],
    ['ta_C3a', 'ta_O3c', 2],
    ['ta_C1a', 'ta_C1m', 1],
    ['ta_C2a', 'ta_C2m', 1],
    ['ta_C3a', 'ta_C3m', 1],
  ]

  const bonds: OrganicBond[] = edges.map(([a, b, order], i) => ({
    id: `ta_b_${i}`,
    a,
    b,
    order,
  }))

  // Pad with hydrogens for remaining valence (simplified teaching model)
  const valenceNeed: Record<string, number> = {
    C: 4,
    O: 2,
  }
  const used = new Map<string, number>()
  for (const a of atoms) used.set(a.id, 0)
  for (const b of bonds) {
    used.set(b.a, (used.get(b.a) ?? 0) + b.order)
    used.set(b.b, (used.get(b.b) ?? 0) + b.order)
  }

  let hIdx = 0
  for (const a of [...atoms]) {
    const need = valenceNeed[a.element] ?? 0
    const have = used.get(a.id) ?? 0
    for (let k = 0; k < need - have; k++) {
      const hid = `ta_H_${hIdx++}`
      const ang = (k + 1) * 0.9
      atoms.push({
        id: hid,
        element: 'H',
        pos: [a.pos[0] + Math.cos(ang) * 0.95, a.pos[1] - 0.7, a.pos[2] + Math.sin(ang) * 0.95],
      })
      bonds.push({ id: `ta_bh_${hid}`, a: a.id, b: hid, order: 1 })
    }
  }

  return { atoms, bonds }
}
