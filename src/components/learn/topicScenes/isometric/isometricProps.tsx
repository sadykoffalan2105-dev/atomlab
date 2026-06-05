import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GlassFlask, AtomBall, BondRod, BurnerFlame, NucleusCluster, ElectronShell } from '../primitives'

export function IsoPlatform({
  position,
  size = [1.4, 0.12, 1.1] as [number, number, number],
  color = '#e8ecf4',
}: {
  position: [number, number, number]
  size?: [number, number, number]
  color?: string
}) {
  return (
    <group position={position}>
      <mesh position={[0, -size[1] / 2, 0]} receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.08} />
      </mesh>
      <mesh position={[0, -size[1] / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size[0] * 0.92, size[2] * 0.92]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.06} />
      </mesh>
    </group>
  )
}

export function ErlenmeyerFlask({
  position = [0, 0, 0] as [number, number, number],
  liquidColor = '#ff6b9d',
  scale = 1,
}: {
  position?: [number, number, number]
  liquidColor?: string
  scale?: number
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.32, 28, 28]} />
        <meshPhysicalMaterial color="#d0e8ff" transmission={0.88} thickness={0.2} transparent opacity={0.45} />
      </mesh>
      <mesh position={[0, 0.08, 0]} scale={[0.85, 0.7, 0.85]}>
        <sphereGeometry args={[0.28, 20, 20]} />
        <meshStandardMaterial color={liquidColor} emissive={liquidColor} emissiveIntensity={0.35} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.32, 16]} />
        <meshPhysicalMaterial color="#e0f4ff" transmission={0.8} transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.12, 8]} />
        <meshStandardMaterial color="#c8dce8" />
      </mesh>
    </group>
  )
}

export function BeakerHalf({ position, color = '#ff4466' }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.2, 0.22, 0.45, 20]} />
        <meshPhysicalMaterial color="#d8eeff" transmission={0.85} transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.22, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

export function CrystalBlock({
  position,
  color = '#5ecbff',
  scale = 1,
}: {
  position: [number, number, number]
  color?: string
  scale?: number
}) {
  const cells = useMemo(() => {
    const out: [number, number, number][] = []
    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 3; y++)
        for (let z = 0; z < 3; z++) out.push([(x - 1) * 0.14, (y - 1) * 0.14, (z - 1) * 0.14])
    return out
  }, [])
  return (
    <group position={position} scale={scale}>
      {cells.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.12, 0.12, 0.12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} metalness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

export function StylizedAtom({
  position,
  accent = '#3dffec',
}: {
  position: [number, number, number]
  accent?: string
}) {
  return (
    <group position={position}>
      <NucleusCluster protons={2} neutrons={2} scale={1.2} />
      <ElectronShell radius={0.42} electrons={2} color={accent} />
      <ElectronShell radius={0.62} electrons={4} color="#aa88ff" tilt={0.6} phase={1} />
    </group>
  )
}

export function PolymerChain({ position, color = '#66aaff' }: { position: [number, number, number]; color?: string }) {
  const pts: [number, number, number][] = [
    [-0.35, 0, 0],
    [-0.12, 0.08, 0],
    [0.12, -0.05, 0],
    [0.35, 0.05, 0],
  ]
  return (
    <group position={position}>
      {pts.map((p, i) => (
        <AtomBall key={i} color={color} radius={0.1} position={p} />
      ))}
      {pts.slice(0, -1).map((p, i) => (
        <BondRod key={`b${i}`} from={p} to={pts[i + 1]!} color="#99bbdd" />
      ))}
    </group>
  )
}

export function RobotArmSimple({ position }: { position: [number, number, number] }) {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (g.current) g.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.5) * 0.15
  })
  return (
    <group position={position} ref={g}>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.25, 0.08, 0.25]} />
        <meshStandardMaterial color="#dde2ee" metalness={0.6} />
      </mesh>
      <mesh position={[0.2, 0.35, 0]} rotation={[0, 0, -0.4]}>
        <boxGeometry args={[0.45, 0.06, 0.06]} />
        <meshStandardMaterial color="#eef1f8" metalness={0.7} />
      </mesh>
      <mesh position={[0.38, 0.52, 0]}>
        <boxGeometry args={[0.08, 0.08, 0.08]} />
        <meshStandardMaterial color="#3dffec" emissive="#3dffec" emissiveIntensity={0.5} />
      </mesh>
      <CrystalBlock position={[0.42, 0.38, 0.1]} color="#5ecbff" scale={0.65} />
    </group>
  )
}

