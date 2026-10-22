import { useEffect, useState, type ReactNode } from 'react'
import type { BootWarmupProgress } from '../lab/labSynthesisWarmup'
import styles from './AppBootSplash.module.css'

/** Минимум на экране — пользователь видит бренд; параллельно идёт полный прогрев. */
const MIN_SPLASH_MS = 2200
const MAX_SPLASH_MS = 8000

/**
 * Boot-splash: WASM, three/drei, stress-симуляция K₂Cr₂O₇ (+/- коэфф.), LabScene.
 * Цель — нулевой hitch при первом +/- и Check на тяжёлых уравнениях.
 */
/** Главная (#/) — лаборатория: только ей нужен прогрев перед первым кадром. */
function isLabRoute(): boolean {
  const h = window.location.hash
  return h === '' || h === '#' || h === '#/' || h.startsWith('#/?')
}

export function AppBootSplash({ children }: { children: ReactNode }) {
  // Урок, учебник, каталог и др. открываются сразу: прогрев лаборатории (WASM, 3D-движки, база веществ ≈ 3 МБ)
  // на медленном интернете минуту держал любую страницу пустой. Заставка с прогревом — только на главной.
  const [onLab] = useState(isLabRoute)
  const [ready, setReady] = useState(!onLab)
  const [hint, setHint] = useState('Загрузка лаборатории…')

  useEffect(() => {
    if (!onLab) return
    let cancelled = false
    const started = performance.now()
    const maxTimer = window.setTimeout(() => {
      if (!cancelled) setReady(true)
    }, MAX_SPLASH_MS)

    void Promise.all([import('../data/compounds'), import('../lab/labSynthesisWarmup')])
      .then(([c, w]) =>
        w.warmupLabBootReady(Object.values(c.compoundById), (p: BootWarmupProgress) => {
          if (!cancelled) setHint(p.label)
        }),
      )
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
  }, [onLab])

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
