/**
 * Установки задач-опытов Kimyo 7: id задачи → компонент установки (локальные координаты — как у опытов:
 * начало — центр рабочего места, верх стола y = 0). Данные задач — src/data/labTasks/labTasksG7.ts.
 */
import type { ComponentType } from 'react'
import type { LabTaskId } from '../../../labContract'
import { ZnMolesRig } from './g7/ZnMolesRig'
import { MgBurnRig } from './g7/MgBurnRig'
import { CuOH2HeatRig } from './g7/CuOH2HeatRig'

export const TASK_RIGS_G7: Partial<Record<LabTaskId, ComponentType>> = {
  'task-g7-zn-moles': ZnMolesRig,
  'task-g7-mg-burn': MgBurnRig,
  'task-g7-cuoh2-heat': CuOH2HeatRig,
}
