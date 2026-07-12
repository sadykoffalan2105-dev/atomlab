import { useEffect, useState, type ReactNode } from 'react'
import { compoundById } from '../data/compounds'
import { warmupLabBootReady, type BootWarmupProgress } from '../lab/labSynthesisWarmup'
import styles from './AppBootSplash.module.css'

/** Минимум на экране — пользователь видит бренд; параллельно идёт полный прогрев. */
const MIN_SPLASH_MS = 1400
const MAX_SPLASH_MS = 5200

/**
 * Boot-splash: WASM, three/drei, stress-симуляция K₂Cr₂O₇ (+/- коэфф.), LabScene.
 * Цель — нулевой hitch при первом +/- и Check на тяжёлых уравнениях.
 */
export function AppBootSplash({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [hint, setHint] = useState('Загрузка лаборатории…')

  useEffect(() => {
    let cancelled = false
    const started = performance.now()
    const maxTimer = window.setTimeout(() => {
      if (!cancelled) setReady(true)
    }, MAX_SPLASH_MS)

    void warmupLabBootReady(Object.values(compoundById), (p: BootWarmupProgress) => {
      if (!cancelled) setHint(p.label)
    })
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
        <div className={styles.hint}>{hint}</div>
        <div className={styles.barTrack} aria-hidden>
          <div className={styles.barFill} />
        </div>
      </div>
    )
  }

  return children
}
