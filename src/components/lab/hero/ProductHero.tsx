import { useMemo } from 'react'
import type { CompoundDef } from '../../../types/chemistry'
import { CatalogSubstanceDisplay } from '../CatalogSubstanceDisplay'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from '../catalogMoleculeHeroShared'
import { buildHeroModel } from './heroGeometry'
import { CrystalHero } from './CrystalHero'
import { MoleculeHero } from './MoleculeHero'

/**
 * Герой продукта в лаборатории.
 *  • Вещество есть в heroStructures (11 веществ документа) → кристалл или молекула по данным ядра.
 *  • Иначе — каталожная модель, как раньше, но БЕЗ ауры и колец (в лаборатории свет только сценический;
 *    в каталоге аура остаётся).
 */
export function ProductHero({
  compound,
  showLabels,
  lowPower = false,
  chaoticWobble = false,
  handoff = false,
}: {
  compound: CompoundDef
  /** DOM-подписи (символы, заряды, a, КЧ): только когда герой в кадре — не на прогреве и не зародышем */
  showLabels: boolean
  lowPower?: boolean
  chaoticWobble?: boolean
  /** слот героя, на который сцена урока заявила передачу кадра (hero/heroHandoff) */
  handoff?: boolean
}) {
  const model = useMemo(() => buildHeroModel(compound.id), [compound.id])
  if (model?.spec.kind === 'crystal') return <CrystalHero model={model} showLabels={showLabels} lowPower={lowPower} handoff={handoff} />
  if (model?.spec.kind === 'molecule') return <MoleculeHero model={model} showLabels={showLabels} lowPower={lowPower} />
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
