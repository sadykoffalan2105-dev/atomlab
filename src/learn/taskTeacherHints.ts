import type { LearnTaskGenerated } from './learnTaskProblems'

export type TaskHintStep = {
  step: number
  textKey: string
  params?: Record<string, string | number>
}

function numericSteps(categoryId: string, params: Record<string, number>): TaskHintStep[] {
  switch (categoryId) {
    case 'solutions':
      return [
        { step: 1, textKey: 'learn.task.hint.sol.s1' },
        {
          step: 2,
          textKey: 'learn.task.hint.sol.s2',
          params: { mSol: params.mSol ?? 0, wPct: params.wPct ?? 0 },
        },
        {
          step: 3,
          textKey: 'learn.task.hint.sol.s3',
          params: { mWater: params.mWater ?? 0 },
        },
        { step: 4, textKey: 'learn.task.hint.sol.s4' },
      ]
    case 'stoichiometry':
      return [
        { step: 1, textKey: 'learn.task.hint.stoich.s1', params: { m: params.m ?? 0 } },
        { step: 2, textKey: 'learn.task.hint.stoich.s2' },
        { step: 3, textKey: 'learn.task.hint.stoich.s3' },
      ]
    case 'limiting_reagent':
      return [
        {
          step: 1,
          textKey: 'learn.task.hint.limit.s1',
          params: { mFe: params.mFe ?? 0, mS: params.mS ?? 0 },
        },
        { step: 2, textKey: 'learn.task.hint.limit.s2' },
        { step: 3, textKey: 'learn.task.hint.limit.s3' },
        { step: 4, textKey: 'learn.task.hint.limit.s4' },
      ]
    case 'yield_impurities':
      return [
        {
          step: 1,
          textKey: 'learn.task.hint.yield.s1',
          params: { mRock: params.mRock ?? 0, impPct: params.impPct ?? 0 },
        },
        { step: 2, textKey: 'learn.task.hint.yield.s2' },
        { step: 3, textKey: 'learn.task.hint.yield.s3' },
      ]
    case 'metal_plate':
      return [
        { step: 1, textKey: 'learn.task.hint.plate.s1', params: { delta: params.delta ?? 0 } },
        { step: 2, textKey: 'learn.task.hint.plate.s2' },
        { step: 3, textKey: 'learn.task.hint.plate.s3' },
      ]
    case 'oge_prep':
      return [
        { step: 1, textKey: 'learn.task.hint.oge.s1', params: { m: params.m ?? 0 } },
        { step: 2, textKey: 'learn.task.hint.oge.s2' },
        { step: 3, textKey: 'learn.task.hint.oge.s3' },
      ]
    default:
      return [
        { step: 1, textKey: 'learn.task.hint.generic.s1' },
        { step: 2, textKey: 'learn.task.hint.generic.s2' },
        { step: 3, textKey: 'learn.task.hint.generic.s3' },
      ]
  }
}

function mcqSteps(categoryId: string): TaskHintStep[] {
  const map: Record<string, TaskHintStep[]> = {
    electron_balance: [
      { step: 1, textKey: 'learn.task.hint.redox.s1' },
      { step: 2, textKey: 'learn.task.hint.redox.s2' },
      { step: 3, textKey: 'learn.task.hint.redox.s3' },
    ],
    ionic_equations: [
      { step: 1, textKey: 'learn.task.hint.ion.s1' },
      { step: 2, textKey: 'learn.task.hint.ion.s2' },
      { step: 3, textKey: 'learn.task.hint.ion.s3' },
    ],
    transformation_chains: [
      { step: 1, textKey: 'learn.task.hint.chain.s1' },
      { step: 2, textKey: 'learn.task.hint.chain.s2' },
    ],
    qualitative_id: [
      { step: 1, textKey: 'learn.task.hint.qual.s1' },
      { step: 2, textKey: 'learn.task.hint.qual.s2' },
      { step: 3, textKey: 'learn.task.hint.qual.s3' },
    ],
    oge_prep: [
      { step: 1, textKey: 'learn.task.hint.mcq.s1' },
      { step: 2, textKey: 'learn.task.hint.mcq.s2' },
    ],
  }
  return map[categoryId] ?? [
    { step: 1, textKey: 'learn.task.hint.mcq.s1' },
    { step: 2, textKey: 'learn.task.hint.mcq.s2' },
  ]
}

/** Пошаговые подсказки учителя — без готового ответа. */
export function buildTaskTeacherHints(problem: LearnTaskGenerated): TaskHintStep[] {
  if (problem.kind === 'numeric') {
    return numericSteps(problem.categoryId, problem.params)
  }
  return mcqSteps(problem.categoryId)
}
