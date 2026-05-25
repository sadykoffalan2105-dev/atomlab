import type { ReactNode } from 'react'
import styles from './LearnArtShell.module.css'

export function LearnArtShell({
  accent,
  children,
  className,
}: {
  accent: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`${styles.shell} ${className ?? ''}`}
      style={{ ['--learn-art-accent' as string]: accent }}
    >
      {children}
    </div>
  )
}

export function LearnArtSvgFrame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {children}
    </svg>
  )
}
