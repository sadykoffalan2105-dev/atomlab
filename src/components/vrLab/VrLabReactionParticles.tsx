import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VrLabMixResult } from '../../vrLab/types'

type Props = {
  active: boolean
  result: VrLabMixResult | null
  position?: [number, number, number]
}

export function VrLabReactionParticles({ active, result, position = [0.9, 0.35, 0] }: Props) {
  const pointsRef = useRef<THREE.Points>(null)
  const count = 120

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.15
      pos[i * 3 + 1] = Math.random() * 0.2
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.15
      vel[i * 3] = (Math.random() - 0.5) * 0.02
      vel[i * 3 + 1] = 0.02 + Math.random() * 0.04
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.02
    }
    return { positions: pos, velocities: vel }
  }, [])

  const color = useMemo(() => {
    if (!result) return new THREE.Color('#5cffd4')
    if (result.effect === 'gasEvolution') return new THREE.Color('#a8f0ff')
    if (result.effect === 'neutralization') return new THREE.Color('#ffe08a')
    if (result.effect === 'hydration') return new THREE.Color('#ff9a6a')
    if (result.effect === 'precipitate') return new THREE.Color('#c8b8ff')
    return new THREE.Color('#7dffb0')
  }, [result])

  useFrame((_, dt) => {
    if (!pointsRef.current || !active) return
    const geo = pointsRef.current.geometry
    const attr = geo.getAttribute('position') as THREE.BufferAttribute
    const intensity = result?.bubbleIntensity ?? 0.3
    for (let i = 0; i < count; i++) {
      let y = attr.getY(i) + velocities[i * 3 + 1]! * intensity * (1 + dt * 30)
      let x = attr.getX(i) + velocities[i * 3]!
      let z = attr.getZ(i) + velocities[i * 3 + 2]!
      if (y > 0.55) {
        y = 0
        x = (Math.random() - 0.5) * 0.12
        z = (Math.random() - 0.5) * 0.12
      }
      attr.setXYZ(i, x, y, z)
    }
    attr.needsUpdate = true
  })

  if (!active) return null

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.035} color={color} transparent opacity={0.85} depthWrite={false} />
      </points>
      {(result?.heat ?? 0) > 0.6 ? (
        <pointLight color="#ffaa66" intensity={result!.heat * 2.5} distance={2.5} />
      ) : null}
    </group>
  )
}

export function VrLabAmbientLab() {
  return (
    <>
      <color attach="background" args={['#0c1018']} />
      <fog attach="fog" args={['#0c1018', 4, 14]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[2.5, 5, 3]} intensity={1.1} castShadow color="#f0f4ff" />
      <directionalLight position={[-3, 2, -1]} intensity={0.35} color="#5ad8ff" />
      <pointLight position={[0, 1.8, 1.2]} intensity={0.6} color="#5cffd4" distance={6} />
    </>
  )
}
