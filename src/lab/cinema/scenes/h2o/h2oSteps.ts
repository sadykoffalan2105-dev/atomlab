import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * 2 H₂ (г.) + O₂ (г.) → 2 H₂O — разветвлённая цепная реакция, ковалентная полярная связь, лёд Ih.
 * Kimyo 7–8 класс. Сцена построена по рецепту эталона scenes/nacl.
 *
 * Семь шагов урока (числа — только в ядре src/chemistry/data, здесь их нет):
 *   1 «Гремучий газ»        — смесь 2 : 1: четыре молекулы H₂ и две O₂ (триплет, два неспаренных e⁻);
 *   2 «Искра: инициирование» — связь H–H одной молекулы рвётся гомолитически: 2 H·;
 *   3 «Разветвление цепи»   — H· + O₂ → ·OH + O(³P);  O(³P) + H₂ → ·OH + H·;
 *   4 «Продолжение цепи»    — ·OH + H₂ → H₂O + H· (дважды): рождается вода, радикалов стало три;
 *   5 «Молекула воды»       — r₀ O–H, ∠H–O–H, две неподелённые пары (схема sp³), δ+/δ−, μ;
 *   6 «Лёд Ih»              — фрагмент 2×2×1 ячейки, H по правилам льда, водородные связи пунктиром;
 *   7 «Энергетический итог» — облёт льда; лестница Гесса через атомы — расчётный путь, не стадии.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока. Все моменты — кратны 1/30 с (сетка дорожек раскадровки).
 */

export const H2O_STEP_IDS = ['reactants', 'spark', 'branching', 'propagation', 'molecule', 'ice', 'energy'] as const

export type H2oStepId = (typeof H2O_STEP_IDS)[number]

export type H2oStep = SceneStep<H2oStepId>

/** Время сюжета (from/to) и экранные секунды (wall): каждый шаг 4–7 с, вся сцена 26–34 с. */
const STEPS: readonly H2oStep[] = [
  { id: 'reactants', from: 0, to: 4, wall: 4.0, ease: 'power1.inOut' },
  { id: 'spark', from: 4, to: 8, wall: 4.2, ease: 'sine.inOut' },
  { id: 'branching', from: 8, to: 14, wall: 5.2, ease: 'sine.inOut' },
  { id: 'propagation', from: 14, to: 19.5, wall: 4.8, ease: 'sine.inOut' },
  { id: 'molecule', from: 19.5, to: 24, wall: 4.6, ease: 'power1.inOut' },
  { id: 'ice', from: 24, to: 30, wall: 5.0, ease: 'power1.inOut' },
  { id: 'energy', from: 30, to: 34, wall: 4.0, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const H2O_FINISH: SceneFinish = { from: 34, to: 34.8, wall: 1.2, ease: 'power2.in' }

/**
 * Элементарные события цепи (время сюжета). В кадр события СТУПЕНЬЮ меняются: связи (старая
 * рвётся, новая есть), число неспаренных электронов у атомов, материал и подписи частиц.
 *   init    — H₂ → 2 H· (искра);
 *   branchH — H· + O₂ → ·OH + O(³P);
 *   branchO — O(³P) + H₂ → ·OH + H·;
 *   propA   — ·OH + H₂ → H₂O + H· (молекула A);
 *   propB   — ·OH + H₂ → H₂O + H· (молекула B).
 * Их читают раскадровка, энергетика (время ступеней лестницы) и тест (кадр смены).
 */
export const H2O_EVENTS = {
  spark: 5.0,
  init: 5.8,
  branchH: 10.0,
  branchO: 12.2,
  propA: 16.0,
  propB: 17.2,
} as const

export type H2oEventId = keyof typeof H2O_EVENTS

export type H2oCueId =
  /** искра: подвод энергии к смеси (единственное свечение сцены, вне молекул) */
  | 'spark'
  /** инициирование: H₂ → 2 H· */
  | 'initiation'
  /** разветвление: H· + O₂ → ·OH + O(³P) */
  | 'branchH'
  /** разветвление: O(³P) + H₂ → ·OH + H· */
  | 'branchO'
  /** продолжение: ·OH + H₂ → H₂O + H· — первая молекула воды */
  | 'water'
  /** две неподелённые пары видны */
  | 'bent'
  /** фрагмент льда собран, водородные связи и рёбра ячеек видны */
  | 'ice'
  /** итог энергии на экране (без огня: пламя только в тексте урока) */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const H2O_TIMING = defineSceneTiming<H2oStepId, H2oCueId>({
  steps: STEPS,
  finish: H2O_FINISH,
  cues: [
    { at: H2O_EVENTS.spark, id: 'spark' },
    { at: H2O_EVENTS.init, id: 'initiation' },
    { at: H2O_EVENTS.branchH, id: 'branchH' },
    { at: H2O_EVENTS.branchO, id: 'branchO' },
    { at: H2O_EVENTS.propA, id: 'water' },
    { at: 21.2, id: 'bent' },
    { at: 28.6, id: 'ice' },
    { at: 30.6, id: 'exo' },
    // Контракт лаборатории — строго в хвосте, после последнего шага.
    { at: 34.2, id: 'embryo' },
    { at: 34.5, id: 'birth' },
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
