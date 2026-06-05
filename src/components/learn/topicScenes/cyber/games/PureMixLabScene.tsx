import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

const CYAN = '#3dffec'
const GOLD = '#ffe566'
const PINK = '#e84a7a'
const GREEN = '#5cff8a'
const VIOLET = '#b06cff'

type SampleVisual = {
  mode: 'pure' | 'mix'
  colors: string[]
}

const SAMPLE_VISUALS: Record<string, SampleVisual> = {
  water: { mode: 'pure', colors: [CYAN] },
  cu: { mode: 'pure', colors: [GOLD] },
  sugar: { mode: 'pure', colors: ['#f8f0ff'] },
  air: { mode: 'mix', colors: [CYAN, PINK, GOLD] },
  milk: { mode: 'mix', colors: ['#f5f5ff', GOLD, '#ddd'] },
  soil: { mode: 'mix', colors: [GOLD, '#8b6914', GREEN] },
}

function Emissive({ color, intensity = 0.55 }: { color: string; intensity?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={intensity}
      metalness={0.2}
      roughness={0.4}
    />
  )
}

function Starfield() {
  const positions = useMemo(() => {
    const pts = new Float32Array(240 * 3)
    for (let i = 0; i < 240; i++) {
      pts[i * 3] = (Math.random() - 0.5) * 14
      pts[i * 3 + 1] = (Math.random() - 0.5) * 8
      pts[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2
    }
    return pts
  }, [])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#8ec8ff" transparent opacity={0.65} sizeAttenuation />
    </points>
  )
}

function Portal({ side, active }: { side: 'pure' | 'mix'; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  const color = side === 'pure' ? CYAN : VIOLET
  useFrame((state) => {
    if (!ref.current) return
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.06
    ref.current.scale.setScalar(active ? pulse * 1.08 : pulse)
  })
  return (
    <group position={[side === 'pure' ? -1.55 : 1.55, -0.05, 0]}>
      <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.42, 0.06, 16, 48]} />
        <Emissive color={color} intensity={active ? 0.95 : 0.45} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function SampleCapsule({
  sampleId,
  flyTarget,
}: {
  sampleId: string
  flyTarget: 'pure' | 'mix' | null
}) {
  const group = useRef<THREE.Group>(null)
  const visual = SAMPLE_VISUALS[sampleId] ?? { mode: 'mix', colors: [CYAN, PINK] }
  const fly = useRef(0)

  const particles = useMemo(() => {
    const out: { pos: [number, number, number]; color: string }[] = []
    if (visual.mode === 'pure') {
      let i = 0
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          for (let z = -1; z <= 1; z++) {
            out.push({
              pos: [x * 0.14, y * 0.14, z * 0.14],
              color: visual.colors[0] ?? CYAN,
            })
            i++
          }
        }
      }
    } else {
      for (let i = 0; i < 28; i++) {
        const r = 0.32 * Math.cbrt(Math.random())
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        out.push({
          pos: [
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi),
          ],
          color: visual.colors[i % visual.colors.length] ?? CYAN,
        })
      }
    }
    return out
  }, [sampleId, visual])

  useFrame((_, dt) => {
    if (!group.current) return
    if (flyTarget) {
      fly.current = Math.min(1, fly.current + dt * 2.4)
      const targetX = flyTarget === 'pure' ? -1.55 : 1.55
      group.current.position.x = THREE.MathUtils.lerp(0, targetX, fly.current)
      group.current.position.y = THREE.MathUtils.lerp(0, -0.05, fly.current)
      group.current.scale.setScalar(THREE.MathUtils.lerp(1, 0.35, fly.current))
    } else {
      fly.current = 0
      group.current.position.x = 0
      group.current.position.y = 0
      group.current.scale.setScalar(1)
      group.current.rotation.y += dt * 0.45
    }
  })

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[0.52, 32, 32]} />
        <meshPhysicalMaterial
          color="#a8d8ff"
          transparent
          opacity={0.18}
          transmission={0.55}
          thickness={0.4}
          roughness={0.1}
        />
      </mesh>
      {visual.mode === 'pure' ? (
        <mesh>
          <icosahedronGeometry args={[0.22, 1]} />
          <meshStandardMaterial color={visual.colors[0]} wireframe emissive={visual.colors[0]} emissiveIntensity={0.5} />
        </mesh>
      ) : null}
      {particles.map((p, i) => (
        <mesh key={i} position={p.pos}>
          <sphereGeometry args={[visual.mode === 'pure' ? 0.05 : 0.055, 8, 8]} />
          <Emissive color={p.color} intensity={visual.mode === 'pure' ? 0.5 : 0.75} />
        </mesh>
      ))}
    </group>
  )
}

export function PureMixLabScene({
  sampleId,
  flyTarget,
  highlightPortal,
}: {
  sampleId: string
  flyTarget: 'pure' | 'mix' | null
  highlightPortal: 'pure' | 'mix' | null
}) {
  return (
    <>
      <color attach="background" args={['#030810']} />
      <fog attach="fog" args={['#030810', 5, 14]} />
      <ambientLight intensity={0.42} />
      <pointLight position={[2.5, 3, 3]} intensity={1} color={CYAN} />
      <pointLight position={[-2, 1, 2]} intensity={0.5} color={VIOLET} />
      <Starfield />
      <Portal side="pure" active={highlightPortal === 'pure'} />
      <Portal side="mix" active={highlightPortal === 'mix'} />
      <mesh position={[0, -0.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.05, 48]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
      <SampleCapsule sampleId={sampleId} flyTarget={flyTarget} />
    </>
  )
}
