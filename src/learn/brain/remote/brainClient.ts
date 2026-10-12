/**
 * Клиент «мозга» ATOMLAB (контракт v1): база знаний, модель ученика и LLM через Ollama. Мозг живёт
 * на сервере ATOMLAB (один для всех учеников) или на компьютере учителя (http://127.0.0.1:8787,
 * `npm run brain:start`). Сайт работает и без него: любой сбой → null → запасной путь (база браузера).
 *
 *  • адреса: VITE_BRAIN_URL (сборка) или public/brain.json рядом с сайтом — сначала серверы из urls,
 *    затем мозг на этом ПК (только с разрешения браузера или по согласию ученика, см. ниже);
 *  • checkHealth(): GET /health (сервер ≤ 2,5 с, этот ПК ≤ 800 мс), кеш 20 с; повтор при каждом вопросе
 *    (ensureBrainOnline) и по таймеру раз в 30 с, пока есть подписчики;
 *  • streamChat(): POST /chat → text/event-stream (meta → queue… → delta… → done | error); обрыв до первого
 *    delta → null, после — накопленный текст (partial). 429 / «занят» → null + короткая пометка для ответа
 *    из базы браузера (takeBrainBusyNote). Отмена signal рвёт соединение — сервер прерывает Ollama.
 */
import { useSyncExternalStore } from 'react'
import { publicAssetUrl } from '../../../utils/publicAssetUrl'

export type BrainStatus = 'checking' | 'online' | 'offline'
export type BrainLang = 'ru' | 'en' | 'uz' | 'auto'
export type BrainMood = 'neutral' | 'confused' | 'tired' | 'bored' | 'happy' | 'stressed'
export type BrainIntent = 'smalltalk' | 'chemistry' | 'calc' | 'homework' | 'offtopic' | 'rule' | 'gibberish'
/** 'remote' — сервер мозга ATOMLAB (для всех учеников); 'local' — мозг на этом компьютере / в локальной сети. */
export type BrainKind = 'remote' | 'local'

export interface BrainHealth {
  ok: boolean
  service: string
  version: string
  contract: number
  /** vision (сверх контракта v1): чат-модель сервера понимает фото задачи */
  llm: { available: boolean; chatModel: string | null; fastModel: string | null; embedModel: string | null; vision?: boolean }
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
  /** Сервер поставил вопрос в очередь: место в очереди (1 — следующий). */
  onQueue?: (position: number) => void
  /**
   * «Сфотографируй задачу»: фото к последней реплике ученика — base64 без «data:» (уже сжатые на устройстве,
   * ≤ 2 шт., см. chatPhoto.ts). Уходят полем messages[-1].images; старые серверы его просто не читают.
   */
  images?: string[]
}

/* ------------------------------------------------------------------ адреса */

function readEnvUrl(): string | undefined {
  try {
    const v = import.meta.env?.VITE_BRAIN_URL as string | undefined
    return typeof v === 'string' ? v : undefined
  } catch {
    return undefined
  }
}

/** Мозг на этом компьютере (`npm run brain:start`). */
export const LOCAL_BRAIN_URL = 'http://127.0.0.1:8787'
const ENV_URL = (readEnvUrl() ?? '').trim().replace(/\/+$/, '')
/** VITE_BRAIN_URL=off — мозг отключён в сборке. */
const BRAIN_DISABLED = /^(off|0|false|none)$/i.test(ENV_URL)
/** Адрес из сборки (VITE_BRAIN_URL) или мозг на этом ПК. Текущий выбранный адрес — getBrainUrl(). */
export const BRAIN_URL: string = ENV_URL && !BRAIN_DISABLED ? ENV_URL : LOCAL_BRAIN_URL

/**
 * public/brain.json (лежит рядом с сайтом, правится на GitHub без изменения кода):
 *   {"urls": ["https://brain.example.org"], "localFallback": true}
 * urls — серверы мозга для всех учеников (по порядку); localFallback — искать ли мозг на этом ПК.
 */
export interface BrainAddressConfig {
  urls: string[]
  localFallback: boolean
}

const DEFAULT_CONFIG: BrainAddressConfig = { urls: [], localFallback: true }
const CONFIG_TIMEOUT_MS = 1_500
/** brain.json не загрузился (сеть, 404) — пробуем снова не раньше чем через минуту. */
const CONFIG_RETRY_MS = 60_000

