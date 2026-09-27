import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { SchoolCinemaScene } from '../school/SchoolCinemaScene'
import { SO2_SCHOOL_SPEC } from './so2Spec'

/**
 * Урок «горение серы»: S + O₂ → SO₂ — школьная сцена образования молекулы (Kimyo 7, § 4.5, с. 95).
 * Сцену рисует общий движок scenes/school по спецификации so2Spec.ts (химия и тексты — school/specs/so2.ts).
 */
export function So2CinemaScene(props: ScientificSynthesisFxProps) {
  return <SchoolCinemaScene {...props} spec={SO2_SCHOOL_SPEC} lesson="so2" />
}
