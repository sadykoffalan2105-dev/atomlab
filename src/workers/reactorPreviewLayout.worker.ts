/**
 * Off-main-thread reactor preview layout (coeff edit / large equations).
 * Uses C++ WASM when available.
 */
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
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
  const wasmAtoms = await buildPreviewLayoutWasm(terms)
  const atoms = wasmAtoms ?? buildReactorPreviewAtoms(terms, { tier: 'full' })
  const msg: ReactorPreviewLayoutWorkerResponse = { id, tier: 'full', atoms }
  self.postMessage(msg)
}
