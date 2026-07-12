import { useEffect, useState, type ReactNode } from 'react'
import { compoundById } from '../data/compounds'
import {
  isLabSynthesisInfraWarmed,
  warmupLabBootReady,
} from '../lab/labSynthesisWarmup'
import styles from './AppBootSplash.module.css'

const MIN_SPLASH_MS = 720
const MAX_SPLASH_MS = 2800

/**
 * Boot-splash: WASM, three/drei, LabScene chunk и layout-кэш до первого кадра.
 * Цель — меньше лагов при первом открытии реактора и +/- коэффициентов.
 */
export function AppBootSplash({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const started = performance.now()
    const maxTimer = window.setTimeout(() => {
      if (!cancelled) setReady(true)
    }, MAX_SPLASH_MS)

    void warmupLabBootReady(Object.values(compoundById))
      .catch(() => undefined)
      .finally(() => {
        const elapsed = performance.now() - started
        const wait = Math.max(0, MIN_SPLASH_MS - elapsed)
        window.setTimeout(() => {
          if (!cancelled) {
            window.clearTimeout(maxTimer)
            setReady(true)
          }
        }, wait)
      })

    // Уже прогретый infra — всё равно дождаться vendor/chunk в этом проходе.
    if (isLabSynthesisInfraWarmed()) {
      /* warmupLabBootReady всё равно прогонит prefetch */
    }

    return () => {
      cancelled = true
      window.clearTimeout(maxTimer)
    }
  }, [])

  if (!ready) {
    return (
      <div className={styles.root} role="status" aria-live="polite" aria-busy="true">
        <div className={styles.glow} aria-hidden />
        <div className={styles.brand}>ATOMLAB</div>
        <div className={styles.hint}>Загрузка лаборатории…</div>
        <div className={styles.barTrack} aria-hidden>
          <div className={styles.barFill} />
        </div>
      </div>
    )
  }

  return children
}
