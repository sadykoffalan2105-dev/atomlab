import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { GPUParticleField } from './gpu/GPUParticleField'
import { useVrLabPerf } from './vrLabPerformance'
import { VR_THEME } from './vrLabTheme'

/** Мягкие «пылинки» в воздухе — GPU instanced. */
export function VrLabAmbientDust({ count = 40 }: { count?: number }) {
  const { tier } = useVrLabPerf()
  if (tier === 'low' && count > 16) {
    return <GPUParticleField mode="dust" count={16} />
  }
  return <GPUParticleField mode="dust" count={count} />
}

/** Пульсирующие LED-полосы на стене. */
export function VrLabPulsingNeon({
  position,
  args = [4.8, 0.012, 0.01] as [number, number, number],
  color = VR_THEME.cyan,
}: {
  position: [number, number, number]
  args?: [number, number, number]
  color?: string
}) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!ref.current) return
    const mat = ref.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = 0.9 + Math.sin(state.clock.elapsedTime * 1.8) * 0.35
  })

  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} roughness={0.2} />
    </mesh>
  )
}

/** Потолочные светильники — основной источник «живого» света. */
export function VrLabCeilingLights() {
  const lights = [
    { x: -1.2, color: '#f0eeff' },
    { x: 0.2, color: '#eef8ff' },
    { x: 1.4, color: '#f0eeff' },
  ]

  return (
    <group position={[0, 1.42, 0.1]}>
      {lights.map(({ x, color }) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.55, 0.22]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.2}
              roughness={0.3}
            />
          </mesh>
          <pointLight intensity={0.55} color={color} distance={3.5} decay={2} />
        </group>
      ))}
    </group>
  )
}
