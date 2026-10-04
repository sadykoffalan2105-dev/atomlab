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
  // У реакции банка свои условия (N₂O₅ + H₂O → 2HNO₃ — без условий, хотя HNO₃ в данных — процесс Оствальда).
  if (r.labNeeds) return r.labNeeds
  return compoundNeeds
}

/** Условия реактора из пометки над стрелкой и подпись катализатора (если указан веществом). */
export type ConditionsLabNeeds = SynthesisLabConditions & { catalystLabel?: string }

const HEAT_WORDS = /(^|[^a-zа-яё])(t°?|т°)(?![a-zа-яё])|нагрев|прокал|кипяч|обжиг|горени|сжиг|сплавл|плавлен|пламя|Δ|t\s*[>≥]/i
const PRESSURE_WORDS = /(^|[^a-zа-яё])p(?![a-zа-яё])|давлен|атм|мпа|(^|[^a-zа-яё])бар(?![a-zа-яё])/i
const CATALYST_WORDS = /кат\.?|катализ|(^|[^a-zа-яё])kt(?![a-zа-яё])/i
/** Вещество-катализатор над стрелкой: MnO₂, V₂O₅, Pt, Ni, Fe, AlCl₃, H⁺. */
const CATALYST_FORMULA = /(^|[\s,;(])((?:[A-Z][a-z]?[₀-₉0-9]*)+[⁺⁻]?)(?=$|[\s,;)])/

/**
 * Пометка над стрелкой → переключатели реактора. «t°», «нагрев», «900–1000 °C» → нагрев;
 * «t° = 0°C» (охлаждение) — не нагрев; «p», «давление» → давление; «кат.», «MnO₂», «Pt» → катализатор;
 * «электролиз», «hν», «конц.» — переключателей нет. Пусто → условий нет (реактор не требует нагрев).
 */
export function labNeedsFromConditions(conditions: string | null | undefined): ConditionsLabNeeds {
  const text = (conditions ?? '').trim()
  if (!text) return {}
  const out: ConditionsLabNeeds = {}
  // Температуры в °C: нагрев — только выше комнатной (≥ 50 °C); «0 °C», «20 °C» — без нагрева.
  const temps = [...text.matchAll(/(-?\d+(?:[.,]\d+)?)\s*(?:[–—-]\s*(\d+))?\s*°\s*[CС]/g)].map((m) =>
    Math.max(Number((m[1] ?? '0').replace(',', '.')), m[2] ? Number(m[2]) : -Infinity),
  )
  if (temps.length > 0) {
    if (Math.max(...temps) >= 50) out.needsHeat = true
  } else if (HEAT_WORDS.test(text)) {
    out.needsHeat = true
  }
  if (PRESSURE_WORDS.test(text)) out.needsPressure = true
  const formula = text.match(CATALYST_FORMULA)?.[2]
  if (CATALYST_WORDS.test(text) || formula) {
    out.needsCatalyst = true
    if (formula) out.catalystLabel = formula
  }
  return out
}

/**
 * Условия реактора для уравнения из ссылки — по ШАГУ, а не по веществу:
 *  • mr= — данные основной реакции (поле lab);
 *  • eq= — пометка над стрелкой («2K₂MnO₄ + Cl₂ → 2KMnO₄ + 2KCl» — без нагрева, хотя KMnO₄ в данных — с нагревом);
 *  • reaction= (банк) — условия реакции банка; нет их — пометка над стрелкой; нет и её — данные вещества.
 */
export function reactorLinkLabNeeds(input: {
  mainLab: SynthesisLabConditions | null | undefined
  /** В ссылке есть текст уравнения (eq=), а не только id банка. */
  fromEquation: boolean
  conditions: string | null | undefined
  bankId: string | null | undefined
  compoundNeeds: SynthesisLabConditions | undefined
  compoundId: string | null | undefined
}): ConditionsLabNeeds | undefined {
  if (input.mainLab) return input.mainLab
  if (input.fromEquation) return labNeedsFromConditions(input.conditions)
  const eff = effectiveLabNeeds(input.compoundNeeds, input.compoundId, input.bankId)
  if (eff !== input.compoundNeeds) return eff
  if (input.conditions?.trim()) return labNeedsFromConditions(input.conditions)
  return input.compoundNeeds
}

/** Одинаковые ли условия реактора (без подписи катализатора). */
export function sameLabNeeds(a: SynthesisLabConditions | undefined, b: SynthesisLabConditions | undefined): boolean {
  return (
    Boolean(a?.needsHeat) === Boolean(b?.needsHeat) &&
    Boolean(a?.needsPressure) === Boolean(b?.needsPressure) &&
    Boolean(a?.needsCatalyst) === Boolean(b?.needsCatalyst)
  )
}
