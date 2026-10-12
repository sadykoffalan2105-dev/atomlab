/**
 * Клиент «Нарисовать» (картинки мозга ATOMLAB, контракт image v1 — раздел C спецификации):
 *
 *  • getImageInfo() / useImageInfo(): поле image из /health мозга {enabled, ready, students, engine};
 *  • fetchPresets(): GET /image/presets — 48 тем учебника Kimyo 7–11 (кеш 5 мин; сбой → []);
 *  • generateImage(): POST /image → text/event-stream (accepted → queue* → progress* → done | error);
 *    до потока сервер может ответить 429/403/503 JSON — это ImageError с кодом сервера;
 *  • роли: владелец — заголовок X-Brain-Admin (ключ в localStorage atomlab.brain.adminKey), учитель —
 *    teacherKey в теле (atomlab.brain.teacherKey), иначе ученик. Ключи нигде не выводятся.
 *
 * Модель картинок формул и подписей не рисует: их накладывает сайт (formulaSvg.ts, overlayCompose.ts).
 * brainClient.ts не меняется: адрес, сессия и разбор SSE берутся из его экспорта.
 */
import { useSyncExternalStore } from 'react'
import {
  BRAIN_SESSION_HEADER,
  brainGradeId,
  brainSessionId,
  ensureBrainOnline,
  getBrainHealth,
  getBrainStatus,
  getBrainUrl,
  parseSseBuffer,
  subscribeBrainStatus,
  type BrainHealth,
} from './brainClient'

/* ------------------------------------------------------------------ типы контракта */

export type ImageRole = 'owner' | 'teacher' | 'student'
export type ImageSize = 'square' | 'wide' | 'tall'
export type ImageStyle = 'illustration' | 'diagram' | 'photo' | 'poster'
export type ImageLang = 'ru' | 'uz' | 'en'
export type ImagePhase = 'checking' | 'waiting_gpu' | 'switching' | 'loading' | 'sampling' | 'decoding' | 'safety' | 'encoding'
/** Коды сервера + 'offline' (мозга нет), 'network' (обрыв), 'aborted' (отменил сам пользователь). */
export type ImageErrorCode =
  | 'disabled'
  | 'not_ready'
  | 'forbidden'
  | 'bad_request'
  | 'rate'
  | 'busy'
  | 'unsafe_prompt'
  | 'unsafe_image'
  | 'timeout'
  | 'internal'
  | 'offline'
  | 'network'
  | 'aborted'

/** /health → image (сверх контракта v1 мозга). */
export interface ImageHealth {
  enabled?: boolean
  ready?: boolean
  engine?: string
  /** Сервер шлёт boolean (students.enabled); принимаем и объект {enabled}. */
  students?: boolean | { enabled?: boolean }
  queue?: { running?: number; waiting?: number; paused?: boolean }
  lastMs?: number
}

export interface ImageInfo {
  enabled: boolean
  ready: boolean
  /** Ученикам можно рисовать (пресеты своего класса ±1). */
  students: boolean
  engine: string
}

export interface ImagePreset {
  id: string
  /** Заголовок на языке запроса. */
  title: string
  titles?: Partial<Record<ImageLang, string>>
  grades: string[]
  topic: string
  style: ImageStyle
  size: ImageSize
  chapter?: { grade?: string; ch?: number | string; sec?: number | string }
}

export interface ImageRequest {
  lang: ImageLang | 'auto'
  presetId?: string
  prompt?: string
  size?: ImageSize
  style?: ImageStyle
  seed?: number
  overlay?: { formula?: string; caption?: string }
  context?: { gradeId?: string; sectionTitle?: string; place?: 'chat' | 'lab' }
  studentId?: string
  sessionId?: string
}

export interface ImageTimings {
  queueMs: number
  drainMs: number
  unloadMs: number
  loadMs: number
  genMs: number
  safetyMs: number
  reloadMs: number
}

