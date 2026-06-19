import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { VR_THEME } from '../vrLabTheme'

type Props = {
  active: boolean
  position: [number, number, number]
}

/** Подсветка зоны реактора во время практического задания. */
export function VrLabPracticeMissionRing({ active, position }: Props) {
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!ringRef.current || !active) return
    const mat = ringRef.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = 1.2 + Math.sin(state.clock.elapsedTime * 3.5) * 0.35
  })

  if (!active) return null

  return (
    <mesh ref={ringRef} position={[position[0], 0.035, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.13, 0.165, 36]} />
      <meshStandardMaterial
        color={VR_THEME.cyan}
        emissive={VR_THEME.cyan}
        emissiveIntensity={1.3}
        transparent
        opacity={0.82}
        depthWrite={false}
      />
    </mesh>
  )
}
