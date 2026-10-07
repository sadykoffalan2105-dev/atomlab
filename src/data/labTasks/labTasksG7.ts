/**
 * Задачи-опыты Kimyo 7 (5 задач): условие из учебника → опыт с приборами → измерения → расчёт → сверка.
 * Формат — labTaskTypes.ts; установки — src/components/lab3d/experiments/rigs/tasks/tasksG7.tsx.
 */
import type { LabTask } from './labTaskTypes'
import { ZN_MOLES } from './g7/znMoles'
import { MG_BURN } from './g7/mgBurn'

export const LAB_TASKS_G7: readonly LabTask[] = [ZN_MOLES, MG_BURN]
