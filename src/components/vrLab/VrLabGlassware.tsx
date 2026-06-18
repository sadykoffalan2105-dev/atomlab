import { useMemo, useRef } from 'react'
import { MeshTransmissionMaterial } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VrLabTubeContent } from '../../vrLab/types'
import { clamp01, easeInOutCubic, lerp } from '../../vrLab/vrLabAnimation'
import { VrLabLiquid, VrLabPourStream } from './VrLabLiquid'

type TubeProps = {
  position?: [number, number, number]
  content: VrLabTubeContent | null
  selected?: boolean
  onClick?: () => void
  pourProgress?: number
  pourActive?: boolean
  tiltMix?: number
}

/** Профиль пробирки (lathe) — округлое дно как в реальности. */
function TestTubeGlass({ selected }: { selected?: boolean }) {
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = []
    pts.push(new THREE.Vector2(0, 0))
    pts.push(new THREE.Vector2(0.1, 0))
    pts.push(new THREE.Vector2(0.11, 0.08))
    pts.push(new THREE.Vector2(0.11, 0.42))
    pts.push(new THREE.Vector2(0.045, 0.48))
    pts.push(new THREE.Vector2(0.045, 0.58))
    return new THREE.LatheGeometry(pts, 32)
  }, [])

  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <MeshTransmissionMaterial
          backside
          samples={4}
          thickness={0.35}
          chromaticAberration={0.04}
          anisotropy={0.12}
          distortion={0.08}
          distortionScale={0.15}
          temporalDistortion={0.08}
          iridescence={0.08}
          iridescenceIOR={1.2}
          roughness={0.06}
          ior={1.52}
          color="#f0f8ff"
        />
      </mesh>
      {selected ? (
        <mesh position={[0, 0.52, 0]}>
          <torusGeometry args={[0.13, 0.008, 8, 32]} />
          <meshStandardMaterial color="#5cffd4" emissive="#5cffd4" emissiveIntensity={0.6} />
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
  const groupRef = useRef<THREE.Group>(null)
  const fill = content?.fillLevel ?? 0
  const color = content?.liquidColor ?? '#3a4a6a'

  useFrame((_, dt) => {
    if (!groupRef.current) return
    const targetTilt = tiltMix * -0.65
    groupRef.current.rotation.z = lerp(groupRef.current.rotation.z, targetTilt, Math.min(1, dt * 4))
  })

  return (
    <group ref={groupRef} position={position} onClick={onClick}>
      <TestTubeGlass selected={selected} />
      {content ? (
        <VrLabLiquid
          color={color}
          targetFill={fill}
          radiusTop={0.1}
          radiusBottom={0.09}
          maxHeight={0.38}
          baseY={0.06}
          animateIn={pourActive}
        />
      ) : null}
      <VrLabPourStream
        active={pourActive}
        color={color}
        from={[0, 0.75, 0.05]}
        to={[0, 0.15, 0]}
        progress={pourProgress}
      />
    </group>
  )
}

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
  const fill = content?.fillLevel ?? 0
  const baseColor = content?.liquidColor ?? '#2a3550'
  const displayColor = mixColor && mixing ? mixColor : baseColor
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!groupRef.current || !mixing) return
    groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 14) * 0.006 * mixProgress
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.26, 0.3, 0.42, 32]} />
        <MeshTransmissionMaterial
          backside
          samples={4}
          thickness={0.4}
          roughness={0.05}
          ior={1.5}
          color="#eef6ff"
          chromaticAberration={0.03}
        />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <torusGeometry args={[0.27, 0.012, 8, 32]} />
        <meshStandardMaterial color="#d0dce8" metalness={0.4} roughness={0.3} />
      </mesh>
      {content ? (
        <VrLabLiquid
          color={displayColor}
          targetFill={fill}
          radiusTop={0.24}
          radiusBottom={0.22}
          maxHeight={0.32}
          baseY={0.02}
          mixing={mixing}
          animateIn={mixing && mixProgress < 0.4}
        />
      ) : null}
    </group>
  )
}

export function VrLabTubeRack({ tubeCount = 4 }: { tubeCount?: number }) {
  return (
    <group position={[-1.45, 0.02, 0.1]}>
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.08, 0.05, 0.32]} />
        <meshStandardMaterial color="#b8c4d4" roughness={0.35} metalness={0.45} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[1.02, 0.12, 0.26]} />
        <meshStandardMaterial color="#9aa8ba" roughness={0.4} metalness={0.35} />
      </mesh>
      {Array.from({ length: tubeCount }, (_, i) => (
        <mesh key={i} position={[-0.36 + i * 0.24, 0.04, 0]} castShadow>
          <cylinderGeometry args={[0.065, 0.065, 0.1, 20]} />
          <meshStandardMaterial color="#8a98a8" metalness={0.5} roughness={0.32} />
        </mesh>
      ))}
    </group>
  )
}

/** Метка на столе (зарезервировано под 3D-текст). */
export function VrLabBenchLabel({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.14, 0.14]} />
      <meshStandardMaterial color="#5a6575" roughness={0.9} transparent opacity={0.01} />
    </mesh>
  )
}

export function useMixTilt(progress: number): number {
  return easeInOutCubic(clamp01(progress))
}
