/**
 * Глобальная тема приложения: 'dark' | 'light'.
 *
 * Хранится в localStorage('atomlab-theme'); если записи нет — берём системную
 * (prefers-color-scheme). Значение пишется атрибутом data-app-theme на <html>,
 * а цветовые токены --lt-* переопределяются в src/theme/appTheme.css.
 *
 * Страница «Таблица Менделеева» продолжает жить своими темами (data-pt-theme
 * на корне страницы): её правила стоят на элементе страницы и перебивают
 * значения, унаследованные от <html>.
 */
import { useSyncExternalStore } from 'react'

export type AppThemeId = 'dark' | 'light'

export const APP_THEME_STORAGE_KEY = 'atomlab-theme'

const listeners = new Set<() => void>()

function isThemeId(value: unknown): value is AppThemeId {
  return value === 'dark' || value === 'light'
}

function readStored(): AppThemeId | null {
  try {
    const raw = window.localStorage.getItem(APP_THEME_STORAGE_KEY)
    return isThemeId(raw) ? raw : null
  } catch {
    return null
  }
}

function systemTheme(): AppThemeId {
  try {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light'
    }
  } catch {
    /* matchMedia недоступен — остаёмся на тёмной */
  }
  return 'dark'
}

let current: AppThemeId = 'dark'
let booted = false

function applyToDocument(theme: AppThemeId): void {
  const root = document.documentElement
  root.dataset.appTheme = theme
  root.style.colorScheme = theme
}

/** Вызывается как можно раньше (main.tsx), чтобы не было вспышки чужой темы. */
export function initAppTheme(): AppThemeId {
  if (booted) return current
  booted = true
  current = readStored() ?? systemTheme()
  applyToDocument(current)
  return current
}

export function getAppTheme(): AppThemeId {
  if (!booted) return initAppTheme()
  return current
}

export function setAppTheme(theme: AppThemeId): void {
  booted = true
  if (current === theme && document.documentElement.dataset.appTheme === theme) return
  current = theme
  applyToDocument(theme)
  try {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, theme)
  } catch {
    /* приватный режим — тема просто не переживёт перезагрузку */
  }
  listeners.forEach((listener) => {
    listener()
  })
}

export function toggleAppTheme(): AppThemeId {
  const next: AppThemeId = getAppTheme() === 'dark' ? 'light' : 'dark'
  setAppTheme(next)
  return next
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAppTheme(): { theme: AppThemeId; setTheme: (theme: AppThemeId) => void; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, getAppTheme, () => 'dark' as AppThemeId)
  return { theme, setTheme: setAppTheme, toggle: toggleAppTheme }
}
