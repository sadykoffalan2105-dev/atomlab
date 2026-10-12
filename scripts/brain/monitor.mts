/**
 * npm run brain:monitor — внешний монитор доступности сервера мозга (ноутбук владельца, nextBuild #1).
 * Раз в 5 минут GET <адрес>/health через Funnel: up / degraded (отвечает, но LLM недоступна или идёт загрузка) / down.
 * Журнал — JSONL (по строке на проверку), состояние — JSON (переживает перезапуски: задача планировщика с --once).
 * Смена статуса печатается; по желанию — сообщение в Telegram (бот владельца). Ключи — только из env, не из репозитория.
 *
 *   npm run brain:monitor                          — цикл: проверка каждые 5 мин (--every=минуты)
 *   npm run brain:monitor -- --once                — одна проверка (для «Планировщика заданий» Windows каждые 5 мин)
 *   npm run brain:monitor -- --summary [--md=docs/plans/brain-availability.md]  — доступность за 24 ч / 7 дней из журнала
 *   --url=https://…         (по умолчанию public/brain.json urls[0])
 *   --dir=папка             журнал и состояние (по умолчанию .tmp/brain-monitor: log.jsonl, state.json)
 *   --fail-after=2          сколько проверок подряд «плохо», прежде чем сообщать (дребезг Funnel/DNS)
 *   --remind-hours=6        напоминание, пока сервер лежит (0 — не напоминать)
 *   --timeout=15            секунд на ответ /health
 *   --env-file=путь         KEY=VALUE вне репозитория (например %USERPROFILE%\atomlab-monitor.env)
 * Telegram (необязательно): env ATOMLAB_TG_TOKEN (токен бота от @BotFather) и ATOMLAB_TG_CHAT (id чата владельца).
 * Код выхода --once: 0 — up, 1 — degraded/down (планировщику это не мешает; удобно для отладки).
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(import.meta.dirname, '..', '..')

export type Status = 'up' | 'degraded' | 'down'
export interface Probe {
  ts: string
  status: Status
  ms: number
  http: number | null
  error?: string
  llm?: boolean
  model?: string | null
  image?: boolean
  stt?: boolean
  version?: string | null
}
export interface MonitorState {
  status: Status | 'unknown'
  since: string
  lastTs: string | null
  pending: { status: Status; count: number } | null
  lastNotifiedTs: string | null
  checks: number
}
export interface Change {
  from: Status | 'unknown'
  to: Status
  /** сколько длился прошлый статус, мс */
  lastedMs: number
  reminder?: boolean
}

export const freshState = (ts = new Date().toISOString()): MonitorState => ({ status: 'unknown', since: ts, lastTs: null, pending: null, lastNotifiedTs: null, checks: 0 })

/** Одна проверка /health. Таймаут/сеть/не-200/не-JSON → down; LLM недоступна или loading → degraded. */
export async function probe(url: string, timeoutMs = 15_000): Promise<Probe> {
  const ts = new Date().toISOString()
  const t0 = performance.now()
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/health`, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'atomlab-monitor' } })
    const ms = Math.round(performance.now() - t0)
    const j = (await res.json().catch(() => null)) as { ok?: boolean; version?: string; loading?: boolean; llm?: { available?: boolean; chatModel?: string | null }; image?: { enabled?: boolean; ready?: boolean }; stt?: { available?: boolean } } | null
    if (!res.ok || !j || j.ok !== true) return { ts, status: 'down', ms, http: res.status, error: j ? 'ok != true' : 'не JSON' }
    const llm = j.llm?.available === true
    const status: Status = llm && !j.loading ? 'up' : 'degraded'
    return { ts, status, ms, http: res.status, llm, model: j.llm?.chatModel ?? null, image: j.image?.enabled ? j.image.ready === true : undefined, stt: j.stt?.available === true, version: j.version ?? null, ...(status === 'degraded' ? { error: j.loading ? 'загрузка базы' : 'LLM недоступна' } : {}) }
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string; errors?: { code?: string }[] } }
    const why = err.cause?.code ?? err.cause?.errors?.[0]?.code ?? err.cause?.message ?? err.message
    return { ts, status: 'down', ms: Math.round(performance.now() - t0), http: null, error: err.name === 'TimeoutError' ? `нет ответа за ${Math.round(timeoutMs / 1000)} с` : String(why).slice(0, 120) }
  }
}

/**
 * Переход состояния. Восстановление (up) — сразу; ухудшение — после failAfter проверок подряд с тем же статусом.
 * Пока сервер не up, раз в remindMs — напоминание (change.reminder).
 */
export function step(prev: MonitorState, p: Probe, failAfter = 2, remindMs = 6 * 3600_000): { state: MonitorState; change: Change | null } {
  const s: MonitorState = { ...prev, lastTs: p.ts, checks: prev.checks + 1 }
  const lasted = (to: Status): Change => ({ from: prev.status, to, lastedMs: Date.parse(p.ts) - Date.parse(prev.since) })
  if (p.status === prev.status) {
    s.pending = null
    if (p.status !== 'up' && remindMs > 0 && prev.lastNotifiedTs && Date.parse(p.ts) - Date.parse(prev.lastNotifiedTs) >= remindMs) {
      s.lastNotifiedTs = p.ts
      return { state: s, change: { ...lasted(p.status), reminder: true } }
    }
    return { state: s, change: null }
  }
  const count = prev.pending?.status === p.status ? prev.pending.count + 1 : 1
  if (p.status === 'up' || count >= failAfter) {
    const change = lasted(p.status)
    Object.assign(s, { status: p.status, since: p.ts, pending: null })
    // первый запуск монитора на живом сервере — без сообщения (только печать)
    if (prev.status === 'unknown' && p.status === 'up') return { state: s, change: null }
    s.lastNotifiedTs = p.ts
    return { state: s, change }
  }
  s.pending = { status: p.status, count }
  return { state: s, change: null }
}

const dur = (ms: number) => {
  const m = Math.round(ms / 60_000)
  return m < 60 ? `${m} мин` : m < 48 * 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${Math.round(m / 1440)} дн.`
}
const ICON: Record<Status, string> = { up: '[OK]', degraded: '[!]', down: '[!!!]' }
const WORD: Record<Status, string> = { up: 'работает', degraded: 'отвечает, но без модели', down: 'НЕ отвечает' }