export interface ImageResult {
  jobId: string
  dataUrl: string
  mime: string
  width: number
  height: number
  seed: number
  engine: string
  variant: string
  ms: number
  timings: ImageTimings
  prompt: { final: string; translated: boolean; presetId?: string }
  safety: { nsfw: number; normal: number }
  overlay?: { formula?: string; caption?: string }
  url: string
  /** Роль, которую признал сервер (из события accepted). */
  role: ImageRole | null
}

export interface ImageAccepted {
  jobId: string
  role: ImageRole | null
  engine: string
  variant: string
  width: number
  height: number
  presetId?: string
  etaSec?: number
}

export interface ImageHandlers {
  onAccepted?: (a: ImageAccepted) => void
  /** Место в очереди картинок (1 — следующая), ориентир в секундах. */
  onQueue?: (position: number, etaSec?: number) => void
  onProgress?: (phase: ImagePhase, pct: number) => void
  signal?: AbortSignal
}

export class ImageError extends Error {
  readonly code: ImageErrorCode
  readonly retryAfterSec?: number
  /** Сервер признал роль (accepted.role) — чтобы показать «ключ не подошёл». */
  readonly role?: ImageRole | null
  constructor(code: ImageErrorCode, message = '', retryAfterSec?: number, role?: ImageRole | null) {
    super(message || code)
    this.name = 'ImageError'
    this.code = code
    if (retryAfterSec != null && Number.isFinite(retryAfterSec) && retryAfterSec > 0) this.retryAfterSec = Math.ceil(retryAfterSec)
    if (role !== undefined) this.role = role
  }
}

const SERVER_CODES: readonly ImageErrorCode[] = [
  'disabled',
  'not_ready',
  'forbidden',
  'bad_request',
  'rate',
  'busy',
  'unsafe_prompt',
  'unsafe_image',
  'timeout',
  'internal',
]

/* ------------------------------------------------------------------ ключи владельца / учителя */

const ADMIN_KEY = 'atomlab.brain.adminKey'
const TEACHER_KEY = 'atomlab.brain.teacherKey'
/** Без localStorage (приватное окно) ключ живёт в памяти вкладки. */
const keyMemory: Record<'owner' | 'teacher', string | null | undefined> = { owner: undefined, teacher: undefined }
const keyListeners = new Set<() => void>()

function readKey(kind: 'owner' | 'teacher'): string {
  const mem = keyMemory[kind]
  if (mem !== undefined) return mem ?? ''
  let v: string
  try {
    v = typeof localStorage !== 'undefined' ? (localStorage.getItem(kind === 'owner' ? ADMIN_KEY : TEACHER_KEY) ?? '') : ''
  } catch {
    v = '' // хранилище закрыто (приватное окно, запрет сайта)
  }
  keyMemory[kind] = v || null
  return v
}

/** Сохранить ключ владельца (X-Brain-Admin) или учителя (teacherKey); пустая строка — забыть. */
export function setImageKey(kind: 'owner' | 'teacher', value: string): void {
  const v = value.trim().slice(0, 256)
  keyMemory[kind] = v || null
  try {
    if (typeof localStorage !== 'undefined') {
      const k = kind === 'owner' ? ADMIN_KEY : TEACHER_KEY
      if (v) localStorage.setItem(k, v)
      else localStorage.removeItem(k)
    }
  } catch {
    // хранилище недоступно — ключ до перезагрузки страницы
  }
  roleSnap = null
  keyListeners.forEach((l) => l())
}

/** Есть ли сохранённый ключ (значение не отдаём). */
export function hasImageKey(kind?: 'owner' | 'teacher'): boolean {
  return kind ? !!readKey(kind) : !!readKey('owner') || !!readKey('teacher')
}

/** Роль по сохранённым ключам: владелец важнее учителя. */
export function role(): ImageRole {
  if (readKey('owner')) return 'owner'
  if (readKey('teacher')) return 'teacher'
  return 'student'
}

let roleSnap: ImageRole | null = null
function roleSnapshot(): ImageRole {
  if (!roleSnap) roleSnap = role()
  return roleSnap
}

