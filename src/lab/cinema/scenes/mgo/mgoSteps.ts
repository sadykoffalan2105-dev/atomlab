import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * 2 Mg (тв.) + O₂ (г.) → 2 MgO (тв.) — ионная связь с ДВУМЯ электронами, Kimyo 7–8 класс.
 *
 * Чем этот урок отличается от NaCl (и ради чего он нужен):
 *   • атом отдаёт не один электрон, а ДВА: Mg⁰ − 2e⁻ → Mg²⁺;
 *   • второй электрон кислород принимает С ЗАТРАТОЙ энергии (EA₂ > 0) —
 *     ключевой момент, которого нет в хлориде натрия;
 *   • заряды ±2 против ±1 дают вчетверо большее притяжение, отсюда
 *     энергия решётки −3789 против −787 кДж/моль и t_пл 2852 против 801 °C.
 *
 * Шесть шагов урока:
 *   1 «Исходные вещества»      — лента металлического магния (ГПУ, КЧ 12)
 *                                и МОЛЕКУЛА кислорода O₂ с двойной связью;
 *   2 «Поджиг»                 — ослепительно-белое пламя, атом Mg выходит из
 *                                металла (+147,1), связь O=O рвётся (+249,2 на ½O₂);
 *   3 «Два электрона»          — IE₁ +737,7 и IE₂ +1450,7 уходят с магния,
 *                                кислород принимает: EA₁ −141, EA₂ +744 (затрата!);
 *                                радиусы 160 → 72 пм и 66 → 140 пм;
 *   4 «Притяжение вчетверо»    — ионы сходятся на 210,6 пм, закон Кулона с q = ±2;
 *   5 «Решётка и тугоплавкость» — фрагмент 4×4×4 каменной соли, КЧ 6, U = −3789;
 *   6 «Энергетический итог»    — лестница Борна — Габера, ΔH°f ≈ −601 кДж/моль.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const MGO_STEP_IDS = ['reactants', 'ignition', 'transfer', 'attraction', 'lattice', 'energy'] as const

export type MgoStepId = (typeof MGO_STEP_IDS)[number]

export type MgoStep = SceneStep<MgoStepId>

const STEPS: readonly MgoStep[] = [
  { id: 'reactants', from: 0, to: 4, wall: 4.6, ease: 'power1.inOut' },
  { id: 'ignition', from: 4, to: 8, wall: 5.4, ease: 'sine.inOut' },
  { id: 'transfer', from: 8, to: 13.5, wall: 6.8, ease: 'sine.inOut' },
  { id: 'attraction', from: 13.5, to: 16.5, wall: 3.8, ease: 'power1.inOut' },
  { id: 'lattice', from: 16.5, to: 21.5, wall: 6.4, ease: 'power1.inOut' },
  { id: 'energy', from: 21.5, to: 25.5, wall: 4.6, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const MGO_FINISH: SceneFinish = { from: 25.5, to: 26.3, wall: 1.2, ease: 'power2.in' }

export type MgoCueId =
  /** атом магния оторвался от металлической решётки (сублимация) */
  | 'sublimate'
  /** поджиг: ослепительно-белая вспышка горящего магния */
  | 'ignite'
  /** связь O=O разорвана гомолитически */
  | 'bondBreak'
  /** оба электрона пришли к кислороду: есть Mg²⁺ и O²⁻ */
  | 'transfer'
  /** ионы соприкоснулись — первая ионная пара, d = 210,6 пм */
  | 'contact'
  /** фрагмент решётки 4×4×4 собран */
  | 'lattice'
  /** пик выделения энергии */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const MGO_TIMING = defineSceneTiming<MgoStepId, MgoCueId>({
  steps: STEPS,
  finish: MGO_FINISH,
  cues: [
    { at: 5.0, id: 'sublimate' },
    { at: 6.2, id: 'ignite' },
    { at: 7.0, id: 'bondBreak' },
    { at: 11.9, id: 'transfer' },
    { at: 15.9, id: 'contact' },
    { at: 21.1, id: 'lattice' },
    { at: 22.2, id: 'exo' },
    { at: 25.7, id: 'embryo' },
    { at: 26.0, id: 'birth' },
    { at: MGO_FINISH.to, id: 'complete' },
  ],
})

export const MGO_STEPS = MGO_TIMING.steps
export const MGO_SEGMENTS = MGO_TIMING.segments
export const MGO_CUES = MGO_TIMING.cues
export const MGO_END = MGO_TIMING.end

export const mgoStepIndexAt = MGO_TIMING.stepIndexAt
export const mgoStepById = MGO_TIMING.stepById
export const mgoCueAt = MGO_TIMING.cueAt
