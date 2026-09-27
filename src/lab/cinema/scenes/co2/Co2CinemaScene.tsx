import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { SchoolCinemaScene } from '../school/SchoolCinemaScene'
import { CO2_SCHOOL_SPEC } from './co2Spec'

/**
 * Урок «горение угля»: C + O₂ → CO₂ — школьная сцена образования молекулы (Kimyo 7, § 4.5, с. 95).
 * Сцену рисует общий движок scenes/school по спецификации co2Spec.ts (химия и тексты — school/specs/co2.ts).
 */
export function Co2CinemaScene(props: ScientificSynthesisFxProps) {
  return <SchoolCinemaScene {...props} spec={CO2_SCHOOL_SPEC} lesson="co2" />
}
