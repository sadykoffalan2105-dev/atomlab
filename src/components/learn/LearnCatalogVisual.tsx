import { AtomStructureModel } from '../lab/AtomStructureModel'
import { getElementByZ } from '../../data/elements'
import { CatalogSubstanceDisplay } from '../lab/CatalogSubstanceDisplay'
import { compoundById } from '../../data/compounds'
import type { CompoundDef } from '../../types/chemistry'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from '../lab/catalogMoleculeHeroShared'
import { AtomBall, BondRod, SceneLights, SpinGroup } from './topicScenes/primitives'

export function LearnCatalogVisual({
  compoundId,
  autoRotate = true,
}: {
  compoundId: string
  autoRotate?: boolean
}) {
  const compound = compoundById[compoundId]
  if (!compound) return null
  return (
    <>
      <SceneLights accent={compound.accentColor ?? '#3dffec'} />
      <SpinGroup autoRotate={autoRotate} speed={0.12}>
        <CatalogSubstanceDisplay
          compound={compound}
          labScaleBoost={CATALOG_HERO_DEFAULT_LAB_SCALE}
          reducedEffects
          labSynthesisScene
          fxLevel="full"
          renderQuality="synthesis"
        />
      </SpinGroup>
    </>
  )
}

export function LearnElementVisual({
  z,
  autoRotate = true,
  cpkHex,
}: {
  z: number
  autoRotate?: boolean
  cpkHex?: string
}) {
  const el = getElementByZ(z)
  const accent = cpkHex ?? (el?.cpkHex ? `#${el.cpkHex}` : '#4488ff')
  return (
    <>
      <SceneLights accent={accent} />
      <SpinGroup autoRotate={autoRotate} speed={0.1}>
        <group scale={1.15}>
          <AtomStructureModel
            z={z}
            animate
            previewEmphasis
            previewLite
            accentHex={accent}
            cosmicStyle
          />
        </group>
      </SpinGroup>
    </>
  )
}

export function LearnDiatomicVisual({
  z,
  autoRotate = true,
  bondLength = 0.36,
}: {
  z: number
  autoRotate?: boolean
  bondLength?: number
}) {
  const hex = z === 8 ? '#4488ff' : z === 1 ? '#eefcff' : '#66ccff'
  const half = bondLength * 0.5
  return (
    <>
      <SceneLights accent={hex} />
      <SpinGroup autoRotate={autoRotate} speed={0.18}>
        <group scale={1.1}>
          <AtomBall color={hex} position={[-half, 0, 0]} radius={0.18} />
          <AtomBall color={hex} position={[half, 0, 0]} radius={0.18} />
          <BondRod from={[-half, 0, 0]} to={[half, 0, 0]} color={hex} />
        </group>
      </SpinGroup>
    </>
  )
}

export function LearnBondVisual({
  compoundId,
  autoRotate = true,
}: {
  compoundId?: string
  autoRotate?: boolean
}) {
  const compound = compoundId ? compoundById[compoundId] : null
  if (compound) {
    return <LearnCatalogVisual compoundId={compound.id} autoRotate={autoRotate} />
  }
  return (
    <>
      <SceneLights accent="#aa66ff" />
      <SpinGroup autoRotate={autoRotate} speed={0.14}>
        <AtomBall color="#3dffec" position={[-0.45, 0, 0]} radius={0.2} />
        <AtomBall color="#ff8844" position={[0.45, 0, 0]} radius={0.2} />
        <BondRod from={[-0.45, 0, 0]} to={[0.45, 0, 0]} />
      </SpinGroup>
    </>
  )
}

export function compoundCatalogVisualId(compoundId: string): string {
  return `molecule:${compoundId}`
}

export function resolveCompoundForHud(compoundId: string): CompoundDef | null {
  return compoundById[compoundId] ?? null
}
