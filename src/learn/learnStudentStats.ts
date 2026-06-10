import type { ClassStudent, ClassTestAttempt, StudentTestKind } from './learnClassRosterStorage'

export type KindStats = {
  attempts: number
  avgPct: number | null
  last: ClassTestAttempt | null
}

export type ProgressPoint = {
  at: string
  pct: number
  kind: StudentTestKind
  label?: string
}

export type ProgressTrend = 'rising' | 'falling' | 'stable' | 'none'

export type StudentMasteryStats = {
  student: ClassStudent
  byKind: Record<StudentTestKind, KindStats>
  overallAvgPct: number | null
  masteryLevel: 'strong' | 'good' | 'needsWork' | 'none'
  recentAttempts: ClassTestAttempt[]
  progressSeries: ProgressPoint[]
  progressTrend: ProgressTrend
}

function attemptPct(a: ClassTestAttempt): number {
  return a.total > 0 ? Math.round((a.score / a.total) * 100) : 0
}

function normalizeKind(kind: ClassTestAttempt['kind'] | undefined): StudentTestKind {
  return kind ?? 'molecule'
}

function kindStats(attempts: ClassTestAttempt[], kind: StudentTestKind): KindStats {
  const filtered = attempts.filter((a) => normalizeKind(a.kind) === kind)
  if (filtered.length === 0) {
    return { attempts: 0, avgPct: null, last: null }
  }
  const sum = filtered.reduce((acc, a) => acc + attemptPct(a), 0)
  return {
    attempts: filtered.length,
    avgPct: Math.round(sum / filtered.length),
    last: filtered[filtered.length - 1] ?? null,
  }
}

export function buildProgressSeries(student: ClassStudent, maxPoints = 16): ProgressPoint[] {
  return student.attempts.slice(-maxPoints).map((a) => ({
    at: a.at,
    pct: attemptPct(a),
    kind: normalizeKind(a.kind),
    label: a.taskCategoryId,
  }))
}

export function computeProgressTrend(series: ProgressPoint[]): ProgressTrend {
  if (series.length < 2) return series.length === 0 ? 'none' : 'stable'

  const firstHalf = series.slice(0, Math.floor(series.length / 2))
  const secondHalf = series.slice(Math.floor(series.length / 2))
  const avg = (pts: ProgressPoint[]) =>
    pts.reduce((s, p) => s + p.pct, 0) / Math.max(pts.length, 1)

  const delta = avg(secondHalf) - avg(firstHalf)
  if (delta >= 8) return 'rising'
  if (delta <= -8) return 'falling'
  return 'stable'
}

export function computeStudentMastery(student: ClassStudent): StudentMasteryStats {
  const attempts = student.attempts
  const byKind: Record<StudentTestKind, KindStats> = {
    molecule: kindStats(attempts, 'molecule'),
    topic: kindStats(attempts, 'topic'),
    ai: kindStats(attempts, 'ai'),
    oral: kindStats(attempts, 'oral'),
    written: kindStats(attempts, 'written'),
    task: kindStats(attempts, 'task'),
  }

  const progressSeries = buildProgressSeries(student)
  const progressTrend = computeProgressTrend(progressSeries)
  const lastAttempts = attempts.slice(-10).reverse()
  const lastScores = attempts.map(attemptPct)
  const overallAvgPct =
    lastScores.length > 0
      ? Math.round(lastScores.reduce((a, b) => a + b, 0) / lastScores.length)
      : null

  let masteryLevel: StudentMasteryStats['masteryLevel'] = 'none'
  if (overallAvgPct !== null) {
    if (overallAvgPct >= 85) masteryLevel = 'strong'
    else if (overallAvgPct >= 65) masteryLevel = 'good'
    else masteryLevel = 'needsWork'
  }

  return {
    student,
    byKind,
    overallAvgPct,
    masteryLevel,
    recentAttempts: lastAttempts,
    progressSeries,
    progressTrend,
  }
}

export function collectWeakTopics(attempts: ClassTestAttempt[]): string[] {
  const ids = new Set<string>()
  for (const a of attempts) {
    for (const id of a.wrongQuestionIds ?? []) ids.add(id)
  }
  return [...ids].slice(0, 8)
}
