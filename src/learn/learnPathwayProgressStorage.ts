import type { LearnPathwayStepId } from '../types/learnPathway'

const STORAGE_KEY = 'atomlab-learn-pathway-progress-v1'

export type PathwayStepProgress = {
  /** Выполнено подпунктов на шаге */
  done: number
  completed: boolean
}

export type PathwayProgress = {
  pathwayId: string
  currentStep: LearnPathwayStepId
  steps: Partial<Record<LearnPathwayStepId, PathwayStepProgress>>
  completedAt?: string
}

export type PathwayProgressStore = {
  pathways: Record<string, PathwayProgress>
}

function emptyStore(): PathwayProgressStore {
  return { pathways: {} }
}

function readStore(): PathwayProgressStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    const p = JSON.parse(raw) as PathwayProgressStore
    if (!p?.pathways || typeof p.pathways !== 'object') return emptyStore()
    return p
  } catch {
    return emptyStore()
  }
}

function writeStore(store: PathwayProgressStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function readPathwayProgress(pathwayId: string): PathwayProgress {
  const store = readStore()
  const existing = store.pathways[pathwayId]
  if (existing) return existing
  return {
    pathwayId,
    currentStep: 'context',
    steps: {},
  }
}

export function savePathwayProgress(progress: PathwayProgress): void {
  const store = readStore()
  store.pathways[progress.pathwayId] = progress
  writeStore(store)
}

export function markPathwayStepTask(
  pathwayId: string,
  stepId: LearnPathwayStepId,
  done: number,
  taskCount: number,
): PathwayProgress {
  const prev = readPathwayProgress(pathwayId)
  const completed = done >= taskCount
  const next: PathwayProgress = {
    ...prev,
    steps: {
      ...prev.steps,
      [stepId]: { done: Math.min(done, taskCount), completed },
    },
  }
  savePathwayProgress(next)
  return next
}

export function setPathwayCurrentStep(
  pathwayId: string,
  stepId: LearnPathwayStepId,
): PathwayProgress {
  const prev = readPathwayProgress(pathwayId)
  const next = { ...prev, currentStep: stepId }
  savePathwayProgress(next)
  return next
}

export function completePathway(pathwayId: string): PathwayProgress {
  const prev = readPathwayProgress(pathwayId)
  const next = { ...prev, completedAt: new Date().toISOString() }
  savePathwayProgress(next)
  return next
}

export function pathwayCompletedTaskCount(progress: PathwayProgress): number {
  return Object.values(progress.steps).reduce((s, st) => s + (st?.done ?? 0), 0)
}
