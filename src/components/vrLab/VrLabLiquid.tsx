import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clamp01, easeOutCubic, lerp } from '../../vrLab/vrLabAnimation'
import { VR_THEME } from './vrLabTheme'

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
      mat.emissiveIntensity = mixing
        ? 0.75 + Math.sin(state.clock.elapsedTime * 8) * 0.2
        : 0.55 + Math.sin(state.clock.elapsedTime * 2.5 + baseY) * 0.1
    }

    if (surfaceRef.current) {
      const wave = mixing ? Math.sin(state.clock.elapsedTime * 12) * 0.012 : Math.sin(state.clock.elapsedTime * 3) * 0.004
      surfaceRef.current.position.y = baseY + h + wave
      surfaceRef.current.scale.setScalar(rTop * (1 + wave * 2))
      const smat = surfaceRef.current.material as THREE.MeshStandardMaterial
      smat.color.copy(colorRef.current)
      smat.emissive.copy(colorRef.current)
      smat.emissiveIntensity = mixing ? 0.9 : 0.65
      surfaceRef.current.rotation.z = mixing ? state.clock.elapsedTime * 2 : 0
    }
  })

  if (targetFill < 0.01 && displayFill.current < 0.01) return null

  return (
    <group>
      <mesh ref={meshRef} position={[0, baseY + maxHeight / 2, 0]}>
        <cylinderGeometry args={[radiusTop, radiusBottom, maxHeight, 20, 1]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          transparent
          opacity={0.9}
          roughness={0.1}
          metalness={0.04}
          clearcoat={0.8}
          clearcoatRoughness={0.12}
        />
      </mesh>
      <mesh ref={surfaceRef} position={[0, baseY + maxHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radiusTop * 0.88, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.65}
          transparent
          opacity={0.78}
          roughness={0.04}
          metalness={0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/** Двухцветная вихревая жидкость для ёмкости смешивания (как на референсе). */
export function VrLabSwirlLiquid({
  colorA,
  colorB,
  targetFill,
  radius,
  maxHeight,
  baseY,
  mixing = false,
}: {
  colorA: string
  colorB: string
  targetFill: number
  radius: number
  maxHeight: number
  baseY: number
  mixing?: boolean
}) {
  const layerA = useRef<THREE.Mesh>(null)
  const layerB = useRef<THREE.Mesh>(null)
  const fillRef = useRef(targetFill)

  useFrame((state, dt) => {
    fillRef.current = lerp(fillRef.current, targetFill, Math.min(1, dt * 3))
    const f = clamp01(fillRef.current)
    if (f < 0.02) return
    const h = Math.max(0.03, f * maxHeight)
    const pulse = mixing ? 0.85 + Math.sin(state.clock.elapsedTime * 6) * 0.15 : 0.65
    const spin = state.clock.elapsedTime * (mixing ? 1.8 : 0.4)

    if (layerA.current) {
      layerA.current.position.y = baseY + h * 0.45
      layerA.current.scale.set(radius * 0.92, h * 0.55, radius * 0.92)
      layerA.current.rotation.y = spin
      const m = layerA.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = pulse
    }
    if (layerB.current) {
      layerB.current.position.y = baseY + h * 0.72
      layerB.current.scale.set(radius * 0.78, h * 0.35, radius * 0.78)
      layerB.current.rotation.y = -spin * 1.3
      const m = layerB.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = pulse * 0.9
    }
  })

  if (targetFill < 0.01 && fillRef.current < 0.01) return null

  return (
    <group>
      <mesh ref={layerA} position={[0, baseY + maxHeight / 2, 0]}>
        <cylinderGeometry args={[1, 1, 1, 24]} />
        <meshStandardMaterial
          color={colorA}
          emissive={colorA}
          emissiveIntensity={0.65}
          transparent
          opacity={0.88}
          roughness={0.12}
        />
      </mesh>
      <mesh ref={layerB} position={[0, baseY + maxHeight * 0.75, 0]}>
        <cylinderGeometry args={[1, 0.85, 1, 24]} />
        <meshStandardMaterial
          color={colorB}
          emissive={colorB}
          emissiveIntensity={0.6}
          transparent
          opacity={0.82}
          roughness={0.12}
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
      <cylinderGeometry args={[0.016, 0.024, 1, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.85}
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </mesh>
  )
}

/** Декоративная неоновая жидкость в колбе (без анимации наливания). */
export function VrLabStaticNeonLiquid({
  color,
  radius,
  height,
  baseY,
}: {
  color: string
  radius: number
  height: number
  baseY: number
}) {
  return (
    <mesh position={[0, baseY + height / 2, 0]}>
      <cylinderGeometry args={[radius * 0.88, radius * 0.95, height, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.85}
        transparent
        opacity={0.9}
        roughness={0.1}
      />
    </mesh>
  )
}

export { VR_THEME }
