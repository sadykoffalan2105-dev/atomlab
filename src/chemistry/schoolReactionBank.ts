import type { ReactionClass } from './reactionTypeTaxonomy'
import type { BalanceLessonKind } from './balanceLessonBank'
import { defaultPassportForClass, type ReactionPassport } from './reactionPassport'

export type SchoolReactionEntry = {
  id: string
  reactionClass: ReactionClass
  grades: readonly (7 | 8 | 9)[]
  equationRu: string
  equationEn: string
  productId: string | null
  kind: BalanceLessonKind
  howToRu: string
  howToEn: string
  /** Переопределения паспорта (ОВР, тепло, фаза, катализ) */
  passport?: Partial<ReactionPassport>
  /** @deprecated используйте passport.heatEffect */
  heatEffect?: 'exo' | 'endo'
  /** @deprecated используйте passport.reversibility */
  reversible?: boolean
  /** @deprecated используйте passport.catalystId */
  catalystId?: string
}

export function passportForReaction(r: SchoolReactionEntry): ReactionPassport {
  const legacy = {
    heatEffect: r.heatEffect,
    reversibility: r.reversible ? ('reversible' as const) : undefined,
    catalytic: Boolean(r.catalystId) || r.reactionClass === 'catalytic',
    catalystId: r.catalystId,
  }
  return defaultPassportForClass(r.reactionClass, { ...legacy, ...r.passport })
}

/**
 * Банк школьных реакций 7–9 кл. (Kimyo / ФГОС).
 * synthesis — можно загрузить в реактор (элементы слева → продукт);
 * practice_only — обмен, замещение с двумя продуктами, ОВР с несколькими веществами.
 */
