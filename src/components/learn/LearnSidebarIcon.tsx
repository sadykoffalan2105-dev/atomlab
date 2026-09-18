/**
 * Небольшой набор inline-SVG иконок для боковой панели урока и опросов
 * (вместо эмодзи). Все иконки — контурные, цвет берут из currentColor.
 */

export type LearnSidebarIconName =
  | 'test'
  | 'class'
  | 'tools'
  | 'mcq'
  | 'oral'
  | 'written'
  | 'balance'
  | 'formulas'
  | 'problems'
  | 'info'
  | 'check'
  | 'play'
  | 'chart'
  | 'search'
  | 'upload'
  | 'lock'
  | 'arrowRight'
  | 'flask'
  | 'sparkle'
  | 'users'
  | 'user'
  | 'plus'
  | 'close'
  | 'history'

type Props = {
  name: LearnSidebarIconName
  size?: number
  className?: string
}

function paths(name: LearnSidebarIconName) {
  switch (name) {
    case 'test':
      return (
        <>
          <rect x="5" y="4" width="14" height="17" rx="2.5" />
          <path d="M9 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
          <path d="m8.5 12.5 2.2 2.2 4.8-4.8" />
        </>
      )
    case 'class':
    case 'users':
      return (
        <>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3 20c0-3.3 2.7-5.6 6-5.6s6 2.3 6 5.6" />
          <path d="M16 4.9a3.2 3.2 0 0 1 0 6.2" />
          <path d="M18 14.7c1.9.7 3 2.6 3 5.3" />
        </>
      )
    case 'tools':
      return (
        <path d="M14.7 6.3a4 4 0 0 0-5.2 5.2L3.8 17.2a1.8 1.8 0 0 0 2.6 2.6l5.7-5.7a4 4 0 0 0 5.2-5.2l-2.6 2.6-2.3-.5-.5-2.3 2.8-2.4Z" />
      )
    case 'mcq':
      return (
        <>
          <circle cx="6" cy="7" r="2" />
          <circle cx="6" cy="17" r="2" />
          <path d="M11 7h9M11 17h9" />
          <path d="m4.9 17 .9.9 1.6-1.7" />
        </>
      )
    case 'oral':
      return (
        <>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
          <path d="M12 17.5V21M8.5 21h7" />
        </>
      )
    case 'written':
      return (
        <>
          <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
          <path d="m13.5 6.5 4 4" />
        </>
      )
    case 'balance':
      return (
        <>
          <path d="M12 3v18M7 21h10" />
          <path d="M5 7h14" />
          <path d="m5 7-3 6a3 3 0 0 0 6 0L5 7ZM19 7l-3 6a3 3 0 0 0 6 0l-3-6Z" />
        </>
      )
    case 'formulas':
      return (
        <>
          <path d="M8 4H6a2 2 0 0 0-2 2v4l-1.5 2L4 14v4a2 2 0 0 0 2 2h2" />
          <path d="M16 4h2a2 2 0 0 1 2 2v4l1.5 2-1.5 2v4a2 2 0 0 1-2 2h-2" />
          <path d="m9.5 9 5 6M14.5 9l-5 6" />
        </>
      )
    case 'problems':
      return (
        <>
          <rect x="4" y="3" width="16" height="18" rx="2.5" />
          <path d="M8 7h8" />
          <path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
        </>
      )
    case 'info':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5M12 7.6h.01" />
        </>
      )
    case 'check':
      return <path d="m5 12.5 4.5 4.5L19 7.5" />
    case 'play':
      return <path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.3-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5Z" />
    case 'chart':
      return (
        <>
          <path d="M4 4v16h16" />
          <path d="M8 16v-4M12 16V8M16 16v-6" />
        </>
      )
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.2-4.2" />
        </>
      )
    case 'upload':
      return (
        <>
          <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </>
      )
    case 'lock':
      return (
        <>
          <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </>
      )
    case 'arrowRight':
      return <path d="M5 12h14M13 6l6 6-6 6" />
    case 'flask':
      return (
        <>
          <path d="M9.5 3h5M10 3v6L4.6 18.2A1.9 1.9 0 0 0 6.2 21h11.6a1.9 1.9 0 0 0 1.6-2.8L14 9V3" />
          <path d="M7.2 15h9.6" />
        </>
      )
    case 'sparkle':
      return (
        <path d="M12 3.5 13.9 9l5.6 2-5.6 2L12 18.5 10.1 13l-5.6-2 5.6-2L12 3.5Z" />
      )
    case 'user':
      return (
        <>
          <circle cx="12" cy="8" r="3.6" />
          <path d="M5 20c0-3.7 3.1-6.3 7-6.3s7 2.6 7 6.3" />
        </>
      )
    case 'plus':
      return <path d="M12 5v14M5 12h14" />
    case 'close':
      return <path d="M6 6l12 12M18 6 6 18" />
    case 'history':
      return (
        <>
          <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
          <path d="M3.5 3.5v5h5" />
          <path d="M12 7.5V12l3 2" />
        </>
      )
    default:
      return null
  }
}

export function LearnSidebarIcon({ name, size = 18, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths(name)}
    </svg>
  )
}