const normUrl = (u: string) => u.trim().replace(/\/+$/, '')
const isLoopbackHost = (h: string) => /^(localhost|127(\.\d+){3}|\[::1\])$/i.test(h)
const isPrivateHost = (h: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || /\.local$/i.test(h)

/** Разобрать brain.json: мусор → умолчания; только http(s)-адреса, без повторов, не больше 5. */
export function parseBrainConfig(raw: unknown): BrainAddressConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG }
  const r = raw as { urls?: unknown; url?: unknown; localFallback?: unknown }
  const list = Array.isArray(r.urls) ? r.urls : typeof r.url === 'string' ? [r.url] : []
  const urls: string[] = []
  for (const u of list) {
    if (typeof u !== 'string') continue
    const url = normUrl(u)
    try {
      const p = new URL(url)
      if ((p.protocol === 'https:' || p.protocol === 'http:') && !urls.includes(url)) urls.push(url)
    } catch {
      // не адрес — пропускаем
    }
  }
  return { urls: urls.slice(0, 5), localFallback: r.localFallback !== false }
}

let configOverride: BrainAddressConfig | null = null
let configPromise: Promise<BrainAddressConfig> | null = null
let configFailedAt = 0

/** Задать адреса вместо brain.json (самопроверка, встраивание); null — снова читать brain.json. */
export function setBrainAddressConfig(cfg: BrainAddressConfig | null): void {
  configOverride = cfg ? parseBrainConfig(cfg) : null
  configPromise = null
  configFailedAt = 0
  activeUrl = null
  activeKind = null
  checkedAt = 0
  // другой сервер — забываем, что прежний был занят
  busy = false
  busyUntil = 0
  lastChatBusy = null
  if (busyTimer) clearTimeout(busyTimer)
  busyTimer = null
  emit()
}

/** brain.json один раз за сеанс (no-store, ≤ 1,5 с); не загрузился — умолчания (мозг на этом ПК). */
export function loadBrainAddressConfig(): Promise<BrainAddressConfig> {
  if (configOverride) return Promise.resolve(configOverride)
  if (configPromise && !(configFailedAt && Date.now() - configFailedAt > CONFIG_RETRY_MS)) return configPromise
  configFailedAt = 0
  configPromise = (async () => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), CONFIG_TIMEOUT_MS)
    try {
      const res = await fetch(publicAssetUrl('brain.json'), { cache: 'no-store', signal: ctrl.signal })
      if (!res.ok) throw new Error(`brain.json ${res.status}`)
      return parseBrainConfig(await res.json())
    } catch {
      configFailedAt = Date.now()
      return { ...DEFAULT_CONFIG }
    } finally {
      clearTimeout(timer)
    }
  })()
  return configPromise
}

interface BrainCandidate {
  url: string
  kind: BrainKind
  /** Адрес этого ПК / локальной сети, а сайт открыт из интернета — браузер спросит разрешение (Local Network Access). */
  space: 'loopback' | 'local' | null
}

function pageHost(): { host: string; https: boolean } {
  try {
    return typeof location !== 'undefined' ? { host: location.hostname, https: location.protocol === 'https:' } : { host: '', https: false }
  } catch {
    return { host: '', https: false }
  }
}

function candidateOf(url: string): BrainCandidate | null {
  try {
    const target = new URL(url).hostname
    const page = pageHost()
    const local = isLoopbackHost(target) || isPrivateHost(target)
    // https-сайт не может обратиться к http-серверу в интернете (смешанное содержимое) — такой адрес бесполезен
    if (!local && page.https && url.startsWith('http:')) return null
    let space: BrainCandidate['space'] = null
    if (!isLoopbackHost(page.host)) {
      if (isLoopbackHost(target)) space = 'loopback'
      else if (isPrivateHost(target) && !isPrivateHost(page.host)) space = 'local'
    }
    return { url, kind: local ? 'local' : 'remote', space }
  } catch {
    return null
  }
}

