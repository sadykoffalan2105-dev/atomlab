import styles from './PeriodicTableCosmos.module.css'

/** Фон страницы таблицы: ночной фон Aurora Lab, мягкие сияния + приглушённые звёзды. */
export function PeriodicTableCosmos({ stars = true }: { stars?: boolean }) {
  return (
    <div className={styles.cosmos} data-stars={stars ? 'on' : 'off'} aria-hidden>
      <div className={styles.aurora} />
      <div className={styles.starsFar} />
      <div className={styles.starsNear} />
      <div className={styles.vignette} />
    </div>
  )
}
