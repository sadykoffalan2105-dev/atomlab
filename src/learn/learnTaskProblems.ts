/** Генерация числовых задач для режима «Обучение → задачи». */

export type LearnTaskNumericProblem = {
  kind: 'numeric'
  categoryId: string
  compoundId: string
  questionKey: string
  answerLabelKey: string
  params: Record<string, number>
  correct: number
  /** Знаков после запятой для отображения эталона */
  decimals: number
}

export type LearnTaskMcqProblem = {
  kind: 'mcq'
  categoryId: string
  compoundId: string | null
  questionKey: string
  choiceKeys: readonly string[]
  correctIndex: number
}

export type LearnTaskGenerated = LearnTaskNumericProblem | LearnTaskMcqProblem

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function roundTo(n: number, decimals: number): number {
  const p = 10 ** decimals
  return Math.round(n * p) / p
}

export function answersClose(user: number, expected: number, decimals: number): boolean {
  if (!Number.isFinite(user) || !Number.isFinite(expected)) return false
  const tol = Math.max(10 ** -decimals / 2, Math.abs(expected) * 0.008 + 1e-9)
  return Math.abs(user - expected) <= tol
}

export function generateTaskProblem(categoryId: string): LearnTaskGenerated {
  switch (categoryId) {
    case 'solutions': {
      const mSol = randInt(15, 28) * 10
      const wPct = randInt(6, 18)
      const mWater = randInt(25, 90) * 5
      const mSolute = (mSol * wPct) / 100
      const wNew = (mSolute / (mSol + mWater)) * 100
      const correct = roundTo(wNew, 2)
      return {
        kind: 'numeric',
        categoryId,
        compoundId: 'nacl',
        questionKey: 'learn.task.sol.question',
        answerLabelKey: 'learn.task.sol.answerLabel',
        params: { mSol, wPct, mWater },
        correct,
        decimals: 2,
      }
    }
    case 'stoichiometry': {
      const m = randInt(4, 22)
      const v = (m / 100) * 22.4
      const correct = roundTo(v, 2)
      return {
        kind: 'numeric',
        categoryId,
        compoundId: 'co2',
        questionKey: 'learn.task.stoich.question',
        answerLabelKey: 'learn.task.stoich.answerLabel',
        params: { m },
        correct,
        decimals: 2,
      }
    }
    case 'limiting_reagent': {
      const mFe = randInt(3, 14) * 4
      const mS = randInt(2, 12) * 4
      const M_FE = 56
      const M_S = 32
      const M_FES = 88
      const nFe = mFe / M_FE
      const nS = mS / M_S
      const n = Math.min(nFe, nS)
      const correct = roundTo(n * M_FES, 2)
      return {
        kind: 'numeric',
        categoryId,
        compoundId: 'fe3o4',
        questionKey: 'learn.task.limit.question',
        answerLabelKey: 'learn.task.limit.answerLabel',
        params: { mFe, mS },
        correct,
        decimals: 2,
      }
    }
    case 'yield_impurities': {
      const mRock = randInt(8, 40) * 100
      const impPct = randInt(5, 18)
      const pure = mRock * (1 - impPct / 100)
      const mCaO = pure * (56 / 100)
      const correct = roundTo(mCaO, 1)
      return {
        kind: 'numeric',
        categoryId,
        compoundId: 'cao',
        questionKey: 'learn.task.yield.question',
        answerLabelKey: 'learn.task.yield.answerLabel',
        params: { mRock, impPct },
        correct,
        decimals: 1,
      }
    }
    case 'metal_plate': {
      const delta = randInt(1, 6) * 8
      const mCu = (delta / 8) * 64
      const correct = roundTo(mCu, 2)
      return {
        kind: 'numeric',
        categoryId,
        compoundId: 'cuo',
        questionKey: 'learn.task.plate.question',
        answerLabelKey: 'learn.task.plate.answerLabel',
        params: { delta },
        correct,
        decimals: 2,
      }
    }
    case 'electron_balance': {
      const variants = [
        {
          q: 'learn.task.mcq.redox.q0',
          choices: [
            'learn.task.mcq.redox.q0o0',
            'learn.task.mcq.redox.q0o1',
            'learn.task.mcq.redox.q0o2',
            'learn.task.mcq.redox.q0o3',
          ] as const,
          correctIndex: 1,
        },
        {
          q: 'learn.task.mcq.redox.q1',
          choices: [
            'learn.task.mcq.redox.q1o0',
            'learn.task.mcq.redox.q1o1',
            'learn.task.mcq.redox.q1o2',
            'learn.task.mcq.redox.q1o3',
          ] as const,
          correctIndex: 2,
        },
      ] as const
      const v = variants[randInt(0, variants.length - 1)]!
      const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5)
      const permuted = order.map((i) => v.choices[i]!)
      const correctIndex = permuted.indexOf(v.choices[v.correctIndex]!)
      return {
        kind: 'mcq',
        categoryId,
        compoundId: 'hno3',
        questionKey: v.q,
        choiceKeys: permuted,
        correctIndex,
      }
    }
    case 'ionic_equations': {
      const variants = [
        {
          q: 'learn.task.mcq.ion.q0',
          choices: [
            'learn.task.mcq.ion.q0o0',
            'learn.task.mcq.ion.q0o1',
            'learn.task.mcq.ion.q0o2',
            'learn.task.mcq.ion.q0o3',
          ] as const,
          correctIndex: 1,
        },
        {
          q: 'learn.task.mcq.ion.q1',
          choices: [
            'learn.task.mcq.ion.q1o0',
            'learn.task.mcq.ion.q1o1',
            'learn.task.mcq.ion.q1o2',
            'learn.task.mcq.ion.q1o3',
          ] as const,
          correctIndex: 0,
        },
      ] as const
      const v = variants[randInt(0, variants.length - 1)]!
      const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5)
      const permuted = order.map((i) => v.choices[i]!)
      const correctIndex = permuted.indexOf(v.choices[v.correctIndex]!)
      return {
        kind: 'mcq',
        categoryId,
        compoundId: 'nacl',
        questionKey: v.q,
        choiceKeys: permuted,
        correctIndex,
      }
    }
    case 'transformation_chains': {
      const variants = [
        {
          q: 'learn.task.mcq.chain.q0',
          choices: [
            'learn.task.mcq.chain.q0o0',
            'learn.task.mcq.chain.q0o1',
            'learn.task.mcq.chain.q0o2',
            'learn.task.mcq.chain.q0o3',
          ] as const,
          correctIndex: 1,
        },
      ] as const
      const v = variants[0]!
      const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5)
      const permuted = order.map((i) => v.choices[i]!)
      const correctIndex = permuted.indexOf(v.choices[v.correctIndex]!)
      return {
        kind: 'mcq',
        categoryId,
        compoundId: 'h2o2',
        questionKey: v.q,
        choiceKeys: permuted,
        correctIndex,
      }
    }
    case 'qualitative_id': {
      const variants = [
        {
          q: 'learn.task.mcq.qual.q0',
          choices: [
            'learn.task.mcq.qual.q0o0',
            'learn.task.mcq.qual.q0o1',
            'learn.task.mcq.qual.q0o2',
            'learn.task.mcq.qual.q0o3',
          ] as const,
          correctIndex: 2,
        },
      ] as const
      const v = variants[0]!
      const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5)
      const permuted = order.map((i) => v.choices[i]!)
      const correctIndex = permuted.indexOf(v.choices[v.correctIndex]!)
      return {
        kind: 'mcq',
        categoryId,
        compoundId: 'nacl',
        questionKey: v.q,
        choiceKeys: permuted,
        correctIndex,
      }
    }
    default: {
      return generateTaskProblem('solutions')
    }
  }
}
