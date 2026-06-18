/**
 * Декоративная sci-fi лаборатория — композиция как на референсе.
 */
import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { VrLabErlenmeyerFlask, VrLabRoundFlask } from './VrLabGlassware'
import { VrLabGlassMaterial } from './vrLabGlassMaterials'
import {
  useMoleculeHoloTexture,
  usePeriodicTablePosterTexture,
  useWaveformHoloTexture,
} from './vrLabPosterTextures'
import { useVrLabPerf } from './vrLabPerformance'
import { VR_THEME } from './vrLabTheme'

function makeHexRingGeometry(outerR: number, innerR: number) {
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    const x = Math.cos(a) * outerR
    const y = Math.sin(a) * outerR
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const hole = new THREE.Path()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    const x = Math.cos(a) * innerR
    const y = Math.sin(a) * innerR
    if (i === 0) hole.moveTo(x, y)
    else hole.lineTo(x, y)
  }
  hole.closePath()
  shape.holes.push(hole)
  return new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: false })
}

/** Гекс-экран с осциллограммой (слева на стене). */
export function VrLabHexWaveDisplay({ position = [-0.55, 1.02, -0.82] as [number, number, number] }) {
  const tex = useWaveformHoloTexture()
  const frameGeo = useMemo(() => makeHexRingGeometry(0.38, 0.345), [])
  const screenRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!screenRef.current) return
    const mat = screenRef.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = 1.1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.25
  })

  return (
    <group position={position}>
      <mesh geometry={frameGeo}>
        <meshStandardMaterial
          color={VR_THEME.cyan}
          emissive={VR_THEME.cyan}
          emissiveIntensity={1.8}
          metalness={0.55}
          roughness={0.2}
        />
      </mesh>
      <mesh ref={screenRef} position={[0, 0, 0.018]}>
        <circleGeometry args={[0.33, 6]} />
        <meshStandardMaterial map={tex} emissive={VR_THEME.cyan} emissiveIntensity={1.1} roughness={0.25} />
      </mesh>
    </group>
  )
}

/** Таблица Менделеева — крупный экран на стене. */
export function VrLabPeriodicTablePoster({
  position = [0.72, 0.98, -0.84] as [number, number, number],
}) {
  const tex = usePeriodicTablePosterTexture()
  const w = 1.55
  const h = 0.88

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.008]}>
        <planeGeometry args={[w + 0.06, h + 0.06]} />
        <meshStandardMaterial
          color={VR_THEME.darkMetal}
          emissive={VR_THEME.magenta}
          emissiveIntensity={0.35}
          roughness={0.35}
          metalness={0.5}
        />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          map={tex}
          emissive={VR_THEME.magenta}
          emissiveIntensity={0.75}
          roughness={0.3}
        />
      </mesh>
    </group>
  )
}

/** Парящая полка с Erlenmeyer (справа вверху). */
export function VrLabFloatingShelf({ position = [1.72, 0.74, -0.52] as [number, number, number] }) {
  const { decorPointLights } = useVrLabPerf()
  const shelfRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (shelfRef.current) {
      shelfRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5) * 0.006
    }
  })

  const flasks = [
    { x: -0.22, color: VR_THEME.neonYellow, s: 0.95 },
    { x: 0, color: VR_THEME.neonRed, s: 1.05 },
    { x: 0.22, color: VR_THEME.neonGreen, s: 0.9 },
  ]

  return (
    <group ref={shelfRef} position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.72, 0.028, 0.18]} />
        <meshStandardMaterial color={VR_THEME.panel} metalness={0.7} roughness={0.3} />
      </mesh>
      {flasks.map((f, i) => (
        <group key={i}>
          <VrLabErlenmeyerFlask
            position={[f.x, 0.1, 0]}
            liquidColor={f.color}
            scale={f.s}
          />
          {decorPointLights ? (
            <pointLight position={[f.x, 0.12, 0.05]} intensity={0.15} color={f.color} distance={0.5} />
          ) : null}
        </group>
      ))}
    </group>
  )
}