function subscribeKeys(l: () => void): () => void {
  keyListeners.add(l)
  // ключ, введённый в другой вкладке
  const onStorage = (e: StorageEvent) => {
    if (e.key !== ADMIN_KEY && e.key !== TEACHER_KEY) return
    keyMemory.owner = undefined
    keyMemory.teacher = undefined
    roleSnap = null
    l()
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    keyListeners.delete(l)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

/** Роль для UI (меняется сразу после ввода / удаления ключа). */
export function useImageRole(): ImageRole {
  return useSyncExternalStore(subscribeKeys, roleSnapshot, () => 'student' as const)
}

/* ------------------------------------------------------------------ /health → image */

function studentsOn(s: ImageHealth['students']): boolean {
  if (typeof s === 'boolean') return s
  return !!(s && typeof s === 'object' && s.enabled === true)
}

/** Поле image из последнего /health (null — мозга нет или сервер без картинок). */
export function getImageInfo(): ImageInfo | null {
  if (getBrainStatus() !== 'online') return null
  const h = getBrainHealth() as (BrainHealth & { image?: ImageHealth }) | null
  const img = h?.image
  if (!img || typeof img !== 'object') return null
  return {
    enabled: img.enabled === true,
    ready: img.ready === true,
    students: studentsOn(img.students),
    engine: typeof img.engine === 'string' ? img.engine : '',
  }
}

/** Можно ли сейчас открыть «Нарисовать» (кнопка видна): рисование включено и роль позволяет. */
export function canUseDrawing(): boolean {
  const info = getImageInfo()
  return !!info?.enabled && (role() !== 'student' || info.students)
}

let infoSnap: ImageInfo | null = null
function infoSnapshot(): ImageInfo | null {
  const next = getImageInfo()
  const prev = infoSnap
  if (prev === next) return prev
  if (
    prev &&
    next &&
    prev.enabled === next.enabled &&
    prev.ready === next.ready &&
    prev.students === next.students &&
    prev.engine === next.engine
  ) {
    return prev
  }
  infoSnap = next
  return next
}

/** /health обновляется опросом brainClient раз в 30 с без события, если статус не менялся — сверяем сами. */
const INFO_RECHECK_MS = 5_000

function subscribeInfo(l: () => void): () => void {
  const off = subscribeBrainStatus(l)
  const id = typeof setInterval !== 'undefined' ? setInterval(l, INFO_RECHECK_MS) : null
  return () => {
    off()
    if (id) clearInterval(id)
  }
}

/** Состояние рисования для кнопок (null — мозга нет / сервер без картинок). */
export function useImageInfo(): ImageInfo | null {
  return useSyncExternalStore(subscribeInfo, infoSnapshot, () => null)
}

/* ------------------------------------------------------------------ пресеты */

const PRESETS_TTL_MS = 5 * 60_000
const PRESETS_TIMEOUT_MS = 6_000
const presetCache = new Map<string, { at: number; list: ImagePreset[] }>()

const STYLES: readonly ImageStyle[] = ['illustration', 'diagram', 'photo', 'poster']
const SIZES: readonly ImageSize[] = ['square', 'wide', 'tall']

function normLang(lang: string | null | undefined): ImageLang {
  return lang === 'en' || lang === 'uz' ? lang : 'ru'
}

function normPreset(raw: unknown, lang: ImageLang): ImagePreset | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || !r.id) return null
  const titlesRaw = (r.titles && typeof r.titles === 'object' ? r.titles : r.title && typeof r.title === 'object' ? r.title : null) as
    | Record<string, unknown>
    | null
  const titles: Partial<Record<ImageLang, string>> = {}
  if (titlesRaw) for (const l of ['ru', 'uz', 'en'] as const) if (typeof titlesRaw[l] === 'string') titles[l] = titlesRaw[l] as string
  const title = typeof r.title === 'string' ? r.title : (titles[lang] ?? titles.ru ?? titles.en ?? r.id)
  const style = STYLES.includes(r.style as ImageStyle) ? (r.style as ImageStyle) : 'illustration'
  const size = SIZES.includes(r.size as ImageSize) ? (r.size as ImageSize) : 'square'
  const grades = Array.isArray(r.grades) ? r.grades.filter((g): g is string => typeof g === 'string') : []
  const out: ImagePreset = { id: r.id, title, grades, topic: typeof r.topic === 'string' ? r.topic : '', style, size }
  if (titlesRaw) out.titles = titles
  if (r.chapter && typeof r.chapter === 'object') out.chapter = r.chapter as ImagePreset['chapter']
  return out
}

