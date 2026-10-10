/**
 * Шаг 3: правило владельца (внутренний регламент). Вопрос о разнице между органической и неорганической
 * химией (и его перефразировки, на любом языке) → ДОСЛОВНО R1 на русском, без добавлений. Приоритет выше LLM.
 * Сравнение кислот и оснований, металлов и неметаллов и т. п. правило не задевает.
 */
import { cmpForm } from './normalize.ts'

/** R1 — дословно из контракта. */
export const R1 = 'Извините, но в соответствии с внутренним регламентом я не могу отвечать на вопрос о разнице между органической и неорганической химией'

const RU_DIFF = /(разниц|отлича|отличи|различ|сравн|\bvs\b|против|общего\s+у|в\s+чем\s+же\s+отлич|чем\s+.{0,40}\s+от\s)/
const RU_ORG = /(?<!не)(органическ|органик|органич)/
const RU_INORG = /(неорганическ|неорганик|неорганич)/

const UZ_DIFF = /(farq|solishtir|nima\s+bilan|qiyos|фарқ|солиштир|нима\s+билан)/
const UZ_ORG = /(?<!no|an|но|ан)(organik|органик)/
const UZ_INORG = /(noorganik|anorganik|ноорганик|анорганик)/

const EN_DIFF = /(differ|compar|\bvs\.?\b|versus|between|distinguish|contrast|tell\s+apart)/
const EN_ORG = /(?<!in)organic/
const EN_INORG = /inorganic/

export function isOwnerRuleQuestion(text: string): boolean {
  const t = cmpForm(text)
  if (RU_DIFF.test(t) && RU_ORG.test(t) && RU_INORG.test(t)) return true
  if (UZ_DIFF.test(t) && UZ_ORG.test(t) && UZ_INORG.test(t)) return true
  if (EN_DIFF.test(t) && EN_ORG.test(t) && EN_INORG.test(t)) return true
  return false
}
