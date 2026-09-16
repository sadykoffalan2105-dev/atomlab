import type { ReactNode, SVGProps } from 'react'

/** Иконки интерактивного учебника (24×24, stroke = currentColor). */
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>

function Svg({ children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
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

export function IconFlask(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 3h6" />
      <path d="M10 3v5.5L5 17.5A2.3 2.3 0 0 0 7 21h10a2.3 2.3 0 0 0 2-3.5L14 8.5V3" />
      <path d="M7.2 14.5h9.6" />
    </Svg>
  )
}

export function IconScale(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4v16M7 20h10" />
      <path d="M5 8h14" />
      <path d="m5 8-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z" />
    </Svg>
  )
}

export function IconGrid(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </Svg>
  )
}

export function IconMenu(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 6.5h16M4 12h16M4 17.5h10" />
    </Svg>
  )
}

export function IconChevronLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </Svg>
  )
}

export function IconChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </Svg>
  )
}

export function IconChevronDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m6 9.5 6 6 6-6" />
    </Svg>
  )
}

export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  )
}

export function IconArrowLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Svg>
  )
}

export function IconArrowRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  )
}

export function IconPage(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </Svg>
  )
}

export function IconPlay(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5v7l5.5-3.5z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconTeacher(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 5.5h16v10H9l-4 3.5v-3.5H4z" />
      <path d="M8.5 9.5h7M8.5 12.5h4.5" />
    </Svg>
  )
}

export function IconAtom(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" />
    </Svg>
  )
}

export function IconBeaker(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 3.5h14M6.5 3.5V19a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V3.5" />
      <path d="M6.5 12h11" />
    </Svg>
  )
}

export function IconSpark(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4-5.7-1.8L10.2 9z" />
    </Svg>
  )
}

export function IconInfo(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.1" />
    </Svg>
  )
}

export function IconBook(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 6.5C10.3 5 7.8 4.5 4 4.5v13c3.8 0 6.3.5 8 2 1.7-1.5 4.2-2 8-2v-13c-3.8 0-6.3.5-8 2z" />
      <path d="M12 6.5v13" />
    </Svg>
  )
}
