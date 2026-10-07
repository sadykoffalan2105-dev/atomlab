/**
 * Установки задач-опытов Kimyo 9: id задачи → компонент установки (локальные координаты — как у опытов:
 * начало — центр рабочего места, верх стола y = 0). Данные задач — src/data/labTasks/labTasksG9.ts.
 */
import type { ComponentType } from 'react'
import type { LabTaskId } from '../../../labContract'

export const TASK_RIGS_G9: Partial<Record<LabTaskId, ComponentType>> = {}
