import { useId } from 'react'

/**
 * Декоративные иллюстрации хабов «Обучения» (inline SVG, aria-hidden).
 * VrLabArt — баннер VR 3D лаборатории; EmptyStateArt — пустые состояния / «не найдено».
 */

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
