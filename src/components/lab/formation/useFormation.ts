import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { formationPlan } from '../../../chemistry/formationPlan'
import { formationTimeline, stepAt, type FormationClock } from './formationTimeline'

/**
 * Управление «Как образуется»: часы показа (requestAnimationFrame — работают и без 3D-модели), номер шага
 * и действия. 3D (FormationCanvas) читает те же часы через ref, подписи шагов — FormationCaptions.
 */
export type FormationControl = {
  active: boolean
  playing: boolean
  step: 0 | 1 | 2 | 3
  clock: MutableRefObject<FormationClock>
  start: () => void
  toggle: () => void
  replay: () => void
  close: () => void
}

export function useFormation(compoundId: string | null): FormationControl {
  const clock = useRef<FormationClock>({ t: 0, playing: false })
  // Показ привязан к веществу: смена вещества — показ закрыт (без сброса состояния в эффекте).
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = activeId != null && activeId === compoundId
  const [playing, setPlaying] = useState(false)
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const plan = useMemo(() => (compoundId ? formationPlan(compoundId) : null), [compoundId])
  const tl = useMemo(() => (plan ? formationTimeline(plan) : null), [plan])

  useEffect(() => {
    if (!active || !tl) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
      last = now
      const c = clock.current
      if (c.playing) c.t += dt
      const s = stepAt(tl, c.t)
      setStep((prev) => (prev === s ? prev : s))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, tl])

  const start = useCallback(() => {
    clock.current = { t: 0, playing: true }
    setStep(0)
    setPlaying(true)
    setActiveId(compoundId)
  }, [compoundId])
  const toggle = useCallback(() => {
    clock.current.playing = !clock.current.playing
    setPlaying(clock.current.playing)
  }, [])
  const replay = useCallback(() => {
    clock.current.t = 0
    clock.current.playing = true
    setStep(0)
    setPlaying(true)
  }, [])
  const close = useCallback(() => {
    clock.current.playing = false
    setPlaying(false)
    setActiveId(null)
  }, [])
  return { active, playing, step, clock, start, toggle, replay, close }
}
