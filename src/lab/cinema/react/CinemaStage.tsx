import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CameraRigState } from '../core/states'

/**
 * Сцена микромира: глубокий неоновый фон, объёмная пыль и «виртуальная камера».
 *
 * Реальную камеру лаборатории двигать нельзя — её держит LabScene (зум, орбита,
 * пользовательский drag). Поэтому кинематографические наезды делаются обратным
 * преобразованием всего мира: сцена подъезжает к зрителю сама. Побочный эффект
 * приятный — пользователь в любой момент может крутить орбиту, и кадр не спорит.
 */

export function CinemaCameraRig({
  state,
  baseScale = 0.58,
  children,
}: {
  state: CameraRigState
  baseScale?: number
  children: ReactNode
}) {
  const group = useRef<THREE.Group>(null)

  useFrame((s) => {
    const g = group.current
    if (!g) return
    const t = s.clock.elapsedTime
    const shake = state.shake
    g.scale.setScalar(baseScale * state.zoom)
    g.position.set(
      state.offset.x + (shake > 0.001 ? Math.sin(t * 47.3) * 0.028 * shake : 0),
      state.offset.y + (shake > 0.001 ? Math.cos(t * 53.1) * 0.028 * shake : 0),
      state.offset.z,
    )
    g.rotation.set(0, state.yaw, state.roll + (shake > 0.001 ? Math.sin(t * 41.7) * 0.012 * shake : 0))
  })

  return (
    <group ref={group} scale={baseScale}>
      {children}
    </group>
  )
}

/** Глубокий фон: цвет, туман по дальности, туманности и парящая пыль. */
export function CinemaEnvironment({
  dust = 60,
  background = '#02030a',
  fogNear = 9,
  fogFar = 26,
}: {
  dust?: number
  background?: string
  fogNear?: number
  fogFar?: number
}) {
  const points = useRef<THREE.Points>(null)

  const geo = useMemo(() => {
    const n = Math.max(1, dust)
    const pos = new Float32Array(n * 3)
    let s = 4242
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296
      return s / 4294967296
    }
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rnd() - 0.5) * 16
      pos[i * 3 + 1] = (rnd() - 0.5) * 11
      pos[i * 3 + 2] = (rnd() - 0.5) * 14 - 2
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [dust])

  useEffect(() => {
    return () => {
      geo.dispose()
    }
  }, [geo])

  useFrame((s) => {
    if (points.current) points.current.rotation.y = s.clock.elapsedTime * 0.012
  })

  return (
    <group>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, fogNear, fogFar]} />
      <mesh position={[-3, 1.2, -7]} scale={[9, 5, 1]} renderOrder={-30}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#1d0b4a"
          transparent
          opacity={0.08}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh position={[2.8, -0.9, -8]} scale={[8, 4.5, 1]} renderOrder={-30}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#052032"
          transparent
          opacity={0.07}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <points ref={points} geometry={geo} renderOrder={-20} dispose={null}>
        <pointsMaterial
          color="#a8dcff"
          size={0.022}
          sizeAttenuation
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}
