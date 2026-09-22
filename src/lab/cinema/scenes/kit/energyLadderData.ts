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
  /** сколько частиц проходит ступень на формульную единицу (2 Al, 3 O для Al₂O₃); нет — 1 */
  multiplier?: number
  /** ΔH на одну частицу, кДж/моль: dH = multiplier·perUnitKJ (проверяет test:chem-data) */
  perUnitKJ?: number
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
    const stage: LadderStage = { id: s.id, dH: s.dHKJ, at: t, equation: s.equation, kind: s.kind }
    if (s.multiplier != null) stage.multiplier = s.multiplier
    if (s.perUnitKJ != null) stage.perUnitKJ = s.perUnitKJ
    return stage
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

/**
 * Формат числа с настоящим знаком: 107.3 → «+107», −786 → «−786»; digits = 1 → «+107,3» (decimal —
 * десятичный знак языка). Точность списка ступеней берётся из данных (ladderDigits), чтобы
 * лестница и текст урока показывали одно и то же число (−348,6, а не −349).
 */
export function formatKJ(n: number, digits = 0, decimal = '.'): string {
  const k = 10 ** digits
  const r = Math.round(n * k) / k
  const body = (digits > 0 ? Math.abs(r).toFixed(digits) : String(Math.abs(r))).replace('.', decimal)
  return (r > 0 ? '+' : r < 0 ? '−' : '') + body
}

/** Сколько знаков после запятой несут ступени цикла в ядре: 1, если хоть одна дана с десятыми. */
export function ladderDigits(ladder: Pick<Ladder, 'stages'>): number {
  return ladder.stages.some((s) => Math.abs(Math.round(s.dH * 10) - Math.round(s.dH) * 10) > 0) ? 1 : 0
}

/**
 * Множитель ступени для подписи: «2 × 577,5», «3 × (−141)». null — ступень без множителя
 * (или множитель 1): такая лестница выглядит как раньше. Число на частицу — ровно perUnitKJ
 * из ядра (одна десятая, без хвоста «,0»), десятичный знак — по языку подписи.
 */
export function formatStageFactor(stage: Pick<LadderStage, 'multiplier' | 'perUnitKJ'>, decimal = '.'): string | null {
  const m = stage.multiplier
  const u = stage.perUnitKJ
  if (m == null || u == null || m === 1) return null
  const r = Math.round(Math.abs(u) * 10) / 10
  const body = (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', decimal)
  return `${m} × ${u < 0 ? `(−${body})` : body}`
}
