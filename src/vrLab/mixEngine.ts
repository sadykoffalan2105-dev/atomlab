import { compoundById } from '../data/compounds'
import type { VrLabMixResult, VrLabReactionEffect } from './types'

type ReactionDef = {
  a: string
  b: string
  productId: string
  equationUnicode: string
  effect: VrLabReactionEffect
  messageKey: string
  heat?: number
  bubbleIntensity?: number
}

/** Школьные реакции смешивания двух растворов / реагентов (проверены по каталогу). */
const RAW_REACTIONS: ReactionDef[] = [
  {
    a: 'hcl',
    b: 'naoh',
    productId: 'nacl',
    equationUnicode: 'HCl + NaOH → NaCl + H₂O',
    effect: 'neutralization',
    messageKey: 'vrLab.reaction.neutralization',
    heat: 0.7,
    bubbleIntensity: 0.2,
  },
  {
    a: 'h2so4',
    b: 'naoh',
    productId: 'salt_na_so4',
    equationUnicode: 'H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O',
    effect: 'neutralization',
    messageKey: 'vrLab.reaction.neutralization',
    heat: 0.85,
    bubbleIntensity: 0.25,
  },
  {
    a: 'hno3',
    b: 'naoh',
    productId: 'salt_na_no3',
    equationUnicode: 'HNO₃ + NaOH → NaNO₃ + H₂O',
    effect: 'neutralization',
    messageKey: 'vrLab.reaction.neutralization',
    heat: 0.75,
    bubbleIntensity: 0.2,
  },
  {
    a: 'hbr',
    b: 'naoh',
    productId: 'salt_na_br',
    equationUnicode: 'HBr + NaOH → NaBr + H₂O',
    effect: 'neutralization',
    messageKey: 'vrLab.reaction.neutralization',
    heat: 0.65,
    bubbleIntensity: 0.15,
  },
  {
    a: 'hcl',
    b: 'koh',
    productId: 'salt_k_cl',
    equationUnicode: 'HCl + KOH → KCl + H₂O',
    effect: 'neutralization',
    messageKey: 'vrLab.reaction.neutralization',
    heat: 0.7,
    bubbleIntensity: 0.2,
  },
  {
    a: 'hcl',
    b: 'ca_oh_2',
    productId: 'salt_ca_cl',
    equationUnicode: '2HCl + Ca(OH)₂ → CaCl₂ + 2H₂O',
    effect: 'neutralization',
    messageKey: 'vrLab.reaction.neutralization',
    heat: 0.8,
    bubbleIntensity: 0.3,
  },
  {
    a: 'hcl',
    b: 'mg_oh_2',
    productId: 'salt_mg_cl',
    equationUnicode: '2HCl + Mg(OH)₂ → MgCl₂ + 2H₂O',
    effect: 'neutralization',
    messageKey: 'vrLab.reaction.neutralization',
    heat: 0.75,
    bubbleIntensity: 0.35,
  },
  {
    a: 'hcl',
    b: 'fe_oh_3',
    productId: 'salt_fe3_cl',
    equationUnicode: '3HCl + Fe(OH)₃ → FeCl₃ + 3H₂O',
    effect: 'neutralization',
    messageKey: 'vrLab.reaction.neutralization',
    heat: 0.6,
    bubbleIntensity: 0.15,
  },
  {
    a: 'h2so4',
    b: 'cu_oh_2',
    productId: 'salt_cu_so4',
    equationUnicode: 'Cu(OH)₂ + H₂SO₄ → CuSO₄ + 2H₂O',
    effect: 'colorShift',
    messageKey: 'vrLab.reaction.dissolve',
    heat: 0.4,
    bubbleIntensity: 0.1,
  },
  {
    a: 'cao',
    b: 'h2o',
    productId: 'ca_oh_2',
    equationUnicode: 'CaO + H₂O → Ca(OH)₂',
    effect: 'hydration',
    messageKey: 'vrLab.reaction.hydration',
    heat: 0.95,
    bubbleIntensity: 0.5,
  },
  {
    a: 'mgo',
    b: 'h2o',
    productId: 'mg_oh_2',
    equationUnicode: 'MgO + H₂O → Mg(OH)₂',
    effect: 'hydration',
    messageKey: 'vrLab.reaction.hydration',
    heat: 0.5,
    bubbleIntensity: 0.2,
  },
  {
    a: 'na2o',
    b: 'h2o',
    productId: 'naoh',
    equationUnicode: 'Na₂O + H₂O → 2NaOH',
    effect: 'hydration',
    messageKey: 'vrLab.reaction.hydration',
    heat: 0.9,
    bubbleIntensity: 0.45,
  },
  {
    a: 'so2',
    b: 'h2o',
    productId: 'h2so3',
    equationUnicode: 'SO₂ + H₂O → H₂SO₃',
    effect: 'colorShift',
    messageKey: 'vrLab.reaction.dissolve',
    heat: 0.2,
    bubbleIntensity: 0.15,
  },
  {
    a: 'co2',
    b: 'h2o',
    productId: 'h2co3',
    equationUnicode: 'CO₂ + H₂O → H₂CO₃',
    effect: 'gasEvolution',
    messageKey: 'vrLab.reaction.gas',
    heat: 0.1,
    bubbleIntensity: 0.85,
  },
  {
    a: 'nh3',
    b: 'hcl',
    productId: 'salt_nh4_cl',
    equationUnicode: 'NH₃ + HCl → NH₄Cl',
    effect: 'gasEvolution',
    messageKey: 'vrLab.reaction.whiteFume',
    heat: 0.55,
    bubbleIntensity: 0.4,
  },
  {
    a: 'hcl',
    b: 'salt_na_co3',
    productId: 'co2',
    equationUnicode: '2HCl + Na₂CO₃ → 2NaCl + H₂O + CO₂↑',
    effect: 'gasEvolution',
    messageKey: 'vrLab.reaction.co2',
    heat: 0.35,
    bubbleIntensity: 0.9,
  },
  {
    a: 'hcl',
    b: 'salt_nahco3',
    productId: 'co2',
    equationUnicode: 'HCl + NaHCO₃ → NaCl + H₂O + CO₂↑',
    effect: 'gasEvolution',
    messageKey: 'vrLab.reaction.co2',
    heat: 0.3,
    bubbleIntensity: 0.88,
  },
  {
    a: 'h2o2',
    b: 'mno2',
    productId: 'h2o',
    equationUnicode: '2H₂O₂ →(MnO₂) 2H₂O + O₂↑',
    effect: 'gasEvolution',
    messageKey: 'vrLab.reaction.catalysis',
    heat: 0.45,
    bubbleIntensity: 1,
  },
  {
    a: 'cuo',
    b: 'h2so4',
    productId: 'salt_cu_so4',
    equationUnicode: 'CuO + H₂SO₄ → CuSO₄ + H₂O',
    effect: 'colorShift',
    messageKey: 'vrLab.reaction.blueSolution',
    heat: 0.35,
    bubbleIntensity: 0.1,
  },
  {
    a: 'fe2o3',
    b: 'hcl',
    productId: 'salt_fe3_cl',
    equationUnicode: 'Fe₂O₃ + 6HCl → 2FeCl₃ + 3H₂O',
    effect: 'colorShift',
    messageKey: 'vrLab.reaction.yellowSolution',
    heat: 0.4,
    bubbleIntensity: 0.12,
  },
  {
    a: 'zno',
    b: 'hcl',
    productId: 'salt_zn_cl',
    equationUnicode: 'ZnO + 2HCl → ZnCl₂ + H₂O',
    effect: 'neutralization',
    messageKey: 'vrLab.reaction.dissolve',
    heat: 0.5,
    bubbleIntensity: 0.15,
  },
]

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function filterValidReactions(): ReactionDef[] {
  return RAW_REACTIONS.filter(
    (r) => compoundById[r.a] && compoundById[r.b] && compoundById[r.productId],
  )
}

