/**
 * Политика «атомы/простые вещества → вещество каталога» vs школьная реакция молекул.
 *
 * Архитектура ATOMLAB:
 * - Каталог «Вещества» / сборка в реакторе из элементов: только то, что в школе
 *   действительно получают из простых веществ (или атомов) в один шаг.
 * - Каталог «Реакции»: молекула + молекула / молекула + простое вещество
 *   (SO₂+O₂, CaO+H₂O, NH₃+HCl, SO₃+H₂O, …).
 *
 * H₂, O₂, N₂, Cl₂ — уже молекулы простых веществ (не «голые атомы»).
 * Уравнение вида «2S + 3O₂ = 2SO₃» химически неверно для школы.
 */

export type SubstanceFromElementsPolicy = 'allowed' | 'forbidden'

/** Вещества, для которых AUTO-уравнение «из элементов» запрещено. */
const FORBIDDEN_FROM_ELEMENTS = new Set<string>([
  // Оксиды — не прямым N₂/O₂ или горение даёт другой продукт
  'so3',
  'n2o5',
  'n2o',
  'no2',
  'feo',
  'cu2o',
  'bao',
  // Оксокислоты — оксид + вода / вытеснение / промышленные цепи
  'h2so4',
  'h2so3',
  'hno3',
  'hno2',
  'h3po4',
  'h3po3',
  'h2co3',
  'h2sio3',
  'hclo',
  'hclo3',
  'hclo4',
  'hmno4',
  'h2cro4',
  // Гидроксиды — оксид + вода / металл + вода / осаждение
  'ca_oh_2',
  'ba_oh_2',
  'mg_oh_2',
  'fe_oh_2',
  'fe_oh_3',
  'al_oh_3',
  'cu_oh_2',
  'zn_oh_2',
  'lioh',
  'naoh',
  'koh',
  'nh3_h2o',
  // Карбонаты / гидрокарбонаты — не из Ca+C+O
  'salt_ca_co3',
  'salt_na_co3',
  'salt_k_co3',
  'salt_ba_co3',
  'salt_mg_co3',
  'salt_nh4_co3',
  'salt_nahco3',
  'salt_khco3',
  'salt_ca_hco3_2',
  // Соли аммония — NH₃ + кислота
  'salt_nh4_cl',
  'salt_nh4_so4',
  'salt_nh4_br',
  'salt_nh4_i',
  'salt_nh4_f',
  'salt_nh4_no3',
  'salt_nh4_3_po4',
  'salt_nh4_so3',
  // Хроматы / дихроматы — не из K+Cr+O₂
  'salt_k2cr2o7',
  'salt_k_cro4',
  // NaBr — предпочтительный спокойный путь (куратор), не прямой Na+Br₂
  'salt_na_br',
  // Fe₂S₃ — сухой Fe+S даёт FeS
  'salt_fe3_s',
])

/** Предпочтительная школьная реакция в каталоге «Реакции» (если есть в банке). */
const PREFERRED_SCHOOL_REACTION: Readonly<Record<string, string>> = {
  so3: 'so2-o2-so3',
  no2: 'no-o2-no2',
  ca_oh_2: 'cao-h2o',
  salt_ca_co3: 'cao-co2',
  salt_nh4_cl: 'nh3-hcl',
  salt_nh4_so4: 'nh3-h2so4',
  h2cro4: 'cro3-h2o',
  naoh: 'na-h2o',
  koh: 'k-h2o',
  h2so4: 'so3-h2o',
  h2so3: 'so2-h2o',
  h3po4: 'p2o5-h2o',
  h2co3: 'co2-h2o',
  hno3: 'ostwald-hno3',
  hno2: 'nano2-hcl-hno2',
  h3po3: 'p4o6-h2o-h3po3',
  h2sio3: 'na2sio3-hcl',
  hclo4: 'kclo4-h2so4',
  hclo3: 'baclo3-h2so4',
  hclo: 'cl2-h2o-hclo',
  hmno4: 'ba-mno4-h2so4',
  n2o5: 'hno3-p2o5-n2o5',
  feo: 'fe2o3-co-feo',
  cu2o: 'cuo-decomp-cu2o',
  bao: 'bao2-decomp-bao',
  salt_k2cr2o7: 'k2cro4-h2so4-k2cr2o7',
  salt_na_no3: 'naoh-hno3',
  salt_fe2_s: 'fe-s-fes',
}

