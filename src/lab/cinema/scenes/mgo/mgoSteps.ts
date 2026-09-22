import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * 2 Mg (тв.) + O₂ (г.) → 2 MgO (тв.) — ионная связь с ДВУМЯ электронами, Kimyo 7–8 класс.
 * Построена по рецепту эталона scenes/nacl.
 *
 * Чем урок отличается от NaCl (и ради чего он нужен):
 *   • атом отдаёт не один электрон, а ДВА: Mg⁰ − 2e⁻ → Mg²⁺;
 *   • второй электрон кислород принимает С ЗАТРАТОЙ энергии (EA₂ > 0) — отдельный шаг;
 *   • заряды ±2 против ±1: решётка намного прочнее, оксид тугоплавкий.
 *
 * Семь шагов урока (числа — только в ядре src/chemistry/data, здесь их нет):
 *   1 «Исходные вещества»   — фрагмент ГПУ-металла Mg (2×2×1 ячейки) и молекула O₂ (O=O, σ + π);
 *   2 «Поджиг»              — два атома Mg выходят из металла, остальной металл гаснет полностью;
 *                             связь O=O рвётся гомолитически; пламя — только в тексте урока;
 *   3 «Первый электрон»     — Mg → Mg⁺ в кадр УХОДА, O → O⁻ в кадр ПРИХОДА (EA₁ < 0);
 *   4 «Второй электрон»     — Mg⁺ → Mg²⁺ (слой 3s пуст — радиус Шеннона), O⁻ → O²⁻ (октет,
 *                             радиус Шеннона) — EA₂ > 0: электрон входит в уже отрицательный ион;
 *   5 «Притяжение»          — две газовые пары Mg²⁺O²⁻ на r_e газовой молекулы (полные сферы
 *                             Шеннона перекрываются — это честно и названо в note);
 *   6 «Решётка»             — фрагмент 2×2×2 ячейки (125 ионов), рёбра ячеек, КЧ 6:6;
 *   7 «Энергетический итог» — облёт решётки, лестница Борна — Габера, без огня внутри.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const MGO_STEP_IDS = ['reactants', 'ignition', 'transfer', 'second', 'attraction', 'lattice', 'energy'] as const

export type MgoStepId = (typeof MGO_STEP_IDS)[number]

export type MgoStep = SceneStep<MgoStepId>

/** Время сюжета (from/to) и экранные секунды (wall): каждый шаг 4–7 с, вся сцена 26–34 с. */
const STEPS: readonly MgoStep[] = [
  { id: 'reactants', from: 0, to: 4, wall: 4.2, ease: 'power1.inOut' },
  { id: 'ignition', from: 4, to: 8, wall: 4.8, ease: 'sine.inOut' },
  { id: 'transfer', from: 8, to: 11.5, wall: 4.4, ease: 'sine.inOut' },
  { id: 'second', from: 11.5, to: 15, wall: 4.6, ease: 'sine.inOut' },
  { id: 'attraction', from: 15, to: 18.5, wall: 4.2, ease: 'power1.inOut' },
  { id: 'lattice', from: 18.5, to: 24, wall: 5.2, ease: 'power1.inOut' },
  { id: 'energy', from: 24, to: 28, wall: 4.2, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const MGO_FINISH: SceneFinish = { from: 28, to: 28.8, wall: 1.2, ease: 'power2.in' }

export type MgoCueId =
  /** первый атом магния оторвался от металлической решётки (сублимация) */
  | 'sublimate'
  /** связь O=O разорвана гомолитически */
  | 'bondBreak'
  /** первые электроны пришли: O⁻ готовы */
  | 'firstElectron'
  /** вторые электроны пришли: обе пары Mg²⁺ / O²⁻ готовы */
  | 'transfer'
  /** газовые пары сошлись на r_e(MgO, г.) */
  | 'contact'
  /** фрагмент 2×2×2 собран, рёбра ячеек видны */
  | 'lattice'
  /** итог энергии: ΔH°f на экране (без огня — пламя только в тексте урока) */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

/**
 * Переходы электронов (время сюжета): leave — старт с оболочки Mg, arrive — приход к O.
 * e1/e2 — первые электроны пар (Mg → Mg⁺, O → O⁻), e3/e4 — вторые (Mg⁺ → Mg²⁺, O⁻ → O²⁻).
 * Донор меняет заряд в кадр leave, акцептор — в кадр arrive: пока e⁻ летит, Σq + (−1)·летящие = 0.
 */
export const MGO_ELECTRONS = {
  e1: { leave: 9.0, arrive: 10.0 },
  e2: { leave: 9.5, arrive: 10.5 },
  e3: { leave: 12.4, arrive: 13.4 },
  e4: { leave: 12.9, arrive: 13.9 },
} as const

/** Экранное появление электрона на оболочке донора до старта (lead), с сюжета. */
export const MGO_ELECTRON_LEAD = 0.6

export const MGO_TIMING = defineSceneTiming<MgoStepId, MgoCueId>({
  steps: STEPS,
  finish: MGO_FINISH,
  cues: [
    { at: 4.9, id: 'sublimate' },
    { at: 6.4, id: 'bondBreak' },
    { at: MGO_ELECTRONS.e2.arrive, id: 'firstElectron' },
    { at: MGO_ELECTRONS.e4.arrive, id: 'transfer' },
    { at: 17.4, id: 'contact' },
    { at: 22.8, id: 'lattice' },
    { at: 24.6, id: 'exo' },
    // Контракт лаборатории — строго в хвосте, после последнего шага.
    { at: 28.2, id: 'embryo' },
    { at: 28.5, id: 'birth' },
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
