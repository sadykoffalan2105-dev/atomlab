import { Line } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CyberExploreAtom } from './CyberExploreAtom'
import { CyberExploreSynthesis } from './CyberExploreSynthesis'

const CYAN = '#3dffec'
const PINK = '#e84a7a'
const GREEN = '#5cff8a'
const GOLD = '#ffe566'

function EmissiveMat({ color, intensity = 0.6 }: { color: string; intensity?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={intensity}
      metalness={0.25}
      roughness={0.35}
    />
  )
}

function MoleculeCage({ spin }: { spin: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (spin && ref.current) ref.current.rotation.y += dt * 0.35
  })
  const geo = useMemo(() => new THREE.IcosahedronGeometry(0.55, 1), [])
  return (
    <group ref={ref}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={CYAN} wireframe emissive={CYAN} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <EmissiveMat color={PINK} intensity={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.55, Math.sin(a * 0.7) * 0.35, Math.sin(a) * 0.55]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <EmissiveMat color="#5ecbff" />
          </mesh>
        )
      })}
    </group>
  )
}

function LatticeGrid() {
  const nodes: [number, number, number][] = []
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        nodes.push([x * 0.32, y * 0.32, z * 0.32])
      }
    }
  }
  return (
    <group>
      {nodes.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.14, 0.14, 0.14]} />
          <EmissiveMat color={CYAN} intensity={0.35} />
        </mesh>
      ))}
    </group>
  )
}

function PropertyGraph() {
  const points = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 32; i++) {
      const t = i / 32
      pts.push([(t - 0.5) * 2.2, Math.sin(t * Math.PI * 2) * 0.35 + 0.1, 0])
    }
    return pts
  }, [])
  return (
    <group position={[0, -0.2, 0]}>
      <Line points={points} color={GOLD} lineWidth={2} />
      <mesh position={[0, -0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.4, 0.8]} />
        <meshStandardMaterial color="#0a1830" transparent opacity={0.6} />
      </mesh>
    </group>
  )
}


function TechBlock({ color }: { color: string }) {
  return (
    <mesh>
      <boxGeometry args={[0.7, 0.7, 0.7]} />
      <EmissiveMat color={color} intensity={0.55} />
    </mesh>
  )
}

function EcoPlant() {
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[(i - 1) * 0.55, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.26, 0.7, 20]} />
          <EmissiveMat color={i === 1 ? CYAN : GREEN} intensity={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 1.4, 8]} />
        <EmissiveMat color={CYAN} intensity={0.3} />
      </mesh>
    </group>
  )
}

function BeakerMix({ animate }: { animate: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!animate || !ref.current) return
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.15
  })
  return (
    <group ref={ref}>
      <mesh position={[0, 0, 0]}>
        <coneGeometry args={[0.35, 0.75, 24]} />
        <meshPhysicalMaterial color="#5ecbff" transparent opacity={0.45} transmission={0.3} />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <EmissiveMat color={GREEN} intensity={0.35} />
      </mesh>
    </group>
  )
}

function Ch4Molecule({ spin }: { spin: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (spin && ref.current) ref.current.rotation.y += dt * 0.4
  })
  const hPos: [number, number, number][] = [
    [0, 0.38, 0],
    [0.36, -0.12, 0],
    [-0.18, -0.12, 0.32],
    [-0.18, -0.12, -0.32],
  ]
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.16, 20, 20]} />
        <EmissiveMat color="#444" intensity={0.2} />
      </mesh>
      {hPos.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <EmissiveMat color={CYAN} />
        </mesh>
      ))}
    </group>
  )
}

function BalanceScale() {
  return (
    <group position={[0, -0.15, 0]}>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.06, 0.7, 0.06]} />
        <meshStandardMaterial color="#99aabb" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[-0.35, 0.55, 0]} rotation={[0, 0, 0.2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.04, 20]} />
        <EmissiveMat color={GOLD} />
      </mesh>
      <mesh position={[0.35, 0.5, 0]} rotation={[0, 0, -0.15]}>
        <cylinderGeometry args={[0.18, 0.18, 0.04, 20]} />
        <EmissiveMat color={CYAN} />
      </mesh>
    </group>
  )
}

function PeriodicBars() {
  return (
    <group position={[-0.5, 0, 0]}>
      {['H', 'C', 'O', 'Na'].map((_, i) => (
        <mesh key={i} position={[0, (1 - i) * 0.22, 0]}>
          <boxGeometry args={[0.35, 0.18, 0.08]} />
          <EmissiveMat color={i % 2 === 0 ? CYAN : '#7eb6ff'} intensity={0.35} />
        </mesh>
      ))}
    </group>
  )
}

export function CyberExploreModels({
  taskId,
  hotspotId,
  animate,
}: {
  taskId: string
  hotspotId: string
  animate: boolean
}) {
  const spin = animate

  switch (taskId) {
    case 'task1':
      if (hotspotId === 'lattice') return <LatticeGrid />
      if (hotspotId === 'graph') return <PropertyGraph />
      return <MoleculeCage spin={spin} />
    case 'task2':
      return (
        <CyberExploreSynthesis
          animate={animate}
          focus={
            hotspotId === 'robot' || hotspotId === 'flasks' || hotspotId === 'chamber'
              ? hotspotId
              : 'chamber'
          }
        />
      )
    case 'task3': {
      const colors: Record<string, string> = {
        energy: GOLD,
        nano: CYAN,
        factory: '#7eb6ff',
        recycle: GREEN,
      }
      return <TechBlock color={colors[hotspotId] ?? CYAN} />
    }
    case 'task4':
      return <EcoPlant />
    case 'task5':
      if (hotspotId === 'separation') {
        return (
          <group>
            <mesh position={[-0.5, 0, 0]}>
              <torusGeometry args={[0.25, 0.04, 12, 24]} />
              <EmissiveMat color="#ccc" />
            </mesh>
            <mesh position={[0.5, 0, 0]}>
              <coneGeometry args={[0.2, 0.5, 16]} />
              <EmissiveMat color={GOLD} />
            </mesh>
          </group>
        )
      }
      if (hotspotId === 'pure') return <CyberExploreAtom />
      return <BeakerMix animate={animate} />
    case 'task6':
      if (hotspotId === 'periodic') return <PeriodicBars />
      if (hotspotId === 'scale') return <BalanceScale />
      if (hotspotId === 'formulas') {
        return (
          <group>
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[0.5, 0.12, 0.05]} />
              <EmissiveMat color={GOLD} />
            </mesh>
            <mesh position={[0, -0.1, 0]}>
              <boxGeometry args={[0.55, 0.12, 0.05]} />
              <EmissiveMat color={CYAN} />
            </mesh>
          </group>
        )
      }
      return <Ch4Molecule spin={spin} />
    default:
      return null
  }
}
