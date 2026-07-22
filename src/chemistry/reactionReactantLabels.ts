import { compoundById } from '../data/compounds'
import type { ReactionReactant } from '../data/curriculum/schoolReactionTypes'

/** Подпись реагента для каталога и реактора (RU). */
export function reactantLabelRu(r: ReactionReactant): string {
  if (r.kind === 'element') {
    const sym = elementSymbol(r.z)
    const base = r.diatomic ? `${sym}₂` : sym
    return r.coeff > 1 ? `${r.coeff}${base}` : base
  }
  const c = compoundById[r.compoundId]
  const f = c?.formulaUnicode ?? r.compoundId
  return r.coeff > 1 ? `${r.coeff}${f}` : f
}

export function reactantsSummaryRu(reactants: readonly ReactionReactant[]): string {
  return reactants.map(reactantLabelRu).join(' + ')
}

function elementSymbol(z: number): string {
  const map: Record<number, string> = {
    1: 'H',
    6: 'C',
    7: 'N',
    8: 'O',
    11: 'Na',
    12: 'Mg',
    13: 'Al',
    15: 'P',
    16: 'S',
    17: 'Cl',
    19: 'K',
    20: 'Ca',
    26: 'Fe',
    29: 'Cu',
    30: 'Zn',
    47: 'Ag',
    56: 'Ba',
  }
  return map[z] ?? `Z=${z}`
}
