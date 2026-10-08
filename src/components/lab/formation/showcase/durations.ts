/**
 * Длительности этапов для showcase-веществ (чистый модуль — его читает formationStory при сборке сценария).
 * Множитель применяется к базовой длительности этапа; 'final' — абсолютные секунды (окружение в финале).
 * Общая длительность показа остаётся в допуске аудита H (30–60 с).
 */
import type { StageKey } from '../formationStory'
import { isShowcaseId, type ShowcaseId } from './types'

type Durs = Partial<Record<StageKey, { mul?: number; abs?: number }>>

export const SHOWCASE_DURS: Record<ShowcaseId, Durs> = {
  h2o: { reagents: { mul: 1.3 }, break: { mul: 1.2 }, valence: { mul: 1.3 }, pairs: { mul: 1.4 }, assemble: { mul: 1.5 }, final: { abs: 14 } },
  co2: { reagents: { mul: 1.2 }, valence: { mul: 1.5 }, pairs: { mul: 1.2 }, assemble: { mul: 1.5 }, final: { abs: 14 } },
  sio2: { reagents: { mul: 1.2 }, valence: { mul: 1.2 }, assemble: { mul: 1.2 }, final: { abs: 12 } },
}

/** Длительность этапа key для вещества id (base — как у обычного показа). */
export function showcaseDur(id: string, key: StageKey, base: number): number {
  if (!isShowcaseId(id)) return base
  const d = SHOWCASE_DURS[id][key]
  if (!d) return base
  if (d.abs != null) return d.abs
  return base * (d.mul ?? 1)
}
