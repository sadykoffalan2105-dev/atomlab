import styles from './VrLabExperimentParams.module.css'
import { useT } from '../../i18n/useT'
import type { VrLabBenchState } from '../../vrLab/types'

type Props = {
  timeScale: number
  concentration: VrLabBenchState['concentration']
  experimentTemperature: number
  onTimeScale: (v: number) => void
  onConcentration: (v: VrLabBenchState['concentration']) => void
  onTemperature: (v: number) => void
}

export function VrLabExperimentParams({
  timeScale,
  concentration,
  experimentTemperature,
  onTimeScale,
  onConcentration,
  onTemperature,
}: Props) {
  const { t } = useT()

  return (
    <section className={styles.panel} aria-label={t('vrLab.params.title')}>
      <h3 className={styles.title}>{t('vrLab.params.title')}</h3>

      <label className={styles.row}>
        <span>{t('vrLab.params.temperature')}</span>
        <input
          type="range"
          min={-10}
          max={100}
          step={1}
          value={experimentTemperature}
          onChange={(e) => onTemperature(Number(e.target.value))}
        />
        <span className={styles.val}>{experimentTemperature}°C</span>
      </label>

      <label className={styles.row}>
        <span>{t('vrLab.params.timeScale')}</span>
        <input
          type="range"
          min={0.1}
          max={5}
          step={0.1}
          value={timeScale}
          onChange={(e) => onTimeScale(Number(e.target.value))}
        />
        <span className={styles.val}>{timeScale.toFixed(1)}×</span>
      </label>

      <label className={styles.row}>
        <span>{t('vrLab.params.concentration')}</span>
        <select
          value={concentration}
          onChange={(e) => onConcentration(e.target.value as VrLabBenchState['concentration'])}
        >
          <option value="dilute">{t('vrLab.params.concDilute')}</option>
          <option value="normal">{t('vrLab.params.concNormal')}</option>
          <option value="concentrated">{t('vrLab.params.concConcentrated')}</option>
        </select>
      </label>
    </section>
  )
}
