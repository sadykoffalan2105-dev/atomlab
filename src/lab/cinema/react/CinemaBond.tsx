import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cinemaUnitCylinder } from '../core/geometries'
import { createBondMaterial } from '../core/bondShader'
import type { BondState } from '../core/states'

const _mid = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _up = new THREE.Vector3(0, 1, 0)

export function CinemaBond({
  state,
  color,
  radius = 0.045,
  plasma = true,
}: {
  state: BondState
  color: number
  radius?: number
  plasma?: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const core = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Mesh>(null)
  const haloMat = useRef<THREE.MeshBasicMaterial>(null)
  const fallbackMat = useRef<THREE.MeshBasicMaterial>(null)
  const geo = cinemaUnitCylinder()
  const material = useMemo(() => (plasma ? createBondMaterial(color) : null), [plasma, color])

  useEffect(() => {
    return () => {
      material?.dispose()
    }
  }, [material])

  useFrame((s) => {
    const g = group.current
    if (!g) return
    if (state.opacity <= 0.01) {
      g.visible = false
      return
    }
    g.visible = true

    _mid.copy(state.from).add(state.to).multiplyScalar(0.5)
    _dir.copy(state.to).sub(state.from)
    const len = Math.max(0.02, _dir.length())
    g.position.copy(_mid)
    g.scale.set(1, len, 1)
    if (_dir.lengthSq() > 1e-9) {
      _quat.setFromUnitVectors(_up, _dir.normalize())
      g.quaternion.copy(_quat)
    }

    const r = radius * (1 - state.thinning * 0.72) * (1 + state.stress * 0.35)
    if (core.current) core.current.scale.set(r, 1, r)
    if (halo.current) halo.current.scale.set(r * 2.8, 1, r * 2.8)

    if (material) {
      const u = material.uniforms
      u.uTime!.value = s.clock.elapsedTime
      u.uStress!.value = state.stress
      u.uOpacity!.value = state.opacity
      u.uForm!.value = state.form
    }
    if (fallbackMat.current) {
      fallbackMat.current.opacity = state.opacity * (0.5 + state.stress * 0.5)
      fallbackMat.current.color.setHex(state.stress > 0.55 ? 0xffffff : color)
    }
    if (haloMat.current) {
      haloMat.current.opacity = state.opacity * (0.14 + state.stress * 0.3)
      haloMat.current.color.setHex(state.stress > 0.6 ? 0xffffff : color)
    }
  })

  return (
    <group ref={group}>
      <mesh ref={halo} geometry={geo} dispose={null} renderOrder={0}>
        <meshBasicMaterial
          ref={haloMat}
          color={color}
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={core} geometry={geo} dispose={null} renderOrder={1}>
        {material ? (
          <primitive object={material} attach="material" />
        ) : (
          <meshBasicMaterial
            ref={fallbackMat}
            color={color}
            transparent
            opacity={0.85}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        )}
      </mesh>
    </group>
  )
}