export const SCHOOL_REACTION_BANK: readonly SchoolReactionEntry[] = [
  // —— Соединение ——
  {
    id: 'h2-o2-h2o',
    reactionClass: 'combination',
    grades: [7],
    equationRu: '2H₂ + O₂ → 2H₂O',
    equationEn: '2H₂ + O₂ → 2H₂O',
    productId: 'h2o',
    kind: 'synthesis',
    howToRu: 'Слева: H (коэфф. 2, дiatом) и O (коэфф. 1, двухатомный). Продукт: вода. Экзотермическая реакция горения водорода.',
    howToEn: 'Left: H (coeff 2, diatomic) and O (coeff 1, diatomic). Product: water.',
    heatEffect: 'exo',
  },
  {
    id: 'na-cl-nacl',
    reactionClass: 'combination',
    grades: [7],
    equationRu: '2Na + Cl₂ → 2NaCl',
    equationEn: '2Na + Cl₂ → 2NaCl',
    productId: 'nacl',
    kind: 'synthesis',
    howToRu: 'Na + Cl₂ (двухатомный) → NaCl.',
    howToEn: 'Na + Cl₂ (diatomic) → NaCl.',
    heatEffect: 'exo',
  },
  {
    id: 'cao-h2o',
    reactionClass: 'combination',
    grades: [7, 8],
    equationRu: 'CaO + H₂O → Ca(OH)₂',
    equationEn: 'CaO + H₂O → Ca(OH)₂',
    productId: 'ca_oh_2',
    kind: 'synthesis',
    howToRu: 'Оксид кальция + вода. В реакторе: Ca, O, H → Ca(OH)₂. Гашение извести — сильно экзотермично.',
    howToEn: 'Quicklime + water → slaked lime.',
    heatEffect: 'exo',
  },
  {
    id: 'cao-co2',
    reactionClass: 'combination',
    grades: [8],
    equationRu: 'CaO + CO₂ → CaCO₃',
    equationEn: 'CaO + CO₂ → CaCO₃',
    productId: 'salt_ca_co3',
    kind: 'synthesis',
    howToRu: 'CaO + CO₂ → карбонат кальция. Обратная реакция к обжигу известняка.',
    howToEn: 'CaO + CO₂ → calcium carbonate.',
  },
  {
    id: 'nh3-hcl',
    reactionClass: 'combination',
    grades: [9],
    equationRu: 'NH₃ + HCl → NH₄Cl',
    equationEn: 'NH₃ + HCl → NH₄Cl',
    productId: 'salt_nh4_cl',
    kind: 'synthesis',
    howToRu: 'Аммиак + хлороводород. В реакторе: N, H, Cl → NH₄Cl (продукт из каталога).',
    howToEn: 'Ammonia + hydrogen chloride → ammonium chloride.',
  },
  {
    id: 'so2-o2-so3',
    reactionClass: 'catalytic',
    grades: [9],
    equationRu: '2SO₂ + O₂ ⇄ 2SO₃',
    equationEn: '2SO₂ + O₂ ⇄ 2SO₃',
    productId: 'so3',
    kind: 'synthesis',
    howToRu: 'S, O → SO₃ через SO₂. Катализатор V₂O₅ в промышленности. Обратимая экзотермическая.',
    howToEn: 'Contact process: SO₂ oxidation to SO₃ with V₂O₅ catalyst.',
    heatEffect: 'exo',
    reversible: true,
    catalystId: 'v2o5',
  },
  {
    id: 'n2-h2-nh3',
    reactionClass: 'combination',
    grades: [9],
    equationRu: 'N₂ + 3H₂ ⇄ 2NH₃',
    equationEn: 'N₂ + 3H₂ ⇄ 2NH₃',
    productId: 'nh3',
    kind: 'synthesis',
    howToRu: 'N (двухатомный) + H (двухатомный, коэфф. 3) → NH₃. Процесс Габера: высокое давление, Fe-катализатор.',
    howToEn: 'Haber process: N₂ + 3H₂ ⇄ 2NH₃.',
    heatEffect: 'exo',
    reversible: true,
  },
  // —— Разложение ——
  {
    id: 'caco3-decomp',
    reactionClass: 'decomposition',
    grades: [8],
    equationRu: 'CaCO₃ → CaO + CO₂',
    equationEn: 'CaCO₃ → CaO + CO₂',
    productId: 'cao',
    kind: 'practice_only',
    howToRu: 'Практика: из CaCO₃ при нагреве — CaO и CO₂. В реакторе для синтеза CaO: Ca + O.',
    howToEn: 'Thermal decomposition of limestone; practice balancing.',
    heatEffect: 'endo',
  },
  {
    id: 'cuoh2-decomp',
    reactionClass: 'decomposition',
    grades: [8],
    equationRu: 'Cu(OH)₂ → CuO + H₂O',
    equationEn: 'Cu(OH)₂ → CuO + H₂O',
    productId: 'cuo',
    kind: 'practice_only',
    howToRu: 'Гидроксид меди при нагревании. Для синтеза CuO: Cu + O.',
    howToEn: 'Copper(II) hydroxide decomposes on heating.',
    heatEffect: 'endo',
  },
  {
    id: 'h2o2-decomp',
    reactionClass: 'catalytic',
    grades: [8],
    equationRu: '2H₂O₂ → 2H₂O + O₂',
    equationEn: '2H₂O₂ → 2H₂O + O₂',
    productId: 'h2o',
    kind: 'practice_only',
    howToRu: 'Разложение пероксида; катализатор MnO₂. Практика балансировки (два продукта).',
    howToEn: 'Hydrogen peroxide decomposition with MnO₂ catalyst.',
    catalystId: 'mno2',
  },
  // —— Горение ——
  {
    id: 'mg-o2-mgo',
    reactionClass: 'combustion',
    grades: [7],
    equationRu: '2Mg + O₂ → 2MgO',
    equationEn: '2Mg + O₂ → 2MgO',
    productId: 'mgo',
    kind: 'synthesis',
    howToRu: 'Mg + O₂ (двухатомный) → MgO. Яркая вспышка при горении ленты.',
    howToEn: 'Magnesium ribbon burns in oxygen.',
    heatEffect: 'exo',
  },
  {
    id: 'fe-o2-fe2o3',
    reactionClass: 'combustion',
    grades: [7, 8],
    equationRu: '4Fe + 3O₂ → 2Fe₂O₃',
    equationEn: '4Fe + 3O₂ → 2Fe₂O₃',
    productId: 'fe2o3',
    kind: 'synthesis',
    howToRu: 'Fe + O₂ → Fe₂O₃. Коэффициенты 4:3:2 — урок подбора.',
    howToEn: 'Iron oxidation to hematite.',
    heatEffect: 'exo',
  },
  {
    id: 'c-o2-co2',
    reactionClass: 'combustion',
    grades: [7],
    equationRu: 'C + O₂ → CO₂',
    equationEn: 'C + O₂ → CO₂',
    productId: 'co2',
    kind: 'synthesis',
    howToRu: 'Уголь + кислород → CO₂. Полное горение углерода.',
    howToEn: 'Complete combustion of carbon.',
    heatEffect: 'exo',
  },
  {
    id: 'al-o2-al2o3',
    reactionClass: 'combustion',
    grades: [8],
    equationRu: '4Al + 3O₂ → 2Al₂O₃',
    equationEn: '4Al + 3O₂ → 2Al₂O₃',
    productId: 'al2o3',
    kind: 'synthesis',
    howToRu: 'Al + O₂ → Al₂O₃. Термит и защитная оксидная плёнка.',
    howToEn: 'Aluminum combustion to alumina.',
    heatEffect: 'exo',
  },
  {
    id: 'cu-o2-cuo',
    reactionClass: 'combustion',
    grades: [8],
    equationRu: '2Cu + O₂ → 2CuO',
    equationEn: '2Cu + O₂ → 2CuO',
    productId: 'cuo',
    kind: 'synthesis',
    howToRu: 'Медь при нагревании на воздухе чернеет (CuO).',
    howToEn: 'Copper oxidizes to CuO on heating.',
    heatEffect: 'exo',
  },
  {
    id: 's-o2-so2',
    reactionClass: 'combustion',
    grades: [8],
    equationRu: 'S + O₂ → SO₂',
    equationEn: 'S + O₂ → SO₂',
    productId: 'so2',
    kind: 'synthesis',
    howToRu: 'Сера горит синим пламенем с SO₂.',
    howToEn: 'Sulfur burns to sulfur dioxide.',
    heatEffect: 'exo',
  },
  {
    id: 'fes2-roast',
    reactionClass: 'combustion',
    grades: [9],
    equationRu: '4FeS₂ + 11O₂ → 2Fe₂O₃ + 8SO₂',
    equationEn: '4FeS₂ + 11O₂ → 2Fe₂O₃ + 8SO₂',
    productId: null,
    kind: 'practice_only',
    howToRu: 'Обжиг пирита — промышленный источник SO₂. Практика ОВР и подбора коэффициентов.',
    howToEn: 'Pyrite roasting — industrial SO₂ source.',
    heatEffect: 'exo',
  },
  // —— Замещение ——
  {
    id: 'zn-hcl',
    reactionClass: 'substitution',
    grades: [8],
    equationRu: 'Zn + 2HCl → ZnCl₂ + H₂',
    equationEn: 'Zn + 2HCl → ZnCl₂ + H₂',
    productId: 'salt_zn_cl',
    kind: 'practice_only',
    howToRu: 'Zn вытесняет H из кислоты. Для синтеза ZnCl₂: Zn + Cl в реакторе. Газ H₂ — признак реакции.',
    howToEn: 'Zinc displaces hydrogen from HCl.',
  },
  {
    id: 'fe-cuso4',
    reactionClass: 'substitution',
    grades: [9],
    equationRu: 'Fe + CuSO₄ → FeSO₄ + Cu',
    equationEn: 'Fe + CuSO₄ → FeSO₄ + Cu',
    productId: null,
    kind: 'practice_only',
    howToRu: 'Железо покрывается медью. Ряд активности металлов. Только балансировка — два продукта.',
    howToEn: 'Iron displaces copper from copper sulfate.',
  },
  {
    id: 'ki-cl2',
    reactionClass: 'substitution',
    grades: [9],
    equationRu: '2KI + Cl₂ → 2KCl + I₂',
    equationEn: '2KI + Cl₂ → 2KCl + I₂',
    productId: null,
    kind: 'practice_only',
    howToRu: 'Хлор вытесняет иод. ОВР: Cl₂ — окислитель, I⁻ — восстановитель.',
    howToEn: 'Chlorine displaces iodine from KI.',
  },
  // —— Обмен и нейтрализация ——
  {
    id: 'naoh-hcl',
    reactionClass: 'neutralization',
    grades: [7, 8],
    equationRu: 'NaOH + HCl → NaCl + H₂O',
    equationEn: 'NaOH + HCl → NaCl + H₂O',
    productId: 'nacl',
    kind: 'practice_only',
    howToRu: 'H⁺ + OH⁻ → H₂O. Для синтеза NaCl: Na + Cl. Вода образуется без изменения степеней окисления.',
    howToEn: 'Classic acid–base neutralization.',
    heatEffect: 'exo',
  },
  {
    id: 'h2so4-koh',
    reactionClass: 'neutralization',
    grades: [8],
    equationRu: 'H₂SO₄ + 2KOH → K₂SO₄ + 2H₂O',
    equationEn: 'H₂SO₄ + 2KOH → K₂SO₄ + 2H₂O',
    productId: 'salt_k_so4',
    kind: 'practice_only',
    howToRu: 'Двухосновная кислота — коэффициент 2 у KOH. Продукт K₂SO₄ в каталоге: salt_k_so4.',
    howToEn: 'Sulfuric acid neutralized with potassium hydroxide.',
    heatEffect: 'exo',
  },
  {
    id: 'bacl2-na2so4',
    reactionClass: 'exchange',
    grades: [8, 9],
    equationRu: 'BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl',
    equationEn: 'BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl',
    productId: null,
    kind: 'practice_only',
    howToRu: 'Белый осадок BaSO₄ — качественная реакция на SO₄²⁻. Правило Бертолле: осадок → необратимо.',
    howToEn: 'Barium sulfate precipitate — sulfate test.',
  },
  {
    id: 'agno3-nacl',
    reactionClass: 'exchange',
    grades: [8],
    equationRu: 'AgNO₃ + NaCl → AgCl↓ + NaNO₃',
    equationEn: 'AgNO₃ + NaCl → AgCl↓ + NaNO₃',
    productId: null,
    kind: 'practice_only',
    howToRu: 'Белый творожистый осадок AgCl — качественная на Cl⁻.',
    howToEn: 'Silver chloride precipitate — chloride test.',
  },
  {
    id: 'na2co3-hcl',
    reactionClass: 'exchange',
    grades: [8],
    equationRu: 'Na₂CO₃ + 2HCl → 2NaCl + H₂O + CO₂↑',
    equationEn: 'Na₂CO₃ + 2HCl → 2NaCl + H₂O + CO₂↑',
    productId: 'nacl',
    kind: 'practice_only',
    howToRu: 'Выделение CO₂ — признак карбонат-ионов. Практика с тремя продуктами.',
    howToEn: 'Carbonate + acid → salt + water + CO₂.',
  },
  // —— ОВР ——
  {
    id: 'k2cr2o7-ki',
    reactionClass: 'redox',
    grades: [9],
    equationRu: 'K₂Cr₂O₇ + 6KI + 7H₂SO₄ → 3I₂ + Cr₂(SO₄)₃ + 4K₂SO₄ + 7H₂O',
    equationEn: 'K₂Cr₂O₇ + 6KI + 7H₂SO₄ → 3I₂ + Cr₂(SO₄)₃ + 4K₂SO₄ + 7H₂O',
    productId: null,
    kind: 'practice_only',
    howToRu: 'Дихромат в кислой среде окисляет I⁻ до I₂. Электронный баланс: Cr⁺6 → Cr⁺3, I⁻ → I₂.',
    howToEn: 'Dichromate oxidizes iodide in acidic medium.',
  },
  {
    id: 'cl2-h2o',
    reactionClass: 'redox',
    grades: [9],
    equationRu: 'Cl₂ + H₂O → HCl + HClO',
    equationEn: 'Cl₂ + H₂O → HCl + HClO',
    productId: null,
    kind: 'practice_only',
    howToRu: 'Диспропорционирование хлора: Cl⁰ → Cl⁻ и Cl⁺1.',
    howToEn: 'Chlorine disproportionation in water.',
  },
  // —— Гидролиз ——
  {
    id: 'na2co3-hydrolysis',
    reactionClass: 'hydrolysis',
    grades: [9],
    equationRu: 'Na₂CO₃ + H₂O ⇄ NaHCO₃ + NaOH',
    equationEn: 'Na₂CO₃ + H₂O ⇄ NaHCO₃ + NaOH',
    productId: null,
    kind: 'practice_only',
    howToRu: 'Среда щелочная (pH > 7). Обратимая реакция — знак ⇄.',
    howToEn: 'Sodium carbonate hydrolysis — alkaline solution.',
    reversible: true,
  },
  // —— Комплексообразование ——
  {
    id: 'aloh3-naoh',
    reactionClass: 'complex',
    grades: [9],
    equationRu: 'Al(OH)₃ + NaOH → Na[Al(OH)₄]',
    equationEn: 'Al(OH)₃ + NaOH → Na[Al(OH)₄]',
    productId: null,
    kind: 'practice_only',
    howToRu: 'Амфотерный гидроксид растворяется в щёлочи — тетрагидроксоалюминат.',
    howToEn: 'Aluminum hydroxide dissolves in excess NaOH.',
  },
  {
    id: 'cuso4-nh3',
    reactionClass: 'complex',
    grades: [9],
    equationRu: 'CuSO₄ + 4NH₃ → [Cu(NH₃)₄]SO₄',
    equationEn: 'CuSO₄ + 4NH₃ → [Cu(NH₃)₄]SO₄',
    productId: null,
    kind: 'practice_only',
    howToRu: 'Глубокая синяя окраска комплекса меди(II). Качественная реакция на Cu²⁺.',
    howToEn: 'Tetraamminecopper(II) — deep blue complex.',
  },
] as const

export function reactionsByClass(reactionClass: ReactionClass): readonly SchoolReactionEntry[] {
  return SCHOOL_REACTION_BANK.filter((r) => r.reactionClass === reactionClass)
}

export function getSchoolReaction(id: string): SchoolReactionEntry | undefined {
  return SCHOOL_REACTION_BANK.find((r) => r.id === id)
}
