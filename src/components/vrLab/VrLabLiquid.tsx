import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clamp01, easeOutCubic, lerp } from '../../vrLab/vrLabAnimation'
import type { VrLabTubeContent } from '../../vrLab/types'
import { LiquidVolumeMaterialMesh, type SloshState } from './liquid/LiquidVolumeMaterial'
import { useVrLabPerf } from './vrLabPerformance'
import { VR_THEME } from './vrLabTheme'

export type LiquidVisual = Pick<
  VrLabTubeContent,
  'liquidColor' | 'emissive' | 'glow' | 'opacity' | 'viscosity'
>

export function liquidVisualFromContent(content: VrLabTubeContent | null): LiquidVisual | null {
  if (!content) return null
  return {
    liquidColor: content.liquidColor,
    emissive: content.emissive,
    glow: content.glow,
    opacity: content.opacity,
    viscosity: content.viscosity,
  }
}

function liquidVisualOrDefaults(
  visual: Partial<LiquidVisual> & { liquidColor: string },
): LiquidVisual {
  return {
    liquidColor: visual.liquidColor,
    emissive: visual.emissive ?? visual.liquidColor,
    glow: visual.glow ?? 0.6,
    opacity: visual.opacity ?? 0.9,
    viscosity: visual.viscosity ?? 0.5,
  }
}
import { InstancedBubbleField } from './gpu/InstancedBubbleField'
type Props = {
  visual: LiquidVisual
  targetFill: number
  radiusTop: number
  radiusBottom: number
  maxHeight: number
  baseY: number
  mixing?: boolean
  animateIn?: boolean
}

export function VrLabLiquid({
  visual,
  targetFill,
  radiusTop,
  radiusBottom,
  maxHeight,
  baseY,
  mixing = false,
  animateIn = false,
  tiltX = 0,
  tiltZ = 0,
  sloshX = 0,
  sloshZ = 0,
  mixRatio = 0,
  visualB,
  temperature = 0,
  sloshRef,
}: Props & {
  tiltX?: number
  tiltZ?: number
  sloshX?: number
  sloshZ?: number
  mixRatio?: number
  visualB?: LiquidVisual
  temperature?: number
  sloshRef?: RefObject<SloshState>
}) {
  const { liquidShader } = useVrLabPerf()

  if (liquidShader === 'full') {
    return (
      <LiquidVolumeMaterialMesh
        visual={visual}
        visualB={visualB}
        mixRatio={mixRatio}
        targetFill={targetFill}
        radiusTop={radiusTop}
        radiusBottom={radiusBottom}
        maxHeight={maxHeight}
        baseY={baseY}
        tiltX={tiltX}
        tiltZ={tiltZ}
        sloshX={sloshX}
        sloshZ={sloshZ}
        mixing={mixing}
        temperature={temperature}
        animateIn={animateIn}
        sloshRef={sloshRef}
      />
    )
  }

  return (
    <VrLabLiquidCylinder
      visual={visual}
      targetFill={targetFill}
      radiusTop={radiusTop}
      radiusBottom={radiusBottom}
      maxHeight={maxHeight}
      baseY={baseY}
      mixing={mixing}
      animateIn={animateIn}
    />
  )
}

