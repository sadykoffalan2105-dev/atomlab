import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GPUParticleSystem } from '../../../vrLab/core/GPUParticleSystem'
import { useVrLabPerf } from '../vrLabPerformance'
import { VR_THEME } from '../vrLabTheme'

type SteamProps = {
  mode: 'steam'
  active: boolean
  intensity: number
  color?: string
  spread?: number
  gasPlume?: boolean
  position?: [number, number, number]
}

type DustProps = {
  mode: 'dust'
  count?: number
}

type Props = SteamProps | DustProps

function createSteamSystem(count: number, color: string, spread: number) {
  const geo = new THREE.SphereGeometry(1, 6, 6)
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  return new GPUParticleSystem(
    count,
    geo,
    mat,
    'steam',
    () => ({
      x: (Math.random() - 0.5) * spread,
      z: (Math.random() - 0.5) * spread,
      y: Math.random() * 0.08,
      speed: 0.06 + Math.random() * 0.12,
      phase: Math.random() * Math.PI * 2,
      size: 0.025 + Math.random() * 0.035,
      drift: 0,
    }),
  )
}

function createDustSystem(count: number) {
  const geo = new THREE.SphereGeometry(1, 4, 4)
  const mat = new THREE.MeshStandardMaterial({
    color: VR_THEME.cyan,
    emissive: VR_THEME.cyan,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  })
  return new GPUParticleSystem(
    count,
    geo,
    mat,
    'dust',
    (i) => ({
      x: (Math.random() - 0.5) * 4.5,
      y: 0.15 + Math.random() * 1.1,
      z: (Math.random() - 0.5) * 2.2,
      speed: 0.015 + (i % 5) * 0.004,
      phase: Math.random() * Math.PI * 2,
      size: 0.012,
      drift: 0.008,
    }),
  )
}

/** Унифицированные GPU-instanced частицы (пар / пыль). */
export function GPUParticleField(props: Props) {
  const { tier, steamCount } = useVrLabPerf()
  const systemRef = useRef<GPUParticleSystem | null>(null)

  const steamCountResolved =
    props.mode === 'steam'
      ? tier === 'high'
        ? steamCount
        : Math.max(8, Math.floor(steamCount * 0.55))
      : 0

  const dustCount =
    props.mode === 'dust'
      ? tier === 'low'
        ? Math.min(16, props.count ?? 40)
        : (props.count ?? 40)
      : 0

  const system = useMemo(() => {
    systemRef.current?.dispose()
    if (props.mode === 'steam') {
      const s = createSteamSystem(
        steamCountResolved,
        props.color ?? '#e8f4ff',
        props.spread ?? 0.2,
      )
      systemRef.current = s
      return s
    }
    const s = createDustSystem(dustCount)
    systemRef.current = s
    return s
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild on count/color change only
  }, [
    props.mode,
    props.mode === 'steam' ? props.color : '',
    props.mode === 'steam' ? props.spread : 0,
    steamCountResolved,
    dustCount,
  ])

  useEffect(() => () => system.dispose(), [system])

  useFrame((state, dt) => {
    if (props.mode === 'steam') {
      if (!props.active || props.intensity < 0.04) {
        system.mesh.count = 0
        return
      }
      system.tick(state.clock.elapsedTime, dt, props.intensity, props.spread ?? 0.2, props.gasPlume ?? false)
      return
    }
    system.tick(state.clock.elapsedTime, dt, 1, 0, false)
  })

  if (props.mode === 'steam' && (!props.active || props.intensity < 0.04 || steamCountResolved === 0)) {
    return null
  }

  if (props.mode === 'dust' && tier === 'low' && dustCount === 0) return null

  return (
    <group position={props.mode === 'steam' ? (props.position ?? [0, 0, 0]) : undefined}>
      <primitive object={system.mesh} />
    </group>
  )
}
