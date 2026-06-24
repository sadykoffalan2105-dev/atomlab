import { compoundById } from '../../data/compounds'

export type ReactionProduct = {
  compoundId: string
  phase: 'liquid' | 'solid' | 'gas'
  coeff: number
}

export function formatFormula(id: string): string {
  return compoundById[id]?.formulaUnicode ?? id
}

export function buildEquation(leftIds: string[], products: ReactionProduct[]): string {
  const left = leftIds.map((id) => formatFormula(id)).join(' + ')
  const right = products
    .map((p) => {
      const f = formatFormula(p.compoundId)
      return p.coeff > 1 ? `${p.coeff}${f}` : f
    })
    .join(' + ')
  return `${left} → ${right}`
}

export function buildSimpleEquation(a: string, b: string, productId: string, extras?: string[]): string {
  const parts = [formatFormula(productId), ...(extras?.map(formatFormula) ?? [])]
  return `${formatFormula(a)} + ${formatFormula(b)} → ${parts.join(' + ')}`
}
