/**
 * C++/WASM preview layout — symmetric atom positions off main thread.
 */
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import { getAtomlabWasmInstance } from './atomlabWasmShared'

type PreviewLayoutExports = {
  reactor_preview_layout: (
    termsPtr: number,
    termCount: number,
    outPtr: number,
    outCap: number,
  ) => number
  memory: WebAssembly.Memory
}

function packTerms(terms: readonly ReactorEquationTerm[]): Uint8Array {
  const active = terms.filter((t) => Math.floor(t.coeff) > 0)
  const buf = new Uint8Array(active.length * 3)
  active.forEach((t, i) => {
    buf[i * 3] = t.z
    buf[i * 3 + 1] = Math.max(0, Math.min(255, Math.floor(t.coeff)))
    buf[i * 3 + 2] = t.diatomic ? 1 : 0
  })
  return buf
}

function layoutFromWasm(
  exports: PreviewLayoutExports,
  terms: readonly ReactorEquationTerm[],
): ReactorPreviewAtom[] | null {
  const active = terms.filter((t) => Math.floor(t.coeff) > 0)
  if (active.length === 0) return []
  const maxAtoms = active.reduce((s, t) => s + Math.max(0, Math.floor(t.coeff)), 0)
  if (maxAtoms <= 0) return []

  const mem = exports.memory
  const packed = packTerms(terms)
  const termsPtr = 0
  const outFloats = maxAtoms * 6
  const outPtr = 4096
  const needBytes = outPtr + outFloats * 4
  if (mem.buffer.byteLength < needBytes) {
    try {
      mem.grow(Math.ceil((needBytes - mem.buffer.byteLength) / 65536))
    } catch {
      return null
    }
  }
  new Uint8Array(mem.buffer).set(packed, termsPtr)
  const count = exports.reactor_preview_layout(termsPtr, active.length, outPtr, maxAtoms)
  if (count < 0) return null

  const floats = new Float32Array(mem.buffer, outPtr, count * 6)
  const out: ReactorPreviewAtom[] = []
  for (let i = 0; i < count; i++) {
    const base = i * 6
    out.push({
      z: Math.round(floats[base + 3]!),
      pos: [floats[base]!, floats[base + 1]!, floats[base + 2]!],
      termIndex: Math.round(floats[base + 4]!),
      atomInTerm: Math.round(floats[base + 5]!),
    })
  }
  const expected = maxAtoms
  if (expected > 0 && out.length !== expected) return null
  return out
}

/** WASM layout or null → caller uses TS fallback. */
export async function buildPreviewLayoutWasm(
  terms: readonly ReactorEquationTerm[],
): Promise<ReactorPreviewAtom[] | null> {
  const inst = await getAtomlabWasmInstance()
  if (!inst) return null
  const exp = inst.exports as unknown as PreviewLayoutExports
  if (typeof exp.reactor_preview_layout !== 'function') return null
  return layoutFromWasm(exp, terms)
}

export function buildPreviewLayoutWasmSync(
  terms: readonly ReactorEquationTerm[],
): ReactorPreviewAtom[] {
  return buildReactorPreviewAtoms(terms, { tier: 'full' })
}
