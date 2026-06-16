import { Bloom, EffectComposer } from '@react-three/postprocessing'

/** Bloom — свечение электронов и облака; порог выше, чтобы CPK-орбиты не «выбивались» в белый. */
export function AtomCosmicBloom({
  intensity = 0.82,
  luminanceThreshold = 0.32,
}: {
  intensity?: number
  luminanceThreshold?: number
}) {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        luminanceThreshold={luminanceThreshold}
        luminanceSmoothing={0.35}
        mipmapBlur
        intensity={intensity}
        radius={0.48}
        levels={6}
      />
    </EffectComposer>
  )
}
