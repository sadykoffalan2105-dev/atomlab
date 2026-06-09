import {
  findCatalogMatchesForLeftTerms,
  type LeftCatalogMatch,
} from '../chemistry/reactorEquationBalance'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { CompoundDef } from '../types/chemistry'
import { scheduleIdleMatch } from './labRenderGuards'
import { CATALOG_MATCH_WORKER_TIMEOUT_MS } from './synthesisHangGuard'
import type { CatalogLite, CatalogMatchWorkerIn, CatalogMatchWorkerOut } from '../workers/catalogMatch.worker'

let worker: Worker | null = null

function resetWorker(): void {
  if (worker) {
    try {
      worker.terminate()
    } catch {
      /* ignore */
    }
    worker = null
  }
}

/** Создать worker заранее — первый синтез не ждёт инициализацию. */
export function warmupCatalogMatchWorker(): void {
  getWorker()
}

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (!worker) {
    try {
      worker = new Worker(new URL('../workers/catalogMatch.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      worker = null
    }
  }
  return worker
}

/**
 * Совпадения каталога в Web Worker (освобождает main thread при большом каталоге).
 * При недоступности Worker или таймауте — отложенный fallback на главном потоке.
 */
export function requestCatalogMatchesFromWorker(
  terms: ReactorEquationTerm[],
  catalog: readonly CompoundDef[],
  catalogLite: readonly CatalogLite[],
  req: number,
  onResult: (matches: LeftCatalogMatch[]) => void,
): () => void {
  const w = getWorker()
  if (!w) {
    scheduleIdleMatch(() => onResult(findCatalogMatchesForLeftTerms(terms, catalog)))
    return () => {}
  }

  let settled = false

  const finish = (matches: LeftCatalogMatch[]) => {
    if (settled) return
    settled = true
    window.clearTimeout(timeoutId)
    w.removeEventListener('message', handler)
    onResult(matches)
  }

  const fallbackSync = () => {
    scheduleIdleMatch(() => finish(findCatalogMatchesForLeftTerms(terms, catalog)))
  }

  const handler = (ev: MessageEvent<CatalogMatchWorkerOut>) => {
    if (ev.data.req !== req) return
    const byId: Record<string, CompoundDef> = {}
    for (const c of catalog) byId[c.id] = c
    const matches: LeftCatalogMatch[] = []
    for (const m of ev.data.matches) {
      const compound = byId[m.id]
      if (compound) matches.push({ compound, k: m.k })
    }
    finish(matches)
  }

  const timeoutId = window.setTimeout(() => {
    if (settled) return
    resetWorker()
    fallbackSync()
  }, CATALOG_MATCH_WORKER_TIMEOUT_MS)

  w.addEventListener('message', handler)
  const payload: CatalogMatchWorkerIn = { req, terms, catalog: [...catalogLite] }
  w.postMessage(payload)

  return () => {
    if (settled) return
    settled = true
    window.clearTimeout(timeoutId)
    w.removeEventListener('message', handler)
  }
}
