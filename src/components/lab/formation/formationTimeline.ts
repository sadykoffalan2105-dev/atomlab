import type { FormationPlan } from '../../../chemistry/formationPlan'

/**
 * Время «Как образуется»: 4 шага — Состав → Заряды / валентности → Сборка (6–10 с) → Готово (держится).
 * Чистые функции: их читают и 3D-вид (положения частиц), и подписи (номер шага).
 */
export type FormationClock = { t: number; playing: boolean }

export const STEP_COMPOSITION = 2.6
export const STEP_CHARGES = 3.2

export type FormationTimeline = {
  /** начала шагов 1…4, с */
  starts: [number, number, number, number]
  /** длительность сборки, с */
  assembly: number
  /** конец сборки — дальше «Готово» */
  end: number
}

export function formationTimeline(plan: FormationPlan): FormationTimeline {
  const n = plan.mode === 'molecular' ? plan.bondOrder.length : plan.units.length
  const assembly = plan.crystal ? 8 : Math.min(10, Math.max(6, 4 + 0.5 * n))
  const s3 = STEP_COMPOSITION + STEP_CHARGES
  return { starts: [0, STEP_COMPOSITION, s3, s3 + assembly], assembly, end: s3 + assembly }
}

export function stepAt(tl: FormationTimeline, t: number): 0 | 1 | 2 | 3 {
  if (t >= tl.starts[3]) return 3
  if (t >= tl.starts[2]) return 2
  if (t >= tl.starts[1]) return 1
  return 0
}

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
export const easeInOut = (x: number): number => {
  const u = clamp01(x)
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}
/** Притяжение: медленно издалека, быстрее у цели и мягкая посадка (без отскока). */
export const easeAttract = (x: number): number => {
  const u = clamp01(x)
  const a = u * u * (3 - 2 * u)
  return a * a * (3 - 2 * a)
}
