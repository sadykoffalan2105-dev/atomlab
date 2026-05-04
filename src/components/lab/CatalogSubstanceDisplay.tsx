import { Suspense, useEffect, useMemo } from 'react'
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
  /** Управление эффектами для синтеза: off/low/full */
  fxLevel?: 'off' | 'low' | 'full'
  /** Быстрый режим молекулы (меньше poly, без тяжелых штук) */
  renderQuality?: 'high' | 'synthesis'
  /**
   * Активная анимация синтеза в лаборатории: не поднимаемся до `full` (без HDR Environment и Bloom).
   */
  labSynthesisScene?: boolean
}

/**
 * 3D-слой, совпадающий с `CatalogHeroScene` / `CatalogMoleculeHero` (каталог, модалка),
 * для использования **внутри** общего `Canvas` лаборатории (тот же `HeroMoleculeRig` + MoleculeMesh).
 */
export function CatalogSubstanceDisplay({
  compound,
  labScaleBoost = CATALOG_HERO_DEFAULT_LAB_SCALE,
  reducedEffects = false,
  fxLevel: fxLevelIn,
  renderQuality = 'high',
  labSynthesisScene = false,
}: Props) {
  const [sr, sg, sb] = categoryAccentRgb(compound.category)
  const secondaryHex = useMemo(
    () => rgbToHex(sr * 0.5 + 0.2, sg * 0.5 + 0.15, sb * 0.55 + 0.25),
    [sr, sg, sb],
  )
  const sparkleHex = compound.accentColor ?? '#3dffec'
  const rawFx: 'off' | 'low' | 'full' = fxLevelIn ?? (reducedEffects ? 'low' : 'full')
  const fxLevel: 'off' | 'low' | 'full' =
    labSynthesisScene && rawFx === 'full' ? 'low' : rawFx
  const starPts = fxLevel === 'full' ? 260 : fxLevel === 'low' ? 100 : 0
  const sp1 = fxLevel === 'full' ? 96 : fxLevel === 'low' ? 32 : 0
  const sp2 = fxLevel === 'full' ? 48 : fxLevel === 'low' ? 16 : 0

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dbdb64' },
      body: JSON.stringify({
        sessionId: 'dbdb64',
        runId: 'aura-sphere-pre',
        hypothesisId: 'H1_H2_H4',
        location: 'CatalogSubstanceDisplay.tsx:fxLevel',
        message: 'resolved fx + aura gate (full-only)',
        data: {
          compoundId: compound.id,
          fxLevelIn: fxLevelIn ?? null,
          reducedEffects,
          resolvedFxLevel: fxLevel,
          auraRenderedFullOnly: fxLevel === 'full',
          auraWouldShowIfLowIncluded: fxLevel === 'full' || fxLevel === 'low',
          substanceAuraBubbleOn: fxLevel === 'full' || fxLevel === 'low',
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }, [compound.id, fxLevel, fxLevelIn, reducedEffects, labSynthesisScene])

  return (
    <>
      {fxLevel === 'full' ? (
        <Suspense fallback={null}>
          <Environment preset="city" environmentIntensity={0.4} />
        </Suspense>
      ) : null}
      <ambientLight intensity={reducedEffects ? 0.5 : 0.42} />
      <directionalLight position={[3.2, 5.5, 3.5]} intensity={reducedEffects ? 0.95 : 0.85} color="#e8eeff" />
      <directionalLight position={[-3.5, 1.5, -2]} intensity={0.35} color={sparkleHex} />
      <pointLight position={[0.2, 0.9, 2.2]} intensity={reducedEffects ? 0.95 : 0.75} color={secondaryHex} distance={8} />
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
      <HeroMoleculeRig compound={compound} labScaleBoost={labScaleBoost} renderQuality={renderQuality} fxLevel={fxLevel} />
      {fxLevel === 'full' ? <CatalogStyleBloom /> : null}
    </>
  )
}