/** Темы для рисования (grade: 'g8' / '8' / '' — все). Кеш 5 мин в памяти; сбой → []. */
export async function fetchPresets(grade: string, lang: string): Promise<ImagePreset[]> {
  const base = getBrainUrl()
  if (!base || typeof fetch === 'undefined') return []
  const g = brainGradeId(grade)
  const l = normLang(lang)
  const key = `${base}|${g}|${l}`
  const hit = presetCache.get(key)
  if (hit && Date.now() - hit.at < PRESETS_TTL_MS) return hit.list
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PRESETS_TIMEOUT_MS)
  try {
    const res = await fetch(`${base}/image/presets?grade=${encodeURIComponent(g)}&lang=${l}`, { signal: ctrl.signal })
    if (!res.ok) return []
    const data = (await res.json()) as { ok?: boolean; presets?: unknown }
    if (!data || !Array.isArray(data.presets)) return []
    const list = data.presets.map((p) => normPreset(p, l)).filter((p): p is ImagePreset => !!p)
    presetCache.set(key, { at: Date.now(), list })
    return list
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

/** Сбросить кеш тем (самопроверка, смена сервера). */
export function clearPresetCache(): void {
  presetCache.clear()
}

/* ------------------------------------------------------------------ рисование */

/** Ни одного байта ответа — сервер завис (заголовки SSE сервер шлёт сразу). */
const FIRST_BYTE_MS = 6_000
/** Тишина без сердцебиения (сервер шлёт ': hb' каждые 5 с). */
const SILENCE_MS = 20_000
/** Всего на одну картинку: очередь окна + переключение видеокарты + рисование. */
const TOTAL_MS = 150_000

const PHASES: readonly ImagePhase[] = ['checking', 'waiting_gpu', 'switching', 'loading', 'sampling', 'decoding', 'safety', 'encoding']

function safeJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)

function roleOf(v: unknown): ImageRole | null {
  return v === 'owner' || v === 'teacher' || v === 'student' ? v : null
}

/** Тело ошибки сервера → ImageError: {code} | {error:'rate', code} | {error:{code,message}}. */
function errorFromBody(raw: unknown, status: number, retryHeader: number | null, fallback: ImageErrorCode): ImageError {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const nested = r.error && typeof r.error === 'object' ? (r.error as Record<string, unknown>) : null
  const codeRaw = str(r.code) || str(nested?.code) || str(r.error)
  const code = (SERVER_CODES as readonly string[]).includes(codeRaw) ? (codeRaw as ImageErrorCode) : fallback
  const message = str(r.message) || str(nested?.message)
  const retry = num(r.retryAfterSec, 0) || num(nested?.retryAfterSec, 0) || retryHeader || undefined
  void status
  return new ImageError(code, message, retry)
}

function retryAfterOf(res: Response): number | null {
  const v = Number(res.headers.get('Retry-After'))
  return Number.isFinite(v) && v > 0 ? v : null
}

function normTimings(raw: unknown): ImageTimings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const t = (k: string) => Math.max(0, num(r[k]))
  return {
    queueMs: t('queueMs'),
    drainMs: t('drainMs'),
    unloadMs: t('unloadMs'),
    loadMs: t('loadMs'),
    genMs: t('genMs'),
    safetyMs: t('safetyMs'),
    reloadMs: t('reloadMs'),
  }
}

