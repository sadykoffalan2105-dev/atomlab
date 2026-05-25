import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  AtomBall,
  BondRod,
  BurnerFlame,
  ElectronShell,
  GlassFlask,
  NucleusCluster,
  ParticleField,
  SceneLights,
  SpinGroup,
} from './primitives'

export type TopicSceneProps = { autoRotate?: boolean }

/** §1 Химия как наука — от макромира к частицам. */
export function G7C1S01Scene({ autoRotate }: TopicSceneProps) {
  return (
    <>
      <SceneLights accent="#6ec8ff" />
      <SpinGroup autoRotate={autoRotate} speed={0.08}>
        <GlassFlask scale={1.1} />
        <group position={[1.1, 0.2, 0]} scale={0.85}>
          <ParticleField count={48} spread={[1.2, 1, 1]} speed={1.2} color="#3dffec" />
        </group>
      </SpinGroup>
    </>
  )
}

/** §2 Материя и свойства — лёд / вода / пар. */
export function G7C1S02Scene(_props: TopicSceneProps) {
  return (
    <>
      <SceneLights accent="#88ccff" />
      <group position={[-1.1, 0, 0]}>
        <ParticleField count={36} spread={[0.5, 0.6, 0.5]} speed={0.15} color="#a8e0ff" ordered />
      </group>
      <group position={[0, 0, 0]}>
        <ParticleField count={40} spread={[0.9, 0.5, 0.9]} speed={0.9} color="#3dffec" />
      </group>
      <group position={[1.1, 0.3, 0]}>
        <ParticleField count={35} spread={[1.1, 1.2, 1.1]} speed={2.2} color="#cceeff" />
      </group>
    </>
  )
}

/** §3 Техника безопасности — стол, колба, очки. */
export function G7C1S03Scene(_props: TopicSceneProps) {
  const goggles = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (goggles.current) goggles.current.position.y = 0.85 + Math.sin(s.clock.elapsedTime) * 0.04
  })
  return (
    <>
      <SceneLights accent="#ffcc66" />
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[2.4, 0.12, 1.2]} />
        <meshStandardMaterial color="#2a3040" roughness={0.6} />
      </mesh>
      <GlassFlask />
      <group ref={goggles} position={[0.7, 0.85, 0.3]}>
        <mesh>
          <torusGeometry args={[0.22, 0.04, 12, 32]} />
          <meshStandardMaterial color="#44eeff" emissive="#22aacc" emissiveIntensity={0.4} transparent opacity={0.7} />
        </mesh>
      </group>
      <mesh position={[-0.8, 0.05, 0.2]}>
        <boxGeometry args={[0.35, 0.08, 0.2]} />
        <meshStandardMaterial color="#ff4444" emissive="#aa2222" emissiveIntensity={0.3} />
      </mesh>
    </>
  )
}

/** §4 Лабораторная посуда — штатив и горелка. */
export function G7C1S04Scene(_props: TopicSceneProps) {
  return (
    <>
      <SceneLights accent="#ff8844" />
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 1.1, 12]} />
        <meshStandardMaterial color="#666" metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.04, 24]} />
        <meshStandardMaterial color="#555" metalness={0.6} />
      </mesh>
      <group position={[0.45, -0.2, 0]}>
        <BurnerFlame />
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.15, 0.18, 0.2, 16]} />
          <meshStandardMaterial color="#444" metalness={0.5} />
        </mesh>
      </group>
      <group position={[-0.35, 0.5, 0]} rotation={[0, 0, 0.2]}>
        <GlassFlask scale={0.7} />
      </group>
    </>
  )
}

/** §5 Чистое вещество и смесь. */
export function G7C1S05Scene(_props: TopicSceneProps) {
  return (
    <>
      <SceneLights />
      <group position={[-0.9, 0, 0]}>
        <ParticleField count={30} spread={[0.6, 0.6, 0.6]} speed={0.2} color="#3dffec" ordered />
      </group>
      <group position={[0.9, 0, 0]}>
        <ParticleField count={20} spread={[0.7, 0.7, 0.7]} speed={1} color="#3dffec" />
        <ParticleField count={20} spread={[0.7, 0.7, 0.7]} speed={1.1} color="#ff88aa" />
      </group>
    </>
  )
}

/** §6 Разделение смесей — воронка и фильтр. */
export function G7C1S06Scene(_props: TopicSceneProps) {
  const drip = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (drip.current) drip.current.position.y = -0.15 + ((s.clock.elapsedTime * 0.4) % 1) * -0.35
  })
  return (
    <>
      <SceneLights accent="#aaccff" />
      <mesh position={[0, 0.5, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.45, 0.5, 24, 1, true]} />
        <meshStandardMaterial color="#99bbdd" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.05, 24]} />
        <meshStandardMaterial color="#eeddcc" />
      </mesh>
      <ParticleField count={25} spread={[0.5, 0.2, 0.5]} speed={0.1} color="#8b6914" ordered />
      <mesh ref={drip} position={[0, -0.15, 0]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color="#3dffec" emissive="#3dffec" emissiveIntensity={0.5} />
      </mesh>
      <GlassFlask scale={0.8} />
    </>
  )
}

