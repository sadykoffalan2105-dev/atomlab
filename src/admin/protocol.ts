/**
 * Протокол устройства ATOMLAB ↔ платформа школ (ATOMLAB Admin).
 *
 * Копия нужной части договора данных из репозитория atomlab-admin:
 *   • src/domain/types.ts — типы;
 *   • docs/API.md — вызовы device-enroll, device-heartbeat, device-command-done, usage-ingest, class-login.
 * Источник правды — atomlab-admin; здесь ничего не придумываем. Поля, помеченные «необязательное дополнение»,
 * в договоре пока нет: агент их читает, если сервер пришлёт, и прекрасно работает без них.
 */

export type ID = string
export type ISODate = string

export type Feature = 'lab' | 'organic' | 'vr' | 'learn' | 'ai_teacher' | 'catalog' | 'periodic' | 'teacher_cabinet'

export type DeviceKind = 'board' | 'desktop' | 'laptop' | 'tablet' | 'phone'
export type DevicePlatform = 'web' | 'windows' | 'macos' | 'linux' | 'android' | 'ios'

export type DeviceCommandKind = 'lock' | 'unlock' | 'message' | 'reload' | 'update_now' | 'logout'

export type UsageEventKind =
  | 'session_start'
  | 'session_end'
  | 'route_view'
  | 'lesson_open'
  | 'reaction_run'
  | 'quiz_done'
  | 'ai_question'
  | 'vr_session'

/** Что сервер отвечает устройству на пульс про обновления. */
export type UpdateOffer = {
  available: boolean
  version: string | null
  mandatory: boolean
  downloadUrl: string | null
  notes: string | null
}

// ─── 1. device-enroll ───────────────────────────────────────────────────────

export type DeviceInfo = {
  name: string
  kind: DeviceKind
  platform: DevicePlatform
  userAgent: string
  screen: string
  appVersion: string
}

export type EnrollRequest = { code: string; device: DeviceInfo }

export type EnrollResponse = {
  deviceId: ID
  deviceToken: string
  schoolId: ID
  classId: ID | null
  heartbeatSec: number
  /** необязательное дополнение: название школы для строки «Подключено к школе …» */
  schoolName?: string
  /** необязательное дополнение: название класса («7А») */
  className?: string
}

/** Ошибки подключения из API.md + сетевые/локальные. */
export type EnrollErrorCode =
  | 'code_not_found'
  | 'code_expired'
  | 'seats_exceeded'
  | 'not_configured'
  | 'bad_code'
  | 'network'
  | 'server'

// ─── 2. device-heartbeat ────────────────────────────────────────────────────

export type HeartbeatRequest = {
  appVersion: string
  route: string
  accountId: ID | null
  screen: string
}

/** Команда в ответе на пульс (подмножество DeviceCommand, которое видит устройство). */
export type HeartbeatCommand = {
  id: ID
  kind: DeviceCommandKind
  text?: string
}

export type ClassAccess = {
  mode: 'always' | 'schedule' | 'off'
  open: boolean
  until?: ISODate | null
}

export type HeartbeatResponse = {
  serverTime: ISODate
  locked: boolean
  commands: HeartbeatCommand[]
  update?: UpdateOffer | null
  access?: ClassAccess | null
  features?: Feature[]
  /** необязательное дополнение: текст администратора на экране блокировки */
  lockMessage?: string | null
}

// ─── 3. device-command-done ─────────────────────────────────────────────────

export type CommandDoneRequest = { commandId: ID }

// ─── 4. usage-ingest ────────────────────────────────────────────────────────

/** Событие использования в том виде, как его шлёт устройство (сервер сам добавляет deviceId/schoolId/classId). */
export type UsageEventInput = {
  at: ISODate
  kind: UsageEventKind
  /** маршрут ATOMLAB или id урока/реакции — без персональных данных */
  target?: string | null
  accountId?: ID | null
  durationSec?: number
  score?: number
}

export type UsageIngestRequest = { events: UsageEventInput[] }

// ─── 5. class-login ─────────────────────────────────────────────────────────

export type ClassLoginRequest = { login: string; password: string }

export type ClassLoginAccount = {
  id: ID
  role: 'teacher' | 'class'
  displayName: string
  scope: { schoolId?: ID; classId?: ID }
}

export type ClassLoginResponse = {
  accessToken: string
  refreshToken: string
  account: ClassLoginAccount
  features: Feature[]
}

export type ClassLoginErrorCode =
  | 'bad_credentials'
  | 'access_closed'
  | 'suspended'
  | 'not_configured'
  | 'network'
  | 'server'
