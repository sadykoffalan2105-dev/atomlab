/**
 * Хранилище «мозга»: единственные функции записи на диск.
 *
 *   appendLine()   — журнал и события учеников: ТОЛЬКО дописывание в конец (флаг 'a'), ничего не удаляется;
 *   writeDerived() — пересобираемые файлы, и только внутри derived/ (проверка пути).
 *
 * В brain/** нет ни одного вызова удаления/усечения файлов журнала — так база только растёт.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DIRS } from '../config.ts'

/** Дописать одну JSON-строку в конец файла (append-only). Возвращает записанную строку. */
export function appendLine(file: string, obj: unknown): string {
  const line = JSON.stringify(obj)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.appendFileSync(file, line + '\n', { flag: 'a', encoding: 'utf8' })
  return line
}

/** Дописать пачку JSON-строк одним вызовом (сборка корпуса) — тоже только в конец файла. */
export function appendLines(file: string, objs: readonly unknown[]): void {
  if (!objs.length) return
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.appendFileSync(file, objs.map((o) => JSON.stringify(o)).join('\n') + '\n', { flag: 'a', encoding: 'utf8' })
}

/** Прочитать JSONL; битые строки пропускаются (их номер всё равно учитывается в счётчике строк). */
export function readJsonl<T>(file: string): { rows: T[]; lines: number; bytes: number } {
  if (!fs.existsSync(file)) return { rows: [], lines: 0, bytes: 0 }
  const raw = fs.readFileSync(file, 'utf8')
  const rows: T[] = []
  let lines = 0
  let start = 0
  while (start < raw.length) {
    let end = raw.indexOf('\n', start)
    if (end < 0) end = raw.length
    const s = raw.slice(start, end).trim()
    start = end + 1
    if (!s) continue
    lines++
    try {
      rows.push(JSON.parse(s) as T)
    } catch {
      /* битая строка: не падаем, журнал не трогаем */
    }
  }
  return { rows, lines, bytes: Buffer.byteLength(raw, 'utf8') }
}

/** Запись пересобираемого файла — разрешена только внутри derived/. */
export function writeDerived(absPath: string, data: string | Uint8Array): void {
  const rel = path.relative(DIRS.derived, absPath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`writeDerived: путь вне derived/: ${absPath}`)
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  fs.writeFileSync(absPath, data)
}

/** Дописать байты в файл внутри derived/ (векторы эмбеддингов). */
export function appendDerived(absPath: string, data: Uint8Array): void {
  const rel = path.relative(DIRS.derived, absPath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`appendDerived: путь вне derived/: ${absPath}`)
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  fs.appendFileSync(absPath, data, { flag: 'a' })
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** ULID: 48 бит времени + 80 бит случайности, Crockford base32 (26 символов). */
export function ulid(now = Date.now()): string {
  let t = now
  let time = ''
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time
    t = Math.floor(t / 32)
  }
  const rnd = crypto.randomBytes(16)
  let r = ''
  for (let i = 0; i < 16; i++) r += CROCKFORD[rnd[i]! % 32]
  return time + r
}

/** Нормализация текста для хеша: NFC, нижний регистр, ё→е, без пунктуации и лишних пробелов. */
export function normForHash(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[ʻʼ‘’`´']/g, "'")
    .replace(/[^\p{L}\p{N}'+\-=→]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sha1(text: string): string {
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex')
}

export function textHash(text: string): string {
  return sha1(normForHash(text))
}

/** Имя файла ученика: только безопасные символы, иначе хеш. */
export function safeStudentFile(studentId: string): string {
  const id = String(studentId || 'anon').trim()
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : `h-${sha1(id).slice(0, 16)}`
}