export function MedicalKit({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[-0.2, 0.08, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.22, 12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.15, 0.05, 0]}>
        <boxGeometry args={[0.18, 0.12, 0.1]} />
        <meshStandardMaterial color="#ff6688" emissive="#ff2244" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0.02, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.35, 8]} />
        <meshStandardMaterial color="#ccc" metalness={0.8} />
      </mesh>
    </group>
  )
}

export function SolarPanelProp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, 0.3, 0.1]}>
      <mesh>
        <boxGeometry args={[0.5, 0.04, 0.35]} />
        <meshStandardMaterial color="#2244aa" emissive="#3366cc" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0.15, 0.35, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#ffcc44" emissive="#ffaa22" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}

export function FactoryEco({ position }: { position: [number, number, number] }) {
  const smoke = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (!smoke.current) return
    smoke.current.children.forEach((c, i) => {
      c.position.y = 0.35 + ((s.clock.elapsedTime * 0.25 + i * 0.2) % 1) * 0.4
      c.scale.setScalar(0.8 + ((s.clock.elapsedTime + i) % 1) * 0.3)
    })
  })
  return (
    <group position={position}>
      <mesh position={[-0.35, 0.1, 0]}>
        <boxGeometry args={[0.35, 0.35, 0.3]} />
        <meshStandardMaterial color="#8899aa" />
      </mesh>
      <mesh position={[-0.35, 0.32, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.25, 10]} />
        <meshStandardMaterial color="#667" />
      </mesh>
      <group ref={smoke} position={[-0.35, 0.45, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[i * 0.08, 0, 0]}>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color="#99aabb" transparent opacity={0.45} />
          </mesh>
        ))}
      </group>
      <mesh position={[0.35, 0.05, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.2, 8]} />
        <meshStandardMaterial color="#44aa66" />
      </mesh>
      <mesh position={[0.35, 0.22, 0]}>
        <sphereGeometry args={[0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color="#33cc55" emissive="#22aa44" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0.35, 0.08, 0.15]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color="#44bbff" emissive="#2288ff" emissiveIntensity={0.5} transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

export function DnaHelix({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const g = useRef<THREE.Group>(null)
  const spheres = useMemo(() => {
    const out: { pos: [number, number, number]; color: string }[] = []
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * Math.PI * 4
      const strand = i % 2
      out.push({
        pos: [Math.cos(t) * 0.22, i * 0.06 - 0.7, Math.sin(t) * 0.22 + strand * 0.12],
        color: strand ? '#5ecbff' : '#aa66ff',
      })
    }
    return out
  }, [])
  useFrame((s) => {
    if (g.current) g.current.rotation.y = s.clock.elapsedTime * 0.25
  })
  return (
    <group position={position} scale={scale} ref={g}>
      {spheres.map((s, i) => (
        <mesh key={i} position={s.pos}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={0.45} />
        </mesh>
      ))}
    </group>
  )
}

export function PropByType({
  type,
  position,
  color,
  scale = 1,
}: {
  type: string
  position: [number, number, number]
  color?: string
  scale?: number
}) {
  switch (type) {
    case 'flask':
      return <ErlenmeyerFlask position={position} liquidColor={color ?? '#ff6b9d'} scale={scale} />
    case 'beaker':
      return <BeakerHalf position={position} color={color ?? '#ff4466'} />
    case 'crystal':
      return <CrystalBlock position={position} color={color ?? '#5ecbff'} scale={scale} />
    case 'atom':
      return <StylizedAtom position={position} accent={color ?? '#3dffec'} />
    case 'robot':
      return <RobotArmSimple position={position} />
    case 'medical':
      return <MedicalKit position={position} />
    case 'solar':
      return <SolarPanelProp position={position} />
    case 'factory':
      return <FactoryEco position={position} />
    case 'dna':
      return <DnaHelix position={position} scale={scale} />
    case 'burner':
      return (
        <group position={position}>
          <BurnerFlame />
        </group>
      )
    case 'glass':
      return (
        <group position={position} scale={scale}>
          <GlassFlask scale={1} />
        </group>
      )
    case 'polymer':
      return <PolymerChain position={position} color={color} />
  }
  return <AtomBall color={color ?? '#3dffec'} position={position} radius={0.12 * scale} />
}
