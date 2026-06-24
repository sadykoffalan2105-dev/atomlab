/** Расчёт скорости переливания от наклона колбы. */
export const POUR_TILT_THRESHOLD = 0.28
export const POUR_TILT_DEG_THRESHOLD = 38

export function tiltNormToDeg(tilt: number): number {
  return tilt * 75
}

export function computePourFlow(tilt: number, fillLevel: number, viscosity: number): number {
  if (tilt < POUR_TILT_THRESHOLD || fillLevel < 0.05) return 0
  const over = (tilt - POUR_TILT_THRESHOLD) / (1 - POUR_TILT_THRESHOLD)
  return Math.sin(over * Math.PI * 0.5) * fillLevel * (1 - viscosity * 0.35)
}

export function canPourFromTilt(tilt: number, fillLevel: number): boolean {
  return tilt >= POUR_TILT_THRESHOLD && fillLevel >= 0.05
}
