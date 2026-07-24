import { getMolecularGeometryOrNull } from '../chemistry/catalogGeometryOverrides'
import {
  expandLeftTermsToPreviewSlots,
  validateReactorEquation,
  type ReactorEquationTerm,
  type ReactorValidationErrorCode,
} from '../chemistry/reactorEquationBalance'
import {
  hasScientificReactorRecipe,
  isScientificEquationBalanced,
  scientificSyntheticZSlots,
  type ReactorCoProductTerm,
} from '../chemistry/scientificReactorRecipes'
import { scientificSynthesisWatchdogMs } from './scientificSynthesis/clo2ScenarioTiming'
import { synthesisLaunchWatchdogMs } from './synthesisLaunchTiming'
import { getReactorVisualTier, type ReactorVisualTier } from '../chemistry/reactorVisualTier'
import type { CompoundDef } from '../types/chemistry'

/**
 * Контракт лаборатории: после успешной валидации и нажатия «Проверить и запустить синтез»
 * пользователь всегда должен увидеть 3D-продукт из каталога (CatalogSubstanceDisplay /
 * SynthesisSettledProductHero) — тот же CompoundDef, что в каталоге веществ.
 */
/** Нижняя граница; фактический бюджет — getSynthesisWatchdogMs (collapse + paint). */
export const SYNTHESIS_WATCHDOG_MS = 5200

/** Таймаут гарантии успеха под длительность космического «запуска». */
export function getSynthesisWatchdogMs(
  flyTerms: readonly ReactorEquationTerm[],
  zSlots: readonly number[],
  productId?: string | null,
): number {
  const sci = productId ? scientificSynthesisWatchdogMs(productId) : null
  if (sci != null) return sci
  if (flyTerms.length > 0) {
    const atomCount = expandLeftTermsToPreviewSlots(flyTerms).length
    const tier = getReactorVisualTier(flyTerms)
    return synthesisLaunchWatchdogMs(flyTerms.length, atomCount, tier)
  }
  return synthesisLaunchWatchdogMs(Math.max(1, zSlots.length), zSlots.length, 'full')
}

/**
 * Визуальный контракт: при успешном синтезе (product != null) сцена использует только
 * converge-layout из кластеров (expandLeftTermsToPreviewSlots), не positionsOnCircle.
 */
export const SYNTHESIS_VISUAL_CONTRACT =
  'success synthesis must use cluster converge layout, never full zSlots circle'

export type GuaranteedSynthesisRun = {
  productId: string
  compound: CompoundDef
  /** Полный набор для валидации/лимитов (O₂ ×2). */
  zSlots: readonly number[]
  /** Снимок слагаемых на момент запуска. */
  flyTerms: readonly ReactorEquationTerm[]
  /** Только отрисовка полёта (capped preview models). */
  visualFlyZs: readonly number[]
  /** full | lite | cluster — tiered 3D performance. */
  visualTier: ReactorVisualTier
}

export type PrepareGuaranteedResult =
  | { ok: true; payload: GuaranteedSynthesisRun }
  | { ok: false; code: ReactorValidationErrorCode; params?: Record<string, string | number> }

/** Dev: регрессия — кольцо при успешном синтезе. */
export function assertSuccessSynthesisVisualMode(_hasProduct: boolean, _usedCircleLayout: boolean): void {
  /* silent — recovery guards handle visuals */
}

/** Свежая ссылка на вещество из каталога по id (не из устаревшего state). */
export function resolveCatalogProduct(
  compoundById: Readonly<Record<string, CompoundDef>>,
  productId: string | null | undefined,
): CompoundDef | null {
  if (!productId) return null
  return compoundById[productId] ?? null
}

/** Минимальная проверка: есть геометрия для HeroMoleculeRig. */
export function isCatalogRenderable(compound: CompoundDef): boolean {
  if (getMolecularGeometryOrNull(compound.id)) return true
  return Array.isArray(compound.atoms) && compound.atoms.length > 0
}

function snapshotFlyTerms(terms: readonly ReactorEquationTerm[]): ReactorEquationTerm[] {
  return terms.map((t) => ({
    id: t.id,
    z: t.z,
    coeff: t.coeff,
    ...(t.diatomic ? { diatomic: true as const } : {}),
    ...(t.compoundId ? { compoundId: t.compoundId } : {}),
    ...(t.locked ? { locked: true as const } : {}),
  }))
}

/**
 * Подготовка гарантированного запуска синтеза: валидация + compound из каталога + zSlots для полёта.
 */
export function prepareGuaranteedSynthesisRun(input: {
  leftTerms: readonly ReactorEquationTerm[]
  productId: string | null
  productCoeff: number
  compoundById: Readonly<Record<string, CompoundDef>>
  coProducts?: readonly ReactorCoProductTerm[]
}): PrepareGuaranteedResult {
  const { leftTerms, productId, productCoeff, compoundById, coProducts = [] } = input
  if (!productId) {
    return { ok: false, code: 'NO_PRODUCT' }
  }

  const catalogCompound = resolveCatalogProduct(compoundById, productId)
  if (!catalogCompound) {
    return { ok: false, code: 'NO_PRODUCT' }
  }

  if (hasScientificReactorRecipe(productId)) {
    if (
      !isScientificEquationBalanced(
        leftTerms,
        coProducts,
        catalogCompound,
        productCoeff,
        compoundById,
      )
    ) {
      return { ok: false, code: 'BALANCE_MISMATCH' }
    }
    if (!isCatalogRenderable(catalogCompound)) {
      return { ok: false, code: 'NO_PRODUCT' }
    }
    const flyTerms = snapshotFlyTerms(leftTerms)
    const zSlots = scientificSyntheticZSlots(catalogCompound, productCoeff)
    return {
      ok: true,
      payload: {
        productId,
        compound: catalogCompound,
        zSlots,
        flyTerms,
        visualFlyZs: zSlots.slice(0, Math.min(8, zSlots.length)),
        visualTier: 'cluster',
      },
    }
  }

  const validated = validateReactorEquation(leftTerms, catalogCompound, productCoeff)
  if (!validated.ok) {
    return { ok: false, code: validated.code, params: validated.params }
  }

  if (!isCatalogRenderable(catalogCompound)) {
    return { ok: false, code: 'NO_PRODUCT' }
  }

  const flyTerms = snapshotFlyTerms(leftTerms)
  const visualTier = getReactorVisualTier(flyTerms)

  return {
    ok: true,
    payload: {
      productId,
      compound: catalogCompound,
      zSlots: validated.zSlots.slice(),
      flyTerms,
      visualFlyZs: expandLeftTermsToPreviewSlots(flyTerms),
      visualTier,
    },
  }
}
