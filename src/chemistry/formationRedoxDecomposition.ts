/**
 * Окислительно-восстановительное разложение при нагревании (сценарий «Как образуется», вид 'redoxDecomposition'):
 * 4MnO₂ → 2Mn₂O₃ + O₂, 3MnO₂ → Mn₃O₄ + O₂, 4CuO → 2Cu₂O + O₂, 2KMnO₄ → K₂MnO₄ + MnO₂ + O₂, 2NaNO₃ → 2NaNO₂ + O₂,
 * 2KNO₃ → 2KNO₂ + O₂. Кислород исходного (O²⁻ / O⁻²) отдаёт электроны и уходит молекулой O₂; катион (или центральный атом
 * аниона) их принимает. Здесь — только химия (уравнение, полуреакции, заряды до/после, проверки); сцена — story/redoxDecomposition.ts.
 */

export type Tri = [string, string, string]

/** Принимающий электроны центр: элемент, заряд/степень окисления до и после, число e⁻, в какой продукт уходит. */
export type RedoxGain = { el: string; from: number; to: number; kind: 'ion' | 'ox'; product: string }

export type RedoxDecompDef = {
  id: string
  /** уравнение пути (HUD): «4MnO₂ —t°→ 2Mn₂O₃ + O₂↑» */
  equation: string
  /** вид фрагмента исходного: rutile — MnO₂ (O–Mn–O), cube — CuO (ионы через один), permanganate — K⁺ + MnO₄⁻, nitrate — M⁺ + NO₃⁻ */
  reagent: 'rutile' | 'cube' | 'permanganate' | 'nitrate'
  /** формула исходного и число формульных единиц по уравнению */
  reagentFormula: string
  n: number
  /** катион нитрата / перманганата (Na, K) */
  cation?: string
  /** «4 MnO₂ = 4 Mn⁴⁺ + 8 O²⁻» */
  reagentIons: Tri
  /** принимающие центры по порядку (сумма e⁻ = 4) */
  gains: RedoxGain[]
  /** у кислорода исходного: 'ion' (O²⁻) или 'ox' (O⁻² в MnO₄⁻ / NO₃⁻) */
  oKind: 'ion' | 'ox'
  oxidation: Tri
  reduction: Tri[]
  /** продукты (кроме O₂): формула, число формульных единиц, состав и сумма зарядов «2·(+3) + 3·(−2) = 0» */
  products: { formula: string; count: number; atoms: Record<string, number>; check: string }[]
  /** что значит разрыв связей: RU / EN / UZ */
  breakNote: Tri
}

const ox = (gains: RedoxGain[]) => gains

