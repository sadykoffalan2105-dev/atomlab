import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AtomStructureModel } from './AtomStructureModel'

const Y_ATOMS = 0.12
const BASE_ATOM_SCALE = 0.44

/**
 * До запуска синтеза — ряд выбранных Z (2–4), плавный поворот.
 */
export function ReactorReagentRowPreview({ zs }: { zs: number[] }) {
  const n = Math.max(0, zs.length)
  const atomGroupRefs = useRef<(THREE.Group | null)[]>([])

  const xs = (() => {
    if (n === 0) return []
    // Keep total row width bounded; compress spacing for large n.
    const maxWidth = 3.3
    const minSep = 0.26
    const idealSep = n <= 2 ? 1.28 : 2.45 / (n - 0.3)
    const sep = Math.max(minSep, Math.min(idealSep, maxWidth / Math.max(1, n - 1)))
    const w = (n - 1) * sep
    return Array.from({ length: n }, (_, i) => -w * 0.5 + i * sep)
  })()

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
  const atomScale = BASE_ATOM_SCALE * clamp(4 / Math.max(4, n), 0.55, 1)

  useFrame((s) => {
    const t = s.clock.elapsedTime
    for (let i = 0; i < n; i++) {
      const g = atomGroupRefs.current[i] ?? null
      if (g) g.rotation.y = t * (i % 2 === 0 ? 0.5 : -0.46)
    }
  })

  if (n === 0) return null

  return (
    <>
      {zs.map((z, i) => (
        <group
          key={`${i}-${z}`}
          ref={(el) => {
            atomGroupRefs.current[i] = el
          }}
          position={[xs[i]!, Y_ATOMS, 0]}
        >
          <group scale={atomScale}>
            <AtomStructureModel z={z} animate={n <= 4} />
          </group>
        </group>
      ))}
    </>
  )
}
