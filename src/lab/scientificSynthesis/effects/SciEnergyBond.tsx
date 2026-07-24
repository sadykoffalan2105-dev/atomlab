import { useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sharedUnitCylinder } from './sharedGeometries'

const _mid = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _up = new THREE.Vector3(0, 1, 0)

/** Пульсирующая энергетическая связь (жгут + ореол). */
export function SciEnergyBond({
  from,
  to,
  stretchRef,
  glowRef,
  thinningRef,
  color = 0xa8e8ff,
  visibleRef,
  lite = false,
}: {
  from: THREE.Vector3
  to: THREE.Vector3
  stretchRef?: MutableRefObject<number>
  glowRef?: MutableRefObject<number>
  thinningRef?: MutableRefObject<number>
  color?: number
  visibleRef?: MutableRefObject<boolean>
  lite?: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.MeshBasicMaterial>(null)
  const haloRef = useRef<THREE.MeshBasicMaterial>(null)
  const coreMeshRef = useRef<THREE.Mesh>(null)
  const haloMeshRef = useRef<THREE.Mesh>(null)
  const geo = sharedUnitCylinder()

  useFrame((s) => {
    const g = groupRef.current
    if (!g) return
    if (visibleRef && !visibleRef.current) {
      g.visible = false
      return
    }
    g.visible = true
    const stretch = stretchRef?.current ?? 1
    const glow = glowRef?.current ?? 0
    const thinning = thinningRef?.current ?? 0

    _mid.copy(from).add(to).multiplyScalar(0.5)
    _dir.copy(to).sub(from)
    const len = Math.max(0.04, _dir.length() * stretch)
    g.position.copy(_mid)
    g.scale.set(1, 1, len)
    if (_dir.lengthSq() > 1e-8) {
      _quat.setFromUnitVectors(_up, _dir.normalize())
      g.quaternion.copy(_quat)
    }

    const pulse = 0.55 + 0.45 * Math.sin(s.clock.elapsedTime * (2.2 + glow * 4))
    const baseR = THREE.MathUtils.lerp(0.048, 0.022, thinning)
    if (coreRef.current) {
      coreRef.current.opacity = 0.4 + 0.5 * pulse + glow * 0.4
      coreRef.current.color.setHex(glow > 0.55 ? 0xffffff : color)
    }
    if (haloRef.current) haloRef.current.opacity = 0.12 + 0.28 * pulse + glow * 0.35
    if (coreMeshRef.current) coreMeshRef.current.scale.setScalar(baseR * (1 + glow * 0.85))
    if (haloMeshRef.current) haloMeshRef.current.scale.setScalar(baseR * (2.5 + glow * 1.6))
  })

  return (
    <group ref={groupRef}>
      {!lite ? (
        <mesh ref={haloMeshRef} geometry={geo} dispose={null}>
          <meshBasicMaterial
            ref={haloRef}
            color={color}
            transparent
            opacity={0.25}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ) : null}
      <mesh ref={coreMeshRef} geometry={geo} dispose={null}>
        <meshBasicMaterial
          ref={coreRef}
          color={color}
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}
