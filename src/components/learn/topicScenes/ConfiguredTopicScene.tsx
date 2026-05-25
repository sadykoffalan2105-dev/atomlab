import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { TopicSceneDef } from '../../../learn/learnTopicSceneDefs'
import { getTopicSceneDef } from '../../../learn/learnTopicSceneDefs'
import {
  AtomBall,
  BondRod,
  BurnerFlame,
  ElectronShell,
  NucleusCluster,
  ParticleField,
  SceneLights,
  SpinGroup,
} from './primitives'

function BondScene({ def, autoRotate }: { def: Extract<TopicSceneDef, { kind: 'bond' }>; autoRotate?: boolean }) {
  const sep = def.mode === 'covalent' ? 0.5 : 0.85
  return (
    <>
      <SceneLights accent={def.leftColor} />
      <SpinGroup autoRotate={autoRotate} speed={0.1}>
        <AtomBall color={def.leftColor} position={[-sep, 0, 0]} radius={0.14} />
        <AtomBall color={def.rightColor} position={[sep, 0, 0]} radius={0.14} />
        {def.mode !== 'ionic' ? <BondRod from={[-sep, 0, 0]} to={[sep, 0, 0]} color="#99bbdd" /> : null}
        {def.mode === 'ionic' ? (
          <>
            <ParticleField count={12} spread={[0.3, 0.3, 0.3]} speed={0.5} color={def.leftColor} />
            <ParticleField count={12} spread={[0.3, 0.3, 0.3]} speed={0.5} color={def.rightColor} />
          </>
        ) : null}
      </SpinGroup>
    </>
  )
}

function AtomScene({ def, autoRotate }: { def: Extract<TopicSceneDef, { kind: 'atom' }>; autoRotate?: boolean }) {
  return (
    <>
      <SceneLights accent={def.accent} />
      <SpinGroup autoRotate={autoRotate}>
        <NucleusCluster protons={def.protons} neutrons={def.neutrons} scale={1.1} />
        {def.shells.map((sh, i) => (
          <ElectronShell key={i} radius={sh.r} electrons={sh.e} color={def.accent} tilt={i * 0.4} phase={i} />
        ))}
      </SpinGroup>
    </>
  )
}

function ElectrolysisScene({ def }: { def: Extract<TopicSceneDef, { kind: 'electrolysis' }> }) {
  const bubbles = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (!bubbles.current) return
    bubbles.current.children.forEach((c, i) => {
      c.position.y = -0.2 + ((s.clock.elapsedTime * def.bubbleRate + i * 0.15) % 1) * 0.85
    })
  })
  return (
    <>
      <SceneLights accent={def.accent} />
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[1.8, 0.45, 0.9]} />
        <meshPhysicalMaterial color={def.accent} transmission={0.55} transparent opacity={0.6} />
      </mesh>
      <mesh position={[-0.5, 0.05, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.75, 12]} />
        <meshStandardMaterial color="#bbb" metalness={0.85} />
      </mesh>
      <mesh position={[0.5, 0.05, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.75, 12]} />
        <meshStandardMaterial color="#bbb" metalness={0.85} />
      </mesh>
      <group ref={bubbles}>
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={i} position={[(i % 5) * 0.15 - 0.3, -0.2, (i >> 2) * 0.1 - 0.05]}>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshStandardMaterial
              color={i % 2 ? '#aaddff' : '#ffaaaa'}
              emissive={i % 2 ? def.accent : '#ff4444'}
              emissiveIntensity={0.45}
              transparent
              opacity={0.85}
            />
          </mesh>
        ))}
      </group>
    </>
  )
}

function CrystalScene({ def, autoRotate }: { def: Extract<TopicSceneDef, { kind: 'crystal' }>; autoRotate?: boolean }) {
  return (
    <>
      <SceneLights accent={def.color} />
      <SpinGroup autoRotate={autoRotate} speed={0.06}>
        {Array.from({ length: def.layers * 4 }).map((_, i) => {
          const row = Math.floor(i / 4)
          const col = i % 4
          return (
            <mesh key={i} position={[(col - 1.5) * 0.28, row * 0.22 - 0.3, 0]}>
              <boxGeometry args={[0.22, 0.18, 0.22]} />
              <meshStandardMaterial color={def.color} emissive={def.color} emissiveIntensity={0.15} metalness={0.3} />
            </mesh>
          )
        })}
      </SpinGroup>
    </>
  )
}

