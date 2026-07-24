import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { CLO2_SCENARIO } from '../clo2ScenarioTiming'
import type { SciPostDirector } from './SciCinematicPostFx'

export type Clo2DirectorState = {
  /** Story time in seconds (0 … finaleEnd) */
  t: number
  entry: number
  camPull: number
  bloom: number
  dof: number
  chroma: number
}

/**
 * GSAP director: maps wall-clock → story time with cinematic easing
 * and drives post-FX cues (bloom / DoF / chroma).
 */
export function useClo2CinematicDirector(
  runId: number,
  lite: boolean,
  postRef: { current: SciPostDirector },
) {
  const stateRef = useRef<Clo2DirectorState>({
    t: 0,
    entry: 0,
    camPull: 0,
    bloom: 0.35,
    dof: 0.15,
    chroma: 0.1,
  })

  useEffect(() => {
    const s = stateRef.current
    s.t = 0
    s.entry = 0
    s.camPull = 0
    s.bloom = 0.35
    s.dof = 0.15
    s.chroma = 0.1
    postRef.current.bloom = s.bloom
    postRef.current.dof = s.dof
    postRef.current.chroma = s.chroma

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: () => {
        postRef.current.bloom = s.bloom
        postRef.current.dof = lite ? 0 : s.dof
        postRef.current.chroma = lite ? Math.min(0.2, s.chroma) : s.chroma
      },
    })

    // Phase 1 — Entry (story 0 → 2.5), cinematic ease into frame
    tl.to(s, { t: CLO2_SCENARIO.stage1End, duration: 2.5, ease: 'power3.inOut' }, 0)
    tl.to(s, { entry: 1, duration: 2.2, ease: 'power3.out' }, 0)
    tl.to(s, { bloom: 0.45, dof: 0.2, chroma: 0.12, duration: 2.0, ease: 'sine.out' }, 0)

    // Phase 2 — Activation (2.5 → 4.0), camera pull + DoF
    tl.to(s, { t: CLO2_SCENARIO.stage2End, duration: 1.6, ease: 'power2.inOut' })
    tl.to(s, { camPull: 1, bloom: 0.75, dof: 0.85, chroma: 0.35, duration: 1.4, ease: 'power2.in' }, '<')

    // Phase 3 — Time dilation (story 4.0 → 5.5 over longer wall clock)
    tl.to(s, {
      t: CLO2_SCENARIO.stage3End,
      duration: lite ? 1.8 : 2.6,
      ease: 'power1.inOut',
    })
    tl.to(s, { bloom: 1, dof: 0.7, chroma: 0.55, duration: 0.35, ease: 'power2.out' }, '<0.35')
    tl.to(s, { bloom: 0.7, chroma: 0.25, duration: 0.8, ease: 'sine.out' }, '>-0.2')

    // Phase 4 — Release
    tl.to(s, { t: CLO2_SCENARIO.stage4End, duration: 1.5, ease: 'power2.out' })
    tl.to(s, { camPull: 0.25, bloom: 0.55, dof: 0.35, chroma: 0.15, duration: 1.3, ease: 'power2.out' }, '<')

    // Finale
    tl.to(s, { t: CLO2_SCENARIO.finaleEnd, duration: 1.5, ease: 'sine.inOut' })
    tl.to(s, { bloom: 0.6, dof: 0.25, chroma: 0.1, duration: 1.2, ease: 'sine.out' }, '<')

    return () => {
      tl.kill()
    }
  }, [runId, lite, postRef])

  return stateRef
}
