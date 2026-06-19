import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VrLabTubeContent } from '../../vrLab/types'
import { clamp01, easeInOutCubic, lerp } from '../../vrLab/vrLabAnimation'
import { SloshSimulator } from '../../vrLab/fluids/SloshSimulator'
import { substanceVisual } from '../../vrLab/substanceVisuals'
import {
  GLASS_PROFILES,
  GraduationMarks,
  latheFromProfile,
  makeHexRingGeometry,
  useGlassGeometry,
} from './vrLabGlassLibrary'
import { resolveCondensationLevel } from './VrLabReactionVfx'
import { GlassCondensation } from './vfx/GlassCondensation'
import { VrLabGlassMaterial } from './vrLabGlassMaterials'
import {
  liquidVisualFromContent,
  VrLabDecorLiquid,
  VrLabLiquid,
  VrLabPourStream,
  VrLabReactorLiquid,
  type LiquidVisual,
} from './VrLabLiquid'
import { PourStreamLocal } from './liquid/PourStreamRibbon'
import { useVrLabPerf } from './vrLabPerformance'
import { VR_THEME } from './vrLabTheme'

type TubeProps = {
  position?: [number, number, number]
  content: VrLabTubeContent | null
  selected?: boolean
  onClick?: () => void
  pourProgress?: number
  pourActive?: boolean
  tiltMix?: number
}

function TestTubeGlass({ selected, geo }: { selected?: boolean; geo: THREE.LatheGeometry }) {
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!ringRef.current || !selected) return
    const mat = ringRef.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = 1.4 + Math.sin(state.clock.elapsedTime * 4) * 0.35
  })

  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <VrLabGlassMaterial color="#eef6ff" variant="lab" />
      </mesh>
      <GraduationMarks />
      <mesh position={[0, 0.59, 0]}>
        <cylinderGeometry args={[0.021, 0.021, 0.018, 12]} />
        <meshStandardMaterial color="#8a6a4a" roughness={0.85} metalness={0.05} />
      </mesh>
      {selected ? (
        <mesh ref={ringRef} position={[0, 0.58, 0]}>
          <torusGeometry args={[0.11, 0.007, 8, 24]} />
          <meshStandardMaterial color={VR_THEME.cyan} emissive={VR_THEME.cyan} emissiveIntensity={1.4} />
        </mesh>
      ) : null}
    </group>
  )
}

export function VrLabTestTube({
  position = [0, 0, 0],
  content,
  selected = false,
  onClick,
  pourProgress = 0,
  pourActive = false,
  tiltMix = 0,
}: TubeProps) {
  const geo = useGlassGeometry(GLASS_PROFILES.testTube)
  const groupRef = useRef<THREE.Group>(null)
  const fill = content?.fillLevel ?? 0
  const visual = liquidVisualFromContent(content)

  useFrame((_, dt) => {
    if (!groupRef.current) return
    groupRef.current.rotation.z = lerp(groupRef.current.rotation.z, tiltMix * -0.65, Math.min(1, dt * 4))
  })

  return (
    <group ref={groupRef} position={position} onClick={onClick}>
      <TestTubeGlass selected={selected} geo={geo} />
      {visual ? (
        <VrLabLiquid
          visual={visual}
          targetFill={fill}
          radiusTop={0.038}
          radiusBottom={0.036}
          maxHeight={0.42}
          baseY={0.05}
          animateIn={pourActive}
          mixing={pourActive}
        />
      ) : null}
      {visual ? (
        <VrLabPourStream
          active={pourActive}
          visual={visual}
          from={[0, 0.78, 0.04]}
          to={[0, 0.12, 0]}
          progress={pourProgress}
        />
      ) : null}
    </group>
  )
}

