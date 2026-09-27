import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { SchoolCinemaScene } from '../school/SchoolCinemaScene'
import { N2O_SCENE_SPEC } from './n2oSpec'

/**
 * Урок «оксид азота(I)»: NH₄NO₃ →(t°) N₂O + 2H₂O — школьная сцена (Kimyo 8, § 39, с. 168). Рисует общий
 * движок scenes/school по n2oSpec.ts (ионы NH₄⁺ и NO₃⁻ → N≡N→O и две молекулы воды); тексты — specs/n2o.ts.
 */
export function N2oCinemaScene(props: ScientificSynthesisFxProps) {
  return <SchoolCinemaScene {...props} spec={N2O_SCENE_SPEC} lesson="n2o" />
}
