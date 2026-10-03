import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { formationStoryFor, stageIndexAt } from './formationStory'
import type { FormationClock } from './formationTimeline'

/**
 * Управление «Как образуется» (от и до): часы показа (requestAnimationFrame — работают и без 3D-модели), этап,
 * скорость 0,5× / 1× / 1,5×, переход по этапам ⏮ ⏭ и ползунок времени. 3D (FormationCanvas) читает те же часы через ref.
 */
export type FormationControl = {
  active: boolean
  playing: boolean
  /** номер этапа сценария (formationStory.stages) */
  step: number
  /** время показа для ползунка (обновляется ~10 раз в секунду) */
  time: number
  total: number
  speed: number
  clock: MutableRefObject<FormationClock>
  start: () => void
  toggle: () => void
  replay: () => void
  close: () => void
  prev: () => void
  next: () => void
  seek: (t: number) => void
  setSpeed: (x: number) => void
}

export const FORMATION_SPEEDS = [0.5, 1, 1.5] as const

export function useFormation(compoundId: string | null): FormationControl {
  const clock = useRef<FormationClock>({ t: 0, playing: false })
  // Показ привязан к веществу: смена вещества — показ закрыт (без сброса состояния в эффекте).
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = activeId != null && activeId === compoundId
  const [playing, setPlaying] = useState(false)
  const [step, setStep] = useState(0)
  const [time, setTime] = useState(0)
  const [speed, setSpeedState] = useState(1)
  const speedRef = useRef(1)
  const story = useMemo(() => (compoundId ? formationStoryFor(compoundId) : null), [compoundId])
  const total = story?.total ?? 0

  useEffect(() => {
    if (!active || !story) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
      last = now
      const c = clock.current
      if (c.playing) c.t += dt * speedRef.current
      const s = stageIndexAt(story, c.t)
      setStep((prev) => (prev === s ? prev : s))
      const shown = Math.round(Math.min(c.t, story.total) * 10) / 10
      setTime((prev) => (prev === shown ? prev : shown))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, story])

  const start = useCallback(() => {
    clock.current = { t: 0, playing: true }
    setStep(0)
    setTime(0)
    setPlaying(true)
    setActiveId(compoundId)
  }, [compoundId])
  const toggle = useCallback(() => {
    // В конце показа «продолжить» — с начала.
    if (!clock.current.playing && story && clock.current.t >= story.total) clock.current.t = 0
    clock.current.playing = !clock.current.playing
    setPlaying(clock.current.playing)
  }, [story])
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
  const seek = useCallback(
    (t: number) => {
      clock.current.t = Math.max(0, Math.min(total, t))
    },
    [total],
  )
  const prev = useCallback(() => {
    if (!story) return
    const t = clock.current.t
    const i = stageIndexAt(story, t)
    // Внутри этапа (больше 1,2 с от начала) — в начало этого этапа, иначе — предыдущего.
    const cur = story.stages[i]!
    const j = t - cur.t0 > 1.2 ? i : Math.max(0, i - 1)
    clock.current.t = story.stages[j]!.t0
  }, [story])
  const next = useCallback(() => {
    if (!story) return
    const i = stageIndexAt(story, clock.current.t)
    const j = Math.min(story.stages.length - 1, i + 1)
    clock.current.t = story.stages[j]!.t0 + (j === i ? story.stages[j]!.dur : 0)
  }, [story])
  const setSpeed = useCallback((x: number) => {
    speedRef.current = x
    setSpeedState(x)
  }, [])
  return { active, playing, step, time, total, speed, clock, start, toggle, replay, close, prev, next, seek, setSpeed }
}
