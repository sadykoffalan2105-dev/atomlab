/**
 * Собранная в Конструкторе молекула вне реестра → OV2Molecule для общего Molecule3D (contracts.ts).
 * Координаты и гибридизация — из встраивателя движка (embed3D), кольца ищутся здесь (кратчайший цикл через каждую связь).
 * Частичные заряды не считаются (q = 0): в Конструкторе слой δ+/δ− не показывается.
 */
import type { OV2Hybridization, OV2Molecule } from '../../../data/organicV2/types'

export interface EmbAtom { readonly el: string; readonly p: readonly [number, number, number]; readonly hyb?: OV2Hybridization; readonly charge?: number }
export interface EmbBond { readonly a: number; readonly b: number; readonly o: 1 | 2 | 3; readonly ar?: boolean }
export interface Embedded { readonly atoms: readonly EmbAtom[]; readonly bonds: readonly EmbBond[] }

/** Кратчайшие циклы через каждую связь (для небольших школьных молекул этого достаточно: бензол, циклогексан, нафталин). */
export function findRings(n: number, bonds: readonly { a: number; b: number }[], maxSize = 8): number[][] {
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (const b of bonds) { adj[b.a]?.push(b.b); adj[b.b]?.push(b.a) }
  const seen = new Set<string>()
  const out: number[][] = []
  for (const { a, b } of bonds) {
    if ((adj[a]?.length ?? 0) < 2 || (adj[b]?.length ?? 0) < 2) continue
    // BFS из a в b без самой связи a–b
    const prev = new Map<number, number>([[a, -1]])
    const q = [a]
    let found = false
    for (let h = 0; h < q.length && !found; h++) {
      const u = q[h]!
      for (const v of adj[u]!) {
        if ((u === a && v === b) || prev.has(v)) continue
        prev.set(v, u)
        if (v === b) { found = true; break }
        q.push(v)
      }
    }
    if (!found) continue
    const ring: number[] = []
    for (let x = b; x !== -1; x = prev.get(x)!) ring.push(x)
    if (ring.length > maxSize) continue
    const key = [...ring].sort((x, y) => x - y).join(',')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ring)
  }
  return out
}

export function embeddedToOV2(id: string, formula: string, e: Embedded): OV2Molecule {
  const arAtom = new Set<number>()
  for (const b of e.bonds) if (b.ar) { arAtom.add(b.a); arAtom.add(b.b) }
  return {
    id,
    smiles: '',
    inchikey: '',
    formula,
    atoms: e.atoms.map((a, i) => ({
      el: a.el,
      p: [a.p[0], a.p[1], a.p[2]] as const,
      p2: [a.p[0], a.p[1]] as const,
      hyb: a.hyb ?? '',
      q: 0,
      ch: a.charge ?? 0,
      ar: arAtom.has(i),
    })),
    bonds: e.bonds.map((b) => ({ a: b.a, b: b.b, o: b.o, ...(b.ar ? { ar: true } : {}) })),
    groups: [],
    rings: findRings(e.atoms.length, e.bonds),
    grades: [10],
  }
}
