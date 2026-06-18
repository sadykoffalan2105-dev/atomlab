import { Bloom, DepthOfField, EffectComposer } from '@react-three/postprocessing'
import type { SynthesisQualityFeatures } from '../../lab/synthesisQualityLadder'
import { REACTION_CENTER } from './reactorPreviewLayout'

const FOCUS_TARGET: [number, number, number] = REACTION_CENTER

/**
 * Bloom + опциональный DOF — только то, что разрешил quality ladder.
 */
export function SynthesisLabCinematicFx({
  phase,
  features,
}: {
  phase: string
  features: SynthesisQualityFeatures
}) {
  const mergeOrProduct = phase === 'mergeFlash' || phase === 'product'
  const converge = phase === 'converge' || phase === 'ignite'

  const bloomOn =
    (mergeOrProduct && features.bloomMerge) || (converge && features.bloomConverge)
  if (!bloomOn && !features.depthOfField) return null

  const bloomIntensity = mergeOrProduct ? 0.88 : 0.38
  const bloomThreshold = mergeOrProduct ? 0.18 : 0.34
  const useDof = mergeOrProduct && features.depthOfField

  if (useDof && bloomOn) {
    return (
      <EffectComposer multisampling={0} enableNormalPass>
        <DepthOfField
          target={FOCUS_TARGET}
          focalLength={0.024}
          bokehScale={2.8}
          height={420}
          worldFocusDistance={4.8}
          worldFocusRange={2.4}
        />
        <Bloom
          luminanceThreshold={bloomThreshold}
          luminanceSmoothing={0.32}
          mipmapBlur
          intensity={bloomIntensity}
          radius={0.48}
          levels={5}
        />
      </EffectComposer>
    )
  }

  if (useDof) {
    return (
      <EffectComposer multisampling={0} enableNormalPass>
        <DepthOfField
          target={FOCUS_TARGET}
          focalLength={0.024}
          bokehScale={2.8}
          height={420}
          worldFocusDistance={4.8}
          worldFocusRange={2.4}
        />
      </EffectComposer>
    )
  }

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.32}
        mipmapBlur
        intensity={bloomIntensity}
        radius={mergeOrProduct ? 0.42 : 0.28}
        levels={mergeOrProduct ? 4 : 3}
      />
    </EffectComposer>
  )
}
