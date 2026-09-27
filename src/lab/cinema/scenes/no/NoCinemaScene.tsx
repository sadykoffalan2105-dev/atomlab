import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { SchoolCinemaScene } from '../school/SchoolCinemaScene'
import { NO_SCENE_SPEC } from './noSpec'

/**
 * Урок «оксид азота(II)»: N₂ + O₂ → 2NO — школьная сцена образования молекулы (Kimyo 7, § 4.5, с. 95;
 * § 2.13, с. 71). Рисует общий движок scenes/school по noSpec.ts; тексты — научная спецификация specs/no.ts.
 */
export function NoCinemaScene(props: ScientificSynthesisFxProps) {
  return <SchoolCinemaScene {...props} spec={NO_SCENE_SPEC} lesson="no" />
}
