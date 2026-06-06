export type LearnPanelId = '3d' | 'work' | 'assistant'

const STORAGE_KEY = 'atomlab-learn-panel-layout-v1'

export type LearnPanelLayout = {
  hidden: LearnPanelId[]
}

export function readLearnPanelLayout(): LearnPanelLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { hidden: [] }
    const p = JSON.parse(raw) as { hidden?: unknown }
    if (!Array.isArray(p.hidden)) return { hidden: [] }
    const hidden = p.hidden.filter(
      (x): x is LearnPanelId => x === '3d' || x === 'work' || x === 'assistant',
    )
    return { hidden: [...new Set(hidden)] }
  } catch {
    return { hidden: [] }
  }
}

export function writeLearnPanelLayout(layout: LearnPanelLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hidden: layout.hidden }))
  } catch {
    /* ignore quota */
  }
}
