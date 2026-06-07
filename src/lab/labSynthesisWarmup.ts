import type { CompoundDef } from '../types/chemistry'
import { warmupCatalogMatchWorker } from './catalogMatchWorkerClient'
import { initAtomlabCore } from '../wasm/atomlabCore'
import { warmupReactorBalanceWasm } from '../wasm/reactorBalanceWasm'

let infraWarmed = false

/** Фоновый прогрев WASM и catalog worker при входе в лабораторию. */
export function warmupLabSynthesisInfra(catalog: readonly CompoundDef[]): void {
  if (infraWarmed) return
  infraWarmed = true
  void initAtomlabCore(catalog)
  warmupCatalogMatchWorker()
  warmupReactorBalanceWasm()
}
