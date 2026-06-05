import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const CYAN = '#3dffec'
const PINK = '#e84a7a'
const GREEN = '#5cff8a'
const AMBER = '#ffb347'

const GEO = {
  boxChamber: new THREE.BoxGeometry(0.95, 1.15, 0.62),
  boxBase: new THREE.BoxGeometry(1.05, 0.08, 0.72),
  coneFlask: new THREE.ConeGeometry(0.14, 0.32, 12),
  sphereLiquid: new THREE.SphereGeometry(0.12, 12, 10),
  sphereMol: new THREE.SphereGeometry(0.1, 14, 14),
  bubble: new THREE.SphereGeometry(0.016, 6, 6),
  arm: new THREE.BoxGeometry(0.36, 0.1, 0.1),
  fore: new THREE.BoxGeometry(0.28, 0.08, 0.08),
  tip: new THREE.SphereGeometry(0.05, 8, 8),
}

function EmissiveMat({ color, intensity = 0.55 }: { color: string; intensity?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={intensity}
      metalness={0.22}
      roughness={0.4}
    />
  )
}

const BUBBLE_COUNT = 5

function BubbleField({ spread = 0.28 }: { spread?: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const seeds = useMemo(
    () =>
      Array.from({ length: BUBBLE_COUNT }, (_, i) => ({
        x: (i % 3) * 0.08 - 0.08,
        phase: (i / BUBBLE_COUNT) * Math.PI * 2,
        speed: 1.1 + (i % 2) * 0.2,
      })),
    [],
  )

  useFrame((state) => {
    const t = state.clock.elapsedTime
    seeds.forEach((s, i) => {
      const m = refs.current[i]
      if (!m) return
      m.position.y = ((t * s.speed + s.phase) % 1.1) * spread - 0.04
      m.position.x = s.x
    })
  })

  return (
    <group>
      {seeds.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          geometry={GEO.bubble}
        >
          <meshBasicMaterial color={GREEN} transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  )
}

function Erlenmeyer({
  position,
  liquidColor,
}: {
  position: [number, number, number]
  liquidColor: string
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.12, 0]} geometry={GEO.coneFlask}>
        <meshStandardMaterial color="#a8c8e8" transparent opacity={0.32} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.04, 0]} scale={[1, 0.35, 1]} geometry={GEO.sphereLiquid}>
        <EmissiveMat color={liquidColor} intensity={0.6} />
      </mesh>
      <group position={[0, 0.02, 0]}>
        <BubbleField />
      </group>
    </group>
  )
}

function RobotArm3D({
  side,
  highlight,
}: {
  side: -1 | 1
  highlight: boolean
}) {
  const base = useRef<THREE.Group>(null)
  const fore = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime * 1.65
    const swing = Math.sin(t + side * 0.5) * 0.55
    if (base.current) base.current.rotation.z = side * (0.25 + swing * 0.35)
    if (fore.current) fore.current.rotation.z = side * (-0.45 - swing * 0.25)
  })
  const emissive = highlight ? 0.85 : 0.3
  return (
    <group position={[side * 1.05, -0.15, 0]} rotation={[0, 0, side * 0.2]}>
      <group ref={base}>
        <mesh position={[side * 0.18, 0.12, 0]} geometry={GEO.arm}>
          <meshStandardMaterial
            color="#9aabbc"
            metalness={0.6}
            roughness={0.4}
            emissive={AMBER}
            emissiveIntensity={emissive * 0.2}
          />
        </mesh>
        <group ref={fore} position={[side * 0.34, 0.22, 0]}>
          <mesh position={[side * 0.14, 0.08, 0]} geometry={GEO.fore}>
            <meshStandardMaterial color="#c5d0dc" metalness={0.5} roughness={0.42} />
          </mesh>
          <mesh position={[side * 0.28, 0.14, 0]} geometry={GEO.tip}>
            <EmissiveMat color={AMBER} intensity={highlight ? 1 : 0.45} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function VacuumChamber3D({ highlight }: { highlight: boolean }) {
  const mol = useRef<THREE.Group>(null)
  const glow = useRef<THREE.PointLight>(null)
  useFrame((state, dt) => {
    if (mol.current) mol.current.rotation.y += dt * 1.15
    if (glow.current) {
      glow.current.intensity = (highlight ? 1.35 : 0.85) * (0.9 + Math.sin(state.clock.elapsedTime * 2.5) * 0.15)
    }
  })
  return (
    <group>
      <mesh geometry={GEO.boxChamber}>
        <meshStandardMaterial color="#88ccff" transparent opacity={0.18} roughness={0.15} metalness={0.1} />
      </mesh>
      <mesh position={[0, -0.52, 0]} geometry={GEO.boxBase}>
        <meshStandardMaterial color="#2a3a50" metalness={0.65} roughness={0.38} />
      </mesh>
      <group ref={mol} position={[0, 0.05, 0]}>
        <mesh geometry={GEO.sphereMol}>
          <EmissiveMat color={PINK} intensity={highlight ? 0.95 : 0.65} />
        </mesh>
      </group>
      <pointLight ref={glow} position={[0, 0.2, 0.3]} color={CYAN} intensity={1} distance={3} />
    </group>
  )
}

export function CyberExploreSynthesis({
  focus,
}: {
  focus: 'chamber' | 'robot' | 'flasks'
  animate: boolean
}) {
  return (
    <group position={[0, -0.05, 0]}>
      <VacuumChamber3D highlight={focus === 'chamber'} />
      <RobotArm3D side={-1} highlight={focus === 'robot'} />
      <RobotArm3D side={1} highlight={focus === 'robot'} />
      <Erlenmeyer position={[-0.75, -0.42, 0.15]} liquidColor={GREEN} />
      <Erlenmeyer position={[0.75, -0.42, 0.15]} liquidColor={PINK} />
      <mesh position={[0.85, -0.2, 0.2]}>
        <boxGeometry args={[0.22, 0.1, 0.04]} />
        <EmissiveMat color={GREEN} intensity={focus === 'flasks' ? 0.85 : 0.35} />
      </mesh>
    </group>
  )
}
