import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VrLabTubeContent } from '../../vrLab/types'
import { clamp01, easeInOutCubic, lerp } from '../../vrLab/vrLabAnimation'
import { VrLabGlassMaterial } from './vrLabGlassMaterials'
import { VrLabLiquid, VrLabPourStream, VrLabSwirlLiquid } from './VrLabLiquid'
import { useVrLabPerf } from './vrLabPerformance'
import { VR_THEME } from './vrLabTheme'

function latheProfile(points: [number, number][], segments: number) {
  const pts = points.map(([r, y]) => new THREE.Vector2(r, y))
  return new THREE.LatheGeometry(pts, segments)
}

/** Высокая пробирка с округлым дном — как на референсе. */
function useTestTubeGeometry() {
  const { latheSegments } = useVrLabPerf()
  return useMemo(
    () =>
      latheProfile(
        [
          [0, 0],
          [0.038, 0],
          [0.042, 0.04],
          [0.042, 0.5],
          [0.018, 0.56],
          [0.018, 0.62],
        ],
        latheSegments,
      ),
    [latheSegments],
  )
}

/** Эrlenmeyer — конус + цилиндрическое горло. */
export function useErlenmeyerGeometry(scale = 1) {
  const { latheSegments } = useVrLabPerf()
  return useMemo(
    () =>
      latheProfile(
        [
          [0, 0],
          [0.055 * scale, 0],
          [0.075 * scale, 0.05 * scale],
          [0.028 * scale, 0.2 * scale],
          [0.022 * scale, 0.24 * scale],
        ],
        latheSegments,
      ),
    [latheSegments, scale],
  )
}

/** Широкая ёмкость для смешивания с «ушком». */
function useMixingVesselGeometry() {
  const { latheSegments } = useVrLabPerf()
  return useMemo(
    () =>
      latheProfile(
        [
          [0, 0],
          [0.06, 0],
          [0.08, 0.015],
          [0.34, 0.02],
          [0.36, 0.06],
          [0.35, 0.32],
          [0.33, 0.36],
          [0.28, 0.38],
        ],
        latheSegments,
      ),
    [latheSegments],
  )
}

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
        <VrLabGlassMaterial color="#eef4ff" />
      </mesh>
      {selected ? (
        <mesh ref={ringRef} position={[0, 0.58, 0]}>
          <torusGeometry args={[0.11, 0.008, 8, 24]} />
          <meshStandardMaterial
            color={VR_THEME.cyan}
            emissive={VR_THEME.cyan}
            emissiveIntensity={1.4}
          />
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
  const geo = useTestTubeGeometry()
  const groupRef = useRef<THREE.Group>(null)
  const fill = content?.fillLevel ?? 0
  const color = content?.liquidColor ?? '#3a4a6a'

  useFrame((_, dt) => {
    if (!groupRef.current) return
    groupRef.current.rotation.z = lerp(groupRef.current.rotation.z, tiltMix * -0.65, Math.min(1, dt * 4))
  })

  return (
    <group ref={groupRef} position={position} onClick={onClick}>
      <TestTubeGlass selected={selected} geo={geo} />
      {content ? (
        <VrLabLiquid
          color={color}
          targetFill={fill}
          radiusTop={0.038}
          radiusBottom={0.036}
          maxHeight={0.42}
          baseY={0.05}
          animateIn={pourActive}
        />
      ) : null}
      <VrLabPourStream
        active={pourActive}
        color={color}
        from={[0, 0.78, 0.04]}
        to={[0, 0.12, 0]}
        progress={pourProgress}
      />
    </group>
  )
}

/** Широкая колба-«ведро» с ручкой для смешивания реагентов. */
export function VrLabBeaker({
  position = [0, 0, 0],
  content,
  mixing = false,
  mixColor,
  mixProgress = 0,
}: {
  position?: [number, number, number]
  content: VrLabTubeContent | null
  mixing?: boolean
  mixColor?: string
  mixProgress?: number
}) {
  const vesselGeo = useMixingVesselGeometry()
  const fill = content?.fillLevel ?? 0
  const baseColor = content?.liquidColor ?? VR_THEME.magenta
  const displayColor = mixColor && mixing ? mixColor : baseColor
  const groupRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.PointLight>(null)

  const colorA = displayColor
  const colorB = mixColor && mixing ? VR_THEME.cyan : VR_THEME.magenta

  useFrame((state) => {
    if (groupRef.current && mixing) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 12) * 0.005 * mixProgress
    }
    if (glowRef.current) {
      glowRef.current.intensity = content ? 0.35 + (mixing ? Math.sin(state.clock.elapsedTime * 5) * 0.15 : 0) : 0
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh geometry={vesselGeo} castShadow receiveShadow position={[0, 0.02, 0]}>
        <VrLabGlassMaterial color="#f2eeff" roughness={0.05} />
      </mesh>

      {/* Дугообразная ручка */}
      <mesh position={[0.36, 0.22, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <torusGeometry args={[0.12, 0.012, 8, 24, Math.PI]} />
        <meshStandardMaterial color={VR_THEME.chrome} metalness={0.85} roughness={0.15} />
      </mesh>

      {content ? (
        <VrLabSwirlLiquid
          colorA={colorA}
          colorB={colorB}
          targetFill={fill}
          radius={0.32}
          maxHeight={0.3}
          baseY={0.06}
          mixing={mixing}
        />
      ) : null}

      <pointLight ref={glowRef} position={[0, 0.2, 0.1]} color={displayColor} intensity={0.3} distance={1.2} />
    </group>
  )
}

/** Минималистичная стойка для пробирок — тонкий металл. */
export function VrLabTubeRack({ tubeCount = 4 }: { tubeCount?: number }) {
  return (
    <group position={[-1.42, 0.02, 0.08]}>
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[0.95, 0.025, 0.22]} />
        <meshStandardMaterial color={VR_THEME.darkMetal} metalness={0.75} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.95, 0.018, 0.22]} />
        <meshStandardMaterial color={VR_THEME.darkMetal} metalness={0.75} roughness={0.28} />
      </mesh>
      {Array.from({ length: tubeCount }, (_, i) => {
        const x = -0.33 + i * 0.22
        return (
          <group key={i} position={[x, 0.1, 0]}>
            <mesh position={[0, 0.08, 0.09]}>
              <boxGeometry args={[0.018, 0.16, 0.018]} />
              <meshStandardMaterial color={VR_THEME.chrome} metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.08, -0.09]}>
              <boxGeometry args={[0.018, 0.16, 0.018]} />
              <meshStandardMaterial color={VR_THEME.chrome} metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        )
      })}
      <mesh position={[0, 0.034, 0]}>
        <boxGeometry args={[0.95, 0.006, 0.22]} />
        <meshStandardMaterial color={VR_THEME.cyan} emissive={VR_THEME.cyan} emissiveIntensity={1.6} />
      </mesh>
    </group>
  )
}

