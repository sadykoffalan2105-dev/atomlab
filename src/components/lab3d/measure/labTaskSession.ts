/**
 * Попытка задачи-опыта: зерно случайности → показания приборов (task.simulate), ответы ученика, проверка, пропуски.
 * Внешнее хранилище без React-контекста: им пользуются установка (холст R3F), доска (отдельный React-корень drei Html)
 * и панель страницы — все видят одну и ту же попытку.
 */
import { useSyncExternalStore } from 'react'
import type { LabTaskId } from '../labContract'
import type { LabTaskValues } from '../../../data/labTasks/labTaskTypes'
import { getLabTask } from '../../../data/labTasks/labTasks'
import { createTaskRng, newSeed } from './instruments'
import { checkAnswers, type AnswerCheck } from './labTaskCheck'

export interface LabTaskSessionState {
  readonly taskId: LabTaskId
  readonly seed: number
  /** Номер попытки (1, 2, …) — растёт при «Повторить». */
  readonly attempt: number
  readonly values: LabTaskValues
  readonly answers: Readonly<Record<string, string>>
  /** Результат последней проверки (null — ещё не проверяли). */
  readonly checks: readonly AnswerCheck[] | null
  /** Сколько раз нажимали «Проверить». */
  readonly tries: number
  /** Шаги, пропущенные кнопкой «Далее» без действия руками. */
  readonly skips: number
  /** Ответ засчитан (хотя бы раз в этой попытке). */
  readonly solved: boolean
}

const sessions = new Map<LabTaskId, LabTaskSessionState>()
const listeners = new Set<() => void>()
let attempts = 0

function emit() {
  for (const l of listeners) l()
}

function make(taskId: LabTaskId, seed: number): LabTaskSessionState {
  attempts++
  const values = getLabTask(taskId).simulate(createTaskRng(seed))
  return { taskId, seed, attempt: attempts, values, answers: {}, checks: null, tries: 0, skips: 0, solved: false }
}

export const labTaskSession = {
  /** Текущая попытка (создаётся при первом обращении). */
  get(taskId: LabTaskId): LabTaskSessionState {
    let s = sessions.get(taskId)
    if (!s) {
      s = make(taskId, newSeed())
      sessions.set(taskId, s)
    }
    return s
  },
  /** Новая попытка: новые показания приборов, ответы стираются. */
  restart(taskId: LabTaskId, seed: number = newSeed()): LabTaskSessionState {
    const s = make(taskId, seed)
    sessions.set(taskId, s)
    emit()
    return s
  },
  setAnswer(taskId: LabTaskId, key: string, value: string) {
    const s = labTaskSession.get(taskId)
    sessions.set(taskId, { ...s, answers: { ...s.answers, [key]: value } })
    emit()
  },
  check(taskId: LabTaskId): readonly AnswerCheck[] {
    const s = labTaskSession.get(taskId)
    const checks = checkAnswers(getLabTask(taskId), s.values, s.answers)
    const solved = s.solved || checks.every((c) => c.status === 'book' || c.status === 'run')
    sessions.set(taskId, { ...s, checks, tries: s.tries + 1, solved })
    emit()
    return checks
  },
  noteSkip(taskId: LabTaskId) {
    const s = labTaskSession.get(taskId)
    sessions.set(taskId, { ...s, skips: s.skips + 1 })
    emit()
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  /** Для тестов. */
  reset() {
    sessions.clear()
    attempts = 0
    emit()
  },
}

/** Попытка задачи (React): перерисовка при новых показаниях/ответах. taskId = null — не задача. */
export function useLabTaskSession(taskId: LabTaskId | null): LabTaskSessionState | null {
  return useSyncExternalStore(
    labTaskSession.subscribe,
    () => (taskId ? labTaskSession.get(taskId) : null),
    () => (taskId ? labTaskSession.get(taskId) : null),
  )
}

/** Показания текущей попытки (для установки на столе). */
export function useLabTaskValues(taskId: LabTaskId): LabTaskValues {
  return useLabTaskSession(taskId)!.values
}
