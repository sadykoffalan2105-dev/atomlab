import type { CSSProperties } from 'react'
import type { MessageKey } from '../../../i18n/useT'
import type { LearnPanelId } from '../../../learn/learnPanelLayoutStorage'
import type { LearnShellIconName } from '../LearnShellIcon'
import type { StudioColumnId } from './studioLayout'

/**
 * Урок делится на три рабочих пространства (как классы на хабе «Обучение»):
 * «Обучение» — кабинет учителя + 3D-каталог + рабочая зона,
 * «Интерактивная доска» — доска на всю ширину (режим презентации),
 * «ИИ-учитель» — широкий диалог с ИИ + узкая колонка кабинета.
 */
export type StudioWorkspace = 'teach' | 'board' | 'ai'

export const STUDIO_WORKSPACES: readonly StudioWorkspace[] = ['teach', 'board', 'ai']

/** Колонки пространства в порядке слева направо. */
export const STUDIO_WORKSPACE_COLUMNS: Record<StudioWorkspace, readonly StudioColumnId[]> = {
  teach: ['main', '3d', 'work'],
  board: ['work'],
  ai: ['main', 'assistant'],
}

/** Опциональные панели пространства (те, что можно закрыть внутри него). */
export function workspacePanels(ws: StudioWorkspace): LearnPanelId[] {
  return STUDIO_WORKSPACE_COLUMNS[ws].filter((c): c is LearnPanelId => c !== 'main')
}

export const STUDIO_WORKSPACE_KEY: Record<StudioWorkspace, '1' | '2' | '3'> = {
  teach: '1',
  board: '2',
  ai: '3',
}

export const STUDIO_WORKSPACE_BY_KEY: Record<'1' | '2' | '3', StudioWorkspace> = {
  '1': 'teach',
  '2': 'board',
  '3': 'ai',
}

export const STUDIO_WORKSPACE_ICON: Record<StudioWorkspace, LearnShellIconName> = {
  teach: 'layout',
  board: 'board',
  ai: 'sparkles',
}

export const STUDIO_WORKSPACE_LABEL: Record<StudioWorkspace, MessageKey> = {
  teach: 'learn.studio.ws.teach',
  board: 'learn.studio.ws.board',
  ai: 'learn.studio.ws.ai',
}

export const STUDIO_WORKSPACE_DESC: Record<StudioWorkspace, MessageKey> = {
  teach: 'learn.studio.ws.teachDesc',
  board: 'learn.studio.ws.boardDesc',
  ai: 'learn.studio.ws.aiDesc',
}

/** Ширины колонок по умолчанию для пространства (доли fr). */
export const STUDIO_WORKSPACE_WIDTHS: Record<StudioWorkspace, Partial<Record<StudioColumnId, number>>> = {
  teach: { main: 1.05, '3d': 1.25, work: 1 },
  board: { work: 1 },
  ai: { main: 0.6, assistant: 1.7 },
}

/** Тон пространства: обучение — фиолетовый, доска — янтарь, ИИ — розовый. */
const WS_TONES: Record<StudioWorkspace, [string, string]> = {
  teach: ['var(--lt-primary-2)', 'var(--lt-primary)'],
  board: ['var(--lt-accent-amber)', 'var(--lt-accent-pink)'],
  ai: ['var(--lt-accent-pink)', 'var(--lt-primary)'],
}

export function workspaceToneStyle(ws: StudioWorkspace): CSSProperties {
  const [a, b] = WS_TONES[ws]
  return {
    ['--studio-tone' as string]: a,
    ['--studio-tone-2' as string]: b,
    ['--ws-a' as string]: a,
    ['--ws-b' as string]: b,
  } as CSSProperties
}

/* ——— Память выбора: своё пространство для каждого урока ——— */

const WS_STORAGE_KEY = 'atomlab-learn-workspace-v1'

function isWorkspace(v: unknown): v is StudioWorkspace {
  return v === 'teach' || v === 'board' || v === 'ai'
}

function readAll(): Record<string, StudioWorkspace> {
  try {
    const raw = localStorage.getItem(WS_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, StudioWorkspace> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (isWorkspace(v)) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

/** Последнее пространство этого урока (null — выбор ещё не сделан). */
export function readLessonWorkspace(lessonId: string): StudioWorkspace | null {
  return readAll()[lessonId] ?? null
}

export function writeLessonWorkspace(lessonId: string, ws: StudioWorkspace): void {
  try {
    const all = readAll()
    all[lessonId] = ws
    // Не даём словарю расти бесконечно: держим последние 60 уроков.
    const keys = Object.keys(all)
    if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete all[k]
    localStorage.setItem(WS_STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* quota / приватный режим */
  }
}
