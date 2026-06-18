/** Иконка VR-очков для навигации. */
export function IconVrLab({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 10.5C4 8.567 5.567 7 7.5 7h2.2c.9 0 1.73.4 2.3 1.05l.45.5c.57.65 1.4 1.05 2.3 1.05h0c.9 0 1.73-.4 2.3-1.05l.45-.5A3.2 3.2 0 0 1 19.3 7H21.5C22.88 7 24 8.12 24 9.5v4c0 1.38-1.12 2.5-2.5 2.5h-1.2c-1.38 0-2.5-1.12-2.5-2.5v-.5c0-.55-.45-1-1-1s-1 .45-1 1v.5c0 1.38-1.12 2.5-2.5 2.5H9.7c-1.38 0-2.5-1.12-2.5-2.5v-.5c0-.55-.45-1-1-1s-1 .45-1 1v.5C4 15.88 2.88 17 1.5 17H0v-7.5C0 8.12 1.12 7 2.5 7H4v3.5Z"
        fill="currentColor"
        opacity="0.9"
      />
      <circle cx="8" cy="12" r="2.2" fill="#5cffd4" />
      <circle cx="16" cy="12" r="2.2" fill="#5cffd4" />
    </svg>
  )
}
