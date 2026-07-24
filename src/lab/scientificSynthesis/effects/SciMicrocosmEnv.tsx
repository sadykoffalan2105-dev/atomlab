import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/** Лёгкий deep-space фон: без Stars (дорого), мало пыли, статика небул. */
export function SciMicrocosmEnv({ lite = false }: { lite?: boolean }) {
  const dustRef = useRef<THREE.Points>(null)

  const dust = useMemo(() => {
    const n = lite ? 24 : 56
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return geo
  }, [lite])

  useEffect(() => {
    return () => {
      dust.dispose()
    }
  }, [dust])

  useFrame((s) => {
    if (!dustRef.current) return
    dustRef.current.rotation.y = s.clock.elapsedTime * 0.01
  })

  return (
    <group>
      <color attach="background" args={['#020208']} />
      <fog attach="fog" args={['#020208', 10, 24]} />
      <mesh position={[-2.5, 0.8, -6]} scale={[7, 4, 1]} renderOrder={-20}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#1a0840"
          transparent
          opacity={0.06}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh position={[2.2, -0.6, -7]} scale={[6, 3.5, 1]} renderOrder={-20}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#041828"
          transparent
          opacity={0.05}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <points ref={dustRef} geometry={dust} renderOrder={-10}>
        <pointsMaterial
          color="#9ad8ff"
          size={0.022}
          sizeAttenuation
          transparent
          opacity={0.28}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}
