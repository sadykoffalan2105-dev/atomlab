/**
 * Показ «Как образуется» v2 в лаборатории: общее состояние 3D-сцены (внутри Canvas лаборатории), панели этапов
 * и HUD-карточек (DOM поверх лаборатории). Лёгкий модуль без three и React-компонентов.
 *  • preview — по кнопке «▶ Как образуется» в шапке реактора (продукт реакции входит в 200 основных);
 *  • synth — запуск синтеза ровно по уравнению образования: в конце показа — продукт (onComplete).
 */
import { useSyncExternalStore, type MutableRefObject } from 'react'
import type { FormationClock } from '../formationTimeline'

export type FormationLabMode = 'preview' | 'synth'
export type FormationLabStage = { key: string; t0: number; dur: number }

export type FormationLabState = {
  id: string | null
  mode: FormationLabMode
  /** этапы истории (ставит 3D-сцена, когда построит историю) */
  stages: readonly FormationLabStage[] | null
  total: number
  t: number
  step: number
  playing: boolean
  speed: number
  /** свободная от панелей часть холста лаборатории (px окна) — туда вписаны 3D и HUD-карточки */
  free: { left: number; top: number; width: number; height: number } | null
  /** верх холста лаборатории (px окна) — панель этапов на телефоне встаёт сразу под шапку */
  canvasTop: number
}

const clockRef: MutableRefObject<FormationClock> = { current: { t: 0, playing: true } }
let state: FormationLabState = { id: null, mode: 'preview', stages: null, total: 0, t: 0, step: 0, playing: true, speed: 1, free: null, canvasTop: 0 }
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const set = (patch: Partial<FormationLabState>) => {
  state = { ...state, ...patch }
  emit()
}
const stepAt = (t: number) => {
  const list = state.stages ?? []
  let k = 0
  for (let j = 0; j < list.length; j++) if (t >= list[j]!.t0) k = j
  return k
}

export const formationLab = {
  /** часы показа (ref — как у useFormation: их читают FormationMoleculeView, облака, фаза, HUD) */
  clock: clockRef,
  /** где на экране панель этапов (px окна) — сцена вписывается в остаток кадра */
  panelRect: null as DOMRect | null,
  /** сколько места HUD-карточки занимают в свободной части (px): dx — справа, dy — сверху */
  hudLayout: { current: { dx: 0, dy: 0 } } as MutableRefObject<{ dx: number; dy: number }>,
  /** «Закрыть» в показе при синтезе: сцена сразу отдаёт продукт */
  skipToEnd: false,
  /** открыть показ вещества (кнопка в реакторе — preview; сцена синтеза — synth) */
  open(id: string, mode: FormationLabMode = 'preview') {
    clockRef.current = { t: 0, playing: true }
    formationLab.skipToEnd = false
    formationLab.hudLayout.current = { dx: 0, dy: 0 }
    set({ id, mode, stages: null, total: 0, t: 0, step: 0, playing: true, speed: state.speed })
  },
  /** 3D-сцена построила историю — этапы для панели */
  setStages(id: string, stages: readonly FormationLabStage[], total: number) {
    if (state.id !== id) return
    set({ stages, total })
  },
  close(id?: string) {
    if (id != null && state.id !== id) return
    if (state.id == null) return
    clockRef.current.playing = false
    set({ id: null, stages: null, total: 0, free: null })
  },
  /** закрыть только показ по кнопке (при запуске синтеза, смене реакции, закрытии реактора) */
  closePreview() {
    if (state.id != null && state.mode === 'preview') formationLab.close()
  },
  /** «Закрыть» панели: preview — возврат к лаборатории; synth — продукт без ожидания конца */
  dismiss() {
    if (state.mode === 'synth') {
      formationLab.skipToEnd = true
      clockRef.current.t = state.total
      clockRef.current.playing = false
      set({ t: Math.round(state.total * 10) / 10, playing: false })
    } else formationLab.close()
  },
  setFree(free: FormationLabState['free'], canvasTop = state.canvasTop) {
    if (Math.abs(canvasTop - state.canvasTop) >= 1) set({ canvasTop })
    const a = state.free
    if (a && free && Math.abs(a.left - free.left) < 1 && Math.abs(a.top - free.top) < 1 && Math.abs(a.width - free.width) < 1 && Math.abs(a.height - free.height) < 1) return
    if (!a && !free) return
    set({ free })
  },
  /** вызывает 3D-сцена каждый кадр: время панели ~10 раз в секунду */
  tick() {
    const c = clockRef.current
    const s = Math.round(Math.min(c.t, state.total) * 10) / 10
    if (s !== state.t || c.playing !== state.playing) set({ t: s, playing: c.playing, step: stepAt(c.t) })
  },
  toggle() {
    const c = clockRef.current
    if (!c.playing && c.t >= state.total) c.t = 0
    c.playing = !c.playing
    set({ playing: c.playing })
  },
  seek(t: number) {
    const c = clockRef.current
    c.t = Math.max(0, Math.min(state.total, t))
    set({ t: Math.round(c.t * 10) / 10, step: stepAt(c.t) })
  },
  replay() {
    clockRef.current.t = 0
    clockRef.current.playing = true
    set({ t: 0, step: 0, playing: true })
  },
  setSpeed(x: number) {
    set({ speed: x })
  },
  prev() {
    const list = state.stages ?? []
    const t = clockRef.current.t
    const k = stepAt(t)
    const j = t - (list[k]?.t0 ?? 0) > 1.2 ? k : Math.max(0, k - 1)
    formationLab.seek(list[j]?.t0 ?? 0)
  },
  next() {
    const list = state.stages ?? []
    const k = stepAt(clockRef.current.t)
    formationLab.seek(k + 1 < list.length ? list[k + 1]!.t0 : state.total)
  },
  subscribe(f: () => void) {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  },
  get: () => state,
}

export function useFormationLab(): FormationLabState {
  return useSyncExternalStore(formationLab.subscribe, formationLab.get, formationLab.get)
}
