/**
 * Быстрая проверка баланса уравнения через WASM (C++ reactor_balance).
 * Fallback — TypeScript isReactorEquationBalanced.
 */
import type { CompoundDef } from '../types/chemistry'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import {
  compositionFromLeftTerms,
  compositionFromProduct,
  isReactorEquationBalanced,
} from '../chemistry/reactorEquationBalance'
import { getElementBySymbol } from '../data/elements'
import { getAtomlabWasmInstance, getAtomlabWasmInstanceSync, prefetchAtomlabWasm } from './atomlabWasmShared'

type WasmBalanceExports = {
  reactor_balance: (
    leftPtr: number,
    leftPairs: number,
    rightPtr: number,
    rightPairs: number,
  ) => number
  memory: WebAssembly.Memory
}

function getExports(): WasmBalanceExports | null {
  const inst = getAtomlabWasmInstanceSync()
  if (!inst) return null
  return inst.exports as unknown as WasmBalanceExports
}

function compositionToSortedPairs(comp: Record<string, number>): Uint16Array {
  const entries: { z: number; count: number }[] = []
  for (const [sym, raw] of Object.entries(comp)) {
    const count = Math.max(0, Math.floor(Number(raw)))
    if (count <= 0) continue
    const el = getElementBySymbol(sym)
    if (!el) continue
    entries.push({ z: el.z, count })
  }
  entries.sort((a, b) => a.z - b.z)
  const out = new Uint16Array(entries.length * 2)
  entries.forEach((e, i) => {
    out[i * 2] = e.z
    out[i * 2 + 1] = e.count
  })
  return out
}

/** Прогрев WASM-модуля (не блокирует UI). */
export function warmupReactorBalanceWasm(): void {
  prefetchAtomlabWasm()
}

/**
 * Синхронная проверка баланса, если WASM уже загружен; иначе null → TS fallback.
 */
export function tryWasmReactorBalance(
  leftTerms: readonly ReactorEquationTerm[],
  product: CompoundDef | undefined,
  productCoeff: number,
): boolean | null {
  const wasmModule = getExports()
  if (!wasmModule || !product) return null
  const left = compositionFromLeftTerms(leftTerms)
  if (!left) return null
  const pk = Math.max(0, Math.floor(productCoeff))
  if (pk <= 0) return null
  const right = compositionFromProduct(product, pk)
  const leftPairs = compositionToSortedPairs(left)
  const rightPairs = compositionToSortedPairs(right)
  if (leftPairs.length < 2 || rightPairs.length < 2) return null

  const mem = wasmModule.memory
  const needBytes = (leftPairs.length + rightPairs.length) * 2
  if (mem.buffer.byteLength < needBytes + 256) {
    return null
  }
  const view = new Uint16Array(mem.buffer)
  const leftOff = 0
  const rightOff = leftPairs.length
  view.set(leftPairs, leftOff)
  view.set(rightPairs, rightOff)
  const leftPairCount = leftPairs.length / 2
  const rightPairCount = rightPairs.length / 2
  const ok = wasmModule.reactor_balance(leftOff, leftPairCount, rightOff, rightPairCount)
  return ok === 1
}

/** Баланс с WASM fast path и TS fallback. */
export function isReactorBalancedFast(
  leftTerms: readonly ReactorEquationTerm[],
  product: CompoundDef | undefined,
  productCoeff: number,
): boolean {
  const wasm = tryWasmReactorBalance(leftTerms, product, productCoeff)
  if (wasm != null) return wasm
  return isReactorEquationBalanced(leftTerms, product, productCoeff)
}

/** Дождаться WASM для первого синтеза (фон). */
export async function ensureReactorBalanceWasmReady(): Promise<boolean> {
  const inst = await getAtomlabWasmInstance()
  return inst != null
}
