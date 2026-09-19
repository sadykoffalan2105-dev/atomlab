import { useEffect, useMemo, useRef } from 'react'
import { cinemaPlayhead } from '../clo2/clo2StepStore'
import { activeStageAt, formatKJ, ladderLevels, type Ladder } from './energyLadderData'
import styles from './EnergyLadder.module.css'

/**
 * ATOMLAB Cinema kit — ЛЕСТНИЦА ЭНЕРГИИ (цикл Борна — Габера).
 *
 * Ступени затрат идут ВВЕРХ (сублимация, диссоциация, ионизация), ступени
 * выигрыша — ВНИЗ (сродство к электрону, энергия решётки). Последняя ступень
 * самая длинная вниз: именно энергия решётки делает весь процесс экзотермическим.
 * Итог — теплота образования ΔH°f.
 *
 * Подсветка идёт за сюжетом сцены: requestAnimationFrame читает cinemaPlayhead
 * и меняет data-атрибуты — без setState на кадр.
 *
 * Тексты приходят СНАРУЖИ (ru/en/uz): подписи ступеней по id, единица, итог.
 */

const W = 320
const H = 132
const PAD_L = 8
const PAD_R = 8
const PAD_T = 16
const PAD_B = 14

export type EnergyLadderText = {
  /** единица измерения, напр. «кДж/моль» */
  unit: string
  /** подписи ступеней по id ступени цикла */
  stages: Readonly<Record<string, string>>
  /** подпись итоговой строки */
  total: string
  /** пояснение под лестницей */
  caption?: string
  /** источники данных */
  sources?: string
  /** aria-label графика; {dH} заменяется суммой */
  summary?: string
}

export function EnergyLadder({
  ladder,
  text,
  compact = false,
}: {
  ladder: Ladder
  text: EnergyLadderText
  compact?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)

  const layout = useMemo(() => {
    const levels = ladderLevels(ladder)
    const max = Math.max(...levels)
    const min = Math.min(...levels)
    const span = max - min || 1
    const y = (v: number) => PAD_T + ((max - v) / span) * (H - PAD_T - PAD_B)
    const n = ladder.stages.length + 1
    const colW = (W - PAD_L - PAD_R) / n
    const cols = ladder.stages.map((s, i) => {
      const x0 = PAD_L + colW * i
      return { id: s.id, dH: s.dH, x0, x1: x0 + colW - 6, yFrom: y(levels[i]!), yTo: y(levels[i + 1]!) }
    })
    return {
      cols,
      total: { x0: PAD_L + colW * ladder.stages.length, x1: W - PAD_R, y: y(levels[levels.length - 1]!) },
      zeroY: y(0),
    }
  }, [ladder])

  useEffect(() => {
    const el = root.current
    if (!el) return
    let raf = 0
    let last = -2
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const active = cinemaPlayhead.runId > 0 ? activeStageAt(ladder, cinemaPlayhead.t) : -1
      if (active === last) return
      last = active
      el.querySelectorAll<HTMLElement>('[data-i]').forEach((node) => {
        const i = Number(node.dataset.i)
        node.dataset.state = i < active ? 'done' : i === active ? 'current' : 'todo'
      })
      el.querySelectorAll<HTMLElement>('[data-total]').forEach((node) => {
        node.dataset.state = active >= ladder.stages.length - 1 ? 'current' : 'todo'
      })
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ladder])

  const totalKJ = Math.round(ladder.sumKJ)
  const summary = (text.summary ?? '{dH}').replace('{dH}', String(totalKJ))

  return (
    <div ref={root} className={styles.wrap} data-compact={compact ? '1' : undefined}>
      <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        <line className={styles.zero} x1={PAD_L} x2={W - PAD_R} y1={layout.zeroY} y2={layout.zeroY} />
        {layout.cols.map((c, i) => (
          <g key={c.id} className={styles.col} data-i={i} data-state="todo">
            <line className={styles.rise} data-sign={c.dH > 0 ? 'up' : 'down'} x1={c.x0} x2={c.x0} y1={c.yFrom} y2={c.yTo} />
            <line className={styles.level} x1={c.x0} x2={c.x1} y1={c.yTo} y2={c.yTo} />
            <text className={styles.val} x={(c.x0 + c.x1) / 2} y={c.dH > 0 ? c.yTo - 5 : c.yTo + 12} textAnchor="middle">
              {formatKJ(c.dH)}
            </text>
          </g>
        ))}
        <g className={`${styles.col} ${styles.total}`} data-total="" data-state="todo">
          <line className={styles.level} x1={layout.total.x0} x2={layout.total.x1} y1={layout.total.y} y2={layout.total.y} />
          <text className={styles.val} x={(layout.total.x0 + layout.total.x1) / 2} y={layout.total.y + 13} textAnchor="middle">
            {formatKJ(totalKJ)}
          </text>
        </g>
      </svg>
      <ul className={styles.list}>
        {ladder.stages.map((s, i) => (
          <li key={s.id} className={styles.row} data-i={i} data-state="todo" data-sign={s.dH > 0 ? 'up' : 'down'}>
            <span className={styles.dot} aria-hidden />
            <span className={styles.eq} translate="no">
              {text.stages[s.id] ?? s.equation}
            </span>
            <span className={styles.num}>
              {formatKJ(s.dH)} {text.unit}
            </span>
          </li>
        ))}
        <li className={`${styles.row} ${styles.sum}`} data-total="" data-state="todo">
          <span className={styles.dot} aria-hidden />
          <span className={styles.eq}>{text.total}</span>
          <span className={styles.num}>
            {formatKJ(totalKJ)} {text.unit}
          </span>
        </li>
      </ul>
      {compact || !text.caption ? null : <p className={styles.caption}>{text.caption}</p>}
      {text.sources ? <p className={styles.caption}>{text.sources}</p> : null}
    </div>
  )
}
