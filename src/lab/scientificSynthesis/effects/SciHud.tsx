import { Billboard, Text } from '@react-three/drei'
import type { RefObject } from 'react'
import * as THREE from 'three'
import { sharedCircle, sharedRing } from './sharedGeometries'

export function SciStoichBadge({
  value,
  position,
  visible,
  label,
}: {
  value: number
  position: [number, number, number]
  visible: boolean
  label?: string
}) {
  if (!visible) return null
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.02]} geometry={sharedCircle(0.3, 24)} dispose={null}>
        <meshBasicMaterial color="#041820" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -0.01]} geometry={sharedRing(0.26, 0.32, 24)} dispose={null}>
        <meshBasicMaterial
          color="#5cf0ff"
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <Text
        fontSize={0.34}
        color="#9ef7ff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.014}
        outlineColor="#021018"
      >
        {String(value)}
      </Text>
      {label ? (
        <Text
          position={[0, -0.36, 0]}
          fontSize={0.12}
          color="#d7f4ff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.006}
          outlineColor="#041018"
        >
          {label}
        </Text>
      ) : null}
    </group>
  )
}

export function SciStageCaption({ text }: { text: string }) {
  return (
    <Billboard position={[0, 2.3, 0]} follow>
      <Text
        fontSize={0.17}
        color="#d8f4ff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.007}
        outlineColor="#041018"
        maxWidth={6.2}
        textAlign="center"
      >
        {text}
      </Text>
    </Billboard>
  )
}

/** Импульс электрона / фотона. */
export function SciElectronImpulse() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh scale={2.1}>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshBasicMaterial
          color="#7ef0ff"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export function SciAmberHalo({ meshRef, radius = 0.95 }: { meshRef: RefObject<THREE.Mesh | null>; radius?: number }) {
  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[radius, 18, 14]} />
      <meshBasicMaterial
        color="#e8a040"
        transparent
        opacity={0.2}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}
