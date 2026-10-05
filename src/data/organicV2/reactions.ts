/**
 * Органика v2 — реакции учебников Kimyo 10–11 с атомным соответствием и маршруты получения (контракт ./types.ts).
 * Данные считаются офлайн (scripts/organic-v2/build_reactions.py, RDKit) и весят несколько МБ, поэтому грузятся
 * отдельным чанком только при первом обращении (режимы «Синтез» и «Реакции» страницы #/organic).
 */
import type { OV2Reaction, OV2ReactionsFile } from './types'

let pending: Promise<OV2ReactionsFile> | null = null

/** Весь файл реакций (один раз за сессию; при ошибке сети следующий вызов пробует снова). */
export function loadOrganicV2Reactions(): Promise<OV2ReactionsFile> {
  pending ??= import('./reactions.json')
    .then((m) => (m as unknown as { default: OV2ReactionsFile }).default)
    .catch((e: unknown) => {
      pending = null
      throw e
    })
  return pending
}

/** Маршруты получения молекулы (сначала реакции учебника по страницам, затем общие схемы). */
export async function loadOrganicV2Routes(moleculeId: string): Promise<OV2Reaction[]> {
  const file = await loadOrganicV2Reactions()
  const byId = new Map(file.reactions.map((r) => [r.id, r]))
  return (file.routes[moleculeId] ?? []).map((id) => byId.get(id)).filter((r): r is OV2Reaction => r != null)
}

/** Химические свойства молекулы: реакции, где она исходное вещество. */
export async function loadOrganicV2Uses(moleculeId: string): Promise<OV2Reaction[]> {
  const file = await loadOrganicV2Reactions()
  const byId = new Map(file.reactions.map((r) => [r.id, r]))
  return (file.uses[moleculeId] ?? []).map((id) => byId.get(id)).filter((r): r is OV2Reaction => r != null)
}
