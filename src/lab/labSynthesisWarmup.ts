import type { CompoundDef } from '../types/chemistry'
import { warmupCatalogMatchWorker } from './catalogMatchWorkerClient'
import { initAtomlabCore } from '../wasm/atomlabCore'
import { ensureReactorBalanceWasmReady, warmupReactorBalanceWasm } from '../wasm/reactorBalanceWasm'
import { warmupAtomlabSynthesisGuard } from './atomlabSynthesisGuard'
import { requestPreviewLayout } from './reactorPreviewLayoutWorkerClient'
import { scheduleIdleMatch } from './labRenderGuards'
import { POPULAR_SYNTHESIS_COMPOUND_IDS } from './synthesisPrewarmPolicy'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import {
  K2CR2O7_PREVIEW_TERMS,
  warmupDichromateCoeffStress,
  warmupDichromateProductAssets,
} from './labBootStressWarmup'

/** Прогрев worker layout (WASM off main thread). */
function warmupPreviewLayoutWorker(): void {
  void requestPreviewLayout(
    [{ id: 'w', z: 8, coeff: 2, diatomic: true }],
    { coeffEditBurst: false },
  )
}

/** Типичное тяжёлое уравнение K₂Cr₂O₇ — layout + cache. */
function warmupHeavyPreviewLayout(): void {
  buildReactorPreviewAtoms(K2CR2O7_PREVIEW_TERMS, { tier: 'full' })
  buildReactorPreviewAtoms(K2CR2O7_PREVIEW_TERMS, { tier: 'lite' })
  void requestPreviewLayout(K2CR2O7_PREVIEW_TERMS, { coeffEditBurst: false })
  warmupDichromateCoeffStress()
}

let infraWarmed = false
let threeVendorPrefetched = false
let labScenePrefetched = false

/** Подгрузка three-vendor chunk до первого Canvas — убирает hitch первого кадра. */
export function prefetchLabThreeVendor(): void {
  if (threeVendorPrefetched) return
  threeVendorPrefetched = true
  void import('@react-three/fiber')
  void import('three')
  void import('@react-three/drei')
}

/** Chunk LabScene / Canvas — до первого открытия лаборатории. */
export function prefetchLabSceneChunk(): void {
  if (labScenePrefetched) return
  labScenePrefetched = true
  void import('../components/lab/LabScene')
}

/** Layout + worker для текущего уравнения (после выбора вещества / генерации). */
export function warmupReactorPreviewTerms(terms: readonly ReactorEquationTerm[]): void {
  if (terms.length < 1) return
  buildReactorPreviewAtoms(terms, { tier: 'full' })
  void requestPreviewLayout(terms, { coeffEditBurst: false })
}

export type BootWarmupProgress = {
  stage: 'wasm' | 'three' | 'dichromate' | 'lab' | 'done'
  label: string
}

/**
 * Полный прогрев для boot-splash: WASM, three/drei, stress K₂Cr₂O₇, LabScene.
 */
export async function warmupLabBootReady(
  catalog: readonly CompoundDef[],
  onProgress?: (p: BootWarmupProgress) => void,
): Promise<void> {
  onProgress?.({ stage: 'wasm', label: 'Подготовка расчётов…' })
  warmupLabSynthesisInfra(catalog)
  prefetchLabThreeVendor()
  prefetchLabSceneChunk()

  onProgress?.({ stage: 'three', label: 'Загрузка 3D-движка…' })
  await Promise.all([
    ensureReactorBalanceWasmReady().catch(() => undefined),
    import('@react-three/fiber'),
    import('three'),
    import('@react-three/drei'),
  ])

  onProgress?.({ stage: 'dichromate', label: 'Прогрев синтеза (K₂Cr₂O₇)…' })
  warmupHeavyPreviewLayout()
  // Доп. циклы rapid +/- — кэш layout до первого клика в реакторе.
  for (let round = 0; round < 3; round++) {
    warmupDichromateCoeffStress()
  }
  await warmupDichromateProductAssets().catch(() => undefined)

  onProgress?.({ stage: 'lab', label: 'Загрузка лаборатории…' })
  await import('../components/lab/LabScene')

  onProgress?.({ stage: 'done', label: 'Готово' })
}

/** Фоновый прогрев WASM, workers и layout-кэша. */
export function warmupLabSynthesisInfra(catalog: readonly CompoundDef[]): void {
  if (infraWarmed) return
  warmupCatalogMatchWorker()
  warmupReactorBalanceWasm()
  warmupAtomlabSynthesisGuard()
  void initAtomlabCore(catalog)
  void ensureReactorBalanceWasmReady()
  warmupPreviewLayoutWorker()
  scheduleIdleMatch(() => {
    prefetchLabThreeVendor()
    prefetchLabSceneChunk()
    warmupHeavyPreviewLayout()
    void requestPreviewLayout(
      [{ id: 'h', z: 1, coeff: 2 }, { id: 'o', z: 8, coeff: 1, diatomic: true }],
      { coeffEditBurst: false },
    )
  })
  infraWarmed = true
}

export function isLabSynthesisInfraWarmed(): boolean {
  return infraWarmed
}

/**
 * Дополнительный прогрев при открытии реактора / выборе продукта.
 */
export function warmupLabSynthesisReactorOpen(
  catalog: readonly CompoundDef[],
  product?: CompoundDef | null,
  previewTerms?: readonly ReactorEquationTerm[] | null,
): void {
  warmupLabSynthesisInfra(catalog)
  prefetchLabThreeVendor()
  prefetchLabSceneChunk()
  scheduleIdleMatch(() => {
    warmupHeavyPreviewLayout()
    if (previewTerms && previewTerms.length > 0) {
      warmupReactorPreviewTerms(previewTerms)
    } else if (product?.id === 'salt_k2cr2o7') {
      warmupDichromateCoeffStress()
    }
    void product?.id
  })
}

/** ID популярных веществ для фоновой GPU-очереди. */
export function getPopularSynthesisCompoundIds(): readonly string[] {
  return POPULAR_SYNTHESIS_COMPOUND_IDS
}
