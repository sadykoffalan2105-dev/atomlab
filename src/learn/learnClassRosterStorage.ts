import type { StudentTestLength } from './studentTestScoring'

export const CLASS_ROSTER_CHANGED = 'atomlab:classRosterChanged'

export type ClassTestAttempt = {
  at: string
  score: number
  total: StudentTestLength
  correct: number
}

export type ClassStudent = {
  id: string
  name: string
  attempts: ClassTestAttempt[]
}

export type ClassRoster = {
  className: string
  students: ClassStudent[]
  activeStudentId: string | null
}

const rosterKey = (sectionId: string) => `atomlab.moleculeClass.${sectionId}`

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
      students: Array.isArray(parsed.students) ? parsed.students : [],
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
  const students = roster.students.map((s) => {
    if (s.id !== studentId) return s
    return {
      ...s,
      attempts: [...s.attempts, { ...result, at: new Date().toISOString() }],
    }
  })
  writeClassRoster(sectionId, { ...roster, students })
}

export function classAverageScore(sectionId: string): number | null {
  const roster = readClassRoster(sectionId)
  const lastScores = roster.students
    .map((s) => s.attempts[s.attempts.length - 1])
    .filter(Boolean) as ClassTestAttempt[]
  if (lastScores.length === 0) return null
  const sum = lastScores.reduce((acc, a) => acc + a.score / a.total, 0)
  return Math.round((sum / lastScores.length) * 100)
}
