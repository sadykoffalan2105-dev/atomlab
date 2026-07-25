import { Clo2CinemaScene } from '../../../lab/cinema/scenes/clo2/Clo2CinemaScene'
import type { ScientificSynthesisFxProps } from '../../../lab/scientificSynthesis/types'

/**
 * Научный микромир получения диоксида хлора: 2 NaClO₂ + Cl₂ → 2 NaCl + 2 ClO₂.
 *
 * Адаптер между контрактом лаборатории (runId / onEmbryoReady / onBirthReady /
 * onComplete) и библиотекой ATOMLAB Cinema, где живёт сама раскадровка.
 */
export function Clo2ScientificSynthesisFx({
  runId = 0,
  lowPower = false,
  onEmbryoReady,
  onBirthReady,
  onComplete,
}: ScientificSynthesisFxProps) {
  return (
    <Clo2CinemaScene
      runId={runId}
      lowPower={lowPower}
      onEmbryoReady={onEmbryoReady}
      onBirthReady={onBirthReady}
      onComplete={onComplete}
    />
  )
}
