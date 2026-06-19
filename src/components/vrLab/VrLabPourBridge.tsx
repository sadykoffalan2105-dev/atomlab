import { useMemo } from 'react'
import { substanceVisual } from '../../vrLab/substanceVisuals'
import type { VrLabShelfFlask } from '../../vrLab/types'
import { PourStreamRibbon } from './liquid/PourStreamRibbon'
import { liquidVisualFromContent, type LiquidVisual } from './VrLabLiquid'

const FLASK_SCALE_SHELF = 0.4
const FLASK_SCALE_BENCH = 0.52

function resolvePourVisual(
  flask: VrLabShelfFlask | undefined,
  compoundId: string | null,
): LiquidVisual | null {
  if (flask?.content) return liquidVisualFromContent(flask.content)
  if (compoundId) return substanceVisual(compoundId)
  return null
}

/** Мировая струя: колба → чан (или точка на столе). */
export function VrLabPourBridge({
  flask,
  target,
  progress,
  compoundId,
}: {
  flask: VrLabShelfFlask | undefined
  target: [number, number, number]
  progress: number
  compoundId: string | null
}) {
  const visual = useMemo(
    () => resolvePourVisual(flask, compoundId),
    [compoundId, flask],
  )

  const from = useMemo((): [number, number, number] => {
    if (!flask) return [0, 0.2, 0]
    const scale = flask.onShelf ? FLASK_SCALE_SHELF : FLASK_SCALE_BENCH
    const tilt = Math.min(0.55, progress * 0.7)
    return [
      flask.position[0] + tilt * 0.04,
      flask.position[1] + scale * 0.15,
      flask.position[2] + 0.02,
    ]
  }, [flask, progress])

  const to = useMemo((): [number, number, number] => {
    return [target[0], target[1] + 0.28, target[2]]
  }, [target])

  if (!visual || !flask) return null

  return (
    <PourStreamRibbon
      active
      visual={visual}
      from={from}
      to={to}
      progress={progress}
      arc={0.14}
      radius={0.011}
    />
  )
}
