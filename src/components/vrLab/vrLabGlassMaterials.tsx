import { useMemo } from 'react'
import * as THREE from 'three'

export type GlassVariant = 'lab' | 'vessel' | 'accent'

const VARIANTS: Record<
  GlassVariant,
  Pick<
    THREE.MeshPhysicalMaterialParameters,
    'transmission' | 'thickness' | 'roughness' | 'opacity' | 'ior' | 'clearcoat' | 'clearcoatRoughness'
  >
> = {
  lab: {
    transmission: 0.88,
    thickness: 0.42,
    roughness: 0.04,
    opacity: 0.42,
    ior: 1.52,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  },
  vessel: {
    transmission: 0.92,
    thickness: 0.55,
    roughness: 0.03,
    opacity: 0.38,
    ior: 1.52,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  },
  accent: {
    transmission: 0.78,
    thickness: 0.35,
    roughness: 0.06,
    opacity: 0.48,
    ior: 1.48,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
  },
}

/** Отдельный физический материал на каждый mesh — корректные roughness/transmission. */
export function VrLabGlassMaterial({
  color = '#eef6ff',
  variant = 'lab',
}: {
  color?: string
  variant?: GlassVariant
}) {
  const mat = useMemo(() => {
    const p = VARIANTS[variant]
    return new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0,
      envMapIntensity: 1.1,
      transparent: true,
      side: THREE.FrontSide,
      ...p,
    })
  }, [color, variant])

  return <primitive attach="material" object={mat} />
}
