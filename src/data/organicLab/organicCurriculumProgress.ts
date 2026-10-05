/**
 * Прогресс уроков органической лаборатории (localStorage).
 * v2 (органика v2): флаги по режимам страницы; ключ `atomlab-organic-v2-progress`.
 * Старый ключ v1 (`viewed/built/equation/isomer/named`) при первом чтении переносится в v2 и остаётся на месте.
 */
import type { OV2Mode } from './organicLessonsV2'

/** v1 — оставлен для миграции и старых проверок. */
export type OrganicLessonProgress = {
  viewed?: boolean
  built?: boolean
  equation?: boolean
  isomer?: boolean
  named?: boolean
}

export type OrganicCurriculumProgressMap = Record<string, OrganicLessonProgress>

const STORAGE_KEY = 'atomlab-organic-curriculum-v1'
export const ORGANIC_PROGRESS_V2_KEY = 'atomlab-organic-v2-progress'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* приватный режим / квота */
  }
}

export function loadOrganicCurriculumProgress(): OrganicCurriculumProgressMap {
  return readJson<OrganicCurriculumProgressMap>(STORAGE_KEY) ?? {}
}

export function getLessonProgress(map: OrganicCurriculumProgressMap, lessonId: string): OrganicLessonProgress {
  return map[lessonId] ?? {}
}

export function isLessonComplete(
  progress: OrganicLessonProgress,
  opts: { requireBuild: boolean; requireEquation: boolean; requireIsomer?: boolean; requireName?: boolean },
): boolean {
  if (!progress.viewed) return false
  if (opts.requireBuild && !progress.built) return false
  if (opts.requireEquation && !progress.equation) return false
  if (opts.requireIsomer && !progress.isomer) return false
  if (opts.requireName && !progress.named) return false
  return true
}

export function markLessonProgress(lessonId: string, patch: Partial<OrganicLessonProgress>): OrganicCurriculumProgressMap {
  const map = loadOrganicCurriculumProgress()
  map[lessonId] = { ...(map[lessonId] ?? {}), ...patch }
  writeJson(STORAGE_KEY, map)
  return map
}

/* ── v2 ─────────────────────────────────────────────────────────────── */

/** Пройденные режимы урока. */
export type OV2LessonProgress = Partial<Record<OV2Mode, true>>
export type OV2ProgressMap = Record<string, OV2LessonProgress>

/** v1 → v2: viewed→molecule, built→constructor, equation→reactions, isomer→isomers, named→name. */
export function migrateProgressV1(v1: OrganicCurriculumProgressMap): OV2ProgressMap {
  const out: OV2ProgressMap = {}
  for (const [id, p] of Object.entries(v1)) {
    const v2: OV2LessonProgress = {}
    if (p.viewed) v2.molecule = true
    if (p.built) v2.constructor = true
    if (p.equation) v2.reactions = true
    if (p.isomer) v2.isomers = true
    if (p.named) v2.name = true
    if (Object.keys(v2).length) out[id] = v2
  }
  return out
}

export function loadProgressV2(): OV2ProgressMap {
  const v2 = readJson<OV2ProgressMap>(ORGANIC_PROGRESS_V2_KEY)
  if (v2) return v2
  const migrated = migrateProgressV1(loadOrganicCurriculumProgress())
  writeJson(ORGANIC_PROGRESS_V2_KEY, migrated)
  return migrated
}

export function markModeDone(lessonId: string, mode: OV2Mode): OV2ProgressMap {
  const map = loadProgressV2()
  if (map[lessonId]?.[mode]) return map
  map[lessonId] = { ...(map[lessonId] ?? {}), [mode]: true }
  writeJson(ORGANIC_PROGRESS_V2_KEY, map)
  return map
}

/** Урок пройден, когда пройдены все его режимы. */
export function isLessonDoneV2(p: OV2LessonProgress | undefined, modes: readonly OV2Mode[]): boolean {
  return modes.length > 0 && modes.every((m) => p?.[m])
}

/** Доля пройденных режимов урока 0..1 (для кольца прогресса). */
export function lessonShareV2(p: OV2LessonProgress | undefined, modes: readonly OV2Mode[]): number {
  if (!modes.length) return 0
  return modes.filter((m) => p?.[m]).length / modes.length
}
