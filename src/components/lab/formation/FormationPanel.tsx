import { useEffect, useMemo } from 'react'
import { formationEquation } from '../../../chemistry/formationEquation'
import { formationPlan } from '../../../chemistry/formationPlan'
import { formationTexts, type FormationLocale } from '../../../chemistry/formationText'
import { formationStageTexts } from './formationStageText'
import { formationStoryFor } from './formationStory'
import { FORMATION_SPEEDS, type FormationControl } from './useFormation'
import { FormationBoard } from './board/FormationBoard'
import styles from './FormationPanel.module.css'

function toFormationLocale(locale: string): FormationLocale {
  return locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru'
}

const fmtT = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

/**
 * Кнопка «▶ Как образуется» (показ закрыт) или панель показа «от и до»: шкала этапов (ширина — по длительности),
 * заголовок и подписи этапа, уравнение образования, ⏮ ⏯ ⏭, скорость 0,5× / 1× / 1,5×, ползунок времени.
 */
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
  const story = useMemo(() => formationStoryFor(compoundId), [compoundId])
  const eq = useMemo(() => formationEquation(compoundId), [compoundId])
  const loc = toFormationLocale(locale)
  const texts = useMemo(() => (plan && story ? formationStageTexts(plan, story, eq, loc, obtainingSection) : null), [plan, story, eq, loc, obtainingSection])
  const playLabel = useMemo(() => (plan ? formationTexts(plan, loc, obtainingSection).ui.play : null), [plan, loc, obtainingSection])
  // Шаг по этапам стрелками ← → (кроме полей ввода: у ползунка стрелки — свои).
  const { active, prev, next } = control
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, prev, next])
  if (!plan || !playLabel) return null
  if (!control.active || !texts || !story) {
    return (
      <button type="button" className={styles.playBtn} onClick={control.start} data-formation-play="">
        {playLabel}
      </button>
    )
  }
  const i = Math.min(control.step, texts.stages.length - 1)
  const s = texts.stages[i]!
  const n = texts.stages.length
  return (
    <section className={styles.panel} aria-live="polite" data-formation-step={i + 1} data-formation-stage={s.key}>
      <ol className={styles.track} aria-label={texts.ui.stage}>
        {story.stages.map((st, k) => {
          const fill = k < i ? 1 : k > i ? 0 : Math.max(0, Math.min(1, (control.time - st.t0) / st.dur))
          return (
            <li key={st.key} className={styles.seg} data-stage-key={st.key} style={{ flexGrow: st.dur }} title={texts.stages[k]!.title} aria-current={k === i ? 'step' : undefined}>
              <button type="button" className={styles.segBtn} onClick={() => control.seek(st.t0)} aria-label={`${texts.ui.stage} ${k + 1}: ${texts.stages[k]!.title}`}>
                <span className={styles.segFill} style={{ transform: `scaleX(${fill})` }} />
              </button>
              {/* Подпись этапа под шкалой: текущий — целиком и ярко, остальные — коротко (полностью в title). */}
              <span className={k === i ? styles.segLabelOn : styles.segLabel} aria-hidden="true">
                {texts.stages[k]!.title}
              </span>
            </li>
          )
        })}
      </ol>
      <p className={styles.stageHead}>
        <span className={styles.stageNum}>
          {texts.ui.stage} {i + 1}/{n}
        </span>
        <span className={styles.stageTitle}>{s.title}</span>
      </p>
      <p className={styles.main}>{s.main}</p>
      <p className={styles.sub}>{s.sub}</p>
      <FormationBoard compoundId={compoundId} plan={plan} stage={story.stages[i]?.key ?? 'final'} loc={loc} refText={s.ref} />
      <div className={styles.eqBox} data-formation-equation="">
        <span className={styles.eqLead}>{texts.equation.lead}:</span>
        <span className={styles.eqText}>{texts.equation.text}</span>
        {texts.equation.lab ? (
          <span className={styles.eqLab}>
            {texts.equation.labLead}: {texts.equation.lab}
          </span>
        ) : null}
        {texts.equation.special ? (
          <span className={styles.eqLab} data-formation-special="">
            <b>{texts.equation.specialLead}:</b> {texts.equation.special}
          </span>
        ) : null}
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.ctrlIcon} onClick={control.prev} aria-label={texts.ui.prev} title={texts.ui.prev} data-formation-prev="">
          ⏮
        </button>
        <button type="button" className={styles.ctrl} onClick={control.toggle} data-formation-toggle="">
          {control.playing ? `❚❚ ${texts.ui.pause}` : `▶ ${texts.ui.resume}`}
        </button>
        <button type="button" className={styles.ctrlIcon} onClick={control.next} aria-label={texts.ui.next} title={texts.ui.next} data-formation-next="">
          ⏭
        </button>
        <span className={styles.speeds} role="group" aria-label={texts.ui.speed}>
          {FORMATION_SPEEDS.map((x) => (
            <button
              key={x}
              type="button"
              className={x === control.speed ? styles.speedOn : styles.speed}
              aria-pressed={x === control.speed}
              onClick={() => control.setSpeed(x)}
              data-formation-speed={x}
            >
              {String(x).replace('.', loc === 'en' ? '.' : ',')}×
            </button>
          ))}
        </span>
        <button type="button" className={styles.ctrl} onClick={control.replay} data-formation-replay="">
          ↺ {texts.ui.replay}
        </button>
        <button type="button" className={styles.ctrlGhost} onClick={control.close} data-formation-close="">
          {texts.ui.close}
        </button>
      </div>
      <label className={styles.timeRow}>
        <span className={styles.timeText}>{fmtT(control.time)}</span>
        <input
          type="range"
          className={styles.range}
          min={0}
          max={Math.ceil(control.total * 10) / 10}
          step={0.1}
          value={Math.min(control.time, control.total)}
          onChange={(e) => control.seek(Number(e.currentTarget.value))}
          aria-label={texts.ui.time}
          data-formation-seek=""
        />
        <span className={styles.timeText}>{fmtT(control.total)}</span>
      </label>
      <p className={styles.note}>{texts.note}</p>
    </section>
  )
}
