import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const ELECTRON = '#3dffec'
const _eulerTilt = new THREE.Euler(Math.PI / 4, Math.PI / 5, 0)
const _pos = new THREE.Vector3()

function ElectronBall({ meshRef }: { meshRef: RefObject<THREE.Mesh | null> }) {
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.07, 16, 16]} />
      <meshStandardMaterial color={ELECTRON} emissive={ELECTRON} emissiveIntensity={1.85} />
    </mesh>
  )
}

/** Bohr-модель: электроны всегда движутся по орбитам (образовательная визуализация). */
export function CyberExploreAtom() {
  const e1 = useRef<THREE.Mesh>(null)
  const e2 = useRef<THREE.Mesh>(null)
  const e3 = useRef<THREE.Mesh>(null)
  const a1 = useRef(0)
  const a2 = useRef(0)

  useFrame((_, dt) => {
    a1.current += dt * 1.85
    a2.current += dt * 1.25
    const r1 = 0.55
    const r2 = 0.9
    if (e1.current) {
      e1.current.position.set(Math.cos(a1.current) * r1, Math.sin(a1.current) * r1, 0)
    }
    if (e2.current) {
      e2.current.position.set(
        Math.cos(a1.current + Math.PI) * r1,
        Math.sin(a1.current + Math.PI) * r1,
        0,
      )
    }
    if (e3.current) {
      _pos.set(Math.cos(a2.current) * r2, Math.sin(a2.current) * r2, 0)
      _pos.applyEuler(_eulerTilt)
      e3.current.position.copy(_pos)
    }
  })

  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial
          color="#5ecbff"
          emissive="#3a8ac8"
          emissiveIntensity={0.55}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>
      {[
        [0.08, 0.06, 0.05],
        [-0.07, 0.05, -0.04],
        [0.04, -0.08, 0.06],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#ff5a6a" emissive="#ff5a6a" emissiveIntensity={0.5} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.007, 10, 56]} />
        <meshBasicMaterial color={ELECTRON} transparent opacity={0.42} />
      </mesh>
      <ElectronBall meshRef={e1} />
      <ElectronBall meshRef={e2} />
      <mesh rotation={[Math.PI / 4, Math.PI / 5, 0]}>
        <torusGeometry args={[0.9, 0.006, 10, 56]} />
        <meshBasicMaterial color="#b56bff" transparent opacity={0.3} />
      </mesh>
      <ElectronBall meshRef={e3} />
      <pointLight position={[0, 0, 0.5]} intensity={1.4} color="#7afcff" distance={4} />
    </group>
  )
}
