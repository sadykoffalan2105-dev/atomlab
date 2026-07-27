import type { StudentTestLength } from './studentTestScoring'

export const CLASS_ROSTER_CHANGED = 'atomlab:classRosterChanged'

/** Отдельный roster для режима задач (/learn/tasks). */
export const TASKS_ROSTER_SECTION_ID = 'learn-tasks-global'

export type StudentTestKind = 'molecule' | 'topic' | 'ai' | 'task' | 'oral' | 'written'

export type ClassTestAttempt = {
  at: string
  kind: StudentTestKind
  score: number
  total: StudentTestLength | number
  correct: number
  wrongQuestionIds?: string[]
  /** Режим задач */
  taskCategoryId?: string
  hintsUsed?: number
}

/** Персональный конспект по пробелам, выданный учителем. */
export type StudentGapConspectRecord = {
  issuedAt: string
  weakIds: string[]
  count: number
}

export type ClassStudent = {
  id: string
  name: string
  attempts: ClassTestAttempt[]
  /** Бонус к рейтингу за работу с конспектами по пробелам (0–15). */
  ratingBonus?: number
  gapConspect?: StudentGapConspectRecord
}

export type ClassRoster = {
  className: string
  students: ClassStudent[]
  activeStudentId: string | null
}

const rosterKey = (sectionId: string) => `atomlab.moleculeClass.${sectionId}`

function normalizeAttempt(raw: Partial<ClassTestAttempt>): ClassTestAttempt {
  const kind = raw.kind ?? 'molecule'
  const totalRaw = raw.total
  const total =
    kind === 'task'
      ? typeof totalRaw === 'number' && totalRaw > 0
        ? totalRaw
        : 5
      : totalRaw === 10
        ? 10
        : 5

  return {
    at: raw.at ?? new Date().toISOString(),
    kind,
    score: raw.score ?? 0,
    total,
    correct: raw.correct ?? 0,
    wrongQuestionIds: Array.isArray(raw.wrongQuestionIds) ? raw.wrongQuestionIds : undefined,
    taskCategoryId: typeof raw.taskCategoryId === 'string' ? raw.taskCategoryId : undefined,
    hintsUsed: typeof raw.hintsUsed === 'number' ? raw.hintsUsed : undefined,
  }
}

function normalizeGapConspect(raw: unknown): StudentGapConspectRecord | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const g = raw as Partial<StudentGapConspectRecord>
  if (typeof g.issuedAt !== 'string') return undefined
  return {
    issuedAt: g.issuedAt,
    weakIds: Array.isArray(g.weakIds) ? g.weakIds.filter((id): id is string => typeof id === 'string') : [],
    count: typeof g.count === 'number' && g.count > 0 ? Math.floor(g.count) : 1,
  }
}

function normalizeStudent(raw: Partial<ClassStudent>): ClassStudent {
  const ratingBonus =
    typeof raw.ratingBonus === 'number' && raw.ratingBonus > 0
      ? Math.min(15, Math.floor(raw.ratingBonus))
      : undefined
  return {
    id: raw.id ?? `stu_${Date.now()}`,
    name: raw.name ?? '',
    attempts: Array.isArray(raw.attempts) ? raw.attempts.map((a) => normalizeAttempt(a)) : [],
    ratingBonus,
    gapConspect: normalizeGapConspect(raw.gapConspect),
  }
}

function emptyRoster(): ClassRoster {
  return { className: '', students: [], activeStudentId: null }
}

