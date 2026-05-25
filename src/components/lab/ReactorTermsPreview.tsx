import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { assertPreviewElectronAnimation } from '../../lab/reactorPreviewGuarantee'
import { AtomStructureModel } from './AtomStructureModel'
import { buildReactorPreviewAtoms, reactorPreviewAtomScale } from './reactorPreviewLayout'

/**
 * Превью реагентов: 4 Cr + 4 K + 7 O₂ → 4 + 4 + 7 моделей (O₂ = один атом на коэффициент).
 * Электроны всегда анимируются (контракт reactorPreviewGuarantee).
 */
export function ReactorTermsPreview({ terms }: { terms: readonly ReactorEquationTerm[] }) {
  const previewAtoms = useMemo(() => buildReactorPreviewAtoms(terms), [terms])

  const n = previewAtoms.length
  const groupRef = useRef<THREE.Group>(null)
  const atomGroupRefs = useRef<(THREE.Group | null)[]>([])
  const scale = reactorPreviewAtomScale(n)
  const dense = n > 8
  const slowSpin = n <= 18
  const driftAtoms = n <= 24
  const electronAnimate = true

  useEffect(() => {
    assertPreviewElectronAnimation(electronAnimate, n)
  }, [electronAnimate, n])

  useFrame((s) => {
    const t = s.clock.elapsedTime
    const root = groupRef.current
    if (root && slowSpin) root.rotation.y = t * (dense ? 0.032 : 0.04)

    if (!driftAtoms) return
    for (let i = 0; i < n; i++) {
      const g = atomGroupRefs.current[i] ?? null
      if (!g) continue
      const { pos } = previewAtoms[i]!
      const [bx, by, bz] = pos
      const ph = i * 1.6 + previewAtoms[i]!.z * 0.37
      const amp = dense ? 0.024 : 0.05
      g.position.set(
        bx + Math.sin(t * 0.32 + ph) * amp,
        by + Math.sin(t * 0.25 + ph * 0.9) * amp * 0.7,
        bz + Math.cos(t * 0.28 + ph * 1.05) * amp,
      )
    }
  })

  if (n === 0) return null

  return (
    <group ref={groupRef}>
      {previewAtoms.map((atom, i) => (
        <group
          key={`${atom.termIndex}-${atom.atomInTerm}-${atom.z}-${i}`}
          position={atom.pos}
          ref={(el) => {
            atomGroupRefs.current[i] = el
          }}
        >
          <group scale={scale}>
            <AtomStructureModel
              z={atom.z}
              animate={electronAnimate}
              previewStatic={false}
              previewEmphasis
              previewLite={dense}
              localLight={!dense && atom.termIndex === 0 && atom.atomInTerm === 0}
            />
          </group>
        </group>
      ))}
    </group>
  )
}
