import { useEffect, useState, type ReactNode } from 'react'
import { compoundById } from '../data/compounds'
import {
  isLabSynthesisInfraWarmed,
  prefetchLabThreeVendor,
  warmupLabSynthesisInfra,
} from '../lab/labSynthesisWarmup'
import { ensureReactorBalanceWasmReady } from '../wasm/reactorBalanceWasm'
import styles from './AppBootSplash.module.css'

const MIN_SPLASH_MS = 520

/**
 * Короткий boot-splash: прогрев WASM / three / layout-кэша до первого кадра лаборатории.
 * Убирает холодные hitch при первом +/- коэффициентов.
 */
export function AppBootSplash({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => isLabSynthesisInfraWarmed())

  useEffect(() => {
    if (ready) return
    let cancelled = false
    const started = performance.now()
    warmupLabSynthesisInfra(Object.values(compoundById))
    prefetchLabThreeVendor()

    void Promise.all([
      ensureReactorBalanceWasmReady().catch(() => undefined),
      import('@react-three/fiber'),
      import('three'),
    ]).finally(() => {
      const wait = Math.max(0, MIN_SPLASH_MS - (performance.now() - started))
      window.setTimeout(() => {
        if (!cancelled) setReady(true)
      }, wait)
    })

    return () => {
      cancelled = true
    }
  }, [ready])

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
