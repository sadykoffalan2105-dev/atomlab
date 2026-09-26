import type { ReactNode, SVGProps } from 'react'

/** Иконки навигационных хабов «Обучения» (24×24, stroke = currentColor). */
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>

function Svg({ children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
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

export function IconPathways(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="5.5" r="2.5" />
      <path d="M8 18.5h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" />
    </Svg>
  )
}

export function IconTasks(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </Svg>
  )
}

export function IconTeacher(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2.5 9 12 4.5 21.5 9 12 13.5z" />
      <path d="M6.5 11v4.5c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3V11" />
      <path d="M21.5 9v5" />
    </Svg>
  )
}

export function IconResearch(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 3h6" />
      <path d="M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3" />
      <path d="M7.2 14h9.6" />
    </Svg>
  )
}

export function IconVr(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v6a2.5 2.5 0 0 1-2.5 2.5h-3.2l-1.8-2.2a1.9 1.9 0 0 0-3 0L8.7 17H5.5A2.5 2.5 0 0 1 3 14.5z" />
      <circle cx="8" cy="11.5" r="1.6" />
      <circle cx="16" cy="11.5" r="1.6" />
    </Svg>
  )
}

export function IconArrowRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Svg>
  )
}

export function IconArrowLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Svg>
  )
}

export function IconChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  )
}

export function IconBook(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
      <path d="M8.5 7.5h7" />
    </Svg>
  )
}

export function IconClock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  )
}

export function IconLayers(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </Svg>
  )
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  )
}

export function IconPlay(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconFlask(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 3h6" />
      <path d="M10 3v5.5L5 17.5A2.3 2.3 0 0 0 7 21h10a2.3 2.3 0 0 0 2-3.5L14 8.5V3" />
      <circle cx="10.5" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="14" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** ИИ-собеседник: пузырь диалога с «искрой» ИИ внутри. */
export function IconAiChat(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5c-4.9 0-8.5 3.2-8.5 7.4 0 2.2 1 4.1 2.7 5.5L5.5 20.5l4.3-2.2c.7.1 1.4.2 2.2.2 4.9 0 8.5-3.2 8.5-7.6S16.9 3.5 12 3.5z" />
      <path
        d="M12 7.2c.3 1.7 1.1 2.6 2.9 3.2-1.8.6-2.6 1.5-2.9 3.2-.3-1.7-1.1-2.6-2.9-3.2 1.8-.6 2.6-1.5 2.9-3.2z"
        fill="currentColor"
        strokeWidth={1.2}
      />
    </Svg>
  )
}

export function IconSparkles(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4-5.7-1.8L10.2 9z" />
      <path d="M19 3v3M17.5 4.5h3" />
    </Svg>
  )
}
