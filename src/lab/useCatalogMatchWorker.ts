import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { findCatalogMatchesForLeftTerms, type LeftCatalogMatch } from '../chemistry/reactorEquationBalance'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { CompoundDef } from '../types/chemistry'
import { requestCatalogMatchesFromWorker } from './catalogMatchWorkerClient'

/**
 * Тяжёлый перебор каталога — в Worker с синхронным fallback; пока нет ответа — sync-оценка на main.
 */
export function useCatalogAutoMatches(
  terms: readonly ReactorEquationTerm[],
  catalog: readonly CompoundDef[],
): LeftCatalogMatch[] {
  const catalogLite = useMemo(
    () => catalog.map((c) => ({ id: c.id, composition: c.composition })),
    [catalog],
  )

  const syncMatches = useMemo(
    () => findCatalogMatchesForLeftTerms(terms, catalog),
    [terms, catalog],
  )

  const [workerMatches, setWorkerMatches] = useState<LeftCatalogMatch[] | null>(null)
  const reqRef = useRef(0)

  useEffect(() => {
    queueMicrotask(() => setWorkerMatches(null))
    const req = ++reqRef.current
    const cancel = requestCatalogMatchesFromWorker(
      [...terms],
      catalog,
      catalogLite,
      req,
      (matches) => {
        if (req !== reqRef.current) return
        startTransition(() => setWorkerMatches(matches))
      },
    )
    return cancel
  }, [terms, catalog, catalogLite])

  return workerMatches ?? syncMatches
}
