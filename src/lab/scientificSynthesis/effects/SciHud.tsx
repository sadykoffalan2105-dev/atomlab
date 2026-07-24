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
    <Billboard position={position} follow>
      <mesh position={[0, 0, -0.02]} geometry={sharedCircle(0.26, 20)} dispose={null}>
        <meshBasicMaterial color="#041820" transparent opacity={0.55} depthWrite={false} depthTest />
      </mesh>
      <mesh position={[0, 0, -0.01]} geometry={sharedRing(0.22, 0.28, 20)} dispose={null}>
        <meshBasicMaterial
          color="#5cf0ff"
          transparent
          opacity={0.7}
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <Text
        fontSize={0.28}
        color="#9ef7ff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#021018"
        depthOffset={-1}
        material-side={THREE.FrontSide}
      >
        {String(value)}
      </Text>
      {label ? (
        <Text
          position={[0, -0.3, 0]}
          fontSize={0.1}
          color="#d7f4ff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.005}
          outlineColor="#041018"
          depthOffset={-1}
          material-side={THREE.FrontSide}
        >
          {label}
        </Text>
      ) : null}
    </Billboard>
  )
}

export function SciStageCaption({ text }: { text: string }) {
  return (
    <Billboard position={[0, 1.85, 0]} follow>
      <Text
        fontSize={0.14}
        color="#d8f4ff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.006}
        outlineColor="#041018"
        maxWidth={5.2}
        textAlign="center"
        material-side={THREE.FrontSide}
        depthOffset={-1}
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
