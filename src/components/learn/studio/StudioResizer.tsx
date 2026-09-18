import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { LearnShellIcon } from '../LearnShellIcon'
import styles from './StudioShell.module.css'

/**
 * Ручка между двумя колонками студии: pointer-drag, двойной клик — сброс,
 * стрелки ←/→ (Shift — крупнее), role="separator".
 */
export function StudioResizer({
  label,
  hint,
  onDelta,
  onReset,
  onDragState,
}: {
  label: string
  hint: string
  /** Сдвиг относительно НАЧАЛА текущего жеста, px (положительный — вправо). */
  onDelta: (deltaPx: number, phase: 'move' | 'end') => void
  onReset: () => void
  onDragState?: (dragging: boolean) => void
}) {
  const startX = useRef<number | null>(null)

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      startX.current = e.clientX
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.dataset.dragging = '1'
      onDragState?.(true)
      e.preventDefault()
    },
    [onDragState],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (startX.current == null) return
      onDelta(e.clientX - startX.current, 'move')
    },
    [onDelta],
  )

  const finish = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (startX.current == null) return
      onDelta(e.clientX - startX.current, 'end')
      startX.current = null
      delete e.currentTarget.dataset.dragging
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      onDragState?.(false)
    },
    [onDelta, onDragState],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 96 : 24
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const d = e.key === 'ArrowLeft' ? -step : step
        onDelta(d, 'move')
        onDelta(d, 'end')
      } else if (e.key === 'Home' || e.key === 'Enter') {
        e.preventDefault()
        onReset()
      }
    },
    [onDelta, onReset],
  )

  return (
    <div
      className={styles.resizer}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title={`${label} · ${hint}`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    >
      <span className={styles.resizerGrip} aria-hidden="true">
        <LearnShellIcon name="grip" size={12} strokeWidth={2.6} />
      </span>
    </div>
  )
}
