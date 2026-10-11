/**
 * Журнал картинок journal/images.jsonl — только дописывание (brain/kb/storage.ts → appendLine), адрес не пишется
 * никогда, текст запроса — только у владельца и учителя (у ученика — лишь хеш и id темы). Подчиняется
 * server.dialogLog: 'off' — не писать, 'local' — только владелец с этого ПК. Файлы картинок на диск не сохраняются.
 */
import path from 'node:path'
import { DIRS } from '../config.ts'
import { appendLine, textHash } from '../kb/storage.ts'
import type { ImageRole, ImageSafety, ImageTimings } from './types.ts'

export type ImageJournalRow = {
  id: string
  at: string
  role: ImageRole
  studentId?: string
  sessionId: string
  presetId?: string
  prompt?: string
  promptHash: string
  engine: string
  variant: string
  size: string
  seed: number
  ms: number
  timings: ImageTimings
  safety?: ImageSafety
  outcome: 'ok' | 'unsafe_prompt' | 'unsafe_image' | 'error' | 'busy'
  reason?: string
}

export function imagesJournalPath(): string {
  return path.join(DIRS.journal, 'images.jsonl')
}

/**
 * Записать строку (или ничего — по правилу dialogLog). promptText — что хешировать (текст запроса или id темы);
 * prompt ученика отбрасывается здесь же, на всякий случай.
 */
export function journalImage(row: ImageJournalRow & { promptText?: string }, o: { dialogLog: 'all' | 'local' | 'off'; local: boolean; noJournal?: boolean }): void {
  if (o.noJournal || o.dialogLog === 'off' || (o.dialogLog === 'local' && !o.local)) return
  const { promptText, ...rest } = row
  const out: ImageJournalRow = { ...rest, promptHash: promptText ? textHash(promptText) : rest.promptHash }
  if (row.role === 'student') delete out.prompt
  else if (out.prompt) out.prompt = out.prompt.slice(0, 500)
  try {
    appendLine(imagesJournalPath(), out)
  } catch (err) {
    console.warn('[image] журнал не записан:', (err as Error).message)
  }
}
