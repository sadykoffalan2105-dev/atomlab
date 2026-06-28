/**
 * Off-main-thread reactor preview layout (coeff edit / large equations).
 */
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import { getReactorVisualTier } from '../chemistry/reactorVisualTier'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import type { ReactorVisualTier } from '../chemistry/reactorVisualTier'

export type ReactorPreviewLayoutWorkerRequest = {
  id: number
  terms: ReactorEquationTerm[]
}

export type ReactorPreviewLayoutWorkerResponse = {
  id: number
  tier: ReactorVisualTier
  atoms: ReactorPreviewAtom[]
}

self.onmessage = (ev: MessageEvent<ReactorPreviewLayoutWorkerRequest>) => {
  const { id, terms } = ev.data
  const tier = getReactorVisualTier(terms)
  const atoms = buildReactorPreviewAtoms(terms, { tier })
  const msg: ReactorPreviewLayoutWorkerResponse = { id, tier, atoms }
  self.postMessage(msg)
}
