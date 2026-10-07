/**
 * Установки задач-опытов Kimyo 8: id задачи → компонент установки (локальные координаты — как у опытов:
 * начало — центр рабочего места, верх стола y = 0). Данные задач — src/data/labTasks/labTasksG8.ts.
 */
import type { ComponentType } from 'react'
import type { LabTaskId } from '../../../labContract'
import { ZnHclGasRig } from './g8/ZnHclGasRig'
import { AgClRig } from './g8/AgClRig'
import { Cuso4HydrateRig } from './g8/Cuso4HydrateRig'
import { AlAcidRig } from './g8/AlAcidRig'
import { HclSolutionRig } from './g8/HclSolutionRig'

export const TASK_RIGS_G8: Partial<Record<LabTaskId, ComponentType>> = {
  'task-g8-zn-hcl-gas': ZnHclGasRig,
  'task-g8-agcl': AgClRig,
  'task-g8-cuso4-hydrate': Cuso4HydrateRig,
  'task-g8-al-acid': AlAcidRig,
  'task-g8-hcl-solution': HclSolutionRig,
}
