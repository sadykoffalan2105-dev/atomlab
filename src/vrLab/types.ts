/** Состояние одной пробирки на столе. */
export type VrLabTubeContent = {
  compoundId: string
  /** 0…1 уровень жидкости */
  fillLevel: number
  /** Цвет раствора (hex) */
  liquidColor: string
}

export type VrLabTubeSlot = {
  id: string
  label: string
  content: VrLabTubeContent | null
}

export type VrLabReactionEffect =
  | 'neutralization'
  | 'precipitate'
  | 'gasEvolution'
  | 'combustion'
  | 'hydration'
  | 'colorShift'
  | 'exothermic'
  | 'noReaction'

export type VrLabMixResult = {
  kind: 'reaction' | 'noReaction' | 'sameSubstance' | 'empty'
  productId?: string
  productColor?: string
  effect: VrLabReactionEffect
  equationUnicode: string
  messageKey: string
  heat: number
  bubbleIntensity: number
}

export type VrLabBenchState = {
  tubes: VrLabTubeSlot[]
  beaker: VrLabTubeContent | null
  selectedTubeId: string | null
  mixing: boolean
  lastMix: VrLabMixResult | null
  /** 0…1 прогресс текущей анимации */
  animProgress: number
  /** idle | pouring | combining | reacting */
  animPhase: 'idle' | 'pouring' | 'combining' | 'reacting'
  pourTubeId: string | null
  pourCompoundId: string | null
  mixColor: string | null
}

export type VrLabSubstanceVisual = {
  compoundId: string
  liquidColor: string
  emissive: string
  opacity: number
  viscosity: number
  glow: number
}
