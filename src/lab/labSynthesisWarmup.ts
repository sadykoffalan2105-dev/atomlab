import type { CompoundDef } from '../types/chemistry'
import { warmupCatalogMatchWorker } from './catalogMatchWorkerClient'
import { initAtomlabCore } from '../wasm/atomlabCore'
import { ensureReactorBalanceWasmReady, warmupReactorBalanceWasm } from '../wasm/reactorBalanceWasm'

import { clearReactorPreviewLayoutCache } from './reactorPreviewLayoutCache'

let infraWarmed = false

/** Фоновый прогрев WASM и catalog worker при входе в приложение / лабораторию. */
export function warmupLabSynthesisInfra(catalog: readonly CompoundDef[]): void {
  if (infraWarmed) return
  warmupCatalogMatchWorker()
  warmupReactorBalanceWasm()
  void initAtomlabCore(catalog)
  void ensureReactorBalanceWasmReady()
  clearReactorPreviewLayoutCache()
  infraWarmed = true
}

export function isLabSynthesisInfraWarmed(): boolean {
  return infraWarmed
}
