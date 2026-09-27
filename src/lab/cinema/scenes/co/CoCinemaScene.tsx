import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { SchoolCinemaScene } from '../school/SchoolCinemaScene'
import { CO_SCHOOL_SPEC } from './coSpec'

/**
 * Урок «угарный газ»: 2C + O₂ → 2CO — школьная сцена образования молекулы (Kimyo 7, § 2.12, с. 69).
 * Тройная связь C≡O: две обменные пары и донорно-акцепторная пара кислорода (school/specs/co.ts).
 */
export function CoCinemaScene(props: ScientificSynthesisFxProps) {
  return <SchoolCinemaScene {...props} spec={CO_SCHOOL_SPEC} lesson="co" />
}
