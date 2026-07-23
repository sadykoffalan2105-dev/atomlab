import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Sparkles } from '@react-three/drei'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { getElementByZ } from '../../data/elements'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import {
  LAUNCH_ATOM_STAGGER,
  LAUNCH_STREAM_FLY_DUR,
  LAUNCH_TERM_STAGGER,
} from '../../lab/synthesisLaunchTiming'
import {
  REACTION_CENTER,
  buildSynthesisApproachAtoms,
  getTermApproachOrigins,
} from './reactorPreviewLayout'
import type { ReactorVisualTier } from '../../chemistry/reactorVisualTier'
import type { SynthesisTimingProfile } from '../../lab/synthesisTimingProfile'
import { SYNTHESIS_TIMING_BALANCED } from '../../lab/synthesisTimingProfile'
import { SYNTH_ANTI_STALL } from '../../lab/synthesisAntiStall'

const ARC_FRAC = 0.55
const REF_RETRY_MAX = 48

const STREAM_FLY_DUR_EXPORT = LAUNCH_STREAM_FLY_DUR
const TERM_STAGGER_EXPORT = LAUNCH_TERM_STAGGER
const ATOM_STAGGER_EXPORT = LAUNCH_ATOM_STAGGER

export const SYNTHESIS_STREAM_FLY_DUR = STREAM_FLY_DUR_EXPORT
export const SYNTHESIS_STREAM_STAGGER = TERM_STAGGER_EXPORT
export const SYNTHESIS_ATOM_STAGGER = ATOM_STAGGER_EXPORT

const _arcMid = new THREE.Vector3()

function refsReady(
  streamRefs: (THREE.Group | null)[],
  atomRefs: (THREE.Group | null)[],
  streamCount: number,
  atomCount: number,
): boolean {
  if (streamCount > 0) {
    const readyStreams = streamRefs.slice(0, streamCount).filter(Boolean).length
    if (readyStreams < streamCount) return false
  }
  if (atomCount <= 0) return streamCount > 0
  const readyAtoms = atomRefs.slice(0, atomCount).filter(Boolean).length
  // Стартуем, когда все ожидаемые слоты на месте, либо большинство уже смонтировано
  // (mountCap Bohr растёт по кадрам — не ждём forever и не скипаем анимацию).
  if (readyAtoms >= atomCount) return true
  if (readyAtoms >= Math.max(1, Math.ceil(atomCount * 0.75))) return true
  return false
}

function flyAtomArc(
  tl: gsap.core.Timeline,
  node: THREE.Object3D,
  stagger: number,
  dur: number,
): void {
  const sx = node.position.x
  const sy = node.position.y
  const sz = node.position.z
  const [cx, cy, cz] = REACTION_CENTER
  _arcMid.set((sx + cx) * 0.5, (sy + cy) * 0.5 + 0.06, (sz + cz) * 0.5)
  const arcDur = dur * ARC_FRAC
  const finalDur = dur * (1 - ARC_FRAC)
  tl.to(
    node.position,
    { x: _arcMid.x, y: _arcMid.y, z: _arcMid.z, duration: arcDur, ease: 'power3.out' },
    stagger,
  )
  tl.to(
    node.position,
    { x: cx, y: cy, z: cz, duration: finalDur, ease: 'power3.out' },
    stagger + arcDur,
  )
}

/**
 * Лучи слагаемых + GSAP-полёт атомов превью (те же THREE.Group refs, без remount).
 */
