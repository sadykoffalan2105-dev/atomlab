import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { clamp01 } from '../../../vrLab/vrLabAnimation'
import { useVrLabPerf } from '../vrLabPerformance'
import { VR_THEME } from '../vrLabTheme'

type Props = {
  active: boolean
  intensity?: number
  color?: string
  position?: [number, number, number]
}

/** Volumetric god-rays над реактором во время реакции (high tier). */
export function ReactionGodRays({
  active,
  intensity = 0.5,
  color = VR_THEME.cyan,
  position = [0, 0.14, 0],
}: Props) {
  const { tier } = useVrLabPerf()
  const coreRef = useRef<THREE.Mesh>(null)
  const haloRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!active) return
    const pulse = 0.85 + Math.sin(state.clock.elapsedTime * 2.8) * 0.15
    const i = clamp01(intensity) * pulse
    if (coreRef.current) {
      const m = coreRef.current.material as THREE.MeshBasicMaterial
      m.opacity = i * 0.22
    }
    if (haloRef.current) {
      const m = haloRef.current.material as THREE.MeshBasicMaterial
      m.opacity = i * 0.1
      haloRef.current.rotation.z = state.clock.elapsedTime * 0.12
    }
  })

  if (!active || tier !== 'high' || intensity < 0.08) return null

  return (
    <group position={position}>
      <mesh ref={coreRef} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.11, 0.55, 20, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={haloRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.06, 0.2, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.08}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}
