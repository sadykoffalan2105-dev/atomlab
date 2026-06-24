import { MeshTransmissionMaterial } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { getGlassScratchNormal, getSharedGlassMaterial } from './vrLabTextureCache'
import { useVrLabPerf } from './vrLabPerformance'

export type GlassVariant = 'lab' | 'vessel' | 'accent'

const PHYSICAL: Record<
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

const TRANSMISSION: Record<
  GlassVariant,
  { ior: number; thickness: number; roughness: number; chromaticAberration: number; samples: number }
> = {
  lab: { ior: 1.52, thickness: 0.65, roughness: 0.04, chromaticAberration: 0.025, samples: 4 },
  vessel: { ior: 1.52, thickness: 0.85, roughness: 0.025, chromaticAberration: 0.04, samples: 5 },
  accent: { ior: 1.48, thickness: 0.45, roughness: 0.05, chromaticAberration: 0.02, samples: 3 },
}

function PhysicalGlassMaterial({
  color,
  variant,
  useScratch,
}: {
  color: string
  variant: GlassVariant
  useScratch: boolean
}) {
  const scratch = useMemo(() => (useScratch ? getGlassScratchNormal() : null), [useScratch])
  const mat = useMemo(() => {
    const p = PHYSICAL[variant]
    return new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0,
      envMapIntensity: 1.6,
      transparent: true,
      side: THREE.FrontSide,
      normalMap: scratch ?? undefined,
      normalScale: scratch ? new THREE.Vector2(0.15, 0.15) : undefined,
      ...p,
    })
  }, [color, scratch, variant])

  return <primitive attach="material" object={mat} />
}

/** Стекло: transmission только на highlight-сосудах (LOD), иначе physical. */
export function VrLabGlassMaterial({
  color = '#eef6ff',
  variant = 'lab',
  highlight = false,
}: {
  color?: string
  variant?: GlassVariant
  highlight?: boolean
}) {
  const { cinematicGlass, tier } = useVrLabPerf()
  const t = TRANSMISSION[variant]
  const useTransmission = cinematicGlass && highlight

  if (tier === 'low') {
    const shared = getSharedGlassMaterial()
    return <primitive attach="material" object={shared} />
  }

  if (useTransmission) {
    return (
      <MeshTransmissionMaterial
        transmission={1}
        ior={t.ior}
        thickness={t.thickness}
        roughness={t.roughness}
        chromaticAberration={t.chromaticAberration}
        anisotropy={0.12}
        samples={Math.min(3, t.samples)}
        resolution={384}
        backside
        backsideThickness={t.thickness * 0.6}
        color={color}
        attenuationColor="#a8d4ff"
        attenuationDistance={0.35}
        envMapIntensity={1.4}
      />
    )
  }

  return <PhysicalGlassMaterial color={color} variant={variant} useScratch={tier === 'high'} />
}

/** Inner shell for rim refraction (high tier only). */
export function VrLabGlassInnerShell({
  geometry,
  color = '#eef6ff',
}: {
  geometry: THREE.BufferGeometry
  color?: string
}) {
  const { tier } = useVrLabPerf()
  if (tier !== 'high') return null
  return (
    <mesh geometry={geometry} scale={0.96}>
      <meshPhysicalMaterial
        color={color}
        side={THREE.BackSide}
        transmission={0.35}
        thickness={0.2}
        roughness={0.08}
        transparent
        opacity={0.25}
        ior={1.52}
        envMapIntensity={1.2}
      />
    </mesh>
  )
}
