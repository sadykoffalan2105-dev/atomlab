/**
 * Режиссёр показов «Как образуется» в лаборатории: в кадре всегда не больше ОДНОГО показа.
 *  • formation-preview — по кнопке «▶ Как образуется» в шапке реактора;
 *  • formation-synth  — запуск синтеза ровно по уравнению образования (в конце — продукт);
 *  • route-synth      — путь получения со своим показом (пути CO₂).
 * Состояние выводится из двух хранилищ (formationLab, routeLab), режиссёр следит за правилами:
 *  — путь и образование взаимоисключающи (путь — это синтез, он важнее показа по кнопке);
 *  — Run при открытом preview того же вещества — передача (handoff) без размонтирования панели;
 *  — конец показа при синтезе: сначала режиссёр → 'none' (панель исчезает, группа сжимается), потом продукт.
 * Лёгкий модуль без three и React-компонентов: его читают страница, сцена, реактор и автопроверки.
 */
import { useSyncExternalStore } from 'react'
import { routeLab } from '../routes/routeLabStore'
import { formationLab } from './formationLabStore'

export type ShowKind = 'none' | 'formation-preview' | 'formation-synth' | 'route-synth'
export type ShowDirectorState = { kind: ShowKind; id: string | null; runId: number }

let state: ShowDirectorState = { kind: 'none', id: null, runId: 0 }
const subs = new Set<() => void>()

function derive(): { kind: ShowKind; id: string | null } {
  const r = routeLab.get()
  if (r.id != null) return { kind: 'route-synth', id: r.id }
  const f = formationLab.get()
  if (f.id != null) return { kind: f.mode === 'synth' ? 'formation-synth' : 'formation-preview', id: f.id }
  return { kind: 'none', id: null }
}

let syncing = false
function sync() {
  if (syncing) return
  syncing = true
  try {
    // Путь и образование одновременно — не бывает: путь (синтез) вытесняет показ образования.
    if (routeLab.get().id != null && formationLab.get().id != null) formationLab.close()
    const d = derive()
    if (d.kind === state.kind && d.id === state.id) return
    state = { kind: d.kind, id: d.id, runId: d.kind === 'none' ? state.runId : state.runId + 1 }
    if (typeof window !== 'undefined') (window as unknown as { __showDirector?: ShowDirectorState }).__showDirector = state
    subs.forEach((f) => f())
  } finally {
    syncing = false
  }
}
formationLab.subscribe(sync)
routeLab.subscribe(sync)

export const showDirector = {
  get: (): ShowDirectorState => state,
  subscribe(f: () => void) {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  },
  /** Идёт показ, который держит синтез (сторож лаборатории ждёт его конца). */
  synthBusy: (): boolean => state.kind === 'formation-synth' || state.kind === 'route-synth',
  /**
   * Запуск синтеза. productId — вещество, чей показ сыграет запуск (formationForLabRun), иначе null.
   * Открыт preview того же вещества — показ продолжается в режиме synth (часы с нуля, панель не мигает);
   * иначе preview закрывается (синтез играет свою сцену).
   */
  handoffToSynth(productId: string | null) {
    const f = formationLab.get()
    if (productId && f.id === productId) formationLab.open(productId, 'synth')
    else if (f.id != null) formationLab.close()
  },
  /** Конец показа: режиссёр → 'none' ДО продукта (onEmbryoReady / onBirthReady / onComplete). */
  finish(kind: 'formation-synth' | 'route-synth', id: string) {
    if (kind === 'formation-synth') formationLab.close(id)
    else routeLab.stop(id as never)
    sync()
  },
}

/** Состояние режиссёра (меняется только при смене показа — не от хода времени). */
export function useShowDirector(): ShowDirectorState {
  return useSyncExternalStore(showDirector.subscribe, showDirector.get, showDirector.get)
}
const getKind = () => state.kind
/** Только вид показа — для сцены и страницы (минимум перерисовок). */
export function useShowKind(): ShowKind {
  return useSyncExternalStore(showDirector.subscribe, getKind, getKind)
}
