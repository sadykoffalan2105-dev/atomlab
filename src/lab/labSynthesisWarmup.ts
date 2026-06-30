import type { CompoundDef } from '../types/chemistry'
import { warmupCatalogMatchWorker } from './catalogMatchWorkerClient'
import { initAtomlabCore } from '../wasm/atomlabCore'
import { ensureReactorBalanceWasmReady, warmupReactorBalanceWasm } from '../wasm/reactorBalanceWasm'
import { requestPreviewLayout } from './reactorPreviewLayoutWorkerClient'
import { clearReactorPreviewLayoutCache } from './reactorPreviewLayoutCache'
import { scheduleIdleMatch } from './labRenderGuards'
import { POPULAR_SYNTHESIS_COMPOUND_IDS } from './synthesisPrewarmPolicy'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'

/** Прогрев worker layout (WASM off main thread). */
function warmupPreviewLayoutWorker(): void {
  void requestPreviewLayout(
    [{ id: 'w', z: 8, coeff: 2, diatomic: true }],
    { coeffEditBurst: false },
  )
}

/** Типичное тяжёлое уравнение K₂Cr₂O₇ — layout + cache. */
function warmupHeavyPreviewLayout(): void {
  const terms: ReactorEquationTerm[] = [
    { id: 'cr', z: 24, coeff: 4 },
    { id: 'k', z: 19, coeff: 4 },
    { id: 'o2', z: 8, coeff: 7, diatomic: true },
  ]
  buildReactorPreviewAtoms(terms, { tier: 'full' })
  void requestPreviewLayout(terms, { coeffEditBurst: false })
}

let infraWarmed = false

/** Фоновый прогрев WASM, workers и layout-кэша. */
export function warmupLabSynthesisInfra(catalog: readonly CompoundDef[]): void {
  if (infraWarmed) return
  warmupCatalogMatchWorker()
  warmupReactorBalanceWasm()
  void initAtomlabCore(catalog)
  void ensureReactorBalanceWasmReady()
  warmupPreviewLayoutWorker()
  scheduleIdleMatch(() => {
    warmupHeavyPreviewLayout()
    void requestPreviewLayout(
      [{ id: 'h', z: 1, coeff: 2 }, { id: 'o', z: 8, coeff: 1, diatomic: true }],
      { coeffEditBurst: false },
    )
  })
  clearReactorPreviewLayoutCache()
  infraWarmed = true
}

export function isLabSynthesisInfraWarmed(): boolean {
  return infraWarmed
}

/** ID популярных веществ для фоновой GPU-очереди. */
export function getPopularSynthesisCompoundIds(): readonly string[] {
  return POPULAR_SYNTHESIS_COMPOUND_IDS
}
