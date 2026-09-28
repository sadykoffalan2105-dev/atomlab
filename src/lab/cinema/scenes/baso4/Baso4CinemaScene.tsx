import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { SchoolCinemaScene } from '../school/SchoolCinemaScene'
import type { SchoolSceneFactory } from '../school/schoolRuntime'
import { SolutionExchangeScene } from '../school/solution/SolutionExchangeScene'
import { BASO4_SOLUTION_SPEC } from '../school/solution/solutionSpec'

/**
 * Урок «белый осадок»: BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl — школьная сцена «на уровне частиц» (Kimyo 7, гл. II,
 * тема 12, с. 67 — признак реакции «осадок»; 8 кл. § 32, с. 138–139; 9 кл. § 6, с. 28–31).
 * Ионы в воде, H₃O⁺, сульфат-ион тетраэдром, рост кристаллика барита; химия — school/specs/baso4.ts.
 */
const createBaso4: SchoolSceneFactory = (opts) => new SolutionExchangeScene(BASO4_SOLUTION_SPEC, opts)

export function Baso4CinemaScene(props: ScientificSynthesisFxProps) {
  return <SchoolCinemaScene {...props} create={createBaso4} lesson="baso4" />
}
