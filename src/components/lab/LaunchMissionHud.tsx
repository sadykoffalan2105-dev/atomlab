import { useMemo } from 'react'
import { useT } from '../../i18n/useT'
import styles from '../../pages/LaboratoryPage.module.css'

const PHASES = ['lab.launch.phase1', 'lab.launch.phase2', 'lab.launch.phase3', 'lab.launch.phase4'] as const

export function LaunchMissionHud({
  active,
  accentColor,
  launchProgress = 0,
}: {
  active: boolean
  accentColor: string
  /** 0…1 — синхронизация с ходом синтеза */
  launchProgress?: number
}) {
  const { t } = useT()

  const phaseIdx = useMemo(() => {
    const p = Math.max(0, Math.min(1, launchProgress))
    if (p < 0.12) return 0
    if (p < 0.45) return 1
    if (p < 0.82) return 2
    return 3
  }, [launchProgress])

  if (!active) return null

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