/** Школьный маршрут (текст на карточке вещества вместо ложного «из элементов»). */
const SCHOOL_ROUTE_RU: Readonly<Record<string, string>> = {
  so3: 'Маршрут: S + O₂ → SO₂, затем 2SO₂ + O₂ ⇄ 2SO₃ (V₂O₅, 400–450 °C)',
  n2o5: 'Маршрут: 2HNO₃ + P₂O₅ → N₂O₅ + 2HPO₃ (не из N₂+O₂)',
  n2o: 'Маршрут: NH₄NO₃ →(t°) N₂O + 2H₂O (не из N₂+O₂ напрямую)',
  no2: 'Маршрут: 2NO + O₂ → 2NO₂ (не прямым N₂+O₂)',
  feo: 'Маршрут: не горение Fe (даёт Fe₃O₄); Fe₂O₃ + CO →(>570 °C) 2FeO + CO₂',
  cu2o: 'Маршрут: 4CuO →(>1020 °C) 2Cu₂O + O₂; или восстановление Cu(OH)₂ (не Cu+O₂ при 400–500 °C)',
  bao: 'Маршрут: 2BaO₂ →(>800 °C) 2BaO + O₂ или BaCO₃ →(t°) BaO + CO₂ (горение Ba часто → BaO₂)',
  h2so4: 'Маршрут: SO₃ + H₂O → H₂SO₄ (после контактного процесса; V₂O₅ — только для SO₂→SO₃)',
  h2so3: 'Маршрут: SO₂ + H₂O ⇄ H₂SO₃',
  hno3:
    'Маршрут Оствальда: 4NH₃+5O₂ → 4NO+6H₂O (Pt–Rh, 800–900 °C); 2NO+O₂ → 2NO₂; 4NO₂+O₂+2H₂O → 4HNO₃',
  hno2: 'Маршрут: NaNO₂ + HCl → HNO₂ + NaCl (холод) или N₂O₃ + H₂O ⇄ 2HNO₂',
  h3po4: 'Маршрут: 4P+5O₂ → 2P₂O₅, затем P₂O₅ + 3H₂O → 2H₃PO₄ (или Ca₃(PO₄)₂ + H₂SO₄)',
  h3po3: 'Маршрут: P₄O₆ + 6H₂O → 4H₃PO₃ или PCl₃ + 3H₂O → H₃PO₃ + 3HCl',
  h2co3: 'Маршрут: CO₂ + H₂O ⇄ H₂CO₃',
  h2sio3: 'Маршрут: Na₂SiO₃ + 2HCl → H₂SiO₃↓ + 2NaCl (не Si+H₂+O₂; SiO₂ с водой не реагирует)',
  hclo4: 'Маршрут: KClO₄ + H₂SO₄ → KHSO₄ + HClO₄ (не Cl₂+H₂+O₂)',
  hclo3: 'Маршрут: Ba(ClO₃)₂ + H₂SO₄ → BaSO₄↓ + 2HClO₃ (не Cl₂+H₂+O₂)',
  hclo: 'Маршрут: Cl₂ + H₂O ⇄ HClO + HCl (или Cl₂O + H₂O ⇄ 2HClO)',
  hmno4: 'Маршрут: Mn₂O₇ + H₂O → 2HMnO₄ (охлаждение) или Ba(MnO₄)₂ + H₂SO₄ → BaSO₄↓ + 2HMnO₄',
  h2cro4: 'Маршрут: CrO₃ + H₂O ⇄ H₂CrO₄ (или K₂CrO₄ + H₂SO₄ → H₂CrO₄ + K₂SO₄)',
  ca_oh_2: 'Маршрут: CaO + H₂O → Ca(OH)₂ (или Ca + 2H₂O)',
  salt_ca_co3: 'Маршрут: CaO + CO₂ → CaCO₃ (или Ca(OH)₂ + CO₂)',
  salt_nh4_cl: 'Маршрут: NH₃ + HCl → NH₄Cl',
  salt_nh4_so4: 'Маршрут: 2NH₃ + H₂SO₄ → (NH₄)₂SO₄',
  naoh: 'Маршрут: 2Na + 2H₂O → 2NaOH + H₂',
  koh: 'Маршрут: 2K + 2H₂O → 2KOH + H₂',
  salt_k2cr2o7:
    'Маршрут: 2K₂CrO₄ + H₂SO₄ → K₂Cr₂O₇ + K₂SO₄ + H₂O (не 4Cr+4K+7O₂). Оранжево-красный Cr(VI).',
  salt_k_cro4: 'Маршрут: через CrO₃ / хромовую кислоту + KOH (не K+Cr+O₂ напрямую)',
  salt_na_no2:
    'Маршрут: NaNO₃ + Pb →(t°) NaNO₂ + PbO (или восстановление нитрата); не N₂+Na+O₂. Ион NO₂⁻, не NO₃⁻.',
  salt_na_no3: 'Маршрут: NaOH / Na₂CO₃ + HNO₃ → NaNO₃ + … (не N₂+Na+O₂)',
  salt_k_mno4:
    'Маршрут: 2KMnO₄ ← окисление MnO₂ / манганата в щёлочи (промышленность); не K+Mn+O₂',
  salt_cr_no3: 'Маршрут: Cr(OH)₃ + 3HNO₃ → Cr(NO₃)₃ + 3H₂O (не Cr+N₂+O₂)',
  salt_cr_no2:
    'Маршрут: обмен в неводной среде, напр. Cr₂(SO₄)₃ + 3Ba(NO₂)₂ → 2Cr(NO₂)₃ + 3BaSO₄↓ (не Cr+N₂+O₂)',
  salt_cr_po4:
    'Маршрут: CrCl₃ + Na₃PO₄ → CrPO₄↓ + 3NaCl или Cr(OH)₃ + H₃PO₄ → CrPO₄↓ + 3H₂O',
  salt_cr_mno4:
    'Маршрут: обмен, напр. Cr₂(SO₄)₃ + 3Ba(MnO₄)₂ → 2Cr(MnO₄)₃ + 3BaSO₄↓ (не Cr+Mn+O₂)',
  salt_fe3_s:
    'Маршрут: Fe₂S₃ нестабилен; при нагреве Fe+S → FeS. Fe₂S₃ — осаждение при низких T из раствора Fe³⁺ + S²⁻ (не сухой синтез).',
  salt_na_sio3:
    'Маршрут: SiO₂ + 2NaOH →(t°) Na₂SiO₃ + H₂O (или Na₂CO₃ + SiO₂); не Na+Si+O₂',
}

