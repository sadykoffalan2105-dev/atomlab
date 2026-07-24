import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sharedUnitCylinder } from './sharedGeometries'
import { createPlasmaBondMaterial } from './plasmaBondShader'

const _mid = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _up = new THREE.Vector3(0, 1, 0)

/**
 * Energetic plasma bond: flowing GLSL conduit + soft halo.
 * Falls back to additive core-only when `lite`.
 */
export function SciPlasmaBond({
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
  const coreMeshRef = useRef<THREE.Mesh>(null)
  const haloMeshRef = useRef<THREE.Mesh>(null)
  const geo = sharedUnitCylinder()
  const plasma = useMemo(() => (lite ? null : createPlasmaBondMaterial(color)), [color, lite])
  const liteCore = useRef<THREE.MeshBasicMaterial>(null)

  useEffect(() => {
    return () => {
      plasma?.dispose()
    }
  }, [plasma])

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
    // CylinderGeometry height is along +Y — scale Y to bond length.
    g.scale.set(1, len, 1)
    if (_dir.lengthSq() > 1e-8) {
      _quat.setFromUnitVectors(_up, _dir.normalize())
      g.quaternion.copy(_quat)
    }

    const baseR = THREE.MathUtils.lerp(0.052, 0.02, thinning)
    const stress = glow > 0.7 ? (glow - 0.7) / 0.3 : 0

    if (plasma) {
      plasma.uniforms.uTime.value = s.clock.elapsedTime
      plasma.uniforms.uGlow.value = glow
      plasma.uniforms.uStress.value = stress
      plasma.uniforms.uOpacity.value = 0.75 + glow * 0.25
      if (glow > 0.55) plasma.uniforms.uColor.value.setHex(0xffffff)
      else plasma.uniforms.uColor.value.setHex(color)
    }

    const r = baseR * (1 + glow * 0.9)
    if (coreMeshRef.current) coreMeshRef.current.scale.set(r, 1, r)
    if (haloMeshRef.current && !lite) haloMeshRef.current.scale.set(r * 2.6, 1, r * 2.6)

    if (liteCore.current) {
      const pulse = 0.55 + 0.45 * Math.sin(s.clock.elapsedTime * (2.2 + glow * 4))
      liteCore.current.opacity = 0.4 + 0.5 * pulse + glow * 0.4
      liteCore.current.color.setHex(glow > 0.55 ? 0xffffff : color)
    }
  })

  return (
    <group ref={groupRef}>
      {!lite ? (
        <mesh ref={haloMeshRef} geometry={geo} dispose={null}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.2}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ) : null}
      <mesh ref={coreMeshRef} geometry={geo} dispose={null}>
        {lite || !plasma ? (
          <meshBasicMaterial
            ref={liteCore}
            color={color}
            transparent
            opacity={0.75}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        ) : (
          <primitive object={plasma} attach="material" />
        )}
      </mesh>
    </group>
  )
}
