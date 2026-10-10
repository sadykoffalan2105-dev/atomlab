/**
 * Клиент «локального мозга» ATOMLAB (контракт v1): сервер на компьютере учителя
 * (по умолчанию http://127.0.0.1:8787, `npm run brain:start`) — база знаний, модель ученика и
 * LLM через Ollama. Сайт работает и без него: любой сбой → null → запасной путь (локальная база).
 *
 *  • checkHealth(): GET /health, таймаут 800 мс, кеш состояния 'online'|'offline' на 20 с;
 *    повтор при каждом вопросе (ensureBrainOnline) и по таймеру раз в 30 с, пока есть подписчики;
 *  • streamChat(): POST /chat → text/event-stream (meta → delta… → done | error); обрыв до первого
 *    delta → null, после — накопленный текст (partial). Отмена signal рвёт соединение — сервер
 *    прерывает Ollama.
 */
import { useSyncExternalStore } from 'react'

export type BrainStatus = 'checking' | 'online' | 'offline'
export type BrainLang = 'ru' | 'en' | 'uz' | 'auto'
export type BrainMood = 'neutral' | 'confused' | 'tired' | 'bored' | 'happy' | 'stressed'
export type BrainIntent = 'smalltalk' | 'chemistry' | 'calc' | 'homework' | 'offtopic' | 'rule' | 'gibberish'

export interface BrainHealth {
  ok: boolean
  service: string
  version: string
  contract: number
  llm: { available: boolean; chatModel: string | null; fastModel: string | null; embedModel: string | null }
  kb: { docs: number; journalLines: number; embedded: number }
  uptimeMs: number
}

export interface BrainChatContext {
  gradeId: string
  chapterId?: string
  sectionId?: string
  sectionTitle?: string
  mode: 'chat' | 'live'
  detail: 'brief' | 'more'
}

export interface BrainStudentSignal {
  mood?: BrainMood
  cameraEngagement?: number
}

export interface BrainMeta {
  turnId: string
  intent: BrainIntent
  route: string
  moderated: boolean
  lang: 'ru' | 'en' | 'uz'
  /** почему ответил запасной путь, хотя LLM была (first_token_timeout, cjk…) — поле сверх контракта v1 */
  reason?: string
}

export interface BrainStudentModel {
  level: number
  mood: BrainMood
  pace: 'slow' | 'normal' | 'fast'
  recentErrors: string[]
}

export interface BrainDone {
  text: string
  source: 'llm' | 'tool' | 'local' | 'rule'
  citations: string[]
  confidence: number
  confidenceLabel: 'high' | 'medium' | 'reasoned'
  student: BrainStudentModel | null
  ms: number
  /** Поток оборвался после первого куска — это уже полученный текст. */
  partial?: boolean
  meta?: BrainMeta | null
}

export interface StreamChatOptions {
  messages: { role: string; content: string }[]
  context: BrainChatContext
  student?: BrainStudentSignal
  lang: BrainLang
  sessionId?: string
  studentId?: string
  signal?: AbortSignal
  onMeta?: (meta: BrainMeta) => void
  /** Новый кусок и весь текст на данный момент. */
  onDelta?: (delta: string, fullText: string) => void
}

/* ------------------------------------------------------------------ адрес */

function readEnvUrl(): string | undefined {
  try {
    const v = import.meta.env?.VITE_BRAIN_URL as string | undefined
    return typeof v === 'string' ? v : undefined
  } catch {
    return undefined
  }
}

export const BRAIN_URL: string = (readEnvUrl() ?? 'http://127.0.0.1:8787').trim().replace(/\/+$/, '')
/** VITE_BRAIN_URL=off — мозг отключён в сборке. */
const BRAIN_DISABLED = !BRAIN_URL || /^(off|0|false|none)$/i.test(BRAIN_URL)

