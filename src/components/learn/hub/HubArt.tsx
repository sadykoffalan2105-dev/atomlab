import { useId } from 'react'
import art from './HubArt.module.css'

/**
 * Декоративные иллюстрации хабов «Обучения» (inline SVG, aria-hidden).
 * VrLabArt — баннер VR 3D лаборатории; EmptyStateArt — пустые состояния / «не найдено»;
 * AiTeacherArt — карточка «Разговор с ИИ-учителем»; AiCoreAvatar — компактное «ядро ИИ» для шапок.
 */

/** 4-лучевая «искра» — общепринятый знак ИИ. (x, y) — центр, r — длина луча. */
function sparkPath(x: number, y: number, r: number) {
  const k = r * 0.28
  return `M${x} ${y - r}C${x + k * 0.35} ${y - k} ${x + k} ${y - k * 0.35} ${x + r} ${y}C${x + k} ${y + k * 0.35} ${
    x + k * 0.35
  } ${y + k} ${x} ${y + r}C${x - k * 0.35} ${y + k} ${x - k} ${y + k * 0.35} ${x - r} ${y}C${x - k} ${y - k * 0.35} ${
    x - k * 0.35
  } ${y - k} ${x} ${y - r}Z`
}

/* Узлы «нейросети» (x, y) и связи: номер узла → номер узла или 'core' (линия к ядру). */
const AI_NODES: readonly (readonly [number, number])[] = [
  [38, 60],
  [84, 28],
  [70, 112],
  [30, 164],
  [108, 176],
  [124, 72],
  [300, 134],
  [288, 222],
]
const AI_LINKS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 2],
  [1, 5],
  [2, 5],
  [2, 3],
  [3, 4],
  [2, 4],
  [6, 7],
]
/** Линии, по которым к ядру бегут импульсы. */
const AI_FEEDS = [5, 2, 4, 6] as const
/** Высоты столбиков звуковой волны (эквалайзер голоса). */
const AI_WAVE = [10, 18, 12, 28, 38, 46, 34, 42, 24, 16, 9] as const

