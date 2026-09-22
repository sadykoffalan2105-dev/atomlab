import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * 2 Pb (тв.) + O₂ (г.) → 2 PbO (тв.) — оксид свинца(II), Kimyo 9 класс (свинец и его соединения).
 * Сцена построена по рецепту эталона scenes/nacl.
 *
 * Шесть шагов урока (числа — только в ядре src/chemistry/data, здесь их нет):
 *   1 «Исходные вещества»        — ячейка ГЦК свинца (Fm-3m) и молекула O₂ с двойной связью;
 *   2 «Сублимация и диссоциация» — два атома Pb выходят из металла, остальной металл гаснет
 *                                  полностью; связь O=O рвётся гомолитически;
 *   3 «Два электрона»            — у каждого Pb уходят два 6p-электрона, пара 6s² остаётся;
 *                                  O принимает два электрона (второй — с затратой энергии);
 *   4 «Массикот»                 — выше температуры перехода первым кристаллизуется жёлтый β-PbO (Pbcm);
 *   5 «Глёт»                     — при медленном охлаждении — красный α-PbO (P4/nmm): слои,
 *                                  пирамида PbO₄, пары 6s² смотрят в щель между слоями;
 *   6 «Энергетический итог»      — облёт глёта, формальная лестница Борна — Габера, без огня.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const PBO_STEP_IDS = ['reactants', 'sublimation', 'transfer', 'massicot', 'litharge', 'energy'] as const

export type PboStepId = (typeof PBO_STEP_IDS)[number]

export type PboStep = SceneStep<PboStepId>

/** Время сюжета (from/to) и экранные секунды (wall): каждый шаг 4–7 с, вся сцена 26–34 с. */
const STEPS: readonly PboStep[] = [
  { id: 'reactants', from: 0, to: 4, wall: 4.8, ease: 'power1.inOut' },
  { id: 'sublimation', from: 4, to: 8, wall: 5.2, ease: 'sine.inOut' },
  { id: 'transfer', from: 8, to: 13.5, wall: 6.2, ease: 'sine.inOut' },
  { id: 'massicot', from: 13.5, to: 17.5, wall: 5.2, ease: 'power1.inOut' },
  { id: 'litharge', from: 17.5, to: 23, wall: 6.2, ease: 'power1.inOut' },
  { id: 'energy', from: 23, to: 27, wall: 5.0, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const PBO_FINISH: SceneFinish = { from: 27, to: 27.8, wall: 1.2, ease: 'power2.in' }

export type PboCueId =
  /** первый атом свинца оторвался от металлической решётки (сублимация) */
  | 'sublimate'
  /** связь O=O разорвана гомолитически */
  | 'bondBreak'
  /** последний электрон пришёл к кислороду: обе пары Pb²⁺ / O²⁻ готовы */
  | 'transfer'
  /** фрагмент массикота 2×2×2 собран */
  | 'massicot'
  /** фрагмент глёта 2×2×2 собран, рёбра ячеек видны */
  | 'lattice'
  /** итог энергии: ΔH°f на экране (без огня) */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const PBO_TIMING = defineSceneTiming<PboStepId, PboCueId>({
  steps: STEPS,
  finish: PBO_FINISH,
  cues: [
    { at: 4.9, id: 'sublimate' },
    { at: 6.4, id: 'bondBreak' },
    { at: 11.9, id: 'transfer' },
    { at: 16.4, id: 'massicot' },
    { at: 21.6, id: 'lattice' },
    { at: 23.6, id: 'exo' },
    // Контракт лаборатории — строго в хвосте, после последнего шага.
    { at: 27.2, id: 'embryo' },
    { at: 27.5, id: 'birth' },
    { at: PBO_FINISH.to, id: 'complete' },
  ],
})

/**
 * Переходы электронов (время сюжета): leave — старт с оболочки Pb, arrive — приход к O.
 * У каждой пары два электрона: первый (e1 / e3) — ступени IE₁ и EA₁, второй (e2 / e4) — IE₂ и EA₂.
 * Заряд донора растёт ступенью в кадр УХОДА (Pb → Pb⁺ → Pb²⁺), заряд акцептора — в кадр ПРИХОДА
 * (O → O⁻ → O²⁻): пока e⁻ летит, сумма зарядов с летящими электронами 0. Последний приход
 * совпадает с cue 'transfer'.
 */
export const PBO_ELECTRONS = {
  /** пара 1 (pb1 → oA), первый электрон */
  e1: { leave: 9.0, arrive: 10.0 },
  /** пара 1, второй электрон */
  e2: { leave: 10.4, arrive: 11.4 },
  /** пара 2 (pb2 → oB), первый электрон */
  e3: { leave: 9.4, arrive: 10.4 },
  /** пара 2, второй электрон */
  e4: { leave: 10.9, arrive: 11.9 },
} as const

export const PBO_STEPS = PBO_TIMING.steps
export const PBO_SEGMENTS = PBO_TIMING.segments
export const PBO_CUES = PBO_TIMING.cues
export const PBO_END = PBO_TIMING.end

export const pboStepIndexAt = PBO_TIMING.stepIndexAt
export const pboStepById = PBO_TIMING.stepById
export const pboCueAt = PBO_TIMING.cueAt
