import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * Si (тв.) + O₂ (г.) → SiO₂ (тв.) — атомный (ковалентный) кристалл, полярная связь Si–O.
 * Kimyo 9 класс (кремний и его соединения), 7–8 класс (типы связи и решёток).
 *
 * Шесть шагов урока (числа — только в ядре src/chemistry/data, здесь их нет):
 *   1 «Исходные вещества»        — ячейка кремния (алмазоподобная, Fd-3m) и две молекулы O₂;
 *   2 «Кислород у поверхности»   — O₂ подходит к кремнию и распадается на атомы O(³P);
 *                                  медленность окисления из-за оксидной плёнки названа в тексте;
 *   3 «Четыре связи Si–O»        — атом O встраивается в каждую из четырёх связей Si–Si:
 *                                  Si–Si + O → Si–O–Si (мостиковый кислород);
 *   4 «Тетраэдр SiO₄»            — тетраэдр, общие вершины, сравнение с CO₂ по энергиям связей;
 *   5 «Каркас α-кварца»          — фрагмент 2×2×2 ячейки, рёбра ячеек, спиральная цепочка;
 *   6 «Энергетический итог»      — облёт каркаса, лестница Гесса, выделенный тетраэдр, без огня.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const SIO2_STEP_IDS = ['reactants', 'surface', 'insertion', 'tetrahedra', 'quartz', 'energy'] as const

export type Sio2StepId = (typeof SIO2_STEP_IDS)[number]

export type Sio2Step = SceneStep<Sio2StepId>

/** Время сюжета (from/to) и экранные секунды (wall): каждый шаг 4–7 с, вся сцена 26–34 с. */
const STEPS: readonly Sio2Step[] = [
  { id: 'reactants', from: 0, to: 4, wall: 4.8, ease: 'power1.inOut' },
  { id: 'surface', from: 4, to: 9, wall: 5.4, ease: 'sine.inOut' },
  { id: 'insertion', from: 9, to: 14, wall: 5.8, ease: 'sine.inOut' },
  { id: 'tetrahedra', from: 14, to: 18.5, wall: 5.2, ease: 'power1.inOut' },
  { id: 'quartz', from: 18.5, to: 24, wall: 5.8, ease: 'power1.inOut' },
  { id: 'energy', from: 24, to: 28.5, wall: 4.8, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const SIO2_FINISH: SceneFinish = { from: 28.5, to: 29.3, wall: 1.2, ease: 'power2.in' }

export type Sio2CueId =
  /** обе молекулы O₂ подошли к поверхности кремния */
  | 'adsorb'
  /** вторая связь O=O разорвана: у поверхности четыре атома O(³P) */
  | 'dissociate'
  /** четвёртый атом O встроился: у Si четыре σ-связи Si–O */
  | 'insert'
  /** тетраэдр SiO₄ и его общие вершины показаны */
  | 'tetra'
  /** фрагмент α-кварца собран, рёбра ячеек видны */
  | 'quartz'
  /** итог энергии: ΔH°f на экране (без огня) */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

/**
 * Встраивание кислорода в связи Si–Si (время сюжета): в момент at атом O k-й связи
 * становится мостиковым — материал, валентные точки (6 → 4) и подпись O → Oᵟ⁻ меняются
 * в этот кадр, связь Si–Si k гаснет, две связи Si–O k появляются. Порядок = порядок связей
 * центрального атома Si в раскадровке.
 */
export const SIO2_INSERTIONS = [
  { at: 9.8 },
  { at: 10.6 },
  { at: 11.4 },
  { at: 12.2 },
] as const

/** Разрыв O=O (гомолиз): молекула A, молекула B. */
export const SIO2_BREAKS = { a: 6.4, b: 6.9 } as const

export const SIO2_TIMING = defineSceneTiming<Sio2StepId, Sio2CueId>({
  steps: STEPS,
  finish: SIO2_FINISH,
  cues: [
    { at: 6.2, id: 'adsorb' },
    { at: SIO2_BREAKS.b, id: 'dissociate' },
    { at: 12.7, id: 'insert' },
    { at: 15.6, id: 'tetra' },
    { at: 23.0, id: 'quartz' },
    { at: 24.6, id: 'exo' },
    // Контракт лаборатории — строго в хвосте, после последнего шага.
    { at: 28.7, id: 'embryo' },
    { at: 29.0, id: 'birth' },
    { at: SIO2_FINISH.to, id: 'complete' },
  ],
})

export const SIO2_STEPS = SIO2_TIMING.steps
export const SIO2_SEGMENTS = SIO2_TIMING.segments
export const SIO2_CUES = SIO2_TIMING.cues
export const SIO2_END = SIO2_TIMING.end

export const sio2StepIndexAt = SIO2_TIMING.stepIndexAt
export const sio2StepById = SIO2_TIMING.stepById
export const sio2CueAt = SIO2_TIMING.cueAt