export function useMixTilt(progress: number): number {
  return easeInOutCubic(clamp01(progress))
}

/** Эrlenmeyer для декора (полка, стол). */
export function VrLabErlenmeyerFlask({
  position,
  liquidColor,
  scale = 1,
}: {
  position: [number, number, number]
  liquidColor: string
  scale?: number
}) {
  const geo = useErlenmeyerGeometry(scale)
  return (
    <group position={position}>
      <mesh geometry={geo} castShadow>
        <VrLabGlassMaterial color="#eef4ff" />
      </mesh>
      <mesh position={[0, 0.04 * scale, 0]}>
        <cylinderGeometry args={[0.05 * scale, 0.065 * scale, 0.1 * scale, 16]} />
        <meshStandardMaterial
          color={liquidColor}
          emissive={liquidColor}
          emissiveIntensity={0.9}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  )
}

/** Круглодонная колба для ректификации. */
export function VrLabRoundFlask({
  position,
  liquidColor,
  liquidLevel = 0.12,
}: {
  position: [number, number, number]
  liquidColor: string
  liquidLevel?: number
}) {
  const { latheSegments } = useVrLabPerf()
  const geo = useMemo(
    () =>
      latheProfile(
        [
          [0, 0],
          [0.09, 0],
          [0.1, 0.04],
          [0.028, 0.12],
          [0.022, 0.16],
        ],
        latheSegments,
      ),
    [latheSegments],
  )

  return (
    <group position={position}>
      <mesh geometry={geo} castShadow>
        <VrLabGlassMaterial color="#f0ecff" />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial
          color={liquidColor}
          emissive={liquidColor}
          emissiveIntensity={0.95}
          transparent
          opacity={0.88}
        />
      </mesh>
      <mesh position={[0, 0.03 + liquidLevel * 0.5, 0]}>
        <cylinderGeometry args={[0.07, 0.08, liquidLevel, 16]} />
        <meshStandardMaterial
          color={liquidColor}
          emissive={liquidColor}
          emissiveIntensity={0.85}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  )
}
