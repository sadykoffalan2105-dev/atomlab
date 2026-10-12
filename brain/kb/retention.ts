/**
 * Сроки хранения (docs/COMPLIANCE.md, ЗРУ-547 «О персональных данных»): config.server.retention.
 *
 *   dialogDays (90) — записи, пришедшие из диалогов (kind 'dialog', source 'dialog…', тег 'from:dialog', meta.fromDialog),
 *                     старше N дней не участвуют в поиске (Journal.search / векторы), события учеников старше N дней —
 *                     в модели ученика (brain/student/events.ts). Журнал знаний при этом НЕ меняется (append-only).
 *   rotateLogs      — журналы-логи journal/dialogs.jsonl и journal/images.jsonl раз в месяц ПЕРЕИМЕНОВЫВАЮТСЯ в
 *                     journal/archive/<имя>-<ГГГГ-ММ>.jsonl (месяц первой записи). Ничего не удаляется и не усекается:
 *                     в brain/** удалений нет (проверка brain:smoke). Удалить архивы старше срока — владелец,
 *                     scripts/brain/logs-retention.mts (по умолчанию — только показать, --apply — удалить).
 *
 * kb-journal.jsonl (журнал знаний) ротации не подлежит никогда — список файлов ниже закрытый.
 */
import fs from 'node:fs'
import path from 'node:path'

export const RETENTION_DEFAULTS = { dialogDays: 90, rotateLogs: true }

/** Файлы, которые можно ротировать (логи). Журнал знаний сюда не входит и не войдёт. */
export const ROTATABLE_LOGS = ['dialogs.jsonl', 'images.jsonl'] as const

/** Итоговые сроки: config.server.retention поверх умолчаний; dialogDays ≤ 0 — без отсечки. */
export function retentionOf(cfg: { server?: { retention?: { dialogDays?: number; rotateLogs?: boolean } } } | null | undefined): { dialogDays: number; rotateLogs: boolean } {
  const r = cfg?.server?.retention ?? {}
  const d = Number(r.dialogDays)
  return { dialogDays: Number.isFinite(d) ? Math.floor(d) : RETENTION_DEFAULTS.dialogDays, rotateLogs: r.rotateLogs !== false }
}

/** Граница «старше N дней» как ISO-строка (null — без отсечки). */
export function retentionCutoff(days: number, now = Date.now()): string | null {
  if (!(days > 0)) return null
  return new Date(now - days * 24 * 60 * 60_000).toISOString()
}

/** Запись журнала пришла из диалога с учеником (а не из учебника / от владельца). */
export function isDialogDerived(r: { kind?: string; source?: string; tags?: readonly string[]; meta?: Record<string, unknown> }): boolean {
  return (
    r.kind === 'dialog' ||
    (typeof r.source === 'string' && /^dialog\b/i.test(r.source)) ||
    (Array.isArray(r.tags) && r.tags.includes('from:dialog')) ||
    r.meta?.fromDialog === true
  )
}

/** Запись ещё в сроке хранения: не из диалога, или из диалога, но не старше отсечки. */
export function withinRetention(r: { at?: string; kind?: string; source?: string; tags?: readonly string[]; meta?: Record<string, unknown> }, cutoff: string | null): boolean {
  if (!cutoff || !isDialogDerived(r)) return true
  return typeof r.at === 'string' && r.at >= cutoff
}

/** Месяц (ГГГГ-ММ) первой записи лога: по полю at первой строки, иначе по дате изменения файла. */
export function firstRecordMonth(file: string): string | null {
  let fd: number | null = null
  try {
    fd = fs.openSync(file, 'r')
    const buf = Buffer.alloc(64 * 1024)
    const n = fs.readSync(fd, buf, 0, buf.length, 0)
    const first = buf.subarray(0, n).toString('utf8').split('\n').find((l) => l.trim())
    if (!first) return null
    try {
      const at = (JSON.parse(first) as { at?: unknown }).at
      if (typeof at === 'string' && /^\d{4}-\d{2}/.test(at)) return at.slice(0, 7)
    } catch {
      /* первая строка битая — берём дату файла */
    }
    return fs.statSync(file).mtime.toISOString().slice(0, 7)
  } catch {
    return null
  } finally {
    if (fd !== null) fs.closeSync(fd)
  }
}

/**
 * Месячная ротация логов: если первая запись dialogs.jsonl / images.jsonl — из прошлого месяца, файл переименовывается
 * в archive/<имя>-<ГГГГ-ММ>.jsonl (занято — суффикс -2, -3 …); новый лог начнётся со следующей записи (appendLine).
 * Возвращает список «откуда → куда». Ошибки не роняют сервер (лог остаётся на месте до следующей попытки).
 */
export function rotateLogs(journalDir: string, now = new Date(), names: readonly string[] = ROTATABLE_LOGS): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = []
  const month = now.toISOString().slice(0, 7)
  for (const name of names) {
    // закрытый список: журнал знаний и всё прочее не ротируется, даже если имя передали явно
    if (!(ROTATABLE_LOGS as readonly string[]).includes(name)) continue
    const file = path.join(journalDir, name)
    try {
      if (!fs.existsSync(file) || fs.statSync(file).size === 0) continue
      const m = firstRecordMonth(file)
      if (!m || m >= month) continue
      const dir = path.join(journalDir, 'archive')
      fs.mkdirSync(dir, { recursive: true })
      const base = name.replace(/\.jsonl$/, '')
      let to = path.join(dir, `${base}-${m}.jsonl`)
      for (let i = 2; fs.existsSync(to) && i < 100; i++) to = path.join(dir, `${base}-${m}-${i}.jsonl`)
      if (fs.existsSync(to)) continue
      fs.renameSync(file, to)
      out.push({ from: file, to })
    } catch (err) {
      console.warn(`[brain] ротация ${name} не удалась (попробую позже):`, (err as Error).message)
    }
  }
  return out
}

/**
 * Архивные логи старше срока — для scripts/brain/logs-retention.mts. Срок считается по ПОСЛЕДНЕЙ записи (дата
 * изменения файла), а не по месяцу в имени: архив, начатый в сентябре и дописанный в октябре, живёт от октября.
 */
export function expiredArchives(journalDir: string, days: number, now = Date.now()): string[] {
  const dir = path.join(journalDir, 'archive')
  if (!(days > 0) || !fs.existsSync(dir)) return []
  const cutoff = retentionCutoff(days, now)!
  const out: string[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!/^(dialogs|images)-\d{4}-\d{2}(?:-\d+)?\.jsonl$/.test(f)) continue
    const p = path.join(dir, f)
    if (fs.statSync(p).mtime.toISOString() <= cutoff) out.push(p)
  }
  return out.sort()
}