/** Реактор смешивания — компактный tech-HUD. */
export function VrLabBeaker({
  position = [0, 0, 0],
  content,
  mixing = false,
  mixColor,
  mixProgress = 0,
  scale = 0.52,
  selected = false,
  onClick,
  reactionHeat = 0,
  vfxPhase = 'idle',
  vfxProgress = 0,
  vfxMixing = false,
  lastMix = null,
}: {
  position?: [number, number, number]
  content: VrLabTubeContent | null
  mixing?: boolean
  mixColor?: string
  mixProgress?: number
  scale?: number
  selected?: boolean
  onClick?: () => void
  reactionHeat?: number
  vfxPhase?: 'idle' | 'pouring' | 'combining' | 'reacting'
  vfxProgress?: number
  vfxMixing?: boolean
  lastMix?: import('../../vrLab/types').VrLabMixResult | null
}) {
  const vesselGeo = useGlassGeometry(GLASS_PROFILES.mixingReactor)
  const hexBaseGeo = useMemo(() => makeHexRingGeometry(0.36, 0.3, 0.018), [])
  const fill = content?.fillLevel ?? 0
  const visualA = liquidVisualFromContent(content)
  const visualB: LiquidVisual | undefined =
    mixColor && mixing
      ? {
          liquidColor: mixColor,
          emissive: mixColor,
          glow: 0.72,
          opacity: 0.88,
          viscosity: 0.4,
        }
      : undefined
  const groupRef = useRef<THREE.Group>(null)
  const stirRef = useRef<THREE.Mesh>(null)
  const rimRef = useRef<THREE.Mesh>(null)
  const condensation = resolveCondensationLevel(lastMix, vfxProgress, vfxPhase, vfxMixing || mixing)

  useFrame((state) => {
    if (groupRef.current && mixing) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 12) * 0.004 * mixProgress
    }
    if (stirRef.current) {
      stirRef.current.rotation.y = state.clock.elapsedTime * (mixing ? 4.5 : 0.6)
    }
    if (rimRef.current) {
      const m = rimRef.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = mixing ? 1.2 + Math.sin(state.clock.elapsedTime * 5) * 0.25 : 0.75
    }
  })

  return (
    <group ref={groupRef} position={position} scale={scale} onClick={onClick}>
      <mesh visible={false}>
        <cylinderGeometry args={[0.38, 0.4, 0.5, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <mesh geometry={hexBaseGeo} position={[0, 0.008, 0]}>
        <meshStandardMaterial color="#0e0c1a" metalness={0.82} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.018, 0]}>
        <cylinderGeometry args={[0.28, 0.3, 0.008, 6]} />
        <meshStandardMaterial
          color={VR_THEME.cyan}
          emissive={VR_THEME.cyan}
          emissiveIntensity={mixing ? 1.6 : selected ? 0.85 : 0.4}
          metalness={0.65}
          roughness={0.18}
        />
      </mesh>

      <mesh geometry={vesselGeo} castShadow receiveShadow position={[0, 0.018, 0]}>
        <VrLabGlassMaterial color="#f8fbff" variant="vessel" />
      </mesh>

      <GlassCondensation level={condensation} active={mixing || vfxPhase === 'reacting'} />

      <mesh ref={rimRef} position={[0, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.004, 8, 32]} />
        <meshStandardMaterial
          color={selected ? VR_THEME.magenta : VR_THEME.cyan}
          emissive={selected ? VR_THEME.magenta : VR_THEME.cyan}
          emissiveIntensity={selected ? 1.1 : 0.55}
        />
      </mesh>

      {selected ? (
        <mesh position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.34, 6]} />
          <meshStandardMaterial color={VR_THEME.magenta} emissive={VR_THEME.magenta} emissiveIntensity={1.2} />
        </mesh>
      ) : null}

      <mesh ref={stirRef} position={[0, 0.055, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.14, 0.012, 0.024]} />
        <meshStandardMaterial color="#ffffff" emissive={VR_THEME.cyan} emissiveIntensity={mixing ? 1.1 : 0.35} />
      </mesh>

      {visualA ? (
        <VrLabReactorLiquid
          visual={visualA}
          visualB={visualB}
          targetFill={fill}
          radius={0.3}
          maxHeight={0.3}
          baseY={0.06}
          mixing={mixing}
          mixRatio={mixProgress}
          mixProgress={mixProgress}
          temperature={mixing ? reactionHeat * mixProgress : 0}
        />
      ) : null}
    </group>
  )
}

export function VrLabTubeRack({ tubeCount = 4 }: { tubeCount?: number }) {
  return (
    <group position={[-1.42, 0.02, 0.08]}>
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[0.95, 0.025, 0.22]} />
        <meshStandardMaterial color={VR_THEME.darkMetal} metalness={0.78} roughness={0.26} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.95, 0.018, 0.22]} />
        <meshStandardMaterial color={VR_THEME.darkMetal} metalness={0.78} roughness={0.26} />
      </mesh>
      {Array.from({ length: tubeCount }, (_, i) => {
        const x = -0.33 + i * 0.22
        return (
          <group key={i} position={[x, 0.1, 0]}>
            <mesh position={[0, 0.08, 0.09]}>
              <boxGeometry args={[0.018, 0.16, 0.018]} />
              <meshStandardMaterial color={VR_THEME.chrome} metalness={0.85} roughness={0.18} />
            </mesh>
            <mesh position={[0, 0.08, -0.09]}>
              <boxGeometry args={[0.018, 0.16, 0.018]} />
              <meshStandardMaterial color={VR_THEME.chrome} metalness={0.85} roughness={0.18} />
            </mesh>
          </group>
        )
      })}
      <mesh position={[0, 0.034, 0]}>
        <boxGeometry args={[0.95, 0.006, 0.22]} />
        <meshStandardMaterial color={VR_THEME.cyan} emissive={VR_THEME.cyan} emissiveIntensity={1.5} />
      </mesh>
    </group>
  )
}

