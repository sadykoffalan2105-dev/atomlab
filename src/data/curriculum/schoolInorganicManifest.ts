import type { ReactionClass } from '../../chemistry/reactionTypeTaxonomy'

/**
 * Обязательный перечень веществ школьной неорганики (7–9 кл.).
 * Источники: Kimyo 7–9 (Askarov), типовые ДЗ/ОГЭ, ФГОС.
 * Формулы — Unicode (нижние индексы), названия — нормы школьной номенклатуры.
 */
export type CurriculumCompoundRef = {
  id: string
  formula: string
  nameRu: string
  grades: readonly (7 | 8 | 9)[]
  chapter?: string
}

/** Ключевые вещества программы — проверяются `verify-school-curriculum.mts`. */
export const CURRICULUM_COMPOUNDS: readonly CurriculumCompoundRef[] = [
  // —— 7 кл.: вода, воздух, соли, кислоты и основания ——
  { id: 'h2o', formula: 'H₂O', nameRu: 'Вода', grades: [7, 8, 9], chapter: 'вода' },
  { id: 'co2', formula: 'CO₂', nameRu: 'Углекислый газ', grades: [7, 8, 9], chapter: 'оксиды' },
  { id: 'nacl', formula: 'NaCl', nameRu: 'Хлорид натрия (поваренная соль)', grades: [7, 8, 9], chapter: 'соли' },
  { id: 'mgo', formula: 'MgO', nameRu: 'Оксид магния', grades: [7, 8], chapter: 'оксиды' },
  { id: 'cao', formula: 'CaO', nameRu: 'Оксид кальция (негашёная известь)', grades: [7, 8, 9], chapter: 'оксиды' },
  { id: 'cuo', formula: 'CuO', nameRu: 'Оксид меди(II)', grades: [7, 8, 9], chapter: 'оксиды' },
  { id: 'fe2o3', formula: 'Fe₂O₃', nameRu: 'Оксид железа(III)', grades: [7, 8, 9], chapter: 'оксиды' },
  { id: 'hcl', formula: 'HCl', nameRu: 'Хлороводород (соляная кислота)', grades: [7, 8, 9], chapter: 'кислоты' },
  { id: 'h2co3', formula: 'H₂CO₃', nameRu: 'Угольная кислота', grades: [7, 8], chapter: 'кислоты' },
  { id: 'naoh', formula: 'NaOH', nameRu: 'Гидроксид натрия (едкий натр)', grades: [7, 8, 9], chapter: 'основания' },
  { id: 'ca_oh_2', formula: 'Ca(OH)₂', nameRu: 'Гидроксид кальция (гашёная известь)', grades: [7, 8, 9], chapter: 'основания' },
  { id: 'salt_nahco3', formula: 'NaHCO₃', nameRu: 'Гидрокарбонат натрия (пищевая сода)', grades: [7, 8], chapter: 'соли' },
  { id: 'salt_ca_co3', formula: 'CaCO₃', nameRu: 'Карбонат кальция (мел, известняк)', grades: [7, 8], chapter: 'соли' },
  { id: 'salt_k_cl', formula: 'KCl', nameRu: 'Хлорид калия', grades: [7, 8], chapter: 'соли' },

  // —— 8 кл.: неметаллы, металлы, качественные реакции ——
  { id: 'co', formula: 'CO', nameRu: 'Оксид углерода(II) (угарный газ)', grades: [8, 9], chapter: 'оксиды' },
  { id: 'fe3o4', formula: 'Fe₃O₄', nameRu: 'Оксид железа(II,III) (магнетит)', grades: [8, 9], chapter: 'оксиды' },
  { id: 'feo', formula: 'FeO', nameRu: 'Оксид железа(II)', grades: [8, 9], chapter: 'оксиды' },
  { id: 'al2o3', formula: 'Al₂O₃', nameRu: 'Оксид алюминия', grades: [8, 9], chapter: 'оксиды' },
  { id: 'zno', formula: 'ZnO', nameRu: 'Оксид цинка', grades: [8, 9], chapter: 'оксиды' },
  { id: 'cu2o', formula: 'Cu₂O', nameRu: 'Оксид меди(I)', grades: [8, 9], chapter: 'оксиды' },
  { id: 'bao', formula: 'BaO', nameRu: 'Оксид бария', grades: [8], chapter: 'оксиды' },
  { id: 'so2', formula: 'SO₂', nameRu: 'Оксид серы(IV) (сернистый газ)', grades: [8, 9], chapter: 'оксиды' },
  { id: 'no2', formula: 'NO₂', nameRu: 'Оксид азота(IV)', grades: [8, 9], chapter: 'оксиды' },
  { id: 'sio2', formula: 'SiO₂', nameRu: 'Оксид кремния(IV) (кремнезём)', grades: [8], chapter: 'кремний' },
  { id: 'h2so4', formula: 'H₂SO₄', nameRu: 'Серная кислота', grades: [8, 9], chapter: 'кислоты' },
  { id: 'h2so3', formula: 'H₂SO₃', nameRu: 'Сернистая кислота', grades: [8, 9], chapter: 'кислоты' },
  { id: 'hno3', formula: 'HNO₃', nameRu: 'Азотная кислота', grades: [8, 9], chapter: 'кислоты' },
  { id: 'hno2', formula: 'HNO₂', nameRu: 'Азотистая кислота', grades: [8, 9], chapter: 'кислоты' },
  { id: 'h3po4', formula: 'H₃PO₄', nameRu: 'Ортофосфорная кислота', grades: [8, 9], chapter: 'кислоты' },
  { id: 'hbr', formula: 'HBr', nameRu: 'Бромоводород (бромоводородная кислота)', grades: [8], chapter: 'кислоты' },
  { id: 'hi', formula: 'HI', nameRu: 'Йодоводород (йодоводородная кислота)', grades: [8], chapter: 'кислоты' },
  { id: 'hf', formula: 'HF', nameRu: 'Фтороводород (плавиковая кислота)', grades: [8], chapter: 'кислоты' },
  { id: 'hclo', formula: 'HClO', nameRu: 'Хлорноватистая кислота', grades: [8], chapter: 'кислоты' },
  { id: 'hclo3', formula: 'HClO₃', nameRu: 'Хлорноватая кислота', grades: [9], chapter: 'кислоты' },
  { id: 'hclo4', formula: 'HClO₄', nameRu: 'Хлорная кислота', grades: [9], chapter: 'кислоты' },
  { id: 'koh', formula: 'KOH', nameRu: 'Гидроксид калия (едкое кали)', grades: [8, 9], chapter: 'основания' },
  { id: 'mg_oh_2', formula: 'Mg(OH)₂', nameRu: 'Гидроксид магния', grades: [8], chapter: 'основания' },
  { id: 'ba_oh_2', formula: 'Ba(OH)₂', nameRu: 'Гидроксид бария', grades: [8, 9], chapter: 'основания' },
  { id: 'cu_oh_2', formula: 'Cu(OH)₂', nameRu: 'Гидроксид меди(II)', grades: [8, 9], chapter: 'основания' },
  { id: 'fe_oh_2', formula: 'Fe(OH)₂', nameRu: 'Гидроксид железа(II)', grades: [8, 9], chapter: 'основания' },
  { id: 'fe_oh_3', formula: 'Fe(OH)₃', nameRu: 'Гидроксид железа(III)', grades: [8, 9], chapter: 'основания' },
  { id: 'al_oh_3', formula: 'Al(OH)₃', nameRu: 'Гидроксид алюминия', grades: [8, 9], chapter: 'основания' },
  { id: 'h2o2', formula: 'H₂O₂', nameRu: 'Пероксид водорода', grades: [8, 9], chapter: 'кислород' },
  { id: 'mno2', formula: 'MnO₂', nameRu: 'Оксид марганца(IV)', grades: [8, 9], chapter: 'катализ' },
  { id: 'salt_ag_cl', formula: 'AgCl', nameRu: 'Хлорид серебра', grades: [8, 9], chapter: 'качественные' },
  { id: 'salt_ag_br', formula: 'AgBr', nameRu: 'Бромид серебра', grades: [8, 9], chapter: 'качественные' },
  { id: 'salt_ag_i', formula: 'AgI', nameRu: 'Йодид серебра', grades: [8, 9], chapter: 'качественные' },
  { id: 'salt_ba_so4', formula: 'BaSO₄', nameRu: 'Сульфат бария', grades: [8, 9], chapter: 'качественные' },
  { id: 'salt_ag_no3', formula: 'AgNO₃', nameRu: 'Нитрат серебра', grades: [8, 9], chapter: 'качественные' },
  { id: 'salt_ba_cl', formula: 'BaCl₂', nameRu: 'Хлорид бария', grades: [8, 9], chapter: 'соли' },
  { id: 'salt_na_so4', formula: 'Na₂SO₄', nameRu: 'Сульфат натрия', grades: [8, 9], chapter: 'соли' },
  { id: 'salt_na_co3', formula: 'Na₂CO₃', nameRu: 'Карбонат натрия (сода кальцинированная)', grades: [8, 9], chapter: 'соли' },
  { id: 'salt_na_no3', formula: 'NaNO₃', nameRu: 'Нитрат натрия (чилийская селитра)', grades: [8, 9], chapter: 'соли' },
  { id: 'salt_k_so4', formula: 'K₂SO₄', nameRu: 'Сульфат калия', grades: [8, 9], chapter: 'соли' },
  { id: 'salt_k_no3', formula: 'KNO₃', nameRu: 'Нитрат калия (селитра)', grades: [8, 9], chapter: 'соли' },
  { id: 'salt_k_br', formula: 'KBr', nameRu: 'Бромид калия', grades: [8], chapter: 'соли' },
  { id: 'salt_cu_so4', formula: 'CuSO₄', nameRu: 'Сульфат меди(II) (медный купорос)', grades: [8, 9], chapter: 'соли' },
  { id: 'salt_fe2_so4', formula: 'FeSO₄', nameRu: 'Сульфат железа(II)', grades: [8, 9], chapter: 'соли' },
  { id: 'salt_fe2_co3', formula: 'FeCO₃', nameRu: 'Карбонат железа(II)', grades: [8], chapter: 'соли' },
  { id: 'salt_zn_so4', formula: 'ZnSO₄', nameRu: 'Сульфат цинка', grades: [8, 9], chapter: 'соли' },
  { id: 'salt_zn_cl', formula: 'ZnCl₂', nameRu: 'Хлорид цинка', grades: [8, 9], chapter: 'соли' },
  { id: 'salt_fe3_cl', formula: 'FeCl₃', nameRu: 'Хлорид железа(III)', grades: [8, 9], chapter: 'соли' },
  { id: 'salt_al_cl', formula: 'AlCl₃', nameRu: 'Хлорид алюминия', grades: [8, 9], chapter: 'соли' },
  { id: 'salt_ca_cl', formula: 'CaCl₂', nameRu: 'Хлорид кальция', grades: [8, 9], chapter: 'соли' },
  { id: 'salt_ca_so4', formula: 'CaSO₄', nameRu: 'Сульфат кальция (гипс)', grades: [8], chapter: 'соли' },
  { id: 'salt_mg_cl', formula: 'MgCl₂', nameRu: 'Хлорид магния', grades: [8], chapter: 'соли' },
  { id: 'salt_mg_so4', formula: 'MgSO₄', nameRu: 'Сульфат магния (горькая соль)', grades: [8], chapter: 'соли' },
  { id: 'salt_khco3', formula: 'KHCO₃', nameRu: 'Гидрокарбонат калия', grades: [8], chapter: 'соли' },
  { id: 'salt_ca_hco3_2', formula: 'Ca(HCO₃)₂', nameRu: 'Гидрокарбонат кальция', grades: [8], chapter: 'соли' },

  // —— 9 кл.: азот, сера, фосфор, хром, комплексные ——
  { id: 'so3', formula: 'SO₃', nameRu: 'Оксид серы(VI)', grades: [9], chapter: 'оксиды' },
  { id: 'no', formula: 'NO', nameRu: 'Оксид азота(II)', grades: [9], chapter: 'оксиды' },
  { id: 'n2o5', formula: 'N₂O₅', nameRu: 'Оксид азота(V)', grades: [9], chapter: 'оксиды' },
  { id: 'p2o5', formula: 'P₂O₅', nameRu: 'Оксид фосфора(V)', grades: [9], chapter: 'фосфор' },
  { id: 'h2s', formula: 'H₂S', nameRu: 'Сероводород', grades: [9], chapter: 'кислоты' },
  { id: 'h3po3', formula: 'H₃PO₃', nameRu: 'Фосфористая кислота', grades: [9], chapter: 'кислоты' },
  { id: 'h2cro4', formula: 'H₂CrO₄', nameRu: 'Хромовая кислота', grades: [9], chapter: 'хром' },
  { id: 'hmno4', formula: 'HMnO₄', nameRu: 'Марганцовая кислота', grades: [9], chapter: 'марганец' },
  { id: 'nh3', formula: 'NH₃', nameRu: 'Аммиак', grades: [9], chapter: 'азот' },
  { id: 'nh3_h2o', formula: 'NH₃·H₂O', nameRu: 'Гидроксид аммония (аммиачная вода)', grades: [9], chapter: 'азот' },
  { id: 'zn_oh_2', formula: 'Zn(OH)₂', nameRu: 'Гидроксид цинка', grades: [9], chapter: 'основания' },
  { id: 'salt_k_i', formula: 'KI', nameRu: 'Йодид калия', grades: [9], chapter: 'соли' },
  { id: 'salt_k_mno4', formula: 'KMnO₄', nameRu: 'Перманганат калия', grades: [9], chapter: 'соли' },
  { id: 'salt_k2cr2o7', formula: 'K₂Cr₂O₇', nameRu: 'Дихромат калия', grades: [9], chapter: 'соли' },
  { id: 'salt_cu_cr2o7', formula: 'CuCr₂O₇', nameRu: 'Дихромат меди(II)', grades: [9], chapter: 'соли' },
  { id: 'salt_pb_no3', formula: 'Pb(NO₃)₂', nameRu: 'Нитрат свинца(II)', grades: [9], chapter: 'соли' },
  { id: 'salt_pb_so4', formula: 'PbSO₄', nameRu: 'Сульфат свинца(II)', grades: [9], chapter: 'соли' },
  { id: 'salt_fe3_so4', formula: 'Fe₂(SO₄)₃', nameRu: 'Сульфат железа(III)', grades: [9], chapter: 'соли' },
  { id: 'salt_nh4_cl', formula: 'NH₄Cl', nameRu: 'Хлорид аммония', grades: [9], chapter: 'соли' },
  { id: 'salt_nh4_3_po4', formula: '(NH₄)₃PO₄', nameRu: 'Ортофосфат аммония', grades: [9], chapter: 'соли' },
  { id: 'cr2o3', formula: 'Cr₂O₃', nameRu: 'Оксид хрома(III)', grades: [9], chapter: 'хром' },
  { id: 'cro3', formula: 'CrO₃', nameRu: 'Оксид хрома(VI)', grades: [9], chapter: 'хром' },
  { id: 'fes2', formula: 'FeS₂', nameRu: 'Пирит (дисульфид железа)', grades: [9], chapter: 'сера' },
  { id: 'clo2', formula: 'ClO₂', nameRu: 'Диоксид хлора', grades: [9], chapter: 'хлор' },
] as const

export type CurriculumReactionRef = {
  id: string
  reactionClass: ReactionClass
  grades: readonly (7 | 8 | 9)[]
  equationRu: string
  productId: string | null
  compoundIds: readonly string[]
}

/** Ключевые уравнения программы (для аудита). Полный банк — schoolReactionBank.ts (80+). */
export const CURRICULUM_REACTIONS: readonly CurriculumReactionRef[] = [] as const
