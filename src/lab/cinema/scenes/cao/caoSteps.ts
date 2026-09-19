import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * CaCO₃ (тв.) → CaO (тв.) + CO₂ (г.) — обжиг известняка, Kimyo 8 класс.
 *
 * ЕДИНСТВЕННАЯ ЭНДОТЕРМИЧЕСКАЯ сцена набора: лестница энергии идёт ВВЕРХ
 * (+179,2 кДж/моль), и реакция идёт только в печи при 900…1000 °C, потому что
 * выделяется ГАЗ: ΔS° = +160,2 Дж/(моль·К), а ΔG = ΔH − TΔS обращается в ноль
 * около 1119 K (≈ 846 °C).
 *
 * Шесть шагов урока:
 *   1 «Кальцит»        — слоистая решётка CaCO₃: слои Ca²⁺ чередуются с плоскими
 *                        треугольниками CO₃²⁻ (R3̄c, a = 499 пм, c/6 = 284 пм);
 *   2 «Нагрев»         — температура = амплитуда колебаний узлов; она растёт
 *                        от 25 °C до 900 °C, лестница ползёт вверх;
 *   3 «Отрыв CO₂»      — связь C–O рвётся ГЕТЕРОЛИТИЧЕСКИ: пара остаётся на
 *                        кислороде, CO₃²⁻ → CO₂ (линейная, 180°) + O²⁻ (140 пм);
 *   4 «Решётка CaO»    — Ca²⁺ и O²⁻ перестраиваются в каменную соль Fm-3m,
 *                        a = 481,1 пм, d(Ca–O) = 240,5 пм, КЧ 6/6;
 *   5 «Дальше в классе» — гашение извести CaO + H₂O → Ca(OH)₂ (−64,5 кДж/моль)
 *                        и помутнение известковой воды Ca(OH)₂ + CO₂ → CaCO₃↓ + H₂O;
 *   6 «Энергия»        — цикл Гесса: +1207,6 − 393,5 − 634,9 = +179,2 кДж/моль,
 *                        зачем нужен сильный нагрев, цемент и металлургия.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const CAO_STEP_IDS = ['calcite', 'heating', 'release', 'rocksalt', 'classroom', 'energy'] as const

export type CaoStepId = (typeof CAO_STEP_IDS)[number]

export type CaoStep = SceneStep<CaoStepId>

const STEPS: readonly CaoStep[] = [
  { id: 'calcite', from: 0, to: 4.5, wall: 4.6, ease: 'power1.inOut' },
  { id: 'heating', from: 4.5, to: 9.5, wall: 5.2, ease: 'sine.inOut' },
  { id: 'release', from: 9.5, to: 15, wall: 6.0, ease: 'sine.inOut' },
  { id: 'rocksalt', from: 15, to: 20, wall: 5.4, ease: 'power1.inOut' },
  { id: 'classroom', from: 20, to: 25, wall: 5.2, ease: 'power1.inOut' },
  { id: 'energy', from: 25, to: 29, wall: 4.4, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const CAO_FINISH: SceneFinish = { from: 29, to: 29.8, wall: 1.0, ease: 'power2.in' }

export type CaoCueId =
  /** печь вышла на режим: решётка колеблется с максимальной амплитудой */
  | 'heat'
  /** связь C–O разорвана: карбонат распался на CO₂ и O²⁻ */
  | 'split'
  /** углекислый газ покинул кристалл */
  | 'escape'
  /** фрагмент решётки CaO собран */
  | 'rocksalt'
  /** гашение извести: экзотермический всплеск */
  | 'slake'
  /** известковая вода помутнела — выпал CaCO₃ */
  | 'limewater'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const CAO_TIMING = defineSceneTiming<CaoStepId, CaoCueId>({
  steps: STEPS,
  finish: CAO_FINISH,
  cues: [
    { at: 7.2, id: 'heat' },
    { at: 11.4, id: 'split' },
    { at: 13.2, id: 'escape' },
    { at: 18.8, id: 'rocksalt' },
    { at: 21.8, id: 'slake' },
    { at: 23.6, id: 'limewater' },
    { at: 29.2, id: 'embryo' },
    { at: 29.5, id: 'birth' },
    { at: CAO_FINISH.to, id: 'complete' },
  ],
})

export const CAO_STEPS = CAO_TIMING.steps
export const CAO_SEGMENTS = CAO_TIMING.segments
export const CAO_CUES = CAO_TIMING.cues
export const CAO_END = CAO_TIMING.end

export const caoStepIndexAt = CAO_TIMING.stepIndexAt
export const caoStepById = CAO_TIMING.stepById
export const caoCueAt = CAO_TIMING.cueAt