function VrLabLiquidCylinder({
  visual,
  targetFill,
  radiusTop,
  radiusBottom,
  maxHeight,
  baseY,
  mixing = false,
  animateIn = false,
}: Props) {
  const v = liquidVisualOrDefaults(visual)
  const meshRef = useRef<THREE.Mesh>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const surfaceRef = useRef<THREE.Mesh>(null)
  const displayFill = useRef(animateIn ? 0 : targetFill)
  const colorRef = useRef(new THREE.Color(v.liquidColor))
  const emissiveRef = useRef(new THREE.Color(v.emissive))
  const attenuationRef = useRef(new THREE.Color(v.liquidColor))

  useFrame((state, dt) => {
    colorRef.current.set(v.liquidColor)
    emissiveRef.current.set(v.emissive)
    attenuationRef.current.set(v.liquidColor)
    const fillSpeed = animateIn ? 1.8 : 4.5
    displayFill.current = lerp(displayFill.current, targetFill, Math.min(1, dt * fillSpeed))
    const f = clamp01(displayFill.current)
    if (f < 0.02) return

    const waveSpeed = 3.5 - v.viscosity * 2
    const h = Math.max(0.025, f * maxHeight)
    const y = baseY + h / 2
    const rTop = lerp(radiusBottom * 0.9, radiusTop * 0.9, f)
    const glowBase = v.glow * (mixing ? 1.15 : 1)
    const pulse = mixing
      ? glowBase + Math.sin(state.clock.elapsedTime * 8) * 0.15
      : glowBase + Math.sin(state.clock.elapsedTime * 2.5 + baseY) * 0.08

    if (meshRef.current) {
      meshRef.current.position.y = y
      meshRef.current.scale.set(rTop / radiusTop, h / maxHeight, rTop / radiusTop)
      const mat = meshRef.current.material as THREE.MeshPhysicalMaterial
      mat.color.copy(colorRef.current)
      mat.emissive.copy(emissiveRef.current)
      mat.emissiveIntensity = pulse
      mat.opacity = v.opacity
    }

    if (coreRef.current) {
      coreRef.current.position.y = baseY + h * 0.35
      coreRef.current.scale.set(rTop * 0.55, h * 0.55, rTop * 0.55)
      const cmat = coreRef.current.material as THREE.MeshStandardMaterial
      cmat.color.copy(emissiveRef.current)
      cmat.emissive.copy(emissiveRef.current)
      cmat.emissiveIntensity = pulse * 1.35
    }

    if (surfaceRef.current) {
      const wave = mixing
        ? Math.sin(state.clock.elapsedTime * 12) * 0.012
        : Math.sin(state.clock.elapsedTime * waveSpeed) * 0.005
      surfaceRef.current.position.y = baseY + h + wave
      surfaceRef.current.scale.setScalar(rTop * (1 + wave * 1.5))
      const smat = surfaceRef.current.material as THREE.MeshStandardMaterial
      smat.color.copy(colorRef.current)
      smat.emissive.copy(emissiveRef.current)
      smat.emissiveIntensity = pulse * 1.1
      surfaceRef.current.rotation.z = mixing ? state.clock.elapsedTime * 2.2 : 0
    }
  })

  if (targetFill < 0.01 && displayFill.current < 0.01) return null

  return (
    <group>
      <mesh ref={meshRef} position={[0, baseY + maxHeight / 2, 0]}>
        <cylinderGeometry args={[radiusTop, radiusBottom, maxHeight, 24, 1]} />
        <meshPhysicalMaterial
          color={v.liquidColor}
          emissive={v.emissive}
          emissiveIntensity={v.glow}
          transparent
          opacity={v.opacity}
          roughness={0.08}
          metalness={0.06}
          clearcoat={0.9}
          clearcoatRoughness={0.1}
          transmission={0.12}
          thickness={0.4}
          ior={1.33}
          attenuationColor={attenuationRef.current}
          attenuationDistance={0.6}
        />
      </mesh>
      <mesh ref={coreRef} position={[0, baseY + maxHeight * 0.35, 0]}>
        <cylinderGeometry args={[1, 1, 1, 16]} />
        <meshStandardMaterial
          color={v.emissive}
          emissive={v.emissive}
          emissiveIntensity={v.glow * 1.2}
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={surfaceRef} position={[0, baseY + maxHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radiusTop * 0.86, 24]} />
        <meshStandardMaterial
          color={v.liquidColor}
          emissive={v.emissive}
          emissiveIntensity={v.glow}
          transparent
          opacity={0.82}
          roughness={0.04}
          metalness={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <InstancedBubbleField
        radius={radiusTop * 0.7}
        baseY={baseY}
        maxHeight={maxHeight}
        fillRef={displayFill}
        color={v.emissive}
        active={mixing}
      />
    </group>
  )
}

/** Жидкость реактора смешивания — вихрь, пена, двухцветное смешение. */
export function VrLabReactorLiquid({
  visual,
  visualB,
  targetFill,
  radius,
  maxHeight,
  baseY,
  mixing = false,
  mixRatio = 0,
  mixProgress = 0,
  temperature = 0,
  concentration = 0.5,
}: {
  visual: LiquidVisual
  visualB?: LiquidVisual
  targetFill: number
  radius: number
  maxHeight: number
  baseY: number
  mixing?: boolean
  mixRatio?: number
  mixProgress?: number
  temperature?: number
  concentration?: number
}) {
  const { liquidShader } = useVrLabPerf()
  const effectiveMix = mixing ? Math.max(mixRatio, mixProgress) : mixRatio

  if (liquidShader === 'full') {
    return (
      <LiquidVolumeMaterialMesh
        visual={visual}
        visualB={visualB}
        mixRatio={effectiveMix}
        targetFill={targetFill}
        radiusTop={radius}
        radiusBottom={radius * 0.94}
        maxHeight={maxHeight}
        baseY={baseY}
        mixing={mixing}
        temperature={temperature}
        concentration={concentration}
      />
    )
  }

  return (
    <VrLabReactorLiquidCylinder
      visual={visual}
      visualB={visualB}
      targetFill={targetFill}
      radius={radius}
      maxHeight={maxHeight}
      baseY={baseY}
      mixing={mixing}
    />
  )
}

function VrLabReactorLiquidCylinder({
  visual,
  visualB,
  targetFill,
  radius,
  maxHeight,
  baseY,
  mixing = false,
}: {
  visual: LiquidVisual
  visualB?: LiquidVisual
  targetFill: number
  radius: number
  maxHeight: number
  baseY: number
  mixing?: boolean
}) {
  const vA = liquidVisualOrDefaults(visual)
  const vB = liquidVisualOrDefaults(visualB ?? { ...visual, liquidColor: VR_THEME.cyan, emissive: VR_THEME.cyan })
  const bodyRef = useRef<THREE.Mesh>(null)
  const swirlRef = useRef<THREE.Mesh>(null)
  const foamRef = useRef<THREE.Mesh>(null)
  const fillRef = useRef(targetFill)

  useFrame((state, dt) => {
    fillRef.current = lerp(fillRef.current, targetFill, Math.min(1, dt * 3))
    const f = clamp01(fillRef.current)
    if (f < 0.02) return
    const h = Math.max(0.04, f * maxHeight)
    const spin = state.clock.elapsedTime * (mixing ? 2.4 : 0.35)
    const pulse = mixing ? vA.glow * 1.1 + Math.sin(state.clock.elapsedTime * 6) * 0.12 : vA.glow

    if (bodyRef.current) {
      bodyRef.current.position.y = baseY + h * 0.42
      bodyRef.current.scale.set(radius * 0.94, h * 0.82, radius * 0.94)
      const m = bodyRef.current.material as THREE.MeshPhysicalMaterial
      m.color.set(vA.liquidColor)
      m.emissive.set(vA.emissive)
      m.emissiveIntensity = pulse
    }
    if (swirlRef.current) {
      swirlRef.current.position.y = baseY + h * 0.62
      swirlRef.current.scale.set(radius * (mixing ? 0.72 : 0.82), h * 0.38, radius * (mixing ? 0.72 : 0.82))
      swirlRef.current.rotation.y = spin
      const m = swirlRef.current.material as THREE.MeshStandardMaterial
      m.color.set(mixing ? vB.liquidColor : vA.liquidColor)
      m.emissive.set(mixing ? vB.emissive : vA.emissive)
      m.emissiveIntensity = pulse * 0.95
    }
    if (foamRef.current) {
      const wave = mixing ? Math.sin(state.clock.elapsedTime * 10) * 0.008 : 0
      foamRef.current.position.y = baseY + h + wave
      foamRef.current.scale.setScalar(radius * 0.88)
      const m = foamRef.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = mixing ? 0.85 + Math.sin(state.clock.elapsedTime * 8) * 0.15 : 0.45
    }
  })

  if (targetFill < 0.01 && fillRef.current < 0.01) return null

  return (
    <group>
      <mesh ref={bodyRef} position={[0, baseY + maxHeight / 2, 0]}>
        <cylinderGeometry args={[1, 1, 1, 32]} />
        <meshPhysicalMaterial
          color={vA.liquidColor}
          emissive={vA.emissive}
          emissiveIntensity={vA.glow}
          transparent
          opacity={vA.opacity}
          roughness={0.06}
          clearcoat={0.85}
          transmission={0.15}
          thickness={0.5}
          ior={1.33}
        />
      </mesh>
      <mesh ref={swirlRef} position={[0, baseY + maxHeight * 0.7, 0]}>
        <cylinderGeometry args={[1, 0.82, 1, 32]} />
        <meshStandardMaterial
          color={vB.liquidColor}
          emissive={vB.emissive}
          emissiveIntensity={vB.glow}
          transparent
          opacity={0.78}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={foamRef} position={[0, baseY + maxHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.55, radius * 0.88, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={vA.emissive}
          emissiveIntensity={0.5}
          transparent
          opacity={mixing ? 0.55 : 0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <InstancedBubbleField
        count={14}
        radius={radius * 0.75}
        baseY={baseY}
        maxHeight={maxHeight}
        fillRef={fillRef}
        color={vA.emissive}
        active={mixing}
      />
    </group>
  )
}

export function VrLabPourStream({
  active,
  visual,
  from = [0, 0.9, 0] as [number, number, number],
  to = [0, 0.1, 0] as [number, number, number],
  progress,
}: {
  active: boolean
  visual: LiquidVisual
  from?: [number, number, number]
  to?: [number, number, number]
  progress: number
}) {
  const v = liquidVisualOrDefaults(visual)
  const ref = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (!ref.current || !active) return
    const t = easeOutCubic(clamp01(progress))
    const y = lerp(from[1], to[1], t)
    const h = Math.max(0.05, from[1] - y)
    ref.current.position.set(from[0], (from[1] + y) / 2, from[2])
    ref.current.scale.set(1, h, 1)
    const mat = ref.current.material as THREE.MeshStandardMaterial
    mat.opacity = v.opacity * (0.85 - t * 0.25)
  })

  if (!active || progress >= 1) return null

  return (
    <mesh ref={ref} position={from}>
      <cylinderGeometry args={[0.014, 0.022, 1, 10]} />
      <meshStandardMaterial
        color={v.liquidColor}
        emissive={v.emissive}
        emissiveIntensity={v.glow * 1.2}
        transparent
        opacity={v.opacity}
        depthWrite={false}
      />
    </mesh>
  )
}

/** Декоративная жидкость в колбах (полка, дистилляция). */
export function VrLabDecorLiquid({
  visual,
  radiusTop,
  radiusBottom,
  height,
  baseY,
  vapor = false,
}: {
  visual: LiquidVisual
  radiusTop: number
  radiusBottom: number
  height: number
  baseY: number
  vapor?: boolean
}) {
  const v = liquidVisualOrDefaults(visual)
  const vaporRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!vaporRef.current || !vapor) return
    vaporRef.current.position.y = baseY + height + 0.06 + Math.sin(state.clock.elapsedTime * 2) * 0.015
    vaporRef.current.scale.setScalar(0.9 + Math.sin(state.clock.elapsedTime * 3) * 0.08)
    const m = vaporRef.current.material as THREE.MeshStandardMaterial
    m.emissiveIntensity = 0.35 + Math.sin(state.clock.elapsedTime * 4) * 0.1
  })

  return (
    <group>
      <mesh position={[0, baseY + height / 2, 0]}>
        <cylinderGeometry args={[radiusTop * 0.9, radiusBottom * 0.95, height, 20]} />
        <meshPhysicalMaterial
          color={v.liquidColor}
          emissive={v.emissive}
          emissiveIntensity={v.glow}
          transparent
          opacity={v.opacity}
          roughness={0.07}
          clearcoat={0.9}
          transmission={0.1}
          thickness={0.35}
        />
      </mesh>
      <mesh position={[0, baseY + height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radiusTop * 0.82, 20]} />
        <meshStandardMaterial
          color={v.liquidColor}
          emissive={v.emissive}
          emissiveIntensity={v.glow * 1.05}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {vapor ? (
        <mesh ref={vaporRef} position={[0, baseY + height + 0.06, 0]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial
            color="#a8e8ff"
            emissive="#a8e8ff"
            emissiveIntensity={0.35}
            transparent
            opacity={0.22}
            depthWrite={false}
          />
        </mesh>
      ) : null}
      <InstancedBubbleField
        count={6}
        radius={radiusTop * 0.65}
        baseY={baseY}
        maxHeight={height}
        fill={0.85}
        color={v.emissive}
        active
      />
    </group>
  )
}

export { VR_THEME }
