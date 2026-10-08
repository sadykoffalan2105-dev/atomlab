/** Реестр сцен «Как образуется» в реакторе: id пути → модель (чистая) + сцена (3D). Тексты — texts/co2Routes.ts. */
import type { ComponentType } from 'react'
import type { RouteModel } from './geom'
import type { ReactorRouteId } from './routeIndex'
import { co2CombustionModel } from './models/co2Combustion'
import { co2AcidModel } from './models/co2Acid'
import { co2CalcinationModel } from './models/co2Calcination'
import { Co2CombustionScene } from './scenes/Co2CombustionScene'
import { Co2AcidScene } from './scenes/Co2AcidScene'
import { Co2CalcinationScene } from './scenes/Co2CalcinationScene'
import type { RouteSceneProps } from './scenes/common'

export const ROUTE_SCENES: Record<ReactorRouteId, { model: () => RouteModel; Scene: ComponentType<RouteSceneProps> }> = {
  'co2-combustion': { model: co2CombustionModel, Scene: Co2CombustionScene },
  'co2-acid': { model: co2AcidModel, Scene: Co2AcidScene },
  'co2-calcination': { model: co2CalcinationModel, Scene: Co2CalcinationScene },
}
