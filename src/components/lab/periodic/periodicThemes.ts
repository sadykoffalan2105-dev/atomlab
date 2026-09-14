import { useCallback, useEffect, useState } from 'react'
import type { MessageKey } from '../../../i18n/useT'

/**
 * Темы страницы «Таблица Менделеева».
 * Сами цвета живут в periodicThemes.css (атрибут data-pt-theme на корне страницы);
 * здесь — список для переключателя и мини-превью.
 */
export type PeriodicThemeId = 'aurora' | 'neon' | 'paper' | 'chalk' | 'contrast'

/** Чем раскрашены ячейки: блоками s/p/d/f или классами элементов. */
export type PeriodicColorMode = 'block' | 'category'

export type PeriodicThemeMeta = {
  id: PeriodicThemeId
  nameKey: MessageKey
  descKey: MessageKey
  /** Мини-превью в переключателе: фон, рамка, цвета s/p/d/f, цвет символа. */
  preview: {
    bg: string
    frame: string
    tiles: readonly [string, string, string, string]
    fill: 'glass' | 'solid' | 'outline'
    ink: string
  }
}

export const PERIODIC_THEMES: readonly PeriodicThemeMeta[] = [
  {
    id: 'aurora',
    nameKey: 'periodic.themeAurora',
    descKey: 'periodic.themeAuroraDesc',
    preview: {
      bg: 'radial-gradient(90% 90% at 10% 0%, rgba(56,189,248,0.35), transparent 60%), radial-gradient(80% 80% at 100% 0%, rgba(168,85,247,0.35), transparent 60%), #070b18',
      frame: 'rgba(148,170,230,0.22)',
      tiles: ['#34d399', '#f472b6', '#60a5fa', '#a78bfa'],
      fill: 'glass',
      ink: '#e8edff',
    },
  },
  {
    id: 'neon',
    nameKey: 'periodic.themeNeon',
    descKey: 'periodic.themeNeonDesc',
    preview: {
      bg: 'linear-gradient(rgba(255,43,214,0.12) 1px, transparent 1px) 0 0 / 10px 10px, linear-gradient(90deg, rgba(0,229,255,0.12) 1px, transparent 1px) 0 0 / 10px 10px, #05020c',
      frame: 'rgba(255,43,214,0.45)',
      tiles: ['#00f5d4', '#ff2bd6', '#00b3ff', '#b983ff'],
      fill: 'outline',
      ink: '#ffffff',
    },
  },
  {
    id: 'paper',
    nameKey: 'periodic.themePaper',
    descKey: 'periodic.themePaperDesc',
    preview: {
      bg: 'linear-gradient(rgba(56,98,160,0.12) 1px, transparent 1px) 0 0 / 9px 9px, linear-gradient(90deg, rgba(56,98,160,0.12) 1px, transparent 1px) 0 0 / 9px 9px, #f6f1e4',
      frame: 'rgba(30,41,59,0.18)',
      tiles: ['#f9a8c9', '#fde68a', '#93c5fd', '#86efac'],
      fill: 'solid',
      ink: '#1b2233',
    },
  },
  {
    id: 'chalk',
    nameKey: 'periodic.themeChalk',
    descKey: 'periodic.themeChalkDesc',
    preview: {
      bg: 'radial-gradient(80% 70% at 50% 40%, #2f5747, #1b3a2e 80%)',
      frame: '#8a6038',
      tiles: ['#ffc2d4', '#fff1a1', '#a9d8ff', '#c5f5c0'],
      fill: 'outline',
      ink: '#f5f3e8',
    },
  },
  {
    id: 'contrast',
    nameKey: 'periodic.themeContrast',
    descKey: 'periodic.themeContrastDesc',
    preview: {
      bg: '#000000',
      frame: '#ffffff',
      tiles: ['#ff5c8a', '#ffd60a', '#4cc9f0', '#80ed99'],
      fill: 'solid',
      ink: '#000000',
    },
  },
]

const THEME_KEY = 'atomlab.periodic.theme'
const COLOR_KEY = 'atomlab.periodic.colorMode'

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = window.localStorage.getItem(key)
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* приватный режим / запрет хранилища — тема просто не запомнится */
  }
}

const THEME_IDS = PERIODIC_THEMES.map((th) => th.id)
const COLOR_MODES: readonly PeriodicColorMode[] = ['block', 'category']

/** Выбранная тема и режим раскраски, запоминаются в localStorage. */
export function usePeriodicTheme() {
  const [theme, setThemeState] = useState<PeriodicThemeId>(() => readStored(THEME_KEY, THEME_IDS, 'aurora'))
  const [colorMode, setColorModeState] = useState<PeriodicColorMode>(() =>
    readStored(COLOR_KEY, COLOR_MODES, 'block'),
  )

  useEffect(() => writeStored(THEME_KEY, theme), [theme])
  useEffect(() => writeStored(COLOR_KEY, colorMode), [colorMode])

  const setTheme = useCallback((id: PeriodicThemeId) => setThemeState(id), [])
  const setColorMode = useCallback((mode: PeriodicColorMode) => setColorModeState(mode), [])

  return { theme, setTheme, colorMode, setColorMode }
}
