import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { CH4_SCENARIO } from '../methaneScenarioTiming'
import type { SciPostDirector } from './SciCinematicPostFx'

export type Ch4DirectorState = {
  /** Story time in seconds (0 … finaleEnd) */
  t: number
  entry: number
  /** Экзотермический импульс (0..1) — драйвит огненные искры и жар */
  heat: number
  bloom: number
  chroma: number
}

/**
 * GSAP-таймлайн горения метана: story time + пост-FX реагируют на фазы
 * (искра активации → вспышка горения → тепловой разлёт), без setState в цикле рендера.
 */
export function useCh4CinematicDirector(
  runId: number,
  lite: boolean,
  postRef: { current: SciPostDirector },
) {
  const stateRef = useRef<Ch4DirectorState>({
    t: 0,
    entry: 0,
    heat: 0,
    bloom: 0.3,
    chroma: 0.08,
  })

  useEffect(() => {
    const s = stateRef.current
    s.t = 0
    s.entry = 0
    s.heat = 0
    s.bloom = 0.3
    s.chroma = 0.08
    postRef.current.bloom = s.bloom
    postRef.current.dof = 0.15
    postRef.current.chroma = s.chroma

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: () => {
        postRef.current.bloom = s.bloom
        postRef.current.chroma = lite ? Math.min(0.18, s.chroma) : s.chroma
      },
    })

    // Phase 1 — Entry
    tl.to(s, { t: CH4_SCENARIO.stage1End, duration: 2.0, ease: 'power3.inOut' }, 0)
    tl.to(s, { entry: 1, duration: 1.8, ease: 'power3.out' }, 0)

    // Phase 2 — Approach, slow-motion натяжение связей
    tl.to(s, { t: CH4_SCENARIO.stage2End, duration: lite ? 1.1 : 1.6, ease: 'power1.inOut' })
    tl.to(s, { bloom: 0.55, chroma: 0.22, duration: 1.2, ease: 'sine.out' }, '<')

    // Phase 3 — Ignition: искра + горение, экзотермический пик
    tl.to(s, { t: CH4_SCENARIO.stage3End, duration: lite ? 1.0 : 1.5, ease: 'power2.in' })
    tl.to(s, { heat: 1, bloom: 1, chroma: 0.5, duration: 0.4, ease: 'power3.out' }, '<0.2')
    tl.to(s, { bloom: 0.72, chroma: 0.22, duration: 0.7, ease: 'sine.out' }, '>-0.15')

    // Phase 4 — Release: тепловой разлёт продуктов
    tl.to(s, { t: CH4_SCENARIO.stage4End, duration: 1.3, ease: 'power2.out' })
    tl.to(s, { heat: 0.6, bloom: 0.5, chroma: 0.15, duration: 1.1, ease: 'power2.out' }, '<')

    // Финал
    tl.to(s, { t: CH4_SCENARIO.finaleEnd, duration: 1.3, ease: 'sine.inOut' })
    tl.to(s, { heat: 0.35, bloom: 0.42, chroma: 0.1, duration: 1.1, ease: 'sine.out' }, '<')

    return () => {
      tl.kill()
    }
  }, [runId, lite, postRef])

  return stateRef
}
