import { useMemo, useState } from 'react'
import {
  EQUILIBRIUM_SCENARIOS,
  computeEquilibriumProduct,
  type EquilibriumScenario,
} from '../../../data/researchLab/researchLabData'
import { useLocale } from '../../../i18n/useLocale'
import { useT } from '../../../i18n/useT'
import styles from '../../../pages/LearnResearchLab.module.css'

function mixColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ] as const
  }
  try {
    const [ar, ag, ab] = parse(a)
    const [br, bg, bb] = parse(b)
    const r = Math.round(ar + (br - ar) * t)
    const g = Math.round(ag + (bg - ag) * t)
    const bl = Math.round(ab + (bb - ab) * t)
    return `rgb(${r},${g},${bl})`
  } catch {
    return b
  }
}

export function ResearchEquilibriumMode({ onMacro }: { onMacro: (text: string) => void }) {
  const { t } = useT()
  const { locale } = useLocale()
  const [scenarioId, setScenarioId] = useState(EQUILIBRIUM_SCENARIOS[0]!.id)
  const [temp, setTemp] = useState(50)
  const [pressure, setPressure] = useState(50)
  const [conc, setConc] = useState(50)

  const scenario = useMemo(
    () => EQUILIBRIUM_SCENARIOS.find((s) => s.id === scenarioId) ?? EQUILIBRIUM_SCENARIOS[0]!,
    [scenarioId],
  )

  const product = computeEquilibriumProduct(scenario, temp, pressure, conc)
  const fill = mixColor(scenario.colorLeft, scenario.colorRight, product)

  const title =
    locale === 'en' ? scenario.titleEn : locale === 'uz' ? scenario.titleUz : scenario.titleRu
  const explain =
    locale === 'en' ? scenario.explainEn : locale === 'uz' ? scenario.explainUz : scenario.explainRu

  const particles = useMemo(() => {
    return Array.from({ length: 48 }, (_, i) => {
      const isProduct = i / 48 < product
      return {
        id: i,
        left: `${(i * 17 + 11) % 92}%`,
        top: `${(i * 29 + 7) % 78}%`,
        color: isProduct ? scenario.colorRight : scenario.colorLeft,
        size: 4 + (i % 4),
      }
    })
  }, [product, scenario.colorLeft, scenario.colorRight])

  return (
    <div>
      <div className={styles.challengeBar}>
        {EQUILIBRIUM_SCENARIOS.map((s: EquilibriumScenario) => (
          <button
            key={s.id}
            type="button"
            className={scenarioId === s.id ? `${styles.btn} ${styles.btnPrimary}` : styles.btn}
            onClick={() => {
              setScenarioId(s.id)
              setTemp(50)
              setPressure(50)
              setConc(50)
              onMacro('')
            }}
          >
            {s.id === 'fescn' ? 'FeSCN' : 'NH₃'}
          </button>
        ))}
      </div>
      <p className={styles.hint}>
        <strong>{title}</strong> — {scenario.equation}
      </p>
      <div className={styles.beaker} aria-label={t('learn.research.beakerAria')}>
        <div
          className={styles.beakerFill}
          style={{ height: `${35 + product * 55}%`, background: fill }}
        />
        <div className={styles.particles}>
          {particles.map((p) => (
            <span
              key={p.id}
              className={styles.particle}
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                background: p.color,
                boxShadow: `0 0 8px ${p.color}`,
              }}
            />
          ))}
        </div>
      </div>
      <p className={styles.hint} style={{ marginTop: '0.45rem' }}>
        {t('learn.research.productShare', { n: Math.round(product * 100) })}
      </p>
      <div className={styles.sliders}>
        <label className={styles.sliderRow}>
          <span>{t('learn.research.temp')}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={temp}
            onChange={(e) => setTemp(Number(e.target.value))}
          />
          <span>{temp}</span>
        </label>
        <label className={styles.sliderRow}>
          <span>{t('learn.research.pressure')}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={pressure}
            onChange={(e) => setPressure(Number(e.target.value))}
            disabled={scenario.pressureShift === 0}
          />
          <span>{pressure}</span>
        </label>
        <label className={styles.sliderRow}>
          <span>{t('learn.research.conc')}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={conc}
            onChange={(e) => setConc(Number(e.target.value))}
          />
          <span>{conc}</span>
        </label>
      </div>
      <button
        type="button"
        className={styles.btn}
        style={{ marginTop: '0.55rem' }}
        onClick={() => onMacro(explain)}
      >
        {t('learn.research.explainShift')}
      </button>
    </div>
  )
}
