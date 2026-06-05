/**
 * Catalog match via WASM (when built) or worker — без sync scan на main thread.
 */
import { startTransition, useEffect, useRef, useState } from 'react'
import type { LeftCatalogMatch, ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { CompoundDef } from '../types/chemistry'
import { requestCatalogMatchesFromWorker } from './catalogMatchWorkerClient'
import { findCatalogMatchesWasm, initAtomlabCore } from '../wasm/atomlabCore'

export function useCatalogAutoMatches(
  terms: readonly ReactorEquationTerm[],
  catalog: readonly CompoundDef[],
): LeftCatalogMatch[] {
  const [matches, setMatches] = useState<LeftCatalogMatch[]>([])
  const [stale, setStale] = useState<LeftCatalogMatch[]>([])
  const reqRef = useRef(0)
  const debounceRef = useRef(0)

  useEffect(() => {
    void initAtomlabCore(catalog)
  }, [catalog])

  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      const req = ++reqRef.current
      void (async () => {
        const wasmResult = await findCatalogMatchesWasm(terms, catalog)
        if (req !== reqRef.current) return
        if (wasmResult) {
          startTransition(() => {
            setMatches(wasmResult)
            setStale(wasmResult)
          })
          return
        }
        const cancel = requestCatalogMatchesFromWorker(
          [...terms],
          catalog,
          catalog.map((c) => ({ id: c.id, composition: c.composition })),
          req,
          (workerMatches) => {
            if (req !== reqRef.current) return
            startTransition(() => {
              setMatches(workerMatches)
              setStale(workerMatches)
            })
          },
        )
        return cancel
      })()
    }, 380)
    return () => window.clearTimeout(debounceRef.current)
  }, [terms, catalog])

  return matches.length > 0 ? matches : stale
}
