import type { CompoundDef } from '../types/chemistry'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import { getElementBySymbol } from '../data/elements'

export type PreviewBondMappingInput = {
  previewAtoms: ReadonlyArray<{ z: number; termIndex: number; atomInTerm: number }>
  flyTerms: readonly ReactorEquationTerm[]
  productAtoms: CompoundDef['atoms']
}

/**
 * Map product atom index → preview atom index using term order + element Z.
 * Prefer same termIndex and atomInTerm when Z matches.
 */
export function mapPreviewIndicesToProduct(
  previewZs: readonly number[],
  productAtoms: CompoundDef['atoms'],
): number[] {
  return mapPreviewIndicesToProductDetailed({
    previewAtoms: previewZs.map((z, i) => ({
      z,
      termIndex: 0,
      atomInTerm: i,
    })),
    flyTerms: [],
    productAtoms,
  })
}

export function mapPreviewIndicesToProductDetailed(input: PreviewBondMappingInput): number[] {
  const { previewAtoms, flyTerms, productAtoms } = input
  const pool = previewAtoms.map((a, i) => ({ ...a, i, used: false }))

  const termZOrder: number[] = []
  if (flyTerms.length > 0) {
    flyTerms.forEach((t, ti) => {
      const c = Math.max(0, Math.floor(t.coeff))
      for (let k = 0; k < c; k++) termZOrder.push(ti)
    })
  }

  return productAtoms.map((atom, pi) => {
    const z = getElementBySymbol(atom.symbol)?.z ?? 0
    const preferredTerm = termZOrder[pi]

    const pick = (pred: (p: (typeof pool)[0]) => boolean) => {
      const hit = pool.find((p) => !p.used && pred(p))
      if (hit) {
        hit.used = true
        return hit.i
      }
      return -1
    }

    if (preferredTerm != null) {
      const exact = pick(
        (p) => p.z === z && p.termIndex === preferredTerm && p.atomInTerm === pi,
      )
      if (exact >= 0) return exact
      const termHit = pick((p) => p.z === z && p.termIndex === preferredTerm)
      if (termHit >= 0) return termHit
    }

    const zHit = pick((p) => p.z === z)
    if (zHit >= 0) return zHit

    const fb = pick(() => true)
    return fb >= 0 ? fb : 0
  })
}
