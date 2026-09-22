import { getSchoolReaction } from '../chemistry/schoolReactionBank'
import type { SynthesisLabConditions } from '../types/chemistry'

/**
 * Условия реактора (нагрев / давление / катализатор) для текущего уравнения.
 * У вещества в данных записаны условия ЕГО синтеза (для NaCl — горение натрия в хлоре, нужен нагрев).
 * Если уравнение пришло по ссылке с id реакции банка и это нейтрализация, те же условия не подходят:
 * кислота и щёлочь реагируют при комнатной температуре. Решение 9: смотрим id реакции, а не продукт.
 */
const NO_CONDITIONS: SynthesisLabConditions = Object.freeze({})

export function effectiveLabNeeds(
  compoundNeeds: SynthesisLabConditions | undefined,
  compoundId: string | null | undefined,
  bankReactionId: string | null | undefined,
): SynthesisLabConditions | undefined {
  if (!bankReactionId || !compoundId) return compoundNeeds
  const r = getSchoolReaction(bankReactionId)
  if (!r || r.productId !== compoundId) return compoundNeeds
  if (r.reactionClass === 'neutralization') return NO_CONDITIONS
  return compoundNeeds
}
