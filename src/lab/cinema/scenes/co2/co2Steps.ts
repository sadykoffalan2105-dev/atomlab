import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * C (графит) + O₂ (г.) → CO₂ (г.) — горение угля, ковалентная полярная связь, Kimyo 7–8 класс.
 *
 * Шесть шагов урока (числа — только в ядре src/chemistry/data, здесь их нет):
 *   1 «Графит и кислород»        — два слоя графита из crystalData (P6₃/mmc) с ячейкой и молекула O₂;
 *   2 «Кислород садится на край» — O₂ хемосорбируется на двух краевых атомах слоя: связь O=O
 *                                  рвётся ТОЛЬКО одновременно с образованием двух связей C–O
 *                                  (поверхностные комплексы C(O)); свободных атомов O нет;
 *   3 «С края уходит CO»         — связи C–C краевого атома рвутся, C(O) десорбируется молекулой CO
 *                                  (C≡O); свободного атома C (г.) в горении графита НЕТ;
 *   4 «CO + ·OH → CO₂ + H·»      — сухой CO почти не горит: дожигание идёт через радикал ·OH;
 *   5 «Строение CO₂»             — D∞h, 180°, две σ + две π в перпендикулярных плоскостях,
 *                                  связи полярны, молекула — нет (векторы гасятся);
 *   6 «Сухой лёд»                — молекулярная решётка Pa-3: центральная молекула и 12 соседей.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const CO2_STEP_IDS = ['reactants', 'chemisorption', 'desorption', 'oxidation', 'structure', 'solid'] as const

export type Co2StepId = (typeof CO2_STEP_IDS)[number]

export type Co2Step = SceneStep<Co2StepId>

/** Время сюжета (from/to) и экранные секунды (wall): каждый шаг 4–7 с, вся сцена 26–34 с. */
const STEPS: readonly Co2Step[] = [
  { id: 'reactants', from: 0, to: 4, wall: 4.6, ease: 'power1.inOut' },
  { id: 'chemisorption', from: 4, to: 8.5, wall: 5.2, ease: 'sine.inOut' },
  { id: 'desorption', from: 8.5, to: 13, wall: 5.2, ease: 'sine.inOut' },
  { id: 'oxidation', from: 13, to: 17.5, wall: 5.4, ease: 'sine.inOut' },
  { id: 'structure', from: 17.5, to: 21.5, wall: 4.8, ease: 'power1.inOut' },
  { id: 'solid', from: 21.5, to: 26.5, wall: 5.6, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const CO2_FINISH: SceneFinish = { from: 26.5, to: 27.3, wall: 1.2, ease: 'power2.in' }

export type Co2CueId =
  /** O=O разорвана на поверхности: два комплекса C(O) на краю слоя */
  | 'adsorb'
  /** связи C–C краевого атома разорваны: молекула CO ушла с края */
  | 'desorb'
  /** CO + ·OH → CO₂ + H·: вторая связь C=O замкнулась, H· ушёл */
  | 'oxidize'
  /** показаны частичные заряды и векторы диполей связей */
  | 'polarity'
  /** молекулярная решётка сухого льда собрана, рёбра ячейки видны */
  | 'crystal'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const CO2_TIMING = defineSceneTiming<Co2StepId, Co2CueId>({
  steps: STEPS,
  finish: CO2_FINISH,
  cues: [
    { at: 6.8, id: 'adsorb' },
    { at: 10.2, id: 'desorb' },
    { at: 15.2, id: 'oxidize' },
    { at: 19.8, id: 'polarity' },
    { at: 24.8, id: 'crystal' },
    // Контракт лаборатории — строго в хвосте, после последнего шага.
    { at: 26.7, id: 'embryo' },
    { at: 27.0, id: 'birth' },
    { at: CO2_FINISH.to, id: 'complete' },
  ],
})

/**
 * Стадии механизма (время сюжета): start — начало натяжения рвущейся связи,
 * at — кадр события (совпадает с cue). Их читают раскадровка, энергетика и тест:
 *   adsorb  — O₂ + 2 C(край) → 2 C(O): O=O рвётся в кадр at, C–O замкнуты к этому кадру;
 *   desorb  — C(O) → CO (г.): две связи C–C краевого атома рвутся в кадр at;
 *   oxidize — CO + ·OH → CO₂ + H·: O–H рвётся и C–O замыкается в кадр at.
 */
export const CO2_STAGES = {
  adsorb: { start: 5.6, at: 6.8 },
  desorb: { start: 9.0, at: 10.2 },
  oxidize: { start: 14.4, at: 15.2 },
} as const

export const CO2_STEPS = CO2_TIMING.steps
export const CO2_SEGMENTS = CO2_TIMING.segments
export const CO2_CUES = CO2_TIMING.cues
export const CO2_END = CO2_TIMING.end

export const co2StepIndexAt = CO2_TIMING.stepIndexAt
export const co2StepById = CO2_TIMING.stepById
export const co2CueAt = CO2_TIMING.cueAt
