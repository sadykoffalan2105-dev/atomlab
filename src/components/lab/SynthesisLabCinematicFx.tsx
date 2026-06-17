import { Bloom, EffectComposer } from '@react-three/postprocessing'

/** Bloom на фазах синтеза — «big bang» при слиянии, мягкое свечение при рождении молекулы. */
export function SynthesisLabCinematicFx({
  phase,
  forceLite = false,
}: {
  phase: string
  forceLite?: boolean
}) {
  if (forceLite) return null

  const active =
    phase === 'ignite' ||
    phase === 'converge' ||
    phase === 'mergeFlash' ||
    phase === 'product' ||
    phase === 'flying'

  if (!active) return null

  const merge = phase === 'mergeFlash'
  const product = phase === 'product'
  const converge = phase === 'converge' || phase === 'ignite'

  const intensity = merge ? 1.05 : product ? 0.68 : converge ? 0.42 : 0.32
  const threshold = merge ? 0.18 : product ? 0.34 : 0.42

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        luminanceThreshold={threshold}
        luminanceSmoothing={0.32}
        mipmapBlur
        intensity={intensity}
        radius={merge ? 0.55 : 0.42}
        levels={6}
      />
    </EffectComposer>
  )
}
