import styles from './PeriodicTableCosmos.module.css'

/** Фон страницы таблицы: сине-фиолетовая пустота + движущиеся звёзды. */
export function PeriodicTableCosmos() {
  return (
    <div className={styles.cosmos} aria-hidden>
      <div className={styles.starsFar} />
      <div className={styles.starsNear} />
      <div className={styles.vignette} />
    </div>
  )
}
