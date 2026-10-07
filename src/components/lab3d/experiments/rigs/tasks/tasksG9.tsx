/**
 * Установки задач-опытов Kimyo 9: id задачи → компонент установки (локальные координаты — как у опытов:
 * начало — центр рабочего места, верх стола y = 0). Данные задач — src/data/labTasks/labTasksG9.ts.
 */
import type { ComponentType } from 'react'
import type { LabTaskId } from '../../../labContract'
import { SodaSolutionRig } from './g9/SodaSolutionRig'
import { NaohCuso4Rig } from './g9/NaohCuso4Rig'

export const TASK_RIGS_G9: Partial<Record<LabTaskId, ComponentType>> = {
  'task-g9-soda-solution': SodaSolutionRig,
  'task-g9-naoh-cuso4': NaohCuso4Rig,
}