function IndustryScene({ def }: { def: Extract<TopicSceneDef, { kind: 'industry' }> }) {
  return (
    <>
      <SceneLights accent={def.accent} />
      {Array.from({ length: def.stages }).map((_, i) => (
        <group key={i} position={[(i - (def.stages - 1) / 2) * 0.9, -0.2 + i * 0.15, 0]}>
          <mesh>
            <cylinderGeometry args={[0.25, 0.3, 0.5, 16]} />
            <meshStandardMaterial color={def.accent} metalness={0.4} roughness={0.5} />
          </mesh>
          {i < def.stages - 1 ? (
            <mesh position={[0.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.03, 0.03, 0.35, 8]} />
              <meshStandardMaterial color="#8899aa" />
            </mesh>
          ) : null}
        </group>
      ))}
      <ParticleField count={20} spread={[2, 0.5, 1]} speed={0.6} color={def.accent} />
    </>
  )
}

function renderDef(def: TopicSceneDef, autoRotate?: boolean) {
  switch (def.kind) {
    case 'particles':
      return (
        <>
          <SceneLights accent={def.colors[0]} />
          {def.colors.map((c, i) => (
            <group key={i} position={[(i - 1) * 1.1, 0, 0]}>
              <ParticleField
                count={Math.floor(def.count / def.colors.length)}
                spread={[0.7, 0.6, 0.7]}
                speed={def.speeds[i] ?? 1}
                color={c}
                ordered={def.ordered[i]}
              />
            </group>
          ))}
        </>
      )
    case 'atom':
      return <AtomScene def={def} autoRotate={autoRotate} />
    case 'burn':
      return (
        <>
          <SceneLights accent={def.accent} />
          <BurnerFlame />
          <ParticleField count={35} spread={[0.6, 0.9, 0.6]} speed={2 + def.wind} color={def.accent} />
        </>
      )
    case 'electrolysis':
      return <ElectrolysisScene def={def} />
    case 'bond':
      return <BondScene def={def} autoRotate={autoRotate} />
    case 'gas':
      return (
        <>
          <SceneLights accent={def.colors[0]} />
          {def.colors.map((c, i) => (
            <ParticleField
              key={i}
              count={18 + i * 8}
              spread={[1.5 + def.pressure, 1, 1.2]}
              speed={0.4 + def.pressure + i * 0.2}
              color={c}
            />
          ))}
        </>
      )
    case 'crystal':
      return <CrystalScene def={def} autoRotate={autoRotate} />
    case 'metal':
      return (
        <>
          <SceneLights accent={def.color} />
          <SpinGroup autoRotate={autoRotate}>
            <mesh>
              <boxGeometry args={[0.8, 0.15, 0.4]} />
              <meshStandardMaterial color={def.color} metalness={0.85} roughness={0.25} />
            </mesh>
            <ParticleField count={15} spread={[0.5, 0.4, 0.5]} speed={1 + def.activity * 2} color="#ffaa44" />
          </SpinGroup>
        </>
      )
    case 'periodic':
      return (
        <>
          <SceneLights accent={def.accent} />
          <SpinGroup autoRotate={autoRotate} speed={0.08}>
            {Array.from({ length: 6 + def.period }).map((_, i) => (
              <mesh
                key={i}
                position={[Math.cos((i / 8) * Math.PI * 2) * 0.75, Math.sin((i / 8) * Math.PI * 2) * 0.45, 0]}
              >
                <boxGeometry args={[0.18, 0.18, 0.06]} />
                <meshStandardMaterial color={def.accent} emissive={def.accent} emissiveIntensity={0.2 + (i % 3) * 0.1} />
              </mesh>
            ))}
          </SpinGroup>
        </>
      )
    case 'industry':
      return <IndustryScene def={def} />
    default:
      return null
  }
}

export function ConfiguredTopicScene({ sceneId, autoRotate }: { sceneId: string; autoRotate?: boolean }) {
  const def = getTopicSceneDef(sceneId)
  if (!def) {
    return (
      <>
        <SceneLights />
        <ParticleField count={40} spread={[1.2, 1, 1.2]} speed={1} color="#3dffec" />
      </>
    )
  }
  return <>{renderDef(def, autoRotate)}</>
}