export const REDOX_DECOMPOSITION: Record<string, RedoxDecompDef> = {
  tb_mn2o3: {
    id: 'tb_mn2o3',
    equation: '4MnO₂ —t°→ 2Mn₂O₃ + O₂↑',
    reagent: 'rutile',
    reagentFormula: 'MnO₂',
    n: 4,
    reagentIons: ['4 MnO₂ = 4 Mn⁴⁺ + 8 O²⁻', '4 MnO₂ = 4 Mn⁴⁺ + 8 O²⁻', '4 MnO₂ = 4 Mn⁴⁺ + 8 O²⁻'],
    gains: ox([1, 2, 3, 4].map(() => ({ el: 'Mn', from: 4, to: 3, kind: 'ion' as const, product: 'Mn₂O₃' }))),
    oKind: 'ion',
    oxidation: ['Окисление: 2O²⁻ − 4e⁻ → O₂⁰', 'Oxidation: 2O²⁻ − 4e⁻ → O₂⁰', 'Oksidlanish: 2O²⁻ − 4e⁻ → O₂⁰'],
    reduction: [['Восстановление: 4Mn⁴⁺ + 4e⁻ → 4Mn³⁺', 'Reduction: 4Mn⁴⁺ + 4e⁻ → 4Mn³⁺', 'Qaytarilish: 4Mn⁴⁺ + 4e⁻ → 4Mn³⁺']],
    products: [{ formula: 'Mn₂O₃', count: 2, atoms: { Mn: 2, O: 3 }, check: 'Mn₂O₃: 2·(+3) + 3·(−2) = 0' }],
    breakNote: ['Связи Mn–O у двух ионов O²⁻ рвутся', 'Mn–O bonds of two O²⁻ ions break', 'Ikki O²⁻ ionining Mn–O bogʻlari uziladi'],
  },
  tb_mn3o4: {
    id: 'tb_mn3o4',
    equation: '3MnO₂ —t°→ Mn₃O₄ + O₂↑',
    reagent: 'rutile',
    reagentFormula: 'MnO₂',
    n: 3,
    reagentIons: ['3 MnO₂ = 3 Mn⁴⁺ + 6 O²⁻', '3 MnO₂ = 3 Mn⁴⁺ + 6 O²⁻', '3 MnO₂ = 3 Mn⁴⁺ + 6 O²⁻'],
    gains: [
      { el: 'Mn', from: 4, to: 3, kind: 'ion', product: 'Mn₃O₄' },
      { el: 'Mn', from: 4, to: 2, kind: 'ion', product: 'Mn₃O₄' },
      { el: 'Mn', from: 4, to: 3, kind: 'ion', product: 'Mn₃O₄' },
    ],
    oKind: 'ion',
    oxidation: ['Окисление: 2O²⁻ − 4e⁻ → O₂⁰', 'Oxidation: 2O²⁻ − 4e⁻ → O₂⁰', 'Oksidlanish: 2O²⁻ − 4e⁻ → O₂⁰'],
    reduction: [
      ['Восстановление: Mn⁴⁺ + 2e⁻ → Mn²⁺', 'Reduction: Mn⁴⁺ + 2e⁻ → Mn²⁺', 'Qaytarilish: Mn⁴⁺ + 2e⁻ → Mn²⁺'],
      ['Восстановление: 2Mn⁴⁺ + 2e⁻ → 2Mn³⁺', 'Reduction: 2Mn⁴⁺ + 2e⁻ → 2Mn³⁺', 'Qaytarilish: 2Mn⁴⁺ + 2e⁻ → 2Mn³⁺'],
    ],
    products: [{ formula: 'Mn₃O₄', count: 1, atoms: { Mn: 3, O: 4 }, check: 'Mn₃O₄: (+2) + 2·(+3) + 4·(−2) = 0' }],
    breakNote: ['Связи Mn–O у двух ионов O²⁻ рвутся', 'Mn–O bonds of two O²⁻ ions break', 'Ikki O²⁻ ionining Mn–O bogʻlari uziladi'],
  },
  cu2o: {
    id: 'cu2o',
    equation: '4CuO —t°→ 2Cu₂O + O₂↑',
    reagent: 'cube',
    reagentFormula: 'CuO',
    n: 4,
    reagentIons: ['4 CuO = 4 Cu²⁺ + 4 O²⁻', '4 CuO = 4 Cu²⁺ + 4 O²⁻', '4 CuO = 4 Cu²⁺ + 4 O²⁻'],
    gains: [1, 2, 3, 4].map(() => ({ el: 'Cu', from: 2, to: 1, kind: 'ion' as const, product: 'Cu₂O' })),
    oKind: 'ion',
    oxidation: ['Окисление: 2O²⁻ − 4e⁻ → O₂⁰', 'Oxidation: 2O²⁻ − 4e⁻ → O₂⁰', 'Oksidlanish: 2O²⁻ − 4e⁻ → O₂⁰'],
    reduction: [['Восстановление: 4Cu²⁺ + 4e⁻ → 4Cu⁺', 'Reduction: 4Cu²⁺ + 4e⁻ → 4Cu⁺', 'Qaytarilish: 4Cu²⁺ + 4e⁻ → 4Cu⁺']],
    products: [{ formula: 'Cu₂O', count: 2, atoms: { Cu: 2, O: 1 }, check: 'Cu₂O: 2·(+1) + (−2) = 0' }],
    breakNote: ['Связи Cu–O у двух ионов O²⁻ рвутся', 'Cu–O bonds of two O²⁻ ions break', 'Ikki O²⁻ ionining Cu–O bogʻlari uziladi'],
  },
  mno2: permanganate('mno2'),
  tb_k2mno4: permanganate('tb_k2mno4'),
  salt_na_no2: nitrate('salt_na_no2', 'Na'),
  salt_k_no2: nitrate('salt_k_no2', 'K'),
}

