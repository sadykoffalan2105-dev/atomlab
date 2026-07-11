import {
  applySkeletonBonds,
  autoBondKitHydrogens,
  createFormulaKit,
  type OrganicGraph,
} from '../../chemistry/organic/organicGraph'
import { layoutOrganicGraph } from '../../chemistry/organic/organicLayout'
import type { OrganicBuildChallenge } from '../researchLab/organicBuildCatalog'

/** Каноническая 3D-структура из задания каталога. */
export function buildShowcaseGraph(challenge: OrganicBuildChallenge): OrganicGraph {
  let g = createFormulaKit(challenge.kit)
  g = applySkeletonBonds(g, challenge.skeleton)
  g = autoBondKitHydrogens(g)
  return layoutOrganicGraph(g)
}
