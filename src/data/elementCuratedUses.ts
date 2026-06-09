/** Уточнённые примеры применения для учебных элементов (RU/EN). */
const CURATED: Record<
  number,
  { usesRu: readonly string[]; usesEn: readonly string[]; extractionRu?: string; extractionEn?: string }
> = {
  1: {
    usesRu: ['Топливо ракет', 'Водородные топливные элементы', 'Производство аммиака'],
    usesEn: ['Rocket fuel', 'Fuel cells', 'Ammonia synthesis'],
  },
  6: {
    usesRu: ['Сталь и сплавы', 'Углепластик', 'Органическая химия', 'Древесный уголь'],
    usesEn: ['Steel & alloys', 'Composites', 'Organic chemistry', 'Charcoal'],
  },
  8: {
    usesRu: ['Дыхание и горение', 'Медицинский кислород', 'Стекло и керамика'],
    usesEn: ['Respiration & combustion', 'Medical oxygen', 'Glass & ceramics'],
  },
  26: {
    usesRu: ['Конструкционная сталь', 'Гемоглобин крови', 'Магниты (Fe–Co–Ni)'],
    usesEn: ['Structural steel', 'Blood hemoglobin', 'Magnets (Fe–Co–Ni)'],
    extractionRu: 'Из железных руд: доменный процесс, прямое восстановление.',
    extractionEn: 'From iron ores: blast furnace or direct reduction.',
  },
  27: {
    usesRu: ['Суперсплавы для турбин', 'Li-ion аккумуляторы (катод)', 'Контраст для МРТ', 'Синий кобальт (краска)'],
    usesEn: ['Superalloys for turbines', 'Li-ion battery cathodes', 'MRI contrast agents', 'Cobalt blue pigments'],
    extractionRu: 'Из кобальтсодержащих руд: обогащение, плавка, электролиз.',
    extractionEn: 'From cobalt ores (linnaeite, cobaltite): enrichment and smelting.',
  },
  28: {
    usesRu: ['Нержавеющая сталь', 'Монеты', 'Катализ в нефтехимии'],
    usesEn: ['Stainless steel', 'Coins', 'Hydrogenation catalyst'],
  },
  29: {
    usesRu: ['Электропроводка', 'Сплавы (латунь, бронза)', 'Антибактериальные поверхности'],
    usesEn: ['Electrical wiring', 'Brass & bronze', 'Antimicrobial surfaces'],
  },
  47: {
    usesRu: ['Ювелирные изделия', 'Фотография (исторически)', 'Зеркала и посуда'],
    usesEn: ['Jewelry', 'Photography (historical)', 'Mirrors & tableware'],
  },
  79: {
    usesRu: ['Ювелирное дело', 'Электроника (контакты)', 'Стоматология'],
    usesEn: ['Jewelry', 'Electronics contacts', 'Dentistry'],
  },
}

export function getCuratedElementLife(z: number) {
  return CURATED[z] ?? null
}
