/**
 * WASM catalog matcher + worker fallback.
 * Сборка: npm run wasm:build (требует emscripten).
 */
import type { LeftCatalogMatch, ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { CompoundDef } from '../types/chemistry'
import { requestCatalogMatchesFromWorker } from '../lab/catalogMatchWorkerClient'
import { getAtomlabWasmInstance, prefetchAtomlabWasm } from './atomlabWasmShared'

type WasmExports = {
  catalog_match: (termsPtr: number, termsLen: number, outPtr: number, outCap: number) => number
  memory: WebAssembly.Memory
}

let catalogCache: CompoundDef[] = []

export async function initAtomlabCore(catalog: readonly CompoundDef[]): Promise<boolean> {
  catalogCache = [...catalog]
  prefetchAtomlabWasm()
  const inst = await getAtomlabWasmInstance()
  return inst != null
}

/** WASM match или null → caller uses worker */
export async function findCatalogMatchesWasm(
  terms: readonly ReactorEquationTerm[],
  catalog: readonly CompoundDef[],
): Promise<LeftCatalogMatch[] | null> {
  const inst = await getAtomlabWasmInstance()
  if (!inst) return workerPromise(terms, catalog)

  const _exports = inst.exports as unknown as WasmExports
  void _exports
  // WASM ABI not wired yet — use worker path (off main thread)
  return null
}

function workerPromise(
  terms: readonly ReactorEquationTerm[],
  catalog: readonly CompoundDef[],
): Promise<LeftCatalogMatch[]> {
  return new Promise((resolve) => {
    const lite = catalog.map((c) => ({ id: c.id, composition: c.composition }))
    requestCatalogMatchesFromWorker([...terms], catalog, lite, 1, resolve)
  })
}

export function getCatalogCache(): readonly CompoundDef[] {
  return catalogCache
}
