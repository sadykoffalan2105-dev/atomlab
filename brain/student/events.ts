/**
 * События ученика: students/<studentId>.jsonl — только дописывание (turn, error_tag, feedback, mood).
 * Снимок модели ученика считается из событий при чтении (brain/student/model.ts); события кешируются в памяти.
 */
import fs from 'node:fs'
import path from 'node:path'
import { DIRS } from '../config.ts'
import { appendLine, readJsonl, safeStudentFile } from '../kb/storage.ts'
import { retentionCutoff } from '../kb/retention.ts'

export type StudentEventType = 'turn' | 'error_tag' | 'feedback' | 'mood'
export type StudentEvent = {
  at: string
  type: StudentEventType
  sessionId?: string
  intent?: string
  /** длина реплики ученика */
  len?: number
  /** «верные шаги» в реплике: уравненное уравнение, совпавший ответ */
  good?: number
  tag?: string
  mood?: string
  value?: number
  grade?: string
}

export class StudentStore {
  private cache = new Map<string, StudentEvent[]>()
  private readonly dir: string
  /** Срок хранения (brain/kb/retention.ts): события старше N дней не влияют на модель ученика; файл не меняется. 0 — без отсечки. */
  retentionDays = 0

  constructor(dir = DIRS.students) {
    this.dir = dir
  }

  file(studentId: string): string {
    return path.join(this.dir, `${safeStudentFile(studentId)}.jsonl`)
  }

  events(studentId: string): StudentEvent[] {
    const list = this.all(studentId)
    const cutoff = retentionCutoff(this.retentionDays)
    return cutoff ? list.filter((e) => typeof e.at === 'string' && e.at >= cutoff) : list
  }

  /** Все события из файла (кеш), без отсечки по сроку. */
  private all(studentId: string): StudentEvent[] {
    let list = this.cache.get(studentId)
    if (!list) {
      list = fs.existsSync(this.file(studentId)) ? readJsonl<StudentEvent>(this.file(studentId)).rows : []
      this.cache.set(studentId, list)
      if (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value!)
    }
    return list
  }

  append(studentId: string, ev: Omit<StudentEvent, 'at'> & { at?: string }): StudentEvent {
    const full: StudentEvent = { at: ev.at ?? new Date().toISOString(), ...ev } as StudentEvent
    const list = this.all(studentId)
    appendLine(this.file(studentId), full)
    list.push(full)
    return full
  }
}