export function useMixTilt(progress: number): number {
  return easeInOutCubic(clamp01(progress))
}

export function useErlenmeyerGeometry(scale = 1) {
  const { latheSegments } = useVrLabPerf()
  return useMemo(
    () => latheFromProfile(GLASS_PROFILES.erlenmeyer(scale), latheSegments),
    [latheSegments, scale],
  )
}

export function VrLabErlenmeyerFlask({
  position,
  content,
  scale = 1,
  vapor = false,
  pourActive = false,
  pourProgress = 0,
  fillToVat = false,
  manualTilt = 0,
}: {
  position: [number, number, number]
  content?: VrLabTubeContent | null
  scale?: number
  vapor?: boolean
  pourActive?: boolean
  pourProgress?: number
  /** true — струя не рисуется локально (рисует VrLabPourBridge). */
  fillToVat?: boolean
  /** Наклон 0..1 (колёсико / R). */
  manualTilt?: number
}) {
  const geo = useErlenmeyerGeometry(scale)
  const groupRef = useRef<THREE.Group>(null)
  const sloshSim = useRef(new SloshSimulator())
  const slosh = useRef({ sloshX: 0, sloshZ: 0, tiltX: 0, tiltZ: 0 })

  const visual = useMemo(() => liquidVisualFromContent(content ?? null), [content])
  const fill = content?.fillLevel ?? 0
  const rTop = 0.048 * scale
  const rBot = 0.062 * scale
  const maxH = 0.11 * scale
  const baseY = 0.035 * scale
  const tiltMix = pourActive
    ? easeInOutCubic(clamp01(pourProgress * 1.15))
    : manualTilt

  useFrame((_, dt) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = lerp(groupRef.current.rotation.z, -tiltMix * 0.62, Math.min(1, dt * 5))
    }
    slosh.current = sloshSim.current.update(tiltMix * 0.38, 0, dt)
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh geometry={geo} castShadow>
        <VrLabGlassMaterial color="#eef6ff" variant="lab" />
      </mesh>
      {visual ? (
        <VrLabLiquid
          visual={visual}
          targetFill={fill}
          radiusTop={rTop}
          radiusBottom={rBot}
          maxHeight={maxH}
          baseY={baseY}
          animateIn={pourActive && !fillToVat}
          mixing={pourActive || vapor}
          tiltX={slosh.current.tiltX}
          tiltZ={slosh.current.tiltZ}
          sloshX={slosh.current.sloshX}
          sloshZ={slosh.current.sloshZ}
          sloshRef={slosh}
          temperature={vapor ? 0.35 : 0}
        />
      ) : null}
      {visual && pourActive && !fillToVat ? (
        <PourStreamLocal active visual={visual} progress={pourProgress} tiltMix={tiltMix} />
      ) : null}
    </group>
  )
}

export function VrLabRoundFlask({
  position,
  liquidColor,
  compoundId,
  liquidLevel = 0.12,
  vapor = false,
}: {
  position: [number, number, number]
  liquidColor: string
  compoundId?: string
  liquidLevel?: number
  vapor?: boolean
}) {
  const geo = useGlassGeometry(GLASS_PROFILES.roundFlask)
  const visual = useMemo(() => {
    if (compoundId) return substanceVisual(compoundId)
    return {
      liquidColor,
      emissive: liquidColor,
      glow: 0.75,
      opacity: 0.9,
      viscosity: 0.5,
    }
  }, [compoundId, liquidColor])

  return (
    <group position={position}>
      <mesh geometry={geo} castShadow>
        <VrLabGlassMaterial color="#f0f4ff" variant="vessel" />
      </mesh>
      <VrLabDecorLiquid
        visual={visual}
        radiusTop={0.07}
        radiusBottom={0.085}
        height={liquidLevel + 0.06}
        baseY={0.028}
        vapor={vapor}
      />
    </group>
  )
}