const HEALTH_TIMEOUT_MS = 800
const CACHE_MS = 20_000
/** Мозг недоступен: перепроверяем не чаще раза в 5 с (быстрый запасной путь). */
const OFFLINE_RECHECK_MS = 5_000
const POLL_MS = 30_000
/** Нет ни одного байта ответа /chat — сервер завис (заголовки и «сердцебиение» сервер шлёт сразу). */
const FIRST_BYTE_TIMEOUT_MS = 6_000
/**
 * Ждём первый кусок ответа столько же, сколько сервер ждёт первый токен модели (config.timeouts.firstTokenMs = 45 с)
 * + запас на поиск и запасной путь сервера: процессор этого ПК читает подсказку 7b до 20–40 с. Пока ждём —
 * сервер шлёт «сердцебиение» (SSE-комментарии), UI показывает «Думаю…»; сердцебиение этот срок НЕ продлевает.
 */
export const FIRST_DELTA_TIMEOUT_MS = 50_000
/** Пауза между событиями потока после первого куска (модель пишет ~10 ток/с). */
const IDLE_TIMEOUT_MS = 45_000
const TOTAL_TIMEOUT_MS = 180_000
const MAX_MESSAGES = 12
const MAX_CONTENT = 4_000

/* ------------------------------------------------------------------ состояние */

let status: BrainStatus = BRAIN_DISABLED ? 'offline' : 'checking'
let lastHealth: BrainHealth | null = null
let checkedAt = 0
let inflight: Promise<boolean> | null = null
const listeners = new Set<() => void>()
let pollTimer: ReturnType<typeof setInterval> | null = null

function setStatus(next: BrainStatus): void {
  if (status === next) return
  status = next
  listeners.forEach((l) => l())
}

export function getBrainStatus(): BrainStatus {
  return status
}

export function getBrainHealth(): BrainHealth | null {
  return lastHealth
}

/** Пометить мозг недоступным (обрыв потока, ошибка сети) — следующий вопрос уйдёт в запасной путь. */
export function markBrainOffline(): void {
  checkedAt = Date.now()
  lastHealth = null
  setStatus('offline')
}

/** GET /health (≤ 800 мс). Кеш 20 с; `force` — проверить сейчас. */
export function checkHealth(force = false): Promise<boolean> {
  if (BRAIN_DISABLED || typeof fetch === 'undefined') {
    setStatus('offline')
    return Promise.resolve(false)
  }
  const age = Date.now() - checkedAt
  if (!force && checkedAt > 0 && age < (status === 'online' ? CACHE_MS : Math.min(CACHE_MS, OFFLINE_RECHECK_MS))) {
    return Promise.resolve(status === 'online')
  }
  if (inflight) return inflight
  inflight = (async () => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS)
    try {
      const res = await fetch(`${BRAIN_URL}/health`, { method: 'GET', signal: ctrl.signal, cache: 'no-store' })
      if (!res.ok) throw new Error(`health ${res.status}`)
      const data = (await res.json()) as Partial<BrainHealth>
      const ok = data?.ok === true && data.service === 'atomlab-brain'
      lastHealth = ok ? (data as BrainHealth) : null
      checkedAt = Date.now()
      setStatus(ok ? 'online' : 'offline')
      return ok
    } catch {
      lastHealth = null
      checkedAt = Date.now()
      setStatus('offline')
      return false
    } finally {
      clearTimeout(timer)
      inflight = null
    }
  })()
  return inflight
}

/** Перед каждым вопросом: мозг сейчас отвечает? (кеш 20 с, быстро при «offline»). */
export function ensureBrainOnline(): Promise<boolean> {
  return checkHealth(false)
}

export function subscribeBrainStatus(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1 && !BRAIN_DISABLED && typeof window !== 'undefined') {
    void checkHealth(status === 'checking')
    pollTimer = setInterval(() => void checkHealth(true), POLL_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }
}

const serverStatus = (): BrainStatus => 'offline'

/** Состояние мозга для UI (подписка запускает проверку и опрос раз в 30 с). */
export function useBrainStatus(): BrainStatus {
  return useSyncExternalStore(subscribeBrainStatus, getBrainStatus, serverStatus)
}

/* ------------------------------------------------------------ модель ученика */

let lastStudent: BrainStudentModel | null = null
const studentListeners = new Set<() => void>()

export function getBrainStudent(): BrainStudentModel | null {
  return lastStudent
}

function setBrainStudent(s: BrainStudentModel | null): void {
  if (!s) return
  lastStudent = s
  studentListeners.forEach((l) => l())
}

