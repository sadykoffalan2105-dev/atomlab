import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * S (тв., ромбическая) + O₂ (г.) → SO₂ (г.) — ковалентная полярная связь,
 * уголковая молекула и неподелённая пара. Kimyo 8–9 класс.
 *
 * Шесть шагов урока:
 *   1 «Сера и кислород»      — корона S₈ (d(S–S) = 205,5 пм, ∠S–S–S = 108°)
 *                              и МОЛЕКУЛА O₂ (d(O=O) из bondData); сера горит синим пламенем;
 *   2 «Кольцо раскрывается»  — у крайнего атома рвутся ДВЕ связи S–S, и он уходит из короны;
 *                              стадия эндотермическая, +277,2 кДж на моль атомов S — это
 *                              СРЕДНЯЯ атомизация ΔH°f(S, г.): в короне 8 атомов и 8 связей,
 *                              то есть в среднем одна связь S–S на вынесенный атом;
 *   3 «Первая связь S=O»     — O=O рвётся гомолитически (+498,4 на моль O₂),
 *                              атом серы и атом кислорода делят электронную пару;
 *   4 «Вторая связь и угол»  — вторая связь S=O, молекула сгибается до 119,5°:
 *                              неподелённая пара серы сжимает угол (CO₂ — 180°),
 *                              π-плотность делокализована — обе связи одинаковы;
 *   5 «Свойства SO₂»         — растворение в воде (H₂SO₃, кислотные дожди)
 *                              и окисление до SO₃ на V₂O₅;
 *   6 «Энергетический итог»  — лестница: +277,2 + 498,4 − 1072,4 = −296,8 кДж/моль.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const SO2_STEP_IDS = ['reactants', 'ring', 'firstBond', 'bend', 'properties', 'energy'] as const

export type So2StepId = (typeof SO2_STEP_IDS)[number]

export type So2Step = SceneStep<So2StepId>

const STEPS: readonly So2Step[] = [
  { id: 'reactants', from: 0, to: 4.2, wall: 4.8, ease: 'power1.inOut' },
  { id: 'ring', from: 4.2, to: 8.2, wall: 5.0, ease: 'sine.inOut' },
  { id: 'firstBond', from: 8.2, to: 12.8, wall: 5.8, ease: 'sine.inOut' },
  { id: 'bend', from: 12.8, to: 17.2, wall: 5.2, ease: 'sine.inOut' },
  { id: 'properties', from: 17.2, to: 22.6, wall: 6.2, ease: 'power1.inOut' },
  { id: 'energy', from: 22.6, to: 26, wall: 4.4, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const SO2_FINISH: SceneFinish = { from: 26, to: 26.8, wall: 1.2, ease: 'power2.in' }

export type So2CueId =
  /** сера горит синим пламенем — знакомство с веществом */
  | 'flame'
  /** в короне S₈ разорвана первая связь S–S — кольцо стало цепочкой */
  | 'ringOpen'
  /** разорвана вторая связь S–S: атом серы оторвался от цепочки */
  | 'sFree'
  /** связь O=O разорвана гомолитически: два атома кислорода */
  | 'o2Break'
  /** образовалась первая связь S=O (общая электронная пара) */
  | 'bond1'
  /** образовалась вторая связь S=O */
  | 'bond2'
  /** молекула приняла уголковую форму, O–S–O = 119,5° */
  | 'bent'
  /** π-плотность делокализовалась: обе связи одинаковы, порядок ≈ 1,5 */
  | 'resonance'
  /** SO₂ растворяется в воде: H₂SO₃, кислотные дожди */
  | 'acidRain'
  /** каталитическое окисление 2 SO₂ + O₂ ⇌ 2 SO₃ на V₂O₅ */
  | 'so3'
  /** пик выделения энергии: −296,8 кДж/моль */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const SO2_TIMING = defineSceneTiming<So2StepId, So2CueId>({
  steps: STEPS,
  finish: SO2_FINISH,
  cues: [
    { at: 2.4, id: 'flame' },
    { at: 5.2, id: 'ringOpen' },
    { at: 7.4, id: 'sFree' },
    { at: 9.9, id: 'o2Break' },
    { at: 11.4, id: 'bond1' },
    { at: 14.4, id: 'bond2' },
    { at: 15.8, id: 'bent' },
    { at: 16.6, id: 'resonance' },
    { at: 18.6, id: 'acidRain' },
    { at: 20.8, id: 'so3' },
    { at: 23.4, id: 'exo' },
    { at: 25.4, id: 'embryo' },
    { at: 25.8, id: 'birth' },
    { at: SO2_FINISH.to, id: 'complete' },
  ],
})

export const SO2_STEPS = SO2_TIMING.steps
export const SO2_SEGMENTS = SO2_TIMING.segments
export const SO2_CUES = SO2_TIMING.cues
export const SO2_END = SO2_TIMING.end

export const so2StepIndexAt = SO2_TIMING.stepIndexAt
export const so2StepById = SO2_TIMING.stepById
export const so2CueAt = SO2_TIMING.cueAt
