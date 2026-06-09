import type { ProgressPoint, ProgressTrend } from '../../learn/learnStudentStats'
import { useT } from '../../i18n/useT'
import styles from './StudentProgressChart.module.css'

type Props = {
  series: ProgressPoint[]
  trend: ProgressTrend
}

const W = 400
const H = 140
const PAD = { t: 12, r: 12, b: 28, l: 36 }

function trendClass(trend: ProgressTrend): string {
  switch (trend) {
    case 'rising':
      return styles.trendRising
    case 'falling':
      return styles.trendFalling
    case 'stable':
      return styles.trendStable
    default:
      return styles.trendNone
  }
}

export function StudentProgressChart({ series, trend }: Props) {
  const { t } = useT()

  if (series.length === 0) {
    return (
      <div className={styles.empty} role="status">
        {t('learn.studentStats.chartEmpty')}
      </div>
    )
  }

  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const n = series.length

  const coords = series.map((p, i) => {
    const x = PAD.l + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
    const y = PAD.t + innerH - (p.pct / 100) * innerH
    return { x, y, pct: p.pct }
  })

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${coords[coords.length - 1]!.x.toFixed(1)} ${(PAD.t + innerH).toFixed(1)} L ${coords[0]!.x.toFixed(1)} ${(PAD.t + innerH).toFixed(1)} Z`

  const trendKey =
    trend === 'rising'
      ? 'learn.studentStats.trend.rising'
      : trend === 'falling'
        ? 'learn.studentStats.trend.falling'
        : trend === 'stable'
          ? 'learn.studentStats.trend.stable'
          : 'learn.studentStats.trend.none'

  return (
    <section className={styles.wrap} aria-labelledby="progress-chart-title">
      <div className={styles.head}>
        <h3 id="progress-chart-title" className={styles.title}>
          {t('learn.studentStats.chartTitle')}
        </h3>
        <span className={`${styles.trendBadge} ${trendClass(trend)}`}>{t(trendKey)}</span>
      </div>

      <svg
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('learn.studentStats.chartAria', {
          n: String(series.length),
          trend: t(trendKey),
        })}
      >
        {[0, 25, 50, 75, 100].map((pct) => {
          const y = PAD.t + innerH - (pct / 100) * innerH
          return (
            <g key={pct}>
              <line
                x1={PAD.l}
                y1={y}
                x2={W - PAD.r}
                y2={y}
                className={styles.gridLine}
              />
              <text x={PAD.l - 6} y={y + 4} className={styles.axisLabel} textAnchor="end">
                {pct}
              </text>
            </g>
          )
        })}

        <path d={areaPath} className={styles.area} />
        <path d={linePath} className={styles.line} fill="none" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={4} className={styles.dot}>
            <title>{`${series[i]!.pct}%`}</title>
          </circle>
        ))}
      </svg>

      <p className={styles.caption}>{t('learn.studentStats.chartCaption')}</p>
    </section>
  )
}
