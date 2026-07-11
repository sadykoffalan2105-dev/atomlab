import type { OrganicGraph } from '../../chemistry/organic/organicGraph'
import type { OrganicClassId } from '../researchLab/organicBuildCatalog'
import type { OrganicFunctionalGroup } from './organicMoleculeTypes'

function neighborEls(graph: OrganicGraph, id: string): string[] {
  const out: string[] = []
  for (const b of graph.bonds) {
    const other = b.a === id ? b.b : b.b === id ? b.a : null
    if (!other) continue
    const a = graph.atoms.find((x) => x.id === other)
    if (a) out.push(a.element)
  }
  return out
}

function bondOrderBetween(graph: OrganicGraph, a: string, b: string): number {
  const bond = graph.bonds.find(
    (x) => (x.a === a && x.b === b) || (x.a === b && x.b === a),
  )
  return bond?.order ?? 0
}

/** Авто-метки FG по классу и графу (учебные подписи). */
export function inferFunctionalGroups(
  graph: OrganicGraph,
  classId: OrganicClassId,
): OrganicFunctionalGroup[] {
  const groups: OrganicFunctionalGroup[] = []
  let n = 0
  const push = (
    label: string,
    labelRu: string,
    atomIds: string[],
    en = label,
    uz = label,
  ) => {
    n += 1
    groups.push({
      id: `fg_${n}`,
      label,
      labelRu,
      labelEn: en,
      labelUz: uz,
      atomIds,
    })
  }

  for (const a of graph.atoms) {
    if (a.element === 'O') {
      const ns = neighborEls(graph, a.id)
      const hN = graph.bonds
        .filter((b) => b.a === a.id || b.b === a.id)
        .map((b) => (b.a === a.id ? b.b : b.a))
        .filter((id) => graph.atoms.find((x) => x.id === id)?.element === 'H')
      const cN = graph.bonds
        .filter((b) => b.a === a.id || b.b === a.id)
        .map((b) => (b.a === a.id ? b.b : b.a))
        .filter((id) => graph.atoms.find((x) => x.id === id)?.element === 'C')

      if (hN.length === 1 && cN.length === 1) {
        push('-OH', 'Гидроксильная', [a.id, cN[0]!, hN[0]!], 'Hydroxyl', 'Gidroksil')
      } else if (cN.length === 2 && hN.length === 0) {
        const orders = cN.map((cid) => bondOrderBetween(graph, a.id, cid))
        if (orders.some((o) => o === 2)) {
          push('C=O', 'Карбонил', [a.id, ...cN], 'Carbonyl', 'Karbonil')
        } else {
          push('-O-', 'Эфирный кислород', [a.id, ...cN], 'Ether oxygen', 'Efir kislorodi')
        }
      } else if (cN.length === 1 && hN.length === 0) {
        const order = bondOrderBetween(graph, a.id, cN[0]!)
        if (order === 2) push('C=O', 'Карбонил', [a.id, cN[0]!], 'Carbonyl', 'Karbonil')
      }
      void ns
    }

    if (a.element === 'Cl') {
      push('-Cl', 'Галоген', [a.id], 'Halogen', 'Galogen')
    }

    if (a.element === 'N') {
      const hN = neighborEls(graph, a.id).filter((e) => e === 'H').length
      if (hN >= 1) push('-NH₂', 'Аминогруппа', [a.id], 'Amino', 'Amino')
      else push('-N=', 'Азот', [a.id], 'Nitrogen', 'Azot')
    }
  }

  // Кратные C–C
  const seen = new Set<string>()
  for (const b of graph.bonds) {
    const A = graph.atoms.find((x) => x.id === b.a)
    const B = graph.atoms.find((x) => x.id === b.b)
    if (!A || !B || A.element !== 'C' || B.element !== 'C') continue
    const key = [b.a, b.b].sort().join('-')
    if (seen.has(key)) continue
    seen.add(key)
    if (b.order === 2) push('C=C', 'Двойная связь', [b.a, b.b], 'Double bond', 'Qoʻsh bogʻ')
    if (b.order === 3) push('C≡C', 'Тройная связь', [b.a, b.b], 'Triple bond', 'Uch bogʻ')
  }

  if (classId === 'arene' || classId === 'phenol') {
    const carbons = graph.atoms.filter((a) => a.element === 'C').slice(0, 6)
    if (carbons.length >= 6) {
      push('Ar', 'Ароматическое кольцо', carbons.map((c) => c.id), 'Aromatic ring', 'Aromatik halqa')
    }
  }

  if (classId === 'acid') {
    // carboxyl: C with =O and -OH
    for (const c of graph.atoms.filter((a) => a.element === 'C')) {
      const neigh = graph.bonds
        .filter((b) => b.a === c.id || b.b === c.id)
        .map((b) => {
          const oid = b.a === c.id ? b.b : b.a
          const el = graph.atoms.find((x) => x.id === oid)?.element
          return { id: oid, el, order: b.order }
        })
      const oxy = neigh.filter((n) => n.el === 'O')
      if (oxy.length >= 2 && oxy.some((o) => o.order === 2)) {
        push('-COOH', 'Карбоксил', [c.id, ...oxy.map((o) => o.id)], 'Carboxyl', 'Karboksil')
        break
      }
    }
  }

  if (classId === 'carb') {
    for (const a of graph.atoms) {
      if (a.element !== 'O') continue
      const cN = graph.bonds
        .filter((b) => b.a === a.id || b.b === a.id)
        .map((b) => (b.a === a.id ? b.b : b.a))
        .filter((id) => graph.atoms.find((x) => x.id === id)?.element === 'C')
      if (cN.length === 2) {
        push('-O-', 'Гликозидный кислород', [a.id, ...cN], 'Glycosidic oxygen', 'Glikozid kislorodi')
        break
      }
    }
  }

  // Уникальность по label+первому атому
  const uniq: OrganicFunctionalGroup[] = []
  const keys = new Set<string>()
  for (const g of groups) {
    const k = `${g.label}:${g.atomIds[0]}`
    if (keys.has(k)) continue
    keys.add(k)
    uniq.push(g)
  }
  return uniq.slice(0, 8)
}

const CLASS_ACCENT: Partial<Record<OrganicClassId, string>> = {
  alkane: '#94a3b8',
  cycloalkane: '#a5b4fc',
  alkene: '#67e8f9',
  alkadiene: '#22d3ee',
  alkyne: '#f0abfc',
  arene: '#fbbf24',
  alcohol: '#34d399',
  polyol: '#6ee7b7',
  phenol: '#f472b6',
  ether: '#2dd4bf',
  aldehyde: '#fb923c',
  ketone: '#fdba74',
  acid: '#f87171',
  ester: '#c084fc',
  carb: '#a3e635',
  halo: '#86efac',
  nitrogen: '#60a5fa',
}

export function accentForClass(classId: OrganicClassId): string {
  return CLASS_ACCENT[classId] ?? '#34d399'
}
