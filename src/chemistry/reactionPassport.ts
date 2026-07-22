import type { HeatEffect, PhaseKind, ReactionClass, Reversibility } from './reactionTypeTaxonomy'

/** Полный «паспорт» реакции по школьной классификации (6+ признаков). */
export type ReactionPassport = {
  /** Меняются степени окисления */
  isRedox: boolean
  heatEffect: HeatEffect
  reversibility: Reversibility
  phaseKind: PhaseKind
  /** Требуется катализатор */
  catalytic: boolean
  catalystId?: string
}

export function describePassportRu(p: ReactionPassport): string {
  const parts: string[] = []
  parts.push(p.isRedox ? 'ОВР' : 'без ОВР')
  parts.push(p.heatEffect === 'exo' ? 'экзотермическая' : p.heatEffect === 'endo' ? 'эндотермическая' : 'изотермическая')
  parts.push(p.reversibility === 'reversible' ? 'обратимая' : 'необратимая')
  parts.push(p.phaseKind === 'homogeneous' ? 'гомогенная' : 'гетерогенная')
  parts.push(p.catalytic ? 'каталитическая' : 'некаталитическая')
  return parts.join(' · ')
}

export type ReactionPassportDefaults = Partial<ReactionPassport>

/** Типовые паспорта по классу реакции (можно переопределить в банке). */
export function defaultPassportForClass(
  reactionClass: ReactionClass,
  overrides: ReactionPassportDefaults = {},
): ReactionPassport {
  const base: ReactionPassport = {
    isRedox: false,
    heatEffect: 'neutral',
    reversibility: 'irreversible',
    phaseKind: 'homogeneous',
    catalytic: false,
  }

  switch (reactionClass) {
    case 'combustion':
      Object.assign(base, { isRedox: true, heatEffect: 'exo', phaseKind: 'heterogeneous' })
      break
    case 'combination':
      Object.assign(base, { heatEffect: 'exo' })
      break
    case 'decomposition':
      Object.assign(base, { heatEffect: 'endo', phaseKind: 'heterogeneous' })
      break
    case 'substitution':
      Object.assign(base, { isRedox: true, phaseKind: 'heterogeneous' })
      break
    case 'exchange':
    case 'neutralization':
      Object.assign(base, { heatEffect: 'exo' })
      break
    case 'redox':
      Object.assign(base, { isRedox: true })
      break
    case 'hydrolysis':
      Object.assign(base, { reversibility: 'reversible' })
      break
    case 'complex':
      Object.assign(base, { reversibility: 'reversible' })
      break
    case 'catalytic':
      Object.assign(base, { catalytic: true })
      break
  }

  return { ...base, ...overrides }
}
