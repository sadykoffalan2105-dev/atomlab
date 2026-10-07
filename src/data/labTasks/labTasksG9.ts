/**
 * Задачи-опыты Kimyo 9 (5 задач): условие из учебника → опыт с приборами → измерения → расчёт → сверка.
 * Формат — labTaskTypes.ts; установки — src/components/lab3d/experiments/rigs/tasks/tasksG9.tsx.
 */
import type { LabTask } from './labTaskTypes'
import { SODA_SOLUTION } from './g9/sodaSolution'
import { BASO4_EXCESS } from './g9/baso4Excess'
import { CU_FROM_CUSO4 } from './g9/cuFromCuso4'
import { NAOH_CUSO4 } from './g9/naohCuso4'
import { NAHCO3_MIX } from './g9/nahco3Mix'

export const LAB_TASKS_G9: readonly LabTask[] = [SODA_SOLUTION, BASO4_EXCESS, CU_FROM_CUSO4, NAOH_CUSO4, NAHCO3_MIX]
