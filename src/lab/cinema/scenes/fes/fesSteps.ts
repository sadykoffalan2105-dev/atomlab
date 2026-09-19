import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * Fe (тв.) + S (тв.) → FeS (тв.) — классический опыт «смесь или соединение», Kimyo 7–8 класс.
 *
 * Шесть шагов урока:
 *   1 «Смесь железа и серы»   — опилки железа и порошок серы рядом; магнит ВЫТЯГИВАЕТ
 *                               железо, сера остаётся: в смеси каждое вещество
 *                               сохраняет свои свойства, состав смеси произвольный;
 *   2 «Нагревание и начало»   — смесь нагревают; после начала реакция идёт САМА
 *                               (экзотермическая), горелку можно убрать;
 *   3 «Переход электронов»    — Fe⁰ − 2e⁻ → Fe²⁺ (126 → 78 пм, катион МЕНЬШЕ атома),
 *                               S⁰ + 2e⁻ → S²⁻ (105 → 184 пм, анион БОЛЬШЕ атома);
 *   4 «Решётка типа NiAs»     — фрагмент троилита: Fe²⁺ в октаэдре из S²⁻, S²⁻ в
 *                               тригональной призме из Fe²⁺, КЧ 6/6, d = 244,5 пм;
 *   5 «Новое вещество»        — чёрный FeS магнитом НЕ вытягивается: свойства
 *                               соединения не равны свойствам исходных веществ;
 *   6 «Энергия и вывод»       — ΔH°f(FeS) = −100,0 кДж/моль, «смесь ≠ соединение».
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const FES_STEP_IDS = ['mixture', 'heating', 'transfer', 'lattice', 'product', 'energy'] as const

export type FesStepId = (typeof FES_STEP_IDS)[number]

export type FesStep = SceneStep<FesStepId>

const STEPS: readonly FesStep[] = [
  { id: 'mixture', from: 0, to: 4, wall: 4.6, ease: 'power1.inOut' },
  { id: 'heating', from: 4, to: 8, wall: 5.2, ease: 'sine.inOut' },
  { id: 'transfer', from: 8, to: 13, wall: 6.4, ease: 'sine.inOut' },
  { id: 'lattice', from: 13, to: 17.5, wall: 5.6, ease: 'power1.inOut' },
  { id: 'product', from: 17.5, to: 21.5, wall: 5.0, ease: 'power1.inOut' },
  { id: 'energy', from: 21.5, to: 25, wall: 4.4, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const FES_FINISH: SceneFinish = { from: 25, to: 25.8, wall: 1.2, ease: 'power2.in' }

export type FesCueId =
  /** магнит поднесён к смеси */
  | 'magnet'
  /** железо вытянуто магнитом — смесь разделена */
  | 'separate'
  /** смесь загорелась: дальше реакция идёт без нагревания */
  | 'ignite'
  /** электроны пришли к сере: есть Fe²⁺ и S²⁻ */
  | 'transfer'
  /** фрагмент решётки NiAs собран */
  | 'lattice'
  /** магнит поднесён к продукту — и ничего не происходит */
  | 'magnetFail'
  /** пик выделения энергии */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const FES_TIMING = defineSceneTiming<FesStepId, FesCueId>({
  steps: STEPS,
  finish: FES_FINISH,
  cues: [
    { at: 2.0, id: 'magnet' },
    { at: 2.9, id: 'separate' },
    { at: 6.2, id: 'ignite' },
    { at: 11.0, id: 'transfer' },
    { at: 16.6, id: 'lattice' },
    { at: 19.6, id: 'magnetFail' },
    { at: 22.2, id: 'exo' },
    { at: 25.2, id: 'embryo' },
    { at: 25.5, id: 'birth' },
    { at: FES_FINISH.to, id: 'complete' },
  ],
})

export const FES_STEPS = FES_TIMING.steps
export const FES_SEGMENTS = FES_TIMING.segments
export const FES_CUES = FES_TIMING.cues
export const FES_END = FES_TIMING.end

export const fesStepIndexAt = FES_TIMING.stepIndexAt
export const fesStepById = FES_TIMING.stepById
export const fesCueAt = FES_TIMING.cueAt
