import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { VAT_POSITION, VAT_ZONE_RADIUS } from '../../vrLab/vrLabShelfLayout'
import { useVrLabGrabOptional } from './VrLabGrabContext'
import { VR_THEME } from './vrLabTheme'

/** Подсветка зоны реактора и подсказка «наклоните сюда». */
export function VrLabBenchZones({ highlight = false }: { highlight?: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null)
  const grab = useVrLabGrabOptional()

  useFrame((state) => {
    if (!ringRef.current) return
    const mat = ringRef.current.material as THREE.MeshStandardMaterial
    const pulse = 0.35 + Math.sin(state.clock.elapsedTime * 3) * 0.15
    const hot = highlight || (grab?.streamingId != null)
    mat.emissiveIntensity = hot ? pulse + 0.45 : pulse
    mat.opacity = hot ? 0.55 : 0.28
  })

  return (
    <group position={[VAT_POSITION[0], 0.013, VAT_POSITION[2]]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[VAT_ZONE_RADIUS * 0.62, VAT_ZONE_RADIUS * 0.92, 40]} />
        <meshStandardMaterial
          color={VR_THEME.cyan}
          emissive={VR_THEME.cyan}
          emissiveIntensity={0.35}
          transparent
          opacity={0.28}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[VAT_ZONE_RADIUS * 0.58, 40]} />
        <meshStandardMaterial
          color={VR_THEME.magenta}
          emissive={VR_THEME.magenta}
          emissiveIntensity={0.12}
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
