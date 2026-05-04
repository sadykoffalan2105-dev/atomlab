import type { CompoundCategory, SynthesisConditionsTextRu, SynthesisLabConditions } from '../types/chemistry'

/** Шаблоны условий синтеза, если в данных не задано `synthesisConditionsRu`. */
export function defaultSynthesisConditionsText(
  lab: SynthesisLabConditions | undefined,
  category: CompoundCategory,
): SynthesisConditionsTextRu {
  const heat = lab?.needsHeat
    ? 'Нагрев: повышение температуры по ходу реакции (конкретный режим — по опыту/методичке).'
    : 'Температура: обычно комнатная или слабый нагрев; при необходимости — по рецепту вещества.'

  const pressure = lab?.needsPressure
    ? 'Давление: повышенное (автоклав, герметичный реактор) — значение по методике.'
    : 'Давление: атмосферное (≈1 атм), если не требуется иное.'

  let catalyst = 'Катализатор: не обязателен для данного примера.'
  if (lab?.needsCatalyst) {
    catalyst =
      'Катализатор: требуется (Pt, Ni, MnO₂ и др. — уточняется по конкретной реакции); укажите в панели реактора.'
  } else if (category === 'salt' || category === 'acid') {
    catalyst = 'Катализатор: как правило не используется; для кислотно‑основных процессов — по реакции.'
  }

  return { temperature: heat, pressure, catalyst }
}
