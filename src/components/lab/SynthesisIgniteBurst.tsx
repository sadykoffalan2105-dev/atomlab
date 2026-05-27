import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/** Вспышка «зажигания» в первые кадры синтеза. */
export function SynthesisIgniteBurst({ accentHex = '#3dffec' }: { accentHex?: string }) {
  const ringRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const t0 = useRef(performance.now() / 1000)

  useFrame(() => {
    const elapsed = performance.now() / 1000 - t0.current
    const tt = Math.min(1, elapsed / 0.38)
    const ease = 1 - (1 - tt) * (1 - tt)
    if (ringRef.current) ringRef.current.scale.setScalar(0.4 + ease * 3.6)
    if (matRef.current) matRef.current.opacity = (1 - tt) * 0.72
  })

  return (
    <mesh ref={ringRef} rotation={[-Math.PI * 0.5, 0, 0]} position={[0, 0.06, 0.25]}>
      <ringGeometry args={[0.35, 0.9, 48]} />
      <meshBasicMaterial
        ref={matRef}
        color={accentHex}
        transparent
        opacity={0.72}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}
