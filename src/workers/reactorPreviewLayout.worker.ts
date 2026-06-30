import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import { expandLeftTermsToPreviewSlots } from '../chemistry/reactorEquationBalance'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import type { ReactorVisualTier } from '../chemistry/reactorVisualTier'
import { buildPreviewLayoutWasm } from '../wasm/reactorPreviewLayoutWasm'

export type ReactorPreviewLayoutWorkerRequest = {
  id: number
  terms: ReactorEquationTerm[]
}

export type ReactorPreviewLayoutWorkerResponse = {
  id: number
  tier: ReactorVisualTier
  atoms: ReactorPreviewAtom[]
}

self.onmessage = async (ev: MessageEvent<ReactorPreviewLayoutWorkerRequest>) => {
  const { id, terms } = ev.data
  const expected = expandLeftTermsToPreviewSlots(terms).length
  const wasmAtoms = await buildPreviewLayoutWasm(terms)
  let atoms: ReactorPreviewAtom[]
  if (wasmAtoms != null && (expected <= 0 || wasmAtoms.length === expected)) {
    atoms = wasmAtoms
  } else {
    atoms = buildReactorPreviewAtoms(terms, { tier: 'full' })
  }
  const msg: ReactorPreviewLayoutWorkerResponse = { id, tier: 'full', atoms }
  self.postMessage(msg)
}
