import type { LiquidVisual } from '../VrLabLiquid'
import { PourStreamShader, PourStreamShaderLocal } from './PourStreamShader'

type Props = {
  active: boolean
  visual: LiquidVisual
  from: [number, number, number]
  to: [number, number, number]
  progress: number
  flowRate?: number
  arc?: number
  radius?: number
}

/** Струя переливания — шейдерная лента (legacy API). */
export function PourStreamRibbon(props: Props) {
  return <PourStreamShader {...props} />
}

export function PourStreamLocal({
  active,
  visual,
  progress,
  tiltMix = 0,
}: {
  active: boolean
  visual: LiquidVisual
  progress: number
  tiltMix?: number
}) {
  return (
    <PourStreamShaderLocal active={active} visual={visual} progress={progress} tiltMix={tiltMix} />
  )
}

export { PourStreamShader }
