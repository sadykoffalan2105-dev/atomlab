/**
 * Анимированный аватар ИИ-учителя (SVG + CSS, без WebGL).
 *
 * «Атом-собеседник»: светящееся ядро с лицом и тремя орбитами.
 *   listening   — дышащее кольцо, реагирует на громкость микрофона (--level);
 *   hearing     — ученик говорит: кольцо ярче, глаза «внимательно»;
 *   thinking    — электроны быстро бегут по орбитам, взгляд вверх;
 *   speaking    — ядро пульсирует, вокруг «звуковые лучи», рот двигается;
 *   interrupted — короткая янтарная вспышка, «удивлённые» глаза;
 *   paused      — микрофон выключен: приглушённые цвета;
 *   connecting  — медленное вращение, пока готовимся.
 * Уровень микрофона задаётся через `subscribeLevel` без перерисовок React.
 */
import { useEffect, useRef, type CSSProperties } from 'react'
import styles from './TeacherAvatar.module.css'

export type AvatarState = 'connecting' | 'listening' | 'hearing' | 'thinking' | 'speaking' | 'interrupted' | 'paused'

const BAR_COUNT = 30
const BARS = Array.from({ length: BAR_COUNT }, (_, i) => i)

export function TeacherAvatar({
  state,
  size,
  subscribeLevel,
  className,
  label,
}: {
  state: AvatarState
  /** Размер (px). Без него размер задаёт CSS через --avatar-size (по умолчанию 240px). */
  size?: number
  subscribeLevel?: (listener: (rms: number) => void) => () => void
  className?: string
  /** Доступное описание состояния (обычно совпадает с подписью статуса). */
  label?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el || !subscribeLevel) return
    let target = 0
    let current = 0
    let raf = 0
    const unsubscribe = subscribeLevel((rms) => {
      // RMS речи ≈ 0.02–0.25 → 0..1 с мягким «коленом».
      target = Math.min(1, Math.max(0, (rms - 0.008) * 6.5))
    })
    const tick = () => {
      current += (target - current) * (target > current ? 0.45 : 0.12)
      target *= 0.94
      el.style.setProperty('--level', current.toFixed(3))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      unsubscribe()
      cancelAnimationFrame(raf)
      el.style.setProperty('--level', '0')
    }
  }, [subscribeLevel])

  return (
    <div
      ref={rootRef}
      className={`${styles.avatar} ${className ?? ''}`}
      data-state={state}
      style={size ? ({ '--avatar-size': `${size}px` } as CSSProperties) : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className={styles.glow} />
      <span className={styles.ripple} />
      <span className={`${styles.ripple} ${styles.rippleLate}`} />
      <span className={styles.levelRing} />
      <svg className={styles.svg} viewBox="0 0 200 200" aria-hidden focusable="false">
        <defs>
          <radialGradient id="ta-core" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#c7d7ff" />
            <stop offset="34%" stopColor="#6d8dff" />
            <stop offset="70%" stopColor="#7c4dff" />
            <stop offset="100%" stopColor="#b03ce0" />
          </radialGradient>
          <linearGradient id="ta-orbit" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>

        <g className={styles.bars}>
          {BARS.map((i) => (
            <g key={i} transform={`rotate(${(360 / BAR_COUNT) * i} 100 100)`}>
              <rect
                className={styles.bar}
                x="98.6"
                y="31"
                width="2.8"
                height="12"
                rx="1.4"
                style={{ animationDelay: `${-((i * 137) % 900)}ms` }}
              />
            </g>
          ))}
        </g>

        {[0, 60, 120].map((deg, i) => (
          <g key={deg} transform={`rotate(${deg} 100 100)`}>
            <ellipse className={styles.orbit} cx="100" cy="100" rx="84" ry="31" stroke="url(#ta-orbit)" />
            <g transform="translate(100 100) scale(1 0.369)">
              <g className={styles.electronSpin} style={{ animationDelay: `${i * -1.1}s` }}>
                <circle className={styles.electron} cx="84" cy="0" r="5.2" />
              </g>
            </g>
          </g>
        ))}

        <g className={styles.head}>
          <circle className={styles.core} cx="100" cy="100" r="46" fill="url(#ta-core)" />
          <ellipse className={styles.shine} cx="84" cy="80" rx="15" ry="9" />
          <g className={styles.eyes}>
            <ellipse className={styles.eye} cx="85" cy="97" rx="4.6" ry="6.4" />
            <ellipse className={styles.eye} cx="115" cy="97" rx="4.6" ry="6.4" />
          </g>
          <path className={styles.mouth} d="M88 115 Q100 124 112 115" />
        </g>
      </svg>
    </div>
  )
}
