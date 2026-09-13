import { useId } from 'react'

/**
 * Декоративные SVG вторичных хабов «Обучения»: орбитальная «аврора» в шапке
 * и маленькая иллюстрация пустого состояния. Только визуал, aria-hidden.
 */

type ArtProps = { className?: string }

export function LearnHubHeroArt({ className }: ArtProps) {
  const uid = useId().replace(/:/g, '')
  const gA = `hero-a-${uid}`
  const gB = `hero-b-${uid}`
  const glow = `hero-glow-${uid}`

  return (
    <svg className={className} viewBox="0 0 240 200" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gA} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
        <linearGradient id={gB} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="100" r="92" fill={`url(#${glow})`} />
      <ellipse cx="120" cy="100" rx="96" ry="34" stroke={`url(#${gA})`} strokeWidth="2.2" opacity="0.85" />
      <ellipse
        cx="120"
        cy="100"
        rx="96"
        ry="34"
        stroke={`url(#${gA})`}
        strokeWidth="2.2"
        opacity="0.7"
        transform="rotate(60 120 100)"
      />
      <ellipse
        cx="120"
        cy="100"
        rx="96"
        ry="34"
        stroke={`url(#${gB})`}
        strokeWidth="2.2"
        opacity="0.75"
        transform="rotate(-60 120 100)"
      />
      <circle cx="120" cy="100" r="20" fill={`url(#${gA})`} />
      <circle cx="120" cy="100" r="20" fill="#fff" opacity="0.12" />
      <circle cx="216" cy="100" r="7" fill="#22d3ee" />
      <circle cx="72" cy="17" r="6" fill="#fbbf24" />
      <circle cx="72" cy="183" r="6" fill="#ec4899" />
    </svg>
  )
}

export function LearnHubEmptyArt({ className }: ArtProps) {
  const uid = useId().replace(/:/g, '')
  const g = `empty-${uid}`

  return (
    <svg className={className} viewBox="0 0 120 90" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b8cff" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="80" rx="42" ry="6" fill="#5b8cff" opacity="0.14" />
      <path
        d="M48 12h24M52 12v20L34 66a7 7 0 0 0 6.2 10.3h39.6A7 7 0 0 0 86 66L68 32V12"
        stroke={`url(#${g})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M41 56h38l6 11a5 5 0 0 1-4.4 7.3H39.4A5 5 0 0 1 35 67Z" fill={`url(#${g})`} opacity="0.28" />
      <circle cx="54" cy="62" r="3" fill="#22d3ee" />
      <circle cx="66" cy="66" r="2.2" fill="#f472b6" />
      <path d="M92 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#fbbf24" opacity="0.9" />
      <path d="M24 30l1.4 3.4 3.4 1.4-3.4 1.4L24 39.6l-1.4-3.4-3.4-1.4 3.4-1.4Z" fill="#22d3ee" opacity="0.8" />
    </svg>
  )
}
