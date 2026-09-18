import { useEffect } from 'react'

export type StudioShortcutHandlers = {
  /** Клавиши 1 / 2 / 3. */
  onPanelKey: (key: '1' | '2' | '3') => void
  /** B — режим доски. */
  onBoard: () => void
  /** F — панель в фокусе на весь экран (или свернуть развёрнутую). */
  onFullscreen: () => void
  /** ? — подсказка по клавишам. */
  onHelp: () => void
  /** Esc — закрыть подсказку / шторку (полноэкранная панель обрабатывается отдельно). */
  onEscape?: () => void
  enabled?: boolean
}

/** Клавиша пришла из поля ввода — шорткаты студии не должны мешать печатать. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.closest('[contenteditable="true"]') != null
}

/** Глобальные горячие клавиши студии урока: 1/2/3 панели, B доска, F fullscreen, ? помощь. */
export function useStudioShortcuts(h: StudioShortcutHandlers): void {
  const { onPanelKey, onBoard, onFullscreen, onHelp, onEscape, enabled = true } = h
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape') {
        onEscape?.()
        return
      }
      if (isEditableTarget(e.target)) return
      if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
        e.preventDefault()
        onHelp()
        return
      }
      if (e.shiftKey) return
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        e.preventDefault()
        onPanelKey(e.key)
        return
      }
      const code = e.code
      if (code === 'KeyB') {
        e.preventDefault()
        onBoard()
      } else if (code === 'KeyF') {
        e.preventDefault()
        onFullscreen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, onBoard, onEscape, onFullscreen, onHelp, onPanelKey])
}
