import { Suspense } from 'react'
import { Environment, Sparkles } from '@react-three/drei'
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
   * Синтез/лаборатория: без IBL-Environment и без Bloom, меньше sparkles/звёzd — плавнее 60 fps.
   * Каталожная карточка/модалка передают false (по умолчанию).
   */
  reducedEffects?: boolean
  /** Управление эффектами для синтеза: off/low/full */
  fxLevel?: 'off' | 'low' | 'full'
  /** Быстрый режим молекулы (menьше poly); в labSynthesisScene для видимого продукта всё равно high */
  renderQuality?: 'high' | 'synthesis'
  /**
   * Лаборатория / синтез: как в каталоге (буквы на атомах, aura-кольца), но без HDR/Bloom
   * и без дубля звёзд — фон даёт LabSynthesisCosmicBackdrop.
   */
  labSynthesisScene?: boolean
  chaoticWobble?: boolean
}

/**
 * 3D-слой, совпадающий с каталогом (HeroMoleculeRig + aura), для модалки и лаборатории.
 */
export function CatalogSubstanceDisplay({
  compound,
  labScaleBoost = CATALOG_HERO_DEFAULT_LAB_SCALE,
  reducedEffects = false,
  fxLevel: fxLevelIn,
  renderQuality = 'high',
  labSynthesisScene = false,
  chaoticWobble = false,
}: Props) {
  const rawFx: 'off' | 'low' | 'full' = fxLevelIn ?? (reducedEffects ? 'low' : 'full')
  const fxLevel: 'off' | 'low' | 'full' =
    labSynthesisScene && rawFx === 'full' ? 'low' : rawFx
  const sparkleHex = compound.accentColor ?? '#3dffec'

  if (labSynthesisScene) {
    const showDecor = fxLevel === 'low' || fxLevel === 'full'
    const sp1 = fxLevel === 'full' ? 96 : fxLevel === 'low' ? 16 : 0
    const sp2 = fxLevel === 'full' ? 48 : 0
    return (
      <>
        {showDecor ? (
          <>
            <SubstanceAuraBubble accentColor={compound.accentColor} compoundId={compound.id} />
            {sp1 > 0 ? (
              <Sparkles
                count={sp1}
                scale={5.5}
                size={1.85}
                speed={0.36}
                opacity={0.55}
                color={sparkleHex}
                position={[0, 0.06, 0]}
              />
            ) : null}
            {sp2 > 0 ? (
              <Sparkles
                count={sp2}
                scale={4}
                size={1.25}
                speed={0.44}
                opacity={0.35}
                color="#cfefff"
                position={[0.1, -0.02, -0.15]}
              />
            ) : null}
          </>
        ) : null}
        <HeroMoleculeRig
          compound={compound}
          labScaleBoost={labScaleBoost}
          renderQuality="synthesis"
          fxLevel={showDecor ? 'low' : 'off'}
          chaoticWobble={chaoticWobble}
        />
      </>
    )
  }

  const starPts = fxLevel === 'full' ? 260 : fxLevel === 'low' ? 100 : 0
  const sp1 = fxLevel === 'full' ? 96 : fxLevel === 'low' ? 32 : 0
  const sp2 = fxLevel === 'full' ? 48 : fxLevel === 'low' ? 16 : 0

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
      {sp1 > 0 ? (
        <Sparkles
          count={sp1}
          scale={5.5}
          size={1.85}
          speed={0.36}
          opacity={0.55}
          color={sparkleHex}
          position={[0, 0.06, 0]}
        />
      ) : null}
      {sp2 > 0 ? (
        <Sparkles
          count={sp2}
          scale={4}
          size={1.25}
          speed={0.44}
          opacity={0.35}
          color="#cfefff"
          position={[0.1, -0.02, -0.15]}
        />
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
