import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorVisualTier } from '../chemistry/reactorVisualTier'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import { getReactorVisualTier } from '../chemistry/reactorVisualTier'
import type {
  ReactorPreviewLayoutWorkerRequest,
  ReactorPreviewLayoutWorkerResponse,
} from '../workers/reactorPreviewLayout.worker'

let worker: Worker | null = null
let reqId = 0
const pending = new Map<
  number,
  { resolve: (v: { tier: ReactorVisualTier; atoms: ReactorPreviewAtom[] }) => void; reject: (e: Error) => void }
>()

function ensureWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('../workers/reactorPreviewLayout.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (ev: MessageEvent<ReactorPreviewLayoutWorkerResponse>) => {
      const { id, tier, atoms } = ev.data
      const p = pending.get(id)
      if (p) {
        pending.delete(id)
        p.resolve({ tier, atoms })
      }
    }
    worker.onerror = () => {
      for (const [, p] of pending) p.reject(new Error('reactorPreviewLayout worker error'))
      pending.clear()
      worker = null
    }
    return worker
  } catch {
    return null
  }
}

/** Sync fallback — always available. */
export function buildPreviewLayoutSync(terms: readonly ReactorEquationTerm[]): {
  tier: ReactorVisualTier
  atoms: ReactorPreviewAtom[]
} {
  const tier = getReactorVisualTier(terms)
  return { tier, atoms: buildReactorPreviewAtoms(terms, { tier }) }
}

/** Worker path for heavy equations; falls back to sync on small N or worker failure. */
export function requestPreviewLayout(
  terms: readonly ReactorEquationTerm[],
): Promise<{ tier: ReactorVisualTier; atoms: ReactorPreviewAtom[] }> {
  const atomEstimate = buildPreviewLayoutSync(terms).atoms.length
  const w = ensureWorker()
  if (!w || atomEstimate <= 12) {
    return Promise.resolve(buildPreviewLayoutSync(terms))
  }
  const id = ++reqId
  const msg: ReactorPreviewLayoutWorkerRequest = { id, terms: [...terms] }
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage(msg)
  })
}

export function terminatePreviewLayoutWorker(): void {
  worker?.terminate()
  worker = null
  pending.clear()
}
