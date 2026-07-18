/**
 * Reasoning Log — журнал скрытых мыслей преподавателя перед выдачей ответа.
 *
 * Порядок стадий по ТЗ:
 *   [Оценка устного ответа] → [Сверка с эмоцией по камере] →
 *   [Оценка манипуляций с пробирками] → [Выбор стратегии] → [Генерация ответа].
 *
 * Трасса накапливает шаги с временными метками (мс от старта) и умеет
 * отдавать компактный снимок для UI/логов и человекочитаемое резюме.
 */
import type { ReasoningStage, ReasoningStepSnapshot } from './brainTypes'

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export class ReasoningTrace {
  private steps: ReasoningStepSnapshot[] = []
  private readonly startedAt: number

  constructor() {
    this.startedAt = now()
  }

  add(stage: ReasoningStage, observation: string, inference: string): this {
    this.steps.push({
      stage,
      observation: observation.trim(),
      inference: inference.trim(),
      atMs: Math.round(now() - this.startedAt),
    })
    return this
  }

  /** Снимок для передачи в UI/лог (иммутабельная копия). */
  snapshot(): ReasoningStepSnapshot[] {
    return this.steps.map((s) => ({ ...s }))
  }

  durationMs(): number {
    return Math.round(now() - this.startedAt)
  }

  isEmpty(): boolean {
    return this.steps.length === 0
  }

  /** Однострочное резюме мыслительного пути (для отладки/тултипа). */
  summary(): string {
    return this.steps
      .map((s) => `${s.stage}: ${s.inference}`)
      .join(' → ')
  }
}
