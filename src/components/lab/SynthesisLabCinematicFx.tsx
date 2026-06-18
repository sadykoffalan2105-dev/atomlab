import { useEffect, useRef, useState } from 'react'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SynthesisQualityFeatures } from '../../lab/synthesisQualityLadder'

/**
 * Bloom на merge/product. Composer появляется через несколько кадров после старта
 * (intensity=0), чтобы не блокировать первый кадр полёта атомов.
 */
export function SynthesisLabCinematicFx({
  runId,
  phase,
  features,
}: {
  runId: number
  phase: string
  features: SynthesisQualityFeatures
}) {
  const mergeOrProduct = phase === 'mergeFlash' || phase === 'product'
  const bloomTarget = mergeOrProduct && features.bloomMerge ? 0.58 : 0
  const intensityRef = useRef(0)
  const bloomRef = useRef<{ intensity: number } | null>(null)
  const [composerReady, setComposerReady] = useState(false)

  useEffect(() => {
    intensityRef.current = 0
    if (bloomRef.current) bloomRef.current.intensity = 0
    setComposerReady(false)
    let raf2 = 0
    let raf3 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        raf3 = requestAnimationFrame(() => setComposerReady(true))
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      cancelAnimationFrame(raf3)
    }
  }, [runId])

  useFrame(() => {
    if (!composerReady) return
    const next = THREE.MathUtils.lerp(intensityRef.current, bloomTarget, 0.22)
    intensityRef.current = next
    if (bloomRef.current) bloomRef.current.intensity = next
  })

  if (!composerReady) return null

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloomRef}
        luminanceThreshold={0.22}
        luminanceSmoothing={0.34}
        mipmapBlur
        intensity={0}
        radius={0.34}
        levels={3}
      />
    </EffectComposer>
  )
}
