import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorVisualTier } from '../chemistry/reactorVisualTier'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import type {
  ReactorPreviewLayoutWorkerRequest,
  ReactorPreviewLayoutWorkerResponse,
} from '../workers/reactorPreviewLayout.worker'
import { REACTOR_PREVIEW_LAYOUT_WORKER_TIMEOUT_MS } from './synthesisHangGuard'

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

function estimatePreviewAtomCount(terms: readonly ReactorEquationTerm[]): number {
  let n = 0
  for (const t of terms) {
    const c = Math.floor(t.coeff)
    if (c > 0) n += c
  }
  return n
}

/** Sync fallback — always available. */
export function buildPreviewLayoutSync(terms: readonly ReactorEquationTerm[]): {
  tier: ReactorVisualTier
  atoms: ReactorPreviewAtom[]
} {
  const tier = 'full' as ReactorVisualTier
  return { tier, atoms: buildReactorPreviewAtoms(terms, { tier }) }
}

let latestRequestId = 0

/** Worker path for heavy equations; falls back to sync on small N, burst, timeout or worker failure. */
export function requestPreviewLayout(
  terms: readonly ReactorEquationTerm[],
  opts?: { coeffEditBurst?: boolean },
): Promise<{ tier: ReactorVisualTier; atoms: ReactorPreviewAtom[] }> {
  const atomEstimate = estimatePreviewAtomCount(terms)
  const burst = opts?.coeffEditBurst === true
  /** При burst — только sync на main thread (стабильность +/- важнее offload). */
  if (burst) {
    return Promise.resolve(buildPreviewLayoutSync(terms))
  }
  const workerThreshold = 6
  const w = ensureWorker()
  if (!w || atomEstimate <= workerThreshold) {
    return Promise.resolve(buildPreviewLayoutSync(terms))
  }
  const id = ++reqId
  latestRequestId = id
  const msg: ReactorPreviewLayoutWorkerRequest = { id, terms: [...terms] }
  return new Promise((resolve) => {
    let settled = false
    const finish = (v: { tier: ReactorVisualTier; atoms: ReactorPreviewAtom[] }) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      pending.delete(id)
      if (id !== latestRequestId) return
      resolve(v)
    }
    const timeoutId = globalThis.setTimeout(() => {
      finish(buildPreviewLayoutSync(terms))
    }, REACTOR_PREVIEW_LAYOUT_WORKER_TIMEOUT_MS)
    pending.set(id, {
      resolve: (v) => finish(v),
      reject: () => finish(buildPreviewLayoutSync(terms)),
    })
    try {
      w.postMessage(msg)
    } catch {
      finish(buildPreviewLayoutSync(terms))
    }
  })
}

export function terminatePreviewLayoutWorker(): void {
  worker?.terminate()
  worker = null
  pending.clear()
}
