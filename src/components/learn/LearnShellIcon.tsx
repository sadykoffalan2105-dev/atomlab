/**
 * Небольшой набор линейных SVG-иконок для «рамки» урока (шапка, панели, вкладки).
 * Иконки декоративные: подписи всегда есть рядом (текст, aria-label или title).
 */

export type LearnShellIconName =
  | 'arrowLeft'
  | 'arrowRight'
  | 'check'
  | 'tasks'
  | 'book'
  | 'flask'
  | 'cube'
  | 'pencil'
  | 'sparkles'
  | 'board'
  | 'close'
  | 'maximize'
  | 'minimize'
  | 'clock'
  | 'award'
  | 'layers'
  | 'list'
  | 'plus'
  | 'eyeOff'
  | 'save'

const PATHS: Record<LearnShellIconName, string[]> = {
  arrowLeft: ['M19 12H5', 'M11 18l-6-6 6-6'],
  arrowRight: ['M5 12h14', 'M13 6l6 6-6 6'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  tasks: ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M3.5 6l1.5 1.5L7.5 5', 'M3.5 12l1.5 1.5L7.5 11', 'M3.5 18l1.5 1.5L7.5 17'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2.5H20v19H6.5A2.5 2.5 0 0 1 4 19V5a2.5 2.5 0 0 1 2.5-2.5z'],
  flask: ['M9 3h6', 'M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3', 'M7 15h10'],
  cube: ['M12 2.5l8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5z', 'M3.5 7.25L12 12l8.5-4.75', 'M12 12v9.5'],
  pencil: ['M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z', 'M14.5 7.5l3 3'],
  sparkles: ['M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z', 'M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z'],
  board: ['M3 4h18v12H3z', 'M12 16v4', 'M8 20h8', 'M7 12l3-3 2 2 4-4'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  maximize: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
  minimize: ['M9 4v5H4', 'M15 4v5h5', 'M9 20v-5H4', 'M15 20v-5h5'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  award: ['M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M8.5 13.9L7 22l5-3 5 3-1.5-8.1'],
  layers: ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3.5 6h.01', 'M3.5 12h.01', 'M3.5 18h.01'],
  plus: ['M12 5v14', 'M5 12h14'],
  eyeOff: ['M3 3l18 18', 'M10.6 5.1A10.4 10.4 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3 3.9', 'M6.6 6.6C4 8.3 2.5 12 2.5 12S6 19 12 19a9.6 9.6 0 0 0 5.4-1.6', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'],
  save: ['M5 3h11l3 3v15H5z', 'M8 3v5h7V3', 'M8 21v-7h8v7'],
}

export function LearnShellIcon({
  name,
  size = 16,
  className,
  strokeWidth = 2,
}: {
  name: LearnShellIconName
  size?: number
  className?: string
  strokeWidth?: number
}) {
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
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
