/**
 * Прогрев показа «Как образуется» в лаборатории на CPU (ленивый модуль: тянет историю, модель, фазу, HUD).
 * Всё строится через кеширующие функции — боевой показ получает готовое.
 */
import { formationPlan } from '../../../../chemistry/formationPlan'
import { compoundById } from '../../../../data/compounds'
import { buildSchoolHeroModel } from '../../hero/schoolHeroModel'
import { hudCards, viewLocale } from '../FormationHud'
import { phaseLayout } from '../FormationPhaseScene'
import { formationStoryFor } from '../formationStory'

export function prewarmFormationCpu(id: string, lowPower: boolean): void {
  const c = compoundById[id]
  if (!c) return
  const story = formationStoryFor(id)
  const plan = formationPlan(id)
  const model = buildSchoolHeroModel(c)
  if (!story || !plan || !model) return
  phaseLayout(story, model, lowPower)
  hudCards(story, plan, viewLocale())
}