function normResult(raw: Record<string, unknown>, base: string, roleSeen: ImageRole | null): ImageResult | null {
  let dataUrl = str(raw.dataUrl)
  const url = str(raw.url)
  // картинка — только data:image/* (или адрес кеша сервера /image/<jobId>, если сервер прислал без dataUrl)
  if (!/^data:image\/(webp|png|jpeg);base64,/i.test(dataUrl)) {
    if (/^\/image\/[\w-]+$/.test(url)) dataUrl = `${base}${url}`
    else return null
  }
  const prompt = (raw.prompt && typeof raw.prompt === 'object' ? raw.prompt : {}) as Record<string, unknown>
  const safety = (raw.safety && typeof raw.safety === 'object' ? raw.safety : {}) as Record<string, unknown>
  const overlay = raw.overlay && typeof raw.overlay === 'object' ? (raw.overlay as ImageResult['overlay']) : undefined
  const out: ImageResult = {
    jobId: str(raw.jobId),
    dataUrl,
    mime: str(raw.mime, 'image/webp'),
    width: Math.max(1, num(raw.width, 1024)),
    height: Math.max(1, num(raw.height, 1024)),
    seed: num(raw.seed),
    engine: str(raw.engine),
    variant: str(raw.variant),
    ms: num(raw.ms),
    timings: normTimings(raw.timings),
    prompt: { final: str(prompt.final), translated: prompt.translated === true, ...(typeof prompt.presetId === 'string' ? { presetId: prompt.presetId } : {}) },
    safety: { nsfw: num(safety.nsfw), normal: num(safety.normal, 1) },
    url,
    role: roleSeen,
  }
  if (overlay) out.overlay = overlay
  return out
}

/**
 * Нарисовать картинку. Успех — ImageResult; любой отказ — throw ImageError (код сервера, 'offline' — мозга нет,
 * 'network' — обрыв, 'timeout' — сроки клиента, 'aborted' — отменил пользователь).
 */
