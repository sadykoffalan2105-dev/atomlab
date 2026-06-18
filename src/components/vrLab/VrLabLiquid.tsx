import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clamp01, easeOutCubic, lerp } from '../../vrLab/vrLabAnimation'

type Props = {
  color: string
  targetFill: number
  radiusTop: number
  radiusBottom: number
  maxHeight: number
  baseY: number
  mixing?: boolean
  animateIn?: boolean
}

export function VrLabLiquid({
  color,
  targetFill,
  radiusTop,
  radiusBottom,
  maxHeight,
  baseY,
  mixing = false,
  animateIn = false,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null)
  const surfaceRef = useRef<THREE.Mesh>(null)
  const displayFill = useRef(animateIn ? 0 : targetFill)
  const colorRef = useRef(new THREE.Color(color))
  const targetColor = useRef(new THREE.Color(color))

  useFrame((state, dt) => {
    targetColor.current.set(color)
    const fillSpeed = animateIn ? 1.8 : 4.5
    displayFill.current = lerp(displayFill.current, targetFill, Math.min(1, dt * fillSpeed))
    const f = clamp01(displayFill.current)
    if (f < 0.02) return

    colorRef.current.lerp(targetColor.current, Math.min(1, dt * 3))

    const h = Math.max(0.025, f * maxHeight)
    const y = baseY + h / 2
    const rTop = lerp(radiusBottom * 0.92, radiusTop * 0.92, f)

    if (meshRef.current) {
      meshRef.current.position.y = y
      meshRef.current.scale.set(rTop / radiusTop, h / maxHeight, rTop / radiusTop)
      const mat = meshRef.current.material as THREE.MeshPhysicalMaterial
      mat.color.copy(colorRef.current)
      mat.emissive.copy(colorRef.current)
      const pulse = mixing
        ? 0.45 + Math.sin(state.clock.elapsedTime * 8) * 0.2
        : 0.22 + Math.sin(state.clock.elapsedTime * 2.5 + baseY) * 0.06
      mat.emissiveIntensity = pulse
    }

    if (surfaceRef.current) {
      const wave = mixing ? Math.sin(state.clock.elapsedTime * 12) * 0.012 : Math.sin(state.clock.elapsedTime * 3) * 0.004
      surfaceRef.current.position.y = baseY + h + wave
      surfaceRef.current.scale.setScalar(rTop * (1 + wave * 2))
      const smat = surfaceRef.current.material as THREE.MeshStandardMaterial
      smat.color.copy(colorRef.current)
      smat.emissive.copy(colorRef.current)
      smat.emissiveIntensity = mixing ? 0.55 : 0.35
      surfaceRef.current.rotation.z = mixing ? state.clock.elapsedTime * 2 : 0
    }
  })

  if (targetFill < 0.01 && displayFill.current < 0.01) return null

  return (
    <group>
      <mesh ref={meshRef} position={[0, baseY + maxHeight / 2, 0]}>
        <cylinderGeometry args={[radiusTop, radiusBottom, maxHeight, 28, 1]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.25}
          transparent
          opacity={0.92}
          roughness={0.12}
          metalness={0.05}
          clearcoat={0.85}
          clearcoatRoughness={0.15}
          transmission={0.08}
          thickness={0.4}
        />
      </mesh>
      <mesh ref={surfaceRef} position={[0, baseY + maxHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radiusTop * 0.88, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          transparent
          opacity={0.75}
          roughness={0.05}
          metalness={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export function VrLabPourStream({
  active,
  color,
  from = [0, 0.9, 0] as [number, number, number],
  to = [0, 0.1, 0] as [number, number, number],
  progress,
}: {
  active: boolean
  color: string
  from?: [number, number, number]
  to?: [number, number, number]
  progress: number
}) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (!ref.current || !active) return
    const t = easeOutCubic(clamp01(progress))
    const y = lerp(from[1], to[1], t)
    const h = Math.max(0.05, from[1] - y)
    ref.current.position.set(from[0], (from[1] + y) / 2, from[2])
    ref.current.scale.set(1, h, 1)
    const mat = ref.current.material as THREE.MeshStandardMaterial
    mat.opacity = 0.75 * (1 - t * 0.3)
  })

  if (!active || progress >= 1) return null

  return (
    <mesh ref={ref} position={from}>
      <cylinderGeometry args={[0.018, 0.028, 1, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </mesh>
  )
}
