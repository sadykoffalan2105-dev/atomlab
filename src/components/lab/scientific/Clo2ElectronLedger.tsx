import { useEffect, useRef } from 'react'
import {
  CLO2_LEDGER_STAGES,
  CLO2_VALENCE_TOTAL,
  clo2LedgerStageAt,
  clo2OrbitalOccupancy,
  clo2OrbitalPhaseAt,
  type Clo2OrbitalPhase,
} from '../../../lab/cinema/scenes/clo2/clo2Energetics'
import { getClo2MechanismText, type Clo2Locale } from '../../../lab/cinema/scenes/clo2/clo2MechanismText'
import { clo2Playhead } from '../../../lab/cinema/scenes/clo2/clo2StepStore'
import styles from './Clo2EnergyProfile.module.css'

/**
 * HUD-строка урока ClO₂: «валентных e⁻: 54» (не меняется — атомы и заряд
 * сохраняются) и бейдж занятости орбитали 2b₁: 2 у хлорита → 1 у радикала ClO₂
 * после распада комплекса (метки 'split' → 'radicals').
 *
 * Story time читается из clo2Playhead в requestAnimationFrame; DOM пишется
 * через рефы и только при смене стадии — React на кадр не просыпается.
 */

const PHASE_ATTR: readonly string[] = ['0', '1', '2']
const COUNT_TEXT: readonly string[] = ['2', '2 → 1', '1']

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => vars[key] ?? m)
}

function ariaFor(template: string, stage: number, phase: Clo2OrbitalPhase): string {
  const s = CLO2_LEDGER_STAGES[stage]!
  return fill(template, {
    n: String(CLO2_VALENCE_TOTAL),
    breakdown: `${s.formula}: ${s.breakdown}`,
    occ: String(clo2OrbitalOccupancy(phase)),
  })
}

function writeStage(el: HTMLElement, stage: number): void {
  el.textContent = CLO2_LEDGER_STAGES[stage]!.breakdown
  el.title = CLO2_LEDGER_STAGES[stage]!.formula
}

function writePhase(badge: HTMLElement, count: HTMLElement, phase: Clo2OrbitalPhase): void {
  badge.setAttribute('data-phase', PHASE_ATTR[phase]!)
  count.textContent = COUNT_TEXT[phase]!
}

export function Clo2ElectronLedger({ locale }: { locale: Clo2Locale }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const breakdownRef = useRef<HTMLSpanElement>(null)
  const badgeRef = useRef<HTMLSpanElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)
  const text = getClo2MechanismText(locale).ledger

  useEffect(() => {
    const root = rootRef.current
    const breakdown = breakdownRef.current
    const badge = badgeRef.current
    const count = countRef.current
    if (!root || !breakdown || !badge || !count) return
    let lastStage = -1
    let lastPhase = -1
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const t = clo2Playhead.t
      const stage = clo2LedgerStageAt(t)
      const phase = clo2OrbitalPhaseAt(t)
      if (stage === lastStage && phase === lastPhase) return
      if (stage !== lastStage) writeStage(breakdown, stage)
      if (phase !== lastPhase) writePhase(badge, count, phase)
      lastStage = stage
      lastPhase = phase
      root.setAttribute('aria-label', ariaFor(text.aria, stage, phase))
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [text.aria])

  return (
    <div ref={rootRef} className={styles.ledger} role="group">
      <span className={styles.ledgerChip} title={text.valenceHint}>
        <span className={styles.ledgerLabel}>{text.valence}:</span>
        <span className={styles.ledgerTotal}>{CLO2_VALENCE_TOTAL}</span>
        <span ref={breakdownRef} className={styles.ledgerBreakdown} />
      </span>
      <span ref={badgeRef} className={styles.orbitalBadge} title={text.orbitalHint}>
        <span className={styles.orbitalName}>{text.orbital}</span>
        <span className={styles.orbitalBox} aria-hidden>
          <span className={styles.spinUp}>↑</span>
          <span className={styles.spinDown}>↓</span>
        </span>
        <span ref={countRef} className={styles.orbitalCount} />
      </span>
    </div>
  )
}