/** §7 Агрегатные состояния — нагрев и движение частиц. */
export function G7C1S07Scene(_props: TopicSceneProps) {
  const heat = useRef<THREE.PointLight>(null)
  useFrame((s) => {
    if (heat.current) heat.current.intensity = 0.6 + Math.sin(s.clock.elapsedTime * 2) * 0.2
  })
  return (
    <>
      <SceneLights />
      <pointLight ref={heat} position={[-1.2, -0.3, 0.5]} color="#ff8844" intensity={0.7} distance={4} />
      <group position={[-1, 0, 0]}>
        <ParticleField count={28} spread={[0.5, 0.5, 0.5]} speed={0.12} color="#aaddff" ordered />
      </group>
      <group position={[0, 0, 0]}>
        <ParticleField count={35} spread={[0.8, 0.4, 0.8]} speed={0.8} color="#3dffec" />
      </group>
      <group position={[1, 0.2, 0]}>
        <ParticleField count={40} spread={[1, 1, 1]} speed={2.5} color="#eef" />
      </group>
    </>
  )
}

/** §8 Физические и химические явления — плавление vs горение. */
export function G7C1S08Scene(_props: TopicSceneProps) {
  const spark = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (spark.current) spark.current.rotation.y = s.clock.elapsedTime * 0.5
  })
  return (
    <>
      <SceneLights accent="#ff6622" />
      <group position={[-1, 0, 0]}>
        <ParticleField count={32} spread={[0.5, 0.5, 0.5]} speed={0.25} color="#a8e0ff" ordered />
        <mesh position={[0, -0.4, 0]}>
          <boxGeometry args={[0.5, 0.15, 0.5]} />
          <meshStandardMaterial color="#88ccee" transparent opacity={0.6} />
        </mesh>
      </group>
      <group ref={spark} position={[1, 0, 0]}>
        <BurnerFlame />
        <ParticleField count={30} spread={[0.6, 0.8, 0.6]} speed={3} color="#ffaa44" />
        <pointLight color="#ff6622" intensity={1.2} distance={3} position={[0, 0.3, 0]} />
      </group>
    </>
  )
}

/** §9 Химия в жизни — питательные молекулы (схематично). */
export function G7C1S09Scene({ autoRotate }: TopicSceneProps) {
  return (
    <>
      <SceneLights accent="#88ff99" />
      <SpinGroup autoRotate={autoRotate} speed={0.1}>
        <group position={[-0.6, 0, 0]}>
          <mesh>
            <torusGeometry args={[0.35, 0.08, 12, 24]} />
            <meshStandardMaterial color="#ffcc66" emissive="#cc9933" emissiveIntensity={0.3} />
          </mesh>
          {Array.from({ length: 6 }).map((_, i) => (
            <AtomBall
              key={i}
              color="#ffdd88"
              radius={0.07}
              position={[Math.cos((i / 6) * Math.PI * 2) * 0.35, Math.sin((i / 6) * Math.PI * 2) * 0.35, 0]}
            />
          ))}
        </group>
        <group position={[0.7, 0, 0]}>
          <AtomBall color="#66aaff" position={[0, 0, 0]} radius={0.1} />
          <AtomBall color="#ff8866" position={[0.25, 0.1, 0]} radius={0.08} />
          <AtomBall color="#66aaff" position={[-0.2, -0.1, 0.1]} radius={0.08} />
          <BondRod from={[0, 0, 0]} to={[0.25, 0.1, 0]} color="#99bbcc" />
        </group>
      </SpinGroup>
    </>
  )
}

/** §10 Повторение — обзор частиц и связей. */
export function G7C1S10Scene({ autoRotate }: TopicSceneProps) {
  return (
    <>
      <SceneLights />
      <SpinGroup autoRotate={autoRotate}>
        <ElectronShell radius={0.7} electrons={2} color="#5ecbff" />
        <NucleusCluster protons={1} neutrons={0} scale={1.2} />
        <ParticleField count={20} spread={[1.5, 1, 1.5]} speed={1} color="#3dffec" />
      </SpinGroup>
    </>
  )
}

/** §1 Атом */
export function G7C2S01Scene({ autoRotate }: TopicSceneProps) {
  return (
    <>
      <SceneLights accent="#ff99aa" />
      <SpinGroup autoRotate={autoRotate} speed={0.12}>
        <NucleusCluster protons={1} neutrons={0} scale={1.4} />
        <ElectronShell radius={0.55} electrons={1} />
      </SpinGroup>
    </>
  )
}

