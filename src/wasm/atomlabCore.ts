/**
 * WASM catalog matcher + worker fallback.
 * Сборка: npm run wasm:build (требует emscripten).
 */
import type { LeftCatalogMatch, ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { CompoundDef } from '../types/chemistry'
import { requestCatalogMatchesFromWorker } from '../lab/catalogMatchWorkerClient'

type WasmExports = {
  catalog_match: (termsPtr: number, termsLen: number, outPtr: number, outCap: number) => number
  memory: WebAssembly.Memory
}

let wasmReady: Promise<boolean> | null = null
let wasmExports: WasmExports | null = null
let catalogCache: CompoundDef[] = []

export async function initAtomlabCore(catalog: readonly CompoundDef[]): Promise<boolean> {
  catalogCache = [...catalog]
  if (!wasmReady) {
    wasmReady = loadWasm()
  }
  return wasmReady
}

async function loadWasm(): Promise<boolean> {
  try {
    const wasmUrl = `${import.meta.env.BASE_URL || '/'}wasm/atomlab_core.wasm`.replace(/\.\//g, '/').replace(/\/+/g, '/')
    const url = wasmUrl.startsWith('http')
      ? wasmUrl
      : `${window.location.origin}${wasmUrl.startsWith('/') ? '' : '/'}${wasmUrl}`
    const res = await fetch(url)
    if (!res.ok) return false
    const buf = await res.arrayBuffer()
    const { instance } = await WebAssembly.instantiate(buf, {
      env: {
        abort: () => {
          throw new Error('wasm abort')
        },
      },
    })
    wasmExports = instance.exports as unknown as WasmExports
    return true
  } catch {
    return false
  }
}

/** WASM match или null → caller uses worker */
export async function findCatalogMatchesWasm(
  terms: readonly ReactorEquationTerm[],
  catalog: readonly CompoundDef[],
): Promise<LeftCatalogMatch[] | null> {
  if (!wasmExports && wasmReady) {
    const ok = await wasmReady
    if (!ok) return workerPromise(terms, catalog)
  }
  if (!wasmExports) return null

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
