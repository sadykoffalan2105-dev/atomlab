import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { sharedSphere } from './sharedGeometries'
import type { SciFxQualityOpts } from './quality'

/** CPK-атом: ядро + аддитивное свечение. Без transmission на lite. */
export function SciProAtom({
  symbol,
  color,
  radius = 0.28,
  emissiveBoost = 0.4,
  quality,
}: {
  symbol: string
  color: number
  radius?: number
  emissiveBoost?: number
  quality: SciFxQualityOpts
}) {
  const hex = useMemo(() => `#${color.toString(16).padStart(6, '0')}`, [color])
  const glowRef = useRef<THREE.Mesh>(null)
  const coreGeo = useMemo(
    () => sharedSphere(radius, quality.atomSegW, quality.atomSegH),
    [radius, quality.atomSegW, quality.atomSegH],
  )
  const glowGeo = useMemo(
    () => sharedSphere(radius, Math.max(10, quality.atomSegW - 8), Math.max(8, quality.atomSegH - 6)),
    [radius, quality.atomSegW, quality.atomSegH],
  )

  useFrame((s) => {
    if (!glowRef.current) return
    // лёгкий pulse без аллокаций
    const p = 1.08 + 0.05 * Math.sin(s.clock.elapsedTime * 2.1 + radius * 7)
    glowRef.current.scale.setScalar(p)
  })

  return (
    <group>
      <mesh ref={glowRef} geometry={glowGeo} scale={1.45} renderOrder={-1} dispose={null}>
        <meshBasicMaterial
          color={hex}
          transparent
          opacity={quality.richMaterials ? 0.18 : 0.12}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh geometry={coreGeo} renderOrder={1} dispose={null}>
        {quality.richMaterials ? (
          <meshStandardMaterial
            color={hex}
            emissive={hex}
            emissiveIntensity={emissiveBoost}
            roughness={0.32}
            metalness={0.18}
          />
        ) : (
          <meshBasicMaterial color={hex} />
        )}
      </mesh>
      {quality.atomLabels ? (
        <Billboard position={[0, radius * 1.5, 0]} follow>
          <Text
            fontSize={radius * 0.9}
            color="#f4fbff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.018}
            outlineColor="#061018"
            fillOpacity={0.95}
          >
            {symbol}
          </Text>
        </Billboard>
      ) : null}
    </group>
  )
}
