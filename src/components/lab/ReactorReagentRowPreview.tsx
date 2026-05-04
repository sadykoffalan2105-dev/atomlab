import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AtomStructureModel } from './AtomStructureModel'

const BASE_ATOM_SCALE = 0.44

function basePosition(z: number, i: number): [number, number, number] {
  const seed = (z + 1) * 0.713 + i * 1.091
  const x = Math.sin(seed) * 0.95 + Math.cos(seed * 1.67) * 0.42
  const y = Math.sin(seed * 0.83) * 0.18 + 0.14
  const zz = Math.cos(seed * 1.11) * 0.82
  return [
    Math.max(-1.1, Math.min(1.1, x * 0.88)),
    Math.max(0, Math.min(0.35, y)),
    Math.max(-0.9, Math.min(0.9, zz)),
  ]
}

/**
 * До запуска синтеза — «бульон» из выбранных Z: детерминированные позиции и лёгкий дрейф.
 */
export function ReactorReagentRowPreview({ zs }: { zs: number[] }) {
  const n = Math.max(0, zs.length)
  const groupRef = useRef<THREE.Group>(null)
  const atomGroupRefs = useRef<(THREE.Group | null)[]>([])

  const basePositions = useMemo(() => zs.map((z, i) => basePosition(z, i)), [zs])

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
  const atomScale = BASE_ATOM_SCALE * clamp(4 / Math.max(4, n), 0.55, 1)

  useFrame((s) => {
    const t = s.clock.elapsedTime
    const root = groupRef.current
    if (root) root.rotation.y = t * 0.085

    for (let i = 0; i < n; i++) {
      const g = atomGroupRefs.current[i] ?? null
      if (!g) continue
      const [bx, by, bz] = basePositions[i]!
      const ph = i * 1.73 + zs[i]! * 0.41
      const ax = 0.12
      const ay = 0.09
      const az = 0.14
      g.position.set(
        bx + Math.sin(t * 0.34 + ph) * ax,
        by + Math.sin(t * 0.27 + ph * 0.91) * ay,
        bz + Math.cos(t * 0.31 + ph * 1.07) * az,
      )
      g.rotation.y = t * (i % 2 === 0 ? 0.5 : -0.46)
    }
  })

  if (n === 0) return null

  return (
    <group ref={groupRef}>
      {zs.map((z, i) => (
        <group
          key={`${i}-${z}`}
          position={basePositions[i]!}
          ref={(el) => {
            atomGroupRefs.current[i] = el
          }}
        >
          <group scale={atomScale}>
            <AtomStructureModel z={z} animate={n <= 8} />
          </group>
        </group>
      ))}
    </group>
  )
}
