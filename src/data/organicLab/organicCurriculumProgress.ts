/** Прогресс уроков органической лаборатории (localStorage). */

export type OrganicLessonProgress = {
  viewed?: boolean
  built?: boolean
  equation?: boolean
  isomer?: boolean
  named?: boolean
}

export type OrganicCurriculumProgressMap = Record<string, OrganicLessonProgress>

const STORAGE_KEY = 'atomlab-organic-curriculum-v1'

function readRaw(): OrganicCurriculumProgressMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as OrganicCurriculumProgressMap
  } catch {
    return {}
  }
}

function writeRaw(map: OrganicCurriculumProgressMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadOrganicCurriculumProgress(): OrganicCurriculumProgressMap {
  return readRaw()
}

export function getLessonProgress(
  map: OrganicCurriculumProgressMap,
  lessonId: string,
): OrganicLessonProgress {
  return map[lessonId] ?? {}
}

export function isLessonComplete(
  progress: OrganicLessonProgress,
  opts: {
    requireBuild: boolean
    requireEquation: boolean
    requireIsomer?: boolean
    requireName?: boolean
  },
): boolean {
  if (!progress.viewed) return false
  if (opts.requireBuild && !progress.built) return false
  if (opts.requireEquation && !progress.equation) return false
  if (opts.requireIsomer && !progress.isomer) return false
  if (opts.requireName && !progress.named) return false
  return true
}

export function markLessonProgress(
  lessonId: string,
  patch: Partial<OrganicLessonProgress>,
): OrganicCurriculumProgressMap {
  const map = readRaw()
  const prev = map[lessonId] ?? {}
  map[lessonId] = { ...prev, ...patch }
  writeRaw(map)
  return map
}