/** Кандидаты по порядку: VITE_BRAIN_URL; иначе серверы из brain.json, затем мозг на этом ПК (localFallback). */
async function brainCandidates(): Promise<BrainCandidate[]> {
  if (BRAIN_DISABLED) return []
  const urls: string[] = []
  if (ENV_URL && !configOverride) urls.push(ENV_URL)
  else {
    const cfg = await loadBrainAddressConfig()
    urls.push(...cfg.urls)
    if (cfg.localFallback) urls.push(LOCAL_BRAIN_URL)
  }
  const out: BrainCandidate[] = []
  for (const u of urls) {
    const c = candidateOf(u)
    if (c && !out.some((x) => x.url === c.url)) out.push(c)
  }
  return out
}

/* ------------------------------------------------------------------ сроки */

/** Мозг на этом ПК / в сети отвечает мгновенно. */
const HEALTH_TIMEOUT_MS = 800
/** Сервер в интернете: даём время на TLS и дальнюю дорогу. */
const REMOTE_HEALTH_TIMEOUT_MS = 2_500
const CACHE_MS = 20_000
/** Мозг на этом ПК недоступен: перепроверяем не чаще раза в 5 с (быстрый запасной путь). */
const OFFLINE_RECHECK_MS = 5_000
const POLL_MS = 30_000
/** Нет ни одного байта ответа /chat — сервер завис (заголовки и «сердцебиение» сервер шлёт сразу). */
const FIRST_BYTE_TIMEOUT_MS = 6_000
/**
 * Ждём первый кусок ответа столько же, сколько сервер ждёт первый токен модели (config.timeouts.firstTokenMs = 45 с)
 * + запас на поиск и запасной путь сервера: процессор этого ПК читает подсказку 7b до 20–40 с. Пока ждём —
 * сервер шлёт «сердцебиение» (SSE-комментарии), UI показывает «Думаю…»; сердцебиение этот срок НЕ продлевает.
 * Пока вопрос стоит в очереди сервера (событие queue), срок отсчитывается заново от выхода из очереди.
 */
export const FIRST_DELTA_TIMEOUT_MS = 50_000
/** Сколько ждать в очереди сервера, прежде чем ответить из базы браузера. */
const QUEUE_WAIT_MS = 90_000
/** Пауза между событиями потока после первого куска (модель пишет ~10 ток/с). */
const IDLE_TIMEOUT_MS = 45_000
const TOTAL_TIMEOUT_MS = 180_000
const MAX_MESSAGES = 12
const MAX_CONTENT = 4_000
/** Фото: не больше двух в сообщении; на загрузку тела с фото по мобильной сети — запас к сроку первого байта. */
const MAX_IMAGES = 2
const PHOTO_UPLOAD_EXTRA_MS = 25_000
/** Сервер ответил 429 / «занят»: столько не шлём ему вопросы (если он не прислал Retry-After). */
const BUSY_DEFAULT_MS = 20_000
const BUSY_MAX_MS = 60_000

/* ------------------------------------------------------------------ состояние */

let status: BrainStatus = BRAIN_DISABLED ? 'offline' : 'checking'
let lastHealth: BrainHealth | null = null
let checkedAt = 0
let inflight: Promise<boolean> | null = null
const listeners = new Set<() => void>()
let pollTimer: ReturnType<typeof setInterval> | null = null
/** Адрес, который ответил на /health последним. */
let activeUrl: string | null = null
let activeKind: BrainKind | null = null
/** В списке адресов есть сервер в интернете (тогда офлайн перепроверяем реже — каждый вопрос не ждёт 2,5 с). */
let hasRemote = false
/** Мозг на этом ПК есть в списке, но к нему нельзя без разрешения браузера / согласия ученика. */
let localGated = false

/** Снимок для UI (неизменяемый объект — для useSyncExternalStore). */
export interface BrainInfo {
  status: BrainStatus
  /** Кто отвечает, когда status === 'online'. */
  kind: BrainKind | null
  access: BrainAccess
  /** Сервер мозга задан в brain.json / VITE_BRAIN_URL. */
  remoteConfigured: boolean
  /** Ученик сам выбрал «Использовать мозг на этом компьютере». */
  localOptIn: boolean
  /** Можно предложить «Использовать мозг на этом компьютере» (адрес есть, но без согласия к нему не стучимся). */
  canUseLocal: boolean
  /** Ждём ответа в окне разрешения браузера. */
  waitingPermission: boolean
  /** Сервер недавно ответил «занят» / 429 — вопросы идут в базу браузера. */
  busy: boolean
  /** Место в очереди сервера для текущего вопроса (null — не в очереди). */
  queue: number | null
}

