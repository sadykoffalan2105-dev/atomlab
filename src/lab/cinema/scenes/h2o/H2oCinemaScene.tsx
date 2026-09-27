import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { SchoolCinemaScene } from '../school/SchoolCinemaScene'
import { H2O_SPEC } from './h2oSpec'

/**
 * Урок «вода»: 2H₂ + O₂ → 2H₂O — школьная сцена образования молекулы (Kimyo 7, § 4.5, с. 95).
 * Сцену рисует общий движок scenes/school по спецификации h2oSpec.ts; тексты — h2oMechanismText.*.
 */
export function H2oCinemaScene(props: ScientificSynthesisFxProps) {
  return <SchoolCinemaScene {...props} spec={H2O_SPEC} lesson="h2o" />
}
