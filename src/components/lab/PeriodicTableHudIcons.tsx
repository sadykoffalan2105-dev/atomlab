type IconProps = { className?: string }

export function IconAtomGrid({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3 3h5v5H3V3zm9 0h5v5h-5V3zM3 12h5v5H3v-5zm9 0h5v5h-5v-5z"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.55"
      />
      <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 2v3M10 15v3M2 10h3M15 10h3" stroke="currentColor" strokeWidth="1" opacity="0.7" />
    </svg>
  )
}

export function IconSolubility({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M6 4h8l-1.5 11a2 2 0 0 1-2 1.7H9.5a2 2 0 0 1-2-1.7L6 4z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M7 8h6M8 11h4" stroke="currentColor" strokeWidth="0.9" opacity="0.65" />
      <circle cx="13.5" cy="6" r="1.2" fill="currentColor" opacity="0.85" />
    </svg>
  )
}

export function IconInfoHud({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3" y="3" width="14" height="14" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <path d="M10 8.5v5M10 6v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
