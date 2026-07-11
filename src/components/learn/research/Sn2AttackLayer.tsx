import { useRef, useState, type RefObject } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import styles from './OrganicBuilderCanvas.module.css'

const IDEAL = 180
const TOL = 28

function angleDeg(nu: THREE.Vector3): number {
  let deg = (Math.atan2(nu.z, nu.x) * 180) / Math.PI
  if (deg < 0) deg += 360
  return deg
}

function deltaToIdeal(deg: number): number {
  const d = Math.abs(deg - IDEAL) % 360
  return d > 180 ? 360 - d : d
}

function makeSectorGeo() {
  const shape = new THREE.Shape()
  const r = 3.2
  const a0 = ((IDEAL - TOL) * Math.PI) / 180
  const a1 = ((IDEAL + TOL) * Math.PI) / 180
  shape.moveTo(0, 0)
  shape.lineTo(Math.cos(a0) * r, Math.sin(a0) * r)
  shape.absarc(0, 0, r, a0, a1, false)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

function NuLabelFollower({ meshRef }: { meshRef: RefObject<THREE.Mesh | null> }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (group.current && meshRef.current) {
      group.current.position.copy(meshRef.current.position)
      group.current.position.y = 0.9
    }
  })
  return (
    <group ref={group}>
      <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <span className={styles.atomTagNu}>Nu⁻</span>
      </Html>
    </group>
  )
}

/** SN2 слой для встраивания в ту же Canvas, что и сборка молекулы. */
export function Sn2AttackLayer({
  onAngle,
  onOrbitLock,
}: {
  onAngle: (deg: number, delta: number, inZone: boolean) => void
  onOrbitLock: (locked: boolean) => void
}) {
  const nuRef = useRef<THREE.Mesh>(null)
  const dragging = useRef(false)
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const hit = useRef(new THREE.Vector3())
  const [sector] = useState(makeSectorGeo)

  useFrame(() => {
    if (!nuRef.current) return
    const p = nuRef.current.position
    const deg = angleDeg(p)
    const d = deltaToIdeal(deg)
    onAngle(deg, d, d <= TOL)
  })

  const project = (e: ThreeEvent<PointerEvent>) => {
    const ok = e.ray.intersectPlane(plane.current, hit.current)
    if (!ok || !nuRef.current) return
    nuRef.current.position.set(
      Math.max(-4.2, Math.min(4.2, hit.current.x)),
      0.35,
      Math.max(-4.2, Math.min(4.2, hit.current.z)),
    )
  }

  const endDrag = () => {
    dragging.current = false
    onOrbitLock(false)
  }

  return (
    <group position={[0, -0.4, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} geometry={sector}>
        <meshBasicMaterial color="#34d399" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <mesh position={[-1.6, 0.06, 0]}>
        <boxGeometry args={[3.2, 0.025, 0.025]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.55} />
      </mesh>

      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.38, 28, 28]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.35} roughness={0.35} />
      </mesh>
      <Html position={[0, 0.95, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <span className={styles.atomTag}>C</span>
      </Html>

      <mesh position={[2.1, 0.32, 0]}>
        <sphereGeometry args={[0.28, 20, 20]} />
        <meshStandardMaterial color="#f87171" emissive="#9f1239" emissiveIntensity={0.35} />
      </mesh>
      <Html position={[2.1, 0.78, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <span className={styles.atomTagLg}>LG</span>
      </Html>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        onPointerMove={(e) => {
          if (!dragging.current) return
          e.stopPropagation()
          project(e)
        }}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <planeGeometry args={[12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh
        ref={nuRef}
        position={[-2.4, 0.35, 0.55]}
        onPointerDown={(e) => {
          e.stopPropagation()
          dragging.current = true
          onOrbitLock(true)
          project(e)
        }}
        onPointerUp={endDrag}
      >
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshStandardMaterial color="#67e8f9" emissive="#0e7490" emissiveIntensity={0.45} />
      </mesh>
      <NuLabelFollower meshRef={nuRef} />
    </group>
  )
}

export const SN2_TOL_DEG = TOL
export const SN2_IDEAL_DEG = IDEAL
