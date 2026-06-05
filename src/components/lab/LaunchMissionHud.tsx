import { useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n/useT'
import styles from '../../pages/LaboratoryPage.module.css'

const PHASES = ['lab.launch.phase1', 'lab.launch.phase2', 'lab.launch.phase3', 'lab.launch.phase4'] as const

function phaseIndex(p: number): number {
  if (p < 0.12) return 0
  if (p < 0.45) return 1
  if (p < 0.82) return 2
  return 3
}

/** HUD запуска — читает progress из ref (без setState каждый кадр на странице). */
export function LaunchMissionHud({
  active,
  accentColor,
  progressRef,
}: {
  active: boolean
  accentColor: string
  progressRef: React.MutableRefObject<number>
}) {
  const { t } = useT()
  const [, bump] = useState(0)
  const phaseIdxRef = useRef(0)

  useEffect(() => {
    if (!active) return
    let raf = 0
    const tick = () => {
      const p = progressRef.current
      const idx = phaseIndex(p)
      if (idx !== phaseIdxRef.current) {
        phaseIdxRef.current = idx
        bump((n) => n + 1)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, progressRef])

  if (!active) return null

  const launchProgress = progressRef.current
  const phaseIdx = phaseIndex(launchProgress)

  return (
    <div
      className={styles.launchMissionHud}
      role="status"
      aria-live="polite"
      style={{ ['--launch-accent' as string]: accentColor }}
    >
      <div className={styles.launchMissionScan} aria-hidden />
      <p className={styles.launchMissionTitle}>{t('lab.launch.title')}</p>
      <p className={styles.launchMissionPhase}>{t(PHASES[phaseIdx] ?? PHASES[0])}</p>
      <div className={styles.launchMissionBar} aria-hidden>
        <span
          className={styles.launchMissionBarFill}
          style={{ transform: `translateX(${-120 + launchProgress * 320}%)` }}
        />
      </div>
    </div>
  )
}
