/**
 * Декоративная sci-fi лаборатория — композиция как на референсе.
 */
import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { compoundById } from '../../data/compounds'
import { substanceVisual } from '../../vrLab/substanceVisuals'
import { VrLabRoundFlask } from './VrLabGlassware'
import { VrLabGlassMaterial } from './vrLabGlassMaterials'
import { getCatalogMoleculeTexture } from './vrLabCatalogMoleculeTexture'
import { VrLabDecorLiquid } from './VrLabLiquid'
import { usePeriodicTablePosterTexture } from './vrLabPosterTextures'
import { VR_THEME } from './vrLabTheme'

function resolvePreviewCompoundId(
  compoundId: string | null | undefined,
  fallback: string,
): string {
  if (compoundId && compoundById[compoundId]) return compoundId
  return compoundById[fallback] ? fallback : 'hcl'
}

/** Таблица Менделеева — кибер-HUD как на странице ПСХЭ. */
export function VrLabPeriodicTablePoster({
  position = [0.55, 0.98, -0.84] as [number, number, number],
}) {
  const tex = usePeriodicTablePosterTexture()
  const w = 1.58
  const h = 1.12

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.012]}>
        <planeGeometry args={[w + 0.1, h + 0.1]} />
        <meshStandardMaterial color="#0a0818" roughness={0.35} metalness={0.45} />
      </mesh>
      <mesh position={[0, 0, -0.008]}>
        <planeGeometry args={[w + 0.06, h + 0.06]} />
        <meshStandardMaterial
          color={VR_THEME.cyan}
          emissive={VR_THEME.cyan}
          emissiveIntensity={0.12}
          transparent
          opacity={0.35}
        />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0, 0.35]} intensity={0.35} color="#00e5ff" distance={2.4} />
    </group>
  )
}

/** Парящая полка — заменена на VrLabShelfFlasksScene (10 колб на стене). */
export function VrLabFloatingShelf() {
  return null
}

/** Монитор с молекулой выбранного вещества. */
export function VrLabHoloMonitor({
  compoundId,
  position = [1.62, 0.18, -0.08] as [number, number, number],
}: {
  compoundId: string | null
  position?: [number, number, number]
}) {
  const previewId = resolvePreviewCompoundId(compoundId, 'nacl')
  const tex = useMemo(() => getCatalogMoleculeTexture(previewId), [previewId])
  const screenRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!screenRef.current) return
    const mat = screenRef.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = 0.85 + Math.sin(state.clock.elapsedTime * 2) * 0.12
  })

  return (
    <group position={position} rotation={[-0.1, -0.28, 0]}>
      <RoundedBox args={[0.34, 0.22, 0.035]} radius={0.01} castShadow>
        <meshStandardMaterial color={VR_THEME.darkMetal} metalness={0.75} roughness={0.22} />
      </RoundedBox>
      <mesh ref={screenRef} position={[0, 0.015, 0.02]}>
        <planeGeometry args={[0.28, 0.15]} />
        <meshStandardMaterial map={tex} emissive={VR_THEME.purpleBright} emissiveIntensity={0.85} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.13, 0]}>
        <boxGeometry args={[0.12, 0.04, 0.1]} />
        <meshStandardMaterial color={VR_THEME.benchBase} metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  )
}

export function VrLabRoboticArm({ position = [-1.92, 0.06, 0.02] as [number, number, number] }) {
  const armRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!armRef.current) return
    armRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.12
  })

  return (
    <group position={position}>
      <RoundedBox args={[0.24, 0.055, 0.2]} radius={0.012} castShadow>
        <meshStandardMaterial color="#7a8498" metalness={0.8} roughness={0.22} />
      </RoundedBox>
      <group ref={armRef} position={[0, 0.16, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.032, 0.038, 0.2, 12]} />
          <meshStandardMaterial color={VR_THEME.chrome} metalness={0.85} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.12, 0]}>
          <sphereGeometry args={[0.042, 14, 14]} />
          <meshStandardMaterial color={VR_THEME.cyan} emissive={VR_THEME.cyan} emissiveIntensity={2.2} />
        </mesh>
        <mesh position={[0, 0.26, 0.05]} rotation={[0.45, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.018, 0.16, 10]} />
          <meshStandardMaterial color={VR_THEME.chrome} metalness={0.85} roughness={0.18} />
        </mesh>
        <mesh position={[0, 0.36, 0.12]} rotation={[0.75, 0, 0]}>
          <coneGeometry args={[0.035, 0.07, 12]} />
          <meshStandardMaterial color="#9aa8b8" metalness={0.9} roughness={0.12} />
        </mesh>
      </group>
    </group>
  )
}

