import { useMemo } from 'react'
import { formationPlan } from '../../../chemistry/formationPlan'
import { formationTexts, type FormationLocale } from '../../../chemistry/formationText'
import type { FormationControl } from './useFormation'
import styles from './FormationPanel.module.css'

function toFormationLocale(locale: string): FormationLocale {
  return locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru'
}

/** Кнопка «▶ Как образуется» (показ закрыт) или подписи шагов с управлением (показ идёт). */
export function FormationCaptions({
  compoundId,
  control,
  locale,
  obtainingSection,
}: {
  compoundId: string
  control: FormationControl
  locale: string
  obtainingSection: string
}) {
  const plan = useMemo(() => formationPlan(compoundId), [compoundId])
  const loc = toFormationLocale(locale)
  const texts = useMemo(() => (plan ? formationTexts(plan, loc, obtainingSection) : null), [plan, loc, obtainingSection])
  if (!plan || !texts) return null
  if (!control.active) {
    return (
      <button type="button" className={styles.playBtn} onClick={control.start} data-formation-play="">
        {texts.ui.play}
      </button>
    )
  }
  const s = texts.steps[control.step]
  return (
    <section className={styles.panel} aria-live="polite" data-formation-step={control.step + 1}>
      <ol className={styles.steps}>
        {texts.steps.map((x, i) => (
          <li key={x.title} className={i === control.step ? styles.stepOn : i < control.step ? styles.stepDone : styles.step} aria-current={i === control.step ? 'step' : undefined}>
            <span className={styles.stepNum}>{i + 1}</span>
            <span className={styles.stepTitle}>{x.title}</span>
          </li>
        ))}
      </ol>
      <p className={styles.main}>{s.main}</p>
      <p className={styles.sub}>{s.sub}</p>
      <div className={styles.controls}>
        <button type="button" className={styles.ctrl} onClick={control.toggle} data-formation-toggle="">
          {control.playing ? `❚❚ ${texts.ui.pause}` : `▶ ${texts.ui.resume}`}
        </button>
        <button type="button" className={styles.ctrl} onClick={control.replay} data-formation-replay="">
          ↺ {texts.ui.replay}
        </button>
        <button type="button" className={styles.ctrlGhost} onClick={control.close} data-formation-close="">
          {texts.ui.close}
        </button>
      </div>
      <p className={styles.note}>{texts.note}</p>
    </section>
  )
}