let info: BrainInfo | null = null

function snapshot(): BrainInfo {
  return {
    status,
    kind: status === 'online' ? activeKind : null,
    access,
    remoteConfigured: hasRemote,
    localOptIn: localOptIn(),
    canUseLocal: status !== 'online' && localGated && !localOptIn() && access !== 'granted',
    waitingPermission,
    busy,
    queue,
  }
}

/** Пересобрать снимок и оповестить подписчиков, если что-то изменилось. */
function emit(): void {
  const next = snapshot()
  const prev = info
  if (prev && (Object.keys(next) as (keyof BrainInfo)[]).every((k) => prev[k] === next[k])) return
  info = next
  listeners.forEach((l) => l())
}

function setStatus(next: BrainStatus): void {
  status = next
  emit()
}

export function getBrainStatus(): BrainStatus {
  return status
}

export function getBrainHealth(): BrainHealth | null {
  return lastHealth
}

/** Адрес мозга, который сейчас отвечает (null — мозг не найден). */
export function getBrainUrl(): string | null {
  return status === 'online' ? activeUrl : null
}

export function getBrainInfo(): BrainInfo {
  if (!info) info = snapshot()
  return info
}

/** Пометить мозг недоступным (обрыв потока, ошибка сети) — следующий вопрос уйдёт в запасной путь. */
export function markBrainOffline(): void {
  checkedAt = Date.now()
  lastHealth = null
  setStatus('offline')
}

/* ------------------------------------------------- «занят» и очередь сервера */

let busy = false
let busyUntil = 0
let busyTimer: ReturnType<typeof setTimeout> | null = null
/** Последний streamChat закончился «занят» / 429 — пометка для ответа из базы браузера. */
let lastChatBusy: 'rate' | 'busy' | null = null
let queue: number | null = null

function noteBusy(kind: 'rate' | 'busy', retryAfterSec?: number | null): void {
  const ms = retryAfterSec && retryAfterSec > 0 ? Math.min(BUSY_MAX_MS, retryAfterSec * 1000) : BUSY_DEFAULT_MS
  busyUntil = Date.now() + ms
  lastChatBusy = kind
  busy = true
  if (busyTimer) clearTimeout(busyTimer)
  busyTimer = setTimeout(() => {
    busy = false
    busyTimer = null
    emit()
  }, ms)
  emit()
}

function setQueue(n: number | null): void {
  queue = n
  emit()
}

/** Короткая пометка «сервер занят» на языке ученика (одна на ответ). */
export const BRAIN_BUSY_NOTE: Record<'ru' | 'en' | 'uz', string> = {
  ru: 'Сервер ATOMLAB сейчас отвечает другим ученикам, поэтому этот ответ — из базы знаний в браузере.',
  en: 'The ATOMLAB server is busy with other students right now, so this answer comes from the in-browser knowledge base.',
  uz: 'ATOMLAB serveri hozir boshqa o‘quvchilarga javob bermoqda, shuning uchun bu javob brauzerdagi bilimlar bazasidan.',
}

/** После streamChat → null: был ли сервер занят (429 / очередь полна)? Пометка на языке ученика ('' — не был) и сброс. */
export function takeBrainBusyNote(lang: string | null | undefined): string {
  if (!lastChatBusy) return ''
  lastChatBusy = null
  return BRAIN_BUSY_NOTE[lang === 'en' || lang === 'uz' ? lang : 'ru']
}

/* ------------------------------------------------- фото задачи: сервер отклонил */

/** Последний streamChat с фото: сервер отклонил фото (лимит фото 429 / размер 413 / формат 415 / 400) — пометка. */
let lastPhotoReject: 'rate' | 'bad' | null = null

