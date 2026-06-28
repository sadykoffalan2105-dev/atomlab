/**
 * WASM preview layout hook — delegates to TS worker when WASM layout export unavailable.
 */
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import { buildPreviewLayoutSync, requestPreviewLayout } from '../lab/reactorPreviewLayoutWorkerClient'

export function warmupReactorPreviewWasm(): void {
  /* layout uses worker; WASM balance already warmed separately */
}

export async function buildPreviewLayoutAsync(terms: readonly ReactorEquationTerm[]) {
  return requestPreviewLayout(terms)
}

export function buildPreviewLayoutFast(terms: readonly ReactorEquationTerm[]) {
  return buildPreviewLayoutSync(terms)
}
