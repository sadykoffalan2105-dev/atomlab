import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clamp01, easeOutCubic, lerp } from '../../../vrLab/vrLabAnimation'
import type { LiquidVisual } from '../VrLabLiquid'

function buildPourCurve(
  from: THREE.Vector3,
  to: THREE.Vector3,
  arc: number,
): THREE.CatmullRomCurve3 {
  const mid = new THREE.Vector3().lerpVectors(from, to, 0.45)
  mid.y += arc
  const cp1 = new THREE.Vector3(from.x, from.y - 0.04, from.z)
  const cp2 = new THREE.Vector3(to.x + (from.x - to.x) * 0.15, mid.y, to.z)
  return new THREE.CatmullRomCurve3([from, cp1, cp2, to], false, 'catmullrom', 0.6)
}

type Props = {
  active: boolean
  visual: LiquidVisual
  from: [number, number, number]
  to: [number, number, number]
  progress: number
  arc?: number
  radius?: number
}

/** Струя переливания — spline-трубка с каплями. */
export function PourStreamRibbon({
  active,
  visual,
  from,
  to,
  progress,
  arc = 0.12,
  radius = 0.013,
}: Props) {
  const tubeRef = useRef<THREE.Mesh>(null)
  const dropRef = useRef<THREE.Mesh>(null)
  const t = clamp01(progress)

  const { curve, geometry } = useMemo(() => {
    const f = new THREE.Vector3(...from)
    const target = new THREE.Vector3(...to)
    const c = buildPourCurve(f, target, arc)
    const geo = new THREE.TubeGeometry(c, 24, radius, 8, false)
    return { curve: c, geometry: geo }
  }, [arc, from, to, radius])

  useFrame(() => {
    if (!active || t >= 1) return
    const eased = easeOutCubic(t)
    const visibleEnd = Math.max(0.08, eased)

    if (tubeRef.current) {
      tubeRef.current.visible = eased > 0.02
      const mat = tubeRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = visual.opacity * (0.92 - eased * 0.15)
      mat.emissiveIntensity = visual.glow * (1.3 - eased * 0.2)
    }

    if (dropRef.current) {
      const pt = curve.getPointAt(Math.min(0.98, visibleEnd))
      dropRef.current.position.copy(pt)
      dropRef.current.visible = eased > 0.05 && eased < 0.98
      const scale = radius * (2.2 + Math.sin(eased * Math.PI) * 0.8)
      dropRef.current.scale.setScalar(scale / radius)
    }
  })

  if (!active || t >= 1 || t <= 0.01) return null

  return (
    <group>
      <mesh ref={tubeRef} geometry={geometry}>
        <meshStandardMaterial
          color={visual.liquidColor}
          emissive={visual.emissive}
          emissiveIntensity={visual.glow * 1.25}
          transparent
          opacity={visual.opacity}
          roughness={0.15}
          metalness={0.05}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={dropRef}>
        <sphereGeometry args={[radius, 10, 10]} />
        <meshStandardMaterial
          color={visual.liquidColor}
          emissive={visual.emissive}
          emissiveIntensity={visual.glow * 1.6}
          transparent
          opacity={0.95}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/** Локальная струя из горлышка колбы (координаты относительно колбы). */
export function PourStreamLocal({
  active,
  visual,
  progress,
  tiltMix = 0,
}: {
  active: boolean
  visual: LiquidVisual
  progress: number
  tiltMix?: number
}) {
  const spoutY = 0.14 + tiltMix * 0.04
  const spoutX = 0.02 + tiltMix * 0.06
  const endY = lerp(spoutY, 0.02, easeOutCubic(clamp01(progress)))

  return (
    <PourStreamRibbon
      active={active}
      visual={visual}
      from={[spoutX, spoutY, 0.02]}
      to={[spoutX * 0.5, endY, 0]}
      progress={progress}
      arc={0.04}
      radius={0.009}
    />
  )
}
