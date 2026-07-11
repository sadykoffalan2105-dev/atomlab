import type { IrPeak } from '../../../data/researchLab/researchLabData'
import styles from '../../../pages/LearnResearchLab.module.css'

/** Учебный ИК-график: ось X = см⁻¹ (4000→600), Y = поглощение. */
export function IrSpectrumChart({
  peaks,
  title,
  emptyLabel,
}: {
  peaks: readonly IrPeak[]
  title: string
  emptyLabel: string
}) {
  const w = 520
  const h = 176
  const padL = 36
  const padR = 12
  const padT = 18
  const padB = 28
  const plotW = w - padL - padR
  const plotH = h - padT - padB

  const wnToX = (wn: number) => padL + ((4000 - wn) / (4000 - 600)) * plotW
  const intToY = (intensity: number) => padT + (1 - intensity) * plotH

  const baselineY = intToY(0.08)
  const path: string[] = [`M ${padL} ${baselineY}`]
  for (let x = 0; x <= plotW; x += 4) {
    const wn = 4000 - (x / plotW) * (4000 - 600)
    let y = 0.08
    for (const p of peaks) {
      const sigma = 55 + (1 - p.intensity) * 40
      const g = p.intensity * Math.exp(-0.5 * ((wn - p.wavenumber) / sigma) ** 2)
      y = Math.max(y, g)
    }
    path.push(`L ${padL + x} ${intToY(y)}`)
  }

  return (
    <div>
      <p className={styles.zoneTitle}>{title}</p>
      {peaks.length === 0 ? (
        <p className={styles.hint}>{emptyLabel}</p>
      ) : (
        <>
          <svg className={styles.irChart} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title}>
            <rect x={padL} y={padT} width={plotW} height={plotH} fill="rgba(4,8,20,0.65)" rx="4" />
            {[1000, 1500, 2000, 2500, 3000, 3500].map((wn) => (
              <g key={wn}>
                <line
                  x1={wnToX(wn)}
                  y1={padT}
                  x2={wnToX(wn)}
                  y2={padT + plotH}
                  stroke="rgba(100,120,160,0.25)"
                  strokeWidth="1"
                />
                <text
                  x={wnToX(wn)}
                  y={h - 8}
                  textAnchor="middle"
                  fill="rgba(160,175,210,0.85)"
                  fontSize="10"
                >
                  {wn}
                </text>
              </g>
            ))}
            <path d={path.join(' ')} fill="none" stroke="#67e8f9" strokeWidth="2" />
            {peaks.map((p) => (
              <g key={`${p.wavenumber}-${p.label}`}>
                <circle cx={wnToX(p.wavenumber)} cy={intToY(p.intensity)} r="3.5" fill="#fbbf24" />
                <text
                  x={wnToX(p.wavenumber)}
                  y={intToY(p.intensity) - 8}
                  textAnchor="middle"
                  fill="#fde68a"
                  fontSize="10"
                >
                  {p.label}
                </text>
              </g>
            ))}
            <text x={padL} y={12} fill="rgba(160,175,210,0.9)" fontSize="10">
              A
            </text>
            <text x={w / 2} y={h - 2} textAnchor="middle" fill="rgba(160,175,210,0.75)" fontSize="9">
              см⁻¹
            </text>
          </svg>
          <div className={styles.irLegend}>
            {peaks.map((p) => (
              <span key={`${p.label}-${p.wavenumber}`} className={styles.irChip}>
                {p.label}: {p.wavenumber} см⁻¹
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
