import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * 4 Al (тв.) + 3 O₂ (г.) → 2 Al₂O₃ (тв., корунд) — Kimyo 8 класс, горение алюминия.
 *
 * Шесть шагов урока (числа — только в ядре src/chemistry/data, здесь их нет):
 *   1 «Алюминий под плёнкой»   — фрагмент ГЦК-алюминия 2×2×1 с естественной АМОРФНОЙ плёнкой
 *                                Al₂O₃ в масштабе (толщина из ядра), три молекулы O₂ садятся
 *                                на плёнку и дальше не проходят;
 *   2 «Плёнка треснула»        — плёнка расходится и гаснет, четыре атома Al выходят из металла,
 *                                три связи O=O рвутся гомолитически (остальное гаснет до паузы);
 *   3 «Шесть электронов»       — каждый Al отдаёт три электрона, каждый O принимает два:
 *                                Al → Al⁺ → Al²⁺ → Al³⁺ в кадры УХОДА, O → O⁻ → O²⁻ в кадры ПРИХОДА;
 *   4 «Корунд»                 — фрагмент 2×2×1 гексагональных ячеек R-3c, рёбра ячеек;
 *   5 «Октаэдр AlO₆»           — координационные многогранники, две длины Al–O;
 *   6 «Энергетический итог»    — облёт решётки, лестница Борна — Габера, без огня.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const AL2O3_STEP_IDS = ['reactants', 'release', 'transfer', 'lattice', 'octahedron', 'energy'] as const

export type Al2o3StepId = (typeof AL2O3_STEP_IDS)[number]

export type Al2o3Step = SceneStep<Al2o3StepId>

/** Время сюжета (from/to) и экранные секунды (wall): каждый шаг 4–7 с, вся сцена 26–34 с. */
const STEPS: readonly Al2o3Step[] = [
  { id: 'reactants', from: 0, to: 4.5, wall: 5.0, ease: 'power1.inOut' },
  { id: 'release', from: 4.5, to: 9, wall: 5.2, ease: 'sine.inOut' },
  { id: 'transfer', from: 9, to: 14.5, wall: 6.4, ease: 'sine.inOut' },
  { id: 'lattice', from: 14.5, to: 20, wall: 5.8, ease: 'power1.inOut' },
  { id: 'octahedron', from: 20, to: 24, wall: 4.6, ease: 'power1.inOut' },
  { id: 'energy', from: 24, to: 28, wall: 4.8, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const AL2O3_FINISH: SceneFinish = { from: 28, to: 28.8, wall: 1.2, ease: 'power2.in' }

export type Al2o3CueId =
  /** молекулы O₂ легли на поверхность аморфной плёнки и остановились */
  | 'film'
  /** плёнка треснула (нагрев: металл под ней плавится и расширяется) */
  | 'crack'
  /** первый атом Al оторвался от металла */
  | 'sublimate'
  /** связи O=O разорваны гомолитически */
  | 'bondBreak'
  /** последний, двенадцатый электрон пришёл: 4 Al³⁺ и 6 O²⁻ */
  | 'transfer'
  /** фрагмент корунда собран, рёбра ячеек видны */
  | 'lattice'
  /** выделены октаэдр AlO₆ и тетраэдр OAl₄ */
  | 'octahedron'
  /** итог энергии: ΔH°f на экране (без огня — огонь только в тексте урока) */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const AL2O3_TIMING = defineSceneTiming<Al2o3StepId, Al2o3CueId>({
  steps: STEPS,
  finish: AL2O3_FINISH,
  cues: [
    { at: 3.0, id: 'film' },
    { at: 4.8, id: 'crack' },
    { at: 5.4, id: 'bondBreak' },
    { at: 5.9, id: 'sublimate' },
    { at: 13.75, id: 'transfer' },
    { at: 19.2, id: 'lattice' },
    { at: 21.4, id: 'octahedron' },
    { at: 24.6, id: 'exo' },
    // Контракт лаборатории — строго в хвосте, после последнего шага.
    { at: 28.2, id: 'embryo' },
    { at: 28.5, id: 'birth' },
    { at: AL2O3_FINISH.to, id: 'complete' },
  ],
})

/**
 * Двенадцать переходов электронов (время сюжета) — по шесть в каждой формульной единице Al₂O₃,
 * обе единицы синхронно. В единице g ∈ {A, B}: первый атом Al (Al g1) отдаёт три электрона
 * атомам O g1, O g2, O g3 (k = 0…2 — первые электроны кислорода, EA₁), затем второй атом
 * (Al g2) — тем же трём атомам (k = 3…5 — вторые электроны, EA₂ > 0).
 * leave — отрыв от Al: заряд донора +1 в тот же кадр; arrive — приход к O: заряд акцептора −1.
 * Последний приход совпадает с cue 'transfer'.
 */
export const AL2O3_ELECTRONS = [
  { leave: 9.9, arrive: 10.75 },
  { leave: 10.45, arrive: 11.3 },
  { leave: 11.0, arrive: 11.85 },
  { leave: 11.8, arrive: 12.65 },
  { leave: 12.35, arrive: 13.2 },
  { leave: 12.9, arrive: 13.75 },
] as const

/** За сколько секунд до отрыва электрон проявляется на оболочке донора (одна из его точек). */
export const AL2O3_ELECTRON_LEAD = 0.45

export const AL2O3_STEPS = AL2O3_TIMING.steps
export const AL2O3_SEGMENTS = AL2O3_TIMING.segments
export const AL2O3_CUES = AL2O3_TIMING.cues
export const AL2O3_END = AL2O3_TIMING.end

export const al2o3StepIndexAt = AL2O3_TIMING.stepIndexAt
export const al2o3StepById = AL2O3_TIMING.stepById
export const al2o3CueAt = AL2O3_TIMING.cueAt
