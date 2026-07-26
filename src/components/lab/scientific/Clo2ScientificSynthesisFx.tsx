import { Clo2CinemaScene } from '../../../lab/cinema/scenes/clo2/Clo2CinemaScene'
import type { Clo2CueId } from '../../../lab/cinema/scenes/clo2/storyboard'
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
  teacherMode = false,
  onNarrationCue,
  onEmbryoReady,
  onBirthReady,
  onComplete,
}: ScientificSynthesisFxProps) {
  return (
    <Clo2CinemaScene
      runId={runId}
      lowPower={lowPower}
      teacherMode={teacherMode}
      onNarrationCue={onNarrationCue as ((id: Clo2CueId) => void) | undefined}
      onEmbryoReady={onEmbryoReady}
      onBirthReady={onBirthReady}
      onComplete={onComplete}
    />
  )
}