/** Короткая пометка, почему фото не разобрано (на языке ученика). */
export const BRAIN_PHOTO_NOTE: Record<'rate' | 'bad' | 'server', Record<'ru' | 'en' | 'uz', string>> = {
  rate: {
    ru: 'Фото сейчас слишком много подряд — подождите минуту или напишите условие задачи текстом.',
    en: 'Too many photos in a row — wait a minute or type the task text.',
    uz: 'Ketma-ket juda koʻp rasm yuborildi — bir daqiqa kuting yoki masala shartini matn bilan yozing.',
  },
  bad: {
    ru: 'Это фото сервер не принял (слишком большое или не JPEG/PNG/WebP). Сфотографируйте ещё раз или напишите условие текстом.',
    en: "The server didn't accept this photo (too large or not JPEG/PNG/WebP). Take it again or type the task text.",
    uz: 'Server bu rasmni qabul qilmadi (juda katta yoki JPEG/PNG/WebP emas). Qayta suratga oling yoki shartni matn bilan yozing.',
  },
  server: {
    ru: 'Фото разбирает ИИ-сервер, а он сейчас недоступен. Напишите условие задачи текстом — отвечу из базы знаний.',
    en: 'Photos are read by the AI server, which is unavailable right now. Type the task text and I will answer from the knowledge base.',
    uz: 'Rasmlarni AI-server oʻqiydi, u hozir ishlamayapti. Masala shartini matn bilan yozing — bilimlar bazasidan javob beraman.',
  },
}

/** После streamChat с фото → null: почему фото не разобрано ('' — сервер фото не отклонял) и сброс. */
export function takePhotoRejectNote(lang: string | null | undefined): string {
  const kind = lastPhotoReject
  lastPhotoReject = null
  return kind ? BRAIN_PHOTO_NOTE[kind][lang === 'en' || lang === 'uz' ? lang : 'ru'] : ''
}

/** Фото к последней реплике: только строки base64 без «data:», не больше MAX_IMAGES. */
function attachImages(
  messages: { role: 'user' | 'assistant'; content: string }[],
  images: readonly string[] | undefined,
): { role: 'user' | 'assistant'; content: string; images?: string[] }[] {
  const list = (images ?? []).map((x) => (typeof x === 'string' ? x.replace(/^data:[^,]*,/, '') : '')).filter(Boolean).slice(0, MAX_IMAGES)
  if (!list.length || !messages.length) return messages
  const out: { role: 'user' | 'assistant'; content: string; images?: string[] }[] = messages.slice()
  out[out.length - 1] = { ...out[out.length - 1]!, images: list }
  return out
}

/** Сервер прислал «занят»: код rate/too_many → 'rate'; busy/overloaded/queue_full/capacity → 'busy'. */
function busyCode(raw: unknown): 'rate' | 'busy' | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { code?: unknown; error?: unknown }
  const code = typeof r.code === 'string' ? r.code : r.error && typeof r.error === 'object' ? (r.error as { code?: unknown }).code : r.error
  if (typeof code !== 'string') return null
  if (/rate|too_many|429/i.test(code)) return 'rate'
  if (/busy|overload|queue|capacity|503/i.test(code)) return 'busy'
  return null
}

function retryAfterOf(res: Response): number | null {
  const v = Number(res.headers.get('Retry-After'))
  return Number.isFinite(v) && v > 0 ? v : null
}

/* ------------------------------------------- разрешение браузера на доступ к ПК */

/**
 * Chrome/Edge (Local Network Access) спрашивают пользователя, можно ли сайту из интернета обратиться
 * к программе на этом компьютере (127.0.0.1). Пока окно «Разрешить» открыто, запрос /health висит —
 * обрыв через 800 мс закрывал окно раньше, чем его успевали увидеть, и мозг навсегда был «не найден».
 * 'prompt' — ждём ответа пользователя без короткого тайм-аута; 'denied' — не стучимся, чип объясняет,
 * где включить доступ; 'unknown' — браузер такого разрешения не знает (Firefox, Safari, старый Chrome).
 * Чтобы окно не выскакивало у каждого ученика, к этому ПК стучимся, только если доступ уже 'granted'
 * или ученик сам нажал «Использовать мозг на этом компьютере» (запоминаем в localStorage).
 */
export type BrainAccess = 'unknown' | 'granted' | 'prompt' | 'denied'

/** Ждём ответа пользователя в окне разрешения браузера. */
const PERMISSION_WAIT_MS = 120_000
const OPT_IN_KEY = 'atomlab.brain.useLocal'

