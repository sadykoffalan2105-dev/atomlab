import { useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sharedCircle, sharedRing } from './sharedGeometries'

export function SciReactionZone({
  intensityRef,
  lite = false,
}: {
  intensityRef: MutableRefObject<number>
  lite?: boolean
}) {
  const ring = useRef<THREE.Mesh>(null)
  const matRing = useRef<THREE.MeshBasicMaterial>(null)
  const matDisc = useRef<THREE.MeshBasicMaterial>(null)

  useFrame((s) => {
    const u = intensityRef.current
    const pulse = 0.75 + 0.25 * Math.sin(s.clock.elapsedTime * 1.6)
    if (ring.current) {
      ring.current.rotation.z = s.clock.elapsedTime * 0.3
      ring.current.scale.setScalar(1 + u * 0.28)
    }
    if (matRing.current) matRing.current.opacity = 0.1 + u * 0.5 * pulse
    if (matDisc.current) matDisc.current.opacity = 0.03 + u * 0.18
  })

  return (
    <group position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={sharedCircle(2.2, lite ? 24 : 40)} dispose={null}>
        <meshBasicMaterial
          ref={matDisc}
          color="#1a6cff"
          transparent
          opacity={0.05}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={ring} geometry={sharedRing(1.5, 1.68, lite ? 32 : 56)} dispose={null}>
        <meshBasicMaterial
          ref={matRing}
          color="#6cf0ff"
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

export function SciShockwave({ amountRef }: { amountRef: MutableRefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => {
    const a = amountRef.current
    if (!mesh.current || !mat.current) return
    mesh.current.visible = a > 0.02
    mesh.current.scale.setScalar(0.35 + a * 3.6)
    mat.current.opacity = a * 0.5
  })
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} visible={false} geometry={sharedRing(0.8, 1.0, 40)} dispose={null}>
      <meshBasicMaterial
        ref={mat}
        color="#ffb060"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
