/**
 * Lab-lite атмосфера: кольца + тонкая оболочка БЕЗ transmission.
 * Catalog full aura (meshPhysicalMaterial transmission) валит слабый WebGL → белый экран.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hash32 } from '../../chemistry/placeholderMolecule'

export function LabLiteAuraBubble({
  accentColor,
  compoundId,
}: {
  accentColor: string
  compoundId: string
}) {
  const col = useMemo(() => new THREE.Color(accentColor), [accentColor])
  const gRings = useRef<THREE.Group>(null)
  const phase = hash32(`${compoundId}_lab_aura`) * 0.02

  useFrame((s) => {
    const t = s.clock.elapsedTime + phase
    if (gRings.current) {
      gRings.current.rotation.y = t * 0.1
      gRings.current.rotation.z = Math.sin(t * 0.08) * 0.05
    }
  })

  const shellHex = `#${col.getHexString()}`

  return (
    <group position={[0, 0.02, 0]} renderOrder={-3}>
      {/* Одна дешёвая оболочка — без transmission / PhysicalMaterial */}
      <mesh scale={1.2}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial
          color={shellHex}
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <group ref={gRings}>
        <mesh rotation={[Math.PI / 2.35, 0.4, 0.2]}>
          <ringGeometry args={[0.88, 1.02, 48]} />
          <meshBasicMaterial
            color={shellHex}
            transparent
            opacity={0.34}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh rotation={[0.35, Math.PI / 2.1, 0.5]}>
          <ringGeometry args={[0.9, 1.04, 48]} />
          <meshBasicMaterial
            color={shellHex}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  )
}
