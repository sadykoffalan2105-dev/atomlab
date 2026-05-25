/// <reference lib="webworker" />

import {
  compositionFromLeftTerms,
  filterCatalogCandidatesForLeft,
  findMatchingProductCoeff,
} from '../chemistry/reactorEquationBalance'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { CompoundDef } from '../types/chemistry'

export type CatalogLite = Pick<CompoundDef, 'id' | 'composition'>

export type CatalogMatchWorkerIn = {
  req: number
  terms: ReactorEquationTerm[]
  catalog: CatalogLite[]
}

export type CatalogMatchWorkerOut = {
  req: number
  matches: { id: string; k: number }[]
}

self.onmessage = (ev: MessageEvent<CatalogMatchWorkerIn>) => {
  const { req, terms, catalog } = ev.data
  const left = compositionFromLeftTerms(terms)
  if (!left || Object.keys(left).length === 0) {
    const out: CatalogMatchWorkerOut = { req, matches: [] }
    ;(self as DedicatedWorkerGlobalScope).postMessage(out)
    return
  }
  const candidates = filterCatalogCandidatesForLeft(left, catalog as CompoundDef[])
  const matches: { id: string; k: number }[] = []
  for (const c of candidates) {
    const k = findMatchingProductCoeff(left, c as CompoundDef)
    if (k != null) matches.push({ id: c.id, k })
  }
  const out: CatalogMatchWorkerOut = { req, matches }
  ;(self as DedicatedWorkerGlobalScope).postMessage(out)
}
