import {
  applySkeletonBonds,
  autoBondKitHydrogens,
  createFormulaKit,
  type OrganicGraph,
} from '../../chemistry/organic/organicGraph'
import { layoutOrganicGraph, type StereoSpec } from '../../chemistry/organic/organicLayout'
import type { OrganicBuildChallenge } from '../researchLab/organicBuildCatalog'

/** Каноническая 3D-структура из задания каталога. */
export function buildShowcaseGraph(challenge: OrganicBuildChallenge): OrganicGraph {
  let g = createFormulaKit(challenge.kit)
  g = applySkeletonBonds(g, challenge.skeleton)
  g = autoBondKitHydrogens(g)
  return layoutOrganicGraph(g, { stereo: stereoIds(g, challenge) })
}

/** Индексы эталона → id атомов набора (applySkeletonBonds берёт k-й атом элемента по порядку). */
function stereoIds(g: OrganicGraph, challenge: OrganicBuildChallenge): StereoSpec | undefined {
  const spec = challenge.skeleton
  if (!spec.stereo?.length) return undefined
  const pools = new Map<string, string[]>()
  for (const a of g.atoms) if (a.element !== 'H') pools.set(a.element, [...(pools.get(a.element) ?? []), a.id])
  const seen = new Map<string, number>()
  const ids = spec.elements.map((el) => {
    const k = seen.get(el) ?? 0
    seen.set(el, k + 1)
    return pools.get(el)?.[k] ?? ''
  })
  return spec.stereo.map(([a, b, c, d, r]) => [ids[a]!, ids[b]!, ids[c]!, ids[d]!, r] as const)
}