export function SynthesisConvergeStreams({
  terms,
  runId,
  onImpact,
  onStreamsReady,
  beamsVisible = true,
  previewAtomGroupRefs,
  previewAtomScaleGroupRefs,
  onBeginAtomFade,
  visualTier = 'full',
  timingProfile = SYNTHESIS_TIMING_BALANCED,
}: {
  terms: readonly ReactorEquationTerm[]
  runId: number
  onImpact: () => void
  onStreamsReady?: () => void
  beamsVisible?: boolean
  previewAtomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  previewAtomScaleGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  onBeginAtomFade?: () => void
  visualTier?: ReactorVisualTier
  timingProfile?: SynthesisTimingProfile
}) {
  const clusterMode = visualTier === 'cluster'
  const flyDur = clusterMode ? timingProfile.clusterFlyDur : timingProfile.streamFlyDur
  const termStagger = clusterMode ? timingProfile.clusterTermStagger : timingProfile.termStagger
  const atomStagger = clusterMode ? 0 : timingProfile.atomStagger

  const approachAtoms = useMemo(
    () => buildSynthesisApproachAtoms(terms, { tier: visualTier }),
    [terms, runId, visualTier],
  )
  const termStreams = useMemo(() => getTermApproachOrigins(terms), [terms, runId])
  const denseFly = approachAtoms.length > 4

  const streamRefs = useRef<(THREE.Group | null)[]>([])
  const beamMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const onImpactRef = useRef(onImpact)
  const onStreamsReadyRef = useRef(onStreamsReady)
  const onBeginAtomFadeRef = useRef(onBeginAtomFade)
  const streamsReadyFiredRef = useRef(false)
  const timelineStartedRef = useRef(false)

  useLayoutEffect(() => {
    onImpactRef.current = onImpact
  }, [onImpact])

  useLayoutEffect(() => {
    onStreamsReadyRef.current = onStreamsReady
    onBeginAtomFadeRef.current = onBeginAtomFade
    streamsReadyFiredRef.current = false
  }, [onStreamsReady, onBeginAtomFade, runId])

  useLayoutEffect(() => {
    approachAtoms.forEach((atom, i) => {
      const node = previewAtomGroupRefs.current[i]
      if (!node) return
      const [x, y, z] = atom.pos
      node.position.set(x, y, z)
    })
  }, [runId, approachAtoms, previewAtomGroupRefs])

  useLayoutEffect(() => {
    streamRefs.current = new Array(termStreams.length).fill(null)
    beamMatRefs.current = new Array(termStreams.length).fill(null)
    timelineStartedRef.current = false

    let ctx: ReturnType<typeof gsap.context> | null = null
    let raf = 0
    let attempts = 0
    let cancelled = false

    const signalStreamsReady = () => {
      if (streamsReadyFiredRef.current) return
      streamsReadyFiredRef.current = true
      onStreamsReadyRef.current?.()
    }

    const triggerMerge = () => {
      onBeginAtomFadeRef.current?.()
      requestAnimationFrame(() => {
        if (!cancelled) onImpactRef.current()
      })
    }

    const startTimeline = () => {
      if (timelineStartedRef.current) return
      if (
        !refsReady(
          streamRefs.current,
          previewAtomGroupRefs.current,
          termStreams.length,
          approachAtoms.length,
        )
      ) {
        return
      }
      timelineStartedRef.current = true

      signalStreamsReady()

      ctx = gsap.context(() => {
        const tl = gsap.timeline({ onComplete: triggerMerge })
        let tweensAdded = 0

        termStreams.forEach((g, i) => {
          const node = streamRefs.current[i]
          if (!node) return
          const stagger = g.termIndex * termStagger
          flyAtomArc(tl, node, stagger, flyDur)
          node.lookAt(REACTION_CENTER[0], REACTION_CENTER[1], REACTION_CENTER[2])
          tweensAdded++
          const mat = beamMatRefs.current[i]
          if (mat) {
            mat.opacity = 0
            tl.fromTo(
              mat,
              { opacity: 0 },
              { opacity: 0.9, duration: flyDur * 0.28, ease: 'power2.out' },
              stagger,
            )
            tl.to(
              mat,
              { opacity: 0, duration: flyDur * 0.35, ease: 'power2.in' },
              stagger + flyDur * 0.65,
            )
          }
        })

        approachAtoms.forEach((atom, i) => {
          const node = previewAtomGroupRefs.current[i]
          if (!node) return
          const stagger = clusterMode
            ? atom.termIndex * termStagger + atom.atomInTerm * atomStagger * 0.35
            : atom.termIndex * termStagger + atom.atomInTerm * atomStagger
          flyAtomArc(tl, node, stagger, flyDur)
          node.rotation.y += atom.atomInTerm * 0.4
          tweensAdded++
        })

        if (tweensAdded === 0) {
          gsap.delayedCall(0.02, triggerMerge)
        }
      })
    }

    const tryStart = () => {
      if (cancelled || timelineStartedRef.current) return
      attempts += 1
      startTimeline()
      if (!timelineStartedRef.current && attempts < REF_RETRY_MAX) {
        raf = requestAnimationFrame(tryStart)
      } else if (!timelineStartedRef.current) {
        signalStreamsReady()
        triggerMerge()
      }
    }

    tryStart()

    const refsWatchdog = window.setTimeout(() => {
      if (cancelled || timelineStartedRef.current) return
      signalStreamsReady()
      triggerMerge()
    }, SYNTH_ANTI_STALL.convergeRefsMaxMs)

    return () => {
      cancelled = true
      window.clearTimeout(refsWatchdog)
      cancelAnimationFrame(raf)
      ctx?.revert()
      timelineStartedRef.current = false
    }
  }, [runId, approachAtoms, termStreams, previewAtomGroupRefs, previewAtomScaleGroupRefs, clusterMode, flyDur, termStagger, atomStagger, timingProfile])

  return (
    <group>
      <group visible={beamsVisible}>
        {termStreams.map((g, i) => {
          const hex = getElementByZ(g.z)?.cpkHex
          const color = hex ? `#${hex}` : '#8899aa'
          const [sx, sy, sz] = g.pos
          return (
            <group
              key={`${runId}-beam-${g.termIndex}-${i}`}
              position={[sx, sy, sz]}
              ref={(el) => {
                streamRefs.current[i] = el
              }}
            >
              <mesh position={[0, 0, -0.52]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.018, 0.085, 1.12, denseFly ? 8 : 12]} />
                <meshBasicMaterial
                  ref={(el) => {
                    beamMatRefs.current[i] = el
                  }}
                  color={color}
                  transparent
                  opacity={0}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
              <mesh position={[0, 0, -0.48]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.006, 0.028, 1.05, 10]} />
                <meshBasicMaterial
                  color="#ffffff"
                  transparent
                  opacity={0.15}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
              {!denseFly ? (
                <>
                  <Sparkles count={42} scale={1.9} size={2.1} speed={2.6} opacity={0.85} color={color} />
                  <pointLight color={color} intensity={1.4} distance={4.2} decay={2} />
                </>
              ) : null}
            </group>
          )
        })}
      </group>
    </group>
  )
}
