import { useId } from 'react'

/**
 * Декоративный «химический» глиф класса (7–11) для карточек и шапок хабов.
 * Цвета берутся из CSS-переменных --hub-ga / --hub-gb родителя (градиент класса).
 */
export function GradeGlyph({ gradeId, className }: { gradeId: string; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const stroke = `url(#gg-s-${uid})`
  const fill = `url(#gg-f-${uid})`

  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`gg-s-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--hub-ga, #22d3ee)' }} />
          <stop offset="1" style={{ stopColor: 'var(--hub-gb, #3b82f6)' }} />
        </linearGradient>
        <radialGradient id={`gg-f-${uid}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.35" style={{ stopColor: 'var(--hub-ga, #22d3ee)' }} />
          <stop offset="1" style={{ stopColor: 'var(--hub-gb, #3b82f6)' }} />
        </radialGradient>
      </defs>
      {renderGlyph(gradeId, stroke, fill)}
    </svg>
  )
}

function renderGlyph(gradeId: string, stroke: string, fill: string) {
  switch (gradeId) {
    case 'g7':
      /* H₂O: вещество и его частицы */
      return (
        <g>
          <circle cx="60" cy="60" r="44" stroke={stroke} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 6" />
          <path d="M60 58 32 80M60 58l28 22" stroke={stroke} strokeWidth="6" strokeLinecap="round" />
          <circle cx="60" cy="54" r="20" fill={fill} />
          <circle cx="30" cy="82" r="11" fill={fill} fillOpacity="0.85" />
          <circle cx="90" cy="82" r="11" fill={fill} fillOpacity="0.85" />
        </g>
      )
    case 'g8':
      /* Атом Бора: строение атома и периодический закон */
      return (
        <g stroke={stroke} strokeWidth="3">
          <ellipse cx="60" cy="60" rx="48" ry="18" />
          <ellipse cx="60" cy="60" rx="48" ry="18" transform="rotate(60 60 60)" />
          <ellipse cx="60" cy="60" rx="48" ry="18" transform="rotate(-60 60 60)" />
          <circle cx="60" cy="60" r="10" fill={fill} stroke="none" />
          <circle cx="108" cy="60" r="5" fill={fill} stroke="none" />
          <circle cx="36" cy="18.4" r="5" fill={fill} stroke="none" />
          <circle cx="36" cy="101.6" r="5" fill={fill} stroke="none" />
        </g>
      )
    case 'g9':
      /* Кристаллическая решётка: металлы и соли */
      return (
        <g>
          <g stroke={stroke} strokeWidth="3" strokeLinejoin="round">
            <path d="M22 44 58 26l40 14v44L58 100 22 84z" strokeOpacity="0.9" />
            <path d="M22 44l36 16 40-20M58 60v40" />
            <path d="M40 35l40 14v44M22 64l36 16 40-18" strokeOpacity="0.4" />
          </g>
          {[
            [22, 44],
            [58, 26],
            [98, 40],
            [58, 60],
            [22, 84],
            [98, 84],
            [58, 100],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="7" fill={fill} />
          ))}
        </g>
      )
    case 'g10':
      /* Бензольное кольцо: органическая химия */
      return (
        <g>
          <path d="M60 16 98 38v44L60 104 22 82V38z" stroke={stroke} strokeWidth="5" strokeLinejoin="round" />
          <circle cx="60" cy="60" r="21" stroke={stroke} strokeWidth="3.5" strokeOpacity="0.75" />
          <path d="M98 38l14-8M22 82 8 90M60 16V4" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.55" />
          {[
            [60, 16],
            [98, 38],
            [98, 82],
            [60, 104],
            [22, 82],
            [22, 38],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="5.5" fill={fill} />
          ))}
        </g>
      )
    default:
      /* Тетраэдр CH₄: общая химия, строение молекул */
      return (
        <g>
          <g stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeOpacity="0.45">
            <path d="M60 14 18 88h84z" />
            <path d="M60 14 70 72 18 88M70 72l32 16" />
          </g>
          <g stroke={stroke} strokeWidth="5" strokeLinecap="round">
            <path d="M60 62V14M60 62 18 88M60 62l42 26M60 62l10 10" />
          </g>
          <circle cx="60" cy="62" r="15" fill={fill} />
          <circle cx="60" cy="14" r="8" fill={fill} fillOpacity="0.9" />
          <circle cx="18" cy="88" r="8" fill={fill} fillOpacity="0.9" />
          <circle cx="102" cy="88" r="8" fill={fill} fillOpacity="0.9" />
          <circle cx="72" cy="74" r="6" fill={fill} fillOpacity="0.7" />
        </g>
      )
  }
}
