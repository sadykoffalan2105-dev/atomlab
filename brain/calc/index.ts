/**
 * Школьный калькулятор Kimyo 7–11: runSchoolCalc(text, cmp, lang, kb) → ToolResult | null.
 * Задачу решает детерминированный код в стиле учебника (школьные Ar, «Дано → Решение → Ответ»); tool = 'calc:<тип>',
 * numbers — только итоговые ответы в школьном округлении (их обязано повторить сообщение модели).
 * null — задача не распознана уверенно: тогда работают старые инструменты tools.ts.
 * Хук: tools.ts runTools — первой строкой (см. docs/plans/school-calc.md).
 */
import type { Knowledge } from '../kb/shards.ts'
import type { Lang } from '../pipeline/normalize.ts'
import type { ToolResult } from '../pipeline/tools.ts'
import { factsLine, render, valueNum, type Solution } from './format.ts'
import { buildCtx } from './parse.ts'
import { SOLVERS, type TaskTypeId } from './registry.ts'

export type { Solution } from './format.ts'

/** Карта программы (строитель A) — необязательная: только то, что нужно для подписи. */
type CurriculumLike = {
  taskTypes?: { id: string; introducedIn?: string[] }[]
  byId?: Map<string, { label?: { ru?: string } }>
}

function citeFor(type: string, kb: Knowledge): string {
  const cur = (kb as unknown as { curriculum?: CurriculumLike | null }).curriculum
  try {
    const tt = cur?.taskTypes?.find((t) => t.id === type)
    const unitId = tt?.introducedIn?.[0]
    const label = unitId ? cur?.byId?.get(unitId)?.label?.ru : undefined
    if (label) return `[ATOMLAB: расчёт по ${label}]`
  } catch {
    /* карта необязательна */
  }
  return '[ATOMLAB: расчёт]'
}

const HAS_DIGIT = /\d/
/** Похоже на задачу: число и вопрос/повеление «найди/вычисли/сколько…». */
const TASK_RE = /(сколько|какая|какой|какое|каков|чему равн|найд|вычисл|рассчит|посчит|определ|составь|выведи|установи|how (much|many)|what|calculate|find|determine|compute|work out|qancha|necha|qanday|toping|hisobla|aniqla|nechta|chiqaring|\?)/iu

/** Решить задачу целиком (для селфтеста и отладки). */
export function solveSchoolTask(text: string, cmp: string, lang: Lang, kb: Knowledge): Solution | null {
  if (!HAS_DIGIT.test(text) || text.length > 1500 || !TASK_RE.test(cmp)) return null
  const ctx = buildCtx(text, cmp, lang, kb)
  for (const s of SOLVERS) {
    let sol: Solution | null = null
    try {
      sol = s.solve(ctx)
    } catch {
      sol = null
    }
    if (!sol || !sol.answers.length) continue
    if (sol.answers.some((a) => a.text == null && (!Number.isFinite(a.value) || a.value < 0))) continue
    return sol
  }
  return null
}

export function runSchoolCalc(text: string, cmp: string, lang: Lang, kb: Knowledge): ToolResult | null {
  const sol = solveSchoolTask(text, cmp, lang, kb)
  if (!sol) return null
  const type = sol.type as TaskTypeId
  return {
    tool: `calc:${type}`,
    text: render(sol, lang),
    facts: factsLine(sol, lang),
    numbers: sol.answers.map((a) => valueNum(a, lang)),
    cite: citeFor(type, kb),
  }
}

export { reconcileCalcAnswer } from './reconcile.ts'
