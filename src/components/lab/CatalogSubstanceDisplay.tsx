import { Suspense } from 'react'
import { Environment } from '@react-three/drei'
import {
  CatalogStyleBloom,
  CosmicStarfield,
  HeroMoleculeRig,
  SubstanceAuraBubble,
} from './CatalogMoleculeHero'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from './catalogMoleculeHeroShared'
import type { CompoundDef } from '../../types/chemistry'

type Props = {
  compound: CompoundDef
  /** >1 — крупнее, чем в карточке каталога, для лабораторного полотна */
  labScaleBoost?: number
  /**
   * Синтез/лаборатория: без IBL-Environment и без Bloom, меньше sparkles/звёзд — плавнее 60 fps.
   * Каталожная карточка/модалка передают false (по умолчанию).
   */
  reducedEffects?: boolean
  /** Управление эффектами для синтеза: off/low/full */
  fxLevel?: 'off' | 'low' | 'full'
  /** Быстрый режим молекулы (меньше poly, без тяжелых штук) */
  renderQuality?: 'high' | 'synthesis'
  /**
   * Активная анимация синтеза в лаборатории: только молекула на общем свете сцены,
   * без aura/sparkles/лишних источников света (нет оранжевых пятен).
   */
  labSynthesisScene?: boolean
}

/**
 * 3D-слой для лаборатории / синтеза — совпадает с каталогом по HeroMoleculeRig.
 */
export function CatalogSubstanceDisplay({
  compound,
  labScaleBoost = CATALOG_HERO_DEFAULT_LAB_SCALE,
  reducedEffects = false,
  fxLevel: fxLevelIn,
  renderQuality = 'high',
  labSynthesisScene = false,
}: Props) {
  if (labSynthesisScene) {
    return (
      <HeroMoleculeRig
        compound={compound}
        labScaleBoost={labScaleBoost}
        renderQuality={renderQuality}
        fxLevel="off"
      />
    )
  }

  const rawFx: 'off' | 'low' | 'full' = fxLevelIn ?? (reducedEffects ? 'low' : 'full')
  const fxLevel = rawFx
  const starPts = fxLevel === 'full' ? 260 : fxLevel === 'low' ? 100 : 0

  return (
    <>
      {fxLevel === 'full' ? (
        <Suspense fallback={null}>
          <Environment preset="city" environmentIntensity={0.4} />
        </Suspense>
      ) : null}
      <ambientLight intensity={reducedEffects ? 0.5 : 0.42} />
      <directionalLight position={[3.2, 5.5, 3.5]} intensity={reducedEffects ? 0.95 : 0.85} color="#e8eeff" />
      {starPts > 0 ? (
        <CosmicStarfield
          compoundId={compound.id}
          accentColor={compound.accentColor}
          category={compound.category}
          pointCount={starPts}
        />
      ) : null}
      {fxLevel === 'full' || fxLevel === 'low' ? (
        <SubstanceAuraBubble accentColor={compound.accentColor} compoundId={compound.id} />
      ) : null}
      <HeroMoleculeRig
        compound={compound}
        labScaleBoost={labScaleBoost}
        renderQuality={renderQuality}
        fxLevel={fxLevel}
      />
      {fxLevel === 'full' ? <CatalogStyleBloom /> : null}
    </>
  )
}
