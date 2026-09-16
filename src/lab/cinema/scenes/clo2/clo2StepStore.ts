import { CLO2_STEPS } from './clo2Steps'

/**
 * Мост между 3D-сценой (внутри Canvas) и DOM-панелью урока (вне Canvas).
 *
 * Сцена владеет часами и регистрирует здесь свои команды; панель читает
 * снимок через useSyncExternalStore и зовёт next/replay/finish. Никаких
 * React-контекстов через границу Canvas и никакого setState на кадр:
 * снимок меняется только на событиях шага.
 *
 * Хранилище общее для всех уроков по шагам (ClO₂, NaCl, …): какой урок идёт,
 * говорит поле `lesson` снимка — панель по нему выбирает тексты и энергетику.
 * Имя файла историческое: первым уроком был ClO₂.
 */

export type Clo2StepStatus = 'idle' | 'playing' | 'paused' | 'finishing' | 'done'

/** Уроки по шагам, которые умеет показывать панель механизма. */
export type CinemaLessonId = 'clo2' | 'nacl'

export type Clo2StepSnapshot = {
  /** runId прогона, к которому относится снимок; 0 — сцены нет */
  runId: number
  /** какой урок идёт (тексты, энергетика, озвучка) */
  lesson: CinemaLessonId
  /** индекс текущего шага в списке шагов урока */
  step: number
  stepCount: number
  status: Clo2StepStatus
  /** автопроигрывание: панель сама жмёт «Далее» после паузы и реплики */
  autoplay: boolean
}

export type Clo2StepControls = {
  /** доиграть текущий шаг / перейти к шагу index и сыграть его */
  playStep: (index: number) => void
  /** перемотать на начало текущего шага и сыграть снова */
  replayStep: () => void
  /** доиграть хвост сцены и отдать кадр лаборатории */
  finish: () => void
}

const AUTOPLAY_KEY = 'atomlab-clo2-autoplay'

/**
 * Позиция сюжета для виджетов вне Canvas (энергетический профиль и т. п.).
 * Сцена пишет каждый кадр, виджеты читают в своём requestAnimationFrame —
 * это не часть снимка, чтобы не будить React 60 раз в секунду.
 */
export const clo2Playhead = { t: 0, runId: 0 }
/** То же место сюжета под нейтральным именем — для уроков, кроме ClO₂. */
export const cinemaPlayhead = clo2Playhead

function readAutoplay(): boolean {
  try {
    return localStorage.getItem(AUTOPLAY_KEY) === '1'
  } catch {
    return false
  }
}

const EMPTY: Clo2StepSnapshot = {
  runId: 0,
  lesson: 'clo2',
  step: 0,
  stepCount: CLO2_STEPS.length,
  status: 'idle',
  autoplay: false,
}

let snapshot: Clo2StepSnapshot = { ...EMPTY, autoplay: readAutoplay() }
let controls: Clo2StepControls | null = null
const listeners = new Set<() => void>()

function emit(next: Clo2StepSnapshot): void {
  snapshot = next
  for (const l of listeners) l()
}

export const clo2StepStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  getSnapshot(): Clo2StepSnapshot {
    return snapshot
  },

  /**
   * Сцена смонтировалась с новым прогоном. Без `lesson` — урок ClO₂ с его числом
   * шагов (поведение первого урока не меняется).
   */
  attach(
    runId: number,
    next: Clo2StepControls,
    lesson: CinemaLessonId = 'clo2',
    stepCount: number = CLO2_STEPS.length,
  ): void {
    controls = next
    emit({ runId, lesson, step: 0, stepCount, status: 'playing', autoplay: snapshot.autoplay })
  },

  /** Сцена размонтирована. Чужой runId не трогаем — новый прогон мог уже подключиться. */
  detach(runId: number): void {
    if (snapshot.runId !== runId) return
    controls = null
    emit({ ...EMPTY, autoplay: snapshot.autoplay })
  },

  /** Сцена сообщает о смене шага/состояния. */
  report(runId: number, step: number, status: Clo2StepStatus): void {
    if (snapshot.runId !== runId) return
    if (snapshot.step === step && snapshot.status === status) return
    emit({ ...snapshot, step, status })
  },

  next(): void {
    const s = snapshot
    if (!controls || s.runId === 0) return
    if (s.status !== 'paused') return
    if (s.step >= s.stepCount - 1) {
      controls.finish()
      return
    }
    controls.playStep(s.step + 1)
  },

  replay(): void {
    if (!controls || snapshot.runId === 0) return
    if (snapshot.status === 'finishing' || snapshot.status === 'done') return
    controls.replayStep()
  },

  finish(): void {
    if (!controls || snapshot.runId === 0) return
    if (snapshot.status === 'finishing' || snapshot.status === 'done') return
    controls.finish()
  },

  setAutoplay(on: boolean): void {
    try {
      localStorage.setItem(AUTOPLAY_KEY, on ? '1' : '0')
    } catch {
      /* private mode */
    }
    emit({ ...snapshot, autoplay: on })
  },
}
