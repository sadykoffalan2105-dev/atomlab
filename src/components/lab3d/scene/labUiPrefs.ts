/**
 * Выбор режима интерфейса лаборатории: обычный или «электронная доска» (крупные кнопки и шрифт).
 * Порядок: ?board=1|0 в адресе → ручной выбор (localStorage 'atomlab-lab3d-ui') → авто (большой сенсорный экран).
 * Сам режим живёт в labUiMode (общая точка с частью XR); здесь только определение и запоминание выбора.
 */
import { labUiMode, type LabUiMode } from './labUiMode'

const PREF_KEY = 'atomlab-lab3d-ui'

function urlBoardParam(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const fromHash = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('board')
    return fromHash ?? new URLSearchParams(window.location.search).get('board')
  } catch {
    return null
  }
}

/** Интерактивная доска / большой сенсорный экран: грубый указатель, ≥ 900 px по короткой стороне, ≥ 5 касаний. */
export function isLargeTouchBoard(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = !!window.matchMedia?.('(pointer: coarse)').matches
  const big = Math.min(window.innerWidth, window.innerHeight) >= 900
  return coarse && big && (navigator.maxTouchPoints ?? 0) >= 5
}

export function resolveLabUiMode(): LabUiMode {
  const q = urlBoardParam()
  if (q === '1') return 'board'
  if (q === '0') return 'normal'
  try {
    const p = window.localStorage.getItem(PREF_KEY)
    if (p === 'board' || p === 'normal') return p
  } catch {
    /* хранилище недоступно (приватный режим) — авто */
  }
  return isLargeTouchBoard() ? 'board' : 'normal'
}

/** Ручной переключатель «Режим доски»: запоминается для следующих заходов. */
export function chooseLabUiMode(mode: LabUiMode): void {
  try {
    window.localStorage.setItem(PREF_KEY, mode)
  } catch {
    /* не запомнили — режим всё равно включится */
  }
  labUiMode.set(mode)
}
