import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * 2 H₂ (г.) + O₂ (г.) → 2 H₂O (г.) — ковалентная полярная связь, Kimyo 7–8 класс.
 *
 * Шесть шагов урока:
 *   1 «Гремучий газ»       — ДВЕ молекулы H₂ и одна O₂ с настоящими длинами связей
 *                            (H–H 74,14 пм, O=O 120,8 пм); смесь 2 : 1 по объёму;
 *   2 «Искра»              — связи натягиваются и рвутся ГОМОЛИТИЧЕСКИ, на это
 *                            уходит 2·436 + 498 = +1370 кДж (лестница идёт вверх);
 *   3 «Новые связи»        — радикалы перестраиваются, каждый O берёт два H;
 *                            общая пара смещена к кислороду (ЭО 3,44 против 2,20);
 *   4 «Уголковая молекула» — угол H–O–H 104,45°, O–H 95,8 пм, ДВЕ неподелённые пары;
 *   5 «Полярность»         — δ− на кислороде, δ+ на водородах, μ = 1,85 D,
 *                            водородная связь H···O 185 пм со второй молекулой;
 *   6 «Энергия»            — экзотермический итог: −241,8 кДж/моль (пар),
 *                            −285,8 кДж/моль (жидкость), пламя водорода.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const H2O_STEP_IDS = ['reactants', 'spark', 'bonds', 'molecule', 'polarity', 'energy'] as const

export type H2oStepId = (typeof H2O_STEP_IDS)[number]

export type H2oStep = SceneStep<H2oStepId>

const STEPS: readonly H2oStep[] = [
  { id: 'reactants', from: 0, to: 4, wall: 4.6, ease: 'power1.inOut' },
  { id: 'spark', from: 4, to: 8.5, wall: 5.4, ease: 'sine.inOut' },
  { id: 'bonds', from: 8.5, to: 14, wall: 6.6, ease: 'sine.inOut' },
  { id: 'molecule', from: 14, to: 18, wall: 4.6, ease: 'power1.inOut' },
  { id: 'polarity', from: 18, to: 22.5, wall: 5.4, ease: 'power1.inOut' },
  { id: 'energy', from: 22.5, to: 26.5, wall: 4.8, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const H2O_FINISH: SceneFinish = { from: 26.5, to: 27.3, wall: 1.2, ease: 'power2.in' }

export type H2oCueId =
  /** искра поджига: смесь 2 H₂ : 1 O₂ получает энергию активации */
  | 'spark'
  /** все связи H–H и O=O разорваны гомолитически — в кадре радикалы H· и O· */
  | 'bondBreak'
  /** общие электронные пары образовали четыре связи O–H */
  | 'pair'
  /** молекула приняла уголковую форму, видны две неподелённые пары */
  | 'bent'
  /** между двумя молекулами воды протянулась водородная связь */
  | 'hbond'
  /** пик выделения энергии: пламя горящего водорода */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const H2O_TIMING = defineSceneTiming<H2oStepId, H2oCueId>({
  steps: STEPS,
  finish: H2O_FINISH,
  cues: [
    { at: 5.4, id: 'spark' },
    { at: 7.2, id: 'bondBreak' },
    { at: 11.8, id: 'pair' },
    { at: 15.2, id: 'bent' },
    { at: 20.4, id: 'hbond' },
    { at: 23.4, id: 'exo' },
    { at: 26.7, id: 'embryo' },
    { at: 27.0, id: 'birth' },
    { at: H2O_FINISH.to, id: 'complete' },
  ],
})

export const H2O_STEPS = H2O_TIMING.steps
export const H2O_SEGMENTS = H2O_TIMING.segments
export const H2O_CUES = H2O_TIMING.cues
export const H2O_END = H2O_TIMING.end

export const h2oStepIndexAt = H2O_TIMING.stepIndexAt
export const h2oStepById = H2O_TIMING.stepById
export const h2oCueAt = H2O_TIMING.cueAt
