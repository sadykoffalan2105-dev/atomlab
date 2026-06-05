import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import {
  assertPreviewElectronAnimation,
  PREVIEW_MAX_ATOM_MODELS,
} from '../../lab/reactorPreviewGuarantee'
import { AtomStructureModel } from './AtomStructureModel'
import { buildReactorPreviewAtoms, reactorPreviewAtomScale } from './reactorPreviewLayout'

/**
 * Превью реагентов: полная структура атома (протоны, нейтроны, электроны).
 * При flightActive позиции управляет GSAP (SynthesisConvergeStreams), не useFrame.
 */
export function ReactorTermsPreview({
  terms,
  visible = true,
  flightActive = false,
  poseLocked = false,
  sharedLighting = false,
  atomGroupRefs: atomGroupRefsExternal,
  atomScaleGroupRefs: atomScaleGroupRefsExternal,
  previewRootRef,
}: {
  terms: readonly ReactorEquationTerm[]
  visible?: boolean
  /** true: drift/GSAP владеют позициями (converge → merge) */
  flightActive?: boolean
  /** true: не сбрасывать позиции/scale к layout (весь синтез) */
  poseLocked?: boolean
  /** true: свет даёт LabReactorLights — без дубля и скачков яркости */
  sharedLighting?: boolean
  atomGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  previewRootRef?: MutableRefObject<THREE.Group | null>
}) {
  const previewAtoms = useMemo(() => buildReactorPreviewAtoms(terms), [terms])

  const n = previewAtoms.length
  const groupRef = useRef<THREE.Group>(null)
  const atomGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomScaleGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomGroupRefs = atomGroupRefsExternal ?? atomGroupRefsLocal
  const atomScaleGroupRefs = atomScaleGroupRefsExternal ?? atomScaleGroupRefsLocal
  const scale = reactorPreviewAtomScale(n)
  const dense = n > 6
  const slowSpin = n <= 12 && visible && !flightActive
  const driftAtoms = n <= 12 && visible && !flightActive
  const electronAnimate = n <= PREVIEW_MAX_ATOM_MODELS

  useEffect(() => {
    assertPreviewElectronAnimation(electronAnimate, n)
  }, [electronAnimate, n])

  /** Только расширяем массивы — не затираем refs после bind (гонка с SynthesisConvergeStreams). */
  useLayoutEffect(() => {
    while (atomGroupRefs.current.length < n) atomGroupRefs.current.push(null)
    while (atomScaleGroupRefs.current.length < n) atomScaleGroupRefs.current.push(null)
    atomGroupRefs.current.length = n
    atomScaleGroupRefs.current.length = n
  }, [n, atomGroupRefs, atomScaleGroupRefs])

  useLayoutEffect(() => {
    if (flightActive || poseLocked) return
    previewAtoms.forEach((atom, i) => {
      const posG = atomGroupRefs.current[i]
      const scaleG = atomScaleGroupRefs.current[i]
      if (posG) posG.position.set(atom.pos[0], atom.pos[1], atom.pos[2])
      if (scaleG) scaleG.scale.set(scale, scale, scale)
    })
  }, [flightActive, poseLocked, previewAtoms, scale, atomGroupRefs, atomScaleGroupRefs])

  useFrame((s) => {
    if (!visible || flightActive) return
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

  useLayoutEffect(() => {
    if (previewRootRef) previewRootRef.current = groupRef.current
  }, [previewRootRef])

  return (
    <group ref={groupRef} visible={visible}>
      {!sharedLighting ? (
        <>
          <ambientLight intensity={dense ? 0.38 : 0.22} />
          <directionalLight position={[4, 6, 2]} intensity={dense ? 0.72 : 0.55} color="#b8c8ff" />
          {dense ? (
            <pointLight position={[0, 0.5, 2.5]} intensity={1.1} distance={12} color="#7afcff" />
          ) : null}
        </>
      ) : null}
      {previewAtoms.map((atom, i) => (
        <group
          key={`${atom.termIndex}-${atom.atomInTerm}-${atom.z}-${i}`}
          position={atom.pos}
          ref={(el) => {
            atomGroupRefs.current[i] = el
          }}
        >
          <group
            scale={scale}
            ref={(el) => {
              atomScaleGroupRefs.current[i] = el
            }}
          >
            <AtomStructureModel
              z={atom.z}
              animate={electronAnimate}
              previewStatic={false}
              previewEmphasis
              previewLite={dense || atom.z > 18}
              localLight={false}
            />
          </group>
        </group>
      ))}
    </group>
  )
}
