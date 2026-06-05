const CLASSES_KEY = 'atomlab-teacher-classes-v1'
const ASSIGNMENTS_KEY = 'atomlab-teacher-assignments-v1'

export type TeacherClass = {
  id: string
  name: string
  gradeId: string
  createdAt: number
}

export type TeacherAssignment = {
  id: string
  classId: string
  sectionPathIds: string[]
  title: string
  dueLabel?: string
  createdAt: number
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function readTeacherClasses(): TeacherClass[] {
  return readJson<TeacherClass[]>(CLASSES_KEY, [])
}

export function saveTeacherClass(cls: TeacherClass): void {
  const list = readTeacherClasses().filter((c) => c.id !== cls.id)
  list.push(cls)
  writeJson(CLASSES_KEY, list)
}

export function deleteTeacherClass(id: string): void {
  writeJson(
    CLASSES_KEY,
    readTeacherClasses().filter((c) => c.id !== id),
  )
  writeJson(
    ASSIGNMENTS_KEY,
    readTeacherAssignments().filter((a) => a.classId !== id),
  )
}

export function readTeacherAssignments(): TeacherAssignment[] {
  return readJson<TeacherAssignment[]>(ASSIGNMENTS_KEY, [])
}

export function saveTeacherAssignment(a: TeacherAssignment): void {
  const list = readTeacherAssignments().filter((x) => x.id !== a.id)
  list.push(a)
  writeJson(ASSIGNMENTS_KEY, list)
}

export function deleteTeacherAssignment(id: string): void {
  writeJson(
    ASSIGNMENTS_KEY,
    readTeacherAssignments().filter((a) => a.id !== id),
  )
}

export function newTeacherId(): string {
  return crypto.randomUUID()
}

export function exportProgressReport(progressJson: string): string {
  return progressJson
}
