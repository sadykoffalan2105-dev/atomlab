import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { cinemaSphere } from '../core/geometries'
import { sceneText } from '../core/glyphs'
import { crystalCoreMaterial, fresnelShellMaterial, nucleusMaterial } from '../core/materials'
import type { CinemaQuality } from '../core/quality'

/**
 * Атом кинематографического микромира.
 *
 * Три слоя: кристаллическая PBR-оболочка, светящееся ядро внутри и френелевская
 * кромка. Вместе читаются как стеклянный шар с искрой внутри, но стоят один
 * дешёвый шейдер — transmission/рефракция на десяти атомах убивает 60 FPS.
 */
export function CinemaAtom({
  color,
  radius,
  quality,
  label,
  emissive = 0.55,
  nucleusScale = 0.34,
  chargeSign,
}: {
  color: number
  radius: number
  quality: CinemaQuality
  label?: string
  emissive?: number
  nucleusScale?: number
  /** знак иона: подсвечивает кромку теплее (катион) или холоднее (анион) */
  chargeSign?: 1 | -1 | 0
}) {
  const shellRef = useRef<THREE.Mesh>(null)
  const nucleusRef = useRef<THREE.Mesh>(null)
  // Фаза «дыхания» выводится из свойств атома, а не из random: сцена должна
  // выглядеть одинаково при каждом запуске урока.
  const seed = useMemo(() => ((color % 97) * 0.13 + radius * 11.7) % 6.283, [color, radius])

  const coreGeo = useMemo(
    () => cinemaSphere(radius, quality.atomSegW, quality.atomSegH),
    [radius, quality.atomSegW, quality.atomSegH],
  )
  const nucleusGeo = useMemo(() => cinemaSphere(radius * nucleusScale, 12, 10), [radius, nucleusScale])
  const shellGeo = useMemo(
    () => cinemaSphere(radius * 1.06, Math.max(12, quality.atomSegW - 6), Math.max(10, quality.atomSegH - 4)),
    [radius, quality.atomSegW, quality.atomSegH],
  )

  const coreMat = useMemo(() => crystalCoreMaterial(color, emissive, 0.9), [color, emissive])
  const nucMat = useMemo(() => nucleusMaterial(color), [color])
  const shellColor = useMemo(() => {
    if (chargeSign === 1) return 0xffd9a0
    if (chargeSign === -1) return 0x9be8ff
    return color
  }, [chargeSign, color])
  const shellMat = useMemo(() => fresnelShellMaterial(shellColor, 2.6, 0.85), [shellColor])

  useFrame((s) => {
    // Дыхание ядра: атом «живой», но амплитуда микроскопическая —
    // молекула не должна выглядеть желейной.
    const t = s.clock.elapsedTime
    if (nucleusRef.current) {
      nucleusRef.current.scale.setScalar(1 + 0.12 * Math.sin(t * 3.1 + seed))
    }
    if (shellRef.current) {
      shellRef.current.scale.setScalar(1 + 0.012 * Math.sin(t * 1.7 + seed * 2))
    }
  })

  return (
    <group>
      <mesh geometry={coreGeo} material={coreMat} dispose={null} />
      <mesh ref={nucleusRef} geometry={nucleusGeo} material={nucMat} dispose={null} renderOrder={2} />
      {quality.shell ? (
        <mesh ref={shellRef} geometry={shellGeo} material={shellMat} dispose={null} renderOrder={3} />
      ) : null}
      {label ? (
        <Billboard position={[0, radius * 1.75, 0]} follow>
          <Text
            fontSize={radius * 0.95}
            color="#eaf7ff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.012}
            outlineColor="#04121c"
            material-side={THREE.FrontSide}
            depthOffset={-1}
          >
            {sceneText(label)}
          </Text>
        </Billboard>
      ) : null}
    </group>
  )
}
