/**
 * Правило владельца (контракт «Локальный мозг» v1, текст R1 — дословно, на любом языке вопроса):
 * на вопрос о разнице между органической и неорганической химией (и его перефразировки)
 * учитель отвечает только R1 — без цитат и без обращения к мозгу/LLM.
 * «Разница между кислотой и основанием» правило НЕ включает.
 */
import { foldForPolicy } from './lang'

export const OWNER_RULE_TEXT =
  'Извините, но в соответствии с внутренним регламентом я не могу отвечать на вопрос о разнице между органической и неорганической химией'

/* ru: сравнение ∧ «органическ…» (не «неорганическ…») ∧ «неорганическ…» */
const RU_COMPARE =
  /(разниц|разн(ая|ые|ое|ятся|ица)|отлич|различ|сравн|(?<!\p{L})vs(?!\p{L})|versus|против|похож|общего|общее|(?<!\p{L})чем(?!\p{L}).+(?<!\p{L})от(?!\p{L}))/u
const RU_ORGANIC = /(?<!\p{L})органи(ческ|к)/u
const RU_INORGANIC = /(неоргани(ческ|к)|анорганич)/u

/* uz (латиница и кириллица) */
const UZ_COMPARE = /(farq|solishtir|nima\s+bilan|o'xsha|фарқ|фарк|солиштир|нима\s+билан)/u
const UZ_ORGANIC = /(?<!\p{L})(organik|органик)/u
const UZ_INORGANIC = /(noorganik|anorganik|ноорганик|анорганик)/u

/* en */
const EN_COMPARE = /(differ|compar|(?<!\p{L})vs(?!\p{L})|versus|between|distinguish|contrast|unlike|similar)/u
const EN_ORGANIC = /(?<!\p{L})organic/u
const EN_INORGANIC = /inorganic/u

/** Вопрос попадает под правило владельца? */
export function matchesOwnerRule(text: string): boolean {
  const t = foldForPolicy(text)
  if (!t.trim()) return false
  if (RU_COMPARE.test(t) && RU_ORGANIC.test(t) && RU_INORGANIC.test(t)) return true
  if (UZ_COMPARE.test(t) && UZ_ORGANIC.test(t) && UZ_INORGANIC.test(t)) return true
  if (EN_COMPARE.test(t) && EN_ORGANIC.test(t) && EN_INORGANIC.test(t)) return true
  return false
}

/** Ответ R1 (одинаковый для всех языков). */
export function ownerRuleReply(): string {
  return OWNER_RULE_TEXT
}
