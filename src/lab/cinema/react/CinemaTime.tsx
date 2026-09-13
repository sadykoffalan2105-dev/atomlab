/* eslint-disable react-refresh/only-export-components -- провайдер, хук и модульный сеттер времени живут вместе: состояние общее */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'

/**
 * ATOMLAB Cinema — визуальное время («жизнь» кадра).
 *
 * Сюжет урока идёт по часам раскадровки (storyClock), а дыхание атомов, течение
 * плазмы в связях, тряска камеры, дрейф газа и вращение пыли — по этому слою.
 * Раньше «жизнь» читала state.clock.elapsedTime, поэтому на паузе шага и в
 * отладочной заморозке атомы стояли, а ядра дышали и плазма текла — кадры
 * не повторялись.
 *
 * Правила:
 *   • visual растёт на ограниченный dt (фоновая вкладка не даёт скачка);
 *   • frozen → visual стоит, dt = 0;
 *   • prefers-reduced-motion → visual идёт в 0.35×;
 *   • провайдер не обязателен: без него компоненты читают модульное время,
 *     которое само догоняет кадр при чтении (без лишнего подписчика useFrame).
 */

export type CinemaTimeState = { visual: number; dt: number; frozen: boolean; reducedMotion: boolean }

/** Потолок шага визуального времени, секунды. */
const MAX_DT = 1 / 20
/** Темп «жизни» при prefers-reduced-motion. */
const REDUCED_MOTION_RATE = 0.35

// ——— Системная настройка «уменьшить движение» (одна подписка на модуль) ———

let reducedMotion = false
let reducedMotionBound = false

function readReducedMotion(): boolean {
  if (!reducedMotionBound) {
    reducedMotionBound = true
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      reducedMotion = mq.matches
      mq.addEventListener?.('change', (e) => {
        reducedMotion = e.matches
      })
    }
  }
  return reducedMotion
}

// ——— Глобальная заморозка (dev freeze сцены) ———

let globalFrozen = false
const providerStates = new Set<CinemaTimeState>()

/** Один шаг визуального времени. Чистая функция над состоянием — без аллокаций. */
function stepCinemaTime(state: CinemaTimeState, rawDt: number, frozen: boolean, reduced: boolean): void {
  const dt = rawDt > 0 && rawDt < Infinity ? Math.min(rawDt, MAX_DT) : 0
  state.frozen = frozen
  state.reducedMotion = reduced
  state.dt = frozen ? 0 : dt * (reduced ? REDUCED_MOTION_RATE : 1)
  state.visual += state.dt
}

/**
 * Метка текущего кадра, мс. document.timeline.currentTime одинаков для всех
 * rAF-колбэков одного кадра — поэтому модульное время сдвигается ровно раз за
 * кадр, сколько бы компонентов его ни прочитало.
 */
function frameStampMs(): number {
  if (typeof document !== 'undefined') {
    const t = document.timeline?.currentTime
    if (typeof t === 'number') return t
  }
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/** Время без провайдера: догоняет кадр лениво при первом чтении в этом кадре. */
class FallbackCinemaTime implements CinemaTimeState {
  private state: CinemaTimeState = { visual: 0, dt: 0, frozen: false, reducedMotion: false }
  private stamp = -1

  private sync(): CinemaTimeState {
    const now = frameStampMs()
    if (now !== this.stamp) {
      const raw = this.stamp < 0 ? 0 : (now - this.stamp) / 1000
      this.stamp = now
      stepCinemaTime(this.state, raw, globalFrozen, readReducedMotion())
    }
    return this.state
  }

  get visual(): number {
    return this.sync().visual
  }
  set visual(v: number) {
    this.sync().visual = v
  }
  get dt(): number {
    return this.sync().dt
  }
  set dt(v: number) {
    this.sync().dt = v
  }
  get frozen(): boolean {
    return this.sync().frozen
  }
  set frozen(v: boolean) {
    this.sync().frozen = v
  }
  get reducedMotion(): boolean {
    return this.sync().reducedMotion
  }
  set reducedMotion(v: boolean) {
    this.sync().reducedMotion = v
  }
}

const fallbackTime: { current: CinemaTimeState } = { current: new FallbackCinemaTime() }

const CinemaTimeContext = createContext<{ current: CinemaTimeState } | null>(null)

/**
 * Заморозить/разморозить визуальное время всех сцен (и провайдеров, и
 * модульного времени). `visual` — поставить конкретное значение: две
 * заморозки на одном visual дают попиксельно одинаковую «жизнь».
 */
export function setCinemaTimeFrozen(frozen: boolean, visual?: number): void {
  globalFrozen = frozen
  if (visual !== undefined && Number.isFinite(visual)) {
    fallbackTime.current.visual = visual
    providerStates.forEach((s) => {
      s.visual = visual
    })
  }
}

/** Текущее визуальное время; читать `.current` внутри useFrame. Работает и без провайдера. */
export function useCinemaTime(): { current: CinemaTimeState } {
  return useContext(CinemaTimeContext) ?? fallbackTime
}

function tickProvider(state: CinemaTimeState, delta: number, frozen: boolean): void {
  stepCinemaTime(state, delta, frozen || globalFrozen, readReducedMotion())
}

/**
 * Провайдер визуального времени сцены. Шаг — в useFrame с приоритетом −900:
 * раньше мира сцены и всех рендереров, поэтому кадр читает одно и то же visual.
 */
export function CinemaTimeProvider({ frozen = false, children }: { frozen?: boolean; children: ReactNode }) {
  const [time] = useState<{ current: CinemaTimeState }>(() => ({
    current: { visual: 0, dt: 0, frozen, reducedMotion: readReducedMotion() },
  }))

  useEffect(() => {
    const s = time.current
    providerStates.add(s)
    return () => {
      providerStates.delete(s)
    }
  }, [time])

  useFrame((_, delta) => tickProvider(time.current, delta, frozen), -900)

  return <CinemaTimeContext.Provider value={time}>{children}</CinemaTimeContext.Provider>
}