/** §2 Строение атома — оболочки K, L */
export function G7C2S02Scene({ autoRotate }: TopicSceneProps) {
  return (
    <>
      <SceneLights accent="#66ccff" />
      <SpinGroup autoRotate={autoRotate} speed={0.08}>
        <NucleusCluster protons={8} neutrons={8} scale={1.1} />
        <ElectronShell radius={0.35} electrons={2} color="#88ddff" tilt={0.2} phase={0} />
        <ElectronShell radius={0.65} electrons={6} color="#44aaff" tilt={0.8} phase={1} />
      </SpinGroup>
    </>
  )
}

/** §3 Элемент и символ */
export function G7C2S03Scene({ autoRotate }: TopicSceneProps) {
  return (
    <>
      <SceneLights accent="#66ff99" />
      <SpinGroup autoRotate={autoRotate}>
        <mesh>
          <boxGeometry args={[1.1, 1.1, 0.12]} />
          <meshStandardMaterial color="#1a2840" metalness={0.3} roughness={0.4} />
        </mesh>
        <AtomBall color="#44ff88" position={[-0.25, 0.15, 0.08]} radius={0.14} />
        <ElectronShell radius={0.5} electrons={7} color="#44ff88" />
      </SpinGroup>
    </>
  )
}

/** §4 Относительная атомная масса */
export function G7C2S04Scene(_props: TopicSceneProps) {
  return (
    <>
      <SceneLights />
      <group position={[-0.6, 0, 0]}>
        <NucleusCluster protons={6} neutrons={6} scale={1} />
        <ElectronShell radius={0.5} electrons={6} />
      </group>
      <group position={[0.6, 0, 0]}>
        <NucleusCluster protons={6} neutrons={7} scale={1} />
        <ElectronShell radius={0.5} electrons={6} />
      </group>
      <mesh position={[0, -0.7, 0]}>
        <boxGeometry args={[1.8, 0.06, 0.3]} />
        <meshStandardMaterial color="#8899aa" metalness={0.6} />
      </mesh>
    </>
  )
}

/** §5 Изотопы */
export function G7C2S05Scene({ autoRotate }: TopicSceneProps) {
  return (
    <>
      <SceneLights accent="#aaddff" />
      <G7C2S04Scene autoRotate={autoRotate} />
    </>
  )
}

/** §6 Формула и валентность — сборка H₂O */
export function G7C2S06Scene(_props: TopicSceneProps) {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (!g.current) return
    const t = s.clock.elapsedTime
    const pulse = 1 + Math.sin(t * 1.5) * 0.05
    g.current.scale.setScalar(pulse)
  })
  return (
    <>
      <SceneLights accent="#3dffec" />
      <group ref={g}>
        <AtomBall color="#ff4444" position={[0, 0.12, 0]} radius={0.14} />
        <AtomBall color="#eeeeff" position={[-0.32, -0.2, 0]} radius={0.1} />
        <AtomBall color="#eeeeff" position={[0.32, -0.2, 0]} radius={0.1} />
        <BondRod from={[0, 0.12, 0]} to={[-0.32, -0.2, 0]} color="#88bbdd" />
        <BondRod from={[0, 0.12, 0]} to={[0.32, -0.2, 0]} color="#88bbdd" />
      </group>
    </>
  )
}

/** Глава III — воздух и горение */
export function G7C3S01Scene() {
  return (
    <>
      <SceneLights accent="#88bbff" />
      <ParticleField count={25} spread={[2, 1.2, 1]} speed={0.4} color="#aaccff" />
      <ParticleField count={15} spread={[2, 1.2, 1]} speed={0.35} color="#3dffec" />
      <ParticleField count={8} spread={[2, 1.2, 1]} speed={0.3} color="#ffaa66" />
    </>
  )
}

export function G7C3S02Scene() {
  const flame = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (flame.current) flame.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 5) * 0.1)
  })
  return (
    <>
      <SceneLights accent="#ff6622" />
      <group ref={flame} position={[0, -0.1, 0]}>
        <BurnerFlame />
        <ParticleField count={35} spread={[0.5, 0.9, 0.5]} speed={2.5} color="#ffaa44" />
      </group>
      <ParticleField count={20} spread={[1.5, 0.8, 1]} speed={0.5} color="#aaccff" />
    </>
  )
}

export function G7C3S03Scene() {
  return (
    <>
      <SceneLights accent="#44aaff" />
      <SpinGroup speed={0.2}>
        <group scale={0.9}>
          <AtomBall color="#4488ff" position={[-0.2, 0, 0]} radius={0.16} />
          <AtomBall color="#4488ff" position={[0.2, 0, 0]} radius={0.16} />
          <BondRod from={[-0.2, 0, 0]} to={[0.2, 0, 0]} color="#6699cc" />
        </group>
      </SpinGroup>
    </>
  )
}

