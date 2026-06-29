import type { CompoundDef } from '../types/chemistry'
import { warmupCatalogMatchWorker } from './catalogMatchWorkerClient'
import { initAtomlabCore } from '../wasm/atomlabCore'
import { ensureReactorBalanceWasmReady, warmupReactorBalanceWasm } from '../wasm/reactorBalanceWasm'

import { requestPreviewLayout } from './reactorPreviewLayoutWorkerClient'
import { clearReactorPreviewLayoutCache } from './reactorPreviewLayoutCache'

/** Прогрев worker layout (WASM off main thread). */
function warmupPreviewLayoutWorker(): void {
  void requestPreviewLayout(
    [{ id: 'w', z: 8, coeff: 2, diatomic: true }],
    { coeffEditBurst: false },
  )
}

let infraWarmed = false

/** Фоновый прогрев WASM и catalog worker при входе в приложение / лабораторию. */
export function warmupLabSynthesisInfra(catalog: readonly CompoundDef[]): void {
  if (infraWarmed) return
  warmupCatalogMatchWorker()
  warmupReactorBalanceWasm()
  void initAtomlabCore(catalog)
  void ensureReactorBalanceWasmReady()
  warmupPreviewLayoutWorker()
  clearReactorPreviewLayoutCache()
  infraWarmed = true
}

export function isLabSynthesisInfraWarmed(): boolean {
  return infraWarmed
}