let access: BrainAccess = 'unknown'
let accessWatched = false
let waitingPermission = false
/** Согласие без localStorage (приватное окно, запрет сайта) — держим в памяти. */
let optInMemory: boolean | null = null

function localOptIn(): boolean {
  if (optInMemory !== null) return optInMemory
  try {
    optInMemory = typeof localStorage !== 'undefined' && localStorage.getItem(OPT_IN_KEY) === '1'
  } catch {
    optInMemory = false
  }
  return optInMemory
}

/** Запомнить выбор ученика «использовать мозг на этом компьютере» (true) или забыть его (false). */
export function setLocalBrainOptIn(on: boolean): void {
  optInMemory = on
  try {
    if (typeof localStorage !== 'undefined') {
      if (on) localStorage.setItem(OPT_IN_KEY, '1')
      else localStorage.removeItem(OPT_IN_KEY)
    }
  } catch {
    // хранилище недоступно — выбор живёт до перезагрузки страницы
  }
  emit()
}

/** Щелчок «Использовать мозг на этом компьютере»: запомнить и проверить сейчас (браузер может спросить разрешение). */
export function optInLocalBrain(): Promise<boolean> {
  setLocalBrainOptIn(true)
  return checkHealth(true)
}

function setAccess(next: BrainAccess): void {
  access = next
  emit()
}

export function getBrainAccess(): BrainAccess {
  return access
}

async function queryAccess(space: 'loopback' | 'local'): Promise<BrainAccess> {
  const perms = typeof navigator !== 'undefined' ? navigator.permissions : undefined
  if (!perms?.query) return 'unknown'
  // Chrome ≥ 145 делит разрешение на «loopback-network» и «local-network», раньше было одно «local-network-access»
  const names = space === 'loopback' ? ['loopback-network', 'local-network-access'] : ['local-network', 'local-network-access']
  for (const name of names) {
    try {
      const st = await perms.query({ name } as unknown as PermissionDescriptor)
      if (!accessWatched) {
        accessWatched = true
        st.onchange = () => {
          setAccess(st.state as BrainAccess)
          if (st.state === 'granted') void checkHealth(true)
        }
      }
      return st.state as BrainAccess
    } catch {
      // такого имени разрешения этот браузер не знает — пробуем следующее
    }
  }
  return 'unknown'
}