export function fromElementsPolicy(compoundId: string): SubstanceFromElementsPolicy {
  if (FORBIDDEN_FROM_ELEMENTS.has(compoundId)) return 'forbidden'
  if (compoundId.startsWith('salt_nh4_')) return 'forbidden'
  if (compoundId.includes('_co3') || compoundId.includes('_hco3')) return 'forbidden'
  if (compoundId.endsWith('_oh_2') || compoundId.endsWith('_oh_3')) return 'forbidden'
  // Хроматы / дихроматы (в т.ч. salt_k2cr2o7)
  if (compoundId.includes('cr2o7') || compoundId.includes('_cro4') || compoundId.endsWith('cro4')) {
    return 'forbidden'
  }
  // Оксосоли: нитраты, нитриты, сульфаты, сульфиты, фосфаты, силикаты,
  // перманганаты, хлораты, перхлораты — НЕ из металла+неметалл+O₂ в один шаг.
  if (
    compoundId.includes('_no3') ||
    compoundId.includes('_no2') ||
    compoundId.includes('_so4') ||
    compoundId.includes('_so3') ||
    compoundId.includes('_po4') ||
    compoundId.includes('_sio3') ||
    compoundId.includes('_mno4') ||
    compoundId.includes('_clo3') ||
    compoundId.includes('_clo4')
  ) {
    return 'forbidden'
  }
  // Fe₂S₃: при нагреве Fe+S → FeS, не Fe₂S₃
  if (compoundId === 'salt_fe3_s') return 'forbidden'
  return 'allowed'
}