export function parsePastedNames(text: string): string[] {
  return text
    .split(/[\n\r\t,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function readClassRoster(sectionId: string): ClassRoster {
  try {
    const raw = localStorage.getItem(rosterKey(sectionId))
    if (!raw) return emptyRoster()
    const parsed = JSON.parse(raw) as ClassRoster
    return {
      className: parsed.className ?? '',
      students: Array.isArray(parsed.students) ? parsed.students.map((s) => normalizeStudent(s)) : [],
      activeStudentId: parsed.activeStudentId ?? null,
    }
  } catch {
    return emptyRoster()
  }
}

export function writeClassRoster(sectionId: string, roster: ClassRoster) {
  localStorage.setItem(rosterKey(sectionId), JSON.stringify(roster))
  window.dispatchEvent(new CustomEvent(CLASS_ROSTER_CHANGED, { detail: { sectionId } }))
}

export function importClassNames(sectionId: string, className: string, names: string[]) {
  const prev = readClassRoster(sectionId)
  const students: ClassStudent[] = names.map((name, i) => {
    const existing = prev.students.find((s) => s.name.toLowerCase() === name.toLowerCase())
    return existing ?? { id: `stu_${Date.now()}_${i}`, name, attempts: [] }
  })
  writeClassRoster(sectionId, {
    className: className.trim() || prev.className,
    students,
    activeStudentId: students[0]?.id ?? null,
  })
}

export function setActiveStudent(sectionId: string, studentId: string | null) {
  const roster = readClassRoster(sectionId)
  writeClassRoster(sectionId, { ...roster, activeStudentId: studentId })
}

export function getActiveStudent(sectionId: string): ClassStudent | null {
  const roster = readClassRoster(sectionId)
  if (!roster.activeStudentId) return null
  return roster.students.find((s) => s.id === roster.activeStudentId) ?? null
}

export function recordStudentTestResult(
  sectionId: string,
  studentId: string,
  result: Omit<ClassTestAttempt, 'at'>,
) {
  const roster = readClassRoster(sectionId)
  const attempt = normalizeAttempt(result)
  const students = roster.students.map((s) => {
    if (s.id !== studentId) return s
    return {
      ...s,
      attempts: [...s.attempts, attempt],
    }
  })
  writeClassRoster(sectionId, { ...roster, students })
}

export function recordStudentTaskResult(
  sectionId: string,
  studentId: string,
  result: {
    taskCategoryId: string
    correct: boolean
    hintsUsed: number
    score: number
    total: number
  },
) {
  recordStudentTestResult(sectionId, studentId, {
    kind: 'task',
    score: result.score,
    total: result.total,
    correct: result.correct ? 1 : 0,
    taskCategoryId: result.taskCategoryId,
    hintsUsed: result.hintsUsed,
  })
}

export function getStudentById(sectionId: string, studentId: string): ClassStudent | null {
  const roster = readClassRoster(sectionId)
  return roster.students.find((s) => s.id === studentId) ?? null
}

/** Учитель выдал персональный конспект по пробелам — фиксируем и даём бонус к рейтингу. */
export function recordGapConspectIssued(
  sectionId: string,
  studentId: string,
  weakIds: string[],
): ClassStudent | null {
  const roster = readClassRoster(sectionId)
  let updated: ClassStudent | null = null
  const students = roster.students.map((s) => {
    if (s.id !== studentId) return s
    const prevCount = s.gapConspect?.count ?? 0
    const nextBonus = Math.min(15, (s.ratingBonus ?? 0) + 5)
    updated = {
      ...s,
      ratingBonus: nextBonus,
      gapConspect: {
        issuedAt: new Date().toISOString(),
        weakIds: weakIds.slice(0, 16),
        count: prevCount + 1,
      },
    }
    return updated
  })
  if (!updated) return null
  writeClassRoster(sectionId, { ...roster, students })
  return updated
}

export function lastAttemptForKind(
  student: ClassStudent,
  kind: StudentTestKind,
): ClassTestAttempt | null {
  for (let i = student.attempts.length - 1; i >= 0; i--) {
    const a = student.attempts[i]
    if ((a?.kind ?? 'molecule') === kind) return a ?? null
  }
  return null
}

export function classAverageScore(sectionId: string): number | null {
  const roster = readClassRoster(sectionId)
  const lastScores = roster.students
    .map((s) => {
      const last = s.attempts[s.attempts.length - 1]
      return last
    })
    .filter(Boolean) as ClassTestAttempt[]
  if (lastScores.length === 0) return null
  const sum = lastScores.reduce((acc, a) => acc + a.score / a.total, 0)
  return Math.round((sum / lastScores.length) * 100)
}