function subscribeBrainStudent(l: () => void): () => void {
  studentListeners.add(l)
  return () => {
    studentListeners.delete(l)
  }
}

const serverStudent = (): BrainStudentModel | null => null

/** Последняя оценка ученика от мозга (уровень, темп, типичные ошибки) или null. */
export function useBrainStudent(): BrainStudentModel | null {
  return useSyncExternalStore(subscribeBrainStudent, getBrainStudent, serverStudent)
}

/* ------------------------------------------------------------------ сессия */

let sessionId: string | null = null

export function brainSessionId(): string {
  if (sessionId) return sessionId
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  sessionId = `s-${rand}`
  return sessionId
}

/** 'g8' / '8' / '' → 'g8' | '' (контракт: "g7".."g11" | ""). */
export function brainGradeId(gradeId: string | null | undefined): string {
  const n = Number(String(gradeId ?? '').replace(/\D/g, ''))
  return n >= 7 && n <= 11 ? `g${n}` : ''
}

/** Эмоция с камеры / настроение текста → настроение контракта. */
export function brainMoodFrom(emotion?: string | null, textMood?: string | null): BrainMood {
  switch (emotion) {
    case 'confused':
      return 'confused'
    case 'frustrated':
      return 'stressed'
    case 'tired':
      return 'tired'
    case 'bored':
      return 'bored'
    case 'confident':
    case 'curious':
      return 'happy'
    default:
      break
  }
  if (textMood === 'hard') return 'confused'
  if (textMood === 'cool' || textMood === 'thanks') return 'happy'
  return 'neutral'
}

/* ------------------------------------------------------------------ SSE */

type SseEvent = { event: string; data: string }

/** Разобрать накопленный буфер SSE: события разделены пустой строкой. */
export function parseSseBuffer(buffer: string): { events: SseEvent[]; rest: string } {
  const norm = buffer.replace(/\r\n?/g, '\n')
  const blocks = norm.split('\n\n')
  const rest = blocks.pop() ?? ''
  const events: SseEvent[] = []
  for (const block of blocks) {
    if (!block.trim()) continue
    let event = 'message'
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue
      const idx = line.indexOf(':')
      const field = idx < 0 ? line : line.slice(0, idx)
      let value = idx < 0 ? '' : line.slice(idx + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'event') event = value
      else if (field === 'data') data.push(value)
    }
    events.push({ event, data: data.join('\n') })
  }
  return { events, rest }
}

function safeJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function normalizeMessages(messages: { role: string; content: string }[]): { role: 'user' | 'assistant'; content: string }[] {
  const list = messages
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: m.content.slice(0, MAX_CONTENT) }))
  // Последнее — реплика ученика.
  while (list.length && list[list.length - 1]!.role !== 'user') list.pop()
  return list.slice(-MAX_MESSAGES)
}

function normalizeDone(raw: Partial<BrainDone> | null, fallbackText: string, meta: BrainMeta | null): BrainDone {
  const text = typeof raw?.text === 'string' && raw.text.trim() ? raw.text : fallbackText
  const label = raw?.confidenceLabel
  return {
    text,
    source: raw?.source === 'tool' || raw?.source === 'local' || raw?.source === 'rule' ? raw.source : 'llm',
    citations: Array.isArray(raw?.citations) ? raw!.citations.filter((c) => typeof c === 'string').slice(0, 3) : [],
    confidence: typeof raw?.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : 0.5,
    confidenceLabel: label === 'high' || label === 'medium' || label === 'reasoned' ? label : 'medium',
    student: raw?.student && typeof raw.student === 'object' ? (raw.student as BrainStudentModel) : null,
    ms: typeof raw?.ms === 'number' ? raw.ms : 0,
    meta,
  }
}

/**
 * Потоковый ответ мозга. null — мозга нет/ошибка до первого куска (тогда запасной путь).
 * После первого куска любая ошибка возвращает уже полученный текст (`partial: true`).
 */
