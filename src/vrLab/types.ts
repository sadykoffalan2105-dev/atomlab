/** Состояние одной пробирки / колбы / чана. */
export type VrLabTubeContent = {
  compoundId: string
  fillLevel: number
  liquidColor: string
  emissive: string
  glow: number
  opacity: number
  viscosity: number
  /** Температура раствора °C (для кипения/замерзания). */
  temperature?: number
  /** Плотность g/mL для расслоения жидкостей. */
  density?: number
}

/** Колба на настенной полке или перенесённая на стол. */
export type VrLabShelfFlask = {
  id: string
  label: string
  content: VrLabTubeContent | null
  slotIndex: number | null
  onShelf: boolean
  position: [number, number, number]
}

export type VrLabSelectionTarget = { kind: 'shelf'; id: string } | { kind: 'vat' }

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
  products?: { compoundId: string; phase: 'liquid' | 'solid' | 'gas'; coeff: number }[]
  precipitateId?: string
  gasIds?: string[]
  confidence?: 'curated' | 'rule' | 'none'
}

export type VrLabBenchState = {
  shelfFlasks: VrLabShelfFlask[]
  /** Содержимое реактора смешивания. */
  beaker: VrLabTubeContent | null
  /** Первый реагент, уже влитый в чан (ожидает второй). */
  vatReagentA: VrLabTubeContent | null
  selectedTarget: VrLabSelectionTarget | null
  mixing: boolean
  lastMix: VrLabMixResult | null
  animProgress: number
  animPhase: 'idle' | 'pouring' | 'combining' | 'reacting'
  pourShelfFlaskId: string | null
  pourCompoundId: string | null
  mixColor: string | null
  /** Пара реагентов последней реакции (для curated VFX). */
  lastReactionPair: { a: string; b: string } | null
  /** Авто-смешивание: колба в анимации. */
  autoMixFlaskId: string | null
  autoMixOverridePos: [number, number, number] | null
  autoMixTilt: number
  /** ID урока для практики (deep link). */
  activeLessonId: string | null
  /** Масштаб времени анимации (0.1–5). */
  timeScale: number
  /** Качественная концентрация раствора. */
  concentration: 'dilute' | 'normal' | 'concentrated'
  /** Базовая температура эксперимента °C. */
  experimentTemperature: number
}

export type VrLabSubstanceVisual = {
  compoundId: string
  liquidColor: string
  emissive: string
  opacity: number
  viscosity: number
  glow: number
}
