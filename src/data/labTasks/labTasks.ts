/**
 * Реестр задач-опытов (по 5 из Kimyo 7, 8, 9) и их «перевод» в таблицы 3D-лаборатории: опыт, шаги, жесты,
 * длительности, крупные планы, подписи, «что произошло», вопросы. Лаборатория работает с задачей как с обычным
 * опытом (id задачи — тоже LabExperimentId), а измерения, расчёт и сверку берёт отсюда.
 */
import type { LabExperimentDef, LabTaskId } from '../../components/lab3d/labContract'
import type { RigFocus, RigGesture, RigLabel } from '../../components/lab3d/experiments/rigTargets'
import type { LabParticleStory, LabQuizQuestion, LabStepAction } from '../labWorks/labExperiments'
import type { LabTask } from './labTaskTypes'
import { LAB_TASKS_G7 } from './labTasksG7'
import { LAB_TASKS_G8 } from './labTasksG8'
import { LAB_TASKS_G9 } from './labTasksG9'

export const LAB_TASKS: readonly LabTask[] = [...LAB_TASKS_G7, ...LAB_TASKS_G8, ...LAB_TASKS_G9]

export function findLabTask(id: string): LabTask | undefined {
  return LAB_TASKS.find((t) => t.id === id)
}

export function getLabTask(id: LabTaskId): LabTask {
  const t = findLabTask(id)
  if (!t) throw new Error(`labTasks: нет задачи «${id}»`)
  return t
}

/** Задачи класса (для карточек и групп на доске). */
export function labTasksOfGrade(grade: 7 | 8 | 9): readonly LabTask[] {
  return LAB_TASKS.filter((t) => t.grade === grade)
}

/** Ссылка в лабораторию: #/vr-lab?task=<id>&from=<откуда вернуться>. */
export function labTaskHref(id: LabTaskId, from?: string): string {
  const q = new URLSearchParams({ task: id })
  if (from) q.set('from', from)
  return `/vr-lab?${q.toString()}`
}

/* ── Таблицы лаборатории ── */

type ByTask<T> = Readonly<Record<LabTaskId, T>>
function byTask<T>(f: (t: LabTask) => T): ByTask<T> {
  return Object.fromEntries(LAB_TASKS.map((t) => [t.id, f(t)])) as unknown as ByTask<T>
}

export const LAB_TASK_EXPERIMENTS: readonly LabExperimentDef[] = LAB_TASKS.map((t) => ({
  id: t.id,
  source: t.source,
  title: t.title,
  equation: t.equation,
  kind: t.kind,
  grade: t.grade,
  page: t.page,
  steps: t.steps.map((s) => ({ id: s.id, instruction: s.instruction, observation: s.observation, target: s.target })),
  equipment: t.equipment,
  safety: t.safety,
  conclusion: t.conclusion,
  place: t.place,
  gear: t.gear,
}))

export const LAB_TASK_RIG_TARGETS: ByTask<readonly string[]> = byTask((t) => [...new Set(t.steps.map((s) => s.target))])
export const LAB_TASK_STEP_SECONDS: ByTask<readonly number[]> = byTask((t) => t.steps.map((s) => s.seconds))
export const LAB_TASK_GESTURES: ByTask<readonly RigGesture[]> = byTask((t) => t.steps.map((s) => s.gesture))
export const LAB_TASK_FOCUS: ByTask<readonly RigFocus[]> = byTask((t) => t.focus)
export const LAB_TASK_LABELS: ByTask<readonly RigLabel[]> = byTask((t) => t.labels)
export const LAB_TASK_STEP_ACTIONS: ByTask<readonly LabStepAction[]> = byTask((t) =>
  t.steps.map((s) => ({ gesture: s.gesture.kind, how: s.how, need: s.need })),
)
export const LAB_TASK_STORY: ByTask<LabParticleStory> = byTask((t) => t.story)
export const LAB_TASK_QUIZ: ByTask<readonly LabQuizQuestion[]> = byTask((t) => t.quiz)
export const LAB_TASK_SIDE_EQUATIONS: Partial<Record<LabTaskId, readonly string[]>> = Object.fromEntries(
  LAB_TASKS.filter((t) => t.sideEquations?.length).map((t) => [t.id, t.sideEquations!]),
)
