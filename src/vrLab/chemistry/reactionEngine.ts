import { compoundById } from '../../data/compounds'
import type { VrLabMixResult } from '../types'
import { applyAqueousRules } from './aqueousRules'
import { findOverride, overrideReactionCount, listOverrideSubstanceIds } from './reactionOverrides'

export function resolveReaction(a: string | null | undefined, b: string | null | undefined): VrLabMixResult {
  if (!a || !b) {
    return {
      kind: 'empty',
      effect: 'noReaction',
      equationUnicode: '',
      messageKey: 'vrLab.reaction.empty',
      heat: 0,
      bubbleIntensity: 0,
      confidence: 'none',
    }
  }

  if (a === b) {
    return {
      kind: 'sameSubstance',
      productId: a,
      effect: 'noReaction',
      equationUnicode: compoundById[a]?.formulaUnicode ?? a,
      messageKey: 'vrLab.reaction.same',
      heat: 0,
      bubbleIntensity: 0,
      confidence: 'none',
    }
  }

  const override = findOverride(a, b)
  if (override) {
    return {
      kind: 'reaction',
      productId: override.productId,
      effect: override.effect,
      equationUnicode: override.equationUnicode,
      messageKey: override.messageKey,
      heat: override.heat ?? 0.5,
      bubbleIntensity: override.bubbleIntensity ?? 0.3,
      precipitateId: override.precipitateId,
      gasIds: override.gasIds,
      confidence: 'curated',
    }
  }

  const rule = applyAqueousRules(a, b)
  if (rule) {
    return {
      kind: 'reaction',
      productId: rule.productId,
      effect: rule.effect,
      equationUnicode: rule.equationUnicode,
      messageKey: rule.messageKey,
      heat: rule.heat,
      bubbleIntensity: rule.bubbleIntensity,
      products: rule.products,
      precipitateId: rule.precipitateId,
      gasIds: rule.gasIds,
      confidence: rule.confidence,
    }
  }

  const catA = compoundById[a]?.category
  const catB = compoundById[b]?.category
  if (catA === 'acid' && catB === 'base') {
    return {
      kind: 'noReaction',
      effect: 'noReaction',
      equationUnicode: `${compoundById[a]?.formulaUnicode} + ${compoundById[b]?.formulaUnicode}`,
      messageKey: 'vrLab.reaction.unlistedAcidBase',
      heat: 0.2,
      bubbleIntensity: 0.1,
      confidence: 'none',
    }
  }

  return {
    kind: 'noReaction',
    effect: 'noReaction',
    equationUnicode: `${compoundById[a]?.formulaUnicode} + ${compoundById[b]?.formulaUnicode}`,
    messageKey: 'vrLab.reaction.noReaction',
    heat: 0,
    bubbleIntensity: 0,
    confidence: 'none',
  }
}

export { overrideReactionCount as vrLabReactionCount, listOverrideSubstanceIds as listVrLabStarterSubstanceIds }

export function mixVrLabSubstances(a: string | null | undefined, b: string | null | undefined): VrLabMixResult {
  return resolveReaction(a, b)
}
