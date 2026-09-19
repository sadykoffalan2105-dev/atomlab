/**
 * ATOMLAB Cinema kit — ДАННЫЕ ЭНЕРГЕТИЧЕСКОЙ ЛЕСТНИЦЫ (без React, читается в Node).
 *
 * Ступени берутся ТОЛЬКО из научного ядра: цикл Борна — Габера — из
 * `BORN_HABER[id]` (thermoData.ts), знаки настоящие:
 *   ΔH_суб > 0, ½D(X₂) > 0, IE > 0, EA₁ < 0 (EA₂ кислорода > 0), U_реш < 0.
 * Сумма ступеней по закону Гесса обязана совпасть с табличной ΔH°f —
 * это проверяет assertLadderMatchesFormation() в тесте сцены.
 *
 * Сцена добавляет к каждой ступени только ВРЕМЯ сюжета: когда ступень пройдена.
 */
import { BORN_HABER, bornHaberSumKJ, type BornHaberStage } from '../../../../chemistry/data'

export type LadderStage = {
  id: string
  /** кДж на моль формульной единицы; > 0 — затраты, < 0 — выигрыш */
  dH: number
  /** момент сюжета, с которого ступень считается пройденной */
  at: number
  /** уравнение стадии из научного ядра, напр. «Na (тв) → Na (г)» */
  equation: string
  kind: BornHaberStage['kind']
}

export type Ladder = {
  cycleId: string
  formula: string
  /** уравнение цикла целиком */
  equation: string
  stages: readonly LadderStage[]
  /** сумма ступеней (закон Гесса), кДж/моль */
  sumKJ: number
  /** табличная ΔH°f, кДж/моль */
  tableKJ: number
}

/**
 * Собирает лестницу цикла Борна — Габера и расставляет ступени ПО ВРЕМЕНИ сюжета
 * (слева направо на экране), а не по порядку в справочнике.
 *
 * @param cycleId  ключ в BORN_HABER ('nacl', 'mgo', 'cao', …)
 * @param at       момент сюжета для каждой ступени: { sublimation: 2.4, … }
 */
export function buildBornHaberLadder(cycleId: string, at: Readonly<Record<string, number>>): Ladder {
  const cycle = BORN_HABER[cycleId]
  if (!cycle) throw new Error(`[energyLadder] нет цикла Борна — Габера «${cycleId}»`)
  const stages: LadderStage[] = cycle.stages.map((s) => {
    const t = at[s.id]
    if (t == null) throw new Error(`[energyLadder] не задано время ступени «${s.id}» цикла «${cycleId}»`)
    return { id: s.id, dH: s.dHKJ, at: t, equation: s.equation, kind: s.kind }
  })
  stages.sort((a, b) => a.at - b.at || cycle.stages.findIndex((s) => s.id === a.id) - cycle.stages.findIndex((s) => s.id === b.id))
  return {
    cycleId,
    formula: cycle.formula,
    equation: cycle.equation,
    stages,
    sumKJ: bornHaberSumKJ(cycleId),
    tableKJ: cycle.dHfTableKJ,
  }
}

/** Индекс ступени, которую подсвечивать в момент t; −1 — ещё ни одной. */
export function activeStageAt(ladder: Ladder, t: number): number {
  let active = -1
  for (let i = 0; i < ladder.stages.length; i++) if (t >= ladder.stages[i]!.at) active = i
  return active
}

/** Кумулятивные уровни энергии: [0, +ΔH₁, +ΔH₁+ΔH₂, …] — по ним строится ступенчатый график. */
export function ladderLevels(ladder: Ladder): number[] {
  const levels = [0]
  for (const s of ladder.stages) levels.push(levels[levels.length - 1]! + s.dH)
  return levels
}

/**
 * Проверка для теста сцены: сумма ступеней совпадает с табличной ΔH°f
 * в пределах `tol` кДж/моль (справочные значения из разных источников
 * дают расхождение в доли килоджоуля — это нормально, выдумка — нет).
 */
export function assertLadderMatchesFormation(ladder: Ladder, tol = 5): void {
  const d = Math.abs(ladder.sumKJ - ladder.tableKJ)
  if (d > tol) {
    throw new Error(
      `[energyLadder] цикл «${ladder.cycleId}»: сумма ${ladder.sumKJ} кДж/моль расходится с табличной ΔH°f ${ladder.tableKJ} на ${d.toFixed(1)} (предел ${tol})`,
    )
  }
}

/** Формат числа с настоящим знаком: 107.3 → «+107», −786 → «−786». */
export function formatKJ(n: number): string {
  const r = Math.round(n)
  return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r)
}
