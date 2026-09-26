/**
 * Агент устройства: связь ATOMLAB с платформой школ (протокол — src/admin/protocol.ts, docs/API.md в atomlab-admin).
 *
 * Что делает:
 *   • подключает устройство к школе по коду (device-enroll) и хранит deviceId/deviceToken в localStorage;
 *   • раз в heartbeatSec (±10 %, при скрытой вкладке — в 4 раза реже) шлёт пульс (device-heartbeat);
 *   • выполняет команды администратора: lock/unlock, message, reload, logout, update_now — и отчитывается
 *     (device-command-done);
 *   • на 401 (device_revoked) стирает токен и сообщает интерфейсу «Устройство отключено»;
 *   • копит события использования и отправляет их пачкой (usage-ingest) — без персональных данных.
 *
 * Инертность: без адреса сервера (config = null) или без подключения агент не делает НИ ОДНОГО запроса.
 * Модуль не читает import.meta.env и не трогает window на верхнем уровне — всё окружение передаётся
 * снаружи (см. deviceAgentHost.ts), поэтому его можно проверять в Node с подменённым fetch.
 */
import type {
  ClassAccess,
  DeviceInfo,
  DeviceKind,
  DevicePlatform,
  EnrollErrorCode,
  EnrollResponse,
  Feature,
  HeartbeatCommand,
  HeartbeatRequest,
  HeartbeatResponse,
  UpdateOffer,
  UsageEventInput,
  UsageEventKind,
} from './protocol'

export type DeviceAgentConfig = {
  /** адрес проекта Supabase, например https://xyz.supabase.co */
  baseUrl: string
  /** публичный (anon) ключ проекта — не секрет, права проверяет сервер */
  anonKey: string
}

type TimerId = unknown

export type DeviceAgentEnv = {
  fetch: (input: string, init?: RequestInit) => Promise<Response>
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  now: () => number
  random: () => number
  setTimeout: (fn: () => void, ms: number) => TimerId
  clearTimeout: (id: TimerId) => void
  /** вкладка скрыта (document.hidden) */
  isHidden: () => boolean
  /** текущий маршрут ATOMLAB («/learn/g/g7») */
  getRoute: () => string
  /** учётная запись учителя/класса, если выполнен вход (class-login), иначе null */
  getAccountId: () => string | null
  getScreen: () => string
  appVersion: string
  /** сведения об устройстве для подключения */
  getDeviceInfo: (name: string) => DeviceInfo
  /** команда reload */
  onReload: () => void
  /** команда logout: выйти из учётной записи учителя/класса */
  onLogout: () => void
  /** команда update_now (веб — перезагрузка, настольная версия — установка обновления) */
  onUpdateNow: (offer: UpdateOffer | null) => void
}

export type DeviceMessage = { id: string; text: string; at: number }

export type DeviceAgentState = {
  /** адрес платформы задан (иначе интерфейс пишет «Платформа школ пока не подключена») */
  configured: boolean
  enrolled: boolean
  deviceId: string | null
  schoolId: string | null
  classId: string | null
  schoolName: string | null
  className: string | null
  locked: boolean
  lockMessage: string | null
  /** администратор удалил устройство (401 device_revoked) — показать «Устройство отключено» */
  revoked: boolean
  messages: DeviceMessage[]
  update: UpdateOffer | null
  access: ClassAccess | null
  features: Feature[] | null
  /** время последнего успешного пульса (мс) */
  lastSeenAt: number | null
  /** последний пульс дошёл до сервера (null — ещё не было) */
  online: boolean | null
}

export type EnrollResult = { ok: true } | { ok: false; error: EnrollErrorCode }

export const DEVICE_STORAGE_KEY = 'atomlab.device.v1'
export const DEFAULT_HEARTBEAT_SEC = 60
/** во сколько раз реже пульс при скрытой вкладке */
export const HIDDEN_HEARTBEAT_FACTOR = 4
export const MAX_BACKOFF_MS = 10 * 60_000
export const USAGE_BATCH_MAX = 100
export const USAGE_QUEUE_MAX = 500
export const USAGE_FLUSH_MS = 60_000
const FIRST_BEAT_DELAY_MS = 1500
const EXECUTED_IDS_MAX = 200

type StoredDevice = {
  deviceId: string
  deviceToken: string
  schoolId: string
  classId: string | null
  heartbeatSec: number
  schoolName?: string | null
  className?: string | null
  /** блокировка переживает перезагрузку страницы */
  locked?: boolean
  lockMessage?: string | null
}

