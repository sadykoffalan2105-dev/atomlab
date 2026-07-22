/**
 * Классификация реакций школьного курса неорганики (7–9 кл., Kimyo / ФГОС).
 * Соответствует учебным разделам и докладу по типам реакций.
 */
export type ReactionClass =
  | 'combination'
  | 'decomposition'
  | 'substitution'
  | 'exchange'
  | 'redox'
  | 'neutralization'
  | 'hydrolysis'
  | 'complex'
  | 'combustion'
  | 'catalytic'

export type HeatEffect = 'exo' | 'endo' | 'neutral'
export type Reversibility = 'irreversible' | 'reversible'
export type PhaseKind = 'homogeneous' | 'heterogeneous'

export type ReactionClassMeta = {
  id: ReactionClass
  titleRu: string
  titleEn: string
  schemeRu: string
  summaryRu: string
  grades: readonly (7 | 8 | 9)[]
}

export const REACTION_CLASS_META: readonly ReactionClassMeta[] = [
  {
    id: 'combination',
    titleRu: 'Реакции соединения',
    titleEn: 'Combination',
    schemeRu: 'A + B → AB',
    summaryRu:
      'Из двух или более простых или сложных веществ образуется одно более сложное. Примеры: 2Na + Cl₂ → 2NaCl; CaO + H₂O → Ca(OH)₂.',
    grades: [7, 8, 9],
  },
  {
    id: 'decomposition',
    titleRu: 'Реакции разложения',
    titleEn: 'Decomposition',
    schemeRu: 'AB → A + B',
    summaryRu:
      'Из одного сложного вещества — несколько более простых. Часто нужны нагрев, свет или ток: CaCO₃ → CaO + CO₂; 2H₂O₂ → 2H₂O + O₂.',
    grades: [7, 8, 9],
  },
  {
    id: 'substitution',
    titleRu: 'Реакции замещения',
    titleEn: 'Single displacement',
    schemeRu: 'A + BC → AC + B',
    summaryRu:
      'Атомы простого вещества замещают атомы в сложном. Более активный элемент вытесняет менее активный: Zn + 2HCl → ZnCl₂ + H₂; Fe + CuSO₄ → FeSO₄ + Cu.',
    grades: [8, 9],
  },
  {
    id: 'exchange',
    titleRu: 'Реакции обмена',
    titleEn: 'Double exchange',
    schemeRu: 'AB + CD → AD + CB',
    summaryRu:
      'Два сложных вещества обмениваются ионами. Идут до конца при осадке, газе или образовании воды: BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl.',
    grades: [8, 9],
  },
  {
    id: 'redox',
    titleRu: 'Окислительно-восстановительные',
    titleEn: 'Redox (OVR)',
    schemeRu: 'e⁻ переходят от восстановителя к окислителю',
    summaryRu:
      'Меняются степени окисления. Межмолекулярные, внутримолекулярные, диспропорционирование и конпропорционирование. Пример: 2Mg + O₂ → 2MgO.',
    grades: [8, 9],
  },
  {
    id: 'neutralization',
    titleRu: 'Нейтрализация',
    titleEn: 'Neutralization',
    schemeRu: 'кислота + основание → соль + H₂O',
    summaryRu:
      'Частный случай обмена: H⁺ + OH⁻ → H₂O. HCl + NaOH → NaCl + H₂O.',
    grades: [7, 8, 9],
  },
  {
    id: 'hydrolysis',
    titleRu: 'Гидролиз солей',
    titleEn: 'Salt hydrolysis',
    schemeRu: 'соль + H₂O ⇄ кислота/основание',
    summaryRu:
      'Ионы соли взаимодействуют с водой, меняется pH среды. Na₂CO₃ + H₂O ⇄ NaHCO₃ + NaOH.',
    grades: [9],
  },
  {
    id: 'complex',
    titleRu: 'Комплексообразование',
    titleEn: 'Complex formation',
    schemeRu: 'ион + лиганд → комплекс',
    summaryRu:
      'Образование комплексных ионов: CuSO₄ + 4NH₃ → [Cu(NH₃)₄]SO₄; Al(OH)₃ + NaOH → Na[Al(OH)₄].',
    grades: [9],
  },
  {
    id: 'combustion',
    titleRu: 'Горение и обжиг',
    titleEn: 'Combustion',
    schemeRu: 'вещество + O₂ → оксиды',
    summaryRu:
      'Экзотермическое окисление при высокой температуре: C + O₂ → CO₂; 4FeS₂ + 11O₂ → 2Fe₂O₃ + 8SO₂.',
    grades: [7, 8, 9],
  },
  {
    id: 'catalytic',
    titleRu: 'Каталитические',
    titleEn: 'Catalytic',
    schemeRu: 'катализатор ускоряет, не расходуется',
    summaryRu:
      '2SO₂ + O₂ → 2SO₃ (V₂O₅); 2H₂O₂ → 2H₂O + O₂ (MnO₂); разложение KClO₃ с MnO₂.',
    grades: [8, 9],
  },
] as const

export function reactionClassMeta(id: ReactionClass): ReactionClassMeta {
  return REACTION_CLASS_META.find((m) => m.id === id) ?? REACTION_CLASS_META[0]!
}
