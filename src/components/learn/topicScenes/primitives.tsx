import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function SceneLights({ accent = '#3dffec' }: { accent?: string }) {
  return (
    <>
      <ambientLight intensity={0.38} />
      <directionalLight position={[4, 6, 3]} intensity={0.9} color="#e8eeff" />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} color={accent} />
      <pointLight position={[0, 1.2, 2]} intensity={0.55} color={accent} distance={10} />
    </>
  )
}

export function SpinGroup({
  children,
  autoRotate = true,
  speed = 0.15,
}: {
  children: ReactNode
  autoRotate?: boolean
  speed?: number
}) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, d) => {
    if (g.current && autoRotate) g.current.rotation.y += d * speed
  })
  return <group ref={g}>{children}</group>
}

/** Сфера-«атом» с цветом элемента. */
export function AtomBall({
  color,
  radius = 0.12,
  emissive = 0.35,
  position = [0, 0, 0] as [number, number, number],
}: {
  color: string
  radius?: number
  emissive?: number
  position?: [number, number, number]
}) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} metalness={0.2} roughness={0.35} />
    </mesh>
  )
}

export function NucleusCluster({
  protons,
  neutrons,
  scale = 1,
}: {
  protons: number
  neutrons: number
  scale?: number
}) {
  const balls = useMemo(() => {
    const out: { pos: [number, number, number]; color: string }[] = []
    let i = 0
    const r = 0.09 * scale
    for (let p = 0; p < protons; p++) {
      const a = (i / (protons + neutrons)) * Math.PI * 2
      out.push({ pos: [Math.cos(a) * r * 0.8, Math.sin(a * 1.3) * r, Math.sin(a) * r * 0.8], color: '#ff5566' })
      i++
    }
    for (let n = 0; n < neutrons; n++) {
      const a = (i / (protons + neutrons)) * Math.PI * 2
      out.push({ pos: [Math.cos(a) * r, Math.sin(a * 0.9) * r * 0.7, Math.sin(a) * r], color: '#8899aa' })
      i++
    }
    return out
  }, [protons, neutrons, scale])
  return (
    <group>
      {balls.map((b, idx) => (
        <AtomBall key={idx} color={b.color} radius={0.07 * scale} position={b.pos} emissive={0.2} />
      ))}
    </group>
  )
}

/** Электрон на орбите (кольцо + точка). */
export function ElectronShell({
  radius,
  electrons,
  color = '#5ecbff',
  tilt = 0,
  phase = 0,
}: {
  radius: number
  electrons: number
  color?: string
  tilt?: number
  phase?: number
}) {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (!g.current) return
    const t = s.clock.elapsedTime + phase
    g.current.rotation.y = t * 0.8
    g.current.rotation.x = tilt
  })
  return (
    <group ref={g}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.008, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} />
      </mesh>
      {Array.from({ length: electrons }).map((_, i) => {
        const a = (i / electrons) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * radius, 0, Math.sin(a) * radius]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Поле частиц — агрегатные состояния, смеси, воздух. */
export function ParticleField({
  count,
  spread,
  speed,
  color,
  ordered = false,
}: {
  count: number
  spread: [number, number, number]
  speed: number
  color: string
  /** true — решётка (твёрдое тело) */
  ordered?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (Math.random() - 0.5) * spread[0],
        y: (Math.random() - 0.5) * spread[1],
        z: (Math.random() - 0.5) * spread[2],
        phase: Math.random() * Math.PI * 2,
        grid: ordered
          ? [
              ((i % 5) - 2) * 0.22,
              (Math.floor(i / 5) % 4 - 1.5) * 0.22,
              (Math.floor(i / 20) - 1) * 0.22,
            ]
          : null,
      })),
    [count, spread, ordered],
  )

  useFrame((s) => {
    const mesh = ref.current
    if (!mesh) return
    const t = s.clock.elapsedTime
    seeds.forEach((p, i) => {
      if (p.grid) {
        dummy.position.set(p.grid[0], p.grid[1], p.grid[2])
      } else {
        dummy.position.set(
          p.x + Math.sin(t * speed + p.phase) * 0.08,
          p.y + Math.cos(t * speed * 0.7 + p.phase) * 0.06,
          p.z + Math.sin(t * speed * 0.5 + p.phase) * 0.08,
        )
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.055, 10, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
    </instancedMesh>
  )
}

export function BondRod({
  from,
  to,
  color = '#88aacc',
}: {
  from: [number, number, number]
  to: [number, number, number]
  color?: string
}) {
  const mid: [number, number, number] = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  ]
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  const len = dir.length()
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  return (
    <mesh position={mid} quaternion={q}>
      <cylinderGeometry args={[0.03, 0.03, len, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
    </mesh>
  )
}

/** Пламя горелки (для лаборатории). */
export function BurnerFlame() {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (!g.current) return
    const t = s.clock.elapsedTime
    g.current.scale.y = 1 + Math.sin(t * 8) * 0.12
    g.current.scale.x = 1 + Math.sin(t * 6) * 0.08
  })
  return (
    <group ref={g} position={[0, 0.55, 0]}>
      <mesh>
        <coneGeometry args={[0.12, 0.35, 16]} />
        <meshStandardMaterial color="#ffaa44" emissive="#ff6622" emissiveIntensity={0.9} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <coneGeometry args={[0.06, 0.2, 12]} />
        <meshStandardMaterial color="#3dffec" emissive="#3dffec" emissiveIntensity={0.7} transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

export function GlassFlask({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshPhysicalMaterial
          color="#a8d8ff"
          transmission={0.92}
          thickness={0.3}
          roughness={0.1}
          transparent
          opacity={0.35}
        />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.35, 16]} />
        <meshPhysicalMaterial color="#c8e8ff" transmission={0.85} transparent opacity={0.4} />
      </mesh>
    </group>
  )
}
