import { useId } from 'react'

/**
 * Кольцо прогресса с градиентной заливкой. Декоративное (aria-hidden):
 * текстовое значение выводит родитель рядом с кольцом.
 */
export function ProgressRing({
  value,
  size = 88,
  stroke = 9,
  className,
  label,
}: {
  /** 0…1 */
  value: number
  size?: number
  stroke?: number
  className?: string
  /** Текст в центре кольца (например, «12%»). */
  label?: string
}) {
  const uid = useId().replace(/:/g, '')
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const dash = v * c

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`pr-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--hub-ga, #5b8cff)' }} />
          <stop offset="1" style={{ stopColor: 'var(--hub-gb, #d946ef)' }} />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(148, 170, 230, 0.16)"
        strokeWidth={stroke}
      />
      {v > 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#pr-${uid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ) : null}
      {label ? (
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fill="currentColor"
          style={{ font: `800 ${Math.round(size * 0.24)}px var(--lt-font-display)` }}
        >
          {label}
        </text>
      ) : null}
    </svg>
  )
}
