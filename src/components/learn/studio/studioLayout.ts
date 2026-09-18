import type { CSSProperties } from 'react'
import type { LearnPanelId } from '../../../learn/learnPanelLayoutStorage'
import type { MessageKey } from '../../../i18n/useT'
import type { LearnShellIconName } from '../LearnShellIcon'

export const STUDIO_PANEL_ICON: Record<LearnPanelId, LearnShellIconName> = {
  '3d': 'cube',
  work: 'pencil',
  assistant: 'sparkles',
}

export const STUDIO_PANEL_LABEL: Record<LearnPanelId, MessageKey> = {
  '3d': 'learn.panel.open3d',
  work: 'learn.panel.openWork',
  assistant: 'learn.panel.openAssistant',
}

/** Все колонки студии урока: кабинет учителя + три опциональные панели. */
export type StudioColumnId = 'main' | LearnPanelId

export type StudioPreset = 'lesson' | 'test' | '3d' | 'ai' | 'board'

export const STUDIO_PANELS: readonly LearnPanelId[] = ['3d', 'work', 'assistant']
export const STUDIO_COLUMNS: readonly StudioColumnId[] = ['main', '3d', 'work', 'assistant']

/** Какие опциональные панели открывает каждая раскладка («Доска» — режим презентации). */
export const STUDIO_PRESET_PANELS: Record<Exclude<StudioPreset, 'board'>, readonly LearnPanelId[]> = {
  lesson: ['3d', 'work', 'assistant'],
  test: ['work'],
  '3d': ['3d'],
  ai: ['assistant'],
}

export const STUDIO_PRESET_ORDER: readonly StudioPreset[] = ['lesson', 'test', '3d', 'ai', 'board']

/** Горячая клавиша для каждой опциональной панели (1/2/3). */
export const STUDIO_PANEL_KEY: Record<LearnPanelId, string> = { '3d': '1', work: '2', assistant: '3' }

/** Тон панели — CSS-переменные --studio-tone / --studio-tone-2 (см. README). */
const TONES: Record<StudioColumnId, [string, string]> = {
  main: ['var(--lt-primary-2)', 'var(--lt-primary)'],
  '3d': ['var(--lt-accent-cyan)', 'var(--lt-primary)'],
  work: ['var(--lt-accent-amber)', 'var(--lt-accent-pink)'],
  assistant: ['var(--lt-accent-pink)', 'var(--lt-primary)'],
}

export function studioToneStyle(id: StudioColumnId): CSSProperties {
  const [a, b] = TONES[id]
  return { ['--studio-tone' as string]: a, ['--studio-tone-2' as string]: b } as CSSProperties
}

/** Определяет активную раскладку по состоянию (null — своя комбинация). */
export function detectStudioPreset(
  hidden: ReadonlySet<LearnPanelId>,
  presentationMode: boolean,
): StudioPreset | null {
  if (presentationMode) return 'board'
  for (const id of ['lesson', 'test', '3d', 'ai'] as const) {
    const want = STUDIO_PRESET_PANELS[id]
    const ok = STUDIO_PANELS.every((p) => want.includes(p) === !hidden.has(p))
    if (ok) return id
  }
  return null
}

/* ——— Ширины колонок (доли fr) ——— */

export type StudioWidths = Record<StudioColumnId, number>

export const STUDIO_DEFAULT_WIDTHS: StudioWidths = { main: 1.05, '3d': 1.3, work: 0.95, assistant: 1 }
export const STUDIO_MIN_PX: Record<StudioColumnId, number> = { main: 250, '3d': 280, work: 240, assistant: 260 }

/** Ширина ручки между колонками, px (совпадает с --studio-handle-w в CSS). */
export const STUDIO_HANDLE_PX = 10

export function studioGridTemplate(cols: readonly StudioColumnId[], widths: StudioWidths): string {
  if (cols.length === 1) return '1fr'
  return cols
    .map((c) => `minmax(${STUDIO_MIN_PX[c]}px, ${clampFr(widths[c])}fr)`)
    .join(` ${STUDIO_HANDLE_PX}px `)
}

function clampFr(v: number): number {
  return Number.isFinite(v) ? Math.min(6, Math.max(0.25, Math.round(v * 1000) / 1000)) : 1
}

/**
 * Перераспределяет долю между двумя соседями по сдвигу мыши в px.
 * Сумма долей пары сохраняется, поэтому остальные колонки не «дышат».
 */
export function resizePair(
  widths: StudioWidths,
  left: StudioColumnId,
  right: StudioColumnId,
  leftPx: number,
  rightPx: number,
  deltaPx: number,
): StudioWidths {
  const pairPx = leftPx + rightPx
  if (pairPx <= 0) return widths
  const minL = STUDIO_MIN_PX[left]
  const minR = STUDIO_MIN_PX[right]
  const nextLeftPx = Math.min(pairPx - minR, Math.max(minL, leftPx + deltaPx))
  const pairFr = widths[left] + widths[right]
  const nextLeft = (pairFr * nextLeftPx) / pairPx
  return { ...widths, [left]: clampFr(nextLeft), [right]: clampFr(pairFr - nextLeft) }
}

/* ——— Хранилище (localStorage, безопасно) ——— */

const STORAGE_KEY = 'atomlab-learn-studio-v1'

export type StudioPrefs = { preset: StudioPreset | null; widths: StudioWidths }

export function readStudioPrefs(): StudioPrefs {
  const fallback: StudioPrefs = { preset: null, widths: { ...STUDIO_DEFAULT_WIDTHS } }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const p = JSON.parse(raw) as { preset?: unknown; widths?: Record<string, unknown> }
    const preset = STUDIO_PRESET_ORDER.includes(p.preset as StudioPreset) ? (p.preset as StudioPreset) : null
    const widths = { ...STUDIO_DEFAULT_WIDTHS }
    for (const c of STUDIO_COLUMNS) {
      const v = p.widths?.[c]
      if (typeof v === 'number' && Number.isFinite(v)) widths[c] = clampFr(v)
    }
    return { preset, widths }
  } catch {
    return fallback
  }
}

export function writeStudioPrefs(patch: Partial<StudioPrefs>): void {
  try {
    const cur = readStudioPrefs()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...patch }))
  } catch {
    /* quota / private mode */
  }
}
