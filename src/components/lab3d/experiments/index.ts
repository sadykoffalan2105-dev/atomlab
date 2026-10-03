/**
 * ВРЕМЕННАЯ заглушка части «опыты» (её делает второй агент; при слиянии берётся его версия этого файла).
 * Сцена импортирует отсюда: LAB_EXPERIMENTS, BoardPanel (содержимое электронной доски), ExperimentRig (установка на столе).
 */
import type { ComponentType } from 'react'
import type { BoardPanelProps, ExperimentRigProps, LabExperimentDef } from '../labContract'
import { BoardPlaceholder } from '../scene/BoardPlaceholder'

export const LAB_EXPERIMENTS: readonly LabExperimentDef[] = []
export const BoardPanel: ComponentType<BoardPanelProps> = BoardPlaceholder
export const ExperimentRig: ComponentType<ExperimentRigProps> = () => null
