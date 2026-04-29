import { Suspense, useMemo } from 'react'
import { Environment, Sparkles } from '@react-three/drei'
import {
  CatalogStyleBloom,
  CosmicStarfield,
  HeroMoleculeRig,
  SubstanceAuraBubble,
} from './CatalogMoleculeHero'
import { CATALOG_HERO_DEFAULT_LAB_SCALE, categoryAccentRgb, rgbToHex } from './catalogMoleculeHeroShared'
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
}

/**
 * 3D-слой, совпадающий с `CatalogHeroScene` / `CatalogMoleculeHero` (каталог, модалка),
 * для использования **внутри** общего `Canvas` лаборатории (тот же `HeroMoleculeRig` + MoleculeMesh).
 */
export function CatalogSubstanceDisplay({
  compound,
  labScaleBoost = CATALOG_HERO_DEFAULT_LAB_SCALE,
  reducedEffects = false,
}: Props) {
  const [sr, sg, sb] = categoryAccentRgb(compound.category)
  const secondaryHex = useMemo(
    () => rgbToHex(sr * 0.5 + 0.2, sg * 0.5 + 0.15, sb * 0.55 + 0.25),
    [sr, sg, sb],
  )
  const sparkleHex = compound.accentColor ?? '#3dffec'
  const starPts = reducedEffects ? 100 : 260
  const sp1 = reducedEffects ? 32 : 96
  const sp2 = reducedEffects ? 16 : 48

  return (
    <>
      {!reducedEffects ? (
        <Suspense fallback={null}>
          <Environment preset="city" environmentIntensity={0.4} />
        </Suspense>
      ) : null}
      <ambientLight intensity={reducedEffects ? 0.5 : 0.42} />
      <directionalLight position={[3.2, 5.5, 3.5]} intensity={reducedEffects ? 0.95 : 0.85} color="#e8eeff" />
      <directionalLight position={[-3.5, 1.5, -2]} intensity={0.35} color={sparkleHex} />
      <pointLight position={[0.2, 0.9, 2.2]} intensity={reducedEffects ? 0.95 : 0.75} color={secondaryHex} distance={8} />
      <CosmicStarfield
        compoundId={compound.id}
        accentColor={compound.accentColor}
        category={compound.category}
        pointCount={starPts}
      />
      <SubstanceAuraBubble accentColor={compound.accentColor} compoundId={compound.id} />
      <Sparkles
        count={sp1}
        scale={5.5}
        size={1.85}
        speed={0.36}
        opacity={0.55}
        color={sparkleHex}
        position={[0, 0.06, 0]}
      />
      <Sparkles
        count={sp2}
        scale={4}
        size={1.25}
        speed={0.44}
        opacity={0.35}
        color="#cfefff"
        position={[0.1, -0.02, -0.15]}
      />
      <HeroMoleculeRig compound={compound} labScaleBoost={labScaleBoost} />
      {reducedEffects ? null : <CatalogStyleBloom />}
    </>
  )
}
