import { useEffect, useMemo, useRef } from 'react'
import { cinemaPlayhead } from '../clo2/clo2StepStore'
import { getNaclMechanismText, type NaclLocale } from './naclMechanismText'
import { NACL_DHF_KJ, naclEnergyActiveStageAt, naclEnergyLadder } from './naclEnergetics'
import styles from './NaclEnergyPanel.module.css'

/**
 * Лестница Борна — Габера для NaCl: ступени затрат вверх, выигрыша вниз,
 * итог — теплота образования. Подсветка ступени идёт за сюжетом сцены:
 * requestAnimationFrame читает cinemaPlayhead и меняет data-атрибуты —
 * без setState на кадр (как у профиля ClO₂).
 */

const W = 320
const H = 132
const PAD_L = 8
const PAD_R = 8
const PAD_T = 16
const PAD_B = 14

function fmt(n: number): string {
  const r = Math.round(n)
  return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r)
}

export function NaclEnergyPanel({ locale, compact = false }: { locale: NaclLocale; compact?: boolean }) {
  const text = getNaclMechanismText(locale)
  const root = useRef<HTMLDivElement>(null)

  const ladder = useMemo(() => naclEnergyLadder(), [])
  const layout = useMemo(() => {
    const levels: number[] = [0]
    for (const s of ladder) levels.push(levels[levels.length - 1]! + s.dH)
    const max = Math.max(...levels)
    const min = Math.min(...levels)
    const span = max - min || 1
    const y = (v: number) => PAD_T + ((max - v) / span) * (H - PAD_T - PAD_B)
    const n = ladder.length + 1
    const colW = (W - PAD_L - PAD_R) / n
    const cols = ladder.map((s, i) => {
      const x0 = PAD_L + colW * i
      const x1 = x0 + colW - 6
      return { id: s.id, dH: s.dH, from: levels[i]!, to: levels[i + 1]!, x0, x1, yFrom: y(levels[i]!), yTo: y(levels[i + 1]!) }
    })
    const total = { x0: PAD_L + colW * ladder.length, x1: W - PAD_R, y: y(levels[levels.length - 1]!) }
    return { cols, total, zeroY: y(0) }
  }, [ladder])

  useEffect(() => {
    const el = root.current
    if (!el) return
    let raf = 0
    let last = -2
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const active = cinemaPlayhead.runId > 0 ? naclEnergyActiveStageAt(cinemaPlayhead.t) : -1
      if (active === last) return
      last = active
      el.querySelectorAll<HTMLElement>('[data-i]').forEach((node) => {
        const i = Number(node.dataset.i)
        node.dataset.state = i < active ? 'done' : i === active ? 'current' : 'todo'
      })
      const sum = el.querySelector<HTMLElement>('[data-total]')
      if (sum) sum.dataset.state = active >= ladder.length - 1 ? 'current' : 'todo'
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ladder.length])

  const summary = text.energy.summary.replace('{dH}', String(NACL_DHF_KJ))

  return (
    <div ref={root} className={styles.wrap} data-compact={compact ? '1' : undefined}>
      <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        <line className={styles.zero} x1={PAD_L} x2={W - PAD_R} y1={layout.zeroY} y2={layout.zeroY} />
        {layout.cols.map((c, i) => (
          <g key={c.id} className={styles.col} data-i={i} data-state="todo">
            <line className={styles.rise} data-sign={c.dH > 0 ? 'up' : 'down'} x1={c.x0} x2={c.x0} y1={c.yFrom} y2={c.yTo} />
            <line className={styles.level} x1={c.x0} x2={c.x1} y1={c.yTo} y2={c.yTo} />
            <text className={styles.val} x={(c.x0 + c.x1) / 2} y={c.dH > 0 ? c.yTo - 5 : c.yTo + 12} textAnchor="middle">
              {fmt(c.dH)}
            </text>
          </g>
        ))}
        <g className={`${styles.col} ${styles.total}`} data-total="" data-state="todo">
          <line className={styles.level} x1={layout.total.x0} x2={layout.total.x1} y1={layout.total.y} y2={layout.total.y} />
          <text className={styles.val} x={(layout.total.x0 + layout.total.x1) / 2} y={layout.total.y + 13} textAnchor="middle">
            {fmt(NACL_DHF_KJ)}
          </text>
        </g>
      </svg>
      <ul className={styles.list}>
        {layout.cols.map((c, i) => (
          <li key={c.id} className={styles.row} data-i={i} data-state="todo" data-sign={c.dH > 0 ? 'up' : 'down'}>
            <span className={styles.dot} aria-hidden />
            <span className={styles.eq} translate="no">
              {text.energy.stages[c.id]}
            </span>
            <span className={styles.num}>
              {fmt(c.dH)} {text.energy.unit}
            </span>
          </li>
        ))}
        <li className={`${styles.row} ${styles.sum}`} data-total="" data-state="todo">
          <span className={styles.dot} aria-hidden />
          <span className={styles.eq}>{text.energy.stages.total}</span>
          <span className={styles.num}>
            {fmt(NACL_DHF_KJ)} {text.energy.unit}
          </span>
        </li>
      </ul>
      {compact ? null : <p className={styles.caption}>{text.energy.caption}</p>}
      <p className={styles.caption}>{text.energy.sources}</p>
    </div>
  )
}
