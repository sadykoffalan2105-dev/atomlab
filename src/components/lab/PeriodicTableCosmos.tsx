import styles from './PeriodicTableCosmos.module.css'

/** Декоративный космический фон (звёзды, туманности, scanline) — без влияния на вёрстку таблицы. */
export function PeriodicTableCosmos() {
  return (
    <div className={styles.cosmos} aria-hidden>
      <div className={styles.orbitRing} data-size="lg" />
      <div className={styles.orbitRing} data-size="md" />
      <div className={styles.laserGrid} />
      <div className={styles.nebula} />
      <div className={styles.aurora} />
      <div className={styles.starsFar} />
      <div className={styles.starsNear} />
      <div className={styles.sparkles} />
      <div className={styles.scanlines} />
      <div className={styles.vignette} />
    </div>
  )
}
