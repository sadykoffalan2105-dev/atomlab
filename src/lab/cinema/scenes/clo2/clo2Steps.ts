import type { StorySegment } from '../../core/storyTime'
import type { Cue } from '../../core/cues'

/**
 * Синтез диоксида хлора в растворе: 2 NaClO₂ + Cl₂ → 2 ClO₂ + 2 NaCl.
 * Показываем принятый в литературе механизм, а не «прыжок электрона на Cl₂»:
 *
 *   1) ClO₂⁻ + Cl₂ → ClOClO + Cl⁻   — медленная стадия, перенос Cl⁺
 *      (Nicoson & Margerum, Inorg. Chem. 2002, 41, 342; двухстадийный перенос
 *      электронов там проверен и опровергнут);
 *   2) ClOClO + ClO₂⁻ → [ClOCl(O)OClO]⁻ → 2 ClO₂ + Cl⁻
 *      (комплекс — по расчётам Jia, Margerum & Francisco, Inorg. Chem. 2000, 39, 2614).
 *
 * Здесь только разметка времени: шаги урока, экранный хронометраж и события.
 * Файл без THREE и React — его читают тесты, watchdog лаборатории и озвучка.
 */

export const CLO2_STEP_IDS = [
  'reagents',
  'approach',
  'clTransfer',
  'intermediate',
  'attack',
  'split',
  'products',
  'balance',
] as const

export type Clo2StepId = (typeof CLO2_STEP_IDS)[number]

export type Clo2Step = {
  id: Clo2StepId
  /** начало шага, story time */
  from: number
  /** конец шага — здесь пошаговый режим встаёт на паузу */
  to: number
  /** экранные секунды на шаг; > to − from = замедленная съёмка */
  wall: number
  ease: string
}

export const CLO2_STEPS: readonly Clo2Step[] = [
  { id: 'reagents', from: 0, to: 5, wall: 5.6, ease: 'power1.inOut' },
  { id: 'approach', from: 5, to: 8, wall: 3.6, ease: 'power1.inOut' },
  { id: 'clTransfer', from: 8, to: 12, wall: 7.2, ease: 'sine.inOut' },
  { id: 'intermediate', from: 12, to: 15, wall: 3.4, ease: 'power1.inOut' },
  { id: 'attack', from: 15, to: 18.5, wall: 4.6, ease: 'power1.inOut' },
  { id: 'split', from: 18.5, to: 23, wall: 8, ease: 'sine.inOut' },
  { id: 'products', from: 23, to: 27, wall: 4.6, ease: 'power1.inOut' },
  { id: 'balance', from: 27, to: 31, wall: 4.4, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const CLO2_FINISH = { from: 31, to: 31.8, wall: 1.3, ease: 'power2.in' } as const

export const CLO2_END = CLO2_FINISH.to

/** Экранный хронометраж: один сегмент на шаг — границы шагов совпадают с границами сегментов. */
export const CLO2_SEGMENTS: readonly StorySegment[] = [
  ...CLO2_STEPS.map((s) => ({ to: s.to, wall: s.wall, ease: s.ease })),
  { to: CLO2_FINISH.to, wall: CLO2_FINISH.wall, ease: CLO2_FINISH.ease },
]

export type Clo2CueId =
  /** пузырёк газа растворился — Cl₂ в растворе */
  | 'bubble'
  /** новая связь O–Cl, связь Cl–Cl разорвана */
  | 'clTransfer'
  /** первый Cl⁻ оторвался */
  | 'chlorideOut'
  /** второй хлорит присоединился к центральному Cl */
  | 'adduct'
  /** комплекс распался */
  | 'split'
  /** обе молекулы ClO₂ приняли форму радикала */
  | 'radicals'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const CLO2_CUES: readonly Cue<Clo2CueId>[] = [
  { at: 3.45, id: 'bubble' },
  { at: 10.2, id: 'clTransfer' },
  { at: 10.75, id: 'chlorideOut' },
  { at: 18.15, id: 'adduct' },
  { at: 20.35, id: 'split' },
  { at: 22.4, id: 'radicals' },
  { at: 31.2, id: 'embryo' },
  { at: 31.5, id: 'birth' },
  { at: CLO2_END, id: 'complete' },
]

/** Шаг, внутри которого находится момент t (конец шага принадлежит ему самому). */
export function clo2StepIndexAt(t: number): number {
  for (let i = 0; i < CLO2_STEPS.length; i++) {
    if (t <= CLO2_STEPS[i]!.to) return i
  }
  return CLO2_STEPS.length - 1
}

export function clo2StepById(id: Clo2StepId): Clo2Step {
  return CLO2_STEPS.find((s) => s.id === id)!
}