export function message(c: Change, p: Probe, url: string): string {
  const host = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (c.reminder) return `${ICON[c.to]} ATOMLAB: сервер мозга всё ещё ${WORD[c.to]} — уже ${dur(c.lastedMs)} (${host}). ${p.error ?? ''}`.trim()
  const head = `${ICON[c.to]} ATOMLAB: сервер мозга ${WORD[c.to]} (${host})`
  if (c.to === 'up') return `${head}${c.from !== 'unknown' ? ` — простой ${dur(c.lastedMs)}` : ''}. Модель ${p.model ?? '—'}, ответ ${p.ms} мс.`
  return `${head}: ${p.error ?? `HTTP ${p.http}`}. Что делать — docs/BRAIN_SERVER.md, раздел «Наблюдение».`
}

/** Сообщение в Telegram; без ключей — молча пропускаем. Токен в журнал не попадает. */
export async function notifyTelegram(text: string, env: NodeJS.ProcessEnv = process.env): Promise<'sent' | 'off' | string> {
  const token = env.ATOMLAB_TG_TOKEN?.trim()
  const chat = env.ATOMLAB_TG_CHAT?.trim()
  if (!token || !chat) return 'off'
  const api = (env.ATOMLAB_TG_API?.trim() || 'https://api.telegram.org').replace(/\/+$/, '')
  try {
    const r = await fetch(`${api}/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }), signal: AbortSignal.timeout(15_000) })
    return r.ok ? 'sent' : `Telegram HTTP ${r.status}`
  } catch (e) {
    return `Telegram: ${String((e as Error).message).replace(token, '***')}`
  }
}

/** KEY=VALUE (# — комментарий) → env, не перезаписывая уже заданное. */
export function loadEnvFile(file: string, env: NodeJS.ProcessEnv = process.env): number {
  let n = 0
  for (const line of fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (!m || line.trim().startsWith('#')) continue
    if (env[m[1]!] === undefined) {
      env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
      n++
    }
  }
  return n
}

export function readState(file: string): MonitorState {
  try {
    return { ...freshState(), ...(JSON.parse(fs.readFileSync(file, 'utf8')) as MonitorState) }
  } catch {
    return freshState()
  }
}

/** Журнал JSONL; больше 2 МБ — оставляем последние 40 дней. */
export function appendLog(file: string, p: Probe): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.appendFileSync(file, JSON.stringify(p) + '\n')
  try {
    if (fs.statSync(file).size > 2 * 1024 * 1024) {
      const edge = Date.now() - 40 * 86400_000
      const keep = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() && Date.parse((JSON.parse(l) as Probe).ts) >= edge)
      fs.writeFileSync(file, keep.join('\n') + '\n')
    }
  } catch {
    /* обрезка журнала — необязательна */
  }
}

export function readLog(file: string): Probe[] {
  try {
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as Probe)
  } catch {
    return []
  }
}

/** Доступность за окно: доля проверок up (degraded считается половиной — сайт отвечает запасным путём). */
export function availability(log: Probe[], windowMs: number, now = Date.now()): { n: number; up: number; degraded: number; down: number; share: number | null; p95Ms: number | null } {
  const rows = log.filter((p) => now - Date.parse(p.ts) <= windowMs)
  const c = { up: 0, degraded: 0, down: 0 }
  for (const p of rows) c[p.status]++
  const ms = rows.filter((p) => p.status !== 'down').map((p) => p.ms).sort((a, b) => a - b)
  return { n: rows.length, ...c, share: rows.length ? (c.up + c.degraded / 2) / rows.length : null, p95Ms: ms.length ? ms[Math.min(ms.length - 1, Math.ceil(0.95 * ms.length) - 1)]! : null }
}

export function summaryMarkdown(log: Probe[], url: string, now = Date.now()): string {
  const L = [`# Доступность сервера мозга`, '', `Внешний монитор \`npm run brain:monitor\` (ноутбук владельца, GET /health каждые 5 мин) · ${url} · собрано ${new Date(now).toISOString().slice(0, 16).replace('T', ' ')} UTC`, '', '| Окно | Проверок | up | degraded | down | Доступность | /health p95 |', '|---|---|---|---|---|---|---|']
  for (const [name, w] of [['24 часа', 86400_000], ['7 дней', 7 * 86400_000], ['30 дней', 30 * 86400_000]] as const) {
    const a = availability(log, w, now)
    L.push(`| ${name} | ${a.n} | ${a.up} | ${a.degraded} | ${a.down} | ${a.share === null ? '—' : (a.share * 100).toFixed(2) + ' %'} | ${a.p95Ms === null ? '—' : a.p95Ms + ' мс'} |`)
  }
  // простои: подряд идущие не-up проверки
  const outages: { from: string; to: string; status: Status; n: number }[] = []
  for (const p of log.filter((x) => now - Date.parse(x.ts) <= 30 * 86400_000)) {
    const last = outages.at(-1)
    if (p.status === 'up') continue
    if (last && last.status === p.status && Date.parse(p.ts) - Date.parse(last.to) <= 11 * 60_000) {
      last.to = p.ts
      last.n++
    } else outages.push({ from: p.ts, to: p.ts, status: p.status, n: 1 })
  }
  if (outages.length) {
    L.push('', '## Простои за 30 дней', '', '| С (UTC) | По (UTC) | Статус | Проверок |', '|---|---|---|---|')
    for (const o of outages.slice(-30)) L.push(`| ${o.from.slice(0, 16).replace('T', ' ')} | ${o.to.slice(0, 16).replace('T', ' ')} | ${o.status} | ${o.n} |`)
  }
  return L.join('\n') + '\n'
}

async function main(): Promise<number> {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  const flag = (name: string) => process.argv.includes(`--${name}`)
  const envFile = arg('env-file')
  if (envFile) {
    try {
      loadEnvFile(path.resolve(envFile))
    } catch (e) {
      console.error(`[monitor] env-file: ${(e as Error).message}`)
    }
  }
  const url = (arg('url') ?? process.env.ATOMLAB_BRAIN_URL ?? (JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'brain.json'), 'utf8')) as { urls: string[] }).urls[0] ?? '').replace(/\/+$/, '')
  if (!url) {
    console.error('[monitor] нет адреса: --url=https://… или public/brain.json urls[0]')
    return 2
  }
  const dir = path.resolve(ROOT, arg('dir') ?? path.join('.tmp', 'brain-monitor'))
  const logFile = path.join(dir, 'log.jsonl')
  const stateFile = path.join(dir, 'state.json')
  if (flag('summary')) {
    const md = summaryMarkdown(readLog(logFile), url)
    const out = arg('md')
    if (out) {
      fs.mkdirSync(path.dirname(path.resolve(ROOT, out)), { recursive: true })
      fs.writeFileSync(path.resolve(ROOT, out), md)
      console.log(`[monitor] ${out}`)
    } else console.log(md)
    return 0
  }
  const failAfter = Math.max(1, Number(arg('fail-after') ?? 2) || 2)
  const remindMs = Math.max(0, Number(arg('remind-hours') ?? 6)) * 3600_000
  const timeoutMs = Math.max(3, Number(arg('timeout') ?? 15) || 15) * 1000
  const tg = process.env.ATOMLAB_TG_TOKEN && process.env.ATOMLAB_TG_CHAT ? 'Telegram включён' : 'Telegram выключен (нет ATOMLAB_TG_TOKEN / ATOMLAB_TG_CHAT)'
  console.log(`[monitor] ${url}/health · ${flag('once') ? 'одна проверка' : `каждые ${Number(arg('every') ?? 5)} мин`} · журнал ${path.relative(ROOT, logFile)} · ${tg}`)

  const once = async (): Promise<Status> => {
    const p = await probe(url, timeoutMs)
    appendLog(logFile, p)
    const { state, change } = step(readState(stateFile), p, failAfter, remindMs)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 1) + '\n')
    const line = `${new Date(p.ts).toLocaleString('ru-RU')} ${p.status.padEnd(8)} ${String(p.ms).padStart(6)} мс${p.error ? ' · ' + p.error : ''}${state.pending ? ` · подозрение ${state.pending.status} ${state.pending.count}/${failAfter}` : ''}`
    console.log(line)
    if (change) {
      const text = message(change, p, url)
      console.log(`[monitor] СМЕНА СТАТУСА: ${change.from} → ${change.to}${change.reminder ? ' (напоминание)' : ''} · ${text}`)
      const r = await notifyTelegram(text)
      if (r !== 'off') console.log(`[monitor] уведомление: ${r}`)
    }
    return p.status
  }
  if (flag('once')) return (await once()) === 'up' ? 0 : 1
  const every = Math.max(1, Number(arg('every') ?? 5) || 5) * 60_000
  for (;;) {
    await once().catch((e) => console.error(`[monitor] сбой проверки: ${(e as Error).message}`))
    await new Promise((r) => setTimeout(r, every))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main()
