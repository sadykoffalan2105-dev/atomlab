import type { AppLocale } from '../i18n/types'
import type { CompoundCategory, SynthesisConditionsTextRu, SynthesisLabConditions } from '../types/chemistry'

type SynthPack = SynthesisConditionsTextRu
type CondKey = keyof SynthesisConditionsTextRu

/** Убрать дубли «Температура: …» — UI уже показывает подпись поля. */
const COND_PREFIX: Record<CondKey, RegExp[]> = {
  temperature: [
    /^Температура:\s*/i,
    /^Нагрев:\s*/i,
    /^Heating:\s*/i,
    /^Temperature:\s*/i,
    /^Harorat:\s*/i,
  ],
  pressure: [/^Давление:\s*/i, /^Pressure:\s*/i, /^Bosim:\s*/i],
  catalyst: [/^Катализатор:\s*/i, /^Catalyst:\s*/i, /^Katalizator:\s*/i],
  equipment: [/^Оборудование:\s*/i, /^Equipment:\s*/i, /^Jihozlar:\s*/i],
}

export function normalizeSynthConditionValue(
  kind: CondKey,
  value: string | undefined | null,
): string | undefined {
  if (value == null) return undefined
  let v = String(value).trim()
  if (!v) return undefined
  for (const re of COND_PREFIX[kind]) v = v.replace(re, '')
  return v.trim() || undefined
}

export function normalizeSynthConditions(
  c: SynthesisConditionsTextRu | undefined | null,
): SynthesisConditionsTextRu {
  if (!c) return {}
  return {
    temperature: normalizeSynthConditionValue('temperature', c.temperature),
    pressure: normalizeSynthConditionValue('pressure', c.pressure),
    catalyst: normalizeSynthConditionValue('catalyst', c.catalyst),
    equipment: normalizeSynthConditionValue('equipment', c.equipment),
  }
}

function packRu(lab: SynthesisLabConditions | undefined, category: CompoundCategory): SynthPack {
  const heat = lab?.needsHeat
    ? 'повышение температуры по ходу реакции (конкретный режим — по опыту/методичке)'
    : 'обычно комнатная или слабый нагрев; при необходимости — по рецепту вещества'

  const pressure = lab?.needsPressure
    ? 'повышенное (автоклав, герметичный сосуд) — значение по методике'
    : 'атмосферное (≈1 атм), если не требуется иное'

  let catalyst = 'не обязателен для данного примера'
  if (lab?.needsCatalyst) {
    catalyst =
      'требуется (Pt, Ni, MnO₂ и др. — уточняется по конкретной реакции); укажите в панели реактора'
  } else if (category === 'salt' || category === 'acid') {
    catalyst = 'как правило не используется; для кислотно‑основных процессов — по реакции'
  }

  const equipment = lab?.needsHeat || lab?.needsPressure || lab?.needsCatalyst
    ? 'пробирки / колбы; горелка / герметичный сосуд / лоток катализатора — по условиям; вытяжка'
    : 'пробирки, штатив, стаканы; при работе с кислотами и газами — вытяжка'

  return { temperature: heat, pressure, catalyst, equipment }
}

function packUz(lab: SynthesisLabConditions | undefined, category: CompoundCategory): SynthPack {
  const heat = lab?.needsHeat
    ? 'reaksiya davomida oshiriladi (aniq rejim — tajriba/metodikaga qarab)'
    : 'odatda xona harorati yoki engil qizdirish; kerak bo\'lsa — modda retseptiga qarab'

  const pressure = lab?.needsPressure
    ? 'yuqori (avtoklav, germetik idish) — qiymat metodikaga qarab'
    : 'atmosfera (~1 atm), boshqa talab qilinmasa'

  let catalyst = 'ushbu misol uchun shart emas'
  if (lab?.needsCatalyst) {
    catalyst =
      'kerak (Pt, Ni, MnO₂ va boshqalar — aniq reaksiyaga qarab); reaktor panelida ko\'rsating'
  } else if (category === 'salt' || category === 'acid') {
    catalyst = 'odatda ishlatilmaydi; kislota–asos jarayonlari uchun — reaksiyaga qarab'
  }

  const equipment =
    'probirokalar / kolbalar; kerak bo\'lsa — isitgich, germetik idish, katalizator; tortish shkafi'

  return { temperature: heat, pressure, catalyst, equipment }
}

function packEn(lab: SynthesisLabConditions | undefined, category: CompoundCategory): SynthPack {
  const heat = lab?.needsHeat
    ? 'increase temperature along the reaction path (exact conditions depend on the procedure)'
    : 'usually room temperature or mild heating; follow the substance recipe if needed'

  const pressure = lab?.needsPressure
    ? 'elevated (autoclave, sealed vessel) — value per procedure'
    : 'atmospheric (≈1 atm) unless otherwise required'

  let catalyst = 'not required for this example'
  if (lab?.needsCatalyst) {
    catalyst =
      'required (Pt, Ni, MnO₂, etc. — depends on the specific reaction); specify in the reactor panel'
  } else if (category === 'salt' || category === 'acid') {
    catalyst = 'typically not used; for acid–base processes — depends on the reaction'
  }

  const equipment =
    'test tubes / flasks; heater, sealed vessel, catalyst tray as needed; fume hood'

  return { temperature: heat, pressure, catalyst, equipment }
}

/** Шаблоны условий синтеза (RU), если в данных не задано `synthesisConditionsRu`. */
export function defaultSynthesisConditionsText(
  lab: SynthesisLabConditions | undefined,
  category: CompoundCategory,
): SynthesisConditionsTextRu {
  return packRu(lab, category)
}

/** Локализованные шаблоны условий синтеза для отображения. */
export function defaultSynthesisConditionsTextForLocale(
  lab: SynthesisLabConditions | undefined,
  category: CompoundCategory,
  locale: AppLocale,
): SynthesisConditionsTextRu {
  if (locale === 'en') return packEn(lab, category)
  if (locale === 'uz') return packUz(lab, category)
  return packRu(lab, category)
}