/** GET /health одного адреса: здоровье, 'busy' (сервер жив, но отвечает 429) или null. */
async function probe(url: string, timeoutMs: number): Promise<BrainHealth | 'busy' | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${url}/health`, { method: 'GET', signal: ctrl.signal, cache: 'no-store' })
    if (res.status === 429) return 'busy'
    if (!res.ok) return null
    const data = (await res.json()) as Partial<BrainHealth>
    return data?.ok === true && data.service === 'atomlab-brain' ? (data as BrainHealth) : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Найти мозг (кеш 20 с; `force` — проверить сейчас): сначала серверы (≤ 2,5 с каждый), затем мозг на этом ПК
 * (≤ 800 мс; с сайта из интернета — только с разрешения браузера или по согласию ученика; пока браузер
 * спрашивает разрешение — ждём ответа пользователя).
 */
export function checkHealth(force = false): Promise<boolean> {
  if (BRAIN_DISABLED || typeof fetch === 'undefined') {
    setStatus('offline')
    return Promise.resolve(false)
  }
  const age = Date.now() - checkedAt
  const offlineMs = hasRemote ? CACHE_MS : OFFLINE_RECHECK_MS
  if (!force && checkedAt > 0 && age < (status === 'online' ? CACHE_MS : offlineMs)) {
    return Promise.resolve(status === 'online')
  }
  if (inflight) return inflight
  const goOnline = (c: BrainCandidate, h: BrainHealth | 'busy'): boolean => {
    activeUrl = c.url
    activeKind = c.kind
    if (h !== 'busy') lastHealth = h
    checkedAt = Date.now()
    if (h === 'busy') noteBusy('busy')
    setStatus('online')
    return true
  }
  inflight = (async () => {
    try {
      const list = await brainCandidates()
      hasRemote = list.some((c) => c.kind === 'remote')
      // 1) адреса без окна разрешения: серверы мозга по порядку (и этот ПК, если сайт открыт с него же)
      for (const c of list) {
        if (c.space) continue
        const h = await probe(c.url, c.kind === 'remote' ? REMOTE_HEALTH_TIMEOUT_MS : HEALTH_TIMEOUT_MS)
        if (h) return goOnline(c, h)
      }
      // 2) мозг на этом ПК с сайта из интернета — только если доступ уже разрешён или ученик согласился
      const local = list.find((c) => c.space)
      localGated = false
      if (local?.space) {
        const acc = await queryAccess(local.space)
        setAccess(acc)
        if (acc !== 'granted' && !localOptIn()) {
          localGated = true
        } else if (acc !== 'denied') {
          waitingPermission = acc === 'prompt'
          emit()
          const h = await probe(local.url, waitingPermission ? PERMISSION_WAIT_MS : HEALTH_TIMEOUT_MS)
          if (h) return goOnline(local, h)
          if (waitingPermission) void queryAccess(local.space).then(setAccess)
        }
      }
      lastHealth = null
      activeUrl = null
      activeKind = null
      checkedAt = Date.now()
      setStatus('offline')
      return false
    } finally {
      waitingPermission = false
      inflight = null
      emit()
    }
  })()
  return inflight
}

/** Перед каждым вопросом: мозг сейчас отвечает? (кеш 20 с, быстро при «offline»; вопрос не ждёт окна разрешения). */
export function ensureBrainOnline(): Promise<boolean> {
  if (inflight && waitingPermission) return Promise.resolve(false)
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

const serverAccess = (): BrainAccess => 'unknown'

/** Разрешение браузера на доступ сайта к мозгу на этом ПК (для подсказки в чипе). */
export function useBrainAccess(): BrainAccess {
  return useSyncExternalStore(subscribeBrainStatus, getBrainAccess, serverAccess)
}

const SERVER_INFO: BrainInfo = {
  status: 'offline',
  kind: null,
  access: 'unknown',
  remoteConfigured: false,
  localOptIn: false,
  canUseLocal: false,
  waitingPermission: false,
  busy: false,
  queue: null,
}
const serverInfo = (): BrainInfo => SERVER_INFO

/** Всё о мозге для чипов: кто отвечает (сервер / этот ПК), занят ли, место в очереди, можно ли включить этот ПК. */
export function useBrainInfo(): BrainInfo {
  return useSyncExternalStore(subscribeBrainStatus, getBrainInfo, serverInfo)
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

/**
 * Заголовок с brainSessionId() для POST /chat и /image: сервер считает лимиты на ученика по паре «адрес + сессия»
 * (30 компьютеров класса за одним адресом школы не делят один лимит). Формат id — [A-Za-z0-9_-]{8,64}.
 */
export const BRAIN_SESSION_HEADER = 'X-Brain-Session'

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
 * Потоковый ответ мозга. null — мозга нет/ошибка до первого куска (тогда запасной путь); если сервер
 * занят (429 / очередь полна) — тоже null, а takeBrainBusyNote() отдаёт короткую пометку для ответа.
 * После первого куска любая ошибка возвращает уже полученный текст (`partial: true`).
 */
export async function streamChat(opts: StreamChatOptions): Promise<BrainDone | null> {
  lastChatBusy = null
  lastPhotoReject = null
  const withPhoto = !!opts.images?.length
  if (BRAIN_DISABLED || typeof fetch === 'undefined') return null
  const outer = opts.signal
  if (outer?.aborted) return null
  const messages = normalizeMessages(opts.messages)
  if (!messages.length) return null
  const base = activeUrl ?? (status === 'online' ? BRAIN_URL : null)
  if (!base) return null
  // сервер недавно ответил «занят» — не стучимся, сразу база браузера (с пометкой)
  if (busy && Date.now() < busyUntil) {
    lastChatBusy = 'busy'
    return null
  }

  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  outer?.addEventListener('abort', onAbort, { once: true })
  let timer: ReturnType<typeof setTimeout> | null = null
  const arm = (ms: number) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => ctrl.abort(), ms)
  }
  const t0 = Date.now()
  /** С какого момента ждём первый кусок: начало запроса или выход из очереди сервера. */
  let waitFrom = t0
  let queued = false
  let full = ''
  let meta: BrainMeta | null = null
  let gotDelta = false
  const partial = (): BrainDone | null =>
    gotDelta && full.trim() ? { ...normalizeDone(null, full, meta), partial: true, ms: Date.now() - t0 } : null

  try {
    arm(FIRST_BYTE_TIMEOUT_MS + (withPhoto ? PHOTO_UPLOAD_EXTRA_MS : 0))
    const res = await fetch(`${base}/chat`, {
      method: 'POST',
      // X-Brain-Session: лимиты мозга — на ученика, а не на весь адрес школы (класс за одним NAT)
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', [BRAIN_SESSION_HEADER]: brainSessionId() },
      body: JSON.stringify({
        sessionId: opts.sessionId ?? brainSessionId(),
        ...(opts.studentId ? { studentId: opts.studentId } : {}),
        lang: opts.lang,
        stream: true,
        messages: withPhoto ? attachImages(messages, opts.images) : messages,
        context: { ...opts.context, gradeId: brainGradeId(opts.context.gradeId) },
        ...(opts.student ? { student: opts.student } : {}),
      }),
      signal: ctrl.signal,
      cache: 'no-store',
    })
    if (res.status === 429) {
      // лимит фото (rule photo_*) — мозг не «занят»: текстовые вопросы ему по-прежнему можно задавать
      const rule = withPhoto ? (await res.json().catch(() => null) as { rule?: unknown } | null)?.rule : null
      if (typeof rule === 'string' && rule.startsWith('photo')) lastPhotoReject = 'rate'
      else noteBusy('rate', retryAfterOf(res))
      return null
    }
    if (withPhoto && (res.status === 400 || res.status === 413 || res.status === 415)) {
      lastPhotoReject = 'bad'
      return null
    }
    if (!res.ok || !res.body) {
      const code = res.status === 503 ? busyCode(await res.json().catch(() => null)) : null
      if (code) noteBusy(code, retryAfterOf(res))
      else if (res.status >= 500 || res.status === 404) markBrainOffline()
      return null
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      // до первого куска — общий срок от начала запроса / выхода из очереди (сердцебиение его не продлевает),
      // в очереди — до QUEUE_WAIT_MS; после первого куска — пауза между событиями
      arm(gotDelta ? IDLE_TIMEOUT_MS : Math.max(1_000, (queued ? QUEUE_WAIT_MS : FIRST_DELTA_TIMEOUT_MS) - (Date.now() - waitFrom)))
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
        if (ev.event === 'queue') {
          // сервер держит вопрос в очереди: {position} — место (1 — следующий), 0 / нет — очередь дошла
          const q = safeJson<{ position?: number }>(ev.data)
          const pos = typeof q?.position === 'number' && Number.isFinite(q.position) ? Math.max(0, Math.round(q.position)) : 0
          if (pos > 0) {
            if (!queued) waitFrom = Date.now()
            queued = true
            setQueue(pos)
            opts.onQueue?.(pos)
          } else if (queued) {
            queued = false
            waitFrom = Date.now()
            setQueue(null)
          }
        } else if (ev.event === 'meta') {
          meta = safeJson<BrainMeta>(ev.data)
          if (meta) opts.onMeta?.(meta)
          if (queued) {
            // очередь дошла — с этого момента ждём модель обычный срок
            queued = false
            waitFrom = Date.now()
            setQueue(null)
          }
        } else if (ev.event === 'delta') {
          const d = safeJson<{ text?: string }>(ev.data)
          const piece = typeof d?.text === 'string' ? d.text : ''
          if (!piece) continue
          if (queued || queue !== null) {
            queued = false
            setQueue(null)
          }
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
          // «занят» до первого куска — ответ из базы браузера с пометкой; мозг при этом жив
          const code = gotDelta ? null : busyCode(safeJson<unknown>(ev.data))
          if (code) noteBusy(code)
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
    // Долго простояли в очереди — сервер жив, просто занят: отвечаем из базы браузера с пометкой.
    if (queued && !gotDelta && !outer?.aborted) noteBusy('busy')
    else if (!outer?.aborted) markBrainOffline()
    return partial()
  } finally {
    if (timer) clearTimeout(timer)
    if (queue !== null) setQueue(null)
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
  const base = getBrainUrl()
  if (BRAIN_DISABLED || !base || typeof fetch === 'undefined') return false
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 3_000)
  try {
    const res = await fetch(`${base}/kb/append`, {
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
