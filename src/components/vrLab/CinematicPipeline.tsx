import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  N8AO,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { useEffect, useState } from 'react'
import { useVrLabPerf } from './vrLabPerformance'

/** Tier-aware пост-обработка: AO, bloom, tone mapping, vignette. */
export function CinematicPipeline() {
  const perf = useVrLabPerf()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 350)
    return () => window.clearTimeout(t)
  }, [])

  if (!perf.postProcessing || !ready) return null

  if (perf.tier === 'high') {
    return (
      <EffectComposer multisampling={4} enableNormalPass>
        <N8AO
          aoRadius={0.45}
          intensity={3.2}
          aoSamples={8}
          denoiseSamples={4}
          denoiseRadius={10}
          distanceFalloff={0.8}
          halfRes={false}
          quality="high"
        />
        <Bloom
          luminanceThreshold={0.32}
          luminanceSmoothing={0.85}
          mipmapBlur
          intensity={perf.bloomIntensity}
          radius={0.42}
          levels={perf.bloomLevels}
        />
        <ChromaticAberration offset={[0.0006, 0.001]} radialModulation modulationOffset={0.15} />
        <ToneMapping adaptive />
        <Vignette eskil={false} offset={0.1} darkness={0.32} />
      </EffectComposer>
    )
  }

  return (
    <EffectComposer multisampling={0} enableNormalPass>
      <N8AO
        aoRadius={0.4}
        intensity={2.2}
        aoSamples={4}
        denoiseSamples={4}
        denoiseRadius={10}
        distanceFalloff={0.8}
        halfRes
        quality="medium"
      />
      <Bloom
        luminanceThreshold={0.35}
        luminanceSmoothing={0.85}
        mipmapBlur
        intensity={perf.bloomIntensity}
        radius={0.4}
        levels={perf.bloomLevels}
      />
      <ToneMapping adaptive />
      <Vignette eskil={false} offset={0.1} darkness={0.3} />
    </EffectComposer>
  )
}