export function AiTeacherArt({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  const coreG = `ai-core-${uid}`
  const haloG = `ai-halo-${uid}`
  const ringG = `ai-ring-${uid}`
  const waveG = `ai-wave-${uid}`
  const glassG = `ai-glass-${uid}`
  const userG = `ai-user-${uid}`
  const cx = 204
  const cy = 108
  const waveY = 190

  return (
    <svg
      className={`${art.ai}${className ? ` ${className}` : ''}`}
      viewBox="0 0 320 260"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id={coreG} cx="0.36" cy="0.32" r="0.72">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.2" stopColor="#cffafe" />
          <stop offset="0.48" stopColor="#22d3ee" />
          <stop offset="0.78" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#4c1d95" />
        </radialGradient>
        <radialGradient id={haloG} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.6" />
          <stop offset="0.45" stopColor="#8b5cf6" stopOpacity="0.26" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ringG} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#67e8f9" stopOpacity="0.12" />
          <stop offset="0.5" stopColor="#67e8f9" stopOpacity="0.95" />
          <stop offset="1" stopColor="#f0abfc" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id={waveG} gradientUnits="userSpaceOnUse" x1={cx - 48} y1="0" x2={cx + 48} y2="0">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.55" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#f472b6" />
        </linearGradient>
        <linearGradient id={glassG} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0f2fe" stopOpacity="0.22" />
          <stop offset="1" stopColor="#a5b4fc" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={userG} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ec4899" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* нейросеть: тонкие связи и узлы */}
      <g stroke="#93c5fd" strokeOpacity="0.22" strokeWidth="1">
        {AI_LINKS.map(([a, b]) => (
          <path key={`${a}-${b}`} d={`M${AI_NODES[a]![0]} ${AI_NODES[a]![1]}L${AI_NODES[b]![0]} ${AI_NODES[b]![1]}`} />
        ))}
        {AI_FEEDS.map((n) => (
          <path key={`f${n}`} d={`M${AI_NODES[n]![0]} ${AI_NODES[n]![1]}L${cx} ${cy}`} />
        ))}
      </g>
      <g stroke="#a5f3fc" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="7 113">
        {AI_FEEDS.map((n, i) => (
          <path
            key={`p${n}`}
            className={art.pulse}
            style={{ animationDelay: `${-i * 0.9}s` }}
            d={`M${AI_NODES[n]![0]} ${AI_NODES[n]![1]}L${cx} ${cy}`}
          />
        ))}
      </g>
      <g fill="#bfdbfe">
        {AI_NODES.map(([x, y], i) => (
          <circle key={i} className={art.twinkle} cx={x} cy={y} r={i % 3 === 0 ? 3 : 2.2} fillOpacity="0.55" />
        ))}
      </g>

      {/* ореол и орбиты вокруг ядра */}
      <circle className={art.halo} cx={cx} cy={cy} r="92" fill={`url(#${haloG})`} />
      <g stroke={`url(#${ringG})`} fill="none">
        <ellipse cx={cx} cy={cy} rx="84" ry="24" strokeWidth="1.7" transform={`rotate(-16 ${cx} ${cy})`} />
        <ellipse
          cx={cx}
          cy={cy}
          rx="74"
          ry="20"
          strokeWidth="1.4"
          strokeOpacity="0.75"
          transform={`rotate(22 ${cx} ${cy})`}
        />
      </g>
      <circle
        className={art.scan}
        cx={cx}
        cy={cy}
        r="50"
        stroke="#a5f3fc"
        strokeOpacity="0.5"
        strokeWidth="1.2"
        strokeDasharray="2 6"
      />
      <circle
        className={art.scanRev}
        cx={cx}
        cy={cy}
        r="60"
        stroke="#c4b5fd"
        strokeOpacity="0.4"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="34 18 6 18 60 40"
      />

      {/* «электроны» на орбитах */}
      <g>
        <circle className={art.twinkle} cx="126" cy="122" r="5" fill="#22d3ee" />
        <circle className={art.twinkle} cx="282" cy="94" r="4.5" fill="#f472b6" />
        <circle className={art.twinkle} cx="137" cy="88" r="3.5" fill="#a78bfa" />
        <circle className={art.twinkle} cx="271" cy="128" r="3.5" fill="#67e8f9" />
      </g>
      <circle cx="126" cy="122" r="10" stroke="#22d3ee" strokeOpacity="0.35" strokeWidth="1.5" />

      {/* ядро ИИ */}
      <g className={art.core}>
        <circle cx={cx} cy={cy} r="34" fill={`url(#${coreG})`} />
        <circle cx={cx} cy={cy} r="34" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.2" />
        <circle cx={cx} cy={cy} r="24" stroke="#fff" strokeOpacity="0.22" strokeWidth="1" />
        <ellipse
          cx={cx - 12}
          cy={cy - 14}
          rx="10"
          ry="5.5"
          fill="#fff"
          fillOpacity="0.4"
          transform={`rotate(-32 ${cx - 12} ${cy - 14})`}
        />
        <path d={sparkPath(cx + 1, cy + 2, 15)} fill="#fff" />
        <path d={sparkPath(cx + 16, cy - 12, 5.5)} fill="#fff" fillOpacity="0.9" />
      </g>

      {/* молекула — намёк на предмет (H₂O) */}
      <g>
        <path d="M151 46 138 58M151 46l14 9" stroke="#e0f2fe" strokeOpacity="0.6" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="151" cy="46" r="7.5" fill="#fb7185" />
        <circle cx="148.5" cy="43.5" r="2.4" fill="#fff" fillOpacity="0.55" />
        <circle cx="138" cy="58" r="4.6" fill="#e0f2fe" />
        <circle cx="165" cy="55" r="4.6" fill="#e0f2fe" />
      </g>

      {/* пузырь ИИ с точками «печатает…» */}
      <g className={art.float}>
        <path
          d="M244 16h42a17 17 0 0 1 0 34h-38l-12 9 2-10.5A17 17 0 0 1 244 16z"
          fill={`url(#${glassG})`}
          stroke="#a5f3fc"
          strokeOpacity="0.55"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <g fill="#e0f2fe">
          <circle className={art.dot} cx="250" cy="33" r="3.4" />
          <circle className={art.dot} cx="265" cy="33" r="3.4" />
          <circle className={art.dot} cx="280" cy="33" r="3.4" />
        </g>
      </g>

      {/* пузырь ученика */}
      <g className={art.floatAlt}>
        <path
          d="M272 162h24a14 14 0 0 1 0 28h-2l1.5 9-10-9H272a14 14 0 0 1 0-28z"
          fill={`url(#${userG})`}
          stroke="#f5d0fe"
          strokeOpacity="0.5"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M268 172h26M268 180h16" stroke="#fff" strokeOpacity="0.8" strokeWidth="2.6" strokeLinecap="round" />
      </g>

      {/* голос: звуковая волна-эквалайзер */}
      <path d={`M112 ${waveY}H300`} stroke={`url(#${waveG})`} strokeOpacity="0.28" strokeWidth="1" />
      <g fill={`url(#${waveG})`}>
        {AI_WAVE.map((h, i) => (
          <rect
            key={i}
            className={art.bar}
            style={{ animationDelay: `${-((i * 0.37) % 1.35)}s` }}
            x={cx - 44 + i * 8}
            y={waveY - h / 2}
            width="4.2"
            height={h}
            rx="2.1"
          />
        ))}
      </g>

      {/* искры */}
      <g fill="#fff">
        <path d={sparkPath(110, 30, 7)} fillOpacity="0.85" />
        <path d={sparkPath(306, 104, 4.5)} fillOpacity="0.7" />
        <path d={sparkPath(150, 226, 4)} fillOpacity="0.55" />
        <circle cx="62" cy="206" r="1.8" fillOpacity="0.5" />
        <circle cx="236" cy="236" r="1.8" fillOpacity="0.5" />
      </g>
    </svg>
  )
}