const VALID_REACTIONS = filterValidReactions()

const REACTION_MAP = new Map<string, ReactionDef>()
for (const r of VALID_REACTIONS) {
  REACTION_MAP.set(pairKey(r.a, r.b), r)
}

export function vrLabReactionCount(): number {
  return VALID_REACTIONS.length
}

export function mixVrLabSubstances(
  idA: string | null | undefined,
  idB: string | null | undefined,
): VrLabMixResult {
  if (!idA || !idB) {
    return {
      kind: 'empty',
      effect: 'noReaction',
      equationUnicode: '',
      messageKey: 'vrLab.reaction.empty',
      heat: 0,
      bubbleIntensity: 0,
    }
  }
  if (idA === idB) {
    return {
      kind: 'sameSubstance',
      productId: idA,
      effect: 'noReaction',
      equationUnicode: compoundById[idA]?.formulaUnicode ?? idA,
      messageKey: 'vrLab.reaction.same',
      heat: 0,
      bubbleIntensity: 0,
    }
  }
  const hit = REACTION_MAP.get(pairKey(idA, idB))
  if (hit) {
    return {
      kind: 'reaction',
      productId: hit.productId,
      effect: hit.effect,
      equationUnicode: hit.equationUnicode,
      messageKey: hit.messageKey,
      heat: hit.heat ?? 0.5,
      bubbleIntensity: hit.bubbleIntensity ?? 0.3,
    }
  }
  const catA = compoundById[idA]?.category
  const catB = compoundById[idB]?.category
  if (catA === 'acid' && catB === 'base') {
    return {
      kind: 'noReaction',
      effect: 'noReaction',
      equationUnicode: `${compoundById[idA]?.formulaUnicode} + ${compoundById[idB]?.formulaUnicode}`,
      messageKey: 'vrLab.reaction.unlistedAcidBase',
      heat: 0.2,
      bubbleIntensity: 0.1,
    }
  }
  return {
    kind: 'noReaction',
    effect: 'noReaction',
    equationUnicode: `${compoundById[idA]?.formulaUnicode} + ${compoundById[idB]?.formulaUnicode}`,
    messageKey: 'vrLab.reaction.noReaction',
    heat: 0,
    bubbleIntensity: 0,
  }
}

export function listVrLabStarterSubstanceIds(): string[] {
  const ids = new Set<string>()
  for (const r of VALID_REACTIONS) {
    ids.add(r.a)
    ids.add(r.b)
  }
  return [...ids].sort()
}
