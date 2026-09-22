import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * 2 KMnO₄ (тв.) + H₂SO₄ (конц.) → Mn₂O₇ (ж.) + K₂SO₄ + H₂O — уравнение учебника (Kimyo 9, марганец;
 * Kimyo 7 — высшая валентность VII). В концентрированной кислоте реально образуется KHSO₄ — это
 * сказано в тексте урока; сцена показывает запись учебника.
 *
 * Шесть шагов урока (числа — только в ядре src/chemistry/data, здесь их нет):
 *   1 «Исходные вещества»   — две формульные единицы KMnO₄ (K⁺ и тетраэдр MnO₄⁻, Mn +7, 3d⁰)
 *                             и молекула H₂SO₄;
 *   2 «Протонирование»      — H₂SO₄ отдаёт два протона вдоль водородных связей: 2 MnO₄⁻ → 2 HMnO₄,
 *                             H₂SO₄ → HSO₄⁻ → SO₄²⁻; два K⁺ уходят к сульфату (K₂SO₄);
 *   3 «Конденсация»         — две HMnO₄ отщепляют воду: протон OH одной молекулы уходит к OH
 *                             другой, тетраэдры сшиваются общей вершиной;
 *   4 «Молекула Mn₂O₇»      — O₃Mn–O–MnO₃: концевые и мостиковые связи, угол Mn–O–Mn;
 *   5 «Жидкость с дихроизмом» — капля вещества: красно-бурая на просвет, зелёная в отражённом свете;
 *   6 «Энергия и опасность» — лестница Гесса, разложение 2 Mn₂O₇ → 4 MnO₂ + 3 O₂, без огня.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const MN2O7_STEP_IDS = ['reactants', 'protonation', 'condensation', 'molecule', 'liquid', 'energy'] as const

export type Mn2o7StepId = (typeof MN2O7_STEP_IDS)[number]

export type Mn2o7Step = SceneStep<Mn2o7StepId>

/** Время сюжета (from/to) и экранные секунды (wall): каждый шаг 4–7 с, вся сцена 26–34 с. */
const STEPS: readonly Mn2o7Step[] = [
  { id: 'reactants', from: 0, to: 4, wall: 4.8, ease: 'power1.inOut' },
  { id: 'protonation', from: 4, to: 9.6, wall: 6.0, ease: 'sine.inOut' },
  { id: 'condensation', from: 9.6, to: 14.6, wall: 6.0, ease: 'sine.inOut' },
  { id: 'molecule', from: 14.6, to: 18.6, wall: 5.0, ease: 'power1.inOut' },
  { id: 'liquid', from: 18.6, to: 22.6, wall: 4.8, ease: 'power1.inOut' },
  { id: 'energy', from: 22.6, to: 26.6, wall: 5.0, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const MN2O7_FINISH: SceneFinish = { from: 26.6, to: 27.4, wall: 1.2, ease: 'power2.in' }

/**
 * Переходы протонов (время сюжета). Протон идёт вдоль водородной связи O–H···O за [leave, arrive];
 * hop — кадр, в который связь O–H переключается с донора на акцептор (протон проходит середину
 * мостика): в этот кадр меняются заряды групп и подписи. Свободного H⁺ в кадре не бывает —
 * протон всегда связан с одним из двух кислородов.
 *   p1 — H₂SO₄ → MnO₄⁻ (A), p2 — HSO₄⁻ → MnO₄⁻ (B), p3 — OH молекулы HMnO₄ (B) → OH молекулы A.
 */
export const MN2O7_PROTONS = {
  p1: { leave: 5.5, hop: 5.7, arrive: 5.9 },
  p2: { leave: 7.5, hop: 7.7, arrive: 7.9 },
  p3: { leave: 12.0, hop: 12.2, arrive: 12.4 },
} as const

export type Mn2o7CueId =
  /** первый протон перешёл: MnO₄⁻ → HMnO₄, H₂SO₄ → HSO₄⁻ */
  | 'protonate1'
  /** второй протон перешёл: HSO₄⁻ → SO₄²⁻ */
  | 'protonate2'
  /** два K⁺ встали у сульфата: K₂SO₄ */
  | 'sulfate'
  /** протон OH ушёл к соседней HMnO₄: отщепилась вода */
  | 'condense'
  /** тетраэдры сшиты общей вершиной: Mn₂O₇ */
  | 'bridge'
  /** капля жидкости на экране */
  | 'liquid'
  /** итог энергии и разложение (без огня) */
  | 'energy'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const MN2O7_TIMING = defineSceneTiming<Mn2o7StepId, Mn2o7CueId>({
  steps: STEPS,
  finish: MN2O7_FINISH,
  cues: [
    { at: MN2O7_PROTONS.p1.hop, id: 'protonate1' },
    { at: MN2O7_PROTONS.p2.hop, id: 'protonate2' },
    { at: 8.9, id: 'sulfate' },
    { at: MN2O7_PROTONS.p3.hop, id: 'condense' },
    { at: 13.7, id: 'bridge' },
    { at: 19.4, id: 'liquid' },
    { at: 23.2, id: 'energy' },
    // Контракт лаборатории — строго в хвосте, после последнего шага.
    { at: 26.8, id: 'embryo' },
    { at: 27.1, id: 'birth' },
    { at: MN2O7_FINISH.to, id: 'complete' },
  ],
})

export const MN2O7_STEPS = MN2O7_TIMING.steps
export const MN2O7_SEGMENTS = MN2O7_TIMING.segments
export const MN2O7_CUES = MN2O7_TIMING.cues
export const MN2O7_END = MN2O7_TIMING.end

export const mn2o7StepIndexAt = MN2O7_TIMING.stepIndexAt
export const mn2o7StepById = MN2O7_TIMING.stepById
export const mn2o7CueAt = MN2O7_TIMING.cueAt
