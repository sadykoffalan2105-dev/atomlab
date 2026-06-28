import { useRef } from 'react'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

/** Badge ×N for cluster/lite tier when coeff > visible instances. */
export function ReactorCoeffBadge({
  coeff,
  position,
  visible = true,
}: {
  coeff: number
  position: [number, number, number]
  visible?: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  if (!visible || coeff <= 1) return null
  const label = `×${coeff}`
  return (
    <group ref={groupRef} position={position}>
      <Text
        fontSize={0.22}
        color="#e8f4ff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#0a1628"
        fillOpacity={0.95}
      >
        {label}
      </Text>
    </group>
  )
}
