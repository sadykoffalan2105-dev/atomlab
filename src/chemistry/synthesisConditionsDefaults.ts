import type { AppLocale } from '../i18n/types'
import type { CompoundCategory, SynthesisConditionsTextRu, SynthesisLabConditions } from '../types/chemistry'

type SynthPack = SynthesisConditionsTextRu

function packRu(lab: SynthesisLabConditions | undefined, category: CompoundCategory): SynthPack {
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

function packUz(lab: SynthesisLabConditions | undefined, category: CompoundCategory): SynthPack {
  const heat = lab?.needsHeat
    ? 'Harorat: reaksiya davomida oshiriladi (aniq rejim — tajriba/metodikaga qarab).'
    : 'Harorat: odatda xona harorati yoki engil qizdirish; kerak bo\'lsa — modda retseptiga qarab.'

  const pressure = lab?.needsPressure
    ? 'Bosim: yuqori (avtoklav, germetik reaktor) — qiymat metodikaga qarab.'
    : 'Bosim: atmosfera (~1 atm), boshqa talab qilinmasa.'

  let catalyst = 'Katalizator: ushbu misol uchun shart emas.'
  if (lab?.needsCatalyst) {
    catalyst =
      'Katalizator: kerak (Pt, Ni, MnO₂ va boshqalar — aniq reaksiyaga qarab); reaktor panelida ko\'rsating.'
  } else if (category === 'salt' || category === 'acid') {
    catalyst = 'Katalizator: odatda ishlatilmaydi; kislota–asos jarayonlari uchun — reaksiyaga qarab.'
  }

  return { temperature: heat, pressure, catalyst }
}

function packEn(lab: SynthesisLabConditions | undefined, category: CompoundCategory): SynthPack {
  const heat = lab?.needsHeat
    ? 'Heating: increase temperature along the reaction path (exact conditions depend on the procedure).'
    : 'Temperature: usually room temperature or mild heating; follow the substance recipe if needed.'

  const pressure = lab?.needsPressure
    ? 'Pressure: elevated (autoclave, sealed reactor) — value per procedure.'
    : 'Pressure: atmospheric (≈1 atm) unless otherwise required.'

  let catalyst = 'Catalyst: not required for this example.'
  if (lab?.needsCatalyst) {
    catalyst =
      'Catalyst: required (Pt, Ni, MnO₂, etc. — depends on the specific reaction); specify in the reactor panel.'
  } else if (category === 'salt' || category === 'acid') {
    catalyst = 'Catalyst: typically not used; for acid–base processes — depends on the reaction.'
  }

  return { temperature: heat, pressure, catalyst }
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
