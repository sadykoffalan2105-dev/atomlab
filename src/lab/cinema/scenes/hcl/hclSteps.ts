import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * H₂ (г.) + Cl₂ (г.) → 2 HCl (г.) — ЦЕПНАЯ РАДИКАЛЬНАЯ реакция, Kimyo 8 класс.
 *
 * Шесть шагов урока:
 *   1 «Смесь в темноте»       — молекулы H₂ и Cl₂ летают рядом и НЕ реагируют:
 *                               связь Cl–Cl (243 кДж/моль) сама не рвётся;
 *   2 «Квант света»           — hν рвёт Cl₂ ГОМОЛИТИЧЕСКИ на два радикала Cl•
 *                               (λ ≤ 492 нм — синий и фиолетовый свет);
 *   3 «Первое звено цепи»     — Cl• + H₂ → HCl + H•, ΔH = +4 кДж/моль;
 *                               рождается первая полярная молекула HCl;
 *   4 «Второе звено и цепь»   — H• + Cl₂ → HCl + Cl•, ΔH = −189 кДж/моль;
 *                               радикал Cl• восстановился — цепь пошла по кругу;
 *   5 «Обрыв цепи»            — Cl• + Cl• → Cl₂ (или радикал гибнет на стенке);
 *   6 «Энергетический итог»   — лестница по энергиям связей, ΔH = −184,6 кДж,
 *                               на солнце — взрыв, в темноте — почти ничего.
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты,
 * watchdog лаборатории и панель урока.
 */

export const HCL_STEP_IDS = [
  'mixture',
  'initiation',
  'propagation1',
  'propagation2',
  'termination',
  'energy',
] as const

export type HclStepId = (typeof HCL_STEP_IDS)[number]

export type HclStep = SceneStep<HclStepId>

const STEPS: readonly HclStep[] = [
  { id: 'mixture', from: 0, to: 4, wall: 4.6, ease: 'power1.inOut' },
  { id: 'initiation', from: 4, to: 8, wall: 5.0, ease: 'sine.inOut' },
  { id: 'propagation1', from: 8, to: 13, wall: 6.0, ease: 'sine.inOut' },
  { id: 'propagation2', from: 13, to: 18, wall: 6.2, ease: 'sine.inOut' },
  { id: 'termination', from: 18, to: 22, wall: 4.6, ease: 'power1.inOut' },
  { id: 'energy', from: 22, to: 26, wall: 4.8, ease: 'power1.inOut' },
]

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export const HCL_FINISH: SceneFinish = { from: 26, to: 26.8, wall: 1.2, ease: 'power2.in' }

export type HclCueId =
  /** квант света долетел до молекулы хлора */
  | 'photon'
  /** связь Cl–Cl разорвана гомолитически: два радикала Cl• */
  | 'homolysis'
  /** Cl• оторвал атом водорода от H₂ — первая молекула HCl */
  | 'abstract'
  /** H• + Cl₂ → HCl + Cl•: вторая молекула HCl, экзотермический пик */
  | 'propagate'
  /** цепь пошла по кругу: счётчик молекул HCl растёт */
  | 'chain'
  /** обрыв цепи: два радикала Cl• рекомбинировали в Cl₂ */
  | 'terminate'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

export const HCL_TIMING = defineSceneTiming<HclStepId, HclCueId>({
  steps: STEPS,
  finish: HCL_FINISH,
  cues: [
    { at: 5.4, id: 'photon' },
    { at: 6.2, id: 'homolysis' },
    { at: 11.0, id: 'abstract' },
    { at: 15.6, id: 'propagate' },
    { at: 17.2, id: 'chain' },
    { at: 20.6, id: 'terminate' },
    { at: 25.2, id: 'embryo' },
    { at: 25.5, id: 'birth' },
    { at: HCL_FINISH.to, id: 'complete' },
  ],
})

export const HCL_STEPS = HCL_TIMING.steps
export const HCL_SEGMENTS = HCL_TIMING.segments
export const HCL_CUES = HCL_TIMING.cues
export const HCL_END = HCL_TIMING.end

export const hclStepIndexAt = HCL_TIMING.stepIndexAt
export const hclStepById = HCL_TIMING.stepById
export const hclCueAt = HCL_TIMING.cueAt
