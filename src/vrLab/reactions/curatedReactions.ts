import type { VrLabReactionEffect } from '../types'
import { mixVrLabSubstances } from '../mixEngine'

export type CuratedReactionId =
  | 'neutralization_hcl_naoh'
  | 'neutralization_h2so4_naoh'
  | 'gas_co2_carbonate'
  | 'hydration_cao'
  | 'neutralization_hcl_koh'
  | 'gas_nh3_hcl'
  | 'color_cuo_h2so4'
  | 'gas_h2o2_catalysis'
  | 'gas_co2_water'
  | 'color_fe2o3_hcl'

export type CuratedReactionDef = {
  id: CuratedReactionId
  lessonId: string
  a: string
  b: string
  titleKey: string
  effect: VrLabReactionEffect
  vfx: {
    steamDensity: number
    bubbleRate: number
    heatGlow: number
    gasPlume: boolean
    precipitate?: boolean
    indicatorShift?: { from: string; to: string }
  }
  practice: {
    compoundA: string
    compoundB: string
    observationKey: string
  }
}

export const CURATED_REACTIONS: CuratedReactionDef[] = [
  {
    id: 'neutralization_hcl_naoh',
    lessonId: 'vr-lesson-neutralization',
    a: 'hcl',
    b: 'naoh',
    titleKey: 'vrLab.curated.neutralization_hcl_naoh',
    effect: 'neutralization',
    vfx: { steamDensity: 0.55, bubbleRate: 0.25, heatGlow: 0.5, gasPlume: false, indicatorShift: { from: '#ff4466', to: '#88ccff' } },
    practice: { compoundA: 'hcl', compoundB: 'naoh', observationKey: 'vrLab.lesson.obs.neutralization' },
  },
  {
    id: 'neutralization_h2so4_naoh',
    lessonId: 'vr-lesson-neutralization',
    a: 'h2so4',
    b: 'naoh',
    titleKey: 'vrLab.curated.neutralization_h2so4_naoh',
    effect: 'neutralization',
    vfx: { steamDensity: 0.65, bubbleRate: 0.3, heatGlow: 0.65, gasPlume: false },
    practice: { compoundA: 'h2so4', compoundB: 'naoh', observationKey: 'vrLab.lesson.obs.warmNeutralization' },
  },
  {
    id: 'gas_co2_carbonate',
    lessonId: 'vr-lesson-gas-evolution',
    a: 'hcl',
    b: 'salt_na_co3',
    titleKey: 'vrLab.curated.gas_co2_carbonate',
    effect: 'gasEvolution',
    vfx: { steamDensity: 0.35, bubbleRate: 0.95, heatGlow: 0.35, gasPlume: true },
    practice: { compoundA: 'hcl', compoundB: 'salt_na_co3', observationKey: 'vrLab.lesson.obs.co2' },
  },
  {
    id: 'hydration_cao',
    lessonId: 'vr-lesson-hydration',
    a: 'cao',
    b: 'h2o',
    titleKey: 'vrLab.curated.hydration_cao',
    effect: 'hydration',
    vfx: { steamDensity: 0.9, bubbleRate: 0.5, heatGlow: 0.85, gasPlume: true },
    practice: { compoundA: 'cao', compoundB: 'h2o', observationKey: 'vrLab.lesson.obs.hydration' },
  },
  {
    id: 'neutralization_hcl_koh',
    lessonId: 'vr-lesson-neutralization',
    a: 'hcl',
    b: 'koh',
    titleKey: 'vrLab.curated.neutralization_hcl_koh',
    effect: 'neutralization',
    vfx: { steamDensity: 0.5, bubbleRate: 0.22, heatGlow: 0.48, gasPlume: false },
    practice: { compoundA: 'hcl', compoundB: 'koh', observationKey: 'vrLab.lesson.obs.neutralization' },
  },
  {
    id: 'gas_nh3_hcl',
    lessonId: 'vr-lesson-gas-evolution',
    a: 'nh3',
    b: 'hcl',
    titleKey: 'vrLab.curated.gas_nh3_hcl',
    effect: 'gasEvolution',
    vfx: { steamDensity: 0.45, bubbleRate: 0.7, heatGlow: 0.4, gasPlume: true },
    practice: { compoundA: 'nh3', compoundB: 'hcl', observationKey: 'vrLab.lesson.obs.whiteFume' },
  },
  {
    id: 'color_cuo_h2so4',
    lessonId: 'vr-lesson-color-shift',
    a: 'cuo',
    b: 'h2so4',
    titleKey: 'vrLab.curated.color_cuo_h2so4',
    effect: 'colorShift',
    vfx: { steamDensity: 0.2, bubbleRate: 0.15, heatGlow: 0.3, gasPlume: false },
    practice: { compoundA: 'cuo', compoundB: 'h2so4', observationKey: 'vrLab.lesson.obs.blueSolution' },
  },
  {
    id: 'gas_h2o2_catalysis',
    lessonId: 'vr-lesson-gas-evolution',
    a: 'h2o2',
    b: 'mno2',
    titleKey: 'vrLab.curated.gas_h2o2_catalysis',
    effect: 'gasEvolution',
    vfx: { steamDensity: 0.4, bubbleRate: 1, heatGlow: 0.45, gasPlume: true },
    practice: { compoundA: 'h2o2', compoundB: 'mno2', observationKey: 'vrLab.lesson.obs.catalysis' },
  },
  {
    id: 'gas_co2_water',
    lessonId: 'vr-lesson-gas-evolution',
    a: 'co2',
    b: 'h2o',
    titleKey: 'vrLab.curated.gas_co2_water',
    effect: 'gasEvolution',
    vfx: { steamDensity: 0.3, bubbleRate: 0.85, heatGlow: 0.2, gasPlume: true },
    practice: { compoundA: 'co2', compoundB: 'h2o', observationKey: 'vrLab.lesson.obs.co2dissolve' },
  },
  {
    id: 'color_fe2o3_hcl',
    lessonId: 'vr-lesson-color-shift',
    a: 'fe2o3',
    b: 'hcl',
    titleKey: 'vrLab.curated.color_fe2o3_hcl',
    effect: 'colorShift',
    vfx: { steamDensity: 0.18, bubbleRate: 0.12, heatGlow: 0.28, gasPlume: false },
    practice: { compoundA: 'fe2o3', compoundB: 'hcl', observationKey: 'vrLab.lesson.obs.yellowSolution' },
  },
]

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

const CURATED_MAP = new Map<string, CuratedReactionDef>()
for (const r of CURATED_REACTIONS) {
  CURATED_MAP.set(pairKey(r.a, r.b), r)
}

export function findCuratedReaction(a: string, b: string): CuratedReactionDef | null {
  const mix = mixVrLabSubstances(a, b)
  if (mix.kind !== 'reaction') return null
  return CURATED_MAP.get(pairKey(a, b)) ?? null
}

export function curatedReactionById(id: CuratedReactionId): CuratedReactionDef | undefined {
  return CURATED_REACTIONS.find((r) => r.id === id)
}

export function curatedReactionByLesson(lessonId: string): CuratedReactionDef[] {
  return CURATED_REACTIONS.filter((r) => r.lessonId === lessonId)
}

export function listCuratedCompoundPairs(): Array<{ a: string; b: string }> {
  return CURATED_REACTIONS.map((r) => ({ a: r.a, b: r.b }))
}
