/**
 * GET /admin/live-report — ночной живой отчёт качества (только чтение, только админ — путь в ADMIN_PATHS server.ts).
 * Отчёты пишет задача «ATOMLAB Nightly» (deploy/brain-pc/nightly-eval.ps1 → scripts/brain/nightly-live.mts)
 * в папку BRAIN_REPORTS_DIR (по умолчанию — «reports» рядом с папкой данных: C:\ATOMLAB\reports), файлы live-YYYYMMDD.json.
 *   ?date=YYYYMMDD | YYYY-MM-DD — отчёт за дату; без даты — последний;
 *   ?list=1 — список дат (до 60 последних) с итогом ok и числом проваленных порогов.
 * Пути на диске в ответ не попадают; имя файла собирается только из проверенной даты (без обхода папок).
 */
import fs from 'node:fs'
import type http from 'node:http'
import path from 'node:path'
import { DATA_DIR } from '../config.ts'
import { json, jsonError } from './guard.ts'

export const LIVE_REPORT_PATH = '/admin/live-report'
const FILE_RE = /^live-(\d{8})\.json$/
const MAX_BYTES = 4 * 1024 * 1024

export function liveReportsDir(): string {
  return path.resolve(process.env.BRAIN_REPORTS_DIR || path.join(path.dirname(DATA_DIR), 'reports'))
}

/** Даты отчётов (YYYYMMDD), новые первыми. */
export function listLiveReports(dir = liveReportsDir()): string[] {
  let names: string[] = []
  try {
    names = fs.readdirSync(dir)
  } catch {
    return []
  }
  return names
    .map((n) => FILE_RE.exec(n)?.[1])
    .filter((d): d is string => !!d)
    .sort()
    .reverse()
}

function readReport(dir: string, date: string): Record<string, unknown> | null {
  const file = path.join(dir, `live-${date}.json`)
  try {
    const st = fs.statSync(file)
    if (!st.isFile() || st.size > MAX_BYTES) return null
    // PowerShell мог записать с BOM — срезаем
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) as Record<string, unknown>
  } catch {
    return null
  }
}

const iso = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`

export function handleLiveReport(res: http.ServerResponse, url: URL, cors: Record<string, string>, dir = liveReportsDir()): void {
  const dates = listLiveReports(dir)
  if (url.searchParams.get('list') === '1') {
    const reports = dates.slice(0, 60).map((d) => {
      const r = readReport(dir, d)
      return { date: iso(d), ok: typeof r?.ok === 'boolean' ? r.ok : null, failed: Array.isArray(r?.failed) ? r.failed.length : null }
    })
    return json(res, 200, { ok: true, reports }, cors)
  }
  const q = url.searchParams.get('date')
  let date: string | undefined
  if (q !== null) {
    const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(q.trim())
    if (!m) return jsonError(res, 400, 'bad_request', 'date: YYYYMMDD или YYYY-MM-DD', cors)
    date = `${m[1]}${m[2]}${m[3]}`
  } else date = dates[0]
  const report = date ? readReport(dir, date) : null
  if (!date || !report) return jsonError(res, 404, 'no_report', date ? `нет отчёта за ${iso(date)}` : 'ночных отчётов пока нет', cors)
  return json(res, 200, { ok: true, date: iso(date), dates: dates.slice(0, 14).map(iso), report }, cors)
}
