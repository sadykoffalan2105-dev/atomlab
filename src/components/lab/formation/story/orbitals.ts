import type { FormationPlan } from '../../../../chemistry/formationPlan'
import type { SchoolHeroModel } from '../../hero/schoolHeroModel'
import { distributeElectrons, type LBond } from '../board/lewis'
import type { AtomOrbital, Hybrid, StoryOrbitals } from './phase'

/**
 * Данные электронных облаков «Как образуется» по атомам модели карточки (story.orbitals): номер внешнего уровня, s/p
 * электроны нейтрального атома (по группе Периодической системы, Kimyo 8), гибридизация по числу σ-направлений,
 * неподелённые пары итоговой частицы (board/lewis.ts — distributeElectrons), роль и отданные/принятые e⁻ у ионов.
 * d-электроны не рисуются (школьная программа): у d-металлов — только внешний s (Cu, Ag, Au, Cr — s¹: «провал» электрона).
 */

/** Период (номер внешнего уровня). */
const PERIOD: Record<string, number> = {
  H: 1, He: 1, Li: 2, Be: 2, B: 2, C: 2, N: 2, O: 2, F: 2, Na: 3, Mg: 3, Al: 3, Si: 3, P: 3, S: 3, Cl: 3,
  K: 4, Ca: 4, V: 4, Cr: 4, Mn: 4, Fe: 4, Cu: 4, Zn: 4, Br: 4, Ag: 5, I: 5, Ba: 6, Au: 6, Hg: 6, Pb: 6,
}
/** [s, p] внешнего уровня нейтрального атома. Pb — p-элемент (6s²6p²). */
const SP: Record<string, [number, number]> = {
  H: [1, 0], Li: [1, 0], Na: [1, 0], K: [1, 0], Be: [2, 0], Mg: [2, 0], Ca: [2, 0], Ba: [2, 0], Zn: [2, 0], Hg: [2, 0],
  B: [2, 1], Al: [2, 1], C: [2, 2], Si: [2, 2], Pb: [2, 2], N: [2, 3], P: [2, 3], O: [2, 4], S: [2, 4],
  F: [2, 5], Cl: [2, 5], Br: [2, 5], I: [2, 5],
  Fe: [2, 0], Mn: [2, 0], V: [2, 0], Cu: [1, 0], Ag: [1, 0], Au: [1, 0], Cr: [1, 0],
}
const METAL = /^(Li|Na|K|Be|Mg|Ca|Ba|Zn|Hg|Al|Fe|Mn|V|Cu|Ag|Au|Cr|Pb)$/
const TERMINAL_NONE = /^(H|F|Cl|Br|I)$/

export function buildStoryOrbitals(plan: FormationPlan, model: SchoolHeroModel): StoryOrbitals {
  const n = model.atoms.length
  const lone = new Array<number>(n).fill(0)
  const unitOf = new Array<number>(n).fill(-1)
  const neighbors = new Array<number>(n).fill(0)
  for (const b of model.bonds) {
    neighbors[b.a]! += 1
    neighbors[b.b]! += 1
  }
  const bondsIn = (atoms: number[]): LBond[] => {
    const idx = new Map(atoms.map((a, k) => [a, k]))
    return model.bonds.flatMap((b) => (idx.has(b.a) && idx.has(b.b) ? [{ a: idx.get(b.a)!, b: idx.get(b.b)!, order: Math.max(1, Math.round(b.order)) }] : []))
  }
  const fill = (atoms: number[], charge: number) => {
    const r = distributeElectrons(atoms.map((a) => model.atoms[a]!.el), bondsIn(atoms), charge)
    if (r) atoms.forEach((a, k) => (lone[a] = r.lone[k]!))
  }
  if (plan.mode === 'ionic') {
    plan.units.forEach((u, k) => {
      for (const a of u.atoms) unitOf[a] = k
      fill(u.atoms, plan.species[u.species]!.charge)
    })
  } else {
    // молекула (или несколько молекул, NH₃·H₂O): связные компоненты по связям модели
    const seen = new Array<boolean>(n).fill(false)
    for (let s = 0; s < n; s++) {
      if (seen[s]) continue
      const comp: number[] = []
      const stack = [s]
      seen[s] = true
      while (stack.length) {
        const a = stack.pop()!
        comp.push(a)
        for (const b of model.bonds) {
          const o = b.a === a ? b.b : b.b === a ? b.a : -1
          if (o >= 0 && !seen[o]) {
            seen[o] = true
            stack.push(o)
          }
        }
      }
      fill(comp, 0)
    }
  }
  const p4 = plan.compoundId === 'tb_p4'
  const atoms: AtomOrbital[] = model.atoms.map((a, i) => {
    const el = a.el
    const [s, p] = SP[el] ?? [2, 0]
    let role: AtomOrbital['role'] = 'covalent'
    let dq: number | undefined
    if (plan.mode === 'ionic') {
      const u = plan.units[unitOf[i]!]
      const sp = u ? plan.species[u.species]! : null
      if (sp && u!.atoms.length === 1 && sp.charge !== 0) {
        role = sp.charge > 0 ? 'cation' : 'anion'
        // катион отдал +n e⁻, анион принял −n e⁻ (dq = заряд иона)
        dq = sp.charge
      }
    }
    // гибридизация: σ-направления = соседи + неподелённые пары (у центрального неметалла; концевые H/галогены/O — нет)
    let hybrid: Hybrid = 'none'
    const sigma = neighbors[i]! + lone[i]!
    if (role === 'covalent' && !METAL.test(el) && !TERMINAL_NONE.test(el) && neighbors[i]! >= 2 && !p4) {
      hybrid = sigma >= 4 ? 'sp3' : sigma === 3 ? 'sp2' : 'sp'
    }
    return { i, el, n: PERIOD[el] ?? 2, s, p, hybrid, lone: lone[i]!, role, ...(dq != null ? { dq } : {}) }
  })
  return { atoms }
}
