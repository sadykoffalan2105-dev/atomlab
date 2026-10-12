/**
 * npm run brain:live-report — на ноутбуке владельца: забрать ночной живой отчёт с сервера мозга
 * (GET /admin/live-report, ключ админа) и записать docs/plans/live-report.md (+ сырой JSON рядом — live-report.json).
 *
 *   npm run brain:live-report                       — адрес из public/brain.json urls[0], ключ из env BRAIN_ADMIN_TOKEN
 *   npm run brain:live-report -- --url=https://… --admin=<ключ> --date=2026-10-12 --out=docs/plans/live-report.md
 *   npm run brain:live-report -- --file=live-20261012.json   — без сети: из файла (скопирован с C:\ATOMLAB\reports)
 * Ключ админа — C:\ATOMLAB\secrets\admin-token.txt на сервере; в репозиторий его не класть (только env или --admin).
 * Код выхода: 0 — отчёт записан (даже если пороги провалены: это видно в самом отчёте), 2 — отчёт получить не удалось.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { consoleLines, renderMarkdown, type LiveReport } from './liveReportLib.mts'

const ROOT = path.resolve(import.meta.dirname, '..', '..')

export type FetchedReport = { report: LiveReport; history: { date: string; ok: boolean | null; failed: number | null }[] }

/** /admin/live-report (+ ?list=1 для истории). Бросает понятную ошибку: сервер молчит, 403, 404. */
export async function fetchLiveReport(url: string, admin: string, date?: string): Promise<FetchedReport> {
  const base = url.replace(/\/+$/, '')
  const H = { 'X-Brain-Admin': admin }
  const q = date ? `?date=${encodeURIComponent(date)}` : ''
  let res: Response
  try {
    res = await fetch(`${base}/admin/live-report${q}`, { headers: H, signal: AbortSignal.timeout(20_000) })
  } catch (e) {
    throw new Error(`сервер ${base} не отвечает (${(e as Error).message})`)
  }
  const j = (await res.json().catch(() => null)) as { ok?: boolean; report?: LiveReport; error?: { message?: string } | string; message?: string } | null
  if (res.status === 403) throw new Error('403: неверный ключ админа (BRAIN_ADMIN_TOKEN / --admin)')
  if (!res.ok || !j?.report) throw new Error(`HTTP ${res.status}: ${typeof j?.error === 'string' ? j.error : (j?.error?.message ?? j?.message ?? 'нет отчёта')}`)
  let history: FetchedReport['history'] = []
  try {
    const l = (await (await fetch(`${base}/admin/live-report?list=1`, { headers: H, signal: AbortSignal.timeout(20_000) })).json()) as { reports?: FetchedReport['history'] }
    history = (l.reports ?? []).filter((h) => h.date !== j.report!.date).slice(0, 14)
  } catch {
    /* история — необязательна */
  }
  return { report: j.report, history }
}

/** Записать Markdown и JSON; вернуть путь .md. */
export function writeLiveReport(out: string, f: FetchedReport): string {
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, renderMarkdown(f.report, f.history))
  fs.writeFileSync(out.replace(/\.md$/i, '') + '.json', JSON.stringify(f.report, null, 1) + '\n')
  return out
}

async function main(): Promise<number> {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  const out = path.resolve(ROOT, arg('out') ?? path.join('docs', 'plans', 'live-report.md'))
  let fetched: FetchedReport
  try {
    const file = arg('file')
    if (file) fetched = { report: JSON.parse(fs.readFileSync(path.resolve(file), 'utf8').replace(/^\uFEFF/, '')) as LiveReport, history: [] }
    else {
      const url = arg('url') ?? (JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'brain.json'), 'utf8')) as { urls: string[] }).urls[0]
      const admin = arg('admin') ?? process.env.BRAIN_ADMIN_TOKEN ?? ''
      if (!url || !admin.trim()) {
        console.error('[live-report] нужно: адрес (--url или public/brain.json) и ключ админа (env BRAIN_ADMIN_TOKEN или --admin)')
        return 2
      }
      fetched = await fetchLiveReport(url, admin.trim(), arg('date'))
    }
  } catch (e) {
    console.error(`[live-report] ${(e as Error).message}`)
    return 2
  }
  for (const line of consoleLines(fetched.report, process.stdout.isTTY === true)) console.log(line)
  console.log(`[live-report] ${fetched.report.date}: ${path.relative(ROOT, writeLiveReport(out, fetched))}`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main()
