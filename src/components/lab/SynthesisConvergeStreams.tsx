import { useLayoutEffect, useMemo, useRef } from 'react'
import { Sparkles } from '@react-three/drei'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { getElementByZ } from '../../data/elements'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { LightweightElementBall } from './LightweightElementBall'
import {
  LAUNCH_ATOM_STAGGER,
  LAUNCH_STREAM_FLY_DUR,
  LAUNCH_TERM_STAGGER,
} from '../../lab/synthesisLaunchTiming'
import {
  REACTION_CENTER,
  buildSynthesisApproachAtoms,
  getTermApproachOrigins,
  synthesisFlyAtomScale,
} from './reactorPreviewLayout'

const STREAM_FLY_DUR = LAUNCH_STREAM_FLY_DUR
const TERM_STAGGER = LAUNCH_TERM_STAGGER
const ATOM_STAGGER = LAUNCH_ATOM_STAGGER
const REF_RETRY_MAX = 24

const STREAM_FLY_DUR_EXPORT = STREAM_FLY_DUR
const TERM_STAGGER_EXPORT = TERM_STAGGER
const ATOM_STAGGER_EXPORT = ATOM_STAGGER

export const SYNTHESIS_STREAM_FLY_DUR = STREAM_FLY_DUR_EXPORT
export const SYNTHESIS_STREAM_STAGGER = TERM_STAGGER_EXPORT
export const SYNTHESIS_ATOM_STAGGER = ATOM_STAGGER_EXPORT

function refsReady(
  streamRefs: (THREE.Group | null)[],
  atomRefs: (THREE.Group | null)[],
  streamCount: number,
  atomCount: number,
): boolean {
  if (streamCount > 0 && !streamRefs.slice(0, streamCount).every(Boolean)) return false
  if (atomCount > 0 && !atomRefs.slice(0, atomCount).every(Boolean)) return false
  return streamCount > 0 || atomCount > 0
}

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
  const timelineStartedRef = useRef(false)

  useLayoutEffect(() => {
    onImpactRef.current = onImpact
  }, [onImpact])

  useLayoutEffect(() => {
    atomRefs.current = new Array(approachAtoms.length).fill(null)
    atomScaleRefs.current = new Array(approachAtoms.length).fill(null)
    streamRefs.current = new Array(termStreams.length).fill(null)
    beamMatRefs.current = new Array(termStreams.length).fill(null)
    timelineStartedRef.current = false

    let ctx: ReturnType<typeof gsap.context> | null = null
    let raf = 0
    let attempts = 0

    const startTimeline = () => {
      if (timelineStartedRef.current) return
      if (
        !refsReady(
          streamRefs.current,
          atomRefs.current,
          termStreams.length,
          approachAtoms.length,
        )
      ) {
        return
      }
      timelineStartedRef.current = true

      ctx = gsap.context(() => {
        const tl = gsap.timeline({
          onComplete: () => onImpactRef.current(),
        })
        let tweensAdded = 0

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
              ease: 'power2.inOut',
            },
            stagger,
          )
          tweensAdded++
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
              ease: 'power2.inOut',
            },
            stagger,
          )
          tweensAdded++
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

        if (tweensAdded === 0) {
          gsap.delayedCall(0.05, () => onImpactRef.current())
        }
      })
    }

    const tryStart = () => {
      attempts += 1
      startTimeline()
      if (!timelineStartedRef.current && attempts < REF_RETRY_MAX) {
        raf = requestAnimationFrame(tryStart)
      } else if (!timelineStartedRef.current) {
        onImpactRef.current()
      }
    }

    raf = requestAnimationFrame(tryStart)

    return () => {
      cancelAnimationFrame(raf)
      ctx?.revert()
      timelineStartedRef.current = false
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
            <mesh position={[0, 0, -0.52]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.018, 0.085, 1.12, 16]} />
              <meshBasicMaterial
                ref={(el) => {
                  beamMatRefs.current[i] = el
                }}
                color={color}
                transparent
                opacity={0.38}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            <mesh position={[0, 0, -0.48]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.006, 0.028, 1.05, 10]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            <Sparkles count={42} scale={1.9} size={2.1} speed={2.6} opacity={0.85} color={color} />
            <pointLight color={color} intensity={1.4} distance={4.2} decay={2} />
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
              <LightweightElementBall z={atom.z} radius={0.42} segments={14} />
            </group>
            <Sparkles count={14} scale={0.75} size={1.1} speed={1.8} opacity={0.62} color={color} />
          </group>
        )
      })}
    </>
  )
}
