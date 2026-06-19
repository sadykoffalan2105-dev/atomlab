import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useVrLabPerf } from './vrLabPerformance'
import { VR_THEME } from './vrLabTheme'

/** Мягкие «пылинки» в воздухе — оживляет сцену без нагрузки на GPU. */
export function VrLabAmbientDust({ count = 40 }: { count?: number }) {
  const { tier } = useVrLabPerf()
  const n = tier === 'low' ? Math.min(16, count) : count
  const ref = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 4.5
      arr[i * 3 + 1] = 0.15 + Math.random() * 1.1
      arr[i * 3 + 2] = (Math.random() - 0.5) * 2.2
    }
    return arr
  }, [n])

  useFrame((state, dt) => {
    if (!ref.current) return
    const attr = ref.current.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < n; i++) {
      let y = attr.getY(i) + dt * (0.015 + (i % 5) * 0.004)
      let x = attr.getX(i) + Math.sin(state.clock.elapsedTime * 0.4 + i) * dt * 0.008
      if (y > 1.35) y = 0.12
      attr.setXYZ(i, x, y, attr.getZ(i))
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.012}
        color={VR_THEME.cyan}
        transparent
        opacity={0.35}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
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
