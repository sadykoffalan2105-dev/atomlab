import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorVisualTier } from '../chemistry/reactorVisualTier'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'

const MAX = 48
const cache = new Map<string, ReactorPreviewAtom[]>()

function signature(terms: readonly ReactorEquationTerm[], tier: ReactorVisualTier): string {
  if (!terms.length) return ''
  const body = terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|')
  return `${tier}::${body}`
}

export function getCachedPreviewAtoms(
  terms: readonly ReactorEquationTerm[],
  tier: ReactorVisualTier,
  build: () => ReactorPreviewAtom[],
): ReactorPreviewAtom[] {
  const key = signature(terms, tier)
  const hit = cache.get(key)
  if (hit) return hit
  const built = build()
  if (cache.size >= MAX) {
    const first = cache.keys().next().value
    if (first) cache.delete(first)
  }
  cache.set(key, built)
  return built
}

export function clearReactorPreviewLayoutCache(): void {
  cache.clear()
}
