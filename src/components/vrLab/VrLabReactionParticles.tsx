import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VrLabMixResult } from '../../vrLab/types'
import { clamp01, lerp } from '../../vrLab/vrLabAnimation'

type Props = {
  active: boolean
  result: VrLabMixResult | null
  position?: [number, number, number]
  progress?: number
}

export function VrLabReactionParticles({
  active,
  result,
  position = [0.95, 0.35, 0],
  progress = 1,
}: Props) {
  const bubblesRef = useRef<THREE.InstancedMesh>(null)
  const steamRef = useRef<THREE.Points>(null)
  const count = 48
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const bubbleData = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 0.22,
      y: Math.random() * 0.15,
      z: (Math.random() - 0.5) * 0.22,
      speed: 0.015 + Math.random() * 0.035,
      phase: Math.random() * Math.PI * 2,
      scale: 0.012 + Math.random() * 0.022,
    }))
  }, [])

  const steamPos = useMemo(() => {
    const arr = new Float32Array(80 * 3)
    for (let i = 0; i < 80; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 0.18
      arr[i * 3 + 1] = Math.random() * 0.25
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.18
    }
    return arr
  }, [])

  const bubbleColor = useMemo(() => {
    if (!result) return new THREE.Color('#ffffff')
    if (result.effect === 'gasEvolution') return new THREE.Color('#d8f8ff')
    if (result.effect === 'neutralization') return new THREE.Color('#fff0c0')
    if (result.effect === 'hydration') return new THREE.Color('#ffd0a0')
    return new THREE.Color('#e8fff0')
  }, [result])

  useFrame((state, dt) => {
    const p = clamp01(progress)
    const intensity = (result?.bubbleIntensity ?? 0.3) * p

    if (bubblesRef.current && active) {
      bubbleData.forEach((b, i) => {
        b.y += b.speed * intensity * (1 + dt * 20)
        if (b.y > 0.5) b.y = 0
        const wobble = Math.sin(state.clock.elapsedTime * 6 + b.phase) * 0.02
        dummy.position.set(b.x + wobble, b.y, b.z)
        const s = b.scale * (1 + intensity * 0.5)
        dummy.scale.setScalar(s)
        dummy.updateMatrix()
        bubblesRef.current!.setMatrixAt(i, dummy.matrix)
      })
      bubblesRef.current.instanceMatrix.needsUpdate = true
    }

    if (steamRef.current && active && (result?.heat ?? 0) > 0.45) {
      const attr = steamRef.current.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < 80; i++) {
        let y = attr.getY(i) + dt * 0.12 * (result!.heat + 0.2)
        let x = attr.getX(i) + Math.sin(state.clock.elapsedTime * 2 + i) * 0.002
        if (y > 0.6) {
          y = 0
          x = (Math.random() - 0.5) * 0.15
        }
        attr.setXYZ(i, x, y, attr.getZ(i))
      }
      attr.needsUpdate = true
    }
  })

  if (!active) return null

  const heat = result?.heat ?? 0

  return (
    <group position={position}>
      <instancedMesh ref={bubblesRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshPhysicalMaterial
          color={bubbleColor}
          transparent
          opacity={0.65}
          roughness={0.1}
          transmission={0.35}
          thickness={0.2}
        />
      </instancedMesh>

      {heat > 0.45 ? (
        <points ref={steamRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[steamPos, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.04}
            color="#ffffff"
            transparent
            opacity={0.25 * heat * progress}
            depthWrite={false}
          />
        </points>
      ) : null}

      {heat > 0.55 ? (
        <pointLight
          color="#ffaa66"
          intensity={lerp(0, heat * 3, progress)}
          distance={2.8}
        />
      ) : null}

      {result?.effect === 'gasEvolution' ? (
        <pointLight color="#a8f0ff" intensity={progress * 1.2} distance={2} />
      ) : null}
    </group>
  )
}

export function VrLabBloom() {
  return null
}
