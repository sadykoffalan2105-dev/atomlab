import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cinemaSphere } from '../core/geometries'
import { crystalCoreMaterial, fresnelShellMaterial } from '../core/materials'
import type { CinemaQuality } from '../core/quality'
import { useCinemaTime } from './CinemaTime'

/**
 * Атом кинематографического микромира.
 *
 * Два слоя: кристаллическая PBR-оболочка и френелевская кромка с искрой ядра в
 * центре. Вместе читаются как стеклянный шар с искрой внутри, но стоят два
 * draw call — transmission/рефракция на десяти атомах убивает 60 FPS.
 *
 * Отдельного меша ядра нет сознательно: внутри полупрозрачного ядра, которое
 * пишет глубину, он не проходил depth test и тратил draw call впустую. Искра
 * теперь — член шейдера оболочки (fresnelShellMaterial, параметр spark).
 * На lite оболочки нет — остаётся одно ядро, один draw call на атом.
 *
 * Подписей (troika Text) у атома нет: формулы и заряды рисует CinemaDomLabels.
 */

function breatheShell(mesh: THREE.Mesh | null, t: number, seed: number): void {
  if (mesh) mesh.scale.setScalar(1 + 0.012 * Math.sin(t * 1.7 + seed * 2))
}

export function CinemaAtom({
  color,
  radius,
  quality,
  emissive = 0.55,
  chargeSign,
}: {
  color: number
  radius: number
  quality: CinemaQuality
  emissive?: number
  /** знак иона: подсвечивает кромку теплее (катион) или холоднее (анион) */
  chargeSign?: 1 | -1 | 0
}) {
  const shellRef = useRef<THREE.Mesh>(null)
  const time = useCinemaTime()
  // Фаза «дыхания» выводится из свойств атома, а не из random: сцена должна
  // выглядеть одинаково при каждом запуске урока.
  const seed = useMemo(() => ((color % 97) * 0.13 + radius * 11.7) % 6.283, [color, radius])

  const coreGeo = useMemo(
    () => cinemaSphere(radius, quality.atomSegW, quality.atomSegH),
    [radius, quality.atomSegW, quality.atomSegH],
  )
  const shellGeo = useMemo(
    () => cinemaSphere(radius * 1.06, Math.max(12, quality.atomSegW - 6), Math.max(10, quality.atomSegH - 4)),
    [radius, quality.atomSegW, quality.atomSegH],
  )

  const coreMat = useMemo(() => crystalCoreMaterial(color, emissive, 0.9), [color, emissive])
  const shellColor = useMemo(() => {
    if (chargeSign === 1) return 0xffd9a0
    if (chargeSign === -1) return 0x9be8ff
    return color
  }, [chargeSign, color])
  // Искра ярче у «энергичных» атомов (ионы Na⁺), но ниже порога bloom:
  // светится энергия реакции, а не каждый атом.
  const spark = Math.round((0.12 + emissive * 0.3) * 100) / 100
  const shellMat = useMemo(() => fresnelShellMaterial(shellColor, 2.6, 0.85, spark), [shellColor, spark])

  useFrame(() => {
    // Дыхание кромки: атом «живой», но амплитуда микроскопическая —
    // молекула не должна выглядеть желейной.
    breatheShell(shellRef.current, time.current.visual, seed)
  })

  return (
    <group>
      <mesh geometry={coreGeo} material={coreMat} dispose={null} />
      {quality.shell ? (
        <mesh ref={shellRef} geometry={shellGeo} material={shellMat} dispose={null} renderOrder={3} />
      ) : null}
    </group>
  )
}