/** Высоты столбиков широкой «голосовой волны» (детерминированно, без случайности между рендерами). */
const VOICE_BARS = Array.from({ length: 38 }, (_, i) => {
  const env = Math.sin((i / 37) * Math.PI) ** 0.8
  const ripple = 0.55 + 0.45 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6))
  return Math.max(6, Math.round(64 * env * ripple))
})

/**
 * Широкая звуковая волна голоса ИИ (декор шапки страницы разговора). Цвета — фирменный
 * градиент средней насыщенности: читается и на тёмном, и на белом фоне.
 */
export function AiVoiceWave({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  const g = `aiv-${uid}`
  const step = 320 / VOICE_BARS.length

  return (
    <svg
      className={`${art.ai}${className ? ` ${className}` : ''}`}
      viewBox="0 0 320 80"
      fill="none"
      preserveAspectRatio="xMaxYMid meet"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={g} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="320" y2="0">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <path d="M0 40H320" stroke={`url(#${g})`} strokeOpacity="0.3" strokeWidth="1" />
      <g fill={`url(#${g})`}>
        {VOICE_BARS.map((h, i) => (
          <rect
            key={i}
            className={art.bar}
            style={{ animationDelay: `${-((i * 0.29) % 1.35)}s` }}
            x={i * step + step * 0.22}
            y={40 - h / 2}
            width={step * 0.56}
            height={h}
            rx={step * 0.28}
          />
        ))}
      </g>
    </svg>
  )
}

/**
 * Компактный аватар «ядро ИИ» (для шапок и бейджей): светящаяся сфера с искрой, орбита и
 * вращающееся кольцо. Размер задаёт родитель (width/height у svg через className).
 */
export function AiCoreAvatar({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  const coreG = `aic-core-${uid}`
  const haloG = `aic-halo-${uid}`
  const ringG = `aic-ring-${uid}`

  return (
    <svg
      className={`${art.ai}${className ? ` ${className}` : ''}`}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id={coreG} cx="0.36" cy="0.32" r="0.72">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.22" stopColor="#cffafe" />
          <stop offset="0.5" stopColor="#22d3ee" />
          <stop offset="0.8" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#4c1d95" />
        </radialGradient>
        <radialGradient id={haloG} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#8b5cf6" stopOpacity="0.22" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ringG} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#67e8f9" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#f0abfc" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <circle className={art.halo} cx="32" cy="32" r="31" fill={`url(#${haloG})`} />
      <circle
        className={art.scan}
        cx="32"
        cy="32"
        r="25"
        stroke="#a5f3fc"
        strokeOpacity="0.6"
        strokeWidth="1.2"
        strokeDasharray="1.6 4"
      />
      <ellipse
        cx="32"
        cy="32"
        rx="29"
        ry="9"
        stroke={`url(#${ringG})`}
        strokeWidth="1.6"
        transform="rotate(-22 32 32)"
      />
      <g className={art.core}>
        <circle cx="32" cy="32" r="17" fill={`url(#${coreG})`} />
        <circle cx="32" cy="32" r="17" stroke="#fff" strokeOpacity="0.45" strokeWidth="1" />
        <path d={sparkPath(32.5, 33, 8.5)} fill="#fff" />
        <path d={sparkPath(41, 25, 3)} fill="#fff" fillOpacity="0.9" />
      </g>
      <circle className={art.twinkle} cx="5.6" cy="42.6" r="2.6" fill="#22d3ee" />
      <circle className={art.twinkle} cx="58.4" cy="21.4" r="2.2" fill="#f472b6" />
    </svg>
  )
}

export function VrLabArt({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  const glass = `vr-glass-${uid}`
  const liquid = `vr-liquid-${uid}`
  const orbit = `vr-orbit-${uid}`
  const glow = `vr-glow-${uid}`

  return (
    <svg className={className} viewBox="0 0 320 260" fill="none" aria-hidden focusable="false">
      <defs>
        <linearGradient id={glass} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0f2fe" stopOpacity="0.55" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id={liquid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id={orbit} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#67e8f9" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="#67e8f9" stopOpacity="0.9" />
          <stop offset="1" stopColor="#f0abfc" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.55" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* перспективная сетка «пола» */}
      <g stroke="#93c5fd" strokeOpacity="0.22" strokeWidth="1">
        <path d="M20 236h280M52 214h216M78 196h164" />
        <path d="M160 190 40 250M160 190 100 250M160 190v60M160 190l60 60M160 190l120 60" />
      </g>

      <ellipse cx="160" cy="150" rx="120" ry="92" fill={`url(#${glow})`} />

      {/* колба */}
      <path
        d="M140 58h40v40l38 70a18 18 0 0 1-16 26h-84a18 18 0 0 1-16-26l38-70z"
        fill={`url(#${glass})`}
        stroke="#e0f2fe"
        strokeOpacity="0.8"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M113 146h94l11 22a18 18 0 0 1-16 26h-84a18 18 0 0 1-16-26z" fill={`url(#${liquid})`} />
      <path d="M134 52h52" stroke="#e0f2fe" strokeOpacity="0.9" strokeWidth="5" strokeLinecap="round" />
      <circle cx="142" cy="172" r="6" fill="#fff" fillOpacity="0.55" />
      <circle cx="166" cy="160" r="4" fill="#fff" fillOpacity="0.45" />
      <circle cx="182" cy="178" r="3" fill="#fff" fillOpacity="0.5" />
      <path d="M150 70v26" stroke="#fff" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />

      {/* орбиты атома вокруг колбы */}
      <g stroke={`url(#${orbit})`} strokeWidth="2">
        <ellipse cx="160" cy="118" rx="126" ry="34" transform="rotate(-14 160 118)" />
        <ellipse cx="160" cy="118" rx="112" ry="28" transform="rotate(18 160 118)" strokeOpacity="0.7" />
      </g>
      <circle cx="44" cy="140" r="8" fill="#22d3ee" />
      <circle cx="44" cy="140" r="14" stroke="#22d3ee" strokeOpacity="0.35" strokeWidth="2" />
      <circle cx="270" cy="86" r="7" fill="#f472b6" />
      <circle cx="262" cy="150" r="5" fill="#a78bfa" />

      {/* молекула сверху */}
      <g transform="translate(236 20)">
        <path d="M18 22 40 12M18 22l6 24" stroke="#e0f2fe" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
        <circle cx="18" cy="22" r="10" fill="#fbbf24" />
        <circle cx="40" cy="12" r="6.5" fill="#e0f2fe" />
        <circle cx="24" cy="46" r="6.5" fill="#e0f2fe" />
      </g>

      {/* искры */}
      <g fill="#fff">
        <path d="M66 58l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fillOpacity="0.85" />
        <path d="M244 204l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fillOpacity="0.7" />
        <circle cx="96" cy="34" r="2" fillOpacity="0.7" />
        <circle cx="290" cy="196" r="2" fillOpacity="0.6" />
      </g>
    </svg>
  )
}

export function EmptyStateArt({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  const g = `es-${uid}`

  return (
    <svg className={className} viewBox="0 0 160 120" fill="none" aria-hidden focusable="false">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--hub-ga, #5b8cff)' }} />
          <stop offset="1" style={{ stopColor: 'var(--hub-gb, #d946ef)' }} />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="106" rx="54" ry="8" fill="#94aae6" fillOpacity="0.1" />
      <path
        d="M66 16h28v26l26 46a12 12 0 0 1-10.5 18h-59A12 12 0 0 1 40 88l26-46z"
        stroke={`url(#${g})`}
        strokeWidth="3.5"
        strokeLinejoin="round"
        fill="#94aae6"
        fillOpacity="0.06"
      />
      <path d="M61 14h38" stroke={`url(#${g})`} strokeWidth="4" strokeLinecap="round" />
      <path d="M52 78h56" stroke={`url(#${g})`} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 6" />
      <circle cx="72" cy="90" r="4" fill={`url(#${g})`} />
      <circle cx="90" cy="94" r="2.5" fill={`url(#${g})`} fillOpacity="0.7" />
      <path
        d="M118 22a10 10 0 1 1 10 10v6"
        stroke="#b6c0e0"
        strokeOpacity="0.7"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="128" cy="46" r="2.2" fill="#b6c0e0" fillOpacity="0.8" />
      <circle cx="30" cy="30" r="3" fill={`url(#${g})`} fillOpacity="0.6" />
      <circle cx="20" cy="52" r="2" fill={`url(#${g})`} fillOpacity="0.4" />
    </svg>
  )
}