function permanganate(id: string): RedoxDecompDef {
  return {
    id,
    equation: '2KMnO₄ —t°→ K₂MnO₄ + MnO₂ + O₂↑',
    reagent: 'permanganate',
    reagentFormula: 'KMnO₄',
    n: 2,
    cation: 'K',
    reagentIons: ['2 KMnO₄ = 2 K⁺ + 2 MnO₄⁻ (Mn⁺⁷)', '2 KMnO₄ = 2 K⁺ + 2 MnO₄⁻ (Mn⁺⁷)', '2 KMnO₄ = 2 K⁺ + 2 MnO₄⁻ (Mn⁺⁷)'],
    gains: [
      { el: 'Mn', from: 7, to: 6, kind: 'ox', product: 'K₂MnO₄' },
      { el: 'Mn', from: 7, to: 4, kind: 'ox', product: 'MnO₂' },
    ],
    oKind: 'ox',
    oxidation: ['Окисление: 2O⁻² − 4e⁻ → O₂⁰', 'Oxidation: 2O⁻² − 4e⁻ → O₂⁰', 'Oksidlanish: 2O⁻² − 4e⁻ → O₂⁰'],
    reduction: [
      ['Восстановление: Mn⁺⁷ + 1e⁻ → Mn⁺⁶ (K₂MnO₄)', 'Reduction: Mn⁺⁷ + 1e⁻ → Mn⁺⁶ (K₂MnO₄)', 'Qaytarilish: Mn⁺⁷ + 1e⁻ → Mn⁺⁶ (K₂MnO₄)'],
      ['Восстановление: Mn⁺⁷ + 3e⁻ → Mn⁺⁴ (MnO₂)', 'Reduction: Mn⁺⁷ + 3e⁻ → Mn⁺⁴ (MnO₂)', 'Qaytarilish: Mn⁺⁷ + 3e⁻ → Mn⁺⁴ (MnO₂)'],
    ],
    products: [
      { formula: 'K₂MnO₄', count: 1, atoms: { K: 2, Mn: 1, O: 4 }, check: 'K₂MnO₄: 2·(+1) + (+6) + 4·(−2) = 0' },
      { formula: 'MnO₂', count: 1, atoms: { Mn: 1, O: 2 }, check: 'MnO₂: (+4) + 2·(−2) = 0' },
    ],
    breakNote: ['Две связи Mn–O одного иона MnO₄⁻ рвутся', 'Two Mn–O bonds of one MnO₄⁻ ion break', 'Bitta MnO₄⁻ ionining ikki Mn–O bogʻi uziladi'],
  }
}

function nitrate(id: string, M: 'Na' | 'K'): RedoxDecompDef {
  return {
    id,
    equation: `2${M}NO₃ —t°→ 2${M}NO₂ + O₂↑`,
    reagent: 'nitrate',
    reagentFormula: `${M}NO₃`,
    n: 2,
    cation: M,
    reagentIons: [`2 ${M}NO₃ = 2 ${M}⁺ + 2 NO₃⁻ (N⁺⁵)`, `2 ${M}NO₃ = 2 ${M}⁺ + 2 NO₃⁻ (N⁺⁵)`, `2 ${M}NO₃ = 2 ${M}⁺ + 2 NO₃⁻ (N⁺⁵)`],
    gains: [
      { el: 'N', from: 5, to: 3, kind: 'ox', product: `${M}NO₂` },
      { el: 'N', from: 5, to: 3, kind: 'ox', product: `${M}NO₂` },
    ],
    oKind: 'ox',
    oxidation: ['Окисление: 2O⁻² − 4e⁻ → O₂⁰', 'Oxidation: 2O⁻² − 4e⁻ → O₂⁰', 'Oksidlanish: 2O⁻² − 4e⁻ → O₂⁰'],
    reduction: [['Восстановление: 2N⁺⁵ + 4e⁻ → 2N⁺³', 'Reduction: 2N⁺⁵ + 4e⁻ → 2N⁺³', 'Qaytarilish: 2N⁺⁵ + 4e⁻ → 2N⁺³']],
    products: [{ formula: `${M}NO₂`, count: 2, atoms: { [M]: 1, N: 1, O: 2 }, check: `${M}NO₂: (+1) + (+3) + 2·(−2) = 0` }],
    breakNote: ['В каждом NO₃⁻ рвётся одна связь N–O', 'In each NO₃⁻ one N–O bond breaks', 'Har bir NO₃⁻ da bitta N–O bogʻi uziladi'],
  }
}

export const isRedoxDecomposition = (id: string): boolean => id in REDOX_DECOMPOSITION
export const redoxDecomposition = (id: string): RedoxDecompDef | null => REDOX_DECOMPOSITION[id] ?? null

/** Баланс: «4e⁻ = 4e⁻» (отдано = принято). */
export function redoxBalance(d: RedoxDecompDef): { given: number; taken: number } {
  return { given: 4, taken: d.gains.reduce((n, g) => n + (g.from - g.to), 0) }
}

/** Атомы исходного по уравнению: 4 MnO₂ → { Mn: 4, O: 8 }. */
export function reagentAtoms(d: RedoxDecompDef): Record<string, number> {
  const per: Record<string, number> =
    d.reagent === 'rutile' ? { Mn: 1, O: 2 } : d.reagent === 'cube' ? { Cu: 1, O: 1 } : d.reagent === 'permanganate' ? { K: 1, Mn: 1, O: 4 } : { [d.cation!]: 1, N: 1, O: 3 }
  return Object.fromEntries(Object.entries(per).map(([k, v]) => [k, v * d.n]))
}

/** Атомы продуктов по уравнению (+ O₂). */
export function productAtoms(d: RedoxDecompDef): Record<string, number> {
  const out: Record<string, number> = { O: 2 }
  for (const p of d.products) for (const [k, v] of Object.entries(p.atoms)) out[k] = (out[k] ?? 0) + v * p.count
  return out
}
