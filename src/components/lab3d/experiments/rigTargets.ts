/**
 * Цели шагов (LabStepDef.target), которые есть в каждой установке. Установка подсвечивает и делает
 * нажимаемым объект с этим именем; тест проверяет, что шаги опытов ссылаются только на них.
 */
import type { LabExperimentId } from '../labContract'

export const RIG_TARGETS = {
  baso4: ['tube-bacl2', 'tube-h2so4', 'rack'],
  'ch4-burn': ['match', 'gas-valve', 'beaker-dry', 'beaker-lime'],
  'zn-hcl': ['zn-granule', 'bottle-hcl', 'tube-acid'],
  'h2-practical': ['bottle-hcl', 'zn-granule', 'stopper', 'collect-tube', 'spirit-lamp', 'glass-plate'],
} as const satisfies Record<LabExperimentId, readonly string[]>

/** Сколько секунд длится анимация действия шага (шаг s: прогресс p идёт от s к s + 1). */
export const RIG_STEP_SECONDS: Readonly<Record<LabExperimentId, readonly number[]>> = {
  baso4: [1.4, 1.8, 3.2, 5.5],
  'ch4-burn': [1.2, 2.4, 3.2, 3.6, 1.4],
  'zn-hcl': [1.4, 2.6, 2.2, 6],
  'h2-practical': [2.6, 2.2, 1.8, 3.2, 2.2, 2.8, 4.2],
}
