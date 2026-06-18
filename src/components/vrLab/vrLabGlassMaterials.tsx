import { MeshTransmissionMaterial } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useVrLabPerf } from './vrLabPerformance'

type GlassProps = {
  color?: string
  roughness?: number
  ior?: number
}

/** Единый материал стекла — transmission только на high tier (экономия GPU). */
export function VrLabGlassMaterial({
  color = '#eef4ff',
  roughness = 0.06,
  ior = 1.52,
}: GlassProps) {
  const { useTransmission } = useVrLabPerf()

  const cheapMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness,
        metalness: 0,
        transmission: 0.88,
        thickness: 0.45,
        transparent: true,
        opacity: 0.42,
        ior,
        envMapIntensity: 0.8,
      }),
    [color, roughness, ior],
  )

  if (useTransmission) {
    return (
      <MeshTransmissionMaterial
        backside
        samples={2}
        thickness={0.3}
        roughness={roughness}
        ior={ior}
        color={color}
        chromaticAberration={0.04}
        anisotropy={0.08}
      />
    )
  }

  return <primitive attach="material" object={cheapMat} />
}

/** Неоновая жидкость — один shared-стиль для всех колб. */
export function useNeonLiquidMaterial(color: string, emissiveIntensity = 0.7) {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: new THREE.Color(color),
        emissiveIntensity,
        transparent: true,
        opacity: 0.92,
        roughness: 0.15,
        metalness: 0.05,
      }),
    [color, emissiveIntensity],
  )
}
