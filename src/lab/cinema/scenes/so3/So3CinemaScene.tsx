import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { SchoolCinemaScene } from '../school/SchoolCinemaScene'
import { SO3_SCHOOL_SPEC } from './so3Spec'

/**
 * Урок «серный ангидрид»: 2SO₂ + O₂ ⇄ 2SO₃ (t, V₂O₅) — школьная сцена образования молекулы
 * (Kimyo 7, с. 96; Kimyo 8, с. 136). Связи S=O молекул SO₂ сохраняются, рвётся только O=O.
 */
export function So3CinemaScene(props: ScientificSynthesisFxProps) {
  return <SchoolCinemaScene {...props} spec={SO3_SCHOOL_SPEC} lesson="so3" />
}