export type DeviceAgent = {
  getState: () => DeviceAgentState
  subscribe: (listener: () => void) => () => void
  /** запустить пульс (ничего не делает без настроек или без подключения) */
  start: () => void
  stop: () => void
  enroll: (code: string, name?: string) => Promise<EnrollResult>
  /** забыть подключение на этом устройстве (на сервере устройство удаляет администратор) */
  disconnect: () => void
  /** отправить пульс сейчас (кнопка «Проверить связь», тесты) */
  heartbeatNow: () => Promise<void>
  dismissMessage: (id: string) => void
  /** сбросить отметку «Устройство отключено» после того, как пользователь её увидел */
  clearRevoked: () => void
  /** вкладка стала видимой/скрытой — пересчитать расписание пульса */
  notifyVisibility: () => void
  /** событие использования в очередь (без подключения — пропускается) */
  track: (kind: UsageEventKind, target?: string | null, extra?: { durationSec?: number; score?: number }) => void
  /** отправить очередь событий; keepalive — при закрытии страницы */
  flushUsage: (opts?: { keepalive?: boolean }) => Promise<void>
  /** сколько событий ждут отправки (для тестов/диагностики) */
  pendingUsage: () => number
}

/** Код подключения: 6–8 букв/цифр, дефисы и пробелы допускаются («7K2-QM9»). */
export function normalizeEnrollCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/[\s_]+/g, '')
  const core = code.replace(/-/g, '')
  if (!/^[A-Z0-9]{6,8}$/.test(core)) return null
  if (!/^[A-Z0-9-]+$/.test(code)) return null
  return code
}

function initialState(configured: boolean): DeviceAgentState {
  return {
    configured,
    enrolled: false,
    deviceId: null,
    schoolId: null,
    classId: null,
    schoolName: null,
    className: null,
    locked: false,
    lockMessage: null,
    revoked: false,
    messages: [],
    update: null,
    access: null,
    features: null,
    lastSeenAt: null,
    online: null,
  }
}

function isStoredDevice(v: unknown): v is StoredDevice {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return typeof o.deviceId === 'string' && typeof o.deviceToken === 'string' && typeof o.schoolId === 'string'
}

function trimTarget(target: string | null | undefined): string | null {
  if (target == null) return null
  const s = String(target).trim()
  return s ? s.slice(0, 200) : null
}

