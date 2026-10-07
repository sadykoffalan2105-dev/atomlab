/**
 * Задачи-опыты Kimyo 8 (5 задач): условие из учебника → опыт с приборами → измерения → расчёт → сверка.
 * Формат — labTaskTypes.ts; установки — src/components/lab3d/experiments/rigs/tasks/tasksG8.tsx.
 */
import type { LabTask } from './labTaskTypes'
import { TASK_G8_ZN_HCL_GAS } from './g8/znHclGas'
import { TASK_G8_AL_ACID } from './g8/alAcid'
import { TASK_G8_HCL_SOLUTION } from './g8/hclSolution'

export const LAB_TASKS_G8: readonly LabTask[] = [
  TASK_G8_ZN_HCL_GAS,
  TASK_G8_AL_ACID,
  TASK_G8_HCL_SOLUTION,
]
