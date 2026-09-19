import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * 2 Na (тв.) + Cl₂ (г.) → 2 NaCl (тв.) — ионная связь, Kimyo 7–8 класс.
 *
 * Шесть шагов урока:
 *   1 «Исходные вещества»       — фрагмент металлического натрия (ОЦК, КЧ 8)
 *                                 и МОЛЕКУЛА хлора Cl₂ с настоящей длиной связи;
 *   2 «Сублимация и диссоциация» — атом Na выходит из металла (+107,3 кДж/моль),
 *                                 связь Cl–Cl рвётся ГОМОЛИТИЧЕСКИ (+121,7 на ½Cl₂);
 *   3 «Отдача и приём электрона» — 3s¹ уходит от Na (+495,8), приходит к Cl (−349);
 *                                 радиусы меняются ровно в этот момент;
 *   4 «Электростатическое притяжение» — ионы сходятся на 282 пм, показан закон Кулона;
 *   5 «Кристаллическая решётка»  — фрагмент 4×4×4, чередование зарядов, КЧ 6 (−786);
 *   6 «Энергетический итог»      — вся лестница Борна — Габера, ΔH°f ≈ −411 кДж/моль.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const NACL_STEP_IDS = ['reactants', 'sublimation', 'transfer', 'attraction', 'lattice', 'energy'] as const

export type NaclStepId = (typeof NACL_STEP_IDS)[number]

export type NaclStep = SceneStep<NaclStepId>

const STEPS: readonly NaclStep[] = [
  { id: 'reactants', from: 0, to: 4, wall: 4.6, ease: 'power1.inOut' },
  { id: 'sublimation', from: 4, to: 8, wall: 5.4, ease: 'sine.inOut' },
  { id: 'transfer', from: 8, to: 13, wall: 6.6, ease: 'sine.inOut' },
  { id: 'attraction', from: 13, to: 16, wall: 4.0, ease: 'power1.inOut' },
  { id: 'lattice', from: 16, to: 21, wall: 6.4, ease: 'power1.inOut' },
  { id: 'energy', from: 21, to: 25, wall: 4.6, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const NACL_FINISH: SceneFinish = { from: 25, to: 25.8, wall: 1.2, ease: 'power2.in' }

export type NaclCueId =
  /** атом натрия оторвался от металлической решётки (сублимация) */
  | 'sublimate'
  /** связь Cl–Cl разорвана гомолитически */
  | 'bondBreak'
  /** электроны пришли к хлору: есть Na⁺ и Cl⁻ */
  | 'transfer'
  /** ионы соприкоснулись — первая ионная пара, d = 282 пм */
  | 'contact'
  /** фрагмент решётки 4×4×4 собран */
  | 'lattice'
  /** пик выделения энергии: пламя горящего натрия в хлоре */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const NACL_TIMING = defineSceneTiming<NaclStepId, NaclCueId>({
  steps: STEPS,
  finish: NACL_FINISH,
  cues: [
    { at: 5.2, id: 'sublimate' },
    { at: 7.0, id: 'bondBreak' },
    { at: 11.0, id: 'transfer' },
    { at: 15.4, id: 'contact' },
    { at: 20.6, id: 'lattice' },
    { at: 21.8, id: 'exo' },
    { at: 25.2, id: 'embryo' },
    { at: 25.5, id: 'birth' },
    { at: NACL_FINISH.to, id: 'complete' },
  ],
})

export const NACL_STEPS = NACL_TIMING.steps
export const NACL_SEGMENTS = NACL_TIMING.segments
export const NACL_CUES = NACL_TIMING.cues
export const NACL_END = NACL_TIMING.end

export const naclStepIndexAt = NACL_TIMING.stepIndexAt
export const naclStepById = NACL_TIMING.stepById
export const naclCueAt = NACL_TIMING.cueAt
