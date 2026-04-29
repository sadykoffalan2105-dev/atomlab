import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AtomStructureModel } from './AtomStructureModel'

const Y_ATOMS = 0.12
const ATOM_SCALE = 0.44

/**
 * До запуска синтеза — ряд выбранных Z (2–4), плавный поворот.
 */
export function ReactorReagentRowPreview({ zs }: { zs: number[] }) {
  const n = Math.min(4, Math.max(0, zs.length))
  const g0 = useRef<THREE.Group>(null)
  const g1 = useRef<THREE.Group>(null)
  const g2 = useRef<THREE.Group>(null)
  const g3 = useRef<THREE.Group>(null)
  const gRefs = [g0, g1, g2, g3]

  const xs = (() => {
    if (n === 0) return []
    const sep = n <= 2 ? 1.28 : Math.max(0.55, 2.45 / (n - 0.3))
    const w = (n - 1) * sep
    return Array.from({ length: n }, (_, i) => -w * 0.5 + i * sep)
  })()

  useFrame((s) => {
    const t = s.clock.elapsedTime
    for (let i = 0; i < n; i++) {
      const g = gRefs[i].current
      if (g) g.rotation.y = t * (i % 2 === 0 ? 0.5 : -0.46)
    }
  })

  if (n === 0) return null

  return (
    <>
      {zs.slice(0, 4).map((z, i) => (
        <group key={`${i}-${z}`} ref={gRefs[i]} position={[xs[i]!, Y_ATOMS, 0]}>
          <group scale={ATOM_SCALE}>
            <AtomStructureModel z={z} />
          </group>
        </group>
      ))}
    </>
  )
}
