/**
 * Прогресс задач-опытов: решённая задача отмечается в прогрессе ученика («lab-task:<id>») и, если в классе выбран
 * ученик, попадает в журнал класса (вид попытки 'lab': звёзды, показания приборов).
 */
import type { LabTaskId } from '../components/lab3d/labContract'
import { getActiveStudent, recordStudentLabResult, TASKS_ROSTER_SECTION_ID } from './learnClassRosterStorage'
import { markLessonCompleted, readLearnProgress } from './learnProgressStorage'

export const labTaskLessonId = (id: LabTaskId) => `lab-task:${id}`

export function isLabTaskCompleted(id: LabTaskId): boolean {
  try {
    return readLearnProgress().completedLessonIds.includes(labTaskLessonId(id))
  } catch {
    return false
  }
}

export function recordLabTaskSolved(input: {
  taskId: LabTaskId
  stars: number
  tries: number
  measurements: Readonly<Record<string, number>>
}): void {
  try {
    markLessonCompleted(labTaskLessonId(input.taskId))
    const student = getActiveStudent(TASKS_ROSTER_SECTION_ID)
    if (student)
      recordStudentLabResult(TASKS_ROSTER_SECTION_ID, student.id, {
        labTaskId: input.taskId,
        correct: true,
        stars: input.stars,
        tries: input.tries,
        measurements: { ...input.measurements },
      })
  } catch {
    // приватный режим браузера / нет localStorage — опыт всё равно засчитан на экране
  }
}
