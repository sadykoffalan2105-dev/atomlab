/**
 * Показ «Как образуется» в самой лаборатории (после «Проверить и запустить синтез»): часы показа общие для 3D-сцены
 * (внутри Canvas лаборатории) и панели этапов (DOM поверх лаборатории). Лёгкий модуль без three и React-компонентов.
 */
import { useSyncExternalStore } from 'react'
import type { Stages } from './geom'
import type { ReactorRouteId } from './routeIndex'

export type RouteLabState = { id: ReactorRouteId | null; stages: Stages | null; t: number; playing: boolean; speed: number }

const clock = { t: 0, playing: true, speed: 1 }
let state: RouteLabState = { id: null, stages: null, t: 0, playing: true, speed: 1 }
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const set = (patch: Partial<RouteLabState>) => {
  state = { ...state, ...patch }
  emit()
}

export const routeLab = {
  clock,
  /** где на экране панель этапов (px окна) — сцена вписывается в остаток кадра */
  panelRect: null as DOMRect | null,
  start(id: ReactorRouteId, stages: Stages) {
    clock.t = 0
    clock.playing = true
    set({ id, stages, t: 0, playing: true, speed: clock.speed })
  },
  stop(id: ReactorRouteId) {
    if (state.id === id) set({ id: null, stages: null })
  },
  /** вызывает 3D-сцена каждый кадр: обновляет время панели ~10 раз в секунду */
  tick() {
    const s = Math.round(clock.t * 10) / 10
    if (s !== state.t || clock.playing !== state.playing) set({ t: s, playing: clock.playing })
  },
  toggle() {
    const total = state.stages?.total ?? 0
    if (!clock.playing && clock.t >= total) clock.t = 0
    clock.playing = !clock.playing
    set({ playing: clock.playing })
  },
  seek(t: number) {
    clock.t = Math.max(0, Math.min(state.stages?.total ?? 0, t))
    set({ t: Math.round(clock.t * 10) / 10 })
  },
  replay() {
    clock.t = 0
    clock.playing = true
    set({ t: 0, playing: true })
  },
  setSpeed(x: number) {
    clock.speed = x
    set({ speed: x })
  },
  prev() {
    const list = state.stages?.list ?? []
    let k = 0
    for (let j = 0; j < list.length; j++) if (clock.t >= list[j]!.t0) k = j
    const j = clock.t - (list[k]?.t0 ?? 0) > 1.2 ? k : Math.max(0, k - 1)
    routeLab.seek(list[j]?.t0 ?? 0)
  },
  next() {
    const list = state.stages?.list ?? []
    let k = 0
    for (let j = 0; j < list.length; j++) if (clock.t >= list[j]!.t0) k = j
    routeLab.seek(k + 1 < list.length ? list[k + 1]!.t0 : (state.stages?.total ?? 0))
  },
  subscribe(f: () => void) {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  },
  get: () => state,
}

export function useRouteLab(): RouteLabState {
  return useSyncExternalStore(routeLab.subscribe, routeLab.get, routeLab.get)
}