export function preferredSchoolReactionId(compoundId: string): string | null {
  return PREFERRED_SCHOOL_REACTION[compoundId] ?? null
}

export function schoolRouteRecipeRu(
  compoundId: string,
  formulaUnicode: string,
): string | null {
  if (fromElementsPolicy(compoundId) !== 'forbidden') return null
  if (SCHOOL_ROUTE_RU[compoundId]) return SCHOOL_ROUTE_RU[compoundId]!
  // Универсальные школьные подсказки по аниону (когда нет VIP-маршрута).
  if (compoundId.includes('_no3')) {
    return `Маршрут: металл / оксид / гидроксид + HNO₃ → ${formulaUnicode} (не из элементов с N₂+O₂)`
  }
  if (compoundId.includes('_no2')) {
    return `Маршрут: восстановление нитрата или обмен с нитритом → ${formulaUnicode} (не N₂+металл+O₂)`
  }
  if (compoundId.includes('_so4')) {
    return `Маршрут: оксид / гидроксид / металл + H₂SO₄ → ${formulaUnicode} (не металл+S+O₂)`
  }
  if (compoundId.includes('_so3')) {
    return `Маршрут: щёлочь + SO₂ → сульфит → ${formulaUnicode} (не металл+S+O₂)`
  }
  if (compoundId.includes('_po4')) {
    return `Маршрут: растворимая соль металла + фосфат / гидроксид + H₃PO₄ → ${formulaUnicode}`
  }
  if (compoundId.includes('_sio3')) {
    return `Маршрут: SiO₂ + щёлочь / карбонат → ${formulaUnicode} (не металл+Si+O₂)`
  }
  if (compoundId.includes('_mno4')) {
    return `Маршрут: через манганат / обмен с перманганатом → ${formulaUnicode} (не металл+Mn+O₂)`
  }
  if (compoundId.includes('_clo3') || compoundId.includes('_clo4')) {
    return `Маршрут: электролиз / disproportionation хлоратов → ${formulaUnicode} (не Cl₂+металл+O₂)`
  }
  return `Не получают прямым соединением элементов в один шаг. Смотрите «Реакции» и этапы получения для ${formulaUnicode}.`
}

/**
 * Итоговая строка для карточки вещества:
 * - allowed → обычное уравнение из простых веществ / override;
 * - forbidden → школьный маршрут (не ложный S+O₂→SO₃).
 */
export function resolveLaboratoryRecipeRu(
  compoundId: string,
  formulaUnicode: string,
  explicitRecipe: string | undefined,
  autoFromElements: string,
): string {
  if (fromElementsPolicy(compoundId) === 'forbidden') {
    if (explicitRecipe && !looksLikeForbiddenElementShortcut(compoundId, explicitRecipe)) {
      return explicitRecipe
    }
    return schoolRouteRecipeRu(compoundId, formulaUnicode) ?? autoFromElements
  }
  return explicitRecipe ?? autoFromElements
}

function looksLikeForbiddenElementShortcut(compoundId: string, recipe: string): boolean {
  if (compoundId === 'so3' && /2S\s*\+\s*3O|3O₂\s*\+\s*2S|2S\s*\+\s*3O₂/.test(recipe)) return true
  if (compoundId === 'h2so4' && /H₂\s*\+\s*S/.test(recipe) && !/SO₃/.test(recipe)) return true
  if (compoundId === 'ca_oh_2' && /Ca\s*\+\s*H₂\s*\+\s*O₂/.test(recipe)) return true
  if (/Маршрут:/.test(recipe)) return false
  // Явные «из элементов» для кислот/запрещённых оксидов
  if (FORBIDDEN_FROM_ELEMENTS.has(compoundId) && /=/.test(recipe) && !/→|⇄|⇌/.test(recipe)) {
    return true
  }
  return false
}

export function listForbiddenFromElementsIds(): readonly string[] {
  return [...FORBIDDEN_FROM_ELEMENTS]
}
