import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

export type SciPostDirector = {
  bloom: number
  dof: number
  chroma: number
}

/**
 * Лёгкий cinematic post: только Bloom + Vignette.
 * N8AO / DoF / chromatic — убраны: они давали hitch на лаборатории.
 */
export function SciCinematicPostFx({
  lite = false,
  directorRef,
}: {
  lite?: boolean
  directorRef: MutableRefObject<SciPostDirector>
}) {
  const [ready, setReady] = useState(false)
  const bloomRef = useRef<{ intensity: number } | null>(null)

  useEffect(() => {
    let a = 0
    const id = requestAnimationFrame(() => {
      a = requestAnimationFrame(() => setReady(true))
    })
    return () => {
      cancelAnimationFrame(id)
      cancelAnimationFrame(a)
    }
  }, [])

  useFrame(() => {
    if (!ready || !bloomRef.current) return
    const d = directorRef.current
    const target = lite ? 0.28 + d.bloom * 0.45 : 0.4 + d.bloom * 0.7
    bloomRef.current.intensity = THREE.MathUtils.lerp(bloomRef.current.intensity, target, 0.16)
  })

  if (!ready) return null

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloomRef}
        luminanceThreshold={lite ? 0.32 : 0.26}
        luminanceSmoothing={0.45}
        mipmapBlur
        intensity={0.45}
        radius={lite ? 0.28 : 0.34}
        levels={lite ? 3 : 4}
      />
      <Vignette eskil={false} offset={0.16} darkness={lite ? 0.36 : 0.32} />
    </EffectComposer>
  )
}
