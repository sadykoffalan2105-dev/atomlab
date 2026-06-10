import type { LearnGradeId } from '../types/learn'

const STORAGE_KEY_V3 = 'atomlab-learn-progress-v3'
const STORAGE_KEY_V2 = 'atomlab-learn-progress-v2'

export type LearnProgressV3 = {
  v: 3
  completedSectionIds: string[]
  completedLessonIds: string[]
  last?: {
    gradeId: LearnGradeId | string
    chapterId: string
    sectionId: string
    slideIndex: number
    topicId?: string
    lessonId?: string
  }
  workspaceDrafts?: Record<string, string>
  workspaceInkDrafts?: Record<string, string>
}

const empty: LearnProgressV3 = {
  v: 3,
  completedSectionIds: [],
  completedLessonIds: [],
}

function parseV3(raw: string): LearnProgressV3 | null {
  try {
    const p = JSON.parse(raw) as Partial<LearnProgressV3>
    if (p?.v !== 3) return null
    const last =
      p.last &&
      typeof p.last.gradeId === 'string' &&
      typeof p.last.chapterId === 'string' &&
      typeof p.last.sectionId === 'string' &&
      typeof p.last.slideIndex === 'number'
        ? p.last
        : undefined
    return {
      v: 3,
      completedSectionIds: [...new Set((p.completedSectionIds ?? []).filter((x) => typeof x === 'string'))],
      completedLessonIds: [...new Set((p.completedLessonIds ?? []).filter((x) => typeof x === 'string'))],
      last,
      workspaceDrafts:
        p.workspaceDrafts && typeof p.workspaceDrafts === 'object' ? { ...p.workspaceDrafts } : {},
      workspaceInkDrafts:
        p.workspaceInkDrafts && typeof p.workspaceInkDrafts === 'object'
          ? { ...p.workspaceInkDrafts }
          : {},
    }
  } catch {
    return null
  }
}

function migrateFromV2(): LearnProgressV3 | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2)
    if (!raw) return null
    const p = JSON.parse(raw) as {
      v?: number
      completedLessonIds?: unknown
      last?: { topicId?: string; lessonId?: string; stepIndex?: number }
    }
    if (p?.v !== 2 || !Array.isArray(p.completedLessonIds)) return null
    return {
      v: 3,
      completedSectionIds: [],
      completedLessonIds: [...new Set(p.completedLessonIds.filter((x) => typeof x === 'string'))],
      last: p.last
        ? {
            gradeId: 'g7',
            chapterId: 'c1',
            sectionId: 's01',
            slideIndex: p.last.stepIndex ?? 0,
            topicId: p.last.topicId,
            lessonId: p.last.lessonId,
          }
        : undefined,
      workspaceDrafts: {},
      workspaceInkDrafts: {},
    }
  } catch {
    return null
  }
}

let migrated = false

export function readLearnProgress(): LearnProgressV3 {
  try {
    const raw3 = localStorage.getItem(STORAGE_KEY_V3)
    if (raw3) {
      const p3 = parseV3(raw3)
      if (p3) return p3
    }
    if (!migrated) {
      migrated = true
      const fromV2 = migrateFromV2()
      if (fromV2) {
        writeLearnProgress(fromV2)
        return fromV2
      }
    }
    return { ...empty }
  } catch {
    return { ...empty }
  }
}

export function writeLearnProgress(p: LearnProgressV3) {
  try {
    localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

export type LearnProgressV2 = LearnProgressV3

export function markSectionCompleted(sectionPathId: string) {
  const cur = readLearnProgress()
  if (cur.completedSectionIds.includes(sectionPathId)) return
  writeLearnProgress({
    ...cur,
    completedSectionIds: [...cur.completedSectionIds, sectionPathId],
  })
}

export function markLessonCompleted(lessonId: string) {
  const cur = readLearnProgress()
  if (cur.completedLessonIds.includes(lessonId)) return
  writeLearnProgress({
    ...cur,
    completedLessonIds: [...cur.completedLessonIds, lessonId],
  })
}

export function setLastPosition(
  gradeId: string,
  chapterId: string,
  sectionId: string,
  slideIndex: number,
) {
  const cur = readLearnProgress()
  writeLearnProgress({
    ...cur,
    last: { gradeId, chapterId, sectionId, slideIndex },
  })
}

export function clearLastPosition() {
  const cur = readLearnProgress()
  const { last: _l, ...rest } = cur
  writeLearnProgress(rest)
}

export function readWorkspaceDraft(sectionPathId: string): string {
  const cur = readLearnProgress()
  return cur.workspaceDrafts?.[sectionPathId] ?? ''
}

export function writeWorkspaceDraft(sectionPathId: string, text: string) {
  const cur = readLearnProgress()
  writeLearnProgress({
    ...cur,
    workspaceDrafts: { ...cur.workspaceDrafts, [sectionPathId]: text },
  })
}

export function readWorkspaceInk(sectionPathId: string): string {
  const cur = readLearnProgress()
  return cur.workspaceInkDrafts?.[sectionPathId] ?? ''
}

export function writeWorkspaceInk(sectionPathId: string, dataUrl: string) {
  const cur = readLearnProgress()
  const next = { ...(cur.workspaceInkDrafts ?? {}) }
  if (!dataUrl) delete next[sectionPathId]
  else next[sectionPathId] = dataUrl
  writeLearnProgress({
    ...cur,
    workspaceInkDrafts: next,
  })
}

export function sectionProgress(
  sectionIds: readonly string[],
  p: LearnProgressV3,
): { done: number; total: number } {
  const total = sectionIds.length
  const done = sectionIds.filter((id) => p.completedSectionIds.includes(id)).length
  return { done, total }
}
