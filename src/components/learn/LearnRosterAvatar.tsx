import styles from './LearnRosterAvatar.module.css'

export type RosterMasteryLevel = 'strong' | 'good' | 'needsWork' | 'none'

type Props = {
  name: string
  size?: 'sm' | 'md' | 'lg'
  /** Цветной статус-индикатор в углу аватара */
  status?: RosterMasteryLevel
  /** Текст статуса для экранных дикторов и подсказки */
  statusLabel?: string
}

const PALETTE = [styles.p0, styles.p1, styles.p2, styles.p3, styles.p4]

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : (parts[0]?.[1] ?? '')
  return `${first}${second}`.toUpperCase()
}

function paletteIndex(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0
  return Math.abs(h) % PALETTE.length
}

const STATUS_CLASS: Record<RosterMasteryLevel, string | undefined> = {
  strong: styles.dotStrong,
  good: styles.dotGood,
  needsWork: styles.dotNeedsWork,
  none: styles.dotNone,
}

export function LearnRosterAvatar({ name, size = 'md', status, statusLabel }: Props) {
  const sizeClass = size === 'sm' ? styles.sm : size === 'lg' ? styles.lg : styles.md
  return (
    <span className={`${styles.avatar} ${sizeClass} ${PALETTE[paletteIndex(name)]}`} aria-hidden={statusLabel ? undefined : true}>
      <span className={styles.initials} aria-hidden="true">
        {initialsOf(name)}
      </span>
      {status ? (
        <span className={`${styles.dot} ${STATUS_CLASS[status] ?? ''}`} title={statusLabel}>
          {statusLabel ? <span className={styles.srOnly}>{statusLabel}</span> : null}
        </span>
      ) : null}
    </span>
  )
}
