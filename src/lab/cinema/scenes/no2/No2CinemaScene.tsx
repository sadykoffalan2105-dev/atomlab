import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { SchoolCinemaScene } from '../school/SchoolCinemaScene'
import { NO2_SCENE_SPEC } from './no2Spec'

/**
 * Урок «оксид азота(IV)»: 2NO + O₂ → 2NO₂ — школьная сцена образования молекулы (Kimyo 7, § 4.5, с. 96;
 * § 2.13, с. 71). Рисует общий движок scenes/school по no2Spec.ts; тексты — научная спецификация specs/no2.ts.
 */
export function No2CinemaScene(props: ScientificSynthesisFxProps) {
  return <SchoolCinemaScene {...props} spec={NO2_SCENE_SPEC} lesson="no2" />
}
