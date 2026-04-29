import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const PROTON_COLOR = new THREE.Color('#ff5a6a')
const NEUTRON_COLOR = new THREE.Color('#6bcfff')
const ELECTRON_COLOR = new THREE.Color('#3dffec')

const _v = new THREE.Vector3()
const _euler = new THREE.Euler()

function setElectronOnTorusMajorCircle(
  mesh: THREE.Object3D,
  majorR: number,
  angle: number,
  torusEulerX: number,
  torusEulerY: number,
  torusEulerZ: number,
): void {
  _euler.set(torusEulerX, torusEulerY, torusEulerZ)
  _v.set(majorR * Math.cos(angle), majorR * Math.sin(angle), 0)
  _v.applyEuler(_euler)
  mesh.position.copy(_v)
}

export function DecorativeAtom() {
  const group = useRef<THREE.Group>(null)
  const r1a = useRef<THREE.Mesh>(null)
  const r1b = useRef<THREE.Mesh>(null)
  const r2a = useRef<THREE.Mesh>(null)
  const r3a = useRef<THREE.Mesh>(null)
  const r3b = useRef<THREE.Mesh>(null)
  const angle1 = useRef(0)
  const angle2 = useRef(0)
  const angle3 = useRef(0)

  const nucleus = useMemo(() => {
    const pts: [THREE.Color, THREE.Vector3][] = []
    const jitter = (i: number, s: number) => {
      const a = Math.sin(i * 2.17) * 0.5 * s
      const b = Math.cos(i * 1.73) * 0.5 * s
      const c = Math.sin(i * 3.01 + 1) * 0.5 * s
      return new THREE.Vector3(a, b, c)
    }
    const r = 0.1
    for (let i = 0; i < 6; i++) pts.push([PROTON_COLOR, jitter(i, r)])
    for (let i = 0; i < 6; i++) pts.push([NEUTRON_COLOR, jitter(i + 7, r)])
    return pts
  }, [])

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.12
    angle1.current += delta * 1.05
    angle2.current += delta * 0.88
    angle3.current += delta * 0.72
    const e1x = Math.PI / 2
    if (r1a.current) setElectronOnTorusMajorCircle(r1a.current, 0.55, angle1.current, e1x, 0, 0)
    if (r1b.current) setElectronOnTorusMajorCircle(r1b.current, 0.55, angle1.current + Math.PI, e1x, 0, 0)
    const e2z = Math.PI / 3
    if (r2a.current) setElectronOnTorusMajorCircle(r2a.current, 0.82, angle2.current, 0, 0, e2z)
    const e3x = Math.PI / 4
    const e3y = Math.PI / 5
    if (r3a.current) setElectronOnTorusMajorCircle(r3a.current, 1.08, angle3.current, e3x, e3y, 0)
    if (r3b.current) setElectronOnTorusMajorCircle(r3b.current, 1.08, angle3.current + Math.PI, e3x, e3y, 0)
  })

  const electronMesh = (ref: RefObject<THREE.Mesh | null>) => (
    <mesh ref={ref}>
      <sphereGeometry args={[0.06, 16, 16]} />
      <meshStandardMaterial
        color={ELECTRON_COLOR}
        emissive={ELECTRON_COLOR}
        emissiveIntensity={1.8}
        metalness={0.2}
        roughness={0.35}
      />
    </mesh>
  )

  return (
    <group ref={group}>
      <group>
        {nucleus.map(([col, pos], i) => (
          <mesh key={i} position={pos}>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshStandardMaterial
              color={col}
              emissive={col}
              emissiveIntensity={0.45}
              metalness={0.15}
              roughness={0.4}
            />
          </mesh>
        ))}
      </group>
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.008, 8, 64]} />
          <meshBasicMaterial color="#3dffec" transparent opacity={0.35} />
        </mesh>
        {electronMesh(r1a)}
        {electronMesh(r1b)}
      </group>
      <group>
        <mesh rotation={[0, 0, Math.PI / 3]}>
          <torusGeometry args={[0.82, 0.006, 8, 64]} />
          <meshBasicMaterial color="#b56bff" transparent opacity={0.28} />
        </mesh>
        {electronMesh(r2a)}
      </group>
      <group>
        <mesh rotation={[Math.PI / 4, Math.PI / 5, 0]}>
          <torusGeometry args={[1.08, 0.005, 8, 64]} />
          <meshBasicMaterial color="#ff5ec7" transparent opacity={0.22} />
        </mesh>
        {electronMesh(r3a)}
        {electronMesh(r3b)}
      </group>
      <pointLight position={[0, 0, 0]} intensity={1.2} distance={4} color="#7afcff" />
    </group>
  )
}
