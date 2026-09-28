import { useMemo } from 'react'
import type { CompoundDef } from '../../../types/chemistry'
import { CatalogSubstanceDisplay } from '../CatalogSubstanceDisplay'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from '../catalogMoleculeHeroShared'
import { HERO_FIT_RADIUS } from './heroFrame'
import { buildSchoolHeroModel } from './schoolHeroModel'
import { SchoolMoleculeView } from './SchoolMoleculeView'

/**
 * Герой продукта в лаборатории — единый школьный вид (SchoolMoleculeView), тот же, что в карточке
 * каталога и в конце школьной сцены: кристаллы heroStructures (решётка из целых ячеек), молекулы
 * школьных сцен (координаты и кратность связей сцены), молекулы по ядру и все прочие вещества по
 * геометрии каталога. Каталожная модель со «стеклом» остаётся только запасным путём для вещества,
 * у которого нет ни одного атома из ядра.
 */
export function ProductHero({
  compound,
  showLabels,
  lowPower = false,
  chaoticWobble = false,
  handoff = false,
}: {
  compound: CompoundDef
  /** DOM-подписи (символы в шарах): только когда герой в кадре — не на прогреве и не зародышем */
  showLabels: boolean
  lowPower?: boolean
  chaoticWobble?: boolean
  /** слот героя, на который сцена урока заявила передачу кадра (hero/heroHandoff) */
  handoff?: boolean
}) {
  const model = useMemo(() => buildSchoolHeroModel(compound), [compound])
  if (model) {
    return <SchoolMoleculeView model={model} fitRadius={HERO_FIT_RADIUS} showLabels={showLabels} lowPower={lowPower} handoff={handoff} cancelParentRotation sceneBody caption={model.kind === 'crystal'} />
  }
  return (
    <CatalogSubstanceDisplay
      compound={compound}
      labScaleBoost={CATALOG_HERO_DEFAULT_LAB_SCALE}
      reducedEffects
      labSynthesisScene
      renderQuality="synthesis"
      fxLevel="low"
      chaoticWobble={chaoticWobble}
      showAtmosphere={false}
    />
  )
}
