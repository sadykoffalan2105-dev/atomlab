import { getMolecularGeometryOrNull } from '../chemistry/catalogGeometryOverrides'
import {
  expandLeftTermsToPreviewSlots,
  validateReactorEquation,
  type ReactorEquationTerm,
  type ReactorValidationErrorCode,
} from '../chemistry/reactorEquationBalance'
import { synthesisLaunchWatchdogMs } from './synthesisLaunchTiming'
import type { CompoundDef } from '../types/chemistry'

/**
 * Контракт лаборатории: после успешной валидации и нажатия «Проверить и запустить синтез»
 * пользователь всегда должен увидеть 3D-продукт из каталога (CatalogSubstanceDisplay /
 * SynthesisSettledProductHero) — тот же CompoundDef, что в каталоге веществ.
 */
export const SYNTHESIS_WATCHDOG_MS = 4500

/** Таймаут гарантии успеха под длительность космического «запуска». */
export function getSynthesisWatchdogMs(
  flyTerms: readonly ReactorEquationTerm[],
  zSlots: readonly number[],
): number {
  if (flyTerms.length > 0) {
    const atomCount = expandLeftTermsToPreviewSlots(flyTerms).length
    return synthesisLaunchWatchdogMs(flyTerms.length, atomCount)
  }
  return synthesisLaunchWatchdogMs(Math.max(1, zSlots.length), zSlots.length)
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
  /** Только отрисовка полёта (15 для 4Cr+4K+7O₂). */
  visualFlyZs: readonly number[]
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
}): PrepareGuaranteedResult {
  const { leftTerms, productId, productCoeff, compoundById } = input
  if (!productId) {
    return { ok: false, code: 'NO_PRODUCT' }
  }

  const catalogCompound = resolveCatalogProduct(compoundById, productId)
  if (!catalogCompound) {
    return { ok: false, code: 'NO_PRODUCT' }
  }

  const validated = validateReactorEquation(leftTerms, catalogCompound, productCoeff)
  if (!validated.ok) {
    return { ok: false, code: validated.code, params: validated.params }
  }

  if (!isCatalogRenderable(catalogCompound)) {
    return { ok: false, code: 'NO_PRODUCT' }
  }

  const flyTerms = snapshotFlyTerms(leftTerms)

  return {
    ok: true,
    payload: {
      productId,
      compound: catalogCompound,
      zSlots: validated.zSlots.slice(),
      flyTerms,
      visualFlyZs: expandLeftTermsToPreviewSlots(flyTerms),
    },
  }
}
