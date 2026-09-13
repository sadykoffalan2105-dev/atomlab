/**
 * Inline SVG-иконки для вторичных хабов «Обучения» (задачи, пути, кабинет учителя).
 * Стиль: 24×24, обводка currentColor — цвет задаёт родитель.
 */

export type LearnHubIconName =
  | 'arrowLeft'
  | 'arrowRight'
  | 'sparkle'
  | 'flask'
  | 'beaker'
  | 'scale'
  | 'funnel'
  | 'percent'
  | 'layers'
  | 'hexagon'
  | 'bolt'
  | 'ions'
  | 'chain'
  | 'search'
  | 'target'
  | 'users'
  | 'chart'
  | 'download'
  | 'trash'
  | 'check'
  | 'alert'
  | 'clock'
  | 'route'
  | 'book'
  | 'info'
  | 'clipboard'
  | 'plus'
  | 'medal'
  | 'calc'
  | 'list'
  | 'teacher'
  | 'cube'
  | 'refresh'

type Props = {
  name: LearnHubIconName
  size?: number
  className?: string
  strokeWidth?: number
}

function paths(name: LearnHubIconName) {
  switch (name) {
    case 'arrowLeft':
      return <path d="M19 12H5m6-6-6 6 6 6" />
    case 'arrowRight':
      return <path d="M5 12h14m-6-6 6 6-6 6" />
    case 'sparkle':
      return (
        <>
          <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7L4.5 11 10.1 9Z" />
          <path d="M19 3v3m-1.5-1.5h3M5 17.5v3M3.5 19h3" />
        </>
      )
    case 'flask':
      return (
        <>
          <path d="M9 3h6M10 3v6.2L4.8 18.4A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3" />
          <path d="M7.5 15h9" />
        </>
      )
    case 'beaker':
      return (
        <>
          <path d="M5 3h14M6.5 3v15.5A2.5 2.5 0 0 0 9 21h6a2.5 2.5 0 0 0 2.5-2.5V3" />
          <path d="M6.5 12.5c2-.9 3.9-.9 5.5 0s3.6.9 5.5 0" />
        </>
      )
    case 'scale':
      return (
        <>
          <path d="M12 3v18M7 21h10M4 7h16" />
          <path d="m6 7-3 7a3 3 0 0 0 6 0Zm12 0-3 7a3 3 0 0 0 6 0Z" />
        </>
      )
    case 'funnel':
      return <path d="M3.5 4h17l-6.5 8v6.5l-4 2V12Z" />
    case 'percent':
      return (
        <>
          <path d="M19 5 5 19" />
          <circle cx="7" cy="7" r="2.5" />
          <circle cx="17" cy="17" r="2.5" />
        </>
      )
    case 'layers':
      return (
        <>
          <path d="m12 3 9 5-9 5-9-5Z" />
          <path d="m3 13 9 5 9-5" />
        </>
      )
    case 'hexagon':
      return (
        <>
          <path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4Z" />
          <circle cx="12" cy="12" r="2.6" />
        </>
      )
    case 'bolt':
      return <path d="M13 2.5 4.5 13.5H11L10 21.5l8.5-11H12Z" />
    case 'ions':
      return (
        <>
          <circle cx="7.5" cy="12" r="4.5" />
          <circle cx="17" cy="12" r="3.5" />
          <path d="M5.5 12h4M7.5 10v4M15.5 12h3" />
        </>
      )
    case 'chain':
      return (
        <>
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </>
      )
    case 'search':
      return (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m20 20-4.8-4.8" />
        </>
      )
    case 'target':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1" />
        </>
      )
    case 'users':
      return (
        <>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
          <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2A6.5 6.5 0 0 1 21.5 20" />
        </>
      )
    case 'chart':
      return <path d="M4 20V10m6 10V4m6 16v-7m5 7H3" />
    case 'download':
      return <path d="M12 3.5v12m-5-5 5 5 5-5M4.5 20.5h15" />
    case 'trash':
      return <path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5" />
    case 'check':
      return <path d="m4.5 12.5 5 5 10-11" />
    case 'alert':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5M12 16.5v.01" />
        </>
      )
    case 'clock':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </>
      )
    case 'route':
      return (
        <>
          <circle cx="6" cy="18" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <path d="M8.5 18H16a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h7.5" />
        </>
      )
    case 'book':
      return (
        <>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
          <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
        </>
      )
    case 'info':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5M12 7.5v.01" />
        </>
      )
    case 'clipboard':
      return (
        <>
          <path d="M9 4.5H6.5A1.5 1.5 0 0 0 5 6v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20V6a1.5 1.5 0 0 0-1.5-1.5H15" />
          <rect x="9" y="2.5" width="6" height="4" rx="1" />
          <path d="m9 14 2 2 4-4.5" />
        </>
      )
    case 'plus':
      return <path d="M12 5v14M5 12h14" />
    case 'medal':
      return (
        <>
          <path d="M8 2.5 5.5 8M16 2.5 18.5 8M9.5 2.5h5" />
          <circle cx="12" cy="14.5" r="6.5" />
          <path d="m12 11 1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3Z" />
        </>
      )
    case 'calc':
      return (
        <>
          <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
          <path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" />
        </>
      )
    case 'list':
      return <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    case 'teacher':
      return (
        <>
          <path d="M3 5.5h18v10H11" />
          <circle cx="6.5" cy="13" r="2.5" />
          <path d="M2.5 21a4 4 0 0 1 8 0M14 9.5h4" />
        </>
      )
    case 'cube':
      return (
        <>
          <path d="m12 2.8 8 4.6v9.2l-8 4.6-8-4.6V7.4Z" />
          <path d="m4 7.4 8 4.6 8-4.6M12 12v9.2" />
        </>
      )
    case 'refresh':
      return (
        <>
          <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
          <path d="M4 3.5V8h4.5M4 13a8 8 0 0 0 14.3 4.9L20 16" />
          <path d="M20 20.5V16h-4.5" />
        </>
      )
    default:
      return null
  }
}

export function LearnHubIcon({ name, size = 20, className, strokeWidth = 1.8 }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths(name)}
    </svg>
  )
}
