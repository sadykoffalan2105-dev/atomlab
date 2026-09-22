import { getElementByZ } from '../../data/elements'

/**
 * Сигнатуры реакций научных сцен.
 *
 * Сцена показывает КОНКРЕТНУЮ реакцию (2 Na + Cl₂ → 2 NaCl), а не «любой путь к продукту».
 * Раньше сцена выбиралась только по id продукта, и «NaOH + HCl → NaCl + H₂O» проигрывала
 * горение натрия в хлоре, разложение Mg(OH)₂ — горение магния, и т. д. Это научная ошибка.
 *
 * Теперь у каждой сцены есть одна или несколько сигнатур — МНОЖЕСТВО реагентов левой части:
 *   • простые вещества — символом элемента ('Na', 'Cl' — это Cl₂, двухатомность не важна);
 *   • соединения — id каталога ('salt_ca_co3', 'hcl').
 * Сцена играет, только если множество реагентов текущего синтеза РАВНО одной из сигнатур
 * (коэффициенты и порядок не важны). Иначе — обычный ElementsCollapseFx.
 *
 * Модуль чистый (без React и three) — его читают LabScene, registry.ts и тест
 * scripts/test-product-hero.mts.
 */

export type ReactionSignature = {
  /** простые вещества: символы элементов (Cl₂ → 'Cl', O₂ → 'O', графит → 'C') */
  readonly elements?: readonly string[]
  /** соединения: id из compoundById */
  readonly compounds?: readonly string[]
}

/** Реагент в том виде, в каком его знают реактор (ReactorEquationTerm) и банк реакций. */
export type SceneReactant = {
  readonly z?: number
  readonly compoundId?: string
}

/**
 * Ключ = id продукта (как в compoundById и productId банка), значение — сигнатуры реакций,
 * которые сцена РЕАЛЬНО показывает. Сверено с раскадровками сцен.
 */
export const SCIENTIFIC_SCENE_SIGNATURES = {
  // 2 NaClO₂ + Cl₂ → 2 NaCl + 2 ClO₂ (bank 'clo2-naclo2-cl2')
  clo2: [{ compounds: ['salt_na_clo2'], elements: ['Cl'] }],
  // 2 Na + Cl₂ → 2 NaCl (bank 'na-cl-nacl'); нейтрализация NaOH + HCl и карбонаты с HCl — НЕ эта сцена
  nacl: [{ elements: ['Na', 'Cl'] }],
  // C (графит) + O₂ → CO₂ (bank 'c-o2-co2'); 2CO + O₂ и H₂CO₃ → … — не эта сцена
  co2: [{ elements: ['C', 'O'] }],
  // Обжиг известняка CaCO₃ → CaO + CO₂ (bank 'caco3-decomp'); 2Ca + O₂ → 2CaO — не эта сцена
  cao: [{ compounds: ['salt_ca_co3'] }],
  // 2 H₂ + O₂ → 2 H₂O (bank 'h2-o2-h2o'); 2H₂O₂ → 2H₂O + O₂ — не эта сцена
  h2o: [{ elements: ['H', 'O'] }],
  // N₂ + 3 H₂ ⇌ 2 NH₃ (bank 'n2-h2-nh3')
  nh3: [{ elements: ['N', 'H'] }],
  // Fe + S → FeS (bank 'fe-s-fes')
  salt_fe2_s: [{ elements: ['Fe', 'S'] }],
  // S + O₂ → SO₂ (bank 's-o2-so2'); обжиг FeS₂ и горение H₂S — не эта сцена
  so2: [{ elements: ['S', 'O'] }],
  // H₂ + Cl₂ → 2 HCl (bank 'h2-cl2-hcl')
  hcl: [{ elements: ['H', 'Cl'] }],
  // 2 Mg + O₂ → 2 MgO (bank 'mg-o2-mgo'); разложение Mg(OH)₂ — не эта сцена
  mgo: [{ elements: ['Mg', 'O'] }],
  // Zn + 2 HCl → ZnCl₂ + H₂↑ (bank 'zn-hcl'); прямой синтез Zn + Cl₂ — не эта сцена
  salt_zn_cl: [{ elements: ['Zn'], compounds: ['hcl'] }],
  // CH₄ + 2 O₂ → CO₂ + 2 H₂O. Ключ не совпадает ни с одним productId каталога — сцена ждёт
  // UI-переключателя маршрута; сигнатура задана, чтобы при подключении не показать её для C + O₂.
  // Метана в каталоге неорганики пока нет: 'ch4' — будущий id, при подключении сверить с compoundById.
  ch4_combustion: [{ compounds: ['ch4'], elements: ['O'] }],
} as const satisfies Readonly<Record<string, readonly ReactionSignature[]>>

export type ScientificSceneProductId = keyof typeof SCIENTIFIC_SCENE_SIGNATURES

/** Ключ реагента: 'el:Na' или 'cmp:naoh'. null — реагент не распознан. */
export function reactantKey(r: SceneReactant): string | null {
  if (r.compoundId) return `cmp:${r.compoundId}`
  if (typeof r.z === 'number') {
    const sym = getElementByZ(r.z)?.symbol
    return sym ? `el:${sym}` : null
  }
  return null
}

function signatureKeySet(sig: ReactionSignature): Set<string> {
  const out = new Set<string>()
  for (const e of sig.elements ?? []) out.add(`el:${e}`)
  for (const c of sig.compounds ?? []) out.add(`cmp:${c}`)
  return out
}

/** Множество реагентов совпадает с сигнатурой (коэффициенты и повторы не важны). */
export function signatureMatches(sig: ReactionSignature, reactants: readonly SceneReactant[]): boolean {
  const want = signatureKeySet(sig)
  const have = new Set<string>()
  for (const r of reactants) {
    const k = reactantKey(r)
    if (!k) return false
    have.add(k)
  }
  if (have.size !== want.size) return false
  for (const k of have) if (!want.has(k)) return false
  return true
}

export function isScientificSceneProduct(id: string): id is ScientificSceneProductId {
  return Object.prototype.hasOwnProperty.call(SCIENTIFIC_SCENE_SIGNATURES, id)
}

/**
 * Какая научная сцена подходит к синтезу: продукт есть в реестре И реагенты совпадают
 * с одной из его сигнатур. Без реагентов сцена не выбирается никогда.
 */
export function scientificSceneFor(
  productId: string | null | undefined,
  reactants: readonly SceneReactant[] | null | undefined,
): ScientificSceneProductId | null {
  if (!productId || !reactants || reactants.length === 0) return null
  if (!isScientificSceneProduct(productId)) return null
  const sigs: readonly ReactionSignature[] = SCIENTIFIC_SCENE_SIGNATURES[productId]
  return sigs.some((s) => signatureMatches(s, reactants)) ? productId : null
}
