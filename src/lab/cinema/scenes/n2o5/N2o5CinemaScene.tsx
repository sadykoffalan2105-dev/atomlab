import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { SchoolCinemaScene } from '../school/SchoolCinemaScene'
import { N2O5_SCENE_SPEC } from './n2o5Spec'

/**
 * Урок «оксид азота(V)»: N₂O₅ + H₂O → 2HNO₃ — школьная сцена (Kimyo 7, § 6.4, с. 139). Продукт — азотная
 * кислота (ключ реестра hno3 с сигнатурой N₂O₅ + H₂O), урок относится к N₂O₅. Движок scenes/school,
 * кадр — n2o5Spec.ts, тексты — specs/n2o5.ts.
 */
export function N2o5CinemaScene(props: ScientificSynthesisFxProps) {
  return <SchoolCinemaScene {...props} spec={N2O5_SCENE_SPEC} lesson="n2o5" />
}