export async function streamChat(opts: StreamChatOptions): Promise<BrainDone | null> {
  if (BRAIN_DISABLED || typeof fetch === 'undefined') return null
  const outer = opts.signal
  if (outer?.aborted) return null
  const messages = normalizeMessages(opts.messages)
  if (!messages.length) return null

  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  outer?.addEventListener('abort', onAbort, { once: true })
  let timer: ReturnType<typeof setTimeout> | null = null
  const arm = (ms: number) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => ctrl.abort(), ms)
  }
  const t0 = Date.now()
  let full = ''
  let meta: BrainMeta | null = null
  let gotDelta = false
  const partial = (): BrainDone | null =>
    gotDelta && full.trim() ? { ...normalizeDone(null, full, meta), partial: true, ms: Date.now() - t0 } : null

  try {
    arm(FIRST_BYTE_TIMEOUT_MS)
    const res = await fetch(`${BRAIN_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        sessionId: opts.sessionId ?? brainSessionId(),
        ...(opts.studentId ? { studentId: opts.studentId } : {}),
        lang: opts.lang,
        stream: true,
        messages,
        context: { ...opts.context, gradeId: brainGradeId(opts.context.gradeId) },
        ...(opts.student ? { student: opts.student } : {}),
      }),
      signal: ctrl.signal,
      cache: 'no-store',
    })
    if (!res.ok || !res.body) {
      if (res.status >= 500 || res.status === 404) markBrainOffline()
      return null
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      // до первого куска — общий срок от начала запроса (сердцебиение его не продлевает), после — пауза между событиями
      arm(gotDelta ? IDLE_TIMEOUT_MS : Math.max(1_000, FIRST_DELTA_TIMEOUT_MS - (Date.now() - t0)))
      if (Date.now() - t0 > TOTAL_TIMEOUT_MS) {
        void reader.cancel().catch(() => undefined)
        return partial()
      }
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parsed = parseSseBuffer(buffer)
      buffer = parsed.rest
      for (const ev of parsed.events) {
        if (ev.event === 'meta') {
          meta = safeJson<BrainMeta>(ev.data)
          if (meta) opts.onMeta?.(meta)
        } else if (ev.event === 'delta') {
          const d = safeJson<{ text?: string }>(ev.data)
          const piece = typeof d?.text === 'string' ? d.text : ''
          if (!piece) continue
          full += piece
          gotDelta = true
          opts.onDelta?.(piece, full)
        } else if (ev.event === 'done') {
          const raw = safeJson<Partial<BrainDone>>(ev.data)
          const result = normalizeDone(raw, full, meta)
          if (!result.ms) result.ms = Date.now() - t0
          if (result.student) setBrainStudent(result.student)
          void reader.cancel().catch(() => undefined)
          return result.text.trim() ? result : partial()
        } else if (ev.event === 'error') {
          void reader.cancel().catch(() => undefined)
          return partial()
        }
      }
    }
    // Поток закрылся без done.
    const tail = parseSseBuffer(`${buffer}\n\n`)
    for (const ev of tail.events) {
      if (ev.event === 'done') {
        const result = normalizeDone(safeJson<Partial<BrainDone>>(ev.data), full, meta)
        if (result.student) setBrainStudent(result.student)
        if (result.text.trim()) return result
      }
    }
    if (!gotDelta) markBrainOffline()
    return partial()
  } catch {
    // Обрыв (сервер остановлен на полуслове) или таймаут — мозг считаем недоступным.
    if (!outer?.aborted) markBrainOffline()
    return partial()
  } finally {
    if (timer) clearTimeout(timer)
    outer?.removeEventListener('abort', onAbort)
  }
}

/* ------------------------------------------------------------------ база знаний */

/** Дописать запись в журнал базы мозга (append-only). Без мозга — false. */
export async function appendToBrainKb(entry: {
  kind: 'fact' | 'qa' | 'correction' | 'feedback' | 'dialog' | 'note'
  lang: 'ru' | 'en' | 'uz'
  text: string
  title?: string
  tags?: string[]
  source?: string
  meta?: Record<string, unknown>
}): Promise<boolean> {
  if (BRAIN_DISABLED || status !== 'online' || typeof fetch === 'undefined') return false
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 3_000)
  try {
    const res = await fetch(`${BRAIN_URL}/kb/append`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry, text: entry.text.slice(0, 20_000) }),
      signal: ctrl.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
