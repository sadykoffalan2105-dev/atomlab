/**
 * Тексты showcase (чистый модуль, без React): подписи этапов панели и HUD-карточки фактов (RU/EN/UZ).
 * Каждое вещество — свой файл texts/<id>.ts, здесь — одна строка регистрации.
 */
import type { FormationLocale } from '../../../../../chemistry/formationText'
import type { StageKey, StoryHud } from '../../formationStory'
import type { ShowcaseId } from '../types'
import { SIO2_TEXTS } from './sio2'

export type Tri = [string, string, string]
export type ShowcaseStageText = { title?: Tri; main?: Tri; sub?: Tri }
export type ShowcaseTexts = {
  /** Подписи этапов панели (заменяют стандартные, если заданы). */
  stages: Partial<Record<StageKey, ShowcaseStageText>>
  /** HUD-карточки фактов: окна времени задаются ДОЛЯМИ этапа [key, from 0…1, to 0…1]. */
  hud: { stage: StageKey; from: number; to: number; title: Tri; lines: Tri[]; tone?: StoryHud['tone'] }[]
}

const TEXTS: Partial<Record<ShowcaseId, ShowcaseTexts>> = {
  // h2o: H2O_TEXTS,
  // co2: CO2_TEXTS,
  sio2: SIO2_TEXTS,
}

export const pickT = (t: Tri, loc: FormationLocale): string => (loc === 'en' ? t[1] : loc === 'uz' ? t[2] : t[0])

export function showcaseStageText(id: string, key: StageKey): ShowcaseStageText | null {
  return TEXTS[id as ShowcaseId]?.stages[key] ?? null
}

/** HUD-карточки showcase в абсолютном времени сценария. */
export function showcaseHud(id: string, stages: readonly { key: StageKey; t0: number; dur: number }[]): StoryHud[] {
  const tx = TEXTS[id as ShowcaseId]
  if (!tx) return []
  const out: StoryHud[] = []
  for (const h of tx.hud) {
    const st = stages.find((s) => s.key === h.stage)
    if (!st) continue
    out.push({
      t0: st.t0 + st.dur * h.from,
      t1: st.t0 + st.dur * h.to,
      title: h.title[0],
      lines: h.lines.map((l) => l[0]),
      tone: h.tone ?? 'route',
      titleT: h.title,
      linesT: h.lines,
    })
  }
  return out
}
