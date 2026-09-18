import { useId } from 'react'
import type { StudioWorkspace } from './studioWorkspaces'
import art from './StudioWorkspaceChooser.module.css'

/**
 * Живой глиф рабочего пространства урока (в духе GradeGlyph класса).
 * Цвета берутся из --ws-a / --ws-b родителя, анимация выключается
 * при prefers-reduced-motion (см. StudioWorkspaceChooser.module.css).
 */
export function StudioWorkspaceArt({ ws, className }: { ws: StudioWorkspace; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const stroke = `url(#ws-s-${uid})`
  const fill = `url(#ws-f-${uid})`

  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden focusable="false">
      <defs>
        <linearGradient id={`ws-s-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--ws-a, #a78bfa)' }} />
          <stop offset="1" style={{ stopColor: 'var(--ws-b, #6366f1)' }} />
        </linearGradient>
        <radialGradient id={`ws-f-${uid}`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="0.38" style={{ stopColor: 'var(--ws-a, #a78bfa)' }} />
          <stop offset="1" style={{ stopColor: 'var(--ws-b, #6366f1)' }} />
        </radialGradient>
      </defs>
      {ws === 'teach' ? <TeachArt stroke={stroke} fill={fill} /> : null}
      {ws === 'board' ? <BoardArt stroke={stroke} fill={fill} /> : null}
      {ws === 'ai' ? <AiArt stroke={stroke} fill={fill} /> : null}
    </svg>
  )
}

/** «Обучение»: экран кабинета, вращающаяся молекула и карточка теста. */
function TeachArt({ stroke, fill }: { stroke: string; fill: string }) {
  return (
    <g>
      <rect
        x="14"
        y="20"
        width="92"
        height="66"
        rx="10"
        stroke={stroke}
        strokeWidth="3"
        strokeOpacity="0.85"
      />
      <path d="M46 96h28M60 86v10" stroke={stroke} strokeWidth="3.4" strokeLinecap="round" strokeOpacity="0.6" />
      <g className={art.spin}>
        <ellipse cx="60" cy="53" rx="30" ry="12" stroke={stroke} strokeWidth="2.4" strokeOpacity="0.55" />
        <ellipse
          cx="60"
          cy="53"
          rx="30"
          ry="12"
          transform="rotate(62 60 53)"
          stroke={stroke}
          strokeWidth="2.4"
          strokeOpacity="0.55"
        />
        <circle cx="90" cy="53" r="4.5" fill={fill} />
        <circle cx="46" cy="27.5" r="4" fill={fill} fillOpacity="0.85" />
      </g>
      <circle cx="60" cy="53" r="11" fill={fill} />
      <g className={art.float}>
        <rect
          x="70"
          y="60"
          width="34"
          height="30"
          rx="7"
          fill="var(--lt-surface-solid, var(--lt-surface))"
          stroke={stroke}
          strokeWidth="2.6"
        />
        <path
          d="M77 70.5l4 4 8-8"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M77 82h20" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" strokeOpacity="0.5" />
      </g>
    </g>
  )
}

/** «Интерактивная доска»: рамка доски, рисующаяся кривая и маркер. */
function BoardArt({ stroke, fill }: { stroke: string; fill: string }) {
  return (
    <g>
      <rect x="10" y="18" width="100" height="70" rx="9" stroke={stroke} strokeWidth="3" />
      <path d="M40 100h40M60 88v12" stroke={stroke} strokeWidth="3.4" strokeLinecap="round" strokeOpacity="0.6" />
      <path d="M20 74c10-4 12-30 22-30s10 22 20 22 12-26 22-26" stroke={stroke} strokeWidth="1.8" strokeOpacity="0.2" />
      <path
        className={art.draw}
        d="M20 74c10-4 12-30 22-30s10 22 20 22 12-26 22-26"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M22 30h26" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.45" />
      <g className={art.float}>
        <path
          d="M84 58l14-14a6 6 0 0 1 8 8L92 66l-10 2z"
          fill="var(--lt-surface-solid, var(--lt-surface))"
          stroke={stroke}
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        <circle cx="85" cy="63" r="3.2" fill={fill} />
      </g>
      <rect className={art.blink} x="26" y="66" width="3.4" height="14" rx="1.7" fill={fill} />
    </g>
  )
}

/** «ИИ-учитель»: искра с пульсирующими кольцами и репликой диалога. */
function AiArt({ stroke, fill }: { stroke: string; fill: string }) {
  return (
    <g>
      <circle className={art.pulse} cx="60" cy="60" r="40" stroke={stroke} strokeWidth="2.6" />
      <circle className={art.pulseSlow} cx="60" cy="60" r="40" stroke={stroke} strokeWidth="2.2" />
      <g className={art.spinBack}>
        <circle cx="60" cy="60" r="30" stroke={stroke} strokeWidth="2" strokeOpacity="0.35" strokeDasharray="5 8" />
        <circle cx="90" cy="60" r="3.6" fill={fill} fillOpacity="0.8" />
      </g>
      <path
        d="M60 28c3 17 7 21 24 24-17 3-21 7-24 24-3-17-7-21-24-24 17-3 21-7 24-24z"
        fill={fill}
      />
      <g className={art.float}>
        <path
          d="M70 74h26a7 7 0 0 1 7 7v10a7 7 0 0 1-7 7H84l-8 8v-8h-6a7 7 0 0 1-7-7V81a7 7 0 0 1 7-7z"
          fill="var(--lt-surface-solid, var(--lt-surface))"
          stroke={stroke}
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <path d="M75 83h16M75 90h10" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" strokeOpacity="0.65" />
      </g>
    </g>
  )
}
