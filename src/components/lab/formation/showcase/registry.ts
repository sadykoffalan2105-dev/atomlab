/**
 * Реестр сцен showcase: id вещества → компонент сцены. Вещества без сцены показываются как раньше.
 * Добавить вещество: scenes/<id>.tsx (сцена), texts/<id>.ts (тексты) + строка здесь и в texts/index.ts,
 * длительности — durations.ts. См. README.md.
 */
import type { ShowcaseId, ShowcaseScene } from './types'
import { H2OScene } from './scenes/h2o'
import { CO2Scene } from './scenes/co2'
import { SiO2Scene } from './scenes/sio2'

const SCENES: Partial<Record<ShowcaseId, ShowcaseScene>> = {
  h2o: H2OScene,
  co2: CO2Scene,
  sio2: SiO2Scene,
}

export function showcaseSceneFor(id: string): ShowcaseScene | null {
  return SCENES[id as ShowcaseId] ?? null
}