export async function generateImage(req: ImageRequest, h: ImageHandlers = {}): Promise<ImageResult> {
  const outer = h.signal
  if (outer?.aborted) throw new ImageError('aborted')
  if (typeof fetch === 'undefined') throw new ImageError('offline')
  let base = getBrainUrl()
  if (!base) {
    await ensureBrainOnline()
    base = getBrainUrl()
  }
  if (!base) throw new ImageError('offline')

  const ctrl = new AbortController()
  let timedOut = false
  const onAbort = () => ctrl.abort()
  outer?.addEventListener('abort', onAbort, { once: true })
  let timer: ReturnType<typeof setTimeout> | null = null
  const arm = (ms: number) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timedOut = true
      ctrl.abort()
    }, ms)
  }
  const t0 = Date.now()
  let roleSeen: ImageRole | null = null

  const owner = readKey('owner')
  const teacher = readKey('teacher')
  // X-Brain-Session — лимиты картинок на ученика, а не на весь адрес школы
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'text/event-stream', [BRAIN_SESSION_HEADER]: brainSessionId() }
  if (owner) headers['X-Brain-Admin'] = owner
  const body: Record<string, unknown> = {
    sessionId: req.sessionId ?? brainSessionId(),
    lang: req.lang,
    size: req.size ?? 'square',
  }
  if (req.studentId) body.studentId = req.studentId
  if (req.presetId) body.presetId = req.presetId
  if (req.prompt?.trim()) body.prompt = req.prompt.trim().slice(0, 500)
  if (req.style) body.style = req.style
  if (typeof req.seed === 'number' && Number.isFinite(req.seed) && req.seed >= 0) body.seed = Math.floor(req.seed)
  if (req.overlay && (req.overlay.formula || req.overlay.caption)) {
    body.overlay = {
      ...(req.overlay.formula ? { formula: req.overlay.formula.slice(0, 80) } : {}),
      ...(req.overlay.caption ? { caption: req.overlay.caption.slice(0, 120) } : {}),
    }
  }
  if (req.context) {
    const c: Record<string, string> = {}
    const g = brainGradeId(req.context.gradeId)
    if (g) c.gradeId = g
    if (req.context.sectionTitle) c.sectionTitle = req.context.sectionTitle.slice(0, 200)
    if (req.context.place) c.place = req.context.place
    body.context = c
  }
  if (teacher && !owner) body.teacherKey = teacher

  try {
    arm(FIRST_BYTE_MS)
    let res: Response
    try {
      res = await fetch(`${base}/image`, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal, cache: 'no-store' })
    } catch {
      if (outer?.aborted) throw new ImageError('aborted')
      throw new ImageError(timedOut ? 'timeout' : 'network')
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      if (res.status === 429) throw errorFromBody(data, 429, retryAfterOf(res), 'rate')
      if (res.status === 404) throw new ImageError('disabled') // старый сервер без /image
      if (res.status === 400 || res.status === 413 || res.status === 415) throw errorFromBody(data, res.status, null, 'bad_request')
      if (res.status === 403) throw errorFromBody(data, 403, null, 'forbidden')
      if (res.status === 503) throw errorFromBody(data, 503, retryAfterOf(res), 'not_ready')
      throw errorFromBody(data, res.status, null, 'internal')
    }
    const ctype = res.headers.get('Content-Type') ?? ''
    if (!ctype.includes('text/event-stream') || !res.body) {
      // сервер ответил одним JSON (?wait=1 / Accept: application/json) — тоже поддерживаем
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
      if (data && data.ok === false) throw errorFromBody(data, res.status, null, 'internal')
      const r = data ? normResult(data, base, roleOf(data.role)) : null
      if (!r) throw new ImageError('internal')
      return r
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      if (Date.now() - t0 > TOTAL_MS) {
        timedOut = true
        void reader.cancel().catch(() => undefined)
        throw new ImageError('timeout')
      }
      arm(Math.min(SILENCE_MS, Math.max(1_000, TOTAL_MS - (Date.now() - t0))))
      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await reader.read()
      } catch {
        if (outer?.aborted) throw new ImageError('aborted')
        throw new ImageError(timedOut ? 'timeout' : 'network')
      }
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })
      const parsed = parseSseBuffer(buffer)
      buffer = parsed.rest
      for (const ev of parsed.events) {
        const data = safeJson<Record<string, unknown>>(ev.data) ?? {}
        if (ev.event === 'accepted') {
          roleSeen = roleOf(data.role)
          const a: ImageAccepted = {
            jobId: str(data.jobId),
            role: roleSeen,
            engine: str(data.engine),
            variant: str(data.variant),
            width: num(data.width, 1024),
            height: num(data.height, 1024),
          }
          if (typeof data.presetId === 'string') a.presetId = data.presetId
          if (typeof data.etaSec === 'number') a.etaSec = data.etaSec
          h.onAccepted?.(a)
        } else if (ev.event === 'queue') {
          const pos = Math.max(0, Math.round(num(data.position)))
          h.onQueue?.(pos, typeof data.etaSec === 'number' ? data.etaSec : undefined)
        } else if (ev.event === 'progress') {
          const phase = PHASES.includes(data.phase as ImagePhase) ? (data.phase as ImagePhase) : null
          if (phase) h.onProgress?.(phase, Math.max(0, Math.min(100, num(data.pct))))
        } else if (ev.event === 'done') {
          void reader.cancel().catch(() => undefined)
          const r = normResult(data, base, roleSeen)
          if (!r) throw new ImageError('internal')
          return r
        } else if (ev.event === 'error') {
          void reader.cancel().catch(() => undefined)
          const e = errorFromBody(data, 200, null, 'internal')
          throw new ImageError(e.code, e.message, e.retryAfterSec, roleSeen)
        }
      }
    }
    if (outer?.aborted) throw new ImageError('aborted')
    throw new ImageError(timedOut ? 'timeout' : 'network')
  } catch (e) {
    if (e instanceof ImageError) {
      if (outer?.aborted && e.code !== 'aborted') throw new ImageError('aborted')
      throw e
    }
    throw new ImageError(outer?.aborted ? 'aborted' : timedOut ? 'timeout' : 'network')
  } finally {
    if (timer) clearTimeout(timer)
    outer?.removeEventListener('abort', onAbort)
  }
}

/** Случайный seed 0..2^48−1 (как у сервера) — «Ещё раз» с новым вариантом. */
export function randomSeed(): number {
  const hi = Math.floor(Math.random() * 0x10000)
  const lo = Math.floor(Math.random() * 0x100000000)
  return hi * 0x100000000 + lo
}