/** Монитор с молекулярной структурой (справа на столе). */
export function VrLabHoloMonitor({ position = [1.62, 0.18, -0.08] as [number, number, number] }) {
  const tex = useMoleculeHoloTexture()
  const screenRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!screenRef.current) return
    const mat = screenRef.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = 0.95 + Math.sin(state.clock.elapsedTime * 2) * 0.12
  })

  return (
    <group position={position} rotation={[-0.1, -0.28, 0]}>
      <RoundedBox args={[0.34, 0.22, 0.035]} radius={0.01} castShadow>
        <meshStandardMaterial color={VR_THEME.darkMetal} metalness={0.75} roughness={0.25} />
      </RoundedBox>
      <mesh ref={screenRef} position={[0, 0.015, 0.02]}>
        <planeGeometry args={[0.28, 0.15]} />
        <meshStandardMaterial map={tex} emissive={VR_THEME.purpleBright} emissiveIntensity={0.95} />
      </mesh>
      <mesh position={[0, -0.13, 0]}>
        <boxGeometry args={[0.12, 0.04, 0.1]} />
        <meshStandardMaterial color={VR_THEME.benchBase} metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  )
}

/** Роботизированный манипулятор (слева). */
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

/** Ректификация: круглодонная колба + спираль + пробирки. */
export function VrLabDistillation({ position = [-0.05, 0.02, -0.06] as [number, number, number] }) {
  const coilRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!coilRef.current) return
    const mat = coilRef.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = 1.6 + Math.sin(state.clock.elapsedTime * 3.5) * 0.35
  })

  return (
    <group position={position}>
      <VrLabRoundFlask position={[0, 0.04, 0]} liquidColor={VR_THEME.magenta} />
      <mesh ref={coilRef} position={[0.14, 0.24, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.07, 0.01, 6, 24, Math.PI * 2.8]} />
        <meshStandardMaterial color="#ffffff" emissive={VR_THEME.cyan} emissiveIntensity={1.6} />
      </mesh>
      {[VR_THEME.magenta, VR_THEME.neonGreen].map((color, i) => (
        <group key={i} position={[0.26 + i * 0.1, 0.22, 0]}>
          <mesh>
            <cylinderGeometry args={[0.014, 0.014, 0.13, 10]} />
            <VrLabGlassMaterial color="#f4f0ff" />
          </mesh>
          <mesh position={[0, -0.035, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.055, 10]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Неоновые лампы над столом + горизонтальные полосы на стене. */
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

/** Мини-консоль с экраном (вместо спектрофотометра). */
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

/** Реагентные бутыли (декор слева). */
export function VrLabReagentBottles({ position = [-0.55, 0.06, 0.02] as [number, number, number] }) {
  const bottles = [
    { x: -0.14, color: VR_THEME.cyan, h: 0.22, r: 0.045 },
    { x: 0, color: VR_THEME.magenta, h: 0.26, r: 0.05 },
    { x: 0.14, color: VR_THEME.neonYellow, h: 0.2, r: 0.042 },
  ]
  return (
    <group position={position}>
      {bottles.map((b, i) => (
        <group key={i} position={[b.x, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[b.r * 0.7, b.r, b.h, 12]} />
            <VrLabGlassMaterial color="#f0f4ff" />
          </mesh>
          <mesh position={[0, -b.h / 2 + 0.05, 0]}>
            <cylinderGeometry args={[b.r * 0.85, b.r * 0.85, b.h * 0.35, 12]} />
            <meshStandardMaterial color={b.color} emissive={b.color} emissiveIntensity={0.9} transparent opacity={0.88} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Вся декоративная сцена. */
export function VrLabEquipmentScene() {
  return (
    <group>
      <VrLabHexWaveDisplay />
      <VrLabPeriodicTablePoster />
      <VrLabFloatingShelf />
      <VrLabHoloMonitor />
      <VrLabRoboticArm />
      <VrLabDistillation />
      <VrLabNeonOverhead />
      <VrLabReagentBottles />
      <VrLabBenchConsole />
    </group>
  )
}
