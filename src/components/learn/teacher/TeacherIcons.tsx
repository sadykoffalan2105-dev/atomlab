/**
 * Иконки интерфейса ИИ-учителя (чат + онлайн-урок), которых нет в LearnAiIcons.
 * currentColor, 1em по умолчанию, aria-hidden.
 */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string }

function Svg({ size = '1em', children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function IconCopy(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
    </Svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  )
}

export function IconRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M20 20v-4h-4" />
    </Svg>
  )
}

export function IconPhoneOff(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.6 13.9c-.5-.5-.6-1.3-.1-1.8C5.8 9.8 8.8 8.6 12 8.6s6.2 1.2 8.5 3.5c.5.5.4 1.3-.1 1.8l-1.8 1.5c-.5.4-1.2.4-1.6 0l-1.3-1.3c-.3-.3-.5-.8-.4-1.2l.2-1c-2.3-.7-4.7-.7-7 0l.2 1c.1.4 0 .9-.4 1.2L7 15.4c-.4.4-1.1.4-1.6 0z" />
    </Svg>
  )
}

export function IconVideo(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6" width="12.5" height="12" rx="2.5" />
      <path d="m15.5 10.5 5-3v9l-5-3" />
    </Svg>
  )
}

export function IconVideoOff(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15.5 13.5 20.5 16.5v-9l-5 3" />
      <path d="M11 6h2a2.5 2.5 0 0 1 2.5 2.5V11M15.5 15.5A2.5 2.5 0 0 1 13 18H5.5A2.5 2.5 0 0 1 3 15.5v-7A2.5 2.5 0 0 1 5 6" />
      <path d="m3 3 18 18" />
    </Svg>
  )
}

export function IconMicOff(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 10.5V6a3 3 0 0 0-5.6-1.5" />
      <path d="M9 9v2a3 3 0 0 0 4.7 2.5" />
      <path d="M18.5 11a6.5 6.5 0 0 1-1 3.4M5.5 11a6.5 6.5 0 0 0 10.2 5.3M12 17.5V21" />
      <path d="m3 3 18 18" />
    </Svg>
  )
}

/** «Перебить» — ладонь «стоп». */
export function IconHandStop(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M11 10.5V4.5a1.5 1.5 0 0 1 3 0v6" />
      <path d="M14 10.5V6a1.5 1.5 0 0 1 3 0v7" />
      <path d="M8 11.5V9a1.5 1.5 0 0 0-3 0v5.5a7 7 0 0 0 7 7h.5a6.5 6.5 0 0 0 6.5-6.5V11a1.5 1.5 0 0 0-3 0" />
    </Svg>
  )
}

export function IconBook(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" />
    </Svg>
  )
}

export function IconDatabase(props: IconProps) {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
      <path d="M4.5 5.5v6.5c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V5.5" />
      <path d="M4.5 12v6.5c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V12" />
    </Svg>
  )
}

export function IconBrainSpark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 13.6 8l4.4 1.6-4.4 1.6L12 15.7l-1.6-4.5L6 9.6 10.4 8z" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
      <path d="M5 16l.6 1.4L7 18l-1.4.6L5 20l-.6-1.4L3 18l1.4-.6z" />
    </Svg>
  )
}

export function IconArrowNext(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </Svg>
  )
}

export function IconQuestion(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </Svg>
  )
}

export function IconPhoto(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m21 16-4.5-4.5L7 20" />
    </Svg>
  )
}

export function IconWifiOff(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 8.8A15 15 0 0 1 7 6.1M11 5a15 15 0 0 1 10.5 3.8" />
      <path d="M5.5 12.4a10 10 0 0 1 4-2.2M14.8 10.5a10 10 0 0 1 3.7 1.9" />
      <path d="M9 15.8a5 5 0 0 1 6 0" />
      <circle cx="12" cy="19" r="0.8" fill="currentColor" />
      <path d="m3 3 18 18" />
    </Svg>
  )
}

export function IconShield(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.3 7.5 9.5 4.4-1.2 7.5-4.9 7.5-9.5V6z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </Svg>
  )
}

export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  )
}

export function IconKeyboardSmall(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" />
    </Svg>
  )
}

export function IconMessage(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20l1-4.2A7.5 7.5 0 1 1 20 12.5z" />
    </Svg>
  )
}