export function VrLabDistillation({ position = [-1.05, 0.02, 0.1] as [number, number, number] }) {
  const coilRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!coilRef.current) return
    const mat = coilRef.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = 1.6 + Math.sin(state.clock.elapsedTime * 3.5) * 0.35
  })

  return (
    <group position={position}>
      <VrLabRoundFlask position={[0, 0.04, 0]} liquidColor={VR_THEME.magenta} compoundId="h2o" vapor />
      <mesh ref={coilRef} position={[0.14, 0.24, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.07, 0.01, 6, 24, Math.PI * 2.8]} />
        <meshStandardMaterial color="#ffffff" emissive={VR_THEME.cyan} emissiveIntensity={1.6} />
      </mesh>
      {(['hcl', 'naoh'] as const).map((id, i) => (
        <group key={id} position={[0.26 + i * 0.1, 0.22, 0]}>
          <mesh>
            <cylinderGeometry args={[0.014, 0.014, 0.13, 10]} />
            <VrLabGlassMaterial color="#f4f0ff" variant="accent" />
          </mesh>
          <VrLabDecorLiquid
            visual={substanceVisual(id)}
            radiusTop={0.011}
            radiusBottom={0.012}
            height={0.05}
            baseY={-0.035}
          />
        </group>
      ))}
    </group>
  )
}

export function VrLabNeonOverhead() {
  return (
    <group>
      {[
        { x: -1.05, color: VR_THEME.magenta, w: 0.5 },
        { x: -0.2, color: VR_THEME.cyan, w: 0.45 },
        { x: 0.65, color: VR_THEME.magenta, w: 0.55 },
        { x: 1.35, color: VR_THEME.cyan, w: 0.4 },
      ].map(({ x, color, w }) => (
        <mesh key={x} position={[x, 0.76, 0.04]}>
          <boxGeometry args={[w, 0.018, 0.032]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} roughness={0.12} />
        </mesh>
      ))}
    </group>
  )
}

export function VrLabBenchConsole({ position = [1.28, 0.06, 0.1] as [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.22, 0.06, 0.16]} radius={0.008}>
        <meshStandardMaterial color={VR_THEME.darkMetal} metalness={0.7} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0.042, 0.06]}>
        <planeGeometry args={[0.14, 0.07]} />
        <meshStandardMaterial color={VR_THEME.holoBg} emissive={VR_THEME.cyan} emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[-0.05, 0.038, 0.082]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshStandardMaterial color={VR_THEME.cyan} emissive={VR_THEME.cyan} emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.05, 0.038, 0.082]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshStandardMaterial color={VR_THEME.magenta} emissive={VR_THEME.magenta} emissiveIntensity={2} />
      </mesh>
    </group>
  )
}

export function VrLabReagentBottles({ position = [-0.72, 0.06, 0.22] as [number, number, number] }) {
  const bottles = [
    { x: -0.14, id: 'hcl', h: 0.22, r: 0.045 },
    { x: 0, id: 'naoh', h: 0.26, r: 0.05 },
    { x: 0.14, id: 'h2o2', h: 0.2, r: 0.042 },
  ]
  return (
    <group position={position}>
      {bottles.map((b, i) => {
        const visual = substanceVisual(b.id)
        return (
          <group key={i} position={[b.x, 0, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[b.r * 0.7, b.r, b.h, 14]} />
              <VrLabGlassMaterial color="#f0f4ff" variant="lab" />
            </mesh>
            <VrLabDecorLiquid
              visual={visual}
              radiusTop={b.r * 0.82}
              radiusBottom={b.r * 0.88}
              height={b.h * 0.38}
              baseY={-b.h / 2 + 0.05}
            />
          </group>
        )
      })}
    </group>
  )
}

export function VrLabEquipmentScene({ previewCompoundId }: { previewCompoundId: string | null }) {
  return (
    <group>
      <VrLabPeriodicTablePoster />
      <VrLabHoloMonitor compoundId={previewCompoundId} />
      <group scale={0.78}>
        <VrLabDistillation />
      </group>
      <VrLabReagentBottles />
      <VrLabNeonOverhead />
      <VrLabBenchConsole />
    </group>
  )
}
