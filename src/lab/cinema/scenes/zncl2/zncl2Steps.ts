import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * Zn (тв.) + 2 HCl (р-р) → ZnCl₂ (р-р) + H₂ (г.)↑ — лабораторное получение водорода
 * (аппарат Киппа), Kimyo 8 класс.
 *
 * Сцена идёт В РАСТВОРЕ, поэтому в кадре не сухие молекулы, а гидратированные
 * частицы: соляная кислота диссоциирована нацело, протон существует как H₃O⁺,
 * а образовавшийся Zn²⁺ сразу одевается в аквакомплекс [Zn(H₂O)₆]²⁺.
 *
 * Шесть шагов урока:
 *   1 «Цинк в соляной кислоте»  — пластинка цинка (ГПУ, P6₃/mmc, КЧ 12)
 *                                 и раствор: H₃O⁺ и Cl⁻ плавают отдельно друг от друга;
 *   2 «Протон забирает электроны» — H₃O⁺ подходит к поверхности, два электрона
 *                                 текут ПО МЕТАЛЛУ к двум протонам: 2 H⁺ + 2e⁻ → 2 H;
 *   3 «Рождение молекулы H₂»     — два атома H на поверхности спариваются
 *                                 (связь 74,14 пм), пузырёк растёт и всплывает;
 *   4 «Цинк уходит в раствор»    — Zn²⁺ покидает решётку, 134 → 74 пм,
 *                                 и его окружают шесть молекул воды (Zn–O 208 пм);
 *   5 «Ионы-зрители и раствор»   — Cl⁻ не изменились; в стакане раствор ZnCl₂;
 *   6 «Энергия и техника безопасности» — цикл Гесса, ΔH = −153,9 кДж/моль,
 *                                 сбор водорода вытеснением воды.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const ZNCL2_STEP_IDS = ['acid', 'contact', 'hydrogen', 'dissolve', 'spectators', 'energy'] as const

export type Zncl2StepId = (typeof ZNCL2_STEP_IDS)[number]

export type Zncl2Step = SceneStep<Zncl2StepId>

const STEPS: readonly Zncl2Step[] = [
  { id: 'acid', from: 0, to: 4, wall: 4.6, ease: 'power1.inOut' },
  { id: 'contact', from: 4, to: 8.5, wall: 5.6, ease: 'sine.inOut' },
  { id: 'hydrogen', from: 8.5, to: 13, wall: 5.8, ease: 'sine.inOut' },
  { id: 'dissolve', from: 13, to: 17, wall: 5.2, ease: 'sine.inOut' },
  { id: 'spectators', from: 17, to: 21, wall: 5.0, ease: 'power1.inOut' },
  { id: 'energy', from: 21, to: 25, wall: 4.8, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const ZNCL2_FINISH: SceneFinish = { from: 25, to: 25.8, wall: 1.2, ease: 'power2.in' }

export type Zncl2CueId =
  /** кислота диссоциирована: в растворе только H₃O⁺ и Cl⁻ */
  | 'dissociation'
  /** ион H₃O⁺ подошёл к поверхности металла */
  | 'approach'
  /** два электрона пришли к протонам: 2 H⁺ + 2e⁻ → 2 H */
  | 'electrons'
  /** два атома H спарились в молекулу H₂ */
  | 'h2form'
  /** пузырёк водорода оторвался от пластинки и всплывает */
  | 'bubble'
  /** ион Zn²⁺ покинул металлическую решётку */
  | 'znLeave'
  /** аквакомплекс [Zn(H₂O)₆]²⁺ собран */
  | 'hydration'
  /** ионы Cl⁻ остались зрителями: в стакане раствор ZnCl₂ */
  | 'spectator'
  /** тепловой эффект: раствор нагрелся */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const ZNCL2_TIMING = defineSceneTiming<Zncl2StepId, Zncl2CueId>({
  steps: STEPS,
  finish: ZNCL2_FINISH,
  cues: [
    { at: 2.4, id: 'dissociation' },
    { at: 6.0, id: 'approach' },
    { at: 7.4, id: 'electrons' },
    { at: 10.4, id: 'h2form' },
    { at: 12.2, id: 'bubble' },
    { at: 14.0, id: 'znLeave' },
    { at: 16.4, id: 'hydration' },
    { at: 18.6, id: 'spectator' },
    { at: 21.6, id: 'exo' },
    { at: 25.2, id: 'embryo' },
    { at: 25.5, id: 'birth' },
    { at: ZNCL2_FINISH.to, id: 'complete' },
  ],
})

export const ZNCL2_STEPS = ZNCL2_TIMING.steps
export const ZNCL2_SEGMENTS = ZNCL2_TIMING.segments
export const ZNCL2_CUES = ZNCL2_TIMING.cues
export const ZNCL2_END = ZNCL2_TIMING.end

export const zncl2StepIndexAt = ZNCL2_TIMING.stepIndexAt
export const zncl2StepById = ZNCL2_TIMING.stepById
export const zncl2CueAt = ZNCL2_TIMING.cueAt
