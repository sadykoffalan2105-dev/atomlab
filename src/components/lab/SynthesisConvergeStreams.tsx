import { useLayoutEffect, useMemo, useRef } from 'react'
import { Sparkles } from '@react-three/drei'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { getElementByZ } from '../../data/elements'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { AtomStructureModel } from './AtomStructureModel'
import {
  REACTION_CENTER,
  buildSynthesisApproachAtoms,
  getTermApproachOrigins,
  synthesisFlyAtomScale,
} from './reactorPreviewLayout'

const STREAM_FLY_DUR = 0.28
const TERM_STAGGER = 0.048
const ATOM_STAGGER = 0.011

/**
 * Реакция: атомы из разных зон экрана летят навстречу друг другу к центру + цветные лучи по слагаемым.
 */
export function SynthesisConvergeStreams({
  terms,
  runId,
  onImpact,
}: {
  terms: readonly ReactorEquationTerm[]
  runId: number
  onImpact: () => void
}) {
  const approachAtoms = useMemo(() => buildSynthesisApproachAtoms(terms), [terms, runId])
  const termStreams = useMemo(() => getTermApproachOrigins(terms), [terms, runId])
  const atomScale = synthesisFlyAtomScale(approachAtoms.length)

  const atomRefs = useRef<(THREE.Group | null)[]>([])
  const atomScaleRefs = useRef<(THREE.Group | null)[]>([])
  const streamRefs = useRef<(THREE.Group | null)[]>([])
  const beamMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const onImpactRef = useRef(onImpact)

  useLayoutEffect(() => {
    onImpactRef.current = onImpact
  }, [onImpact])

  useLayoutEffect(() => {
    atomRefs.current = new Array(approachAtoms.length).fill(null)
    atomScaleRefs.current = new Array(approachAtoms.length).fill(null)
    streamRefs.current = new Array(termStreams.length).fill(null)
    beamMatRefs.current = new Array(termStreams.length).fill(null)

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => onImpactRef.current(),
      })

      termStreams.forEach((g, i) => {
        const node = streamRefs.current[i]
        if (!node) return
        const [sx, sy, sz] = g.pos
        node.position.set(sx, sy, sz)
        node.lookAt(REACTION_CENTER[0], REACTION_CENTER[1], REACTION_CENTER[2])
        const stagger = g.termIndex * TERM_STAGGER
        tl.to(
          node.position,
          {
            x: REACTION_CENTER[0],
            y: REACTION_CENTER[1],
            z: REACTION_CENTER[2],
            duration: STREAM_FLY_DUR,
            ease: 'power4.in',
          },
          stagger,
        )
        const mat = beamMatRefs.current[i]
        if (mat) {
          tl.fromTo(
            mat,
            { opacity: 0.2 },
            { opacity: 0.92, duration: STREAM_FLY_DUR * 0.32, ease: 'power2.out' },
            stagger,
          )
          tl.to(
            mat,
            { opacity: 0, duration: STREAM_FLY_DUR * 0.28, ease: 'power2.in' },
            stagger + STREAM_FLY_DUR * 0.72,
          )
        }
      })

      approachAtoms.forEach((atom, i) => {
        const node = atomRefs.current[i]
        const scaleNode = atomScaleRefs.current[i]
        if (!node) return
        const [sx, sy, sz] = atom.pos
        node.position.set(sx, sy, sz)
        const stagger = atom.termIndex * TERM_STAGGER + atom.atomInTerm * ATOM_STAGGER
        tl.to(
          node.position,
          {
            x: REACTION_CENTER[0],
            y: REACTION_CENTER[1],
            z: REACTION_CENTER[2],
            duration: STREAM_FLY_DUR,
            ease: 'power4.in',
          },
          stagger,
        )
        if (scaleNode) {
          tl.fromTo(
            scaleNode.scale,
            { x: 1, y: 1, z: 1 },
            { x: 1.12, y: 1.12, z: 1.12, duration: STREAM_FLY_DUR * 0.55, ease: 'power2.out' },
            stagger,
          )
          tl.to(
            scaleNode.scale,
            { x: 0.05, y: 0.05, z: 0.05, duration: STREAM_FLY_DUR * 0.38, ease: 'power3.in' },
            stagger + STREAM_FLY_DUR * 0.62,
          )
        }
      })
    })

    return () => {
      ctx.revert()
    }
  }, [runId, approachAtoms, termStreams])

  return (
    <>
      {termStreams.map((g, i) => {
        const hex = getElementByZ(g.z)?.cpkHex
        const color = hex ? `#${hex}` : '#8899aa'
        return (
          <group
            key={`${runId}-beam-${g.termIndex}-${i}`}
            ref={(el) => {
              streamRefs.current[i] = el
            }}
          >
            <mesh position={[0, 0, -0.48]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.014, 0.048, 0.95, 10]} />
              <meshBasicMaterial
                ref={(el) => {
                  beamMatRefs.current[i] = el
                }}
                color={color}
                transparent
                opacity={0.28}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            <Sparkles count={12} scale={1.15} size={1.2} speed={1.4} opacity={0.65} color={color} />
            <pointLight color={color} intensity={0.85} distance={2.8} decay={2} />
          </group>
        )
      })}

      {approachAtoms.map((atom, i) => {
        const hex = getElementByZ(atom.z)?.cpkHex
        const color = hex ? `#${hex}` : '#66ccff'
        return (
          <group
            key={`${runId}-fly-${atom.termIndex}-${atom.atomInTerm}-${atom.z}-${i}`}
            ref={(el) => {
              atomRefs.current[i] = el
            }}
          >
            <group
              ref={(el) => {
                atomScaleRefs.current[i] = el
              }}
              scale={atomScale}
            >
              <AtomStructureModel z={atom.z} animate previewEmphasis previewLite localLight={false} />
            </group>
            <Sparkles count={6} scale={0.55} size={0.9} speed={1.1} opacity={0.45} color={color} />
          </group>
        )
      })}
    </>
  )
}

export const SYNTHESIS_STREAM_FLY_DUR = STREAM_FLY_DUR
export const SYNTHESIS_STREAM_STAGGER = TERM_STAGGER
export const SYNTHESIS_ATOM_STAGGER = ATOM_STAGGER
