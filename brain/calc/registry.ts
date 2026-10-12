/**
 * Школьный калькулятор: реестр решателей. Каждый решатель сам разбирает условие (Ctx → ParsedTask внутри)
 * и решает; срабатывает только при полной уверенности (все нужные величины найдены, роли непротиворечивы),
 * иначе null — тогда работают старые инструменты tools.ts. Порядок — по приоритету: более специфичный раньше
 * (combustion_formula > formula_from_fractions > mass_fraction_element; excess_limiting > equation_stoich > moles…;
 * solubility > solution_mass_fraction).
 */
import type { Ctx } from './parse.ts'
import type { Solution } from './format.ts'
import { BASIC_SOLVERS } from './solvers/basic.ts'
import { EXTRA_SOLVERS } from './solvers/extra.ts'
import { PHYSICAL_SOLVERS } from './solvers/physical.ts'
import { REACTION_SOLVERS } from './solvers/reaction.ts'
import { SOLUTION_SOLVERS } from './solvers/solutions.ts'

/** Идентификаторы типов задач (общие с картой программы A: task-types.json). */
export type TaskTypeId =
  | 'molar_mass' | 'mass_fraction_element' | 'formula_from_fractions' | 'moles_mass_volume_particles' | 'gas_density' | 'gas_mixture'
  | 'clapeyron' | 'equation_stoich' | 'excess_limiting' | 'yield' | 'impurities' | 'solution_mass_fraction' | 'solution_density_volume'
  | 'molarity' | 'normality' | 'equivalent' | 'solubility' | 'crystal_hydrate' | 'thermochem' | 'reaction_rate' | 'equilibrium'
  | 'electrolysis_faraday' | 'redox_balance' | 'dissociation_degree' | 'water_hardness' | 'atomic_structure_counts' | 'mixture_fraction'
  | 'combustion_formula' | 'metal_plate' | 'air_volume' | 'ph' | 'oxidation_state'

/** Разобранная задача (для журнала и отладки). */
export type ParsedTask = {
  type: TaskTypeId
  givens: { key: string; value: number; unit: string; species?: string }[]
  find: string[]
  confidence: number
}

export type Solver = {
  id: TaskTypeId
  /** больше — раньше */
  priority: number
  solve(ctx: Ctx): Solution | null
}

export const SOLVERS: Solver[] = [...BASIC_SOLVERS, ...REACTION_SOLVERS, ...SOLUTION_SOLVERS, ...PHYSICAL_SOLVERS, ...EXTRA_SOLVERS].sort((a, b) => b.priority - a.priority)
