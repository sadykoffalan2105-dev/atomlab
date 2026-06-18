import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VrLabMixResult } from '../../vrLab/types'
import { clamp01, lerp } from '../../vrLab/vrLabAnimation'
import { useVrLabPerf } from './vrLabPerformance'
import { VR_THEME } from './vrLabTheme'

type Props = {
  active: boolean
  result: VrLabMixResult | null
  position?: [number, number, number]
  progress?: number
}

export function VrLabReactionParticles({
  active,
  result,
  position = [0.82, 0.3, 0.1],
  progress = 1,
}: Props) {
  const { particleCount, steamCount, tier } = useVrLabPerf()
  const bubblesRef = useRef<THREE.InstancedMesh>(null)
  const steamRef = useRef<THREE.Points>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const bubbleData = useMemo(() => {
    return Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * 0.28,
      y: Math.random() * 0.12,
      z: (Math.random() - 0.5) * 0.28,
      speed: 0.012 + Math.random() * 0.028,
      phase: Math.random() * Math.PI * 2,
      scale: 0.01 + Math.random() * 0.018,
    }))
  }, [particleCount])

  const steamPos = useMemo(() => {
    const arr = new Float32Array(steamCount * 3)
    for (let i = 0; i < steamCount; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 0.16
      arr[i * 3 + 1] = Math.random() * 0.2
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.16
    }
    return arr
  }, [steamCount])

  const bubbleColor = useMemo(() => {
    if (!result) return new THREE.Color(VR_THEME.cyan)
    if (result.effect === 'gasEvolution') return new THREE.Color(VR_THEME.cyan)
    if (result.effect === 'neutralization') return new THREE.Color(VR_THEME.neonYellow)
    if (result.effect === 'hydration') return new THREE.Color(VR_THEME.magenta)
    return new THREE.Color(VR_THEME.neonGreen)
  }, [result])

  useFrame((state, dt) => {
    if (!active) return
    const p = clamp01(progress)
    const intensity = (result?.bubbleIntensity ?? 0.3) * p

    if (bubblesRef.current && particleCount > 0) {
      bubbleData.forEach((b, i) => {
        b.y += b.speed * intensity * (1 + dt * 18)
        if (b.y > 0.45) b.y = 0
        const wobble = Math.sin(state.clock.elapsedTime * 5 + b.phase) * 0.018
        dummy.position.set(b.x + wobble, b.y, b.z)
        dummy.scale.setScalar(b.scale * (1 + intensity * 0.4))
        dummy.updateMatrix()
        bubblesRef.current!.setMatrixAt(i, dummy.matrix)
      })
      bubblesRef.current.instanceMatrix.needsUpdate = true
    }

    if (steamRef.current && steamCount > 0 && (result?.heat ?? 0) > 0.45) {
      const attr = steamRef.current.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < steamCount; i++) {
        let y = attr.getY(i) + dt * 0.1 * ((result?.heat ?? 0) + 0.2)
        let x = attr.getX(i) + Math.sin(state.clock.elapsedTime * 2 + i) * 0.0015
        if (y > 0.5) {
          y = 0
          x = (Math.random() - 0.5) * 0.12
        }
        attr.setXYZ(i, x, y, attr.getZ(i))
      }
      attr.needsUpdate = true
    }
  })

  if (!active || particleCount === 0) return null

  const heat = result?.heat ?? 0

  return (
    <group position={position}>
      <instancedMesh ref={bubblesRef} args={[undefined, undefined, particleCount]} frustumCulled>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial
          color={bubbleColor}
          emissive={bubbleColor}
          emissiveIntensity={0.6}
          transparent
          opacity={0.6}
          roughness={0.15}
        />
      </instancedMesh>

      {steamCount > 0 && heat > 0.45 ? (
        <points ref={steamRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[steamPos, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.035}
            color="#ffffff"
            transparent
            opacity={0.22 * heat * progress}
            depthWrite={false}
          />
        </points>
      ) : null}

      {tier === 'high' && heat > 0.55 ? (
        <pointLight color={VR_THEME.magenta} intensity={lerp(0, heat * 2, progress)} distance={2} />
      ) : null}

      {tier === 'high' && result?.effect === 'gasEvolution' ? (
        <pointLight color={VR_THEME.cyan} intensity={progress * 1.2} distance={1.6} />
      ) : null}
    </group>
  )
}
