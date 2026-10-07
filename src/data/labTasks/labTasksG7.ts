/**
 * Задачи-опыты Kimyo 7 (5 задач): условие из учебника → опыт с приборами → измерения → расчёт → сверка.
 * Формат — labTaskTypes.ts; установки — src/components/lab3d/experiments/rigs/tasks/tasksG7.tsx.
 */
import type { LabTask } from './labTaskTypes'
import { ZN_MOLES } from './g7/znMoles'
import { MG_BURN } from './g7/mgBurn'
import { CUOH2_HEAT } from './g7/cuoh2Heat'
import { TASK_G7_KIPP_H2 } from './g7/kippH2'
import { TASK_G7_CAO_WATER } from './g7/caoWater'

export const LAB_TASKS_G7: readonly LabTask[] = [ZN_MOLES, MG_BURN, TASK_G7_KIPP_H2, TASK_G7_CAO_WATER, CUOH2_HEAT]
