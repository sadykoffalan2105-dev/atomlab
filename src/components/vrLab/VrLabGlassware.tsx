import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VrLabTubeContent } from '../../vrLab/types'

type Props = {
  position?: [number, number, number]
  label?: string
  content: VrLabTubeContent | null
  selected?: boolean
  onClick?: () => void
  scale?: number
}

export function VrLabTestTube({
  position = [0, 0, 0],
  label,
  content,
  selected = false,
  onClick,
  scale = 1,
}: Props) {
  const liquidRef = useRef<THREE.Mesh>(null)
  const fill = content?.fillLevel ?? 0
  const color = content?.liquidColor ?? '#3a4a6a'

  useFrame(() => {
    if (liquidRef.current && content) {
      liquidRef.current.position.y = -0.18 + fill * 0.32
      const mat = liquidRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.28 + Math.sin(performance.now() * 0.002) * 0.06
    }
  })

  const glassMat = useMemo(
    () => ({
      color: '#e8f4ff',
      transmission: 0.92,
      thickness: 0.15,
      roughness: 0.08,
      transparent: true,
      opacity: 0.55,
    }),
    [],
  )

  return (
    <group position={position} scale={scale} onClick={onClick}>
      {selected ? (
        <mesh position={[0, 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.26, 32]} />
          <meshBasicMaterial color="#5cffd4" transparent opacity={0.85} />
        </mesh>
      ) : null}

      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.11, 0.13, 0.52, 24]} />
        <meshPhysicalMaterial {...glassMat} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.14, 16]} />
        <meshPhysicalMaterial {...glassMat} />
      </mesh>

      {/* Жидкость */}
      {content ? (
        <mesh ref={liquidRef} position={[0, -0.18 + fill * 0.32, 0]}>
          <cylinderGeometry args={[0.095, 0.105, Math.max(0.04, fill * 0.42), 20]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.35}
            transparent
            opacity={0.9}
            roughness={0.25}
          />
        </mesh>
      ) : null}

      {label ? (
        <mesh position={[0, -0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.18, 0.18]} />
          <meshBasicMaterial color="#1a2038" transparent opacity={0.001} />
        </mesh>
      ) : null}
    </group>
  )
}

export function VrLabBeaker({
  position = [0, 0, 0],
  content,
  mixing = false,
}: {
  position?: [number, number, number]
  content: VrLabTubeContent | null
  mixing?: boolean
}) {
  const liquidRef = useRef<THREE.Mesh>(null)
  const fill = content?.fillLevel ?? 0
  const color = content?.liquidColor ?? '#2a3550'

  useFrame((_, dt) => {
    if (!liquidRef.current) return
    if (mixing) {
      liquidRef.current.rotation.y += dt * 2.5
      const mat = liquidRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.55 + Math.sin(performance.now() * 0.012) * 0.25
    }
  })

  return (
    <group position={position}>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.28, 0.32, 0.38, 28]} />
        <meshPhysicalMaterial
          color="#e0f0ff"
          transmission={0.88}
          thickness={0.18}
          transparent
          opacity={0.5}
        />
      </mesh>
      {content ? (
        <mesh ref={liquidRef} position={[0, 0.02 + fill * 0.14, 0]}>
          <cylinderGeometry args={[0.24, 0.27, Math.max(0.06, fill * 0.28), 24]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={mixing ? 0.65 : 0.38}
            transparent
            opacity={0.92}
          />
        </mesh>
      ) : null}
    </group>
  )
}

export function VrLabBenchTable({ width = 4.2 }: { width?: number }) {
  return (
    <group>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[width, 0.08, 1.6]} />
        <meshStandardMaterial color="#8a95a8" roughness={0.55} metalness={0.12} />
      </mesh>
      <mesh position={[0, -0.28, 0]}>
        <boxGeometry args={[width * 0.92, 0.42, 1.35]} />
        <meshStandardMaterial color="#5c6575" roughness={0.65} />
      </mesh>
      {/* Задняя стенка лаборатории */}
      <mesh position={[0, 0.85, -0.72]}>
        <planeGeometry args={[width, 1.8]} />
        <meshStandardMaterial color="#121828" roughness={0.9} />
      </mesh>
    </group>
  )
}

export function VrLabTubeRack({ tubeCount = 4 }: { tubeCount?: number }) {
  return (
    <group position={[-1.35, 0.04, 0]}>
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[1.05, 0.06, 0.28]} />
        <meshStandardMaterial color="#c8d4e8" roughness={0.4} metalness={0.25} />
      </mesh>
      {Array.from({ length: tubeCount }, (_, i) => (
        <mesh key={i} position={[-0.36 + i * 0.24, 0.06, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.12, 16]} />
          <meshStandardMaterial color="#aebcd4" metalness={0.35} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}