export function createDeviceAgent(config: DeviceAgentConfig | null, env: DeviceAgentEnv): DeviceAgent {
  const configured = !!(config && config.baseUrl.trim() && config.anonKey.trim())
  const base = configured ? `${config!.baseUrl.trim().replace(/\/+$/, '')}/functions/v1/` : ''
  const anonKey = configured ? config!.anonKey.trim() : ''

  let state: DeviceAgentState = initialState(configured)
  let stored: StoredDevice | null = null
  const listeners = new Set<() => void>()
  let running = false
  let beatTimer: TimerId | null = null
  let nextBeatAt = 0
  let beatInFlight = false
  let failures = 0
  const executed: string[] = []
  let usageQueue: UsageEventInput[] = []
  let usageTimer: TimerId | null = null
  let usageInFlight = false

  function emit() {
    for (const l of [...listeners]) {
      try {
        l()
      } catch {
        /* слушатель интерфейса не должен ронять агента */
      }
    }
  }

  function setState(patch: Partial<DeviceAgentState>) {
    state = { ...state, ...patch }
    emit()
  }

  function readStored(): StoredDevice | null {
    if (!env.storage) return null
    try {
      const raw = env.storage.getItem(DEVICE_STORAGE_KEY)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      return isStoredDevice(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  function writeStored(d: StoredDevice | null) {
    if (!env.storage) return
    try {
      if (d) env.storage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(d))
      else env.storage.removeItem(DEVICE_STORAGE_KEY)
    } catch {
      /* приватный режим: подключение живёт до закрытия вкладки */
    }
  }

  function applyStored(d: StoredDevice | null) {
    stored = d
    if (!d) {
      setState({
        enrolled: false,
        deviceId: null,
        schoolId: null,
        classId: null,
        schoolName: null,
        className: null,
        locked: false,
        lockMessage: null,
      })
      return
    }
    setState({
      enrolled: true,
      deviceId: d.deviceId,
      schoolId: d.schoolId,
      classId: d.classId,
      schoolName: d.schoolName ?? null,
      className: d.className ?? null,
      locked: !!d.locked,
      lockMessage: d.lockMessage ?? null,
    })
  }

  // Без адреса сервера агент даже не смотрит в хранилище.
  if (configured) applyStored(readStored())

  async function post(
    fn: string,
    body: unknown,
    opts?: { auth?: 'anon' | 'device'; keepalive?: boolean },
  ): Promise<{ status: number; json: Record<string, unknown> | null }> {
    const headers: Record<string, string> = { apikey: anonKey, 'Content-Type': 'application/json' }
    const token = opts?.auth === 'device' ? stored?.deviceToken : anonKey
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await env.fetch(base + fn, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      keepalive: opts?.keepalive,
    })
    let json: Record<string, unknown> | null = null
    try {
      const text = await res.text()
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null
    } catch {
      json = null
    }
    return { status: res.status, json }
  }

  function heartbeatSec(): number {
    const s = stored?.heartbeatSec
    return typeof s === 'number' && s >= 10 && s <= 3600 ? s : DEFAULT_HEARTBEAT_SEC
  }

  function nextDelayMs(): number {
    const baseMs = heartbeatSec() * 1000
    if (failures > 0) {
      const backoff = Math.min(baseMs * 2 ** Math.min(failures, 8), MAX_BACKOFF_MS)
      return Math.round(backoff * (0.9 + 0.2 * env.random()))
    }
    const hidden = env.isHidden() ? HIDDEN_HEARTBEAT_FACTOR : 1
    return Math.round(baseMs * (0.9 + 0.2 * env.random()) * hidden)
  }

  function clearBeat() {
    if (beatTimer != null) env.clearTimeout(beatTimer)
    beatTimer = null
  }

  function scheduleBeat(ms: number) {
    clearBeat()
    if (!running || !stored) return
    nextBeatAt = env.now() + ms
    beatTimer = env.setTimeout(() => {
      beatTimer = null
      void beat()
    }, ms)
  }

  function forget(revoked: boolean) {
    clearBeat()
    clearUsageTimer()
    usageQueue = []
    writeStored(null)
    applyStored(null)
    setState({ revoked, update: null, access: null, features: null, online: null, lastSeenAt: null })
  }

  function persistLock(locked: boolean, lockMessage: string | null) {
    if (!stored) return
    if (!!stored.locked === locked && (stored.lockMessage ?? null) === lockMessage) return
    stored = { ...stored, locked, lockMessage }
    writeStored(stored)
  }

  async function commandDone(commandId: string) {
    try {
      await post('device-command-done', { commandId }, { auth: 'device' })
    } catch {
      /* не дошло — не страшно: сервер уже пометил доставку, повтор команды отсекается по id */
    }
  }

  function rememberExecuted(id: string): boolean {
    if (executed.includes(id)) return false
    executed.push(id)
    if (executed.length > EXECUTED_IDS_MAX) executed.splice(0, executed.length - EXECUTED_IDS_MAX)
    return true
  }

  async function handleHeartbeat(res: HeartbeatResponse) {
    const commands: HeartbeatCommand[] = Array.isArray(res.commands) ? res.commands : []
    let lockMessage: string | null = typeof res.lockMessage === 'string' ? res.lockMessage : state.lockMessage
    let lockedByCommand: boolean | null = null
    let wantReload = false
    let wantUpdate = false
    let wantLogout = false
    const newMessages: DeviceMessage[] = []

    for (const cmd of commands) {
      if (!cmd || typeof cmd.id !== 'string') continue
      const fresh = rememberExecuted(cmd.id)
      if (fresh) {
        switch (cmd.kind) {
          case 'message':
            if (cmd.text && cmd.text.trim()) newMessages.push({ id: cmd.id, text: cmd.text.trim(), at: env.now() })
            break
          case 'lock':
            lockedByCommand = true
            if (cmd.text && cmd.text.trim()) lockMessage = cmd.text.trim()
            break
          case 'unlock':
            lockedByCommand = false
            break
          case 'reload':
            wantReload = true
            break
          case 'update_now':
            wantUpdate = true
            break
          case 'logout':
            wantLogout = true
            break
          default:
            break
        }
      }
      // Отчитываемся ДО перезагрузки — иначе reload повторялся бы бесконечно.
      await commandDone(cmd.id)
    }

    // Истина о блокировке — поле locked ответа; команды lock/unlock в той же пачке его лишь дублируют.
    const locked = typeof res.locked === 'boolean' ? res.locked : (lockedByCommand ?? state.locked)
    if (!locked) lockMessage = null
    persistLock(locked, lockMessage)

    setState({
      locked,
      lockMessage,
      messages: newMessages.length ? [...state.messages, ...newMessages].slice(-5) : state.messages,
      update: res.update ?? null,
      access: res.access ?? null,
      features: Array.isArray(res.features) ? res.features : null,
      lastSeenAt: env.now(),
      online: true,
      revoked: false,
    })

    if (wantLogout) {
      try {
        env.onLogout()
      } catch {
        /* ignore */
      }
    }
    if (wantUpdate) env.onUpdateNow(res.update ?? null)
    else if (wantReload) env.onReload()
  }

  async function beat(): Promise<void> {
    if (!configured || !stored || beatInFlight) return
    beatInFlight = true
    try {
      const body: HeartbeatRequest = {
        appVersion: env.appVersion,
        route: env.getRoute(),
        accountId: env.getAccountId(),
        screen: env.getScreen(),
      }
      const { status, json } = await post('device-heartbeat', body, { auth: 'device' })
      if (status === 401) {
        forget(true)
        return
      }
      if (status >= 200 && status < 300 && json) {
        failures = 0
        await handleHeartbeat(json as unknown as HeartbeatResponse)
      } else {
        failures += 1
        setState({ online: false })
      }
    } catch {
      failures += 1
      setState({ online: false })
    } finally {
      beatInFlight = false
      if (running && stored) scheduleBeat(nextDelayMs())
    }
  }

  // ─── события использования ───────────────────────────────────────────────

  function clearUsageTimer() {
    if (usageTimer != null) env.clearTimeout(usageTimer)
    usageTimer = null
  }

  function scheduleUsageFlush() {
    if (usageTimer != null || !running || !stored || usageQueue.length === 0) return
    usageTimer = env.setTimeout(() => {
      usageTimer = null
      void flushUsage()
    }, USAGE_FLUSH_MS)
  }

  async function flushUsage(opts?: { keepalive?: boolean }): Promise<void> {
    if (!configured || !stored || usageInFlight || usageQueue.length === 0) return
    usageInFlight = true
    clearUsageTimer()
    try {
      while (usageQueue.length && stored) {
        const batch = usageQueue.slice(0, USAGE_BATCH_MAX)
        const { status } = await post('usage-ingest', { events: batch }, { auth: 'device', keepalive: opts?.keepalive })
        if (status === 401) {
          forget(true)
          return
        }
        if (status < 200 || status >= 300) break
        usageQueue = usageQueue.slice(batch.length)
      }
    } catch {
      /* сеть недоступна — отправим в следующий раз */
    } finally {
      usageInFlight = false
      scheduleUsageFlush()
    }
  }

  function track(kind: UsageEventKind, target?: string | null, extra?: { durationSec?: number; score?: number }) {
    if (!configured || !stored) return
    const ev: UsageEventInput = { at: new Date(env.now()).toISOString(), kind }
    // Вопросы ИИ-учителю — только факт, без текста и темы: target никогда не отправляется.
    const t = kind === 'ai_question' ? null : trimTarget(target)
    if (t) ev.target = t
    const accountId = env.getAccountId()
    if (accountId) ev.accountId = accountId
    if (extra?.durationSec != null && Number.isFinite(extra.durationSec)) ev.durationSec = Math.max(0, Math.round(extra.durationSec))
    if (extra?.score != null && Number.isFinite(extra.score)) ev.score = Math.min(1, Math.max(0, extra.score))
    usageQueue.push(ev)
    if (usageQueue.length > USAGE_QUEUE_MAX) usageQueue = usageQueue.slice(-USAGE_QUEUE_MAX)
    if (usageQueue.length >= USAGE_BATCH_MAX) void flushUsage()
    else scheduleUsageFlush()
  }

  // ─── публичные методы ────────────────────────────────────────────────────

  async function enroll(rawCode: string, name?: string): Promise<EnrollResult> {
    if (!configured) return { ok: false, error: 'not_configured' }
    const code = normalizeEnrollCode(rawCode)
    if (!code) return { ok: false, error: 'bad_code' }
    const device = env.getDeviceInfo((name ?? '').trim().slice(0, 60))
    try {
      const { status, json } = await post('device-enroll', { code, device }, { auth: 'anon' })
      if (status >= 200 && status < 300 && json && typeof json.deviceId === 'string' && typeof json.deviceToken === 'string') {
        const r = json as unknown as EnrollResponse
        const d: StoredDevice = {
          deviceId: r.deviceId,
          deviceToken: r.deviceToken,
          schoolId: String(r.schoolId ?? ''),
          classId: r.classId ?? null,
          heartbeatSec: typeof r.heartbeatSec === 'number' ? r.heartbeatSec : DEFAULT_HEARTBEAT_SEC,
          schoolName: typeof r.schoolName === 'string' ? r.schoolName : null,
          className: typeof r.className === 'string' ? r.className : null,
          locked: false,
          lockMessage: null,
        }
        failures = 0
        writeStored(d)
        applyStored(d)
        setState({ revoked: false, online: null })
        if (running) scheduleBeat(FIRST_BEAT_DELAY_MS)
        return { ok: true }
      }
      const err = typeof json?.error === 'string' ? json.error : typeof json?.code === 'string' ? json.code : ''
      if (status === 404 || err === 'code_not_found') return { ok: false, error: 'code_not_found' }
      if (status === 410 || err === 'code_expired') return { ok: false, error: 'code_expired' }
      if (status === 409 || err === 'seats_exceeded') return { ok: false, error: 'seats_exceeded' }
      return { ok: false, error: 'server' }
    } catch {
      return { ok: false, error: 'network' }
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start() {
      if (running) return
      running = true
      if (!configured || !stored) return
      scheduleBeat(FIRST_BEAT_DELAY_MS)
      scheduleUsageFlush()
    },
    stop() {
      running = false
      clearBeat()
      clearUsageTimer()
    },
    enroll,
    disconnect() {
      forget(false)
    },
    heartbeatNow: () => beat(),
    dismissMessage(id) {
      if (!state.messages.some((m) => m.id === id)) return
      setState({ messages: state.messages.filter((m) => m.id !== id) })
    },
    clearRevoked() {
      if (state.revoked) setState({ revoked: false })
    },
    notifyVisibility() {
      if (!running || !stored || beatInFlight) return
      if (env.isHidden()) return
      // Вкладку открыли снова — не ждём «скрытый» (длинный) интервал.
      if (nextBeatAt - env.now() > FIRST_BEAT_DELAY_MS) scheduleBeat(FIRST_BEAT_DELAY_MS)
    },
    track,
    flushUsage,
    pendingUsage: () => usageQueue.length,
  }
}

// ─── сведения об устройстве ─────────────────────────────────────────────────

export type DeviceProbe = {
  userAgent: string
  maxTouchPoints: number
  screenWidth: number
  screenHeight: number
  /** настольная сборка (Electron) */
  desktopApp: boolean
  appVersion: string
}

function detectPlatform(ua: string, desktopApp: boolean): DevicePlatform {
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (!desktopApp) return 'web'
  if (/Windows/i.test(ua)) return 'windows'
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macos'
  if (/Linux/i.test(ua)) return 'linux'
  return 'web'
}

function detectKind(p: DeviceProbe): DeviceKind {
  const ua = p.userAgent
  const long = Math.max(p.screenWidth, p.screenHeight)
  if (/iPhone|Android.+Mobile/i.test(ua)) return 'phone'
  if (/iPad|Android/i.test(ua)) return 'tablet'
  // Большой сенсорный экран — интерактивная доска.
  if (p.maxTouchPoints > 1 && long >= 1600) return 'board'
  if (p.maxTouchPoints > 1) return 'laptop'
  return 'desktop'
}

/** «Chrome 130 / Windows 10» — без версии сборки и прочих подробностей. */
export function shortUserAgent(ua: string): string {
  const browser =
    ua.match(/Electron\/(\d+)/)?.[1] != null
      ? `ATOMLAB Desktop`
      : ua.match(/Edg\/(\d+)/)
        ? `Edge ${ua.match(/Edg\/(\d+)/)![1]}`
        : ua.match(/Firefox\/(\d+)/)
          ? `Firefox ${ua.match(/Firefox\/(\d+)/)![1]}`
          : ua.match(/Chrome\/(\d+)/)
            ? `Chrome ${ua.match(/Chrome\/(\d+)/)![1]}`
            : ua.match(/Version\/(\d+).*Safari/)
              ? `Safari ${ua.match(/Version\/(\d+).*Safari/)![1]}`
              : 'Браузер'
  const os = /Windows NT 10/.test(ua)
    ? 'Windows 10/11'
    : /Windows/.test(ua)
      ? 'Windows'
      : /Android (\d+)/.test(ua)
        ? `Android ${ua.match(/Android (\d+)/)![1]}`
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Mac OS X/.test(ua)
            ? 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : ''
  return os ? `${browser} / ${os}` : browser
}

export function collectDeviceInfo(p: DeviceProbe, name: string): DeviceInfo {
  const kind = detectKind(p)
  const platform = detectPlatform(p.userAgent, p.desktopApp)
  const fallbackName = `ATOMLAB · ${shortUserAgent(p.userAgent)}`
  return {
    name: name || fallbackName,
    kind,
    platform,
    userAgent: shortUserAgent(p.userAgent),
    screen: `${Math.round(p.screenWidth)}×${Math.round(p.screenHeight)}`,
    appVersion: p.appVersion,
  }
}
