import { getElementBySymbol } from '../data/elements'
import type { CompoundDef } from '../types/chemistry'

/** Сопоставление индексов превью-атомов (z) с атомами продукта по символу. */
export function mapPreviewIndicesToProduct(
  previewZs: readonly number[],
  productAtoms: CompoundDef['atoms'],
): number[] {
  const pool = previewZs.map((z, i) => ({ z, i, used: false }))
  return productAtoms.map((atom) => {
    const z = getElementBySymbol(atom.symbol)?.z
    const hit = pool.find((p) => !p.used && (z == null || p.z === z))
    if (hit) {
      hit.used = true
      return hit.i
    }
    const fallback = pool.find((p) => !p.used)
    if (fallback) {
      fallback.used = true
      return fallback.i
    }
    return 0
  })
}
