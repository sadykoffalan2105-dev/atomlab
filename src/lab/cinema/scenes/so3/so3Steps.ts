import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * 2 SO₂ (г.) + O₂ (г.) ⇌ 2 SO₃ (г.) на катализаторе V₂O₅ — контактный способ, Kimyo 9 класс.
 *
 * Шесть шагов урока (числа — только в ядре src/chemistry/data, здесь их нет):
 *   1 «Исходные вещества»     — две уголковые молекулы SO₂ и молекула O₂ (триплет);
 *   2 «Обратимость»           — столкновение без катализатора: молекулы разлетаются;
 *                               ΔH реакции < 0 → по Ле Шателье нагрев мешает выходу;
 *   3 «Катализатор, стадия 1» — V₂O₅ + SO₂ → V₂O₄ + SO₃ (×2): SO₂ забирает атом O у катализатора;
 *   4 «Катализатор, стадия 2» — V₂O₄ + ½ O₂ → V₂O₅ (×2): O₂ рвётся на поверхности и
 *                               возвращает катализатору кислород — кислород «ходит» через ванадий;
 *   5 «Продукт»               — SO₃: плоский треугольник D₃h, три равные связи, μ = 0;
 *   6 «Конденсированный SO₃»  — тример S₃O₉ (γ-форма) рядом с молекулой; с водой — бурно (олеум).
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const SO3_STEP_IDS = ['reactants', 'equilibrium', 'catalyst', 'reoxidation', 'product', 'condensed'] as const

export type So3StepId = (typeof SO3_STEP_IDS)[number]

export type So3Step = SceneStep<So3StepId>

/** Время сюжета (from/to) и экранные секунды (wall): каждый шаг 4–7 с, вся сцена 26–34 с. */
const STEPS: readonly So3Step[] = [
  { id: 'reactants', from: 0, to: 4, wall: 4.6, ease: 'power1.inOut' },
  { id: 'equilibrium', from: 4, to: 9, wall: 5.2, ease: 'sine.inOut' },
  { id: 'catalyst', from: 9, to: 15, wall: 6.0, ease: 'sine.inOut' },
  { id: 'reoxidation', from: 15, to: 20.5, wall: 5.6, ease: 'sine.inOut' },
  { id: 'product', from: 20.5, to: 25, wall: 5.0, ease: 'power1.inOut' },
  { id: 'condensed', from: 25, to: 29.5, wall: 5.2, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const SO3_FINISH: SceneFinish = { from: 29.5, to: 30.3, wall: 1.2, ease: 'power2.in' }

export type So3CueId =
  /** SO₂ и O₂ столкнулись без катализатора и разлетаются */
  | 'collide'
  /** первая молекула SO₂ забрала атом O у катализатора: SO₃ + V₂O₄ */
  | 'transferA'
  /** вторая молекула SO₂ забрала атом O */
  | 'transferB'
  /** связь O=O разорвана на поверхности катализатора */
  | 'o2Break'
  /** атомы O из O₂ заняли освободившиеся места: V₂O₄ → V₂O₅ */
  | 'refillA'
  | 'refillB'
  /** SO₃ повёрнута: видно, что четыре атома в одной плоскости */
  | 'planar'
  /** тример S₃O₉ собран */
  | 'trimer'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

/**
 * Переходы атома кислорода (время сюжета). transfer — кадр, в который атом O катализатора
 * становится третьим лигандом серы: в этот же кадр S⁺⁴ → S⁺⁶ (формальная степень окисления),
 * материал атома O «каркас катализатора» → «молекула», подпись SO₂ → SO₃ и V₂O₅ → V₂O₄.
 * refill — кадр, в который атом O из O₂ садится в освободившееся место: V₂O₄ → V₂O₅.
 */
export const SO3_TRANSFERS = {
  a: { transfer: 12.2, refill: 17.9 },
  b: { transfer: 13.4, refill: 18.3 },
} as const

export const SO3_TIMING = defineSceneTiming<So3StepId, So3CueId>({
  steps: STEPS,
  finish: SO3_FINISH,
  cues: [
    { at: 6.2, id: 'collide' },
    { at: SO3_TRANSFERS.a.transfer, id: 'transferA' },
    { at: SO3_TRANSFERS.b.transfer, id: 'transferB' },
    { at: 17.0, id: 'o2Break' },
    { at: SO3_TRANSFERS.a.refill, id: 'refillA' },
    { at: SO3_TRANSFERS.b.refill, id: 'refillB' },
    { at: 22.2, id: 'planar' },
    { at: 26.6, id: 'trimer' },
    // Контракт лаборатории — строго в хвосте, после последнего шага.
    { at: 29.7, id: 'embryo' },
    { at: 30.0, id: 'birth' },
    { at: SO3_FINISH.to, id: 'complete' },
  ],
})

export const SO3_STEPS = SO3_TIMING.steps
export const SO3_SEGMENTS = SO3_TIMING.segments
export const SO3_CUES = SO3_TIMING.cues
export const SO3_END = SO3_TIMING.end

export const so3StepIndexAt = SO3_TIMING.stepIndexAt
export const so3StepById = SO3_TIMING.stepById
export const so3CueAt = SO3_TIMING.cueAt
