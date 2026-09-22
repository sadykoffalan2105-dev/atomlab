import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * 2 Na (тв.) + Cl₂ (г.) → 2 NaCl (тв.) — ионная связь, Kimyo 7–8 класс. ЭТАЛОН набора сцен.
 *
 * Шесть шагов урока (числа — только в ядре src/chemistry/data, здесь их нет):
 *   1 «Исходные вещества»       — ячейка металлического натрия (ОЦК) и молекула Cl₂;
 *   2 «Сублимация и диссоциация» — два атома Na выходят из металла, остальной металл
 *                                 гаснет полностью; связь Cl–Cl рвётся гомолитически;
 *   3 «Отдача и приём электрона» — 3s¹ натрия уходит к хлору; Na → Na⁺ в кадр УХОДА
 *                                 электрона, Cl → Cl⁻ — в кадр его ПРИХОДА;
 *   4 «Электростатическое притяжение» — две газовые пары Na⁺Cl⁻ на r_e газовой молекулы;
 *   5 «Кристаллическая решётка»  — фрагмент 2×2×2 ячейки (125 ионов), рёбра ячеек;
 *   6 «Энергетический итог»      — облёт решётки, лестница Борна — Габера, без огня.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const NACL_STEP_IDS = ['reactants', 'sublimation', 'transfer', 'attraction', 'lattice', 'energy'] as const

export type NaclStepId = (typeof NACL_STEP_IDS)[number]

export type NaclStep = SceneStep<NaclStepId>

/** Время сюжета (from/to) и экранные секунды (wall): каждый шаг 4–7 с, вся сцена 26–34 с. */
const STEPS: readonly NaclStep[] = [
  { id: 'reactants', from: 0, to: 4, wall: 4.8, ease: 'power1.inOut' },
  { id: 'sublimation', from: 4, to: 8, wall: 5.2, ease: 'sine.inOut' },
  { id: 'transfer', from: 8, to: 13, wall: 6.0, ease: 'sine.inOut' },
  { id: 'attraction', from: 13, to: 16.5, wall: 4.6, ease: 'power1.inOut' },
  { id: 'lattice', from: 16.5, to: 22, wall: 6.0, ease: 'power1.inOut' },
  { id: 'energy', from: 22, to: 26, wall: 5.0, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const NACL_FINISH: SceneFinish = { from: 26, to: 26.8, wall: 1.2, ease: 'power2.in' }

export type NaclCueId =
  /** первый атом натрия оторвался от металлической решётки (сублимация) */
  | 'sublimate'
  /** связь Cl–Cl разорвана гомолитически */
  | 'bondBreak'
  /** второй электрон пришёл к хлору: обе пары Na⁺ / Cl⁻ готовы */
  | 'transfer'
  /** газовые пары сошлись на r_e(NaCl, г.) */
  | 'contact'
  /** фрагмент 2×2×2 собран, рёбра ячеек видны */
  | 'lattice'
  /** итог энергии: ΔH°f на экране (без огня — огонь только в тексте урока) */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const NACL_TIMING = defineSceneTiming<NaclStepId, NaclCueId>({
  steps: STEPS,
  finish: NACL_FINISH,
  cues: [
    { at: 4.9, id: 'sublimate' },
    { at: 6.4, id: 'bondBreak' },
    { at: 11.6, id: 'transfer' },
    { at: 15.4, id: 'contact' },
    { at: 20.8, id: 'lattice' },
    { at: 22.6, id: 'exo' },
    // Контракт лаборатории — строго в хвосте, после последнего шага.
    { at: 26.2, id: 'embryo' },
    { at: 26.5, id: 'birth' },
    { at: NACL_FINISH.to, id: 'complete' },
  ],
})

/**
 * Переходы электронов (время сюжета): leave — старт с оболочки Na, arrive — приход к Cl.
 * В кадр leave Na становится Na⁺ (радиус, заряд, материал, подпись — octetSnap), в кадр arrive
 * Cl становится Cl⁻: пока e⁻ летит, сумма зарядов 0. Второй приход
 * совпадает с cue 'transfer'.
 */
export const NACL_ELECTRONS = {
  e1: { leave: 9.8, arrive: 10.9 },
  e2: { leave: 10.5, arrive: 11.6 },
} as const

export const NACL_STEPS = NACL_TIMING.steps
export const NACL_SEGMENTS = NACL_TIMING.segments
export const NACL_CUES = NACL_TIMING.cues
export const NACL_END = NACL_TIMING.end

export const naclStepIndexAt = NACL_TIMING.stepIndexAt
export const naclStepById = NACL_TIMING.stepById
export const naclCueAt = NACL_TIMING.cueAt
