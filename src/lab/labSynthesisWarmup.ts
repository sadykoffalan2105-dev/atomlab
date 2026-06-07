import type { CompoundDef } from '../types/chemistry'
import { warmupCatalogMatchWorker } from './catalogMatchWorkerClient'
import { scheduleIdleMatch } from './labRenderGuards'
import { initAtomlabCore } from '../wasm/atomlabCore'

let infraWarmed = false

/** Фоновый прогрев WASM и catalog worker при входе в лабораторию. */
export function warmupLabSynthesisInfra(catalog: readonly CompoundDef[]): void {
  if (infraWarmed) return
  infraWarmed = true
  scheduleIdleMatch(() => {
    void initAtomlabCore(catalog)
    warmupCatalogMatchWorker()
  })
}
