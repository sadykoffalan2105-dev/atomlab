/**
 * Агент устройства в браузере: единственный экземпляр на всё приложение.
 *
 * Адрес платформы — VITE_ADMIN_SUPABASE_URL и VITE_ADMIN_SUPABASE_ANON_KEY (anon-ключ публичный, права проверяет
 * сервер). Если хотя бы одного нет — агент инертен: ни одного сетевого запроса, интерфейс пишет
 * «Платформа школ пока не подключена».
 */
import { useSyncExternalStore } from 'react'
import { version as APP_VERSION } from '../../package.json'
import { getAtomlabDesktop, isAtomlabDesktop } from '../electronBridge.types'
import { collectDeviceInfo, createDeviceAgent, type DeviceAgent, type DeviceAgentConfig, type DeviceAgentState } from './deviceAgent'
import type { UsageEventKind } from './protocol'
import { getSchoolAccountId, clearSchoolSession } from './schoolSession'

export function readAdminConfig(): DeviceAgentConfig | null {
  const baseUrl = String(import.meta.env.VITE_ADMIN_SUPABASE_URL ?? '').trim()
  const anonKey = String(import.meta.env.VITE_ADMIN_SUPABASE_ANON_KEY ?? '').trim()
  if (!baseUrl || !anonKey) return null
  if (!/^https?:\/\//i.test(baseUrl)) return null
  return { baseUrl, anonKey }
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function currentRoute(): string {
  const hash = window.location.hash || ''
  const path = hash.startsWith('#') ? hash.slice(1) : hash
  // Без параметров запроса: в них могут оказаться посторонние данные.
  return (path.split('?')[0] || '/').slice(0, 200)
}

function screenString(): string {
  const w = window.screen?.width ?? window.innerWidth
  const h = window.screen?.height ?? window.innerHeight
  return `${Math.round(w)}×${Math.round(h)}`
}

let agent: DeviceAgent | null = null

export function getDeviceAgent(): DeviceAgent {
  if (agent) return agent
  agent = createDeviceAgent(readAdminConfig(), {
    fetch: (input, init) => window.fetch(input, init),
    storage: safeStorage(),
    now: () => Date.now(),
    random: () => Math.random(),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id as number),
    isHidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
    getRoute: currentRoute,
    getAccountId: getSchoolAccountId,
    getScreen: screenString,
    appVersion: APP_VERSION,
    getDeviceInfo: (name) =>
      collectDeviceInfo(
        {
          userAgent: navigator.userAgent,
          maxTouchPoints: navigator.maxTouchPoints ?? 0,
          screenWidth: window.screen?.width ?? window.innerWidth,
          screenHeight: window.screen?.height ?? window.innerHeight,
          desktopApp: isAtomlabDesktop(),
          appVersion: APP_VERSION,
        },
        name,
      ),
    onReload: () => {
      const desk = getAtomlabDesktop()
      if (desk) void desk.reloadApp()
      else window.location.reload()
    },
    onLogout: () => clearSchoolSession(),
    onUpdateNow: () => {
      const desk = getAtomlabDesktop()
      if (desk) {
        // Настольная версия: скачанное обновление ставится сразу, иначе — проверить и перезапуститься позже.
        void desk
          .getUpdateStatus()
          .then(async (s) => {
            if (s.state === 'downloaded') await desk.installUpdate()
            else await desk.checkForUpdates()
          })
          .catch(() => undefined)
      } else {
        // Веб-версия: свежая сборка приходит с перезагрузкой страницы.
        window.location.reload()
      }
    },
  })
  return agent
}

let wired = false

/** Запустить агента и подписаться на видимость вкладки (один раз за жизнь страницы). */
export function startDeviceAgent(): DeviceAgent {
  const a = getDeviceAgent()
  if (wired) return a
  wired = true
  a.start()
  if (!a.getState().configured) return a
  const startedAt = Date.now()
  let sessionOpen = false
  const openSession = () => {
    if (sessionOpen || !a.getState().enrolled) return
    sessionOpen = true
    a.track('session_start')
  }
  openSession()
  // Подключили устройство посреди работы — сессия начинается с этого момента.
  a.subscribe(openSession)
  document.addEventListener('visibilitychange', () => {
    a.notifyVisibility()
    if (document.visibilityState === 'hidden') void a.flushUsage({ keepalive: true })
  })
  window.addEventListener('pagehide', () => {
    if (sessionOpen) a.track('session_end', null, { durationSec: (Date.now() - startedAt) / 1000 })
    sessionOpen = false
    void a.flushUsage({ keepalive: true })
  })
  return a
}

/**
 * Событие использования для платформы школ. Без адреса сервера или без подключения — ничего не делает.
 * target — только маршрут или id урока/реакции; никаких текстов, имён и ответов учеников.
 */
export function trackUsage(kind: UsageEventKind, target?: string | null): void {
  getDeviceAgent().track(kind, target)
}

/** Урок учебника или задания по маршруту: «/learn/g/g7/c/c1/s/s01» → «g7/c1/s01». */
export function lessonTargetFromPath(pathname: string): string | null {
  const book = pathname.match(/^\/learn\/g\/([^/]+)\/c\/([^/]+)\/s\/([^/]+)/)
  if (book) return `${book[1]}/${book[2]}/${book[3]}`
  const task = pathname.match(/^\/learn\/tasks\/([^/]+)/)
  if (task) return `tasks/${task[1]}`
  const pathway = pathname.match(/^\/learn\/pathway\/([^/]+)\/([^/]+)/)
  if (pathway) return `pathway/${pathway[1]}/${pathway[2]}`
  return null
}

export function useDeviceAgentState(): DeviceAgentState {
  const a = getDeviceAgent()
  return useSyncExternalStore(a.subscribe, a.getState, a.getState)
}
