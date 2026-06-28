import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'

const POOL = 280

/**
 * Cinematic bond-formation burst: point light pulse + GPU sparkles + emissive flash.
 */
export function SynthesisBondBurst({
  active,
  progressRef,
  accentHex = '#3dffec',
  minimalFx = false,
}: {
  active: boolean
  progressRef: React.MutableRefObject<number>
  accentHex?: string
  minimalFx?: boolean
}) {
  const lightRef = useRef<THREE.PointLight>(null)
  const flashRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(() => {
    if (!active) return
    const t = Math.min(1, Math.max(0, progressRef.current))
    const peak = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65
    const intensity = peak * (minimalFx ? 2.2 : 4.8)
    if (lightRef.current) lightRef.current.intensity = intensity
    if (matRef.current) {
      matRef.current.opacity = peak * 0.55
      matRef.current.color.set(accentHex)
    }
    if (flashRef.current) {
      const s = 0.4 + peak * 1.6
      flashRef.current.scale.set(s, s, s)
    }
  })

  if (!active) return null

  return (
    <group position={[0, 0.12, 0]}>
      <pointLight
        ref={lightRef}
        color={accentHex}
        intensity={0}
        distance={minimalFx ? 8 : 14}
        decay={2}
      />
      <mesh ref={flashRef}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial
          ref={matRef}
          color={accentHex}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {!minimalFx ? (
        <Sparkles
          count={POOL}
          scale={2.4}
          size={2.8}
          speed={3.2}
          opacity={0.9}
          color={accentHex}
        />
      ) : (
        <Sparkles count={80} scale={1.6} size={2} speed={2.4} opacity={0.75} color={accentHex} />
      )}
    </group>
  )
}
