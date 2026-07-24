import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { sharedSphere } from './sharedGeometries'
import { sharedAtomMaterial } from './sciMaterialCache'
import type { SciFxQualityOpts } from './quality'

/**
 * CPK-атом: общий MeshStandardMaterial (кэш по цвету) + аддитивный glow.
 * Без transmission/MeshPhysical — рефракция очень дорога при 16+ атомах на сцене.
 */
export function SciProAtom({
  symbol,
  color,
  radius = 0.28,
  emissiveBoost = 0.45,
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
  const tick = useRef(0)
  const coreGeo = useMemo(
    () => sharedSphere(radius, quality.atomSegW, quality.atomSegH),
    [radius, quality.atomSegW, quality.atomSegH],
  )
  const glowGeo = useMemo(
    () =>
      sharedSphere(
        radius,
        Math.max(8, quality.atomSegW - 4),
        Math.max(6, quality.atomSegH - 4),
      ),
    [radius, quality.atomSegW, quality.atomSegH],
  )
  const coreMat = useMemo(
    () => (quality.richMaterials ? sharedAtomMaterial(hex, emissiveBoost) : null),
    [hex, emissiveBoost, quality.richMaterials],
  )

  useFrame((s) => {
    if (!glowRef.current) return
    // Пульс раз в 2 кадра — меньше CPU на 16+ атомах
    tick.current += 1
    if (tick.current % 2 !== 0) return
    const p = 1.06 + 0.04 * Math.sin(s.clock.elapsedTime * 2.0 + radius * 7)
    glowRef.current.scale.setScalar(p)
  })

  return (
    <group>
      <mesh ref={glowRef} geometry={glowGeo} scale={1.35} renderOrder={-1} dispose={null}>
        <meshBasicMaterial
          color={hex}
          transparent
          opacity={quality.richMaterials ? 0.16 : 0.1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh geometry={coreGeo} renderOrder={1} dispose={null} material={coreMat ?? undefined}>
        {coreMat ? null : <meshBasicMaterial color={hex} />}
      </mesh>
      {quality.atomLabels ? (
        <Billboard position={[0, radius * 1.55, 0]} follow>
          <Text
            fontSize={radius * 0.85}
            color="#f4fbff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.016}
            outlineColor="#061018"
            fillOpacity={0.95}
            material-side={THREE.FrontSide}
          >
            {symbol}
          </Text>
        </Billboard>
      ) : null}
    </group>
  )
}