export function G7C3S04Scene() {
  return (
    <>
      <SceneLights />
      <G7C3S02Scene />
      <group position={[1.2, 0, 0]} scale={0.7}>
        <AtomBall color="#333" position={[0, 0, 0]} radius={0.1} />
        <AtomBall color="#ff4444" position={[0.2, 0.1, 0]} radius={0.09} />
        <BondRod from={[0, 0, 0]} to={[0.2, 0.1, 0]} />
      </group>
    </>
  )
}

export function G7C3S05Scene() {
  return (
    <>
      <SceneLights accent="#aa66ff" />
      <ParticleField count={40} spread={[1.2, 0.6, 1.2]} speed={1.2} color="#99aaff" />
      <pointLight color="#8866ff" intensity={0.8} position={[0, 0.5, 0]} distance={4} />
    </>
  )
}

export function G7C3S06Scene({ autoRotate }: TopicSceneProps) {
  return <G7C1S10Scene autoRotate={autoRotate} />
}

/** Глава IV — водород и вода */
export function G7C4S01Scene() {
  return (
    <>
      <SceneLights accent="#eef" />
      <SpinGroup speed={0.25}>
        <group scale={0.85}>
          <AtomBall color="#eeeeff" position={[-0.18, 0, 0]} radius={0.1} />
          <AtomBall color="#eeeeff" position={[0.18, 0, 0]} radius={0.1} />
          <BondRod from={[-0.18, 0, 0]} to={[0.18, 0, 0]} />
        </group>
      </SpinGroup>
    </>
  )
}

export function G7C4S02Scene() {
  return <G7C2S06Scene />
}

export function G7C4S03Scene() {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (g.current) g.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.5) * 0.15
  })
  return (
    <>
      <SceneLights accent="#3dffec" />
      <group ref={g}>
        <G7C2S06Scene />
        <mesh position={[0, -0.5, 0]}>
          <boxGeometry args={[1.4, 0.08, 1]} />
          <meshPhysicalMaterial color="#44aaff" transmission={0.6} transparent opacity={0.5} />
        </mesh>
      </group>
    </>
  )
}

export function G7C4S04Scene() {
  const bubbles = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (!bubbles.current) return
    bubbles.current.children.forEach((c, i) => {
      c.position.y = -0.3 + ((s.clock.elapsedTime * 0.35 + i * 0.2) % 1) * 0.9
    })
  })
  return (
    <>
      <SceneLights accent="#3dffec" />
      <mesh position={[0, -0.45, 0]}>
        <boxGeometry args={[1.6, 0.5, 0.9]} />
        <meshPhysicalMaterial color="#2266aa" transmission={0.5} transparent opacity={0.65} />
      </mesh>
      <mesh position={[-0.55, 0.1, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.8, 12]} />
        <meshStandardMaterial color="#aaa" metalness={0.8} />
      </mesh>
      <mesh position={[0.55, 0.1, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.8, 12]} />
        <meshStandardMaterial color="#aaa" metalness={0.8} />
      </mesh>
      <group ref={bubbles}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[-0.3 + (i % 4) * 0.2, -0.3, (i >> 2) * 0.15 - 0.1]}>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#aaddff' : '#ffaaaa'}
              emissive={i % 2 === 0 ? '#4488ff' : '#ff4444'}
              emissiveIntensity={0.5}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}
      </group>
    </>
  )
}

/** Глава V */
export function G7C5S01Scene() {
  return <G7C1S09Scene />
}

export function G7C5S02Scene() {
  return (
    <>
      <SceneLights accent="#ffcc88" />
      <ParticleField count={15} spread={[0.8, 0.5, 0.8]} speed={0.3} color="#ffdd99" ordered />
      <ParticleField count={15} spread={[0.8, 0.5, 0.8]} speed={0.3} color="#88ffaa" ordered />
      <ParticleField count={15} spread={[0.8, 0.5, 0.8]} speed={0.3} color="#aaccff" ordered />
    </>
  )
}

export function G7C5S03Scene() {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (g.current) g.current.rotation.y = s.clock.elapsedTime * 0.1
  })
  return (
    <>
      <SceneLights accent="#ccaa88" />
      <group ref={g}>
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh
            key={i}
            position={[Math.cos((i / 12) * Math.PI * 2) * 0.7, (Math.random() - 0.5) * 0.3, Math.sin((i / 12) * Math.PI * 2) * 0.7]}
          >
            <boxGeometry args={[0.15, 0.1, 0.2]} />
            <meshStandardMaterial color={i % 2 ? '#aa8866' : '#667788'} roughness={0.8} />
          </mesh>
        ))}
      </group>
    </>
  )
}
