import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * N₂ (г.) + 3 H₂ (г.) ⇌ 2 NH₃ (г.) — синтез аммиака по Габеру — Бошу, Kimyo 9 класс.
 *
 * Шесть шагов урока:
 *   1 «Исходные вещества»        — молекула N₂ с ТРОЙНОЙ связью (σ + 2π, 945 кДж/моль)
 *                                  и три молекулы H₂: видно, почему азот инертен;
 *   2 «Адсорбция на катализаторе» — фрагмент железа (ОЦК, a = 286,65 пм) с промоторами
 *                                  K₂O/Al₂O₃; молекулы садятся на поверхность, связь N≡N
 *                                  слабеет (3 → 1) и рвётся; две кривые Eₐ — с Fe и без;
 *   3 «Связи N–H по одной»        — на поверхности собираются NH → NH₂ → NH₃
 *                                  (общая пара электронов, связь полярная, δ− на азоте);
 *   4 «Десорбция»                 — молекула уходит с катализатора: тригональная пирамида,
 *                                  угол H–N–H 106,7°, неподелённая пара, μ = 1,47 D;
 *                                  железо остаётся прежним — катализатор не расходуется;
 *   5 «Равновесие»                — реакция обратимая: две стрелки ⇌, принцип Ле Шателье
 *                                  (p↑ смещает вправо, 4 моль → 2 моль; T↑ — влево);
 *   6 «Энергетический итог»       — лестница по связям: +945 +1307,4 −2346 = −93,6 кДж
 *                                  (табличное −91,8), аммиак → удобрения.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const NH3_STEP_IDS = [
  'reactants',
  'adsorption',
  'bonds',
  'desorption',
  'equilibrium',
  'energy',
] as const

export type Nh3StepId = (typeof NH3_STEP_IDS)[number]

export type Nh3Step = SceneStep<Nh3StepId>

const STEPS: readonly Nh3Step[] = [
  { id: 'reactants', from: 0, to: 4, wall: 4.8, ease: 'power1.inOut' },
  { id: 'adsorption', from: 4, to: 10, wall: 6.2, ease: 'sine.inOut' },
  { id: 'bonds', from: 10, to: 16, wall: 6.2, ease: 'sine.inOut' },
  { id: 'desorption', from: 16, to: 20, wall: 4.8, ease: 'power1.inOut' },
  { id: 'equilibrium', from: 20, to: 24, wall: 4.6, ease: 'power1.inOut' },
  { id: 'energy', from: 24, to: 28, wall: 4.6, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const NH3_FINISH: SceneFinish = { from: 28, to: 28.8, wall: 1.2, ease: 'power2.in' }

export type Nh3CueId =
  /** молекулы коснулись поверхности железа (адсорбция) */
  | 'adsorb'
  /** тройная связь N≡N разорвана — на поверхности два атома N */
  | 'split'
  /** образовалась первая связь N–H (частица NH) */
  | 'nh'
  /** вторая связь N–H (частица NH₂) */
  | 'nh2'
  /** третья связь N–H — молекула NH₃ собрана на поверхности */
  | 'nh3'
  /** аммиак покинул катализатор, видна пирамида и неподелённая пара */
  | 'desorb'
  /** показаны обе стрелки: реакция обратимая */
  | 'equilibrium'
  /** выделение теплоты: ΔH = −92 кДж на 2 моль NH₃ */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const NH3_TIMING = defineSceneTiming<Nh3StepId, Nh3CueId>({
  steps: STEPS,
  finish: NH3_FINISH,
  cues: [
    { at: 5.6, id: 'adsorb' },
    { at: 8.4, id: 'split' },
    { at: 11.6, id: 'nh' },
    { at: 13.4, id: 'nh2' },
    { at: 15.4, id: 'nh3' },
    { at: 17.4, id: 'desorb' },
    { at: 21.0, id: 'equilibrium' },
    { at: 24.6, id: 'exo' },
    { at: 28.2, id: 'embryo' },
    { at: 28.5, id: 'birth' },
    { at: NH3_FINISH.to, id: 'complete' },
  ],
})

export const NH3_STEPS = NH3_TIMING.steps
export const NH3_SEGMENTS = NH3_TIMING.segments
export const NH3_CUES = NH3_TIMING.cues
export const NH3_END = NH3_TIMING.end

export const nh3StepIndexAt = NH3_TIMING.stepIndexAt
export const nh3StepById = NH3_TIMING.stepById
export const nh3CueAt = NH3_TIMING.cueAt
