import type { CompoundCategory } from '../../types/chemistry'
import { compoundById } from '../../data/compounds'
import type { VrLabReactionEffect } from '../types'

export type VrLabPhysProps = {
  liquidColor?: string
  density: number
  viscosity: number
  boilingPointC?: number
  meltingPointC?: number
  gasColor?: string
  precipitateColor?: string
  flameTestColor?: string
  defaultEffect?: VrLabReactionEffect
}

const CATEGORY_DEFAULTS: Record<CompoundCategory, VrLabPhysProps> = {
  acid: { density: 1.05, viscosity: 0.42, boilingPointC: 100 },
  base: { density: 1.04, viscosity: 0.55, boilingPointC: 100 },
  salt: { density: 1.12, viscosity: 0.48, boilingPointC: 100 },
  oxide: { density: 2.4, viscosity: 0.6 },
  other: { density: 1.0, viscosity: 0.5, boilingPointC: -33 },
}

/** Ключевые вещества — точные физ. свойства для VR-анимаций. */
const OVERRIDES: Record<string, Partial<VrLabPhysProps>> = {
  h2o: { density: 1.0, viscosity: 0.5, boilingPointC: 100, meltingPointC: 0, liquidColor: '#6ec8ff' },
  hcl: { density: 1.05, viscosity: 0.38, liquidColor: '#ffe8a8', boilingPointC: 110 },
  h2so4: { density: 1.84, viscosity: 0.72, liquidColor: '#fff4cc', boilingPointC: 337 },
  hno3: { density: 1.42, viscosity: 0.45, liquidColor: '#ffd4a8', boilingPointC: 83 },
  naoh: { density: 1.04, viscosity: 0.58, liquidColor: '#ffc8e8', boilingPointC: 138 },
  koh: { density: 1.09, viscosity: 0.56, liquidColor: '#ffb8dc' },
  ca_oh_2: { density: 2.24, viscosity: 0.65, precipitateColor: '#f5f5f0' },
  salt_cu_so4: { density: 1.18, liquidColor: '#4da6ff', flameTestColor: '#22c55e' },
  salt_k_mno4: { density: 1.12, liquidColor: '#a855f7' },
  salt_ag_no3: { density: 1.73, liquidColor: '#e8f0ff' },
  salt_nacl: { density: 1.08, liquidColor: '#f0f4ff' },
  nacl: { density: 1.08, liquidColor: '#f0f4ff' },
  salt_na_co3: { density: 1.06, liquidColor: '#f8f8ff' },
  salt_nahco3: { density: 1.09, liquidColor: '#fafafa' },
  salt_caco3: { density: 2.71, precipitateColor: '#f5f5f0' },
  caco3: { density: 2.71, precipitateColor: '#f5f5f0' },
  co2: { density: 0.00198, gasColor: '#c8e8ff', boilingPointC: -78 },
  h2: { density: 0.00009, gasColor: '#e0f4ff', boilingPointC: -253 },
  nh3: { density: 0.00073, gasColor: '#d8f0ff', boilingPointC: -33 },
  o2: { density: 0.00143, gasColor: '#b8e8ff', boilingPointC: -183 },
  cao: { density: 3.34, meltingPointC: 2613 },
  mgo: { density: 3.58, meltingPointC: 2852 },
  fe2o3: { density: 5.24, precipitateColor: '#8b4513' },
  cuo: { density: 6.31, precipitateColor: '#1a1a1a' },
  salt_fe3_cl: { density: 1.42, liquidColor: '#d4a017' },
  salt_fe2_cl: { density: 1.36, liquidColor: '#9acd32' },
  salt_pb_no3: { density: 1.68, liquidColor: '#f0f0ff' },
  salt_ki: { density: 1.12, liquidColor: '#f8f8ff' },
  salt_ba_cl: { density: 1.18, liquidColor: '#f0f4ff' },
  salt_ba_so4: { density: 4.5, precipitateColor: '#ffffff' },
  salt_ag_cl: { density: 5.56, precipitateColor: '#f8f8f8' },
  salt_cu_oh: { density: 2.2, precipitateColor: '#1e90ff' },
  salt_fe3_oh: { density: 2.4, precipitateColor: '#8b4513' },
  salt_na: { flameTestColor: '#fbbf24' },
  salt_k: { flameTestColor: '#c084fc' },
  salt_cu: { flameTestColor: '#22c55e' },
  salt_ca: { flameTestColor: '#f97316' },
  salt_ba: { flameTestColor: '#84cc16' },
  salt_li: { flameTestColor: '#ef4444' },
}

const cache = new Map<string, VrLabPhysProps>()

export function getVrLabPhysProps(compoundId: string): VrLabPhysProps {
  const cached = cache.get(compoundId)
  if (cached) return cached

  const c = compoundById[compoundId]
  const cat = c?.category ?? 'other'
  const base = { ...CATEGORY_DEFAULTS[cat] }
  const ov = OVERRIDES[compoundId] ?? {}

  const props: VrLabPhysProps = {
    ...base,
    ...ov,
    liquidColor: ov.liquidColor ?? (c?.accentColor?.startsWith('#') ? c.accentColor : base.liquidColor),
  }
  cache.set(compoundId, props)
  return props
}

export function compareDensity(aId: string, bId: string): number {
  return getVrLabPhysProps(aId).density - getVrLabPhysProps(bId).density
}
