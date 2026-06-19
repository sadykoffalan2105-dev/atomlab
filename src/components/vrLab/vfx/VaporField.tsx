import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clamp01 } from '../../../vrLab/vrLabAnimation'
import { useVrLabPerf } from '../vrLabPerformance'

type Props = {
  active: boolean
  intensity: number
  color?: string
  spread?: number
  gasPlume?: boolean
  position?: [number, number, number]
}

/** Пар / дым над реактором с турбулентностью. */
export function VaporField({
  active,
  intensity,
  color = '#e8f4ff',
  spread = 0.2,
  gasPlume = false,
  position = [0, 0, 0],
}: Props) {
  const { steamCount, tier } = useVrLabPerf()
  const ref = useRef<THREE.Points>(null)
  const count = tier === 'high' ? steamCount : Math.max(8, Math.floor(steamCount * 0.55))

  const seeds = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * spread,
        z: (Math.random() - 0.5) * spread,
        y: Math.random() * 0.08,
        speed: 0.06 + Math.random() * 0.12,
        phase: Math.random() * Math.PI * 2,
        size: 0.025 + Math.random() * 0.035,
      })),
    [count, spread],
  )

  const positions = useMemo(() => new Float32Array(count * 3), [count])

  useFrame((state, dt) => {
    if (!ref.current || !active || intensity < 0.04) return
    const attr = ref.current.geometry.getAttribute('position') as THREE.BufferAttribute
    const t = state.clock.elapsedTime

    for (let i = 0; i < count; i++) {
      const s = seeds[i]!
      let y = s.y + dt * s.speed * intensity * (gasPlume ? 1.35 : 1)
      const curl =
        Math.sin(t * 1.8 + s.phase) * 0.012 * intensity +
        Math.cos(t * 1.3 + s.phase * 1.7) * 0.008 * intensity
      let x = s.x + curl
      let z = s.z + Math.cos(t * 2.1 + s.phase) * 0.01 * intensity

      if (y > 0.42 + spread * 0.3) {
        y = 0
        x = (Math.random() - 0.5) * spread * 0.8
        z = (Math.random() - 0.5) * spread * 0.8
        s.x = x
        s.z = z
        s.y = 0
      } else {
        s.y = y
        s.x = x
        s.z = z
      }

      attr.setXYZ(i, x, y + 0.06, z)
    }
    attr.needsUpdate = true

    const mat = ref.current.material as THREE.PointsMaterial
    mat.opacity = clamp01(intensity * (gasPlume ? 0.38 : 0.28))
    mat.size = 0.028 + intensity * 0.022
  })

  if (!active || intensity < 0.04 || count === 0) return null

  for (let i = 0; i < count; i++) {
    const s = seeds[i]!
    positions[i * 3] = s.x
    positions[i * 3 + 1] = s.y + 0.06
    positions[i * 3 + 2] = s.z
  }

  return (
    <group position={position}>
      <points ref={ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={0.035}
          transparent
          opacity={0.25}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}
