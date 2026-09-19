import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * C (графит) + O₂ (г.) → CO₂ (г.) — ковалентная полярная связь, Kimyo 7–8 класс.
 *
 * Шесть шагов урока:
 *   1 «Уголь и кислород»        — фрагмент ГРАФИТА (два слоя, P6₃/mmc, C–C 141,8 пм,
 *                                 между слоями 335,4 пм) и МОЛЕКУЛЫ O₂ (120,8 пм);
 *   2 «Атом покидает слой»      — с края слоя уходит атом углерода: энтальпия
 *                                 атомизации графита +716,7 кДж/моль — самая дорогая ступень;
 *   3 «Первая связь C=O»        — связь O=O рвётся гомолитически (+498 кДж/моль),
 *                                 первый атом кислорода садится на углерод;
 *   4 «Молекула выпрямляется»   — вторая связь C=O, sp-гибридизация, угол 180°,
 *                                 две σ- и две π-связи, длина C=O 116,0 пм;
 *   5 «Связи полярны, молекула — нет» — Δχ(O − C) = 0,89, но диполи связей
 *                                 направлены встречно и гасятся: μ = 0 D;
 *   6 «Энергия»                 — ΔH°f(CO₂) = −393,5 кДж/моль, тепло и свет пламени,
 *                                 предупреждение про угарный газ CO (ΔH°f = −110,5).
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const CO2_STEP_IDS = ['reactants', 'erosion', 'firstBond', 'linear', 'polarity', 'energy'] as const

export type Co2StepId = (typeof CO2_STEP_IDS)[number]

export type Co2Step = SceneStep<Co2StepId>

const STEPS: readonly Co2Step[] = [
  { id: 'reactants', from: 0, to: 4.2, wall: 4.8, ease: 'power1.inOut' },
  { id: 'erosion', from: 4.2, to: 8.4, wall: 5.2, ease: 'sine.inOut' },
  { id: 'firstBond', from: 8.4, to: 13.4, wall: 6.0, ease: 'sine.inOut' },
  { id: 'linear', from: 13.4, to: 18.0, wall: 5.6, ease: 'power1.inOut' },
  { id: 'polarity', from: 18.0, to: 21.6, wall: 4.4, ease: 'power1.inOut' },
  { id: 'energy', from: 21.6, to: 25.8, wall: 5.0, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const CO2_FINISH: SceneFinish = { from: 25.8, to: 26.6, wall: 1.2, ease: 'power2.in' }

export type Co2CueId =
  /** уголь раскалился: фрагмент графита светится, реакция может начаться */
  | 'ignite'
  /** атом углерода оторвался от края слоя (атомизация графита) */
  | 'detach'
  /** связь O=O разорвана гомолитически */
  | 'o2Break'
  /** первая связь C=O замкнулась */
  | 'bond1'
  /** вторая связь C=O замкнулась */
  | 'bond2'
  /** молекула выпрямилась: O=C=O, 180° */
  | 'linear'
  /** показаны диполи связей и их взаимное гашение */
  | 'dipole'
  /** пик выделения энергии: пламя горящего угля */
  | 'exo'
  /** предупреждение о неполном сгорании: 2 C + O₂ → 2 CO */
  | 'coWarn'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const CO2_TIMING = defineSceneTiming<Co2StepId, Co2CueId>({
  steps: STEPS,
  finish: CO2_FINISH,
  cues: [
    { at: 3.4, id: 'ignite' },
    { at: 6.6, id: 'detach' },
    { at: 10.0, id: 'o2Break' },
    { at: 12.2, id: 'bond1' },
    { at: 14.6, id: 'bond2' },
    { at: 17.4, id: 'linear' },
    { at: 19.6, id: 'dipole' },
    { at: 22.6, id: 'exo' },
    { at: 24.4, id: 'coWarn' },
    { at: 26.0, id: 'embryo' },
    { at: 26.3, id: 'birth' },
    { at: CO2_FINISH.to, id: 'complete' },
  ],
})

export const CO2_STEPS = CO2_TIMING.steps
export const CO2_SEGMENTS = CO2_TIMING.segments
export const CO2_CUES = CO2_TIMING.cues
export const CO2_END = CO2_TIMING.end

export const co2StepIndexAt = CO2_TIMING.stepIndexAt
export const co2StepById = CO2_TIMING.stepById
export const co2CueAt = CO2_TIMING.cueAt
