// src/components/lab/formation/story/phase.ts
import type { FormationStory } from '../formationStory'
export type Tri = [string, string, string]
/** Итог «как в жизни» при 25 °C. */
export type FinalPhase = 'gas' | 'liquid' | 'solution' | 'molecular' | 'ionic' | 'network' | 'chain'
export type PhaseInfo = {
  /** число копий молекулы вокруг центральной (газ 6–10, жидкость 10–12); 0 — не рисовать */
  copies: number
  /** шаг между центрами копий в диаметрах молекулы: газ 2.4–3.0, жидкость 1.08 */
  spacing: number
  /** раствор: индексы кислотных H модели, уходящих к воде (H₃O⁺); пусто — не диссоциирует */
  acidH?: number[]
  dissociation?: 'strong' | 'weak' | 'none'
  /** раствор: число молекул воды вокруг (4–8) */
  waters?: number
  /** справочная решётка: структурный тип, параметры (пм), координация — для HUD и аудита */
  lattice?: { type: string; a?: number; b?: number; c?: number; coord: string }
  /** честная подпись RU/EN/UZ («реально молекулы газа в ~10 раз дальше», «тенорит 4:4 — упрощено») */
  note?: Tri
}
export type Hybrid = 'none' | 'sp' | 'sp2' | 'sp3'
export type AtomOrbital = {
  i: number
  el: string
  /** номер внешнего уровня (H 1, O 2, Cl 3, Br 4, I 5) */
  n: number
  /** валентные e⁻ на внешнем уровне у НЕЙТРАЛЬНОГО атома: s 0–2, p 0–6 (металлы: s, p = 0; d не рисуем) */
  s: number
  p: number
  hybrid: Hybrid
  /** неподелённые пары в итоговой частице */
  lone: number
  role: 'covalent' | 'cation' | 'anion' | 'metal' | 'inert'
  /** ионные: отдано (+n) / принято (−n) e⁻ */
  dq?: number
}
export type StoryOrbitals = { atoms: AtomOrbital[] }
/** Нормы движения (общие для вида и аудита). */
export const VIB_LIMITS = { ampPm: 4, hzMax: 1.5, latticeAmpPm: 0.3 } as const
export type VibSpec = { ampPm: number; hz: number; expand: number }
export const VIB_DEFAULT: VibSpec = { ampPm: 4, hz: 1.2, expand: 0.015 }
type Ext = { finalPhase?: FinalPhase; phaseInfo?: PhaseInfo; orbitals?: StoryOrbitals; vib?: VibSpec }
/** Фаза итога: поле story (B) или вывод по latticeKind/type (пока B не выложил данные). */
export function phaseOf(story: FormationStory): FinalPhase {
  const e = story as FormationStory & Ext
  if (e.finalPhase) return e.finalPhase
  const k = story.latticeKind
  if (k === 'ionic' || k === 'molecular' || k === 'network' || k === 'chain') return k
  return 'gas'
}
export function phaseInfoOf(story: FormationStory): PhaseInfo {
  return (story as FormationStory & Ext).phaseInfo ?? { copies: phaseOf(story) === 'gas' ? 8 : 0, spacing: 2.6 }
}
export function orbitalsOf(story: FormationStory): StoryOrbitals | null {
  return (story as FormationStory & Ext).orbitals ?? null
}
export function vibOf(story: FormationStory): VibSpec {
  return (story as FormationStory & Ext).vib ?? VIB_DEFAULT
}
