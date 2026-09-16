import type { StorySegment } from '../../core/storyTime'
import type { Cue } from '../../core/cues'

/**
 * Синтез поваренной соли из простых веществ: 2 Na + Cl₂ → 2 NaCl (Kimyo, 7–8 класс:
 * ионная связь, переход электрона). Показываем школьную картину честно:
 *
 *   1) атомы Na и молекула Cl₂ сближаются;
 *   2) связь Cl–Cl рвётся гомолитически — по одному электрону каждому атому;
 *   3) единственный внешний электрон натрия (3s¹) переходит к хлору:
 *      Na → Na⁺ + e⁻ (радиус 1,86 → 1,02 Å), Cl + e⁻ → Cl⁻ (0,99 → 1,81 Å);
 *   4) разноимённые ионы притягиваются электростатически;
 *   5) ионы укладываются в фрагмент кубической решётки NaCl (Na–Cl 2,82 Å);
 *   6) выделяется энергия: ΔH°f(NaCl) = −411 кДж/моль.
 *
 * Здесь только разметка времени: шаги урока, экранный хронометраж и события.
 * Файл без THREE и React — его читают тесты, watchdog лаборатории и панель урока.
 */

export const NACL_STEP_IDS = ['approach', 'homolysis', 'transfer', 'attraction', 'lattice', 'energy'] as const

export type NaclStepId = (typeof NACL_STEP_IDS)[number]

export type NaclStep = {
  id: NaclStepId
  /** начало шага, story time */
  from: number
  /** конец шага — здесь пошаговый режим встаёт на паузу */
  to: number
  /** экранные секунды на шаг; > to − from = замедленная съёмка */
  wall: number
  ease: string
}

export const NACL_STEPS: readonly NaclStep[] = [
  { id: 'approach', from: 0, to: 4, wall: 4.6, ease: 'power1.inOut' },
  { id: 'homolysis', from: 4, to: 7, wall: 4.4, ease: 'sine.inOut' },
  { id: 'transfer', from: 7, to: 12, wall: 8.2, ease: 'sine.inOut' },
  { id: 'attraction', from: 12, to: 15, wall: 4.2, ease: 'power1.inOut' },
  { id: 'lattice', from: 15, to: 20, wall: 6.2, ease: 'power1.inOut' },
  { id: 'energy', from: 20, to: 24, wall: 5, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const NACL_FINISH = { from: 24, to: 24.8, wall: 1.3, ease: 'power2.in' } as const

export const NACL_END = NACL_FINISH.to

/** Экранный хронометраж: один сегмент на шаг — границы шагов совпадают с границами сегментов. */
export const NACL_SEGMENTS: readonly StorySegment[] = [
  ...NACL_STEPS.map((s) => ({ to: s.to, wall: s.wall, ease: s.ease })),
  { to: NACL_FINISH.to, wall: NACL_FINISH.wall, ease: NACL_FINISH.ease },
]

export type NaclCueId =
  /** связь Cl–Cl разорвана (гомолиз) */
  | 'bondBreak'
  /** электроны прибыли к атомам хлора: ионы Na⁺ и Cl⁻ есть */
  | 'transfer'
  /** ионы соприкоснулись — первая ионная пара */
  | 'contact'
  /** фрагмент решётки собран */
  | 'lattice'
  /** пик выделения энергии */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const NACL_CUES: readonly Cue<NaclCueId>[] = [
  { at: 6.0, id: 'bondBreak' },
  { at: 10.0, id: 'transfer' },
  { at: 14.4, id: 'contact' },
  { at: 19.2, id: 'lattice' },
  { at: 20.8, id: 'exo' },
  { at: 24.2, id: 'embryo' },
  { at: 24.5, id: 'birth' },
  { at: NACL_END, id: 'complete' },
]

/** Шаг, внутри которого находится момент t (конец шага принадлежит ему самому). */
export function naclStepIndexAt(t: number): number {
  for (let i = 0; i < NACL_STEPS.length; i++) {
    if (t <= NACL_STEPS[i]!.to) return i
  }
  return NACL_STEPS.length - 1
}

export function naclStepById(id: NaclStepId): NaclStep {
  return NACL_STEPS.find((s) => s.id === id)!
}

export function naclCueAt(id: NaclCueId): number {
  return NACL_CUES.find((c) => c.id === id)!.at
}
